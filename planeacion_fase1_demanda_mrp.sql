-- ============================================================================
-- KRAEM ERP / MRP - PLANEACION FASE 1: DEMANDA UNIFICADA, FORECAST VS FIRME Y MRP
-- Script 100% no destructivo e idempotente (sin borrados ni reinicios de tablas).
-- ============================================================================

-- ============================================================================
-- SECCION 1A: EXTENSION DE public.requerimientos Y AUTOMATIZACION DE FOLIOS
-- ============================================================================

ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS folio_demanda text;
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS tipo_demanda text NOT NULL DEFAULT 'PEDIDO_FIRME';
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS cliente text;
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS proyecto text;
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS prioridad text DEFAULT 'NORMAL';
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS origen text DEFAULT 'MANUAL';
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS lote_importacion text;
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE public.requerimientos ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_requerimientos_tipo_demanda'
    ) THEN
        ALTER TABLE public.requerimientos
            ADD CONSTRAINT chk_requerimientos_tipo_demanda
            CHECK (tipo_demanda = ANY (ARRAY['PEDIDO_FIRME'::text, 'FORECAST'::text]));
    END IF;
END $$;

UPDATE public.requerimientos
SET folio_demanda = 'DEM-' || lpad(id::text, 5, '0')
WHERE folio_demanda IS NULL OR btrim(folio_demanda) = '';

UPDATE public.requerimientos r
SET cliente = COALESCE(r.cliente, p.client),
    proyecto = COALESCE(r.proyecto, p.project)
FROM public.parts p
WHERE r.part_id = p.id
  AND (r.cliente IS NULL OR r.proyecto IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_requerimientos_folio_demanda
    ON public.requerimientos(folio_demanda)
    WHERE folio_demanda IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requerimientos_part_id
    ON public.requerimientos(part_id);

CREATE INDEX IF NOT EXISTS idx_requerimientos_status_due
    ON public.requerimientos(status, due_date);

CREATE INDEX IF NOT EXISTS idx_requerimientos_tipo_demanda
    ON public.requerimientos(tipo_demanda);

CREATE OR REPLACE FUNCTION public.fn_requerimientos_autofill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.folio_demanda IS NULL OR btrim(NEW.folio_demanda) = '' THEN
        NEW.folio_demanda := CASE
            WHEN NEW.id IS NOT NULL THEN 'DEM-' || lpad(NEW.id::text, 5, '0')
            ELSE 'DEM-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS')
        END;
    END IF;

    IF NEW.tipo_demanda IS NULL OR btrim(NEW.tipo_demanda) = '' THEN
        NEW.tipo_demanda := 'PEDIDO_FIRME';
    END IF;

    IF (NEW.cliente IS NULL OR NEW.proyecto IS NULL) AND NEW.part_id IS NOT NULL THEN
        SELECT COALESCE(NEW.cliente, p.client), COALESCE(NEW.proyecto, p.project)
        INTO NEW.cliente, NEW.proyecto
        FROM public.parts p
        WHERE p.id = NEW.part_id;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_requerimientos_autofill'
          AND tgrelid = 'public.requerimientos'::regclass
    ) THEN
        CREATE TRIGGER trg_requerimientos_autofill
            BEFORE INSERT OR UPDATE ON public.requerimientos
            FOR EACH ROW
            EXECUTE FUNCTION public.fn_requerimientos_autofill();
    END IF;
END $$;


-- ============================================================================
-- SECCION 1B: VISTAS DE DEMANDA, PLANEACION MAESTRA Y COBERTURA COMERCIAL
-- ============================================================================

CREATE OR REPLACE VIEW public.v_requerimientos_detalle
WITH (security_invoker = true) AS
SELECT
    r.id AS requerimiento_id,
    r.part_id,
    p.part_number,
    p.part_name,
    p.project,
    p.abc_class,
    r.quantity AS required_qty,
    r.due_date,
    r.status,
    COALESCE(inv.total_quantity, 0::bigint) AS current_inventory,
    r.folio_demanda,
    r.tipo_demanda,
    COALESCE(r.cliente, p.client) AS cliente,
    r.prioridad,
    r.notas
