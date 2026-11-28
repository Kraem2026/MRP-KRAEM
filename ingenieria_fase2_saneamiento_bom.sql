-- ============================================================================
-- KRAEM by APEX SYSTEM — Fase 2 Ingeniería & BOM: Saneamiento No Destructivo O(N)
-- Estrategia ERP/SAP:
--   * Consolida atributos técnicos en el registro canónico de public.parts en una sola pasada O(N)
--   * Re-apunta referencias hacia keep_id (omitiendo tablas sin filas) y archiva duplicados
--   * Reclasifica partes canónicas en PT / SUB-ENSAMBLE / COMPONENTE
--   * Crea los SKUs reales de RESINA (unit_of_measure = 'KG')
--   * Desactiva auto-referencias y duplicados en bom_structures (is_active = false)
--   * Enlaza cada pieza moldeada (PT / SUB-ENSAMBLE) con su RESINA en KG/pieza
--   * Aplica índices únicos parciales, CHECK activo, vistas canónicas y explorar_bom_multinivel
-- ============================================================================

-- 1. Columna de archivado lógico en parts + sincronización de secuencias
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS is_archived_duplicate boolean NOT NULL DEFAULT false;

SELECT setval('public.parts_id_seq', COALESCE((SELECT max(id) FROM public.parts), 1), true);
SELECT setval('public.bom_structures_id_seq', COALESCE((SELECT max(id) FROM public.bom_structures), 1), true);

-- 2. Función auxiliar inmutable para distinguir grados reales de resina vs ecos del N/P
CREATE OR REPLACE FUNCTION public.is_real_resin_grade(g text, pn text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT
    g IS NOT NULL
    AND pg_catalog.btrim(g) <> ''
    AND pg_catalog.btrim(g) <> '-'
    AND pg_catalog.btrim(g) !~ '^[0-9.]+(\*[0-9.]+)+[a-zA-Z]*$'
    AND pg_catalog.regexp_replace(pg_catalog.upper(pg_catalog.btrim(g)), '[^A-Z0-9]', '', 'g')
        <> pg_catalog.regexp_replace(pg_catalog.upper(pg_catalog.btrim(COALESCE(pn, ''))), '[^A-Z0-9]', '', 'g')
    AND pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(pg_catalog.upper(pg_catalog.btrim(g)), '[_ -]+(SY|KS|DH|KR|SC|HC|WK)$', ''),
          '[^A-Z0-9]', '', 'g'
        )
        <> pg_catalog.regexp_replace(pg_catalog.upper(pg_catalog.btrim(COALESCE(pn, ''))), '[^A-Z0-9]', '', 'g');
$fn$;

