// ═══════════════════════════════════════════════════════════
// MODULE: products-page.js
// ═══════════════════════════════════════════════════════════

// ══ PRODUCTS OVERVIEW PAGE ════════════════════════════════════════════

// ── Column toggle ──────────────────────────────────────────────────
function poToggleColMenu() {
  const m = document.getElementById('po-col-menu'); if(!m) return;
  if (!m.innerHTML) {
    m.innerHTML = Object.keys(poColumns).map(k =>
      `<div class="po-col-item"><input type="checkbox" id="pocol-${k}" ${poColumns[k]?'checked':''} onchange="poToggleCol('${k}')"><label for="pocol-${k}">${PO_COL_LABELS[k]}</label></div>`
    ).join('');
  }
  m.classList.toggle('open');
}
function poToggleCol(k) {
  poColumns[k] = document.getElementById('pocol-'+k)?.checked ? 1 : 0;
  renderProductsPage();
}
document.addEventListener('click', e => {
  const menu = document.getElementById('po-col-menu');
  if (menu && !menu.closest('.po-header')?.contains(e.target)) menu.classList.remove('open');
  const separationMenu = document.getElementById('separation-product-menu');
  const separationWrap = document.querySelector('.separation-lookup-group');
  if (separationMenu && separationWrap && !separationWrap.contains(e.target)) resetSeparationLookup();
});


function poSort(col) {
  if (poSortColRef === col) poSortDirRef = -poSortDirRef;
  else { poSortColRef = col; poSortDirRef = 1; }
  renderProductsPage();
}

function poRenderHeaders() {
  const thead = document.getElementById('po-thead'); if(!thead) return;
  const cols = Object.keys(poColumns).filter(k=>poColumns[k]);
  thead.innerHTML = '<tr>'+cols.map(k=>`<th draggable="true" data-col-key="${escapeAttr(k)}" onclick="poSort('${k}')">${PO_COL_LABELS[k]}</th>`).join('')+'</tr>';
}

