-- ==============================================================================
-- KRAEM MRP: INGENIERÍA FASE 2 — Completar Ingeniería estilo SAP (MM/PP/CA/C223/QM)
--   * Extensión a `parts`          (Parámetros MRP, Ingeniería ECN y Ubicación WMS)
--   * Extensión a `bom_structures` (% Scrap, Vigencia y Estatus)
--   * Extensión a `mes_machines`   (Capacidad técnica SAP CR01: barras, inyección, turnos/hrs)
--   * `clientes`                   (Catálogo Comercial / Plantas / Días tránsito)
--   * `procesos` & `part_routings` (Hojas de Ruta SAP CA01)
--   * `checklists` & `checklist_items` (Checklists SMED Montaje de Moldes / Calidad)
--   * `v_production_versions`      (Versiones de Fabricación SAP C223)
--   * `explorar_bom_multinivel()`  (Explosión BOM recursiva con scrap para MRP y WMS)
--
-- 100% NO DESTRUCTIVO: solo agrega tablas, columnas, vistas y funciones.
-- Ejecutar en Supabase → SQL Editor (después de ingenieria_fase1_moldes.sql)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN MAESTRO DE MATERIALES (`parts` — SAP MM01/MM02/MRP)
-- ------------------------------------------------------------------------------
alter table parts
    add column if not exists customer_part_number text,
    add column if not exists drawing_revision     text default 'REV-01',
    add column if not exists engineering_status   text default 'ACTIVO',
    add column if not exists safety_stock         numeric(12,2) default 0,
    add column if not exists min_lot_size         numeric(12,2) default 0,
    add column if not exists lot_rounding         numeric(12,2) default 1,
    add column if not exists lead_time_days       integer default 0,
    add column if not exists scrap_pct            numeric(6,2) default 0,
    add column if not exists regrind_pct          numeric(6,2) default 0,
    add column if not exists default_location_id  bigint;

create index if not exists idx_parts_eng_status on parts(engineering_status);
create index if not exists idx_parts_type       on parts(product_type);

-- ------------------------------------------------------------------------------
-- 2. EXTENSIÓN LISTA DE MATERIALES (`bom_structures` — SAP CS01/CS02)
-- ------------------------------------------------------------------------------
alter table bom_structures
    add column if not exists scrap_pct  numeric(6,2) default 0,
    add column if not exists valid_from date,
    add column if not exists valid_to   date,
    add column if not exists is_active  boolean default true,
    add column if not exists notes      text;

-- ------------------------------------------------------------------------------
-- 3. EXTENSIÓN CENTROS DE TRABAJO (`mes_machines` — SAP CR01/CR02)
-- ------------------------------------------------------------------------------
alter table mes_machines
    add column if not exists tie_bar_h_mm       numeric(8,2),
    add column if not exists tie_bar_v_mm       numeric(8,2),
    add column if not exists max_mold_weight_kg numeric(10,2),
    add column if not exists shot_capacity_gr   numeric(10,2),
    add column if not exists shifts_per_day     integer default 3,
    add column if not exists hours_per_day      numeric(5,2) default 22.5,
    add column if not exists oee_target_pct     numeric(5,2) default 85;

-- ------------------------------------------------------------------------------
-- 4. CATÁLOGO DE CLIENTES (`clientes` — Comercial / Forecast / Embarques)
-- ------------------------------------------------------------------------------
create table if not exists clientes (
    id bigserial primary key,
    codigo        text unique not null,
    nombre        text not null,
    planta        text,
    contacto      text,
    telefono      text,
    email         text,
    dias_transito integer default 1,
    observaciones text,
    activo        boolean default true,
    created_at    timestamptz default now(),
    updated_at    timestamptz default now()
);

create index if not exists idx_clientes_codigo on clientes(codigo);

