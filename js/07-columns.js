// ╔══════════════════════════════════════════════════════════════════╗
// ║  07-columns.js           Drag de colunas + Navegação de páginas      ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ COLUMN DRAG REORDER ══════════════════════════════════════════════
// Works on any table. After drop, calls the right reorderFn(fromIdx, toIdx).
let _cdSrc = null; // { th, tableId, colIdx }

document.addEventListener('dragstart', ev => {
  const th = ev.target.closest('th[draggable]');
  if (!th) return;
  const ths = Array.from(th.parentElement.querySelectorAll('th'));
  _cdSrc = { th, tableId: th.closest('table')?.id, colIdx: ths.indexOf(th) };
  th.classList.add('col-drag-src');
  ev.dataTransfer.effectAllowed = 'move';
});

document.addEventListener('dragover', ev => {
  const th = ev.target.closest('th[draggable]');
  if (!th || !_cdSrc) return;
  if (th.closest('table')?.id !== _cdSrc.tableId) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
  th.closest('tr').querySelectorAll('th').forEach(t => t.classList.remove('col-drag-over'));
  if (th !== _cdSrc.th) th.classList.add('col-drag-over');
});

document.addEventListener('dragleave', ev => {
  const th = ev.target.closest('th[draggable]');
  if (th) th.classList.remove('col-drag-over');
});

document.addEventListener('drop', ev => {
  const th = ev.target.closest('th[draggable]');
  if (!th || !_cdSrc || th === _cdSrc.th) { _cdDone(); return; }
  if (th.closest('table')?.id !== _cdSrc.tableId) { _cdDone(); return; }
  ev.preventDefault();
  const ths     = Array.from(th.parentElement.querySelectorAll('th'));
  const toIdx   = ths.indexOf(th);
  const fromIdx = _cdSrc.colIdx;
  const tblId   = _cdSrc.tableId;
  if (tblId === 'po-table-el')    poReorderCol(fromIdx, toIdx);
  if (tblId === 'sidebar-ptable') sbReorderCol(fromIdx, toIdx);
  _cdDone();
});

document.addEventListener('dragend', () => _cdDone());

function _cdDone() {
  if (_cdSrc) { _cdSrc.th.classList.remove('col-drag-src'); _cdSrc = null; }
  document.querySelectorAll('th.col-drag-over').forEach(t => t.classList.remove('col-drag-over'));
}

// ── Products page column reorder ─────────────────────────────────────
function poReorderCol(from, to) {
  const allKeys = Object.keys(poColumns);
  const visKeys = allKeys.filter(k =>  poColumns[k]);
  const hidKeys = allKeys.filter(k => !poColumns[k]);
  if (from < 0 || to < 0 || from >= visKeys.length || to >= visKeys.length || from === to) return;
  const moved = visKeys.splice(from, 1)[0];
  visKeys.splice(to, 0, moved);
  const newCols = {};
  [...visKeys, ...hidKeys].forEach(k => { newCols[k] = poColumns[k]; });
  poColumns = newCols;
  renderProductsPage();
}

// ── Sidebar ptable column reorder ────────────────────────────────────
const sbColOrder = ['code', 'name', 'qty', 'status']; // mutable order

function sbReorderCol(from, to) {
  if (from < 0 || to < 0 || from >= sbColOrder.length || to >= sbColOrder.length || from === to) return;
  const moved = sbColOrder.splice(from, 1)[0];
  sbColOrder.splice(to, 0, moved);
  renderProductTable();
}

// ══ PAGE NAVIGATION ══════════════════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  const btn  = document.getElementById('nav-'  + name);
  if (page) page.classList.add('active');
  if (btn)  btn.classList.add('active');

  // sidebar só visível na página depot
  const sidebar = document.getElementById('sidebar');
  const sres    = document.getElementById('sidebar-resizer');
  const show    = name === 'depot';
  if (sidebar) sidebar.style.display = show ? '' : 'none';
  if (sres)    sres.style.display    = show ? '' : 'none';

  if (name === 'products')  { renderProductsPage(); poKpiFilter = ''; updatePoKpiActiveState(); }
  if (name === 'history')   renderPageHistory();
  if (name === 'depots')    renderDepotsPage();
  if (name === 'floorplan') {
    fpLoadLayout();
    fpPopulateDepotSelect();
    renderFloorPlan();
    setTimeout(() => { if (fpSearchQuery || fpSearchFilter) fpApplySearch(); }, 50);
  }
}
