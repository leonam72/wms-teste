// ╔══════════════════════════════════════════════════════════════════╗
// ║  12-search-filter.js     Busca, filtros e navegação para gaveta      ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ SEARCH & FILTER STATE ══════════════════════════════════════════════
let searchScope   = 'product'; // 'product' | 'address'
let activeChips   = new Set();   // 'occupied'|'empty'|'expired'|'expiring'|'multi'|'selected'

function setScope(scope) {
  searchScope = scope;
  document.getElementById('scope-product').classList.toggle('active', scope === 'product');
  document.getElementById('scope-address').classList.toggle('active', scope === 'address');
  document.getElementById('grid-search').placeholder = scope === 'product' ? 'Código ou nome...' : 'Ex: A2  ou  A2.G3  ou  B';
  applyFilters();
}

function toggleChip(name) {
  activeChips.has(name) ? activeChips.delete(name) : activeChips.add(name);
  const el = document.getElementById('chip-' + name);
  if (el) el.classList.toggle('active', activeChips.has(name));
  applyFilters();
}

function clearSearch() {
  document.getElementById('grid-search').value = '';
  applyFilters();
}

function clearAllFilters() {
  document.getElementById('grid-search').value = '';
  activeChips.clear();
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  applyFilters();
}

function applyFilters() {
  const q    = (document.getElementById('grid-search')?.value || '').trim().toLowerCase();
  const chips = activeChips;

  let shown = 0, hidden = 0;

  document.querySelectorAll('.shelf-block').forEach(block => {
    const shelfId = block.querySelector('.shelf-block-name')?.textContent.replace('PRATELEIRA ','').trim();
    let anyVisible = false;

    block.querySelectorAll('.drawer[data-key]').forEach(dEl => {
      const key   = dEl.dataset.key;
      const prods = products[key] || [];
      const isOccupied = prods.length > 0;

      // ── address scope match ──
      let addrMatch = true;
      if (q && searchScope === 'address') {
        const qUp = q.toUpperCase();
        const parsed = parseKey(key);
        addrMatch =
          key.toUpperCase().startsWith(qUp) ||        // exact prefix  A1.G2
          (parsed && parsed.shelf === qUp) ||          // shelf only    A
          (parsed && `${parsed.shelf}${parsed.floor}` === qUp) || // shelf+floor A1
          key.toUpperCase() === qUp;                   // exact match
      }

      // ── product scope match ──
      let prodMatch = true;
      if (q && searchScope === 'product') {
        prodMatch = prods.some(p =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
        );
      }

      // ── chip filters (AND logic within incompatible groups, OR within same) ──
      let chipPass = true;

      // occupancy group: occupied / empty are mutually exclusive intent
      if (chips.has('occupied') && !chips.has('empty')   && !isOccupied) chipPass = false;
      if (chips.has('empty')    && !chips.has('occupied') && isOccupied)  chipPass = false;

      if (chips.has('expired') && chipPass) {
        const st = drawerExpiryStatus(prods);
        if (st !== 'expired') chipPass = false;
      }
      if (chips.has('expiring') && chipPass) {
        const st = drawerExpiryStatus(prods);
        if (st !== 'expiring') chipPass = false;
      }
      if (chips.has('multi') && chipPass) {
        const skus = new Set(prods.map(p => p.code));
        if (skus.size < 2) chipPass = false;
      }
      if (chips.has('selected') && chipPass) {
        if (!selectedProductCode || !prods.some(p => p.code === selectedProductCode)) chipPass = false;
      }

      const visible = addrMatch && prodMatch && chipPass;
      dEl.classList.toggle('filtered-out', !visible);
      if (visible) { anyVisible = true; shown++; } else { hidden++; }
    });

    block.classList.toggle('all-filtered', !anyVisible);
  });

  const total = shown + hidden;
  const countEl = document.getElementById('filter-result-count');
  if (countEl) {
    if (!q && chips.size === 0) {
      countEl.textContent = `${total} gavetas`;
    } else {
      countEl.textContent = `${shown} / ${total} gavetas`;
      countEl.style.color = shown === 0 ? 'var(--danger)' : shown < total ? 'var(--warn)' : 'var(--text3)';
    }
  }
}

// ——— NAVIGATE TO DRAWER ———
function navigateToDrawer(key, code) {
  // close any open modals
  ['expiry-modal','prod-detail-modal'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
  });

  // switch to depot page
  showPage('depot');

  // highlight the specific product + drawer
  if (code) selectedProductCode = code;
  setFocusedDrawer(key);
  renderAll();

  // scroll and flash the drawer
  requestAnimationFrame(() => {
    const target = document.querySelector(`.drawer[data-key="${key}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.outline = '3px solid var(--accent)';
      target.style.transition = 'none';
      setTimeout(() => {
        target.style.outline = '3px solid transparent';
        target.style.transition = 'outline .8s ease';
        setTimeout(() => { target.style.outline = ''; target.style.transition = ''; }, 900);
      }, 500);
    }
  });
}