-- ------------------------------------------------------------------------------
-- 5. CATÁLOGO DE PROCESOS Y HOJAS DE RUTA (`procesos`, `part_routings` — SAP CA01)
-- ------------------------------------------------------------------------------
create table if not exists procesos (
    id bigserial primary key,
    codigo              text unique not null,
    nombre              text not null,
    tipo                text default 'PRODUCCION', -- INYECCION, ENSAMBLE, SOLDADURA, INSPECCION, EMPAQUE
    area_id             bigint,
    std_setup_min       numeric(8,2) default 0,
    requiere_molde      boolean default false,
    requiere_checklist  boolean default false,
    descripcion         text,
    activo              boolean default true,
    created_at          timestamptz default now()
);

insert into procesos (codigo, nombre, tipo, std_setup_min, requiere_molde, requiere_checklist, descripcion)
values
    ('PROC-INY', 'Inyección de Plástico',      'INYECCION',  45, true,  true,  'Moldeo por inyección en prensa'),
    ('PROC-DES', 'Desbaste / Acabado Manual',  'ACABADO',     0, false, false, 'Corte de colada, rebabeo y acabado en estación'),
    ('PROC-SOL', 'Soldadura / Termofusión',    'SOLDADURA',  15, false, true,  'Soldadura ultrasónica, vibración o placa caliente'),
    ('PROC-ENS', 'Ensamble de Componentes',    'ENSAMBLE',   10, false, true,  'Inserción de clips, pads, fasteners y sub-ensambles'),
    ('PROC-INS', 'Inspección Final / Calidad', 'INSPECCION',  0, false, true,  'Validación dimensional, visual y liberación'),
    ('PROC-EMP', 'Empaque y Etiquetado WMS',   'EMPAQUE',     0, false, false, 'Empaque en carro/tote conforme a Standard Pack')
on conflict (codigo) do nothing;

-- ------------------------------------------------------------------------------
-- 6. CHECKLISTS MAESTROS (`checklists`, `checklist_items` — Setup SMED / Calidad)
-- ------------------------------------------------------------------------------
create table if not exists checklists (
    id bigserial primary key,
    codigo       text unique not null,
    nombre       text not null,
    tipo         text not null default 'MONTAJE_MOLDE', -- MONTAJE_MOLDE, ARRANQUE_PRIMERA_PIEZA, CAMBIO_MATERIAL, AUDITORIA
    descripcion  text,
    activo       boolean default true,
    created_at   timestamptz default now(),
    updated_at   timestamptz default now()
);

create table if not exists checklist_items (
    id bigserial primary key,
    checklist_id bigint not null references checklists(id) on delete cascade,
    orden        integer not null default 1,
    punto_verificacion text not null,
    criterio_especificacion text,
    tipo_respuesta text default 'OK_NOK', -- OK_NOK, NUMERICO, TEXTO
    obligatorio  boolean default true,
    created_at   timestamptz default now()
);

create index if not exists idx_checklist_items_chk on checklist_items(checklist_id);

-- Crear `part_routings` respetando el tipo de id de `molds` y `mes_machines`
do $$
declare
    v_mold_type text;
    v_mach_type text;
begin
    select coalesce((select case when data_type = 'uuid' then 'uuid' else 'bigint' end
                     from information_schema.columns
                     where table_schema = 'public' and table_name = 'molds' and column_name = 'id'), 'bigint')
      into v_mold_type;

    select coalesce((select case when data_type = 'uuid' then 'uuid' else 'bigint' end
                     from information_schema.columns
                     where table_schema = 'public' and table_name = 'mes_machines' and column_name = 'id'), 'bigint')
      into v_mach_type;

    execute format($f$
        create table if not exists part_routings (
            id bigserial primary key,
            part_id        bigint not null references parts(id) on delete cascade,
            seq_num        integer not null default 10,
            proceso_id     bigint not null references procesos(id),
            area_id        bigint,
            mold_id        %s references molds(id) on delete set null,
            machine_id     %s references mes_machines(id) on delete set null,
            checklist_id   bigint references checklists(id) on delete set null,
            std_time_sec   numeric(10,2) default 0,
            setup_time_min numeric(8,2) default 0,
            operators_req  integer default 1,
            notas          text,
            is_active      boolean default true,
            created_at     timestamptz default now(),
            unique (part_id, seq_num)
        )$f$, v_mold_type, v_mach_type);
