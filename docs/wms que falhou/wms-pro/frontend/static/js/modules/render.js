// ═══════════════════════════════════════════════════════════
// MODULE: render.js
// ═══════════════════════════════════════════════════════════

// ——— INIT ———
async function init() {
  hydrateCurrentUserFromStorage();
  applyRolePermissions();
  ensurePageNavigationConsistency('depot');
  const loaded = await loadAppState(false);
  if (loaded === null) return;
  if (typeof startServerAvailabilityMonitor === 'function') {
    startServerAvailabilityMonitor({ redirectToLoginOnRecovery: true });
  }
  fpLoadLayout();
  ensureDepotState();
  qrWorkflow.depotId = activeDepotId;
  const today = new Date().toISOString().slice(0, 10);
  const gpEntry = document.getElementById('gp-entry'); if (gpEntry) gpEntry.value = today;
  const qrEntry = document.getElementById('qr-form-entry'); if (qrEntry) qrEntry.value = today;
  syncWeightFields('gp', 'qty');
  syncWeightFields('pf', 'qty');
  syncWeightFields('qr', 'qty');
  renderDepotTabs();
  renderAll();
  applyRolePermissions();
  ensurePageNavigationConsistency(getCurrentPageName());
  startRevisionPolling();
}

function renderAll(skipPersist = false) {
  // keep shims in sync with active depot
  shelves  = shelvesAll[activeDepotId]  || [];
  products = productsAll[activeDepotId] || {};
  applyRolePermissions();
  ensurePageNavigationConsistency(getCurrentPageName());
  renderDepotTabs();
  renderDepotsPage();
  renderShelfGrid();
  renderProductTable();
  renderShelfList();
  renderStats();
  renderAlerts();
  renderHistory();
  if (typeof renderProductsPage === 'function' && document.getElementById('page-products')) renderProductsPage();
  if (document.getElementById('page-unloads')?.classList.contains('active')) renderUnloadsPage();
  if (document.getElementById('page-receiving')?.classList.contains('active')) openReceivingPage();
  if (document.getElementById('page-unload-review')?.classList.contains('active')) renderUnloadReviewPage();
  if (typeof renderPageHistory === 'function' && document.getElementById('page-history-list')) renderPageHistory();
  if (typeof renderShippingRecordCount === 'function') renderShippingRecordCount();
  if (typeof renderShippingPage === 'function' && document.getElementById('page-saidas')?.classList.contains('active')) renderShippingPage();
  if (typeof renderSeparationPage === 'function' && document.getElementById('page-separation')?.classList.contains('active')) renderSeparationPage();
  if (typeof renderOutboundRecordsPage === 'function' && document.getElementById('page-outbound')?.classList.contains('active')) renderOutboundRecordsPage();
  if (typeof renderQualityPage === 'function' && document.getElementById('page-quality')) renderQualityPage();
  if (typeof renderIndicatorsPage === 'function' && document.getElementById('page-indicators')?.classList.contains('active')) renderIndicatorsPage();
  if (document.getElementById('page-settings')?.classList.contains('active')) renderSettingsPage();
  if (typeof renderQrPage === 'function' && document.getElementById('page-qr')?.classList.contains('active')) renderQrPage();
  applyFilters();
  syncSbChips();
  if (typeof fpPopulateDepotSelect === 'function') fpPopulateDepotSelect();
  if (document.getElementById('page-floorplan')?.classList.contains('active')) { renderFloorPlan(); setTimeout(() => { if(fpSearchQuery||fpSearchFilter) fpApplySearch(); }, 50); }
  // also refresh fp modal body if open
  if (fpFocusedShelf && document.getElementById('fp-shelf-modal')?.classList.contains('open')) {
    const depotId = fpFocusedDepotId || activeDepotId;
    const sh = (shelvesAll[depotId] || []).find(s => s.id === fpFocusedShelf);
    if (sh) renderFpModalBody(sh, depotId);
  }
  if (!stateHydrating && !skipPersist && !suppressAutoPersist) saveAppState();
}

function syncSbChips() {
  ['all','expired','expiring','multi','none','missing'].forEach(k => {
    const el = document.getElementById('sbf-' + k);
    if (el) el.classList.toggle('active', (k === 'all' && sbFilter === '') || k === sbFilter);
  });
}

function formatSecondsHms(totalSeconds = 0) {
  const diff = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(diff / 3600)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function drawerKey(shelfId, floor, drawer) {
  return `${shelfId}${floor}.G${drawer}`;
}

function parseKey(key) {
  const m = key.match(/^([A-Z]+)(\d+)\.G(\d+)$/);
  if (!m) return null;
  return { shelf: m[1], floor: parseInt(m[2]), drawer: parseInt(m[3]) };
}

// ——— SHELF GRID ———
function renderShelfGrid() {
  const grid = document.getElementById('shelves-grid');
  grid.innerHTML = '';
  const depotIds = getDepotViewScopeIds();
  depotIds.forEach((depotId, depotIdx) => {
    const depotShelves = shelvesAll[depotId] || [];
    const depotProducts = productsAll[depotId] || {};
    if (isDepotPageAllContext()) {
      const depotGroup = document.createElement('div');
      depotGroup.className = 'depot-scope-group';
      depotGroup.innerHTML = `<div class="depot-scope-group-title">${escapeHtml(getDepotById(depotId)?.name || depotId)}</div>`;
      grid.appendChild(depotGroup);
      depotShelves.forEach((shelf, shelfIdx) => {
        depotGroup.appendChild(buildDepotShelfBlock(depotId, depotProducts, shelf, shelfIdx + depotIdx));
      });
      return;
    }
    depotShelves.forEach((shelf, shelfIdx) => {
      grid.appendChild(buildDepotShelfBlock(depotId, depotProducts, shelf, shelfIdx));
    });
  });
}

function buildDepotShelfBlock(depotId, depotProducts, shelf, shelfIdx = 0) {
  const block = document.createElement('div');
  block.className = `shelf-block ${getShelfTypeClass(shelf.type)}`;
  let occupied = 0;
  const total = shelf.floors * shelf.drawers;
  let nExpired = 0;
  let nExpiring = 0;
  let nOk = 0;
  let nNoVal = 0;
  let nearestDays = null;
  for (let f = 1; f <= shelf.floors; f++) {
    for (let d = 1; d <= shelf.drawers; d++) {
      const prods = depotProducts[drawerKey(shelf.id, f, d)] || [];
      if (prods.length) occupied++;
      prods.forEach(p => {
        const st = productExpiryStatus(p);
        if (st === 'expired') nExpired++;
        else if (st === 'expiring') {
          nExpiring++;
          const nd = daysUntil(nearestExpiry(p));
          if (nd !== null && (nearestDays === null || nd < nearestDays)) nearestDays = nd;
        } else if (st === 'ok') nOk++;
        else nNoVal++;
      });
    }
  }
  const occPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const occCls = occPct >= 90 ? 'var(--danger)' : occPct >= 60 ? 'var(--warn)' : 'var(--accent3)';
  let statsHtml = '';
  if (nExpired) statsHtml += `<span class="shelf-stat-badge ssb-exp">⛔ ${nExpired} vencido${nExpired > 1 ? 's' : ''}</span>`;
  if (nExpiring) statsHtml += `<span class="shelf-stat-badge ssb-warn">⚠ ${nExpiring} a vencer${nearestDays !== null ? ` (${nearestDays}d)` : ''}</span>`;
  if (nOk) statsHtml += `<span class="shelf-stat-badge ssb-ok">✓ ${nOk} ok</span>`;
  if (nNoVal) statsHtml += `<span class="shelf-stat-badge ssb-noval">— ${nNoVal} sem val.</span>`;
  block.innerHTML = `
    <div class="shelf-block-header" style="align-items:center">
      <div style="flex:1;min-width:0">
        <div class="shelf-block-name">${isDepotPageAllContext() ? `${escapeHtml(getDepotById(depotId)?.name || depotId)} · ` : ''}PRATELEIRA ${escapeHtml(shelf.id)}</div>
        <div style="margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          ${buildShelfTypeBadge(shelf)}
          <span class="shelf-block-stats">${occupied}/${total} gav.</span>
          ${statsHtml}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="text-align:right">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:800;color:${occCls};line-height:1">${occPct}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--text3);margin-top:1px">ocupação</div>
        </div>
      </div>
    </div>
    <div class="floors"></div>`;
  block.ondblclick = ev => {
    if (ev.target.closest('.drawer')) return;
    if (depotId !== activeDepotId) switchDepot(depotId);
    openFpModal(shelf.id, depotId);
  };
  const floorsEl = block.querySelector('.floors');
  floorsEl.style.flexDirection = shelfIdx % 2 === 0 ? 'column-reverse' : 'column';
  for (let f = 1; f <= shelf.floors; f++) {
    const floorEl = document.createElement('div');
    floorEl.className = 'floor';
    floorEl.innerHTML = `<div class="floor-label">${escapeHtml(shelf.id)}${f}</div><div class="drawers"></div>`;
    floorsEl.appendChild(floorEl);
    const drawersEl = floorEl.querySelector('.drawers');
    for (let d = 1; d <= shelf.drawers; d++) {
      const key = drawerKey(shelf.id, f, d);
      const prods = depotProducts[key] || [];
      const isOccupied = prods.length > 0;
      const isHighlighted = selectedProductCode && prods.some(p => p.code === selectedProductCode);
      const expSt = isOccupied ? drawerExpiryStatus(prods) : 'ok';
      const totalKgDrawer = prods.reduce((sum, p) => sum + (parseFloat(p.kg) || 0), 0);
      const maxKg = shelf.maxKg || 50;
      const capPct = Math.min(100, (totalKgDrawer / maxKg) * 100);
      const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';
      const dEl = document.createElement('div');
      let cls = `drawer${isOccupied ? ' occupied' : ''}${isHighlighted ? ' highlighted' : ''}`;
      if (expSt === 'expired') cls += ' expired';
      else if (expSt === 'expiring') cls += ' expiring';
      dEl.className = cls;
      dEl.title = isDepotPageAllContext() ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key;
      if (isOccupied) {
        const shown = prods.slice(0, 2);
        const extra = prods.length - shown.length;
        const codeExpMap = {};
        prods.forEach(p => {
          const ne = nearestExpiry(p);
          if (!codeExpMap[p.code] || (ne && ne < codeExpMap[p.code])) codeExpMap[p.code] = ne;
        });
        const prodsHtml = shown.map(p => {
          const es = productExpiryStatus(p);
          const ne = nearestExpiry(p);
          const isSoonest = ne && ne === codeExpMap[p.code];
          const sameCount = prods.filter(x => x.code === p.code).length;
          const dot = es !== 'ok' ? `<span class="exp-dot ${es === 'expired' ? 'danger' : 'warn'}"></span>` : '';
          const urgencyStyle = (sameCount > 1 && isSoonest && es !== 'ok')
            ? `background:${es === 'expired' ? '#ffd6d6' : '#fff0cc'};border-radius:2px;padding:0 2px;`
            : '';
          const urgencyTitle = sameCount > 1 && isSoonest ? ' title="Validade mais próxima"' : '';
          return `<div class="drawer-prod-entry" style="flex-direction:row;align-items:center;gap:2px;${urgencyStyle}"${urgencyTitle}>${dot}<span class="drawer-prod-code">${escapeHtml(p.code)}</span><span class="drawer-prod-name" style="margin-left:2px">${escapeHtml(p.name)}</span></div>`;
        }).join('');
        dEl.innerHTML = `<div class="drawer-key">${escapeHtml(key)}</div><div class="drawer-prod-list">${prodsHtml}${extra > 0 ? `<div class="drawer-more">+${extra} mais</div>` : ''}</div><div class="cap-bar-wrap" style="margin-top:auto"><div class="cap-bar ${capCls}" style="width:${capPct}%"></div></div>`;
      } else {
        dEl.innerHTML = `<div class="drawer-key">${escapeHtml(key)}</div><div class="drawer-empty-label">vazia</div>`;
      }
      dEl.dataset.key = key;
      dEl.dataset.depot = depotId;
      dEl.onclick = () => {
        if (mvState) {
          if (depotId !== activeDepotId) switchDepot(depotId);
          mvSelectDest(key);
          return;
        }
        if (depotId !== activeDepotId) switchDepot(depotId);
        setFocusedDrawer(key);
      };
      dEl.ondblclick = event => {
        event.stopPropagation();
        if (depotId !== activeDepotId) switchDepot(depotId);
        openDrawerModal(key, shelf.id, f, d);
      };
      if (!isDepotPageAllContext() || depotId === activeDepotId) dndInit(dEl, key);
      dEl.addEventListener('mouseenter', ev => showDrawerTooltip(ev, key));
      dEl.addEventListener('mouseleave', hideDrawerTooltip);
      drawersEl.appendChild(dEl);
    }
  }
  return block;
}

// ——— PRODUCT TABLE ———
function getAllProducts() {
  const map = {};
  getDepotViewScopeIds().forEach(depotId => {
    Object.entries(productsAll[depotId] || {}).forEach(([key, prods]) => {
      prods.forEach(p => {
        if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [] };
        map[p.code].qty++;
        map[p.code].kg += parseFloat(p.kg) || 0;
        map[p.code].locations.push(isDepotPageAllContext() ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key);
      });
    });
  });
  return Object.values(map);
}

