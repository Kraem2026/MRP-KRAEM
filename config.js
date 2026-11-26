// config.js - Configuración Central de Supabase, Auth Guard, Roles e i18n (ES/KO/EN) para KRAEM MRP
const _supabaseUrl = 'https://telntsrrschcdxczlape.supabase.co';
const _supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbG50c3Jyc2NoY2R4Y3psYXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjI4MTcsImV4cCI6MjA4MDQzODgxN30.DC2teZ_4gk3wA7UmZJHyeZHjw5aOOEmmKvd3a8jRUyw';

var client = window.client || (typeof supabase !== 'undefined' ? supabase.createClient(_supabaseUrl, _supabaseKey) : null);
window.client = client;

// ============================================================================
// HELPER GLOBAL: Consulta Completa Paginada (Bypass al límite de 1000 de Supabase)
// ============================================================================
function getSupabaseClient(c) {
    if (c) return c;
    if (window.client) return window.client;
    if (typeof client !== 'undefined' && client) return client;
    if (typeof _client !== 'undefined' && _client) return _client;
    if (typeof supabase !== 'undefined') {
        window.client = supabase.createClient(_supabaseUrl, _supabaseKey);
        return window.client;
    }
    return null;
}
window.getSupabaseClient = getSupabaseClient;

window.fetchAllRows = async function(tableName, options = {}) {
    const c = getSupabaseClient(options.client);
    if (!c) throw new Error("Supabase client no disponible para fetchAllRows");

    const select = options.select || '*';
    const pageSize = options.pageSize || 1000;
    const orderBy = options.orderBy !== undefined ? options.orderBy : 'id';
    const ascending = options.ascending !== undefined ? options.ascending : true;

    let all = [];
    let from = 0;

    while (true) {
        let q = c.from(tableName).select(select);
        if (typeof options.filter === 'function') {
            q = options.filter(q);
        }
        if (orderBy) {
            q = q.order(orderBy, { ascending });
        }
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) {
            console.error(`Error en fetchAllRows('${tableName}'):`, error);
            throw error;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
};

window.fetchAllQuery = async function(queryBuilderFn, pageSize = 1000) {
    let all = [];
    let from = 0;
    while (true) {
        const q = queryBuilderFn();
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) {
            console.error('Error en fetchAllQuery:', error);
            throw error;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
};

// ============================================================================
// 1. PROTECCIÓN GLOBAL DE SESIÓN (AUTH GUARD) Y BASE PARA PERFILES / ROLES
// ============================================================================
(function initKraemAuth() {
    const path = (window.location.pathname || '').toLowerCase();
    const fileName = path.split('/').pop() || 'index.html';
    const isLoginPage = (fileName === '' || fileName === 'index.html');

    // Mapa de módulos para control futuro por perfil/rol
    const MODULE_BY_PAGE = {
        'dashboard.html': 'dashboard', 'dashboard_kpi.html': 'dashboard',
        'configuracion_sistema.html': 'configuracion',
        'rh_empleados.html': 'rh_personal', 'admin_rh.html': 'rh_personal', 'rh_turnos.html': 'rh_personal',
        'rh_reporte_asistencia.html': 'rh_prenomina',
        'rh_solicitudes.html': 'rh_solicitudes',
        'rh_asistencia.html': 'rh_asistencia',
        'rh_evaluacion_5s.html': 'rh_5s', 'dashboard_5s.html': 'rh_5s',
        'rh_matriz_habilidades.html': 'rh_capacitacion', 'rh_capacitacion.html': 'rh_capacitacion',
        'admin_partes.html': 'ingenieria', 'admin_empaques.html': 'ingenieria', 'ingenieria_bom.html': 'ingenieria',
        'catalogo_moldes.html': 'ingenieria', 'admin_areas.html': 'ingenieria', 'ingenieria_catalogos.html': 'ingenieria',
        'catalogo_areas_generales.html': 'ingenieria', 'admin_ubicaciones.html': 'ingenieria', 'admin_maquinas.html': 'ingenieria',
        'catalogo_procesos.html': 'ingenieria', 'admin_defectos.html': 'ingenieria', 'catalogo_checklists.html': 'ingenieria',
        'catalogo_materiales.html': 'ingenieria', 'catalogo_clientes.html': 'ingenieria', 'ingenieria_nuevo_np.html': 'ingenieria',
        'part_ficha_tecnica.html': 'ingenieria', 'Admin.html': 'ingenieria',
        'planeacion_hub.html': 'planeacion', 'planeacion_mrp_forecast.html': 'planeacion', 'planeacion_aps_tablero.html': 'planeacion',
        'planeacion_montaje_moldes.html': 'planeacion', 'Planeacion.html': 'planeacion', 'planeacion_calendario_maquinas.html': 'planeacion',
        'planeacion_forecast.html': 'planeacion', 'planeacion_produccion.html': 'planeacion', 'planeacion_propuesta.html': 'planeacion',
        'planeacion_requerimientos.html': 'planeacion',
        'calidad_control.html': 'calidad', 'control_documental_iso.html': 'calidad', 'analisis.html': 'calidad',
        'produccion_inspeccion_captura.html': 'calidad', 'inspeccion_captura.html': 'calidad',
        'wms_operaciones.html': 'wms', 'consulta_fifo.html': 'wms', 'historial.html': 'wms', 'conteos_menu.html': 'wms',
        'captura_inventario.html': 'wms', 'ciclicos_lista.html': 'wms', 'inventarios.html': 'wms', 'inventarios_ubicacion.html': 'wms',
        'compras_ordenes.html': 'compras', 'compras_recibo.html': 'compras', 'catalogo_proveedores.html': 'compras',
        'catalogo_plantas.html': 'configuracion',
        'produccion_captura.html': 'produccion'
    };

    const currentModule = MODULE_BY_PAGE[path.split('/').pop()] || 'general';

    window.KraemAuth = {
        user: null,
        profile: null,
        role: 'ADMIN',
        permissions: null,
        ready: false,
        currentModule,
        MODULE_BY_PAGE,
        isHighRank: function () {
            const roleUpper = String(this.role || 'ADMIN').toUpperCase();
            const highRoles = (window.KraemSettings && window.KraemSettings.get('seguridad', 'high_rank_roles')) || ['ADMIN', 'SUPERADMIN', 'GERENCIA'];
            return highRoles.map(r => String(r).toUpperCase()).includes(roleUpper);
        },
        isStrictAdmin: function () {
            return String(this.role || 'ADMIN').toUpperCase() === 'ADMIN';
        },
        _resolveModulePerm: function (mod) {
            if (this.permissions && this.permissions[mod]) return this.permissions[mod];
            const matrix = window.KraemSettings && window.KraemSettings.get('seguridad', 'role_matrix');
            const roleUpper = String(this.role || '').toUpperCase();
            if (matrix && matrix[roleUpper] && matrix[roleUpper][mod]) return matrix[roleUpper][mod];
            return null;
        },
        hasModuleAccess: function (mod) {
            if (this.isHighRank()) return true;
            const p = this._resolveModulePerm(mod);
            if (!p) return mod !== 'configuracion';
            return p.view !== false;
        },
        canEdit: function (mod) {
            const target = mod || this.currentModule;
            if (this.isHighRank()) return true;
            const p = this._resolveModulePerm(target);
            if (!p) return !this.permissions;
            return p.edit === true;
        },
        getPlantId: function () {
            if (this.profile && this.profile.plant_id) return parseInt(this.profile.plant_id, 10);
            if (this.user && this.user.user_metadata && this.user.user_metadata.plant_id) {
                return parseInt(this.user.user_metadata.plant_id, 10);
            }
            return null;
        },
        canAccessPlant: function (plantId) {
            if (this.isHighRank()) return true;
            const assigned = this.getPlantId();
            if (!assigned) return true;
            return assigned === parseInt(plantId, 10);
        },
        canApproveRequests: function () {
            if (this.isHighRank()) return true;
            if (String(this.role || '').toUpperCase() === 'RH') return true;
            const p = this._resolveModulePerm('rh_prenomina');
            return p ? p.edit === true : false;
        },
        logout: async function () {
            try {
                if (client && client.auth) await client.auth.signOut();
            } catch (e) { console.warn(e); }
            window.location.replace('index.html');
        }
    };

    window.logout = function () { return window.KraemAuth.logout(); };

    if (isLoginPage || !client || !client.auth) {
        window.KraemAuth.ready = true;
        return;
    }

    // Ocultar contenido inmediatamente mientras se valida la sesión para evitar parpadeos sin login
    const gateStyle = document.createElement('style');
    gateStyle.id = 'kraem-auth-gate';
    gateStyle.textContent = 'html.kraem-checking body { opacity: 0 !important; pointer-events: none !important; }';
    document.documentElement.classList.add('kraem-checking');
    document.head.appendChild(gateStyle);

    function redirectToLogin() {
        const currentTarget = (window.location.pathname.split('/').pop() || 'dashboard.html') + window.location.search;
        window.location.replace('index.html?redirect=' + encodeURIComponent(currentTarget));
    }

    async function verifySession() {
        try {
            const { data, error } = await client.auth.getSession();
            if (error || !data || !data.session || !data.session.user) {
                redirectToLogin();
                return;
            }

            const user = data.session.user;
            window.KraemAuth.user = user;
            window.KraemAuth.role = (user.user_metadata && user.user_metadata.role) || 'ADMIN';

            // Cargar configuración global del sistema antes de evaluar permisos de módulo
            if (window.KraemSettings && typeof window.KraemSettings.load === 'function') {
                await window.KraemSettings.load();
            }

            // Intento opcional de cargar perfil/permisos desde `user_profiles` si la tabla ya existe
            try {
                const { data: prof, error: pErr } = await client
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (!pErr && prof) {
                    if (prof.active === false) {
                        alert('Tu usuario se encuentra desactivado. Contacta al Administrador.');
                        await window.KraemAuth.logout();
                        return;
                    }
                    window.KraemAuth.profile = prof;
                    if (prof.role) window.KraemAuth.role = prof.role;
                    if (prof.permissions) window.KraemAuth.permissions = prof.permissions;
                }
            } catch (_) { /* Tabla opcional aún no creada */ }

            if (!window.KraemAuth.hasModuleAccess(currentModule)) {
                alert('Tu perfil no tiene acceso a este módulo (' + currentModule + ').');
                window.location.replace('dashboard.html');
                return;
            }

            window.KraemAuth.ready = true;
            document.documentElement.classList.remove('kraem-checking');
            if (gateStyle.parentNode) gateStyle.parentNode.removeChild(gateStyle);
            document.dispatchEvent(new CustomEvent('kraem:authready', { detail: window.KraemAuth }));
        } catch (err) {
            console.error('Auth verify error:', err);
            redirectToLogin();
        }
    }

    client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            redirectToLogin();
        }
    });

    verifySession();
})();

// ============================================================================
// 2. SISTEMA GLOBAL DE 3 IDIOMAS (ES / KO / EN) SINCRONIZADO CON DASHBOARD
// ============================================================================
window.KraemI18n = (function () {
    const VALID = ['es', 'ko', 'en'];

    function getLang() {
        const stored = localStorage.getItem('lang') || localStorage.getItem('kraem_lang') || 'es';
        return VALID.includes(stored) ? stored : 'es';
    }

    function setLang(lang) {
        const next = VALID.includes(lang) ? lang : 'es';
        try {
            localStorage.setItem('lang', next);
            localStorage.setItem('kraem_lang', next);
        } catch(e) {}
        document.documentElement.setAttribute('lang', next);
        document.dispatchEvent(new CustomEvent('kraem:langchange', { detail: { lang: next } }));
        if (document.body) {
            applyCommonTextNodes();
        }
        return next;
    }

    // Traducciones comunes compartidas en botones/encabezados/tablas/módulos del sistema
    const COMMON_PHRASES = {
        'Volver al Dashboard': { ko: '대시보드로 돌아가기', en: 'Back to Dashboard' },
        'Volver': { ko: '뒤로', en: 'Back' },
        'Regresar': { ko: '돌아가기', en: 'Return' },
        'Inicio': { ko: '홈', en: 'Home' },
        'Dashboard': { ko: '대시보드', en: 'Dashboard' },
        'Configuración': { ko: '설정', en: 'Settings' },
        'Configuración del Sistema': { ko: '시스템 설정', en: 'System Settings' },
        'Cerrar Sesión': { ko: '로그아웃', en: 'Sign Out' },
        'Guardar': { ko: '저장', en: 'Save' },
        'Guardar Cambios': { ko: '변경 사항 저장', en: 'Save Changes' },
        'Cancelar': { ko: '취소', en: 'Cancel' },
        'Cerrar': { ko: '닫기', en: 'Close' },
        'Editar': { ko: '편집', en: 'Edit' },
        'Eliminar': { ko: '삭제', en: 'Delete' },
        'Nuevo': { ko: '신규', en: 'New' },
        'Nueva': { ko: '신규', en: 'New' },
        'Agregar': { ko: '추가', en: 'Add' },
        'Actualizar': { ko: '새로고침', en: 'Refresh' },
        'Actualizar Lista': { ko: '목록 새로고침', en: 'Refresh List' },
        'Buscar': { ko: '검색', en: 'Search' },
        'Buscar...': { ko: '검색...', en: 'Search...' },
        'Filtrar': { ko: '필터', en: 'Filter' },
        'Limpiar': { ko: '초기화', en: 'Clear' },
        'Exportar': { ko: '내보내기', en: 'Export' },
        'Exportar Excel': { ko: 'Excel 내보내기', en: 'Export Excel' },
        'Exportar CSV': { ko: 'CSV 내보내기', en: 'Export CSV' },
        'Imprimir': { ko: '인쇄', en: 'Print' },
        'Ver': { ko: '보기', en: 'View' },
        'Detalle': { ko: '상세', en: 'Details' },
        'Detalles': { ko: '상세 정보', en: 'Details' },
        'Activo': { ko: '활성', en: 'Active' },
        'ACTIVO': { ko: '활성', en: 'ACTIVE' },
        'ACTIVA': { ko: '활성', en: 'ACTIVE' },
        'Inactivo': { ko: '비활성', en: 'Inactive' },
        'INACTIVO': { ko: '비활성', en: 'INACTIVE' },
        'INACTIVA': { ko: '비활성', en: 'INACTIVE' },
        'Cargando...': { ko: '불러오는 중...', en: 'Loading...' },
        'Sin registros': { ko: '등록된 데이터가 없습니다', en: 'No records' },
        'No hay registros': { ko: '등록된 데이터가 없습니다', en: 'No records found' },
        'Código': { ko: '코드', en: 'Code' },
        'Nombre': { ko: '이름', en: 'Name' },
        'Descripción': { ko: '설명', en: 'Description' },
        'Estatus': { ko: '상태', en: 'Status' },
        'Estado': { ko: '상태', en: 'Status' },
        'Acciones': { ko: '작업', en: 'Actions' },
        'Acción': { ko: '작업', en: 'Action' },
        'Fecha': { ko: '날짜', en: 'Date' },
        'Desde': { ko: '시작일', en: 'From' },
        'Hasta': { ko: '종료일', en: 'To' },
        'Hora': { ko: '시간', en: 'Time' },
        'Área': { ko: '구역', en: 'Area' },
        'Áreas': { ko: '구역', en: 'Areas' },
        'Áreas Generales': { ko: '전체 구역', en: 'General Areas' },
        'Ubicación': { ko: '위치', en: 'Location' },
        'Ubicaciones': { ko: '위치', en: 'Locations' },
        'Puesto': { ko: '직책', en: 'Position' },
        'Turno': { ko: '교대', en: 'Shift' },
        'Turnos': { ko: '교대 근무', en: 'Shifts' },
        'Máquina': { ko: '설비', en: 'Machine' },
        'Máquinas': { ko: '설비', en: 'Machines' },
        'Molde': { ko: '금형', en: 'Mold' },
        'Moldes': { ko: '금형', en: 'Molds' },
        'Número de Parte': { ko: '품번 (N/P)', en: 'Part Number' },
        'No. Parte': { ko: '품번', en: 'Part No.' },
        'N/P': { ko: '품번', en: 'P/N' },
        'Material': { ko: '자재', en: 'Material' },
        'Materiales': { ko: '자재', en: 'Materials' },
        'Cliente': { ko: '고객사', en: 'Customer' },
        'Clientes': { ko: '고객사', en: 'Customers' },
        'Cantidad': { ko: '수량', en: 'Quantity' },
        'Piezas': { ko: '수량(EA)', en: 'Pieces' },
        'Peso': { ko: '중량', en: 'Weight' },
        'Cavidades': { ko: '캐비티', en: 'Cavities' },
        'Tiempo Ciclo': { ko: '사이클 타임', en: 'Cycle Time' },
        'Observaciones': { ko: '비고', en: 'Observations' },
        'Comentarios': { ko: '의견', en: 'Comments' },
        'Notas': { ko: '메모', en: 'Notes' },
        'Responsable': { ko: '담당자', en: 'Responsible' },
        'Usuario': { ko: '사용자', en: 'User' },
        'Usuarios': { ko: '사용자', en: 'Users' },
        'Rol': { ko: '권한', en: 'Role' },
        'Total': { ko: '합계', en: 'Total' },
        // Ingeniería
        'Ingeniería': { ko: '엔지니어링', en: 'Engineering' },
        'Catálogos Ingeniería': { ko: '엔지니어링 카탈로그', en: 'Engineering Catalogs' },
        'Administración maestra del sistema KRAEM': { ko: 'KRAEM 시스템 마스터 관리', en: 'KRAEM System Master Administration' },
        'Estructura Organizacional': { ko: '조직 구조', en: 'Organizational Structure' },
        'Procesos': { ko: '공정', en: 'Processes' },
        'Defectos': { ko: '불량 유형', en: 'Defects' },
        'Checklists': { ko: '체크리스트', en: 'Checklists' },
        'Empaques y Cajas': { ko: '포장 및 박스', en: 'Packaging & Boxes' },
        'Catálogo de N/P': { ko: '품번 카탈로그', en: 'Part Number Catalog' },
        'Matriz de Moldes': { ko: '금형 매트릭스', en: 'Mold Matrix' },
        'Administración de Áreas': { ko: '구역 관리', en: 'Area Administration' },
        // Planeación & Producción
        'Planeación': { ko: '생산 계획', en: 'Planning' },
        'Producción': { ko: '생산', en: 'Production' },
        'Tablero APS & Máquinas': { ko: 'APS 및 설비 현황판', en: 'APS & Machine Board' },
        'Montaje de Moldes (SMED)': { ko: '금형 교체 (SMED)', en: 'Mold Setup (SMED)' },
        'Captura de Producción': { ko: '생산 실적 입력', en: 'Production Entry' },
        'Piezas Buenas': { ko: '양품 수량', en: 'Good Pieces' },
        'Scrap': { ko: '불량(Scrap)', en: 'Scrap' },
        'Tiempo Muerto': { ko: '비가동 시간', en: 'Downtime' },
        'Orden de Producción': { ko: '생산 지시서', en: 'Production Order' },
        'Requerimientos': { ko: '소요량', en: 'Requirements' },
        // WMS & Calidad
        'Almacén / WMS': { ko: '창고 / WMS', en: 'Warehouse / WMS' },
        'Inventarios': { ko: '재고 현황', en: 'Inventory' },
        'Consulta FIFO': { ko: '선입선출(FIFO) 조회', en: 'FIFO Lookup' },
        'Conteos Cíclicos': { ko: '순환 재고 조사', en: 'Cycle Counts' },
        'Captura de Inventario': { ko: '재고 입력', en: 'Inventory Capture' },
        'Historial de Movimientos': { ko: '이동 이력', en: 'Movement History' },
        'Operaciones WMS': { ko: 'WMS 작업', en: 'WMS Operations' },
        'Lote': { ko: '로트(Lot)', en: 'Lot' },
        'Entrada': { ko: '입고', en: 'Inbound' },
        'Salida': { ko: '출고', en: 'Outbound' },
        'Transferencia': { ko: '이동', en: 'Transfer' },
        'Calidad': { ko: '품질', en: 'Quality' },
        'Control de Calidad': { ko: '품질 관리', en: 'Quality Control' },
        'Inspección': { ko: '검사', en: 'Inspection' },
        'Control Documental ISO': { ko: 'ISO 문서 관리', en: 'ISO Document Control' },
        'Análisis y Paretos': { ko: '분석 및 파레토', en: 'Analysis & Pareto' },
        // RH
        'Recursos Humanos': { ko: '인사 관리 (HR)', en: 'Human Resources' },
        'Personal': { ko: '직원', en: 'Personnel' },
        'Expedientes de Personal': { ko: '인사 기록부', en: 'Employee Records' },
        'Asistencia': { ko: '출결 관리', en: 'Attendance' },
        'Pase de Lista': { ko: '출석 체크', en: 'Roll Call' },
        'Solicitudes y Permisos': { ko: '휴가 및 외출 신청', en: 'Leave Requests' },
        'Capacitación': { ko: '교육 훈련', en: 'Training' },
        'Matriz de Habilidades': { ko: '스킬 매트릭스', en: 'Skills Matrix' },
        'Evaluación 5S': { ko: '5S 평가', en: '5S Evaluation' },
        'Pendiente': { ko: '대기 중', en: 'Pending' },
        'PENDIENTE': { ko: '대기 중', en: 'PENDING' },
        'Aprobado': { ko: '승인됨', en: 'Approved' },
        'APROBADO': { ko: '승인됨', en: 'APPROVED' },
        'Autorizado': { ko: '승인됨', en: 'Authorized' },
        'Rechazado': { ko: '반려됨', en: 'Rejected' },
        'RECHAZADO': { ko: '반려됨', en: 'REJECTED' },
        'Autorizar': { ko: '승인', en: 'Approve' },
        'Rechazar': { ko: '반려', en: 'Reject' }
    };

    // ------------------------------------------------------------------------
    // Motor de traducción: frases exactas + patrones (regex) + atributos + diálogos.
    // Los módulos registran sus textos con KraemI18n.register({ phrases, patterns }).
    // ------------------------------------------------------------------------
    const LOCALES = { es: 'es-MX', ko: 'ko-KR', en: 'en-US' };
    const extraPhrases = {};
    const patterns = [];
    const seenExtra = new WeakSet();
    const textState = new WeakMap(); // nodo de texto -> { orig, applied }
    const attrState = new WeakMap(); // elemento -> { attr: { orig, applied } }
    const TEXT_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
    const SYMS = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;
    const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
    let version = 0;
    let indexCache = { exact: null, lower: null, ver: -1 };

    function t(dict, key, fallback) {
        const lang = getLang();
        if (dict && dict[lang] && dict[lang][key] !== undefined) return dict[lang][key];
        if (dict && dict.es && dict.es[key] !== undefined) return dict.es[key];
        return fallback !== undefined ? fallback : key;
    }

    function locale() { return LOCALES[getLang()] || 'es-MX'; }

    function register(pack) {
        if (!pack) return;
        if (pack.phrases) Object.assign(extraPhrases, pack.phrases);
        if (Array.isArray(pack.patterns)) {
            pack.patterns.forEach(p => {
                try { patterns.push({ re: new RegExp(p.re), ko: p.ko, en: p.en }); }
                catch (e) { console.warn('[KraemI18n] patrón inválido:', p && p.re); }
            });
        }
        version++;
        if (document.body && getLang() !== 'es') applyCommonTextNodes();
    }

    function getIndex() {
        if (indexCache.exact && indexCache.ver === version) return indexCache;
        const exact = Object.assign({}, COMMON_PHRASES, extraPhrases);
        const lower = {};
        Object.keys(exact).forEach(k => {
            const lk = k.trim().replace(/\s+/g, ' ').toLowerCase();
            if (!(lk in lower)) lower[lk] = exact[k];
        });
        indexCache = { exact, lower, ver: version };
        return indexCache;
    }

    function lookupCore(core, lang, idx) {
        const hit = idx.exact[core];
        if (hit && hit[lang]) return hit[lang];
        const norm = core.replace(/\s+/g, ' ');
        const lh = idx.lower[norm.toLowerCase()];
        if (lh && lh[lang]) {
            let out = lh[lang];
            const letters = norm.replace(/[^\p{L}]/gu, '');
            if (letters.length > 1 && norm === norm.toUpperCase()) return out.toUpperCase();
            if (lang === 'en' && norm[0] !== norm[0].toLowerCase() && out[0] !== out[0].toUpperCase()) {
                out = out[0].toUpperCase() + out.slice(1);
            }
            return out;
        }
        for (let i = 0; i < patterns.length; i++) {
            const p = patterns[i];
            if (p[lang] !== undefined && p.re.test(norm)) return norm.replace(p.re, p[lang]);
        }
        return null;
    }

    // Devuelve el texto traducido conservando espacios/emojis/puntuación alrededor, o null si no hay traducción.
    function translateText(raw, lang, idx) {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        let r = lookupCore(trimmed, lang, idx);
        if (r !== null) return raw.replace(trimmed, () => r);
        const m = SYMS.exec(trimmed);
        if (m && m[2] && m[2] !== trimmed) {
            r = lookupCore(m[2], lang, idx);
            if (r !== null) return raw.replace(trimmed, () => m[1] + r + m[3]);
        }
        return null;
    }

    // Traduce un mensaje suelto (alert/confirm/toasts generados por JS). En ES devuelve el mismo texto.
    function tr(str) {
        if (str === null || str === undefined) return str;
        const s = String(str);
        const lang = getLang();
        if (lang === 'es') return s;
        const idx = getIndex();
        const whole = translateText(s, lang, idx);
        if (whole !== null) return whole;
        if (s.indexOf('\n') === -1) return s;
        return s.split('\n').map(line => {
            const r = translateText(line, lang, idx);
            return r !== null ? r : line;
        }).join('\n');
    }

    function processTextNode(n, lang, idx) {
        let st = textState.get(n);
        if (!st) {
            st = { orig: n.nodeValue, applied: null };
            textState.set(n, st);
        } else if (n.nodeValue !== st.orig && n.nodeValue !== st.applied) {
            // El JS de la página reescribió el nodo: tomar el nuevo valor como original
            st.orig = n.nodeValue;
            st.applied = null;
        }
        const next = lang === 'es' ? null : translateText(st.orig, lang, idx);
        const target = next !== null ? next : st.orig;
        if (n.nodeValue !== target) n.nodeValue = target;
        st.applied = next;
    }

    function processAttr(el, attr, lang, idx) {
        if (!el.hasAttribute(attr)) return;
        let states = attrState.get(el);
        if (!states) { states = {}; attrState.set(el, states); }
        const cur = el.getAttribute(attr);
        let st = states[attr];
        if (!st) {
            st = { orig: cur, applied: null };
            states[attr] = st;
        } else if (cur !== st.orig && cur !== st.applied) {
            st.orig = cur;
            st.applied = null;
        }
        const next = lang === 'es' ? null : translateText(st.orig || '', lang, idx);
        const target = next !== null ? next : st.orig;
        if (cur !== target) el.setAttribute(attr, target);
        st.applied = next;
    }

    function applyElements(dict) {
        const lang = getLang();
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const k = el.getAttribute('data-i18n');
            const val = t(dict, k, null);
            if (val !== null) el.textContent = val;
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const k = el.getAttribute('data-i18n-html');
            const val = t(dict, k, null);
            if (val !== null) el.innerHTML = val;
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const k = el.getAttribute('data-i18n-ph');
            const val = t(dict, k, null);
            if (val !== null) el.setAttribute('placeholder', val);
        });
        document.documentElement.setAttribute('lang', lang);
    }

    function applyCommonTextNodes(extraMap) {
        if (!document.body) return;
        if (extraMap && !seenExtra.has(extraMap)) {
            seenExtra.add(extraMap);
            Object.assign(extraPhrases, extraMap);
            version++;
        }
        const lang = getLang();
        const idx = getIndex();

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) {
            const p = n.parentElement;
            if (!p || SKIP_TAGS[p.tagName]) continue;
            if (p.closest('[data-i18n], [data-i18n-html], .notranslate, [translate="no"]')) continue;
            nodes.push(n);
        }
        nodes.forEach(node => processTextNode(node, lang, idx));

        const titleEl = document.querySelector('title');
        if (titleEl && titleEl.firstChild && titleEl.firstChild.nodeType === 3) processTextNode(titleEl.firstChild, lang, idx);

        const sel = TEXT_ATTRS.map(a => '[' + a + ']').join(',') + ',input[type=button],input[type=submit],input[type=reset]';
        document.querySelectorAll(sel).forEach(el => {
            if (el.closest('.notranslate, [translate="no"]')) return;
            TEXT_ATTRS.forEach(a => processAttr(el, a, lang, idx));
            if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type)) processAttr(el, 'value', lang, idx);
        });
    }

    // alert / confirm / prompt también siguen el idioma elegido
    ['alert', 'confirm', 'prompt'].forEach(name => {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__kraemI18n) return;
        const wrapped = function (msg, def) {
            return name === 'prompt' ? orig.call(window, tr(msg), def) : orig.call(window, tr(msg));
        };
        wrapped.__kraemI18n = true;
        window[name] = wrapped;
    });

    return { getLang, setLang, t, tr, locale, register, applyElements, applyCommonTextNodes, COMMON_PHRASES };
})();

/* i18n_master.js - Diccionario Maestro Unificado de KRAEM MRP (ES / KO / EN) */
if (window.KraemI18n) {
  window.KraemI18n.register({
    phrases: {
      "➕ Asignar Número de Parte a este Contenedor": { ko: "➕ 이 전용 대차/용기에 품번(N/P) 매핑", en: "➕ Assign Part Number to this Container" },
      "-- Selecciona un motivo obligatorio --": { ko: "-- 필수 사유를 선택하세요 --", en: "-- Select required reason --" },
      "-- Sin ubicación fija --": { ko: "-- 고정 로케이션 없음 --", en: "-- No fixed location --" },
      "% Capacitación por Área": { ko: "구역별 교육 훈련 이수율 %", en: "% Training by Area" },
      "% Defecto": { ko: "불량 점유율 %", en: "% Defect" },
      "% Merma / Scrap": { ko: "% 스크랩 / 손실률", en: "% Scrap / Loss" },
      "% Merma / Scrap Estándar": { ko: "% 표준 스크랩 및 공정 손실률", en: "% Standard Scrap / Loss" },
      "% RECHAZO": { ko: "% 불량률", en: "% REJECTION" },
      "% Remolido Permitido": { ko: "% 분쇄재(재생재) 허용 배합률", en: "% Regrind Allowed" },
      "% Scrap / Remol.": { ko: "% 스크랩 / 분쇄재 배합비", en: "% Scrap / Regrind" },
      "(-) Negativo": { ko: "(-) 차감 (감소)", en: "(-) Negative" },
      "(-) Negativo (Falta / Merma)": { ko: "(-) 마이너스 조정 (부족 / 손실)", en: "(-) Negative (Shortage / Loss)" },
      "(+) Positivo": { ko: "(+) 가산 (증가)", en: "(+) Positive" },
      "(+) Positivo (Sobra inventario)": { ko: "(+) 플러스 조정 (재고 과잉)", en: "(+) Positive (Excess inventory)" },
      ", además de líneas de firma autógrafa cuando se usa en piso.": { ko: ", 현장 사용 시 자필 서명란이 포함됩니다.", en: ", plus signature lines when used on the shop floor." },
      "¿Aplica uso de Jigs / Dispositivos en la estación?": { ko: "해당 공정에 지그 및 보조기구를 사용합니까?", en: "Does station apply Jigs / Fixtures?" },
      "¿Principal?": { ko: "주 사양?", en: "Primary?" },
      "¿Requiere Checklist?": { ko: "체크리스트 필수 여부?", en: "Requires Checklist?" },
      "¿Requiere Molde?": { ko: "금형 필요 여부?", en: "Requires Mold?" },
      "⏰ Estado de Conteo": { ko: "⏰ 실사 진행 상태", en: "⏰ Count Status" },
      "+ Agregar Operador": { ko: "+ 작업자 추가", en: "+ Add Operator" },
      "+ Agregar Parte": { ko: "+ 품번 추가", en: "+ Add Part" },
      "+ Agregar Ubicación / Carrito Hallado": { ko: "+ 현장 발견 로케이션/대차 추가", en: "+ Add Found Location / Cart" },
      "= totales": { ko: "= 전체 합계", en: "= totals" },
      "⬅ Planeación": { ko: "⬅ 생산 계획", en: "⬅ Planning" },
      "☑️ Los Materiales Seleccionados con Palomita en la Pestaña 1": { ko: "☑️ 1번 탭에서 체크된 품목들", en: "☑️ Materials Checked in Tab 1" },
      "✅ ESTATUS DE VIGENCIA": { ko: "✅ 문서 유효 상태", en: "✅ VALIDITY STATUS" },
      "✅ LIBERADO": { ko: "✅ 초품 승인 완료 (양산 개시)", en: "✅ RELEASED" },
      "✅ Sí (Oficial)": { ko: "✅ 예 (공식 승인)", en: "✅ Yes (Official)" },
      "⚠️ ¿Es Parcial? (Caja/Carro incompleto)": { ko: "⚠️ 미달 박스입니까? (부분 수량)", en: "⚠️ Is Partial? (Incomplete box/cart)" },
      "⚠️ Ajuste Manual (Restar o descontar saldo)": { ko: "⚠️ 수동 잔여일수 조정 (차감/가산)", en: "⚠️ Manual Adjustment (Deduct or adjust balance)" },
      "⚠️ Alternativo": { ko: "⚠️ 대체 사양", en: "⚠️ Alternative" },
      "⚠️ Corto Material (Shortage)": { ko: "⚠️ 자재 결품 (쇼티지 발생)", en: "⚠️ Material Shortage" },
      "⚡ WMS Estación Operativa Unificada": { ko: "⚡ WMS 통합 운영 작업 스테이션", en: "⚡ WMS Unified Operations Station" },
      "⚙️ Producción OK": { ko: "⚙️ 정상 가동 중", en: "⚙️ Production OK" },
      "⚪ Nunca Auditados": { ko: "⚪ 미실사 품목 (실사 이력 없음)", en: "⚪ Never Audited" },
      "0 - No conoce / Solo teoría": { ko: "0단계 - 미숙지 / 이론만 인지", en: "0 - Unfamiliar / Theory only" },
      "0 Cav": { ko: "0 캐비티", en: "0 Cav" },
      "0 Cav.": { ko: "0 캐비티", en: "0 Cav." },
      "0 días": { ko: "0일", en: "0 Days" },
      "0 h": { ko: "0시간", en: "0 h" },
      "0 PZA": { ko: "0개", en: "0 PCS" },
      "0 PZA/Día": { ko: "0개/일", en: "0 PCS/Day" },
      "0 pzs": { ko: "0개", en: "0 pcs" },
      "0 Seg": { ko: "0초", en: "0 Sec" },
      "0 Seg.": { ko: "0초", en: "0 Sec." },
      "0.0 g": { ko: "0.0 g", en: "0.0 g" },
      "0h": { ko: "0시간", en: "0h" },
      "1 - En formación / Bajo supervisión": { ko: "1단계 - 교육 중 / 전담 지도 감독 필요", en: "1 - In training / Under supervision" },
      "1 Principiante · supervisión 100": { ko: "1 초급 · 100% 전담 지도 감독", en: "1 Beginner · 100% supervision" },
      "1 Principiante · supervisión 100%": { ko: "1 초급 · 100% 전담 지도 감독", en: "1 Beginner · 100% supervision" },
      "1. ¿Qué materiales deseas incluir en el PDF": { ko: "1. PDF에 포함할 품목을 선택하세요", en: "1. Which materials do you want in PDF" },
      "1. ¿Qué materiales deseas incluir en el PDF?": { ko: "1. PDF에 포함할 품목을 선택하세요", en: "1. Which materials do you want in PDF?" },
      "1. Compatibilidad Máquina ↔ Molde (Tonelaje / Barras": { ko: "1. 설비 ↔ 금형 호환성 검증 (형체력 톤수 / 타이바 간격", en: "1. Machine ↔ Mold Compatibility (Tonnage / Tie Bars" },
      "1. Compatibilidad Máquina ↔ Molde (Tonelaje / Barras)": { ko: "1. 설비 ↔ 금형 호환성 검증 (형체력 톤수 / 타이바 간격)", en: "1. Machine ↔ Mold Compatibility (Tonnage / Tie Bars)" },
      "1. CONTEO ABC DEL DÍA": { ko: "1. 오늘의 ABC 순환조사", en: "1. TODAY'S ABC CYCLE COUNT" },
      "1. Demanda, Excel Masivo & MPS": { ko: "1. 수요 관리, 엑셀 대량 업로드 및 MPS", en: "1. Demand, Bulk Excel & MPS" },
      "1. ENTRADA": { ko: "1. 입고 (ENTRADA)", en: "1. INBOUND" },
      "1. Hojas de Ruta y Versiones por N/P": { ko: "1. 품번별 공정 라우팅 및 생산 버전", en: "1. Routings & Versions per P/N" },
      "1. Identificación Básica": { ko: "1. 품번 기본 식별 정보", en: "1. Basic Identification" },
      "1. Nomenclatura Estándar (`KR-SYS-XX-0000": { ko: "1. 표준 명명 체계 (`KR-SYS-XX-0000", en: "1. Standard Nomenclature (`KR-SYS-XX-0000" },
      "1. Nomenclatura Estándar (`KR-SYS-XX-0000`)": { ko: "1. 표준 명명 체계 (`KR-SYS-XX-0000`)", en: "1. Standard Nomenclature (`KR-SYS-XX-0000`)" },
      "1. P/N RUTA FIFO": { ko: "1. 품번별 FIFO 추천 경로", en: "1. P/N FIFO ROUTE" },
      "1. Seleccionar Orden de Compra Pendiente": { ko: "1. 미입고 발주서(PO) 선택", en: "1. Select Pending Purchase Order" },
      "1. Tipo de Barrido a Realizar": { ko: "1. 진행할 실사 스캔 유형", en: "1. Sweep Type to Perform" },
      "100% VIGENTE": { ko: "100% 유효 (개정본)", en: "100% CURRENT (VALID)" },
      "11 dígitos": { ko: "11자리 숫자", en: "11 digits" },
      "14 Días (Quincenal": { ko: "14일 (2주간 계획", en: "14 Days (Biweekly" },
      "14 Días (Quincenal)": { ko: "14일 (2주간 계획)", en: "14 Days (Biweekly)" },
      "2 - Experto / Puede enseñar": { ko: "2단계 - 숙련자 / 타인 교육 지도 가능", en: "2 - Expert / Can teach others" },
      "2 Básico · supervisión intermitente": { ko: "2 중급 · 간헐적 감독 하 작업 가능", en: "2 Basic · intermittent supervision" },
      "2. BARRIDO POR UBICACIÓN / QR": { ko: "2. 로케이션 / QR 전수 조사", en: "2. LOCATION / QR SWEEP" },
      "2. Catálogo Maestro de Procesos": { ko: "2. 표준 공정 마스터 카탈로그", en: "2. Master Process Catalog" },
      "2. Escribe o Escanea Ubicación / Carrito": { ko: "2. 로케이션 또는 대차 QR 스캔", en: "2. Enter or Scan Location / Cart" },
      "2. Escribe o Escanea Ubicación / Carrito *": { ko: "2. 로케이션 또는 대차 QR 스캔 *", en: "2. Enter or Scan Location / Cart *" },
      "2. Explosión MRP de Resinas y Componentes": { ko: "2. 레진 및 부품 MRP 자재 소요량 전개", en: "2. MRP Explosion of Resins & Components" },
      "2. Fotografía": { ko: "2. 제품 외관 사진", en: "2. Photograph" },
      "2. Modalidad de la Hoja Impresa": { ko: "2. 실사 시트 출력 양식", en: "2. Printed Sheet Mode" },
      "2. Partidas a Recibir en WMS": { ko: "2. WMS 입고 검수 품목", en: "2. Line Items to Receive in WMS" },
      "2. Pie de Página Controlado en PDF y Excel": { ko: "2. PDF 및 엑셀 관리 번호 하단 표기", en: "2. Controlled Footer in PDF and Excel" },
      "2. SALIDA (FIFO": { ko: "2. 출고 (FIFO", en: "2. OUTBOUND (FIFO" },
      "2. SALIDA (FIFO)": { ko: "2. 출고 (FIFO)", en: "2. OUTBOUND (FIFO)" },
      "2. Salud PM del Molde (Disparos actuales vs Intervalo": { ko: "2. 금형 예방보전 상태 (현재 쇼트수 vs 점검 주기", en: "2. Mold PM Health (Current shots vs Interval" },
      "2. Salud PM del Molde (Disparos actuales vs Intervalo)": { ko: "2. 금형 예방보전 상태 (현재 쇼트수 vs 점검 주기)", en: "2. Mold PM Health (Current shots vs Interval)" },
      "2. Selecciona el Área a Auditar": { ko: "2. 실사 대상 구역 선택", en: "2. Select Area to Audit" },
      "2. Selecciona el Área a Auditar *": { ko: "2. 실사 대상 구역 선택 *", en: "2. Select Area to Audit *" },
      "2. UBICACIÓN FIJA": { ko: "2. 고정 보관 로케이션", en: "2. FIXED LOCATION" },
      "3 Días (Detalle por Turno": { ko: "3일 (교대조별 상세 일정", en: "3 Days (Shift Detail" },
      "3 Días (Detalle por Turno)": { ko: "3일 (교대조별 상세 일정)", en: "3 Days (Shift Detail)" },
      "3 Regular · sin supervisión": { ko: "3 숙련 · 단독 작업 가능 (감독 불필요)", en: "3 Regular · unsupervised" },
      "3. CARRITO MÓVIL": { ko: "3. 이동식 대차 (카트)", en: "3. MOBILE CART" },
      "3. Especificaciones de Inyección": { ko: "3. 사출 성형 기술 조건 사양", en: "3. Injection Specifications" },
      "3. HOJA IMPRIMIBLE (CIEGA": { ko: "3. 출력용 실사 시트 (블라인드", en: "3. PRINTABLE SHEET (BLIND" },
      "3. HOJA IMPRIMIBLE (CIEGA)": { ko: "3. 출력용 실사 시트 (블라인드)", en: "3. PRINTABLE SHEET (BLIND)" },
      "3. Inmutabilidad y Bitácora de Auditoría": { ko: "3. 위변조 방지 및 감사 추적 일지", en: "3. Immutability & Audit Trail" },
      "3. Material Surtido por WMS a pie de máquina": { ko: "3. WMS 현장 자재 키팅 및 공급 완료 상태", en: "3. WMS Material Kitting to Machine" },
      "3. Nombre del Auditor Asignado (Opcional": { ko: "3. 담당 실사자 성명 (선택사항", en: "3. Assigned Auditor Name (Optional" },
      "3. Nombre del Auditor Asignado (Opcional)": { ko: "3. 담당 실사자 성명 (선택사항)", en: "3. Assigned Auditor Name (Optional)" },
      "3. REUBICAR": { ko: "3. 재고 이동 (이송)", en: "3. RELOCATE" },
      "4 Dominio · experto": { ko: "4 마스터 · 최고 숙련 (지도자 수준)", en: "4 Master · expert" },
      "4. AJUSTES": { ko: "4. 재고 조정", en: "4. ADJUSTMENTS" },
      "4. Estatus, Logística y MRP (SAP MM": { ko: "4. 품번 상태, 물류 및 MRP (SAP MM", en: "4. Status, Logistics & MRP (SAP MM" },
      "4. Estatus, Logística y MRP (SAP MM)": { ko: "4. 품번 상태, 물류 및 MRP (SAP MM)", en: "4. Status, Logistics & MRP (SAP MM)" },
      "4. INVENTARIO Y ESTATUS": { ko: "4. 재고 현황 및 품질 상태", en: "4. INVENTORY & STATUS" },
      "4. KPI VERACIDAD E HISTORIAL": { ko: "4. 재고 정확도 KPI 및 이력", en: "4. ACCURACY KPI & HISTORY" },
      "5 AÑOS (NUBE + PDF": { ko: "5년 (클라우드 + PDF", en: "5 YEARS (CLOUD + PDF" },
      "5 AÑOS (NUBE + PDF)": { ko: "5년 (클라우드 + PDF)", en: "5 YEARS (CLOUD + PDF)" },
      "5. Estructura de Materiales (BOM": { ko: "5. BOM (자재명세서) 구조", en: "5. Bill of Materials (BOM) Structure" },
      "5. Estructura de Materiales (BOM)": { ko: "5. BOM (자재명세서) 구조", en: "5. Bill of Materials (BOM) Structure" },
      "5. REVERSAS": { ko: "5. 수불 역분개 (취소)", en: "5. REVERSALS" },
      "7 Días (Semanal": { ko: "7일 (주간 계획", en: "7 Days (Weekly" },
      "7 Días (Semanal)": { ko: "7일 (주간 계획)", en: "7 Days (Weekly)" },
      "Abasto Externo": { ko: "외주 및 외부 공급", en: "External Supply" },
      "Abril": { ko: "4월", en: "April" },
      "Abrir Boceto Forecast & MRP": { ko: "판매예측 & MRP 초안 열기", en: "Open Forecast & MRP Draft" },
      "Abrir Boceto Montaje SMED": { ko: "SMED 금형교체 계획 열기", en: "Open SMED Setup Draft" },
      "Abrir en Correo (Outlook / Gmail": { ko: "이메일 프로그램으로 열기 (Outlook / Gmail", en: "Open in Email (Outlook / Gmail" },
      "Abrir en Correo (Outlook / Gmail)": { ko: "이메일 프로그램으로 열기 (Outlook / Gmail)", en: "Open in Email (Outlook / Gmail)" },
      "Abrir Tablero APS": { ko: "APS 현황판 열기", en: "Open APS Board" },
      "ACABADO": { ko: "후가공 / 마감", en: "FINISHING" },
      "Acceso de solo lectura: únicamente usuarios de alto rango (ADMIN / GERENCIA) pueden guardar cambios en Configuración": { ko: "읽기 전용 모드: 상위 직급(관리자/경영진)만 시스템 설정을 변경할 수 있습니다", en: "Read-only access: only high-ranking users (ADMIN / MANAGEMENT) can save changes in Settings" },
      "Acceso de solo lectura: únicamente usuarios de alto rango (ADMIN / GERENCIA) pueden guardar cambios en Configuración.": { ko: "읽기 전용 모드: 상위 직급(관리자/경영진)만 시스템 설정을 변경할 수 있습니다.", en: "Read-only access: only high-ranking users (ADMIN / MANAGEMENT) can save changes in Settings." },
      "Acceso MRP - KRAEM": { ko: "KRAEM MRP 로그인", en: "KRAEM MRP Login" },
      "ACEPTADO (PZS": { ko: "합격 수량 (EA", en: "ACCEPTED (PCS" },
      "ACEPTADO (PZS)": { ko: "합격 수량 (EA)", en: "ACCEPTED (PCS)" },
      "Activar": { ko: "활성화", en: "Activate" },
      "Activos": { ko: "활성 품목", en: "Active" },
      "Actualizar Contraseña": { ko: "비밀번호 변경", en: "Update Password" },
      "además de líneas de firma autógrafa cuando se usa en piso": { ko: "현장 사용 시 자필 서명란이 포함됩니다", en: "plus signature lines when used on the shop floor" },
      "ADMIN": { ko: "관리자", en: "ADMIN" },
      "ADMIN, SUPERADMIN, GERENCIA": { ko: "관리자, 최고관리자, 경영진", en: "ADMIN, SUPERADMIN, MANAGEMENT" },
      "Administración de Áreas": { ko: "공장 세부 구역 관리", en: "Area Administration" },
      "Administración de clientes, plantas y contactos principales": { ko: "고객사, 납품 공장 및 주요 담당자 정보 관리", en: "Customer, plant and main contact administration" },
      "Administración de clientes, plantas y contactos principales.": { ko: "고객사, 납품 공장 및 주요 담당자 정보 관리.", en: "Customer, plant and main contact administration." },
      "Administración de inyectoras, airbag, verticales, gas y equipos": { ko: "사출 성형기, 에어백, 수직 성형기, 가스 사출 및 부대 설비 관리", en: "Administration of injection presses, airbag, vertical, gas and equipment" },
      "Administración de inyectoras, airbag, verticales, gas y equipos.": { ko: "사출 성형기, 에어백, 수직 성형기, 가스 사출 및 부대 설비 관리.", en: "Administration of injection presses, airbag, vertical, gas and equipment." },
      "Administración de Máquinas": { ko: "사출 성형기 및 설비 관리", en: "Machine Administration" },
      "Administración de Personal - KRAEM": { ko: "KRAEM 인사 관리 시스템", en: "KRAEM Personnel Administration" },
      "Administración de personal, expedientes y evaluación operativa": { ko: "인사 기록부, 직원 프로필 및 현장 운영 평가 관리", en: "Personnel administration, records and operational evaluation" },
      "Administración de personal, expedientes y evaluación operativa.": { ko: "인사 기록부, 직원 프로필 및 현장 운영 평가 관리.", en: "Personnel administration, records and operational evaluation." },
      "Administración de ubicaciones físicas y contenedores del sistema": { ko: "공장 내 실물 보관 로케이션 및 운반 용기 마스터 관리", en: "Administration of physical locations and containers in the system" },
      "Administración maestra del sistema KRAEM": { ko: "KRAEM 제조 마스터 기준정보 총괄 관리", en: "KRAEM Master Data Administration" },
      "ADMINISTRADOR": { ko: "시스템 관리자", en: "ADMINISTRATOR" },
      "Administrar áreas": { ko: "구역 관리", en: "Manage Areas" },
      "Administrar áreas del almacén": { ko: "창고 구역 관리", en: "Manage Warehouse Areas" },
      "Agosto": { ko: "8월", en: "August" },
      "Agregar a la Tabla": { ko: "테이블에 추가", en: "Add to Table" },
      "AGREGAR AL CATÁLOGO": { ko: "기준정보 카탈로그에 등록", en: "ADD TO CATALOG" },
      "Agregar Elemento al BOM": { ko: "BOM에 원자재/부품 추가", en: "Add Item to BOM" },
      "AGREGAR MATERIAL / RESINA / COMPONENTE": { ko: "원자재 / 레진 / 부품 발주 추가", en: "ADD MATERIAL / RESIN / COMPONENT" },
      "AGREGAR MATERIAL / RESINA / COMPONENTE:": { ko: "원자재 / 레진 / 부품 발주 추가:", en: "ADD MATERIAL / RESIN / COMPONENT:" },
      "Agregar Material Hallado en Piso": { ko: "현장 발견 자재 등록", en: "Add Floor-Found Material" },
      "Agregar Operación": { ko: "공정 라우팅 단계 추가", en: "Add Operation" },
      "Agregar Operador": { ko: "작업자 추가", en: "Add Operator" },
      "Agregar Parte": { ko: "품번 추가", en: "Add Part" },
      "Agregar Ubicación / Carrito Hallado": { ko: "현장 발견 로케이션/대차 추가", en: "Add Found Location / Cart" },
      "Ajustar Orden": { ko: "작업지시 일정 조정", en: "Adjust Order" },
      "AJUSTE": { ko: "재고조정", en: "ADJUSTMENT" },
      "Ajuste Aplicado": { ko: "조정 반영 완료", en: "Adjustment Applied" },
      "Ajuste de Parámetros": { ko: "설정 기준 조정", en: "Parameter Adjustment" },
      "Ajuste Excepción": { ko: "예외 수동 조정", en: "Exception Adjustment" },
      "Ajuste Manual (Restar o descontar saldo": { ko: "수동 잔여일수 조정 (차감/가산", en: "Manual Adjustment (Deduct or adjust balance" },
      "Ajustes y Reversas": { ko: "조정 및 취소 내역", en: "Adjustments & Reversals" },
      "Al Día (Vigentes": { ko: "실사 완료 (기한 내", en: "Up to Date (Current" },
      "Alergias / Padecimientos": { ko: "알레르기 / 지병 내역", en: "Allergies / Conditions" },
      "Alertas de partes sin molde, sin BOM o sin ubicación default WMS": { ko: "금형 미지정, BOM 누락 또는 WMS 기본 로케이션 미등록 부품 경고", en: "Alerts for parts without mold, without BOM or without default WMS location" },
      "Alta de Empleado": { ko: "신규 직원 입사 등록", en: "Employee Registration" },
      "Alta de Nuevo Usuario (Solo ADMIN": { ko: "신규 사용자 등록 (관리자 전용", en: "New User Registration (ADMIN Only" },
      "Alta de Nuevo Usuario (Solo ADMIN)": { ko: "신규 사용자 등록 (관리자 전용)", en: "New User Registration (ADMIN Only)" },
      "Alta en Maestro de Partes": { ko: "품번 마스터 신규 등록", en: "Register in Parts Master" },
      "Alta rotación / Críticos": { ko: "고회전 / 핵심 자재 (A등급)", en: "High Rotation / Critical" },
      "Alterna": { ko: "대체 규격", en: "Alternative" },
      "Alternativo": { ko: "대체 사양", en: "Alternative" },
      "Alterno": { ko: "대체 사양", en: "Alternative" },
      "Alto (cm": { ko: "높이 (cm", en: "Height (cm" },
      "Alto (cm)": { ko: "높이 (cm)", en: "Height (cm)" },
      "Alto (mm": { ko: "높이 (mm", en: "Height (mm" },
      "Alto (mm)": { ko: "높이 (mm)", en: "Height (mm)" },
      "Alto cm": { ko: "높이 cm", en: "Height cm" },
      "Análisis de Calidad 80/20": { ko: "품질 파레토 80/20 분석", en: "80/20 Quality Analysis" },
      "Análisis de demanda futura e inventarios para decisiones anticipadas": { ko: "선제적 의사결정을 위한 미래 고객 수요 및 재고 시뮬레이션 분석", en: "Future demand and inventory analysis for early decision making" },
      "Análisis de demanda futura e inventarios para decisiones anticipadas.": { ko: "선제적 의사결정을 위한 미래 고객 수요 및 재고 시뮬레이션 분석.", en: "Future demand and inventory analysis for early decision making." },
      "Análisis visual de OEE, Cumplimiento de Plan y Veracidad de Inventario (IRA": { ko: "OEE, 계획 달성률 및 재고 정확도(IRA) 시각적 분석", en: "Visual analysis of OEE, Plan Compliance, and Inventory Record Accuracy (IRA" },
      "Análisis visual de OEE, Cumplimiento de Plan y Veracidad de Inventario (IRA)": { ko: "OEE, 계획 달성률 및 재고 정확도(IRA) 시각적 분석", en: "Visual analysis of OEE, Plan Compliance, and Inventory Record Accuracy (IRA)" },
      "Ancho (mm": { ko: "가로 너비 (mm", en: "Width (mm" },
      "Ancho (mm)": { ko: "가로 너비 (mm)", en: "Width (mm)" },
      "Ancho cm": { ko: "가로 너비 cm", en: "Width cm" },
      "Antigüedad": { ko: "근속 기간", en: "Seniority" },
      "Antigüedad:": { ko: "근속 연수:", en: "Seniority:" },
      "Año completo": { ko: "연간 전체", en: "Full Year" },
      "Apartado con Orden de Embarque": { ko: "출하 작업지시 예약됨", en: "Reserved for Shipping Order" },
      "APEX SYSTEM": { ko: "APEX 시스템", en: "APEX SYSTEM" },
      "Aplica uso de Jigs / Dispositivos en la estación": { ko: "해당 공정에 지그 및 보조기구를 사용합니까", en: "Does station apply Jigs / Fixtures" },
      "Aprobadas": { ko: "승인 완료 건수", en: "Approved" },
      "APS": { ko: "APS (고급 생산 계획)", en: "APS" },
      "Aquí defines los puntos obligatorios que validará Setup / Calidad / Producción": { ko: "금형 교체, 품질 보증 및 제조 현장에서 필수 검증할 점검 항목을 정의합니다.", en: "Here you define mandatory points to be validated by Setup / QA / Production" },
      "Área / Ubicación Fija": { ko: "구역 / 고정 보관 위치", en: "Area / Fixed Location" },
      "Área de Trabajo": { ko: "소속 작업 구역", en: "Work Area" },
      "Área Default": { ko: "기본 배정 구역", en: "Default Area" },
      "Área Destino": { ko: "도착 구역", en: "Destination Area" },
      "Área Destino *": { ko: "도착 구역 *", en: "Destination Area *" },
      "Área Origen": { ko: "출발 구역", en: "Origin Area" },
      "Área Origen *": { ko: "출발 구역 *", en: "Origin Area *" },
      "Áreas de Planta": { ko: "공장 구역 목록", en: "Plant Areas" },
      "Áreas Generales": { ko: "공장 대분류 구역", en: "General Areas" },
      "Áreas WMS": { ko: "WMS 창고 구역", en: "WMS Areas" },
      "Arquitectura SAP PP/MRP/APS conectada con Ingeniería, Moldes, WMS, Compras y Producción": { ko: "엔지니어링, 금형, WMS 창고, 구매 및 생산과 실시간 연동된 SAP PP/MRP/APS 아키텍처", en: "SAP PP/MRP/APS Architecture connected to Engineering, Molds, WMS, Purchasing and Production" },
      "Arranque / Primera Pieza": { ko: "초품 검사 / 양산 가동 승인", en: "Startup / First Piece" },
      "Asigna área, rol y estado activo. La columna de contraseñas y su cambio es visible": { ko: "구역, 권한 및 활성 상태를 지정합니다. 비밀번호 설정은 관리자에게만 표시됩니다.", en: "Assign area, role, and active status. Password column and changes are visible" },
      "Asignación automática considerando capacidad, moldes y fechas": { ko: "설비 생산능력, 금형 가용성 및 납기일을 반영한 자동 지시 편성", en: "Automatic assignment considering capacity, molds and due dates" },
      "Asignación automática considerando capacidad, moldes y fechas.": { ko: "설비 생산능력, 금형 가용성 및 납기일을 반영한 자동 지시 편성.", en: "Automatic assignment considering capacity, molds and due dates." },
      "ASIGNADO A EMBARQUE": { ko: "출하 배정 완료", en: "ASSIGNED TO SHIPMENT" },
      "ASIGNADO EMBARQUE": { ko: "출하 배정", en: "ASSIGNED SHIPMENT" },
      "Asignar": { ko: "배정하기", en: "Assign" },
      "Asignar Número de Parte a este Contenedor": { ko: "이 전용 대차/용기에 품번(N/P) 매핑", en: "Assign Part Number to this Container" },
      "Asigne los componentes, resinas o sub-ensambles necesarios para fabricar este número de parte": { ko: "이 완제품/반제품을 제조하는 데 소요되는 원자재 레진, 인서트 및 부품을 연결하세요", en: "Assign components, resins or sub-assemblies needed to manufacture this part number" },
      "Asigne los componentes, resinas o sub-ensambles necesarios para fabricar este número de parte.": { ko: "이 완제품/반제품을 제조하는 데 소요되는 원자재 레진, 인서트 및 부품을 연결하세요.", en: "Assign components, resins or sub-assemblies needed to manufacture this part number." },
      "Asistencias": { ko: "출석 횟수", en: "Attendances" },
      "Asistencias y retardos": { ko: "출결 및 지각 현황", en: "Attendance & Tardiness" },
      "Asunto Oficial": { ko: "공식 발주 이메일 제목", en: "Official Subject" },
      "Auditar un Área Completa (Inventario Anual": { ko: "구역 전체 실사 (정기 재고조사", en: "Audit Full Area (Annual Inventory" },
      "Auditar un Carrito Móvil Completo": { ko: "이동식 대차 전체 실사", en: "Audit Full Mobile Cart" },
      "Auditar una Ubicación Fija (Rack / Hilera": { ko: "고정 로케이션 실사 (랙 / 선반", en: "Audit Fixed Location (Rack / Row" },
      "Auditor / Evaluador": { ko: "감사관 / 평가자", en: "Auditor / Evaluator" },
      "Auditor / Nota": { ko: "실사자 / 메모", en: "Auditor / Note" },
      "Auditoría & ISO": { ko: "감사 및 ISO 관리", en: "Audit & ISO" },
      "Auditoría 5's": { ko: "5S 감사", en: "5S Audit" },
      "Auditoría 5S": { ko: "5S 현장 진단 감사", en: "5S Audit" },
      "Auditoría ABC y veracidad IRA": { ko: "ABC 순환조사 및 IRA 정확도", en: "ABC Audit & IRA Accuracy" },
      "Auditoría de correcciones": { ko: "수정 내역 감사", en: "Correction Audit" },
      "Auditoría de Inventario Anual / Mensual": { ko: "연간 / 월간 정기 재고실사", en: "Annual / Monthly Inventory Audit" },
      "Auditoría de Proceso": { ko: "제조 공정 정기 감사", en: "Process Audit" },
      "Auditoría de Trazabilidad Completa: Entradas, Salidas FIFO, Transferencias, Ajustes y Reversas": { ko: "전체 수불 추적성 감사: 입고, FIFO 출고, 이동, 조정 및 역분개", en: "Full Traceability Audit: Inbound, FIFO Outbound, Transfers, Adjustments and Reversals" },
      "AUDITORÍA EN PISO POR UBICACIÓN FIJA, CARRITO O ÁREA COMPLETA": { ko: "고정 로케이션, 대차 또는 전체 구역 현장 실사", en: "FLOOR AUDIT BY FIXED LOCATION, CART OR FULL AREA" },
      "Auditorías cíclicas": { ko: "순환 재고조사 진행 중", en: "Cycle Audits" },
      "Auditorías cíclicas...": { ko: "순환 재고조사 진행 중...", en: "Cycle Audits..." },
      "aún no existe en Supabase. Tus cambios se guardan localmente en este navegador; ejecuta": { ko: "테이블이 아직 데이터베이스에 없습니다. 브라우저 로컬에 저장되며 다음을 실행하십시오:", en: "does not exist in database yet. Changes saved locally in this browser; please execute" },
      "Automático (acomodar en el siguiente hueco libre": { ko: "자동 편성 (다음 가용 공백 시간에 배치", en: "Automatic (fit into next free slot" },
      "Autorización de Reversa Oficial": { ko: "공식 역분개(취소) 승인", en: "Official Reversal Authorization" },
      "Autorización para inicio de producción por turno": { ko: "교대조별 양산 가동 착수 승인서", en: "Shift production startup authorization" },
      "Autorización para inicio de producción por turno.": { ko: "교대조별 양산 가동 착수 승인서.", en: "Shift production startup authorization." },
      "Autorizó": { ko: "승인자", en: "Authorized by" },
      "Avance acumulado del periodo": { ko: "기간 누적 진척도", en: "Cumulative Progress for Period" },
      "Avance real de piezas buenas/scrap y paros": { ko: "양품/스크랩 실시간 진척 및 비가동 현황", en: "Real-time progress of good pieces/scrap and downtime" },
      "BAJA": { ko: "퇴사 (비활성)", en: "INACTIVE (Terminated)" },
      "Baja rotación": { ko: "저회전 자재 (C등급)", en: "Slow Rotation" },
      "Baja Stock de Seguridad": { ko: "안전재고 미달 품목", en: "Below Safety Stock" },
      "Base para Demanda y Forecast": { ko: "수요 및 판매예측 기준 데이터", en: "Base for Demand & Forecast" },
      "BIBLIOTECA DE MANUALES DIDÁCTICOS E INSTRUCCIONES DE TRABAJO (ABRIR AQUÍ MISMO SIN CAMBIAR DE PANTALLA": { ko: "시각적 작업표준서(SOP) 및 지침서 라이브러리 (화면 이동 없이 즉시 열람", en: "INTERACTIVE MANUALS & WORK INSTRUCTIONS LIBRARY (OPEN HERE WITHOUT LEAVING SCREEN" },
      "BIBLIOTECA DE MANUALES DIDÁCTICOS E INSTRUCCIONES DE TRABAJO (ABRIR AQUÍ MISMO SIN CAMBIAR DE PANTALLA)": { ko: "시각적 작업표준서(SOP) 및 지침서 라이브러리 (화면 이동 없이 즉시 열람)", en: "INTERACTIVE MANUALS & WORK INSTRUCTIONS LIBRARY (OPEN HERE WITHOUT LEAVING SCREEN)" },
      "BITÁCORA DE AUDITORÍAS DE CONTEO CÍCLICO Y VERACIDAD IRA": { ko: "순환조사 감사 일지 및 재고 정확도 (IRA", en: "CYCLE COUNT AUDIT LOG & IRA % ACCURACY" },
      "BITÁCORA DE AUDITORÍAS DE CONTEO CÍCLICO Y VERACIDAD IRA %": { ko: "순환조사 감사 일지 및 재고 정확도 (IRA %)", en: "CYCLE COUNT AUDIT LOG & IRA % ACCURACY" },
      "Bloqueado (calidad": { ko: "품질 사유 잠금 (출고 불가", en: "Blocked (Quality" },
      "Bloqueado (calidad)": { ko: "품질 사유 잠금 (출고 불가)", en: "Blocked (Quality)" },
      "Blow": { ko: "블로우 성형", en: "Blow" },
      "Boceto Base": { ko: "기본 시뮬레이션 초안", en: "Base Draft" },
      "Boceto listo en este módulo": { ko: "이 모듈에서 시뮬레이션 준비 완료", en: "Draft ready in this module" },
      "BOM Estructura": { ko: "BOM (자재명세서) 구조", en: "BOM Structure" },
      "Busca N/P": { ko: "품번 검색", en: "Search P/N" },
      "Busca N/P...": { ko: "품번 검색...", en: "Search P/N..." },
      "Busca o escanea carrito": { ko: "대차 번호 검색 또는 스캔", en: "Search or scan cart" },
      "Busca o escanea carrito de origen": { ko: "출발 대차 번호 검색 또는 스캔", en: "Search or scan origin cart" },
      "Busca o escanea carrito de origen...": { ko: "출발 대차 번호 검색 또는 스캔...", en: "Search or scan origin cart..." },
      "Busca o escanea carrito destino": { ko: "도착 대차 번호 검색 또는 스캔", en: "Search or scan destination cart" },
      "Busca o escanea carrito destino...": { ko: "도착 대차 번호 검색 또는 스캔...", en: "Search or scan destination cart..." },
      "Busca o escanea carrito...": { ko: "대차 번호 검색 또는 스캔...", en: "Search or scan cart..." },
      "Busca o escanea etiqueta": { ko: "라벨 검색 또는 스캔", en: "Search or scan label" },
      "Busca o escanea etiqueta...": { ko: "라벨 검색 또는 스캔...", en: "Search or scan label..." },
      "Busca o escanea hilera destino": { ko: "도착 랙/선반 검색 또는 스캔", en: "Search or scan destination row" },
      "Busca o escanea hilera destino...": { ko: "도착 랙/선반 검색 또는 스캔...", en: "Search or scan destination row..." },
      "Busca o escanea ubicación fija": { ko: "고정 로케이션 검색 또는 스캔", en: "Search or scan fixed location" },
      "Busca o escanea ubicación fija...": { ko: "고정 로케이션 검색 또는 스캔...", en: "Search or scan fixed location..." },
      "BUSCADOR DE LOTE MÁS ANTIGUO (RUTA FIFO": { ko: "최선입 로트 검색기 (FIFO 경로 추천", en: "OLDEST LOT FINDER (FIFO ROUTE" },
      "BUSCADOR DE LOTE MÁS ANTIGUO (RUTA FIFO)": { ko: "최선입 로트 검색기 (FIFO 경로 추천)", en: "OLDEST LOT FINDER (FIFO ROUTE)" },
      "Buscador QR, FIFO & Estatus": { ko: "QR 바코드 검색, 선입선출 & 품질 상태", en: "QR Finder, FIFO & Status" },
      "Buscar (Nombre / Usuario / Email": { ko: "검색 (이름 / 계정 / 이메일", en: "Search (Name / User / Email" },
      "Buscar (Nombre / Usuario / Email)": { ko: "검색 (이름 / 계정 / 이메일)", en: "Search (Name / User / Email)" },
      "Buscar carro (ej: CARRO-05": { ko: "대차 번호 검색 (예: CARRO-05", en: "Search cart (e.g.: CART-05" },
      "Buscar código, nombre o cliente": { ko: "코드, 명칭 또는 고객사 검색", en: "Search code, name or customer" },
      "Buscar código, nombre, cliente, proyecto o número de parte": { ko: "코드, 명칭, 고객사, 프로젝트 또는 품번 검색", en: "Search code, name, customer, project or part number" },
      "Buscar código, nombre, contacto o correo": { ko: "코드, 업체명, 담당자 또는 이메일 검색", en: "Search code, name, contact or email" },
      "Buscar código, nombre, planta o contacto": { ko: "코드, 고객사명, 공장 또는 담당자 검색", en: "Search code, name, plant or contact" },
      "Buscar Colaborador por Nombre": { ko: "직원 성명으로 검색", en: "Search Employee by Name" },
      "Buscar material o grado": { ko: "자재 또는 레진 그레이드 검색", en: "Search material or grade" },
      "Buscar módulo": { ko: "모듈 검색", en: "Search module" },
      "Buscar módulo...": { ko: "모듈 검색...", en: "Search module..." },
      "Buscar N/P o nombre": { ko: "품번 또는 품명 검색", en: "Search P/N or name" },
      "Buscar N/P o nombre...": { ko: "품번 또는 품명 검색...", en: "Search P/N or name..." },
      "Buscar N° Parte / Descripción": { ko: "품번 / 품명 검색", en: "Search P/N / Description" },
      "Buscar N° parte o nombre": { ko: "품번 또는 품명 검색", en: "Search P/N or name" },
      "Buscar N° parte o nombre...": { ko: "품번 또는 품명 검색...", en: "Search P/N or name..." },
      "Buscar N° parte, nombre, grado de resina o proveedor": { ko: "품번, 품명, 레진 그레이드 또는 협력사 검색", en: "Search part number, name, resin grade or vendor" },
      "Buscar Parte / Desc": { ko: "품번 / 품명 검색", en: "Search Part / Desc" },
      "Buscar personal": { ko: "직원 검색", en: "Search personnel" },
      "Buscar por Código, Nombre o Cláusula ISO": { ko: "문서 코드, 문서명 또는 ISO 조항 검색", en: "Search by Code, Name or ISO Clause" },
      "Buscar por folio, proveedor o estatus": { ko: "전표 번호, 협력사 또는 상태 검색", en: "Search by folio, vendor or status" },
      "Buscar por Nombre": { ko: "성명으로 검색", en: "Search by Name" },
      "Buscar por número de parte o nombre": { ko: "품번 또는 부품명으로 검색", en: "Search by part number or name" },
      "Buscar por número de parte o nombre...": { ko: "품번 또는 부품명으로 검색...", en: "Search by part number or name..." },
      "Buscar por recibo, OC, remisión o N.P": { ko: "입고 번호, 발주 번호, 납품서 또는 품번 검색", en: "Search by receipt, PO, invoice or P/N" },
      "by APEX SYSTEM": { ko: "APEX SYSTEM 제공", en: "by APEX SYSTEM" },
      "C/Time (s": { ko: "사이클 타임 (초", en: "Cycle Time (s" },
      "C/Time (s)": { ko: "사이클 타임 (초)", en: "Cycle Time (s)" },
      "cada perfil": { ko: "각 프로필별 권한", en: "each profile" },
      "cada perfil.": { ko: "각 프로필별 권한.", en: "each profile." },
      "Cadena de Suministro & Manufactura (Supply Chain Flow": { ko: "공급망 및 제조 흐름 (Supply Chain Flow", en: "Supply Chain & Manufacturing Flow" },
      "Cadena de Suministro & Manufactura (Supply Chain Flow)": { ko: "공급망 및 제조 흐름 (Supply Chain Flow)", en: "Supply Chain & Manufacturing Flow" },
      "Caja Grande Interna (Macrobin": { ko: "대형 사내 보관 박스 (매크로빈", en: "Internal Large Box (Macrobin" },
      "Calculado según ley actual": { ko: "현행 노동법 기준 자동 산출", en: "Calculated per current labor law" },
      "Calculando corridas": { ko: "생산 일정 산출 중", en: "Calculating runs" },
      "Calculando corridas...": { ko: "생산 일정 산출 중...", en: "Calculating runs..." },
      "Cálculo de resinas vs stock WMS": { ko: "레진 소요량 vs WMS 재고 계산", en: "Resin Demand vs WMS Stock Calculation" },
      "Calendario de carga por máquina": { ko: "설비별 부하 캘린더", en: "Machine Load Calendar" },
      "Calendario de Máquinas": { ko: "설비별 가동 캘린더", en: "Machine Calendar" },
      "Calendario de servicios a prensas": { ko: "사출기 정기 점검 캘린더", en: "Press Maintenance Calendar" },
      "Calidad": { ko: "품질률", en: "Quality" },
      "Calidad %": { ko: "품질률 %", en: "Quality %" },
      "Calidad & ISO": { ko: "품질 및 ISO 문서", en: "Quality & ISO" },
      "Calidad & SGC": { ko: "품질 및 품질경영시스템(SGC)", en: "Quality & QMS" },
      "Calidad (FTQ": { ko: "직행률 (FTQ", en: "First Time Quality (FTQ" },
      "Calidad (FTQ)": { ko: "직행률 (FTQ)", en: "First Time Quality (FTQ)" },
      "Calidad (Yield": { ko: "품질 수율 (Yield", en: "Quality (Yield" },
      "Calidad (Yield)": { ko: "품질 수율 (Yield)", en: "Quality (Yield)" },
      "Calidad y Defectos": { ko: "품질 및 불량률", en: "Quality & Defects" },
      "Calle, Colonia, Municipio": { ko: "도로명, 번지, 구/동/시", en: "Street, Neighborhood, City" },
      "Calle, Número, Parque Industrial, Ciudad": { ko: "도로명, 번지, 산업단지명, 도시명", en: "Street, Number, Industrial Park, City" },
      "Cambiar Contraseña": { ko: "비밀번호 변경", en: "Change Password" },
      "Cambio de Resina / Color": { ko: "원재료 레진 및 색상 교체 점검", en: "Resin / Color Change" },
      "Cambios de Molde (SMED": { ko: "SMED 금형 교체 관리", en: "Mold Changes (SMED" },
      "Cambios de Molde (SMED)": { ko: "SMED 금형 교체 관리", en: "Mold Changes (SMED)" },
      "Cancelación de requerimiento / embarque": { ko: "생산 요청 또는 출하 취소", en: "Requirement / shipping cancellation" },
      "Cancelar Orden": { ko: "작업지시 취소", en: "Cancel Order" },
      "Cant. Defectuosa": { ko: "불량 수량", en: "Defective Qty" },
      "Cant. Inspeccionada": { ko: "검사 완료 수량", en: "Inspected Qty" },
      "Cant. Recibida Hoy": { ko: "금일 실입고 수량", en: "Qty Received Today" },
      "Cant. Recibida Hoy *": { ko: "금일 실입고 수량 *", en: "Qty Received Today *" },
      "CANTIDAD": { ko: "수량", en: "QUANTITY" },
      "Cantidad (PZA": { ko: "수량 (개", en: "Quantity (PCS" },
      "Cantidad (PZA)": { ko: "수량 (개)", en: "Quantity (PCS)" },
      "Cantidad a producir": { ko: "생산 목표 수량", en: "Quantity to produce" },
      "Cantidad de Piezas": { ko: "수량 (EA", en: "Quantity of Pieces" },
      "Cantidad de Piezas *": { ko: "수량 (EA) *", en: "Quantity of Pieces *" },
      "Cantidad Física Hallada": { ko: "현장 실측 수량", en: "Physical Quantity Found" },
      "Cantidad Física Hallada *": { ko: "현장 실측 수량 *", en: "Physical Quantity Found *" },
      "Cantidad inicial de filas visibles en Explosión MRP": { ko: "MRP 자재전개 테이블 초기 표시 행 수", en: "Initial visible rows in MRP Explosion table" },
      "Cantidad inicial de filas visibles en Explosión MRP.": { ko: "MRP 자재전개 테이블 초기 표시 행 수.", en: "Initial visible rows in MRP Explosion table." },
      "Cantidad OK": { ko: "합격 수량", en: "OK Quantity" },
      "Cantidad piezas": { ko: "부품 수량", en: "Piece quantity" },
      "CANTIDAD:": { ko: "수량:", en: "QUANTITY:" },
      "Capacidad": { ko: "생산 능력 (Capa)", en: "Capacity" },
      "Capacidad CR01": { ko: "작업장 CR01 생산 능력", en: "CR01 Work Center Capacity" },
      "Capacidad diaria base para máquinas sin horario propio (default 22.5h": { ko: "개별 일정이 없는 설비의 기본 일일 가동 시간 (기본값 22.5시간", en: "Base daily capacity for machines without custom schedule (default 22.5h" },
      "Capacidad diaria base para máquinas sin horario propio (default 22.5h).": { ko: "개별 일정이 없는 설비의 기본 일일 가동 시간 (기본값 22.5시간).", en: "Base daily capacity for machines without custom schedule (default 22.5h)." },
      "Capacidad Disparo (gr": { ko: "최대 1회 사출 용량 (g", en: "Shot Capacity (g" },
      "Capacidad Disparo (gr)": { ko: "최대 1회 사출 용량 (g)", en: "Shot Capacity (g)" },
      "Capacidad operativa actualizada": { ko: "최신 가동 능력", en: "Updated operational capacity" },
      "Capacidad según N/P | Acepta Parciales": { ko: "품번별 적재 용량 | 부분 수량 허용", en: "Capacity per P/N | Accepts Partials" },
      "Capacitación": { ko: "교육 훈련", en: "Training" },
      "Capacitación por Área": { ko: "구역별 교육 훈련 이수율", en: "Training by Area" },
      "Capacitación y Matriz de Habilidades | KRAEM": { ko: "교육 훈련 및 스킬 매트릭스 | KRAEM", en: "Training & Skills Matrix | KRAEM" },
      "Capacitación y multi-habilidad": { ko: "교육 훈련 및 다기능 매트릭스", en: "Training & Multi-Skill Matrix" },
      "Captura de Inspección": { ko: "품질 검사 실적 등록", en: "Inspection Capture" },
      "Captura de Inspección Interna - KRAEM": { ko: "KRAEM 사내 품질 검사 실적 등록", en: "KRAEM Internal Inspection Entry" },
      "Captura de necesidades del cliente. Base principal para la planeación": { ko: "고객사 요구 수량 등록. 생산 계획의 기본 원천 데이터", en: "Customer requirements entry. Primary foundation for planning" },
      "Captura de necesidades del cliente. Base principal para la planeación.": { ko: "고객사 요구 수량 등록. 생산 계획의 기본 원천 데이터.", en: "Customer requirements entry. Primary foundation for planning." },
      "Captura de Requerimiento (Demanda": { ko: "수주 및 납기 소요량 입력", en: "Requirement Capture (Demand" },
      "Captura duplicada accidentalmente": { ko: "실수로 중복 입력됨", en: "Accidentally duplicated entry" },
      "Captura en tiempo real (Tablet": { ko: "태블릿 실시간 생산 실적 입력", en: "Real-Time Entry (Tablet" },
      "Captura en tiempo real (Tablet)": { ko: "태블릿 실시간 생산 실적 입력", en: "Real-Time Entry (Tablet)" },
      "Captura Inventario - Sistema Pro KRAEM": { ko: "재고 등록 - KRAEM Pro 시스템", en: "Inventory Capture - KRAEM Pro System" },
      "Captura Rápida (con Filtro de Cliente / Proyecto y Buscador": { ko: "빠른 수주 입력 (고객사/프로젝트 필터 및 품번 검색", en: "Quick Entry (with Customer / Project Filter & Search" },
      "Captura Rápida (con Filtro de Cliente / Proyecto y Buscador)": { ko: "빠른 수주 입력 (고객사/프로젝트 필터 및 품번 검색)", en: "Quick Entry (with Customer / Project Filter & Search)" },
      "Carga de Prensas": { ko: "사출기 부하율", en: "Press Workload" },
      "Carga Masiva por Excel (800+ NPs": { ko: "엑셀 대량 업로드 (800개 이상 품번 지원", en: "Bulk Excel Upload (800+ P/Ns" },
      "Carga Masiva por Excel (800+ NPs)": { ko: "엑셀 대량 업로드 (800개 이상 품번 지원)", en: "Bulk Excel Upload (800+ P/Ns)" },
      "Cargando catálogo": { ko: "카탈로그 불러오는 중", en: "Loading catalog" },
      "Cargando catálogo de empaques": { ko: "포장 사양 카탈로그 로딩 중", en: "Loading packaging catalog" },
      "Cargando catálogo de empaques...": { ko: "포장 사양 카탈로그 로딩 중...", en: "Loading packaging catalog..." },
      "Cargando catálogo...": { ko: "카탈로그 불러오는 중...", en: "Loading catalog..." },
      "Cargando cola de montajes": { ko: "금형 교체 대기열 로딩 중", en: "Loading setup queue" },
      "Cargando cola de montajes...": { ko: "금형 교체 대기열 로딩 중...", en: "Loading setup queue..." },
      "Cargando componentes del BOM": { ko: "BOM 하위 부품 로딩 중", en: "Loading BOM components" },
      "Cargando componentes del BOM...": { ko: "BOM 하위 부품 로딩 중...", en: "Loading BOM components..." },
      "Cargando datos relacionales": { ko: "연계 마스터 정보 로딩 중", en: "Loading relational data" },
      "Cargando datos relacionales...": { ko: "연계 마스터 정보 로딩 중...", en: "Loading relational data..." },
      "Cargando ficha técnica": { ko: "기술 사양서 불러오는 중", en: "Loading technical sheet" },
      "Cargando ficha técnica...": { ko: "기술 사양서 불러오는 중...", en: "Loading technical sheet..." },
      "Cargando flota": { ko: "대차 플릿 현황 로딩 중", en: "Loading fleet" },
      "Cargando flota...": { ko: "대차 플릿 현황 로딩 중...", en: "Loading fleet..." },
      "Cargando historial": { ko: "입고 이력 조회 중", en: "Loading history" },
      "Cargando historial maestro": { ko: "마스터 이력 로드 중", en: "Loading master history" },
      "Cargando historial maestro...": { ko: "마스터 이력 로드 중...", en: "Loading master history..." },
      "Cargando historial...": { ko: "입고 이력 조회 중...", en: "Loading history..." },
      "Cargando información de personal": { ko: "직원 프로필 로딩 중", en: "Loading personnel info" },
      "Cargando información de personal...": { ko: "직원 프로필 로딩 중...", en: "Loading personnel info..." },
      "Cargando lista": { ko: "목록 불러오는 중", en: "Loading list" },
      "Cargando lista...": { ko: "목록 불러오는 중...", en: "Loading list..." },
      "Cargando maestros": { ko: "기준정보 마스터 로딩 중", en: "Loading master data" },
      "Cargando maestros...": { ko: "기준정보 마스터 로딩 중...", en: "Loading master data..." },
      "Cargando moldes": { ko: "금형 마스터 로딩 중", en: "Loading molds" },
      "Cargando moldes...": { ko: "금형 마스터 로딩 중...", en: "Loading molds..." },
      "Cargando órdenes": { ko: "발주서 로딩 중", en: "Loading orders" },
      "Cargando órdenes...": { ko: "발주서 로딩 중...", en: "Loading orders..." },
      "Cargando proveedores": { ko: "공급업체 목록 로딩 중", en: "Loading vendors" },
      "Cargando proveedores...": { ko: "공급업체 목록 로딩 중...", en: "Loading vendors..." },
      "Cargando registros": { ko: "데이터 불러오는 중", en: "Loading records" },
      "Cargando registros...": { ko: "데이터 불러오는 중...", en: "Loading records..." },
      "Cargando requerimiento": { ko: "소요량 불러오는 중", en: "Loading requirement" },
      "Cargando requerimiento...": { ko: "소요량 불러오는 중...", en: "Loading requirement..." },
      "Cargando requerimientos activos": { ko: "진행 중인 소요량 데이터 로딩 중", en: "Loading active requirements" },
      "Cargando requerimientos activos...": { ko: "진행 중인 소요량 데이터 로딩 중...", en: "Loading active requirements..." },
      "Cargando unidades físicas desde 'locations": { ko: "로케이션 실물 위치 로딩 중", en: "Loading physical units from 'locations" },
      "Cargando unidades físicas desde 'locations'...": { ko: "로케이션 실물 위치 로딩 중...", en: "Loading physical units from 'locations'..." },
      "Cargar Déficits de MRP": { ko: "MRP 자재 결품 소요량 자동 불러오기", en: "Load MRP Deficits" },
      "Cargar Demo": { ko: "데모 데이터 로드", en: "Load Demo Data" },
      "Cargar Hoja de Conteo Ciego": { ko: "블라인드 실사 시트 로드", en: "Load Blind Count Sheet" },
      "Cargar/Actualizar Excel BOM": { ko: "BOM 엑셀 파일 업로드 / 갱신", en: "Upload/Update Excel BOM" },
      "Carrito / Contenedor": { ko: "대차 / 용기", en: "Cart / Container" },
      "Carrito / Contenedor (Opcional": { ko: "대차 / 용기 (선택사항", en: "Cart / Container (Optional" },
      "Carrito Retornable": { ko: "고객사 회수용 리턴 대차", en: "Returnable Cart" },
      "Carritos KIA (Uso/Máx": { ko: "KIA 대차 현황 (사용 중 / 최대 보유", en: "KIA Carts (Used/Max" },
      "Carritos KIA (Uso/Máx)": { ko: "KIA 대차 현황 (사용 중 / 최대 보유)", en: "KIA Carts (Used/Max)" },
      "Carro Interno (Flota de 107": { ko: "사내 전용 대차 (107대 플릿", en: "Internal Cart (107 Fleet" },
      "Carro Metálico de Planta": { ko: "사내 공장 철재 대차 (카트)", en: "Plant Metallic Cart" },
      "Carro o Hilera equivocada": { ko: "잘못된 대차 또는 랙 선택", en: "Wrong Cart or Row" },
      "CARRO_INTERNO": { ko: "사내 운반 대차", en: "INTERNAL_CART" },
      "Carros (107) y retornables": { ko: "대차(107대) 및 고객사 리턴 용기", en: "Carts (107) & Returnable Containers" },
      "Carros (107), cajas retornables de cliente, macrobins y empaque alternativo": { ko: "사내 전용 대차(107대), 고객사 회수용 전용 박스, 매크로빈 및 대체 포장 관리", en: "Carts (107), customer returnable containers, macrobins and alternate packaging" },
      "Carros (107), cajas retornables de cliente, macrobins y empaque alternativo.": { ko: "사내 전용 대차(107대), 고객사 회수용 전용 박스, 매크로빈 및 대체 포장 관리.", en: "Carts (107), customer returnable containers, macrobins and alternate packaging." },
      "Carros máx/parte (demo": { ko: "품번당 최대 대차 수 (예시", en: "Max carts/part (demo" },
      "Carros máx/parte (demo):": { ko: "품번당 최대 대차 수 (예시):", en: "Max carts/part (demo):" },
      "Cartón / Desviación": { ko: "골판지 박스 (비상용/특채 포장)", en: "Cardboard / Deviation" },
      "Catálogo Áreas Generales": { ko: "공장 대분류 구역 카탈로그", en: "General Areas Catalog" },
      "Catálogo de Checklists (SMED & Validaciones": { ko: "체크리스트 카탈로그 (금형교체 SMED & 품질검증", en: "Checklists Catalog (SMED & Validations" },
      "Catálogo de Checklists (SMED & Validaciones)": { ko: "체크리스트 카탈로그 (금형교체 SMED & 품질검증)", en: "Checklists Catalog (SMED & Validations)" },
      "Catálogo de Clientes Finales": { ko: "최종 고객사 카탈로그", en: "End Customers Catalog" },
      "Catálogo de Defectos": { ko: "불량 유형 카탈로그", en: "Defects Catalog" },
      "Catálogo de Defectos - KRAEM": { ko: "KRAEM 불량 유형 기준정보", en: "KRAEM Defects Catalog" },
      "Catálogo de Empaques y Gestión de Flota": { ko: "포장 사양 카탈로그 및 대차 플릿 관리", en: "Packaging Catalog & Fleet Management" },
      "Catálogo de Ingeniería - KRAEM by APEX SYSTEM": { ko: "KRAEM 엔지니어링 카탈로그", en: "Engineering Catalog - KRAEM by APEX SYSTEM" },
      "Catálogo de Materiales & Parámetros MRP": { ko: "원부자재 카탈로그 및 MRP 파라미터", en: "Materials Catalog & MRP Parameters" },
      "Catálogo de N/P": { ko: "품번 (N/P) 카탈로그", en: "Part Number Catalog" },
      "Catálogo de Ubicaciones": { ko: "창고 로케이션 카탈로그", en: "Locations Catalog" },
      "Catálogo Maestro": { ko: "마스터 기준정보 카탈로그", en: "Master Catalog" },
      "Catálogo maestro de defectos de calidad y clasificaciones": { ko: "품질 불량 유형 코드, 발생 원인 및 분류 마스터 관리", en: "Master catalog of quality defects and classifications" },
      "Catálogo maestro de defectos de calidad y clasificaciones.": { ko: "품질 불량 유형 코드, 발생 원인 및 분류 마스터 관리.", en: "Master catalog of quality defects and classifications." },
      "Catálogo maestro de números de parte y relaciones productivas": { ko: "품번 마스터, 금형/설비 연계 및 양산 사양 총괄 관리", en: "Master catalog of part numbers and production links" },
      "Catálogo maestro de números de parte y relaciones productivas.": { ko: "품번 마스터, 금형/설비 연계 및 양산 사양 총괄 관리.", en: "Master catalog of part numbers and production links." },
      "Catálogo Maestro de Proveedores": { ko: "협력업체 마스터 카탈로그", en: "Master Vendor Catalog" },
      "Catálogos Ingeniería": { ko: "엔지니어링 마스터 기준정보", en: "Engineering Catalogs" },
      "Catálogos Maestros": { ko: "마스터 기준정보", en: "Master Catalogs" },
      "Catálogos Maestros Conectados (BD": { ko: "연동된 마스터 기준정보 (DB", en: "Connected Master Catalogs (DB" },
      "Catálogos Maestros Conectados (BD)": { ko: "연동된 마스터 기준정보 (DB)", en: "Connected Master Catalogs (DB)" },
      "Catálogos Maestros Editables en Base de Datos": { ko: "데이터베이스 수정 가능한 마스터 카탈로그", en: "Editable Master Catalogs in Database" },
      "Categoría Insumo": { ko: "원부자재 분류", en: "Supply Category" },
      "Categoría Insumo *": { ko: "원부자재 분류 *", en: "Supply Category *" },
      "Cav. (act/tot": { ko: "캐비티 (가동/전체", en: "Cav. (act/tot" },
      "Cav. (act/tot)": { ko: "캐비티 (가동/전체)", en: "Cav. (act/tot)" },
      "Cav. de esta parte": { ko: "해당 품번 캐비티 수", en: "Cavities of this part" },
      "Cav. de esta parte *": { ko: "해당 품번 캐비티 수 *", en: "Cavities of this part *" },
      "Cavidades activas": { ko: "현재 가동 캐비티 수", en: "Active Cavities" },
      "Cavidades Totales": { ko: "총 캐비티 수", en: "Total Cavities" },
      "Cavidades totales *": { ko: "금형 총 캐비티 수 *", en: "Total Cavities *" },
      "Cavidades y tiros PM": { ko: "캐비티 수 및 예방정비 쇼트 수", en: "Cavities & PM Shot Count" },
      "Cavidades, SMED y tonelajes": { ko: "캐비티, 금형교체(SMED) 및 톤수", en: "Cavities, SMED & Tonnage" },
      "Celdas cubiertas": { ko: "이수 완료 항목 수", en: "Covered Cells" },
      "Centros de trabajo": { ko: "작업장 / 워크센터", en: "Work Centers" },
      "Certificaciones Activas": { ko: "유효한 사내 자격증/인증", en: "Active Certifications" },
      "Checklist requerido": { ko: "체크리스트 필수 적용", en: "Checklist Required" },
      "Checklist SMED / Cambio de Molde": { ko: "SMED 금형 교체 점검 체크리스트", en: "SMED Mold Change Checklist" },
      "Checklists Maestro": { ko: "체크리스트 마스터", en: "Master Checklists" },
      "Checklists SMED / Arranque": { ko: "SMED 금형교체 및 초품 체크리스트", en: "SMED Setup / Startup Checklists" },
      "Ciclo en esta máquina (s": { ko: "해당 설비 적용 사이클 타임 (초", en: "Cycle on this machine (s" },
      "Ciclo en esta máquina (s)": { ko: "해당 설비 적용 사이클 타임 (초)", en: "Cycle on this machine (s)" },
      "Ciudad / Estado": { ko: "도시 / 주 (도)", en: "City / State" },
      "CLASE A": { ko: "A등급 (핵심/고회전)", en: "CLASS A" },
      "CLASE A (CADA 30 DÍAS": { ko: "A등급 (30일 주기 실사", en: "CLASS A (EVERY 30 DAYS" },
      "Clase A (Contar cada 30 días": { ko: "A등급 (30일마다 실사", en: "Class A (Count every 30 days" },
      "Clase A (Mensual - 30 días": { ko: "A등급 (월간 - 30일", en: "Class A (Monthly - 30 days" },
      "Clase ABC": { ko: "ABC 관리등급", en: "ABC Class" },
      "CLASE B (CADA 90 DÍAS": { ko: "B등급 (90일 주기 실사", en: "CLASS B (EVERY 90 DAYS" },
      "Clase B (Contar cada 90 días": { ko: "B등급 (90일마다 실사", en: "Class B (Count every 90 days" },
      "Clase B (Trimestral - 90 días": { ko: "B등급 (분기 - 90일", en: "Class B (Quarterly - 90 days" },
      "CLASE C (CADA 180 DÍAS": { ko: "C등급 (180일 주기 실사", en: "CLASS C (EVERY 180 DAYS" },
      "Clase C (Contar cada 180 días": { ko: "C등급 (180일마다 실사", en: "Class C (Count every 180 days" },
      "Clase C (Semestral - 180 días": { ko: "C등급 (반기 - 180일", en: "Class C (Semi-annual - 180 days" },
      "Clasificación ABC": { ko: "ABC 등급 분류", en: "ABC Classification" },
      "Clasificación ABC de este N/P": { ko: "해당 품번의 ABC 등급", en: "ABC Classification of this P/N" },
      "Cláusula 7.5 Control Documental": { ko: "7.5항 문서화된 정보 관리", en: "Clause 7.5 Document Control" },
      "Cláusula 7.5 ISO 9001:2015 / IATF 16949 - Información Documentada": { ko: "ISO 9001:2015 / IATF 16949 7.5항 - 문서화된 정보", en: "Clause 7.5 ISO 9001:2015 / IATF 16949 - Documented Information" },
      "Cláusula ISO 9001": { ko: "ISO 9001 해당 조항", en: "ISO 9001 Clause" },
      "Click para subir foto": { ko: "클릭하여 제품 사진 업로드", en: "Click to upload photo" },
      "CLIENTE": { ko: "고객사", en: "CUSTOMER" },
      "Cliente (propietario": { ko: "금형 소유 고객사", en: "Customer (Owner" },
      "Cliente (propietario)": { ko: "금형 소유 고객사", en: "Customer (Owner)" },
      "Cliente (Supabase": { ko: "고객사 정보", en: "Customer (Database" },
      "Cliente (Supabase)": { ko: "고객사 정보", en: "Customer (Database)" },
      "Cliente / Destino": { ko: "고객사 / 행선지", en: "Customer / Destination" },
      "Cliente / Propietario": { ko: "고객사 / 금형 소유주", en: "Customer / Owner" },
      "Cliente / Proveedor": { ko: "고객사 / 외주 공급업체", en: "Customer / Vendor" },
      "Cliente / Proyecto": { ko: "고객사 / 프로젝트", en: "Customer / Project" },
      "Clientes & Forecast": { ko: "고객사 및 판매 예측 (Forecast)", en: "Customers & Forecast" },
      "Clientes Finales": { ko: "최종 고객사", en: "End Customers" },
      "Clientes Registrados": { ko: "등록된 고객사 수", en: "Registered Customers" },
      "Clientes y Comercial": { ko: "고객사 및 영업 관리", en: "Customers & Commercial" },
      "Clientes, plantas destino, RFC fiscal y días de tránsito": { ko: "고객사, 납품 공장, 사업자 번호 및 운송 일수 (판매예측, 출하 및 WMS 기준)", en: "Customers, destination plants, tax ID and transit days" },
      "Cobertura de Inventario": { ko: "재고 보유 일수 (재고 커버리지)", en: "Inventory Coverage" },
      "Cockpit de Planeación": { ko: "생산 계획 통합 콕핏", en: "Planning Cockpit" },
      "Cockpit de Planeación & Control ERP": { ko: "ERP 생산 계획 및 제어 통합 콕핏", en: "ERP Planning & Control Cockpit" },
      "Código": { ko: "식별 코드", en: "Code" },
      "Código (QR": { ko: "식별 코드 (QR", en: "Code (QR" },
      "Código (QR)": { ko: "식별 코드 (QR)", en: "Code (QR)" },
      "Código *": { ko: "식별 코드 *", en: "Code *" },
      "Código Área": { ko: "구역 코드", en: "Area Code" },
      "Código Cliente": { ko: "고객사 코드", en: "Customer Code" },
      "Código Cliente *": { ko: "고객사 코드 *", en: "Customer Code *" },
      "Código de Carro": { ko: "대차 관리 번호", en: "Cart Code" },
      "Código ISO": { ko: "ISO 관리 번호", en: "ISO Code" },
      "CÓDIGO MAESTRO: KR-SGC-LM-0001 | REV 01": { ko: "마스터 관리번호: KR-SGC-LM-0001 | 개정 01", en: "MASTER CODE: KR-SGC-LM-0001 | REV 01" },
      "Código Máquina": { ko: "설비 관리 번호", en: "Machine Code" },
      "Código Molde": { ko: "금형 관리 번호", en: "Mold Code" },
      "Código Molde *": { ko: "금형 관리 번호 *", en: "Mold Code *" },
      "Código Postal": { ko: "우편번호", en: "Postal Code" },
      "Código Proveedor": { ko: "협력업체 코드", en: "Vendor Code" },
      "Código Proveedor *": { ko: "협력업체 코드 *", en: "Vendor Code *" },
      "Código QR Parte": { ko: "품번 식별 QR 코드", en: "Part QR Code" },
      "Código Ubicación / QR": { ko: "로케이션 식별 코드 / QR", en: "Location Code / QR" },
      "Código Único (QR": { ko: "고유 QR 식별 코드", en: "Unique Code (QR" },
      "Código Único (QR) *": { ko: "고유 QR 식별 코드 *", en: "Unique Code (QR) *" },
      "Códigos calidad": { ko: "품질 코드", en: "Quality Codes" },
      "Cola de setups desde el Tablero APS, validación PM/WMS y checklists": { ko: "APS 현황판 기반 금형 교체 대기열, 예방정비/자재공급 검증 및 체크리스트 연동", en: "Setup queue from APS Board, PM/WMS validation and checklists" },
      "Cola Montaje SMED": { ko: "금형 교체 대기열 (SMED", en: "SMED Setup Queue" },
      "Cola Montaje SMED →": { ko: "금형 교체 대기열 (SMED) →", en: "SMED Setup Queue →" },
      "Cola Programada de Cambios de Molde": { ko: "금형 교체 편성 대기열", en: "Scheduled Mold Change Queue" },
      "Colaborador": { ko: "직원 성명", en: "Employee" },
      "Colaborador (Ver Historial": { ko: "직원 선택 (근태 이력 보기", en: "Employee (View History" },
      "Colaborador (Ver Historial)": { ko: "직원 선택 (근태 이력 보기)", en: "Employee (View History)" },
      "Colaborador afectado": { ko: "해당 직원", en: "Affected Employee" },
      "Colaborador:": { ko: "직원 성명:", en: "Employee:" },
      "Colada (g": { ko: "런너 중량 (g", en: "Runner (g" },
      "Colada (g)": { ko: "런너 중량 (g)", en: "Runner (g)" },
      "Colada caliente": { ko: "핫 러너 (Hot Runner)", en: "Hot Runner" },
      "Colada fría": { ko: "콜드 러너 (Cold Runner)", en: "Cold Runner" },
      "Color Resina": { ko: "원재료 레진 색상", en: "Resin Color" },
      "Columnas estándar": { ko: "표준 컬럼 구성", en: "Standard columns" },
      "Columnas estándar:": { ko: "표준 컬럼 구성:", en: "Standard columns:" },
      "Comentario": { ko: "의견 / 비고", en: "Comment" },
      "Comentario / Motivo": { ko: "비고 / 사유", en: "Comment / Reason" },
      "Comentario / Motivo *": { ko: "비고 / 사유 *", en: "Comment / Reason *" },
      "Comentario / OP / Auditoría": { ko: "비고 / 작업지시 / 감사", en: "Comment / WO / Audit" },
      "Cómo trabaja la propuesta automática": { ko: "자동 일정 편성 알고리즘 동작 방식", en: "How automated scheduling works" },
      "Cómo trabaja la propuesta automática:": { ko: "자동 일정 편성 알고리즘 동작 방식:", en: "How automated scheduling works:" },
      "Comparar por Área": { ko: "구역별 비교", en: "Compare by Area" },
      "Comparar por Máquina": { ko: "설비별 비교", en: "Compare by Machine" },
      "Comparar por Operador": { ko: "작업자별 비교", en: "Compare by Operator" },
      "Comparar por Turno": { ko: "교대조별 비교", en: "Compare by Shift" },
      "Componente (Clip/Pad/Otros": { ko: "부자재 (클립 / 패드 / 기타", en: "Component (Clip/Pad/Other" },
      "Componente (Clip/Pad/Otros)": { ko: "부자재 (클립 / 패드 / 기타)", en: "Component (Clip/Pad/Other)" },
      "Componente / Materia Prima": { ko: "부품 / 원재료", en: "Component / Raw Material" },
      "Componente / Resina": { ko: "부품 / 레진", en: "Component / Resin" },
      "Componentes / Insertos": { ko: "조립 부품 / 금속 인서트", en: "Components / Inserts" },
      "Componentes e Insertos": { ko: "구성 부품 및 인서트", en: "Components & Inserts" },
      "Componentes OEE (D × R × C": { ko: "OEE 구성요소 (가동률 × 성능 × 품질률", en: "OEE Components (A × P × Q" },
      "Componentes OEE (D × R × C)": { ko: "OEE 구성요소 (가동률 × 성능 × 품질률)", en: "OEE Components (A × P × Q)" },
      "Componentes, Clips e Insertos": { ko: "부품, 클립 및 인서트", en: "Components, Clips & Inserts" },
      "Compra Sugerida (Lote/Múlt": { ko: "구매 추천 발주량 (최소포장/배수 반영", en: "Suggested Purchase (Lot/Multiple" },
      "Compra Sugerida (Lote/Múlt.)": { ko: "구매 추천 발주량 (최소포장/배수 반영)", en: "Suggested Purchase (Lot/Multiple)" },
      "Comprador / Solicitante": { ko: "구매 담당자 / 요청자", en: "Buyer / Requester" },
      "Compras & Abasto": { ko: "구매 및 자재 수급", en: "Purchasing & Supply" },
      "Compras, Proveedores & Recibo": { ko: "구매 발주, 협력사 및 자재 입고", en: "Purchasing, Vendors & Receipts" },
      "Con Discrepancia": { ko: "오차 발생", en: "With Discrepancy" },
      "Con variación detectada": { ko: "재고 차이 발견됨", en: "Variance Detected" },
      "Condiciones de pago": { ko: "대금 결제 조건", en: "Payment Terms" },
      "Conectando a Supabase": { ko: "데이터베이스 연결 중", en: "Connecting to database" },
      "Conectando a Supabase...": { ko: "데이터베이스 연결 중...", en: "Connecting to database..." },
      "Configuración Central del Sistema": { ko: "시스템 중앙 환경설정", en: "Central System Configuration" },
      "Configuración de checklists de auditoría, setups y validaciones": { ko: "감사, 금형 교체(SMED) 및 양산 승인 검증 체크리스트 구성", en: "Configuration of audit, setup and validation checklists" },
      "Configuración de checklists de auditoría, setups y validaciones.": { ko: "감사, 금형 교체(SMED) 및 양산 승인 검증 체크리스트 구성.", en: "Configuration of audit, setup and validation checklists." },
      "Configuración de Metas": { ko: "목표치 (KPI) 설정", en: "Target Configuration" },
      "Configuración de procesos productivos y operaciones estándar": { ko: "생산 공정 및 표준 라우팅 작업 순서 설정", en: "Configuration of production processes and standard operations" },
      "Configuración de procesos productivos y operaciones estándar.": { ko: "생산 공정 및 표준 라우팅 작업 순서 설정.", en: "Configuration of production processes and standard operations." },
      "Configuración Flexible de Turnos (Por Día": { ko: "요일별 탄력 교대조 설정", en: "Flexible Shift Configuration (By Day" },
      "Configuración Flexible de Turnos (Por Día)": { ko: "요일별 탄력 교대조 설정", en: "Flexible Shift Configuration (By Day)" },
      "Configuraciones en Sistema": { ko: "시스템 환경설정", en: "System Settings" },
      "CONFIRMAR ENTRADA": { ko: "입고 확정 등록", en: "CONFIRM INBOUND" },
      "Confirmar Entrada en WMS & Generar QR": { ko: "WMS 입고 확정 및 QR 바코드 라벨 발행", en: "Confirm WMS Receipt & Generate QR" },
      "CONFIRMAR MOVIMIENTO": { ko: "재고 이동 확정", en: "CONFIRM MOVEMENT" },
      "Confirmar Surtido WMS": { ko: "WMS 현장 자재 불출 확정", en: "Confirm WMS Kitting" },
      "Consolidado mensual y faltas": { ko: "월간 근태 집계 및 결근", en: "Monthly Summary & Absences" },
      "Consolidado por N/P y Área": { ko: "품번 및 구역별 집계", en: "Consolidated by P/N and Area" },
      "CONSULTA DE CONTENIDO EN CARRITO / CONTENEDOR": { ko: "대차 / 용기 적재 품목 조회", en: "CART / CONTAINER CONTENT INQUIRY" },
      "CONSULTA DE MATERIALES EN UBICACIÓN FIJA": { ko: "고정 로케이션 보관 자재 조회", en: "FIXED LOCATION MATERIALS INQUIRY" },
      "Consumo (U/S": { ko: "단위 소요량 (U/S", en: "Consumption (U/S" },
      "Consumo (U/S)": { ko: "단위 소요량 (U/S)", en: "Consumption (U/S)" },
      "Consumo promedio": { ko: "일평균 소요량", en: "Average Consumption" },
      "Contacto & Teléfono": { ko: "담당자 성명 및 연락처", en: "Contact & Phone" },
      "Contacto de Emergencia (Nombre": { ko: "비상 연락처 (성명 및 관계", en: "Emergency Contact (Name" },
      "Contacto de Emergencia (Nombre)": { ko: "비상 연락처 (성명 및 관계)", en: "Emergency Contact (Name)" },
      "Contacto de Ventas": { ko: "영업 담당자", en: "Sales Contact" },
      "Contacto Principal": { ko: "대표 담당자", en: "Main Contact" },
      "Contenedor / Carrito DESTINO": { ko: "도착 대차 / 용기", en: "DESTINATION Container / Cart" },
      "Contenedor / Carrito ORIGEN": { ko: "출발 대차 / 용기", en: "ORIGIN Container / Cart" },
      "Contenedor / Carro": { ko: "용기 / 대차", en: "Container / Cart" },
      "Contenedor Móvil (Carrito / Palet": { ko: "이동식 용기 (카트 / 파렛트", en: "Mobile Container (Cart / Pallet" },
      "Conteo Cíclico / Barrido de Ubicación": { ko: "순환조사 / 로케이션 전수실사", en: "Cycle Count / Location Sweep" },
      "CONTEO CIEGO": { ko: "블라인드 실사 (수량 미표시", en: "BLIND COUNT" },
      "CONTEO CIEGO:": { ko: "블라인드 실사 (수량 미표시):", en: "BLIND COUNT:" },
      "Conteo Físico": { ko: "실물 수량 실사", en: "Physical Count" },
      "Conteo Físico *": { ko: "실물 수량 실사 *", en: "Physical Count *" },
      "Conteos Cíclicos IRA": { ko: "순환 재고조사 및 IRA 정확도", en: "Cycle Counts & IRA" },
      "Contraseña": { ko: "비밀번호", en: "Password" },
      "Contraseña *": { ko: "비밀번호 *", en: "Password *" },
      "Control de Calidad - KRAEM": { ko: "KRAEM 품질 관리 시스템", en: "KRAEM Quality Control" },
      "Control de carros fuera de servicio por daño o en reparación (Afecta directamente la capacidad de Planeación": { ko: "파손 또는 수리 중인 대차 현황 통제 (생산 계획 배정 능력에 직결", en: "Control of out-of-service damaged carts (directly affects Planning capacity" },
      "Control de carros fuera de servicio por daño o en reparación (Afecta directamente la capacidad de Planeación).": { ko: "파손 또는 수리 중인 대차 현황 통제 (생산 계획 배정 능력에 직결).", en: "Control of out-of-service damaged carts (directly affects Planning capacity)." },
      "Control de Estatus y Embarque": { ko: "품질 상태 및 출하 제어", en: "Status Control & Shipping" },
      "Control de los 107 Carros en Planta (Capacidad, Mantenimiento y Daños), Cajas Retornables y Cartón": { ko: "공장 내 107대 대차(적재능력, 정비 및 파손), 회수용 박스 및 골판지 박스 통합 관리", en: "Control of 107 Plant Carts (Capacity, Maintenance & Damage), Returnable Containers and Boxes" },
      "Control de Producción, Cadena de Suministro e Inventarios": { ko: "생산 관리, 공급망 및 실시간 재고 제어", en: "Production Control, Supply Chain and Inventory" },
      "Control de Solicitudes Kraem": { ko: "KRAEM 휴가 및 근태 신청 관리", en: "Kraem Requests Control" },
      "Control de Vacaciones": { ko: "연차 휴가 일수 통제", en: "Vacation Control" },
      "Control documental KR-SGC-LM-0001": { ko: "문서 관리 대장 KR-SGC-LM-0001", en: "Document Control KR-SGC-LM-0001" },
      "Control maestro de moldes, cavidades y relaciones productivas": { ko: "금형, 캐비티 수, 설비 호환성 및 생산 매핑 마스터 총괄 관리", en: "Master mold control, cavities, and production linkages" },
      "Control maestro de moldes, cavidades y relaciones productivas.": { ko: "금형, 캐비티 수, 설비 호환성 및 생산 매핑 마스터 총괄 관리.", en: "Master mold control, cavities, and production linkages." },
      "Copia y pega este script una vez en": { ko: "이 스크립트를 데이터베이스에서 한 번 실행하세요:", en: "Copy and paste this script once in" },
      "Copiar SQL": { ko: "SQL 복사", en: "Copy SQL" },
      "Copiar Texto": { ko: "발주 본문 복사", en: "Copy Text" },
      "Correo al Proveedor": { ko: "공급업체 발송 이메일", en: "Email to Vendor" },
      "Correo Electrónico para Envío de OC": { ko: "발주서 수신용 공식 이메일", en: "Email for PO Dispatch" },
      "Correo Electrónico para Envío de OC *": { ko: "발주서 수신용 공식 이메일 *", en: "Email for PO Dispatch *" },
      "Correo Pedidos (Envío OC": { ko: "수주 접수 이메일 (발주서 자동 전송", en: "Orders Email (PO Dispatch" },
      "Correo Pedidos (Envío OC)": { ko: "수주 접수 이메일 (발주서 자동 전송)", en: "Orders Email (PO Dispatch)" },
      "Corte Acumulado Pareto Calidad": { ko: "품질 파레토 누적 컷오프", en: "Quality Pareto Cumulative Cutoff" },
      "Corte Acumulado Pareto Calidad (%)": { ko: "품질 파레토 누적 컷오프 (%)", en: "Quality Pareto Cumulative Cutoff (%)" },
      "Corto Material (Shortage": { ko: "자재 결품 (쇼티지 발생", en: "Material Shortage" },
      "Cortos de Material (Shortage": { ko: "자재 결품 (쇼티지 현황", en: "Material Shortages" },
      "Cortos de Material (Shortage)": { ko: "자재 결품 (쇼티지 현황)", en: "Material Shortages" },
      "Crear Usuario en Supabase": { ko: "신규 사용자 생성", en: "Create User in Supabase" },
      "Crédito / Moneda": { ko: "여신 기간 / 기준 통화", en: "Credit / Currency" },
      "Criterio / Especificación": { ko: "판정 기준 / 기술 사양", en: "Criteria / Specification" },
      "Criterio / Tolerancia": { ko: "허용 오차 및 공차 기준", en: "Criteria / Tolerance" },
      "Cualquier ajuste manual reprograma en automático la cola de la máquina": { ko: "수동으로 일정을 이동하면 해당 설비의 이후 지시가 자동으로 연쇄 재조정됩니다", en: "Any manual adjustment automatically reschedules machine queue downstream" },
      "Cualquier ajuste manual reprograma en automático la cola de la máquina.": { ko: "수동으로 일정을 이동하면 해당 설비의 이후 지시가 자동으로 연쇄 재조정됩니다.", en: "Any manual adjustment automatically reschedules machine queue downstream." },
      "CUARENTENA / CALIDAD": { ko: "품질 격리 보관", en: "QUARANTINE / QUALITY" },
      "Cuerpo del Correo Pre-redactado": { ko: "자동 작성된 발주 이메일 본문", en: "Pre-drafted Email Body" },
      "Cuestionario Editable de Auditoría 5S": { ko: "수정 가능한 5S 감사 체크리스트", en: "Editable 5S Audit Questionnaire" },
      "Cumplimiento Global": { ko: "전체 달성률", en: "Overall Compliance" },
      "Cumplimiento Jigs": { ko: "지그/설비 사용 준수율", en: "Jigs Compliance" },
      "Dado de Baja / Dañado": { ko: "폐기 / 파손 불능", en: "Decommissioned / Damaged" },
      "Dados de Baja / Chatarra": { ko: "폐기 처분 / 고철", en: "Scrapped / Decommissioned" },
      "Dashboard Ejecutivo de KPIs": { ko: "경영진 KPI 대시보드", en: "Executive KPI Dashboard" },
      "Dashboard Gerencial & KPIs": { ko: "종합 경영 대시보드 및 KPI", en: "Managerial Dashboard & KPIs" },
      "Dashboard Planta": { ko: "공장 현황 대시보드", en: "Plant Dashboard" },
      "Defecto": { ko: "불량 점유율", en: "Defect" },
      "Defecto Detectado": { ko: "발견된 불량 항목", en: "Detected Defect" },
      "Defectos detectados en prensa": { ko: "사출기 발생 불량 현황", en: "Defects Detected at Press" },
      "Déficit Neto": { ko: "순 부족 수량 (순소요량)", en: "Net Deficit" },
      "Define qué roles tienen rango alto (pueden editar este panel) y qué módulos puede": { ko: "시스템 설정 권한을 가진 상위 직급과 접근 가능한 모듈을 정의합니다.", en: "Defines which roles have high rank (can edit this panel) and which modules they can access." },
      "Definir Parámetros del Turno": { ko: "교대조 근무 시간 정의", en: "Define Shift Parameters" },
      "Demanda": { ko: "고객 수요", en: "Demand" },
      "Demanda / Salida Prom. Diaria": { ko: "일평균 출고 소요량", en: "Avg Daily Demand / Issue" },
      "Demanda → MRP → APS → SMED": { ko: "고객 수요 → MRP 자재 → APS 계획 → SMED 금형교체", en: "Demand → MRP → APS → SMED" },
      "Departamentos / 5S": { ko: "부서별 5S 현황", en: "Departments / 5S" },
      "Descargar Formato PDF Oficial de Auditoría (Desglosado por Ubicación, Carrito y Lote": { ko: "공식 감사 PDF 양식 다운로드 (로케이션, 대차, 로트별 상세", en: "Download Official Audit PDF Form (Broken down by Location, Cart and Lot" },
      "Descargar Formato PDF Oficial de Auditoría (Desglosado por Ubicación, Carrito y Lote)": { ko: "공식 감사 PDF 양식 다운로드 (로케이션, 대차, 로트별 상세)", en: "Download Official Audit PDF Form (Broken down by Location, Cart and Lot)" },
      "Descargar PDF": { ko: "PDF 다운로드", en: "Download PDF" },
      "Descargar Plantilla Excel": { ko: "엑셀 표준 템플릿 다운로드", en: "Download Excel Template" },
      "Descargar PNG": { ko: "PNG 이미지 다운로드", en: "Download PNG" },
      "Describe por qué cambia de estatus (ej. Detenido por porosidad, Liberado por Calidad, Asignado a embarque": { ko: "상태 변경 사유를 입력하세요 (예: 기포 불량 격리, 품질 승인 해제, 출하 배정 등", en: "Describe why status changes (e.g. Quarantined for porosity, Released by QA, Assigned to shipment" },
      "Describe por qué cambia de estatus (ej. Detenido por porosidad, Liberado por Calidad, Asignado a embarque...)": { ko: "상태 변경 사유를 입력하세요 (예: 기포 불량 격리, 품질 승인 해제, 출하 배정 등)", en: "Describe why status changes (e.g. Quarantined for porosity, Released by QA, Assigned to shipment...)" },
      "Descripción Material": { ko: "원자재 품명 규격", en: "Material Description" },
      "Desde / Hasta": { ko: "시작일 / 종료일", en: "From / To" },
      "Desechable (Cartón": { ko: "일회용 포장 (골판지 박스", en: "Disposable (Cardboard" },
      "Desempeño por Prensa / Máquina": { ko: "사출기별 실적 및 가동률", en: "Performance by Press / Machine" },
      "Destinatario (Correo de Pedidos del Proveedor": { ko: "수신처 (협력사 수주 담당자 이메일", en: "Recipient (Vendor Orders Email" },
      "Destinatario (Correo de Pedidos del Proveedor)": { ko: "수신처 (협력사 수주 담당자 이메일)", en: "Recipient (Vendor Orders Email)" },
      "Destino (Ubicación / Carro": { ko: "도착지 (로케이션 / 대차", en: "Destination (Location / Cart" },
      "Destino (Ubicación / Carro)": { ko: "도착지 (로케이션 / 대차)", en: "Destination (Location / Cart)" },
      "DESTINO DEL MATERIAL (A dónde ingresa": { ko: "입고 목적지 (어디로 들어가는가", en: "MATERIAL DESTINATION (Where it enters" },
      "DESTINO DEL MATERIAL (A dónde ingresa)": { ko: "입고 목적지 (어디로 들어가는가)", en: "MATERIAL DESTINATION (Where it enters)" },
      "Destino Sugerido": { ko: "권장 처분 방식", en: "Suggested Disposition" },
      "Detalle ampliamente la justificación para planta o ajuste": { ko: "공장 승인 또는 근태 조정을 위한 상세 사유를 입력하세요", en: "Detail the justification for plant or adjustment in depth" },
      "Detalle ampliamente la justificación para planta o ajuste...": { ko: "공장 승인 또는 근태 조정을 위한 상세 사유를 입력하세요...", en: "Detail the justification for plant or adjustment in depth..." },
      "Detalle de Inspecciones": { ko: "검사 상세 내역", en: "Inspection Details" },
      "Detalle por Ubicación / Lote": { ko: "로케이션 / 로트별 상세", en: "Detail by Location / Lot" },
      "Detenido (Bloquea salida FIFO": { ko: "출고 정지 (FIFO 출고 차단", en: "Hold (Blocks FIFO dispatch" },
      "Detenido (Bloquea salida FIFO)": { ko: "출고 정지 (FIFO 출고 차단)", en: "Hold (Blocks FIFO dispatch)" },
      "Día de Trabajo (Operativo": { ko: "실제 근무일 (생산일", en: "Work Day (Operational" },
      "Día de Trabajo (Operativo)": { ko: "실제 근무일 (생산일)", en: "Work Day (Operational)" },
      "Diagrama de Gantt por Máquina": { ko: "설비별 간트차트 일정표", en: "Machine Gantt Chart" },
      "Diagrama de Pareto (80/20": { ko: "파레토 다이어그램 (80/20 분석", en: "Pareto Chart (80/20" },
      "Diagrama de Pareto (80/20)": { ko: "파레토 다이어그램 (80/20 분석)", en: "Pareto Chart (80/20)" },
      "Días Aplicados": { ko: "신청 반영된 일수", en: "Days Applied" },
      "Días cobertura": { ko: "재고 유효 일수", en: "Coverage Days" },
      "Días de Crédito": { ko: "외상 대금 결제 기간 (일)", en: "Credit Days" },
      "Días de Ley": { ko: "법정 유급 휴가 일수", en: "Statutory Days" },
      "Días de Tránsito (Embarque": { ko: "운송 소요 일수 (선적 리드타임", en: "Transit Days (Shipping" },
      "Días de Tránsito (Embarque)": { ko: "운송 소요 일수 (선적 리드타임)", en: "Transit Days (Shipping)" },
      "Días de vacaciones a quitar/descontar": { ko: "차감/차감할 연차 휴가 일수", en: "Vacation days to deduct" },
      "Días disponibles con el stock actual": { ko: "현재고 기준 생산 가능 일수", en: "Days available with current stock" },
      "Días que tarda el proveedor en entregar material": { ko: "발주 후 협력사 납품까지 소요 일수 (리드타임)", en: "Days vendor takes to deliver material" },
      "Días retorno carro": { ko: "대차 회송 소요 일수", en: "Cart return days" },
      "Días retorno carro:": { ko: "대차 회송 소요 일수:", en: "Cart return days:" },
      "Diciembre": { ko: "12월", en: "December" },
      "Diferencia": { ko: "차이", en: "Difference" },
      "Diferencia en Conteo Físico / Cíclico": { ko: "실물 실사 / 순환조사 수량 차이", en: "Physical / Cycle Count Discrepancy" },
      "Diferencia máxima permitida para contar lote como exacto en IRA": { ko: "IRA 정확도 계산 시 일치로 인정되는 최대 허용 오차 수량", en: "Maximum difference allowed to count lot as accurate in IRA" },
      "Diferencia máxima permitida para contar lote como exacto en IRA.": { ko: "IRA 정확도 계산 시 일치로 인정되는 최대 허용 오차 수량.", en: "Maximum difference allowed to count lot as accurate in IRA." },
      "Dimensiones (cm": { ko: "외형 치수 (cm", en: "Dimensions (cm" },
      "Dimensiones (cm)": { ko: "외형 치수 (cm)", en: "Dimensions (cm)" },
      "Dimensiones Críticas (Según Plano": { ko: "도면상 핵심 중점 치수", en: "Critical Dimensions (Per Drawing" },
      "Dimensiones Críticas (Según Plano)": { ko: "도면상 핵심 중점 치수", en: "Critical Dimensions (Per Drawing)" },
      "Dirección": { ko: "주소", en: "Address" },
      "Dirección / Ubicación Planta": { ko: "납품 공장 주소 및 위치", en: "Plant Address / Location" },
      "Dirección habitual": { ko: "실거주지 주소", en: "Home address" },
      "Dirección habitual:": { ko: "실거주지 주소:", en: "Home address:" },
      "Dirección Particular": { ko: "자택 주소", en: "Home Address" },
      "Directorio de Proveedores": { ko: "공급업체 디렉터리", en: "Vendor Directory" },
      "Directorio de proveedores industriales, términos comerciales, lead times y correos": { ko: "산업 자재 공급사 디렉터리, 거래 조건, 리드타임 및 발주서 자동 전송 이메일", en: "Industrial vendor directory, commercial terms, lead times and emails for automated PO" },
      "Directorio Proveedores": { ko: "공급사 디렉터리", en: "Vendor Directory" },
      "Directrices de Control Documental Electrónico (Evidencia para Auditorías ISO": { ko: "전자 문서 관리 지침 (ISO / IATF 심사 증빙 자료", en: "Electronic Document Control Guidelines (Audit Evidence for ISO" },
      "Directrices de Control Documental Electrónico (Evidencia para Auditorías ISO)": { ko: "전자 문서 관리 지침 (ISO / IATF 심사 증빙 자료)", en: "Electronic Document Control Guidelines (Audit Evidence for ISO)" },
      "Discrepancia en BOM (Estructura": { ko: "BOM (자재명세서) 기준 불일치", en: "BOM (Structure) Discrepancy" },
      "Discrepancia en BOM (Estructura)": { ko: "BOM (자재명세서) 기준 불일치", en: "BOM (Structure) Discrepancy" },
      "Disp": { ko: "판정", en: "Disp" },
      "Disponibilidad": { ko: "가동률 (Disponibilidad)", en: "Availability" },
      "Disponibilidad OEE Fallback": { ko: "기본 가동률 대체값", en: "OEE Availability Fallback" },
      "Disponibilidad OEE Fallback (%)": { ko: "기본 가동률 대체값 (%)", en: "OEE Availability Fallback (%)" },
      "Disponibilidad y disparos PM": { ko: "설비 가동률 및 예방정비 타수", en: "Availability & PM Shot Counts" },
      "Disponible": { ko: "가용 가능", en: "Available" },
      "DISPONIBLE (HÁBIL": { ko: "사용 가능 (출고 가용", en: "AVAILABLE" },
      "Disposición": { ko: "품질 처분 판정", en: "Disposition" },
      "Disposición Final": { ko: "최종 판정 처리", en: "Final Disposition" },
      "Distribución de Órdenes (WO": { ko: "작업지시서 (WO) 분포", en: "Work Order (WO) Distribution" },
      "Distribución de Órdenes (WO)": { ko: "작업지시서 (WO) 분포", en: "Work Order (WO) Distribution" },
      "DOCUMENTO CONTROLADO SGC ISO 9001 | CÓDIGO | REV 01 | Fecha de Emisión | Página X de Y": { ko: "ISO 9001 SGC 관리문서 | 문서코드 | 개정 01 | 발행일자 | X / Y 페이지", en: "CONTROLLED DOCUMENT QMS ISO 9001 | CODE | REV 01 | Issue Date | Page X of Y" },
      "DOCUMENTO RECTOR DEL SISTEMA: LISTA MAESTRA DE FORMATOS Y REPORTES ELECTRÓNICOS CONTROLADOS": { ko: "시스템 최상위 관리 규정: 전자 서식 및 보고서 마스터 등록대장", en: "GOVERNING DOCUMENT: MASTER LIST OF CONTROLLED ELECTRONIC FORMS AND REPORTS" },
      "Documento Rector que avala todos los Reportes, Formatos, Auditorías y Registros Electrónicos del Sistema MRP/WMS KRAEM": { ko: "KRAEM MRP/WMS 시스템의 모든 전자 보고서, 서식, 감사 및 기록의 유효성을 보증하는 최상위 규정", en: "Governing document validating all Reports, Forms, Audits and Electronic Records of KRAEM MRP/WMS" },
      "Domingo": { ko: "일요일", en: "Sunday" },
      "Duración estándar de cambio de molde cuando no se especifica otra": { ko: "별도 지정이 없을 때 적용되는 표준 금형 교체 소요 시간", en: "Standard mold change duration when not otherwise specified" },
      "Duración estándar de cambio de molde cuando no se especifica otra.": { ko: "별도 지정이 없을 때 적용되는 표준 금형 교체 소요 시간.", en: "Standard mold change duration when not otherwise specified." },
      "ECN (En Cambio": { ko: "설계 변경 진행 중 (ECN", en: "ECN (Under Change" },
      "ECN (En Cambio)": { ko: "설계 변경 진행 중 (ECN)", en: "ECN (Under Change)" },
      "Editar Ficha": { ko: "인사기록 카드 수정", en: "Edit File" },
      "Editar Ficha Técnica / BOM": { ko: "기술 사양서 / BOM 수정", en: "Edit Technical Sheet / BOM" },
      "Eficiencia General": { ko: "종합 효율", en: "Overall Efficiency" },
      "Ej: KR-SYS-CC-0001, Conteo Cíclico, FIFO, Kardex": { ko: "예: KR-SYS-CC-0001, 순환실사, FIFO, 수불부", en: "E.g.: KR-SYS-CC-0001, Cycle Count, FIFO, Kardex" },
      "Ej: KR-SYS-CC-0001, Conteo Cíclico, FIFO, Kardex...": { ko: "예: KR-SYS-CC-0001, 순환실사, FIFO, 수불부...", en: "E.g.: KR-SYS-CC-0001, Cycle Count, FIFO, Kardex..." },
      "Ejecución en Máquina": { ko: "설비 생산 실행", en: "Machine Execution" },
      "Ejecutar Conteo": { ko: "실사 등록 실행", en: "Execute Count" },
      "Ejecutar Reversa": { ko: "수불 역분개(취소) 실행", en: "Execute Reversal" },
      "Elegir Año": { ko: "연도 선택", en: "Select Year" },
      "Elegir Mes": { ko: "월 선택", en: "Select Month" },
      "Elegir Semana": { ko: "주차 선택", en: "Select Week" },
      "Email de Acceso": { ko: "로그인 이메일", en: "Access Email" },
      "Email de Acceso *": { ko: "로그인 이메일 *", en: "Access Email *" },
      "Emisión automática por correo": { ko: "이메일 자동 발송", en: "Automated Email Delivery" },
      "Emisión de órdenes de compra, conexión directa con déficits del MRP y envío automatizado de correos al proveedor": { ko: "구매 발주서(PO) 발행, MRP 자재 결품 데이터 자동 연동 및 협력사 이메일 자동 발송", en: "Purchase order issuance, direct link to MRP deficits and automated email to vendor" },
      "Emisión de órdenes de compra, conexión directa con déficits del MRP y envío automatizado de correos al proveedor.": { ko: "구매 발주서(PO) 발행, MRP 자재 결품 데이터 자동 연동 및 협력사 이메일 자동 발송.", en: "Purchase order issuance, direct link to MRP deficits and automated email to vendor." },
      "Empaque / Restricción": { ko: "포장 사양 / 제약 조건", en: "Packaging / Constraint" },
      "Empaque de emergencia": { ko: "비상용 대체 포장", en: "Emergency Packaging" },
      "Empaque Estándar Logístico": { ko: "표준 물류 포장 사양", en: "Standard Logistics Packaging" },
      "Empaque Estándar Oficial": { ko: "공식 표준 포장 사양", en: "Official Standard Pack" },
      "Empaque Oficial": { ko: "공식 양산 포장 사양", en: "Official Packaging" },
      "Empaques e Insumos": { ko: "포장 용기 및 부자재", en: "Packaging & Supplies" },
      "Empaques y Carros": { ko: "포장 사양 및 대차", en: "Packaging & Carts" },
      "Empaques, Cajas y Retornables": { ko: "대차, 회수용 박스 및 전용 용기", en: "Packaging, Boxes & Returnables" },
      "EMPEZAR AUDITORÍA": { ko: "5S 감사 시작", en: "START AUDIT" },
      "Empleado": { ko: "직원 성명", en: "Employee" },
      "Empresa / Razón Social": { ko: "회사명 / 법인 상호명", en: "Company / Legal Business Name" },
      "En almacén de moldes": { ko: "금형 보관대에 보관 중", en: "In mold warehouse" },
      "EN CUARENTENA / CALIDAD": { ko: "품질 격리 보관 중", en: "IN QUARANTINE / QUALITY" },
      "En programa APS": { ko: "APS 일정에 등록됨", en: "In APS Schedule" },
      "En Reparación / Taller": { ko: "보전실 수리 중", en: "Under Repair / Toolroom" },
      "EN RETRABAJO": { ko: "재작업 진행 중", en: "IN REWORK" },
      "EN SETUP": { ko: "금형 교체 작업 중", en: "IN SETUP" },
      "En sorteo o reproceso": { ko: "선별 또는 재작업 진행 중", en: "In sorting or rework" },
      "en Supabase para sincronizarlos en toda la planta": { ko: "데이터베이스와 연동하여 전 공장에 동기화합니다", en: "in database to synchronize across the plant" },
      "en Supabase para sincronizarlos en toda la planta.": { ko: "데이터베이스와 연동하여 전 공장에 동기화합니다.", en: "in database to synchronize across the plant." },
      "En taller / bloqueados": { ko: "금형실 수리 중 (가동 불가)", en: "In toolroom / blocked" },
      "En taller / mantenimiento": { ko: "보전실 점검 수리 중", en: "In toolroom / maintenance" },
      "En Taller / Reparación": { ko: "수리 및 정비 중", en: "In Toolroom / Repair" },
      "En Tránsito / Proveedor": { ko: "배송 중 / 협력사 출하", en: "In Transit / Vendor" },
      "Enero": { ko: "1월", en: "January" },
      "English (EN": { ko: "영어 (EN", en: "English (EN" },
      "English (EN)": { ko: "영어 (EN)", en: "English (EN)" },
      "Ensamble / proceso": { ko: "조립 / 공정", en: "Assembly / Process" },
      "Ensamble / proceso *": { ko: "조립 / 공정 *", en: "Assembly / Process *" },
      "Ensamble / procesos": { ko: "조립 및 생산 공정", en: "Assembly / Processes" },
      "Entendido": { ko: "확인 완료", en: "Understood" },
      "ENTRADA": { ko: "입고 (INBOUND)", en: "INBOUND" },
      "Entrada física a almacén, registro de lote proveedor para trazabilidad FIFO y generación de etiqueta QR de tarima": { ko: "실물 창고 입고, 선입선출(FIFO) 추적을 위한 공급사 로트 등록 및 팔레트 식별 QR 라벨 발행", en: "Physical warehouse receipt, vendor lot logging for FIFO traceability and pallet QR label generation" },
      "Entrada física a almacén, registro de lote proveedor para trazabilidad FIFO y generación de etiqueta QR de tarima.": { ko: "실물 창고 입고, 선입선출(FIFO) 추적을 위한 공급사 로트 등록 및 팔레트 식별 QR 라벨 발행.", en: "Physical warehouse receipt, vendor lot logging for FIFO traceability and pallet QR label generation." },
      "ENTRADA WMS": { ko: "WMS 창고 입고", en: "WMS RECEIPT" },
      "Entradas Realizadas Hoy": { ko: "오늘 입고 완료된 건수", en: "Receipts Completed Today" },
      "Entradas, Salidas FIFO Automáticas, Transferencias, Ajustes y Reversas Blindadas": { ko: "입고, 자동 선입선출 출고, 이동, 재고조정 및 안전 역분개", en: "Inbound, Automated FIFO Outbound, Transfers, Adjustments and Secured Reversals" },
      "Entradas, salidas FIFO y ajustes": { ko: "입고, 선입선출(FIFO) 출고 및 재고 조정", en: "Inbound, FIFO Outbound & Adjustments" },
      "Entradas, Salidas FIFO, Transferencias, Ajustes y Reversas Seguras": { ko: "입고, 선입선출 출고, 이동, 조정 및 안전 역분개", en: "Inbound, FIFO Outbound, Transfers, Adjustments and Secure Reversals" },
      "Entradas, Salidas FIFO, Transferencias, Ajustes y Reversas Seguras.": { ko: "입고, 선입선출 출고, 이동, 조정 및 안전 역분개.", en: "Inbound, FIFO Outbound, Transfers, Adjustments and Secure Reversals." },
      "Entrar": { ko: "입장", en: "Enter" },
      "Entrar al Sistema": { ko: "시스템 로그인", en: "Sign In" },
      "Entre Barras H (mm": { ko: "타이바 간격 (가로 mm", en: "Between Tie Bars H (mm" },
      "Entre Barras H (mm)": { ko: "타이바 간격 (가로 mm)", en: "Between Tie Bars H (mm)" },
      "Entre Barras V (mm": { ko: "타이바 간격 (세로 mm", en: "Between Tie Bars V (mm" },
      "Entre Barras V (mm)": { ko: "타이바 간격 (세로 mm)", en: "Between Tie Bars V (mm)" },
      "Entrega Prometida": { ko: "납품 약정일", en: "Promised Delivery" },
      "ENVIADA": { ko: "발송 완료됨", en: "SENT" },
      "Envío Automático de Orden de Compra": { ko: "구매 발주서 자동 전송", en: "Automatic Purchase Order Dispatch" },
      "Error de digitación en cantidad de piezas": { ko: "수량 입력 오타 / 오기", en: "Typo in piece count" },
      "Es Parcial? (Caja/Carro incompleto": { ko: "미달 박스입니까? (부분 수량", en: "Is Partial? (Incomplete box/cart" },
      "Escaneando Código QR": { ko: "QR 바코드 스캔 중...", en: "Scanning QR Code" },
      "Escanear en WMS": { ko: "WMS에서 바코드 스캔", en: "Scan in WMS" },
      "Escáner 3-en-1, Prioridad #1 FIFO, Cuarentena, Retrabajo y Embarques": { ko: "3-in-1 스캐너, FIFO 1순위 출고, 품질 격리, 재작업 및 출하 통제", en: "3-in-1 Scanner, FIFO Priority #1, Quarantine, Rework and Shipments" },
      "Escáner 3-en-1, Prioridad #1 FIFO, Cuarentena, Retrabajo y Embarques.": { ko: "3-in-1 스캐너, FIFO 1순위 출고, 품질 격리, 재작업 및 출하 통제.", en: "3-in-1 Scanner, FIFO Priority #1, Quarantine, Rework and Shipments." },
      "Escáner QR & Torre FIFO": { ko: "QR 바코드 스캐너 및 FIFO 현황", en: "QR Scanner & FIFO Tower" },
      "Escribe comentario o nota": { ko: "비고 또는 메모 입력", en: "Write comment or note" },
      "Escribe comentario o nota...": { ko: "비고 또는 메모 입력...", en: "Write comment or note..." },
      "Escribe el nombre del operador": { ko: "작업자 성명 입력", en: "Type operator name" },
      "Escribe el nombre del operador...": { ko: "작업자 성명 입력...", en: "Type operator name..." },
      "Escribe o Escanea Código de Carrito / Contenedor": { ko: "대차/용기 QR 스캔 또는 번호 입력", en: "Enter or Scan Cart / Container Code" },
      "Escribe o Escanea Código de Carrito / Contenedor *": { ko: "대차/용기 QR 스캔 또는 번호 입력 *", en: "Enter or Scan Cart / Container Code *" },
      "Escribe o escanea etiqueta de Número de Parte": { ko: "품번 라벨 스캔 또는 입력", en: "Enter or scan Part Number label" },
      "Escribe o escanea etiqueta de Número de Parte...": { ko: "품번 라벨 스캔 또는 입력...", en: "Enter or scan Part Number label..." },
      "Escribe o Escanea Localidad Fija / Hilera": { ko: "고정 로케이션 / 랙 번호 입력", en: "Enter or Scan Fixed Location / Row" },
      "Escribe o Escanea Localidad Fija / Hilera *": { ko: "고정 로케이션 / 랙 번호 입력 *", en: "Enter or Scan Fixed Location / Row *" },
      "Escribe o Escanea Número de Parte": { ko: "품번 (N/P) 입력 또는 스캔", en: "Enter or Scan Part Number" },
      "Escribe o Escanea Número de Parte *": { ko: "품번 (N/P) 입력 또는 스캔 *", en: "Enter or Scan Part Number *" },
      "Escribe o selecciona N.P": { ko: "품번 입력 또는 목록 선택", en: "Type or select P/N" },
      "Escribe o selecciona N.P....": { ko: "품번 입력 또는 목록 선택...", en: "Type or select P/N..." },
      "Español (MX": { ko: "스페인어 (MX", en: "Spanish (MX" },
      "Español (MX)": { ko: "스페인어 (MX)", en: "Spanish (MX)" },
      "Especificaciones de Ingeniería / Inyección": { ko: "사출 엔지니어링 기술 성형 사양", en: "Engineering / Injection Specifications" },
      "Estación de Trabajo (S1–S5": { ko: "작업 스테이션 (S1-S5", en: "Workstation (S1–S5" },
      "Estación de Trabajo (S1–S5)": { ko: "작업 스테이션 (S1-S5)", en: "Workstation (S1–S5)" },
      "Estación de Trabajo / Operador (Diaria": { ko: "작업대 / 작업자 일일 점검", en: "Workstation / Operator (Daily" },
      "Estación de Trabajo / Operador (Diaria)": { ko: "작업대 / 작업자 일일 점검", en: "Workstation / Operator (Daily)" },
      "Estaciones de Trabajo": { ko: "작업 스테이션", en: "Workstations" },
      "Estado Base": { ko: "기본 진행 상태", en: "Base State" },
      "Estado de Conteo": { ko: "실사 진행 상태", en: "Count Status" },
      "Estatus / Máquina": { ko: "가동 상태 / 담당 설비", en: "Status / Machine" },
      "Estatus Catálogo": { ko: "기준정보 상태", en: "Catalog Status" },
      "Estatus de Stock": { ko: "재고 품질 상태", en: "Stock Status" },
      "ESTATUS DE VIGENCIA": { ko: "문서 유효 상태", en: "VALIDITY STATUS" },
      "Estatus Ficha": { ko: "재직 상태", en: "File Status" },
      "Estatus Ingeniería": { ko: "엔지니어링 개발 상태", en: "Engineering Status" },
      "Estatus Material (MRP": { ko: "MRP 자재 수급 상태", en: "Material MRP Status" },
      "Estatus Material (MRP)": { ko: "MRP 자재 수급 상태", en: "Material MRP Status" },
      "Estatus Molde": { ko: "금형 보전 상태", en: "Mold Status" },
      "Estatus MRP": { ko: "MRP 실행 상태", en: "MRP Status" },
      "ESTATUS OC": { ko: "발주 상태", en: "PO STATUS" },
      "ESTATUS OC:": { ko: "발주 상태:", en: "PO STATUS:" },
      "Estatus Operativo (Flota": { ko: "대차 가동 상태", en: "Operating Status (Fleet" },
      "Estatus Operativo (Flota)": { ko: "대차 가동 상태", en: "Operating Status (Fleet)" },
      "Estatus PM de moldes": { ko: "금형 예방보전 상태", en: "Mold PM Status" },
      "Este módulo está programado para la siguiente fase de implementación": { ko: "이 모듈은 다음 개발 단계에서 제공될 예정입니다", en: "This module is scheduled for the next implementation phase" },
      "Este módulo está programado para la siguiente fase de implementación.": { ko: "이 모듈은 다음 개발 단계에서 제공될 예정입니다.", en: "This module is scheduled for the next implementation phase." },
      "Estos roles tienen acceso completo sin bloqueo a todos los módulos y a Settings": { ko: "이 권한을 가진 사용자는 모든 모듈과 시스템 설정에 제한 없이 접근할 수 있습니다", en: "These roles have unrestricted access to all modules and Settings" },
      "Estos roles tienen acceso completo sin bloqueo a todos los módulos y a Settings.": { ko: "이 권한을 가진 사용자는 모든 모듈과 시스템 설정에 제한 없이 접근할 수 있습니다.", en: "These roles have unrestricted access to all modules and Settings." },
      "Estructura de Código": { ko: "문서 코드 명명 구조", en: "Code Structure" },
      "Estructura de Código:": { ko: "문서 코드 명명 구조:", en: "Code Structure:" },
      "Etiqueta / Impresión": { ko: "라벨 및 인쇄 양식", en: "Label / Printout" },
      "Etiqueta de Identificación WMS (Tarima / Bulto": { ko: "WMS 자재 식별 라벨 (팔레트 / 포대", en: "WMS Identification Label (Pallet / Bag" },
      "Etiqueta de Identificación WMS (Tarima / Bulto)": { ko: "WMS 자재 식별 라벨 (팔레트 / 포대)", en: "WMS Identification Label (Pallet / Bag)" },
      "Etiqueta QR": { ko: "QR 바코드 식별표", en: "QR Label" },
      "Etiqueta QR de Contenedor": { ko: "대차 / 용기 전용 QR 라벨", en: "Container QR Label" },
      "EUR - Euros": { ko: "EUR - 유로화", en: "EUR - Euros" },
      "Evaluación de Desempeño": { ko: "직무 수행 평가", en: "Performance Evaluation" },
      "Evaluación de orden y limpieza": { ko: "정리정돈 및 청결 평가 (5S)", en: "Order & Cleanliness Evaluation" },
      "Evaluador": { ko: "평가자", en: "Evaluator" },
      "Exactitud de registro en sistema": { ko: "전산 재고 일치 정확도", en: "System Record Accuracy" },
      "Exactos": { ko: "완전 일치", en: "Accurate" },
      "Exactos vs Con Diferencia": { ko: "일치 로트 vs 오차 로트", en: "Accurate vs With Discrepancy" },
      "Excel / CSV Controlado": { ko: "공식 관리 엑셀 / CSV", en: "Controlled Excel / CSV" },
      "Excluir texto": { ko: "제외할 키워드", en: "Exclude text" },
      "Excluir texto...": { ko: "제외할 키워드...", en: "Exclude text..." },
      "exclusivamente para el rol ADMIN": { ko: "시스템 관리자(ADMIN) 전용", en: "exclusively for ADMIN role" },
      "Expediente de Empleado": { ko: "직원 인사 파일", en: "Employee Record" },
      "Explica brevemente por qué se reversa este movimiento": { ko: "역분개(취소) 사유를 간략히 입력하세요", en: "Briefly explain why this movement is reversed" },
      "Explica brevemente por qué se reversa este movimiento...": { ko: "역분개(취소) 사유를 간략히 입력하세요...", en: "Briefly explain why this movement is reversed..." },
      "Explicación Detallada (Mínimo 6 caracteres": { ko: "상세 사유 (최소 6자 이상", en: "Detailed Explanation (Min 6 characters" },
      "Explicación Detallada (Mínimo 6 caracteres) *": { ko: "상세 사유 (최소 6자 이상) *", en: "Detailed Explanation (Min 6 characters) *" },
      "Explosión de Requerimientos de Materiales (Resinas, Insertos, Componentes": { ko: "자재 소요량 전개 (레진, 인서트, 부품 및 포장재", en: "Material Requirements Explosion (Resins, Inserts, Components" },
      "Explosión de Requerimientos de Materiales (Resinas, Insertos, Componentes)": { ko: "자재 소요량 전개 (레진, 인서트, 부품 및 포장재)", en: "Material Requirements Explosion (Resins, Inserts, Components)" },
      "Explosión MRP de Materiales": { ko: "원부자재 MRP 소요량 전개", en: "Material MRP Explosion" },
      "Explosión Resinas": { ko: "레진 소요량 전개", en: "Resin Explosion" },
      "Exportar JSON": { ko: "JSON 내보내기", en: "Export JSON" },
      "Exportar matriz": { ko: "스킬 매트릭스 엑셀 내보내기", en: "Export Matrix" },
      "Exportar Matriz Completa": { ko: "전체 매트릭스 내보내기", en: "Export Full Matrix" },
      "Fabricó": { ko: "생산 작업자", en: "Manufactured by" },
      "Fabricó...": { ko: "생산 작업자...", en: "Manufactured by..." },
      "Factor Rendimiento OEE Fallback": { ko: "기본 성능률 대체값", en: "OEE Performance Fallback" },
      "Factor Rendimiento OEE Fallback (%)": { ko: "기본 성능률 대체값 (%)", en: "OEE Performance Fallback (%)" },
      "Factura o Remisión del Proveedor": { ko: "협력사 송장 / 납품서 번호", en: "Vendor Invoice or Delivery Note" },
      "Factura o Remisión del Proveedor *": { ko: "협력사 송장 / 납품서 번호 *", en: "Vendor Invoice or Delivery Note *" },
      "Faltan tablas en Supabase. Abre el SQL Editor y ejecuta el archivo": { ko: "데이터베이스에 필수 테이블이 없습니다. SQL 편집기를 열고 스크립트를 실행하십시오:", en: "Missing tables in database. Open SQL Editor and execute file" },
      "Faltas": { ko: "결근 횟수", en: "Absences" },
      "Febrero": { ko: "2월", en: "February" },
      "Fecha de cambio": { ko: "상태 변경 일자", en: "Change Date" },
      "Fecha de Ingreso": { ko: "입사일자", en: "Hire Date" },
      "Fecha de Ingreso *": { ko: "입사일자 *", en: "Hire Date *" },
      "Fecha de inicio": { ko: "시작일", en: "Start Date" },
      "Fecha de inicio *": { ko: "시작일 *", en: "Start Date *" },
      "FECHA EMISIÓN / PROMETIDA": { ko: "발행일 / 납기 약정일", en: "ISSUE / PROMISED DATE" },
      "FECHA EMISIÓN / PROMETIDA:": { ko: "발행일 / 납기 약정일:", en: "ISSUE / PROMISED DATE:" },
      "Fecha Entrada": { ko: "입고 처리 일시", en: "Receipt Date" },
      "Fecha Entrada:": { ko: "입고 처리 일시:", en: "Receipt Date:" },
      "Fecha Fin": { ko: "종료일자", en: "End Date" },
      "Fecha Ingreso": { ko: "입사일", en: "Hire Date" },
      "Fecha Ingreso:": { ko: "입사일:", en: "Hire Date:" },
      "Fecha Inicio": { ko: "시작일자", en: "Start Date" },
      "Fecha Inicio Mínima": { ko: "최초 착수 가능일", en: "Earliest Start Date" },
      "Fecha Límite": { ko: "최종 납기 기한", en: "Deadline Date" },
      "Fecha producción": { ko: "생산 예정일", en: "Production Date" },
      "Fecha Prometida de Entrega": { ko: "납품 약정 기한", en: "Promised Delivery Date" },
      "Fecha Recibo": { ko: "입고 수령 일자", en: "Receipt Date" },
      "Fecha Req": { ko: "요청 납기일", en: "Req. Date" },
      "Fecha Req.": { ko: "요청 납기일", en: "Req. Date" },
      "Fecha Requerida": { ko: "요구 일자", en: "Required Date" },
      "Fecha Única de Ausencia": { ko: "결근 / 휴무 해당일", en: "Single Absence Date" },
      "Fecha Vigencia": { ko: "유효 기간", en: "Expiration Date" },
      "Fecha Vigencia:": { ko: "유효 기간:", en: "Expiration Date:" },
      "Ficha Técnica Maestra - KRAEM": { ko: "KRAEM 제품 기술 사양서 마스터", en: "Master Technical Sheet - KRAEM" },
      "Ficha técnica y números de parte": { ko: "기술 사양서 및 품번 관리", en: "Technical Specs & Part Numbers" },
      "Ficha técnica y obsoletos": { ko: "기술 사양서 및 단종품 관리", en: "Technical Specs & Obsoletes" },
      "FIFO & Despacho": { ko: "선입선출(FIFO) 및 출하 관리", en: "FIFO & Dispatch" },
      "Fijada Manual": { ko: "수동 고정된 일정", en: "Manually Fixed" },
      "Fijar en esta fecha/hora y reprogramar las demás": { ko: "이 일시에 일정을 고정하고 다른 지시 자동 재편성", en: "Fix at this date/time and reschedule others" },
      "Filas por Defecto Tabla MRP": { ko: "MRP 테이블 기본 행 수", en: "Default Rows for MRP Table" },
      "Filtrar área": { ko: "구역 필터링", en: "Filter Area" },
      "Filtrar área...": { ko: "구역 필터...", en: "Filter area..." },
      "Filtrar carro": { ko: "대차 필터", en: "Filter cart" },
      "Filtrar carro...": { ko: "대차 필터...", en: "Filter cart..." },
      "Filtrar descripción": { ko: "품명 필터", en: "Filter description" },
      "Filtrar descripción...": { ko: "품명 필터...", en: "Filter description..." },
      "Filtrar parte": { ko: "품번 필터", en: "Filter part" },
      "Filtrar parte...": { ko: "품번 필터...", en: "Filter part..." },
      "Filtrar por Área": { ko: "구역별 필터", en: "Filter by Area" },
      "Filtrar por Área / Depto": { ko: "구역 / 부서별 필터", en: "Filter by Area / Dept" },
      "Filtrar por Permiso (Rol": { ko: "권한(역할)별 필터", en: "Filter by Role" },
      "Filtrar por Permiso (Rol)": { ko: "권한(역할)별 필터", en: "Filter by Role" },
      "Filtrar por Puesto": { ko: "직책별 필터", en: "Filter by Position" },
      "Filtrar proyecto": { ko: "프로젝트 필터", en: "Filter project" },
      "Filtrar proyecto...": { ko: "프로젝트 필터...", en: "Filter project..." },
      "Filtrar Ruta": { ko: "통근 버스 노선 필터", en: "Filter Commute Route" },
      "Filtrar tabla por NP, nombre, cliente o proyecto": { ko: "품번, 품명, 고객사 또는 프로젝트 검색", en: "Filter by P/N, name, customer or project" },
      "Filtrar Turno": { ko: "교대조 필터", en: "Filter Shift" },
      "Filtrar ubicación": { ko: "로케이션 필터", en: "Filter location" },
      "Filtrar ubicación...": { ko: "로케이션 필터...", en: "Filter location..." },
      "Filtro de Documentos Controlados": { ko: "관리 대상 문서 필터", en: "Controlled Document Filter" },
      "Filtros de búsqueda": { ko: "검색 필터 조건", en: "Search Filters" },
      "FILTROS DE PROGRAMACIÓN ABC Y SELECCIÓN DE AUDITORÍA": { ko: "ABC 실사 계획 필터 및 감사 대상 선택", en: "ABC SCHEDULING FILTERS & AUDIT SELECTION" },
      "FINALIZAR REPORTE": { ko: "생산 실적 보고서 마감", en: "FINALIZE REPORT" },
      "Firma Autorizada RH / Supervisor": { ko: "인사과 / 부서장 승인 서명", en: "Authorized HR / Supervisor Signature" },
      "Fiscal, RFC, lead times y pedidos": { ko: "세무 정보, 리드타임 및 발주 관리", en: "Tax Info, Lead Times & Orders" },
      "Físico": { ko: "실물 수량", en: "Physical Count" },
      "Físico Contado": { ko: "실물 확인 수량", en: "Physical Counted" },
      "Físico Contado *": { ko: "실물 확인 수량 *", en: "Physical Counted *" },
      "Flota 107 / Totes": { ko: "107대 대차 플릿 / 토트 박스", en: "107 Cart Fleet / Totes" },
      "Flota Carros (107": { ko: "107대 대차 플릿", en: "Cart Fleet (107" },
      "Flota Carros (107)": { ko: "107대 대차 플릿", en: "Cart Fleet (107)" },
      "Flota Total Creada": { ko: "총 등록 대차 대수", en: "Total Fleet Created" },
      "Flujo Completo de Planeación en el ERP": { ko: "ERP 생산 계획 전체 프로세스 흐름", en: "Complete Planning Flow in ERP" },
      "Flujo End-to-End": { ko: "전체 제조 흐름 (End-to-End)", en: "End-to-End Flow" },
      "Flujo Principal": { ko: "주요 공정 흐름", en: "Main Flow" },
      "Folio OC": { ko: "발주서 번호 (PO Folio)", en: "PO Folio" },
      "Folio Orden (OP / Embarque": { ko: "작업지시 / 출하 오더 번호", en: "Order Folio (WO / Shipping" },
      "Folio Orden (OP / Embarque)": { ko: "작업지시 / 출하 오더 번호", en: "Order Folio (WO / Shipping)" },
      "Folio Orden de Embarque": { ko: "출하 지시 번호", en: "Shipping Order Folio" },
      "Folio Orden de Embarque *": { ko: "출하 지시 번호 *", en: "Shipping Order Folio *" },
      "Folio Recibo": { ko: "입고 전표 번호", en: "Receipt Folio" },
      "Forecast": { ko: "판매 예측 (Forecast)", en: "Forecast" },
      "Forecast – Análisis de Demanda": { ko: "판매 예측 - 고객 수요 분석", en: "Forecast – Demand Analysis" },
      "Forecast & Explosión MRP": { ko: "판매 예측 및 MRP 자재 소요량 전개", en: "Forecast & MRP Explosion" },
      "Forecast & MRP": { ko: "판매 예측 및 MRP 자재 계획", en: "Forecast & MRP" },
      "Forecast & Requerimientos": { ko: "판매 예측 및 수주 소요량", en: "Forecast & Requirements" },
      "Forecast, Demanda & Explosión MRP (Boceto MD01/MD04": { ko: "판매예측, 수주수요 및 MRP 자재전개 (SAP MD01/MD04 호환", en: "Forecast, Demand & MRP Explosion (SAP MD01/MD04 Draft" },
      "Forecast, Demanda & Explosión MRP (Boceto MD01/MD04)": { ko: "판매예측, 수주수요 및 MRP 자재전개 (SAP MD01/MD04 호환)", en: "Forecast, Demand & MRP Explosion (SAP MD01/MD04 Draft)" },
      "Formato de Fecha": { ko: "날짜 형식", en: "Date Format" },
      "Formato de Salida": { ko: "출력 포맷 형태", en: "Output Format" },
      "FORMATOS CONTROLADOS": { ko: "공식 관리 서식", en: "CONTROLLED FORMS" },
      "Fotografía del Producto": { ko: "완제품 외관 사진", en: "Product Photograph" },
      "Frecuencia Clase A (días": { ko: "A등급 실사 주기 (일", en: "Class A Frequency (days" },
      "Frecuencia Clase A (días)": { ko: "A등급 실사 주기 (일)", en: "Class A Frequency (days)" },
      "Frecuencia Clase B (días": { ko: "B등급 실사 주기 (일", en: "Class B Frequency (days" },
      "Frecuencia Clase B (días)": { ko: "B등급 실사 주기 (일)", en: "Class B Frequency (days)" },
      "Frecuencia Clase C (días": { ko: "C등급 실사 주기 (일", en: "Class C Frequency (days" },
      "Frecuencia Clase C (días)": { ko: "C등급 실사 주기 (일)", en: "Class C Frequency (days)" },
      "Frecuencia: Registro Diario": { ko: "주기: 일일 기록", en: "Frequency: Daily Entry" },
      "Frecuencias Conteo Cíclico ABC y Tolerancias": { ko: "ABC 순환조사 주기 및 허용오차", en: "ABC Cycle Count Frequencies & Tolerances" },
      "Gantt por prensa y kitting WMS": { ko: "사출기별 간트차트 및 WMS 키팅", en: "Gantt by Press & WMS Kitting" },
      "GENERADOR DE FORMATOS OFICIALES DE CONTEO EN PISO (PDF": { ko: "현장 실사 공식 양식 생성기 (PDF", en: "SHOP FLOOR OFFICIAL COUNT SHEET GENERATOR (PDF" },
      "GENERADOR DE FORMATOS OFICIALES DE CONTEO EN PISO (PDF)": { ko: "현장 실사 공식 양식 생성기 (PDF)", en: "SHOP FLOOR OFFICIAL COUNT SHEET GENERATOR (PDF)" },
      "Generar": { ko: "보고서 생성", en: "Generate" },
      "Generar Nueva Orden de Compra (OC": { ko: "신규 구매 발주서(PO) 작성", en: "Generate New Purchase Order (PO" },
      "Generar Nueva Orden de Compra (OC)": { ko: "신규 구매 발주서(PO) 작성", en: "Generate New Purchase Order (PO)" },
      "Generar Propuesta Automática (APS": { ko: "APS 자동 생산 일정 편성 실행", en: "Generate Automatic Proposal (APS" },
      "Generar Propuesta Automática (APS)": { ko: "APS 자동 생산 일정 편성 실행", en: "Generate Automatic Proposal (APS)" },
      "Gestión de BOM - KRAEM": { ko: "KRAEM BOM (자재명세서) 통합 관리", en: "BOM Management - KRAEM" },
      "Gestión de Compras & Órdenes (OC": { ko: "구매 발주 및 조달 관리 (PO", en: "Purchasing & Order Management (PO" },
      "Gestión de Compras & Órdenes (OC)": { ko: "구매 발주 및 조달 관리 (PO)", en: "Purchasing & Order Management (PO)" },
      "Gestión de Flota de Carros en Planta (Admin Ubicaciones": { ko: "사내 대차 플릿 현황 관리 (로케이션 관리", en: "Plant Cart Fleet Management (Location Admin" },
      "Gestión de Flota de Carros en Planta (Admin Ubicaciones)": { ko: "사내 대차 플릿 현황 관리 (로케이션 관리)", en: "Plant Cart Fleet Management (Location Admin)" },
      "Gestionar Flota de Carros": { ko: "대차 플릿 관리하기", en: "Manage Cart Fleet" },
      "Golpes / PM": { ko: "현재 타수 / 예방보전 주기", en: "Shots / PM" },
      "Golpes actuales": { ko: "누적 생산 타수 (Shots)", en: "Current Shots" },
      "Golpes límite PM": { ko: "예방정비 기준 타수 (PM)", en: "PM Shot Limit" },
      "Grado / Spec": { ko: "원재료 그레이드 및 규격", en: "Grade / Spec" },
      "Grado de Resina": { ko: "레진 재질 그레이드", en: "Resin Grade" },
      "Guardado": { ko: "저장 완료", en: "Saved" },
      "Guardando Ficha Técnica y Estructura BOM": { ko: "기술 사양서 및 BOM 저장 중", en: "Saving Technical Sheet & BOM" },
      "Guardando Ficha Técnica y Estructura BOM...": { ko: "기술 사양서 및 BOM 저장 중...", en: "Saving Technical Sheet & BOM..." },
      "Guardar Área": { ko: "구역 저장", en: "Save Area" },
      "GUARDAR AUDITORÍA": { ko: "5S 감사 결과 저장", en: "SAVE AUDIT" },
      "Guardar avance": { ko: "훈련 진척도 저장", en: "Save Progress" },
      "GUARDAR CAMBIOS DEL DÍA": { ko: "오늘의 근태 변경 저장", en: "SAVE TODAY'S CHANGES" },
      "Guardar Cliente": { ko: "고객사 저장", en: "Save Customer" },
      "GUARDAR DATOS Y BOM": { ko: "사양 데이터 및 BOM 저장", en: "SAVE DATA & BOM" },
      "Guardar Empaque": { ko: "포장 규격 저장", en: "Save Packaging" },
      "Guardar en Matriz": { ko: "스킬 매트릭스에 등록", en: "Save to Matrix" },
      "Guardar Estatus": { ko: "품질 상태 변경 저장", en: "Save Status" },
      "Guardar Liberación": { ko: "초품 합격 승인 저장", en: "Save Release" },
      "Guardar Máquina": { ko: "설비 정보 저장", en: "Save Machine" },
      "Guardar Molde": { ko: "금형 마스터 저장", en: "Save Mold" },
      "Guardar Parámetros": { ko: "기술 파라미터 저장", en: "Save Parameters" },
      "Guardar planeación": { ko: "생산 계획 저장", en: "Save Planning" },
      "Guardar Proceso": { ko: "공정 정보 저장", en: "Save Process" },
      "Guardar Proveedor": { ko: "협력업체 저장", en: "Save Vendor" },
      "GUARDAR REGISTRO": { ko: "검사 실적 등록", en: "SAVE RECORD" },
      "Guardar Solicitud": { ko: "신청서 제출", en: "Save Request" },
      "Guardar Turno": { ko: "교대조 설정 저장", en: "Save Shift" },
      "Guardar Ubicación": { ko: "로케이션 저장", en: "Save Location" },
      "Guardar y Generar OC": { ko: "발주서 저장 및 PDF/이메일 생성", en: "Save & Generate PO" },
      "HÁBIL / DISPONIBLE": { ko: "가용 / 출고 가능", en: "USABLE / AVAILABLE" },
      "Habilidad / Máquina / Curso": { ko: "직무 스킬 / 담당 설비 / 이수 교육", en: "Skill / Machine / Course" },
      "Hallazgos Registrados": { ko: "지적 사항 및 부적합 내역", en: "Recorded Findings" },
      "Hallazgos, mejoras, problemas detectados": { ko: "지적 사항, 개선 아이디어, 문제점 기록", en: "Findings, improvements, issues detected" },
      "Hallazgos, mejoras, problemas detectados...": { ko: "지적 사항, 개선 아이디어, 문제점 기록...", en: "Findings, improvements, issues detected..." },
      "Haz clic aquí para elegir del Stock o escanea": { ko: "재고 목록에서 선택하거나 스캔하세요", en: "Click here to choose from Stock or scan" },
      "Haz clic aquí para elegir del Stock o escanea...": { ko: "재고 목록에서 선택하거나 스캔하세요...", en: "Click here to choose from Stock or scan..." },
      "Haz clic en cualquier barra del Gantt o fila para mover, posponer o cancelar": { ko: "간트차트 막대나 행을 클릭하여 일정을 이동, 연기 또는 취소할 수 있습니다.", en: "Click any Gantt bar or row to move, postpone or cancel" },
      "Haz clic en cualquier tarjeta para ver el Paso a Paso Ilustrado y para qué sirve cada botón": { ko: "카드를 클릭하면 각 버튼의 기능과 그림이 포함된 단계별 표준 작업 매뉴얼을 열람할 수 있습니다.", en: "Click any card to view Illustrated Step-by-Step and what each button is for" },
      "Haz clic o escanea Origen": { ko: "출발지를 클릭하거나 스캔하세요", en: "Click or scan Origin" },
      "Haz clic o escanea Origen...": { ko: "출발지를 클릭하거나 스캔하세요...", en: "Click or scan Origin..." },
      "Haz clic para seleccionar archivo Excel (.xlsx / .xls / .csv": { ko: "클릭하여 엑셀 파일 선택 (.xlsx / .xls / .csv", en: "Click to select Excel file (.xlsx / .xls / .csv" },
      "Haz clic para seleccionar archivo Excel (.xlsx / .xls / .csv)": { ko: "클릭하여 엑셀 파일 선택 (.xlsx / .xls / .csv)", en: "Click to select Excel file (.xlsx / .xls / .csv)" },
      "Hilera o CARRO": { ko: "선반 위치 또는 대차번호", en: "Row or CART" },
      "Hilera o CARRO-...": { ko: "선반 위치 또는 대차번호...", en: "Row or CART-..." },
      "Historial conteos cíclicos": { ko: "순환조사 이력", en: "Cycle Count History" },
      "Historial de Días Tomados": { ko: "사용 휴가 상세 이력", en: "Taken Days History" },
      "Historial de niveles": { ko: "스킬 레벨 승급 이력", en: "Skill Levels History" },
      "Historial de Órdenes de Compra": { ko: "구매 발주서 발행 이력", en: "Purchase Orders History" },
      "Historial de Recibos Realizados": { ko: "자재 입고 수령 완료 내역", en: "Completed Receipts History" },
      "Historial Maestro de Movimientos": { ko: "수불 이력 종합 마스터", en: "Movement History Master" },
      "Historial Movimientos (MB51": { ko: "수불 이동 이력 (SAP MB51", en: "Movement History (MB51" },
      "Historial Movimientos (MB51)": { ko: "수불 이동 이력 (SAP MB51)", en: "Movement History (MB51)" },
      "Histórico de Salidas de Almacén": { ko: "창고 출고 이력", en: "Warehouse Issues History" },
      "Hoja de Conteo CIEGO (Oculta la cantidad del sistema para el contador": { ko: "블라인드 실사 시트 (실사자에게 전산 수량을 숨김", en: "BLIND Count Sheet (Hides system quantity from counter" },
      "Hoja de Ruta de Operaciones": { ko: "표준 공정 라우팅 시트", en: "Routing Sheet of Operations" },
      "Hoja de SUPERVISOR (Muestra la cantidad del sistema como referencia": { ko: "관리자용 시트 (전산 재고 수량 표시", en: "SUPERVISOR Sheet (Shows system count as reference" },
      "Hora de Llegada/Regreso": { ko: "출근 / 복귀 시간", en: "Arrival / Return Time" },
      "Hora Inicio Deseada (00–23h": { ko: "희망 착수 시각 (00-23시", en: "Desired Start Hour (00–23h" },
      "Hora Inicio Deseada (00–23h)": { ko: "희망 착수 시각 (00-23시)", en: "Desired Start Hour (00–23h)" },
      "Hora Salida": { ko: "퇴근 시간", en: "Departure Time" },
      "Horario Autorizado": { ko: "공식 승인 근무시간", en: "Authorized Schedule" },
      "Horario Autorizado:": { ko: "공식 승인 근무시간:", en: "Authorized Schedule:" },
      "Horarios Específicos por Día": { ko: "요일별 근무 일정", en: "Day-Specific Schedules" },
      "Horarios Específicos por Día:": { ko: "요일별 근무 일정:", en: "Day-Specific Schedules:" },
      "Horarios por día": { ko: "일별 근무 시간", en: "Schedules by Day" },
      "Horas disponibles": { ko: "가용 설비 시간", en: "Available Hours" },
      "Horas Disponibles por Prensa / Día": { ko: "사출기별 일일 가용 시간", en: "Available Hours per Press / Day" },
      "Horas estimadas": { ko: "예상 소요 시간", en: "Estimated Hours" },
      "Horas planeadas": { ko: "계획 편성 시간", en: "Planned Hours" },
      "Horas Prod. / Día": { ko: "일일 생산 가능 시간", en: "Prod. Hours / Day" },
      "Horas Totales Cargadas": { ko: "총 부하 시간", en: "Total Loaded Hours" },
      "Horizonte de Carga APS (días": { ko: "APS 부하 계획 수립 기간 (일", en: "APS Scheduling Horizon (days" },
      "Horizonte de Carga APS (días)": { ko: "APS 부하 계획 수립 기간 (일)", en: "APS Scheduling Horizon (days)" },
      "Identidad de Planta y Respaldo de Configuración": { ko: "공장 정보 및 설정 백업", en: "Plant Identity & Config Backup" },
      "Idioma Predeterminado": { ko: "기본 언어", en: "Default Language" },
      "Importar JSON": { ko: "JSON 가져오기", en: "Import JSON" },
      "Imprimir Acta / Lista Maestra PDF (Firmas ISO": { ko: "ISO 관리대장 PDF 인쇄 (공식 서명란 포함", en: "Print Master Document List PDF (ISO Signatures" },
      "Imprimir Acta / Lista Maestra PDF (Firmas ISO)": { ko: "ISO 관리대장 PDF 인쇄 (공식 서명란 포함)", en: "Print Master Document List PDF (ISO Signatures)" },
      "Imprimir Etiqueta": { ko: "QR 바코드 라벨 인쇄", en: "Print Label" },
      "Imprimir Hoja Ciega (Seleccionados": { ko: "선택 항목 블라인드 시트 인쇄", en: "Print Blind Sheet (Selected" },
      "Imprimir Hoja Ciega (Seleccionados)": { ko: "선택 항목 블라인드 시트 인쇄", en: "Print Blind Sheet (Selected)" },
      "Imprimir QR": { ko: "QR 바코드 인쇄", en: "Print QR" },
      "Inactivo / Bloqueado": { ko: "비활성 / 잠금 조치", en: "Inactive / Blocked" },
      "Incapacidad (Enfermedad": { ko: "질병 병가 (의사 진단", en: "Medical Leave (Illness" },
      "Incapacidad (Enfermedad)": { ko: "질병 병가 (의사 진단)", en: "Medical Leave (Illness)" },
      "Incapacidad (Maternidad/Paternidad": { ko: "출산 / 육아 휴직", en: "Maternity/Paternity Leave" },
      "Incapacidad (Maternidad/Paternidad)": { ko: "출산 / 육아 휴직", en: "Maternity/Paternity Leave" },
      "Incapacidades y justificaciones": { ko: "병가 및 사유서 관리", en: "Disabilities & Justifications" },
      "Incapacidades/Permisos": { ko: "병가 및 공식 승인 결근", en: "Leaves & Justifications" },
      "Información General": { ko: "일반 기본 정보", en: "General Information" },
      "Ingeniería - KRAEM": { ko: "KRAEM 엔지니어링", en: "Engineering - KRAEM" },
      "Ingeniería & BOM": { ko: "엔지니어링 및 BOM", en: "Engineering & BOM" },
      "Ingresa la cantidad física encontrada en cada Ubicación, Carrito y Lote": { ko: "각 로케이션, 대차 및 로트에서 발견된 실물 수량을 입력하세요", en: "Enter physical quantity found in each Location, Cart and Lot" },
      "Ingresa la cantidad física encontrada en cada Ubicación, Carrito y Lote.": { ko: "각 로케이션, 대차 및 로트에서 발견된 실물 수량을 입력하세요.", en: "Enter physical quantity found in each Location, Cart and Lot." },
      "Ingresa la cantidad física que está ingresando, el": { ko: "실제 입고되는 수량 및 공급사 로트번호를 입력하고", en: "Enter the physical quantity received, the" },
      "Ingrese N/P": { ko: "품번(N/P) 입력", en: "Enter P/N" },
      "Ingrese N/P...": { ko: "품번(N/P) 입력...", en: "Enter P/N..." },
      "Ingreso Planta": { ko: "공장 입문 시간", en: "Plant Entry Time" },
      "INICIAR CORRIDA": { ko: "양산 런(Run) 시작", en: "START PRODUCTION RUN" },
      "Iniciar Sesión Ahora": { ko: "지금 로그인", en: "Sign In Now" },
      "INICIO": { ko: "초기 홈", en: "HOME" },
      "Insp": { ko: "검사", en: "Insp" },
      "INSPECCION": { ko: "품질 검사 공정", en: "INSPECTION" },
      "Inspección Validación": { ko: "품질 검증 및 승인", en: "Inspection & Validation" },
      "Inspección Visual (Sin ráfagas/quemados": { ko: "외관 육안 검사 (은조흔/미성형/탄화 없음", en: "Visual Inspection (No silver streaks/burns" },
      "Inspección Visual (Sin ráfagas/quemados)": { ko: "외관 육안 검사 (은조흔/미성형/탄화 없음)", en: "Visual Inspection (No silver streaks/burns)" },
      "INSPECCIONADO": { ko: "검사 완료 수량", en: "INSPECTED" },
      "Inspecciones Recientes": { ko: "최근 검사 내역", en: "Recent Inspections" },
      "Inspector": { ko: "검사원", en: "Inspector" },
      "Instrucción a Caseta": { ko: "경비실 출입 지침", en: "Gatehouse Instruction" },
      "Instrucción a Caseta:": { ko: "경비실 출입 지침:", en: "Gatehouse Instruction:" },
      "Instrucciones / Notas de Operación": { ko: "작업 표준 지침 및 주의사항", en: "Instructions / Operation Notes" },
      "Instructor / evaluador": { ko: "교육 강사 / 평가 담당자", en: "Trainer / Evaluator" },
      "Inventario Actual Total": { ko: "현재 총 재고 수량", en: "Total Current Inventory" },
      "Inventario General - Control Total": { ko: "통합 재고 현황 - 총괄 제어", en: "General Inventory - Total Control" },
      "Inventario por Áreas": { ko: "구역별 재고", en: "Inventory by Areas" },
      "Inventario por Ubicación": { ko: "로케이션별 재고 현황", en: "Inventory by Location" },
      "Investigación por Discrepancia Reportada": { ko: "보고된 수량 오차 조사", en: "Investigation for Reported Discrepancy" },
      "INYECCION": { ko: "사출 성형 공정", en: "INJECTION" },
      "Ir a Compras (OC": { ko: "구매 발주 관리로 이동", en: "Go to Purchasing (PO" },
      "Ir a Compras (OC)": { ko: "구매 발주 관리로 이동", en: "Go to Purchasing (PO)" },
      "Ir a Conteos Cíclicos": { ko: "순환 재고조사 바로가기", en: "Go to Cycle Counts" },
      "Ir a Paretos de Calidad": { ko: "품질 파레토 분석 바로가기", en: "Go to Quality Pareto" },
      "Ir a Simulación BOM": { ko: "BOM 자재 소요량 시뮬레이션 이동", en: "Go to BOM Simulation" },
      "Ir a Tablero APS": { ko: "APS 현황판 바로가기", en: "Go to APS Board" },
      "Ir a WMS Operaciones": { ko: "WMS 작업 화면으로 이동", en: "Go to WMS Operations" },
      "Ir al Módulo": { ko: "해당 모듈로 이동", en: "Go to Module" },
      "IRA % (Inventory Record Accuracy": { ko: "재고 정확도 (IRA", en: "IRA % (Inventory Record Accuracy" },
      "IRA % (Inventory Record Accuracy)": { ko: "재고 정확도 (IRA %)", en: "IRA % (Inventory Record Accuracy)" },
      "ISO 9001 / IATF 16949": { ko: "ISO 9001 / IATF 16949 품질인증", en: "ISO 9001 / IATF 16949" },
      "IVA (16": { ko: "부가세 IVA (16", en: "VAT (16" },
      "IVA (16%):": { ko: "부가세 IVA (16%):", en: "VAT (16%):" },
      "Jueves": { ko: "목요일", en: "Thursday" },
      "Julio": { ko: "7월", en: "July" },
      "Junio": { ko: "6월", en: "June" },
      "Kardex auditable, rastreo de lotes/carritos y folios reversados": { ko: "감사 가능한 수불부, 로트/대차 실시간 추적 및 역분개 전표 관리", en: "Auditable Kardex, lot/cart tracking and reversed folios" },
      "Kardex auditable, rastreo de lotes/carritos y folios reversados.": { ko: "감사 가능한 수불부, 로트/대차 실시간 추적 및 역분개 전표 관리.", en: "Auditable Kardex, lot/cart tracking and reversed folios." },
      "Kardex de transacciones (MB51": { ko: "재고 수불부 (MB51", en: "Transaction Kardex (MB51" },
      "Kardex de transacciones (MB51)": { ko: "재고 수불부 (MB51)", en: "Transaction Kardex (MB51)" },
      "KG / PZA": { ko: "kg / 개", en: "KG / PCS" },
      "KILOGRAMOS (KG": { ko: "킬로그램 (KG", en: "KILOGRAMS (KG" },
      "KILOGRAMOS (KG)": { ko: "킬로그램 (KG)", en: "KILOGRAMS (KG)" },
      "Kitting WMS": { ko: "WMS 현장 자재 키팅", en: "WMS Kitting" },
      "KRAEM - Gestión de Personal e Indicadores": { ko: "KRAEM - 인사 노무 및 핵심 지표 관리", en: "KRAEM - Personnel Management & Indicators" },
      "KRAEM - Matriz de Habilidades": { ko: "KRAEM - 현장 다기능 스킬 매트릭스", en: "KRAEM - Skills Matrix" },
      "KRAEM | Administración de Áreas": { ko: "KRAEM | 공장 구역 관리", en: "KRAEM | Area Administration" },
      "KRAEM | Administración de Máquinas": { ko: "KRAEM | 사출기 설비 관리", en: "KRAEM | Machine Administration" },
      "KRAEM | Auditoría 5S": { ko: "KRAEM | 현장 5S 감사 진단", en: "KRAEM | 5S Audit" },
      "KRAEM | BI Analytics 80/20": { ko: "KRAEM | 80/20 불량 통계 분석", en: "KRAEM | BI Analytics 80/20" },
      "KRAEM | Buscador QR, FIFO y Torre de Control de Inventarios": { ko: "KRAEM | QR 검색, 선입선출(FIFO) 및 재고 관제탑", en: "KRAEM | QR Finder, FIFO & Inventory Control Tower" },
      "KRAEM | Business Intelligence 5'S": { ko: "KRAEM | 5S 비즈니스 인텔리전스", en: "KRAEM | 5S Business Intelligence" },
      "KRAEM | Catálogo Áreas Generales": { ko: "KRAEM | 대분류 구역 카탈로그", en: "KRAEM | General Areas Catalog" },
      "KRAEM | Catálogo de Checklists (SMED & Calidad": { ko: "KRAEM | 체크리스트 마스터 (SMED & 품질", en: "KRAEM | Checklists Catalog (SMED & QA" },
      "KRAEM | Catálogo de Checklists (SMED & Calidad)": { ko: "KRAEM | 체크리스트 마스터 (SMED & 품질)", en: "KRAEM | Checklists Catalog (SMED & QA)" },
      "KRAEM | Catálogo de Clientes": { ko: "KRAEM | 고객사 카탈로그", en: "KRAEM | Customer Catalog" },
      "KRAEM | Catálogo de Materiales y Parámetros MRP": { ko: "KRAEM | 원부자재 카탈로그 & MRP 파라미터", en: "KRAEM | Materials Catalog & MRP Parameters" },
      "KRAEM | Catálogo de Ubicaciones": { ko: "KRAEM | 창고 로케이션 카탈로그", en: "KRAEM | Locations Catalog" },
      "KRAEM | Catálogo Maestro de Empaques y Gestión de Flota": { ko: "KRAEM | 포장 사양 마스터 및 대차 플릿 관리", en: "KRAEM | Master Packaging Catalog & Fleet Management" },
      "KRAEM | Catálogos Ingeniería": { ko: "KRAEM | 엔지니어링 기준정보 마스터", en: "KRAEM | Engineering Catalogs" },
      "KRAEM | Control de Asistencia": { ko: "KRAEM | 출퇴근 및 일일 근태 관리", en: "KRAEM | Attendance Control" },
      "KRAEM | Estación de Conteos Cíclicos, Auditoría QR y Veracidad IRA": { ko: "KRAEM | 순환 실사, QR 감사 및 재고 정확도 (IRA) 스테이션", en: "KRAEM | Cycle Count Station, QR Audit & IRA Accuracy" },
      "KRAEM | Gestión Avanzada de Turnos": { ko: "KRAEM | 교대조 일정 고급 관리", en: "KRAEM | Advanced Shift Management" },
      "KRAEM | Historial Maestro de Movimientos (SAP MB51": { ko: "KRAEM | 통합 수불 이력 마스터 (SAP MB51 호환", en: "KRAEM | Movement History Master (SAP MB51" },
      "KRAEM | Historial Maestro de Movimientos (SAP MB51)": { ko: "KRAEM | 통합 수불 이력 마스터 (SAP MB51 호환)", en: "KRAEM | Movement History Master (SAP MB51)" },
      "KRAEM | INSPECCION DE PRODUCCION": { ko: "KRAEM | 생산 라인 품질 검사", en: "KRAEM | PRODUCTION INSPECTION" },
      "KRAEM | Lista Maestra de Documentos y Control ISO 9001 / IATF 16949": { ko: "KRAEM | ISO 9001 / IATF 16949 품질 문서 관리 대장", en: "KRAEM | Master Document List & ISO 9001 / IATF 16949 Control" },
      "KRAEM | Maestro de Moldes": { ko: "KRAEM | 사출 금형 마스터", en: "KRAEM | Molds Master" },
      "KRAEM | Procesos, Hojas de Ruta (CA01) y Versiones (C223": { ko: "KRAEM | 공정, 표준 라우팅 (CA01) 및 생산 버전 (C223", en: "KRAEM | Processes, Routings (CA01) & Versions (C223" },
      "KRAEM | Procesos, Hojas de Ruta (CA01) y Versiones (C223)": { ko: "KRAEM | 공정, 표준 라우팅 (CA01) 및 생산 버전 (C223)", en: "KRAEM | Processes, Routings (CA01) & Versions (C223)" },
      "KRAEM | Reporte Maestro de Asistencia y Extra": { ko: "KRAEM | 출결 집계 및 잔업(특근) 마스터 리포트", en: "KRAEM | Master Attendance & Overtime Report" },
      "KRAEM | Solicitudes RH PRO": { ko: "KRAEM | 인사 휴가 및 외출 신청 관리 PRO", en: "KRAEM | HR Requests PRO" },
      "KRAEM by APEX SYSTEM | Catálogo de Proveedores": { ko: "KRAEM by APEX SYSTEM | 협력업체 디렉터리", en: "KRAEM by APEX SYSTEM | Vendor Catalog" },
      "KRAEM by APEX SYSTEM | Estación Unificada de Operaciones WMS": { ko: "KRAEM by APEX SYSTEM | WMS 통합 작업 스테이션", en: "KRAEM by APEX SYSTEM | Unified WMS Operations Station" },
      "KRAEM by APEX SYSTEM | Órdenes de Compra & Requisiciones": { ko: "KRAEM by APEX SYSTEM | 구매 발주서 및 구매 청구", en: "KRAEM by APEX SYSTEM | Purchase Orders & Requisitions" },
      "KRAEM by APEX SYSTEM | Recepción de Materiales WMS": { ko: "KRAEM by APEX SYSTEM | WMS 원부자재 입고 검수", en: "KRAEM by APEX SYSTEM | WMS Material Receiving" },
      "KRAEM ERP | Boceto Forecast & Explosión MRP": { ko: "KRAEM ERP | 판매예측 및 MRP 자재전개", en: "KRAEM ERP | Forecast & MRP Explosion Draft" },
      "KRAEM ERP | Boceto Montaje de Moldes (SMED": { ko: "KRAEM ERP | SMED 금형교체 계획", en: "KRAEM ERP | SMED Mold Setup Draft" },
      "KRAEM ERP | Boceto Montaje de Moldes (SMED)": { ko: "KRAEM ERP | SMED 금형교체 계획", en: "KRAEM ERP | SMED Mold Setup Draft" },
      "KRAEM ERP | Boceto Tablero APS Autónomo & Gantt": { ko: "KRAEM ERP | 지능형 APS 현황판 & 간트차트", en: "KRAEM ERP | Autonomous APS Board & Gantt" },
      "KRAEM ERP | Cockpit Planeación (Boceto PP/MRP/APS": { ko: "KRAEM ERP | 통합 생산 계획 콕핏 (PP/MRP/APS", en: "KRAEM ERP | Planning Cockpit (PP/MRP/APS" },
      "KRAEM ERP | Cockpit Planeación (Boceto PP/MRP/APS)": { ko: "KRAEM ERP | 통합 생산 계획 콕핏 (PP/MRP/APS)", en: "KRAEM ERP | Planning Cockpit (PP/MRP/APS)" },
      "KRAEM INSPECCION DE PRODUCCION": { ko: "KRAEM 생산 검사 실적", en: "KRAEM PRODUCTION INSPECTION" },
      "KRAEM MRP | Configuración del Sistema": { ko: "KRAEM MRP | 시스템 환경설정", en: "KRAEM MRP | System Settings" },
      "KRAEM MRP | Dashboard Ejecutivo de KPIs": { ko: "KRAEM MRP | 경영진 KPI 대시보드", en: "KRAEM MRP | Executive KPI Dashboard" },
      "Kraem S.A. de C.V. - Sistema Automatizado Corporativo de Control Interno RH - 2026": { ko: "Kraem S.A. de C.V. - 사내 인사 근태 통합 관리 시스템 - 2026", en: "Kraem S.A. de C.V. - Corporate Internal HR Control System - 2026" },
      "Lado": { ko: "장착 방향 (LH/RH)", en: "Side" },
      "Largo (mm": { ko: "길이 (mm", en: "Length (mm" },
      "Largo (mm)": { ko: "길이 (mm)", en: "Length (mm)" },
      "Largo × Ancho (cm": { ko: "길이 × 너비 (cm", en: "Length × Width (cm" },
      "Largo × Ancho (cm)": { ko: "길이 × 너비 (cm)", en: "Length × Width (cm)" },
      "Largo cm": { ko: "길이 cm", en: "Length cm" },
      "Lead Time": { ko: "조달 리드타임", en: "Lead Time" },
      "Lead Time Estándar (Días": { ko: "표준 조달 리드타임 (일", en: "Standard Lead Time (Days" },
      "Lead Time Estándar (Días) *": { ko: "표준 조달 리드타임 (일) *", en: "Standard Lead Time (Days) *" },
      "Lectura WMS lista · Kitting en Fase 3": { ko: "WMS 연동 완료 · 3단계 키팅 준비", en: "WMS read ready · Phase 3 Kitting" },
      "Lee las demandas del módulo": { ko: "수요 모듈의 데이터를 조회합니다", en: "Reads demands from module" },
      "Leyendo archivo de Excel": { ko: "엑셀 파일 분석 중", en: "Reading Excel file" },
      "Leyendo archivo de Excel...": { ko: "엑셀 파일 분석 중...", en: "Reading Excel file..." },
      "LH": { ko: "좌측 (LH)", en: "LH" },
      "Liberación de Primera Pieza": { ko: "초품 합격 승인 (First Piece Release)", en: "First Piece Release" },
      "Liberaciones y auditorías de lote": { ko: "초품 승인 및 로트 출하 감사", en: "Lot Release & Audits" },
      "Liberado": { ko: "품질 승인됨", en: "Released" },
      "Liberar Máquina a Producción (Boceto": { ko: "설비 양산 투입 승인", en: "Release Machine to Production" },
      "Liberar Máquina a Producción (Boceto)": { ko: "설비 양산 투입 승인", en: "Release Machine to Production" },
      "Libre para FIFO y Embarque": { ko: "선입선출 및 출하 가능 (가용 재고)", en: "Free for FIFO and Shipping" },
      "Limpiar Filtros": { ko: "필터 초기화", en: "Clear Filters" },
      "Limpiar selección": { ko: "선택 항목 해제", en: "Clear Selection" },
      "Limpiar Todo": { ko: "전체 초기화", en: "Clear All" },
      "Líneas de Demanda": { ko: "수주 및 수요 라인 수", en: "Demand Lines" },
      "Líneas y naves de producción": { ko: "생산 라인 및 공장 동", en: "Production Lines & Bays" },
      "Lista de Surtido/Kitting por WO a pie de máquina y Requisiciones de compra de MP": { ko: "작업지시별 설비 라인 사이드 자재 키팅 목록 및 원자재 구매 청구서", en: "Material Kitting list per WO to machine and Raw Material Purchase Requisitions" },
      "Lista Maestra de Control Documental (SGC ISO 9001 / IATF 16949": { ko: "품질 문서 관리 대장 (SGC ISO 9001 / IATF 16949", en: "Document Control Master List (QMS ISO 9001 / IATF 16949" },
      "Lista Maestra ISO (SGC": { ko: "ISO 품질문서 관리대장 (SGC", en: "ISO Master Document List" },
      "Lista Maestra ISO (SGC)": { ko: "ISO 품질문서 관리대장 (SGC)", en: "ISO Master Document List" },
      "Listas de Producción, Inspección y Control ISO": { ko: "생산 지시, 검사 및 ISO 관리 목록", en: "Production, Inspection & ISO Lists" },
      "Listas de verificación para Montaje de Moldes, Primera Pieza, Cambio de Material y Auditorías": { ko: "금형 교체, 초품 검사, 원료 변경 및 공정 감사를 위한 점검 목록", en: "Checklists for Mold Setup, First Piece, Material Change and Process Audits" },
      "LITROS (L": { ko: "리터 (L", en: "LITERS (L" },
      "LITROS (L)": { ko: "리터 (L)", en: "LITERS (L)" },
      "LIVE": { ko: "실시간", en: "LIVE" },
      "Locaciones físicas, WIP, embarques, inspección y almacenes": { ko: "실물 위치, 공정간 재공(WIP), 출하장, 검사장 및 원자재/완제품 창고", en: "Physical locations, WIP, shipping, inspection and warehouses" },
      "Locaciones físicas, WIP, embarques, inspección y almacenes.": { ko: "실물 위치, 공정간 재공(WIP), 출하장, 검사장 및 원자재/완제품 창고.", en: "Physical locations, WIP, shipping, inspection and warehouses." },
      "Login - KRAEM by APEX SYSTEM": { ko: "로그인 - KRAEM by APEX SYSTEM", en: "Login - KRAEM by APEX SYSTEM" },
      "Los Materiales Seleccionados con Palomita en la Pestaña 1": { ko: "1번 탭에서 체크된 품목들", en: "Materials Checked in Tab 1" },
      "Lote (FIFO": { ko: "FIFO 우선 로트", en: "Lot (FIFO" },
      "Lote (FIFO)": { ko: "FIFO 우선 로트", en: "Lot (FIFO)" },
      "Lote (YYYYMMDD": { ko: "로트 번호 (YYYYMMDD", en: "Lot (YYYYMMDD" },
      "Lote de Proveedor": { ko: "공급사 제조 로트", en: "Vendor Lot" },
      "Lote FIFO": { ko: "선입선출(FIFO) 로트", en: "FIFO Lot" },
      "Lote Mín / Múlt": { ko: "최소발주량 / 배수", en: "Min Lot / Multiple" },
      "Lote Mín / Múlt.": { ko: "최소발주량 / 배수", en: "Min Lot / Multiple" },
      "Lote Mínimo Compra": { ko: "최소 구매 발주 수량 (MOQ)", en: "Minimum Purchase Lot (MOQ)" },
      "Lote Proveedor (FIFO": { ko: "공급사 로트 (FIFO 추적", en: "VENDOR LOT (FIFO" },
      "Lote Proveedor (FIFO) *": { ko: "공급사 로트 번호 (FIFO 관리용) *", en: "Vendor Lot (FIFO) *" },
      "LOTE PROVEEDOR (FIFO):": { ko: "공급사 로트 (FIFO 추적):", en: "VENDOR LOT (FIFO):" },
      "Lote proveedor FIFO & etiqueta QR": { ko: "공급사 로트 FIFO 및 QR 라벨", en: "Vendor Lot FIFO & QR Label" },
      "Lote Resina": { ko: "원재료 레진 로트번호", en: "Resin Lot" },
      "Lotes 100% Exactos": { ko: "100% 일치 로트", en: "100% Accurate Lots" },
      "Lotes Ajustados": { ko: "조정된 로트 수", en: "Adjusted Lots" },
      "Lotes Disponibles por FIFO (Se auto-carga el más antiguo; toca otro si requieres cambiar": { ko: "FIFO 출고 가능 로트 (가장 오래된 로트가 자동 선택되며 터치하여 변경 가능", en: "Available Lots by FIFO (Oldest lot auto-selected; tap another to change" },
      "Lotes Disponibles por FIFO (Se auto-carga el más antiguo; toca otro si requieres cambiar)": { ko: "FIFO 출고 가능 로트 (가장 오래된 로트가 자동 선택되며 터치하여 변경 가능)", en: "Available Lots by FIFO (Oldest lot auto-selected; tap another to change)" },
      "Lotes Divididos por Empaque": { ko: "포장 용기 용량 기준 분할 로트", en: "Lots Split by Packaging" },
      "Lugar de Entrega": { ko: "납품 장소 (공장/창고)", en: "Delivery Place" },
      "Lun - Jue": { ko: "월 - 목", en: "Mon - Thu" },
      "Lunes": { ko: "월요일", en: "Monday" },
      "Macro áreas principales como LS, Nissei, HDL, Calidad y Almacén": { ko: "LS, 니세이, HDL, 품질 및 창고 등 공장 주요 대분류 구역", en: "Main macro areas like LS, Nissei, HDL, Quality and Warehouse" },
      "Macro áreas principales como LS, Nissei, HDL, Calidad y Almacén.": { ko: "LS, 니세이, HDL, 품질 및 창고 등 공장 주요 대분류 구역.", en: "Main macro areas like LS, Nissei, HDL, Quality and Warehouse." },
      "Maestro de Moldes": { ko: "금형 기준정보 마스터", en: "Molds Master" },
      "Maestro listo (Fase 1 y 2": { ko: "마스터 기준정보 준비 완료 (1, 2단계", en: "Master ready (Phase 1 & 2" },
      "Maestro listo (Fase 1 y 2)": { ko: "마스터 기준정보 준비 완료 (1, 2단계)", en: "Master ready (Phase 1 & 2)" },
      "Mapa de Conexión entre Módulos (Ingeniería ↔ Planeación ↔ WMS ↔ Producción": { ko: "모듈 간 실시간 연계 맵 (엔지니어링 ↔ 생산계획 ↔ WMS창고 ↔ 제조현장", en: "Module Connection Map (Engineering ↔ Planning ↔ WMS ↔ Production" },
      "Mapa de Conexión entre Módulos (Ingeniería ↔ Planeación ↔ WMS ↔ Producción)": { ko: "모듈 간 실시간 연계 맵 (엔지니어링 ↔ 생산계획 ↔ WMS창고 ↔ 제조현장)", en: "Module Connection Map (Engineering ↔ Planning ↔ WMS ↔ Production)" },
      "Máquina / Estación": { ko: "설비 / 작업 스테이션", en: "Machine / Workstation" },
      "Máquina Asignada": { ko: "배정된 사출기", en: "Assigned Machine" },
      "Máquina de Inyección (Diaria": { ko: "사출 성형기 일일 점검", en: "Injection Machine (Daily" },
      "Máquina de Inyección (Diaria)": { ko: "사출 성형기 일일 점검", en: "Injection Machine (Daily)" },
      "Máquina donde está montado": { ko: "현재 금형 장착 설비", en: "Machine where mounted" },
      "Máquinas compatibles": { ko: "장착 가능한 호환 사출기", en: "Compatible Machines" },
      "Máquinas Configuradas": { ko: "등록된 설비 수", en: "Configured Machines" },
      "Máquinas de Inyección": { ko: "사출 성형기", en: "Injection Molding Machines" },
      "Máquinas de Inyección (S1–S5": { ko: "사출 성형기 (S1-S5", en: "Injection Presses (S1–S5" },
      "Máquinas de Inyección (S1–S5)": { ko: "사출 성형기 (S1-S5)", en: "Injection Presses (S1–S5)" },
      "Máquinas, defectos y parámetros": { ko: "설비, 불량 유형 및 성형 조건", en: "Machines, Defects & Parameters" },
      "Martes": { ko: "화요일", en: "Tuesday" },
      "Marzo": { ko: "3월", en: "March" },
      "Material / N.P": { ko: "자재 / 품번", en: "Material / P/N" },
      "Material / N.P.": { ko: "자재 / 품번", en: "Material / P/N" },
      "Materiales baja rotación (default 180 días": { ko: "저회전 자재 (기본 180일 주기", en: "Slow moving materials (default 180 days" },
      "Materiales baja rotación (default 180 días).": { ko: "저회전 자재 (기본 180일 주기).", en: "Slow moving materials (default 180 days)." },
      "Materiales Bajo Stock Seg": { ko: "안전재고 미달 품목", en: "Materials Below Safety Stock" },
      "Materiales Bajo Stock Seg.": { ko: "안전재고 미달 품목", en: "Materials Below Safety Stock" },
      "Materiales con Déficit Compra": { ko: "구매 발주 필요 부족 자재", en: "Materials with Purchase Deficit" },
      "Materiales críticos / alta rotación (default 30 días": { ko: "고회전 / 핵심 자재 (기본 30일 주기", en: "Critical / fast moving materials (default 30 days" },
      "Materiales críticos / alta rotación (default 30 días).": { ko: "고회전 / 핵심 자재 (기본 30일 주기).", en: "Critical / fast moving materials (default 30 days)." },
      "Materiales rotación media (default 90 días": { ko: "중회전 자재 (기본 90일 주기", en: "Medium moving materials (default 90 days" },
      "Materiales rotación media (default 90 días).": { ko: "중회전 자재 (기본 90일 주기).", en: "Medium moving materials (default 90 days)." },
      "Matriz de Acceso por Rol y Módulos": { ko: "역할 및 모듈별 접근 권한 매트릭스", en: "Role & Module Access Matrix" },
      "Matriz de Conocimientos": { ko: "직무 지식 숙련도 매트릭스", en: "Knowledge Matrix" },
      "Matriz de Habilidades por Proceso": { ko: "공정별 다기능 스킬 매트릭스", en: "Skills Matrix by Process" },
      "Mayo": { ko: "5월", en: "May" },
      "Medio / Formato": { ko: "보관 매체 / 서식", en: "Medium / Format" },
      "Merma / Scrap": { ko: "스크랩 / 손실률", en: "Scrap / Loss" },
      "Merma / Scrap Estándar": { ko: "표준 스크랩 및 공정 손실률", en: "Standard Scrap / Loss" },
      "Merma en maniobra de almacén": { ko: "창고 운반/적재 중 파손 및 손실", en: "Loss during warehouse handling" },
      "MES - Iniciar Corrida": { ko: "MES - 생산 가동 착수", en: "MES - Start Production Run" },
      "Mes Completo": { ko: "한 달 전체", en: "Full Month" },
      "Mes en curso": { ko: "이번 달", en: "Current Month" },
      "Mes específico": { ko: "특정 월 선택", en: "Specific Month" },
      "Meta Aprobatoria Auditoría 5S": { ko: "5S 감사 합격 목표 점수", en: "5S Audit Passing Target" },
      "Meta Aprobatoria Auditoría 5S (%)": { ko: "5S 감사 합격 목표 점수 (%)", en: "5S Audit Passing Target (%)" },
      "Meta Cumplimiento Plan vs Real": { ko: "생산 계획 대비 실적 목표", en: "Plan vs Actual Compliance Target" },
      "Meta Cumplimiento Plan vs Real (%)": { ko: "생산 계획 대비 실적 목표 (%)", en: "Plan vs Actual Compliance Target (%)" },
      "Meta Lote": { ko: "로트 목표 수량", en: "Lot Target" },
      "Meta OEE": { ko: "OEE 종합 목표", en: "OEE Target" },
      "Meta OEE (%)": { ko: "목표 OEE 종합효율 (%)", en: "Target OEE (%)" },
      "Meta OEE Global Planta": { ko: "공장 종합 OEE 목표치", en: "Global Plant OEE Target" },
      "Meta OEE Global Planta (%)": { ko: "공장 종합 OEE 목표치 (%)", en: "Global Plant OEE Target (%)" },
      "Meta Planeada": { ko: "계획 목표치", en: "Planned Target" },
      "Meta Veracidad de Inventario IRA": { ko: "재고 정확도(IRA) 목표치", en: "Inventory Accuracy (IRA) Target" },
      "Meta Veracidad de Inventario IRA (%)": { ko: "재고 정확도(IRA) 목표치 (%)", en: "Inventory Accuracy (IRA) Target (%)" },
      "Meta Versatilidad Matriz Habilidades": { ko: "다기능 매트릭스 유연성 목표", en: "Skills Matrix Versatility Target" },
      "Meta Versatilidad Matriz Habilidades (%)": { ko: "다기능 매트릭스 유연성 목표 (%)", en: "Skills Matrix Versatility Target (%)" },
      "Metas Gerenciales y Factores KPI": { ko: "경영 목표치 및 KPI 산출 계수", en: "Management Targets & KPI Factors" },
      "Metas, parámetros operativos, listas editables y control de perfiles/roles": { ko: "목표치, 운영 파라미터, 수정 가능한 기준정보 및 권한 제어", en: "Targets, operational parameters, editable lists, and role management" },
      "Métricas & Gerencia": { ko: "경영 지표 및 분석", en: "Metrics & Management" },
      "Métricas y cumplimiento": { ko: "핵심 지표 및 목표 달성률", en: "Metrics & Compliance" },
      "METROS (M": { ko: "미터 (M", en: "METERS (M" },
      "METROS (M)": { ko: "미터 (M)", en: "METERS (M)" },
      "Miércoles": { ko: "수요일", en: "Wednesday" },
      "Mínimo 6 caracteres": { ko: "최소 6자 이상", en: "Minimum 6 characters" },
      "Mixta": { ko: "복합 재질", en: "Mixed" },
      "Modelos en catálogo": { ko: "등록된 품목 수", en: "Models in catalog" },
      "Modo Boceto sobre Datos Reales": { ko: "실제 데이터 기반 시뮬레이션 모드", en: "Simulation Mode over Real Data" },
      "Modo Boceto sobre Datos Reales:": { ko: "실제 데이터 기반 시뮬레이션 모드:", en: "Simulation Mode over Real Data:" },
      "Modo de Programación": { ko: "일정 편성 방식", en: "Scheduling Mode" },
      "Modo de Transferencia": { ko: "이송 모드", en: "Transfer Mode" },
      "Modo de Transferencia:": { ko: "재고 이동 방식:", en: "Transfer Mode:" },
      "Módulo Conectado": { ko: "연계된 모듈", en: "Connected Module" },
      "Módulo de Calidad": { ko: "품질 관리 모듈", en: "Quality Module" },
      "Módulo de Capital Humano": { ko: "인사 관리 (HR) 모듈", en: "Human Capital Module" },
      "Módulo de Compras (OC": { ko: "구매 발주 모듈 바로가기", en: "Purchasing Module (PO" },
      "Módulo de Compras (OC)": { ko: "구매 발주 (PO) 모듈", en: "Purchasing Module (PO)" },
      "Módulo de Compras (OC) →": { ko: "구매 발주 모듈 바로가기 →", en: "Purchasing Module (PO) →" },
      "Módulo en Desarrollo": { ko: "개발 진행 중인 모듈", en: "Module in Development" },
      "Módulos de Planta": { ko: "공장 운영 모듈", en: "Plant Modules" },
      "Molde principal": { ko: "주 생산 금형", en: "Primary Mold" },
      "Moldes activos": { ko: "가동 중인 금형 수", en: "Active Molds" },
      "Moldes de Fabricación": { ko: "생산용 사출 금형", en: "Manufacturing Molds" },
      "Moldes Registrados": { ko: "등록된 금형 수", en: "Registered Molds" },
      "Moldes, cavidades, matriz Molde ↔ Parte y Molde ↔ Máquina": { ko: "금형, 캐비티 수, 금형 ↔ 부품 매핑 및 금형 ↔ 설비 호환성 (생산계획 및 SMED 기본)", en: "Molds, cavities, Mold ↔ Part matrix and Mold ↔ Machine compatibility" },
      "Moneda & Términos": { ko: "통화 및 결제 조건", en: "Currency & Terms" },
      "Moneda Preferida": { ko: "거래 기준 통화", en: "Preferred Currency" },
      "Monitor Maestro Kraem": { ko: "KRAEM 마스터 현황판", en: "Kraem Master Monitor" },
      "Montado": { ko: "장착 완료", en: "Mounted" },
      "Montado en máquina": { ko: "설비에 장착 가동 중", en: "Mounted on machine" },
      "Montados en máquina": { ko: "설비에 장착된 금형", en: "Mounted on machines" },
      "Montaje / Calidad": { ko: "금형 교체 / 품질 승인", en: "Setup / Quality" },
      "Montaje + desmontaje": { ko: "금형 교체 (탈착 + 장착)", en: "Setup + Teardown" },
      "Montaje de Molde (SMED": { ko: "SMED 금형 교체", en: "Mold Setup (SMED" },
      "Montaje de Molde (SMED)": { ko: "SMED 금형 교체", en: "Mold Setup (SMED)" },
      "Montaje de Moldes (SMED) & Liberación a Producción (Boceto": { ko: "SMED 금형 교체 및 양산 착수 승인", en: "Mold Setup (SMED) & Release to Production" },
      "Montaje de Moldes (SMED) & Liberación a Producción (Boceto)": { ko: "SMED 금형 교체 및 양산 착수 승인", en: "Mold Setup (SMED) & Release to Production" },
      "Montaje de Moldes SMED": { ko: "SMED 금형 교체 관리", en: "SMED Mold Setup" },
      "Montaje Moldes": { ko: "금형 교체", en: "Mold Setup" },
      "Mostrando datos reales conectados a Supabase": { ko: "데이터베이스 실시간 데이터 표시 중", en: "Displaying live database data" },
      "Mostrando datos reales conectados a Supabase.": { ko: "데이터베이스 실시간 데이터 표시 중.", en: "Displaying live database data." },
      "Motivo / Nota de Auditoría (Obligatorio": { ko: "실사 사유 및 비고 (필수", en: "Audit Reason / Note (Required" },
      "Motivo / Nota de Auditoría (Obligatorio) *": { ko: "실사 사유 및 비고 (필수) *", en: "Audit Reason / Note (Required) *" },
      "Motivo / Observaciones (Justificación Obligatoria": { ko: "신청 사유 및 비고 (사유 입력 필수", en: "Reason / Observations (Mandatory Justification" },
      "Motivo / Observaciones (Justificación Obligatoria)": { ko: "신청 사유 및 비고 (사유 입력 필수)", en: "Reason / Observations (Mandatory Justification)" },
      "Motivo / Referencia de Auditoría": { ko: "감사 사유 / 참조 번호", en: "Audit Reason / Reference" },
      "Motivo / Referencia de Auditoría *": { ko: "감사 사유 / 참조 번호 *", en: "Audit Reason / Reference *" },
      "Motivo de Daño / Falla": { ko: "대차/용기 파손 사유", en: "Damage / Failure Cause" },
      "Motivo de Daño / Taller": { ko: "금형 파손 원인 / 수리 사유", en: "Damage Cause / Toolroom" },
      "Motivo de Discrepancia": { ko: "수량 불일치 사유", en: "Discrepancy Reason" },
      "Motivo de Discrepancia *": { ko: "수량 불일치 사유 *", en: "Discrepancy Reason *" },
      "Motivo de Planta": { ko: "사내 공장 사유", en: "Plant Reason" },
      "Motivo de Planta:": { ko: "사내 공장 사유:", en: "Plant Reason:" },
      "Motivo Oficial de Auditoría (Candado 3": { ko: "공식 감사 사유 (승인 단계 3", en: "Official Audit Reason (Gate 3" },
      "Motivo Oficial de Auditoría (Candado 3) *": { ko: "공식 감사 사유 (승인 단계 3) *", en: "Official Audit Reason (Gate 3) *" },
      "Mover Carrito Completo": { ko: "대차 전체 이동", en: "Move Full Cart" },
      "Mover Carrito Completo (Todas sus piezas": { ko: "대차 전체 일괄 이동 (적재 부품 전체", en: "Move Full Cart (All pieces" },
      "Mover Ubicación Fija Completa": { ko: "고정 로케이션 전체 일괄 이동", en: "Move Entire Fixed Location" },
      "Mover y Reprogramar Cascada": { ko: "일정 이동 및 연쇄 재스케줄링", en: "Move & Reschedule Cascade" },
      "Movimientos Filtrados": { ko: "조회된 수불 건수", en: "Filtered Movements" },
      "Movimientos Recientes y Reversas Blindadas": { ko: "최근 수불 및 안전 역분개 내역", en: "Recent Movements & Reversals" },
      "Múltiplo / Redondeo (ej. 25 kg": { ko: "포장 포대 단위 배수 (예: 25kg", en: "Multiple / Rounding (e.g. 25 kg" },
      "Múltiplo / Redondeo (ej. 25 kg)": { ko: "포장 포대 단위 배수 (예: 25kg)", en: "Multiple / Rounding (e.g. 25 kg)" },
      "Múltiplo Redondeo": { ko: "발주 단위 배수", en: "Rounding Multiple" },
      "MXN - Pesos Mexicanos": { ko: "MXN - 멕시코 페소", en: "MXN - Mexican Pesos" },
      "N/P Asignados": { ko: "매핑된 품번 목록", en: "Assigned P/Ns" },
      "N° Parte / Desc": { ko: "품번 / 품명", en: "P/N / Desc" },
      "N° Parte / Desc.": { ko: "품번 / 품명", en: "P/N / Desc." },
      "N° Parte / Descripción / Lote": { ko: "품번 / 품명 / 로트 검색", en: "P/N / Description / Lot" },
      "N° Parte / Material": { ko: "품번 / 원부자재", en: "P/N / Material" },
      "N° Parte Componente": { ko: "하위 부품 품번", en: "Component Part Number" },
      "N° Parte o Nombre": { ko: "품번 또는 품명", en: "P/N or Name" },
      "N° Parte o Nombre (escribe para filtrar": { ko: "품번 또는 품명 입력", en: "Part Number or Name (type to filter" },
      "N° Parte o Nombre (escribe para filtrar)": { ko: "품번 또는 품명 입력...", en: "Part Number or Name (type to filter)" },
      "N° Parte o Nombre...": { ko: "품번 또는 품명...", en: "P/N or Name..." },
      "N° Parte PT": { ko: "완제품 (PT) 품번", en: "Finished Goods P/N" },
      "Necesidad Neta (WO": { ko: "순 생산 필요 수량 (WO", en: "Net Requirement (WO" },
      "Necesidad Neta (WO)": { ko: "순 생산 필요 수량 (WO)", en: "Net Requirement (WO)" },
      "Negativo": { ko: "차감 (감소", en: "Negative" },
      "Negativo (Falta / Merma": { ko: "마이너스 조정 (부족 / 손실", en: "Negative (Shortage / Loss" },
      "Ninguna": { ko: "없음", en: "None" },
      "Nivel 4 (dominio": { ko: "4레벨 (전문가/마스터", en: "Level 4 (Mastery" },
      "Nivel 4 (dominio)": { ko: "4레벨 (전문가/마스터)", en: "Level 4 (Mastery)" },
      "Nivel de Dominio": { ko: "스킬 숙련도 레벨", en: "Mastery Level" },
      "Nivel inicial": { ko: "초기 숙련도 레벨", en: "Initial Level" },
      "Nivel inicial *": { ko: "초기 숙련도 레벨 *", en: "Initial Level *" },
      "No hay partes vinculadas": { ko: "연결된 품번이 없습니다", en: "No linked parts" },
      "No hay partes vinculadas.": { ko: "연결된 품번이 없습니다.", en: "No linked parts." },
      "No hay partidas agregadas aún. Selecciona un material arriba o usa \"Cargar Déficits de MRP": { ko: "등록된 품목이 없습니다. 위에서 자재를 선택하거나 \"MRP 자재 결품 불러오기\"를 누르세요", en: "No items added yet. Select a material above or use \"Load MRP Deficits" },
      "No hay partidas agregadas aún. Selecciona un material arriba o usa \"Cargar Déficits de MRP\".": { ko: "등록된 품목이 없습니다. 위에서 자재를 선택하거나 \"MRP 자재 결품 불러오기\"를 누르세요.", en: "No items added yet. Select a material above or use \"Load MRP Deficits\"." },
      "Nombre Comercial": { ko: "상호명 (브랜드명", en: "Commercial Name" },
      "Nombre Comercial *": { ko: "상호명 (브랜드명) *", en: "Commercial Name *" },
      "Nombre Comercial / Razón Social": { ko: "상호명 / 법인 등록명", en: "Commercial / Legal Name" },
      "Nombre Comercial / Razón Social *": { ko: "상호명 / 법인 등록명 *", en: "Commercial / Legal Name *" },
      "Nombre Completo": { ko: "직원 성명 (전체", en: "Full Name" },
      "Nombre Completo *": { ko: "직원 성명 (전체) *", en: "Full Name *" },
      "Nombre corto": { ko: "약칭", en: "Short Name" },
      "Nombre de Empresa / Planta": { ko: "회사명 / 공장명", en: "Company / Plant Name" },
      "Nombre de la Pieza": { ko: "부품명 (품명", en: "Part Name" },
      "Nombre de la Pieza *": { ko: "부품명 (품명) *", en: "Part Name *" },
      "Nombre de quien recibe": { ko: "입고 검수 담당자 성명", en: "Receiver Name" },
      "Nombre de Usuario": { ko: "사용자 계정명", en: "Username" },
      "Nombre de Usuario *": { ko: "사용자 계정명 *", en: "Username *" },
      "Nombre del comprador": { ko: "구매 발주 담당자", en: "Buyer Name" },
      "Nombre del contacto": { ko: "담당자 성명", en: "Contact Name" },
      "Nombre del Empaque": { ko: "포장 용기 명칭", en: "Packaging Name" },
      "Nombre del ensamble o proceso": { ko: "조립 및 공정 명칭", en: "Assembly or Process Name" },
      "Nombre del Personal": { ko: "직원 성명", en: "Employee Name" },
      "Nombre del Personal *": { ko: "직원 성명 *", en: "Employee Name *" },
      "Nombre del proveedor": { ko: "공급업체 상호명", en: "Vendor Name" },
      "Nombre del Turno": { ko: "교대조 명칭", en: "Shift Name" },
      "Nombre Máquina": { ko: "설비 호기명", en: "Machine Name" },
      "Nombre Oficial del Documento / Reporte": { ko: "공식 관리 문서명 / 보고서명", en: "Official Document / Report Name" },
      "Nombre pieza": { ko: "품명 입력", en: "Part name" },
      "Nombre pieza...": { ko: "품명 입력...", en: "Part name..." },
      "Nomenclatura oficial de documentos controlados (ej. KR-SGC": { ko: "공식 관리문서 접두사 (예: KR-SGC", en: "Official prefix for controlled documents (e.g. KR-SGC" },
      "Nomenclatura oficial de documentos controlados (ej. KR-SGC-).": { ko: "공식 관리문서 접두사 (예: KR-SGC-).", en: "Official prefix for controlled documents (e.g. KR-SGC-)." },
      "NORMATIVA APLICABLE": { ko: "적용 인증 규격", en: "APPLICABLE REGULATION" },
      "Notas adicionales": { ko: "추가 특이사항 입력", en: "Additional notes" },
      "Notas adicionales...": { ko: "추가 특이사항 입력...", en: "Additional notes..." },
      "Notas sobre condiciones de entrega, flete, cuentas bancarias, etc": { ko: "납품 조건, 운임 부담, 결제 계좌 등에 관한 특이사항", en: "Notes on delivery terms, freight, bank accounts, etc" },
      "Notas sobre condiciones de entrega, flete, cuentas bancarias, etc.": { ko: "납품 조건, 운임 부담, 결제 계좌 등에 관한 특이사항.", en: "Notes on delivery terms, freight, bank accounts, etc." },
      "Notas sobre estiba, clientes autorizados o si es empaque de desviación": { ko: "적재 단수, 승인된 고객사 또는 대체 포장 승인 메모", en: "Notes on stacking, authorized customers or deviation packaging" },
      "Notas sobre estiba, clientes autorizados o si es empaque de desviación...": { ko: "적재 단수, 승인된 고객사 또는 대체 포장 승인 메모...", en: "Notes on stacking, authorized customers or deviation packaging..." },
      "Noviembre": { ko: "11월", en: "November" },
      "NP Cliente": { ko: "고객사 품번 (Customer P/N)", en: "Customer P/N" },
      "NP_CLIENTE": { ko: "고객사 품번", en: "CUSTOMER_PN" },
      "NSS": { ko: "사회보장번호 (NSS)", en: "Social Security Number (NSS)" },
      "NSS:": { ko: "사회보장번호:", en: "NSS:" },
      "Nueva Área General": { ko: "신규 대분류 구역 등록", en: "New General Area" },
      "Nueva capacitación": { ko: "신규 교육 등록", en: "New Training" },
      "Nueva contraseña": { ko: "새 비밀번호 입력", en: "New password" },
      "Nueva Contraseña (mínimo 6 caracteres": { ko: "새 비밀번호 (최소 6자", en: "New Password (min 6 characters" },
      "Nueva Contraseña (mínimo 6 caracteres)": { ko: "새 비밀번호 (최소 6자)", en: "New Password (min 6 characters)" },
      "Nueva contraseña...": { ko: "새 비밀번호 입력...", en: "New password..." },
      "Nueva Inspección": { ko: "신규 검사 등록", en: "New Inspection" },
      "Nueva Ubicación / Contenedor": { ko: "신규 로케이션 / 용기 등록", en: "New Location / Container" },
      "Nuevo Checklist": { ko: "신규 체크리스트 등록", en: "New Checklist" },
      "Nuevo Cliente": { ko: "신규 고객사 등록", en: "New Customer" },
      "Nuevo Empaque": { ko: "신규 포장 사양 등록", en: "New Packaging" },
      "Nuevo Empaque / Contenedor": { ko: "신규 포장 용기 등록", en: "New Packaging / Container" },
      "Nuevo ensamble": { ko: "신규 조립 라인", en: "New Assembly" },
      "Nuevo ensamble / proceso": { ko: "신규 조립 / 공정 등록", en: "New Assembly / Process" },
      "Nuevo Molde": { ko: "신규 금형 등록", en: "New Mold" },
      "Nuevo N.P": { ko: "신규 품번 등록 (N/P", en: "New Part Number" },
      "Nuevo N.P.": { ko: "신규 품번 등록 (N/P)", en: "New Part Number" },
      "Nuevo nivel": { ko: "신규 스킬 레벨", en: "New Level" },
      "Nuevo Proceso Estándar": { ko: "신규 표준 공정 등록", en: "New Standard Process" },
      "Nuevo Tipo de Defecto": { ko: "신규 불량 유형 등록", en: "New Defect Type" },
      "Numérico": { ko: "수치 측정값", en: "Numeric" },
      "Número de Lote / Fecha (Automático": { ko: "로트 번호 / 생산일자 (자동생성", en: "Lot Number / Date (Automated" },
      "Número de Lote / Fecha (Automático)": { ko: "로트 번호 / 생산일자 (자동생성)", en: "Lot Number / Date (Automated)" },
      "Número de Lote / Fecha Prod (Molde": { ko: "로트 번호 / 사출 생산일", en: "Lot Number / Mold Prod Date" },
      "Número de Lote / Fecha Prod (Molde)": { ko: "로트 번호 / 사출 생산일", en: "Lot Number / Mold Prod Date" },
      "Número de parte": { ko: "품번", en: "PART NUMBER" },
      "Número de parte *": { ko: "품번 (N/P) *", en: "Part number *" },
      "Número de Parte escaneado por error": { ko: "잘못 스캔된 품번", en: "Part Number scanned by mistake" },
      "NÚMERO DE PARTE:": { ko: "품번:", en: "PART NUMBER:" },
      "Nunca Auditados": { ko: "미실사 품목 (실사 이력 없음", en: "Never Audited" },
      "Observación / Causa de Diferencia": { ko: "비고 / 오차 발생 원인", en: "Observation / Discrepancy Cause" },
      "Observaciones / Certificaciones / Términos": { ko: "품질 인증 규격 및 거래 조건", en: "Observations / Certifications / Terms" },
      "Observaciones / Reglas de uso": { ko: "사용 규칙 및 취급 주의사항", en: "Observations / Usage Rules" },
      "Observaciones / Ventanas de Entrega": { ko: "입고 납품 가능 윈도우 시간", en: "Observations / Delivery Windows" },
      "Observaciones de esta sección": { ko: "해당 항목 검사 소견", en: "Observations of this section" },
      "Observaciones del Auditor": { ko: "실사 담당자 종합 의견", en: "Auditor Observations" },
      "OBSOLETO": { ko: "단종 품목", en: "OBSOLETE" },
      "Obsoletos": { ko: "단종 부품", en: "Obsoletes" },
      "OCs Proveedores": { ko: "협력사 발주서", en: "Vendor Purchase Orders" },
      "Octubre": { ko: "10월", en: "October" },
      "OEE Est": { ko: "추정 OEE", en: "Est. OEE" },
      "OEE Est.": { ko: "추정 OEE", en: "Est. OEE" },
      "OEE Estándar de Cálculo APS": { ko: "APS 일정 산출 표준 OEE", en: "Standard OEE for APS Scheduling" },
      "OEE Estándar de Cálculo APS (%)": { ko: "APS 일정 산출 표준 OEE (%)", en: "Standard OEE for APS Scheduling (%)" },
      "OEE Global Planta": { ko: "공장 종합 설비효율 (OEE)", en: "Global Plant OEE" },
      "OEE por Máquina vs Meta": { ko: "사출기별 OEE 대비 목표", en: "Machine OEE vs Target" },
      "oficial de la planta": { ko: "공장 공식 기준", en: "official plant standard" },
      "oficial de la planta.": { ko: "공장 공식 기준.", en: "official plant standard." },
      "OK / NOK": { ko: "합격 / 불합격 판정", en: "OK / NOK" },
      "Opcional (Ej: OP-104": { ko: "선택사항 (예: OP-104", en: "Optional (e.g. WO-104" },
      "Opcional (Ej: OP-104)": { ko: "선택사항 (예: OP-104)", en: "Optional (e.g. WO-104)" },
      "Opcional / OEM": { ko: "선택사항 / OEM 전용", en: "Optional / OEM" },
      "Operación Nissei": { ko: "니세이 사출 공정", en: "Nissei Operation" },
      "Operador / Área": { ko: "작업자 / 소속 구역", en: "Operator / Area" },
      "Operador Evaluado": { ko: "평가 대상 작업자", en: "Evaluated Operator" },
      "Operadores": { ko: "작업자 목록", en: "Operators" },
      "Operadores req": { ko: "필요 작업 인원", en: "Req. Operators" },
      "Operadores req.": { ko: "필요 작업 인원", en: "Req. Operators" },
      "Operativo (Disponible": { ko: "가동 가능 (가용", en: "Operational (Available" },
      "Operativos (Disponibles": { ko: "정상 가동 (가용", en: "Operational (Available" },
      "Orden / Fecha": { ko: "지시번호 / 날짜", en: "Order / Date" },
      "Orden Compra": { ko: "구매 발주", en: "Purchase Order" },
      "Orden de Compra / Proveedor": { ko: "구매 발주서 / 협력사", en: "Purchase Order / Vendor" },
      "Orden de Compra / Proveedor *": { ko: "구매 발주서 / 협력사 *", en: "Purchase Order / Vendor *" },
      "Órdenes Activas": { ko: "진행 중인 작업지시", en: "Active Orders" },
      "Órdenes Completadas": { ko: "완료된 작업지시", en: "Completed Orders" },
      "Órdenes Compra": { ko: "구매 발주서", en: "Purchase Orders" },
      "Órdenes de Compra (OC": { ko: "구매 발주서 (PO", en: "Purchase Orders (PO" },
      "Órdenes de Compra (OC)": { ko: "구매 발주서 (PO)", en: "Purchase Orders (PO)" },
      "Órdenes de Producción (WO) liberadas con máquina, molde, meta/hora y estándar de empaque": { ko: "설비, 금형, 시간당 목표 및 포장 표준이 확정된 양산 작업지시서(WO)", en: "Production Orders (WO) released with machine, mold, rate/hr and packing standard" },
      "Órdenes Pendientes / Atraso": { ko: "지연 및 대기 지시", en: "Pending / Overdue Orders" },
      "Órdenes planeadas": { ko: "계획 지시서 조회 중", en: "Planned orders" },
      "Órdenes planeadas...": { ko: "계획 지시서 조회 중...", en: "Planned orders..." },
      "Órdenes por Recibir": { ko: "입고 대기 중인 발주서", en: "Orders to Receive" },
      "Órdenes Programadas (WO": { ko: "편성된 작업지시 (WO", en: "Scheduled Orders (WO" },
      "Órdenes Programadas (WO)": { ko: "편성된 작업지시 (WO)", en: "Scheduled Orders (WO)" },
      "Origen (Ubicación / Carro": { ko: "출발지 (로케이션 / 대차", en: "Origin (Location / Cart" },
      "Origen (Ubicación / Carro)": { ko: "출발지 (로케이션 / 대차)", en: "Origin (Location / Cart)" },
      "ORIGEN DEL MATERIAL": { ko: "자재 출발지 (어디서 출고되는가)", en: "MATERIAL ORIGIN" },
      "Panel BI 5'S": { ko: "5S 비즈니스 인텔리전스 패널", en: "5S BI Panel" },
      "Panel de Control Inteligente (Filtros de Máquina e Indicador de Jigs": { ko: "스마트 관리 패널 (사출기 필터 및 지그 상태 표시", en: "Smart Control Panel (Machine Filters & Jig Indicators" },
      "Panel de Control Inteligente (Filtros de Máquina e Indicador de Jigs)": { ko: "스마트 관리 패널 (사출기 필터 및 지그 상태 표시)", en: "Smart Control Panel (Machine Filters & Jig Indicators)" },
      "Panel Estratégico 5S | KRAEM": { ko: "5S 전략 대시보드 | KRAEM", en: "5S Strategic Panel | KRAEM" },
      "Panel General": { ko: "종합 현황 패널", en: "General Panel" },
      "para habilitar guardado en la nube de todas las configuraciones y perfiles de usuario": { ko: "모든 시스템 설정 및 사용자 권한을 데이터베이스에 영구 동기화합니다", en: "to enable cloud saving for all settings and user profiles" },
      "para habilitar guardado en la nube de todas las configuraciones y perfiles de usuario.": { ko: "모든 시스템 설정 및 사용자 권한을 데이터베이스에 영구 동기화합니다.", en: "to enable cloud saving for all settings and user profiles." },
      "para la regla FIFO y selecciona la ubicación en racks o tolva": { ko: "선입선출(FIFO) 관리를 위해 보관 랙 또는 원료 호퍼 위치를 지정하세요", en: "for FIFO rule and select location in racks or hopper" },
      "para la regla FIFO y selecciona la ubicación en racks o tolva.": { ko: "선입선출(FIFO) 관리를 위해 보관 랙 또는 원료 호퍼 위치를 지정하세요.", en: "for FIFO rule and select location in racks or hopper." },
      "Parámetros de Motor MRP, Tablero APS y Moldes (SMED": { ko: "MRP 엔진, APS 현황판 및 금형교체(SMED) 파라미터", en: "MRP Engine, APS Board & Mold Setup Parameters" },
      "Parámetros de Motor MRP, Tablero APS y Moldes (SMED)": { ko: "MRP 엔진, APS 현황판 및 금형교체(SMED) 파라미터", en: "MRP Engine, APS Board & Mold Setup Parameters" },
      "Parámetros de RH, Habilidades y Auditorías 5S": { ko: "인사 관리, 스킬 매트릭스 및 5S 감사 기준 파라미터", en: "HR, Skills Matrix & 5S Audit Parameters" },
      "Parámetros MRP / WMS": { ko: "MRP 및 WMS 물류 파라미터", en: "MRP / WMS Parameters" },
      "Parcialidades": { ko: "부분 수량 허용 여부", en: "Partials" },
      "Parentesco": { ko: "가족 관계", en: "Relationship" },
      "PART_NUMBER": { ko: "품번", en: "PART_NUMBER" },
      "Partes del molde": { ko: "해당 금형 생산 부품 목록", en: "Parts of mold" },
      "Partes Producidas": { ko: "생산된 부품", en: "Parts Produced" },
      "Partidas / Lotes": { ko: "발주 품목 / 입고 로트", en: "Items / Lots" },
      "Pase de Lista": { ko: "출석 확인 (롤콜)", en: "Roll Call" },
      "Pase de Lista Diario": { ko: "일일 출석 체크", en: "Daily Roll Call" },
      "PASE OFICIAL DE CONTROL": { ko: "공식 출입 확인증 (통행증)", en: "OFFICIAL CONTROL PASS" },
      "Paso 1 · Demanda": { ko: "1단계 · 고객 수요 분석", en: "Step 1 · Demand" },
      "Paso 1: Validar y Revelar Diferencias": { ko: "1단계: 오차 검증 및 차이 확인", en: "Step 1: Validate and Reveal Discrepancies" },
      "Paso 2 · Abasto": { ko: "2단계 · 자재 수급 (MRP)", en: "Step 2 · Supply" },
      "Paso 2: Confirmar y Cuadrar Inventario en Sistema": { ko: "2단계: 전산 재고 조정 확정 및 일치화", en: "Step 2: Confirm and Reconcile System Stock" },
      "Paso 2: Guardar Conteo y Actualizar Próxima Fecha ABC": { ko: "2단계: 실사 저장 및 다음 ABC 실사일 갱신", en: "Step 2: Save Count and Update Next ABC Date" },
      "Paso 3 · Capacidad": { ko: "3단계 · 설비 능력 및 일정 (APS)", en: "Step 3 · Capacity" },
      "Paso 4 · Piso": { ko: "4단계 · 현장 제조 실행 (MES)", en: "Step 4 · Shop Floor" },
      "PDF Controlado": { ko: "공식 관리본 PDF", en: "Controlled PDF" },
      "Pedido Firme": { ko: "확정 수주 (PO 수령)", en: "Firm Order" },
      "Pendiente Confirmar": { ko: "확정 대기", en: "Pending Confirmation" },
      "Pendiente unificar tabla máquinas": { ko: "설비 기준정보 테이블 통합 예정", en: "Pending machine table unification" },
      "Pendientes de Envío": { ko: "발송 대기 발주서", en: "Pending Dispatch" },
      "Pendientes por Programar (Planeación": { ko: "계획 편성 대기 목록", en: "Pending to Schedule (Planning" },
      "Perfil de las 5S": { ko: "5S 평가 프로필", en: "5S Profile" },
      "Período": { ko: "조회 기간", en: "Period" },
      "Periodo / Fecha": { ko: "대상 기간 / 일자", en: "Period / Date" },
      "Periodo Rápido": { ko: "빠른 기간 선택", en: "Quick Period" },
      "Periodo Rápido:": { ko: "빠른 기간 선택:", en: "Quick Period:" },
      "Permiso c/Goce (Leyes/Defunción": { ko: "유급 휴가 (경조사/법정", en: "Paid Leave (Legal/Bereavement" },
      "Permiso c/Goce (Leyes/Defunción)": { ko: "유급 휴가 (경조사/법정)", en: "Paid Leave (Legal/Bereavement)" },
      "Permiso de Llegada Tarde": { ko: "지각 외출 승인서", en: "Late Arrival Permission" },
      "Permiso de Salida Temprano": { ko: "조퇴 승인서", en: "Early Departure Permission" },
      "Permiso Local (Ida y Vuelta": { ko: "업무 외출 승인서 (왕복", en: "Local Pass (Round Trip" },
      "Permiso Local (Ida y Vuelta)": { ko: "업무 외출 승인서 (왕복)", en: "Local Pass (Round Trip)" },
      "Permiso sin Goce de Sueldo": { ko: "무급 휴가 / 개인 사유 결근", en: "Unpaid Leave" },
      "Permisos y Vacaciones": { ko: "휴가 및 외출 신청", en: "Leaves & Vacations" },
      "Permite registrar cajas incompletas si la máquina se detiene a medias": { ko: "설비 정지 시 미달 포장 박스를 등록할 수 있도록 허용합니다", en: "Allows registering incomplete boxes if the machine stops midway" },
      "Permite registrar cajas incompletas si la máquina se detiene a medias.": { ko: "설비 정지 시 미달 포장 박스를 등록할 수 있도록 허용합니다.", en: "Allows registering incomplete boxes if the machine stops midway." },
      "Permitir Parcialidades": { ko: "부분 수량 입고/출고 허용", en: "Allow Partials" },
      "Permitir Parcialidades:": { ko: "부분 수량 입고/출고 허용:", en: "Allow Partials:" },
      "Personal & 5S": { ko: "인사 및 5S 관리", en: "Personnel & 5S" },
      "Personal × ensambles / procesos. Define la versatilidad operativa": { ko: "작업자 × 공정 매트릭스. 현장의 다기능 유연성을 정의합니다", en: "Personnel × assemblies / processes. Defines operational versatility" },
      "Personal × ensambles / procesos. Define la versatilidad operativa.": { ko: "작업자 × 공정 매트릭스. 현장의 다기능 유연성을 정의합니다.", en: "Personnel × assemblies / processes. Defines operational versatility." },
      "Personal Capacitado": { ko: "교육 이수 인원", en: "Trained Personnel" },
      "Personal de RH (Automático": { ko: "인사 마스터 자동 연동", en: "HR Personnel (Automated" },
      "Personal de RH (Automático)": { ko: "인사 마스터 자동 연동", en: "HR Personnel (Automated)" },
      "PERSONAL Y ÁREA": { ko: "투입 인원 및 소속 구역", en: "PERSONNEL & AREA" },
      "Peso Colada (g": { ko: "런너 중량 (g", en: "Runner Weight (g" },
      "Peso Colada (g)": { ko: "런너 중량 (g)", en: "Runner Weight (g)" },
      "Peso Colada/Vena (Gramos": { ko: "런너/스프루 중량 (g", en: "Runner/Sprue Weight (Grams" },
      "Peso Colada/Vena (Gramos)": { ko: "런너/스프루 중량 (g)", en: "Runner/Sprue Weight (Grams)" },
      "Peso de la Pieza (Gramaje": { ko: "제품 단품 중량 (g", en: "Piece Weight (Grams" },
      "Peso de la Pieza (Gramaje)": { ko: "제품 단품 중량 (g)", en: "Piece Weight (Grams)" },
      "Peso Máx. Molde (kg": { ko: "설비 최대 허용 금형 중량 (kg", en: "Max Mold Weight (kg" },
      "Peso Máx. Molde (kg)": { ko: "설비 최대 허용 금형 중량 (kg)", en: "Max Mold Weight (kg)" },
      "Peso molde (kg": { ko: "금형 중량 (kg", en: "Mold Weight (kg" },
      "Peso molde (kg)": { ko: "금형 중량 (kg)", en: "Mold Weight (kg)" },
      "Peso Pieza (g": { ko: "제품 단품 중량 (g", en: "Piece Weight (g" },
      "Peso Pieza (g)": { ko: "제품 단품 중량 (g)", en: "Piece Weight (g)" },
      "Peso Pieza (Gramos": { ko: "제품 중량 (g", en: "Piece Weight (Grams" },
      "Peso Pieza (Gramos)": { ko: "제품 중량 (g)", en: "Piece Weight (Grams)" },
      "Peso Purga (g": { ko: "퍼지(Purge) 중량 (g", en: "Purge Weight (g" },
      "Peso Purga (g)": { ko: "퍼지(Purge) 중량 (g)", en: "Purge Weight (g)" },
      "Peso pza (g": { ko: "단품 중량 (g", en: "Part Weight (g" },
      "Peso pza (g)": { ko: "단품 중량 (g)", en: "Part Weight (g)" },
      "Peso Tara Vacío (kg": { ko: "용기 공차 중량 (kg", en: "Tare Weight Empty (kg" },
      "Peso Tara Vacío (kg)": { ko: "용기 공차 중량 (kg)", en: "Tare Weight Empty (kg)" },
      "Peso Total (g": { ko: "1쇼트 총 사출 중량 (g", en: "Total Weight (g" },
      "Peso Total (g)": { ko: "1쇼트 총 사출 중량 (g)", en: "Total Weight (g)" },
      "Peso Total Inyectado": { ko: "총 사출 용량 중량 (제품+런너)", en: "Total Shot Weight" },
      "Peso Vena (g": { ko: "스프루/런너 중량 (g", en: "Runner Weight (g" },
      "Peso Vena (g)": { ko: "스프루/런너 중량 (g)", en: "Runner Weight (g)" },
      "Peso Vena/Colada (g": { ko: "스프루/런너 중량 (g", en: "Sprue/Runner Weight (g" },
      "Peso Vena/Colada (g)": { ko: "스프루/런너 중량 (g)", en: "Sprue/Runner Weight (g)" },
      "PIEZA (PZA": { ko: "개수 (EA", en: "PIECE (PCS" },
      "PIEZA (PZA)": { ko: "개수 (EA)", en: "PIECE (PCS)" },
      "Pieza Dañada / Scrap no declarado": { ko: "파손 부품 / 미신고 불량(Scrap)", en: "Damaged piece / Undeclared scrap" },
      "Pieza Individual (Normal": { ko: "개별 부품 이동 (일반", en: "Single Piece (Normal" },
      "Piezas buenas vs inspeccionadas": { ko: "양품 수량 vs 검사 수량", en: "Good Pieces vs Inspected" },
      "Piezas embarcadas": { ko: "출하된 수량", en: "Shipped pieces" },
      "Piezas ingresadas": { ko: "입고된 수량", en: "Received pieces" },
      "PIEZAS OK": { ko: "양품 합격 수량", en: "OK PIECES" },
      "Piezas Producidas / Plan": { ko: "생산 실적 / 계획 수량", en: "Produced Pieces / Planned" },
      "Piezas que caben en este empaque": { ko: "포장 용기 적재 수량 (Standard Pack)", en: "Pieces that fit in this pack" },
      "Plan Maestro (MPS) — Necesidad Bruta vs Stock WMS vs WO Sugerida": { ko: "대일정 계획 (MPS) - 총소요량 vs WMS 재고 vs 추천 작업지시", en: "Master Schedule (MPS) — Gross Demand vs WMS Stock vs Suggested WO" },
      "Plan Preventivo": { ko: "예방 정비 계획", en: "Preventive Plan" },
      "Plan vs Real Mensual": { ko: "월간 계획 대비 생산 실적", en: "Monthly Plan vs Actual" },
      "Planeación": { ko: "생산 계획", en: "Planning" },
      "Planeación – Forecast": { ko: "생산 계획 - 판매 예측", en: "Planning – Forecast" },
      "Planeación de demanda, producción y capacidad": { ko: "고객 수요, 제조 생산 및 설비 능력 계획", en: "Demand, production and capacity planning" },
      "Planeación de Producción": { ko: "생산 계획 수립", en: "Production Planning" },
      "Planeación Maestra - WO & Carritos": { ko: "기준 생산 계획 - 작업지시 & 전용 대차", en: "Master Planning - WO & Carts" },
      "Planeación MRP & APS": { ko: "MRP 자재 계획 및 APS 일정", en: "MRP & APS Planning" },
      "Planeación MRP/APS": { ko: "MRP/APS 생산 계획", en: "MRP/APS Planning" },
      "Planificado vs Producido (Piezas": { ko: "계획 vs 실적 (수량", en: "Planned vs Produced (Pieces" },
      "Planificado vs Producido (Piezas)": { ko: "계획 vs 실적 (수량)", en: "Planned vs Produced (Pieces)" },
      "Planta Monterrey": { ko: "몬테레이 공장", en: "Monterrey Plant" },
      "Plantas y ventanas de embarque": { ko: "출하 공장 및 배송 윈도우", en: "Plants & Shipping Windows" },
      "Plantilla Estándar .xlsx": { ko: "표준 엑셀 템플릿 양식 .xlsx", en: "Standard Template .xlsx" },
      "Playera": { ko: "유니폼 사이즈", en: "Shirt Size" },
      "Playera:": { ko: "유니폼 사이즈:", en: "Shirt Size:" },
      "PM disparos y checklist arranque": { ko: "쇼트 수 기반 예방정비 및 초품 점검", en: "PM Shot Counts & Startup Checklist" },
      "PM vencido o ≥ 90": { ko: "예방보전 도래 또는 90% 이상", en: "PM overdue or ≥ 90" },
      "PM vencido o ≥ 90%": { ko: "예방보전 도래 또는 90% 이상", en: "PM overdue or ≥ 90%" },
      "Polipropileno Negro Inyección": { ko: "사출용 블랙 폴리프로필렌 (PP)", en: "Injection Black Polypropylene" },
      "Polivalencia promedio": { ko: "평균 다기능 보유율", en: "Average Versatility" },
      "Por Aprobar": { ko: "승인 대기 건수", en: "Pending Approval" },
      "Por ensamble": { ko: "조립 공정별", en: "By Assembly" },
      "Por favor, no cierre esta ventana mientras se actualiza Supabase": { ko: "데이터베이스가 업데이트되는 동안 이 창을 닫지 마세요", en: "Please do not close this window while database is updating" },
      "Por favor, no cierre esta ventana mientras se actualiza Supabase.": { ko: "데이터베이스가 업데이트되는 동안 이 창을 닫지 마세요.", en: "Please do not close this window while database is updating." },
      "Por fechas (avances": { ko: "일자별 진척도", en: "By Dates (Progress" },
      "Por fechas (avances)": { ko: "일자별 진척도", en: "By Dates (Progress)" },
      "Por norma de trazabilidad, el sistema no permite registrar movimientos sin iniciar sesión": { ko: "추적성 관리 규정에 따라 로그인 없이는 재고 이동을 등록할 수 없습니다", en: "By traceability policy, the system does not allow recording movements without signing in" },
      "Por norma de trazabilidad, el sistema no permite registrar movimientos sin iniciar sesión.": { ko: "추적성 관리 규정에 따라 로그인 없이는 재고 이동을 등록할 수 없습니다.", en: "By traceability policy, the system does not allow recording movements without signing in." },
      "Por operador": { ko: "작업자별", en: "By Operator" },
      "Porcentaje de tiros acumulados para alertar mantenimiento preventivo": { ko: "금형 예방 정비 알림을 발생시킬 누적 타수 도달 백분율", en: "Cumulative shot count percentage to trigger preventive maintenance alert" },
      "Porcentaje de tiros acumulados para alertar mantenimiento preventivo.": { ko: "금형 예방 정비 알림을 발생시킬 누적 타수 도달 백분율.", en: "Cumulative shot count percentage to trigger preventive maintenance alert." },
      "Porcentaje objetivo de órdenes/piezas producidas vs planificadas": { ko: "계획 수량 대비 생산 수량의 목표 달성률 백분율", en: "Target percentage of orders/pieces produced vs planned" },
      "Porcentaje objetivo de órdenes/piezas producidas vs planificadas.": { ko: "계획 수량 대비 생산 수량의 목표 달성률 백분율.", en: "Target percentage of orders/pieces produced vs planned." },
      "Porcentaje objetivo en Dashboard 5S y Evaluaciones": { ko: "5S 대시보드 및 정기 평가 목표 백분율", en: "Target percentage in 5S Dashboard and Evaluations" },
      "Porcentaje objetivo en Dashboard 5S y Evaluaciones.": { ko: "5S 대시보드 및 정기 평가 목표 백분율.", en: "Target percentage in 5S Dashboard and Evaluations." },
      "Posiciones almacén": { ko: "창고 로케이션", en: "Warehouse Positions" },
      "Positivo": { ko: "가산 (증가", en: "Positive" },
      "Positivo (Sobra inventario": { ko: "플러스 조정 (재고 과잉", en: "Positive (Excess inventory" },
      "POWERED BY": { ko: "시스템 구동 엔진", en: "POWERED BY" },
      "Precio Unit": { ko: "단가", en: "Unit Price" },
      "Precio Unit.": { ko: "단가", en: "Unit Price" },
      "Prefijo Documental ISO / SGC": { ko: "ISO / SGC 문서 접두사", en: "ISO / QMS Document Prefix" },
      "Preguntas Especiales Jigs": { ko: "지그 관련 특별 점검 항목", en: "Special Jig Questions" },
      "Prensas y Máquinas": { ko: "사출기 및 부대 설비", en: "Presses & Machines" },
      "Principal": { ko: "주 사양", en: "Primary" },
      "Prioridad inmediata de auditoría": { ko: "최우선 실사 대상", en: "Immediate audit priority" },
      "Privado / Propio": { ko: "자차 출퇴근", en: "Personal Vehicle" },
      "Procesando e Importando BOM": { ko: "BOM 자재명세서 분석 및 등록 중...", en: "Processing & Importing BOM" },
      "Proceso / Departamento": { ko: "적용 공정 / 부서", en: "Process / Department" },
      "Proceso / Módulo": { ko: "공정 / 해당 모듈", en: "Process / Module" },
      "Procesos y Rutas": { ko: "공정 및 생산 라우팅", en: "Processes & Routings" },
      "Procesos, Hojas de Ruta & Versiones (SAP CA01/C223": { ko: "공정, 표준 라우팅 및 생산 버전 (SAP CA01/C223 호환", en: "Processes, Routings & Versions (SAP CA01/C223" },
      "Procesos, Hojas de Ruta & Versiones (SAP CA01/C223)": { ko: "공정, 표준 라우팅 및 생산 버전 (SAP CA01/C223 호환)", en: "Processes, Routings & Versions (SAP CA01/C223)" },
      "Producción (Piso": { ko: "제조 현장 생산 실적", en: "Production (Shop Floor" },
      "Producción (Piso)": { ko: "제조 현장 생산 실적", en: "Production (Shop Floor)" },
      "Producción LS": { ko: "LS 사출 생산 구역", en: "LS Production" },
      "Producción OK": { ko: "정상 가동 중", en: "Production OK" },
      "Producción Piso": { ko: "현장 생산 실적", en: "Shop Floor Production" },
      "Producto / Sub-ensamble": { ko: "완제품 / 반제품", en: "Product / Sub-assembly" },
      "PRODUCTO Y EQUIPO": { ko: "생산 품목 및 설비", en: "PRODUCT & EQUIPMENT" },
      "Productos Terminados / Sub": { ko: "완제품 / 반제품", en: "Finished Goods / Sub" },
      "Programa Detallado de Montaje, Corrida y Kitting WMS": { ko: "금형 교체, 생산 런 및 WMS 자재 키팅 상세 일정", en: "Detailed Schedule of Setup, Run and WMS Kitting" },
      "Programación ABC, Conteo Ciego por Ubicación + Carrito + Lote, Barrido QR y Veracidad de Stock": { ko: "ABC 실사 편성, 로케이션+대차+로트 블라인드 실사, QR 스캔 및 재고 정확도 관리", en: "ABC Scheduling, Blind Count by Location + Cart + Lot, QR Sweep and Stock Accuracy" },
      "Programado": { ko: "생산 계획됨", en: "Scheduled" },
      "Promedio General": { ko: "전체 평균", en: "Overall Average" },
      "Propietario": { ko: "금형 소유주", en: "Owner" },
      "Propuesta automática de planeación": { ko: "생산 계획 자동 편성 제안", en: "Automated Planning Proposal" },
      "Propuesta de Planeación": { ko: "생산 계획 편성 제안", en: "Planning Proposal" },
      "PROTOTIPO": { ko: "시제품 (프로토타입)", en: "PROTOTYPE" },
      "Prototipos Anteriores": { ko: "이전 시제품 이력", en: "Previous Prototypes" },
      "PROVEEDOR": { ko: "공급업체", en: "VENDOR" },
      "Proveedor Principal": { ko: "주 공급업체", en: "Primary Vendor" },
      "PROVEEDOR:": { ko: "공급업체:", en: "VENDOR:" },
      "Proveedores Activos": { ko: "거래 중인 협력업체", en: "Active Vendors" },
      "Proveedores de Resina": { ko: "원재료 레진 공급업체", en: "Resin Vendors" },
      "Proveedores en el Sistema": { ko: "시스템 등록 협력업체 수", en: "Vendors in System" },
      "Próximamente": { ko: "출시 예정", en: "Coming Soon" },
      "Próximo Conteo": { ko: "다음 실사 예정일", en: "Next Count Date" },
      "Proyecto / Vehículo": { ko: "프로젝트 / 적용 차종", en: "Project / Vehicle" },
      "PT (Entrega Req": { ko: "완제품 (요청 납기", en: "FG (Req. Delivery" },
      "PT (Entrega Req.)": { ko: "완제품 (요청 납기)", en: "FG (Req. Delivery)" },
      "PT (Producto Terminado": { ko: "완제품 (PT", en: "Finished Product (FG" },
      "PT (Producto Terminado)": { ko: "완제품 (PT)", en: "Finished Product (FG)" },
      "Puesto Operativo": { ko: "현장 직무", en: "Operational Position" },
      "Puestos, fotos y turnos": { ko: "직무, 직원 사진 및 교대조", en: "Positions, Photos & Shifts" },
      "Puntaje Promedio": { ko: "평균 평점", en: "Average Score" },
      "Punto de Verificación": { ko: "점검 확인 항목", en: "Verification Point" },
      "Punto de verificación *": { ko: "필수 점검 항목 *", en: "Verification Point *" },
      "Puntos críticos": { ko: "핵심 관리 항목", en: "Critical Points" },
      "Puntualidad": { ko: "정시 출근율", en: "Punctuality" },
      "Purga arranque (kg": { ko: "초기 기동 퍼지량 (kg", en: "Startup Purge (kg" },
      "Purga arranque (kg)": { ko: "초기 기동 퍼지량 (kg)", en: "Startup Purge (kg)" },
      "Pzs / Empaque": { ko: "포장당 입수량", en: "Pcs / Pack" },
      "Pzs / Hora": { ko: "시간당 생산량", en: "Pcs / Hour" },
      "Pzs por Caja (Std": { ko: "박스당 표준 수량 (Std Pack", en: "Pcs per Box (Std" },
      "Pzs por Caja (Std)": { ko: "박스당 표준 수량 (Std Pack)", en: "Pcs per Box (Std)" },
      "Pzs/hora": { ko: "개/시간", en: "Pcs/hr" },
      "Qué le entrega Planeación": { ko: "계획 모듈이 타 부서에 전달하는 정보", en: "What Planning delivers" },
      "Qué lee Planeación de él": { ko: "계획 모듈이 타 부서에서 참조하는 정보", en: "What Planning reads from it" },
      "Químicos": { ko: "화학 약품 / 첨가제", en: "Chemicals" },
      "Químicos, Pigmentos y Masterbatch": { ko: "화학품, 안료 및 마스터배치", en: "Chemicals, Pigments & Masterbatch" },
      "Quitar": { ko: "제거 (삭제)", en: "Remove" },
      "Rack, carro o folio": { ko: "랙, 대차 또는 전표번호", en: "Rack, cart, or folio" },
      "Rack, carro o folio...": { ko: "랙, 대차 또는 전표번호...", en: "Rack, cart, or folio..." },
      "Racks, posiciones y localizaciones": { ko: "랙, 선반 및 보관 위치", en: "Racks, Bins & Locations" },
      "Rango de análisis": { ko: "분석 대상 기간", en: "Analysis Range" },
      "Rango de análisis:": { ko: "분석 대상 기간:", en: "Analysis Range:" },
      "Rango personalizado": { ko: "사용자 지정 기간", en: "Custom Range" },
      "Rango Semanal": { ko: "주간 범위", en: "Weekly Range" },
      "Ranking Comparativo": { ko: "비교 순위", en: "Comparative Ranking" },
      "Razón Social Fiscal": { ko: "공식 법인 상호명", en: "Legal Business Name" },
      "Razón Social Fiscal *": { ko: "공식 법인 상호명 *", en: "Legal Business Name *" },
      "Real": { ko: "실적", en: "Actual" },
      "Real Producido": { ko: "실제 생산량", en: "Actual Produced" },
      "Recalcular APS": { ko: "APS 일정 재계산", en: "Recalculate APS" },
      "Recalcular métricas": { ko: "지표 재산출", en: "Recalculate Metrics" },
      "Recepción de Material WMS": { ko: "WMS 자재 입고 처리", en: "WMS Material Receiving" },
      "Recetas y consumo resinas": { ko: "배합 레시피 및 레진 소요량", en: "Recipes & Resin Consumption" },
      "Rech": { ko: "불량", en: "Rej" },
      "Rechazadas": { ko: "반려된 신청 건수", en: "Rejected" },
      "RECHAZO": { ko: "불량률", en: "REJECTION" },
      "RECHAZO (PZS": { ko: "부적합 불량 수량 (개", en: "REJECTION (PCS" },
      "RECHAZO (PZS)": { ko: "부적합 불량 수량 (개)", en: "REJECTION (PCS)" },
      "Recibido por (Almacenista": { ko: "입고 확인자 (창고 담당", en: "Received by (Warehouse Keeper" },
      "Recibido por (Almacenista) *": { ko: "입고 확인자 (창고 담당) *", en: "Received by (Warehouse Keeper) *" },
      "Recibió": { ko: "수령인", en: "Received by" },
      "Recibo de Materiales WMS contra OC": { ko: "발주서 대비 WMS 원부자재 입고 검수", en: "WMS Material Receipt against PO" },
      "Recibo en WMS": { ko: "WMS 창고 입고 처리", en: "Receive in WMS" },
      "Recibo en WMS →": { ko: "WMS 창고 입고 처리 →", en: "Receive in WMS →" },
      "Recibo WMS": { ko: "WMS 자재 입고 처리", en: "WMS Receiving" },
      "RECURSOS HUMANOS / 5S": { ko: "인사 관리 / 5S 평가", en: "HUMAN RESOURCES / 5S" },
      "Redirigiendo a Estación de Conteos Cíclicos WMS": { ko: "WMS 순환 실사 화면으로 이동 중", en: "Redirecting to WMS Cycle Counts" },
      "Redirigiendo a Estación de Conteos Cíclicos WMS...": { ko: "WMS 순환 실사 화면으로 이동 중...", en: "Redirecting to WMS Cycle Counts..." },
      "Refacciones": { ko: "설비 예비품 (스페어파트)", en: "Spare Parts" },
      "Refacciones Mantenimiento / Moldes": { ko: "금형 및 설비 보전용 예비 부품", en: "Maintenance / Mold Spare Parts" },
      "Referencia 80/20 en Análisis y Paretos de Defectos": { ko: "품질 불량 파레토 분석의 80/20 기준값", en: "80/20 reference for Quality Pareto & Defect Analysis" },
      "Referencia 80/20 en Análisis y Paretos de Defectos.": { ko: "품질 불량 파레토 분석의 80/20 기준값.", en: "80/20 reference for Quality Pareto & Defect Analysis." },
      "Refrescar": { ko: "새로고침", en: "Refresh" },
      "Registrar avance de nivel": { ko: "스킬 승급 기록 등록", en: "Record Level Progress" },
      "Registrar Competencia": { ko: "직무 역량 등록", en: "Register Competency" },
      "Registrar Conocimiento": { ko: "기술 지식 등록", en: "Register Knowledge" },
      "REGISTRAR DEMANDA": { ko: "고객 수요 등록", en: "REGISTER DEMAND" },
      "REGISTRAR EMPLEADO": { ko: "신규 직원 등록", en: "REGISTER EMPLOYEE" },
      "Registrar Hallazgo Físico en Piso": { ko: "현장 발견 실물 재고 등록", en: "Register Shop Floor Physical Finding" },
      "Registrar Nuevo Proveedor": { ko: "신규 공급사 등록", en: "Register New Vendor" },
      "Registrar Solicitud": { ko: "신청서 등록", en: "Register Request" },
      "Registro de Ingeniería": { ko: "엔지니어링 기술 등록", en: "Engineering Record" },
      "Registro de Personal": { ko: "직원 인사 기록", en: "Personnel Registration" },
      "Registro de Scrap": { ko: "불량(Scrap) 등록", en: "Scrap Log" },
      "Registro preventivo inspectores": { ko: "검사원 예방 점검 기록", en: "Inspector Preventive Log" },
      "Registros en pantalla": { ko: "화면 표시 건수", en: "Records on Screen" },
      "Registros oficiales del sistema": { ko: "시스템 공식 전자 기록", en: "Official system records" },
      "Regla de Empaque Limitado (Boceto a conectar con Ingeniería": { ko: "전용 용기 한정 규칙 (엔지니어링 사양 연동", en: "Limited Packaging Rule (to connect with Engineering" },
      "Regla de Empaque Limitado (Boceto a conectar con Ingeniería):": { ko: "전용 용기 한정 규칙 (엔지니어링 사양 연동):", en: "Limited Packaging Rule (to connect with Engineering):" },
      "Regresar a Personal": { ko: "인사 관리로 돌아가기", en: "Return to Personnel" },
      "Regresar al Dashboard": { ko: "대시보드로 돌아가기", en: "Return to Dashboard" },
      "Remisión / Factura": { ko: "납품서 / 세금계산서", en: "Delivery Note / Invoice" },
      "Remolido Permitido": { ko: "분쇄재(재생재) 허용 배합률", en: "Regrind Allowed" },
      "Rendimiento": { ko: "성능률 (Performance)", en: "Performance" },
      "Reporte Asistencias": { ko: "출결 종합 보고서", en: "Attendance Report" },
      "Reporte de fallas urgentes": { ko: "긴급 고장 발생 보고", en: "Urgent Breakdown Report" },
      "Reporte Semanal": { ko: "주간 업무 보고서", en: "Weekly Report" },
      "Reporte Auditable (Preguntas)": { ko: "정밀 감사 보고서 (문항별)", en: "Auditable Detailed Report (Questions)" },
      "Exportar Matriz Completa": { ko: "전체 매트릭스 내보내기", en: "Export Full Matrix" },
      "Resumen CSV": { ko: "CSV 요약본", en: "CSV Summary" },
      "Reportes 80/20 de defectos": { ko: "불량 80/20 분석 보고서", en: "80/20 Defect Reports" },
      "Reportes de auditoría": { ko: "5S 감사 결과 보고서", en: "Audit Reports" },
      "Requerido BOM (+Scrap": { ko: "BOM 기준 소요량 (불량률 가산", en: "BOM Required (+Scrap" },
      "Requerido BOM (+Scrap)": { ko: "BOM 기준 소요량 (불량률 가산)", en: "BOM Required (+Scrap)" },
      "Requerido WMS": { ko: "WMS 필수 관리 대상", en: "Required WMS" },
      "Requerimientos": { ko: "고객 요구 수량", en: "Requirements" },
      "Requiere Checklist": { ko: "체크리스트 필수 여부", en: "Requires Checklist" },
      "Requiere Molde": { ko: "금형 필요 여부", en: "Requires Mold" },
      "Requieren seguimiento APS": { ko: "APS 일정 집중 관리 필요", en: "Requires APS Follow-up" },
      "Resina (Tipo": { ko: "레진 재질 종류", en: "Resin (Type" },
      "Resina (Tipo)": { ko: "레진 재질 종류", en: "Resin (Type)" },
      "Resina / Materia Prima": { ko: "레진 / 원자재", en: "Resin / Raw Material" },
      "Resinas activas": { ko: "사용 중인 레진 품목", en: "Active Resins" },
      "Resinas y Componentes": { ko: "원재료 레진 및 부품", en: "Resins & Components" },
      "Resinas y Compuestos": { ko: "레진 및 컴파운드", en: "Resins & Compounds" },
      "Resinas, insertos, clips, etiquetas y consumibles conectados con WMS": { ko: "WMS 실시간 재고 및 BOM과 연계된 레진, 인서트, 클립, 라벨 및 소모품", en: "Resins, inserts, clips, labels and consumables connected with WMS and BOM" },
      "Resinas, insertos, etiquetas y materiales consumibles": { ko: "레진, 인서트, 라벨 및 제조 소모성 자재", en: "Resins, inserts, labels and consumable materials" },
      "Resinas, insertos, etiquetas y materiales consumibles.": { ko: "레진, 인서트, 라벨 및 제조 소모성 자재.", en: "Resins, inserts, labels and consumable materials." },
      "Resinas/Componentes vs WMS": { ko: "레진/부품 소요 vs WMS 가용재고", en: "Resins/Components vs WMS" },
      "Respaldo electrónico en Supabase": { ko: "데이터베이스 전자 보관", en: "Electronic backup in database" },
      "Restaurar": { ko: "복원", en: "Restore" },
      "Resultado": { ko: "결과", en: "Result" },
      "RESULTADO FINAL": { ko: "최종 평가 결과", en: "FINAL RESULT" },
      "Resultado IRA": { ko: "재고 정확도(IRA) 결과", en: "IRA Result" },
      "Resumen CSV": { ko: "CSV 요약", en: "CSV Summary" },
      "Resumen de qué consume Planeación de cada área y qué le entrega de regreso": { ko: "각 부문별 투입 기준정보 및 생산 계획 결과물 종합 흐름", en: "Summary of what Planning consumes from each area and delivers back" },
      "Resumen de qué consume Planeación de cada área y qué le entrega de regreso.": { ko: "각 부문별 투입 기준정보 및 생산 계획 결과물 종합 흐름.", en: "Summary of what Planning consumes from each area and delivers back." },
      "Retardos": { ko: "지각 건수", en: "Tardiness Count" },
      "Retornable de Cliente (Tote/KLT": { ko: "고객사 회수용 전용 용기 (Tote/KLT", en: "Customer Returnable (Tote/KLT" },
      "RETORNABLE_CLIENTE": { ko: "고객사 리턴 전용 박스", en: "CUSTOMER_RETURNABLE" },
      "Retornables Cliente": { ko: "고객사 회수용 전용 박스", en: "Customer Returnables" },
      "RETRABAJO": { ko: "재작업 진행", en: "REWORK" },
      "Reubicaciones internas": { ko: "사내 로케이션 재배치", en: "Internal Relocations" },
      "Revisión (ECN": { ko: "설계 변경 차수 (ECN", en: "Revision (ECN" },
      "Revisión (ECN)": { ko: "설계 변경 차수 (ECN)", en: "Revision (ECN)" },
      "Revisión 01 Autorizada": { ko: "승인된 개정 01호", en: "Authorized Revision 01" },
      "Revisó": { ko: "검토 확인자", en: "Reviewed by" },
      "Revisó...": { ko: "검토 확인자...", en: "Reviewed by..." },
      "RFC / Tax ID": { ko: "사업자 등록번호 (RFC / Tax ID)", en: "RFC / Tax ID" },
      "RH": { ko: "우측 (RH)", en: "RH" },
      "Roles de Alto Rango (separados por coma": { ko: "상위 직급 권한 목록 (쉼표 구분", en: "High Rank Roles (comma separated" },
      "Roles de Alto Rango (separados por coma)": { ko: "상위 직급 권한 목록 (쉼표 구분)", en: "High Rank Roles (comma separated)" },
      "Rotación intermedia": { ko: "중간 회전율 (B등급)", en: "Medium Rotation" },
      "Ruta de Personal": { ko: "통근 버스 노선", en: "Staff Commute Route" },
      "Ruta de Transporte": { ko: "출퇴근 통근 노선", en: "Transport Route" },
      "Ruta sugerida FIFO, rastreo de ubicaciones/carritos, cuarentenas y órdenes de embarque": { ko: "FIFO 추천 경로, 로케이션/대차 추적, 품질 격리 및 출하 작업지시 제어", en: "Suggested FIFO route, location/cart tracking, quarantines and shipping orders" },
      "Sáb - Dom": { ko: "토 - 일", en: "Sat - Sun" },
      "Sábado": { ko: "토요일", en: "Saturday" },
      "Saldo Disponible": { ko: "사용 가능 잔여 일수", en: "Available Balance" },
      "SALIDA": { ko: "출고 (OUTBOUND)", en: "OUTBOUND" },
      "Salir": { ko: "종료", en: "Exit" },
      "Salud y Emergencias": { ko: "보건 및 비상 상황", en: "Health & Emergencies" },
      "SCRAP": { ko: "폐기 불량 (스크랩", en: "SCRAP" },
      "Scrap / Remol": { ko: "스크랩 / 분쇄재 배합비", en: "Scrap / Regrind" },
      "Script SQL": { ko: "SQL 스크립트", en: "SQL Script" },
      "Script SQL:": { ko: "SQL 스크립트:", en: "SQL Script:" },
      "Se usa como meta global y fallback si una máquina no tiene meta propia": { ko: "설비별 개별 목표가 없을 때 적용되는 공장 표준 목표값입니다", en: "Used as global target and fallback when machine lacks specific target" },
      "Se usa como meta global y fallback si una máquina no tiene meta propia.": { ko: "설비별 개별 목표가 없을 때 적용되는 공장 표준 목표값입니다.", en: "Used as global target and fallback when machine lacks specific target." },
      "Secuencia": { ko: "공정 순서 번호", en: "Sequence" },
      "Secuencia *": { ko: "공정 순서 번호 *", en: "Sequence *" },
      "Secuencia de cambios de molde con fecha/hora objetivo y máquina destino": { ko: "목표 일시 및 대상 설비가 지정된 금형 교체 순서", en: "Mold change sequence with target date/time and destination machine" },
      "Secuencia de operaciones estándar por Número de Parte": { ko: "구역, 금형, 사출기, 포장 사양 및 체크리스트를 연계한 품번별 표준 작업 순서", en: "Standard operation sequence per Part Number linking Areas, Molds, Machines, Packaging and Checklists" },
      "Secuencias producción": { ko: "생산 투입 순서", en: "Production Sequences" },
      "Seguimiento de Órdenes de Producción (Plan vs Real": { ko: "생산 작업지시 추적 (계획 vs 실적", en: "Production Order Tracking (Plan vs Actual" },
      "Seguimiento de Órdenes de Producción (Plan vs Real)": { ko: "생산 작업지시 추적 (계획 vs 실적)", en: "Production Order Tracking (Plan vs Actual)" },
      "Seguridad Industrial": { ko: "산업 안전 보건", en: "Industrial Safety" },
      "Selecciona el Estatus del Lote / Material": { ko: "로트 / 자재 품질 상태 선택", en: "Select Lot / Material Status" },
      "Selecciona el Estatus del Lote / Material *": { ko: "로트 / 자재 품질 상태 선택 *", en: "Select Lot / Material Status *" },
      "Selecciona el tipo de reporte y pulsa Generar": { ko: "보고서 유형을 선택하고 '생성'을 누르세요", en: "Select report type and click Generate" },
      "Selecciona el tipo de reporte y pulsa Generar.": { ko: "보고서 유형을 선택하고 '생성'을 누르세요.", en: "Select report type and click Generate." },
      "Selecciona un checklist": { ko: "체크리스트를 선택하세요", en: "Select a checklist" },
      "Selecciona un motivo obligatorio": { ko: "필수 사유를 선택하세요", en: "Select required reason" },
      "Selecciona un número de parte": { ko: "품번을 선택하세요", en: "Select a part number" },
      "Selecciona un número de parte a la izquierda": { ko: "좌측 목록에서 품번을 선택하세요", en: "Select a part number on the left" },
      "Selecciona un número de parte.": { ko: "품번을 선택하세요.", en: "Select a part number." },
      "Selecciona un proveedor": { ko: "공급업체를 선택하세요", en: "Select a vendor" },
      "Selecciona un proveedor...": { ko: "공급업체를 선택하세요...", en: "Select a vendor..." },
      "Selecciona una Orden de Compra": { ko: "입고할 발주서를 선택하세요", en: "Select a Purchase Order" },
      "Selecciona una Orden de Compra...": { ko: "입고할 발주서를 선택하세요...", en: "Select a Purchase Order..." },
      "Selecciona una orden de montaje de la izquierda": { ko: "좌측 목록에서 금형 교체 지시를 선택하세요", en: "Select a setup order from the left" },
      "Selecciona una orden de montaje de la izquierda.": { ko: "좌측 목록에서 금형 교체 지시를 선택하세요.", en: "Select a setup order from the left." },
      "Seleccionar Producto Terminado / Sub-ensamble": { ko: "완제품 또는 반제품 선택", en: "Select Finished Product / Sub-assembly" },
      "Seleccione área": { ko: "구역을 선택하세요", en: "Select area" },
      "Seleccione área general": { ko: "대분류 구역을 선택하세요", en: "Select general area" },
      "Seleccione área general...": { ko: "대분류 구역을 선택하세요...", en: "Select general area..." },
      "Seleccione área y turno": { ko: "구역과 교대조를 선택하세요", en: "Select area and shift" },
      "Seleccione área y turno...": { ko: "구역과 교대조를 선택하세요...", en: "Select area and shift..." },
      "Seleccione área...": { ko: "구역을 선택하세요...", en: "Select area..." },
      "Seleccione un número de parte": { ko: "품번을 선택하세요", en: "Select a part number" },
      "Seleccione un PT o Sub-ensamble para ver su estructura": { ko: "BOM 구조를 보려면 완제품 또는 반제품을 선택하세요", en: "Select a FG or Sub-assembly to view its structure" },
      "Seleccione un PT o Sub-ensamble para ver su estructura.": { ko: "BOM 구조를 보려면 완제품 또는 반제품을 선택하세요.", en: "Select a FG or Sub-assembly to view its structure." },
      "Sello o Firma Caseta": { ko: "경비실 확인 인장 또는 서명", en: "Gatehouse Stamp or Signature" },
      "Semana específica": { ko: "특정 주차 선택", en: "Specific Week" },
      "Septiembre": { ko: "9월", en: "September" },
      "Servicios Externos / Maquila": { ko: "외주 가공 및 임가공 서비스", en: "External Services / Outcontracting" },
      "Sesión de Operador Requerida": { ko: "작업자 로그인 필요", en: "Operator Session Required" },
      "Setup (min": { ko: "준비 교체 시간 (분", en: "Setup (min" },
      "Setup (min)": { ko: "준비 교체 시간 (분)", en: "Setup (min)" },
      "Setup Estándar (min": { ko: "표준 금형교체 소요 시간 (분", en: "Standard Setup (min" },
      "Setup Estándar (min)": { ko: "표준 금형교체 소요 시간 (분)", en: "Standard Setup (min)" },
      "Setup SMED (min": { ko: "SMED 금형교체 시간 (분", en: "SMED Setup (min" },
      "Setup SMED (min)": { ko: "SMED 금형교체 시간 (분)", en: "SMED Setup (min)" },
      "SGC / CALIDAD": { ko: "품질경영시스템(SGC) / 품질보증", en: "QMS / QUALITY" },
      "Sí (Oficial": { ko: "예 (공식 승인", en: "Yes (Official" },
      "Si el empaque primario es": { ko: "기본 포장 방식이", en: "If primary packaging is" },
      "Si reversas una": { ko: "역분개 실행 시", en: "If you reverse a" },
      "SIGUIENTE": { ko: "다음 단계", en: "NEXT" },
      "Simular Explosión MRP": { ko: "MRP 자재 소요량 전개 시뮬레이션", en: "Simulate MRP Explosion" },
      "Simular Lote (Pcs": { ko: "로트 생산 수량 시뮬레이션 (개", en: "Simulate Lot (Pcs" },
      "Simular Lote (Pcs):": { ko: "로트 생산 수량 시뮬레이션 (개):", en: "Simulate Lot (Pcs):" },
      "Sin diferencia sistema vs físico": { ko: "전산 재고와 실물 재고 오차 없음", en: "Zero difference system vs physical" },
      "Sin Ubicación Default WMS": { ko: "WMS 기본 보관 로케이션 미지정", en: "No Default WMS Location" },
      "Sin ubicación fija": { ko: "고정 로케이션 없음", en: "No fixed location" },
      "Sistema": { ko: "시스템", en: "System" },
      "SISTEMA APEX": { ko: "APEX 시스템", en: "APEX SYSTEM" },
      "SISTEMA MRP KRAEM": { ko: "KRAEM 제조 MRP 시스템", en: "KRAEM MRP SYSTEM" },
      "SISTEMA MRP KRAEM by APEX SYSTEM": { ko: "KRAEM MRP 시스템 by APEX SYSTEM", en: "KRAEM MRP SYSTEM by APEX SYSTEM" },
      "SMED / PRT": { ko: "금형 교체 (SMED) / 초품 검사", en: "SMED / First Piece" },
      "SMED Montaje": { ko: "SMED 금형 교체", en: "SMED Setup" },
      "Soldadura": { ko: "융착 / 초음파 용접", en: "Welding" },
      "Solo activos": { ko: "가동 중인 항목만", en: "Active Only" },
      "Solo bajo Stock de Seguridad": { ko: "안전재고 미달 품목만", en: "Below Safety Stock Only" },
      "Solo Componentes": { ko: "부품류만", en: "Components Only" },
      "Solo Dados de Baja": { ko: "폐기 처분된 항목만", en: "Decommissioned Only" },
      "Solo en Reparación": { ko: "수리 중인 항목만", en: "Under Repair Only" },
      "Solo inactivos": { ko: "비활성 항목만", en: "Inactive Only" },
      "Solo Operativos": { ko: "정상 가용 항목만", en: "Operational Only" },
      "Solo Resinas": { ko: "원재료 레진만", en: "Resins Only" },
      "Soporta cientos de filas, fechas Excel y empate por NP interno o NP Cliente": { ko: "수백 행 일괄 처리, 엑셀 날짜 형식 자동 변환, 사내 품번 및 고객사 품번 자동 매칭", en: "Supports hundreds of rows, Excel dates and internal or customer P/N matching" },
      "SQL Supabase": { ko: "데이터베이스 SQL", en: "Database SQL" },
      "Standard Pack": { ko: "표준 적재 용량 (Standard Pack)", en: "Standard Pack" },
      "Status Máquina": { ko: "사출기 가동 상태", en: "Machine Status" },
      "Stock de Seguridad": { ko: "안전 재고 수량", en: "Safety Stock" },
      "Stock disponible (Toca para cargar": { ko: "가용 재고 (클릭하여 자동 입력", en: "Available stock (Tap to load" },
      "Stock disponible (Toca para cargar)": { ko: "가용 재고 (클릭하여 자동 입력)", en: "Available stock (Tap to load)" },
      "Stock en esta ubicación": { ko: "해당 로케이션 현재고", en: "Stock in this location" },
      "STOCK FÍSICO TOTAL": { ko: "총 실물 재고", en: "TOTAL PHYSICAL STOCK" },
      "Stock por ubicación y cuarentenas": { ko: "로케이션별 재고 및 격리 보관 현황", en: "Stock by Location & Quarantines" },
      "Stock Real": { ko: "현재 실물 재고", en: "Actual Stock" },
      "Stock Seg": { ko: "안전 재고", en: "Safety Stock" },
      "Stock Seg.": { ko: "안전 재고", en: "Safety Stock" },
      "Stock Sistema": { ko: "전산 재고 수량", en: "System Stock" },
      "Subáreas operativas relacionadas a las áreas generales": { ko: "대분류 구역에 종속된 현장 세부 운영 구역", en: "Operational sub-areas related to general areas" },
      "Subáreas operativas relacionadas a las áreas generales.": { ko: "대분류 구역에 종속된 현장 세부 운영 구역.", en: "Operational sub-areas related to general areas." },
      "Sub-ensamble": { ko: "중간 반제품 (Sub-assembly)", en: "Sub-assembly" },
      "Sub-ensamble Inyectado": { ko: "사출 성형 반제품", en: "Injected Sub-assembly" },
      "Subir Foto del Operador": { ko: "작업자 증명사진 등록", en: "Upload Operator Photo" },
      "Subir Imagen": { ko: "사진 업로드", en: "Upload Image" },
      "Supervisor Solicitante": { ko: "신청 담당 반장/부서장", en: "Requesting Supervisor" },
      "Supervisores / Liderazgo (S1–S5": { ko: "관리자 및 조장 리더십 평가 (S1-S5", en: "Supervisors / Leadership (S1–S5" },
      "Supervisores / Liderazgo (S1–S5)": { ko: "관리자 및 조장 리더십 평가 (S1-S5)", en: "Supervisors / Leadership (S1–S5)" },
      "Supervisores / Liderazgo (Semanal": { ko: "관리자 / 리더십 주간 평가", en: "Supervisors / Leadership (Weekly" },
      "Supervisores / Liderazgo (Semanal)": { ko: "관리자 / 리더십 주간 평가", en: "Supervisors / Leadership (Weekly)" },
      "Supply Chain Flow": { ko: "공급망 흐름", en: "Supply Chain Flow" },
      "Suspensión Laboral": { ko: "징계 정직 (출근 정지)", en: "Work Suspension" },
      "Tablero APS": { ko: "APS 일정 현황판", en: "APS Board" },
      "Tablero APS & Máquinas": { ko: "APS 일정 현황판 및 설비", en: "APS Board & Machines" },
      "Tablero APS →": { ko: "APS 현황판 바로가기 →", en: "APS Board →" },
      "Tablero APS Autónomo & Gantt por Máquina": { ko: "설비별 지능형 APS 현황판 & 간트차트", en: "Autonomous APS Board & Machine Gantt" },
      "Tablero APS Prensa": { ko: "사출기별 APS 현황판", en: "Press APS Board" },
      "Talla de Playera": { ko: "유니폼 사이즈", en: "Shirt Size" },
      "Tara (kg": { ko: "공차 중량 (kg", en: "Tare (kg" },
      "Tara (kg)": { ko: "공차 중량 (kg)", en: "Tare (kg)" },
      "Teléfono / Email": { ko: "전화번호 / 이메일", en: "Phone / Email" },
      "Teléfono Celular": { ko: "휴대전화 번호", en: "Cell Phone" },
      "Teléfono de Emergencia": { ko: "비상 연락 전화번호", en: "Emergency Phone" },
      "Teléfono Directo": { ko: "직통 전화번호", en: "Direct Phone" },
      "Tema": { ko: "화면 테마", en: "Theme" },
      "Tendencia de Cumplimiento": { ko: "계획 달성률 추세", en: "Compliance Trend" },
      "Tendencia de Exactitud IRA": { ko: "재고 정확도(IRA) 추세", en: "IRA Accuracy Trend" },
      "Tendencia de Exactitud IRA %": { ko: "재고 정확도(IRA) 추세", en: "IRA Accuracy Trend %" },
      "Tendencia de Piezas Defectuosas en el Tiempo": { ko: "시간 경과에 따른 불량 발생 추세선", en: "Defective Pieces Trend Over Time" },
      "Tendencia Ejecutiva: Producción Diaria Real vs Meta Plan": { ko: "경영진 핵심 지표: 일일 실제 생산량 vs 계획 목표치 추세", en: "Executive Trend: Daily Actual Production vs Plan Target" },
      "Terminal Operativa WMS": { ko: "WMS 현장 작업 터미널", en: "WMS Shop Floor Terminal" },
      "Tickets Correctivos": { ko: "시정조치 요청서", en: "Corrective Action Tickets" },
      "Tiempo (s": { ko: "소요 시간 (초", en: "Time (s" },
      "Tiempo (s)": { ko: "소요 시간 (초)", en: "Time (s)" },
      "Tiempo Ciclo (seg": { ko: "사이클 타임 (초", en: "Cycle Time (sec" },
      "Tiempo Ciclo (seg)": { ko: "사이클 타임 (초)", en: "Cycle Time (sec)" },
      "Tiempo ciclo / pza (s": { ko: "개당 사이클 타임 (초", en: "Cycle Time / pc (s" },
      "Tiempo ciclo / pza (s)": { ko: "개당 사이클 타임 (초)", en: "Cycle Time / pc (s)" },
      "TIEMPO EXTRA": { ko: "연장 근로 (특근/잔업)", en: "OVERTIME" },
      "Tiempo Meta SMED Estándar (min": { ko: "표준 금형교체(SMED) 목표 시간 (분", en: "Standard SMED Target Time (min" },
      "Tiempo Meta SMED Estándar (min)": { ko: "표준 금형교체(SMED) 목표 시간 (분)", en: "Standard SMED Target Time (min)" },
      "Tiempo montaje SMED (min": { ko: "SMED 금형 교체 소요 시간 (분", en: "SMED Setup Time (min" },
      "Tiempo montaje SMED (min)": { ko: "SMED 금형 교체 소요 시간 (분)", en: "SMED Setup Time (min)" },
      "Tiempo operando vs programado": { ko: "실제 가동 시간 vs 계획 가동 시간", en: "Operating Time vs Scheduled" },
      "Tiempo Retención": { ko: "문서 보존 연한", en: "Retention Period" },
      "Tipo / Grado": { ko: "재질 종류 / 그레이드", en: "Type / Grade" },
      "Tipo / Material Grade": { ko: "재질 / 원재료 그레이드", en: "Type / Material Grade" },
      "Tipo Ajuste": { ko: "조정 유형", en: "Adjustment Type" },
      "Tipo Auditoría": { ko: "감사 유형", en: "Audit Type" },
      "Tipo de Auditoría": { ko: "감사 평가 유형", en: "Audit Type" },
      "Tipo de Checklist": { ko: "체크리스트 종류", en: "Checklist Type" },
      "Tipo de colada": { ko: "러너 방식 (핫/콜드)", en: "Runner Type" },
      "Tipo de Empaque": { ko: "포장 용기 유형", en: "Packaging Type" },
      "Tipo de Empaque *": { ko: "포장 용기 유형 *", en: "Packaging Type *" },
      "Tipo de Permiso": { ko: "휴가 유형", en: "Leave Type" },
      "Tipo de Permiso (Rol": { ko: "접근 권한 (역할", en: "Permission Type (Role" },
      "Tipo de Permiso (Rol)": { ko: "접근 권한 (역할)", en: "Permission Type (Role)" },
      "Tipo de Permiso / Ausencia": { ko: "근태 / 휴가 유형", en: "Leave / Absence Type" },
      "Tipo de Permiso:": { ko: "휴가 유형:", en: "Leave Type:" },
      "Tipo de Producto": { ko: "제품 분류 (완제품/반제품/원자재)", en: "Product Type" },
      "Tipo de Registro": { ko: "품목 등록 유형", en: "Record Type" },
      "Tipo de reporte": { ko: "출력 보고서 종류", en: "Report Type" },
      "Tipo de Sangre": { ko: "혈액형", en: "Blood Type" },
      "Tipo Demanda": { ko: "수요 구분 (수주/예측)", en: "Demand Type" },
      "Tipo Máquina": { ko: "사출기 기종", en: "Machine Type" },
      "Tipo Mov": { ko: "수불 유형", en: "Movement Type" },
      "Tipo Mov.": { ko: "수불 유형", en: "Movement Type" },
      "Tipo Movimiento": { ko: "수불 이동 유형", en: "Movement Type" },
      "Tipo Resina": { ko: "레진 재질 종류", en: "Resin Type" },
      "Todas las Áreas": { ko: "전체 구역", en: "All Areas" },
      "Todas las categorías": { ko: "모든 분류", en: "All Categories" },
      "TODAS LAS CLASES (A, B, C": { ko: "모든 등급 (A, B, C", en: "ALL CLASSES (A, B, C" },
      "TODAS LAS CLASES (A, B, C)": { ko: "모든 등급 (A, B, C)", en: "ALL CLASSES (A, B, C)" },
      "Todo el Historial": { ko: "전체 이력", en: "Full History" },
      "Todo el Inventario Actual con Existencia > 0": { ko: "재고 수량 0 초과 전체 품목", en: "All Current Inventory with Qty > 0" },
      "TODOS (PDF / EXCEL / IMPRESO": { ko: "모든 형식 (PDF / EXCEL / 인쇄물", en: "ALL (PDF / EXCEL / PRINTED" },
      "TODOS (PDF / EXCEL / IMPRESO)": { ko: "모든 형식 (PDF / EXCEL / 인쇄물)", en: "ALL (PDF / EXCEL / PRINTED)" },
      "Todos los clientes": { ko: "모든 고객사", en: "All Customers" },
      "Todos los Clientes / Propietarios": { ko: "모든 고객사 / 소유주", en: "All Customers / Owners" },
      "TODOS LOS ESTADOS": { ko: "모든 상태", en: "ALL STATES" },
      "TODOS LOS ESTATUS": { ko: "모든 품질 상태", en: "ALL STATUSES" },
      "Todos los Materiales Clase A (Críticos": { ko: "A등급 모든 핵심 자재", en: "All Class A Materials (Critical" },
      "Todos los Materiales Vencidos / Toca Contar Hoy": { ko: "실사 기한 도래 / 오늘 실사 대상 전체", en: "All Overdue Materials / Due Today" },
      "Todos los niveles de stock": { ko: "모든 재고 상태", en: "All Stock Levels" },
      "Todos los PDFs incluyen": { ko: "모든 관리 PDF에 포함되는 항목", en: "All PDFs include" },
      "Todos los PDFs incluyen:": { ko: "모든 관리 PDF에 포함되는 항목:", en: "All PDFs include:" },
      "Todos los permisos": { ko: "모든 권한", en: "All Permissions" },
      "TODOS LOS PROCESOS": { ko: "모든 생산 공정", en: "ALL PROCESSES" },
      "Todos los proyectos": { ko: "모든 프로젝트", en: "All Projects" },
      "Todos los puestos": { ko: "모든 직무", en: "All Positions" },
      "Todos los Tipos": { ko: "모든 유형", en: "All Types" },
      "Todos los Tipos de Empaque": { ko: "모든 포장 용기 유형", en: "All Packaging Types" },
      "Todos los Turnos": { ko: "모든 교대조", en: "All Shifts" },
      "Tolerancia Conteo Exacto (piezas": { ko: "재고 정확도 허용 오차 (수량", en: "Exact Count Tolerance (pieces" },
      "Tolerancia Conteo Exacto (piezas)": { ko: "재고 정확도 허용 오차 (수량)", en: "Exact Count Tolerance (pieces)" },
      "Tolerancia Peso (+/- g": { ko: "단품 중량 허용 공차 (+/- g", en: "Weight Tolerance (+/- g" },
      "Tolerancia Peso (+/- g)": { ko: "단품 중량 허용 공차 (+/- g)", en: "Weight Tolerance (+/- g)" },
      "Tomados / Ajustes": { ko: "사용 일수 / 수동 조정", en: "Taken / Adjustments" },
      "Ton": { ko: "톤 (Ton)", en: "Ton" },
      "Tonelaje máx": { ko: "최대 형체력 톤수", en: "Max Tonnage" },
      "Tonelaje máx.": { ko: "최대 형체력 톤수", en: "Max Tonnage" },
      "Tonelaje mín": { ko: "최소 형체력 톤수", en: "Min Tonnage" },
      "Tonelaje mín.": { ko: "최소 형체력 톤수", en: "Min Tonnage" },
      "Tonelaje y meta OEE": { ko: "톤수 및 목표 OEE", en: "Tonnage & Target OEE" },
      "Top 5 Empleados Multihabilidades": { ko: "다기능 우수 직원 TOP 5", en: "Top 5 Multi-Skilled Employees" },
      "Total Auditorías IRA": { ko: "총 순환 실사 횟수", en: "Total IRA Audits" },
      "Total Entradas": { ko: "총 입고 수량", en: "Total Inbound" },
      "Total Entradas (+)": { ko: "총 입고 수량 (+)", en: "Total Inbound (+)" },
      "Total Horas Extra": { ko: "총 잔업/특근 시간", en: "Total Overtime Hours" },
      "Total Inversión en Material": { ko: "총 원자재 구매 투자액", en: "Total Material Investment" },
      "Total Modelos": { ko: "총 등록 모델 수", en: "Total Models" },
      "Total OC": { ko: "발주 총액", en: "Total PO" },
      "Total OC:": { ko: "발주 총액:", en: "Total PO:" },
      "Total Órdenes Emitidas": { ko: "총 발행 발주 건수", en: "Total Orders Issued" },
      "Total Pedido": { ko: "발주 합계 금액", en: "Total Order" },
      "Total Piezas": { ko: "총 수량", en: "Total Pieces" },
      "Total Piezas Demandadas": { ko: "총 고객 요구 수량", en: "Total Demanded Pieces" },
      "Total Piezas:": { ko: "총 수량:", en: "Total Pieces:" },
      "Total Salidas": { ko: "총 출고 수량", en: "Total Outbound" },
      "Total Salidas (-)": { ko: "총 출고 수량 (-)", en: "Total Outbound (-)" },
      "TOTAL SCRAP": { ko: "총 불량(Scrap) 수량", en: "TOTAL SCRAP" },
      "totales": { ko: "전체 합계", en: "totals" },
      "Totes y KLTs de clientes": { ko: "고객사 리턴 전용 토트(Tote) 및 KLT 박스", en: "Customer Totes & KLTs" },
      "TRANSF": { ko: "이동", en: "TRANSFER" },
      "TRANSFERENCIA": { ko: "재고 이동 (이송)", en: "TRANSFER" },
      "Transferencias": { ko: "이동 내역", en: "Transfers" },
      "Tránsito": { ko: "운송 중", en: "In Transit" },
      "Transporte": { ko: "출퇴근 교통수단", en: "Transportation" },
      "Transporte Público": { ko: "대중교통 이용", en: "Public Transport" },
      "TRAZABILIDAD Y RETENCIÓN": { ko: "이력 추적 및 보존 연한", en: "TRACEABILITY & RETENTION" },
      "Tu nombre de usuario": { ko: "사용자 계정명", en: "Your Username" },
      "Turno 3": { ko: "3교대 (야간조)", en: "Shift 3" },
      "Turno Laboral": { ko: "근무 교대조", en: "Work Shift" },
      "Turno, estación, motivo de la capacitación": { ko: "교대조, 작업대, 교육 사유 입력", en: "Shift, station, training reason" },
      "Turno, estación, motivo de la capacitación...": { ko: "교대조, 작업대, 교육 사유 입력...", en: "Shift, station, training reason..." },
      "Turnos / Día (CR01": { ko: "일일 가동 교대수 (CR01", en: "Shifts / Day (CR01" },
      "Turnos / Día (CR01)": { ko: "일일 가동 교대수 (CR01)", en: "Shifts / Day (CR01)" },
      "Turnos / OEE": { ko: "교대조 / OEE 종합효율", en: "Shifts / OEE" },
      "U/S": { ko: "단위 소요량 (U/S)", en: "U/S" },
      "Ubic. Default WMS": { ko: "기본 WMS 보관 위치", en: "Default WMS Location" },
      "Ubic. WMS": { ko: "WMS 보관 로케이션", en: "WMS Location" },
      "UBICACIÓN": { ko: "보관 로케이션", en: "LOCATION" },
      "Ubicación / Carrito / Orden": { ko: "로케이션 / 대차 / 오더", en: "Location / Cart / Order" },
      "Ubicación Default WMS": { ko: "기본 WMS 보관 로케이션", en: "Default WMS Location" },
      "Ubicación Destino WMS": { ko: "WMS 입고 보관 위치", en: "WMS Destination Location" },
      "Ubicación Destino WMS *": { ko: "WMS 입고 보관 위치 *", en: "WMS Destination Location *" },
      "Ubicación Fija": { ko: "고정 로케이션", en: "Fixed Location" },
      "Ubicación Fija (Carril / Rack": { ko: "고정 로케이션 (적재 라인 / 랙", en: "Fixed Location (Lane / Rack" },
      "Ubicación Fija / Hilera DESTINO": { ko: "도착 고정 로케이션 / 랙", en: "DESTINATION Fixed Location / Row" },
      "Ubicación Fija DESTINO": { ko: "도착 고정 로케이션", en: "DESTINATION Fixed Location" },
      "Ubicación Fija donde se encontró": { ko: "실물이 발견된 고정 로케이션", en: "Fixed Location Where Found" },
      "Ubicación Fija ORIGEN": { ko: "출발 고정 로케이션", en: "ORIGIN Fixed Location" },
      "Ubicación Fija ORIGEN (Haz clic para ver Stock del Área": { ko: "출발 고정 로케이션 (클릭 시 구역 재고 확인", en: "ORIGIN Fixed Location (Click to view Area Stock" },
      "UBICACIÓN:": { ko: "보관 로케이션:", en: "LOCATION:" },
      "Ubicaciones Registradas": { ko: "등록된 로케이션 수", en: "Registered Locations" },
      "Últimas Auditorías de Conteo Cíclico (IRA": { ko: "최근 진행된 순환 재고조사 (IRA", en: "Recent Cycle Count Audits (IRA" },
      "Últimas Auditorías de Conteo Cíclico (IRA)": { ko: "최근 진행된 순환 재고조사 (IRA)", en: "Recent Cycle Count Audits (IRA)" },
      "Último Conteo": { ko: "최근 실사일", en: "Last Count Date" },
      "Último Folio Recibo": { ko: "최근 입고 전표 번호", en: "Last Receipt Folio" },
      "Últimos 7 Días": { ko: "최근 7일", en: "Last 7 Days" },
      "Umbral Alerta PM de Molde (% tiros": { ko: "금형 예방정비 경고 기준 (% 쇼트", en: "Mold PM Alert Threshold (% shots" },
      "Umbral Alerta PM de Molde (% tiros)": { ko: "금형 예방정비 경고 기준 (% 쇼트)", en: "Mold PM Alert Threshold (% shots)" },
      "Umbral objetivo de polivalencia por empleado/estación": { ko: "직원/공정당 다기능 보유율 목표 기준", en: "Target versatility threshold per employee/workstation" },
      "Umbral objetivo de polivalencia por empleado/estación.": { ko: "직원/공정당 다기능 보유율 목표 기준.", en: "Target versatility threshold per employee/workstation." },
      "Umbral para semáforo OK en Dashboard y Conteos Cíclicos": { ko: "대시보드 및 실사 지표의 정상(초록) 판정 기준", en: "Threshold for OK status in Dashboard and Cycle Counts" },
      "Umbral para semáforo OK en Dashboard y Conteos Cíclicos.": { ko: "대시보드 및 실사 지표의 정상(초록) 판정 기준.", en: "Threshold for OK status in Dashboard and Cycle Counts." },
      "Unidad de Medida": { ko: "단위 (UoM)", en: "Unit of Measure" },
      "Unidades Físicas / Flota": { ko: "실물 대차 보유 수량", en: "Physical Units / Fleet" },
      "Usa esta opción si encontraste material físicamente en una ubicación o carrito que no aparecía en la lista del sistema": { ko: "전산에 등록되지 않았으나 현장 로케이션 또는 대차에서 실물 자재를 발견한 경우 사용하세요", en: "Use this option if you physically found material in a location or cart that was not listed in system" },
      "Usa esta opción si encontraste material físicamente en una ubicación o carrito que no aparecía en la lista del sistema.": { ko: "전산에 등록되지 않았으나 현장 로케이션 또는 대차에서 실물 자재를 발견한 경우 사용하세요.", en: "Use this option if you physically found material in a location or cart that was not listed in system." },
      "Usado al calcular tiempo estimado de órdenes en tablero APS": { ko: "APS 현황판에서 작업 완료 예정 시간 계산 시 사용됩니다", en: "Used to calculate estimated order time in APS board" },
      "Usado al calcular tiempo estimado de órdenes en tablero APS.": { ko: "APS 현황판에서 작업 완료 예정 시간 계산 시 사용됩니다.", en: "Used to calculate estimated order time in APS board." },
      "Usado cuando aún no existen tiempos ciclo cerrados en corridas": { ko: "실제 생산 사이클 타임 데이터가 없을 때 적용됩니다", en: "Used when closed cycle times are not yet recorded in runs" },
      "Usado cuando aún no existen tiempos ciclo cerrados en corridas.": { ko: "실제 생산 사이클 타임 데이터가 없을 때 적용됩니다.", en: "Used when closed cycle times are not yet recorded in runs." },
      "Usado en cálculo estimado cuando no hay máquinas en estatus Producción": { ko: "생산 가동 중인 설비가 없을 때 추정치 산출에 사용됩니다", en: "Used in estimation when no machines are in Production status" },
      "Usado en cálculo estimado cuando no hay máquinas en estatus Producción.": { ko: "생산 가동 중인 설비가 없을 때 추정치 산출에 사용됩니다.", en: "Used in estimation when no machines are in Production status." },
      "USD - Dólares Americanos": { ko: "USD - 미국 달러", en: "USD - US Dollars" },
      "Uso / Pieza (U/S": { ko: "개당 소요 원단위 (U/S", en: "Usage / Piece (U/S" },
      "Uso / Pieza (U/S)": { ko: "개당 소요 원단위 (U/S)", en: "Usage / Piece (U/S)" },
      "Uso BOM": { ko: "BOM 소요량", en: "BOM Usage" },
      "Usuario": { ko: "로그인 사용자", en: "User" },
      "Usuario: -": { ko: "로그인 사용자: -", en: "User: -" },
      "Usuarios Registrados": { ko: "등록된 사용자", en: "Registered Users" },
      "Usuarios Registrados (": { ko: "등록된 사용자 (", en: "Registered Users (" },
      "Vacaciones": { ko: "연차 유급 휴가", en: "Vacations" },
      "Vacaciones Pendientes": { ko: "미사용 잔여 연차", en: "Pending Vacations" },
      "Vacío · sin capacitación": { ko: "미이수 · 교육 전", en: "Empty · untrained" },
      "Validación Pre-Arranque & Checklist SMED": { ko: "초품 가동 전 사전 점검 & SMED 체크리스트", en: "Pre-Startup Validation & SMED Checklist" },
      "Validación Vigilancia": { ko: "경비실 출입 승인 검증", en: "Security Guard Validation" },
      "Validando sesión": { ko: "사용자 세션 확인 중", en: "Validating session" },
      "Validando sesión...": { ko: "사용자 세션 확인 중...", en: "Validating session..." },
      "Velocidad real vs ciclo estándar": { ko: "실제 사이클 속도 vs 표준 사이클 타임", en: "Actual Speed vs Standard Cycle" },
      "VENCIDOS / CONTAR HOY": { ko: "실사 기한 도래 / 오늘 실사", en: "OVERDUE / COUNT TODAY" },
      "Vencidos / Toca Contar Hoy": { ko: "실사 기한 도래 / 오늘 실사", en: "Overdue / Count Today" },
      "Ventana de programación de prensas (default 7 días": { ko: "사출기 일정 편성 기간 (기본 7일", en: "Press scheduling window (default 7 days" },
      "Ventana de programación de prensas (default 7 días).": { ko: "사출기 일정 편성 기간 (기본 7일).", en: "Press scheduling window (default 7 days)." },
      "Ventana Producción": { ko: "양산 생산 기간", en: "Production Window" },
      "Ventana Setup SMED": { ko: "금형 교체 준비 시간", en: "SMED Setup Window" },
      "Ver / Copiar SQL": { ko: "SQL 보기 / 복사", en: "View / Copy SQL" },
      "Ver 100 filas": { ko: "100행 보기", en: "View 100 rows" },
      "Ver 300 filas": { ko: "300행 보기", en: "View 300 rows" },
      "Ver Gráfica de Rendimiento": { ko: "성능 및 가동률 차트 보기", en: "View Performance Chart" },
      "Ver Manual Aquí": { ko: "여기서 매뉴얼 보기", en: "View Manual Here" },
      "Ver Stock & FIFO WMS": { ko: "WMS 재고 및 선입선출(FIFO) 현황 보기", en: "View Stock & FIFO WMS" },
      "Ver Stock & FIFO WMS →": { ko: "WMS 재고 및 선입선출(FIFO) 현황 보기 →", en: "View Stock & FIFO WMS →" },
      "Ver todas": { ko: "전체 보기", en: "View all" },
      "Veracidad Inv": { ko: "재고 정확도 (IRA", en: "Inv. Accuracy" },
      "Veracidad Inv.": { ko: "재고 정확도 (IRA)", en: "Inv. Accuracy" },
      "Veracidad IRA": { ko: "재고 정확도 (IRA", en: "IRA ACCURACY" },
      "Veracidad IRA %": { ko: "재고 정확도 (IRA) %", en: "IRA Accuracy %" },
      "Verificando BD": { ko: "데이터베이스 연결 확인 중", en: "Checking Database" },
      "Verificando BD...": { ko: "데이터베이스 연결 확인 중...", en: "Checking Database..." },
      "Versatilidad (Matriz": { ko: "다기능 숙련도 지수 (매트릭스", en: "Versatility (Matrix" },
      "Versatilidad (Matriz)": { ko: "다기능 숙련도 지수 (매트릭스)", en: "Versatility (Matrix)" },
      "Versiones de Fabricación (Parte + Molde + Máquina + Empaque": { ko: "생산 버전 마스터 (품번 + 금형 + 사출기 + 포장 사양 연계", en: "Production Versions (Part + Mold + Machine + Packaging" },
      "Versiones de Fabricación (Parte + Molde + Máquina + Empaque)": { ko: "생산 버전 마스터 (품번 + 금형 + 사출기 + 포장 사양 연계)", en: "Production Versions (Part + Mold + Machine + Packaging)" },
      "Viernes": { ko: "금요일", en: "Friday" },
      "Vigilancia / Caseta de Entrada y Salida": { ko: "공장 정문 경비실 출입 통제", en: "Guardhouse / Entry & Exit Gate" },
      "Vista": { ko: "조회 보기", en: "View" },
      "Vista Ejemplo": { ko: "미리보기 예시", en: "Example View" },
      "Visualización de carga diaria y saturación por máquina": { ko: "설비별 일일 가동 부하율 및 가동 포화도 시각화", en: "Visualization of daily load and saturation per machine" },
      "Visualización de carga diaria y saturación por máquina.": { ko: "설비별 일일 가동 부하율 및 가동 포화도 시각화.", en: "Visualization of daily load and saturation per machine." },
      "Volver a Catálogos": { ko: "카탈로그 목록으로 돌아가기", en: "Back to Catalogs" },
      "Volver al Catálogo": { ko: "카탈로그로 돌아가기", en: "Back to Catalog" },
      "WMS & Inventarios": { ko: "WMS 및 재고 관리", en: "WMS & Inventories" },
      "WMS (Almacén": { ko: "WMS (원부자재 및 완제품 창고", en: "WMS (Warehouse" },
      "WMS (Almacén)": { ko: "WMS (원부자재 및 완제품 창고)", en: "WMS (Warehouse)" },
      "WMS / ALMACÉN": { ko: "WMS / 자재 및 제품 창고", en: "WMS / WAREHOUSE" },
      "WMS Buscador QR, FIFO y Control de Stock": { ko: "WMS QR 검색, 선입선출 및 재고 통제", en: "WMS QR Finder, FIFO & Stock Control" },
      "WMS Estación de Conteos Cíclicos y Auditoría IRA": { ko: "WMS 순환 실사 및 재고 정확도 감사", en: "WMS Cycle Counts & IRA Audit Station" },
      "WMS Estación Operativa Unificada": { ko: "WMS 통합 운영 작업 스테이션", en: "WMS Unified Operations Station" },
      "WMS Inventarios": { ko: "WMS 재고 현황", en: "WMS Inventories" },
      "WMS Lote FIFO": { ko: "WMS 선입선출(FIFO) 로트", en: "WMS FIFO Lot" },
      "WO": { ko: "작업지시번호(WO)", en: "WO" },
      "WO cerradas a tiempo": { ko: "정시 납기 완료 지시", en: "WO Closed on Time" },
      "WO Sugeridas (Netas": { ko: "추천 작업지시서 (순소요", en: "Suggested WO (Net" },
      "WO Sugeridas (Netas)": { ko: "추천 작업지시서 (순소요)", en: "Suggested WO (Net)" },
      "y todo lo demás se reprogramará en cascada": { ko: "이후 모든 일정이 자동으로 연쇄 재조정됩니다", en: "and everything else will reschedule in cascade" },
      "y todo lo demás se reprogramará en cascada.": { ko: "이후 모든 일정이 자동으로 연쇄 재조정됩니다.", en: "and everything else will reschedule in cascade." },
      "Ya Recibido": { ko: "기 입고 수량", en: "Already Received" },
      "YIELD": { ko: "종합 수율 (Yield", en: "YIELD" },
      "YIELD %": { ko: "종합 수율 (Yield %)", en: "YIELD %" },
      "🅰️ CLASE A (CADA 30 DÍAS)": { ko: "🅰️ A등급 (30일 주기 실사)", en: "🅰️ CLASS A (EVERY 30 DAYS)" },
      "🅰️ Clase A (Contar cada 30 días)": { ko: "🅰️ A등급 (30일마다 실사)", en: "🅰️ Class A (Count every 30 days)" },
      "🅰️ Clase A (Mensual - 30 días)": { ko: "🅰️ A등급 (월간 - 30일)", en: "🅰️ Class A (Monthly - 30 days)" },
      "🅰️ Todos los Materiales Clase A (Críticos)": { ko: "🅰️ A등급 모든 핵심 자재", en: "🅰️ All Class A Materials (Critical)" },
      "🅱️ CLASE B (CADA 90 DÍAS)": { ko: "🅱️ B등급 (90일 주기 실사)", en: "🅱️ CLASS B (EVERY 90 DAYS)" },
      "🅱️ Clase B (Contar cada 90 días)": { ko: "🅱️ B등급 (90일마다 실사)", en: "🅱️ Class B (Count every 90 days)" },
      "🅱️ Clase B (Trimestral - 90 días)": { ko: "🅱️ B등급 (분기 - 90일)", en: "🅱️ Class B (Quarterly - 90 days)" },
      "🅲 CLASE C (CADA 180 DÍAS)": { ko: "🅲 C등급 (180일 주기 실사)", en: "🅲 CLASS C (EVERY 180 DAYS)" },
      "🅲 Clase C (Contar cada 180 días)": { ko: "🅲 C등급 (180일마다 실사)", en: "🅲 Class C (Count every 180 days)" },
      "🅲 Clase C (Semestral - 180 días)": { ko: "🅲 C등급 (반기 - 180일)", en: "🅲 Class C (Semi-annual - 180 days)" },
      "🎯 VERACIDAD IRA %": { ko: "🎯 재고 정확도 (IRA %)", en: "🎯 IRA ACCURACY %" },
      "🏛️ NORMATIVA APLICABLE": { ko: "🏛️ 적용 인증 규격", en: "🏛️ APPLICABLE REGULATION" },
      "🏭 Auditar un Área Completa (Inventario Anual)": { ko: "🏭 구역 전체 실사 (정기 재고조사)", en: "🏭 Audit Full Area (Annual Inventory)" },
      "🏭 Planeación de Producción": { ko: "🏭 생산 계획 수립 및 관리", en: "🏭 Production Planning" },
      "🏷️ Clasificación ABC": { ko: "🏷️ ABC 등급 분류", en: "🏷️ ABC Classification" },
      "👁️ Hoja de SUPERVISOR (Muestra la cantidad del sistema como referencia)": { ko: "👁️ 관리자용 시트 (전산 재고 수량 표시)", en: "👁️ SUPERVISOR Sheet (Shows system count as reference)" },
      "👥 Registro de Personal": { ko: "👥 직원 인사 명부", en: "👥 Personnel Directory" },
      "💾 Guardar planeación": { ko: "💾 생산 계획 저장", en: "💾 Save Planning" },
      "📄 Desechable (Cartón)": { ko: "📄 일회용 포장 (골판지 박스)", en: "📄 Disposable (Cardboard)" },
      "📈 Forecast": { ko: "📈 판매 예측 (Forecast)", en: "📈 Forecast" },
      "📈 Forecast – Análisis de Demanda": { ko: "📈 판매 예측 - 고객 수요 분석", en: "📈 Forecast – Demand Analysis" },
      "📊 Planeación": { ko: "📊 생산 계획", en: "📊 Planning" },
      "📊 Propuesta automática de planeación": { ko: "📊 생산 계획 자동 편성 제안", en: "📊 Automated Planning Proposal" },
      "📋 FORMATOS CONTROLADOS": { ko: "📋 공식 관리 서식", en: "📋 CONTROLLED FORMS" },
      "📋 Pendientes por Programar (Planeación)": { ko: "📋 계획 편성 대기 목록", en: "📋 Pending to Schedule (Planning)" },
      "📌 Fijada Manual": { ko: "📌 수동 고정된 일정", en: "📌 Manually Fixed" },
      "📌 Fijar en esta fecha/hora y reprogramar las demás": { ko: "📌 이 일시에 일정을 고정하고 다른 지시 자동 재편성", en: "📌 Fix at this date/time and reschedule others" },
      "📍 Auditar una Ubicación Fija (Rack / Hilera)": { ko: "📍 고정 로케이션 실사 (랙 / 선반)", en: "📍 Audit Fixed Location (Rack / Row)" },
      "📍 Filtrar Área": { ko: "📍 구역 필터링", en: "📍 Filter Area" },
      "📍 Inventario por Ubicación": { ko: "📍 로케이션별 재고", en: "📍 Inventory by Location" },
      "📍 Mover Ubicación Fija Completa": { ko: "📍 고정 로케이션 전체 일괄 이동", en: "📍 Move Entire Fixed Location" },
      "📍 Ubicación / Carrito / Orden": { ko: "📍 로케이션 / 대차 / 오더", en: "📍 Location / Cart / Order" },
      "📍 Ubicación Fija": { ko: "📍 고정 로케이션", en: "📍 Fixed Location" },
      "📍 Ubicación Fija (Carril / Rack)": { ko: "📍 고정 로케이션 (적재 라인 / 랙)", en: "📍 Fixed Location (Lane / Rack)" },
      "📍 Ubicación Fija / Hilera DESTINO *": { ko: "📍 도착 고정 로케이션 / 랙 *", en: "📍 DESTINATION Fixed Location / Row *" },
      "📍 Ubicación Fija DESTINO": { ko: "📍 도착 고정 로케이션", en: "📍 DESTINATION Fixed Location" },
      "📍 Ubicación Fija donde se encontró *": { ko: "📍 실물이 발견된 고정 로케이션 *", en: "📍 Fixed Location Where Found *" },
      "📍 Ubicación Fija ORIGEN": { ko: "📍 출발 고정 로케이션", en: "📍 ORIGIN Fixed Location" },
      "📍 Ubicación Fija ORIGEN (Haz clic para ver Stock del Área)": { ko: "📍 출발 고정 로케이션 (클릭 시 구역 재고 확인)", en: "📍 ORIGIN Fixed Location (Click to view Area Stock)" },
      "📜 Historial Maestro de Movimientos": { ko: "📜 수불 이력 종합 마스터", en: "📜 Movement History Master" },
      "📜 Movimientos Recientes y Reversas Blindadas": { ko: "📜 최근 수불 및 안전 역분개 내역", en: "📜 Recent Movements & Reversals" },
      "📞 Captura de Requerimiento (Demanda)": { ko: "📞 수주 및 납기 소요량 입력", en: "📞 Requirement Capture (Demand)" },
      "📥 Requerimientos": { ko: "📥 고객 요구 수량", en: "📥 Requirements" },
      "📦 Caja Grande Interna (Macrobin)": { ko: "📦 대형 사내 보관 박스 (매크로빈)", en: "📦 Internal Large Box (Macrobin)" },
      "📦 Carrito Retornable": { ko: "📦 고객사 회수용 리턴 대차", en: "📦 Returnable Cart" },
      "📦 Catálogo de Empaques y Gestión de Flota": { ko: "📦 포장 사양 카탈로그 및 대차 플릿 관리", en: "📦 Packaging Catalog & Fleet Management" },
      "📦 Inventario por Áreas": { ko: "📦 구역별 재고", en: "📦 Inventory by Areas" },
      "📦 STOCK FÍSICO TOTAL": { ko: "📦 총 실물 재고", en: "📦 TOTAL PHYSICAL STOCK" },
      "📦 Todo el Inventario Actual con Existencia > 0": { ko: "📦 재고 수량 0 초과 전체 품목", en: "📦 All Current Inventory with Qty > 0" },
      "📷 Escaneando Código QR": { ko: "📷 QR 코드 스캔 중", en: "📷 Scanning QR Code" },
      "🔄 Retornable de Cliente (Tote/KLT)": { ko: "🔄 고객사 회수용 전용 용기 (Tote/KLT)", en: "🔄 Customer Returnable (Tote/KLT)" },
      "🔄 RETRABAJO": { ko: "🔄 재작업 진행", en: "🔄 REWORK" },
      "🔄 WMS Estación de Conteos Cíclicos y Auditoría IRA": { ko: "🔄 WMS 순환 실사 및 재고 정확도 감사", en: "🔄 WMS Cycle Counts & IRA Audit Station" },
      "🔍 Buscar carro (ej: CARRO-05)...": { ko: "🔍 대차 번호 검색 (예: CARRO-05)...", en: "🔍 Search cart (e.g.: CART-05)..." },
      "🔍 Buscar código, nombre o cliente...": { ko: "🔍 코드, 명칭 또는 고객사 검색...", en: "🔍 Search code, name or customer..." },
      "🔍 Buscar código, nombre, cliente, proyecto o número de parte...": { ko: "🔍 코드, 명칭, 고객사, 프로젝트 또는 품번 검색...", en: "🔍 Search code, name, customer, project or part number..." },
      "🔍 Buscar código, nombre, contacto o correo...": { ko: "🔍 코드, 업체명, 담당자 또는 이메일 검색...", en: "🔍 Search code, name, contact or email..." },
      "🔍 Buscar código, nombre, planta o contacto...": { ko: "🔍 코드, 고객사명, 공장 또는 담당자 검색...", en: "🔍 Search code, name, plant or contact..." },
      "🔍 Buscar material o grado...": { ko: "🔍 자재 또는 레진 그레이드 검색...", en: "🔍 Search material or grade..." },
      "🔍 Buscar N° Parte / Descripción": { ko: "🔍 품번 / 품명 검색", en: "🔍 Search P/N / Description" },
      "🔍 Buscar N° parte, nombre, grado de resina o proveedor...": { ko: "🔍 품번, 품명, 레진 그레이드 또는 협력사 검색...", en: "🔍 Search part number, name, resin grade or vendor..." },
      "🔍 Buscar Parte / Desc.": { ko: "🔍 품번 / 품명 검색", en: "🔍 Search Part / Desc." },
      "🔍 Buscar por folio, proveedor o estatus...": { ko: "전표 번호, 협력사 또는 상태 검색...", en: "Search by folio, vendor or status..." },
      "🔍 Buscar por recibo, OC, remisión o N.P....": { ko: "입고 번호, 발주 번호, 납품서 또는 품번 검색...", en: "Search by receipt, PO, invoice or P/N..." },
      "🔍 Filtrar tabla por NP, nombre, cliente o proyecto...": { ko: "🔍 품번, 품명, 고객사 또는 프로젝트 검색...", en: "🔍 Filter by P/N, name, customer or project..." },
      "🔍 N° Parte / Descripción / Lote": { ko: "🔍 품번 / 품명 / 로트 검색", en: "🔍 P/N / Description / Lot" },
      "🔍 WMS Buscador QR, FIFO y Control de Stock": { ko: "🔍 WMS QR 검색, 선입선출 및 재고 통제", en: "🔍 WMS QR Finder, FIFO & Stock Control" },
      "🔒 TRAZABILIDAD Y RETENCIÓN": { ko: "🔒 이력 추적 및 보존 연한", en: "🔒 TRACEABILITY & RETENTION" },
      "🔢 Lote (YYYYMMDD) *": { ko: "🔢 로트 번호 (YYYYMMDD) *", en: "🔢 Lot (YYYYMMDD) *" },
      "🔤 Pieza Individual (Normal)": { ko: "🔤 개별 부품 이동 (일반)", en: "🔤 Single Piece (Normal)" },
      "🔧 SMED Montaje": { ko: "🔧 SMED 금형 교체", en: "🔧 SMED Setup" },
      "🔴 Dado de Baja / Dañado": { ko: "🔴 폐기 / 파손 불능", en: "🔴 Decommissioned / Damaged" },
      "🔴 Dados de Baja / Chatarra": { ko: "🔴 폐기 처분 / 고철", en: "🔴 Scrapped / Decommissioned" },
      "🔴 Solo Dados de Baja": { ko: "🔴 폐기 처분된 항목만", en: "🔴 Decommissioned Only" },
      "🔴 Todos los Materiales Vencidos / Toca Contar Hoy": { ko: "🔴 실사 기한 도래 / 오늘 실사 대상 전체", en: "🔴 All Overdue Materials / Due Today" },
      "🔴 VENCIDOS / CONTAR HOY": { ko: "🔴 실사 기한 도래 / 오늘 실사", en: "🔴 OVERDUE / COUNT TODAY" },
      "🔴 Vencidos / Toca Contar Hoy": { ko: "🔴 실사 기한 도래 / 오늘 실사", en: "🔴 Overdue / Count Today" },
      "🔵 ASIGNADO A EMBARQUE": { ko: "🔵 출하 배정 완료", en: "🔵 ASSIGNED TO SHIPMENT" },
      "🔵 ASIGNADO EMBARQUE": { ko: "🔵 출하 배정", en: "🔵 ASSIGNED SHIPMENT" },
      "🗑️ SCRAP": { ko: "🗑️ 폐기 불량 (스크랩)", en: "🗑️ SCRAP" },
      "🗓️ Calendario de carga por máquina": { ko: "🗓️ 설비별 부하 캘린더", en: "🗓️ Machine Load Calendar" },
      "🗓️ Calendario de Máquinas": { ko: "🗓️ 사출기 가동 일정 캘린더", en: "🗓️ Machine Calendar" },
      "🙈 Hoja de Conteo CIEGO (Oculta la cantidad del sistema para el contador)": { ko: "🙈 블라인드 실사 시트 (실사자에게 전산 수량을 숨김)", en: "🙈 BLIND Count Sheet (Hides system quantity from counter)" },
      "🚫 Catálogo de Defectos": { ko: "🚫 불량 유형 카탈로그", en: "🚫 Defects Catalog" },
      "🛒 Auditar un Carrito Móvil Completo": { ko: "🛒 이동식 대차 전체 실사", en: "🛒 Audit Full Mobile Cart" },
      "🛒 Carrito / Contenedor (Opcional)": { ko: "🛒 대차 / 용기 (선택사항)", en: "🛒 Cart / Container (Optional)" },
      "🛒 Carro Interno (Flota de 107)": { ko: "🛒 사내 전용 대차 (107대 플릿)", en: "🛒 Internal Cart (107 Fleet)" },
      "🛒 Contenedor / Carrito DESTINO": { ko: "🛒 도착 대차 / 용기", en: "🛒 DESTINATION Container / Cart" },
      "🛒 Contenedor / Carrito DESTINO *": { ko: "🛒 도착 대차 / 용기 *", en: "🛒 DESTINATION Container / Cart *" },
      "🛒 Contenedor / Carrito ORIGEN": { ko: "🛒 출발 대차 / 용기", en: "🛒 ORIGIN Container / Cart" },
      "🛒 Contenedor Móvil (Carrito / Palet)": { ko: "🛒 이동식 용기 (카트 / 파렛트)", en: "🛒 Mobile Container (Cart / Pallet)" },
      "🛒 Mover Carrito Completo": { ko: "🛒 대차 전체 이동", en: "🛒 Move Full Cart" },
      "🛒 Mover Carrito Completo (Todas sus piezas)": { ko: "🛒 대차 전체 일괄 이동 (적재 부품 전체)", en: "🛒 Move Full Cart (All pieces)" },
      "🛡️ Estatus de Stock": { ko: "🛡️ 재고 품질 상태", en: "🛡️ Stock Status" },
      "🛡️ Lista Maestra de Control Documental (SGC ISO 9001 / IATF 16949)": { ko: "🛡️ 품질 문서 관리 대장 (SGC ISO 9001 / IATF 16949)", en: "🛡️ Document Control Master List (QMS ISO 9001 / IATF 16949)" },
      "🟠 EN RETRABAJO": { ko: "🟠 재작업 진행 중", en: "🟠 IN REWORK" },
      "🟡 CUARENTENA / CALIDAD": { ko: "🟡 품질 격리 보관", en: "🟡 QUARANTINE / QUALITY" },
      "🟡 EN CUARENTENA / CALIDAD": { ko: "🟡 품질 격리 보관 중", en: "🟡 IN QUARANTINE / QUALITY" },
      "🟡 En Reparación / Taller": { ko: "🟡 보전실 수리 중", en: "🟡 Under Repair / Toolroom" },
      "🟡 En Taller / Reparación": { ko: "🟡 수리 및 정비 중", en: "🟡 In Toolroom / Repair" },
      "🟡 Solo en Reparación": { ko: "🟡 수리 중인 항목만", en: "🟡 Under Repair Only" },
      "🟢 Al Día (Vigentes)": { ko: "🟢 실사 완료 (기한 내)", en: "🟢 Up to Date (Current)" },
      "🟢 DISPONIBLE (HÁBIL)": { ko: "🟢 사용 가능 (출고 가용)", en: "🟢 AVAILABLE" },
      "🟢 HÁBIL / DISPONIBLE": { ko: "🟢 가용 / 출고 가능", en: "🟢 USABLE / AVAILABLE" },
      "🟢 Operativo (Disponible)": { ko: "🟢 가동 가능 (가용)", en: "🟢 Operational (Available)" },
      "🟢 Operativos (Disponibles)": { ko: "🟢 정상 가동 (가용)", en: "🟢 Operational (Available)" },
      "🟢 Solo Operativos": { ko: "🟢 정상 가용 항목만", en: "🟢 Operational Only" },
      "🤖 Automático (acomodar en el siguiente hueco libre)": { ko: "🤖 자동 편성 (다음 가용 공백 시간에 배치)", en: "🤖 Automatic (fit into next free slot)" },
      "🧠 Propuesta de Planeación": { ko: "🧠 지능형 생산 계획 제안", en: "🧠 Planning Proposal" }
    },
    patterns: [
      { re: '^Se guardaron (\\d+) registros?$', ko: ' 등록 완료', en: 'Saved  records' },
      { re: '^(\\d+) registros encontrados?$', ko: ' 항목 검색됨', en: ' records found' },
      { re: '^(\\d+) piezas?$', ko: '', en: ' pieces' },
      { re: '^Total:\\s*(\\d+)', ko: '합계: ', en: 'Total: ' }
    ]
  });
}



// ============================================================================
// 3. TEMA GLOBAL CLARO / OSCURO UNIFICADO PARA TODOS LOS MÓDULOS
// ============================================================================
function ensureUnifiedThemeStyles() {
    let style = document.getElementById('kraem-unified-theme-css');
    if (!style) {
        style = document.createElement('style');
        style.id = 'kraem-unified-theme-css';
        style.textContent = `
        html[data-theme="dark"] {
            color-scheme: dark;
            --bg: #020617;
            --bg-body: #020617;
            --card: #1e293b;
            --bg-card: #1e293b;
            --surface: #1e293b;
            --text: #f1f5f9;
            --text-main: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-muted: #94a3b8;
            --muted: #94a3b8;
            --border: #334155;
            --input-bg: #0f172a;
        }
        html[data-theme="dark"] body {
            background-color: #020617 !important;
            color: #f1f5f9 !important;
        }
        html[data-theme="dark"] [data-kraem-dark-surface="1"],
        html[data-theme="dark"] .card,
        html[data-theme="dark"] .main-card,
        html[data-theme="dark"] .metric-card,
        html[data-theme="dark"] .catalog-card,
        html[data-theme="dark"] .panel,
        html[data-theme="dark"] .kpi-card,
        html[data-theme="dark"] .stat-card,
        html[data-theme="dark"] .module-card,
        html[data-theme="dark"] .modal-content,
        html[data-theme="dark"] .modal-box,
        html[data-theme="dark"] .table-container,
        html[data-theme="dark"] .table-wrap,
        html[data-theme="dark"] .table-wrapper,
        html[data-theme="dark"] .form-card,
        html[data-theme="dark"] .filter-bar,
        html[data-theme="dark"] .filters,
        html[data-theme="dark"] .emp-card,
        html[data-theme="dark"] .card-body,
        html[data-theme="dark"] .summary-card,
        html[data-theme="dark"] .box,
        html[data-theme="dark"] .date-picker-box,
        html[data-theme="dark"] .tabs-container,
        html[data-theme="dark"] .attendance-card,
        html[data-theme="dark"] .footer-save,
        html[data-theme="dark"] .area-chip:not(.active),
        html[data-theme="dark"] .turno-chip:not(.active),
        html[data-theme="dark"] .bg-white,
        html[data-theme="dark"] .bg-slate-50,
        html[data-theme="dark"] .bg-slate-100,
        html[data-theme="dark"] .bg-gray-50,
        html[data-theme="dark"] .bg-gray-100,
        html[data-theme="dark"] [style*="background: white"],
        html[data-theme="dark"] [style*="background: #fff"],
        html[data-theme="dark"] [style*="background:#fff"],
        html[data-theme="dark"] [style*="background-color: white"],
        html[data-theme="dark"] [style*="background-color: #fff"],
        html[data-theme="dark"] [style*="background: #f8fafc"],
        html[data-theme="dark"] [style*="background: #f1f5f9"] {
            background-color: #1e293b !important;
            color: #f1f5f9 !important;
            border-color: #334155 !important;
        }
        html[data-theme="dark"] .bg-blue-50 {
            background-color: rgba(37, 99, 235, 0.16) !important;
            border-color: rgba(59, 130, 246, 0.35) !important;
        }
        html[data-theme="dark"] .text-slate-900,
        html[data-theme="dark"] .text-slate-800,
        html[data-theme="dark"] .text-slate-700,
        html[data-theme="dark"] .text-gray-900,
        html[data-theme="dark"] .text-gray-800,
        html[data-theme="dark"] .text-gray-700 {
            color: #f1f5f9 !important;
        }
        html[data-theme="dark"] .text-slate-600,
        html[data-theme="dark"] .text-slate-500,
        html[data-theme="dark"] .text-slate-400,
        html[data-theme="dark"] .text-gray-600,
        html[data-theme="dark"] .text-gray-500,
        html[data-theme="dark"] .text-gray-400 {
            color: #94a3b8 !important;
        }
        html[data-theme="dark"] .text-blue-800,
        html[data-theme="dark"] .text-blue-700 {
            color: #93c5fd !important;
        }
        html[data-theme="dark"] .border-slate-200,
        html[data-theme="dark"] .border-slate-100,
        html[data-theme="dark"] .border-gray-200,
        html[data-theme="dark"] .border-gray-100 {
            border-color: #334155 !important;
        }
        html[data-theme="dark"] .custom-table tr:hover,
        html[data-theme="dark"] .hover\:bg-slate-50:hover {
            background-color: rgba(51, 65, 85, 0.45) !important;
        }
        html[data-theme="dark"] .topbar,
        html[data-theme="dark"] .header,
        html[data-theme="dark"] .navbar,
        html[data-theme="dark"] .btn-back,
        html[data-theme="dark"] .back-btn {
            background-color: #1e293b !important;
            color: #f1f5f9 !important;
            border-color: #334155 !important;
        }
        html[data-theme="light"] .topbar,
        html[data-theme="light"] .header,
        html[data-theme="light"] .navbar {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
        }
        html[data-theme="light"] .btn-back,
        html[data-theme="light"] .back-btn {
            background-color: #f8fafc !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
        }
        html[data-theme="dark"] h1,
        html[data-theme="dark"] h2,
        html[data-theme="dark"] h3,
        html[data-theme="dark"] h4,
        html[data-theme="dark"] label,
        html[data-theme="dark"] .catalog-title,
        html[data-theme="dark"] .section-title {
            color: #f1f5f9;
        }
        html[data-theme="dark"] table {
            color: #f1f5f9;
            background-color: #1e293b !important;
        }
        html[data-theme="dark"] th {
            background-color: #0f172a !important;
            color: #cbd5e1 !important;
            border-color: #334155 !important;
        }
        html[data-theme="dark"] td {
            border-color: #334155 !important;
            color: #e2e8f0 !important;
        }
        html[data-theme="dark"] tr:hover td {
            background-color: rgba(51, 65, 85, 0.35) !important;
        }
        html[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]),
        html[data-theme="dark"] select,
        html[data-theme="dark"] textarea {
            background-color: #0f172a !important;
            color: #f1f5f9 !important;
            border-color: #334155 !important;
        }
        html[data-theme="dark"] .btn-status:not(.active-P):not(.active-R):not(.active-F) {
            background-color: #0f172a !important;
            color: #e2e8f0 !important;
            border-color: #475569 !important;
        }
        html[data-theme="dark"] .tab.active {
            background-color: rgba(37, 99, 235, 0.18) !important;
            color: #93c5fd !important;
        }
        html[data-theme="dark"] .card-saved {
            background-color: rgba(34, 197, 94, 0.12) !important;
        }
        html[data-theme="dark"] .card-extra {
            background-color: rgba(124, 58, 237, 0.14) !important;
        }
        html[data-theme="dark"] .icon-box {
            background-color: rgba(37, 99, 235, 0.16) !important;
        }
    `;
    }
    const targetHead = document.head || document.documentElement;
    if (targetHead && style.parentNode !== targetHead) {
        targetHead.appendChild(style);
    } else if (document.head && document.head.lastElementChild !== style) {
        document.head.appendChild(style);
    }
}

function normalizeDarkSurfaces() {
    if (!document.body) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (!isDark) {
        document.querySelectorAll('[data-kraem-dark-surface]').forEach(el => el.removeAttribute('data-kraem-dark-surface'));
        return;
    }
    const candidates = document.body.querySelectorAll('div, section, article, main, aside, header, nav, table, thead, tbody, tr, td, ul, form, fieldset, a, button');
    candidates.forEach(el => {
        if (el.hasAttribute('data-kraem-dark-surface')) return;
        if (el.classList.contains('btn-status') || el.classList.contains('active') || el.classList.contains('active-P') || el.classList.contains('active-R') || el.classList.contains('active-F')) return;
        const bg = window.getComputedStyle(el).backgroundColor;
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return;
        const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
        const a = m[4] !== undefined ? Number(m[4]) : 1;
        if (a > 0.7 && r > 225 && g > 225 && b > 225) {
            el.setAttribute('data-kraem-dark-surface', '1');
        }
    });
}

function applyTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (document.body) document.body.setAttribute('data-theme', savedTheme);
    ensureUnifiedThemeStyles();
    normalizeDarkSurfaces();
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    // Sincronizar bidireccionalmente con iframes hijos si existen
    try {
        const frame = document.getElementById('appWorkspaceFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'KRAEM_THEME_CHANGED', theme: savedTheme }, '*');
        }
    } catch(e) {}
}

function toggleTheme() {
    const current = document.body?.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme();
}

// Aplicar tema inmediatamente para evitar parpadeo claro al navegar
applyTheme();

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    document.documentElement.setAttribute('lang', window.KraemI18n.getLang());
    window.KraemI18n.applyCommonTextNodes();

    let domTimer = null;
    if (document.body) {
        const obs = new MutationObserver(() => {
            clearTimeout(domTimer);
            domTimer = setTimeout(() => {
                if (document.documentElement.getAttribute('data-theme') === 'dark') {
                    ensureUnifiedThemeStyles();
                    normalizeDarkSurfaces();
                }
                if (window.KraemI18n.getLang() !== 'es') {
                    window.KraemI18n.applyCommonTextNodes();
                }
            }, 120);
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }
});

document.addEventListener('kraem:langchange', () => {
    window.KraemI18n.applyCommonTextNodes();
});

window.addEventListener('storage', (ev) => {
    if (ev.key === 'theme') applyTheme();
    if (ev.key === 'lang') {
        document.documentElement.setAttribute('lang', window.KraemI18n.getLang());
        window.KraemI18n.applyCommonTextNodes();
    }
});

window.addEventListener('message', (ev) => {
    if (ev.data && ev.data.type === 'KRAEM_THEME_CHANGED') {
        if (ev.data.theme) {
            localStorage.setItem('theme', ev.data.theme);
            applyTheme();
        }
    }
});

// ============================================================================
// 4. MOTOR CENTRAL DE CONFIGURACIONES DEL SISTEMA (KraemSettings)
// ============================================================================
window.KraemSettings = (function () {
    const STORAGE_KEY = 'kraem_system_settings_v1';

    const DEFAULTS = {
        kpi: {
            oee_target_pct: 85,
            oee_perf_default_pct: 92,
            oee_avail_fallback_pct: 88,
            plan_target_pct: 95,
            ira_target_pct: 98,
            pareto_cutoff_pct: 80
        },
        wms: {
            abc_days_a: 30,
            abc_days_b: 90,
            abc_days_c: 180,
            ira_tolerance_qty: 0,
            motivos_ajuste: [
                'Diferencia en Conteo Físico / Cíclico',
                'Discrepancia en BOM (Estructura)',
                'Pieza Dañada / Scrap no declarado',
                'Merma en maniobra de almacén'
            ],
            motivos_reversa: [
                'Error de digitación en cantidad de piezas',
                'Número de Parte escaneado por error',
                'Carro o Hilera equivocada',
                'Captura duplicada accidentalmente',
                'Cancelación de requerimiento / embarque'
            ],
            estatus_fifo: [
                'HÁBIL / DISPONIBLE',
                'CUARENTENA / CALIDAD',
                'EN RETRABAJO',
                'ASIGNADO A EMBARQUE'
            ]
        },
        planeacion: {
            aps_hours_per_day: 22.5,
            aps_oee_default_pct: 85,
            aps_horizon_days: 7,
            smed_default_min: 45,
            pm_alert_pct: 90,
            mrp_table_limit: 100
        },
        produccion_calidad: {
            destinos_inspeccion: ['LIBERADO', 'RETRABAJO', 'SCRAP'],
            iso_doc_prefix: 'KR-SGC-'
        },
        rh_5s: {
            meta_5s_pct: 90,
            meta_versatilidad_pct: 80,
            tallas_uniforme: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            tipos_solicitud: [
                'Vacaciones',
                'Ajuste Manual (Restar o descontar saldo)',
                'Incapacidad (Enfermedad)',
                'Incapacidad (Maternidad/Paternidad)',
                'Permiso c/Goce (Leyes/Defunción)',
                'Permiso sin Goce de Sueldo',
                'Suspensión Laboral',
                'Permiso Local (Ida y Vuelta)',
                'Permiso de Llegada Tarde',
                'Permiso de Salida Temprano'
            ],
            habilidades_base: [
                'Operación Nissei',
                'Ajuste de Parámetros',
                'Seguridad Industrial',
                'Calidad y Defectos'
            ],
            preguntas_5s: {
                estacion: [
                    ['¿Solo material necesario?', '¿Scrap identificado?', '¿Sin objetos innecesarios?', '¿Herramientas en uso?', '¿Mesa despejada?'],
                    ['¿Herramientas en su lugar?', '¿Material en su lugar?', '¿Área libre de obstáculos?', '¿Contenedores correctamente identificados?', '¿Instrucciones visibles?'],
                    ['¿Área libre de polvo?', '¿Piso limpio?', '¿Contenedores limpios?', '¿Máquina limpia?', '¿Mesa limpia?'],
                    ['¿Instrucciones actualizadas?', '¿Uso de uniforme?', '¿Etiquetas correctas?', '¿Área delimitada?', '¿Cumple estándar?'],
                    ['¿Hábito de limpieza?', '¿Sigue instrucciones?', '¿Respeta ubicación?', '¿Reporta anomalías?', '¿Conoce 5S?']
                ],
                jigs: [
                    '¿Solo Jigs de producción actual en uso? (Sin Jigs obsoletos/ajenos)',
                    '¿Jigs guardados en su ubicación asignada o soporte correcto?',
                    '¿Jigs limpios de residuos, y conectores/sensores libres de grasa/polvo?',
                    '¿Jigs identificados/etiquetados y con cables/conexiones en buen estado?',
                    '¿El operador reporta fallas en sensores de Jigs y los maneja con cuidado?'
                ],
                maquina: [
                    ['¿Área de máquina libre de refacciones viejas, moldes o mangueras sin usar?', '¿Purga de plástico retirada del área de goteo?', '¿Herramientas de cambio de molde ausentes si no está en Setup?', '¿Herramientas del operador guardadas?', '¿Sin documentos obsoletos en tablero?'],
                    ['¿Mangueras de agua/aceite ordenadas y sin riesgo de tropiezo?', '¿Contenedores de materia prima (Tolva/Alimentador) bien ubicados?', '¿Hieleras, racks de producto y tarimas alineados en su delimitación?', '¿Pistolas de aire y herramientas colgadas en su sitio?', '¿Paros de emergencia accesibles y sin obstrucción?'],
                    ['¿Piso e interior de la máquina libres de fugas de aceite o agua?', '¿Estructura, tolva y guardas libres de polvo o residuos de resina?', '¿Unidad de inyección, pistón y husillo limpios de purgas quemadas?', '¿Bandejas de goteo limpias y sin desborde?', '¿Tablero eléctrico y pantallas limpios y cerrados?'],
                    ['¿Hojas de parámetros y ayudas visuales legibles y vigentes en la máquina?', '¿Puntos de lubricación identificados y con niveles correctos?', '¿Código de colores visible en mangueras de enfriamiento?', '¿Delimitación de seguridad del perímetro de la máquina en buen estado?', '¿Checklist diario de máquina liberado por operador/mtto?'],
                    ['¿El personal limpia la máquina al terminar el turno?', '¿Se respetan los accesos de mantenimiento sin dejar obstrucciones?', '¿Se reportan y atienden fugas críticas de inmediato?', '¿Se usan los botes de basura correctos para purgas/residuos?', '¿El equipo de mtto/producción sigue el estándar de orden de la máquina?']
                ],
                supervisor: [
                    ['¿Aplica correctamente el proceso de Tarjetas Rojas en su área asignada?', '¿Gestiona el retiro de sobrantes de material al cierre de lote/turno?', '¿Mantiene tableros técnicos y de KPI sin hojas viejas o no vigentes?', '¿Asegura que no haya equipo descompuesto/obsoleto acumulado en pasillos?', '¿Coordina el retorno de contenedores y tarimas vacías a su almacén?'],
                    ['¿Verifica que las líneas/estaciones tengan demarcación de piso completa?', '¿Asegura que el herramental y Jigs tengan un lugar asignado y etiquetado?', '¿Garantiza que el material en proceso (WIP) esté en áreas autorizadas?', '¿Valida el orden y fácil acceso a los equipos de seguridad (EPP/Extintores)?', '¿Mantiene el escritorio/mesa de supervisión ordenada y sin exceso de papel?'],
                    ['¿Programa y supervisa rutinas de limpieza profunda en sus líneas?', '¿Asegura que el personal cuente con insumos de limpieza adecuados?', '¿Da seguimiento al reporte y reparación de fugas de aire, agua o aceite?', '¿Verifica la limpieza de contenedores y racks antes de enviar a empaque?', '¿Promueve el hábito de limpiar durante y al final del turno con su equipo?'],
                    ['¿Realiza y registra sus auditorías capas (LPA/5S) en tiempo y forma?', '¿Asegura que las ayudas visuales y hojas de instrucción estén publicadas?', '¿Verifica el uso correcto y completo de EPP del personal a su cargo?', '¿Mantiene al día la matriz de habilidades y estandarización del área?', '¿Asegura que las desviaciones detectadas tengan responsable y fecha límite?'],
                    ['¿Retroalimenta a su personal cuando detecta incumplimientos de 5S?', '¿Participa activamente en recorridos de seguimiento y juntas de hallazgos?', '¿Aplica disciplina operativa de forma justa y constante en su turno?', '¿Reconoce y motiva a las estaciones o equipos con mejor desempeño 5S?', '¿Demuestra compromiso personal manteniendo el ejemplo en su área y conducta?']
                ]
            }
        },
        seguridad: {
            high_rank_roles: ['ADMIN', 'SUPERADMIN', 'GERENCIA'],
            role_matrix: {
                ADMIN: { dashboard:{view:true,edit:true}, ingenieria:{view:true,edit:true}, planeacion:{view:true,edit:true}, calidad:{view:true,edit:true}, wms:{view:true,edit:true}, produccion:{view:true,edit:true}, rh_5s:{view:true,edit:true}, rh_asistencia:{view:true,edit:true}, rh_solicitudes:{view:true,edit:true}, rh_capacitacion:{view:true,edit:true}, rh_prenomina:{view:true,edit:true}, rh_personal:{view:true,edit:true}, configuracion:{view:true,edit:true} },
                GERENCIA: { dashboard:{view:true,edit:true}, ingenieria:{view:true,edit:true}, planeacion:{view:true,edit:true}, calidad:{view:true,edit:true}, wms:{view:true,edit:true}, produccion:{view:true,edit:true}, rh_5s:{view:true,edit:true}, rh_asistencia:{view:true,edit:true}, rh_solicitudes:{view:true,edit:true}, rh_capacitacion:{view:true,edit:true}, rh_prenomina:{view:true,edit:true}, rh_personal:{view:true,edit:true}, configuracion:{view:true,edit:true} },
                RH: { dashboard:{view:true,edit:false}, ingenieria:{view:false,edit:false}, planeacion:{view:false,edit:false}, calidad:{view:false,edit:false}, wms:{view:false,edit:false}, produccion:{view:false,edit:false}, rh_5s:{view:true,edit:true}, rh_asistencia:{view:true,edit:true}, rh_solicitudes:{view:true,edit:true}, rh_capacitacion:{view:true,edit:true}, rh_prenomina:{view:true,edit:true}, rh_personal:{view:true,edit:true}, configuracion:{view:false,edit:false} },
                SUPERVISOR: { dashboard:{view:true,edit:false}, ingenieria:{view:true,edit:false}, planeacion:{view:true,edit:true}, calidad:{view:true,edit:true}, wms:{view:true,edit:true}, produccion:{view:true,edit:true}, rh_5s:{view:true,edit:true}, rh_asistencia:{view:true,edit:true}, rh_solicitudes:{view:true,edit:true}, rh_capacitacion:{view:true,edit:true}, rh_prenomina:{view:false,edit:false}, rh_personal:{view:true,edit:false}, configuracion:{view:false,edit:false} },
                LIDER: { dashboard:{view:true,edit:false}, ingenieria:{view:false,edit:false}, planeacion:{view:false,edit:false}, calidad:{view:true,edit:true}, wms:{view:false,edit:false}, produccion:{view:true,edit:true}, rh_5s:{view:true,edit:true}, rh_asistencia:{view:true,edit:true}, rh_solicitudes:{view:true,edit:true}, rh_capacitacion:{view:true,edit:false}, rh_prenomina:{view:false,edit:false}, rh_personal:{view:true,edit:false}, configuracion:{view:false,edit:false} },
                CALIDAD: { dashboard:{view:true,edit:false}, ingenieria:{view:true,edit:false}, planeacion:{view:false,edit:false}, calidad:{view:true,edit:true}, wms:{view:true,edit:false}, produccion:{view:true,edit:false}, rh_5s:{view:true,edit:true}, rh_asistencia:{view:false,edit:false}, rh_solicitudes:{view:false,edit:false}, rh_capacitacion:{view:false,edit:false}, rh_prenomina:{view:false,edit:false}, rh_personal:{view:false,edit:false}, configuracion:{view:false,edit:false} },
                PLANEACION: { dashboard:{view:true,edit:false}, ingenieria:{view:true,edit:false}, planeacion:{view:true,edit:true}, calidad:{view:false,edit:false}, wms:{view:true,edit:false}, produccion:{view:true,edit:false}, rh_5s:{view:false,edit:false}, rh_asistencia:{view:false,edit:false}, rh_solicitudes:{view:false,edit:false}, rh_capacitacion:{view:false,edit:false}, rh_prenomina:{view:false,edit:false}, rh_personal:{view:false,edit:false}, configuracion:{view:false,edit:false} },
                ALMACEN: { dashboard:{view:true,edit:false}, ingenieria:{view:false,edit:false}, planeacion:{view:false,edit:false}, calidad:{view:false,edit:false}, wms:{view:true,edit:true}, produccion:{view:false,edit:false}, rh_5s:{view:false,edit:false}, rh_asistencia:{view:false,edit:false}, rh_solicitudes:{view:false,edit:false}, rh_capacitacion:{view:false,edit:false}, rh_prenomina:{view:false,edit:false}, rh_personal:{view:false,edit:false}, configuracion:{view:false,edit:false} },
                OPERADOR: { dashboard:{view:true,edit:false}, ingenieria:{view:false,edit:false}, planeacion:{view:false,edit:false}, calidad:{view:true,edit:true}, wms:{view:false,edit:false}, produccion:{view:true,edit:true}, rh_5s:{view:false,edit:false}, rh_asistencia:{view:false,edit:false}, rh_solicitudes:{view:false,edit:false}, rh_capacitacion:{view:false,edit:false}, rh_prenomina:{view:false,edit:false}, rh_personal:{view:false,edit:false}, configuracion:{view:false,edit:false} }
            }
        },
        general: {
            empresa_nombre: 'KRAEM DE MÉXICO',
            default_lang: 'es',
            formato_fecha: 'YYYY-MM-DD'
        }
    };

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function mergeDefaults(saved) {
        const merged = deepClone(DEFAULTS);
        if (!saved || typeof saved !== 'object') return merged;
        Object.keys(merged).forEach(cat => {
            if (saved[cat] && typeof saved[cat] === 'object') {
                merged[cat] = Object.assign({}, merged[cat], saved[cat]);
            }
        });
        if (saved.seguridad && saved.seguridad.role_matrix) {
            const defMatrix = DEFAULTS.seguridad.role_matrix;
            const resMatrix = deepClone(defMatrix);
            Object.keys(saved.seguridad.role_matrix).forEach(role => {
                const sRole = saved.seguridad.role_matrix[role] || {};
                const base = defMatrix[role] ? deepClone(defMatrix[role]) : {};
                Object.keys(sRole).forEach(k => {
                    if (k !== 'rh') base[k] = sRole[k];
                });
                resMatrix[role] = base;
            });
            merged.seguridad.role_matrix = resMatrix;
        }
        return merged;
    }

    let cache = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        cache = mergeDefaults(raw ? JSON.parse(raw) : null);
    } catch (_) {
        cache = deepClone(DEFAULTS);
    }

    let cloudAvailable = null;

    async function load() {
        if (!client) return cache;
        try {
            const { data, error } = await client.from('system_settings').select('key, value');
            if (!error && Array.isArray(data)) {
                cloudAvailable = true;
                const map = {};
                data.forEach(row => { if (row && row.key) map[row.key] = row.value; });
                cache = mergeDefaults(map);
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch (_) {}
            } else if (error) {
                cloudAvailable = false;
            }
        } catch (_) {
            cloudAvailable = false;
        }
        document.dispatchEvent(new CustomEvent('kraem:settingsready', { detail: cache }));
        return cache;
    }

    function getCategory(category) {
        return deepClone(cache[category] || DEFAULTS[category] || {});
    }

    function get(category, key, fallback) {
        const cat = cache[category] || DEFAULTS[category];
        if (cat && cat[key] !== undefined && cat[key] !== null) return cat[key];
        const defCat = DEFAULTS[category];
        if (defCat && defCat[key] !== undefined) return defCat[key];
        return fallback;
    }

    async function saveCategory(category, obj) {
        const nextCat = Object.assign({}, DEFAULTS[category] || {}, obj || {});
        cache[category] = nextCat;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch (_) {}

        let cloudSaved = false;
        let errorMsg = null;
        if (client) {
            try {
                const email = window.KraemAuth && window.KraemAuth.user ? window.KraemAuth.user.email : 'system';
                const { error } = await client.from('system_settings').upsert({
                    key: category,
                    category: category,
                    value: nextCat,
                    updated_by: email,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
                if (!error) {
                    cloudSaved = true;
                    cloudAvailable = true;
                } else {
                    cloudAvailable = false;
                    errorMsg = error.message;
                }
            } catch (err) {
                cloudAvailable = false;
                errorMsg = err.message;
            }
        }
        document.dispatchEvent(new CustomEvent('kraem:settingsready', { detail: cache }));
        return { ok: true, cloudSaved, error: errorMsg };
    }

    async function resetCategory(category) {
        return saveCategory(category, deepClone(DEFAULTS[category] || {}));
    }

    return {
        DEFAULTS,
        get,
        getCategory,
        saveCategory,
        resetCategory,
        load,
        isCloudAvailable: () => cloudAvailable,
        exportAll: () => deepClone(cache),
        importAll: async (obj) => {
            const cats = Object.keys(DEFAULTS);
            let lastRes = { ok: true, cloudSaved: true };
            for (const c of cats) {
                if (obj && obj[c]) {
                    lastRes = await saveCategory(c, obj[c]);
                }
            }
            return lastRes;
        }
    };
})();