end $$;

create index if not exists idx_part_routings_part on part_routings(part_id);

-- Checklist base sugerido para Montaje de Moldes SMED
insert into checklists (codigo, nombre, tipo, descripcion)
values ('CHK-SMED-01', 'Checklist Estándar de Montaje de Molde (SMED)', 'MONTAJE_MOLDE', 'Verificación de seguridad, fijación, conexiones y arranque')
on conflict (codigo) do nothing;

insert into checklist_items (checklist_id, orden, punto_verificacion, criterio_especificacion, tipo_respuesta, obligatorio)
select c.id, v.orden, v.punto, v.criterio, v.tipo, true
from checklists c
cross join (values
    (1, 'Limpieza de platinas y centrado de aro', 'Sin rebabas ni grasa en caras de montaje', 'OK_NOK'),
    (2, 'Fijación de bridas / tornillería', 'Torque especificado completo en plato fijo y móvil', 'OK_NOK'),
    (3, 'Conexión de circuitos de enfriamiento / aceite', 'Sin fugas bajo presión nominal', 'OK_NOK'),
    (4, 'Verificación de botadores y seguridad de molde', 'Carrera libre sin interferencia', 'OK_NOK'),
    (5, 'Purga y temperatura de barril / colada caliente', 'Conforme a hoja de parámetros de resina', 'NUMERICO'),
    (6, 'Liberación de primera pieza (Calidad)', 'Peso y dimensional dentro de tolerancia', 'OK_NOK')
) as v(orden, punto, criterio, tipo)
where c.codigo = 'CHK-SMED-01'
  and not exists (select 1 from checklist_items ci where ci.checklist_id = c.id);

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS (usuarios autenticados)
-- ------------------------------------------------------------------------------
alter table clientes        enable row level security;
alter table procesos        enable row level security;
alter table part_routings   enable row level security;
alter table checklists      enable row level security;
alter table checklist_items enable row level security;

do $$
declare t text;
begin
    foreach t in array array['clientes','procesos','part_routings','checklists','checklist_items'] loop
        if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_auth_all') then
            execute format('create policy %I on %I for all to authenticated using (true) with check (true)',
                           t || '_auth_all', t);
        end if;
    end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 8. VISTA DE VERSIONES DE FABRICACIÓN (SAP C223)
--    Une Parte + Molde + Máquina + Empaque Primario + Ubicación Default WMS
-- ------------------------------------------------------------------------------
create or replace view v_production_versions as
select
    p.id                    as part_id,
    p.part_number,
    p.part_name,
    p.product_type,
    p.engineering_status,
    p.safety_stock,
    p.min_lot_size,
    p.lot_rounding,
    p.lead_time_days,
    p.scrap_pct             as part_scrap_pct,
    p.regrind_pct,
    p.default_location_id,
    loc.location_code       as default_location_code,
    pm.mold_id,
    m.mold_code,
    m.mold_name,
    m.current_status        as mold_status,
    m.setup_time_min        as mold_setup_min,
    m.purge_weight_kg,
    pm.cavities_for_part,
    mm.machine_id,
    mach.machine_code,
    mach.machine_name,
    mach.tonnage            as machine_tonnage,
    mach.hours_per_day      as machine_hours_per_day,
    coalesce(mm.cycle_time_sec, pm.cycle_time_sec, p.cycle_time_seg) as cycle_time_sec,
    case when coalesce(mm.cycle_time_sec, pm.cycle_time_sec, p.cycle_time_seg) > 0
         then round(3600.0 / coalesce(mm.cycle_time_sec, pm.cycle_time_sec, p.cycle_time_seg) * coalesce(pm.cavities_for_part, p.cavities, 1), 1)
    end                     as pcs_per_hour,
    ep.empaque_id,
    emp.codigo              as empaque_codigo,
    ep.standard_pack        as official_std_pack,
    pm.is_primary           as mold_is_primary,
    mm.is_primary           as machine_is_primary