-- 3. Consolidar mejores valores técnicos en keep_id = min(id) en una sola pasada O(N)
WITH grp AS (
  SELECT
    upper(btrim(p.part_number)) AS norm_pn,
    min(p.id) AS keep_id,
    (array_agg(btrim(p.part_number) ORDER BY p.id ASC))[1] AS clean_pn,
    (array_agg(
       btrim(regexp_replace(p.part_name, '[\r\n]+', ' ', 'g'))
       ORDER BY (position('??' IN COALESCE(p.part_name, '')) = 0) DESC,
                length(btrim(regexp_replace(COALESCE(p.part_name, ''), '[\r\n]+', ' ', 'g'))) DESC,
                p.id DESC
     ) FILTER (WHERE NULLIF(btrim(regexp_replace(COALESCE(p.part_name, ''), '[\r\n]+', ' ', 'g')), '') IS NOT NULL))[1] AS best_name,
    (array_agg(btrim(p.project) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.project), '') IS NOT NULL))[1] AS part_project,
    (array_agg(btrim(p.client) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.client), '') IS NOT NULL))[1] AS part_client,
    (array_agg(btrim(p.supplier) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.supplier), '') IS NOT NULL))[1] AS best_supplier,
    (array_agg(btrim(p.resin_grade) ORDER BY p.id DESC)
       FILTER (WHERE COALESCE(p.product_type, '') <> 'COMPONENTE' AND public.is_real_resin_grade(p.resin_grade, p.part_number)))[1] AS part_resin_grade,
    (array_agg(btrim(p.resin_type) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.resin_type), '') IS NOT NULL))[1] AS best_resin_type,
    (array_agg(btrim(p.color) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.color), '') IS NOT NULL))[1] AS best_color,
    (array_agg(btrim(p.customer_part_number) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.customer_part_number), '') IS NOT NULL))[1] AS best_cust_pn,
    (array_agg(btrim(p.image_url) ORDER BY p.id DESC) FILTER (WHERE NULLIF(btrim(p.image_url), '') IS NOT NULL))[1] AS best_image_url,
    (array_agg(p.default_location_id ORDER BY p.id DESC) FILTER (WHERE p.default_location_id IS NOT NULL))[1] AS best_loc_id,
    bool_or(p.product_type = 'COMPONENTE') AS was_ever_comp,
    bool_or(p.product_type = 'PT') AS was_ever_pt,
    bool_or(p.product_type = 'RESINA') AS was_ever_resina,
    max(COALESCE(p.cavities, 0)) AS grp_max_cav,
    max(COALESCE(p.cycle_time_seg, 0)) AS grp_max_cyc,
    max(COALESCE(p.part_weight_gr, 0)) AS grp_max_wt,
    max(COALESCE(p.runner_weight_gr, 0)) AS grp_max_run,
    max(COALESCE(p.std_pack, 0)) AS grp_max_std_pack,
    max(COALESCE(p.safety_stock, 0)) AS grp_max_ss,
    max(COALESCE(p.min_lot_size, 0)) AS grp_max_min_lot,
    GREATEST(1, max(COALESCE(p.lot_rounding, 1))) AS grp_max_lot_round,
    max(COALESCE(p.lead_time_days, 0)) AS grp_max_lt,
    max(COALESCE(p.scrap_pct, 0)) AS grp_max_scrap,
    max(COALESCE(p.regrind_pct, 0)) AS grp_max_regrind,
    bool_and(COALESCE(p.obsolete, false)) AS all_obsolete
  FROM public.parts p
  GROUP BY upper(btrim(p.part_number))
),
bom_best_grade AS (
  SELECT DISTINCT ON (upper(btrim(pc2.part_number)))
    upper(btrim(pc2.part_number)) AS norm_pn,
    btrim(b2.material_grade) AS bom_resin_grade
  FROM public.bom_structures b2
  JOIN public.parts pc2 ON pc2.id = b2.child_id
  WHERE upper(COALESCE(b2.unit, '')) = 'KG'
    AND public.is_real_resin_grade(b2.material_grade, pc2.part_number)
  ORDER BY upper(btrim(pc2.part_number)), COALESCE(b2.net_weight_kg, 0) DESC, b2.id ASC
),
bom_child_stats AS (
  SELECT
    upper(btrim(pc.part_number)) AS norm_pn,
    max(NULLIF(btrim(b.car_model), '')) AS bom_project,
    max(NULLIF(btrim(b.client), '')) AS bom_client,
    max(COALESCE(b.cavities, 0)) FILTER (WHERE upper(COALESCE(b.unit, '')) = 'KG') AS bom_max_cav,
    max(COALESCE(b.cycle_time_sec, 0)) FILTER (WHERE upper(COALESCE(b.unit, '')) = 'KG') AS bom_max_cyc,
    max(COALESCE(b.net_weight_kg, 0)) FILTER (WHERE upper(COALESCE(b.unit, '')) = 'KG' AND COALESCE(b.net_weight_kg, 0) > 0) AS bom_max_net_kg,
    max(COALESCE(b.gate_weight_kg, 0)) FILTER (WHERE upper(COALESCE(b.unit, '')) = 'KG' AND COALESCE(b.net_weight_kg, 0) > 0) AS bom_max_gate_kg
  FROM public.bom_structures b
  JOIN public.parts pc ON pc.id = b.child_id
  GROUP BY upper(btrim(pc.part_number))
),
canon AS (
  SELECT
    g.keep_id,
    g.clean_pn,
    g.best_name,
    COALESCE(g.part_project, bcs.bom_project) AS best_project,
    COALESCE(g.part_client, bcs.bom_client) AS best_client,
    g.best_supplier,
    COALESCE(bbg.bom_resin_grade, g.part_resin_grade) AS best_resin_grade,
    g.best_resin_type,
    g.best_color,
    g.best_cust_pn,
    g.best_image_url,
    g.best_loc_id,
    GREATEST(g.grp_max_cav, COALESCE(bcs.bom_max_cav, 0)) AS best_cavities,
    GREATEST(g.grp_max_cyc, COALESCE(bcs.bom_max_cyc, 0)) AS best_cycle,
    CASE
      WHEN COALESCE(bcs.bom_max_net_kg, 0) > 0 THEN round((bcs.bom_max_net_kg * 1000.0)::numeric, 3)
      WHEN g.grp_max_wt > 0 AND g.grp_max_wt < 1 THEN round((g.grp_max_wt * 1000.0)::numeric, 3)
      ELSE g.grp_max_wt
    END AS best_part_wt_gr,
    CASE
      WHEN COALESCE(bcs.bom_max_gate_kg, 0) > 0 THEN round((bcs.bom_max_gate_kg * 1000.0)::numeric, 3)
      WHEN g.grp_max_run > 0 AND g.grp_max_run < 1 THEN round((g.grp_max_run * 1000.0)::numeric, 3)
      ELSE g.grp_max_run
    END AS best_runner_wt_gr,
    g.grp_max_std_pack AS best_std_pack,
    g.grp_max_ss AS best_ss,
    g.grp_max_min_lot AS best_min_lot,
    g.grp_max_lot_round AS best_lot_round,
    g.grp_max_lt AS best_lt,
    g.grp_max_scrap AS best_scrap,
    g.grp_max_regrind AS best_regrind,
    g.all_obsolete,
    g.was_ever_comp,
    g.was_ever_resina
  FROM grp g
  LEFT JOIN bom_child_stats bcs ON bcs.norm_pn = g.norm_pn
  LEFT JOIN bom_best_grade bbg ON bbg.norm_pn = g.norm_pn
)
UPDATE public.parts p
SET
  part_number = c.clean_pn,
  part_name = COALESCE(c.best_name, p.part_name),
  project = COALESCE(c.best_project, p.project),
  client = COALESCE(c.best_client, p.client),
  supplier = COALESCE(c.best_supplier, p.supplier),
  resin_grade = c.best_resin_grade,
  resin_type = COALESCE(c.best_resin_type, p.resin_type),
  color = COALESCE(c.best_color, p.color),
  customer_part_number = COALESCE(c.best_cust_pn, p.customer_part_number),
  image_url = COALESCE(c.best_image_url, p.image_url),
  default_location_id = COALESCE(c.best_loc_id, p.default_location_id),
  cavities = NULLIF(c.best_cavities, 0),
  cycle_time_seg = c.best_cycle,
  part_weight_gr = c.best_part_wt_gr,
  runner_weight_gr = c.best_runner_wt_gr,
  std_pack = NULLIF(c.best_std_pack, 0),
  safety_stock = c.best_ss,
  min_lot_size = c.best_min_lot,
  lot_rounding = c.best_lot_round,
  lead_time_days = c.best_lt,
  scrap_pct = c.best_scrap,
  regrind_pct = c.best_regrind,
  obsolete = c.all_obsolete,
  is_archived_duplicate = false,
  engineering_status = CASE WHEN c.all_obsolete THEN 'OBSOLETO' ELSE COALESCE(NULLIF(p.engineering_status, ''), 'ACTIVO') END,
  product_type = CASE
    WHEN c.was_ever_comp AND NOT c.was_ever_resina AND c.best_resin_grade IS NULL AND c.best_cycle = 0 THEN 'COMPONENTE'
    ELSE p.product_type
  END
