-- ============================================================================
-- KRAEM by APEX SYSTEM — Fase 3 Ingeniería & BOM: Unificación Máquinas + Moldes + Std Pack
-- Estrategia 100% No Destructiva:
--   3A. Unificación bidireccional public.mes_machines <-> public.machines por id exacto
--       + soporte de folio en public.production_orders y columnas de piso en mes_machines
--   3B. Poblado de public.molds (1,462 moldes base) + public.part_molds (1,649 vínculos)
--       + trigger bidireccional de compatibilidad mold_machines -> molds.compatible_machine / machine_molds
--   3C. Fuente única de Standard Pack (empaques_partes <-> parts.std_pack / pcs_per_trolley)
--       + vistas canónicas v_part_mold_capacity, v_production_versions y v_planeacion_maestra
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECCIÓN 3A: UNIFICACIÓN DE MÁQUINAS (mes_machines <-> machines) + FOLIO OP
-- ----------------------------------------------------------------------------
ALTER TABLE public.mes_machines
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS current_run_id bigint,
  ADD COLUMN IF NOT EXISTS current_mold_id bigint,
  ADD COLUMN IF NOT EXISTS current_part_id bigint,
  ADD COLUMN IF NOT EXISTS last_start_time timestamptz;

UPDATE public.mes_machines
SET status = 'AVAILABLE'
WHERE status IS NULL OR btrim(status) = '';

UPDATE public.mes_machines
SET production_area = 'NISSEI'
WHERE upper(btrim(production_area)) = 'NISSEI'
  AND production_area <> 'NISSEI';

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS machine_code text,
  ADD COLUMN IF NOT EXISTS area_general_id bigint,
  ADD COLUMN IF NOT EXISTS tonnage integer,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mes_machine_id bigint;

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS folio text;

CREATE INDEX IF NOT EXISTS idx_production_orders_folio
  ON public.production_orders (folio);

UPDATE public.machines t
SET
  machine_code = m.machine_code,
  machine_name = COALESCE(m.machine_code || ' - ' || NULLIF(m.machine_name, ''), m.machine_code, m.machine_name),
  area = m.production_area,
  area_general_id = m.area_general_id,
  tonnage = m.tonnage,
  active = COALESCE(m.active, true),
  mes_machine_id = m.id,
  status = COALESCE(NULLIF(t.status, ''), m.status, 'AVAILABLE')
FROM public.mes_machines m
WHERE t.id = m.id;

INSERT INTO public.machines (
  id,
  machine_code,
  machine_name,
  area,
  area_general_id,
  tonnage,
  active,
  mes_machine_id,
  status
)
OVERRIDING SYSTEM VALUE
SELECT
  m.id,
  m.machine_code,
  COALESCE(m.machine_code || ' - ' || NULLIF(m.machine_name, ''), m.machine_code, m.machine_name),
  m.production_area,
  m.area_general_id,
  m.tonnage,
  COALESCE(m.active, true),
  m.id,
  COALESCE(NULLIF(m.status, ''), 'AVAILABLE')
FROM public.mes_machines m
WHERE NOT EXISTS (
  SELECT 1 FROM public.machines t WHERE t.id = m.id
);

