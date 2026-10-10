-- Matriz de habilidades / versatilidad (KRAEM)
-- Ejecutar en Supabase → SQL Editor

create table if not exists rh_procesos (
    id uuid primary key default gen_random_uuid(),
    codigo text,
    nombre text not null,
    descripcion text,
    area_general_id uuid,
    activo boolean default true,
    created_at timestamptz default now()
);

create table if not exists rh_matriz_habilidades (
    id uuid primary key default gen_random_uuid(),
    empleado_id uuid not null references rh_empleados(id) on delete cascade,
    proceso_id uuid not null references rh_procesos(id) on delete cascade,
    nivel int not null check (nivel between 1 and 4),
    fecha_inicio date,
    fecha_nivel date,
    instructor text,
    observaciones text,
    updated_at timestamptz default now(),
    unique (empleado_id, proceso_id)
);

create table if not exists rh_matriz_historial (
    id uuid primary key default gen_random_uuid(),
    empleado_id uuid not null references rh_empleados(id) on delete cascade,
    proceso_id uuid not null references rh_procesos(id) on delete cascade,
    nivel int not null check (nivel between 1 and 4),
    fecha_inicio date,
    fecha_fin date,
    instructor text,
    observaciones text,
    created_at timestamptz default now()
);

create index if not exists idx_rh_matriz_emp on rh_matriz_habilidades (empleado_id);
create index if not exists idx_rh_matriz_proc on rh_matriz_habilidades (proceso_id);
create index if not exists idx_rh_hist_emp_proc on rh_matriz_historial (empleado_id, proceso_id);

alter table rh_procesos enable row level security;
alter table rh_matriz_habilidades enable row level security;
alter table rh_matriz_historial enable row level security;

-- Ajusta estas políticas si ya usas autenticación más estricta
do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'rh_procesos_all') then
        create policy rh_procesos_all on rh_procesos for all using (true) with check (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'rh_matriz_all') then
        create policy rh_matriz_all on rh_matriz_habilidades for all using (true) with check (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'rh_hist_all') then
        create policy rh_hist_all on rh_matriz_historial for all using (true) with check (true);
    end if;
end $$;