function poRenderRow(p) {
  const nearest = p.nearest;
  const days    = nearest ? daysUntil(nearest) : null;
  const daysStr = days===null ? '—' : days < 0 ? `<span style="color:var(--danger);font-weight:700">${Math.abs(days)}d VENC.</span>`
                : days===0  ? `<span style="color:var(--danger);font-weight:700">HOJE</span>`
                : days<=30  ? `<span style="color:var(--warn);font-weight:700">${days}d</span>`
                : `<span style="color:var(--accent3)">${days}d</span>`;
  const statusBadge = p.statusKey==='expired' ? '<span class="status-badge expired">VENCIDO</span>'
    : p.statusKey==='expiring' ? '<span class="status-badge expiring">A VENCER</span>'
    : p.statusKey==='ok'      ? '<span class="status-badge ok">OK</span>'
    : '<span class="status-badge none">SEM VAL.</span>';
  const _stCls = p.statusKey==='expired'?'expired':p.statusKey==='expiring'?'expiring':p.statusKey==='ok'?'ok':'none';
  const locTags = p.locations.map(loc =>
    `<span class="status-badge ${_stCls} loc-tag" data-loc="${loc}" data-code="${p.code}" onclick="event.stopPropagation();navigateToDrawer(this.dataset.loc,this.dataset.code)">${loc}</span>`
  ).join(' ');

  const cellMap = {
    code:       `<td class="td-code">${escapeHtml(p.code)}</td>`,
    name:       `<td class="col-name">${escapeHtml(p.name)}</td>`,
    sku:        `<td>${escapeHtml(p.sku||'—')}</td>`,
    qty:        `<td style="text-align:right">${escapeHtml(String(p.qty))}</td>`,
    kg:         `<td style="text-align:right">${escapeHtml(p.kg.toFixed(2))}</td>`,
    entry:      `<td>${escapeHtml(p.lastEntry||'—')}</td>`,
    status:     `<td>${statusBadge}</td>`,
    nearest:    `<td>${nearest?escapeHtml(fmtDate(nearest)):'—'}</td>`,
    days:       `<td>${escapeHtml(daysStr)}</td>`,
    brand:      `<td>${escapeHtml(p.brand||'—')}</td>`,
    manufacturer:`<td>${escapeHtml(p.manufacturer||'—')}</td>`,
    model:      `<td>${escapeHtml(p.model||'—')}</td>`,
    family:     `<td>${escapeHtml(p.family||'—')}</td>`,
    category:   `<td>${escapeHtml(p.category||'—')}</td>`,
    supplier:   `<td>${escapeHtml(p.supplier||'—')}</td>`,
    unit:       `<td>${escapeHtml(p.unit||'un')}</td>`,
    lot:        `<td>${escapeHtml(p.lot||'—')}</td>`,
    ean:        `<td>${escapeHtml(p.ean||'—')}</td>`,
    ncm:        `<td>${escapeHtml(p.ncm||'—')}</td>`,
    anvisa:     `<td>${escapeHtml(p.anvisa||'—')}</td>`,
    serialControl: `<td>${escapeHtml(p.serialControl||'—')}</td>`,
    tempMin:    `<td>${p.tempMin!=null?escapeHtml(String(p.tempMin)):'—'}</td>`,
    tempMax:    `<td>${p.tempMax!=null?escapeHtml(String(p.tempMax)):'—'}</td>`,
    minStock:   `<td>${p.minStock!=null?escapeHtml(String(p.minStock)):'—'}</td>`,
    maxStock:   `<td>${p.maxStock!=null?escapeHtml(String(p.maxStock)):'—'}</td>`,
    reorderPoint:`<td>${p.reorderPoint!=null?escapeHtml(String(p.reorderPoint)):'—'}</td>`,
    perishable: `<td>${escapeHtml(p.perishable==='yes'?'SIM':p.perishable==='frozen'?'CONGELADO':'NÃO')}</td>`,
    cost:       `<td>${p.cost!=null?'R$ '+escapeHtml(parseFloat(p.cost).toFixed(2)):'—'}</td>`,
    price:      `<td>${p.price!=null?'R$ '+escapeHtml(parseFloat(p.price).toFixed(2)):'—'}</td>`,
    notes:      `<td class="col-name">${escapeHtml(p.notes||'—')}</td>`,
    locations:  `<td class="col-locs" style="padding-right:6px">${locTags}</td>`,
  };
  const visibleCols = Object.keys(poColumns).filter(k=>poColumns[k]);
  return `<tr class="${p.statusKey==='expired'?'row-expired':p.statusKey==='expiring'?'row-expiring':''}" data-prod-code="${escapeAttr(p.code)}" onclick="openProductDetail(this.dataset.prodCode)" style="cursor:pointer">${visibleCols.map(k=>cellMap[k]||'<td>—</td>').join('')}</tr>`;
}

let poSortColRef = 'code', poSortDirRef = 1;
let poKpiFilter = '';
// Column visibility
let poColumns = {
  code:1, name:1, qty:1, kg:1, entry:1, status:1, nearest:1, days:1,
  sku:0, brand:0, manufacturer:0, model:0, family:0, category:0, supplier:0, unit:0, lot:0, ean:0, ncm:0, anvisa:0,
  serialControl:0, tempMin:0, tempMax:0, minStock:0, maxStock:0, reorderPoint:0, perishable:0, cost:0, price:0, notes:0, locations:1
};
const PO_COL_LABELS = {
  code:'CÓDIGO', name:'NOME', qty:'QTD', kg:'PESO', entry:'ÚLTIMA ENTRADA',
  status:'STATUS', nearest:'PRÓX. VENC.', days:'DIAS P/ VENC.',
  sku:'SKU', brand:'MARCA', manufacturer:'FABRICANTE', model:'MODELO',
  family:'FAMÍLIA', category:'GRUPO', supplier:'FORNECEDOR', unit:'UNIDADE', lot:'LOTE',
  ean:'EAN', ncm:'NCM', anvisa:'ANVISA', serialControl:'CONTROLE SÉRIE', tempMin:'TEMP. MÍN', tempMax:'TEMP. MÁX',
  minStock:'ESTOQUE MÍN', maxStock:'ESTOQUE MÁX', reorderPoint:'PONTO REPOS.', perishable:'PERECÍVEL',
  cost:'CUSTO', price:'PREÇO', notes:'OBSERVAÇÕES', locations:'LOCALIZAÇÕES'
}; // active KPI filter key