FROM canon c
WHERE p.id = c.keep_id;

-- 4. Re-apuntar referencias hacia keep_id (omitiendo tablas sin filas) y archivar duplicados
DO $repoint$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bom_structures LIMIT 1) THEN
    WITH dup_map AS (
      SELECT p.id AS old_id, k.keep_id
      FROM public.parts p
      JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k
        ON k.norm_pn = upper(btrim(p.part_number))
      WHERE p.id <> k.keep_id
    )
    UPDATE public.bom_structures b SET parent_id = d.keep_id FROM dup_map d WHERE b.parent_id = d.old_id;

    WITH dup_map AS (
      SELECT p.id AS old_id, k.keep_id
      FROM public.parts p
      JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k
        ON k.norm_pn = upper(btrim(p.part_number))
      WHERE p.id <> k.keep_id
    )
    UPDATE public.bom_structures b SET child_id = d.keep_id FROM dup_map d WHERE b.child_id = d.old_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_movements LIMIT 1) THEN
    WITH dup_map AS (
      SELECT p.id AS old_id, k.keep_id
      FROM public.parts p
      JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k
        ON k.norm_pn = upper(btrim(p.part_number))
      WHERE p.id <> k.keep_id
    )
    UPDATE public.inventory_movements t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.requerimientos LIMIT 1) THEN
    WITH dup_map AS (
      SELECT p.id AS old_id, k.keep_id
      FROM public.parts p
      JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k
        ON k.norm_pn = upper(btrim(p.part_number))
      WHERE p.id <> k.keep_id
    )
    UPDATE public.requerimientos t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.part_specs LIMIT 1) THEN
    WITH dup_map AS (
      SELECT p.id AS old_id, k.keep_id
      FROM public.parts p
      JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k
        ON k.norm_pn = upper(btrim(p.part_number))
      WHERE p.id <> k.keep_id
    )
    UPDATE public.part_specs ps
    SET part_id = d.keep_id
    FROM dup_map d
    WHERE ps.part_id = d.old_id
      AND NOT EXISTS (SELECT 1 FROM public.part_specs ps2 WHERE ps2.part_id = d.keep_id);
  END IF;

  IF EXISTS (SELECT 1 FROM public.cycle_count_tasks LIMIT 1) THEN
    WITH dup_map AS (
      SELECT p.id AS old_id, k.keep_id
      FROM public.parts p
      JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k
        ON k.norm_pn = upper(btrim(p.part_number))
      WHERE p.id <> k.keep_id
    )
    UPDATE public.cycle_count_tasks ct
    SET part_id = d.keep_id
    FROM dup_map d
    WHERE ct.part_id = d.old_id
      AND NOT EXISTS (SELECT 1 FROM public.cycle_count_tasks ct2 WHERE ct2.part_id = d.keep_id);
  END IF;

  IF EXISTS (SELECT 1 FROM public.cycle_count_results LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.cycle_count_results t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sales_orders LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.sales_orders t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.calidad_inspeccion LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.calidad_inspeccion t SET part_id = d.keep_id::integer FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.quality_inspections LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.quality_inspections t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.production_plan LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.production_plan t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.production_orders LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.production_orders t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventario_anual_detalles LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.inventario_anual_detalles t SET part_id = d.keep_id::integer FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventarios_ubicacion LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.inventarios_ubicacion t SET part_id = d.keep_id::integer FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.produccion_registro LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.produccion_registro t SET parte_id = d.keep_id::integer FROM dup_map d WHERE t.parte_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.run_outputs LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.run_outputs t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.runs LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.runs t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.machines WHERE current_part_id IS NOT NULL LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.machines t SET current_part_id = d.keep_id FROM dup_map d WHERE t.current_part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.empaques_partes LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.empaques_partes t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.part_molds LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.part_molds t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.part_routings LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.part_routings t
    SET part_id = d.keep_id
    FROM dup_map d
    WHERE t.part_id = d.old_id
      AND NOT EXISTS (SELECT 1 FROM public.part_routings pr2 WHERE pr2.part_id = d.keep_id AND pr2.seq_num = t.seq_num);
  END IF;
  IF EXISTS (SELECT 1 FROM public.compras_ordenes_det LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.compras_ordenes_det t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.compras_recibos_det LIMIT 1) THEN
    WITH dup_map AS (SELECT p.id AS old_id, k.keep_id FROM public.parts p JOIN (SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id FROM public.parts GROUP BY 1) k ON k.norm_pn = upper(btrim(p.part_number)) WHERE p.id <> k.keep_id)
    UPDATE public.compras_recibos_det t SET part_id = d.keep_id FROM dup_map d WHERE t.part_id = d.old_id;
  END IF;
END $repoint$;

WITH dup_map AS (
  SELECT p.id AS old_id
  FROM public.parts p
  JOIN (
    SELECT upper(btrim(part_number)) AS norm_pn, min(id) AS keep_id
    FROM public.parts
    GROUP BY 1
  ) k ON k.norm_pn = upper(btrim(p.part_number))
  WHERE p.id <> k.keep_id
    AND p.is_archived_duplicate = false
)
UPDATE public.parts p
SET is_archived_duplicate = true,
    obsolete = true,
    engineering_status = 'DUPLICADO_ARCHIVADO'
FROM dup_map d
WHERE p.id = d.old_id;

-- 5. Reclasificar las 2,627 partes canónicas en PT, SUB-ENSAMBLE y COMPONENTE
WITH parent_parts AS (
  SELECT DISTINCT parent_id AS part_id
  FROM public.bom_structures
  WHERE parent_id <> child_id
    AND COALESCE(is_active, true) = true
),
child_parts AS (
  SELECT DISTINCT child_id AS part_id
  FROM public.bom_structures
  WHERE parent_id <> child_id
    AND COALESCE(is_active, true) = true
),
molded_kg_parts AS (
  SELECT DISTINCT b.child_id AS part_id
  FROM public.bom_structures b
  JOIN public.parts p ON p.id = b.child_id
  WHERE p.is_archived_duplicate = false
    AND upper(COALESCE(b.unit, '')) = 'KG'
    AND public.is_real_resin_grade(b.material_grade, p.part_number)
),
classified AS (
  SELECT
    p.id,
    p.unit_of_measure,
    CASE
      WHEN cp.part_id IS NOT NULL AND (
        pp.part_id IS NOT NULL
        OR mk.part_id IS NOT NULL
        OR public.is_real_resin_grade(p.resin_grade, p.part_number)
        OR COALESCE(p.cycle_time_seg, 0) > 0
      ) THEN 'SUB-ENSAMBLE'
      WHEN (cp.part_id IS NOT NULL AND pp.part_id IS NULL)
        OR (
          pp.part_id IS NULL
          AND mk.part_id IS NULL
          AND COALESCE(p.cycle_time_seg, 0) = 0
          AND NOT public.is_real_resin_grade(p.resin_grade, p.part_number)
          AND p.product_type = 'COMPONENTE'
        ) THEN 'COMPONENTE'
      ELSE 'PT'
    END AS target_type
  FROM public.parts p
  LEFT JOIN parent_parts pp ON pp.part_id = p.id
  LEFT JOIN child_parts cp ON cp.part_id = p.id
  LEFT JOIN molded_kg_parts mk ON mk.part_id = p.id
  WHERE p.is_archived_duplicate = false
)
UPDATE public.parts p
SET
  product_type = c.target_type,
  unit_of_measure = CASE
    WHEN c.target_type IN ('PT', 'SUB-ENSAMBLE') THEN 'PZA'
    WHEN upper(COALESCE(c.unit_of_measure, '')) IN ('EA', 'PZA', 'M', 'L', 'T', 'SET', 'ROLL') THEN upper(c.unit_of_measure)
    ELSE 'PZA'
  END,
  uom = CASE
    WHEN c.target_type IN ('PT', 'SUB-ENSAMBLE') THEN 'PZA'
    WHEN upper(COALESCE(c.unit_of_measure, '')) IN ('EA', 'PZA', 'M', 'L', 'T', 'SET', 'ROLL') THEN upper(c.unit_of_measure)
    ELSE 'PZA'
  END,
  resin_grade = CASE WHEN c.target_type = 'COMPONENTE' THEN NULL ELSE p.resin_grade END,
  part_weight_gr = CASE WHEN c.target_type = 'COMPONENTE' THEN 0 ELSE COALESCE(p.part_weight_gr, 0) END,
  runner_weight_gr = CASE WHEN c.target_type = 'COMPONENTE' THEN 0 ELSE COALESCE(p.runner_weight_gr, 0) END,
  cavities = CASE WHEN c.target_type = 'COMPONENTE' THEN 0 ELSE p.cavities END,
  cycle_time_seg = CASE WHEN c.target_type = 'COMPONENTE' THEN 0 ELSE COALESCE(p.cycle_time_seg, 0) END
FROM classified c
WHERE p.id = c.id
  AND p.is_archived_duplicate = false;

-- 6. Insertar SKUs reales de RESINA en public.parts (is_archived_duplicate = false)
WITH grade_sources AS (
  SELECT
    btrim(b.material_grade) AS raw_grade,
    NULLIF(btrim(b.supplier_name), '') AS sup
  FROM public.bom_structures b
  JOIN public.parts c ON c.id = b.child_id
  WHERE c.is_archived_duplicate = false
    AND upper(COALESCE(b.unit, '')) = 'KG'
    AND public.is_real_resin_grade(b.material_grade, c.part_number)
  UNION ALL
  SELECT
    btrim(p.resin_grade) AS raw_grade,
    NULLIF(btrim(p.supplier), '') AS sup
  FROM public.parts p
  WHERE p.is_archived_duplicate = false
    AND p.product_type IN ('PT', 'SUB-ENSAMBLE')
    AND public.is_real_resin_grade(p.resin_grade, p.part_number)
),
supplier_counts AS (
  SELECT
    upper(raw_grade) AS norm_grade,
    sup,
    count(*) AS cnt
  FROM grade_sources
  WHERE sup IS NOT NULL
  GROUP BY upper(raw_grade), sup
),
top_supplier_per_grade AS (
  SELECT DISTINCT ON (norm_grade)
    norm_grade,
    sup AS top_supplier
  FROM supplier_counts
  ORDER BY norm_grade, cnt DESC, sup ASC
),
distinct_resins AS (
  SELECT DISTINCT ON (upper(gs.raw_grade))
    upper(gs.raw_grade) AS norm_grade,
    gs.raw_grade AS grade_code,
    ts.top_supplier
  FROM grade_sources gs
  LEFT JOIN top_supplier_per_grade ts ON ts.norm_grade = upper(gs.raw_grade)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.parts ep
    WHERE ep.is_archived_duplicate = false
      AND upper(btrim(ep.part_number)) = upper(gs.raw_grade)
  )
  ORDER BY upper(gs.raw_grade), length(gs.raw_grade) ASC, gs.raw_grade ASC
)
INSERT INTO public.parts (
  part_number,
  part_name,
  product_type,
  unit_of_measure,
  uom,
  resin_grade,
  supplier,
  part_weight_gr,
  runner_weight_gr,
  cavities,
  cycle_time_seg,
  min_lot_size,
  lot_rounding,
  obsolete,
  is_archived_duplicate,
  engineering_status
)
SELECT
  grade_code,
  'Resina ' || grade_code,
  'RESINA',
  'KG',
  'KG',
  grade_code,
  top_supplier,
  0,
  0,
  0,
  0,
  25,
  25,
  false,
  false,
  'ACTIVO'