SELECT setval(
  pg_get_serial_sequence('public.mes_machines', 'id'),
  COALESCE((SELECT max(id) FROM public.mes_machines), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.machines', 'id'),
  COALESCE((SELECT max(id) FROM public.machines), 1),
  true
);

CREATE OR REPLACE FUNCTION public.fn_sync_mes_machines_to_machines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(current_setting('kraem.syncing_machines', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('kraem.syncing_machines', '1', true);

  INSERT INTO public.machines (
    id,
    machine_code,
    machine_name,
    area,
    area_general_id,
    tonnage,
    active,
    mes_machine_id,
    status,
    current_run_id,
    current_mold_id,
    current_part_id,
    last_start_time
  )
  OVERRIDING SYSTEM VALUE
  VALUES (
    NEW.id,
    NEW.machine_code,
    COALESCE(NEW.machine_code || ' - ' || NULLIF(NEW.machine_name, ''), NEW.machine_code, NEW.machine_name),
    NEW.production_area,
    NEW.area_general_id,
    NEW.tonnage,
    COALESCE(NEW.active, true),
    NEW.id,
    COALESCE(NULLIF(NEW.status, ''), 'AVAILABLE'),
    NEW.current_run_id,
    NEW.current_mold_id,
    NEW.current_part_id,
    NEW.last_start_time
  )
  ON CONFLICT (id) DO UPDATE SET
    machine_code = EXCLUDED.machine_code,
    machine_name = EXCLUDED.machine_name,
    area = EXCLUDED.area,
    area_general_id = EXCLUDED.area_general_id,
    tonnage = EXCLUDED.tonnage,
    active = EXCLUDED.active,
    mes_machine_id = EXCLUDED.mes_machine_id,
    status = COALESCE(NULLIF(EXCLUDED.status, ''), public.machines.status, 'AVAILABLE'),
    current_run_id = COALESCE(EXCLUDED.current_run_id, public.machines.current_run_id),
    current_mold_id = COALESCE(EXCLUDED.current_mold_id, public.machines.current_mold_id),
    current_part_id = COALESCE(EXCLUDED.current_part_id, public.machines.current_part_id),
    last_start_time = COALESCE(EXCLUDED.last_start_time, public.machines.last_start_time);

  PERFORM setval(
    pg_get_serial_sequence('public.machines', 'id'),
    GREATEST(COALESCE((SELECT max(id) FROM public.machines), 1), NEW.id),
    true
  );

  PERFORM set_config('kraem.syncing_machines', '0', true);
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_mes_machines_to_machines'
      AND tgrelid = 'public.mes_machines'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_mes_machines_to_machines
    AFTER INSERT OR UPDATE ON public.mes_machines
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mes_machines_to_machines();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_sync_machines_runtime_to_mes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(current_setting('kraem.syncing_machines', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('kraem.syncing_machines', '1', true);

  UPDATE public.mes_machines
  SET
    status = COALESCE(NULLIF(NEW.status, ''), 'AVAILABLE'),
    current_run_id = NEW.current_run_id,
    current_mold_id = NEW.current_mold_id,
    current_part_id = NEW.current_part_id,
    last_start_time = NEW.last_start_time,
    last_status_change = now()
  WHERE id = NEW.id;

  PERFORM set_config('kraem.syncing_machines', '0', true);
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_machines_runtime_to_mes'
      AND tgrelid = 'public.machines'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_machines_runtime_to_mes
    AFTER UPDATE OF status, current_run_id, current_mold_id, current_part_id, last_start_time ON public.machines
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_machines_runtime_to_mes();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- SECCIÓN 3B: MOLDES, MATRIZ MOLDE <-> PARTE Y COMPATIBILIDAD MÁQUINAS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_molds_sync_names()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.mold_name := COALESCE(NULLIF(NEW.mold_name, ''), NEW.name);
  NEW.name      := COALESCE(NULLIF(NEW.name, ''), NEW.mold_name);
  IF TG_OP = 'UPDATE' AND NEW.mold_name IS DISTINCT FROM OLD.mold_name THEN
    NEW.name := NEW.mold_name;
  END IF;
  IF NEW.cavities_active IS NULL THEN
    NEW.cavities_active := NEW.cavities;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_molds_mold_code
  ON public.molds (upper(btrim(mold_code)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_part_molds_mold_part
  ON public.part_molds (mold_id, part_id);

WITH molded_parts AS (
  SELECT
    p.id,
    p.part_number,
    btrim(p.part_name) AS clean_name,
    NULLIF(btrim(p.client), '') AS clean_client,
    NULLIF(btrim(p.project), '') AS clean_project,
    COALESCE(NULLIF(p.cavities, 0), 1) AS clean_cav,
    regexp_replace(upper(btrim(p.part_number)), '^([A-Z0-9]{5}-[A-Z0-9]{5})[A-Z0-9]{2,4}$', '\1') AS base_pn
  FROM public.parts p
  WHERE p.is_archived_duplicate = false
    AND p.product_type IN ('PT', 'SUB-ENSAMBLE')
    AND EXISTS (
      SELECT 1
      FROM public.bom_structures b
      JOIN public.parts r ON r.id = b.child_id
      WHERE b.parent_id = p.id
        AND COALESCE(b.is_active, true) = true
        AND r.product_type = 'RESINA'
    )
),
base_molds AS (
  SELECT
    mp.base_pn,
    'MLD-' || mp.base_pn AS target_code,
    COALESCE(
      (array_agg(mp.clean_name ORDER BY length(COALESCE(mp.clean_name, '')) DESC, mp.id ASC)
         FILTER (WHERE NULLIF(mp.clean_name, '') IS NOT NULL))[1],
      'Molde ' || mp.base_pn
    ) AS target_name,
    (array_agg(mp.clean_client ORDER BY mp.id ASC) FILTER (WHERE mp.clean_client IS NOT NULL))[1] AS target_client,
    (array_agg(mp.clean_project ORDER BY mp.id ASC) FILTER (WHERE mp.clean_project IS NOT NULL))[1] AS target_project,
    GREATEST(1, max(mp.clean_cav)) AS target_cav
  FROM molded_parts mp
  GROUP BY mp.base_pn
)
INSERT INTO public.molds (
  mold_code,
  mold_name,
  name,
  cliente,
  project,
  cavities,
  cavities_active,
  runner_type,
  setup_time_min,
  current_status,
  active
)
SELECT
  bm.target_code,
  bm.target_name,
  bm.target_name,
  bm.target_client,
  bm.target_project,
  bm.target_cav,
  bm.target_cav,
  'FRIA',
  45,
  'EN_ALMACEN',
  true
FROM base_molds bm
WHERE NOT EXISTS (
  SELECT 1
  FROM public.molds em
  WHERE upper(btrim(em.mold_code)) = upper(btrim(bm.target_code))
);

WITH molded_parts AS (
  SELECT
    p.id AS part_id,
    p.part_name,
    GREATEST(1, COALESCE(NULLIF(p.cavities, 0), 1)) AS cav,
    NULLIF(p.cycle_time_seg, 0) AS cyc_sec,
    NULLIF(p.part_weight_gr, 0) AS wt_gr,
    p.runner_weight_gr AS run_gr,
    regexp_replace(upper(btrim(p.part_number)), '^([A-Z0-9]{5}-[A-Z0-9]{5})[A-Z0-9]{2,4}$', '\1') AS base_pn,
    CASE
      WHEN p.part_name ~* '(^|[^A-Z])LH([^A-Z]|$)' AND p.part_name !~* 'LH\s*/\s*RH' THEN 'LH'
      WHEN p.part_name ~* '(^|[^A-Z])RH([^A-Z]|$)' AND p.part_name !~* 'LH\s*/\s*RH' THEN 'RH'
      ELSE 'NA'
    END AS side
  FROM public.parts p
  WHERE p.is_archived_duplicate = false
    AND p.product_type IN ('PT', 'SUB-ENSAMBLE')
    AND EXISTS (
      SELECT 1
      FROM public.bom_structures b
      JOIN public.parts r ON r.id = b.child_id
      WHERE b.parent_id = p.id
        AND COALESCE(b.is_active, true) = true
        AND r.product_type = 'RESINA'
    )
)
INSERT INTO public.part_molds (
  mold_id,
  part_id,
  cavities_for_part,
  cycle_time_sec,
  part_weight_gr,
  runner_weight_gr,
  side,
  is_primary,
  active
)
SELECT
  m.id,
  mp.part_id,
  mp.cav,
  mp.cyc_sec,
  mp.wt_gr,
  mp.run_gr,
  mp.side,
  true,
  true
FROM molded_parts mp
JOIN public.molds m
  ON upper(btrim(m.mold_code)) = upper('MLD-' || mp.base_pn)
ON CONFLICT (mold_id, part_id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.molds', 'id'),
  COALESCE((SELECT max(id) FROM public.molds), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.part_molds', 'id'),
  COALESCE((SELECT max(id) FROM public.part_molds), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.mold_machines', 'id'),
  COALESCE((SELECT max(id) FROM public.mold_machines), 1),
  true
);

CREATE OR REPLACE FUNCTION public.fn_sync_mold_machines_compat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_mach_id bigint;
BEGIN
  SELECT mm.machine_id
    INTO v_mach_id
  FROM public.mold_machines mm
  WHERE mm.mold_id = NEW.mold_id
    AND COALESCE(mm.active, true) = true
  ORDER BY mm.is_primary DESC, mm.id ASC
  LIMIT 1;

  UPDATE public.molds
  SET compatible_machine = v_mach_id::text
  WHERE id = NEW.mold_id;

  IF COALESCE(NEW.active, true) = true
     AND NEW.machine_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.machines maq WHERE maq.id = NEW.machine_id) THEN
    INSERT INTO public.machine_molds (machine_id, mold_id)
    VALUES (NEW.machine_id, NEW.mold_id)
    ON CONFLICT (machine_id, mold_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_mold_machines_compat'
      AND tgrelid = 'public.mold_machines'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_mold_machines_compat
    AFTER INSERT OR UPDATE ON public.mold_machines
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mold_machines_compat();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- SECCIÓN 3C: FUENTE ÚNICA DE STANDARD PACK Y VISTAS CANÓNICAS
-- ----------------------------------------------------------------------------
ALTER TABLE public.empaques_partes
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

UPDATE public.empaques_partes ep
SET
  part_id = p.id,
  part_name = COALESCE(NULLIF(ep.part_name, ''), p.part_name)
FROM public.parts p
WHERE p.is_archived_duplicate = false
  AND upper(btrim(p.part_number)) = upper(btrim(ep.part_number))
  AND ep.part_id IS NULL;

INSERT INTO public.empaques_partes (
  empaque_id,
  part_id,
  part_number,
  part_name,
  standard_pack,
  es_empaque_primario,
  active
)
SELECT
  e.id,
  p.id,
  p.part_number,
  p.part_name,
  p.std_pack::integer,
  true,
  true
FROM public.parts p
JOIN public.empaques e ON e.codigo = 'CARRO-KRAEM'
WHERE p.is_archived_duplicate = false
  AND COALESCE(p.std_pack, 0) > 0
ON CONFLICT (empaque_id, part_number) DO UPDATE SET
  part_id = EXCLUDED.part_id,
  part_name = EXCLUDED.part_name,
  standard_pack = EXCLUDED.standard_pack,
  es_empaque_primario = true,
  active = true;

UPDATE public.parts
SET pcs_per_trolley = std_pack::integer
WHERE is_archived_duplicate = false
  AND COALESCE(std_pack, 0) > 0
  AND pcs_per_trolley IS DISTINCT FROM std_pack::integer;

WITH primary_keep AS (
  SELECT DISTINCT ON (part_id)
    id AS keep_ep_id,
    part_id
  FROM public.empaques_partes
  WHERE part_id IS NOT NULL
    AND active = true
    AND es_empaque_primario = true
  ORDER BY part_id, created_at ASC, id ASC
)
UPDATE public.empaques_partes ep
SET es_empaque_primario = false
FROM primary_keep pk
WHERE ep.part_id = pk.part_id
  AND ep.id <> pk.keep_ep_id
  AND ep.active = true
  AND ep.es_empaque_primario = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_empaques_partes_one_primary
  ON public.empaques_partes (part_id)
  WHERE es_empaque_primario = true AND active = true AND part_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empaques_partes_part_id
  ON public.empaques_partes (part_id)
  WHERE active = true;

CREATE OR REPLACE FUNCTION public.fn_empaques_partes_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_part record;
BEGIN
  IF NEW.part_id IS NOT NULL THEN
    SELECT id, part_number, part_name
      INTO v_part
    FROM public.parts
    WHERE id = NEW.part_id
    LIMIT 1;
  ELSIF NEW.part_number IS NOT NULL THEN
    SELECT id, part_number, part_name
      INTO v_part
    FROM public.parts
    WHERE is_archived_duplicate = false
      AND upper(btrim(part_number)) = upper(btrim(NEW.part_number))
    LIMIT 1;
  END IF;

  IF v_part.id IS NOT NULL THEN
    NEW.part_id := v_part.id;
    NEW.part_number := v_part.part_number;
    NEW.part_name := COALESCE(NULLIF(NEW.part_name, ''), v_part.part_name);
  END IF;

  IF COALESCE(NEW.active, true) = false THEN
    NEW.es_empaque_primario := false;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.es_empaque_primario, false) = true
     AND NEW.part_id IS NOT NULL
     AND COALESCE(current_setting('kraem.clearing_primary_empaque', true), '') <> '1' THEN
    PERFORM set_config('kraem.clearing_primary_empaque', '1', true);
    UPDATE public.empaques_partes
    SET es_empaque_primario = false
    WHERE part_id = NEW.part_id
      AND active = true
      AND es_empaque_primario = true
      AND id IS DISTINCT FROM NEW.id;
    PERFORM set_config('kraem.clearing_primary_empaque', '0', true);
  END IF;

  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_empaques_partes_before_write'
      AND tgrelid = 'public.empaques_partes'::regclass
  ) THEN
    CREATE TRIGGER trg_empaques_partes_before_write
    BEFORE INSERT OR UPDATE ON public.empaques_partes
    FOR EACH ROW EXECUTE FUNCTION public.fn_empaques_partes_before_write();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_empaques_partes_after_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_pack integer;
BEGIN
  IF COALESCE(current_setting('kraem.clearing_primary_empaque', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('kraem.syncing_std_pack', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.part_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ep.standard_pack
    INTO v_pack
  FROM public.empaques_partes ep
  WHERE ep.part_id = NEW.part_id
    AND ep.active = true
  ORDER BY ep.es_empaque_primario DESC, ep.created_at ASC
  LIMIT 1;

  PERFORM set_config('kraem.syncing_std_pack', '1', true);

  UPDATE public.parts
  SET
    std_pack = v_pack,
    pcs_per_trolley = COALESCE(v_pack, pcs_per_trolley)
  WHERE id = NEW.part_id
    AND (std_pack IS DISTINCT FROM v_pack OR (v_pack IS NOT NULL AND pcs_per_trolley IS DISTINCT FROM v_pack));

  PERFORM set_config('kraem.syncing_std_pack', '0', true);
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_empaques_partes_after_write'
      AND tgrelid = 'public.empaques_partes'::regclass
  ) THEN
    CREATE TRIGGER trg_empaques_partes_after_write
    AFTER INSERT OR UPDATE ON public.empaques_partes
    FOR EACH ROW EXECUTE FUNCTION public.fn_empaques_partes_after_write();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_parts_sync_std_pack_to_empaques()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_emp_id uuid;
  v_updated integer;
BEGIN
  IF COALESCE(current_setting('kraem.syncing_std_pack', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.is_archived_duplicate, false) = true THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.std_pack, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('kraem.syncing_std_pack', '1', true);

  IF NEW.pcs_per_trolley IS DISTINCT FROM NEW.std_pack::integer THEN
    UPDATE public.parts
    SET pcs_per_trolley = NEW.std_pack::integer
    WHERE id = NEW.id;
  END IF;

  UPDATE public.empaques_partes
  SET
    standard_pack = NEW.std_pack::integer,
    part_number = NEW.part_number,
    part_name = NEW.part_name
  WHERE part_id = NEW.id
    AND active = true
    AND es_empaque_primario = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT id INTO v_emp_id
    FROM public.empaques
    WHERE codigo = 'CARRO-KRAEM'
    LIMIT 1;

    IF v_emp_id IS NOT NULL THEN
      INSERT INTO public.empaques_partes (
        empaque_id,
        part_id,
        part_number,
        part_name,
        standard_pack,
        es_empaque_primario,
        active
      )
      VALUES (
        v_emp_id,
        NEW.id,
        NEW.part_number,
        NEW.part_name,
        NEW.std_pack::integer,
        true,
        true
      )
      ON CONFLICT (empaque_id, part_number) DO UPDATE SET
        part_id = EXCLUDED.part_id,
        part_name = EXCLUDED.part_name,
        standard_pack = EXCLUDED.standard_pack,
        es_empaque_primario = true,
        active = true;
    END IF;
  END IF;

  PERFORM set_config('kraem.syncing_std_pack', '0', true);
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_parts_sync_std_pack'
      AND tgrelid = 'public.parts'::regclass
  ) THEN
    CREATE TRIGGER trg_parts_sync_std_pack
    AFTER INSERT OR UPDATE OF std_pack ON public.parts
    FOR EACH ROW EXECUTE FUNCTION public.fn_parts_sync_std_pack_to_empaques();
  END IF;
END $$;

-- Vistas actualizadas conservando exactamente columnas y tipos previos
CREATE OR REPLACE VIEW public.v_part_mold_capacity AS
SELECT
  pm.part_id,
  p.part_number,
  p.part_name,
  m.id AS mold_id,
  m.mold_code,
  m.mold_name,
  m.current_status AS mold_status,
  m.setup_time_min,
  pm.cavities_for_part,
  mm.machine_id,
  COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0)) AS cycle_time_sec,
  CASE
    WHEN COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0)) > 0::numeric
      THEN round((3600.0 / COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0))) * (COALESCE(pm.cavities_for_part, p.cavities, 1))::numeric, 1)
    ELSE NULL::numeric
  END AS pcs_per_hour,
  pm.part_weight_gr,
  pm.runner_weight_gr,
  pm.is_primary AS mold_is_primary,
  mm.is_primary AS machine_is_primary
FROM public.part_molds pm
JOIN public.molds m ON m.id = pm.mold_id
JOIN public.parts p ON p.id = pm.part_id
LEFT JOIN public.mold_machines mm ON mm.mold_id = m.id AND mm.active
WHERE pm.active
  AND COALESCE(m.active, true)
  AND p.is_archived_duplicate = false;

CREATE OR REPLACE VIEW public.v_production_versions AS
SELECT
  p.id AS part_id,
  p.part_number,
  p.part_name,
  p.product_type,
  p.engineering_status,
  p.safety_stock,
  p.min_lot_size,
  p.lot_rounding,
  p.lead_time_days,
  p.scrap_pct AS part_scrap_pct,
  p.regrind_pct,
  p.default_location_id,
  loc.location_code AS default_location_code,
  pm.mold_id,
  m.mold_code,
  m.mold_name,
  m.current_status AS mold_status,
  m.setup_time_min AS mold_setup_min,
  m.purge_weight_kg,
  pm.cavities_for_part,
  mm.machine_id,
  mach.machine_code,
  mach.machine_name,
  mach.tonnage AS machine_tonnage,
  mach.hours_per_day AS machine_hours_per_day,
  COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0)) AS cycle_time_sec,
  CASE
    WHEN COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0)) > 0::numeric
      THEN round((3600.0 / COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0))) * (COALESCE(pm.cavities_for_part, p.cavities, 1))::numeric, 1)
    ELSE NULL::numeric
  END AS pcs_per_hour,
  ep.empaque_id,
  emp.codigo AS empaque_codigo,
  COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0))::integer AS official_std_pack,
  pm.is_primary AS mold_is_primary,
  mm.is_primary AS machine_is_primary
