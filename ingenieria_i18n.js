// ingenieria_i18n.js - Traductor automático ES / KO / EN para las 16 pantallas de Ingeniería
// Lee el idioma configurado en Dashboard (localStorage 'lang') vía KraemI18n.
(function () {
  const DICT = {
    // --- HUB CATÁLOGOS INGENIERÍA ---
    'Catálogos Ingeniería': { ko: '엔지니어링 카탈로그', en: 'Engineering Catalogs' },
    'Administración maestra del sistema KRAEM': { ko: 'KRAEM 시스템 마스터 기준정보 관리', en: 'KRAEM Master Data Administration' },
    'Estructura Organizacional': { ko: '조직 및 구역 구조', en: 'Organizational Structure' },
    'Áreas Generales': { ko: '대분류 구역', en: 'General Areas' },
    'Macro áreas principales como LS, Nissei, HDL, Calidad y Almacén.': { ko: 'LS, Nissei, HDL, 품질, 창고 등 주요 대분류 구역.', en: 'Macro areas such as LS, Nissei, HDL, Quality and Warehouse.' },
    'Áreas': { ko: '세부 구역', en: 'Areas' },
    'Subáreas operativas relacionadas a las áreas generales.': { ko: '대분류 구역에 연결된 세부 운영 구역.', en: 'Operational sub-areas linked to general areas.' },
    'Ubicaciones': { ko: '로케이션 (위치)', en: 'Locations' },
    'Locaciones físicas, WIP, embarques, inspección y almacenes.': { ko: '실물 위치, WIP, 출하, 검사 및 창고 로케이션.', en: 'Physical locations, WIP, shipping, inspection & warehouses.' },
    'Producción': { ko: '생산 기준정보', en: 'Production' },
    'Máquinas': { ko: '설비 (사출기)', en: 'Machines' },
    'Administración de inyectoras, airbag, verticales, gas y equipos.': { ko: '사출기, 에어백, 수직기 및 부대 설비 관리.', en: 'Injection presses, airbag, vertical, gas & equipment.' },
    'Moldes': { ko: '금형 마스터', en: 'Molds' },
    'Control maestro de moldes, cavidades y relaciones productivas.': { ko: '금형, 캐비티 및 부품/설비 연결 관리.', en: 'Master mold control, cavities & production links.' },
    'Procesos': { ko: '공정 (라우팅)', en: 'Processes' },
    'Configuración de procesos productivos y operaciones estándar.': { ko: '생산 공정 및 표준 작업 순서 설정.', en: 'Production processes and standard routings.' },
    'Calidad': { ko: '품질 기준정보', en: 'Quality' },
    'Defectos': { ko: '불량 유형', en: 'Defects' },
    'Catálogo maestro de defectos de calidad y clasificaciones.': { ko: '품질 불량 유형 및 스크랩/재작업 분류.', en: 'Master quality defects & classifications.' },
    'Checklists': { ko: '체크리스트', en: 'Checklists' },
    'Configuración de checklists de auditoría, setups y validaciones.': { ko: '감사, 금형 교체(SMED) 및 검증 체크리스트.', en: 'Audit, SMED setup & validation checklists.' },
    'Inventario y Materiales': { ko: '자재 및 포장 기준정보', en: 'Inventory & Materials' },
    'Materiales': { ko: '원자재 / 레진', en: 'Materials' },
    'Resinas, insertos, etiquetas y materiales consumibles.': { ko: '레진, 인서트, 라벨 및 소모성 자재.', en: 'Resins, inserts, labels & consumables.' },
    'Empaques y Cajas': { ko: '포장 및 대차 관리', en: 'Packaging & Carts' },
    'Carros (107), cajas retornables de cliente, macrobins y empaque alternativo.': { ko: '대차(107), 고객 리턴 박스, 매크로빈 및 대체 포장.', en: 'Carts (107), returnable totes, macrobins & alternate packs.' },
    'Números de Parte': { ko: '품번 마스터 (N/P)', en: 'Part Numbers' },
    'Catálogo maestro de números de parte y relaciones productivas.': { ko: '품번 마스터 카탈로그 및 생산 사양.', en: 'Master part number catalog & production links.' },
    'Clientes y Comercial': { ko: '고객 및 영업', en: 'Customers & Sales' },
    'Clientes': { ko: '고객사 관리', en: 'Customers' },
    'Administración de clientes, plantas y contactos principales.': { ko: '고객사, 공장 및 주요 담당자 관리.', en: 'Customer, plant & contact administration.' },

    // --- CATÁLOGOS COMUNES / ÁREAS / UBICACIONES / DEFECTOS ---
    'Catálogo Áreas Generales': { ko: '대분류 구역 카탈로그', en: 'General Areas Catalog' },
    'Nueva Área General': { ko: '신규 대분류 구역', en: 'New General Area' },
    'Editar Área General': { ko: '대분류 구역 수정', en: 'Edit General Area' },
    'Administración de Áreas': { ko: '세부 구역 관리', en: 'Area Management' },
    'Área General': { ko: '대분류 구역', en: 'General Area' },
    'Código de Área': { ko: '구역 코드', en: 'Area Code' },
    'Nombre de Área': { ko: '구역명', en: 'Area Name' },
    'Guardar Área': { ko: '구역 저장', en: 'Save Area' },
    'Actualizar Área': { ko: '구역 업데이트', en: 'Update Area' },
    'Catálogo de Ubicaciones': { ko: '로케이션 카탈로그', en: 'Locations Catalog' },
    'Guardar Ubicación': { ko: '로케이션 저장', en: 'Save Location' },
    'Actualizar Ubicación': { ko: '로케이션 업데이트', en: 'Update Location' },
    'Código Ubicación': { ko: '로케이션 코드', en: 'Location Code' },
    'Nombre Ubicación': { ko: '로케이션명', en: 'Location Name' },
    'Tipo': { ko: '유형', en: 'Type' },
    'Fijo': { ko: '고정 위치', en: 'Fixed' },
    'Móvil': { ko: '이동 대차', en: 'Mobile' },
    '🚫 Catálogo de Defectos': { ko: '🚫 불량 유형 카탈로그', en: '🚫 Defects Catalog' },
    'Catálogo de Defectos': { ko: '불량 유형 카탈로그', en: 'Defects Catalog' },
    'Nuevo Tipo de Defecto': { ko: '신규 불량 유형', en: 'New Defect Type' },
    'Destino Sugerido': { ko: '권장 처리', en: 'Suggested Disposition' },
    'AGREGAR AL CATÁLOGO': { ko: '카탈로그에 추가', en: 'ADD TO CATALOG' },
    'Defecto': { ko: '불량명', en: 'Defect' },
    'Destino': { ko: '처리 구분', en: 'Disposition' },
    'Cargando catálogo...': { ko: '카탈로그 불러오는 중...', en: 'Loading catalog...' },
    'No hay defectos registrados.': { ko: '등록된 불량이 없습니다.', en: 'No defects registered.' },

    // --- MÁQUINAS ---
    'Catálogo de Máquinas': { ko: '설비 (사출기) 카탈로그', en: 'Machines Catalog' },
    'Código Máquina': { ko: '설비 코드', en: 'Machine Code' },
    'Nombre Máquina': { ko: '설비명', en: 'Machine Name' },
    'Tonelaje': { ko: '형체력 (톤)', en: 'Tonnage' },
    'Meta OEE (%)': { ko: '목표 OEE (%)', en: 'OEE Target (%)' },
    'Turnos / OEE': { ko: '교대 / OEE', en: 'Shifts / OEE' },
    'Guardar Máquina': { ko: '설비 저장', en: 'Save Machine' },

    // --- MOLDES ---
    'Matriz Maestra de Moldes': { ko: '금형 마스터 매트릭스', en: 'Master Mold Matrix' },
    'Maestro de Moldes': { ko: '금형 마스터', en: 'Mold Master' },
    'Nuevo Molde': { ko: '신규 금형', en: 'New Mold' },
    'Total Moldes Activos': { ko: '활성 금형 수', en: 'Active Molds' },
    'Montados en Prensa': { ko: '설비 장착 중', en: 'Mounted on Press' },
    'En Taller / Bloqueados': { ko: '수리실 / 대기', en: 'Toolroom / Blocked' },
    'Alerta PM (≥90% disparos)': { ko: 'PM 점검 경고 (≥90%)', en: 'PM Alert (≥90% shots)' },
    'Cavidades': { ko: '캐비티', en: 'Cavities' },
    'Setup (min)': { ko: '교체시간 (분)', en: 'Setup (min)' },
    'Partes': { ko: '품번', en: 'Parts' },
    'No hay moldes con los filtros actuales.': { ko: '조건에 맞는 금형이 없습니다.', en: 'No molds match current filters.' },

    // --- CLIENTES / CHECKLISTS / PROCESOS / MATERIALES / EMPAQUES ---
    'Catálogo de Clientes': { ko: '고객사 카탈로그', en: 'Customer Catalog' },
    'Nuevo Cliente': { ko: '신규 고객사', en: 'New Customer' },
    'Clientes Registrados': { ko: '등록된 고객사', en: 'Registered Customers' },
    'Sin clientes registrados.': { ko: '등록된 고객사가 없습니다.', en: 'No customers registered.' },
    'Planta': { ko: '공장', en: 'Plant' },
    'Contacto': { ko: '담당자', en: 'Contact' },
    'Teléfono / Email': { ko: '연락처 / 이메일', en: 'Phone / Email' },
    'Tránsito': { ko: '운송일수', en: 'Transit' },
    'Catálogo de Checklists': { ko: '체크리스트 카탈로그', en: 'Checklists Catalog' },
    'Nuevo Checklist': { ko: '신규 체크리스트', en: 'New Checklist' },
    'Sin checklists registrados.': { ko: '등록된 체크리스트가 없습니다.', en: 'No checklists registered.' },
    'Selecciona un checklist': { ko: '체크리스트를 선택하세요', en: 'Select a checklist' },
    'Procesos y Hojas de Ruta': { ko: '공정 및 라우팅', en: 'Processes & Routings' },
    'Catálogo de Materiales (MRP)': { ko: '원자재 카탈로그 (MRP)', en: 'Materials Catalog (MRP)' },
    'Parámetros MRP / WMS': { ko: 'MRP / WMS 파라미터', en: 'MRP / WMS Parameters' },
    'Editar MRP': { ko: 'MRP 수정', en: 'Edit MRP' },
    'Guardar Parámetros': { ko: '파라미터 저장', en: 'Save Parameters' },
    'Sin materiales con los filtros actuales.': { ko: '조건에 맞는 자재가 없습니다.', en: 'No materials match filters.' },
    'Catálogo de Empaques, Cajas y Flota de Carros': { ko: '포장, 박스 및 대차 관리', en: 'Packaging, Boxes & Cart Fleet' },

    // --- FICHA TÉCNICA & NUEVO NP & BOM ---
    'Ficha Técnica de Ingeniería': { ko: '엔지니어링 기술 사양서', en: 'Engineering Technical Sheet' },
    'Editar Ficha Técnica / BOM': { ko: '사양서 / BOM 수정', en: 'Edit Spec / BOM' },
    'Stock Actual': { ko: '현재 재고', en: 'Current Stock' },
    'Consumo Promedio': { ko: '일평균 출고', en: 'Avg Daily Demand' },
    'Cobertura': { ko: '재고 일수', en: 'Coverage' },
    'Standard Pack': { ko: '표준 포장', en: 'Standard Pack' },
    'Volver a Catálogos': { ko: '카탈로그로 돌아가기', en: 'Back to Catalogs' }
  };

  let observer = null;
  let applying = false;

  function applyAll() {
    if (!window.KraemI18n || applying) return;
    const lang = window.KraemI18n.getLang();
    if (lang === 'es') return;
    applying = true;
    try {
      window.KraemI18n.applyCommonTextNodes(DICT);
    } finally {
      applying = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyAll();
    if (document.body && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (!applying) applyAll();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });

  document.addEventListener('kraem:langchange', () => {
    if (window.KraemI18n && window.KraemI18n.getLang() === 'es') {
      window.location.reload();
    } else {
      applyAll();
    }
  });
})();