function getAllProductsDetail() {
  const map = {};
  const scopeDepotId = getDepotTabsContextId();
  const scopedDepots = scopeDepotId === ALL_DEPOTS_VALUE ? depots.map(item => item.id) : [scopeDepotId];
  scopedDepots.forEach(depotId => {
    Object.entries(productsAll[depotId] || {}).forEach(([key, prods]) => {
      prods.forEach(p => {
        if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [], entries: [], allExpiries: [] };
        const rec = map[p.code];
        rec.qty++;
        rec.kg += parseFloat(p.kg) || 0;
        const locationLabel = scopeDepotId === ALL_DEPOTS_VALUE ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key;
        if (!rec.locations.includes(locationLabel)) rec.locations.push(locationLabel);
        if (p.entry) rec.entries.push(p.entry);
        if (p.expiryControl!=='no') getExpiries(p).filter(Boolean).forEach(d => { if (!rec.allExpiries.includes(d)) rec.allExpiries.push(d); });
        ['ean','sku','brand','manufacturer','model','family','category','supplier','unit','lot','perishable','serialControl','cost','price','tempMax','tempMin','anvisa','ncm','notes','minStock','maxStock','reorderPoint'].forEach(f=>{ if(!rec[f]&&p[f] != null) rec[f]=p[f]; });
      });
    });
  });
  return Object.values(map).map(r => {
    r.allExpiries.sort();
    r.nearest = r.allExpiries[0] || null;
    r.latestEntry = r.entries.sort().slice(-1)[0] || null;
    const st = r.nearest ? expiryStatus(r.nearest) : 'none';
    r.statusKey = st;
    return r;
  });
}

