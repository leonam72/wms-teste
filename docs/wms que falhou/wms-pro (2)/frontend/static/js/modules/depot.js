// ═══════════════════════════════════════════════════════════
// MODULE: depot.js
// ═══════════════════════════════════════════════════════════

function addDepot(name) { openDepotModal(null); }

async function removeDepot(id) {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode excluir depósitos.')) return;
  normalizeDiscardDepotState();
  if (depots.length <= 1) {
    await showNotice({ title: 'OPERAÇÃO BLOQUEADA', icon: '⛔', desc: 'Não é possível remover o único depósito cadastrado.' });
    return;
  }
  const depot = depots.find(d => d.id === id);
  if (id === 'dep_discard') {
    await showNotice({ title: 'DEPÓSITO FIXO', icon: '⛔', desc: 'O depósito de descarte é estrutural do sistema e não pode ser removido.' });
    return;
  }
  const slist = shelvesAll[id] || [];
  const p     = productsAll[id] || {};
  const prodCount  = Object.values(p).reduce((s, a) => s + a.length, 0);
  const skuCount   = new Set(Object.values(p).flat().map(pr => pr.code)).size;
  if (prodCount > 0) {
    await showNotice({
      title: 'DEPÓSITO COM PRODUTOS',
      icon: '⛔',
      desc: `Não é possível excluir "${depot?.name}" enquanto houver produtos armazenados.`,
      summary: { PRODUTOS: String(prodCount), SKUS: String(skuCount) },
    });
    return;
  }
  if (slist.length > 0) {
    await showNotice({
      title: 'DEPÓSITO COM PRATELEIRAS',
      icon: '⛔',
      desc: `Não é possível excluir "${depot?.name}" enquanto houver prateleiras cadastradas.`,
      summary: { PRATELEIRAS: String(slist.length), CÓDIGOS: slist.map(item => item.id).join(', ') || '—' },
    });
    return;
  }
  const ok = await showConfirm({
    title: 'EXCLUIR DEPÓSITO', icon: '🗑',
    desc: 'Esta ação é permanente. O depósito será removido do sistema.',
    summary: { 'NOME': depot?.name||id, 'PRATELEIRAS': slist.length, 'PRODUTOS': prodCount },
    okLabel: 'EXCLUIR', okStyle: 'danger'
  });
  if (!ok) return;
  depots = depots.filter(d => d.id !== id);
  delete shelvesAll[id]; delete productsAll[id];
  Object.keys(fpLayout || {}).forEach(key => { if (key.startsWith(`${id}::`)) delete fpLayout[key]; });
  fpObjects = (fpObjects || []).filter(obj => obj.depotId !== id);
  const removedWasActive = activeDepotId === id;
  if (removedWasActive && depots[0]?.id) activeDepotId = depots[0].id;
  await Promise.all([
    persistStructureState(),
    persistFloorplanState(),
  ]);
  if (removedWasActive && depots[0]?.id) switchDepot(depots[0].id);
  else { renderDepotTabs(); renderAll(true); }
}

function renameDepot(id) { openDepotModal(id); }

function getCurrentPageName() {
  const activePage = document.querySelector('.page.active');
  return activePage?.id?.replace(/^page-/, '') || 'depot';
}

function canOpenPage(name) {
  if (!name) return false;
  if (name === 'saidas') return hasPermission('shipment.process') || hasPermission('discard.process');
  if (name === 'separation') return hasPermission('shipment.process');
  if (name === 'unloads') return hasBlindCountAccess();
  if (name === 'receiving') return hasPermission('entry.register');
  if (name === 'unload-review') return canReviewBlindUnloads();
  return true;
}

