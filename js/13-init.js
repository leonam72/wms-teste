// ╔══════════════════════════════════════════════════════════════════╗
// ║  13-init.js              Init e renderAll                            ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— INIT ———
function init() {
  const today = new Date().toISOString().slice(0, 10);
  const gpEntry = document.getElementById('gp-entry'); if (gpEntry) gpEntry.value = today;
  renderDepotTabs();
  renderAll();
}

function renderAll() {
  // keep shims in sync with active depot
  shelves  = shelvesAll[activeDepotId]  || [];
  products = productsAll[activeDepotId] || {};
  renderShelfGrid();
  renderProductTable();
  renderShelfList();
  renderStats();
  renderAlerts();
  renderHistory();
  applyFilters();
  syncSbChips();
  if (document.getElementById('page-floorplan')?.classList.contains('active')) { renderFloorPlan(); setTimeout(() => { if(fpSearchQuery||fpSearchFilter) fpApplySearch(); }, 50); }
  // also refresh fp modal body if open
  if (fpFocusedShelf && document.getElementById('fp-shelf-modal')?.classList.contains('open')) {
    const sh = shelves.find(s => s.id === fpFocusedShelf);
    if (sh) renderFpModalBody(sh);
  }
}

function syncSbChips() {
  ['all','expired','expiring','multi','none','missing'].forEach(k => {
    const el = document.getElementById('sbf-' + k);
    if (el) el.classList.toggle('active', (k === 'all' && sbFilter === '') || k === sbFilter);
  });
}

// ——— KEY HELPERS ———
function drawerKey(shelfId, floor, drawer) {
  return `${shelfId}${floor}.G${drawer}`;
}

function parseKey(key) {
  const m = key.match(/^([A-Z]+)(\d+)\.G(\d+)$/);
  if (!m) return null;
  return { shelf: m[1], floor: parseInt(m[2]), drawer: parseInt(m[3]) };
}

