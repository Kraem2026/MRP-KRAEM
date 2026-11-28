-- ============================================================================
-- KRAEM ERP / MRP - FASE 4: HOJAS DE RUTA (CA01), CHECKLISTS SMED / TAMPO / 1RA PIEZA Y CONEXION APS-MES
-- Script 100% no destructivo e idempotente (sin borrados ni reinicios de tablas).
-- ============================================================================

-- ============================================================================
-- SECCION 4A: PROCESOS, CHECKLISTS ESTANDAR Y REGISTRO DE EJECUCIONES
-- ============================================================================

-- 1. Extensiones de esquema en tablas existentes (idempotentes)
ALTER TABLE public.procesos
    ADD COLUMN IF NOT EXISTS default_checklist_id bigint REFERENCES public.checklists(id);

CREATE INDEX IF NOT EXISTS idx_procesos_default_checklist_id
    ON public.procesos(default_checklist_id);

ALTER TABLE public.checklist_items
    ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;

UPDATE public.checklist_items
SET activo = true
WHERE activo IS NULL;

ALTER TABLE public.production_orders
    ADD COLUMN IF NOT EXISTS setup_planned_min numeric;

ALTER TABLE public.production_orders
    ADD COLUMN IF NOT EXISTS setup_status text DEFAULT 'PENDIENTE';

ALTER TABLE public.production_orders
    ADD COLUMN IF NOT EXISTS smed_released_at timestamptz;

-- 2. Catalogo maestro de checklists estandar (SMED, Arranque/1ra Pieza, Tampografia, Ensamble, Cambio Material)
INSERT INTO public.checklists (codigo, nombre, tipo, descripcion, activo, updated_at)
VALUES
    ('CHK-SMED-01', 'Checklist Estándar de Montaje de Molde (SMED)', 'MONTAJE_MOLDE', 'Verificación de seguridad, fijación, conexiones y arranque de molde en prensa', true, now()),
    ('CHK-ARR-01',  'Liberación de Arranque y Primera Pieza (Inyección)', 'ARRANQUE_PRIMERA_PIEZA', 'Validación de parámetros de proceso, visual, gramaje, dimensional y empaque oficial', true, now()),
    ('CHK-TAM-01',  'Setup y Validación de Tampografía (Pad Printing)', 'TAMPOGRAFIA', 'Montaje de cliché/tampón, mezcla de tinta, fixture y prueba de adherencia', true, now()),
    ('CHK-ENS-01',  'Poka-Yoke y Verificación de Ensamble / Soldadura', 'ENSAMBLE', 'Verificación de componentes BOM en estación, sensores Poka-Yoke, soldadura y empaque', true, now()),
    ('CHK-MAT-01',  'Purga de Barril y Cambio de Resina / Color', 'CAMBIO_MATERIAL', 'Limpieza de tolva, secado de resina, purga libre de contaminación y registro de merma', true, now())
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    activo = true,
    updated_at = now();

-- Puntos de verificacion para CHK-ARR-01 (sin duplicar si ya existen por orden)
INSERT INTO public.checklist_items (checklist_id, orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio, activo)
SELECT c.id, v.orden, v.punto_verificacion, v.criterio_especificacion, v.tipo_respuesta, v.obligatorio, true
FROM public.checklists c
CROSS JOIN (VALUES
    (1, 'Hoja de parámetros vigente y lote de resina seca en tolva', 'Parámetros cargados conforme a ficha técnica y lote trazable', 'OK_NOK', true),
    (2, 'Inspección visual libre de ráfagas, quemados, rechupes o rebaba', '100% libre de defectos cosméticos en zona A/B', 'OK_NOK', true),
    (3, 'Peso neto de pieza en gramos dentro de tolerancia de ficha técnica', 'Peso báscula vs nominal de ficha técnica (+/- tolerancia)', 'NUMERICO', true),
    (4, 'Dimensiones críticas / Galga Go-NoGo conforme a plano', 'Pasa galga de control / CMM sin interferencia', 'OK_NOK', true),
    (5, 'Identificación de contenedor conforme a Standard Pack oficial', 'Etiqueta y cama de empaque oficial asignada', 'OK_NOK', true)
) AS v(orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio)
WHERE c.codigo = 'CHK-ARR-01'
  AND NOT EXISTS (
      SELECT 1 FROM public.checklist_items ci
      WHERE ci.checklist_id = c.id AND ci.orden = v.orden
  );

