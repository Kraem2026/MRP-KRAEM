-- ==============================================================================
-- KRAEM MRP: Sistema de Reversas Blindadas y Enlaces a Órdenes (Versión Atómica)
-- Candados activos:
--   Candado 1: Validación Física en BD (Verifica que el material siga en la ubicación actual
--              y que no tenga movimientos posteriores sin reversar)
--   Candado 2 (Atómico): Si es una TRANSFERENCIA (compuesta por salida de A y entrada a B),
--              encuentra su par y reversa AMBOS lados al mismo tiempo para que nunca se descuadre.
--   Candado 3: Motivo y Explicación de Auditoría Obligatorios
-- Ejecutar en Supabase → SQL Editor
-- ==============================================================================

-- 1. Ampliación de columnas en inventory_movements para Reversas, Fechas y Órdenes
alter table inventory_movements 
    alter column created_at set default now(),
    add column if not exists transfer_group_id text,
    add column if not exists status_stock text default 'DISPONIBLE' check (status_stock in ('DISPONIBLE', 'CALIDAD', 'BLOQUEADO', 'RETRABAJO', 'ASIGNADO')),
    add column if not exists es_parcial boolean default false,
    add column if not exists reversado boolean default false,
    add column if not exists es_reversa boolean default false,
    add column if not exists original_movement_id text,
    add column if not exists motivo_reversa text,
    add column if not exists reversado_por text,
    add column if not exists reversado_at timestamptz,
    -- Campos listos para el enlace a Órdenes de Producción y Embarques futuros:
    add column if not exists orden_produccion_folio text,
    add column if not exists maquina_id bigint,
    add column if not exists orden_embarque_folio text,
    add column if not exists cliente_destino text;

-- Reparar movimientos históricos con created_at NULL (que causaban fecha 31/12/1969):
-- Si tienen lot_number de 8 dígitos (YYYYMMDD) toma esa fecha; si no, les asigna now()
update inventory_movements
set created_at = case
    when lot_number ~ '^\d{8}$' then to_timestamp(lot_number || ' 12:00:00', 'YYYYMMDD HH24:MI:SS')
    else now()
end
where created_at is null;

-- Índices de consulta rápida
create index if not exists idx_inv_mov_transfer_group on inventory_movements(transfer_group_id);
create index if not exists idx_inv_mov_reversado on inventory_movements(reversado);
create index if not exists idx_inv_mov_es_reversa on inventory_movements(es_reversa);
create index if not exists idx_inv_mov_status_stock on inventory_movements(status_stock);
create index if not exists idx_inv_mov_op on inventory_movements(orden_produccion_folio);
create index if not exists idx_inv_mov_oe on inventory_movements(orden_embarque_folio);

-- 2. Función Stored Procedure: reversar_movimiento_seguro
create or replace function reversar_movimiento_seguro(
    p_movement_id text,
    p_motivo text,
    p_explicacion text,
    p_usuario text default 'SUPERVISOR'
)
returns json
language plpgsql
security definer
as $$
declare
    v_mov record;
    v_pair record;
    v_mov_entrada record;
    v_stock_actual numeric;
    v_nueva_fila_id text;
    v_nueva_fila_pair_id text;
    v_target_location_id bigint;
    v_target_container_id bigint;
