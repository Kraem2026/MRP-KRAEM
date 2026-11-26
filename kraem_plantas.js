/**
 * KRAEM by APEX SYSTEM - Multi-Plant Architecture & Scope Controller (kraem_plantas.js)
 * Administra el catálogo de Plantas / Sedes Industriales y el filtrado estricto
 * de Áreas Generales, Áreas Específicas, Ubicaciones WMS, Carritos y Permisos.
 */

(function (window) {
  'use strict';

  var DEFAULT_PLANTS = [
    { id: 1, code: 'PL-MTY', nombre: 'Planta Monterrey (Matriz)', ciudad: 'Monterrey, N.L.', direccion: 'Parque Industrial Apodaca', active: true },
    { id: 2, code: 'PL-RAM', nombre: 'Planta Ramos Arizpe', ciudad: 'Ramos Arizpe, Coah.', direccion: 'Parque Industrial Santa María', active: true },
    { id: 3, code: 'PL-QRO', nombre: 'Planta Querétaro', ciudad: 'Querétaro, Qro.', direccion: 'Parque Industrial El Marqués', active: true },
    { id: 4, code: 'PL-TIJ', nombre: 'Planta Tijuana', ciudad: 'Tijuana, B.C.', direccion: 'Parque Industrial El Florido', active: true }
  ];

  var KraemPlant = {
    STORAGE_PLANTS: 'kraem_plantas_db_v1',
    STORAGE_ACTIVE_ID: 'kraem_active_plant_id',
    STORAGE_AREA_MAP: 'kraem_area_general_plant_map_v1',

    /**
     * Obtener listado de plantas (de Supabase con fallback a localStorage)
     */
    getPlants: function () {
      try {
        var saved = localStorage.getItem(this.STORAGE_PLANTS);
        if (saved) {
          var parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('[KraemPlant] Error al leer plantas locales:', e);
      }
      // Sembrar por defecto
      localStorage.setItem(this.STORAGE_PLANTS, JSON.stringify(DEFAULT_PLANTS));
      return DEFAULT_PLANTS;
    },

    /**
     * Guardar listado de plantas y sincronizar en toda la aplicación
     */
    savePlants: function (plantsList) {
      localStorage.setItem(this.STORAGE_PLANTS, JSON.stringify(plantsList));

      // Si la planta activa fue eliminada o desactivada, reasignar a la primera activa disponible
      var activeId = parseInt(localStorage.getItem(this.STORAGE_ACTIVE_ID), 10);
      var activeStillExists = plantsList.find(function(p) { return p.id === activeId && p.active !== false; });
      if (!activeStillExists && plantsList.length > 0) {
        var firstActive = plantsList.find(function(p) { return p.active !== false; }) || plantsList[0];
        localStorage.setItem(this.STORAGE_ACTIVE_ID, String(firstActive.id));
      }

      // Intentar sincronizar en Supabase si la tabla existe
      if (window.client && typeof window.client.from === 'function') {
        try {
          window.client.from('plantas').select('id').limit(1).then(function(res) {
            if (!res.error) {
              plantsList.forEach(function(p) {
                window.client.from('plantas').upsert([p]).then(function() {});
              });
            }
          });
        } catch (_) {}
      }

      // Actualizar toda la interfaz actual
      this.updateUI();

      // Notificar evento local
      var evt = new CustomEvent('kraem:plantsupdated', { detail: plantsList });
      document.dispatchEvent(evt);

      // Notificar bidireccionalmente entre App Shell e iframes
      if (window.self !== window.top) {
        try {
          window.parent.postMessage({ type: 'KRAEM_PLANTS_UPDATED', plants: plantsList }, '*');
        } catch (e) {}
      } else {
        var frame = document.getElementById('appWorkspaceFrame');
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ type: 'KRAEM_PLANTS_UPDATED', plants: plantsList }, '*');
          } catch (e) {}
        }
      }
    },

    /**
     * Eliminar permanentemente una planta
     */
    deletePlant: function (plantId) {
      plantId = parseInt(plantId, 10);
      var plants = this.getPlants();
      if (plants.length <= 1) {
        alert('No se puede eliminar la única planta del sistema. Debe existir al menos una sede.');
        return false;
      }
      var target = plants.find(function (p) { return p.id === plantId; });
      if (!target) return false;

      var updated = plants.filter(function (p) { return p.id !== plantId; });
      this.savePlants(updated);
      return true;
    },

    /**
     * Obtener la planta activa actual
     */
    getActivePlant: function () {
      var plants = this.getPlants();
      var activeId = parseInt(localStorage.getItem(this.STORAGE_ACTIVE_ID), 10);
      if (!activeId) {
        activeId = plants[0] ? plants[0].id : 1;
        localStorage.setItem(this.STORAGE_ACTIVE_ID, String(activeId));
      }
      var found = plants.find(function (p) { return p.id === activeId; });
      return found || plants[0] || DEFAULT_PLANTS[0];
    },

    /**
     * Verificar si el usuario actual tiene permiso para alternar plantas
     */
    canSwitchPlant: function () {
      if (window.KraemAuth) {
        if (typeof window.KraemAuth.isHighRank === 'function' && window.KraemAuth.isHighRank()) return true;
        var role = (window.KraemAuth.role || '').toUpperCase();
        if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'GERENCIA') return true;
      }
      return false; // Operarios y usuarios estándar sólo acceden a su planta asignada
    },

    /**
     * Cambiar la planta de trabajo activa
     */
    setActivePlant: function (plantId, notify) {
      plantId = parseInt(plantId, 10);
      var plants = this.getPlants();
      var target = plants.find(function (p) { return p.id === plantId; });
      if (!target) return false;

      // Validación de permisos para usuarios no administradores
      if (!this.canSwitchPlant()) {
        var userAssigned = this.getUserAssignedPlantId();
        if (userAssigned && userAssigned !== plantId) {
          alert('Acceso restringido: Tu perfil está asignado exclusivamente a ' + (this.getPlantById(userAssigned)?.nombre || 'otra planta') + '. Sólo Administradores pueden alternar de sede.');
          return false;
        }
      }

      localStorage.setItem(this.STORAGE_ACTIVE_ID, String(plantId));

      // Disparar evento global en el documento actual
      var evt = new CustomEvent('kraem:plantchange', { detail: target });
      document.dispatchEvent(evt);

      // Si está en el shell o iframe, comunicar hacia arriba o hacia abajo
      if (window.self !== window.top) {
        try {
          window.parent.postMessage({ type: 'KRAEM_PLANT_CHANGED', plant: target }, '*');
        } catch (e) {}
      } else {
        var frame = document.getElementById('appWorkspaceFrame');
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ type: 'KRAEM_PLANT_CHANGED', plant: target }, '*');
          } catch (e) {}
        }
      }

      this.updateUI();
      return true;
    },

    /**
     * Obtener planta por ID
     */
    getPlantById: function (id) {
      return this.getPlants().find(function (p) { return p.id === parseInt(id, 10); }) || null;
    },

    /**
     * Planta asignada al usuario
     */
    getUserAssignedPlantId: function () {
      if (window.KraemAuth && window.KraemAuth.user) {
        var meta = window.KraemAuth.user.user_metadata || {};
        if (meta.plant_id) return parseInt(meta.plant_id, 10);
      }
      return null;
    },

    /**
     * Mapa de Áreas Generales asociadas a Plantas
     */
    getAreaGeneralPlantMap: function () {
      try {
        var mapStr = localStorage.getItem(this.STORAGE_AREA_MAP);
        if (mapStr) return JSON.parse(mapStr);
      } catch (e) {}
      // Mapeo inicial: Áreas 1 (LS), 2 (Nissei), 3 (HDL) pertenecen a Planta Monterrey (ID: 1)
      var initialMap = { 1: 1, 2: 1, 3: 1 };
      localStorage.setItem(this.STORAGE_AREA_MAP, JSON.stringify(initialMap));
      return initialMap;
    },

    /**
     * Asignar un Área General a una Planta
     */
    assignAreaGeneralToPlant: function (areaGeneralId, plantId) {
      var map = this.getAreaGeneralPlantMap();
      map[areaGeneralId] = parseInt(plantId, 10);
      localStorage.setItem(this.STORAGE_AREA_MAP, JSON.stringify(map));
    },

    /**
     * Filtrar Áreas Generales según la Planta Activa
     */
    filterAreasGenerales: function (areasList) {
      if (!Array.isArray(areasList)) return [];
      var activePlant = this.getActivePlant();
      var map = this.getAreaGeneralPlantMap();

      return areasList.filter(function (area) {
        // Si el registro de la BD ya tiene columna planta_id
        if (area.planta_id !== undefined && area.planta_id !== null) {
          return parseInt(area.planta_id, 10) === activePlant.id;
        }
        // Fallback al mapa registrado
        var assigned = map[area.id];
        if (assigned !== undefined) {
          return assigned === activePlant.id;
        }
        // Por defecto, registros legados no asignados se muestran en Planta 1 (Monterrey)
        return activePlant.id === 1;
      });
    },

    /**
     * Re-generar dinámicamente las opciones de un select con las plantas actuales
     */
    populateSelect: function (sel, includeInactive) {
      if (!sel) return;
      var plants = this.getPlants();
      var active = this.getActivePlant();
      var previousVal = sel.value || String(active.id);

      sel.innerHTML = '';
      plants.forEach(function (p) {
        if (!includeInactive && p.active === false) return;
        var opt = document.createElement('option');
        opt.value = String(p.id);
        var label = p.nombre;
        if (sel.id === 'selActivePlant' || sel.id === 'selFilterPlanta' || sel.classList.contains('plant-select-compact')) {
          if (label.length > 18) label = label.substring(0, 16) + '…';
        } else {
          label = p.nombre + (p.code ? ' (' + p.code + ')' : '');
        }
        opt.textContent = label;
        opt.title = p.nombre + (p.code ? ' (' + p.code + ')' : '');
        if (String(p.id) === String(previousVal)) {
          opt.selected = true;
        }
        sel.appendChild(opt);
      });

      if (!sel.value && sel.options.length > 0) {
        sel.value = String(active.id);
      }
    },

    /**
     * Actualizar elementos visuales del selector de planta en la página
     */
    updateUI: function () {
      var self = this;
      var active = this.getActivePlant();

      // Actualizar texto en sidebar o topbar
      document.querySelectorAll('.active-plant-name, #sidebarPlantName, #topbarPlantTxt, #kpiPlantaActivaTxt').forEach(function (el) {
        el.textContent = active.nombre;
      });

      // Actualizar y repoblar dinámicamente los selects de planta
      document.querySelectorAll('select.plant-select, #selActivePlant, #selFilterPlanta, #filterPlantSelect').forEach(function (sel) {
        self.populateSelect(sel);
        sel.value = String(active.id);
      });
    },

    /**
     * Inicializar automáticamente
     */
    init: function () {
      var self = this;
      document.addEventListener('DOMContentLoaded', function () {
        self.updateUI();

        // Escuchar cambios de planta enviados desde iframe o ventana padre
        window.addEventListener('message', function (e) {
          if (!e.data || !e.data.type) return;

          if (e.data.type === 'KRAEM_PLANT_CHANGED' && e.data.plant) {
            localStorage.setItem(self.STORAGE_ACTIVE_ID, String(e.data.plant.id));
            self.updateUI();
            var evt = new CustomEvent('kraem:plantchange', { detail: e.data.plant });
            document.dispatchEvent(evt);
          } else if (e.data.type === 'KRAEM_PLANTS_UPDATED') {
            self.updateUI();
            var evtUpd = new CustomEvent('kraem:plantsupdated', { detail: e.data.plants });
            document.dispatchEvent(evtUpd);
          }
        });
      });
    }
  };

  KraemPlant.init();
  window.KraemPlant = KraemPlant;

})(window);
