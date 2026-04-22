// ═══════════════════════════════════════════════════════════
// MODULE: drawer-ops.js
// ═══════════════════════════════════════════════════════════


// ══ SAVE DRAWER CHANGES ═══════════════════════════════════════════════
function saveDrawerChanges() {
  if (!hasPermission('entry.register')) return;
  if (!currentDrawerKey) return;
  logHistory('💾', `Gaveta salva: ${currentDrawerKey}`, `${(products[currentDrawerKey]||[]).length} produto(s)`, { depotId: activeDepotId, drawerKey: currentDrawerKey });
  const btn = document.querySelector('.modal-footer .btn[onclick="saveDrawerChanges()"]');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ SALVO!'; btn.style.color='var(--accent3)'; setTimeout(()=>{btn.textContent=orig;btn.style.color='';},1500); }
  renderAll();
}




// ══ DRAWER DRAG & DROP ════════════════════════════════════════════════
let dndSrcKey  = null;   // source drawer key
let dndSrcIdx  = null;   // product index (null = whole drawer, future)
let dndOverKey = null;
const dndGhost = () => document.getElementById('dnd-ghost');

function dndInit(drawerEl, key) {
  // Make the whole drawer div draggable
  drawerEl.setAttribute('draggable', 'true');

  drawerEl.addEventListener('dragstart', (e) => {
    dndSrcKey = key;
    drawerEl.classList.add('dnd-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
    const prods = products[key] || [];
    const ghost = dndGhost();
    if (ghost) {
      ghost.textContent = '⠿ ' + (prods.length ? prods.map(p=>p.code).join(', ') : 'vazia') + ' → ?';
      ghost.style.display = 'block';
    }
  });

  drawerEl.addEventListener('dragend', () => {
    drawerEl.classList.remove('dnd-dragging');
    if (dndGhost()) dndGhost().style.display = 'none';
    // remove all dnd-over classes
    document.querySelectorAll('.drawer.dnd-over').forEach(el => el.classList.remove('dnd-over'));
    dndSrcKey = null; dndOverKey = null;
  });

  drawerEl.addEventListener('dragover', (e) => {
    if (!dndSrcKey || dndSrcKey === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dndOverKey !== key) {
      document.querySelectorAll('.drawer.dnd-over').forEach(el => el.classList.remove('dnd-over'));
      drawerEl.classList.add('dnd-over');
      dndOverKey = key;
    }
    const ghost = dndGhost();
    if (ghost) { ghost.style.left = (e.clientX + 14) + 'px'; ghost.style.top = (e.clientY + 14) + 'px'; }
  });

  drawerEl.addEventListener('dragleave', () => {
    drawerEl.classList.remove('dnd-over');
    if (dndOverKey === key) dndOverKey = null;
  });

  drawerEl.addEventListener('drop', (e) => {
    e.preventDefault();
    drawerEl.classList.remove('dnd-over');
    if (!dndSrcKey || dndSrcKey === key) return;
    // use the move-mode flow: set mvState and open confirm
    const srcProds = products[dndSrcKey] || [];
    if (!srcProds.length) return;
    // pick first product and open move modal
    dndSrcKey_pending = dndSrcKey;
    dndDstKey_pending = key;
    openDndMoveModal();
  });
}

function dndSwapDrawers(srcKey, dstKey) {
  const srcProds = products[srcKey] || [];
  const dstProds = products[dstKey] || [];
  if (srcProds.length === 0) return; // nothing to move

  // swap entire contents
  const tmp = [...srcProds];
  products[srcKey] = [...dstProds];
  products[dstKey] = [...tmp];
  // clean up empty
  if (!products[srcKey].length) delete products[srcKey];

  logHistory('🔀', `Gavetas trocadas: ${srcKey} ↔ ${dstKey}`,
    tmp.map(p=>p.code).join(', ') + (dstProds.length ? ' | ← '+dstProds.map(p=>p.code).join(', ') : ''),
    { depotId: activeDepotId, from: srcKey, to: dstKey, drawerKey: dstKey, productCode: [...tmp.map(p=>p.code), ...dstProds.map(p=>p.code)].join(',') });

  // refresh whichever modal is currently showing
  if (document.getElementById('drawer-modal')?.classList.contains('open')) {
    renderDrawerProducts();
  }
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open') && fpFocusedShelf) {
    const depotId = fpFocusedDepotId || activeDepotId;
    const shelf = (shelvesAll[depotId] || []).find(s => s.id === fpFocusedShelf);
    if (shelf) renderFpModalBody(shelf, depotId);
  }
  renderAll();
}


// ── DnD pending move ────────────────────────────────────────────────
let dndSrcKey_pending = null;
let dndDstKey_pending = null;