begin
    -- =========================================================================
    -- CANDADO 3: MOTIVO Y EXPLICACIÓN DE AUDITORÍA OBLIGATORIOS
    -- =========================================================================
    if p_motivo is null or trim(p_motivo) = '' then
        raise exception 'Candado 3: Debes seleccionar un motivo oficial para autorizar la reversa.';
    end if;

    if p_explicacion is null or length(trim(p_explicacion)) < 6 then
        raise exception 'Candado 3: Es obligatorio redactar una explicación detallada de por qué se reversa este movimiento (mínimo 6 caracteres).';
    end if;

    -- Obtener el movimiento seleccionado
    select * into v_mov
    from inventory_movements
    where id::text = p_movement_id;

    if not found then
        raise exception 'El movimiento con folio #% no existe en el sistema.', p_movement_id;
    end if;

    -- Validar que no haya sido reversado previamente
    if v_mov.reversado is true then
        raise exception 'Este movimiento (#%) YA FUE REVERSADO anteriormente por % el %.', 
            p_movement_id, coalesce(v_mov.reversado_por, 'un usuario'), coalesce(to_char(v_mov.reversado_at, 'DD/MM/YYYY HH24:MI'), '');
    end if;

    -- Validar que no se intente reversar una reversa
    if v_mov.es_reversa is true or v_mov.movement_type = 'REVERSA' then
        raise exception 'Regla de auditoría: No se puede reversar un movimiento que ya es una reversa.';
    end if;

    -- =========================================================================
    -- CASO ESPECIAL: SI ES UNA TRANSFERENCIA, ENCONTRAR SU PAR ATÓMICO (A <-> B)
    -- =========================================================================
    if v_mov.movement_type = 'TRANSFERENCIA' then
        -- Buscar la otra mitad de la transferencia (por transfer_group_id o por coincidencia de lote/parte/cantidad inversa en el mismo minuto)
        if v_mov.transfer_group_id is not null then
            select * into v_pair
            from inventory_movements
            where transfer_group_id = v_mov.transfer_group_id
              and id <> v_mov.id
              and part_id = v_mov.part_id
              and coalesce(lot_number, '') = coalesce(v_mov.lot_number, '')
              and quantity = -v_mov.quantity
              and reversado is not true
            limit 1;
        else
            select * into v_pair
            from inventory_movements
            where id <> v_mov.id
              and movement_type = 'TRANSFERENCIA'
              and part_id = v_mov.part_id
              and coalesce(lot_number, '') = coalesce(v_mov.lot_number, '')
              and quantity = -v_mov.quantity
              and reversado is not true
              and abs(extract(epoch from (created_at - v_mov.created_at))) <= 10
            order by abs(extract(epoch from (created_at - v_mov.created_at))) asc
            limit 1;
        end if;

        if not found then
            raise exception 'Candado de Integridad: No se encontró el movimiento par de esta transferencia para reversar ambos lados de forma segura.';
        end if;

        -- Identificar cuál de los dos es el lado positivo (la entrada a la Ubicación B)
        if v_mov.quantity > 0 then
            v_mov_entrada := v_mov;
        else
            v_mov_entrada := v_pair;
        end if;

        -- CANDADO 1 EN TRANSFERENCIA: Verificar que las piezas sigan en la Ubicación Destino (B)
        v_target_location_id := v_mov_entrada.to_location_id;
        v_target_container_id := v_mov_entrada.to_container_id;

        select coalesce(sum(quantity), 0) into v_stock_actual
        from inventory_movements
        where part_id = v_mov_entrada.part_id
          and coalesce(lot_number, '') = coalesce(v_mov_entrada.lot_number, '')
          and (
              (v_target_location_id is not null and (to_location_id = v_target_location_id or from_location_id = v_target_location_id))
              or (v_target_location_id is null)
          )
          and (
              (v_target_container_id is not null and (to_container_id = v_target_container_id or from_container_id = v_target_container_id))
              or (v_target_container_id is null)
          );

        if v_stock_actual < abs(v_mov_entrada.quantity) then
            raise exception 'Candado 1 (Bloqueo Físico): No se puede reversar esta transferencia porque el material en la ubicación destino ya fue movido o consumido. Existencia actual en destino: % pzs, Reversa solicitada: % pzs.',
                v_stock_actual, abs(v_mov_entrada.quantity);
        end if;

        -- Insertar Reversa del Lado 1 (v_mov)
        insert into inventory_movements (
            part_id, area, quantity, from_location_id, from_container_id, to_location_id, to_container_id,
            movement_type, comment, user_id, lot_number, status_stock, es_parcial,
            es_reversa, original_movement_id, motivo_reversa, reversado_por, reversado_at, transfer_group_id
        ) values (
            v_mov.part_id, v_mov.area, -v_mov.quantity,
            v_mov.to_location_id, v_mov.to_container_id, v_mov.from_location_id, v_mov.from_container_id,
            'REVERSA',
            format('[REVERSA ATÓMICA DE TRANSFERENCIA #%s/#%s] Motivo: %s | %s | Por: %s', v_mov.id, v_pair.id, p_motivo, p_explicacion, p_usuario),
            v_mov.user_id, v_mov.lot_number, v_mov.status_stock, v_mov.es_parcial,
            true, v_mov.id::text, p_motivo || ': ' || p_explicacion, p_usuario, now(), v_mov.transfer_group_id
        ) returning id::text into v_nueva_fila_id;

        -- Insertar Reversa del Lado 2 (v_pair)
        insert into inventory_movements (
            part_id, area, quantity, from_location_id, from_container_id, to_location_id, to_container_id,
            movement_type, comment, user_id, lot_number, status_stock, es_parcial,
            es_reversa, original_movement_id, motivo_reversa, reversado_por, reversado_at, transfer_group_id
        ) values (
            v_pair.part_id, v_pair.area, -v_pair.quantity,
            v_pair.to_location_id, v_pair.to_container_id, v_pair.from_location_id, v_pair.from_container_id,
            'REVERSA',
            format('[REVERSA ATÓMICA DE TRANSFERENCIA #%s/#%s] Motivo: %s | %s | Por: %s', v_pair.id, v_mov.id, p_motivo, p_explicacion, p_usuario),
            v_pair.user_id, v_pair.lot_number, v_pair.status_stock, v_pair.es_parcial,
            true, v_pair.id::text, p_motivo || ': ' || p_explicacion, p_usuario, now(), v_pair.transfer_group_id
        ) returning id::text into v_nueva_fila_pair_id;

        -- Marcar AMBOS movimientos originales de la transferencia como reversados
        update inventory_movements
        set reversado = true,
            reversado_por = p_usuario,
            motivo_reversa = p_motivo || ': ' || p_explicacion,
            reversado_at = now()
        where id in (v_mov.id, v_pair.id);

        return json_build_object(
            'success', true,
            'message', format('Transferencia completa (#%s y #%s) reversada atómicamente. El material regresó a su ubicación original sin descuadres.', v_mov.id, v_pair.id),
            'original_id', p_movement_id,
            'reversal_id', v_nueva_fila_id,
            'piezas_reversadas', abs(v_mov.quantity)
        );
    end if;

    -- =========================================================================
    -- CANDADO 1 PARA ENTRADAS Y AJUSTES POSITIVOS (ANTI-NEGATIVOS Y ORDEN CRONOLÓGICO)
    -- =========================================================================
    if v_mov.quantity > 0 then
        v_target_location_id := v_mov.to_location_id;
        v_target_container_id := v_mov.to_container_id;

        -- Calcular existencia actual de esa parte y lote EXACTAMENTE en la ubicación donde entró (A)
        select coalesce(sum(quantity), 0) into v_stock_actual
        from inventory_movements
        where part_id = v_mov.part_id
          and coalesce(lot_number, '') = coalesce(v_mov.lot_number, '')
          and (
              (v_target_location_id is not null and (to_location_id = v_target_location_id or from_location_id = v_target_location_id))
              or (v_target_location_id is null)
          )
          and (
              (v_target_container_id is not null and (to_container_id = v_target_container_id or from_container_id = v_target_container_id))
              or (v_target_container_id is null)
          );

        if v_stock_actual < abs(v_mov.quantity) then
            raise exception 'Candado 1 (Orden Cronológico): No puedes reversar esta ENTRADA porque el material ya fue transferido a otra ubicación o consumido. Primero debes reversar la TRANSFERENCIA o SALIDA posterior. (Stock actual en esta ubicación: % pzs, Reversa solicitada: % pzs).', 
                v_stock_actual, abs(v_mov.quantity);
        end if;
    end if;

    -- =========================================================================
    -- GENERACIÓN DEL MOVIMIENTO ESPEJO (PARA ENTRADA, SALIDA O AJUSTE)
    -- =========================================================================
    insert into inventory_movements (
        part_id, area, quantity, from_location_id, from_container_id, to_location_id, to_container_id,
        movement_type, comment, user_id, lot_number, status_stock, es_parcial,
        es_reversa, original_movement_id, motivo_reversa, reversado_por, reversado_at,
        orden_produccion_folio, orden_embarque_folio
    ) values (
        v_mov.part_id, v_mov.area, -v_mov.quantity,
        v_mov.to_location_id, v_mov.to_container_id, v_mov.from_location_id, v_mov.from_container_id,
        'REVERSA',
        format('[REVERSA OFICIAL DE FOLIO #%s] Motivo: %s | Explicación: %s | Por: %s', v_mov.id, p_motivo, p_explicacion, p_usuario),
        v_mov.user_id, v_mov.lot_number, v_mov.status_stock, v_mov.es_parcial,
        true, v_mov.id::text, p_motivo || ': ' || p_explicacion, p_usuario, now(),
        v_mov.orden_produccion_folio, v_mov.orden_embarque_folio
    ) returning id::text into v_nueva_fila_id;

    update inventory_movements
    set reversado = true,
        reversado_por = p_usuario,
        motivo_reversa = p_motivo || ': ' || p_explicacion,
        reversado_at = now()
    where id = v_mov.id;

    return json_build_object(
        'success', true,
        'message', format('Movimiento #%s reversado exitosamente con Candados 1 y 3.', p_movement_id),
        'original_id', p_movement_id,
        'reversal_id', v_nueva_fila_id,
        'piezas_reversadas', abs(v_mov.quantity)
    );
end;
$$;
