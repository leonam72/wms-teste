// ╔══════════════════════════════════════════════════════════════════╗
// ║  07-columns.js           Reordenação de colunas por drag             ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ COLUMN DRAG REORDER ══════════════════════════════════════════════
// Works on any table. After drop, calls the provided reorderFn(fromIdx, toIdx).
(function() {
  let _cdSrc = null; // { th, tableId, colIdx }

  document.addEventListener('dragstart', ev => {
    const th = ev.target.closest('th[draggable]');
    if (!th) return;
    const tr = th.parentElement;
    const ths = Array.from(tr.querySelectorAll('th'));
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
    // remove over from all, add to this
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
    const tr = th.parentElement;
    const ths = Array.from(tr.querySelectorAll('th'));
    const toIdx = ths.indexOf(th);
    const fromIdx = _cdSrc.colIdx;
    // call the right reorder handler based on table id
    const tblId = _cdSrc.tableId;
    if (tblId === 'po-table-el')   poReorderCol(fromIdx, toIdx);
    if (tblId === 'sidebar-ptable') sbReorderCol(fromIdx, toIdx);
    _cdDone();
  });

  document.addEventListener('dragend', () => _cdDone());

  function _cdDone() {
    if (_cdSrc) { _cdSrc.th.classList.remove('col-drag-src'); _cdSrc = null; }
    document.querySelectorAll('th.col-drag-over').forEach(t => t.classList.remove('col-drag-over'));
  }
})();

// ── Products page column reorder ─────────────────────────────────────
function poReorderCol(from, to) {
  const keys = Object.keys(poColumns).filter(k => poColumns[k]);
  if (from < 0 || to < 0 || from >= keys.length || to >= keys.length || from === to) return;
  // Reorder the keys in poColumns by rebuilding in new order
  const allKeys = Object.keys(poColumns);
  const visKeys = allKeys.filter(k => poColumns[k]);
  const hidKeys = allKeys.filter(k => !poColumns[k]);
  // move visKeys[from] to position to
  const moved = visKeys.splice(from, 1)[0];
  visKeys.splice(to, 0, moved);
  // rebuild poColumns preserving hidden ones at end
  const newCols = {};
  [...visKeys, ...hidKeys].forEach(k => { newCols[k] = poColumns[k]; });
  poColumns = newCols;
  // rebuild PO_COL_LABELS order doesn't matter — it's a lookup
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
  const btn  = document.getElementById('nav-' + name);
  if (page) page.classList.add('active');
  if (btn)  btn.classList.add('active');

  // hide sidebar on non-depot pages
  const sidebar = document.getElementById('sidebar');
  const sidebarVisible = name === 'depot';
  if (sidebar) sidebar.style.display = sidebarVisible ? '' : 'none';
  // also hide the resizer handle visual
  const sres = document.getElementById('sidebar-resizer');
  if (sres) sres.style.display = sidebarVisible ? '' : 'none';

  if (name === 'products')  { renderProductsPage(); poKpiFilter = ''; updatePoKpiActiveState(); }
  if (name === 'history')   renderPageHistory();
  if (name === 'depots')    renderDepotsPage();
  if (name === 'floorplan') { fpLoadLayout(); fpPopulateDepotSelect(); renderFloorPlan(); setTimeout(() => { if(fpSearchQuery||fpSearchFilter) fpApplySearch(); }, 50); }
}

