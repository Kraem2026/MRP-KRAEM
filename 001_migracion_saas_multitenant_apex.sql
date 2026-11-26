-- ============================================================================
-- APEX SYSTEM - MIGRACIÓN MAESTRA SAAS MULTI-TENANT (SUPABASE POSTGRESQL)
-- Versión: 1.0.0
-- ============================================================================
-- Este script transforma la base de datos a un esquema Multi-Tenant con:
-- 1. Aislamiento total mediante Row Level Security (RLS) y función mi_empresa_id().
-- 2. Bloqueo automático por falta de pago o vencimiento de plan.
-- 3. Catálogos dinámicos industriales y campos personalizados (JSONB).
-- 4. Onboarding automatizado (inicializar_empresa) y Reseteo Sandbox seguro.
-- 5. Índices compuestos optimizados para alto rendimiento con millones de filas.
-- 6. Seguridad y aislamiento de Storage (erp-archivos/{empresa_id}/...).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLA MAESTRA: empresas (Tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_cliente SERIAL UNIQUE,
    nombre TEXT NOT NULL,
    rfc TEXT,
    estatus TEXT NOT NULL DEFAULT 'prueba' CHECK (estatus IN ('prueba', 'activo', 'suspendido')),
    fecha_vencimiento DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    plan_contratado TEXT NOT NULL DEFAULT 'standard' CHECK (plan_contratado IN ('basico', 'standard', 'enterprise')),
    limite_usuarios INTEGER NOT NULL DEFAULT 10,
    etiquetas JSONB NOT NULL DEFAULT '{
        "molde": "Molde",
        "maquina": "Máquina",
        "scrap": "Scrap",
        "pieza": "Pieza",
        "lote": "Lote",
        "linea": "Línea",
        "operador": "Operador",
        "parte": "Número de Parte"
    }'::jsonb,
    modulos_activos JSONB NOT NULL DEFAULT '{
        "wms": true,
        "produccion": true,
        "planeacion": true,
        "ingenieria": true,
        "calidad": true,
        "rh": true,
        "compras": true,
        "kpi": true
    }'::jsonb,
    configuracion_general JSONB DEFAULT '{}'::jsonb,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_el TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_estatus_vencimiento 
    ON public.empresas (estatus, fecha_vencimiento);

-- ============================================================================
-- 2. TABLA: perfiles_usuarios (Vínculo de Auth con Tenant y Roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.perfiles_usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'OPERADOR',
    es_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_el TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_usuarios_tenant_active 
    ON public.perfiles_usuarios (empresa_id, activo, rol);
CREATE INDEX IF NOT EXISTS idx_perfiles_usuarios_superadmin 
    ON public.perfiles_usuarios (id, es_super_admin) WHERE es_super_admin = TRUE;

-- ============================================================================
-- 3. FUNCIONES DE SESIÓN Y SEGURIDAD (SECURITY DEFINER)
-- ============================================================================

-- Obtiene el empresa_id del usuario autenticado validando estatus y pago
CREATE OR REPLACE FUNCTION public.mi_empresa_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_estatus TEXT;
    v_vencimiento DATE;
BEGIN
    SELECT p.empresa_id, e.estatus, e.fecha_vencimiento
    INTO v_empresa_id, v_estatus, v_vencimiento
    FROM perfiles_usuarios p
    JOIN empresas e ON e.id = p.empresa_id
    WHERE p.id = auth.uid() AND p.activo = TRUE;

    IF v_empresa_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Bloqueo automático por estatus o falta de pago
    IF v_estatus NOT IN ('activo', 'prueba') OR v_vencimiento < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cuenta empresarial suspendida o vencida por falta de pago. Contacte al soporte de APEX SYSTEM.';
    END IF;

    RETURN v_empresa_id;
END;
$$;

-- Determina si el usuario actual es Super Administrador de la plataforma
CREATE OR REPLACE FUNCTION public.es_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM perfiles_usuarios
        WHERE id = auth.uid() AND es_super_admin = TRUE AND activo = TRUE
    );
END;
$$;

-- ============================================================================
-- 4. CATÁLOGOS DINÁMICOS POR EMPRESA (Generalización Industrial)
-- ============================================================================

-- 4.1 Unidades de Medida
CREATE TABLE IF NOT EXISTS public.unidades_medida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    es_fraccionable BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    datos_extra JSONB DEFAULT '{}'::jsonb,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_unidades_medida_empresa UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_unidades_medida_empresa 
    ON public.unidades_medida (empresa_id, activo);

