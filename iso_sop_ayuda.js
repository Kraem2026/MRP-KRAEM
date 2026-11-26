/**
 * KRAEM S.A. DE C.V. - SISTEMA DE GESTIÓN DE CALIDAD ISO 9001 / IATF 16949
 * Motor de Instrucciones de Trabajo Estándar (SOP) con CAPTURAS DE PANTALLA REALES DEL SISTEMA
 * - Renderiza réplicas 1:1 del DOM/CSS real de cada pantalla y usa html2canvas para capturar la pantalla real
 *   exactamente como la ve el operador, tanto en el visor interactivo como en el PDF controlado.
 * - Incluye además el botón "📸 Capturar Mi Pantalla Actual en Vivo" para tomar fotos reales en vivo.
 */
(function () {
  const KRAEM_LOGO_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAdOSURBVGhDvVjbb5RFFOc/UYnQG7SBaikQuSjYlnu5JgrGaGLCpfggUhKkAiqXAImIDybEVwVLIOKLMYIJvrUJFx9q0CbQ7hIotIZ2od12uz2eMzNn9sx8833dlsLDLzNzzpkzv9/cvtmdls1mYWhoyAHZslksPbv2sT8AjkmMk7lCfoLwc6wp/b5BAQxFxLcZYrquB1A29otS+5iUSyYi0NjJz3B9Lk+dI0EAJ5R+tkXiPFGOjyFEFvppcmyTIMLjxqAvUUBc6feRg4TyqT6eLcmufCYnCQ/5CRQzLeSQ4EF4IJ0Uk/MAwsd+rksbx0ftrs2HiolpU9/EM+DD6Uwwg7Nd27Q42Y9jxrP5YnQ+N47z81hKQCi5ChalHyNt0qcH8GyiHkKcn3NFbWYMLMc9A0koJHtGBHLL/I7Nq0cExCUkG6keGRmB0dFRyOfzUwrKSbmZjx6vIJBXVfIl2zQmG3F69+4w+miQsbGx5woSMzw8rIkbaD4BjiSAGxwk29aOnShxaMDnARYR4aG4UFkQoQRYdcbI0B1ezMz7IBGSi8+J2/YWUqVwsKBcLhcc4EWAzgTz8cFnwm4hargBWpC|+dajd19cH6VQK0uk09PX2xq5Qf3+/iuHYnp6eCW3F/Gg+wsvyIyA/ewvJQHbSPvQHHHz6FI4dOQLLly5VONjSAplMxokhPHr4CD764ENYtmQpYokqf7l8ORKXBBpbHmjJTa0Als41Grl5hqMr8OTJE2jeswfKZ8yAMkTTjp1qpmXMwMAAHDxwAGaXlqq4qvIKOH70qBNTDFiA5WeJE9eAAB+hFSgImAllr86A3Tt2OAJo33596hTMnT1bxVSWlcP+ffug//FjJ08x8FfAEhcc9SEmCCMHJQqYiQJwdqUAOgvffnMGqioqlI9m//2tW+Eh7n2Zo1g4Ajx+XNpbiJ3KYWzxAj6FCitAbyG6rS60tkLN3GpFnARuWLtOHfg8rkoORYzcuStwx0HuUS+MeWNZAZKbrOOKxG6hZAF6CxFRPgN/XL2qDisJq0Dflg0b4J/btyGPOTKXfob76zZBqnoBpObWQhqhyjlYKsyDvi+OQB7HlGPR2HH8COSbtAAiSiKacAv9ee0aLJo/X8882hYvXAjtbW14DeL7pqsb7r3xFnS/XGIws1B/iYBtRG/zZ5AfHHTGkgL8C4Y5RraQrCfdQixgdUMDLJw3D9slql1b/ZpaDRv/62/Q/UopdFkBiPI5kK58HdJVNQgssf7foS+DK0BvMOIkJ1pxNgc6eIhVECJuBfZ+YrYQiTBCuDzc8rkTnzl/QQkg4iks07WLYOCHc/D09yuIqwZXINvxN4x5H0RnBUICsIwVQIgVYM6A2u8swGBBTQ3cuH7dxmfOtyoBRD6FIh6s3aQOtMwZBxbAKxCpI+wZYKcjAG0hAXyIadusX7MGVrxdZwTgxw2/DQ3Ll0Pnv52qb+ZcK6Sml8K96WVaQONmFPDQyRkHKyAB+BaKF0C2OAFEnm4buoXa29ph7cpVdhVmlZRA0/bt0IvvpMyPP+Hs0/YpgTSuQs8kBFh+pq7axlZYAeOQSL6F9KHdvVNfozeu34A3Fy3Wq4CoKi9Xz4lM60W9fYyISa9AgB/BCpBgdYmH2Ox9FkBf4UsXL6pbiK9TKr87eAi666bZc/CgccvEBXjcJNegAEKSgGa+hRDyMUd9vj97Firx8UY+Wola/DJf2LMXuqrnT1qAw0vUCbECCIkCzA3EK8B+ynfm9Gm1xfg9VI/P7pvHT0LXFK2AbI8jIPkWmlVSCh/v2uUIIAxgm95Ls9RzWm+ljY2N0Nm8H+5v3johAcQhxFEJQTsKcB0S4wmgVfBXgHEXH2jvvfOuFUBo2rYNOo+dgBzeTn58CLwCxMX+2Wu4qZXRAsIrQIHx3wF6jZpbKPCDhpHq7oa6ZctUHH0fKkvL4OThwzCEOULxPliAguHktLEMCrA/HNDnCxjEB9epEydgdX0DrKqrh6+QUOgnJaOjowO2bNwIK+vqYAViPT6x/7p1KxjrwwrwHnLEjcuwAEZAAIGuzNxITv0GKOYvF4pj0C+2UM4Q6DXLZOM4KgHcsE6yGTsNGEr+IiD/VpH8JLQAQThUFjtjUwlaWSbNPHzy9heZhiFtbiXVyQSGvgfPE7z3LQ/iZbj4MAJ0Qwb6HdSNVMR+f1bQzNNYzEEKkSUjcojlDSQFKR/eBrQvaRCapakE5aTcelzDQYwdh6gAUUYEiLYeaIpA+bz8zEHWZVvZUKjeQsrpJyN4CZXNSyLqjp36MlTb7avthcmzMabNMY7f1KXNroAfwMnYZktvEAnfHhdHIB/DsVk+7uSxX7YJKCBqJCiiLIJmS82Y8RlE+nh1HzLWxoncMiYu3kfkDDDiEjq2gDAu/bqMk0jyFYNYAcWABYR8BElKrqiMeRZQvsQVCNkZauY8WzGYSL+kOJWHBfizI2eWB5TJdLyO4UQE6zdlHGR+axN2WZcxKo5jFLLwP+8MXwWI80HSAAAAAElFTkSuQmCC'.replace('+|', '+');

  // Cargar html2canvas dinámicamente para convertir las vistas reales del DOM en imágenes PNG de alta resolución
  function asegurarHtml2Canvas() {
    return new Promise((resolve) => {
      if (window.html2canvas) return resolve(window.html2canvas);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = () => resolve(window.html2canvas);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  function limpiarTextoPDF(str) {
    if (!str) return '';
    return String(str)
      .replace(/➔|➜|➡/g, '->')
      .replace(/•|·/g, '-')
      .replace(/[^\x20-\x7E\xA1-\xFF\n]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // =========================================================================
  // GENERADOR DE VISTAS REALES 1:1 DEL DOM DE CADA PANTALLA DEL SISTEMA KRAEM
  // Usa las mismas clases, colores, estructura, textos e íconos FontAwesome reales
  // =========================================================================
  function construirHTMLRealDelPaso(sceneId) {
    switch (sceneId) {
      // ---------------------------------------------------------------------
      // WMS OPERACIONES - ENTRADAS (PASOS 1 A 4)
      // ---------------------------------------------------------------------
      case 'WMS_ENT_1':
        return `
          <div class="real-ui-shot">
            <div class="r-topbar">
              <div class="r-top-left">
                <div class="r-btn-back"><i class="fas fa-arrow-left"></i></div>
                <div>
                  <div class="r-h1">⚡ WMS Estación Operativa Unificada</div>
                  <div class="r-sub">Entradas, Salidas FIFO Automáticas, Transferencias, Ajustes y Reversas Blindadas</div>
                </div>
              </div>
            </div>
            <div class="r-user-badge">
              <span><i class="fas fa-user-shield" style="color:#2563eb;"></i> OPERADOR ACTIVO: <b>ALMACEN01</b> (almacen01@kraem.com)</span>
              <span class="r-badge-online"><i class="fas fa-lock"></i> Trazabilidad Activa</span>
            </div>
            <div class="r-tabs sop-focus-ring" data-callout="1. Haz clic en 1. ENTRADA">
              <div class="r-tab active"><i class="fas fa-arrow-right-to-bracket"></i><span>1. ENTRADA</span></div>
              <div class="r-tab"><i class="fas fa-truck-ramp-box"></i><span>2. SALIDA (FIFO)</span></div>
              <div class="r-tab"><i class="fas fa-people-carry-box"></i><span>3. REUBICAR</span></div>
              <div class="r-tab"><i class="fas fa-scale-balanced"></i><span>4. AJUSTES</span></div>
              <div class="r-tab"><i class="fas fa-history"></i><span>5. REVERSAS</span></div>
            </div>
            <div class="r-main-card">
              <div class="r-form-group sop-focus-ring" data-callout="2. Escribe o escanea con cámara el N° de Parte">
                <div class="r-label">NÚMERO DE PARTE *</div>
                <div class="r-input-btn">
                  <div class="r-input" style="border-color:#2563eb; font-weight:700;">84120-KRAEM-01 — PANEL FRONTAL INYECCION ABS</div>
                  <div class="r-btn-qr"><i class="fas fa-camera"></i></div>
                </div>
              </div>
              <div class="r-std-banner">
                <div><i class="fas fa-boxes-packing" style="color:#2563eb; margin-right:6px;"></i> <b>Empaque Estándar Oficial</b></div>
                <span class="r-badge-std">50 pzs</span>
              </div>
            </div>
          </div>`;

      case 'WMS_ENT_2':
        return `
          <div class="real-ui-shot">
            <div class="r-main-card">
              <div class="r-form-group">
                <div class="r-label">NÚMERO DE PARTE *</div>
                <div class="r-input-btn">
                  <div class="r-input" style="font-weight:700;">84120-KRAEM-01 — PANEL FRONTAL INYECCION ABS</div>
                  <div class="r-btn-qr"><i class="fas fa-camera"></i></div>
                </div>
              </div>
              <div class="r-std-banner">
                <div><i class="fas fa-boxes-packing" style="color:#2563eb; margin-right:6px;"></i> <b>Empaque Estándar Oficial</b></div>
                <span class="r-badge-std">50 pzs</span>
              </div>
              <div class="r-form-group sop-focus-ring" data-callout="El Lote del día (YYYYMMDD) se asigna automáticamente sin teclear">
                <div class="r-label">NÚMERO DE LOTE / FECHA (AUTOMÁTICO)</div>
                <div class="r-input" style="background:#eff6ff; border-color:#93c5fd; font-weight:800; color:#1d4ed8;">20261111 (Lote Oficial de Hoy - Bloqueado contra edición manual)</div>
              </div>
              <div class="r-section-block r-block-origen">
                <div class="r-sec-title" style="color:#d97706;"><i class="fas fa-plane-departure"></i> ORIGEN DEL MATERIAL</div>
                <div class="r-label">ÁREA ORIGEN *</div>
                <div class="r-input" style="font-weight:700;">INYECCION MAQUINAS LS</div>
              </div>
            </div>
          </div>`;

      case 'WMS_ENT_3':
        return `
          <div class="real-ui-shot">
            <div class="r-main-card">
              <div class="r-section-block r-block-origen" style="margin-bottom:10px;">
                <div class="r-sec-title" style="color:#d97706;"><i class="fas fa-plane-departure"></i> ORIGEN DEL MATERIAL</div>
                <div class="r-label">ÁREA ORIGEN *</div>
                <div class="r-input" style="font-weight:700;">INYECCION MAQUINAS LS</div>
              </div>
              <div class="r-section-block r-block-destino sop-focus-ring" data-callout="Selecciona Área Destino, Ubicación Fija (Hilera) y Carrito Destino">
                <div class="r-sec-title" style="color:#22c55e;"><i class="fas fa-plane-arrival"></i> DESTINO DEL MATERIAL (A DÓNDE INGRESA)</div>
                <div class="r-form-group">
                  <div class="r-label">ÁREA DESTINO *</div>
                  <div class="r-input" style="font-weight:700;">ALMACEN PT (PRODUCTO TERMINADO)</div>
                </div>
                <div class="r-form-group">
                  <div class="r-label">📍 UBICACIÓN FIJA / HILERA DESTINO *</div>
                  <div class="r-input-btn">
                    <div class="r-input" style="font-weight:700;">RACK-A01 (Pasillo Principal PT)</div>
                    <div class="r-btn-qr"><i class="fas fa-camera"></i></div>
                  </div>
                </div>
                <div class="r-form-group" style="margin-bottom:0;">
                  <div class="r-label">🛒 CONTENEDOR / CARRITO DESTINO *</div>
                  <div class="r-input-btn">
                    <div class="r-input" style="font-weight:700; color:#d97706;">CARRO-014 (Contenedor Móvil Retornable)</div>
                    <div class="r-btn-qr"><i class="fas fa-camera"></i></div>
                  </div>
                </div>
              </div>
            </div>
          </div>`;

      case 'WMS_ENT_4':
        return `
          <div class="real-ui-shot">
            <div class="r-main-card">
              <div class="r-form-group sop-focus-ring" data-callout="Cantidad auto-cargada del Std Pack (activa ¿Es Parcial? si la caja va incompleta)">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span class="r-label" style="margin:0;">CANTIDAD DE PIEZAS *</span>
                  <span style="font-size:11px; font-weight:700; color:#f59e0b;">☐ ⚠️ ¿Es Parcial? (Caja/Carro incompleto)</span>
                </div>
                <div class="r-input" style="font-size:16px; font-weight:800;">50</div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:10px; margin-bottom:12px;">
                <div>
                  <div class="r-label">FOLIO ORDEN (OP / EMBARQUE)</div>
                  <div class="r-input">OP-2026-104</div>
                </div>
                <div>
                  <div class="r-label">COMENTARIO / MOTIVO *</div>
                  <div class="r-input">Producción Turno 1 - Máquina LS-04 OK</div>
                </div>
              </div>
              <div class="r-btn-action r-btn-entrada sop-focus-ring" data-callout="Presiona CONFIRMAR ENTRADA para grabar en el Kardex">
                <i class="fas fa-check-circle"></i> CONFIRMAR ENTRADA
              </div>
            </div>
          </div>`;

      // ---------------------------------------------------------------------
      // WMS OPERACIONES - SALIDAS FIFO (PASOS 1 Y 2)
      // ---------------------------------------------------------------------
      case 'WMS_SAL_1':
        return `
          <div class="real-ui-shot">
            <div class="r-tabs sop-focus-ring" data-callout="1. Cambia a la pestaña 2. SALIDA (FIFO)">
              <div class="r-tab"><i class="fas fa-arrow-right-to-bracket"></i><span>1. ENTRADA</span></div>
              <div class="r-tab active"><i class="fas fa-truck-ramp-box"></i><span>2. SALIDA (FIFO)</span></div>
              <div class="r-tab"><i class="fas fa-people-carry-box"></i><span>3. REUBICAR</span></div>
              <div class="r-tab"><i class="fas fa-scale-balanced"></i><span>4. AJUSTES</span></div>
              <div class="r-tab"><i class="fas fa-history"></i><span>5. REVERSAS</span></div>
            </div>
            <div class="r-main-card">
              <div class="r-form-group">
                <div class="r-label">NÚMERO DE PARTE *</div>
                <div class="r-input-btn">
                  <div class="r-input" style="font-weight:700;">84120-KRAEM-01 — PANEL FRONTAL INYECCION ABS</div>
                  <div class="r-btn-qr"><i class="fas fa-camera"></i></div>
                </div>
              </div>
              <div class="r-fifo-card sop-focus-ring" data-callout="2. El sistema auto-selecciona el lote DISPONIBLE más antiguo y bloquea lotes en Calidad">
                <div class="r-fifo-title"><i class="fas fa-star"></i> LOTES DISPONIBLES POR FIFO (SE AUTO-CARGA EL MÁS ANTIGUO)</div>
                <div class="r-fifo-item selected">
                  <div>
                    <b>Lote: 20261018</b> <span class="r-badge-fifo">🔥 1° FIFO (SACAR PRIMERO)</span><br>
                    <span style="font-size:11px; color:#475569;">📍 Ubicación: <b>RACK-A01</b> • 🛒 Carrito: <b>CARRO-014</b> • 🟢 DISPONIBLE</span>
                  </div>
                  <b style="font-size:14px; color:#15803d;">180 pzs</b>
                </div>
                <div class="r-fifo-item" style="opacity:0.6; background:#fef2f2; border-color:#fecaca;">
                  <div>
                    <b>Lote: 20261012</b> <span style="background:#dc2626; color:#fff; font-size:9.5px; padding:2px 6px; border-radius:4px; font-weight:800;">🔒 BLOQUEADO EN CALIDAD / CUARENTENA</span><br>
                    <span style="font-size:11px; color:#64748b;">📍 Ubicación: AREA-CALIDAD • No disponible para salida</span>
                  </div>
                  <b style="font-size:13px; color:#dc2626;">50 pzs</b>
                </div>
              </div>
            </div>
          </div>`;

      case 'WMS_SAL_2':
        return `
          <div class="real-ui-shot">
            <div class="r-main-card">
              <div class="r-section-block r-block-origen sop-focus-ring" data-callout="Ubicación Fija Origen y Carrito Origen se rellenan solos desde el lote FIFO">
                <div class="r-sec-title" style="color:#d97706;"><i class="fas fa-plane-departure"></i> ORIGEN DEL MATERIAL (DE DÓNDE SALE)</div>
                <div class="r-form-group">
                  <div class="r-label">ÁREA ORIGEN *</div>
                  <div class="r-input" style="font-weight:700;">ALMACEN PT</div>
                </div>
                <div class="r-form-group">
                  <div class="r-label">📍 UBICACIÓN FIJA ORIGEN</div>
                  <div class="r-input" style="background:rgba(245,158,11,0.1); font-weight:800;">RACK-A01</div>
                </div>
                <div class="r-form-group" style="margin-bottom:0;">
                  <div class="r-label">🛒 CONTENEDOR / CARRITO ORIGEN</div>
                  <div class="r-input" style="font-weight:800; color:#d97706;">CARRO-014</div>
                </div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:8px; margin-bottom:10px;">
                <div><div class="r-label">CANTIDAD *</div><div class="r-input" style="font-weight:800;">100</div></div>
                <div><div class="r-label">FOLIO ORDEN EMBARQUE</div><div class="r-input" style="font-weight:700;">OE-2026-089</div></div>
                <div><div class="r-label">COMENTARIO *</div><div class="r-input">Embarque Cliente Mobis</div></div>
              </div>
              <div class="r-btn-action r-btn-salida sop-focus-ring" data-callout="Presiona CONFIRMAR SALIDA FIFO para descontar el lote">
                <i class="fas fa-truck-ramp-box"></i> CONFIRMAR SALIDA FIFO
              </div>
            </div>
          </div>`;

      // ---------------------------------------------------------------------
      // WMS OPERACIONES - TRANSFERENCIA Y REVERSAS (PASOS C Y D)
      // ---------------------------------------------------------------------
      case 'WMS_TRA_1':
        return `
          <div class="real-ui-shot">
            <div class="r-tabs">
              <div class="r-tab"><i class="fas fa-arrow-right-to-bracket"></i><span>1. ENTRADA</span></div>
              <div class="r-tab"><i class="fas fa-truck-ramp-box"></i><span>2. SALIDA (FIFO)</span></div>
              <div class="r-tab active"><i class="fas fa-people-carry-box"></i><span>3. REUBICAR</span></div>
              <div class="r-tab"><i class="fas fa-scale-balanced"></i><span>4. AJUSTES</span></div>
              <div class="r-tab"><i class="fas fa-history"></i><span>5. REVERSAS</span></div>
            </div>
            <div class="r-main-card">
              <div class="r-switch-mode sop-focus-ring" data-callout="Elige si mueves Pieza Individual, un Carrito Completo o una Ubicación Completa">
                <span style="font-size:12px; font-weight:800; color:#8b5cf6;"><i class="fas fa-layer-group"></i> Modo de Transferencia:</span>
                <div class="r-input" style="width:auto; font-weight:800; background:#fff; padding:6px 12px;">🛒 Mover Carrito Completo (Todas sus piezas)</div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="r-section-block r-block-origen" style="margin-bottom:0;">
                  <div class="r-sec-title" style="color:#d97706;"><i class="fas fa-plane-departure"></i> ORIGEN ACTUAL</div>
                  <div class="r-label">🛒 CARRITO A MOVER</div>
                  <div class="r-input" style="font-weight:800; color:#d97706;">CARRO-014 (En INY-MAQ-04)</div>
                </div>
                <div class="r-section-block r-block-destino" style="margin-bottom:0;">
                  <div class="r-sec-title" style="color:#22c55e;"><i class="fas fa-plane-arrival"></i> NUEVO DESTINO</div>
                  <div class="r-label">📍 NUEVA UBICACIÓN FIJA DESTINO</div>
                  <div class="r-input" style="font-weight:800; color:#15803d;">ALMACEN PT ➔ RACK-B02</div>
                </div>
              </div>
              <div class="r-btn-action r-btn-transf">
                <i class="fas fa-people-carry-box"></i> CONFIRMAR REUBICACIÓN / TRANSFERENCIA
              </div>
            </div>
          </div>`;

      case 'WMS_REV_1':
        return `
          <div class="real-ui-shot">
            <div class="r-tabs">
              <div class="r-tab"><i class="fas fa-arrow-right-to-bracket"></i><span>1. ENTRADA</span></div>
              <div class="r-tab"><i class="fas fa-truck-ramp-box"></i><span>2. SALIDA (FIFO)</span></div>
              <div class="r-tab"><i class="fas fa-people-carry-box"></i><span>3. REUBICAR</span></div>
              <div class="r-tab"><i class="fas fa-scale-balanced"></i><span>4. AJUSTES</span></div>
              <div class="r-tab active"><i class="fas fa-history"></i><span>5. REVERSAS</span></div>
            </div>
            <div class="r-main-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <b style="font-size:14px;">📜 Movimientos Recientes y Reversas Blindadas</b>
                  <div style="font-size:11px; color:#64748b;">Si reversas una TRANSFERENCIA, el sistema reversa ambos lados (Origen y Destino) validando el stock disponible.</div>
                </div>
              </div>
              <table class="r-table sop-focus-ring" data-callout="Presiona el botón rojo Reversar en el movimiento que deseas cancelar">
                <thead>
                  <tr><th>Folio</th><th>Hora</th><th>Parte</th><th>Movimiento</th><th>Ubicación / Carro</th><th>Cant.</th><th>Lote</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>#4582</b></td><td>10:15</td><td><b>84120-KRAEM-01</b></td>
                    <td><span style="background:#ede9fe; color:#6d28d9; padding:2px 6px; border-radius:4px; font-weight:800;">TRANSFERENCIA</span></td>
                    <td>📍 RACK-A01 ➔ RACK-B02 [🛒 CARRO-014]</td><td style="font-weight:800;">50</td><td>20261111</td>
                    <td><span class="r-btn-rev"><i class="fas fa-undo"></i> Reversar</span></td>
                  </tr>
                  <tr style="opacity:0.65;">
                    <td><b>#4580</b></td><td>09:40</td><td><b>84120-KRAEM-01</b></td>
                    <td><span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-weight:800;">ENTRADA</span></td>
                    <td>📍 RACK-A01 [🛒 CARRO-014]</td><td style="font-weight:800;">+50</td><td>20261111</td>
                    <td><span class="r-badge-rev-done">REVERSADO</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`;

      // ---------------------------------------------------------------------
      // CONSULTA FIFO Y TORRE DE CONTROL (PASOS 1 Y 2)
      // ---------------------------------------------------------------------
      case 'FIFO_1':
        return `
          <div class="real-ui-shot">
            <div class="r-topbar">
              <div class="r-top-left">
                <div class="r-btn-back"><i class="fas fa-arrow-left"></i></div>
                <div>
                  <div class="r-h1">🔍 WMS Buscador QR, FIFO y Control de Stock</div>
                  <div class="r-sub">Ruta sugerida FIFO, rastreo de ubicaciones/carritos, cuarentenas y órdenes de embarque</div>
                </div>
              </div>
            </div>
            <div class="r-tabs">
              <div class="r-tab active"><i class="fas fa-barcode"></i><span>1. P/N RUTA FIFO</span></div>
              <div class="r-tab"><i class="fas fa-map-marker-alt"></i><span>2. UBICACIÓN FIJA</span></div>
              <div class="r-tab"><i class="fas fa-truck-loading"></i><span>3. CARRITO MÓVIL</span></div>
              <div class="r-tab"><i class="fas fa-layer-group"></i><span>4. INVENTARIO Y ESTATUS</span></div>
            </div>
            <div class="r-main-card">
              <div class="r-section-block" style="border-left:4px solid #2563eb;">
                <div class="r-sec-title" style="color:#2563eb;"><i class="fas fa-barcode"></i> BUSCADOR DE LOTE MÁS ANTIGUO (RUTA FIFO)</div>
                <div class="r-input-btn sop-focus-ring" data-callout="Escanea cualquier QR (Parte, Ubicación o Carrito) o escribe el N° de Parte">
                  <div class="r-input" style="font-weight:700;">84120-KRAEM-01</div>
                  <div class="r-btn-qr"><i class="fas fa-camera"></i></div>
                </div>
              </div>
              <div style="background:#f0fdf4; border:2px solid #22c55e; border-radius:12px; padding:12px;" class="sop-focus-ring" data-callout="La tarjeta verde te indica cuál es la Prioridad #1 (Sacar Primero)">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="background:#16a34a; color:#fff; padding:3px 10px; border-radius:6px; font-weight:900; font-size:11px;">🔥 PRIORIDAD #1 — SACAR PRIMERO (FIFO)</span>
                  <span style="font-weight:900; color:#15803d; font-size:15px;">180 PZAS</span>
                </div>
                <div style="margin-top:6px; font-size:12px;">
                  <b>Lote: 20261018</b> • 🏭 Área: <b>ALMACEN PT</b> • 📍 Ubicación Fija: <b>RACK-A01</b> • 🛒 Carrito: <b>CARRO-014</b>
                </div>
              </div>
            </div>
          </div>`;

      case 'FIFO_2':
        return `
          <div class="real-ui-shot">
            <div class="r-tabs">
              <div class="r-tab"><i class="fas fa-barcode"></i><span>1. P/N RUTA FIFO</span></div>
              <div class="r-tab"><i class="fas fa-map-marker-alt"></i><span>2. UBICACIÓN FIJA</span></div>
              <div class="r-tab"><i class="fas fa-truck-loading"></i><span>3. CARRITO MÓVIL</span></div>
              <div class="r-tab active"><i class="fas fa-layer-group"></i><span>4. INVENTARIO Y ESTATUS</span></div>
            </div>
            <div class="r-main-card">
              <div class="r-kpi-row sop-focus-ring" data-callout="Haz clic en cualquier tarjeta KPI para filtrar por Estatus (Disponible, Calidad, Retrabajo, Embarque)">
                <div class="r-kpi" style="border-left-color:#8b5cf6;"><span>📦 STOCK TOTAL</span><b>1,450</b></div>
                <div class="r-kpi" style="border-left-color:#22c55e;"><span>🟢 DISPONIBLE</span><b style="color:#16a34a;">1,100</b></div>
                <div class="r-kpi" style="border-left-color:#f59e0b;"><span>🟡 CUARENTENA</span><b style="color:#d97706;">150</b></div>
                <div class="r-kpi" style="border-left-color:#f97316;"><span>🟠 RETRABAJO</span><b style="color:#ea580c;">50</b></div>
                <div class="r-kpi" style="border-left-color:#2563eb;"><span>🔵 EMBARQUE</span><b style="color:#2563eb;">150</b></div>
              </div>
              <table class="r-table sop-focus-ring" data-callout="Usa el botón ⚙️ Estatus en cualquier fila para bloquear en Calidad o Asignar a Embarque">
                <thead>
                  <tr><th>N° Parte</th><th>Área / Ubicación</th><th>Carrito</th><th>Lote</th><th>Estatus Actual</th><th>Cant.</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>84120-KRAEM-01</b></td><td>ALMACEN PT • 📍 RACK-A01</td><td>🛒 CARRO-014</td><td><b>20261018</b></td>
                    <td><span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:10px; font-weight:800;">🟢 DISPONIBLE</span></td>
                    <td><b>180</b></td>
                    <td><span style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; padding:4px 8px; border-radius:6px; font-weight:800;">⚙️ Estatus</span></td>
                  </tr>
                  <tr>
                    <td><b>84120-KRAEM-01</b></td><td>CALIDAD • 📍 AREA-RET</td><td>📦 Suelto</td><td><b>20261012</b></td>
                    <td><span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:10px; font-weight:800;">🟡 CALIDAD / CUARENTENA</span></td>
                    <td><b>50</b></td>
                    <td><span style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; padding:4px 8px; border-radius:6px; font-weight:800;">⚙️ Estatus</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`;

      // ---------------------------------------------------------------------
      // CONTEOS CÍCLICOS E IRA % (PASOS 1 Y 2)
      // ---------------------------------------------------------------------
      case 'CC_1':
        return `
          <div class="real-ui-shot">
            <div class="r-kpi-row">
              <div class="r-kpi" style="border-left-color:#22c55e;"><span>🎯 VERACIDAD IRA %</span><b style="color:#16a34a;">98.6%</b></div>
              <div class="r-kpi" style="border-left-color:#ef4444;"><span>🔴 CONTAR HOY</span><b style="color:#dc2626;">12</b></div>
              <div class="r-kpi" style="border-left-color:#f59e0b;"><span>🅰️ CLASE A (30d)</span><b>25</b></div>
              <div class="r-kpi" style="border-left-color:#2563eb;"><span>🅱️ CLASE B (90d)</span><b>48</b></div>
              <div class="r-kpi" style="border-left-color:#8b5cf6;"><span>🅲 CLASE C (180d)</span><b>90</b></div>
            </div>
            <div class="r-tabs">
              <div class="r-tab active"><i class="fas fa-calendar-check"></i><span>1. CONTEO ABC DEL DÍA</span></div>
              <div class="r-tab"><i class="fas fa-qrcode"></i><span>2. BARRIDO POR UBICACIÓN / QR</span></div>
              <div class="r-tab"><i class="fas fa-file-pdf"></i><span>3. HOJA IMPRIMIBLE (CIEGA)</span></div>
              <div class="r-tab"><i class="fas fa-chart-line"></i><span>4. KPI VERACIDAD E HISTORIAL</span></div>
            </div>
            <div class="r-main-card">
              <table class="r-table sop-focus-ring" data-callout="PASO 1: El Stock Sistema aparece como 🔒 CIEGO mientras capturas el Conteo Físico">
                <thead>
                  <tr><th>Área</th><th>Ubicación Fija</th><th>Carrito Móvil</th><th>Lote FIFO</th><th>Stock Sistema</th><th>Conteo Físico</th><th>Diferencia</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>ALMACEN PT</b></td><td>📍 <b>RACK-A01</b></td><td><b style="color:#d97706;">🛒 CARRO-014</b></td><td><b>20261018</b></td>
                    <td><span style="background:#f1f5f9; color:#64748b; padding:3px 8px; border-radius:6px; font-weight:800;"><i class="fas fa-lock"></i> CIEGO</span></td>
                    <td><div class="r-input" style="width:90px; padding:5px 8px; font-weight:900; border:2px solid #2563eb;">180</div></td>
                    <td>---</td>
                  </tr>
                </tbody>
              </table>
              <div style="display:flex; gap:10px; margin-top:12px;" class="sop-focus-ring" data-callout="PASO 2: Presiona 1. Revelar Diferencias (Amarillo) y luego 2. Confirmar y Aplicar Ajustes (Verde)">
                <div class="r-btn-action" style="background:#f59e0b; color:#000; height:40px; margin-top:0; font-size:13px;">
                  <i class="fas fa-eye"></i> 1. Validar y Revelar Diferencias
                </div>
                <div class="r-btn-action" style="background:#22c55e; height:40px; margin-top:0; font-size:13px;">
                  <i class="fas fa-check-double"></i> 2. Confirmar y Aplicar Ajustes (IRA %)
                </div>
              </div>
            </div>
          </div>`;

      // ---------------------------------------------------------------------
      // HISTORIAL MB51
      // ---------------------------------------------------------------------
      case 'HIST_1':
        return `
          <div class="real-ui-shot">
            <div class="r-topbar">
              <div class="r-top-left">
                <div class="r-btn-back"><i class="fas fa-arrow-left"></i></div>
                <div>
                  <div class="r-h1">🕒 Historial Maestro de Movimientos <span style="background:#eff6ff; color:#2563eb; padding:2px 7px; border-radius:6px; font-size:12px;">MB51</span></div>
                  <div class="r-sub">Auditoría de Trazabilidad Completa: Entradas, Salidas FIFO, Transferencias, Ajustes y Reversas</div>
                </div>
              </div>
            </div>
            <div class="r-main-card">
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:10px;" class="sop-focus-ring" data-callout="Filtra por Fecha, N° Parte, Lote FIFO, Ubicación/Carro u Operador y exporta a Excel">
                <div><div class="r-label">N° PARTE / DESC.</div><div class="r-input">84120-KRAEM-01</div></div>
                <div><div class="r-label">LOTE (FIFO)</div><div class="r-input">20261018</div></div>
                <div><div class="r-label">UBICACIÓN / CARRO</div><div class="r-input">CARRO-014</div></div>
                <div><div class="r-label">TIPO MOVIMIENTO</div><div class="r-input">TODOS</div></div>
              </div>
              <table class="r-table">
                <thead>
                  <tr><th>Folio</th><th>Fecha y Hora</th><th>N° Parte</th><th>Lote</th><th>Origen</th><th>Destino</th><th>Cant.</th><th>Tipo Mov.</th><th>Operador</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>#4585</b></td><td>11/11/2026 10:20</td><td><b>84120-KRAEM-01</b></td><td><b>20261018</b></td>
                    <td>📍 RACK-A01 [🛒 CARRO-014]</td><td>EMBARQUE CLIENTE</td>
                    <td style="color:#dc2626; font-weight:900;">-100</td>
                    <td><span style="background:#ffedd5; color:#c2410c; padding:2px 6px; border-radius:4px; font-weight:800;">SALIDA</span></td>
                    <td><b>👤 ALMACEN01</b></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`;

      default:
        return `
          <div class="real-ui-shot">
            <div class="r-topbar">
              <div class="r-top-left">
                <img src="logo-kraem.jpg" style="height:36px; border-radius:6px;">
                <div>
                  <div class="r-h1">SISTEMA MRP / WMS KRAEM — CONTROL DOCUMENTAL ISO 9001</div>
                  <div class="r-sub">Lista Maestra KR-SGC-LM-0001 y Manuales Operativos con Capturas Reales del Sistema</div>
                </div>
              </div>
            </div>
          </div>`;
    }
  }

  // Renderiza el HTML real en un contenedor oculto y lo convierte en imagen PNG real usando html2canvas
  const cacheCapturasPNG = {};
  async function obtenerCapturaRealPNG(sceneId) {
    if (cacheCapturasPNG[sceneId]) return cacheCapturasPNG[sceneId];
    const h2c = await asegurarHtml2Canvas();
    if (!h2c) return null;

    let stage = document.getElementById('kraem-hidden-shot-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'kraem-hidden-shot-stage';
      stage.style.cssText = 'position:fixed; left:-9999px; top:0; width:820px; z-index:-1; background:#f8fafc; padding:10px;';
      document.body.appendChild(stage);
    }

    stage.innerHTML = construirHTMLRealDelPaso(sceneId);
    const target = stage.firstElementChild;
    try {
      const canvas = await h2c(target, {
        scale: 1.6,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      cacheCapturasPNG[sceneId] = dataUrl;
      return dataUrl;
    } catch (e) {
      return null;
    }
  }

  // =========================================================================
  // CATÁLOGO DE MANUALES CON REFERENCIA A LAS VISTAS REALES DEL SISTEMA
  // =========================================================================
  const MANUALES_SOP = {
    'wms_operaciones.html': {
      id: 'wms_operaciones.html',
      icono: '⚡',
      nombreCorto: 'Terminal Operativa WMS',
      codigo: 'KR-IT-WMS-0001',
      reportesAsociados: ['KR-SYS-WMS-0003'],
      rev: 'REV 01',
      clausula: 'ISO 9001:2015 Clausula 8.5.1 y 8.5.2 (Control de Produccion y Trazabilidad FIFO)',
      puesto: 'Operadores de Almacen, Montacarguistas, Lideres de Inyeccion y Embarques',
      titulo: 'Instruccion de Trabajo Oficial: Terminal Operativa WMS (Entradas, Salidas FIFO, Reubicaciones, Ajustes y Reversas)',
      objetivo: 'Establecer el metodo estandar paso a paso con capturas reales del sistema para ejecutar Entradas de produccion, Salidas por lote FIFO, Reubicaciones de piezas o carritos completos, Ajustes y Reversas blindadas.',
      anatomia: [
        {
          nombre: '1. Barra de Sesion y 5 Pestanas de Operacion',
          sirvePara: 'Muestra el usuario logueado (OPERADOR ACTIVO) y permite elegir entre: 1. ENTRADA, 2. SALIDA (FIFO), 3. REUBICAR, 4. AJUSTES y 5. REVERSAS.',
          comoSeUsa: 'Confirma que tu usuario este activo en verde antes de capturar cualquier movimiento.'
        },
        {
          nombre: '2. Buscador de Numero de Parte, Banner Std Pack y Lote Automatico',
          sirvePara: 'Identifica la pieza mediante texto o camara QR, muestra su Empaque Estandar Oficial (Std Pack) y asigna el Lote sin intervencion manual.',
          comoSeUsa: 'En 1. ENTRADA asigna el lote de hoy (YYYYMMDD); en 2. SALIDA selecciona automaticamente el lote DISPONIBLE mas antiguo.'
        },
        {
          nombre: '3. Bloques de ORIGEN (Amarillo) y DESTINO (Verde)',
          sirvePara: 'Separar visualmente de donde sale el material (Area Origen, Ubicacion Fija Origen, Carrito Origen) y hacia donde ingresa (Area Destino, Ubicacion Fija Destino, Carrito Destino).',
          comoSeUsa: 'En SALIDA el bloque Origen se autorrellena con la ubicacion del lote FIFO mas viejo.'
        },
        {
          nombre: '4. Cantidad, Switch ¿Es Parcial?, Folio Orden y Confirmacion',
          sirvePara: 'Registrar el total de piezas movidas, marcar si una caja va incompleta respecto al Std Pack y asociar la Orden de Produccion o Embarque.',
          comoSeUsa: 'Presiona el boton inferior de confirmacion para grabar el movimiento en tiempo real.'
        }
      ],
      procesos: [
        {
          subtitulo: 'PROCESO 1: ENTRADA DE MATERIAL AL SISTEMA (PESTANA "1. ENTRADA")',
          color: '#2563eb',
          descripcionProceso: 'Registro de piezas provenientes de Inyeccion o Recepcion hacia una Ubicacion Fija y Carrito.',
          pasos: [
            {
              num: 1,
              sceneId: 'WMS_ENT_1',
              titulo: 'Seleccionar Pestana "1. ENTRADA" y Escanear Numero de Parte',
              queEs: 'Activa el formulario de ingreso de material y carga el Empaque Estandar Oficial (Std Pack) de la pieza.',
              explicacion: '1) Verifica que la pestana "1. ENTRADA" este seleccionada en azul.\n2) En el campo "Numero de Parte *", escribe el codigo o presiona el boton azul de camara para escanear la etiqueta QR.\n3) Al elegir la pieza, aparece automaticamente el recuadro "Empaque Estandar Oficial" (ej. 50 pzs).',
              reglaOro: 'El sistema precarga automaticamente la cantidad del Empaque Estandar Oficial para agilizar la captura.'
            },
            {
              num: 2,
              sceneId: 'WMS_ENT_2',
              titulo: 'Verificacion del Lote Automatico del Dia y Area Origen',
              queEs: 'El campo "Numero de Lote / Fecha (Automatico)" se bloquea con la fecha actual (YYYYMMDD).',
              explicacion: '1) Observa que el campo "Numero de Lote / Fecha (Automatico)" ya contiene el lote del dia de hoy (ej. 20261111). El operador no debe ni puede alterarlo manualmente.\n2) En el bloque amarillo "ORIGEN DEL MATERIAL", selecciona el Area Origen de donde proviene la pieza (ej. INYECCION MAQUINAS LS).',
              reglaOro: 'Al generar el lote automaticamente con la fecha del dia, se garantiza que el orden FIFO sea 100% exacto.'
            },
            {
              num: 3,
              sceneId: 'WMS_ENT_3',
              titulo: 'Capturar el Bloque Verde "DESTINO DEL MATERIAL" (Area, Ubicacion Fija y Carrito)',
              queEs: 'Indica en que Area, Hilera/Rack fijo y Contenedor/Carrito movil quedara resguardado el material.',
              explicacion: 'Dentro del bloque verde "DESTINO DEL MATERIAL (A donde ingresa)":\n1) Selecciona el "Area Destino *" (ej. ALMACEN PT).\n2) En "Ubicacion Fija / Hilera DESTINO *", escribe o escanea con el boton QR el rack o hilera (ej. RACK-A01).\n3) En "Contenedor / Carrito DESTINO *", escribe o escanea el codigo del carrito retornable (ej. CARRO-014).',
              reglaOro: 'Puedes usar el boton de camara QR al lado de cada campo para escanear directamente la etiqueta pegada en el rack y en el carrito.'
            },
            {
              num: 4,
              sceneId: 'WMS_ENT_4',
              titulo: 'Confirmar Cantidad, Folio de Orden y Presionar "CONFIRMAR ENTRADA"',
              queEs: 'Valida la cantidad de piezas ingresadas (completa o parcial) y guarda la transaccion.',
              explicacion: '1) Verifica el campo "Cantidad de Piezas *". Si ingresas una caja incompleta menor al Std Pack, marca la casilla "¿Es Parcial? (Caja/Carro incompleto)".\n2) Opcionalmente anota el "Folio Orden (OP / Embarque)" y un "Comentario / Motivo *".\n3) Presiona el boton verde "CONFIRMAR ENTRADA".',
              reglaOro: 'Toda caja marcada con "¿Es Parcial?" queda identificada en el Kardex para que en el proximo embarque sea la primera en completarse o surtirse.'
            }
          ]
        },
        {
          subtitulo: 'PROCESO 2: SALIDAS DEL SISTEMA POR FIFO AUTOMATICO (PESTANA "2. SALIDA (FIFO)")',
          color: '#d97706',
          descripcionProceso: 'Descuento de inventario para embarque o consumo, obligando a surtir el lote disponible mas antiguo.',
          pasos: [
            {
              num: 1,
              sceneId: 'WMS_SAL_1',
              titulo: 'Seleccionar "2. SALIDA (FIFO)" y Revisar Tarjeta de Lotes Disponibles por FIFO',
              queEs: 'Al elegir el Numero de Parte, el sistema despliega la tarjeta amarilla con los lotes ordenados por antiguedad y bloquea lotes en Calidad.',
              explicacion: '1) Haz clic en la pestana "2. SALIDA (FIFO)" y escanea o escribe el Numero de Parte.\n2) Se abrira automaticamente la tarjeta "Lotes Disponibles por FIFO", marcando en verde con "1° FIFO (SACAR PRIMERO)" el lote mas antiguo que este DISPONIBLE.\n3) Si existe un lote detenido en CALIDAD / CUARENTENA o EN RETRABAJO, el sistema lo bloquea automaticamente para impedir su salida.',
              reglaOro: 'Nunca se puede dar salida por error a un lote retenido por Calidad, cumpliendo la Clausula 8.7 de ISO 9001 (Control de Salidas No Conformes).'
            },
            {
              num: 2,
              sceneId: 'WMS_SAL_2',
              titulo: 'Verificar Origen Auto-Cargado, Capturar Cantidad / Orden de Embarque y Confirmar',
              queEs: 'El bloque amarillo "ORIGEN DEL MATERIAL" se llena solo con la Ubicacion Fija y Carrito del lote 1° FIFO.',
              explicacion: '1) Confirma en el bloque amarillo la Ubicacion Fija Origen (ej. RACK-A01) y el Carrito Origen (ej. CARRO-014) que el sistema cargo automaticamente.\n2) Escribe la "Cantidad de Piezas *" a surtir, el "Folio Orden (OP / Embarque)" (ej. OE-2026-089) y el comentario.\n3) Presiona el boton amarillo "CONFIRMAR SALIDA FIFO".',
              reglaOro: 'Si intentas dar salida a mas piezas de las que tiene ese lote en esa ubicacion, el sistema detendra la operacion antes de guardar.'
            }
          ]
        },
        {
          subtitulo: 'PROCESO 3: REUBICACIONES Y TRANSFERENCIAS (PESTANA "3. REUBICAR")',
          color: '#7c3aed',
          descripcionProceso: 'Cambio de ubicacion de piezas individuales, de un carrito movil completo o de una ubicacion completa.',
          pasos: [
            {
              num: 1,
              sceneId: 'WMS_TRA_1',
              titulo: 'Elegir el Modo de Transferencia (Pieza Individual, Carrito Completo o Ubicacion)',
              queEs: 'En la pestana "3. REUBICAR" aparece el selector morado "Modo de Transferencia".',
              explicacion: '1) Haz clic en la pestana "3. REUBICAR".\n2) En el selector morado elige una de las 3 opciones reales de la pantalla:\n   - "Pieza Individual (Normal)": Mueve una cantidad especifica conservando su lote original.\n   - "Mover Carrito Completo (Todas sus piezas)": Solo escaneas el carrito y la nueva Ubicacion Fija Destino; todo el contenido del carrito cambia de rack en un solo movimiento.\n   - "Mover Ubicacion Fija Completa": Muda todo el stock de una hilera a otra.',
              reglaOro: 'Al mover un Carrito Completo, todos los lotes que van dentro del carrito conservan intacta su fecha FIFO.'
            }
          ]
        },
        {
          subtitulo: 'PROCESO 4: REVERSAS BLINDADAS ANTI-NEGATIVOS (PESTANA "5. REVERSAS")',
          color: '#dc2626',
          descripcionProceso: 'Cancelacion auditable de movimientos capturados por error sin descuadrar ni hacer bolsas el inventario.',
          pasos: [
            {
              num: 1,
              sceneId: 'WMS_REV_1',
              titulo: 'Localizar el Folio en la Tabla de Reversas y Autorizar con Candado de Auditoria',
              queEs: 'Permite anular una transaccion reciente verificando primero que el stock siga disponible en la ubicacion.',
              explicacion: '1) Entra a la pestana "5. REVERSAS". Veras la tabla "Movimientos Recientes y Reversas Blindadas".\n2) Ubica el Folio (#ID) que deseas cancelar y presiona el boton rojo "Reversar".\n3) Se abrira la ventana "Autorizacion de Reversa Oficial": selecciona el "Motivo Oficial de Auditoria (Candado 3) *" y escribe la explicacion.\n4) Si el material ya fue transferido posteriormente de A -> B, el sistema te pedira reversar primero la Transferencia (B -> A) y luego la Entrada, evitando saldos negativos.',
              reglaOro: 'Cuando reversas una TRANSFERENCIA, el sistema reversa automaticamente ambos lados (Origen y Destino) para que el inventario jamas se descuadre.'
            }
          ]
        }
      ]
    },

    'consulta_fifo.html': {
      id: 'consulta_fifo.html',
      icono: '⏱️',
      nombreCorto: 'Buscador QR, FIFO & Torre de Control',
      codigo: 'KR-IT-WMS-0002',
      reportesAsociados: ['KR-SYS-WMS-0001', 'KR-SYS-WMS-0002'],
      rev: 'REV 01',
      clausula: 'ISO 9001:2015 Clausula 8.5.2 (Identificacion y Trazabilidad) y 8.7 (Salidas No Conformes)',
      puesto: 'Inspectores de Calidad, Supervisores WMS, Logistica y Embarques',
      titulo: 'Instruccion de Trabajo Oficial: Buscador QR, Ruta FIFO y Torre de Control de Stock',
      objetivo: 'Mostrar con capturas reales del sistema como consultar la Prioridad #1 de salida FIFO por Numero de Parte, rastrear Ubicaciones Fijas o Carritos Moviles, y administrar los 4 estatus de stock (Disponible, Cuarentena/Calidad, Retrabajo y Asignado a Embarque).',
      anatomia: [
        {
          nombre: '1. Pestanas 1, 2 y 3 (Escaneo QR por Parte, Ubicacion Fija o Carrito Movil)',
          sirvePara: 'Rastrear en segundos donde estan los lotes de una pieza, que hay dentro de un rack fijo o que lleva cargado un carrito.',
          comoSeUsa: 'Usa el boton de camara QR: el sistema detecta automaticamente que tipo de etiqueta escaneaste.'
        },
        {
          nombre: '2. Pestana 4: INVENTARIO Y ESTATUS (Torre de Control Unificada)',
          sirvePara: 'Concentra el Inventario General y por Ubicacion con 5 tarjetas KPI de estatus y boton de cambio de estatus por lote.',
          comoSeUsa: 'Haz clic en las tarjetas KPI superiores para filtrar o presiona "Estatus" en cualquier fila para poner en Cuarentena/Retrabajo/Embarque.'
        }
      ],
      procesos: [
        {
          subtitulo: 'PROCESO 1: CONSULTA DE RUTA FIFO Y PRIORIDAD #1 DE SALIDA (PESTANA 1)',
          color: '#2563eb',
          descripcionProceso: 'Como saber exactamente que lote, de que rack y de que carrito se debe surtir primero.',
          pasos: [
            {
              num: 1,
              sceneId: 'FIFO_1',
              titulo: 'Escanear o Escribir Numero de Parte y Localizar la Tarjeta Verde "PRIORIDAD #1"',
              queEs: 'Calcula la ruta FIFO real de la pieza en toda la planta.',
              explicacion: '1) En la pestana "1. P/N RUTA FIFO", escribe o escanea el Numero de Parte.\n2) El sistema muestra en la parte superior una tarjeta verde destacada con la leyenda "PRIORIDAD #1 - SACAR PRIMERO (FIFO)", indicando Lote, Area, Ubicacion Fija, Carrito y Cantidad.',
              reglaOro: 'Los lotes en Cuarentena/Calidad o Retrabajo nunca aparecen como Prioridad #1 de salida.'
            }
          ]
        },
        {
          subtitulo: 'PROCESO 2: TORRE DE CONTROL DE INVENTARIO Y CAMBIO DE ESTATUS (PESTANA 4)',
          color: '#d97706',
          descripcionProceso: 'Como filtrar el stock de toda la planta y bloquear o liberar lotes por Calidad, Retrabajo o Embarque.',
          pasos: [
            {
              num: 1,
              sceneId: 'FIFO_2',
              titulo: 'Filtrar con las 5 Tarjetas KPI y Cambiar Estatus con el Boton "⚙️ Estatus"',
              queEs: 'Permite controlar en vivo que material esta Habil/Disponible, En Cuarentena/Calidad, En Retrabajo o Asignado a Embarque.',
              explicacion: '1) Entra a la pestana "4. INVENTARIO Y ESTATUS".\n2) Toca cualquiera de las 5 tarjetas KPI superiores para filtrar la tabla instantaneamente, o alterna entre "Detalle por Ubicacion / Lote" y "Consolidado por N/P y Area".\n3) Para retener un lote en Cuarentena, mandarlo a Retrabajo o asignarle una Orden de Embarque, presiona el boton "⚙️ Estatus" en su fila y guarda.',
              reglaOro: 'Puedes exportar cualquier vista filtrada a Excel controlado (KR-SYS-WMS-0002) con el boton verde "Exportar Excel".'
            }
          ]
        }
      ]
    },

    'conteos_menu.html': {
      id: 'conteos_menu.html',
      icono: '🔄',
      nombreCorto: 'Conteos Ciclicos & Auditoria IRA',
      codigo: 'KR-IT-WMS-0003',
      reportesAsociados: ['KR-SYS-CC-0001', 'KR-SYS-CC-0002'],
      rev: 'REV 01',
      clausula: 'ISO 9001:2015 Clausula 8.5.4 (Preservacion) y 9.1.1 (Veracidad de Inventario IRA %)',
      puesto: 'Auditores de Inventario, Supervisores WMS, Contraloria y Calidad',
      titulo: 'Instruccion de Trabajo Oficial: Estacion de Conteos Ciclicos ABC, Conteo Ciego y KPI IRA %',
      objetivo: 'Mostrar con capturas reales del sistema como ejecutar el Conteo Ciego en 2 pasos (ocultando primero el stock del sistema y revelando diferencias despues), como aplicar ajustes respetando el lote FIFO y como imprimir la Hoja Ciega PDF controlada (KR-SYS-CC-0001).',
      anatomia: [
        {
          nombre: '1. Cinco Tarjetas KPI Superiores (Veracidad IRA %, Vencidos, Clase A, B y C)',
          sirvePara: 'Muestran la exactitud actual del inventario (IRA %) y cuantas partes requieren conteo hoy segun su ciclo ABC (30, 90 y 180 dias).',
          comoSeUsa: 'Haz clic en "VENCIDOS / CONTAR HOY" para ver la lista prioritaria del dia.'
        },
        {
          nombre: '2. Cuatro Pestanas Operativas (Conteo ABC, Barrido QR, Hoja PDF Ciega e Historial IRA)',
          sirvePara: 'Ejecutar conteos por Numero de Parte (Pestana 1), por Rack/Carrito/Area completa (Pestana 2), imprimir formato en papel (Pestana 3) o auditar el historial IRA % (Pestana 4).',
          comoSeUsa: 'En todas las modalidades el conteo opera bajo la regla de Conteo Ciego en 2 pasos.'
        }
      ],
      procesos: [
        {
          subtitulo: 'PROCESO UNICO: EJECUCION DE CONTEO CIEGO EN 2 PASOS Y AJUSTE AUTOMATICO FIFO',
          color: '#4f46e5',
          descripcionProceso: 'Captura fisica a ciegas, validacion de diferencias y actualizacion automatica de inventario e IRA %.',
          pasos: [
            {
              num: 1,
              sceneId: 'CC_1',
              titulo: 'Capturar Conteo Fisico con Sistema Oculto ("🔒 CIEGO"), Revelar Diferencias y Aplicar Ajustes',
              queEs: 'Impide que el auditor copie el stock del sistema, garantizando un conteo fisico real por Ubicacion + Carrito + Lote.',
              explicacion: '1) PASO 1 (CIEGO): Al abrir el conteo de una parte o ubicacion, la columna "Stock Sistema" muestra el candado "🔒 CIEGO". Cuenta las piezas fisicas y escribelas en la columna "Conteo Fisico" (escribe 0 si no hay piezas).\n2) PASO 2 (REVELAR): Presiona el boton amarillo "1. Validar y Revelar Diferencias". Se destapara el Stock Sistema y veras si salio Exacto (0), Sobra (+) o Falta (-).\n3) PASO 3 (GUARDAR): Presiona el boton verde "2. Confirmar y Aplicar Ajustes" para ajustar el lote y registrar el resultado en el KPI de Veracidad IRA %.',
              reglaOro: 'En la Pestana 3 puedes descargar la Hoja Imprimible PDF Ciega con el logo de KRAEM, firmas y codigo controlado KR-SYS-CC-0001.'
            }
          ]
        }
      ]
    },

    'historial.html': {
      id: 'historial.html',
      icono: '🕒',
      nombreCorto: 'Historial de Movimientos (Kardex MB51)',
      codigo: 'KR-IT-WMS-0004',
      reportesAsociados: ['KR-SYS-WMS-0003'],
      rev: 'REV 01',
      clausula: 'ISO 9001:2015 Clausula 8.5.2 (Trazabilidad de Transacciones) y 7.5.3 (Control de Registros)',
      puesto: 'Auditores Internos/Externos, Supervisores WMS, Planeacion y Calidad',
      titulo: 'Instruccion de Trabajo Oficial: Historial Maestro de Movimientos (Kardex MB51)',
      objetivo: 'Mostrar con la interfaz real del Kardex MB51 como auditar cualquier transaccion historica por Fecha, Numero de Parte, Lote FIFO, Ubicacion/Carrito u Operador, y exportar el reporte controlado KR-SYS-WMS-0003.',
      anatomia: [
        {
          nombre: '1. Tarjetas KPI Interactivas y Botones de Periodo Rapido',
          sirvePara: 'Filtrar en un solo clic por Entradas, Salidas, Transferencias o Reversas, y por Hoy, Ultimos 7 Dias, Este Mes o Todo el Historial.',
          comoSeUsa: 'Haz clic sobre cualquier tarjeta o boton de periodo para acotar la tabla.'
        },
        {
          nombre: '2. Panel de 9 Filtros Multicriterio y Exportacion CSV (KR-SYS-WMS-0003)',
          sirvePara: 'Rastrear la trazabilidad completa de un lote o carrito desde su entrada hasta su embarque.',
          comoSeUsa: 'Escribe el Lote o Carrito y presiona el boton verde "Exportar Excel (CSV)".'
        }
      ],
      procesos: [
        {
          subtitulo: 'PROCESO UNICO: RASTREO DE TRAZABILIDAD Y AUDITORIA DE TRANSACCIONES',
          color: '#2563eb',
          descripcionProceso: 'Consulta de movimientos y exportacion oficial para auditorias ISO.',
          pasos: [
            {
              num: 1,
              sceneId: 'HIST_1',
              titulo: 'Aplicar Filtros Multicriterio y Exportar el Kardex Controlado',
              queEs: 'Filtra en tiempo real todas las columnas del Kardex mostrando Folio (#ID), Fecha/Hora, Lote, Origen, Destino y Operador.',
              explicacion: '1) Selecciona el periodo deseado y escribe en cualquiera de los 9 filtros (ej. Numero de Parte, Lote FIFO o Carrito).\n2) Revisa en la tabla el detalle de ubicaciones fijas (📍) y carritos moviles (🛒) de origen y destino.\n3) Presiona el boton verde "Exportar Excel (CSV)" para obtener el archivo con codigo de control documental KR-SYS-WMS-0003.',
              reglaOro: 'Los movimientos anulados permanecen visibles con la etiqueta "REVERSADO" para mantener la trazabilidad intacta.'
            }
          ]
        }
      ]
    },

    'control_documental_iso.html': {
      id: 'control_documental_iso.html',
      icono: '🛡️',
      nombreCorto: 'Lista Maestra ISO 9001 (SGC)',
      codigo: 'KR-IT-SGC-0001',
      reportesAsociados: ['KR-SGC-LM-0001'],
      rev: 'REV 01',
      clausula: 'ISO 9001:2015 Clausula 7.5 (Informacion Documentada)',
      puesto: 'Aseguramiento de Calidad (SGC), Representante de la Direccion y Auditores',
      titulo: 'Instruccion de Trabajo Oficial: Lista Maestra de Control Documental ISO 9001 / IATF 16949',
      objetivo: 'Administrar y presentar ante auditorias la Lista Maestra (KR-SGC-LM-0001) que avala todos los reportes controlados (KR-SYS) y todas las instrucciones de trabajo (KR-IT) del sistema KRAEM.',
      anatomia: [
        {
          nombre: '1. Emision de Acta Oficial PDF Firmada (KR-SGC-LM-0001)',
          sirvePara: 'Imprimir la Lista Maestra oficial con el logo de KRAEM y los 3 bloques de firma de autorizacion.',
          comoSeUsa: 'Haz clic en el boton rojo "Imprimir Acta / Lista Maestra PDF (Firmas ISO)".'
        },
        {
          nombre: '2. Biblioteca de Manuales Didacticos Integrada',
          sirvePara: 'Abrir o descargar en PDF cualquier manual operativo sin salir de la pantalla de Control Documental.',
          comoSeUsa: 'Haz clic en "Ver Manual Aqui" en cualquiera de las tarjetas superiores.'
        }
      ],
      procesos: [
        {
          subtitulo: 'PROCESO UNICO: CONTROL Y CONSULTA DE DOCUMENTOS SGC',
          color: '#2563eb',
          descripcionProceso: 'Acceso centralizado a todos los manuales y formatos vigentes.',
          pasos: [
            {
              num: 1,
              sceneId: 'DEFAULT',
              titulo: 'Consultar Manuales o Emitir el Acta Maestra KR-SGC-LM-0001',
              queEs: 'Respalda ante el auditor que todo reporte impreso o exportado tiene un codigo vigente y controlado.',
              explicacion: 'Usa la barra superior de este visor o las tarjetas de la Biblioteca de Manuales para abrir o imprimir en PDF las instrucciones de trabajo con capturas reales del sistema.',
              reglaOro: 'Verifica que el codigo a pie de pagina de cada reporte coincida con la revision vigente en la Lista Maestra KR-SGC-LM-0001.'
            }
          ]
        }
      ]
    },

    'dashboard.html': {
      id: 'dashboard.html',
      icono: '🏠',
      nombreCorto: 'Dashboard Principal MRP',
      codigo: 'KR-IT-SYS-0000',
      reportesAsociados: ['KR-SGC-LM-0001'],
      rev: 'REV 01',
      clausula: 'ISO 9001:2015 Clausula 4.4 (Sistema de Gestion de Calidad y sus Procesos)',
      puesto: 'Todo el Personal Autorizado de Planta KRAEM',
      titulo: 'Instruccion de Trabajo Oficial: Panel de Control Principal (Dashboard MRP / WMS KRAEM)',
      objetivo: 'Guiar al usuario por las estaciones centralizadas del sistema MRP/WMS y el acceso rapido a las Instrucciones de Trabajo.',
      anatomia: [
        {
          nombre: '1. Seccion WMS (Inventarios) Unificada',
          sirvePara: 'Reune las 4 estaciones maestras: Terminal Operativa WMS, Buscador QR/FIFO & Torre de Control, Historial de Movimientos y Conteos Ciclicos.',
          comoSeUsa: 'Haz clic en cualquiera de las 4 tarjetas para abrir el modulo.'
        }
      ],
      procesos: [
        {
          subtitulo: 'NAVEGACION GENERAL Y CONSULTA DE MANUALES',
          color: '#2563eb',
          descripcionProceso: 'Acceso a todos los manuales desde la barra superior.',
          pasos: [
            {
              num: 1,
              sceneId: 'WMS_ENT_1',
              titulo: 'Seleccionar Cualquier Modulo en la Barra Superior de Este Visor',
              queEs: 'Te permite capacitarte en cualquier modulo viendo sus capturas reales sin cambiar de ventana.',
              explicacion: 'Haz clic en las pestanas superiores de esta ventana (Terminal Operativa WMS, Buscador QR/FIFO, Conteos Ciclicos, Historial MB51) para ver su manual paso a paso o descargar su PDF.',
              reglaOro: 'Tambien puedes usar el boton verde "Capturar Mi Pantalla Actual en Vivo" para tomar una fotografia real de la pantalla en la que estes trabajando.'
            }
          ]
        }
      ]
    }
  };

  const ORDEN_MODULOS = [
    'wms_operaciones.html',
    'consulta_fifo.html',
    'conteos_menu.html',
    'historial.html',
    'control_documental_iso.html',
    'dashboard.html'
  ];

  function obtenerArchivoActual() {
    const path = window.location.pathname || '';
    const file = path.split('/').pop() || 'dashboard.html';
    return MANUALES_SOP[file] ? file : 'dashboard.html';
  }

  function inyectarEstilosSOP() {
    if (document.getElementById('kraem-sop-styles')) return;
    const style = document.createElement('style');
    style.id = 'kraem-sop-styles';
    style.innerHTML = `
      .btn-sop-help {
        background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
        color: #ffffff !important;
        border: none !important;
        padding: 8px 14px !important;
        border-radius: 8px !important;
        font-weight: 800 !important;
        font-size: 0.82rem !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28) !important;
        transition: transform 0.15s, box-shadow 0.15s !important;
      }
      .btn-sop-help:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4) !important;
      }
      .sop-modal-overlay {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78);
        display: none; justify-content: center; align-items: center;
        z-index: 99999; padding: 14px; backdrop-filter: blur(4px);
      }
      .sop-modal-card {
        background: var(--card, #ffffff); color: var(--text, #0f172a);
        width: 100%; max-width: 1100px; max-height: 92vh; overflow-y: auto;
        border-radius: 16px; border: 1px solid var(--border, #e2e8f0);
        padding: 22px; box-shadow: 0 25px 60px rgba(0,0,0,0.45);
      }
      .sop-module-switcher {
        display: flex; gap: 6px; flex-wrap: wrap;
        background: rgba(100,116,139,0.08); padding: 8px;
        border-radius: 10px; margin-bottom: 16px; border: 1px solid var(--border, #e2e8f0);
      }
      .sop-mod-btn {
        border: 1px solid transparent; background: var(--card, #ffffff);
        color: var(--text-secondary, #64748b); padding: 8px 12px;
        border-radius: 8px; font-size: 11.5px; font-weight: 800;
        cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      }
      .sop-mod-btn.active { background: #2563eb; color: #ffffff; }
      .sop-header-banner {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: 12px; border-bottom: 2px solid var(--border, #e2e8f0);
        padding-bottom: 14px; margin-bottom: 16px; flex-wrap: wrap;
      }
      .sop-meta-strip {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px; background: rgba(37, 99, 235, 0.05);
        border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 10px;
        padding: 12px 14px; margin-bottom: 16px; font-size: 12px;
      }
      .sop-sec-heading {
        font-size: 13px; font-weight: 900; text-transform: uppercase;
        color: #ffffff; background: #1e3a8a;
        padding: 10px 14px; border-radius: 8px; margin: 20px 0 12px;
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
      }
      .sop-anatomy-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 10px; margin-bottom: 16px;
      }
      .sop-anatomy-card {
        border: 1px solid var(--border, #e2e8f0); border-radius: 10px;
        padding: 12px; background: var(--card, #ffffff);
      }
      .sop-anatomy-title { font-size: 12.5px; font-weight: 900; color: #2563eb; margin-bottom: 6px; }
      .sop-anatomy-purpose { font-size: 12px; color: var(--text, #334155); line-height: 1.45; margin-bottom: 6px; }
      .sop-anatomy-how {
        font-size: 11.5px; color: #15803d; background: rgba(22, 163, 74, 0.08);
        padding: 6px 9px; border-radius: 6px; font-weight: 700;
      }
      .sop-step-card {
        border: 1px solid var(--border, #e2e8f0); border-radius: 12px;
        padding: 16px; margin-bottom: 18px; background: var(--card, #ffffff);
        box-shadow: 0 3px 10px rgba(0,0,0,0.03);
      }
      .sop-step-title {
        display: flex; align-items: center; gap: 10px; font-size: 14.5px;
        font-weight: 900; color: #1e40af; margin-bottom: 8px;
      }
      .sop-step-num {
        background: #2563eb; color: #fff; padding: 4px 10px;
        border-radius: 20px; font-size: 11.5px; font-weight: 900; flex-shrink: 0;
      }
      .sop-step-what {
        font-size: 12.5px; font-weight: 800; color: #0f172a;
        background: #f1f5f9; padding: 7px 11px; border-radius: 6px; margin-bottom: 8px;
      }
      .sop-step-desc { font-size: 13px; line-height: 1.6; margin-bottom: 12px; white-space: pre-line; }
      .sop-step-alert {
        background: rgba(245, 158, 11, 0.12); border-left: 4px solid #d97706;
        padding: 9px 12px; border-radius: 6px; font-size: 12px; font-weight: 700;
        color: #b45309; margin-top: 12px;
      }

      /* ===================================================================== */
      /* RÉPLICA EXACTA 1:1 DE LA INTERFAZ REAL DEL SISTEMA PARA LAS CAPTURAS  */
      /* ===================================================================== */
      .real-ui-shot {
        background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 14px;
        padding: 14px; color: #0f172a; font-family: 'Segoe UI', system-ui, sans-serif;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); margin: 10px 0;
      }
      .r-topbar {
        display: flex; justify-content: space-between; align-items: center;
        background: #ffffff; padding: 10px 16px; border-radius: 12px;
        border: 1px solid #e2e8f0; margin-bottom: 10px;
      }
      .r-top-left { display: flex; align-items: center; gap: 10px; }
      .r-btn-back {
        width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e2e8f0;
        background: #f8fafc; color: #2563eb; display: flex; align-items: center; justify-content: center;
      }
      .r-h1 { font-size: 15px; font-weight: 800; color: #0f172a; }
      .r-sub { font-size: 10.5px; color: #64748b; }
      .r-user-badge {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11.5px; font-weight: 700; background: #ffffff;
        border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 10px; margin-bottom: 10px;
      }
      .r-badge-online { background: #dcfce7; color: #15803d; padding: 3px 9px; border-radius: 6px; font-size: 10.5px; }
      .r-tabs {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 6px; background: #ffffff; padding: 6px; border-radius: 12px;
        border: 1px solid #e2e8f0; margin-bottom: 10px;
      }
      .r-tab {
        padding: 8px 4px; font-size: 10.5px; font-weight: 700; border-radius: 8px;
        color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center;
      }
      .r-tab.active { background: #2563eb; color: #ffffff; box-shadow: 0 3px 8px rgba(37,99,235,0.3); }
      .r-main-card {
        background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;
      }
      .r-form-group { margin-bottom: 10px; }
      .r-label { font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px; display: block; }
      .r-input-btn { display: flex; gap: 6px; }
      .r-input {
        width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid #e2e8f0;
        background: #f8fafc; color: #0f172a; font-size: 12.5px;
      }
      .r-btn-qr {
        background: #2563eb; color: #ffffff; width: 40px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .r-std-banner {
        background: rgba(37,99,235,0.06); border: 1px dashed #2563eb;
        padding: 8px 12px; border-radius: 8px; font-size: 11.5px; margin-bottom: 10px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .r-badge-std { background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; }
      .r-section-block {
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px;
      }
      .r-block-origen { border-left: 4px solid #f59e0b; }
      .r-block-destino { border-left: 4px solid #22c55e; }
      .r-sec-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
      .r-btn-action {
        width: 100%; height: 44px; border-radius: 10px; color: #fff; font-size: 13.5px;
        font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px;
      }
      .r-btn-entrada { background: #22c55e; }
      .r-btn-salida { background: #f59e0b; color: #000; }
      .r-btn-transf { background: #8b5cf6; margin-top: 10px; }
      .r-fifo-card {
        background: rgba(245,158,11,0.06); border: 1px solid #f59e0b; border-left: 5px solid #f59e0b;
        padding: 10px; border-radius: 8px;
      }
      .r-fifo-title { font-size: 10.5px; font-weight: 800; color: #d97706; margin-bottom: 6px; }
      .r-fifo-item {
        background: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px;
      }
      .r-fifo-item.selected { border-color: #22c55e; background: rgba(34,197,94,0.08); }
      .r-badge-fifo { background: #f59e0b; color: #000; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
      .r-switch-mode {
        background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.3);
        padding: 10px 12px; border-radius: 8px; margin-bottom: 10px;
        display: flex; justify-content: space-between; align-items: center;
      }
      .r-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; }
      .r-table th { background: #f1f5f9; padding: 7px 8px; text-align: left; font-size: 10px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
      .r-table td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }
      .r-btn-rev { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 10.5px; }
      .r-badge-rev-done { background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-decoration: line-through; }
      .r-kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px; }
      .r-kpi { background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 8px 10px; }
      .r-kpi span { display: block; font-size: 9.5px; font-weight: 800; color: #64748b; }
      .r-kpi b { font-size: 16px; font-weight: 900; }

      /* Anillo rojo de enfoque didáctico sobre el elemento exacto del paso */
      .sop-focus-ring {
        outline: 3px solid #dc2626 !important;
        outline-offset: 2px !important;
        position: relative !important;
        border-radius: 10px !important;
      }
      .sop-focus-ring::after {
        content: "👉 " attr(data-callout);
        position: absolute;
        top: -12px;
        right: 10px;
        background: #dc2626;
        color: #ffffff;
        font-size: 10px;
        font-weight: 900;
        padding: 2px 8px;
        border-radius: 10px;
        box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4);
        z-index: 10;
      }

      /* Responsividad del Visor de Manuales en Celular y Tablet */
      @media (max-width: 768px) {
        .sop-modal-overlay { padding: 8px; }
        .sop-modal-card { padding: 14px; max-height: 95vh; }
        .sop-header-banner { flex-direction: column; align-items: stretch; }
        .sop-mod-btn { flex: 1 1 calc(50% - 6px); justify-content: center; text-align: center; }
        .r-kpi-row { grid-template-columns: repeat(2, 1fr); }
        .real-ui-shot { overflow-x: auto; padding: 10px; }
        .sop-focus-ring::after { position: static; display: inline-block; margin-top: 4px; }
      }
    `;
    document.head.appendChild(style);
  }

  function textoBotonSOP() {
    const lang = (window.KraemI18n ? window.KraemI18n.getLang() : (localStorage.getItem('lang') || localStorage.getItem('kraem_lang') || 'es'));
    if (lang === 'ko') return '📘 작업표준서 / 매뉴얼 (SOP)';
    if (lang === 'en') return '📘 Interactive Manual / SOP';
    return '📘 Manual Didáctico / SOP ISO';
  }

  document.addEventListener('kraem:langchange', function() {
    const btn = document.getElementById('btnUniversalSOPLauncher');
    if (btn) {
      btn.innerHTML = <i class="fas fa-book-open"></i>  + textoBotonSOP();
    }
  });

  // Captura en vivo de la ventana actual del usuario por si desea incluir su pantalla activa con datos en vivo
  window.capturarPantallaActualEnVivo = async function () {
    const overlay = document.getElementById('modalUniversalSOP');
    if (overlay) overlay.style.display = 'none';
    await new Promise(r => setTimeout(r, 150));

    const h2c = await asegurarHtml2Canvas();
    if (!h2c) {
      if (overlay) overlay.style.display = 'flex';
      return alert("No se pudo iniciar el motor de captura.");
    }

    const target = document.querySelector('.container') || document.querySelector('.app-container') || document.body;
    const canvas = await h2c(target, { scale: 1.5, useCORS: true, backgroundColor: '#f8fafc' });
    const dataUrl = canvas.toDataURL('image/png');

    if (overlay) overlay.style.display = 'flex';
    const boxVivo = document.getElementById('sopLiveCapturePreview');
    if (boxVivo) {
      boxVivo.style.display = 'block';
      boxVivo.innerHTML = `
        <div style="font-size:12px; font-weight:900; color:#15803d; margin-bottom:6px;">
          ✅ CAPTURA EN VIVO TOMADA DE TU PANTALLA ACTUAL (Se incluirá como evidencia real en el PDF si lo descargas ahora):
        </div>
        <img src="${dataUrl}" style="width:100%; border:2px solid #16a34a; border-radius:10px;">
      `;
      window._ultimaCapturaEnVivoDataUrl = dataUrl;
    }
  };

  // =========================================================================
  // VISOR INTERACTIVO EN PANTALLA (CON VISTAS REALES 1:1 DE CADA PANTALLA)
  // =========================================================================
  window.abrirManualSOP = function (archivoForzado) {
    inyectarEstilosSOP();
    asegurarHtml2Canvas();
    const file = (archivoForzado && MANUALES_SOP[archivoForzado]) ? archivoForzado : obtenerArchivoActual();
    const sop = MANUALES_SOP[file] || MANUALES_SOP['wms_operaciones.html'];

    let overlay = document.getElementById('modalUniversalSOP');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modalUniversalSOP';
      overlay.className = 'sop-modal-overlay';
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      };
      document.body.appendChild(overlay);
    }

    const switcherHTML = ORDEN_MODULOS.map(modKey => {
      const m = MANUALES_SOP[modKey];
      const isAct = (modKey === file) ? 'active' : '';
      return `
        <button class="sop-mod-btn ${isAct}" onclick="abrirManualSOP('${modKey}')">
          <span>${m.icono}</span>
          <span>${m.nombreCorto}</span>
          <small style="opacity:0.8;">(${m.codigo})</small>
        </button>
      `;
    }).join('');

    const anatomiaHTML = (sop.anatomia || []).map(a => `
      <div class="sop-anatomy-card">
        <div class="sop-anatomy-title">${a.nombre}</div>
        <div class="sop-anatomy-purpose"><b>¿Para qué sirve?:</b> ${a.sirvePara}</div>
        <div class="sop-anatomy-how"><b>Cómo se usa:</b> ${a.comoSeUsa}</div>
      </div>
    `).join('');

    const procesosHTML = (sop.procesos || []).map(proc => {
      const pasosProcHTML = (proc.pasos || []).map(p => `
        <div class="sop-step-card">
          <div class="sop-step-title">
            <span class="sop-step-num" style="background:${proc.color || '#2563eb'};">PASO ${p.num}</span>
            <span>${p.titulo}</span>
          </div>
          <div class="sop-step-what"><b>¿Qué hace este apartado?:</b> ${p.queEs}</div>
          <div class="sop-step-desc">${p.explicacion}</div>
          <div style="font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">
            📸 VISTA REAL DE LA PANTALLA EN EL SISTEMA (EL RECUADRO ROJO SEÑALA DÓNDE EJECUTAR EL PASO ${p.num}):
          </div>
          ${construirHTMLRealDelPaso(p.sceneId)}
          ${p.reglaOro ? `<div class="sop-step-alert"><b>REGLA DE ORO / PUNTO CRÍTICO ISO:</b> ${p.reglaOro}</div>` : ''}
        </div>
      `).join('');

      return `
        <div class="sop-sec-heading" style="background:${proc.color || '#1e3a8a'};">
          <span>${proc.subtitulo}</span>
          <span style="font-size:11px; font-weight:600; opacity:0.9;">${proc.descripcionProceso || ''}</span>
        </div>
        ${pasosProcHTML}
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="sop-modal-card">
        <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <span>SELECCIONA CUALQUIER MÓDULO PARA VER O IMPRIMIR SU MANUAL CON CAPTURAS REALES SIN SALIR DE ESTA PANTALLA:</span>
          <span style="color:#2563eb;">Cláusula 7.5 y 8.5.1 ISO 9001</span>
        </div>
        <div class="sop-module-switcher">
          ${switcherHTML}
        </div>

        <div class="sop-header-banner">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="logo-kraem.jpg" alt="KRAEM" style="height:42px; border-radius:6px;">
            <div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <span style="background:#2563eb; color:#fff; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:900;">
                  INSTRUCCIÓN DE TRABAJO: ${sop.codigo} | ${sop.rev}
                </span>
                <span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:900;">
                  CAPTURAS 100% FIELES AL SISTEMA REAL
                </span>
              </div>
              <h2 style="margin:6px 0 0; font-size:1.1rem; color:var(--text);">${sop.titulo}</h2>
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button class="btn-sop-help" style="background:#16a34a !important;" onclick="capturarPantallaActualEnVivo()" title="Toma una foto real en vivo de tu pantalla actual">
              <i class="fas fa-camera"></i> Capturar Mi Pantalla en Vivo
            </button>
            <button id="btnDownloadSopPdf" class="btn-sop-help" style="background:#dc2626 !important;" onclick="descargarManualSOP_PDF('${file}')">
              <i class="fas fa-file-pdf"></i> Descargar PDF con Capturas Reales (${sop.codigo})
            </button>
            <button onclick="document.getElementById('modalUniversalSOP').style.display='none'" style="background:transparent; border:1px solid #cbd5e1; border-radius:8px; padding:8px 12px; cursor:pointer; font-weight:800; color:var(--text);">
              ✕ Cerrar
            </button>
          </div>
        </div>

        <div id="sopLiveCapturePreview" style="display:none; margin-bottom:14px; padding:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px;"></div>

        <div class="sop-meta-strip">
          <div><b style="color:#2563eb;">CÓDIGO OFICIAL SOP:</b><br>${sop.codigo} (${sop.rev})</div>
          <div><b style="color:#2563eb;">NORMA / CLÁUSULA ISO:</b><br>${sop.clausula}</div>
          <div><b style="color:#2563eb;">DIRIGIDO A:</b><br>${sop.puesto}</div>
          <div><b style="color:#2563eb;">REPORTES CONTROLADOS:</b><br>${(sop.reportesAsociados || []).join(', ')}</div>
        </div>

        <div style="background:rgba(22,163,74,0.08); border-left:4px solid #16a34a; padding:11px 14px; border-radius:8px; margin-bottom:14px; font-size:13px; line-height:1.5;">
          <b>OBJETIVO DEL DOCUMENTO:</b> ${sop.objetivo}
        </div>

        <div class="sop-sec-heading" style="background:#0f172a;">
          <span>MAPA GENERAL DE LA PANTALLA: ¿PARA QUÉ SIRVE CADA SECCIÓN?</span>
        </div>
        <div class="sop-anatomy-grid">
          ${anatomiaHTML}
        </div>

        ${procesosHTML}

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border, #e2e8f0); padding-top:12px; margin-top:14px; font-size:11px; color:#64748b; flex-wrap:wrap; gap:8px;">
          <span>DOCUMENTO CONTROLADO SGC ISO 9001 / IATF 16949 • KRAEM S.A. DE C.V.</span>
          <span>Avalado en Lista Maestra: <b>KR-SGC-LM-0001</b> | Código Instructivo: <b>${sop.codigo}</b></span>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';
  };

  // =========================================================================
  // GENERADOR DE PDF OFICIAL CON CAPTURAS PNG REALES RENDERIZADAS CON HTML2CANVAS
  // =========================================================================
  window.descargarManualSOP_PDF = async function (archivoForzado) {
    inyectarEstilosSOP();
    const file = (archivoForzado && MANUALES_SOP[archivoForzado]) ? archivoForzado : obtenerArchivoActual();
    const sop = MANUALES_SOP[file] || MANUALES_SOP['wms_operaciones.html'];

    if (!window.jspdf) {
      alert("Cargando motor PDF, intenta de nuevo en un segundo.");
      return;
    }

    const btnPdf = document.getElementById('btnDownloadSopPdf');
    const oldText = btnPdf ? btnPdf.innerHTML : '';
    if (btnPdf) {
      btnPdf.disabled = true;
      btnPdf.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Capturando pantallas reales y generando PDF...`;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'pt', 'a4');
      const fechaHoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

      function dibujarEncabezadoPagina() {
        try {
          doc.addImage(KRAEM_LOGO_B64, 'PNG', 38, 22, 34, 34);
        } catch (e) {}

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("KRAEM S.A. DE C.V.", 78, 36);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("INSTRUCCION DE TRABAJO ESTANDAR (SOP) CON CAPTURAS REALES DEL SISTEMA", 78, 48);

        doc.setFillColor(37, 99, 235);
        doc.roundedRect(410, 22, 145, 32, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`CODIGO: ${limpiarTextoPDF(sop.codigo)}`, 420, 36);
        doc.setFontSize(7.5);
        doc.text(`${limpiarTextoPDF(sop.rev)}  |  VIGENTE`, 420, 48);

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(1);
        doc.line(38, 62, 555, 62);
        doc.setTextColor(0, 0, 0);
      }

      dibujarEncabezadoPagina();
      let curY = 76;

      // Título principal
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      const titLines = doc.splitTextToSize(limpiarTextoPDF(sop.titulo), 515);
      doc.text(titLines, 38, curY);
      curY += titLines.length * 13 + 4;

      // Bloque de Objetivo y Norma
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      const objText = "OBJETIVO: " + limpiarTextoPDF(sop.objetivo);
      const objLines = doc.splitTextToSize(objText, 500);
      const boxH = (objLines.length * 10.5) + 26;
      doc.roundedRect(38, curY, 517, boxH, 5, 5, 'FD');

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`NORMA APLICABLE: ${limpiarTextoPDF(sop.clausula)}   |   PERSONAL: ${limpiarTextoPDF(sop.puesto)}`, 46, curY + 13);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(objLines, 46, curY + 26);
      curY += boxH + 10;

      // Si el usuario tomó una captura en vivo de su pantalla actual, incluirla primero
      if (window._ultimaCapturaEnVivoDataUrl) {
        doc.setFillColor(22, 163, 74);
        doc.roundedRect(38, curY, 517, 18, 4, 4, 'F');
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("EVIDENCIA DE PANTALLA ACTIVA CAPTURADA EN VIVO EN ESTACION DE TRABAJO", 46, curY + 12);
        curY += 22;
        try {
          doc.addImage(window._ultimaCapturaEnVivoDataUrl, 'PNG', 58, curY, 475, 185);
          curY += 195;
        } catch (e) {}
      }

      // Secciones Principales de la Pantalla
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(38, curY, 517, 20, 4, 4, 'F');
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("ANATOMIA DE LA PANTALLA (QUE ES Y PARA QUE SIRVE CADA SECCION)", 46, curY + 13);
      curY += 25;

      for (const a of (sop.anatomia || [])) {
        const descAnat = `${limpiarTextoPDF(a.sirvePara)} Como se usa: ${limpiarTextoPDF(a.comoSeUsa)}`;
        const linesAnat = doc.splitTextToSize(descAnat, 500);
        const cardH = (linesAnat.length * 10) + 22;

        if (curY + cardH > 770) {
          doc.addPage();
          dibujarEncabezadoPagina();
          curY = 76;
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(38, curY, 517, cardH, 4, 4, 'FD');

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 235);
        doc.text(limpiarTextoPDF(a.nombre), 46, curY + 12);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(linesAnat, 46, curY + 23);

        curY += cardH + 6;
      }

      // Recorrer cada proceso y capturar en PNG real cada vista del DOM
      for (const proc of (sop.procesos || [])) {
        if (curY > 650) {
          doc.addPage();
          dibujarEncabezadoPagina();
          curY = 76;
        } else {
          curY += 6;
        }

        doc.setFillColor(30, 64, 175);
        doc.roundedRect(38, curY, 517, 22, 4, 4, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(limpiarTextoPDF(proc.subtitulo), 46, curY + 14);
        curY += 28;

        for (const p of (proc.pasos || [])) {
          const queEsTxt = "FUNCION DEL APARTADO: " + limpiarTextoPDF(p.queEs);
          const expTxt = "PASO A PASO: " + limpiarTextoPDF(p.explicacion);
          const reglaTxt = "REGLA DE ORO / CONTROL ISO: " + limpiarTextoPDF(p.reglaOro || 'Seguir estandar operativo.');

          const queEsLines = doc.splitTextToSize(queEsTxt, 498);
          const expLines = doc.splitTextToSize(expTxt, 498);
          const reglaLines = doc.splitTextToSize(reglaTxt, 498);

          const imgW = 475;
          const imgH = 175;
          const totalStepH = 24 + (queEsLines.length * 10) + (expLines.length * 10.5) + imgH + (reglaLines.length * 10) + 28;

          if (curY + totalStepH > 775) {
            doc.addPage();
            dibujarEncabezadoPagina();
            curY = 76;
          }

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(148, 163, 184);
          doc.setLineWidth(1);
          doc.roundedRect(38, curY, 517, totalStepH, 6, 6, 'FD');

          doc.setFillColor(239, 246, 255);
          doc.roundedRect(39, curY + 1, 515, 20, 5, 5, 'F');
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(29, 78, 216);
          doc.text(`PASO ${p.num}: ${limpiarTextoPDF(p.titulo)}`, 48, curY + 14);

          let innerY = curY + 32;

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(queEsLines, 48, innerY);
          innerY += queEsLines.length * 10 + 4;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          doc.text(expLines, 48, innerY);
          innerY += expLines.length * 10.5 + 6;

          const realPng = await obtenerCapturaRealPNG(p.sceneId);
          if (realPng) {
            try {
              doc.addImage(realPng, 'PNG', 58, innerY, imgW, imgH);
              doc.setDrawColor(203, 213, 225);
              doc.rect(58, innerY, imgW, imgH);
            } catch (err) {}
          }
          innerY += imgH + 8;

          doc.setFillColor(254, 243, 199);
          doc.roundedRect(48, innerY - 3, 497, (reglaLines.length * 10) + 8, 3, 3, 'F');
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.8);
          doc.setTextColor(180, 83, 9);
          doc.text(reglaLines, 54, innerY + 6);

          curY += totalStepH + 10;
        }
      }

      // Firmas de autorización ISO 9001
      if (curY + 75 > 780) {
        doc.addPage();
        dibujarEncabezadoPagina();
        curY = 95;
      } else {
        curY += 35;
      }

      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.8);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);

      doc.line(40, curY, 190, curY);
      doc.text("ELABORO: INGENIERIA / WMS", 52, curY + 12);

      doc.line(220, curY, 370, curY);
      doc.text("REVISO: CALIDAD / SGC ISO", 236, curY + 12);

      doc.line(400, curY, 555, curY);
      doc.text("AUTORIZO: GERENCIA DE PLANTA", 412, curY + 12);

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(38, 810, 555, 810);
        doc.setFontSize(7.2);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`DOCUMENTO CONTROLADO SGC ISO 9001 | CODIGO: ${limpiarTextoPDF(sop.codigo)} | ${limpiarTextoPDF(sop.rev)}`, 38, 822);
        doc.text(`Fecha de Emision: ${fechaHoy}`, 275, 822);
        doc.text(`Pagina ${i} de ${totalPages}`, 500, 822);
      }

      doc.save(`${limpiarTextoPDF(sop.codigo)}_Manual_Capturas_Reales_${file.replace('.html', '')}.pdf`);
    } finally {
      if (btnPdf) {
        btnPdf.disabled = false;
        btnPdf.innerHTML = oldText;
      }
    }
  };

  function insertarBotonEnTopbar() {
    inyectarEstilosSOP();
    const contenedorAcciones = document.querySelector('.top-actions') || document.querySelector('.controls');
    if (!contenedorAcciones || document.getElementById('btnOpenSOP')) return;

    const btn = document.createElement('button');
    btn.id = 'btnOpenSOP';
    btn.className = 'btn-sop-help';
    btn.innerHTML = `<i class="fas fa-book-open"></i> <span id="txtBtnSOP">${textoBotonSOP()}</span>`;
    btn.onclick = () => window.abrirManualSOP();
    contenedorAcciones.insertBefore(btn, contenedorAcciones.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertarBotonEnTopbar);
  } else {
    insertarBotonEnTopbar();
  }
})();