FROM distinct_resins;

-- 7. Sanear public.bom_structures sin borrados físicos
-- 7.1 Desactivar auto-referencias y relaciones con FK nula
UPDATE public.bom_structures
SET is_active = false,
    notes = COALESCE(notes, 'ARCHIVED_SELF_REF_FASE2')
WHERE (parent_id = child_id OR parent_id IS NULL OR child_id IS NULL)
  AND COALESCE(is_active, true) = true;

-- 7.2 Consolidar pares activos duplicados (parent_id, child_id) y desactivar excedentes
WITH dup_bom AS (
  SELECT
    parent_id,
    child_id,
    min(id) AS keep_bom_id,
    max(COALESCE(NULLIF(usage_qty, 0), NULLIF(quantity, 0), 1)) AS best_usage,
    max(COALESCE(net_weight_kg, 0)) AS best_net_kg,
    max(COALESCE(gate_weight_kg, 0)) AS best_gate_kg,
    max(NULLIF(btrim(material_grade), '')) AS best_grade,
    max(NULLIF(btrim(supplier_name), '')) AS best_sup,
    max(NULLIF(btrim(client), '')) AS best_cli,
    max(NULLIF(btrim(car_model), '')) AS best_proj
  FROM public.bom_structures
  WHERE COALESCE(is_active, true) = true
  GROUP BY parent_id, child_id
  HAVING count(*) > 1
)
UPDATE public.bom_structures b
SET
  usage_qty = db.best_usage,
  quantity = db.best_usage,
  net_weight_kg = db.best_net_kg,
  gate_weight_kg = db.best_gate_kg,
  material_grade = COALESCE(NULLIF(btrim(b.material_grade), ''), db.best_grade),
  supplier_name = COALESCE(NULLIF(btrim(b.supplier_name), ''), db.best_sup),
  client = COALESCE(NULLIF(btrim(b.client), ''), db.best_cli),
  car_model = COALESCE(NULLIF(btrim(b.car_model), ''), db.best_proj)