-- 4.2 Tipos de Movimiento de Inventario (+1 = Entrada, -1 = Salida, 0 = Reubicación)
CREATE TABLE IF NOT EXISTS public.tipos_movimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    factor INTEGER NOT NULL CHECK (factor IN (-1, 0, 1)),
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    datos_extra JSONB DEFAULT '{}'::jsonb,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tipos_movimiento_empresa UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_tipos_movimiento_empresa 
    ON public.tipos_movimiento (empresa_id, activo);

-- 4.3 Almacenes / Naves / Patios
CREATE TABLE IF NOT EXISTS public.almacenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'general',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    datos_extra JSONB DEFAULT '{}'::jsonb,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_almacenes_empresa UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_almacenes_empresa 
    ON public.almacenes (empresa_id, activo);

-- 4.4 Categorías Generales
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    modulo TEXT NOT NULL DEFAULT 'general',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    datos_extra JSONB DEFAULT '{}'::jsonb,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_categorias_empresa UNIQUE (empresa_id, modulo, codigo)
);
CREATE INDEX IF NOT EXISTS idx_categorias_empresa 
    ON public.categorias (empresa_id, modulo, activo);

-- 4.5 Campos Personalizados (Custom Fields dinámicos en frontend)
CREATE TABLE IF NOT EXISTS public.campos_personalizados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tabla_destino TEXT NOT NULL,
    nombre_campo TEXT NOT NULL,
    etiqueta TEXT NOT NULL,
    tipo_dato TEXT NOT NULL CHECK (tipo_dato IN ('texto', 'numero', 'fecha', 'booleano', 'lista')),
    opciones JSONB DEFAULT '[]'::jsonb,
    es_requerido BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campos_personalizados_empresa UNIQUE (empresa_id, tabla_destino, nombre_campo)
);
CREATE INDEX IF NOT EXISTS idx_campos_personalizados_empresa 
    ON public.campos_personalizados (empresa_id, tabla_destino, activo);

-- ============================================================================
-- 5. PROCEDIMIENTOS DE ONBOARDING Y MODO SANDBOX (RPC)
-- ============================================================================

