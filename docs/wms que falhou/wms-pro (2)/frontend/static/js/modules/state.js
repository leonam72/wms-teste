// ═══════════════════════════════════════════════════════════
// MODULE: state.js
// ═══════════════════════════════════════════════════════════

// ——— STATE ———
// ── Multi-depot: each depot has id, name, and its own shelves/products
let depots = [
  
];
let activeDepotId = null;

// shelves and products are now per-depot
// shelves['dep1'] = [...], products['dep1'] = {...}
let shelvesAll = {
  
};
let productsAll = {};

// Compatibility shims — shelves/products point to active depot
let shelves = [];
let products = {};

function ensureDepotState() {
  if (!Array.isArray(depots)) depots = [];
  if (!shelvesAll || typeof shelvesAll !== 'object') shelvesAll = {};
  if (!productsAll || typeof productsAll !== 'object') productsAll = {};
  normalizeDiscardDepotState();
  depots.forEach(d => {
    d.allowOvercapacity = !!d.allowOvercapacity;
    if (!Array.isArray(shelvesAll[d.id])) shelvesAll[d.id] = [];
    if (!productsAll[d.id] || typeof productsAll[d.id] !== 'object') productsAll[d.id] = {};
    shelvesAll[d.id] = shelvesAll[d.id].map(shelf => ({
      ...shelf,
      type: normalizeShelfType(shelf?.type),
    }));
  });
  if (!depots.some(d => d.id === activeDepotId)) activeDepotId = depots[0]?.id || null;
  shelves = activeDepotId ? (shelvesAll[activeDepotId] || []) : [];
  products = activeDepotId ? (productsAll[activeDepotId] || {}) : {};
  if (!Array.isArray(auditHistory)) auditHistory = [];
}

function saveAppState() {
  if (stateHydrating || syncInFlight) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    persistAppState().catch(err => console.error('Falha ao persistir estado do WMS:', err));
  }, 250);
}

async function persistAppState(force = false) {
  if ((stateHydrating || syncInFlight) && !force) return;
  syncInFlight = true;
  try {
    const response = await apiCall('/wms/inventory-state', 'PUT', {
      expected_revision: serverRevision,
      productsAll: deepClone(productsAll),
      history: deepClone(auditHistory),
    });
    if (response?.revision) serverRevision = response.revision;
    suppressAutoPersist = false;
    inventoryPersistBlockedReason = '';
  } catch (err) {
    const errMsg = String(err.message || '');
    if (errMsg.includes('Capacidade da gaveta excedida')) {
      if (inventoryPersistBlockedReason !== errMsg) {
        inventoryPersistBlockedReason = errMsg;
        showNotice({
          title: 'ESTOQUE ACIMA DA CAPACIDADE',
          icon: '⛔',
          desc: `${errMsg}. O sistema vai parar de tentar persistir automaticamente até você corrigir a lotação deste endereço.`,
        }).catch(() => {});
      }
      suppressAutoPersist = true;
      return;
    }
    if (String(err.message || '').includes('Estado desatualizado') || String(err.message || '').includes('Conflict')) {
      await showNotice({ title: 'CONFLITO DE EDIÇÃO', icon: '⛔', desc: 'Outro usuário alterou os dados antes desta gravação. O sistema vai recarregar o estado mais recente do banco.' });
      await loadAppState(false);
      renderAll();
      return;
    }
    throw err;
  } finally {
    syncInFlight = false;
  }
}

async function loadAppState(seedIfEmpty = false) {
  try {
    stateHydrating = true;
    const response = await apiCall('/wms/bootstrap');
    const data = response?.state || {};
    serverRevision = response?.revision || '0';
    const hasServerData = Array.isArray(data.depots) && data.depots.length > 0;
    if (!hasServerData) {
      depots = [];
      activeDepotId = null;
      shelvesAll = {};
      productsAll = {};
      auditHistory = [];
      outboundRecords = [];
      blindCountPool = [];
      blindCountRecords = [];
      blindUnloadDraft = null;
      activeBlindUnloadId = null;
      fpLayout = {};
      fpObjects = [];
      fpObjIdSeq = 0;
      ensureDepotState();
      stateHydrating = false;
      return false;
    }
    depots = Array.isArray(data.depots) ? data.depots : depots;
    activeDepotId = typeof data.activeDepotId === 'string' && data.activeDepotId ? data.activeDepotId : depots[0]?.id || activeDepotId;
    shelvesAll = data.shelvesAll && typeof data.shelvesAll === 'object' ? data.shelvesAll : shelvesAll;
    productsAll = data.productsAll && typeof data.productsAll === 'object' ? data.productsAll : productsAll;
    normalizeDiscardInventoryState();
    auditHistory = Array.isArray(data.history) ? data.history : auditHistory;
    outboundRecords = Array.isArray(data.outboundRecords) ? data.outboundRecords : [];
    blindCountRecords = Array.isArray(data.blindCountRecords) ? data.blindCountRecords : [];
    activeBlindUnloadId = typeof data.activeBlindUnloadId === 'string' ? data.activeBlindUnloadId : null;
    blindCountPool = [];
    blindUnloadDraft = null;
    const fp = data.floorplan || {};
    fpLayout = fp.layout || {};
    fpObjects = fp.objects || [];
    fpObjIdSeq = fp.objSeq || fpObjects.length || 0;
    ensureDepotState();
    await loadOperationalState();
    return true;
  } catch (err) {
    console.error('Falha ao carregar estado do WMS:', err);
    return null;
  } finally {
    stateHydrating = false;
  }
}