FROM public.parts p
LEFT JOIN public.locations loc ON loc.id = p.default_location_id
LEFT JOIN public.part_molds pm ON pm.part_id = p.id AND pm.active
LEFT JOIN public.molds m ON m.id = pm.mold_id AND COALESCE(m.active, true)
LEFT JOIN public.mold_machines mm ON mm.mold_id = m.id AND mm.active
LEFT JOIN public.mes_machines mach ON mach.id = mm.machine_id AND COALESCE(mach.active, true)
LEFT JOIN LATERAL (
  SELECT ep1.empaque_id, ep1.standard_pack
  FROM public.empaques_partes ep1
  WHERE (ep1.part_id = p.id OR ep1.part_number = p.part_number)
    AND COALESCE(ep1.active, true) = true
  ORDER BY ep1.es_empaque_primario DESC, ep1.created_at ASC
  LIMIT 1
) ep ON true
LEFT JOIN public.empaques emp ON emp.id = ep.empaque_id
WHERE p.is_archived_duplicate = false
  AND COALESCE(p.obsolete, false) = false;

CREATE OR REPLACE VIEW public.v_planeacion_maestra AS
SELECT
  d.requerimiento_id,
  d.part_id,
  d.part_number,
  d.part_name,
  d.due_date AS fecha_entrega,
  d.required_qty AS demanda_ventas,
  d.current_inventory AS stock_actual,
  d.net_demand AS falta_producir,
  COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), NULLIF(p.pcs_per_trolley, 1))::integer AS pcs_per_trolley,
  p.max_trolleys_inventory,
  CASE
    WHEN COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), NULLIF(p.pcs_per_trolley, 1)) > 0
      THEN round((d.current_inventory::numeric / COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), NULLIF(p.pcs_per_trolley, 1))::numeric), 1)
    ELSE NULL::numeric
  END AS carritos_actuales
FROM public.v_planning_demand d
JOIN public.parts p ON d.part_id = p.id
LEFT JOIN LATERAL (
  SELECT ep1.standard_pack
  FROM public.empaques_partes ep1
  WHERE (ep1.part_id = p.id OR ep1.part_number = p.part_number)
    AND COALESCE(ep1.active, true) = true
  ORDER BY ep1.es_empaque_primario DESC, ep1.created_at ASC
  LIMIT 1
) ep ON true;