-- Puntos de verificacion para CHK-TAM-01
INSERT INTO public.checklist_items (checklist_id, orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio, activo)
SELECT c.id, v.orden, v.punto_verificacion, v.criterio_especificacion, v.tipo_respuesta, v.obligatorio, true
FROM public.checklists c
CROSS JOIN (VALUES
    (1, 'Montaje y limpieza de cliché fotopolímero/acero y tampón sin daño', 'Superficie limpia sin ralladuras ni residuos secos', 'OK_NOK', true),
    (2, 'Preparación de tinta, catalizador y solvente con lote vigente', 'Registrar código de lote y relación de mezcla', 'TEXTO', true),
    (3, 'Alineación de pieza en fixture/jig y posición de gráfico según estándar', 'Centrado y nitidez dentro de tolerancia visual', 'OK_NOK', true),
    (4, 'Prueba de adherencia (Tape Test / Cross-Hatch) sin desprendimiento', 'Sin transferencia de tinta en cinta 3M', 'OK_NOK', true),
    (5, 'Verificación de curado/secado y liberación de primera pieza impresa', 'Sin manchado al tacto tras tiempo de curado', 'OK_NOK', true)
) AS v(orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio)
WHERE c.codigo = 'CHK-TAM-01'
  AND NOT EXISTS (
      SELECT 1 FROM public.checklist_items ci
      WHERE ci.checklist_id = c.id AND ci.orden = v.orden
  );

-- Puntos de verificacion para CHK-ENS-01
INSERT INTO public.checklist_items (checklist_id, orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio, activo)
SELECT c.id, v.orden, v.punto_verificacion, v.criterio_especificacion, v.tipo_respuesta, v.obligatorio, true
FROM public.checklists c
CROSS JOIN (VALUES
    (1, 'Componentes del BOM (clips, pads, fasteners) verificados en estación FIFO', 'Surtido completo con etiqueta de lote vigente', 'OK_NOK', true),
    (2, 'Validación de sensores Poka-Yoke y sujeción de fixture', 'Prueba con pieza máster / rechazo correcto de falla', 'OK_NOK', true),
    (3, 'Retención mecánica / soldadura ultrasónica sin holgura ni daño cosmético', 'Unión firme conforme a estándar de ingeniería', 'OK_NOK', true),
    (4, 'Acomodo en empaque oficial conforme a Standard Pack WMS', 'Cantidad exacta y protección correcta por cama', 'OK_NOK', true)
) AS v(orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio)
WHERE c.codigo = 'CHK-ENS-01'
  AND NOT EXISTS (
      SELECT 1 FROM public.checklist_items ci
      WHERE ci.checklist_id = c.id AND ci.orden = v.orden
  );

-- Puntos de verificacion para CHK-MAT-01
INSERT INTO public.checklist_items (checklist_id, orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio, activo)
SELECT c.id, v.orden, v.punto_verificacion, v.criterio_especificacion, v.tipo_respuesta, v.obligatorio, true
FROM public.checklists c
CROSS JOIN (VALUES
    (1, 'Limpieza de tolva, imán y mangueras sin gránulos del material anterior', 'Inspección visual 100% libre de contaminación', 'OK_NOK', true),
    (2, 'Temperatura y horas de secado del nuevo grado verificadas (°C)', 'Registrar temperatura real de deshumidificador (°C)', 'NUMERICO', true),
    (3, 'Purga completa de unidad de inyección libre de contaminación de color', 'Colada / plasta limpia con color uniforme del nuevo material', 'OK_NOK', true),
    (4, 'Pesaje e identificación de plasta de purga generada (g)', 'Registrar peso total de purga para balance de resina (g)', 'NUMERICO', true)
) AS v(orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio)
WHERE c.codigo = 'CHK-MAT-01'
  AND NOT EXISTS (
      SELECT 1 FROM public.checklist_items ci
      WHERE ci.checklist_id = c.id AND ci.orden = v.orden
  );