from parts p
left join locations loc       on loc.id = p.default_location_id
left join part_molds pm       on pm.part_id = p.id and pm.active
left join molds m             on m.id = pm.mold_id and coalesce(m.active, true)
left join mold_machines mm    on mm.mold_id = m.id and mm.active
left join mes_machines mach   on mach.id = mm.machine_id and coalesce(mach.active, true)
left join lateral (
    select ep1.empaque_id, ep1.standard_pack
    from empaques_partes ep1
    where ep1.part_number = p.part_number
    order by ep1.es_empaque_primario desc, ep1.created_at asc
    limit 1
) ep on true
left join empaques emp on emp.id = ep.empaque_id
where coalesce(p.obsolete, false) = false;

-- ------------------------------------------------------------------------------
-- 9. FUNCIÓN RPC: EXPLOSIÓN BOM MULTINIVEL PARA MRP Y SURTIDO WMS
--    Calcula requerimientos netos incluyendo % de scrap del componente
-- ------------------------------------------------------------------------------
create or replace function explorar_bom_multinivel(
    p_part_id bigint,
    p_qty     numeric default 1
)
returns table (
    nivel             integer,
    parent_id         bigint,
    child_id          bigint,
    part_number       text,
    part_name         text,
    product_type      text,
    unit              text,
    usage_per_parent  numeric,
    effective_usage   numeric,
    scrap_pct         numeric,
    required_qty      numeric
)
language sql
stable
as $$
with recursive bom_tree as (
    select
        1 as nivel,
        b.parent_id,
        b.child_id,
        coalesce(nullif(b.usage_qty, 0), b.quantity, 1)::numeric as usage_per_parent,
        (coalesce(nullif(b.usage_qty, 0), b.quantity, 1) * (1 + coalesce(b.scrap_pct, 0) / 100.0))::numeric as effective_usage,
        coalesce(b.scrap_pct, 0)::numeric as scrap_pct,
        b.unit,
        array[b.parent_id, b.child_id] as path
    from bom_structures b
    where b.parent_id = p_part_id
      and coalesce(b.is_active, true) = true
      and (b.valid_from is null or b.valid_from <= current_date)
      and (b.valid_to   is null or b.valid_to   >= current_date)

    union all

    select
        bt.nivel + 1,
        b.parent_id,
        b.child_id,
        coalesce(nullif(b.usage_qty, 0), b.quantity, 1)::numeric,
        (bt.effective_usage * coalesce(nullif(b.usage_qty, 0), b.quantity, 1) * (1 + coalesce(b.scrap_pct, 0) / 100.0))::numeric,
        coalesce(b.scrap_pct, 0)::numeric,
        b.unit,
        bt.path || b.child_id
    from bom_structures b
    join bom_tree bt on b.parent_id = bt.child_id
    where bt.nivel < 5
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
    coalesce(bt.unit, c.unit_of_measure, 'PZA') as unit,
    bt.usage_per_parent,
    round(bt.effective_usage, 6) as effective_usage,
    bt.scrap_pct,
    case
        when upper(coalesce(c.product_type, '')) = 'RESINA' or upper(coalesce(bt.unit, '')) = 'KG'
             then round(((coalesce(c.part_weight_gr, 0) + coalesce(c.runner_weight_gr, 0)) / 1000.0) * p_qty * bt.effective_usage, 4)
        else round(p_qty * bt.effective_usage, 4)
    end as required_qty
from bom_tree bt
join parts c on c.id = bt.child_id
order by bt.nivel, c.part_number;
$$;