FROM public.requerimientos r
JOIN public.parts p ON p.id = r.part_id
LEFT JOIN public.v_inventory_total inv ON inv.part_number = p.part_number;

CREATE OR REPLACE VIEW public.v_open_requerimientos
WITH (security_invoker = true) AS
SELECT
    r.id AS requerimiento_id,
    r.part_id,
    d.part_number,
    d.project,
    d.abc_class,
    r.quantity AS required_qty,
    ceil(r.quantity::numeric * 1.10) AS qty_with_buffer,
    r.due_date,
    r.status,
    r.tipo_demanda,
    COALESCE(r.cliente, d.cliente) AS cliente,
    r.folio_demanda
FROM public.requerimientos r
JOIN public.v_requerimientos_detalle d ON d.requerimiento_id = r.id
WHERE r.status = ANY (ARRAY['ABIERTO'::text, 'open'::text]);

CREATE OR REPLACE VIEW public.v_planning_demand
WITH (security_invoker = true) AS
SELECT
    r.id AS requerimiento_id,
    r.part_id,
    p.part_number,
    p.part_name,
    r.due_date,
    r.quantity AS required_qty,
    COALESCE(inv.total_quantity, 0::bigint) AS current_inventory,
    GREATEST(r.quantity - COALESCE(inv.total_quantity, 0::bigint), 0::bigint) AS net_demand,
    r.status,
    r.tipo_demanda,
    COALESCE(r.cliente, p.client) AS cliente,
    COALESCE(r.proyecto, p.project) AS proyecto,
    r.folio_demanda
FROM public.requerimientos r
JOIN public.parts p ON p.id = r.part_id
LEFT JOIN public.v_inventory_total inv ON inv.part_number = p.part_number
WHERE r.status = ANY (ARRAY['ABIERTO'::text, 'open'::text]);

CREATE OR REPLACE VIEW public.v_planeacion_maestra
WITH (security_invoker = true) AS
SELECT
    d.requerimiento_id,
    d.part_id,
    d.part_number,
    d.part_name,
    d.due_date AS fecha_entrega,
    d.required_qty AS demanda_ventas,
    d.current_inventory AS stock_actual,
    d.net_demand AS falta_producir,
    COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), NULLIF(p.pcs_per_trolley, 1)) AS pcs_per_trolley,
    p.max_trolleys_inventory,
    CASE
        WHEN COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), NULLIF(p.pcs_per_trolley, 1)) > 0
            THEN round(d.current_inventory::numeric / COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), NULLIF(p.pcs_per_trolley, 1))::numeric, 1)
        ELSE NULL::numeric
    END AS carritos_actuales,
    d.status,
    d.tipo_demanda,
    d.cliente,
    d.proyecto,
    d.folio_demanda
FROM public.v_planning_demand d
JOIN public.parts p ON d.part_id = p.id
LEFT JOIN LATERAL (
    SELECT ep1.standard_pack
    FROM public.empaques_partes ep1
    WHERE (ep1.part_id = p.id OR ep1.part_number = p.part_number)
      AND COALESCE(ep1.active, true) = true
    ORDER BY ep1.es_empaque_primario DESC, ep1.created_at
    LIMIT 1
) ep ON true;