-- 5.1 Precarga de datos semilla al crear una empresa cliente
CREATE OR REPLACE FUNCTION public.inicializar_empresa(p_empresa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Unidades de Medida Básicas
    INSERT INTO public.unidades_medida (empresa_id, codigo, nombre, es_fraccionable) VALUES
        (p_empresa_id, 'PZA', 'Pieza / Unidad', FALSE),
        (p_empresa_id, 'KG', 'Kilogramo', TRUE),
        (p_empresa_id, 'LT', 'Litro', TRUE),
        (p_empresa_id, 'M', 'Metro', TRUE),
        (p_empresa_id, 'LOTE', 'Lote Completo', FALSE)
    ON CONFLICT (empresa_id, codigo) DO NOTHING;

    -- Tipos de Movimiento Básicos
    INSERT INTO public.tipos_movimiento (empresa_id, codigo, nombre, factor, descripcion) VALUES
        (p_empresa_id, 'ENT_RECIBO', 'Entrada por Recepción / Compra', 1, 'Ingreso físico de material a almacén'),
        (p_empresa_id, 'ENT_PROD', 'Entrada por Producción Terminada', 1, 'Piezas buenas fabricadas en planta'),
        (p_empresa_id, 'SAL_EMBARQUE', 'Salida por Embarque / Venta', -1, 'Despacho a cliente final'),
        (p_empresa_id, 'SAL_CONSUMO', 'Salida por Consumo de Producción', -1, 'Consumo de materias primas e insertos'),
        (p_empresa_id, 'TRF_UBIC', 'Reubicación / Transferencia Interna', 0, 'Movimiento entre ubicaciones o carritos'),
        (p_empresa_id, 'AJU_POS', 'Ajuste de Inventario (+) Positivo', 1, 'Sobrante detectado en conteo físico'),
        (p_empresa_id, 'AJU_NEG', 'Ajuste de Inventario (-) Negativo', -1, 'Faltante o merma detectada en conteo'),
        (p_empresa_id, 'SCRAP', 'Baja por Scrap / Rechazo Calidad', -1, 'Material dañado no recuperable')
    ON CONFLICT (empresa_id, codigo) DO NOTHING;

    -- Almacenes Base
    INSERT INTO public.almacenes (empresa_id, codigo, nombre, tipo) VALUES
        (p_empresa_id, 'ALM_GRAL', 'Almacén General de Materia Prima', 'general'),
        (p_empresa_id, 'WIP_PISO', 'Área de Proceso / WIP Piso', 'wip'),
        (p_empresa_id, 'CUARENTENA', 'Área de Cuarentena e Inspección', 'cuarentena'),
        (p_empresa_id, 'EMBARQUE', 'Área de Producto Terminado / Embarque', 'producto_terminado')
    ON CONFLICT (empresa_id, codigo) DO NOTHING;

    -- Categorías Base
    INSERT INTO public.categorias (empresa_id, codigo, nombre, modulo) VALUES
        (p_empresa_id, 'MAT_PRIMA', 'Materia Prima / Resina', 'wms'),
        (p_empresa_id, 'PROD_TERM', 'Producto Terminado', 'wms'),
        (p_empresa_id, 'SUB_ENSAMBLE', 'Sub-ensamble / Semielaborado', 'wms'),
        (p_empresa_id, 'EMPAQUE', 'Empaque y Embalaje', 'wms'),
        (p_empresa_id, 'CONSUMIBLE', 'Insumos y Consumibles', 'wms')
    ON CONFLICT (empresa_id, modulo, codigo) DO NOTHING;
END;
$$;

-- 5.2 Reseteo Seguro de Operaciones (Modo Sandbox para un Tenant)
CREATE OR REPLACE FUNCTION public.resetear_operacion_empresa(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_es_admin BOOLEAN := FALSE;
BEGIN
    -- Validar que quien invoca sea Admin de esta empresa o Super Admin
    SELECT (p.rol IN ('ADMIN', 'SUPERADMIN', 'GERENCIA') OR p.es_super_admin = TRUE)
    INTO v_es_admin
    FROM perfiles_usuarios p
    WHERE p.id = auth.uid() AND (p.empresa_id = p_empresa_id OR p.es_super_admin = TRUE);

    IF NOT COALESCE(v_es_admin, FALSE) THEN
        RAISE EXCEPTION 'No tiene permisos suficientes para resetear la operación de esta empresa.';
    END IF;

    -- 1. Borrar movimientos y transacciones operativas
    DELETE FROM public.inventory_movements WHERE empresa_id = p_empresa_id;
    DELETE FROM public.cycle_count_results WHERE empresa_id = p_empresa_id;
    
    -- Tablas condicionales de producción (si existen en el schema)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'produccion_registros') THEN
        EXECUTE 'DELETE FROM public.produccion_registros WHERE empresa_id = $1' USING p_empresa_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'runs') THEN
        EXECUTE 'DELETE FROM public.runs WHERE empresa_id = $1' USING p_empresa_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_orders') THEN
        EXECUTE 'DELETE FROM public.production_orders WHERE empresa_id = $1' USING p_empresa_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requerimientos') THEN
        EXECUTE 'DELETE FROM public.requerimientos WHERE empresa_id = $1' USING p_empresa_id;
    END IF;

    -- 2. Reiniciar existencias de inventario a 0 (sin borrar las ubicaciones)
    UPDATE public.inventory_locations 
    SET quantity = 0, actual_qty = 0, status = 'LIBRE' 
    WHERE empresa_id = p_empresa_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'mensaje', 'Operaciones de prueba reiniciadas exitosamente. Los catálogos se mantienen intactos.',
        'empresa_id', p_empresa_id
    );
END;
$$;

-- ============================================================================
-- 6. ADAPTACIÓN DE TABLAS OPERATIVAS A MULTI-TENANT (ALTER & ÍNDICES)
-- ============================================================================