FROM dup_bom db
WHERE b.id = db.keep_bom_id;

WITH keep_map AS (
  SELECT parent_id, child_id, min(id) AS keep_bom_id
  FROM public.bom_structures
  WHERE COALESCE(is_active, true) = true
  GROUP BY parent_id, child_id
)
UPDATE public.bom_structures b
SET is_active = false,
    notes = COALESCE(b.notes, 'ARCHIVED_DUP_FASE2')
FROM keep_map k
WHERE k.parent_id = b.parent_id
  AND k.child_id = b.child_id
  AND b.id <> k.keep_bom_id
  AND COALESCE(b.is_active, true) = true;

-- 7.3 Normalizar unidades y cantidades en relaciones activas hacia PT / SUB-ENSAMBLE / COMPONENTE
UPDATE public.bom_structures b
SET
  unit = CASE
    WHEN c.product_type IN ('PT', 'SUB-ENSAMBLE') THEN 'PZA'
    WHEN upper(COALESCE(b.unit, '')) IN ('EA', 'PZA', 'M', 'L', 'T', 'SET', 'ROLL') THEN upper(b.unit)
    ELSE 'EA'
  END,
  bom_level = 1,
  usage_qty = CASE
    WHEN c.product_type IN ('PT', 'SUB-ENSAMBLE', 'COMPONENTE') THEN COALESCE(NULLIF(b.usage_qty, 0), NULLIF(b.quantity, 0), 1)
    ELSE COALESCE(b.usage_qty, b.quantity, 0)
  END,
  quantity = CASE
    WHEN c.product_type IN ('PT', 'SUB-ENSAMBLE', 'COMPONENTE') THEN COALESCE(NULLIF(b.usage_qty, 0), NULLIF(b.quantity, 0), 1)
    ELSE COALESCE(b.usage_qty, b.quantity, 0)
  END,
  material_grade = CASE WHEN c.product_type = 'COMPONENTE' THEN NULL ELSE b.material_grade END,
  net_weight_kg = CASE
    WHEN c.product_type = 'COMPONENTE' THEN 0
    WHEN c.product_type IN ('PT', 'SUB-ENSAMBLE') THEN round((COALESCE(c.part_weight_gr, 0) / 1000.0)::numeric, 6)
    ELSE COALESCE(b.net_weight_kg, 0)
  END,
  gate_weight_kg = CASE
    WHEN c.product_type = 'COMPONENTE' THEN 0
    WHEN c.product_type IN ('PT', 'SUB-ENSAMBLE') THEN round((COALESCE(c.runner_weight_gr, 0) / 1000.0)::numeric, 6)
    ELSE COALESCE(b.gate_weight_kg, 0)
  END,
  total_weight_kg = CASE
    WHEN c.product_type = 'COMPONENTE' THEN 0
    WHEN c.product_type IN ('PT', 'SUB-ENSAMBLE') THEN round(((COALESCE(c.part_weight_gr, 0) + COALESCE(c.runner_weight_gr, 0)) / 1000.0)::numeric, 6)
    ELSE COALESCE(b.total_weight_kg, 0)
  END,
  is_active = true
