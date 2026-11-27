/**
 * KRAEM by APEX SYSTEM - Smart Navigation Bridge (kraem_nav.js)
 * Maneja la navegación jerárquica unificada tanto dentro del App Shell (iframe)
 * como en modo autónomo (móvil, tabletas o accesos directos).
 */

(function (window) {
  'use strict';

  var KraemNav = {
    // Mapa jerárquico oficial de módulos y sus padres
    hierarchy: {
      // Catálogos e Ingeniería
      'catalogo_plantas.html': { parent: 'ingenieria_catalogos.html', title: 'Catálogo de Plantas & Sedes', group: 'Ingeniería' },
      'admin_areas.html': { parent: 'ingenieria_catalogos.html', title: 'Áreas de Planta', group: 'Ingeniería' },
      'catalogo_areas_generales.html': { parent: 'ingenieria_catalogos.html', title: 'Áreas Generales', group: 'Ingeniería' },
      'catalogo_materiales.html': { parent: 'ingenieria_catalogos.html', title: 'Materiales & Resinas', group: 'Ingeniería' },
      'catalogo_moldes.html': { parent: 'ingenieria_catalogos.html', title: 'Moldes & Herramentales', group: 'Ingeniería' },
      'catalogo_procesos.html': { parent: 'ingenieria_catalogos.html', title: 'Procesos de Producción', group: 'Ingeniería' },
      // 1. Operaciones & Planta
      'admin_defectos.html': { parent: 'ingenieria_catalogos.html', title: 'Catálogo de Defectos', group: '1. Ingeniería' },
      'admin_maquinas.html': { parent: 'ingenieria_catalogos.html', title: 'Prensas & Maquinaria', group: '1. Ingeniería' },
      'admin_empaques.html': { parent: 'ingenieria_catalogos.html', title: 'Empaques & Embalajes', group: '1. Ingeniería' },
      'catalogo_checklists.html': { parent: 'ingenieria_catalogos.html', title: 'Checklists de Calidad', group: '1. Ingeniería' },
      'admin_partes.html': { parent: 'ingenieria_catalogos.html', title: 'Números de Parte', group: '1. Ingeniería' },
      'ingenieria_nuevo_np.html': { parent: 'admin_partes.html', title: 'Alta Número de Parte', group: '1. Ingeniería' },
      'part_ficha_tecnica.html': { parent: 'admin_partes.html', title: 'Ficha Técnica', group: '1. Ingeniería' },
      'ingenieria_bom.html': { parent: 'ingenieria_catalogos.html', title: 'Estructura de Materiales (BOM)', group: '1. Ingeniería' },
      'catalogo_moldes.html': { parent: 'ingenieria_catalogos.html', title: 'Matriz de Moldes', group: '1. Ingeniería' },
      'admin_areas.html': { parent: 'ingenieria_catalogos.html', title: 'Áreas de Planta', group: '1. Ingeniería' },
      'ingenieria_catalogos.html': { parent: 'dashboard.html', title: 'Catálogos Maestros de Ingeniería', group: '1. Ingeniería' },

      // WMS e Inventarios
      'inventarios.html': { parent: 'wms_operaciones.html', title: 'Inventario Maestro', group: '1. WMS' },
      'inventarios_ubicacion.html': { parent: 'inventarios.html', title: 'Inventario por Ubicación', group: '1. WMS' },
      'captura_inventario.html': { parent: 'inventarios.html', title: 'Ajuste de Inventario', group: '1. WMS' },
      'admin_ubicaciones.html': { parent: 'inventarios.html', title: 'Catálogo de Ubicaciones WMS', group: '1. WMS' },
      'consulta_fifo.html': { parent: 'wms_operaciones.html', title: 'Consulta FIFO & Lotes', group: '1. WMS' },
      'conteos_menu.html': { parent: 'wms_operaciones.html', title: 'Conteos Físicos & Cíclicos', group: '1. WMS' },
      'ciclicos_lista.html': { parent: 'conteos_menu.html', title: 'Lista de Conteos Cíclicos', group: '1. WMS' },
      'wms_operaciones.html': { parent: 'dashboard.html', title: 'Estación Operativa WMS', group: '1. WMS' },
      'historial.html': { parent: 'wms_operaciones.html', title: 'Historial Maestro de Movimientos', group: '1. WMS' },

      // Planeación & MRP
      'planeacion_hub.html': { parent: 'dashboard.html', title: 'Cockpit de Planeación & Control ERP', group: '1. Planeación' },
      'planeacion_mrp_forecast.html': { parent: 'planeacion_hub.html', title: 'Forecast, Demanda & Explosión MRP', group: '1. Planeación' },
      'planeacion_requerimientos.html': { parent: 'planeacion_hub.html', title: 'Requerimientos de Demanda', group: '1. Planeación' },
      'planeacion_produccion.html': { parent: 'planeacion_requerimientos.html', title: 'Planeación de Producción', group: '1. Planeación' },
      'planeacion_propuesta.html': { parent: 'planeacion_requerimientos.html', title: 'Propuesta de Producción (APS)', group: '1. Planeación' },
      'planeacion_aps_tablero.html': { parent: 'planeacion_hub.html', title: 'Tablero APS de Inyección', group: '1. Planeación' },
      'planeacion_montaje_moldes.html': { parent: 'planeacion_hub.html', title: 'SMED Montaje de Moldes', group: '1. Planeación' },
      'planeacion_calendario_maquinas.html': { parent: 'planeacion_hub.html', title: 'Calendario de Máquinas', group: '1. Planeación' },
      'planeacion_forecast.html': { parent: 'planeacion_hub.html', title: 'Forecast de Demanda', group: '2. Comercial' },
      'Planeacion.html': { parent: 'planeacion_hub.html', title: 'Planeación Histórica', group: '1. Planeación' },

      // Compras
      'compras_ordenes.html': { parent: 'dashboard.html', title: 'Órdenes de Compra (OCs)', group: '1. Compras' },
      'compras_recibo.html': { parent: 'compras_ordenes.html', title: 'Recibo de Mercancía WMS', group: '1. Compras' },
      'catalogo_proveedores.html': { parent: 'compras_ordenes.html', title: 'Catálogo de Proveedores', group: '1. Compras' },

      // Comercial
      'catalogo_clientes.html': { parent: 'dashboard.html', title: 'Catálogo de Clientes', group: '2. Comercial' },

      // Calidad
      'calidad_control.html': { parent: 'dashboard.html', title: 'Control de Calidad & ISO', group: '1. Calidad' },
      'inspeccion_captura.html': { parent: 'calidad_control.html', title: 'Inspección de Calidad', group: '1. Calidad' },
      'control_documental_iso.html': { parent: 'calidad_control.html', title: 'Control Documental ISO 9001', group: '1. Calidad' },

      // Producción Piso
      'produccion_captura.html': { parent: 'dashboard.html', title: 'MES Captura & Cierre de Producción', group: '1. Producción' },
      'produccion_inspeccion_captura.html': { parent: 'produccion_captura.html', title: 'Inspección en Piso', group: '1. Producción' },

      // Finanzas & Costos
      'dashboard_kpi.html': { parent: 'dashboard.html', title: 'Monitor Gerencial & OEE', group: '3. Finanzas' },
      'analisis.html': { parent: 'dashboard.html', title: 'Análisis de Costos & Defectos', group: '3. Finanzas' },

      // Recursos Humanos & 5S
      'rh_empleados.html': { parent: 'admin_rh.html', title: 'Expedientes de Empleados', group: '4. Personal' },
      'rh_asistencia.html': { parent: 'admin_rh.html', title: 'Control de Asistencia', group: '4. Personal' },
      'rh_reporte_asistencia.html': { parent: 'rh_asistencia.html', title: 'Reporte de Asistencia', group: '4. Personal' },
      'rh_capacitacion.html': { parent: 'admin_rh.html', title: 'Capacitaciones & Cursos', group: '4. Personal' },
      'rh_turnos.html': { parent: 'admin_rh.html', title: 'Asignación de Turnos', group: '4. Personal' },
      'rh_solicitudes.html': { parent: 'admin_rh.html', title: 'Solicitudes & Permisos', group: '4. Personal' },
      'rh_matriz_habilidades.html': { parent: 'admin_rh.html', title: 'Matriz de Habilidades', group: '4. Personal' },
      'rh_evaluacion_5s.html': { parent: 'admin_rh.html', title: 'Evaluaciones 5S', group: '4. Personal' },
      'dashboard_5s.html': { parent: 'admin_rh.html', title: 'Dashboard 5S', group: '4. Personal' },
      'admin_rh.html': { parent: 'dashboard.html', title: 'Portal de Recursos Humanos & 5S', group: '4. Personal' },

      // Gobernanza & Configuración
      'catalogo_plantas.html': { parent: 'dashboard.html', title: 'Catálogo de Plantas & Sedes', group: '5. Gobernanza' },
      'configuracion_sistema.html': { parent: 'dashboard.html', title: 'Configuración del Sistema', group: '5. Gobernanza' },
      'dashboard.html': { parent: null, title: 'Dashboard Operativo', group: 'General' }
    },

    isInsideShell: function () {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    },

    getCurrentFileName: function () {
      var path = window.location.pathname;
      var file = path.substring(path.lastIndexOf('/') + 1) || 'dashboard.html';
      return file.split('#')[0].split('?')[0];
    },

    getParent: function (file) {
      file = file || this.getCurrentFileName();
      var meta = this.hierarchy[file];
      return (meta && meta.parent) ? meta.parent : 'dashboard.html';
    },

    /**
     * Motor Maestro de Responsividad Móvil y Tablet
     * Se inyecta en todos los módulos automáticamente para corregir desbordamientos,
     * evitar auto-zoom en inputs y eliminar ruido visual en pantallas táctiles <= 820px.
     * En PC (> 820px) no tiene ningún efecto para respetar al 100% el diseño de escritorio.
     */
    injectMobileMasterStyles: function () {
      if (document.getElementById('kraem-mobile-master-styles')) return;

      var style = document.createElement('style');
      style.id = 'kraem-mobile-master-styles';
      style.textContent = [
        '/* --- KRAEM ERP UNIVERSAL MOBILE & TABLET RESPONSIVE ENGINE --- */',
        '@media (max-width: 820px) {',
        '  html, body {',
        '    max-width: 100vw !important;',
        '    overflow-x: hidden !important;',
        '    -webkit-text-size-adjust: 100% !important;',
        '  }',
        '  *, *::before, *::after {',
        '    box-sizing: border-box !important;',
        '  }',
        '  body {',
        '    padding: 10px 12px 35px !important;',
        '    font-size: 14px !important;',
        '  }',
        '  /* 1. Control total de Inputs para evitar desbordamiento y auto-zoom en iOS/Android */',
        '  input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]),',
        '  select,',
        '  textarea {',
        '    width: 100% !important;',
        '    max-width: 100% !important;',
        '    box-sizing: border-box !important;',
        '    font-size: 16px !important;',
        '    padding: 10px 12px !important;',
        '    border-radius: 9px !important;',
        '    line-height: 1.35 !important;',
        '  }',
        '  /* 2. Flex containers donde conviven input y botón (cámaras QR, buscar, etc.) */',
        '  .input-with-btn,',
        '  .input-group,',
        '  .search-with-btn,',
        '  .field-with-btn,',
        '  .search-bar,',
        '  div[style*="grid-template-columns:1fr auto"],',
        '  div[style*="grid-template-columns: 1fr auto"],',
        '  div[style*="grid-template-columns:auto 1fr"],',
        '  div[style*="grid-template-columns: auto 1fr"] {',
        '    display: flex !important;',
        '    flex-direction: row !important;',
        '    align-items: center !important;',
        '    gap: 8px !important;',
        '    width: 100% !important;',
        '    max-width: 100% !important;',
        '    box-sizing: border-box !important;',
        '  }',
        '  .input-with-btn input,',
        '  .input-group input,',
        '  .search-with-btn input,',
        '  .field-with-btn input,',
        '  .search-bar input,',
        '  .input-with-btn select,',
        '  .input-group select {',
        '    flex: 1 1 auto !important;',
        '    min-width: 0 !important;',
        '    width: 100% !important;',
        '    box-sizing: border-box !important;',
        '  }',
        '  .input-with-btn button,',
        '  .input-with-btn .btn-qr,',
        '  .input-group button,',
        '  .input-group .btn,',
        '  .search-with-btn button {',
        '    flex: 0 0 auto !important;',
        '    box-sizing: border-box !important;',
        '    height: 44px !important;',
        '    min-width: 44px !important;',
        '    margin-top: 0 !important;',
        '  }',
        '  /* 3. Rejillas: colapsar columnas forzadas a una sola columna ordenada en móvil */',
        '  .grid,',
        '  .form-grid,',
        '  .filter-grid,',
        '  .fields-grid,',
        '  .search-container,',
        '  .filters,',
        '  .kpi-grid,',
        '  .kpi-row,',
        '  .stats-grid,',
        '  .card-grid,',
        '  .wo-grid {',
        '    grid-template-columns: 1fr !important;',
        '    gap: 12px !important;',
        '  }',
        '  .form-row,',
        '  .filters-row,',
        '  .row {',
        '    flex-direction: column !important;',
        '    align-items: stretch !important;',
        '    gap: 10px !important;',
        '  }',
        '  /* 4. Encabezados y barras de acción: cero ruido visual y botones claros */',
        '  header,',
        '  .header,',
        '  .topbar,',
        '  .top-nav {',
        '    padding: 10px 14px !important;',
        '    margin-bottom: 14px !important;',
        '    border-radius: 12px !important;',
        '    gap: 10px !important;',
        '    display: flex !important;',
        '    flex-wrap: wrap !important;',
        '    justify-content: space-between !important;',
        '    align-items: center !important;',
        '  }',
        '  header h1, header h2,',
        '  .header h1, .header h2,',
        '  .topbar h1, .topbar h2,',
        '  .title-box h1, .title-box h2 {',
        '    font-size: 16px !important;',
        '    line-height: 1.3 !important;',
        '    margin: 0 !important;',
        '    word-break: break-word !important;',
        '  }',
        '  .title-box p, header p, .topbar p {',
        '    font-size: 11px !important;',
        '    margin-top: 2px !important;',
        '  }',
        '  .controls,',
        '  .header-controls,',
        '  .top-right {',
        '    display: flex !important;',
        '    align-items: center !important;',
        '    gap: 6px !important;',
        '    flex-wrap: wrap !important;',
        '  }',
        '  .user-badge {',
        '    padding: 7px 10px !important;',
        '    font-size: 11px !important;',
        '    margin-bottom: 12px !important;',
        '  }',
        '  /* 5. Contenedores y Tarjetas */',
        '  .container,',
        '  .card,',
        '  .main-card,',
        '  .filter-panel {',
        '    padding: 14px !important;',
        '    border-radius: 12px !important;',
        '    margin-bottom: 14px !important;',
        '    max-width: 100% !important;',
        '    box-sizing: border-box !important;',
        '  }',
        '  /* 6. Pestañas (Tabs) deslizables de forma táctil sin amontonamiento */',
        '  .tabs,',
        '  .tabs-nav {',
        '    display: flex !important;',
        '    grid-template-columns: none !important;',
        '    overflow-x: auto !important;',
        '    -webkit-overflow-scrolling: touch !important;',
        '    white-space: nowrap !important;',
        '    gap: 6px !important;',
        '    padding-bottom: 6px !important;',
        '    scrollbar-width: none !important;',
        '    border-radius: 10px !important;',
        '  }',
        '  .tabs::-webkit-scrollbar,',
        '  .tabs-nav::-webkit-scrollbar {',
        '    display: none !important;',
        '  }',
        '  .tabs button,',
        '  .tabs-nav button,',
        '  .tab-btn {',
        '    flex: 0 0 auto !important;',
        '    white-space: nowrap !important;',
        '    padding: 9px 14px !important;',
        '    font-size: 13px !important;',
        '    border-radius: 8px !important;',
        '  }',
        '  /* 7. Tablas de datos con desplazamiento fluido sin romper diseño */',
        '  .table-container,',
        '  .table-wrap,',
        '  .table-responsive {',
        '    width: 100% !important;',
        '    max-width: 100% !important;',
        '    overflow-x: auto !important;',
        '    -webkit-overflow-scrolling: touch !important;',
        '    border-radius: 10px !important;',
        '    margin-bottom: 14px !important;',
        '  }',
        '  /* 8. Modales y avisos emergentes adaptados a pantallas chicas */',
        '  .modal-content,',
        '  .modal-card,',
        '  .lock-box {',
        '    width: 95% !important;',
        '    max-width: 95% !important;',
        '    padding: 16px 14px !important;',
        '    margin: 10px auto !important;',
        '    box-sizing: border-box !important;',
        '  }',
        '  .active-run-card {',
        '    flex-direction: column !important;',
        '    align-items: stretch !important;',
        '    gap: 12px !important;',
        '    padding: 14px !important;',
        '  }',
        '  .active-run-card .run-meta {',
        '    gap: 8px 14px !important;',
        '  }',
        '  .wo-loaded-banner {',
        '    flex-direction: column !important;',
        '    align-items: stretch !important;',
        '    gap: 10px !important;',
        '  }',
        '}'
      ].join('\n');

      document.head.appendChild(style);
    },

    /**
     * Regresar de forma inteligente a la pantalla anterior real
     */
    back: function (explicitFallback) {
      var currentFile = this.getCurrentFileName();
      var fallback = explicitFallback || this.getParent(currentFile) || 'dashboard.html';

      // 1. Si está dentro del App Shell (Desktop con Sidebar fijo)
      if (this.isInsideShell()) {
        try {
          if (window.parent && typeof window.parent.navShellBack === 'function') {
            window.parent.navShellBack();
            return;
          }
        } catch (e) {}

        try {
          window.parent.postMessage({
            type: 'KRAEM_NAV_REQUEST',
            action: 'BACK',
            current: currentFile,
            fallback: fallback
          }, '*');
          return;
        } catch (err) {
          console.warn('[KraemNav] Error al comunicar con App Shell:', err);
        }
      }

      // 2. Si está en modo autónomo (Móvil / Tableta / Acceso directo)
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = fallback;
      }
    },

    /**
     * Ir directo al Home / Dashboard
     */
    home: function () {
      if (this.isInsideShell()) {
        try {
          if (window.parent && typeof window.parent.navGoHome === 'function') {
            window.parent.navGoHome();
            return;
          }
        } catch (e) {}
        try {
          window.parent.postMessage({ type: 'KRAEM_NAV_REQUEST', action: 'HOME' }, '*');
          return;
        } catch(e) {}
      }
      window.location.href = 'dashboard.html';
    },

    /**
     * Inicializar automáticamente botones de volver en la página
     */
    autoBind: function () {
      var self = this;
      var initFn = function () {
        self.injectMobileMasterStyles();
        var inShell = self.isInsideShell();

        if (inShell) {
          document.body.classList.add('inside-kraem-shell');

          // Ocultar TODOS los botones internos de retorno/menú redundantes cuando el módulo corre dentro del App Shell
          var style = document.createElement('style');
          style.id = 'kraem-shell-hide-style';
          style.textContent = [
            'body.inside-kraem-shell .btn-back,',
            'body.inside-kraem-shell .back-btn,',
            'body.inside-kraem-shell button.back,',
            'body.inside-kraem-shell .btn-secondary.btn-back,',
            'body.inside-kraem-shell .btn-shell-hide,',
            'body.inside-kraem-shell a.btn-back,',
            'body.inside-kraem-shell button[onclick*="KraemNav.back"],',
            'body.inside-kraem-shell button[onclick*="navShellBack"],',
            'body.inside-kraem-shell button[onclick*="history.back"],',
            'body.inside-kraem-shell button[onclick*="goBack"],',
            'body.inside-kraem-shell button[onclick*="dashboard.html"],',
            'body.inside-kraem-shell button[onclick*="planeacion_hub.html"],',
            'body.inside-kraem-shell button[onclick*="ingenieria_catalogos.html"],',
            'body.inside-kraem-shell button[onclick*="wms_operaciones.html"],',
            'body.inside-kraem-shell button[onclick*="location.href"],',
            'body.inside-kraem-shell a[onclick*="KraemNav.back"],',
            'body.inside-kraem-shell a[onclick*="navShellBack"],',
            'body.inside-kraem-shell a[onclick*="dashboard.html"],',
            'body.inside-kraem-shell a[href*="dashboard.html"],',
            'body.inside-kraem-shell a[href*="planeacion_hub.html"],',
            'body.inside-kraem-shell a[href*="ingenieria_catalogos.html"],',
            'body.inside-kraem-shell a[href*="wms_operaciones.html"],',
            'body.inside-kraem-shell .btn-nav[onclick*="dashboard.html"],',
            'body.inside-kraem-shell .topbar .top-left .btn-back,',
            'body.inside-kraem-shell .header .title-box .btn-back,',
            'body.inside-kraem-shell .header .title-wrap .btn-back,',
            'body.inside-kraem-shell .header > a.btn:first-child,',
            'body.inside-kraem-shell .header > button:first-child,',
            'body.inside-kraem-shell .header > .btn:first-child,',
            'body.inside-kraem-shell .header .btn-secondary:first-child,',
            'body.inside-kraem-shell .header a.btn-icon:first-child,',
            'body.inside-kraem-shell .top-bar-left > a.btn,',
            'body.inside-kraem-shell .top-bar-left > button.btn {',
            '  display: none !important;',
            '}'
          ].join('\n');
          document.head.appendChild(style);

          // Comunicar al App Shell el archivo actual para actualizar historial y breadcrumbs
          var cur = self.getCurrentFileName();
          var meta = self.hierarchy[cur];
          try {
            window.parent.postMessage({
              type: 'KRAEM_FRAME_LOADED',
              file: cur,
              title: (meta && meta.title) || document.title,
              group: (meta && meta.group) || ''
            }, '*');
          } catch (e) {}
        }

        // Vincular TODOS los botones de volver internos para que SIEMPRE funcionen
        // (sin interceptar botones que usan .btn-nav/.btn-back para pasos internos o cerrar modales)
        var backBtns = document.querySelectorAll('.btn-back, .back-btn, .btn-nav, button.back, [data-action="back"]');
        backBtns.forEach(function (btn) {
          var oc = (btn.getAttribute('onclick') || '').trim();
          var esVolverReal = !oc || /KraemNav\.back|navShellBack|history\.back|goBack|location\.href|\.html/i.test(oc);
          if (!esVolverReal) return;

          btn.style.cursor = 'pointer';
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var fallback = btn.getAttribute('data-fallback') || btn.getAttribute('href') || self.getParent();
            self.back(fallback);
          });
        });

        // Interceptar enlaces o botones al dashboard directo para que no aniden el iframe
        if (inShell) {
          var homeLinks = document.querySelectorAll('a[href*="dashboard.html"], button[onclick*="dashboard.html"]');
          homeLinks.forEach(function (el) {
            el.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              self.home();
            }, true);
          });
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFn);
      } else {
        initFn();
      }
    }
  };

  KraemNav.autoBind();
  window.KraemNav = KraemNav;

})(window);