function renderProductsPage() {
  poRenderHeaders();
  const q  = (document.getElementById('po-search')?.value || '').toLowerCase();
  const fs = document.getElementById('po-filter-status')?.value || '';
  const fsh = document.getElementById('po-filter-shelf')?.value || '';
  const scopeDepotId = getDepotTabsContextId();

  // populate shelf filter
  const shelfSel = document.getElementById('po-filter-shelf');
  if (shelfSel) {
    const shelfRows = (scopeDepotId === ALL_DEPOTS_VALUE
      ? depots.flatMap(depot => (shelvesAll[depot.id] || []).map(shelf => ({ ...shelf, depotId: depot.id })))
      : (shelvesAll[scopeDepotId] || []).map(shelf => ({ ...shelf, depotId: scopeDepotId })));
    const current = shelfSel.value || '';
    shelfSel.innerHTML = '<option value="">Todas prateleiras</option>';
    shelfRows.forEach(s => {
      const o = document.createElement('option');
      o.value = scopeDepotId === ALL_DEPOTS_VALUE ? `${s.depotId}::${s.id}` : s.id;
      o.textContent = scopeDepotId === ALL_DEPOTS_VALUE ? `Prateleira ${s.id} · ${getDepotById(s.depotId)?.name || s.depotId}` : 'Prateleira ' + s.id;
      shelfSel.appendChild(o);
    });
    if (Array.from(shelfSel.options).some(option => option.value === current)) shelfSel.value = current;
  }

  // KPI
  const kpiEl = document.getElementById('po-kpi-grid');
  // KPIs computed from ALL rows (before filters)
  const allRows = getAllProductsDetail();
  if (kpiEl) {
    const totalKg  = allRows.reduce((s,r) => s + r.kg, 0);
    const expired  = allRows.filter(r => r.statusKey === 'expired').length;
    const expiring = allRows.filter(r => r.statusKey === 'expiring').length;
    const multiLoc = allRows.filter(r => r.locations.length > 1).length;
    const noVal    = allRows.filter(r => r.statusKey === 'none').length;
    const kpiData = [
      { key: '',         label: 'SKUs DISTINTOS', value: allRows.length, sub: allRows.reduce((s,r)=>s+r.qty,0)+' entradas totais', color: 'var(--accent)' },
      { key: 'weight',   label: 'PESO TOTAL',     value: totalKg.toFixed(1), sub: 'kg armazenados', color: 'var(--warn)' },
      { key: 'expired',  label: 'VENCIDOS',        value: expired,  sub: 'SKUs com val. vencida', color: 'var(--danger)' },
      { key: 'expiring', label: 'A VENCER (30d)',  value: expiring, sub: 'SKUs próximos de vencer', color: 'var(--warn)' },
      { key: 'multi',    label: 'MULTI-LOCAL',     value: multiLoc, sub: 'SKUs em 2+ locais', color: 'var(--accent2)' },
      { key: 'none',     label: 'SEM VALIDADE',    value: noVal,    sub: 'SKUs sem data cadastrada', color: 'var(--text3)' },
    ];
    kpiEl.innerHTML = kpiData.map(k =>
      `<div class="po-kpi ${poKpiFilter === k.key ? 'active' : ''}" onclick="setPoKpiFilter('${k.key}')">
        <div class="po-kpi-label">${k.label}</div>
        <div class="po-kpi-value" style="color:${k.color}">${k.value}</div>
        <div class="po-kpi-sub">${k.sub}</div>
      </div>`
    ).join('');
  }

  // filters
  let rows = getAllProductsDetail();
  if (q) rows = rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  // KPI card filter takes precedence over dropdown if set
  const activeStatus = poKpiFilter && poKpiFilter !== 'weight' && poKpiFilter !== 'multi' ? poKpiFilter : fs;
  if (poKpiFilter === 'multi') rows = rows.filter(r => r.locations.length > 1);
  else if (activeStatus) rows = rows.filter(r => r.statusKey === activeStatus);
  else if (fs) rows = rows.filter(r => r.statusKey === fs);
  if (fsh) {
    if (scopeDepotId === ALL_DEPOTS_VALUE && fsh.includes('::')) {
      const [filterDepotId, filterShelfId] = fsh.split('::');
      const depotName = getDepotById(filterDepotId)?.name || filterDepotId;
      rows = rows.filter(r => r.locations.some(l => l.startsWith(`${depotName} · ${filterShelfId}`)));
    } else {
      rows = rows.filter(r => r.locations.some(l => l.includes(fsh)));
    }
  }

  // sort
  rows.sort((a,b) => {
    let va = a[poSortColRef], vb = b[poSortColRef];
    if (poSortColRef === 'status') { va = a.statusKey; vb = b.statusKey; }
    if (poSortColRef === 'nearest') { va = a.nearest || 'z'; vb = b.nearest || 'z'; }
    if (va === undefined || va === null) va = '';
    if (vb === undefined || vb === null) vb = '';
    return va < vb ? -poSortDirRef : va > vb ? poSortDirRef : 0;
  });

  // update sort indicators
  const visibleCols = Object.keys(poColumns).filter(k => poColumns[k]);
  const idx = visibleCols.indexOf(poSortColRef);
  document.querySelectorAll('#po-thead th').forEach((th, i) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (i === idx) th.classList.add(poSortDirRef === 1 ? 'sort-asc' : 'sort-desc');
  });

  const tbody = document.getElementById('po-tbody');
  if (!tbody) return;
    tbody.innerHTML = rows.map(r => poRenderRow(r)).join('');
  queueEnhanceResizableTables();
}