// ── Sidebar product list state ──
let sbFilter = '';
let selectedShelfId = null;     // '' | 'expired' | 'expiring' | 'multi' | 'none' | 'missing'
let sbSortCol = 'code';
let sbSortDir = 1;

function setSbFilter(f) {
  sbFilter = sbFilter === f ? '' : f;
  // sync chip active states
  ['all','expired','expiring','multi','none','missing'].forEach(k => {
    const el = document.getElementById('sbf-' + k);
    if (el) el.classList.toggle('active', (k === 'all' && sbFilter === '') || k === sbFilter);
  });
  renderProductTable();
}

function setSbSort(col) {
  if (sbSortCol === col) sbSortDir = -sbSortDir;
  else { sbSortCol = col; sbSortDir = 1; }
  // update header indicators
  ['code','name','qty','status'].forEach(c => {
    const th = document.getElementById('sbth-' + c);
    if (!th) return;
    th.classList.remove('sort-asc','sort-desc');
    if (c === sbSortCol) th.classList.add(sbSortDir === 1 ? 'sort-asc' : 'sort-desc');
  });
  renderProductTable();
}

function getAllProductsDetail2() {
  // Like getAllProductsDetail but also enriches with status/nearest for sidebar
  const map = {};
  getDepotViewScopeIds().forEach(depotId => {
    Object.entries(productsAll[depotId] || {}).forEach(([key, prods]) => {
      prods.forEach(p => {
        if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [], allExpiries: [], entries: [] };
        const rec = map[p.code];
        rec.qty++;
        rec.kg += parseFloat(p.kg) || 0;
        const locationLabel = isDepotPageAllContext() ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key;
        if (!rec.locations.includes(locationLabel)) rec.locations.push(locationLabel);
        if (p.entry) rec.entries.push(p.entry);
        if (p.expiryControl!=='no') getExpiries(p).filter(Boolean).forEach(d => { if (!rec.allExpiries.includes(d)) rec.allExpiries.push(d); });
        ['ean','sku','category','supplier','unit','lot','perishable','cost','price','tempMax','tempMin','anvisa','ncm','notes'].forEach(f=>{ if(!rec[f]&&p[f]) rec[f]=p[f]; });
      });
    });
  });
  return Object.values(map).map(r => {
    r.allExpiries.sort();
    r.nearest = r.nearest || r.allExpiries[0] || null;
    r.statusKey = r.nearest ? expiryStatus(r.nearest) : 'none';
    return r;
  });
}

function renderProductTable() {
  renderFocusPanel();
  if (focusedDrawerKey) return;

  const q = (document.getElementById('product-search-input')?.value || '').toLowerCase();
  let prods = getAllProductsDetail2();

  // text filter
  if (q) prods = prods.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));

  // chip filter
  if (sbFilter === 'expired')  prods = prods.filter(p => p.statusKey === 'expired');
  else if (sbFilter === 'expiring') prods = prods.filter(p => p.statusKey === 'expiring');
  else if (sbFilter === 'multi')    prods = prods.filter(p => p.locations.length > 1);
  else if (sbFilter === 'none')     prods = prods.filter(p => p.statusKey === 'none');
  else if (sbFilter === 'missing')  prods = prods.filter(p => p.qty === 0); // shouldn't happen normally

  // sort
  prods.sort((a, b) => {
    let va = a[sbSortCol], vb = b[sbSortCol];
    if (sbSortCol === 'status') { va = a.statusKey; vb = b.statusKey; }
    if (va === undefined) va = '';
    if (vb === undefined) vb = '';
    if (typeof va === 'number') return (va - vb) * sbSortDir;
    return va.toString().localeCompare(vb.toString()) * sbSortDir;
  });

  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  if (!prods.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="font-size:10px">Nenhum produto</td></tr>`;
    return;
  }

  // sidebar cell definitions
  const _sbCells = {
    code:   p => { let x=''; if(p.locations.length>1)x+=`<span class="xref-badge xref-multi">${p.locations.length}L</span>`; if(p.statusKey==='expired')x+=`<span class="xref-badge xref-expired">V!</span>`; else if(p.statusKey==='expiring')x+=`<span class="xref-badge xref-expiring">${daysUntil(p.nearest)}d</span>`; return `<td class="td-code" style="font-size:10px">${p.code}${x}</td>`; },
    name:   p => `<td style="font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>`,
    qty:    p => `<td class="td-qty" style="font-size:10px">${p.qty}</td>`,
    status: p => { const ic=p.statusKey==='expired'?'🔴':p.statusKey==='expiring'?'🟡':p.statusKey==='ok'?'🟢':'⚪'; return `<td style="text-align:center;font-size:11px" title="${p.nearest?fmtDate(p.nearest):'Sem validade'}">${ic}</td>`; },
  };
  // update header order to match sbColOrder
  sbColOrder.forEach(k => {
    const th = document.getElementById('sbth-'+k);
    if (th && th.parentElement) {
      th.dataset.colKey = k;
      th.parentElement.appendChild(th);
    }
  });
  tbody.innerHTML = prods.map(p => {
    const isSelected = p.code === selectedProductCode;
    const rowCls = isSelected ? 'selected' : p.statusKey === 'expired' ? 'row-expired' : p.statusKey === 'expiring' ? 'row-expiring' : '';
    return `<tr class="${rowCls}" data-prod-code="${escapeAttr(p.code)}" onclick="selectProduct(this.dataset.prodCode)">${sbColOrder.map(k => _sbCells[k] ? _sbCells[k](p) : '<td>—</td>').join('')}</tr>`;
  }).join('');
  queueEnhanceResizableTables();
}

function renderFocusPanel() {
  const normal = document.getElementById('sidebar-normal-list');
  const focus  = document.getElementById('sidebar-focus-panel');
  if (!normal || !focus) return;

  if (!focusedDrawerKey) {
    normal.style.display = 'flex';
    focus.style.display  = 'none';
    return;
  }

  normal.style.display = 'none';
  focus.style.display  = 'flex';
  const label = document.getElementById('focus-key-label');
  const parsed = parseKey(focusedDrawerKey);
  if (label) {
    label.textContent = parsed
      ? `Prateleira ${parsed.shelf} andar ${parsed.floor} Gaveta ${parsed.drawer} (${focusedDrawerKey})`
      : focusedDrawerKey;
  }

  const prods = (productsAll[activeDepotId] || products)[focusedDrawerKey] || [];
  const list = document.getElementById('focus-prod-list');
  if (!list) return;

  if (!prods.length) {
    list.innerHTML = '<div class="empty-msg">Gaveta vazia</div>';
    return;
  }

  list.innerHTML = prods.map((p, i) => {
    const es = productExpiryStatus(p);
    const ne = nearestExpiry(p);
    const expiries = getExpiries(p).filter(Boolean).sort();
    const expLabel = ne ? (es === 'expired' ? '<span style="color:var(--danger);font-weight:700">VENCIDO</span>' : es === 'expiring' ? '<span style="color:var(--warn);font-weight:700">⚠ ' + daysUntil(ne) + 'd</span>' : fmtDate(ne)) : '—';
    const bg = es === 'expired' ? 'background:#fff0f0' : es === 'expiring' ? 'background:#fff8ee' : '';
    return `<div class="focus-prod-item" draggable="true"
        data-idx="${i}" data-from="${focusedDrawerKey}"
        style="${bg}"
        ondragstart="onDragStart(event,${i},this.dataset.from)" data-from="${escapeAttr(focusedDrawerKey)}"
        ondragend="onDragEnd(event)">
      <div class="focus-prod-code">${escapeHtml(p.code)}</div>
      <div class="focus-prod-info">
        <div class="focus-prod-name">${escapeHtml(p.name)}</div>
        <div class="focus-prod-meta">${p.kg ? p.kg+'kg' : ''} · Val: ${expLabel}${expiries.length > 1 ? ' <span style="color:var(--accent);font-size:9px">+' + (expiries.length-1) + '</span>' : ''}</div>
      </div>
      <span style="font-size:14px;color:var(--text3)" title="Arraste para mover">⠿</span>
    </div>`;
  }).join('');
}