function getVisibleNavPages() {
  return Array.from(document.querySelectorAll('.nav-rail .nav-btn[data-page]'))
    .filter(btn => {
      if (!btn.id?.startsWith('nav-')) return false;
      if (btn.disabled) return false;
      const style = getComputedStyle(btn);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map(btn => btn.dataset.page)
    .filter(Boolean);
}

function getFallbackPageName(preferred = '') {
  if (preferred && canOpenPage(preferred)) {
    const preferredBtn = document.getElementById(`nav-${preferred}`);
    if (preferredBtn && getComputedStyle(preferredBtn).display !== 'none') return preferred;
  }
  return getVisibleNavPages().find(pageName => canOpenPage(pageName)) || 'depot';
}

function ensurePageNavigationConsistency(preferredPage = '') {
  const current = getCurrentPageName();
  const pageName = document.getElementById(`page-${current}`) ? current : '';
  const btn = pageName ? document.getElementById(`nav-${pageName}`) : null;
  const currentVisible = pageName && canOpenPage(pageName) && (!btn || getComputedStyle(btn).display !== 'none');
  const target = currentVisible ? pageName : getFallbackPageName(preferredPage || pageName || 'depot');
  if (!target) return;
  if (target !== pageName) {
    showPage(target);
    return;
  }
  const page = document.getElementById(`page-${target}`);
  if (page && !page.classList.contains('active')) page.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(node => {
    const active = node.dataset.page === target;
    node.classList.toggle('active', active);
    if (active) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
}

function applyDepotContextForCurrentPage(depotId) {
  const pageName = getCurrentPageName();
  depotTabsContextId = depotId;
  if (pageName === 'depots') {
    renderDepotTabs();
    renderDepotsPage();
    return;
  }
  if (pageName === 'floorplan') {
    fpSwitchDepot(depotId);
    renderDepotTabs();
    return;
  }
  if (pageName === 'quality') {
    const select = byId('quality-filter-depot');
    if (select) select.value = depotId === ALL_DEPOTS_VALUE ? '' : depotId;
    renderQualityPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'history') {
    const select = byId('history-filter-depot');
    if (select) select.value = depotId === ALL_DEPOTS_VALUE ? '' : (getDepotById(depotId)?.name || depotId);
    renderPageHistory();
    renderDepotTabs();
    return;
  }
  if (pageName === 'saidas') {
    const select = byId('shipping-source-depot');
    if (select) select.value = depotId;
    renderShippingPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'products') {
    renderProductsPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'unloads') {
    renderUnloadsPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'unload-review') {
    renderUnloadReviewPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'outbound') {
    renderOutboundRecordsPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'depot') {
    if (depotId === ALL_DEPOTS_VALUE) {
      depotTabsContextId = ALL_DEPOTS_VALUE;
      renderAll(true);
      renderDepotTabs();
      return;
    }
    depotTabsContextId = depotId;
    switchDepot(depotId);
    return;
  }
  if (depotId === ALL_DEPOTS_VALUE) {
    renderDepotTabs();
    return;
  }
  switchDepot(depotId);
}

function renderDepotTabs() {
  const bar = document.getElementById('depot-tabs-bar');
  if (!bar) return;
  const pageName = getCurrentPageName();
  const supportedPages = new Set(['depot', 'depots', 'unloads', 'unload-review', 'saidas', 'products', 'floorplan', 'quality', 'outbound', 'history']);
  const shouldHide = !supportedPages.has(pageName);
  bar.style.display = shouldHide ? 'none' : '';
  if (shouldHide) {
    bar.replaceChildren();
    return;
  }
  const canManageDepots = hasPermission('settings.manage');
  const depotsPageActive = pageName === 'depots';
  bar.replaceChildren();

  const allTab = document.createElement('div');
  const currentSelection = pageName === 'floorplan'
    ? (fpShowAllDepots ? ALL_DEPOTS_VALUE : (fpViewDepotId || activeDepotId))
    : getDepotTabsContextId();
  allTab.className = `depot-tab ${currentSelection === ALL_DEPOTS_VALUE || depotsPageActive ? 'active' : ''}`.trim();
  allTab.title = 'Visão consolidada de todos os depósitos';
  allTab.addEventListener('click', () => applyDepotContextForCurrentPage(ALL_DEPOTS_VALUE));
  const allLabel = document.createElement('span');
  allLabel.textContent = 'TODOS OS DEPÓSITOS';
  allTab.appendChild(allLabel);
  bar.appendChild(allTab);

  depots.forEach(d => {
    const tab = document.createElement('div');
    tab.className = `depot-tab ${d.id === currentSelection ? 'active' : ''} ${isDiscardDepot(d) ? 'discard' : ''}`.trim();
    tab.addEventListener('click', () => applyDepotContextForCurrentPage(d.id));

    const label = document.createElement('span');
    label.textContent = d.name || d.id;
    tab.appendChild(label);

    if (canManageDepots) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'depot-tab-edit';
      editBtn.title = 'Renomear';
      editBtn.textContent = '✏';
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        renameDepot(d.id);
      });
      tab.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'depot-tab-del';
      delBtn.title = 'Remover';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', event => {
        event.stopPropagation();
        removeDepot(d.id);
      });
      tab.appendChild(delBtn);
    }

    bar.appendChild(tab);
  });
  if (canManageDepots) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'depot-tab-add';
    addBtn.title = 'Adicionar depósito';
    addBtn.textContent = '+ DEPÓSITO';
    addBtn.addEventListener('click', () => openDepotModal(null));
    bar.appendChild(addBtn);
  }
}
// products is now productsAll[activeDepotId] — see shim above
let auditHistory = []; // { ts, action, detail, icon, user, depotId, depotName, from, to, shelfId, drawerKey, productCode }
let selectedProductCode = null;
let currentDrawerKey = null;
let moveProductIdx = null;
let moveFromKey = null;
let dpExpiries = [];   // working list for drawer modal add form
let gpExpiries = [];   // working list for global add product modal
let dateEditCtx = null; // { list, idx, renderFn }
let selectedEditIdx = null; // product index being edited in drawer modal
let poSortCol = 'code'; let poSortDir = 1;
let focusedDrawerKey = null;
let qualityMoveCtx = null;
let shippingSelected = { depotId: null, drawerKey: null };
let shippingAddCtx = null;
let shippingDragCtx = null;
let outboundEditIdx = null;
let outboundCart = [];
let appToastTimer = null;
let outboundRecords = [];
let blindCountSelected = { depotId: null, drawerKey: null };
let blindCountFocusedItemId = null;
let blindCountAllocationCtx = null;
let blindCountDragItemId = null;
let blindCountPool = [];
let blindCountRecords = [];
let blindUnloadDraft = null;
let activeBlindUnloadId = null;
let blindTimerInterval = null;
let blindPendingInvoiceBarcodes = [];
let blindPendingVehiclePlate = '';
let separationDraftItems = [];
let separationLookupResults = [];
let separationSelectedLookupItem = null;
let separationRecentRequests = [];
let separationSelectedRequestId = null;
let separationSelectedRequestDetail = null;
let separationLoadedOnce = false;
let separationSearchTimer = null;
let separationSearchRequestId = 0;
let receivingSession = null;
let receivingItems = [];
let receivingTimerInterval = null;
let receivingStartedAt = null;
let receivingStep = 1;
let receivingAvailableNfes = [];
let receivingHistoryRecords = [];
let receivingSelectedNfe = null;
let receivingClosePreview = null;
let receivingDoubleCheckRequired = false;