CREATE OR REPLACE VIEW public.v_cobertura_demanda_pt
WITH (security_invoker = true) AS
WITH stk AS (
    SELECT v.part_id, COALESCE(SUM(v.quantity), 0)::numeric AS qty
    FROM public.v_inventory_by_location v
    WHERE v.quantity > 0
    GROUP BY v.part_id
),
wo AS (
    SELECT po.part_id, COALESCE(SUM(po.quantity_planned), 0)::numeric AS qty
    FROM public.production_orders po
    WHERE po.part_id IS NOT NULL
      AND po.status = ANY (ARRAY['PROGRAMADA'::text, 'planned'::text, 'EN_PROCESO'::text])
    GROUP BY po.part_id
),
req AS (
    SELECT
        r.part_id,
        COALESCE(SUM(r.quantity) FILTER (WHERE r.tipo_demanda = 'PEDIDO_FIRME'), 0)::numeric AS firm_qty,
        COALESCE(SUM(r.quantity) FILTER (WHERE r.tipo_demanda = 'FORECAST'), 0)::numeric AS fcst_qty
    FROM public.requerimientos r
    WHERE r.status = ANY (ARRAY['ABIERTO'::text, 'open'::text])
    GROUP BY r.part_id
),
mov AS (
    SELECT im.part_id, COALESCE(SUM(ABS(im.quantity)), 0)::numeric AS out_30d
    FROM public.inventory_movements im
    WHERE im.movement_type = ANY (ARRAY['SALIDA'::text, 'OUT'::text])
      AND COALESCE(im.reversado, false) = false
      AND COALESCE(im.es_reversa, false) = false
      AND im.created_at >= (now() - interval '30 days')
    GROUP BY im.part_id
)
SELECT
    p.id AS part_id,
    p.part_number,
    p.part_name,
    p.product_type,
    p.client,
    p.project,
    COALESCE(p.safety_stock, 0)::numeric AS safety_stock,
    COALESCE(ep.standard_pack, NULLIF(p.std_pack, 0), 0)::int AS std_pack,
    COALESCE(stk.qty, 0)::numeric AS current_inventory,
    COALESCE(wo.qty, 0)::numeric AS open_wo_qty,
    COALESCE(req.firm_qty, 0)::numeric AS firm_demand_qty,
    COALESCE(req.fcst_qty, 0)::numeric AS forecast_demand_qty,
    COALESCE(mov.out_30d, 0)::numeric AS outflow_30d,
    round(COALESCE(mov.out_30d, 0)::numeric / 30.0, 2) AS avg_daily_consumption,
    round(COALESCE(mov.out_30d, 0)::numeric, 1) AS avg_monthly_consumption,
    CASE
        WHEN COALESCE(mov.out_30d, 0) > 0
            THEN round(COALESCE(stk.qty, 0)::numeric / (mov.out_30d::numeric / 30.0), 1)
        WHEN (COALESCE(req.firm_qty, 0) + COALESCE(req.fcst_qty, 0)) > 0
            THEN round(COALESCE(stk.qty, 0)::numeric / ((COALESCE(req.firm_qty, 0) + COALESCE(req.fcst_qty, 0))::numeric / 30.0), 1)
        ELSE NULL::numeric
    END AS coverage_days
FROM public.parts p
LEFT JOIN stk ON stk.part_id = p.id
LEFT JOIN wo ON wo.part_id = p.id
LEFT JOIN req ON req.part_id = p.id
LEFT JOIN mov ON mov.part_id = p.id
LEFT JOIN LATERAL (
    SELECT ep1.standard_pack
    FROM public.empaques_partes ep1
    WHERE (ep1.part_id = p.id OR ep1.part_number = p.part_number)
      AND COALESCE(ep1.active, true) = true
    ORDER BY ep1.es_empaque_primario DESC, ep1.created_at
    LIMIT 1
) ep ON true
WHERE NOT COALESCE(p.is_archived_duplicate, false)
  AND NOT COALESCE(p.obsolete, false)
  AND p.product_type = ANY (ARRAY['PT'::text, 'SUB-ENSAMBLE'::text]);

GRANT SELECT ON public.v_requerimientos_detalle, public.v_open_requerimientos, public.v_planning_demand, public.v_planeacion_maestra, public.v_cobertura_demanda_pt TO authenticated, anon;