FROM public.parts c
WHERE c.id = b.child_id
  AND COALESCE(b.is_active, true) = true
  AND c.product_type <> 'RESINA';

-- 7.4 Actualizar e insertar enlaces activos Pieza Moldeada (PT / SUB-ENSAMBLE) -> RESINA (KG/pieza) en O(N)
WITH bom_best_grade_by_id AS (
  SELECT DISTINCT ON (b.child_id)
    b.child_id,
    btrim(b.material_grade) AS mat_grade
  FROM public.bom_structures b
  JOIN public.parts m ON m.id = b.child_id
  WHERE m.is_archived_duplicate = false
    AND m.product_type IN ('PT', 'SUB-ENSAMBLE')
    AND upper(COALESCE(b.unit, '')) = 'KG'
    AND public.is_real_resin_grade(b.material_grade, m.part_number)
  ORDER BY b.child_id, COALESCE(b.net_weight_kg, 0) DESC, b.id ASC
),
candidate_links AS (
  SELECT
    m.id AS molded_part_id,
    m.product_type AS molded_type,
    m.client AS molded_client,
    m.project AS molded_project,
    COALESCE(m.cavities, 1) AS molded_cavities,
    COALESCE(m.cycle_time_seg, 0) AS molded_cycle,
    round((COALESCE(m.part_weight_gr, 0) / 1000.0)::numeric, 6) AS net_kg,
    round((COALESCE(m.runner_weight_gr, 0) / 1000.0)::numeric, 6) AS gate_kg,
    COALESCE(NULLIF(btrim(m.resin_grade), ''), bg.mat_grade) AS raw_grade
  FROM public.parts m
  LEFT JOIN bom_best_grade_by_id bg ON bg.child_id = m.id
  WHERE m.is_archived_duplicate = false
    AND m.product_type IN ('PT', 'SUB-ENSAMBLE')
),
molded_resin_links AS (
  SELECT
    cl.molded_part_id,
    r.id AS resin_part_id,
    r.part_number AS resin_code,
    r.supplier AS resin_supplier,
    CASE WHEN cl.molded_type = 'SUB-ENSAMBLE' THEN 2 ELSE 1 END AS bom_lvl,
    cl.molded_client,
    cl.molded_project,
    GREATEST(1, cl.molded_cavities) AS cavities,
    cl.molded_cycle AS cycle_time_sec,
    cl.net_kg,
    cl.gate_kg,
    round((cl.net_kg + cl.gate_kg)::numeric, 6) AS total_kg
  FROM candidate_links cl
  JOIN public.parts r
    ON r.is_archived_duplicate = false
   AND r.product_type = 'RESINA'
   AND upper(btrim(r.part_number)) = upper(btrim(cl.raw_grade))
  WHERE cl.raw_grade IS NOT NULL
    AND cl.molded_part_id <> r.id
)
UPDATE public.bom_structures b
SET
  unit = 'KG',
  bom_level = l.bom_lvl,
  net_weight_kg = l.net_kg,
  gate_weight_kg = l.gate_kg,
  total_weight_kg = l.total_kg,
  usage_qty = l.total_kg,
  quantity = l.total_kg,
  cavities = l.cavities,
  cycle_time_sec = l.cycle_time_sec,
  material_grade = l.resin_code,
  client = COALESCE(l.molded_client, b.client),
  car_model = COALESCE(l.molded_project, b.car_model),
  supplier_name = COALESCE(l.resin_supplier, b.supplier_name),
  is_active = true