function selectProduct(code) {
  selectedProductCode = selectedProductCode === code ? null : code;
  renderAll();
  if (selectedProductCode) {
    // find first drawer that has this product and scroll to it
    requestAnimationFrame(() => {
      const target = document.querySelector(`.drawer.highlighted[data-key]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // brief extra pulse to catch the eye
        target.style.outline = '2px solid var(--accent)';
        setTimeout(() => { target.style.outline = ''; }, 1200);
      }
    });
  }
}

// ——— STATS ———
function renderStats() {
  const prods = getAllProducts();
  const totalKg = prods.reduce((s, p) => s + p.kg, 0);
  let occupied = 0, total = 0;
  getDepotViewScopeIds().forEach(depotId => {
    (shelvesAll[depotId] || []).forEach(s => {
      total += s.floors * s.drawers;
      for (let f = 1; f <= s.floors; f++) {
        for (let d = 1; d <= s.drawers; d++) {
          if (getDrawerProductsForDepotView(depotId, drawerKey(s.id, f, d)).length > 0) occupied++;
        }
      }
    });
  });

  const occPctGlobal = total > 0 ? Math.round((occupied/total)*100) : 0;
  const occColor = occPctGlobal >= 90 ? 'var(--danger)' : occPctGlobal >= 60 ? 'var(--warn)' : 'var(--accent3)';
  const scopeLabel = isDepotPageAllContext() ? 'todos os depósitos' : 'depósito ativo';
  document.getElementById('queue-widget')?.remove();
  const queueScope = getDepotViewScopeIds();
  const pendingUnloadCount = blindCountRecords.filter(record => ['in_progress', 'pending_review', 'rejected'].includes(record.status) && getUnloadRecordDepotIds(record).some(id => queueScope.includes(id))).length;
  const pendingApprovalCount = blindCountRecords.filter(record => record.status === 'pending_review' && getUnloadRecordDepotIds(record).some(id => queueScope.includes(id))).length;
  const pendingQualityCount = (qualityRowsCurrent || []).filter(row => queueScope.includes(row.depotId) && (row.expiryState === 'expired' || row.expiryState === 'expiring' || row.shelfType === 'quarantine' || row.shelfType === 'blocked')).length;
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card"><div class="stat-label">PRATELEIRAS</div><div class="stat-value">${getDepotViewScopeIds().reduce((sum, depotId) => sum + ((shelvesAll[depotId] || []).length), 0)}</div><div class="stat-sub">${total} gavetas total · ${scopeLabel}</div></div>
    <div class="stat-card">
      <div class="stat-label">OCUPAÇÃO</div>
      <div class="stat-value" style="color:${occColor}">${occPctGlobal}%</div>
      <div class="stat-sub">${occupied} de ${total} gavetas</div>
    </div>
    <div class="stat-card"><div class="stat-label">PRODUTOS</div><div class="stat-value" style="color:var(--accent2)">${prods.length}</div><div class="stat-sub">SKUs distintos</div></div>
    <div class="stat-card"><div class="stat-label">PESO TOTAL</div><div class="stat-value" style="color:var(--warn)">${totalKg.toFixed(1)}</div><div class="stat-sub">kg armazenados</div></div>
  `;
  document.getElementById('stats-bar').insertAdjacentHTML('afterend', `
    <div class="queue-widget" id="queue-widget">
      <div class="queue-card"><span>Fila de descargas</span><strong>${pendingUnloadCount}</strong><div class="stat-sub">Em andamento, pendentes ou reprovadas</div></div>
      <div class="queue-card"><span>Aprovações</span><strong>${pendingApprovalCount}</strong><div class="stat-sub">Descargas aguardando revisão</div></div>
      <div class="queue-card"><span>Qualidade</span><strong>${pendingQualityCount}</strong><div class="stat-sub">Itens a tratar por validade/quarentena/bloqueio</div></div>
    </div>
  `);
  renderDepotSummary();
}

function collectDepotMetrics(depotId = activeDepotId) {
  const depot = getDepotById(depotId);
  const slist = shelvesAll[depotId] || [];
  const prods = productsAll[depotId] || {};
  let totalDrawers = 0;
  let occupiedDrawers = 0;
  let totalEntries = 0;
  let expired = 0;
  let expiring = 0;
  let shortExpiry = 0;
  let usedKg = 0;
  let totalCapKg = 0;
  const skuSet = new Set();
  const categorySet = new Set();
  const familySet = new Set();
  const supplierSet = new Set();

  slist.forEach(shelf => {
    totalDrawers += shelf.floors * shelf.drawers;
    totalCapKg += shelf.floors * shelf.drawers * (shelf.maxKg || 50);
    for (let floor = 1; floor <= shelf.floors; floor++) {
      for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
        const key = drawerKey(shelf.id, floor, drawer);
        const list = prods[key] || [];
        if (list.length) occupiedDrawers++;
        list.forEach(product => {
          totalEntries++;
          usedKg += parseFloat(product.kgTotal ?? product.kg) || 0;
          skuSet.add(product.code);
          if (product.family) familySet.add(product.family);
          if (product.category) categorySet.add(product.category);
          if (product.supplier) supplierSet.add(product.supplier);
          const status = productExpiryStatus(product);
          if (status === 'expired') expired++;
          if (status === 'expiring') expiring++;
          const nearest = nearestExpiry(product);
          const days = nearest ? daysUntil(nearest) : null;
          if (days !== null && days >= 0 && days <= 15) shortExpiry++;
        });
      }
    }
  });

  const occupancyPct = totalDrawers ? Math.round((occupiedDrawers / totalDrawers) * 100) : 0;
  const loadPct = totalCapKg ? Math.round((usedKg / totalCapKg) * 100) : 0;
  return {
    depot,
    shelves: slist.length,
    totalDrawers,
    occupiedDrawers,
    totalEntries,
    usedKg,
    totalCapKg,
    occupancyPct,
    loadPct,
    skuCount: skuSet.size,
    categoryCount: categorySet.size,
    supplierCount: supplierSet.size,
    expired,
    expiring,
    shortExpiry,
  };
}

function collectCombinedDepotMetrics(depotIds = getDepotViewScopeIds()) {
  const metricsList = depotIds.map(id => collectDepotMetrics(id));
  const depotNames = metricsList.map(item => item.depot?.name || item.depot?.id || '').filter(Boolean);
  const depotCities = metricsList.map(item => item.depot?.city).filter(Boolean);
  const depotManagers = metricsList.map(item => item.depot?.manager).filter(Boolean);
  return {
    depot: {
      name: depotIds.length > 1 ? 'Todos os depósitos' : (metricsList[0]?.depot?.name || activeDepotId),
      city: depotIds.length > 1 ? `${depotCities.length} cidade(s)` : (metricsList[0]?.depot?.city || ''),
      manager: depotIds.length > 1 ? `${depotManagers.length} responsável(eis)` : (metricsList[0]?.depot?.manager || ''),
      address: depotIds.length > 1 ? depotNames.join(' · ') : (metricsList[0]?.depot?.address || ''),
    },
    shelves: metricsList.reduce((sum, item) => sum + item.shelves, 0),
    totalDrawers: metricsList.reduce((sum, item) => sum + item.totalDrawers, 0),
    occupiedDrawers: metricsList.reduce((sum, item) => sum + item.occupiedDrawers, 0),
    totalEntries: metricsList.reduce((sum, item) => sum + item.totalEntries, 0),
    usedKg: metricsList.reduce((sum, item) => sum + item.usedKg, 0),
    totalCapKg: metricsList.reduce((sum, item) => sum + item.totalCapKg, 0),
    occupancyPct: 0,
    loadPct: 0,
    skuCount: metricsList.reduce((sum, item) => sum + item.skuCount, 0),
    categoryCount: metricsList.reduce((sum, item) => sum + item.categoryCount, 0),
    supplierCount: metricsList.reduce((sum, item) => sum + item.supplierCount, 0),
    expired: metricsList.reduce((sum, item) => sum + item.expired, 0),
    expiring: metricsList.reduce((sum, item) => sum + item.expiring, 0),
    shortExpiry: metricsList.reduce((sum, item) => sum + item.shortExpiry, 0),
  };
}

function renderDepotSummary() {
  const el = document.getElementById('depot-summary-grid');
  if (!el) return;
  const metrics = isDepotPageAllContext()
    ? collectCombinedDepotMetrics(getDepotViewScopeIds())
    : collectDepotMetrics(activeDepotId);
  metrics.occupancyPct = metrics.totalDrawers ? Math.round((metrics.occupiedDrawers / metrics.totalDrawers) * 100) : 0;
  metrics.loadPct = metrics.totalCapKg ? Math.round((metrics.usedKg / metrics.totalCapKg) * 100) : 0;
  const occColor = metrics.occupancyPct >= 90 ? 'var(--danger)' : metrics.occupancyPct >= 60 ? 'var(--warn)' : 'var(--accent3)';
  const loadColor = metrics.loadPct >= 90 ? 'var(--danger)' : metrics.loadPct >= 60 ? 'var(--warn)' : 'var(--accent)';
  el.innerHTML = `
    <div class="depot-summary-card">
      <div class="depot-summary-title">DEPÓSITO ATIVO</div>
      <div class="depot-summary-main">${escapeHtml(metrics.depot?.name || activeDepotId)}</div>
      <div class="depot-summary-sub">${escapeHtml(metrics.depot?.city || 'Sem cidade')} · ${escapeHtml(metrics.depot?.manager || 'Sem responsável')}</div>
      <div class="depot-summary-sub">${escapeHtml(metrics.depot?.address || 'Sem endereço cadastrado')}</div>
    </div>
    <div class="depot-summary-card">
      <div class="depot-summary-title">CAPACIDADE OPERACIONAL</div>
      <div class="depot-summary-main" style="color:${loadColor}">${metrics.loadPct}%</div>
      <div class="depot-summary-sub">${metrics.usedKg.toFixed(1)} / ${metrics.totalCapKg.toFixed(0)} kg no depósito</div>
      <div class="depot-summary-sub">${metrics.occupiedDrawers} de ${metrics.totalDrawers} gavetas ocupadas</div>
    </div>
    <div class="depot-summary-card">
      <div class="depot-summary-title">SORTIMENTO</div>
      <div class="depot-summary-list">
        <div class="depot-summary-row"><span>SKUs distintos</span><strong>${metrics.skuCount}</strong></div>
        <div class="depot-summary-row"><span>Entradas totais</span><strong>${metrics.totalEntries}</strong></div>
        <div class="depot-summary-row"><span>Categorias</span><strong>${metrics.categoryCount}</strong></div>
        <div class="depot-summary-row"><span>Fornecedores</span><strong>${metrics.supplierCount}</strong></div>
      </div>
    </div>
    <div class="depot-summary-card">
      <div class="depot-summary-title">RISCO E GIRO</div>
      <div class="depot-summary-list">
        <div class="depot-summary-row"><span>Ocupação</span><strong style="color:${occColor}">${metrics.occupancyPct}%</strong></div>
        <div class="depot-summary-row"><span>Validades curtas</span><strong>${metrics.shortExpiry}</strong></div>
        <div class="depot-summary-row"><span>Produtos vencidos</span><strong>${metrics.expired}</strong></div>
        <div class="depot-summary-row"><span>A vencer</span><strong>${metrics.expiring}</strong></div>
      </div>
    </div>
  `;
}

function getCheckedShelfType(inputName) {
  return normalizeShelfType(document.querySelector(`input[name="${inputName}"]:checked`)?.value || 'normal');
}

function setCheckedShelfType(inputName, value) {
  const target = normalizeShelfType(value);
  document.querySelectorAll(`input[name="${inputName}"]`).forEach(input => {
    input.checked = input.value === target;
  });
}

function buildShelfTypeBadge(shelf) {
  const shelfType = normalizeShelfType(shelf?.type);
  if (shelfType === 'normal') return '';
  return `<span class="status-badge ${shelfType === 'quarantine' ? 'quarantine' : 'blocked'}">${getShelfTypeLabel(shelfType)}</span>`;
}

// ——— SHELF LIST ———
function renderShelfList() {
  const el = document.getElementById('shelf-list');
  const canManageShelves = hasPermission('structure.manage');
  el.replaceChildren();

  const appendAddButton = () => {
    if (!canManageShelves) return;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'do-add-card do-add-card-compact';
    addBtn.innerHTML = '<span>+ NOVA PRATELEIRA</span>';
    addBtn.addEventListener('click', toggleAddShelfPanel);
    el.appendChild(addBtn);
  };

  if (!shelves.length) {
    appendAddButton();
    const empty = document.createElement('div');
    empty.className = 'empty-msg';
    empty.textContent = 'Nenhuma prateleira';
    el.appendChild(empty);
    return;
  }

  shelves.forEach(s => {
    let occ = 0;
    for (let f = 1; f <= s.floors; f++) {
      for (let d = 1; d <= s.drawers; d++) {
        if ((products[drawerKey(s.id, f, d)] || []).length > 0) occ++;
      }
    }
    const isEmpty = occ === 0;
    const shelfItem = document.createElement('div');
    shelfItem.className = `shelf-item ${getShelfTypeClass(s.type)} ${selectedShelfId === s.id ? 'active' : ''}`.trim();
    shelfItem.addEventListener('click', () => selectShelf(s.id));
    shelfItem.addEventListener('dblclick', () => openFpModal(s.id, activeDepotId));

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'shelf-name';
    name.textContent = s.id;
    if (normalizeShelfType(s.type) !== 'normal') {
      const badgeWrap = document.createElement('span');
      badgeWrap.innerHTML = ` ${buildShelfTypeBadge(s)}`;
      name.appendChild(badgeWrap);
    }
    const meta = document.createElement('div');
    meta.className = 'shelf-meta';
    meta.textContent = `${s.floors} andares × ${s.drawers} gavetas`;
    const status = document.createElement('div');
    status.className = 'shelf-meta';
    status.style.marginTop = '2px';
    status.style.color = isEmpty ? 'var(--accent3)' : 'var(--text3)';
    status.textContent = isEmpty ? '✓ vazia' : `${occ} gaveta(s) com produtos`;
    info.append(name, meta, status);

    const actions = document.createElement('div');
    actions.className = 'shelf-actions';
    actions.style.display = 'flex';
    actions.style.gap = '4px';
    if (canManageShelves) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'icon-btn';
      editBtn.title = 'Editar prateleira';
      editBtn.textContent = '✏';
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        openEditShelfPanel(s.id);
      });
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '✕';
      if (isEmpty) {
        delBtn.className = 'icon-btn del';
        delBtn.title = 'Remover prateleira vazia';
        delBtn.addEventListener('click', event => {
          event.stopPropagation();
          removeShelf(s.id);
        });
      } else {
        delBtn.className = 'icon-btn';
        delBtn.disabled = true;
        delBtn.style.opacity = '.35';
        delBtn.style.cursor = 'not-allowed';
        delBtn.title = `${occ} gaveta(s) ocupada(s) — esvazie antes de remover`;
      }
      actions.appendChild(delBtn);
    }

    shelfItem.append(info, actions);
    el.appendChild(shelfItem);
  });

  appendAddButton();
}



// ── Shelf panel toggle ────────────────────────────────────────────────
function toggleAddShelfPanel() {
  if (!hasPermission('structure.manage')) return;
  const panel = document.getElementById('add-shelf-panel');
  const editPanel = document.getElementById('edit-shelf-panel');
  const btn = document.getElementById('btn-add-shelf');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (editPanel) editPanel.style.display = 'none';
  if (btn) btn.textContent = isOpen ? '+ NOVA' : '✕ FECHAR';
  if (!isOpen) {
    // reset fields
    ['new-shelf-name','new-shelf-floors','new-shelf-drawers','new-shelf-maxkg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { if(id==='new-shelf-floors')el.value='6'; else if(id==='new-shelf-drawers')el.value='4'; else if(id==='new-shelf-maxkg')el.value='50'; else el.value=''; }
    });
    setCheckedShelfType('new-shelf-type', 'normal');
    setTimeout(() => document.getElementById('new-shelf-name')?.focus(), 50);
  }
}

let _editShelfId = null;
function openEditShelfPanel(shelfId) {
  if (!hasPermission('structure.manage')) return;
  const shelf = shelves.find(s => s.id === shelfId); if (!shelf) return;
  _editShelfId = shelfId;
  const addPanel = document.getElementById('add-shelf-panel');
  if (addPanel) addPanel.style.display = 'none';
  const btn = document.getElementById('btn-add-shelf');
  if (btn) btn.textContent = '+ NOVA';
  const panel = document.getElementById('edit-shelf-panel');
  const lbl   = document.getElementById('edit-shelf-id-label');
  if (lbl) lbl.textContent = shelfId;
  const setV = (id, v) => { const el=document.getElementById(id); if(el) el.value=v; };
  setV('edit-shelf-floors',  shelf.floors);
  setV('edit-shelf-drawers', shelf.drawers);
  setV('edit-shelf-maxkg',   shelf.maxKg || 50);
  setCheckedShelfType('edit-shelf-type', shelf.type || 'normal');
  if (panel) panel.style.display = 'block';
  // scroll panel into view
  panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeEditShelfPanel() {
  const panel = document.getElementById('edit-shelf-panel');
  if (panel) panel.style.display = 'none';
  _editShelfId = null;
}

async function saveEditShelf() {
  if (!await requirePermission('structure.manage', 'Seu perfil não pode editar prateleiras.')) return;
  if (!_editShelfId) return;
  const shelf = shelves.find(s => s.id === _editShelfId); if (!shelf) return;
  const floors  = parseInt(document.getElementById('edit-shelf-floors')?.value) || shelf.floors;
  const drawers = parseInt(document.getElementById('edit-shelf-drawers')?.value) || shelf.drawers;
  const maxKg   = parseFloat(document.getElementById('edit-shelf-maxkg')?.value) || shelf.maxKg || 50;
  const shelfType = getCheckedShelfType('edit-shelf-type');
  let shelfUsedKg = 0;
  for (let floor = 1; floor <= shelf.floors; floor++) {
    for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
      const key = drawerKey(shelf.id, floor, drawer);
      const drawerProducts = products[key] || [];
      if (floor > floors || drawer > drawers) {
        if (drawerProducts.length) {
          await showNotice({
            title: 'REDUÇÃO BLOQUEADA',
            icon: '⛔',
            desc: 'A nova configuração removeria gavetas que ainda possuem produtos.',
            summary: { GAVETA: key, ITENS: String(drawerProducts.length) },
          });
          return;
        }
        continue;
      }
      const drawerKg = drawerProducts.reduce((sum, product) => sum + (parseFloat(product.kg) || 0), 0);
      shelfUsedKg += drawerKg;
      if (drawerKg > maxKg) {
        await showNotice({
          title: 'CAPACIDADE POR GAVETA EXCEDIDA',
          icon: '⛔',
          desc: 'A nova capacidade por gaveta ficaria abaixo do peso já armazenado.',
          summary: { GAVETA: key, 'ATUAL (KG)': drawerKg.toFixed(2), 'NOVO LIMITE (KG)': maxKg.toFixed(2) },
        });
        return;
      }
    }
  }
  const projectedShelfCapacity = floors * drawers * maxKg;
  if (shelfUsedKg > projectedShelfCapacity) {
    await showNotice({
      title: 'CAPACIDADE DA PRATELEIRA EXCEDIDA',
      icon: '⛔',
      desc: 'A nova configuração da prateleira não suporta o peso atualmente armazenado.',
      summary: { PRATELEIRA: shelf.id, 'ATUAL (KG)': shelfUsedKg.toFixed(2), 'NOVO LIMITE (KG)': projectedShelfCapacity.toFixed(2) },
    });
    return;
  }
  const ok = await showConfirm({
    title: 'EDITAR PRATELEIRA ' + _editShelfId, icon: '✏',
    desc: 'Salvar alterações nas propriedades da prateleira?',
    summary: { 'TIPO': getShelfTypeLabel(shelfType), 'ANDARES': floors, 'GAVETAS': drawers, 'CAP. MÁX': maxKg + ' kg/gav.' },
    okLabel: 'SALVAR', okStyle: 'accent'
  });
  if (!ok) return;
  shelf.floors  = floors;
  shelf.drawers = drawers;
  shelf.maxKg   = maxKg;
  shelf.type    = shelfType;
  logHistory('✏', `Prateleira editada: ${_editShelfId}`, `${getShelfTypeLabel(shelfType)} · ${floors} and. × ${drawers} gav. · ${maxKg}kg`, { depotId: activeDepotId, shelfId: _editShelfId });
  await persistStructureState();
  closeEditShelfPanel();
  renderAll(true);
  renderShelfList();
}