function openDndMoveModal() {
  const src = dndSrcKey_pending, dst = dndDstKey_pending;
  if (!src || !dst) return;
  const srcProds = products[src] || [];
  if (!srcProds.length) { dndSrcKey_pending=null; dndDstKey_pending=null; return; }

  document.getElementById('dnd-move-from').textContent = src;
  document.getElementById('dnd-move-to').textContent   = dst;

  const list = document.getElementById('dnd-product-list');
  list.innerHTML = srcProds.map((p,i) => {
    const expiries = getExpiries(p).filter(Boolean).sort();
    const st = productExpiryStatus(p);
    const stBadge = st==='expired' ? '<span style="color:var(--danger);font-size:9px;font-weight:700">VENCIDO</span>'
                  : st==='expiring'? `<span style="color:var(--warn);font-size:9px;font-weight:700">⚠${daysUntil(nearestExpiry(p))}d</span>` : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);">
      <input type="checkbox" id="dndp-${i}" checked style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;">
      <label for="dndp-${i}" style="flex:1;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px">
        <strong style="color:#004499">${p.code}</strong> — ${p.name} ${stBadge}
        <div style="font-size:10px;color:var(--text2)">${p.kg||0}kg${p.entry?' · Entrada:'+p.entry:''}${expiries.length?' · Val:'+expiries.map(fmtDate).join(', '):''}</div>
      </label>
    </div>`;
  }).join('');

  document.getElementById('dnd-move-modal').classList.add('open');
}

async function confirmDndMove() {
  const src = dndSrcKey_pending, dst = dndDstKey_pending;
  if (!src || !dst) return;
  const srcProds = [...(products[src] || [])];
  const selected = [];
  const remaining = [];
  srcProds.forEach((p, i) => {
    const cb = document.getElementById('dndp-' + i);
    if (cb && cb.checked) selected.push(p);
    else remaining.push(p);
  });
  if (!selected.length) { closeDndMoveModal(); return; }
  const incomingKg = selected.reduce((sum, product) => sum + (parseFloat(product.kg) || 0), 0);
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: dst,
    incomingKg,
  });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  const okMove = await showConfirm({
    title: 'CONFIRMAR TRANSFERÊNCIA',
    icon: '🔀',
    desc: 'Deseja mover os produtos selecionados para a gaveta destino?',
    summary: {
      ORIGEM: src,
      DESTINO: dst,
      ITENS: String(selected.length),
      PESO: `${incomingKg.toFixed(3)} kg`,
    },
    okLabel: 'MOVER',
  });
  if (!okMove) return;

  // move selected to dest
  if (!products[dst]) products[dst] = [];
  selected.forEach(p => products[dst].push({...p}));
  products[src] = remaining;
  if (!remaining.length) delete products[src];

  logHistory('🔀', `DnD: ${selected.map(p=>p.code).join(',')}`, `${src} → ${dst}`, { depotId: activeDepotId, from: src, to: dst, drawerKey: dst, productCode: selected.map(p => p.code).join(',') });
  closeDndMoveModal();
  // refresh open modals
  if (document.getElementById('drawer-modal')?.classList.contains('open')) renderDrawerProducts();
  if (fpFocusedShelf) {
    const depotId = fpFocusedDepotId || activeDepotId;
    const sh=(shelvesAll[depotId] || []).find(s=>s.id===fpFocusedShelf);
    if(sh) renderFpModalBody(sh, depotId);
  }
  renderAll();
}

function closeDndMoveModal() {
  document.getElementById('dnd-move-modal').classList.remove('open');
  dndSrcKey_pending = null; dndDstKey_pending = null;
}

// ══ SIDEBAR RESIZE ═══════════════════════════════════════════════════
(function() {
  const MIN = 180, MAX = () => Math.floor(window.innerWidth * 0.6);
  let dragging = false, startX = 0, startW = 0;
  const sidebar  = document.getElementById('sidebar');
  const resizer  = document.getElementById('sidebar-resizer');
  if (!sidebar || !resizer) return;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW  = Math.min(Math.max(startW + delta, MIN), MAX());
    sidebar.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });

  // double-click resets to default
  resizer.addEventListener('dblclick', () => {
    sidebar.style.width = '320px';
  });
})();

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
      const depotId = dEl.dataset.depot || activeDepotId;
      const prods = getDrawerProductsForDepotView(depotId, key);
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

function startRevisionPolling() {
  if (revisionPollTimer) clearInterval(revisionPollTimer);
  revisionPollTimer = setInterval(async () => {
    if (syncInFlight || stateHydrating) return;
    try {
      const meta = await apiCall('/wms/meta');
      if (meta?.revision && meta.revision !== serverRevision) {
        await loadAppState(false);
        renderAll();
      }
    } catch (err) {
      console.error('Falha ao consultar revisão do WMS:', err);
    }
  }, 5000);
}

