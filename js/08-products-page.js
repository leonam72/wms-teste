// ╔══════════════════════════════════════════════════════════════════╗
// ║  08-products-page.js     Página visão geral de produtos              ║
// ╚══════════════════════════════════════════════════════════════════╝

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
});


function poSort(col) {
  if (poSortColRef === col) poSortDirRef = -poSortDirRef;
  else { poSortColRef = col; poSortDirRef = 1; }
  renderProductsPage();
}

function poRenderHeaders() {
  const thead = document.getElementById('po-thead'); if(!thead) return;
  const cols = Object.keys(poColumns).filter(k=>poColumns[k]);
  thead.innerHTML = '<tr>'+cols.map(k=>`<th draggable="true" onclick="poSort('${k}')">${PO_COL_LABELS[k]}</th>`).join('')+'</tr>';
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
    code:       `<td class="td-code">${p.code}</td>`,
    name:       `<td class="col-name">${p.name}</td>`,
    qty:        `<td style="text-align:right">${p.qty}</td>`,
    kg:         `<td style="text-align:right">${p.kg.toFixed(2)}</td>`,
    entry:      `<td>${p.lastEntry||'—'}</td>`,
    status:     `<td>${statusBadge}</td>`,
    nearest:    `<td>${nearest?fmtDate(nearest):'—'}</td>`,
    days:       `<td>${daysStr}</td>`,
    category:   `<td>${p.category||'—'}</td>`,
    supplier:   `<td>${p.supplier||'—'}</td>`,
    unit:       `<td>${p.unit||'un'}</td>`,
    lot:        `<td>${p.lot||'—'}</td>`,
    ean:        `<td>${p.ean||'—'}</td>`,
    cost:       `<td>${p.cost!=null?'R$ '+parseFloat(p.cost).toFixed(2):'—'}</td>`,
    price:      `<td>${p.price!=null?'R$ '+parseFloat(p.price).toFixed(2):'—'}</td>`,
    locations:  `<td class="col-locs" style="padding-right:6px">${locTags}</td>`,
  };
  const cols = Object.keys(poColumns).filter(k=>poColumns[k]);
  const cols2 = Object.keys(poColumns).filter(k=>poColumns[k]);
  return `<tr class="${p.statusKey==='expired'?'row-expired':p.statusKey==='expiring'?'row-expiring':''}" onclick="openProductDetail('${p.code}')" style="cursor:pointer">${cols2.map(k=>cellMap[k]||'<td>—</td>').join('')}</tr>`;
}

let poSortColRef = 'code', poSortDirRef = 1;
let poKpiFilter = '';
// Column visibility
let poColumns = {
  code:1, name:1, qty:1, kg:1, entry:1, status:1, nearest:1, days:1,
  category:0, supplier:0, unit:0, lot:0, ean:0, cost:0, price:0, locations:1
};
const PO_COL_LABELS = {
  code:'CÓDIGO', name:'NOME', qty:'QTD', kg:'PESO', entry:'ÚLTIMA ENTRADA',
  status:'STATUS', nearest:'PRÓX. VENC.', days:'DIAS P/ VENC.',
  category:'CATEGORIA', supplier:'FORNECEDOR', unit:'UNIDADE', lot:'LOTE',
  ean:'EAN', cost:'CUSTO', price:'PREÇO', locations:'LOCALIZAÇÕES'
}; // active KPI filter key

function getAllProductsDetail() {
  const map = {};
  Object.entries(products).forEach(([key, prods]) => {
    prods.forEach(p => {
      if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [], entries: [], allExpiries: [] };
      const rec = map[p.code];
      rec.qty++;
      rec.kg += parseFloat(p.kg) || 0;
      if (!rec.locations.includes(key)) rec.locations.push(key);
      if (p.entry) rec.entries.push(p.entry);
      if (p.expiryControl!=='no') getExpiries(p).filter(Boolean).forEach(d => { if (!rec.allExpiries.includes(d)) rec.allExpiries.push(d); });
      // merge extended fields (take first non-empty)
      ['ean','sku','category','supplier','unit','lot','perishable','cost','price'].forEach(f=>{ if(!rec[f]&&p[f]) rec[f]=p[f]; });
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

  // populate shelf filter
  const shelfSel = document.getElementById('po-filter-shelf');
  if (shelfSel && shelfSel.options.length <= 1) {
    shelves.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = 'Prateleira ' + s.id;
      shelfSel.appendChild(o);
    });
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
  if (fsh) rows = rows.filter(r => r.locations.some(l => l.startsWith(fsh)));

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
  document.querySelectorAll('#po-thead th').forEach(th => {
    th.classList.remove('sort-asc','sort-desc');
  });
  const colMap = {code:0,name:1,qty:2,kg:3,entry:4,status:5,nearest:6};
  const idx = colMap[poSortColRef];
  const ths = document.querySelectorAll('#po-thead th');
  if (ths[idx]) ths[idx].classList.add(poSortDirRef === 1 ? 'sort-asc' : 'sort-desc');

  const tbody = document.getElementById('po-tbody');
  if (!tbody) return;
    tbody.innerHTML = rows.map(r => poRenderRow(r)).join('');
}