// ——— SCROLL TO SHELF ———
function selectShelf(id) {
  selectedShelfId = selectedShelfId === id ? null : id;
  renderShelfList();

  if (!selectedShelfId) {
    document.querySelectorAll('.shelf-block.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));
    return;
  }

  // switch to depot page if not already there
  showPage('depot');

  requestAnimationFrame(() => {
    // find shelf block by its name text
    const blocks = document.querySelectorAll('.shelf-block');
    let target = null;
    blocks.forEach(b => {
      const nameEl = b.querySelector('.shelf-block-name');
      if (nameEl && nameEl.textContent.trim() === 'PRATELEIRA ' + selectedShelfId) target = b;
    });

    // remove previous highlight
    document.querySelectorAll('.shelf-block.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));

    if (target) {
      target.classList.add('shelf-highlighted');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // remove highlight after 2.5s
      setTimeout(() => target.classList.remove('shelf-highlighted'), 2500);
    }
  });
}

// ——— ADD SHELF ———
async function addShelf() {
  if (!hasPermission('structure.manage')) return;
  const name = sanitizeTextInput(readInputValue('new-shelf-name'), { maxLength: 8, uppercase: true });
  const floors = parseInt(readInputValue('new-shelf-floors'), 10);
  const drawers = parseInt(readInputValue('new-shelf-drawers'), 10);
  const maxKg = parseFloat(readInputValue('new-shelf-maxkg')) || 50;
  const shelfType = getCheckedShelfType('new-shelf-type');
  if (!name || isNaN(floors) || isNaN(drawers)) { showNotice({ title:'DADOS INCOMPLETOS', icon:'⛔', desc:'Preencha nome, andares e gavetas para criar a prateleira.' }); return; }
  if (/^[0-9]+$/.test(name)) { showNotice({ title:'NOME INVÁLIDO', icon:'⛔', desc:'O nome da prateleira não pode ser apenas números.' }); return; }
  if (shelves.find(s => s.id === name)) { showNotice({ title:'PRATELEIRA DUPLICADA', icon:'⛔', desc:'Já existe uma prateleira com esse código neste depósito.', summary:{ DEPÓSITO: getDepotById(activeDepotId)?.name || activeDepotId, PRATELEIRA: name } }); return; }
  shelves.push({ id: name, type: shelfType, floors, drawers, maxKg });
  shelvesAll[activeDepotId] = shelves;
  writeInputValue('new-shelf-name', '');
  setCheckedShelfType('new-shelf-type', 'normal');
  logHistory('🏷', `Prateleira criada: ${name}`, `${getShelfTypeLabel(shelfType)} · ${floors} and. × ${drawers} gav. · ${maxKg}kg`, { depotId: activeDepotId, shelfId: name, type: 'edicao' });
  await persistStructureState();
  renderAll(true);
}

async function removeShelf(id) {
  if (!await requirePermission('structure.manage', 'Seu perfil não pode remover prateleiras.')) return;
  const shelf = shelves.find(s => s.id === id);
  if (!shelf) return;
  // verify truly empty
  for (let f = 1; f <= shelf.floors; f++)
    for (let d = 1; d <= shelf.drawers; d++)
      if ((products[drawerKey(shelf.id, f, d)] || []).length > 0) {
        await showNotice({
          title: 'PRATELEIRA OCUPADA',
          icon: '⛔',
          desc: `A prateleira ${id} ainda possui produtos. Esvazie todas as gavetas antes de removê-la.`,
        });
        return;
      }
  const ok2 = await showConfirm({ title:'REMOVER PRATELEIRA', icon:'🗑', desc:'Remover a prateleira vazia?', summary:{'PRATELEIRA':id,'ANDARES':shelf.floors,'GAVETAS':shelf.floors*shelf.drawers}, okLabel:'REMOVER' }); if(!ok2) return;
  shelves = shelves.filter(s => s.id !== id);
  shelvesAll[activeDepotId] = shelves;
  Object.keys(products).forEach(k => { if (k.startsWith(id + '.') || k.startsWith(id + '0') || k.match(new RegExp('^' + id + '\\d')) ) delete products[k]; });
  await persistStructureState();
  renderAll(true);
}

// ——— DRAWER MODAL ———
function openDrawerModal(key) {
  currentDrawerKey = key;
  document.getElementById('drawer-modal-title').textContent = `GAVETA — ${key}`;
  const p = parseKey(key);
  document.getElementById('drawer-modal-loc').textContent = p ? `Prateleira ${p.shelf} · Andar ${p.floor} · Gaveta ${p.drawer}` : key;
  renderDrawerProducts();
  document.getElementById('drawer-modal').classList.add('open');
}

function closeDrawerModal() {
  document.getElementById('drawer-modal').classList.remove('open');
  currentDrawerKey = null;
  dpExpiries = [];
  pfExpiries = [];
}

function renderDrawerProducts() {
  const list = document.getElementById('drawer-products-list');
  const prods = products[currentDrawerKey] || [];
  const canEditProducts = canManageProducts();

  // capacity bar
  const parsedKey = parseKey(currentDrawerKey || '');
  const shelf = parsedKey ? shelves.find(s => s.id === parsedKey.shelf) : null;
  const maxKg = getDrawerCapacityKg(currentDrawerKey, activeDepotId) || (shelf ? (shelf.maxKg || 50) : 50);
  const usedKg = prods.reduce((s,p) => s + (parseFloat(p.kg)||0), 0);
  const capPct = Math.min(100, (usedKg / maxKg) * 100);
  const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';
  const capBar = document.getElementById('drawer-cap-bar');
  const capInfo = document.getElementById('drawer-cap-info');
  if (capBar) { capBar.style.width = capPct + '%'; capBar.className = 'cap-bar ' + capCls; }
  if (capInfo) capInfo.textContent = usedKg.toFixed(1) + ' / ' + maxKg + ' kg (' + Math.round(capPct) + '%)';

  if (!prods.length) { list.innerHTML = '<div class="empty-msg">Gaveta vazia</div>'; return; }

  // group by code to find soonest per code
  const codeMinExp = {};
  prods.forEach(p => {
    const ne = nearestExpiry(p);
    if (!codeMinExp[p.code] || (ne && ne < codeMinExp[p.code])) codeMinExp[p.code] = ne;
  });

  list.innerHTML = prods.map((p, i) => {
    const es = productExpiryStatus(p);
    const expiries = getExpiries(p).filter(Boolean).sort();
    const nearest = expiries[0];
    const sameCodeProds = prods.filter(x => x.code === p.code);
    const isSoonest = nearest && nearest === codeMinExp[p.code] && sameCodeProds.length > 1;
    const isLatest  = nearest && nearest !== codeMinExp[p.code] && sameCodeProds.length > 1;

    const expBadge = es === 'expired'
      ? ' <span style="color:var(--danger);font-size:10px;font-weight:700">VENCIDO</span>'
      : es === 'expiring'
      ? ` <span style="color:var(--warn);font-size:10px;font-weight:700">⚠ ${daysUntil(nearest)}d</span>`
      : '';

    let urgencyRibbon = '';
    if (isSoonest) {
      const ribbonColor = es==='expired'?'var(--danger)':es==='expiring'?'var(--warn)':'#1a8a3a';
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:${ribbonColor};margin-top:2px">⬆ VALIDADE MAIS PRÓXIMA</div>`;
    } else if (isLatest && es === 'ok') {
      // only show "validade mais longa" ribbon when THIS entry is truly within date
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;color:var(--accent3);margin-top:2px">✓ validade mais longa</div>`;
    } else if (isLatest && es !== 'ok') {
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--danger);margin-top:2px">⚠ ${es==='expired'?'VENCIDO':'A VENCER'} (lote mais antigo)</div>`;
    }

    // expiry chips display inside product card
    let valChips = '';
    if (expiries.length === 0) {
      valChips = '<span style="font-size:10px;color:var(--text3);font-family:IBM Plex Mono,monospace">Sem validade</span>';
    } else {
      valChips = expiries.map((d, di) => {
        const st = expiryStatus(d);
        return `<span class="exp-chip ${st}" ${canEditProducts ? `onclick="openDateEditForProduct(${i},${di})" title="Clique para editar"` : ''}>${fmtDate(d)} ${canEditProducts ? `<button class="chip-edit" onclick="event.stopPropagation();openDateEditForProduct(${i},${di})">✏</button>` : ''}</span>`;
      }).join('');
    }

    const borderStyle = es === 'expired'
      ? (isSoonest ? 'border-color:#cc2222;border-width:2px;background:#fff0f0' : 'border-color:#e88;background:#fff0f0')
      : es === 'expiring'
      ? (isSoonest ? 'border-color:#cc7700;border-width:2px;background:#fff8ee' : 'border-color:#e8a800;background:#fff8ee')
      : isSoonest ? 'border-color:#1a8a3a;border-width:2px;background:#f0fdf4'
      : isLatest  ? 'border-color:#7ec87e;background:#f6fff6'
      : '';

    return `<div class="dp-item" style="${borderStyle};cursor:${canEditProducts ? 'pointer' : 'default'}" ${canEditProducts ? `onclick="openProductForm(${i})"` : ''}>
      <div class="dp-code">${escapeHtml(p.code)}</div>
      <div class="dp-info" style="min-width:0">
        <div class="dp-name">${escapeHtml(p.name)}${expBadge}</div>
        <div class="dp-meta">${p.kg ? p.kg + ' kg' : '—'}${p.entry ? ' · Entrada: ' + p.entry : ''}</div>
        <div class="exp-chip-list" style="margin-top:4px">${valChips}</div>
        ${urgencyRibbon}
      </div>
      ${canEditProducts ? `<button class="dp-move" onclick="openMoveModal(${i})" title="Mover">⇄</button>` : ''}
      ${canEditProducts ? `<button class="dp-remove" onclick="removeProductFromDrawer(${i})">✕</button>` : ''}
    </div>`;
  }).join('');
}

function openDateEditForProduct(prodIdx, dateIdx) {
  if (!canManageProducts()) return;
  const p = (products[currentDrawerKey] || [])[prodIdx];
  if (!p) return;
  const expiries = getExpiries(p).filter(Boolean).sort();
  dateEditCtx = {
    type: 'product',
    prodIdx,
    dateIdx,
    list: [...expiries],
    save: (newList) => {
      products[currentDrawerKey][prodIdx].expiries = newList;
      products[currentDrawerKey][prodIdx].exit = undefined;
      renderDrawerProducts();
      renderAll();
    }
  };
  document.getElementById('date-edit-title').textContent = `VALIDADE — ${p.code}`;
  document.getElementById('date-edit-input').value = expiries[dateIdx] || '';
  document.getElementById('date-edit-modal').classList.add('open');
}

// dp-* helpers now delegate to unified pf- form
function dpAddExpiry()    { pfAddExpiry(); }
function renderDpChips()  { renderPfChips(); }
function dpEditExpiry(i)  { pfEditExpiry(i); }
function addProductToDrawer() {
  if (!canManageProducts()) return;
  openProductForm(null);
}

async function removeProductFromDrawer(idx) {
  if (!canManageProducts()) return;
  const p = products[currentDrawerKey][idx];
  const okRm = await showConfirm({ title:'REMOVER PRODUTO', icon:'🗑', desc:'Remover este produto da gaveta?', summary:{'CÓDIGO':p.code,'NOME':p.name,'GAVETA':currentDrawerKey}, okLabel:'REMOVER' }); if(!okRm) return;
  logHistory('📤', `Saída: ${p.code} — ${p.name}`, `Removido de ${currentDrawerKey}`, { depotId: activeDepotId, from: currentDrawerKey, drawerKey: currentDrawerKey, productCode: p.code });
  products[currentDrawerKey].splice(idx, 1);
  renderDrawerProducts();
  renderAll();
}

// ——— GLOBAL ADD PRODUCT ———
function openAddProductModal() {
  if (!canManageProducts()) return;
  const today = new Date().toISOString().slice(0, 10);
  if (document.getElementById('gp-entry')) document.getElementById('gp-entry').value = today;
  if (document.getElementById('gp-qty')) document.getElementById('gp-qty').value = '1';
  if (document.getElementById('gp-unit')) document.getElementById('gp-unit').value = 'un';
  if (document.getElementById('gp-kg-unit')) document.getElementById('gp-kg-unit').value = '';
  if (document.getElementById('gp-kg-total')) document.getElementById('gp-kg-total').value = '';
  if (document.getElementById('gp-kg')) document.getElementById('gp-kg').value = '';
  document.getElementById('add-product-modal').classList.add('open');
}

async function addGlobalProduct() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode registrar entradas manuais.')) return;
  const code = sanitizeTextInput(document.getElementById('gp-code').value, { maxLength: 40, uppercase: true });
  const name = sanitizeTextInput(document.getElementById('gp-name').value, { maxLength: 120 });
  syncWeightFields('gp', 'qty');
  const qty = parseInt(document.getElementById('gp-qty').value, 10) || 1;
  const unit = document.getElementById('gp-unit')?.value || 'un';
  const kgUnit = parseFloat(document.getElementById('gp-kg-unit').value) || 0;
  const kg = parseFloat(document.getElementById('gp-kg-total').value || document.getElementById('gp-kg').value) || 0;
  const loc = sanitizeTextInput(document.getElementById('gp-location').value, { maxLength: 20, uppercase: true });
  const entry = document.getElementById('gp-entry').value;
  const expiries2 = [...gpExpiries];
  if (!code || !name || !loc) { await showNotice({ title:'CAMPOS OBRIGATÓRIOS', icon:'⛔', desc:'Código, nome e local são obrigatórios.' }); return; }
  const p = parseKey(loc);
  if (!p) { await showNotice({ title:'LOCAL INVÁLIDO', icon:'⛔', desc:'Use o formato A1.G2 para indicar o local do produto.' }); return; }
  const shelf = shelves.find(s => s.id === p.shelf);
  if (!shelf) { await showNotice({ title:'PRATELEIRA INEXISTENTE', icon:'⛔', desc:`A prateleira ${p.shelf} não existe neste depósito.` }); return; }
  if (p.floor < 1 || p.floor > shelf.floors) { await showNotice({ title:'ANDAR INVÁLIDO', icon:'⛔', desc:`O andar ${p.floor} não existe na prateleira ${p.shelf}.` }); return; }
  if (p.drawer < 1 || p.drawer > shelf.drawers) { await showNotice({ title:'GAVETA INVÁLIDA', icon:'⛔', desc:`A gaveta ${p.drawer} não existe na prateleira ${p.shelf}.` }); return; }
  const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: loc, incomingKg: kg });
  if (!validation.ok) { await showNotice({ title: validation.title, icon:'⛔', desc: validation.detail, summary: validation.summary }); return; }
  if (!products[loc]) products[loc] = [];
  const okGp = await showConfirm({ title:'CADASTRAR PRODUTO', icon:'📥', desc:'Confirmar entrada do produto?', summary:{'CÓDIGO':code,'NOME':name,'LOCAL':loc,'PESO':kg+'kg'}, okLabel:'CADASTRAR', okStyle:'accent' }); if(!okGp) return;
  products[loc].push({ code, name, kg, kgTotal: kg, kgPerUnit: kgUnit, qty, unit, entry, expiries: expiries2 });
  logHistory('📥', `Entrada: ${code} — ${name}`, `${loc} · ${kg}kg`, { depotId: activeDepotId, to: loc, drawerKey: loc, productCode: code });
  ['gp-code','gp-name','gp-location','gp-kg','gp-kg-unit','gp-kg-total'].forEach(id => document.getElementById(id).value = '');
  if (document.getElementById('gp-qty')) document.getElementById('gp-qty').value = '1';
  if (document.getElementById('gp-unit')) document.getElementById('gp-unit').value = 'un';
  gpExpiries = [];
  const gpChips = document.getElementById('gp-expiry-chips');
  if (gpChips) gpChips.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
  document.getElementById('add-product-modal').classList.remove('open');
  renderAll();
}

