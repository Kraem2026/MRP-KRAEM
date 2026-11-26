-- ==============================================================================
-- APEX SYSTEM / KRAEM MRP: MÓDULO DE COMPRAS, PROVEEDORES Y RECIBO WMS (FASE 1)
--   * `proveedores`               (Catálogo Maestro con datos fiscales, contacto y correo para envío automático de OC)
--   * `compras_ordenes`           (Cabecera de Órdenes de Compra / Requisiciones)
--   * `compras_ordenes_det`       (Partidas de compra con precios, cantidades y UoM)
--   * `compras_recibos`           (Recepción física en WMS contra Factura/Remisión)
--   * `compras_recibos_det`       (Detalle de piezas recibidas con Lote Proveedor y Ubicación WMS)
--   * `v_compras_pendientes`      (Vista para Almacén WMS: qué material falta por recibir)
--
-- 100% NO DESTRUCTIVO: Crear tablas, vistas e índices seguros.
-- Ejecutar en Supabase → SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CATÁLOGO MAESTRO DE PROVEEDORES (`proveedores`)
-- ------------------------------------------------------------------------------
create table if not exists proveedores (
    id bigserial primary key,
    codigo              text unique not null,
    nombre_comercial    text not null,
    razon_social        text not null,
    rfc                 text,
    categoria           text default 'RESINAS', -- RESINAS, COMPONENTES, EMPAQUE, QUIMICOS, REFACCIONES, SERVICIOS
    direccion           text,
    ciudad              text,
    estado              text,
    pais                text default 'México',
    codigo_postal       text,
    contacto_nombre     text,
    telefono            text,
    email_pedidos       text not null, -- Correo principal para envío automático de la OC
    email_facturacion   text,
    dias_credito        integer default 30,
    lead_time_dias      integer default 5, -- Tiempo estándar de entrega para el MRP
    moneda_preferida    text default 'MXN', -- MXN, USD, EUR
    observaciones       text,
    activo              boolean default true,
    created_at          timestamptz default now(),
    updated_at          timestamptz default now()
);

create index if not exists idx_proveedores_codigo on proveedores(codigo);
create index if not exists idx_proveedores_categoria on proveedores(categoria);
create index if not exists idx_proveedores_email on proveedores(email_pedidos);

-- ------------------------------------------------------------------------------
-- 2. ÓRDENES DE COMPRA / REQUISICIONES (`compras_ordenes`)
-- ------------------------------------------------------------------------------
create table if not exists compras_ordenes (
    id bigserial primary key,
    folio               text unique not null, -- Ej. OC-2026-0001
    proveedor_id        bigint references proveedores(id) on delete restrict,
    fecha_emision       date default current_date,
    fecha_prometida     date,
    estatus             text default 'BORRADOR', -- BORRADOR, ENVIADA, RECIBIDA_PARCIAL, RECIBIDA_TOTAL, CANCELADA
    moneda              text default 'MXN',
    tipo_cambio         numeric(10,4) default 1.0000,
    subtotal            numeric(14,2) default 0,
    iva_pct             numeric(5,2) default 16,
    iva_monto           numeric(14,2) default 0,
    total               numeric(14,2) default 0,
    condiciones_pago    text default 'Crédito 30 días',
    lugar_entrega       text default 'Planta KRAEM - Almacén WMS',
    comprador           text,
    observaciones       text,
    origen_mrp          boolean default false,
    email_enviado_at    timestamptz,
    created_at          timestamptz default now(),
    updated_at          timestamptz default now()
);

create index if not exists idx_compras_ordenes_folio on compras_ordenes(folio);
create index if not exists idx_compras_ordenes_estatus on compras_ordenes(estatus);
create index if not exists idx_compras_ordenes_prov on compras_ordenes(proveedor_id);

-- ------------------------------------------------------------------------------
-- 3. PARTIDAS DE ÓRDENES DE COMPRA (`compras_ordenes_det`)
-- ------------------------------------------------------------------------------
create table if not exists compras_ordenes_det (
    id bigserial primary key,
    orden_id            bigint references compras_ordenes(id) on delete cascade,
    part_id             bigint references parts(id) on delete restrict,
    part_number         text not null,
    descripcion         text,
    cantidad_ordenada   numeric(12,2) not null,
    cantidad_recibida   numeric(12,2) default 0,
    unidad_medida       text default 'KG',
    precio_unitario     numeric(14,4) default 0,
    importe             numeric(14,2) default 0,
    estatus_linea       text default 'PENDIENTE', -- PENDIENTE, PARCIAL, RECIBIDO
    created_at          timestamptz default now()
);

create index if not exists idx_compras_det_orden on compras_ordenes_det(orden_id);
create index if not exists idx_compras_det_part on compras_ordenes_det(part_id);

-- ------------------------------------------------------------------------------
-- 4. RECEPCIÓN EN ALMACÉN WMS (`compras_recibos`)
-- ------------------------------------------------------------------------------
create table if not exists compras_recibos (
    id bigserial primary key,
    folio_recibo        text unique not null, -- Ej. REC-2026-0001
    orden_id            bigint references compras_ordenes(id) on delete restrict,
    proveedor_id        bigint references proveedores(id) on delete restrict,
    factura_remision    text not null, -- Número de factura o remisión del transportista
    fecha_recepcion     timestamptz default now(),
    recibido_por        text,
    observaciones       text,
    created_at          timestamptz default now()
);

