-- ==============================================================================
-- KRAEM MRP · WMS · Correcciones de integridad del inventario (idempotente)
-- Reemplaza/completa a wms_reversas_ordenes.sql (que estaba aplicado solo a medias).
--
-- Qué corrige:
--  1. Falta la columna transfer_group_id (las TRANSFERENCIAS fallaban al guardar).
--  2. created_at sin DEFAULT (27 movimientos sin fecha; FIFO y horas incorrectas).
--  3. CHECK de status_stock sin 'ASIGNADO' (Torre de Control no podía asignar a embarque).
--  4. Reversa de TRANSFERENCIA solo revertía UN lado (dejaba piezas fantasma).
--  5. 'area' (texto libre) distinta a la del catálogo ('ALMACEN' vs 'Almacén') -> el stock
--     quedaba "invisible" para SALIDA/FIFO. Ahora el área se toma SIEMPRE de la ubicación.
--  6. Sin candado en BD contra stock negativo (se podía sacar más de lo existente).
--  7. v_history_master no exponía lote, contenedor, reversado ni es_reversa
--     (la pantalla REVERSAS no mostraba "REVERSADO" ni lote ni carro).
-- ==============================================================================

-- 1-3. Columnas, default de fecha y constraint ------------------------------------
alter table public.inventory_movements add column if not exists transfer_group_id text;
alter table public.inventory_movements alter column created_at set default now();

alter table public.inventory_movements drop constraint if exists inventory_movements_status_stock_check;
alter table public.inventory_movements add constraint inventory_movements_status_stock_check
  check (status_stock in ('DISPONIBLE','CALIDAD','BLOQUEADO','RETRABAJO','ASIGNADO'));

create index if not exists idx_inv_mov_transfer_group on public.inventory_movements(transfer_group_id);
create index if not exists idx_inv_mov_part on public.inventory_movements(part_id);
create index if not exists idx_inv_mov_reversado on public.inventory_movements(reversado);
create index if not exists idx_inv_mov_es_reversa on public.inventory_movements(es_reversa);

-- Reparar fechas NULL: usa la fecha del lote (YYYYMMDD) si es válida; si no, now()
do $$
declare r record;
begin
  for r in select id, lot_number from public.inventory_movements where created_at is null loop
    begin
      if r.lot_number ~ '^20[2-3][0-9](0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$' then
        update public.inventory_movements
           set created_at = (to_date(r.lot_number, 'YYYYMMDD') + time '12:00')
         where id = r.id;
      else
        update public.inventory_movements set created_at = now() where id = r.id;
      end if;
    exception when others then
      update public.inventory_movements set created_at = now() where id = r.id;
    end;
  end loop;
end $$;

-- 5. El área de un movimiento SIEMPRE sale de la ubicación física -------------------
create or replace function public.wms_normalizar_area_movimiento()
returns trigger language plpgsql as $$
declare
  v_loc integer;
  v_area_id integer;
  v_area_name text;
begin
  v_loc := coalesce(
             case when new.quantity < 0 then new.from_location_id else new.to_location_id end,
             new.to_location_id, new.from_location_id);
  if v_loc is not null then
    select l.area_id, a.area_name into v_area_id, v_area_name
      from public.locations l left join public.areas a on a.id = l.area_id
     where l.id = v_loc;
    if v_area_id is not null then
      new.area_id := v_area_id;
      new.area := v_area_name;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_wms_a_normalizar_area on public.inventory_movements;
create trigger trg_wms_a_normalizar_area
  before insert on public.inventory_movements
  for each row execute function public.wms_normalizar_area_movimiento();

-- Corregir históricos con área distinta a la de su ubicación
update public.inventory_movements m
   set area = a.area_name, area_id = a.id
  from public.locations l
  join public.areas a on a.id = l.area_id
 where l.id = coalesce(case when m.quantity < 0 then m.from_location_id else m.to_location_id end,
                       m.to_location_id, m.from_location_id)
   and (m.area is distinct from a.area_name or m.area_id is distinct from a.id);

-- 6. Candado anti-stock-negativo (ubicación + contenedor + lote + parte) ------------
create or replace function public.wms_validar_stock_no_negativo()
returns trigger language plpgsql as $$
declare
  v_stock numeric;
  v_pn text;
  v_loc text;
begin
  if new.quantity >= 0 or new.from_location_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.part_id::text || ':' || new.from_location_id::text));

  select coalesce(sum(m.quantity), 0) into v_stock
    from public.inventory_movements m
   where m.part_id = new.part_id
     and coalesce(m.to_location_id, m.from_location_id) = new.from_location_id
     and coalesce(m.to_container_id, m.from_container_id) is not distinct from new.from_container_id
     and coalesce(m.lot_number, '') = coalesce(new.lot_number, '');

  if v_stock + new.quantity < 0 then
    select part_number into v_pn from public.parts where id = new.part_id;
    select location_code into v_loc from public.locations where id = new.from_location_id;
    raise exception 'Stock insuficiente: la parte % en [%] (lote %) solo tiene % pzs y se intentan sacar % pzs.',
      coalesce(v_pn, new.part_id::text), coalesce(v_loc, new.from_location_id::text),
      coalesce(nullif(new.lot_number, ''), 'S/L'), v_stock, abs(new.quantity);
  end if;
  return new;