// ——— TABS ———
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabMap = {'products-tab':'tab-products','shelves-tab':'tab-shelves'};
  if (tabMap[id]) document.getElementById(tabMap[id]).classList.add('active');

}

// ——— QR OPERATIONS ———
const QR_PREFIX = 'WMSQR1';
let qrWorkflow = { depotId: null, shelfId: null, drawerKey: null, productCode: null, locationDrawerKey: null, payload: null };
let qrVideoStream = null;
let qrScanTimer = null;

function buildQrPayloadForType(type, { depotId = '', shelfId = '', drawerKey = '', productCode = '' } = {}) {
  if (type === 'depot') return `${QR_PREFIX}|DEPOT|${depotId}`;
  if (type === 'shelf') return `${QR_PREFIX}|SHELF|${depotId}|${shelfId}`;
  if (type === 'drawer') return `${QR_PREFIX}|DRAWER|${depotId}|${drawerKey}`;
  if (type === 'product') return `${QR_PREFIX}|PRODUCT|${productCode}`;
  return `${QR_PREFIX}|LOCATION|${depotId}|${drawerKey}|${productCode}`;
}

function buildQrPayload() {
  const type = document.getElementById('qr-gen-type')?.value || 'depot';
  const depotValue = document.getElementById('qr-gen-depot')?.value || activeDepotId;
  const shelfValue = document.getElementById('qr-gen-shelf')?.value || '';
  const drawerValueRaw = document.getElementById('qr-gen-drawer')?.value || '';
  const productCode = document.getElementById('qr-gen-product')?.value || '';
  const shelfDepotId = shelfValue.includes('::') ? shelfValue.split('::')[0] : depotValue;
  const shelfId = shelfValue.includes('::') ? shelfValue.split('::')[1] : shelfValue;
  const drawerDepotId = drawerValueRaw.includes('::') ? drawerValueRaw.split('::')[0] : shelfDepotId;
  const drawerValue = drawerValueRaw.includes('::') ? drawerValueRaw.split('::')[1] : drawerValueRaw;
  const depotId = type === 'product' ? '' : (drawerDepotId || shelfDepotId || depotValue);
  return buildQrPayloadForType(type, { depotId, shelfId, drawerKey: drawerValue, productCode });
}

function parseQrPayload(text) {
  const raw = sanitizeTextInput(text, { maxLength: 400 });
  const parts = raw.split('|');
  if (parts[0] !== QR_PREFIX) throw new Error('Payload QR inválido para este WMS.');
  const type = parts[1];
  if (type === 'DEPOT') return { type: 'depot', depotId: parts[2] };
  if (type === 'SHELF') return { type: 'shelf', depotId: parts[2], shelfId: parts[3] };
  if (type === 'DRAWER') return { type: 'drawer', depotId: parts[2], drawerKey: parts[3] };
  if (type === 'PRODUCT') return { type: 'product', productCode: parts[2] };
  if (type === 'LOCATION') return { type: 'location', depotId: parts[2], drawerKey: parts[3], productCode: parts[4] || null };
  throw new Error('Tipo de QR não reconhecido.');
}

function renderQrPage() {
  const userBadge = document.getElementById('qr-user-badge');
  if (userBadge) userBadge.textContent = `Usuário: ${getCurrentUserLabel()}`;
  populateQrSelectors();
  renderQrProductLookup();
  renderQrGenerator();
  renderQrWorkflow();
}

function getQrProductCatalog() {
  const map = new Map();
  Object.entries(productsAll || {}).forEach(([depotId, productMap]) => {
    Object.entries(productMap || {}).forEach(([drawer, items]) => {
      (items || []).forEach(product => {
        if (!product?.code) return;
        const key = product.code;
        if (!map.has(key)) {
          map.set(key, {
            code: product.code,
            name: product.name || '',
            unit: product.unit || 'un',
            lot: product.lot || '',
            brand: product.brand || '',
            family: product.family || '',
            category: product.category || '',
            qty: 0,
            kg: 0,
            depots: new Set(),
            drawers: new Set(),
            product,
          });
        }
        const rec = map.get(key);
        rec.qty += parseInt(product.qty, 10) || 1;
        rec.kg += parseFloat(product.kgTotal ?? product.kg) || 0;
        rec.depots.add(depotId);
        rec.drawers.add(drawer);
        if (!rec.name && product.name) rec.name = product.name;
        if (!rec.brand && product.brand) rec.brand = product.brand;
        if (!rec.family && product.family) rec.family = product.family;
        if (!rec.category && product.category) rec.category = product.category;
        if (!rec.lot && product.lot) rec.lot = product.lot;
        if (!rec.unit && product.unit) rec.unit = product.unit;
        rec.product = { ...rec.product, ...product };
      });
    });
  });
  return [...map.values()]
    .map(item => ({ ...item, depots: [...item.depots], drawers: [...item.drawers] }))
    .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
}

function populateQrSelectors() {
  const genDepot = document.getElementById('qr-gen-depot');
  const formDepot = document.getElementById('qr-form-depot');
  if (genDepot) genDepot.innerHTML = buildDepotOptionsHtml({ includeAll: true, selected: genDepot.value || ALL_DEPOTS_VALUE });
  if (formDepot) formDepot.innerHTML = buildDepotOptionsHtml({ selected: formDepot.value || qrWorkflow.depotId || activeDepotId });
  if (genDepot && !genDepot.value) genDepot.value = ALL_DEPOTS_VALUE;
  if (formDepot && !formDepot.value) formDepot.value = qrWorkflow.depotId || activeDepotId;

  const genDepotId = genDepot?.value || ALL_DEPOTS_VALUE;
  const formDepotId = formDepot?.value || activeDepotId;
  const genShelves = genDepotId === ALL_DEPOTS_VALUE ? depots.flatMap(depot => (shelvesAll[depot.id] || []).map(shelf => ({ ...shelf, depotId: depot.id }))) : (shelvesAll[genDepotId] || []).map(shelf => ({ ...shelf, depotId: genDepotId }));
  const formShelves = shelvesAll[formDepotId] || [];

  const genShelf = document.getElementById('qr-gen-shelf');
  const formShelf = document.getElementById('qr-form-shelf');
  if (genShelf) genShelf.innerHTML = genShelves.map(s => {
    const value = genDepotId === ALL_DEPOTS_VALUE ? `${s.depotId}::${s.id}` : s.id;
    return `<option value="${value}">${escapeHtml(s.id)}${genDepotId === ALL_DEPOTS_VALUE ? ' · ' + escapeHtml(getDepotById(s.depotId)?.name || s.depotId) : ''}</option>`;
  }).join('');
  if (formShelf) formShelf.innerHTML = formShelves.map(s => `<option value="${s.id}">${s.id}</option>`).join('');

  if (qrWorkflow.shelfId && formShelf && formShelves.some(s => s.id === qrWorkflow.shelfId)) formShelf.value = qrWorkflow.shelfId;
  if (genShelf && !genShelf.value && genShelves[0]) genShelf.value = genDepotId === ALL_DEPOTS_VALUE ? `${genShelves[0].depotId}::${genShelves[0].id}` : genShelves[0].id;

  populateQrDrawerSelectors();
  populateQrProductSelectors();
}

function populateQrDrawerSelectors() {
  const buildDrawerOptions = (depotId, shelfId) => {
    const resolvedDepotId = depotId === ALL_DEPOTS_VALUE && shelfId.includes('::') ? shelfId.split('::')[0] : depotId;
    const resolvedShelfId = shelfId.includes('::') ? shelfId.split('::')[1] : shelfId;
    const shelf = (shelvesAll[resolvedDepotId] || []).find(s => s.id === resolvedShelfId);
    if (!shelf) return '';
    const options = [];
    for (let floor = 1; floor <= shelf.floors; floor++) {
      for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
        const key = drawerKey(shelf.id, floor, drawer);
        const value = resolvedDepotId === depotId ? key : `${resolvedDepotId}::${key}`;
        options.push(`<option value="${value}">${escapeHtml(key)}${depotId === ALL_DEPOTS_VALUE ? ' · ' + escapeHtml(getDepotById(resolvedDepotId)?.name || resolvedDepotId) : ''}</option>`);
      }
    }
    return options.join('');
  };
  const genDepotId = document.getElementById('qr-gen-depot')?.value || ALL_DEPOTS_VALUE;
  const genShelfId = document.getElementById('qr-gen-shelf')?.value || '';
  const formDepotId = document.getElementById('qr-form-depot')?.value || activeDepotId;
  const formShelfId = document.getElementById('qr-form-shelf')?.value || '';
  const genDrawer = document.getElementById('qr-gen-drawer');
  const formDrawer = document.getElementById('qr-form-drawer');
  if (genDrawer) genDrawer.innerHTML = buildDrawerOptions(genDepotId, genShelfId);
  if (formDrawer) formDrawer.innerHTML = buildDrawerOptions(formDepotId, formShelfId);
  if (qrWorkflow.drawerKey && formDrawer && [...formDrawer.options].some(opt => opt.value === qrWorkflow.drawerKey)) formDrawer.value = qrWorkflow.drawerKey;
}

