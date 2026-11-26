-- ============================================================================
-- KRAEM MRP - Configuración Centralizada del Sistema, Perfiles y Gestión Admin
-- Ejecutar este script una vez en Supabase -> SQL Editor
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabla de Parámetros Globales del Sistema (Editables desde configuracion_sistema.html)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'general',
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_read_auth" ON public.system_settings;
CREATE POLICY "system_settings_read_auth"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "system_settings_write_auth" ON public.system_settings;
CREATE POLICY "system_settings_write_auth"
ON public.system_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Tabla de Perfiles y Permisos por Usuario (Sincronizada con KraemAuth en config.js)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT,
    area_nombre TEXT,
    empleado_id UUID DEFAULT NULL,
    role TEXT NOT NULL DEFAULT 'OPERADOR',
    permissions JSONB DEFAULT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS area_nombre TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS empleado_id UUID DEFAULT NULL;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_read_auth" ON public.user_profiles;
CREATE POLICY "user_profiles_read_auth"
ON public.user_profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "user_profiles_write_auth" ON public.user_profiles;
CREATE POLICY "user_profiles_write_auth"
ON public.user_profiles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Bóveda de Credenciales SOLO visible/editable por ADMIN estricto (ni GERENCIA ni otros roles)
CREATE TABLE IF NOT EXISTS public.admin_user_credentials (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    password_display TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_user_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_creds_strict_admin" ON public.admin_user_credentials;
CREATE POLICY "admin_creds_strict_admin"
ON public.admin_user_credentials FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = auth.uid() AND upper(up.role) = 'ADMIN'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = auth.uid() AND upper(up.role) = 'ADMIN'
    )
);

-- Trigger automático para nuevos usuarios creados directamente en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_kraem_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, full_name, username, area_nombre, role, active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'area_nombre',
        COALESCE(NEW.raw_user_meta_data->>'role', 'ADMIN'),
        true
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_kraem ON auth.users;
CREATE TRIGGER on_auth_user_created_kraem
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_kraem_user();

-- Seed inicial para usuarios ya existentes en auth.users
INSERT INTO public.user_profiles (user_id, email, full_name, username, role, active)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), split_part(email, '@', 1), 'ADMIN', true
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 4. RPC: Crear nuevo usuario en auth.users + perfil + bóveda (SOLO ADMIN)
DROP FUNCTION IF EXISTS public.admin_create_kraem_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_create_kraem_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_username TEXT,
    p_area_nombre TEXT,
    p_role TEXT,
    p_empleado_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_uid UUID := gen_random_uuid();
    v_email TEXT := lower(trim(p_email));
    v_caller_email TEXT;
    v_full_name TEXT := p_full_name;
    v_area_nombre TEXT := p_area_nombre;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid() AND upper(role) = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: únicamente ADMIN puede crear usuarios.';
    END IF;

    IF v_email = '' OR length(coalesce(p_password, '')) < 6 THEN
        RAISE EXCEPTION 'Email válido y contraseña de al menos 6 caracteres son obligatorios.';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
        RAISE EXCEPTION 'Ya existe un usuario registrado con el correo %', v_email;
    END IF;

    IF p_empleado_id IS NOT NULL AND to_regclass('public.rh_empleados') IS NOT NULL THEN
        SELECT e.nombre_completo, ag.nombre
        INTO v_full_name, v_area_nombre
        FROM public.rh_empleados e
        LEFT JOIN public.areas_generales ag ON ag.id = e.area_general_id
        WHERE e.id = p_empleado_id;

        v_full_name := COALESCE(NULLIF(v_full_name, ''), p_full_name);
        v_area_nombre := COALESCE(NULLIF(v_area_nombre, ''), p_area_nombre);
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_uid,
        'authenticated',
        'authenticated',
        v_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_full_name, 'username', p_username, 'area_nombre', v_area_nombre, 'role', upper(p_role), 'empleado_id', p_empleado_id),
        now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email',
        v_uid::text,
        now(), now(), now()
    );

    INSERT INTO public.user_profiles (user_id, email, full_name, username, area_nombre, empleado_id, role, active)
    VALUES (v_uid, v_email, v_full_name, p_username, v_area_nombre, p_empleado_id, upper(p_role), true)
    ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        area_nombre = EXCLUDED.area_nombre,
        empleado_id = EXCLUDED.empleado_id,
        role = EXCLUDED.role,
        updated_at = now();

    INSERT INTO public.admin_user_credentials (user_id, password_display, updated_by, updated_at)
    VALUES (v_uid, p_password, v_caller_email, now())
    ON CONFLICT (user_id) DO UPDATE SET
        password_display = EXCLUDED.password_display,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

    RETURN v_uid;
END;
$$;

-- 5. RPC: Cambiar contraseña de cualquier usuario (SOLO ADMIN)
CREATE OR REPLACE FUNCTION public.admin_reset_kraem_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_caller_email TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid() AND upper(role) = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: únicamente ADMIN puede cambiar contraseñas.';
    END IF;

    IF length(coalesce(p_new_password, '')) < 6 THEN
        RAISE EXCEPTION 'La nueva contraseña debe tener al menos 6 caracteres.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado en auth.users.';
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

    INSERT INTO public.admin_user_credentials (user_id, password_display, updated_by, updated_at)
    VALUES (p_user_id, p_new_password, v_caller_email, now())
    ON CONFLICT (user_id) DO UPDATE SET
        password_display = EXCLUDED.password_display,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

    RETURN true;
END;
$$;

-- 6. RPC: Eliminar cuenta de usuario por completo (SOLO ADMIN)
CREATE OR REPLACE FUNCTION public.admin_delete_kraem_user(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = auth.uid() AND upper(role) = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: únicamente ADMIN puede eliminar cuentas.';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'No puedes eliminar tu propia cuenta activa.';
    END IF;

    DELETE FROM public.admin_user_credentials WHERE user_id = p_user_id;
    DELETE FROM public.user_profiles WHERE user_id = p_user_id;
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado en auth.users.';
    END IF;

    RETURN true;
END;
$$;

-- 7. Trigger automático: si cambia nombre o área en rh_empleados, sincroniza user_profiles
CREATE OR REPLACE FUNCTION public.sync_user_profile_from_empleado()
RETURNS TRIGGER AS $$
DECLARE
    v_area_nombre TEXT;
BEGIN
    SELECT nombre INTO v_area_nombre FROM public.areas_generales WHERE id = NEW.area_general_id;
    UPDATE public.user_profiles
    SET full_name = NEW.nombre_completo,
        area_nombre = COALESCE(v_area_nombre, area_nombre),
        updated_at = now()
    WHERE empleado_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    IF to_regclass('public.rh_empleados') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS trg_sync_user_from_empleado ON public.rh_empleados;
        CREATE TRIGGER trg_sync_user_from_empleado
        AFTER INSERT OR UPDATE OF nombre_completo, area_general_id ON public.rh_empleados
        FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile_from_empleado();
    END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_create_kraem_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_kraem_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_kraem_user(UUID) TO authenticated;
