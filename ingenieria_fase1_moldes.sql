-- ==============================================================================
-- KRAEM MRP: INGENIERÍA FASE 1 — Maestro de Moldes (SAP PRT) y Matrices
--   * molds          : Maestro de moldes / herramentales
--   * part_molds     : Matriz Molde ↔ Número de Parte (moldes familiares LH/RH)
--   * mold_machines  : Matriz Molde ↔ Máquina compatible (principal / alternas)
--
-- 100% NO DESTRUCTIVO: solo crea tablas/columnas que no existan.
-- Respeta las columnas que ya usan Planeación (mold_name, cavities,
-- compatible_machine) y Producción (name).
-- Ejecutar en Supabase → SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. DIAGNÓSTICO (solo lectura). Ejecuta esto primero y guarda el resultado:
--    sirve para decidir la unificación machines vs mes_machines y
--    defects vs catalogo_defectos (Fase 1-B).
-- ------------------------------------------------------------------------------
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('machines','mes_machines','machine_capacity','molds','part_molds',
--                      'defects','catalogo_defectos','production_plan','production_orders','runs')
-- order by table_name, ordinal_position;

-- ------------------------------------------------------------------------------
-- 1. MAESTRO DE MOLDES
-- ------------------------------------------------------------------------------
create table if not exists molds (
    id bigserial primary key,
    created_at timestamptz default now()
);

alter table molds
    add column if not exists mold_code          text,
    add column if not exists mold_name          text,
    add column if not exists name               text,           -- compatibilidad produccion_captura.html
    add column if not exists cliente            text,
    add column if not exists project            text,
    add column if not exists cavities           integer default 1,  -- cavidades totales (usado por Planeación)
    add column if not exists cavities_active    integer,            -- cavidades habilitadas (si hay canceladas)
    add column if not exists tonnage_min        numeric(8,2),
    add column if not exists tonnage_max        numeric(8,2),
    add column if not exists largo_mm           numeric(10,2),
    add column if not exists ancho_mm           numeric(10,2),
    add column if not exists alto_mm            numeric(10,2),
    add column if not exists peso_kg            numeric(10,2),
    add column if not exists runner_type        text default 'FRIA',  -- FRIA / CALIENTE / MIXTA
    add column if not exists setup_time_min     numeric(8,2) default 0, -- montaje + desmontaje (SMED)
    add column if not exists purge_weight_kg    numeric(10,3) default 0,
    add column if not exists shots_current      bigint default 0,
    add column if not exists shots_pm_limit     bigint default 0,       -- golpes para mantenimiento preventivo
    add column if not exists current_status     text default 'EN_ALMACEN',
    add column if not exists current_machine_id bigint,                 -- mes_machines.id donde está montado
    add column if not exists compatible_machine bigint,                 -- legado Planeación (apunta a `machines`, NO a mes_machines)
    add column if not exists observaciones      text,
    add column if not exists active             boolean default true,
    add column if not exists updated_at         timestamptz default now();

create index if not exists idx_molds_code   on molds(mold_code);
create index if not exists idx_molds_status on molds(current_status);

-- Mantener sincronizados name <-> mold_name (Producción usa name, Planeación usa mold_name)
create or replace function trg_molds_sync_names()
returns trigger language plpgsql as $$
begin
    new.mold_name := coalesce(nullif(new.mold_name,''), new.name);
    new.name      := coalesce(nullif(new.name,''), new.mold_name);
    if tg_op = 'UPDATE' and new.mold_name is distinct from old.mold_name then
        new.name := new.mold_name;
    end if;
    if new.cavities_active is null then
        new.cavities_active := new.cavities;
    end if;
    new.updated_at := now();
    return new;
end $$;

drop trigger if exists molds_sync_names on molds;
create trigger molds_sync_names
before insert or update on molds
for each row execute function trg_molds_sync_names();

-- Rellenar datos legados
update molds set mold_name = name where mold_name is null and name is not null;
update molds set name = mold_name where name is null and mold_name is not null;

-- ------------------------------------------------------------------------------
-- 2. MATRIZ MOLDE ↔ PARTE  y  3. MATRIZ MOLDE ↔ MÁQUINA
--    (se detecta el tipo de id de molds / mes_machines para no romper FKs)
-- ------------------------------------------------------------------------------
do $$
declare
    v_mold_type text;
    v_mach_type text;