function populateQrProductSelectors() {
  const search = (document.getElementById('qr-gen-product-search')?.value || '').trim().toLowerCase();
  const catalog = getQrProductCatalog().filter(item => {
    const hay = [item.code, item.name, item.brand, item.category, item.lot].join(' ').toLowerCase();
    return !search || hay.includes(search);
  });
  const genProduct = document.getElementById('qr-gen-product');
  if (genProduct) {
    genProduct.innerHTML = catalog.map(item => `<option value="${escapeAttr(item.code)}">${escapeHtml(item.code)} - ${escapeHtml(item.name || 'Sem nome')}</option>`).join('');
    if (qrWorkflow.productCode && catalog.some(item => item.code === qrWorkflow.productCode)) genProduct.value = qrWorkflow.productCode;
  }
}

function filterQrGeneratorProducts() {
  populateQrProductSelectors();
  renderQrGenerator();
}

function renderQrProductLookup() {
  const resultEl = document.getElementById('qr-form-product-results');
  if (!resultEl) return;
  const query = (document.getElementById('qr-form-product-search')?.value || '').trim().toLowerCase();
  const catalog = getQrProductCatalog().filter(item => {
    const hay = [item.code, item.name, item.brand, item.category, item.lot, ...item.depots].join(' ').toLowerCase();
    return !query || hay.includes(query);
  }).slice(0, 10);
  if (!catalog.length) {
    resultEl.innerHTML = '<div class="empty-msg" style="padding:10px 12px">Nenhum produto encontrado.</div>';
    return;
  }
  resultEl.innerHTML = catalog.map(item => {
    const meta = [
      item.qty > 0 ? `${item.qty} un` : null,
      item.kg  > 0 ? `${item.kg.toFixed(3)} kg` : null,
      item.brand || null,
      item.category || null,
      item.lot ? `lote ${item.lot}` : null,
      item.depots?.join(', ') || null,
    ].filter(Boolean).join(' · ');
    const active = qrWorkflow.productCode === item.code ? 'pli__item--focused' : '';
    return `<button type="button" class="pli__item ${active}" onclick="selectQrFormProduct('${escapeJs(item.code)}')">
      <span class="pli__code">${escapeHtml(item.code)}</span>
      <span class="pli__name">${escapeHtml(item.name || 'Sem nome')}</span>
      ${meta ? `<span class="pli__meta">${escapeHtml(meta)}</span>` : ''}
    </button>`;
  }).join('');
  resultEl.classList.add('pli--open');
}

function selectQrFormProduct(code) {
  qrWorkflow.productCode = code;
  const codeInput = document.getElementById('qr-form-code');
  if (codeInput) codeInput.value = code;
  const searchInput = document.getElementById('qr-form-product-search');
  const match = getQrProductCatalog().find(item => item.code === code);
  if (searchInput && match) searchInput.value = `${match.code} - ${match.name || ''}`;
  hydrateQrProductForm();
  renderQrProductLookup();
  renderQrWorkflow();
}

function renderQrGenerator() {
  populateQrSelectors();
  const payload = buildQrPayload();
  const payloadEl = document.getElementById('qr-payload');
  if (payloadEl) payloadEl.value = payload;
  const preview = document.getElementById('qr-code-preview');
  if (!preview) return;
  preview.innerHTML = '';
  if (window.QRCode) {
    new window.QRCode(preview, { text: payload, width: 220, height: 220 });
  } else {
    preview.textContent = 'Biblioteca QR indisponível.';
  }
}

function copyQrPayload() {
  const payload = document.getElementById('qr-payload')?.value || '';
  if (!payload) return;
  navigator.clipboard?.writeText(payload);
}

function downloadQrImage() {
  const img = document.querySelector('#qr-code-preview img') || document.querySelector('#qr-code-preview canvas');
  if (!img) return;
  const href = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
  const a = document.createElement('a');
  a.href = href;
  a.download = 'wms_qr.png';
  a.click();
}

function openEntityQrModal({ title, subtitle, type, depotId = '', shelfId = '', drawerKey = '', productCode = '' }) {
  const payload = buildQrPayloadForType(type, { depotId, shelfId, drawerKey, productCode });
  const titleEl = document.getElementById('entity-qr-title');
  const subtitleEl = document.getElementById('entity-qr-subtitle');
  const payloadEl = document.getElementById('entity-qr-payload');
  const preview = document.getElementById('entity-qr-preview');
  if (titleEl) titleEl.textContent = title || 'QR CODE';
  if (subtitleEl) subtitleEl.textContent = subtitle || '';
  if (payloadEl) payloadEl.value = payload;
  if (preview) {
    preview.innerHTML = '';
    if (window.QRCode) new window.QRCode(preview, { text: payload, width: 220, height: 220 });
    else preview.textContent = 'Biblioteca QR indisponível.';
  }
  document.getElementById('entity-qr-modal')?.classList.add('open');
}

function closeEntityQrModal() {
  document.getElementById('entity-qr-modal')?.classList.remove('open');
}

function copyEntityQrPayload() {
  const payload = document.getElementById('entity-qr-payload')?.value || '';
  if (payload) navigator.clipboard?.writeText(payload);
}

function downloadEntityQrImage() {
  const img = document.querySelector('#entity-qr-preview img') || document.querySelector('#entity-qr-preview canvas');
  if (!img) return;
  const href = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
  const a = document.createElement('a');
  a.href = href;
  a.download = 'wms_entity_qr.png';
  a.click();
}

function openDrawerQrModal() {
  if (!currentDrawerKey) return;
  const parsed = parseKey(currentDrawerKey);
  openEntityQrModal({
    title: `QR GAVETA ${currentDrawerKey}`,
    subtitle: parsed ? `${getDepotById(activeDepotId)?.name || activeDepotId} · Prateleira ${parsed.shelf} · Andar ${parsed.floor} · Gaveta ${parsed.drawer}` : currentDrawerKey,
    type: 'drawer',
    depotId: activeDepotId,
    drawerKey: currentDrawerKey,
  });
}

function openShelfQrModal() {
  if (!fpFocusedShelf) return;
  const depotId = fpFocusedDepotId || activeDepotId;
  const shelf = (shelvesAll[depotId] || []).find(item => item.id === fpFocusedShelf);
  openEntityQrModal({
    title: `QR PRATELEIRA ${fpFocusedShelf}`,
    subtitle: `${getDepotById(depotId)?.name || depotId}${shelf ? ` · ${shelf.floors} andares · ${shelf.drawers} gavetas` : ''}`,
    type: 'shelf',
    depotId,
    shelfId: fpFocusedShelf,
  });
}

function renderQrWorkflow() {
  const context = document.getElementById('qr-context');
  if (!context) return;
  const drawerParsed = qrWorkflow.drawerKey ? parseKey(qrWorkflow.drawerKey) : null;
  const values = [
    ['DEPÓSITO', getDepotById(qrWorkflow.depotId)?.name || qrWorkflow.depotId || '—'],
    ['ESTANTE', qrWorkflow.shelfId || drawerParsed?.shelf || '—'],
    ['GAVETA', qrWorkflow.drawerKey || '—'],
    ['PRODUTO', qrWorkflow.productCode || '—'],
    ['PAYLOAD', qrWorkflow.payload || '—'],
  ];
  context.innerHTML = values.map(([label, value]) => `<div class="qr-context-item"><span class="qr-context-label">${escapeHtml(label)}</span><span class="qr-context-value">${escapeHtml(value)}</span></div>`).join('');
}

function applyQrContext(data, rawPayload) {
  qrWorkflow.payload = rawPayload;
  if (data.depotId) qrWorkflow.depotId = data.depotId;
  if (data.shelfId) qrWorkflow.shelfId = data.shelfId;
  if (data.drawerKey) {
    qrWorkflow.drawerKey = data.drawerKey;
    qrWorkflow.locationDrawerKey = data.drawerKey;
    qrWorkflow.shelfId = parseKey(data.drawerKey)?.shelf || qrWorkflow.shelfId;
  }
  if (data.productCode) qrWorkflow.productCode = data.productCode;

  if (qrWorkflow.depotId) document.getElementById('qr-form-depot').value = qrWorkflow.depotId;
  populateQrSelectors();
  if (qrWorkflow.shelfId && document.getElementById('qr-form-shelf')) document.getElementById('qr-form-shelf').value = qrWorkflow.shelfId;
  populateQrDrawerSelectors();
  if (qrWorkflow.drawerKey && document.getElementById('qr-form-drawer')) document.getElementById('qr-form-drawer').value = qrWorkflow.drawerKey;
  if (qrWorkflow.productCode) document.getElementById('qr-form-code').value = qrWorkflow.productCode;
  hydrateQrProductForm();
  renderQrProductLookup();
  renderQrWorkflow();
}

function hydrateQrProductForm() {
  const code = sanitizeTextInput(document.getElementById('qr-form-code')?.value || qrWorkflow.productCode || '', { maxLength: 40, uppercase: true });
  if (!code) return;
  const all = Object.values(productsAll).flatMap(productMap => Object.values(productMap).flat());
  const match = all.find(product => product.code === code);
  if (!match) return;
  qrWorkflow.productCode = match.code;
  document.getElementById('qr-form-code').value = match.code;
  document.getElementById('qr-form-name').value = match.name || '';
  document.getElementById('qr-form-unit').value = match.unit || 'un';
  document.getElementById('qr-form-lot').value = match.lot || '';
  document.getElementById('qr-form-qty').value = String(match.qty || 1);
  document.getElementById('qr-form-kg-unit').value = match.kgPerUnit != null ? String(match.kgPerUnit) : '';
  document.getElementById('qr-form-kg-total').value = match.kgTotal != null ? String(match.kgTotal) : String(match.kg || '');
  const searchInput = document.getElementById('qr-form-product-search');
  if (searchInput) searchInput.value = `${match.code} - ${match.name || ''}`;
  syncWeightFields('qr', 'qty');
}

function syncQrFormFromSelectors() {
  qrWorkflow.depotId = document.getElementById('qr-form-depot')?.value || qrWorkflow.depotId;
  qrWorkflow.shelfId = document.getElementById('qr-form-shelf')?.value || qrWorkflow.shelfId;
  populateQrDrawerSelectors();
  qrWorkflow.drawerKey = document.getElementById('qr-form-drawer')?.value || qrWorkflow.drawerKey;
  renderQrWorkflow();
}

async function applyManualQrPayload() {
  const raw = document.getElementById('qr-manual-payload')?.value || '';
  try {
    const data = parseQrPayload(raw);
    applyQrContext(data, raw);
  } catch (err) {
    await showNotice({ title: 'QR INVÁLIDO', icon: '⛔', desc: err.message });
  }
}

function resetQrWorkflow() {
  qrWorkflow = { depotId: activeDepotId, shelfId: null, drawerKey: null, productCode: null, locationDrawerKey: null, payload: null };
  document.getElementById('qr-manual-payload').value = '';
  const genSearch = document.getElementById('qr-gen-product-search');
  if (genSearch) genSearch.value = '';
  const formSearch = document.getElementById('qr-form-product-search');
  if (formSearch) formSearch.value = '';
  renderQrPage();
}

async function startQrScanner() {
  if (!('BarcodeDetector' in window)) {
    await showNotice({ title: 'LEITURA NÃO SUPORTADA', icon: 'ℹ', desc: 'Seu navegador não oferece BarcodeDetector para QR. Use imagem ou payload manual.' });
    return;
  }
  const video = document.getElementById('qr-video');
  if (!video) return;
  qrVideoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = qrVideoStream;
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const tick = async () => {
    if (!qrVideoStream) return;
    try {
      const codes = await detector.detect(video);
      if (codes[0]?.rawValue) {
        document.getElementById('qr-manual-payload').value = codes[0].rawValue;
        await applyManualQrPayload();
      }
    } catch (err) {}
    qrScanTimer = setTimeout(tick, 700);
  };
  tick();
}

function stopQrScanner() {
  if (qrScanTimer) { clearTimeout(qrScanTimer); qrScanTimer = null; }
  if (qrVideoStream) {
    qrVideoStream.getTracks().forEach(track => track.stop());
    qrVideoStream = null;
  }
  const video = document.getElementById('qr-video');
  if (video) video.srcObject = null;
}

async function handleQrImage(file) {
  if (!file) return;
  if (!('BarcodeDetector' in window)) {
    await showNotice({ title: 'LEITURA NÃO SUPORTADA', icon: 'ℹ', desc: 'Seu navegador não oferece leitura por imagem. Use payload manual.' });
    return;
  }
  const bitmap = await createImageBitmap(file);
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const codes = await detector.detect(bitmap);
  if (codes[0]?.rawValue) {
    document.getElementById('qr-manual-payload').value = codes[0].rawValue;
    await applyManualQrPayload();
  } else {
    await showNotice({ title: 'QR NÃO ENCONTRADO', icon: 'ℹ', desc: 'Nenhum QR code foi detectado na imagem enviada.' });
  }
}