create index if not exists idx_compras_recibos_folio on compras_recibos(folio_recibo);
create index if not exists idx_compras_recibos_orden on compras_recibos(orden_id);

-- ------------------------------------------------------------------------------
-- 5. DETALLE DE RECEPCIÓN WMS Y TRAZABILIDAD FIFO (`compras_recibos_det`)
-- ------------------------------------------------------------------------------
create table if not exists compras_recibos_det (
    id bigserial primary key,
    recibo_id           bigint references compras_recibos(id) on delete cascade,
    orden_det_id        bigint references compras_ordenes_det(id) on delete restrict,
    part_id             bigint references parts(id) on delete restrict,
    part_number         text not null,
    cantidad_recibida   numeric(12,2) not null,
    lote_proveedor      text not null, -- Lote de fábrica para trazabilidad FIFO
    location_id         bigint references locations(id), -- Ubicación de rack/tolva asignada
    certificado_calidad boolean default true,
    created_at          timestamptz default now()
);

create index if not exists idx_recibos_det_recibo on compras_recibos_det(recibo_id);
create index if not exists idx_recibos_det_part on compras_recibos_det(part_id);
create index if not exists idx_recibos_det_lote on compras_recibos_det(lote_proveedor);

-- ------------------------------------------------------------------------------
-- 6. VISTA: MATERIALES PENDIENTES DE RECIBIR EN WMS (`v_compras_pendientes`)
-- ------------------------------------------------------------------------------
create or replace view v_compras_pendientes as
select
    co.id as orden_id,
    co.folio,
    co.fecha_emision,
    co.fecha_prometida,
    co.estatus as estatus_orden,
    p.codigo as proveedor_codigo,
    p.nombre_comercial as proveedor_nombre,
    p.email_pedidos,
    cd.id as partida_id,
    cd.part_id,
    cd.part_number,
    cd.descripcion,
    cd.cantidad_ordenada,
    cd.cantidad_recibida,
    (cd.cantidad_ordenada - cd.cantidad_recibida) as cantidad_pendiente,
    cd.unidad_medida,
    cd.estatus_linea
from compras_ordenes co
join proveedores p on p.id = co.proveedor_id
join compras_ordenes_det cd on cd.orden_id = co.id
where co.estatus in ('ENVIADA', 'RECIBIDA_PARCIAL')
  and (cd.cantidad_ordenada - cd.cantidad_recibida) > 0;

-- ------------------------------------------------------------------------------
-- 7. REGISTROS SEMILLA (PROVEEDORES INDUSTRIALES REALISTAS)
-- ------------------------------------------------------------------------------
insert into proveedores (codigo, nombre_comercial, razon_social, rfc, categoria, direccion, ciudad, estado, pais, codigo_postal, contacto_nombre, telefono, email_pedidos, dias_credito, lead_time_dias, moneda_preferida)
values
    ('PROV-SABIC', 'SABIC México', 'SABIC Innovative Plastics México S. de R.L. de C.V.', 'SIP980421XX1', 'RESINAS', 'Av. De los Sauces 12', 'Lerma', 'Estado de México', 'México', '52000', 'Ing. Carlos Mendoza', '7282829000', 'pedidos.mexico@sabic.com', 45, 5, 'USD'),
    ('PROV-LGCHEM', 'LG Chem Automotive', 'LG Chem America Inc. Sucursal México', 'LGC120805AA2', 'RESINAS', 'Parque Industrial Milenium', 'Apodaca', 'Nuevo León', 'México', '66600', 'Lic. Min-Soo Park / Roberto Garza', '8182451000', 'orders.mex@lgchem.com', 60, 7, 'USD'),
    ('PROV-ALPEK', 'Alpek Polyester', 'Alpek DAK Americas S.A. de C.V.', 'ADA010915B33', 'RESINAS', 'Av. Gómez Morín 1111', 'San Pedro Garza García', 'Nuevo León', 'México', '66220', 'Ing. Fernando Treviño', '8187485200', 'ventas.resinas@alpek.com', 30, 3, 'MXN'),
    ('PROV-DUPONT', 'DuPont Performance Resins', 'DuPont México S.A. de C.V.', 'DUP6501019A1', 'RESINAS', 'Homero 206, Polanco', 'Ciudad de México', 'CDMX', 'México', '11570', 'Ing. Valeria Domínguez', '5557221000', 'resinas.dupont@dupont.com', 45, 10, 'USD'),
    ('PROV-CLIPS', 'Fasteners & Clips del Norte', 'Fijaciones Industriales del Norte S.A. de C.V.', 'FIN080312KJ4', 'COMPONENTES', 'Av. Lincoln 4500', 'Monterrey', 'Nuevo León', 'México', '64100', 'Lic. Alejandro Ríos', '8183104500', 'ventas@clipsdelnorte.com.mx', 30, 4, 'MXN'),
    ('PROV-EMPAC', 'Empaques Industriales Kraem', 'Soluciones de Cartón y Corrugados de México S.A.', 'SCC150420TR8', 'EMPAQUE', 'Carretera a Laredo Km 15', 'Escobedo', 'Nuevo León', 'México', '66050', 'Lic. Sandra Lozano', '8182993000', 'pedidos@empaqueskraem.com', 15, 2, 'MXN')
on conflict (codigo) do nothing;