FROM molded_resin_links l
WHERE b.parent_id = l.molded_part_id
  AND b.child_id = l.resin_part_id
  AND COALESCE(b.is_active, true) = true;

WITH bom_best_grade_by_id AS (
  SELECT DISTINCT ON (b.child_id)
    b.child_id,
    btrim(b.material_grade) AS mat_grade
  FROM public.bom_structures b
  JOIN public.parts m ON m.id = b.child_id
  WHERE m.is_archived_duplicate = false
    AND m.product_type IN ('PT', 'SUB-ENSAMBLE')
    AND upper(COALESCE(b.unit, '')) = 'KG'
    AND public.is_real_resin_grade(b.material_grade, m.part_number)
  ORDER BY b.child_id, COALESCE(b.net_weight_kg, 0) DESC, b.id ASC
),
candidate_links AS (
  SELECT
    m.id AS molded_part_id,
    m.product_type AS molded_type,
    m.client AS molded_client,
    m.project AS molded_project,
    COALESCE(m.cavities, 1) AS molded_cavities,
    COALESCE(m.cycle_time_seg, 0) AS molded_cycle,
    round((COALESCE(m.part_weight_gr, 0) / 1000.0)::numeric, 6) AS net_kg,
    round((COALESCE(m.runner_weight_gr, 0) / 1000.0)::numeric, 6) AS gate_kg,
    COALESCE(NULLIF(btrim(m.resin_grade), ''), bg.mat_grade) AS raw_grade
  FROM public.parts m
  LEFT JOIN bom_best_grade_by_id bg ON bg.child_id = m.id
  WHERE m.is_archived_duplicate = false
    AND m.product_type IN ('PT', 'SUB-ENSAMBLE')
),
molded_resin_links AS (
  SELECT
    cl.molded_part_id,
    r.id AS resin_part_id,
    r.part_number AS resin_code,
    r.supplier AS resin_supplier,
    CASE WHEN cl.molded_type = 'SUB-ENSAMBLE' THEN 2 ELSE 1 END AS bom_lvl,
    cl.molded_client,
    cl.molded_project,
    GREATEST(1, cl.molded_cavities) AS cavities,
    cl.molded_cycle AS cycle_time_sec,
    cl.net_kg,
    cl.gate_kg,
    round((cl.net_kg + cl.gate_kg)::numeric, 6) AS total_kg
  FROM candidate_links cl
  JOIN public.parts r
    ON r.is_archived_duplicate = false
   AND r.product_type = 'RESINA'
   AND upper(btrim(r.part_number)) = upper(btrim(cl.raw_grade))
  WHERE cl.raw_grade IS NOT NULL
    AND cl.molded_part_id <> r.id
)
INSERT INTO public.bom_structures (
  parent_id,
  child_id,
  quantity,
  usage_qty,
  unit,
  bom_level,
  client,
  car_model,
  cycle_time_sec,
  cavities,
  net_weight_kg,
  gate_weight_kg,
  total_weight_kg,
  material_grade,
  supplier_name,
  scrap_pct,
  is_active
)
SELECT
  l.molded_part_id,
  l.resin_part_id,
  l.total_kg,
  l.total_kg,
  'KG',
  l.bom_lvl,
  l.molded_client,
  l.molded_project,
  l.cycle_time_sec,
  l.cavities,
  l.net_kg,
  l.gate_kg,
  l.total_kg,
  l.resin_code,
  l.resin_supplier,
  0,
  true