async function submitQrEntry() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode registrar entradas via QR.')) return;
  syncWeightFields('qr', 'qty');
  const depotId = document.getElementById('qr-form-depot')?.value || qrWorkflow.depotId || activeDepotId;
  const shelfId = document.getElementById('qr-form-shelf')?.value || qrWorkflow.shelfId || '';
  const drawerValue = document.getElementById('qr-form-drawer')?.value || qrWorkflow.drawerKey || '';
  const code = sanitizeTextInput(document.getElementById('qr-form-code')?.value, { maxLength: 40, uppercase: true });
  const name = sanitizeTextInput(document.getElementById('qr-form-name')?.value, { maxLength: 120 });
  const unit = document.getElementById('qr-form-unit')?.value || 'un';
  const qty = parseInt(document.getElementById('qr-form-qty')?.value, 10) || 1;
  const kgPerUnit = parseFloat(document.getElementById('qr-form-kg-unit')?.value) || 0;
  const kgTotal = parseFloat(document.getElementById('qr-form-kg-total')?.value) || 0;
  const entry = document.getElementById('qr-form-entry')?.value || new Date().toISOString().slice(0, 10);
  const expiry = document.getElementById('qr-form-expiry')?.value || '';
  const lot = sanitizeTextInput(document.getElementById('qr-form-lot')?.value, { maxLength: 60, uppercase: true });
  const notes = sanitizeTextInput(document.getElementById('qr-form-notes')?.value, { maxLength: 180 });

  if (!depotId || !shelfId || !drawerValue || !code || !name) {
    await showNotice({ title: 'DADOS INCOMPLETOS', icon: '⛔', desc: 'Depósito, estante, gaveta, código e nome são obrigatórios para registrar a entrada.' });
    return;
  }
  const validation = validateDrawerPlacement({ depotId, drawerKeyValue: drawerValue, incomingKg: kgTotal });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  if (!productsAll[depotId]) productsAll[depotId] = {};
  if (!productsAll[depotId][drawerValue]) productsAll[depotId][drawerValue] = [];
  const existingTemplate = Object.values(productsAll[depotId]).flat().find(product => product.code === code)
    || Object.values(productsAll).flatMap(productMap => Object.values(productMap).flat()).find(product => product.code === code);
  productsAll[depotId][drawerValue].push({
    ...(existingTemplate || {}),
    code,
    name,
    unit,
    qty,
    kg: kgTotal,
    kgTotal,
    kgPerUnit,
    entry,
    lot,
    expiries: expiry ? [expiry] : [],
    notes: notes || existingTemplate?.notes || '',
  });

  logHistory('🔳', `Entrada via QR/manual: ${code} — ${name}`, `${drawerValue} · ${kgTotal.toFixed(3)}kg · ${qty} ${unit}${notes ? ' · ' + notes : ''}`, { depotId, to: drawerValue, drawerKey: drawerValue, productCode: code });
  switchDepot(depotId);
  document.getElementById('qr-form-code').value = '';
  document.getElementById('qr-form-name').value = '';
  document.getElementById('qr-form-lot').value = '';
  document.getElementById('qr-form-expiry').value = '';
  document.getElementById('qr-form-notes').value = '';
  document.getElementById('qr-form-qty').value = '1';
  document.getElementById('qr-form-kg-unit').value = '';
  document.getElementById('qr-form-kg-total').value = '';
  syncWeightFields('qr', 'qty');
  resetQrWorkflow();
  renderAll();
}

// ——— CLOSE MODALS ON OVERLAY CLICK ———
// modal overlay click handlers — deferred so DOM is ready
function attachModalListeners() {
  const em = document.getElementById('expiry-modal');
  if (em) em.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
  const dm = document.getElementById('drawer-modal');
  if (dm) dm.addEventListener('click', function(e) { if (e.target === this) closeDrawerModal(); });
  const apm = document.getElementById('add-product-modal');
  if (apm) apm.addEventListener('click', function(e) { if (e.target === this) document.getElementById('add-product-modal').classList.remove('open'); });
  const sm = document.getElementById('settings-modal');
  if (sm) sm.addEventListener('click', function(e) { if (e.target === this) closeSettingsModal(); });
  const bpm = document.getElementById('blind-pool-modal');
  if (bpm) bpm.addEventListener('click', function(e) { if (e.target === this) closeBlindPoolModal(); });
  const bam = document.getElementById('blind-allocate-modal');
  if (bam) bam.addEventListener('click', function(e) { if (e.target === this) closeBlindAllocateModal(); });
  const tim = document.getElementById('text-input-modal');
  if (tim) tim.addEventListener('click', function(e) { if (e.target === this) textPromptResolve(null); });
  const tif = document.getElementById('text-input-field');
  if (tif) tif.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitTextPrompt(); } });
  document.getElementById('qr-gen-depot')?.addEventListener('change', () => { populateQrSelectors(); renderQrGenerator(); });
  document.getElementById('qr-gen-shelf')?.addEventListener('change', () => { populateQrDrawerSelectors(); renderQrGenerator(); });
  document.getElementById('qr-form-depot')?.addEventListener('change', () => { populateQrSelectors(); syncQrFormFromSelectors(); });
  document.getElementById('qr-form-shelf')?.addEventListener('change', () => { populateQrDrawerSelectors(); syncQrFormFromSelectors(); });
  document.getElementById('qr-form-code')?.addEventListener('change', hydrateQrProductForm);
  document.getElementById('qr-form-code')?.addEventListener('input', () => { qrWorkflow.productCode = sanitizeTextInput(document.getElementById('qr-form-code')?.value || '', { maxLength: 40, uppercase: true }); renderQrProductLookup(); renderQrWorkflow(); });
  const dz = document.getElementById('csv-drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); });
  }
}
document.addEventListener('DOMContentLoaded', attachModalListeners);

// ——— DRAWER FOCUS MODE ———
function setFocusedDrawer(key) {
  // clear old active outline
  document.querySelectorAll('.drawer.active-drawer').forEach(d => d.classList.remove('active-drawer'));
  focusedDrawerKey = key;
  selectedProductCode = null;
  // switch sidebar to products tab and show focus panel
  switchTab('products-tab');
  renderProductTable();
  // highlight the active drawer
  requestAnimationFrame(() => {
    const el = document.querySelector(`.drawer[data-key="${key}"]`);
    if (el) el.classList.add('active-drawer');
  });
}

function clearFocus() {
  focusedDrawerKey = null;
  document.querySelectorAll('.drawer.active-drawer').forEach(d => d.classList.remove('active-drawer'));
  renderProductTable();
}

function getQualityRowById(rowId) {
  return qualityRowsCurrent.find(row => row.rowId === rowId) || null;
}

function getAvailableDrawersForShelf(shelf, depotId, incomingKg, excludeDrawerKey = null, excludeIndex = null) {
  const options = [];
  if (!shelf) return options;
  for (let floor = 1; floor <= shelf.floors; floor++) {
    for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
      const key = drawerKey(shelf.id, floor, drawer);
      const validation = validateDrawerPlacement({
        depotId,
        drawerKeyValue: key,
        incomingKg,
        sourceDepotId: depotId,
        sourceDrawerKey: excludeDrawerKey,
        sourceProductIdx: excludeIndex,
        allowExistingSameDrawer: true,
      });
      if (validation.ok) options.push(key);
    }
  }
  return options;
}

