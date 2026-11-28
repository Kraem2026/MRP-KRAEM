-- Planeación & MRP Fase 2: Órdenes de Producción APS sin duplicados, Kitting WMS FIFO y conexión relacional Compras OC
-- Script idempotente y no destructivo (sin sentencias de eliminación física)

-- 1. Extender public.production_orders para calendarización APS, olas por empaque y kitting WMS
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS planned_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS ola_num integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pack_note text,
  ADD COLUMN IF NOT EXISTS kitting_status text NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS kitting_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kitting_confirmed_by text,
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_production_orders_kitting_status'
  ) THEN
    ALTER TABLE public.production_orders
      ADD CONSTRAINT chk_production_orders_kitting_status
      CHECK (kitting_status IN ('PENDIENTE', 'PARCIAL', 'SURTIDO', 'NO_APLICA'));
  END IF;
END $$;

-- 2. Secuencia y Trigger idempotente de autofill para production_orders
CREATE SEQUENCE IF NOT EXISTS public.seq_production_orders_folio START WITH 1001;

DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '\D', '', 'g'), '')::bigint), 1000)
  INTO v_max
  FROM public.production_orders;
  PERFORM setval('public.seq_production_orders_folio', GREATEST(1000, v_max), true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_production_orders_autofill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.folio IS NULL OR btrim(NEW.folio) = '' THEN
    NEW.folio := 'WO-' || LPAD(nextval('public.seq_production_orders_folio')::text, 5, '0');
  END IF;
  IF NEW.status IS NULL OR btrim(NEW.status) = '' OR lower(NEW.status) = 'planned' THEN
    NEW.status := 'PROGRAMADA';
  END IF;
  IF NEW.ola_num IS NULL OR NEW.ola_num < 1 THEN
    NEW.ola_num := 1;
  END IF;
  IF NEW.kitting_status IS NULL OR btrim(NEW.kitting_status) = '' THEN
    NEW.kitting_status := 'PENDIENTE';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_production_orders_autofill'
      AND tgrelid = 'public.production_orders'::regclass
  ) THEN
    CREATE TRIGGER trg_production_orders_autofill
      BEFORE INSERT OR UPDATE ON public.production_orders
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_production_orders_autofill();
  END IF;
END $$;

-- 3. Índices únicos parciales antiduplicados e índices de rendimiento
CREATE UNIQUE INDEX IF NOT EXISTS uq_production_orders_folio_active
  ON public.production_orders (folio)
  WHERE folio IS NOT NULL
    AND UPPER(COALESCE(status, '')) NOT IN ('CANCELADA', 'CANCELADO');

CREATE UNIQUE INDEX IF NOT EXISTS uq_production_orders_req_ola_active
  ON public.production_orders (requerimiento_id, ola_num)
  WHERE requerimiento_id IS NOT NULL
    AND UPPER(COALESCE(status, '')) NOT IN ('CANCELADA', 'CANCELADO');

CREATE INDEX IF NOT EXISTS idx_production_orders_status_mach
  ON public.production_orders (status, machine_id);

CREATE INDEX IF NOT EXISTS idx_compras_ordenes_det_orden_part
  ON public.compras_ordenes_det (orden_id, part_id);

-- 4. Seguridad de vistas (security_invoker = true) y vista de Kitting pendiente
ALTER VIEW public.v_compras_pendientes SET (security_invoker = true);

CREATE OR REPLACE VIEW public.v_aps_kitting_pendiente
WITH (security_invoker = true) AS
SELECT
  po.id AS production_order_id,
  po.folio,
  po.status AS wo_status,
  po.kitting_status,
  po.machine_id,
  m.machine_code,
  po.mold_id,
  mo.mold_code,
  po.part_id AS pt_part_id,
  pt.part_number AS pt_part_number,
  po.quantity_planned,
  ch.id AS child_part_id,
  ch.part_number AS child_part_number,
  ch.part_name AS child_part_name,
  COALESCE(
    ch.unit_of_measure,
    CASE WHEN ch.product_type = 'RESINA' THEN 'KG' ELSE 'PZA' END
  ) AS uom,
  CEIL(
    po.quantity_planned
    * COALESCE(b.usage_qty, b.quantity, 0)
    * (1 + COALESCE(b.scrap_pct, ch.scrap_pct, 0) / 100.0)
  )::bigint AS qty_needed,
  COALESCE(inv.stock_wms, 0)::numeric AS stock_wms,
  GREATEST(
    0,
    CEIL(
      po.quantity_planned
      * COALESCE(b.usage_qty, b.quantity, 0)
      * (1 + COALESCE(b.scrap_pct, ch.scrap_pct, 0) / 100.0)
    ) - COALESCE(inv.stock_wms, 0)
  )::numeric AS shortage_qty
FROM public.production_orders po
JOIN public.parts pt ON pt.id = po.part_id
LEFT JOIN public.machines m ON m.id = po.machine_id
LEFT JOIN public.molds mo ON mo.id = po.mold_id
JOIN public.bom_structures b
  ON b.parent_id = po.part_id
  AND COALESCE(b.is_active, true) = true
  AND b.parent_id <> b.child_id
JOIN public.parts ch ON ch.id = b.child_id
LEFT JOIN (
  SELECT part_id, SUM(quantity) AS stock_wms
  FROM public.v_inventory_by_location
  GROUP BY part_id
) inv ON inv.part_id = ch.id
WHERE UPPER(COALESCE(po.status, '')) IN ('PROGRAMADA', 'EN_PROCESO');

GRANT SELECT ON public.v_aps_kitting_pendiente TO anon, authenticated;

-- 5. Neutralizar de forma segura el trigger legado trg_wo_number (apuntaba a columna inexistente wo_number)
CREATE OR REPLACE FUNCTION public.generate_wo_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.folio IS NULL OR btrim(NEW.folio) = '' THEN
    NEW.folio := 'WO-' || LPAD(nextval('public.seq_production_orders_folio')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.production_orders DISABLE TRIGGER trg_wo_number;