begin
    select case when data_type = 'uuid' then 'uuid' else 'bigint' end
      into v_mold_type
      from information_schema.columns
     where table_schema = 'public' and table_name = 'molds' and column_name = 'id';

    select case when data_type = 'uuid' then 'uuid' else 'bigint' end
      into v_mach_type
      from information_schema.columns
     where table_schema = 'public' and table_name = 'mes_machines' and column_name = 'id';

    -- 2. part_molds
    execute format($f$
        create table if not exists part_molds (
            id bigserial primary key,
            mold_id %s not null references molds(id) on delete cascade,
            part_id bigint not null references parts(id) on delete cascade,
            created_at timestamptz default now(),
            unique (mold_id, part_id)
        )$f$, v_mold_type);

    -- 3. mold_machines
    if v_mach_type is not null then
        execute format($f$
            create table if not exists mold_machines (
                id bigserial primary key,
                mold_id %s not null references molds(id) on delete cascade,
                machine_id %s not null references mes_machines(id) on delete cascade,
                created_at timestamptz default now(),
                unique (mold_id, machine_id)
            )$f$, v_mold_type, v_mach_type);
    end if;
end $$;

alter table part_molds
    add column if not exists cavities_for_part integer default 1,   -- cavidades de ESTA parte en el molde
    add column if not exists cycle_time_sec    numeric(8,2),         -- ciclo de referencia
    add column if not exists part_weight_gr    numeric(10,3),        -- SIEMPRE en gramos
    add column if not exists runner_weight_gr  numeric(10,3),        -- colada proporcional, en gramos
    add column if not exists side              text default 'NA',    -- LH / RH / NA
    add column if not exists is_primary        boolean default true, -- molde principal para esta parte
    add column if not exists active            boolean default true;

create index if not exists idx_part_molds_part on part_molds(part_id);
create index if not exists idx_part_molds_mold on part_molds(mold_id);

alter table mold_machines
    add column if not exists cycle_time_sec numeric(8,2),          -- ciclo real en ESTA máquina
    add column if not exists is_primary     boolean default false,
    add column if not exists active         boolean default true;

create index if not exists idx_mold_machines_mold on mold_machines(mold_id);
create index if not exists idx_mold_machines_mach on mold_machines(machine_id);

-- ------------------------------------------------------------------------------
-- 4. RLS: solo usuarios autenticados (mismo login del sistema)
-- ------------------------------------------------------------------------------
alter table part_molds    enable row level security;
alter table mold_machines enable row level security;

do $$
declare t text;
begin
    foreach t in array array['part_molds','mold_machines'] loop
        if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_auth_all') then
            execute format('create policy %I on %I for all to authenticated using (true) with check (true)',
                           t || '_auth_all', t);
        end if;
    end loop;

    -- molds: si tiene RLS activo y ninguna política, agregar la de autenticados
    if exists (select 1 from pg_class where relname = 'molds' and relrowsecurity)
       and not exists (select 1 from pg_policies where tablename = 'molds') then
        create policy molds_auth_all on molds for all to authenticated using (true) with check (true);
    end if;
end $$;

-- ------------------------------------------------------------------------------
-- 5. VISTA DE APOYO PARA PLANEACIÓN / MONTAJE DE MOLDES
--    Piezas por hora reales por combinación Parte + Molde (+ máquina si existe)
-- ------------------------------------------------------------------------------
create or replace view v_part_mold_capacity as
select
    pm.part_id,
    p.part_number,
    p.part_name,
    m.id                as mold_id,
    m.mold_code,
    m.mold_name,
    m.current_status    as mold_status,
    m.setup_time_min,
    pm.cavities_for_part,
    mm.machine_id,
    coalesce(mm.cycle_time_sec, pm.cycle_time_sec) as cycle_time_sec,
    case when coalesce(mm.cycle_time_sec, pm.cycle_time_sec) > 0
         then round(3600.0 / coalesce(mm.cycle_time_sec, pm.cycle_time_sec) * pm.cavities_for_part, 1)
    end                 as pcs_per_hour,
    pm.part_weight_gr,
    pm.runner_weight_gr,
    pm.is_primary       as mold_is_primary,
    mm.is_primary       as machine_is_primary
from part_molds pm
join molds m  on m.id = pm.mold_id
join parts p  on p.id = pm.part_id
left join mold_machines mm on mm.mold_id = m.id and mm.active
where pm.active and coalesce(m.active, true);