async function loadOperationalState() {
  const [inventoryResult, unloadsResult, outboundResult] = await Promise.allSettled([
    apiCall('/wms/inventory-state'),
    apiCall('/wms/unloads-state'),
    apiCall('/wms/outbound-records-state'),
  ]);
  if (inventoryResult.status === 'fulfilled') {
    const inventoryResponse = inventoryResult.value;
    productsAll = inventoryResponse?.productsAll && typeof inventoryResponse.productsAll === 'object' ? inventoryResponse.productsAll : productsAll;
    normalizeDiscardInventoryState();
    auditHistory = Array.isArray(inventoryResponse?.history) ? inventoryResponse.history : auditHistory;
  } else {
    console.error('Falha ao carregar inventário incremental do WMS:', inventoryResult.reason);
  }
  if (unloadsResult.status === 'fulfilled') {
    const unloadsResponse = unloadsResult.value;
    blindCountRecords = Array.isArray(unloadsResponse?.blindCountRecords) ? unloadsResponse.blindCountRecords : blindCountRecords;
    activeBlindUnloadId = typeof unloadsResponse?.activeBlindUnloadId === 'string' ? unloadsResponse.activeBlindUnloadId : activeBlindUnloadId;
    setActiveBlindUnload(activeBlindUnloadId);
  } else {
    console.error('Falha ao carregar descargas incrementais do WMS:', unloadsResult.reason);
  }
  if (outboundResult.status === 'fulfilled') {
    const outboundResponse = outboundResult.value;
    outboundRecords = Array.isArray(outboundResponse?.outboundRecords) ? outboundResponse.outboundRecords : outboundRecords;
  } else {
    console.error('Falha ao carregar saídas incrementais do WMS:', outboundResult.reason);
  }
  ensureDepotState();
}

async function persistBlindUnloadsState() {
  const currentBlind = getBlindCurrentDraft();
  if (currentBlind) currentBlind.poolItems = deepClone(blindCountPool);
  const response = await apiCall('/wms/unloads-state', 'PUT', {
    expected_revision: serverRevision,
    blindCountRecords: deepClone(blindCountRecords),
    activeBlindUnloadId,
  });
  if (response?.revision) serverRevision = response.revision;
}

async function persistOutboundRecordsState() {
  const response = await apiCall('/wms/outbound-records-state', 'PUT', {
    expected_revision: serverRevision,
    outboundRecords: deepClone(outboundRecords),
  });
  if (response?.revision) serverRevision = response.revision;
}

async function persistStructureState() {
  const response = await apiCall('/wms/structure-state', 'PUT', {
    expected_revision: serverRevision,
    depots: deepClone(depots),
    activeDepotId,
    shelvesAll: deepClone(shelvesAll),
  });
  if (response?.revision) serverRevision = response.revision;
}

async function persistFloorplanState() {
  const response = await apiCall('/wms/floorplan-state', 'PUT', {
    expected_revision: serverRevision,
    floorplan: {
      layout: deepClone(fpLayout),
      objects: deepClone(fpObjects),
      objSeq: fpObjIdSeq,
    },
  });
  if (response?.revision) serverRevision = response.revision;
}

function switchDepot(depotId) {
  if (!shelvesAll[depotId])  { shelvesAll[depotId]  = []; }
  if (!productsAll[depotId]) { productsAll[depotId] = {}; }
  activeDepotId = depotId;
  shelves  = shelvesAll[depotId];
  products = productsAll[depotId];
  selectedProductCode = null;
  selectedShelfId = null;
  sbFilter = '';
  renderAll(true);
  renderDepotTabs();
  persistStructureState().catch(err => console.error('Falha ao persistir troca de depósito:', err));
}


// ── Estado do módulo de recebimento ──────────────────────
let receivingSession        = null;
let receivingItems          = [];
let receivingTimerInterval  = null;
let receivingStartedAt      = null;
let receivingStep           = 1;
let receivingAvailableNfes  = [];
let receivingHistoryRecords = [];
let receivingSelectedNfe    = null;
let receivingClosePreview   = null;