// ══ PAGE HISTORY ═════════════════════════════════════════════════════
function renderPageHistory() {
  const el = document.getElementById('page-history-list');
  if (!el) return;
  syncHistoryFilterOptions();
  const rows = getFilteredHistory();
  if (!rows.length) { el.innerHTML = '<div class="empty-msg">Nenhuma movimentação registrada para os filtros atuais</div>'; return; }
  el.innerHTML = rows.map(h => {
    const d = new Date(h.ts);
    const time = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const extra = [
      h.user ? `Usuário: ${escapeHtml(h.user)}` : '',
      h.depotName ? `Depósito: ${escapeHtml(h.depotName)}` : '',
      h.from ? `Origem: ${escapeHtml(h.from)}` : '',
      h.to ? `Destino: ${escapeHtml(h.to)}` : '',
      h.drawerKey ? `Gaveta: ${escapeHtml(h.drawerKey)}` : '',
      h.productCode ? `Produto: ${escapeHtml(h.productCode)}` : '',
    ].filter(Boolean).join(' · ');
    return `<div class="hist-item"><div class="hist-icon">${escapeHtml(h.icon || '•')}</div><div class="hist-body"><div class="hist-action">${escapeHtml(h.action || 'Evento')}</div><div class="hist-meta">${escapeHtml(h.detail || '')}${extra ? '<br>' + extra : ''}</div></div><div class="hist-time">${time}</div></div>`;
  }).join('');
}

function syncHistoryFilterOptions() {
  const typeEl = document.getElementById('history-filter-type');
  const depotEl = document.getElementById('history-filter-depot');
  if (typeEl) {
    const current = typeEl.value;
    const values = [...new Set(auditHistory.map(item => item.type || inferHistoryType(item.action, item.icon)).filter(Boolean))].sort();
    typeEl.innerHTML = `<option value="">Todas movimentações</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    typeEl.value = values.includes(current) ? current : '';
  }
  if (depotEl) {
    const current = depotEl.value;
    const values = [...new Set(auditHistory.map(item => item.depotName || '').filter(Boolean))].sort();
    depotEl.innerHTML = `<option value="">Todos depósitos</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    depotEl.value = values.includes(current) ? current : '';
  }
}

function getFilteredHistory() {
  const scopeDepotId = getDepotTabsContextId();
  const user = (document.getElementById('history-filter-user')?.value || '').trim().toLowerCase();
  const type = document.getElementById('history-filter-type')?.value || '';
  const depot = document.getElementById('history-filter-depot')?.value || '';
  const product = (document.getElementById('history-filter-product')?.value || '').trim().toLowerCase();
  const from = document.getElementById('history-filter-from')?.value || '';
  const to = document.getElementById('history-filter-to')?.value || '';
  return auditHistory.filter(item => {
    const ts = item.ts ? item.ts.slice(0, 10) : '';
    if (scopeDepotId !== ALL_DEPOTS_VALUE && item.depotId !== scopeDepotId) return false;
    if (user && !(item.user || '').toLowerCase().includes(user)) return false;
    if (type && (item.type || inferHistoryType(item.action, item.icon)) !== type) return false;
    if (depot && (item.depotName || '') !== depot) return false;
    if (product) {
      const hay = [item.productCode, item.action, item.detail].join(' ').toLowerCase();
      if (!hay.includes(product)) return false;
    }
    if (from && (!ts || ts < from)) return false;
    if (to && (!ts || ts > to)) return false;
    return true;
  });
}