end $$;

drop trigger if exists trg_wms_b_stock_no_negativo on public.inventory_movements;
create trigger trg_wms_b_stock_no_negativo
  before insert on public.inventory_movements
  for each row execute function public.wms_validar_stock_no_negativo();

-- 4. Reversa blindada (Candados 1, 2 y 3) ---------------------------------------------
create or replace function public.reversar_movimiento_seguro(
  p_movement_id text,
  p_motivo text,
  p_explicacion text,
  p_usuario text default 'SUPERVISOR'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov record;
  v_pair record;
  v_ent record;
  v_stock numeric;
  v_id1 text;
  v_id2 text;
  v_uid uuid;
  v_huerfana boolean := false;
begin
  -- CANDADO 3: motivo y explicación obligatorios
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Candado 3: Debes seleccionar un motivo oficial para autorizar la reversa.';
  end if;
  if p_explicacion is null or length(trim(p_explicacion)) < 6 then
    raise exception 'Candado 3: Es obligatorio redactar una explicación detallada (mínimo 6 caracteres).';
  end if;

  select * into v_mov from public.inventory_movements where id::text = p_movement_id for update;
  if not found then
    raise exception 'El movimiento con folio #% no existe en el sistema.', p_movement_id;
  end if;
  if v_mov.reversado is true then
    raise exception 'Este movimiento (#%) YA FUE REVERSADO anteriormente por % el %.',
      p_movement_id, coalesce(v_mov.reversado_por, 'un usuario'),
      coalesce(to_char(v_mov.reversado_at, 'DD/MM/YYYY HH24:MI'), '');
  end if;
  if v_mov.es_reversa is true or v_mov.movement_type = 'REVERSA' then
    raise exception 'Regla de auditoría: No se puede reversar un movimiento que ya es una reversa.';
  end if;
  if v_mov.quantity = 0 then
    raise exception 'Este registro es solo una marca de estatus/auditoría (0 pzs); no mueve inventario y no se reversa.';
  end if;

  v_uid := coalesce(auth.uid(), v_mov.user_id);

  -- CANDADO 2 (atómico): una TRANSFERENCIA se reversa completa (lado A y lado B)
  if v_mov.movement_type = 'TRANSFERENCIA' then
    if v_mov.transfer_group_id is not null then
      select * into v_pair from public.inventory_movements
       where transfer_group_id = v_mov.transfer_group_id
         and id <> v_mov.id
         and movement_type = 'TRANSFERENCIA'
         and part_id = v_mov.part_id
         and coalesce(lot_number, '') = coalesce(v_mov.lot_number, '')
         and quantity = -v_mov.quantity
         and es_reversa is not true
       order by id limit 1;
    else
      -- Transferencias antiguas sin grupo: par = mismo comentario, cantidad inversa y folio contiguo
      select * into v_pair from public.inventory_movements
       where id <> v_mov.id
         and movement_type = 'TRANSFERENCIA'
         and part_id = v_mov.part_id
         and coalesce(lot_number, '') = coalesce(v_mov.lot_number, '')
         and quantity = -v_mov.quantity
         and es_reversa is not true
         and coalesce(comment, '') = coalesce(v_mov.comment, '')
         and abs(id - v_mov.id) <= 3
       order by abs(id - v_mov.id) limit 1;
    end if;

    if not found then
      raise exception 'Candado de Integridad: no se encontró el movimiento par de esta transferencia; no se puede reversar de forma segura.';
    end if;

    -- Caso "huérfano": el otro lado ya había sido reversado por separado (error histórico).
    -- Se permite reversar solo este lado para sanear el inventario.
    v_huerfana := (v_pair.reversado is true);

    if not v_huerfana then
      if v_mov.quantity > 0 then v_ent := v_mov; else v_ent := v_pair; end if;

      -- CANDADO 1: las piezas deben seguir en el destino
      select coalesce(sum(quantity), 0) into v_stock
        from public.inventory_movements
       where part_id = v_ent.part_id
         and coalesce(to_location_id, from_location_id) = v_ent.to_location_id
         and coalesce(to_container_id, from_container_id) is not distinct from v_ent.to_container_id
         and coalesce(lot_number, '') = coalesce(v_ent.lot_number, '');
      if v_stock < abs(v_ent.quantity) then
        raise exception 'Candado 1 (Bloqueo Físico): no se puede reversar la transferencia porque el material ya fue movido o consumido en el destino. Existencia actual en destino: % pzs, a reversar: % pzs.',
          v_stock, abs(v_ent.quantity);
      end if;

      insert into public.inventory_movements (
        part_id, area, quantity, from_location_id, from_container_id, to_location_id, to_container_id,
        movement_type, comment, user_id, lot_number, status_stock, es_parcial,
        es_reversa, original_movement_id, motivo_reversa, reversado_por, reversado_at, transfer_group_id,
        orden_produccion_folio, orden_embarque_folio)
      select x.part_id, x.area, -x.quantity, x.to_location_id, x.to_container_id, x.from_location_id, x.from_container_id,
             'REVERSA',
             format('[REVERSA ATÓMICA DE TRANSFERENCIA #%s/#%s] Motivo: %s | %s | Por: %s',
                    x.id, case when x.id = v_mov.id then v_pair.id else v_mov.id end, p_motivo, p_explicacion, p_usuario),
             v_uid, x.lot_number, x.status_stock, x.es_parcial,
             true, x.id::text, p_motivo || ': ' || p_explicacion, p_usuario, now(), x.transfer_group_id,
             x.orden_produccion_folio, x.orden_embarque_folio
        from (select * from public.inventory_movements where id in (v_mov.id, v_pair.id)
               order by quantity desc) x;  -- primero entra el lado positivo (origen), luego sale el destino

      update public.inventory_movements
         set reversado = true, reversado_por = p_usuario, reversado_at = now(),
             motivo_reversa = p_motivo || ': ' || p_explicacion
       where id in (v_mov.id, v_pair.id);

      return json_build_object(
        'success', true,
        'message', format('Transferencia completa (#%s y #%s) reversada atómicamente. El material regresó a su origen sin descuadres.', v_mov.id, v_pair.id),
        'original_id', p_movement_id,
        'piezas_reversadas', abs(v_mov.quantity));
    end if;
    -- si es huérfana, continúa al flujo de un solo movimiento
  end if;

  -- CANDADO 1 (entradas / ajustes + / lado positivo huérfano): las piezas deben seguir ahí
  if v_mov.quantity > 0 and v_mov.to_location_id is not null then
    select coalesce(sum(quantity), 0) into v_stock
      from public.inventory_movements
     where part_id = v_mov.part_id
       and coalesce(to_location_id, from_location_id) = v_mov.to_location_id
       and coalesce(to_container_id, from_container_id) is not distinct from v_mov.to_container_id
       and coalesce(lot_number, '') = coalesce(v_mov.lot_number, '');
    if v_stock < v_mov.quantity then
      raise exception 'Candado 1 (Orden Cronológico): no puedes reversar este movimiento porque el material ya fue transferido o consumido. Primero reversa el movimiento posterior. (Stock actual en la ubicación: % pzs, a reversar: % pzs).',
        v_stock, v_mov.quantity;
    end if;
  end if;

  -- Movimiento espejo
  insert into public.inventory_movements (
    part_id, area, quantity, from_location_id, from_container_id, to_location_id, to_container_id,
    movement_type, comment, user_id, lot_number, status_stock, es_parcial,
    es_reversa, original_movement_id, motivo_reversa, reversado_por, reversado_at,
    orden_produccion_folio, orden_embarque_folio, transfer_group_id)
  values (
    v_mov.part_id, v_mov.area, -v_mov.quantity,
    v_mov.to_location_id, v_mov.to_container_id, v_mov.from_location_id, v_mov.from_container_id,
    'REVERSA',
    format('[REVERSA OFICIAL DE FOLIO #%s%s] Motivo: %s | Explicación: %s | Por: %s',
           v_mov.id, case when v_huerfana then ' (saneamiento de transferencia huérfana)' else '' end,
           p_motivo, p_explicacion, p_usuario),
    v_uid, v_mov.lot_number, v_mov.status_stock, v_mov.es_parcial,
    true, v_mov.id::text, p_motivo || ': ' || p_explicacion, p_usuario, now(),
    v_mov.orden_produccion_folio, v_mov.orden_embarque_folio, v_mov.transfer_group_id)
  returning id::text into v_id1;

  update public.inventory_movements
     set reversado = true, reversado_por = p_usuario, reversado_at = now(),
         motivo_reversa = p_motivo || ': ' || p_explicacion
   where id = v_mov.id;

  return json_build_object(
    'success', true,
    'message', format('Movimiento #%s reversado exitosamente con Candados 1 y 3.', p_movement_id),
    'original_id', p_movement_id,
    'reversal_id', v_id1,
    'piezas_reversadas', abs(v_mov.quantity));
end;
$$;

-- 7. Historial maestro: ahora expone lote, contenedores y estado de reversa ----------
create or replace view public.v_history_master as
 select h.id,
        h.created_at,
        h.part_number,
        p.part_name as description,
        p.project,
        h.from_location,
        h.to_location,
        h.quantity,
        h.movement_type,
        h.area,
        h.comment,
        h.user_email,
        m.lot_number,
        coalesce(m.reversado, false)  as reversado,
        coalesce(m.es_reversa, false) as es_reversa,
        cf.location_code as from_container,
        ct.location_code as to_container,
        m.transfer_group_id,
        m.status_stock,
        m.original_movement_id
   from public.inventory_history h
   left join public.parts p on h.part_number = p.part_number
   join public.inventory_movements m on m.id = h.id
   left join public.locations cf on cf.id = m.from_container_id
   left join public.locations ct on ct.id = m.to_container_id;