function openQualityMoveModal(rowId, targetType) {
  if (!hasPermission('quality.manage')) return;
  const row = getQualityRowById(rowId);
  if (!row) return;
  const specialDepots = depots.filter(depot => (shelvesAll[depot.id] || []).some(shelf => normalizeShelfType(shelf.type) === targetType));
  if (!specialDepots.length) {
    showNotice({
      title: 'SEM PRATELEIRA ESPECIAL',
      icon: '⛔',
      desc: `Não existe nenhuma prateleira de ${targetType === 'quarantine' ? 'quarentena' : 'bloqueio'} cadastrada.`,
      summary: { AÇÃO: 'Crie uma prateleira especial na aba PRATELEIRAS.' },
    });
    return;
  }
  qualityMoveCtx = { rowId, targetType };
  document.getElementById('quality-move-title').textContent = targetType === 'quarantine' ? 'ENVIAR PARA QUARENTENA' : 'ENVIAR PARA BLOQUEIO';
  document.getElementById('quality-move-subtitle').textContent = `${row.product.code} — ${row.product.name} · origem ${row.drawerKey}`;
  document.getElementById('quality-move-summary').innerHTML = [
    ['DEPÓSITO ORIGEM', row.depotName],
    ['LOCAL ORIGEM', row.drawerKey],
    ['LOTE', row.product.lot || '—'],
    ['QTD', parseFloat(row.product.qty || 1).toFixed(3)],
    ['KG', (parseFloat(row.product.kgTotal ?? row.product.kg) || 0).toFixed(3)],
  ].map(([k, v]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(k)}</span><span class="confirm-sum-val">${escapeHtml(v)}</span></div>`).join('');
  const depotSelect = document.getElementById('quality-move-depot');
  depotSelect.innerHTML = specialDepots.map(depot => `<option value="${depot.id}">${escapeHtml(depot.name)}</option>`).join('');
  depotSelect.value = specialDepots.some(depot => depot.id === row.depotId) ? row.depotId : specialDepots[0].id;
  document.getElementById('quality-move-note').value = targetType === 'quarantine' ? 'Segregado para análise de qualidade.' : 'Produto bloqueado pela qualidade.';
  syncQualityMoveDestinations();
  document.getElementById('quality-move-modal').classList.add('open');
}

function syncQualityMoveDestinations() {
  if (!qualityMoveCtx) return;
  const row = getQualityRowById(qualityMoveCtx.rowId);
  if (!row) return;
  const depotId = document.getElementById('quality-move-depot')?.value || row.depotId;
  const shelfSelect = document.getElementById('quality-move-shelf');
  const drawerSelect = document.getElementById('quality-move-drawer');
  const incomingKg = parseFloat(row.product.kgTotal ?? row.product.kg) || 0;
  const specialShelves = (shelvesAll[depotId] || []).filter(shelf => normalizeShelfType(shelf.type) === qualityMoveCtx.targetType);
  shelfSelect.innerHTML = specialShelves.map(shelf => `<option value="${shelf.id}">${escapeHtml(shelf.id)} · ${escapeHtml(getShelfTypeLabel(shelf.type))}</option>`).join('');
  if (!specialShelves.length) {
    drawerSelect.innerHTML = '<option value="">Nenhuma prateleira disponível</option>';
    return;
  }
  if (!Array.from(shelfSelect.options).some(option => option.value === shelfSelect.value)) shelfSelect.value = specialShelves[0].id;
  const selectedShelf = specialShelves.find(shelf => shelf.id === shelfSelect.value) || specialShelves[0];
  const drawerOptions = getAvailableDrawersForShelf(
    selectedShelf,
    depotId,
    incomingKg,
    row.depotId === depotId ? row.drawerKey : null,
    row.depotId === depotId ? row.productIndex : null,
  );
  drawerSelect.innerHTML = drawerOptions.length
    ? drawerOptions.map(key => `<option value="${key}">${escapeHtml(key)}</option>`).join('')
    : '<option value="">Sem gaveta compatível</option>';
}

function closeQualityMoveModal() {
  document.getElementById('quality-move-modal').classList.remove('open');
  qualityMoveCtx = null;
}

async function executeQualityMove() {
  if (!await requirePermission('quality.manage', 'Seu perfil não pode fazer destinação de qualidade.')) return;
  if (!qualityMoveCtx) return;
  const row = getQualityRowById(qualityMoveCtx.rowId);
  if (!row) return;
  const depotId = document.getElementById('quality-move-depot')?.value || row.depotId;
  const drawerValue = document.getElementById('quality-move-drawer')?.value || '';
  const note = sanitizeTextInput(document.getElementById('quality-move-note')?.value || '', { maxLength: 180 });
  if (!drawerValue) {
    await showNotice({ title: 'DESTINO INVÁLIDO', icon: '⛔', desc: 'Selecione uma gaveta válida para a destinação de qualidade.' });
    return;
  }
  if (depotId === row.depotId && drawerValue === row.drawerKey) {
    await showNotice({ title: 'DESTINO INVÁLIDO', icon: '⛔', desc: 'Escolha uma gaveta diferente da origem.' });
    return;
  }
  const incomingKg = parseFloat(row.product.kgTotal ?? row.product.kg) || 0;
  const validation = validateDrawerPlacement({ depotId, drawerKeyValue: drawerValue, incomingKg, sourceDepotId: row.depotId });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }
  const sourceMap = productsAll[row.depotId] || {};
  const sourceList = sourceMap[row.drawerKey] || [];
  if (row.productIndex < 0) {
    await showNotice({ title: 'ITEM NÃO LOCALIZADO', icon: '⛔', desc: 'Este registro veio do banco, mas não foi possível vinculá-lo ao item carregado no frontend. Recarregue a página antes de mover.' });
    return;
  }
  const product = sourceList[row.productIndex];
  if (!product) {
    await showNotice({ title: 'ITEM NÃO ENCONTRADO', icon: '⛔', desc: 'O item mudou desde a abertura desta ação. Recarregue a página de qualidade.' });
    closeQualityMoveModal();
    return;
  }
  sourceList.splice(row.productIndex, 1);
  if (!sourceList.length) delete sourceMap[row.drawerKey];
  if (!productsAll[depotId]) productsAll[depotId] = {};
  if (!productsAll[depotId][drawerValue]) productsAll[depotId][drawerValue] = [];
  productsAll[depotId][drawerValue].push(product);
  const actionLabel = qualityMoveCtx.targetType === 'quarantine' ? 'Quarentena' : 'Bloqueio';
  logHistory('🛡', `${actionLabel}: ${product.code} — ${product.name}`, `${row.drawerKey} → ${drawerValue}${note ? ' · ' + note : ''}`, {
    depotId,
    from: row.drawerKey,
    to: drawerValue,
    drawerKey: drawerValue,
    productCode: product.code,
    type: 'movimentacao',
  });
  if (row.depotId === activeDepotId || depotId === activeDepotId) switchDepot(activeDepotId === row.depotId ? activeDepotId : depotId);
  qualityDataCache.fetchedAt = 0;
  qualityDataCache.states = null;
  qualityDataCache.summary = null;
  qualityRowsCurrent = [];
  closeQualityMoveModal();
  renderAll();
  setTimeout(() => renderQualityPage(true), 700);
}

// ——— DRAG AND DROP ———
let dragIdx = null;
let dragFromKey = null;

function onDragStart(e, idx, fromKey) {
  dragIdx = idx;
  dragFromKey = fromKey;
  e.dataTransfer.effectAllowed = 'move';
  const el = e.currentTarget;
  setTimeout(() => el.classList.add('dragging'), 0);
  // make ALL drawers drop-ready
  document.querySelectorAll('.drawer').forEach(d => {
    d.addEventListener('dragover',  onDrawerDragOver);
    d.addEventListener('dragleave', onDrawerDragLeave);
    d.addEventListener('drop',      onDrawerDrop);
  });
}

function onDragEnd(e) {
  e.currentTarget && e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drawer').forEach(d => {
    d.classList.remove('drop-target');
    d.removeEventListener('dragover',  onDrawerDragOver);
    d.removeEventListener('dragleave', onDrawerDragLeave);
    d.removeEventListener('drop',      onDrawerDrop);
  });
}

function onDrawerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drop-target');
}

function onDrawerDragLeave(e) {
  this.classList.remove('drop-target');
}

function onDrawerDrop(e) {
  e.preventDefault();
  this.classList.remove('drop-target');
  const destKey = this.dataset.key;
  if (!destKey || dragIdx === null || !dragFromKey) return;
  if (destKey === dragFromKey) return;

  const prod = (products[dragFromKey] || [])[dragIdx];
  if (!prod) return;
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: destKey,
    incomingKg: parseFloat(prod.kg) || 0,
  });
  if (!validation.ok) {
    showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    dragIdx = null; dragFromKey = null;
    return;
  }

  // perform move
  products[dragFromKey].splice(dragIdx, 1);
  if (!products[destKey]) products[destKey] = [];
  products[destKey].push(prod);
  logHistory('🔀', `Movido: ${prod.code} — ${prod.name}`, `${dragFromKey} → ${destKey}`, { depotId: activeDepotId, from: dragFromKey, to: destKey, drawerKey: destKey, productCode: prod.code });

  // flash the target drawer
  this.classList.add('drop-ok');
  setTimeout(() => this.classList.remove('drop-ok'), 600);

  dragIdx = null; dragFromKey = null;

  // stay focused on source if it still has products, else clear
  if (focusedDrawerKey === dragFromKey && (products[dragFromKey] || []).length === 0) {
    focusedDrawerKey = destKey;
  }
  renderAll();
}

// ——— MOVE PRODUCT ———
// ══ MOVE MODE STATE MACHINE ══════════════════════════════════════════
let mvState = null;
// { prodIdx, srcKey, product, destKey }

function syncMoveTransferFields(source = 'qty') {
  if (!mvState?.product) return;
  const qtyEl = document.getElementById('cm-move-qty');
  const kgEl = document.getElementById('cm-move-kg');
  if (!qtyEl || !kgEl) return;
  const product = mvState.product;
  const totalQty = Math.max(0.001, parseFloat(product.qty || 1));
  const totalKg = Math.max(0.001, parseFloat(product.kgTotal ?? product.kg) || 0.001);
  const kgPerUnit = totalQty > 0 ? totalKg / totalQty : totalKg;

  if (source === 'kg') {
    const kg = Math.min(totalKg, Math.max(0.001, parseFloat(kgEl.value) || totalKg));
    kgEl.value = kg.toFixed(3);
    qtyEl.value = (kg / kgPerUnit).toFixed(3);
    return;
  }

  const qty = Math.min(totalQty, Math.max(0.001, parseFloat(qtyEl.value) || totalQty));
  qtyEl.value = qty.toFixed(3);
  kgEl.value = (qty * kgPerUnit).toFixed(3);
}

function getMinimumTransferKg(product) {
  const totalQty = Math.max(0.001, parseFloat(product?.qty || 1));
  const totalKg = Math.max(0.001, parseFloat(product?.kgTotal ?? product?.kg) || 0.001);
  const kgPerUnit = parseFloat(product?.kgPerUnit) || (totalKg / totalQty);
  return Math.max(0.001, Math.min(totalKg, kgPerUnit || 0.001));
}

function openMoveModal(prodIdx) {
  if (!hasPermission('entry.register')) return;
  const p = (products[currentDrawerKey] || [])[prodIdx];
  if (!p) return;

  mvState = { prodIdx, srcKey: currentDrawerKey, product: p, destKey: null };

  // close the drawer modal — we'll highlight the entire grid
  closeDrawerModal();
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open')) closeFpModal();

  // activate move mode
  document.getElementById('move-mode-banner').classList.add('active');
  document.getElementById('move-banner-text').textContent =
    `Movendo: ${p.code} — ${p.name} · de ${mvState.srcKey}`;
  document.body.classList.add('move-mode');

  // highlight drawers
  applyMoveHighlights();
}

function applyMoveHighlights() {
  if (!mvState) return;
  const src = mvState.srcKey;
  const incomingKg = getMinimumTransferKg(mvState.product);
  // highlight in depot grid
  document.querySelectorAll('.drawer[data-key]').forEach(el => {
    const key = el.dataset.key;
    el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
    if (key === src) { el.classList.add('mv-source'); return; }
    const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: key, incomingKg });
    if (validation.ok) {
      const prods = products[key] || [];
      el.classList.add(prods.length === 0 ? 'mv-empty' : 'mv-has-room');
      el.onclick = (e) => { e.stopPropagation(); mvSelectDest(key); };
    } else {
      el.classList.add('mv-full');
      el.onclick = (e) => {
        e.stopPropagation();
        showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
      };
    }
  });
  // if floor plan modal open, highlight there too
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open')) {
    document.querySelectorAll('#fp-modal-body .drawer[data-key]').forEach(el => {
      const key = el.dataset.key;
      el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
      if (key === src) { el.classList.add('mv-source'); return; }
      const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: key, incomingKg });
      if (validation.ok) {
        const prods = products[key] || [];
        el.classList.add(prods.length === 0 ? 'mv-empty' : 'mv-has-room');
        el.onclick = (e) => { e.stopPropagation(); mvSelectDest(key); };
      } else {
        el.classList.add('mv-full');
        el.onclick = (e) => {
          e.stopPropagation();
          showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
        };
      }
    });
  }
}

function mvSelectDest(destKey) {
  if (!mvState) return;
  mvState.destKey = destKey;
  const p = mvState.product;
  const expiries = getExpiries(p).filter(Boolean).sort();

  // fill confirm modal
  document.getElementById('cm-product').textContent = `${p.code} — ${p.name}`;
  document.getElementById('cm-available').textContent = `${parseFloat(p.qty || 1).toFixed(3)} un · ${(parseFloat(p.kgTotal ?? p.kg) || 0).toFixed(3)} kg`;
  document.getElementById('cm-from').textContent = mvState.srcKey;
  document.getElementById('cm-to').textContent = destKey;
  const qtyInput = document.getElementById('cm-move-qty');
  const kgInput = document.getElementById('cm-move-kg');
  if (qtyInput) qtyInput.value = parseFloat(p.qty || 1).toFixed(3);
  if (kgInput) kgInput.value = (parseFloat(p.kgTotal ?? p.kg) || 0).toFixed(3);

  // expiry selection
  const expSection = document.getElementById('cm-expiry-section');
  const expList = document.getElementById('cm-expiry-list');
  if (expiries.length > 0) {
    expSection.style.display = 'block';
    expList.innerHTML = expiries.map((d, i) => {
      const st = expiryStatus(d);
      const stLabel = st === 'expired' ? ' 🔴 VENCIDA' : st === 'expiring' ? ' 🟡 A VENCER' : ' 🟢 OK';
      return `<div class="cm-expiry-row">
        <input type="checkbox" id="cmexp-${i}" value="${d}" checked>
        <label for="cmexp-${i}" style="cursor:pointer">${fmtDate(d)}${stLabel}</label>
      </div>`;
    }).join('');
  } else {
    expSection.style.display = 'none';
  }

  document.getElementById('move-confirm-modal').classList.add('open');
}

async function executeMoveConfirmed() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode movimentar produtos manualmente.')) return;
  if (!mvState || !mvState.destKey) return;
  const { prodIdx, srcKey, destKey, product: p } = mvState;
  const sourceQty = Math.max(0.001, parseFloat(p.qty || 1));
  const sourceKg = Math.max(0.001, parseFloat(p.kgTotal ?? p.kg) || 0.001);
  const moveQty = Math.max(0.001, parseFloat(document.getElementById('cm-move-qty')?.value || sourceQty));
  const moveKg = Math.max(0.001, parseFloat(document.getElementById('cm-move-kg')?.value || sourceKg));
  if (moveQty - sourceQty > 0.0001 || moveKg - sourceKg > 0.0001) {
    await showNotice({ title: 'TRANSFERÊNCIA INVÁLIDA', icon: '⛔', desc: 'Quantidade ou peso informados excedem o disponível na origem.' });
    return;
  }
  const partialMove = Math.abs(moveQty - sourceQty) > 0.0001 || Math.abs(moveKg - sourceKg) > 0.0001;

  // get selected expiries
  const expiries = getExpiries(p).filter(Boolean).sort();
  let movedExpiries = expiries; // default: all
  if (expiries.length > 0) {
    movedExpiries = [];
    document.querySelectorAll('#cm-expiry-list input[type=checkbox]').forEach(cb => {
      if (cb.checked) movedExpiries.push(cb.value);
    });
  }
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: destKey,
    incomingKg: moveKg,
  });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  // remove from source
  const srcProds = products[srcKey] || [];
  srcProds.splice(prodIdx, 1);
  if (!srcProds.length) delete products[srcKey];

  // add to dest with only selected expiries
  if (!products[destKey]) products[destKey] = [];
  const movedItem = {
    ...p,
    qty: parseFloat(moveQty.toFixed(3)),
    kg: parseFloat(moveKg.toFixed(3)),
    kgTotal: parseFloat(moveKg.toFixed(3)),
    expiries: movedExpiries,
  };
  products[destKey].push(movedItem);

  // if some expiries were NOT moved, keep product at source with remaining
  const remainingExp = expiries.filter(d => !movedExpiries.includes(d));
  const remainingQty = Math.max(0, sourceQty - moveQty);
  const remainingKg = Math.max(0, sourceKg - moveKg);
  if (partialMove || remainingExp.length > 0) {
    if (!products[srcKey]) products[srcKey] = [];
    products[srcKey].push({
      ...p,
      qty: parseFloat(remainingQty.toFixed(3)),
      kg: parseFloat(remainingKg.toFixed(3)),
      kgTotal: parseFloat(remainingKg.toFixed(3)),
      expiries: remainingExp.length > 0 ? remainingExp : expiries,
    });
  }

  logHistory('🔀', `Movido: ${p.code} — ${p.name}`,
    `${srcKey} → ${destKey} · ${moveQty.toFixed(3)} un · ${moveKg.toFixed(3)} kg${remainingExp.length ? ' ('+movedExpiries.length+' val. de '+expiries.length+')' : ''}${partialMove ? ' · parcial' : ''}`,
    { depotId: activeDepotId, from: srcKey, to: destKey, drawerKey: destKey, productCode: p.code });

  cancelMoveMode();
  renderAll();
}

function cancelMoveMode() {
  // close confirm modal
  document.getElementById('move-confirm-modal').classList.remove('open');
  // remove banner
  document.getElementById('move-mode-banner').classList.remove('active');
  document.body.classList.remove('move-mode');
  // remove all move highlights and restore onclick
  document.querySelectorAll('.drawer[data-key]').forEach(el => {
    el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
    const key = el.dataset.key;
    // restore original onclick
    el.onclick = (e) => { e.stopPropagation(); openDrawerModal(key); };
  });
  mvState = null;
}

// hook ESC to also cancel move mode




init().catch(err => console.error('Falha ao inicializar o WMS:', err));
