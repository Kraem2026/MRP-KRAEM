-- ============================================================================
-- KRAEM MRP/ERP — FASE 1 INGENIERIA & CATALOGOS MAESTROS
-- Migración aditiva e idempotente (sin sentencias destructivas DROP):
-- 1. Agrega columna rfc a public.clientes y siembra los 24 clientes reales.
-- 2. Enriquece public.defects (categoria, destino_sugerido, activo) y lo
--    sincroniza bidireccionalmente hacia public.defect (FK de run_defects).
-- 3. Agrega el proceso estándar PROC-TAM (Tampografía / Pad Printing).
-- ============================================================================

-- 1. CLIENTES
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS rfc text;

INSERT INTO public.clientes (codigo, nombre, dias_transito, activo)
SELECT v.codigo, v.nombre, 1, true
FROM (VALUES
  ('CLI-AGS', 'AGS'),
  ('CLI-DONGJIN', 'DONGJIN'),
  ('CLI-DSA-USA', 'DSA 대한USA'),
  ('CLI-DSG-USA', 'DSG 대한USA'),
  ('CLI-DSM', 'DSM 대한'),
  ('CLI-GLOBAL-JJ', 'GLOBAL JJ'),
  ('CLI-HANWHA', 'HANWHA'),
  ('CLI-JINTECH', 'JIN TECH'),
  ('CLI-JMIMX', 'JMIMX'),
  ('CLI-KFTA', 'KFTA'),
  ('CLI-KJ', 'KJ'),
  ('CLI-KRAEM-USA', 'KRAEM USA'),
  ('CLI-KRAEM-KAIS', 'KRAEM USA(KAIS)'),
  ('CLI-KRAEM-TRANSYS', 'KRAEM USA(TRANSYS)'),
  ('CLI-KRAEM-GM', 'KRAEM USA(광명USA)'),
  ('CLI-MAUTOTECH', 'M-Autotech'),
  ('CLI-MOBIS', 'MOBIS'),
  ('CLI-PHA', 'PHA'),
  ('CLI-PROPLASTIC', 'PRO PLASTIC'),
  ('CLI-SEMA', 'SEMA 서연'),
  ('CLI-SEOYON', 'Seoyon 서연'),
  ('CLI-SNA', 'SNA 서연'),
  ('CLI-TRANSYS-SAV', 'TRANSYS SAVANNAH'),
  ('CLI-WOOSUNG', 'WOOSUNG')
) AS v(codigo, nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.clientes c WHERE upper(c.nombre) = upper(v.nombre)
)
ON CONFLICT (codigo) DO NOTHING;

-- 2. DEFECTOS UNIFICADOS (public.defects -> public.defect)
ALTER TABLE public.defects ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'INYECCION';
ALTER TABLE public.defects ADD COLUMN IF NOT EXISTS destino_sugerido text NOT NULL DEFAULT 'SCRAP';
ALTER TABLE public.defects ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

UPDATE public.defects SET categoria = 'EMPAQUE', destino_sugerido = 'RETRABAJO' WHERE "Defect_name" ILIKE '%Etiqueta%';
UPDATE public.defects SET categoria = 'TAMPOGRAFIA' WHERE "Defect_name" IN ('Serigrafia Mal', 'Mal Pintado', 'Mancha');
UPDATE public.defects SET categoria = 'ENSAMBLE' WHERE "Defect_name" ILIKE '%Ultrasonico%';
UPDATE public.defects SET destino_sugerido = 'RETRABAJO' WHERE "Defect_name" IN ('Mal rebabeo', 'Mal corte', 'Rebaba');

INSERT INTO public.defect (id, "Defect_name", created_at)
SELECT id, "Defect_name", created_at
FROM public.defects
ON CONFLICT (id) DO UPDATE SET "Defect_name" = EXCLUDED."Defect_name";

SELECT setval(pg_get_serial_sequence('public.defects', 'id'), COALESCE((SELECT max(id) FROM public.defects), 1), true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'defect' AND policyname = 'defect_select_all'
  ) THEN
    CREATE POLICY defect_select_all ON public.defect FOR SELECT USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_sync_defects_to_defect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.defect (id, "Defect_name", created_at)
  VALUES (NEW.id, NEW."Defect_name", COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE SET "Defect_name" = EXCLUDED."Defect_name";
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_defects_to_defect'
      AND tgrelid = 'public.defects'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_defects_to_defect
    AFTER INSERT OR UPDATE ON public.defects
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_defects_to_defect();
  END IF;
END $$;

-- 3. PROCESO TAMPOGRAFÍA / PAD PRINTING
INSERT INTO public.procesos (codigo, nombre, tipo, std_setup_min, requiere_molde, requiere_checklist, descripcion, activo)
VALUES ('PROC-TAM', 'Tampografía / Pad Printing', 'TAMPOGRAFIA', 20, false, true, 'Impresión tampográfica (Pad Print), cliché, tinta y curado', true)
ON CONFLICT (codigo) DO NOTHING;