-- 3. Asegurar proceso PROC-TAM y ligar checklist default + areas por proceso
INSERT INTO public.procesos (codigo, nombre, tipo, std_setup_min, requiere_molde, requiere_checklist, descripcion, activo)
VALUES (
    'PROC-TAM',
    'Tampografía / Pad Printing',
    'TAMPOGRAFIA',
    20,
    false,
    true,
    'Impresión tampográfica (Pad Print), cliché, tinta y curado',
    true
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = 'TAMPOGRAFIA',
    std_setup_min = COALESCE(public.procesos.std_setup_min, 20),
    requiere_checklist = true,
    activo = true;

UPDATE public.procesos p
SET default_checklist_id = c.id
FROM public.checklists c
WHERE (
    (p.codigo = 'PROC-INY' AND c.codigo = 'CHK-SMED-01')
    OR (p.codigo = 'PROC-TAM' AND c.codigo = 'CHK-TAM-01')
    OR (p.codigo = 'PROC-SOL' AND c.codigo = 'CHK-ENS-01')
    OR (p.codigo = 'PROC-ENS' AND c.codigo = 'CHK-ENS-01')
    OR (p.codigo = 'PROC-INS' AND c.codigo = 'CHK-ARR-01')
);

UPDATE public.procesos p
SET area_id = CASE p.codigo
    WHEN 'PROC-INY' THEN (SELECT id FROM public.areas WHERE id = 2 LIMIT 1)
    WHEN 'PROC-ENS' THEN (SELECT id FROM public.areas WHERE id = 11 LIMIT 1)
    WHEN 'PROC-INS' THEN (SELECT id FROM public.areas WHERE id = 5 LIMIT 1)
    WHEN 'PROC-EMP' THEN (SELECT id FROM public.areas WHERE id = 4 LIMIT 1)
    ELSE p.area_id
END
WHERE p.area_id IS NULL
  AND p.codigo IN ('PROC-INY', 'PROC-ENS', 'PROC-INS', 'PROC-EMP');

-- 4. Tabla auditada de ejecuciones reales de Checklists (SMED, Arranque/1ra Pieza, Tampo, Ensamble)
CREATE TABLE IF NOT EXISTS public.checklist_executions (
    id bigserial PRIMARY KEY,
    checklist_id bigint NOT NULL REFERENCES public.checklists(id),
    production_order_id bigint REFERENCES public.production_orders(id),
    wo_folio text,
    run_id bigint REFERENCES public.runs(id),
    part_id bigint REFERENCES public.parts(id),
    mold_id bigint REFERENCES public.molds(id),
    machine_id bigint REFERENCES public.mes_machines(id),
    execution_type text NOT NULL DEFAULT 'MONTAJE_MOLDE',
    status text NOT NULL DEFAULT 'APROBADO',
    setup_duration_min numeric,
    wms_kit_confirmed boolean DEFAULT false,
    responses jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes text,
    executed_by uuid DEFAULT auth.uid(),
    executed_by_email text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.production_orders
    ADD COLUMN IF NOT EXISTS smed_execution_id bigint REFERENCES public.checklist_executions(id);

CREATE INDEX IF NOT EXISTS idx_checklist_executions_checklist_id ON public.checklist_executions(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_po_id ON public.checklist_executions(production_order_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_run_id ON public.checklist_executions(run_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_part_id ON public.checklist_executions(part_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_mold_id ON public.checklist_executions(mold_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_machine_id ON public.checklist_executions(machine_id);
CREATE INDEX IF NOT EXISTS idx_checklist_executions_created_at ON public.checklist_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_orders_smed_exec_id ON public.production_orders(smed_execution_id);

ALTER TABLE public.checklist_executions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.checklist_executions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.checklist_executions_id_seq TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'checklist_executions' AND policyname = 'checklist_executions_select_auth'
    ) THEN
        CREATE POLICY checklist_executions_select_auth
            ON public.checklist_executions
            FOR SELECT
            TO authenticated
            USING ((select auth.uid()) IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'checklist_executions' AND policyname = 'checklist_executions_insert_auth'
    ) THEN
        CREATE POLICY checklist_executions_insert_auth
            ON public.checklist_executions
            FOR INSERT
            TO authenticated
            WITH CHECK ((select auth.uid()) IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'checklist_executions' AND policyname = 'checklist_executions_update_auth'
    ) THEN
        CREATE POLICY checklist_executions_update_auth
            ON public.checklist_executions
            FOR UPDATE
            TO authenticated
            USING ((select auth.uid()) IS NOT NULL)
            WITH CHECK ((select auth.uid()) IS NOT NULL);
    END IF;
END $$;


-- ============================================================================
-- SECCION 4B: POBLACION INICIAL DE HOJAS DE RUTA (SAP CA01 -> public.part_routings)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_part_routings_proceso_id ON public.part_routings(proceso_id);
CREATE INDEX IF NOT EXISTS idx_part_routings_mold_id ON public.part_routings(mold_id);
CREATE INDEX IF NOT EXISTS idx_part_routings_machine_id ON public.part_routings(machine_id);
CREATE INDEX IF NOT EXISTS idx_part_routings_checklist_id ON public.part_routings(checklist_id);
CREATE INDEX IF NOT EXISTS idx_part_routings_area_id ON public.part_routings(area_id);

-- Seq 10: PROC-INY (Inyeccion con molde y maquina principal)
INSERT INTO public.part_routings (
    part_id, seq_num, proceso_id, area_id, mold_id, machine_id, checklist_id,
    std_time_sec, setup_time_min, operators_req, notas, is_active
)
SELECT
    p.id AS part_id,
    10 AS seq_num,
    pr.id AS proceso_id,
    COALESCE(
        (SELECT a.id FROM public.areas a WHERE a.id = CASE COALESCE(mach.area_general_id, 1) WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 12 ELSE 2 END LIMIT 1),
        pr.area_id
    ) AS area_id,
    pm.mold_id,
    mm.machine_id,
    chk.id AS checklist_id,
    round(
        COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0), 30)::numeric
        / GREATEST(COALESCE(pm.cavities_for_part, NULLIF(p.cavities, 0), 1), 1)::numeric,
        2
    ) AS std_time_sec,
    COALESCE(m.setup_time_min, pr.std_setup_min, 45) AS setup_time_min,
    1 AS operators_req,
    'Moldeo por inyección conforme a hoja de parámetros' AS notas,
    true AS is_active
FROM public.parts p
JOIN public.procesos pr ON pr.codigo = 'PROC-INY'
LEFT JOIN public.checklists chk ON chk.codigo = 'CHK-SMED-01'
CROSS JOIN LATERAL (
    SELECT pm1.mold_id, pm1.cavities_for_part, pm1.cycle_time_sec
    FROM public.part_molds pm1
    JOIN public.molds m1 ON m1.id = pm1.mold_id
    WHERE pm1.part_id = p.id
      AND COALESCE(pm1.active, true) = true
      AND COALESCE(m1.active, true) = true
    ORDER BY pm1.is_primary DESC, pm1.id
    LIMIT 1
) pm
JOIN public.molds m ON m.id = pm.mold_id
LEFT JOIN LATERAL (
    SELECT mm1.machine_id, mm1.cycle_time_sec
    FROM public.mold_machines mm1
    JOIN public.mes_machines mach1 ON mach1.id = mm1.machine_id
    WHERE mm1.mold_id = pm.mold_id
      AND COALESCE(mm1.active, true) = true
      AND COALESCE(mach1.active, true) = true
    ORDER BY mm1.is_primary DESC, mm1.id
    LIMIT 1
) mm ON true
LEFT JOIN public.mes_machines mach ON mach.id = mm.machine_id
WHERE NOT COALESCE(p.is_archived_duplicate, false)
  AND NOT COALESCE(p.obsolete, false)
  AND p.product_type IN ('PT', 'SUB-ENSAMBLE')
ON CONFLICT (part_id, seq_num) DO NOTHING;

-- Seq 20: PROC-TAM (Tampografia / Pad Printing detectado en nombre o componente BOM)
INSERT INTO public.part_routings (
    part_id, seq_num, proceso_id, area_id, mold_id, machine_id, checklist_id,
    std_time_sec, setup_time_min, operators_req, notas, is_active
)
SELECT
    p.id AS part_id,
    20 AS seq_num,
    pr.id AS proceso_id,
    pr.area_id,
    NULL AS mold_id,
    NULL AS machine_id,
    chk.id AS checklist_id,
    18 AS std_time_sec,
    COALESCE(pr.std_setup_min, 20) AS setup_time_min,
    1 AS operators_req,
    'Aplicación de tampografía (Pad Printing) y curado' AS notas,
    true AS is_active
FROM public.parts p
JOIN public.procesos pr ON pr.codigo = 'PROC-TAM'
LEFT JOIN public.checklists chk ON chk.codigo = 'CHK-TAM-01'
WHERE NOT COALESCE(p.is_archived_duplicate, false)
  AND NOT COALESCE(p.obsolete, false)
  AND p.product_type IN ('PT', 'SUB-ENSAMBLE')
  AND (
      COALESCE(p.part_name, '') ILIKE '%PAD PRINT%'
      OR COALESCE(p.part_name, '') ILIKE '%TAMPO%'
      OR EXISTS (
          SELECT 1
          FROM public.bom_structures b
          JOIN public.parts ch ON ch.id = b.child_id
          WHERE b.parent_id = p.id
            AND b.is_active IS DISTINCT FROM false
            AND b.parent_id <> b.child_id
            AND (
                COALESCE(ch.part_name, '') ILIKE '%PRINT%'
                OR COALESCE(ch.part_name, '') ILIKE '%TAMPO%'
                OR COALESCE(ch.part_name, '') ILIKE '%INK%'
                OR COALESCE(ch.part_name, '') ILIKE '%TINTA%'
            )
      )
  )
ON CONFLICT (part_id, seq_num) DO NOTHING;

-- Seq 30: PROC-ENS (Ensamble / sub-ensamble de componentes BOM reales)
INSERT INTO public.part_routings (
    part_id, seq_num, proceso_id, area_id, mold_id, machine_id, checklist_id,
    std_time_sec, setup_time_min, operators_req, notas, is_active
)
SELECT
    p.id AS part_id,
    30 AS seq_num,
    pr.id AS proceso_id,
    COALESCE((SELECT a.id FROM public.areas a WHERE a.id = 11 LIMIT 1), pr.area_id) AS area_id,
    NULL AS mold_id,
    NULL AS machine_id,
    chk.id AS checklist_id,
    25 AS std_time_sec,
    COALESCE(pr.std_setup_min, 10) AS setup_time_min,
    CASE
        WHEN (
            SELECT count(*)
            FROM public.bom_structures b2
            JOIN public.parts ch2 ON ch2.id = b2.child_id
            WHERE b2.parent_id = p.id
              AND b2.is_active IS DISTINCT FROM false
              AND b2.parent_id <> b2.child_id
              AND ch2.product_type IN ('COMPONENTE', 'SUB-ENSAMBLE')
        ) >= 5 THEN 2
        ELSE 1
    END AS operators_req,
    'Sub-ensamble de componentes y verificación Poka-Yoke' AS notas,
    true AS is_active
FROM public.parts p
JOIN public.procesos pr ON pr.codigo = 'PROC-ENS'
LEFT JOIN public.checklists chk ON chk.codigo = 'CHK-ENS-01'
WHERE NOT COALESCE(p.is_archived_duplicate, false)
  AND NOT COALESCE(p.obsolete, false)
  AND p.product_type IN ('PT', 'SUB-ENSAMBLE')
  AND EXISTS (
      SELECT 1
      FROM public.bom_structures b
      JOIN public.parts ch ON ch.id = b.child_id
      WHERE b.parent_id = p.id
        AND b.is_active IS DISTINCT FROM false
        AND b.parent_id <> b.child_id
        AND ch.product_type IN ('COMPONENTE', 'SUB-ENSAMBLE')
        AND NOT (COALESCE(ch.part_name, '') ILIKE '%PAD PRINT%')
  )
ON CONFLICT (part_id, seq_num) DO NOTHING;

-- Seq 40: PROC-INS (Inspeccion final y liberacion para PTs con operaciones previas)
INSERT INTO public.part_routings (
    part_id, seq_num, proceso_id, area_id, mold_id, machine_id, checklist_id,
    std_time_sec, setup_time_min, operators_req, notas, is_active
)
SELECT
    p.id AS part_id,
    40 AS seq_num,
    pr.id AS proceso_id,
    COALESCE((SELECT a.id FROM public.areas a WHERE a.id = 5 LIMIT 1), pr.area_id) AS area_id,
    NULL AS mold_id,
    NULL AS machine_id,
    chk.id AS checklist_id,
    8 AS std_time_sec,
    0 AS setup_time_min,
    1 AS operators_req,
    'Inspección dimensional/visual y liberación de calidad' AS notas,
    true AS is_active
FROM public.parts p
JOIN public.procesos pr ON pr.codigo = 'PROC-INS'
LEFT JOIN public.checklists chk ON chk.codigo = 'CHK-ARR-01'
WHERE NOT COALESCE(p.is_archived_duplicate, false)
  AND NOT COALESCE(p.obsolete, false)
  AND p.product_type = 'PT'
  AND EXISTS (
      SELECT 1
      FROM public.part_routings r
      WHERE r.part_id = p.id
        AND r.seq_num IN (10, 20, 30)
        AND r.is_active IS DISTINCT FROM false
  )
ON CONFLICT (part_id, seq_num) DO NOTHING;

-- Seq 50: PROC-EMP (Empaque y etiquetado WMS cuando hay Standard Pack o empaque oficial)
INSERT INTO public.part_routings (
    part_id, seq_num, proceso_id, area_id, mold_id, machine_id, checklist_id,
    std_time_sec, setup_time_min, operators_req, notas, is_active
)
SELECT
    p.id AS part_id,
    50 AS seq_num,
    pr.id AS proceso_id,
    COALESCE((SELECT a.id FROM public.areas a WHERE a.id = 4 LIMIT 1), pr.area_id) AS area_id,
    NULL AS mold_id,
    NULL AS machine_id,
    NULL AS checklist_id,
    5 AS std_time_sec,
    0 AS setup_time_min,
    1 AS operators_req,
    'Empaque en contenedor oficial conforme a Standard Pack WMS' AS notas,
    true AS is_active
FROM public.parts p
JOIN public.procesos pr ON pr.codigo = 'PROC-EMP'
WHERE NOT COALESCE(p.is_archived_duplicate, false)
  AND NOT COALESCE(p.obsolete, false)
  AND p.product_type = 'PT'
  AND (
      COALESCE(p.std_pack, 0) > 0
      OR EXISTS (
          SELECT 1
          FROM public.empaques_partes ep
          WHERE (ep.part_id = p.id OR ep.part_number = p.part_number)
            AND COALESCE(ep.active, true) = true
      )
  )
ON CONFLICT (part_id, seq_num) DO NOTHING;


-- ============================================================================
-- SECCION 4C: VISTAS INTEGRADAS DE RUTAS Y VERSIONES DE FABRICACION
-- ============================================================================

CREATE OR REPLACE VIEW public.v_part_routing_summary
WITH (security_invoker = true) AS
SELECT
    pr.part_id,
    count(*)::int AS routing_steps_count,
    string_agg(proc.codigo, ' → ' ORDER BY pr.seq_num) AS route_codes_chain,
    string_agg(proc.nombre, ' → ' ORDER BY pr.seq_num) AS route_names_chain,
    bool_or(proc.tipo = 'INYECCION') AS has_injection,
    bool_or(proc.tipo = 'TAMPOGRAFIA') AS has_tampo,
    bool_or(proc.tipo IN ('ENSAMBLE', 'SOLDADURA')) AS has_assembly,
    MAX(pr.setup_time_min) FILTER (WHERE proc.tipo = 'INYECCION') AS inj_setup_min,
    COALESCE(SUM(pr.setup_time_min), 0::numeric) AS total_setup_min,
    COALESCE(SUM(pr.std_time_sec) FILTER (WHERE proc.tipo <> 'INYECCION'), 0::numeric) AS post_inj_time_sec,
    COALESCE(MAX(pr.operators_req), 1) AS max_operators_req,
    (array_agg(pr.checklist_id ORDER BY pr.seq_num) FILTER (WHERE proc.tipo = 'INYECCION' AND pr.checklist_id IS NOT NULL))[1] AS primary_smed_checklist_id,
    (array_agg(pr.checklist_id ORDER BY pr.seq_num DESC) FILTER (WHERE proc.tipo = 'INSPECCION' AND pr.checklist_id IS NOT NULL))[1] AS primary_release_checklist_id
FROM public.part_routings pr
JOIN public.procesos proc ON proc.id = pr.proceso_id
WHERE COALESCE(pr.is_active, true) = true
GROUP BY pr.part_id;

GRANT SELECT ON public.v_part_routing_summary TO authenticated, anon;

CREATE OR REPLACE VIEW public.v_production_versions
WITH (security_invoker = true) AS
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
    COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0::numeric)) AS cycle_time_sec,
    CASE
        WHEN COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0::numeric)) > 0::numeric
            THEN round(3600.0 / COALESCE(mm.cycle_time_sec, pm.cycle_time_sec, NULLIF(p.cycle_time_seg, 0::numeric)) * COALESCE(pm.cavities_for_part, p.cavities, 1)::numeric, 1)
        ELSE NULL::numeric
    END AS pcs_per_hour,
    ep.empaque_id,
    emp.codigo AS empaque_codigo,
    COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0)) AS official_std_pack,
    pm.is_primary AS mold_is_primary,
    mm.is_primary AS machine_is_primary,
    COALESCE(rs.routing_steps_count, 0) AS routing_steps_count,
    rs.route_codes_chain,
    COALESCE(rs.total_setup_min, m.setup_time_min, 0::numeric) AS route_total_setup_min,
    COALESCE(rs.max_operators_req, 1) AS max_operators_req,
    COALESCE(rs.has_tampo, false) AS has_tampo,
    COALESCE(rs.has_assembly, false) AS has_assembly,
    rs.primary_smed_checklist_id
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
    ORDER BY ep1.es_empaque_primario DESC, ep1.created_at
    LIMIT 1
) ep ON true
LEFT JOIN public.empaques emp ON emp.id = ep.empaque_id
LEFT JOIN public.v_part_routing_summary rs ON rs.part_id = p.id
WHERE p.is_archived_duplicate = false
  AND COALESCE(p.obsolete, false) = false;

GRANT SELECT ON public.v_production_versions TO authenticated, anon;