FROM molded_resin_links l
WHERE NOT EXISTS (
  SELECT 1 FROM public.bom_structures b
  WHERE b.parent_id = l.molded_part_id
    AND b.child_id = l.resin_part_id
    AND COALESCE(b.is_active, true) = true
);

-- 8. Blindaje parcial, índices, vistas canónicas y función explorar_bom_multinivel
CREATE UNIQUE INDEX IF NOT EXISTS uq_parts_canonical_part_number
  ON public.parts (upper(btrim(part_number)))
  WHERE is_archived_duplicate = false;

CREATE INDEX IF NOT EXISTS idx_parts_active_catalog
  ON public.parts (is_archived_duplicate, product_type, obsolete);

CREATE INDEX IF NOT EXISTS idx_bom_structures_parent_id
  ON public.bom_structures (parent_id)
  WHERE COALESCE(is_active, true) = true;

CREATE INDEX IF NOT EXISTS idx_bom_structures_child_id
  ON public.bom_structures (child_id)
  WHERE COALESCE(is_active, true) = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_active_parent_child
  ON public.bom_structures (parent_id, child_id)
  WHERE COALESCE(is_active, true) = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bom_structures'::regclass AND conname = 'chk_bom_active_no_self_ref'
  ) THEN
    ALTER TABLE public.bom_structures
      ADD CONSTRAINT chk_bom_active_no_self_ref
      CHECK (COALESCE(is_active, true) = false OR parent_id <> child_id);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.forecast_parts AS
SELECT
  p.id AS part_id,
  p.part_number,
  inv.current_inventory,
  0 AS req_30_days,
  GREATEST((0)::bigint, (0 - COALESCE(inv.current_inventory, (0)::bigint))) AS forecast_30_days
FROM public.parts p
LEFT JOIN public.inventory_part_summary inv ON inv.part_id = p.id
WHERE p.is_archived_duplicate = false;

CREATE OR REPLACE VIEW public.inventory_part_alerts AS
SELECT
  p.id AS part_id,
  p.part_number,
  p.part_name,
  p.obsolete,
  k.abc_final,
  k.last_out,
  k.qty_30_days,
  k.qty_90_days,
  k.rotation_30,
  k.rotation_90_monthly,
  ((k.qty_90_days = 0) AND (k.abc_final = 'A'::bpchar)) AS alert_abc_a_no_moves,
  ((p.obsolete = true) AND (k.qty_30_days > 0)) AS alert_obsolete_with_stock
FROM public.parts p
LEFT JOIN public.inventory_kpi_parts k ON k.id = p.id
WHERE p.is_archived_duplicate = false;

CREATE OR REPLACE FUNCTION public.explorar_bom_multinivel(p_part_id bigint, p_qty numeric DEFAULT 1)
 RETURNS TABLE(nivel integer, parent_id bigint, child_id bigint, part_number text, part_name text, product_type text, unit text, usage_per_parent numeric, effective_usage numeric, scrap_pct numeric, required_qty numeric)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
with recursive bom_tree as (
    select
        1 as nivel,
        b.parent_id,
        b.child_id,
        coalesce(b.usage_qty, b.quantity, 0)::numeric as usage_per_parent,
        (coalesce(b.usage_qty, b.quantity, 0) * (1 + coalesce(b.scrap_pct, 0) / 100.0))::numeric as effective_usage,
        coalesce(b.scrap_pct, 0)::numeric as scrap_pct,
        b.unit,
        array[b.parent_id, b.child_id] as path
    from public.bom_structures b
    where b.parent_id = p_part_id
      and b.parent_id <> b.child_id
      and coalesce(b.is_active, true) = true
      and (b.valid_from is null or b.valid_from <= current_date)
      and (b.valid_to   is null or b.valid_to   >= current_date)

    union all

    select
        bt.nivel + 1,
        b.parent_id,
        b.child_id,
        coalesce(b.usage_qty, b.quantity, 0)::numeric,
        (bt.effective_usage * coalesce(b.usage_qty, b.quantity, 0) * (1 + coalesce(b.scrap_pct, 0) / 100.0))::numeric,
        coalesce(b.scrap_pct, 0)::numeric,
        b.unit,
        bt.path || b.child_id
    from public.bom_structures b
    join bom_tree bt on b.parent_id = bt.child_id
    where bt.nivel < 5
      and b.parent_id <> b.child_id
      and not (b.child_id = any(bt.path))
      and coalesce(b.is_active, true) = true
      and (b.valid_from is null or b.valid_from <= current_date)
      and (b.valid_to   is null or b.valid_to   >= current_date)
)
select
    bt.nivel,
    bt.parent_id,
    bt.child_id,
    c.part_number,
    c.part_name,
    c.product_type,
    coalesce(nullif(bt.unit, ''), c.unit_of_measure, 'PZA') as unit,
    bt.usage_per_parent,
    round(bt.effective_usage, 6) as effective_usage,
    bt.scrap_pct,
    round(p_qty * bt.effective_usage, 4) as required_qty
from bom_tree bt
join public.parts c on c.id = bt.child_id
order by bt.nivel, c.part_number;
$function$;