DO $$
DECLARE
    tbl RECORD;
    v_sql TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('empresas', 'schema_migrations')
    LOOP
        -- 1. Asegurar columna empresa_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl.table_name AND column_name = 'empresa_id'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;', tbl.table_name);
        END IF;

        -- 2. Asegurar columna datos_extra JSONB
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl.table_name AND column_name = 'datos_extra'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN datos_extra JSONB DEFAULT ''{}''::jsonb;', tbl.table_name);
        END IF;

        -- 3. Habilitar Row Level Security (RLS)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.table_name);

        -- 4. Crear políticas RLS estándar por empresa
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_all" ON public.%I;', tbl.table_name);
        EXECUTE format('
            CREATE POLICY "tenant_isolation_all" ON public.%I
            FOR ALL
            USING (empresa_id = public.mi_empresa_id() OR public.es_super_admin())
            WITH CHECK (empresa_id = public.mi_empresa_id() OR public.es_super_admin());
        ', tbl.table_name);

    END LOOP;
END $$;

-- Índices Compuestos Estratégicos de Alto Rendimiento (empresa_id primero)
CREATE INDEX IF NOT EXISTS idx_inv_movements_compuesto 
    ON public.inventory_movements (empresa_id, created_at DESC, part_number);

CREATE INDEX IF NOT EXISTS idx_inv_locations_compuesto 
    ON public.inventory_locations (empresa_id, location_name, part_number);

CREATE INDEX IF NOT EXISTS idx_parts_compuesto 
    ON public.parts (empresa_id, part_number, is_active);

CREATE INDEX IF NOT EXISTS idx_rh_empleados_compuesto 
    ON public.rh_empleados (empresa_id, numero_reloj, activo);

CREATE INDEX IF NOT EXISTS idx_rh_asistencia_compuesto 
    ON public.rh_asistencia_diaria (empresa_id, fecha DESC, empleado_id);

CREATE INDEX IF NOT EXISTS idx_production_orders_compuesto 
    ON public.production_orders (empresa_id, status, scheduled_date);

-- ============================================================================
-- 7. POLÍTICAS DE RLS PARA TABLAS MAESTRAS (empresas y perfiles_usuarios)
-- ============================================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresas_superadmin_all" ON public.empresas;
CREATE POLICY "empresas_superadmin_all" ON public.empresas
    FOR ALL
    USING (public.es_super_admin())
    WITH CHECK (public.es_super_admin());

DROP POLICY IF EXISTS "empresas_self_select" ON public.empresas;
CREATE POLICY "empresas_self_select" ON public.empresas
    FOR SELECT
    USING (id = public.mi_empresa_id());

ALTER TABLE public.perfiles_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfiles_superadmin_all" ON public.perfiles_usuarios;
CREATE POLICY "perfiles_superadmin_all" ON public.perfiles_usuarios
    FOR ALL
    USING (public.es_super_admin())
    WITH CHECK (public.es_super_admin());

DROP POLICY IF EXISTS "perfiles_tenant_all" ON public.perfiles_usuarios;
CREATE POLICY "perfiles_tenant_all" ON public.perfiles_usuarios
    FOR ALL
    USING (empresa_id = public.mi_empresa_id())
    WITH CHECK (empresa_id = public.mi_empresa_id());

-- ============================================================================
-- 8. POLÍTICAS DE STORAGE AISLADO (Bucket: erp-archivos/{empresa_id}/...)
-- ============================================================================
-- El bucket 'erp-archivos' aísla carpetas por empresa_id:
-- Ejemplo de ruta: erp-archivos/8f3b2a1c-.../empleados/foto.jpg

INSERT INTO storage.buckets (id, name, public)
VALUES ('erp-archivos', 'erp-archivos', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_tenant_isolation_select" ON storage.objects;
CREATE POLICY "storage_tenant_isolation_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'erp-archivos' 
        AND (
            (storage.foldername(name))[1] = public.mi_empresa_id()::text 
            OR public.es_super_admin()
        )
    );

DROP POLICY IF EXISTS "storage_tenant_isolation_insert" ON storage.objects;
CREATE POLICY "storage_tenant_isolation_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'erp-archivos' 
        AND (
            (storage.foldername(name))[1] = public.mi_empresa_id()::text 
            OR public.es_super_admin()
        )
    );

DROP POLICY IF EXISTS "storage_tenant_isolation_update" ON storage.objects;
CREATE POLICY "storage_tenant_isolation_update" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'erp-archivos' 
        AND (
            (storage.foldername(name))[1] = public.mi_empresa_id()::text 
            OR public.es_super_admin()
        )
    );

DROP POLICY IF EXISTS "storage_tenant_isolation_delete" ON storage.objects;
CREATE POLICY "storage_tenant_isolation_delete" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'erp-archivos' 
        AND (
            (storage.foldername(name))[1] = public.mi_empresa_id()::text 
            OR public.es_super_admin()
        )
    );