function clearHistoryFilters() {
  clearFilterBar('history-filter-bar', renderPageHistory);
  return;
  ['history-filter-user','history-filter-product','history-filter-from','history-filter-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['history-filter-type','history-filter-depot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderPageHistory();
}

// ══ DRAWER INLINE EDIT ════════════════════════════════════════════════
// ══ UNIFIED PRODUCT FORM MODAL ════════════════════════════════════════
let pfEditIdx = null;    // null = add mode, number = edit mode
let pfExpiries = [];     // working expiry list for this form

function openProductForm(idx) {
  if (!canManageProducts()) return;
  pfEditIdx = idx;
  pfExpiries = [];
  pfSwitchTab('basic');

  const isEdit = idx !== null && idx !== undefined;
  document.getElementById('pf-title').textContent = isEdit ? '✏ EDITAR PRODUTO' : '+ ADICIONAR PRODUTO';

  const today = new Date().toISOString().slice(0,10);

  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const newFields = ['pf-ean','pf-sku','pf-family','pf-category','pf-supplier','pf-unit','pf-qty','pf-kg-unit','pf-kg-total','pf-lot','pf-temp-max','pf-temp-min','pf-brand','pf-manufacturer','pf-model','pf-anvisa','pf-ncm','pf-cost','pf-price','pf-min-stock','pf-max-stock','pf-reorder-point','pf-length-cm','pf-width-cm','pf-height-cm','pf-perishable','pf-serial-control','pf-expiry-control','pf-notes'];

  if (isEdit) {
    const p = (products[currentDrawerKey] || [])[idx];
    if (!p) return;
    pfExpiries = [...getExpiries(p).filter(Boolean)];
    setV('pf-code',  p.code);
    setV('pf-name',  p.name);
    setV('pf-kg',    p.kg);
    setV('pf-entry', p.entry || today);
    // extended fields
    setV('pf-ean',      p.ean      || '');
    setV('pf-sku',      p.sku      || '');
    setV('pf-family',   p.family   || '');
    setV('pf-category', p.category || '');
    setV('pf-supplier', p.supplier || '');
    setV('pf-unit',     p.unit     || 'un');
    setV('pf-qty',      p.qty      || 1);
    setV('pf-kg-unit',  p.kgPerUnit != null ? p.kgPerUnit : ((p.qty||1) ? (parseFloat(p.kg||0)/(p.qty||1)) : ''));
    setV('pf-kg-total', p.kgTotal != null ? p.kgTotal : (p.kg != null ? p.kg : ''));
    setV('pf-lot',      p.lot      || '');
    setV('pf-temp-max', p.tempMax  != null ? p.tempMax : '');
    setV('pf-temp-min', p.tempMin  != null ? p.tempMin : '');
    setV('pf-brand',    p.brand    || '');
    setV('pf-manufacturer', p.manufacturer || '');
    setV('pf-model',    p.model    || '');
    setV('pf-anvisa',   p.anvisa   || '');
    setV('pf-ncm',      p.ncm      || '');
    setV('pf-cost',     p.cost     != null ? p.cost : '');
    setV('pf-price',    p.price    != null ? p.price : '');
    setV('pf-min-stock', p.minStock != null ? p.minStock : '');
    setV('pf-max-stock', p.maxStock != null ? p.maxStock : '');
    setV('pf-reorder-point', p.reorderPoint != null ? p.reorderPoint : '');
    setV('pf-length-cm', p.lengthCm != null ? p.lengthCm : '');
    setV('pf-width-cm',  p.widthCm != null ? p.widthCm : '');
    setV('pf-height-cm', p.heightCm != null ? p.heightCm : '');
    setV('pf-perishable',    p.perishable    || 'no');
    setV('pf-serial-control', p.serialControl || 'none');
    setV('pf-expiry-control', p.expiryControl || 'yes');
    setV('pf-notes',    p.notes    || '');

    const footer = document.getElementById('pf-footer');
    if (footer) footer.innerHTML = `
      <button class="btn btn-danger" onclick="pfDeleteProduct()">✕ EXCLUIR</button>
      <div style="flex:1"></div>
      <button class="btn" onclick="closeProductForm()">CANCELAR</button>
      <button class="btn btn-accent" onclick="saveProductForm()">✓ SALVAR EDIÇÃO</button>
    `;
  } else {
    setV('pf-code',  ''); setV('pf-name',  ''); setV('pf-kg',    ''); setV('pf-entry', today);
    newFields.forEach(id => { const el=document.getElementById(id); if(el&&el.tagName==='SELECT')el.selectedIndex=0; else if(el)el.value=''; });
    setV('pf-qty', 1); setV('pf-unit','un');
    const footer = document.getElementById('pf-footer');
    if (footer) footer.innerHTML = `
      <button class="btn" onclick="closeProductForm()">CANCELAR</button>
      <button class="btn btn-accent" onclick="saveProductForm()">+ ADICIONAR</button>
    `;
  }

  renderPfChips();
  syncWeightFields('pf', 'qty');
  const pfExpIn = document.getElementById('pf-expiry-input');
  if (pfExpIn) pfExpIn.value = '';
  document.getElementById('product-form-modal').classList.add('open');
}

function closeProductForm() {
  document.getElementById('product-form-modal').classList.remove('open');
  pfEditIdx = null;
  pfExpiries = [];
}

function pfAddExpiry() {
  const pfIn = document.getElementById('pf-expiry-input');
  const val = pfIn ? pfIn.value : '';
  if (!val) return;
  if (!pfExpiries.includes(val)) pfExpiries.push(val);
  pfExpiries.sort();
  if (pfIn) pfIn.value = '';
  renderPfChips();
  pfUpdateDaysInfo();
}

function renderPfChips() {
  const c = document.getElementById('pf-expiry-chips');
  if (!c) return;
  if (!pfExpiries.length) {
    c.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
    return;
  }
  c.innerHTML = pfExpiries.map((d,i) => {
    const st = expiryStatus(d);
    return `<span class="exp-chip ${st}">${fmtDate(d)}
      <button class="chip-edit" onclick="pfEditExpiry(${i})">✏</button>
    </span>`;
  }).join('');
}

function pfEditExpiry(idx) {
  dateEditCtx = {
    type: 'pfForm', dateIdx: idx, list: [...pfExpiries],
    save: (newList) => { pfExpiries = newList; renderPfChips(); }
  };
  document.getElementById('date-edit-title').textContent = 'EDITAR VALIDADE';
  document.getElementById('date-edit-input').value = pfExpiries[idx] || '';
  document.getElementById('date-edit-modal').classList.add('open');
}

async function saveProductForm() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode criar ou editar produtos.')) return;
  const code  = sanitizeTextInput(document.getElementById('pf-code')?.value, { maxLength: 40, uppercase: true });
  const name  = sanitizeTextInput(document.getElementById('pf-name')?.value, { maxLength: 120 });
  syncWeightFields('pf', 'qty');
  const kg    = parseFloat(document.getElementById('pf-kg-total')?.value || document.getElementById('pf-kg')?.value) || 0;
  const entry = document.getElementById('pf-entry')?.value || '';
  const expiryControl = document.getElementById('pf-expiry-control')?.value || 'yes';
  const extFields = {
    ean:      sanitizeTextInput(document.getElementById('pf-ean')?.value, { maxLength: 40, uppercase: true }),
    sku:      sanitizeTextInput(document.getElementById('pf-sku')?.value, { maxLength: 60, uppercase: true }),
    family:   sanitizeTextInput(document.getElementById('pf-family')?.value, { maxLength: 120 }),
    category: sanitizeTextInput(document.getElementById('pf-category')?.value, { maxLength: 80 }),
    supplier: sanitizeTextInput(document.getElementById('pf-supplier')?.value, { maxLength: 120 }),
    unit:     document.getElementById('pf-unit')?.value||'un',
    qty:      parseInt(document.getElementById('pf-qty')?.value)||1,
    kgPerUnit: parseFloat(document.getElementById('pf-kg-unit')?.value) || 0,
    kgTotal: kg,
    lot:      sanitizeTextInput(document.getElementById('pf-lot')?.value, { maxLength: 60, uppercase: true }),
    tempMax:  document.getElementById('pf-temp-max')?.value!==''?parseFloat(document.getElementById('pf-temp-max').value):null,
    tempMin:  document.getElementById('pf-temp-min')?.value!==''?parseFloat(document.getElementById('pf-temp-min').value):null,
    brand:    sanitizeTextInput(document.getElementById('pf-brand')?.value, { maxLength: 80 }),
    manufacturer: sanitizeTextInput(document.getElementById('pf-manufacturer')?.value, { maxLength: 120 }),
    model:    sanitizeTextInput(document.getElementById('pf-model')?.value, { maxLength: 80 }),
    anvisa:   sanitizeTextInput(document.getElementById('pf-anvisa')?.value, { maxLength: 60, uppercase: true }),
    ncm:      sanitizeTextInput(document.getElementById('pf-ncm')?.value, { maxLength: 30, uppercase: true }),
    cost:     document.getElementById('pf-cost')?.value!==''?parseFloat(document.getElementById('pf-cost').value):null,
    price:    document.getElementById('pf-price')?.value!==''?parseFloat(document.getElementById('pf-price').value):null,
    minStock: document.getElementById('pf-min-stock')?.value!==''?parseInt(document.getElementById('pf-min-stock').value):null,
    maxStock: document.getElementById('pf-max-stock')?.value!==''?parseInt(document.getElementById('pf-max-stock').value):null,
    reorderPoint: document.getElementById('pf-reorder-point')?.value!==''?parseInt(document.getElementById('pf-reorder-point').value):null,
    lengthCm: document.getElementById('pf-length-cm')?.value!==''?parseFloat(document.getElementById('pf-length-cm').value):null,
    widthCm:  document.getElementById('pf-width-cm')?.value!==''?parseFloat(document.getElementById('pf-width-cm').value):null,
    heightCm: document.getElementById('pf-height-cm')?.value!==''?parseFloat(document.getElementById('pf-height-cm').value):null,
    perishable: document.getElementById('pf-perishable')?.value||'no',
    serialControl: document.getElementById('pf-serial-control')?.value||'none',
    expiryControl,
    notes:    sanitizeTextInput(document.getElementById('pf-notes')?.value, { maxLength: 240 }),
  };
  const finalExpiries = expiryControl==='no' ? [] : [...pfExpiries];
  if (!code || !name) {
    await showNotice({ title: 'CAMPOS OBRIGATÓRIOS', icon: '⛔', desc: 'Código e nome do produto são obrigatórios.' });
    return;
  }

  if (!products[currentDrawerKey]) products[currentDrawerKey] = [];
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: currentDrawerKey,
    incomingKg: kg,
    sourceDrawerKey: currentDrawerKey,
    sourceProductIdx: pfEditIdx,
    allowExistingSameDrawer: pfEditIdx !== null,
  });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  if (pfEditIdx !== null) {
    const okEdit = await showConfirm({ title:'EDITAR PRODUTO', icon:'✏', desc:'Salvar as alterações neste produto?', summary:{'CÓDIGO':code,'NOME':name,'PESO':kg+'kg','GAVETA':currentDrawerKey}, okLabel:'SALVAR', okStyle:'accent' }); if(!okEdit) return;
    const p = products[currentDrawerKey][pfEditIdx];
    products[currentDrawerKey][pfEditIdx] = { ...p, code, name, kg, entry, expiries: finalExpiries, ...extFields };
    logHistory('✏', `Editado: ${code} — ${name}`, `${currentDrawerKey}`, { depotId: activeDepotId, drawerKey: currentDrawerKey, productCode: code });
  } else {
    // add new
    products[currentDrawerKey].push({ code, name, kg, entry, expiries: finalExpiries, ...extFields });
    logHistory('📥', `Entrada: ${code} — ${name}`, `${currentDrawerKey} · ${kg}kg`, { depotId: activeDepotId, to: currentDrawerKey, drawerKey: currentDrawerKey, productCode: code });
  }

  closeProductForm();
  renderDrawerProducts();
  renderAll();
}

async function pfDeleteProduct() {
  if (pfEditIdx === null) return;
  const p = products[currentDrawerKey][pfEditIdx];
  const okDel = await showConfirm({ title:'EXCLUIR PRODUTO', icon:'🗑', desc:'Remover este produto permanentemente desta gaveta?', summary:{'CÓDIGO':p.code,'NOME':p.name,'GAVETA':currentDrawerKey,'PESO':(p.kg||0)+'kg'}, okLabel:'EXCLUIR' }); if(!okDel) return;
  logHistory('📤', `Saída: ${p.code} — ${p.name}`, `Removido de ${currentDrawerKey}`, { depotId: activeDepotId, from: currentDrawerKey, drawerKey: currentDrawerKey, productCode: p.code });
  products[currentDrawerKey].splice(pfEditIdx, 1);
  closeProductForm();
  renderDrawerProducts();
  renderAll();
}

function clearProductsFilters() {
  clearFilterBar('po-filter-bar', renderProductsPage);
}
