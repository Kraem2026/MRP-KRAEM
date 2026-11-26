-- ==============================================================================
-- KRAEM MRP: Catálogo Maestro de Empaques, Contenedores y Cajas
-- Ejecutar en Supabase → SQL Editor
-- ==============================================================================

-- 1. Tabla Maestra de Modelos de Empaque / Contenedores (Ficha Técnica)
create table if not exists empaques (
    id uuid primary key default gen_random_uuid(),
    codigo text unique not null,
    nombre text not null,
    tipo_empaque text not null check (tipo_empaque in ('CARRO_INTERNO', 'RETORNABLE_CLIENTE', 'CAJA_INTERNA', 'DESECHABLE_CARTON')),
    cliente_propietario text default 'KRAEM',
    largo_cm numeric(8,2) default 0,
    ancho_cm numeric(8,2) default 0,
    alto_cm numeric(8,2) default 0,
    peso_tara_kg numeric(8,2) default 0,
    permite_parciales boolean default true,
    activo boolean default true,
    observaciones text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Matriz de Empaque y Números de Parte (Standard Pack Oficial y Alternativo)
create table if not exists empaques_partes (
    id uuid primary key default gen_random_uuid(),
    empaque_id uuid not null references empaques(id) on delete cascade,
    part_id bigint references parts(id) on delete cascade,
    part_number text not null,
    part_name text,
    standard_pack integer not null check (standard_pack > 0),
    es_empaque_primario boolean default true,
    created_at timestamptz default now(),
    unique(empaque_id, part_number)
);

-- 3. Vincular las Ubicaciones Físicas (los 107 carros de locations) con el Catálogo de Empaques
-- Agregamos estatus operativo: OPERATIVO, EN_REPARACION, BAJA y motivo de falla
alter table locations add column if not exists empaque_id uuid references empaques(id);
alter table locations add column if not exists status_operativo text default 'OPERATIVO' check (status_operativo in ('OPERATIVO', 'EN_REPARACION', 'BAJA'));
alter table locations add column if not exists motivo_estado text;

-- Índices de optimización
create index if not exists idx_empaques_codigo on empaques(codigo);
create index if not exists idx_empaques_tipo on empaques(tipo_empaque);
create index if not exists idx_empaques_cliente on empaques(cliente_propietario);
create index if not exists idx_empaques_partes_emp on empaques_partes(empaque_id);
create index if not exists idx_empaques_partes_num on empaques_partes(part_number);
create index if not exists idx_locations_status_op on locations(status_operativo);
create index if not exists idx_locations_empaque on locations(empaque_id);

-- Políticas RLS (Row Level Security)
alter table empaques enable row level security;
alter table empaques_partes enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'empaques_select_all') then
        create policy empaques_select_all on empaques for select using (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'empaques_insert_all') then
        create policy empaques_insert_all on empaques for insert with check (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'empaques_update_all') then
        create policy empaques_update_all on empaques for update using (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'empaques_delete_all') then
        create policy empaques_delete_all on empaques for delete using (true);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'empaques_partes_select_all') then
        create policy empaques_partes_select_all on empaques_partes for select using (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'empaques_partes_insert_all') then
        create policy empaques_partes_insert_all on empaques_partes for insert with check (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'empaques_partes_update_all') then
        create policy empaques_partes_update_all on empaques_partes for update using (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'empaques_partes_delete_all') then
        create policy empaques_partes_delete_all on empaques_partes for delete using (true);
    end if;
end $$;

-- 4. Inserción de Modelos Base de Empaque
insert into empaques (codigo, nombre, tipo_empaque, cliente_propietario, permite_parciales, observaciones)
values 
    ('CARRO-KRAEM', 'Carro Tubular Metálico de Planta (Flota Interna)', 'CARRO_INTERNO', 'KRAEM', true, 'Flota de carros rodantes en planta a ras de piso'),
    ('TOTE-RETORNABLE-01', 'Tote Plástico Retornable Estándar', 'RETORNABLE_CLIENTE', 'HYUNDAI', true, 'Caja azul con retorno desde planta del cliente'),
    ('MACROBIN-INTERNO', 'Contenedor Gigante Plástico Gaylord', 'CAJA_INTERNA', 'KRAEM', true, 'Para piezas voluminosas o WIP interno'),
    ('CARTON-EMERGENCIA', 'Caja de Cartón Desechable / Desviación', 'DESECHABLE_CARTON', 'KRAEM', true, 'Empaque alternativo cuando no hay retornables')
on conflict (codigo) do update set
    tipo_empaque = excluded.tipo_empaque,
    nombre = excluded.nombre;

-- 5. MIGRACIÓN AUTOMÁTICA:
-- Conectar en automático todos los 107 carros existentes en 'locations' (type Móvil o Contenedor) con el modelo 'CARRO-KRAEM'
update locations
set 
    empaque_id = (select id from empaques where codigo = 'CARRO-KRAEM' limit 1),
    status_operativo = coalesce(status_operativo, 'OPERATIVO')
where 
    (type in ('Móvil', 'Contenedor') or location_code like 'CARRO%')
    and (empaque_id is null or status_operativo is null);
