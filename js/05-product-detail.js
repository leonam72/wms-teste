// ╔══════════════════════════════════════════════════════════════════╗
// ║  05-product-detail.js    Modal de detalhe de produto, tooltip e KPI  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ PRODUCT DETAIL MODAL ═════════════════════════════════════════════
function openProductDetail(code) {
  const allProds = productsAll[activeDepotId] || products;
  const instances = [];
  Object.entries(allProds).forEach(([key, prods]) => {
    prods.forEach((p) => { if (p.code === code) instances.push({key, p}); });
  });
  if (!instances.length) return;
  const first = instances[0].p;
  document.getElementById('pdm-title').textContent = first.code + ' — ' + first.name;
  const stKey = productExpiryStatus(first);
  const stLabel = stKey==='expired'?'VENCIDO':stKey==='expiring'?'A VENCER':stKey==='ok'?'OK':'SEM VALIDADE';
  document.getElementById('pdm-subtitle').textContent = instances.length + ' entrada(s) · Status: ' + stLabel;
  const body = document.getElementById('pdm-body');
  let h2 = '<div class="pdm-section"><div class="pdm-section-title">IDENTIFICAÇÃO</div><div class="pdm-grid">';
  [['CÓDIGO',first.code],['EAN/GTIN',first.ean||'—'],['SKU',first.sku||'—'],
   ['NCM',first.ncm||'—'],['ANVISA',first.anvisa||'—'],['CATEGORIA',first.category||'—'],
   ['FORNECEDOR',first.supplier||'—'],['UNIDADE',first.unit||'un'],
   ['PERECÍVEL',first.perishable==='yes'?'Sim':first.perishable==='frozen'?'Congelado':'Não']
  ].forEach(([l,v]) => { h2 += '<div class="pdm-field"><span class="pdm-label">'+l+'</span><span class="pdm-value">'+v+'</span></div>'; });
  h2 += '</div></div>';
  if (first.cost!=null||first.price!=null) {
    h2 += '<div class="pdm-section"><div class="pdm-section-title">FINANCEIRO</div><div class="pdm-grid">';
    if(first.cost!=null)  h2 += '<div class="pdm-field"><span class="pdm-label">CUSTO</span><span class="pdm-value">R$ '+parseFloat(first.cost).toFixed(2)+'</span></div>';
    if(first.price!=null) h2 += '<div class="pdm-field"><span class="pdm-label">PREÇO</span><span class="pdm-value accent">R$ '+parseFloat(first.price).toFixed(2)+'</span></div>';
    h2 += '</div></div>';
  }
  if (first.tempMax!=null||first.tempMin!=null||first.notes) {
    h2 += '<div class="pdm-section"><div class="pdm-section-title">ARMAZENAMENTO</div><div class="pdm-grid">';
    if(first.tempMax!=null) h2 += '<div class="pdm-field"><span class="pdm-label">TEMP. MÁX</span><span class="pdm-value">'+first.tempMax+'°C</span></div>';
    if(first.tempMin!=null) h2 += '<div class="pdm-field"><span class="pdm-label">TEMP. MÍN</span><span class="pdm-value">'+first.tempMin+'°C</span></div>';
    if(first.notes) h2 += '<div class="pdm-field" style="grid-column:1/-1"><span class="pdm-label">OBS.</span><span class="pdm-value" style="font-weight:400">'+first.notes+'</span></div>';
    h2 += '</div></div>';
  }
  h2 += '<div class="pdm-section"><div class="pdm-section-title">LOCALIZAÇÕES</div>';
  instances.forEach(({key,p}) => {
    const expiries = getExpiries(p).filter(Boolean).sort();
    const st = productExpiryStatus(p);
    const cls = st==='expired'?'danger':st==='expiring'?'warn':st==='ok'?'ok':'';
    const daysN = expiries.length ? daysUntil(expiries[0]) : null;
    const daysLbl = daysN===null?'Sem validade':daysN<0?'Vencido há '+Math.abs(daysN)+'d':daysN===0?'HOJE':'Vence em '+daysN+'d';
    h2 += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">'
      +'<span class="pdm-loc-tag" data-key="'+key+'" data-code="'+p.code+'" onclick="closePdmAndNavigate(this.dataset.key,this.dataset.code)">'+key+'</span>'
      +'<div style="flex:1"><span style="font-size:10px;color:var(--text2)">'+(p.kg||0)+'kg · Lote: '+(p.lot||'—')+' · Entrada: '+(p.entry?fmtDate(p.entry):'—')+'</span><br>'
      +'<span class="pdm-value '+cls+'" style="font-size:11px">'+daysLbl+(expiries.length?' ('+expiries.map(fmtDate).join(', ')+')':'')+'</span></div></div>';
  });
  h2 += '</div>';
  const allExp = instances.flatMap(({p}) => getExpiries(p).filter(Boolean)).sort();
  if (allExp.length) {
    h2 += '<div class="pdm-section"><div class="pdm-section-title">VALIDADES</div><div class="pdm-exp-row">';
    allExp.forEach(d => {
      const st=expiryStatus(d), cls=st==='expired'?'danger':st==='expiring'?'warn':'ok';
      const days=daysUntil(d);
      const lbl=days===null?'—':days<0?'VENCIDO há '+Math.abs(days)+'d':days===0?'HOJE':days+'d';
      h2 += '<div class="pdm-exp-item"><span class="exp-chip '+st+'" style="margin:0">'+fmtDate(d)+'</span><span class="pdm-value '+cls+'">'+lbl+'</span></div>';
    });
    h2 += '</div></div>';
  }
  body.innerHTML = h2;
  document.getElementById('prod-detail-modal').classList.add('open');
}
function closePdmAndNavigate(key, code) {
  document.getElementById('prod-detail-modal').classList.remove('open');
  navigateToDrawer(key, code);
}

// ══ DRAWER TOOLTIP ════════════════════════════════════════════════════
let _dttTimer = null;
function showDrawerTooltip(ev, key) {
  clearTimeout(_dttTimer);
  _dttTimer = setTimeout(() => {
    const tip = document.getElementById('drawer-tooltip');
    if (!tip) return;
    const prods = products[key] || [];
    let inner = '<div class="dtt-key">'+key+'</div>';
    if (!prods.length) {
      inner += '<div class="dtt-empty">Gaveta vazia</div>';
    } else {
      prods.forEach(p => {
        const st = productExpiryStatus(p);
        const ne = nearestExpiry(p);
        const dot = st==='expired'?'🔴':st==='expiring'?'🟡':'🟢';
        const days = ne ? (daysUntil(ne)===null?'':daysUntil(ne)<0?' (VENC.)':' ('+daysUntil(ne)+'d)') : '';
        inner += '<div class="dtt-prod">'+dot+' <strong>'+p.code+'</strong> '+p.name.slice(0,22)+days+'</div>';
      });
      const usedKg = prods.reduce((s,p)=>s+(parseFloat(p.kg)||0),0);
      inner += '<div style="margin-top:4px;font-size:9px;color:var(--text3)">'+prods.length+' produto(s) · '+usedKg.toFixed(2)+' kg</div>';
    }
    tip.innerHTML = inner;
    tip.style.left = (ev.clientX+14)+'px';
    tip.style.top  = (ev.clientY+14)+'px';
    tip.style.display = 'block';
  }, 300);
}
function hideDrawerTooltip() {
  clearTimeout(_dttTimer);
  const tip = document.getElementById('drawer-tooltip');
  if (tip) tip.style.display = 'none';
}

// ══ KPI ACTIVE STATE ═══════════════════════════════════════════════════
function updatePoKpiActiveState() {
  document.querySelectorAll('.po-kpi').forEach(el => el.classList.remove('active'));
}
function setPoKpiFilter(key) {
  poKpiFilter = poKpiFilter === key ? '' : key;
  renderProductsPage();
}



// ── Product form tabs ─────────────────────────────────────────────────
function pfSwitchTab(tab) {
  ['basic','details','expiry'].forEach((t,i) => {
    const tabEl = document.querySelectorAll('.pf-tab')[i];
    if (tabEl) tabEl.classList.toggle('active', t===tab);
    const panel = document.getElementById('pftab-'+t);
    if (panel) panel.classList.toggle('active', t===tab);
  });
}

function pfUpdateExpiryTab() {
  const ctrl = document.getElementById('pf-expiry-control')?.value;
  const dis  = document.getElementById('pf-expiry-disabled-msg');
  const act  = document.getElementById('pf-expiry-active');
  if (dis) dis.style.display = ctrl==='no' ? 'block' : 'none';
  if (act) act.style.display = ctrl==='no' ? 'none'  : 'block';
}

function pfUpdateDaysInfo() {
  const info = document.getElementById('pf-expiry-days-info');
  if (!info || !pfExpiries.length) { if(info) info.innerHTML=''; return; }
  const lines = [...pfExpiries].sort().map(d => {
    const days = daysUntil(d);
    const st   = expiryStatus(d);
    const lbl  = days===null ? '—' : days<0 ? `VENCIDA há ${Math.abs(days)} dias` : days===0 ? 'Vence HOJE' : `Vence em ${days} dias`;
    const color = st==='expired'?'var(--danger)':st==='expiring'?'var(--warn)':'var(--accent3)';
    return `<span style="color:${color}">${fmtDate(d)}: ${lbl}</span>`;
  });
  info.innerHTML = lines.join('<br>');
}

// ── Depot modal save ──────────────────────────────────────────────────
let depotModalEditId = null;

async function saveDepotModal() {
  const name = document.getElementById('dm-name')?.value.trim();
  if (!name) { alert('Nome é obrigatório.'); return; }
  const data = {
    name,
    address: document.getElementById('dm-address')?.value.trim() || '',
    city:    document.getElementById('dm-city')?.value.trim()    || '',
    manager: document.getElementById('dm-manager')?.value.trim() || '',
    phone:   document.getElementById('dm-phone')?.value.trim()   || '',
    notes:   document.getElementById('dm-notes')?.value.trim()   || '',
  };
  if (depotModalEditId) {
    const ok = await showConfirm({ title:'EDITAR DEPÓSITO', icon:'✏', desc:'Salvar alterações neste depósito?', summary:{NOME:name, CIDADE:data.city||'—', 'RESPONS.':data.manager||'—'}, okLabel:'SALVAR', okStyle:'accent' });
    if (!ok) return;
    const d = depots.find(d2 => d2.id === depotModalEditId);
    if (d) Object.assign(d, data);
  } else {
    const ok = await showConfirm({ title:'CRIAR DEPÓSITO', icon:'🏭', desc:'Criar um novo depósito?', summary:{NOME:name, ENDEREÇO:data.address||'—', CIDADE:data.city||'—'}, okLabel:'CRIAR', okStyle:'accent' });
    if (!ok) return;
    const id = 'dep' + Date.now();
    depots.push({ id, ...data });
    shelvesAll[id]  = [];
    productsAll[id] = {};
    closeDepotModal();
    renderDepotTabs();
    renderDepotsPage();
    switchDepot(id);
    return;
  }
  closeDepotModal();
  renderDepotTabs();
  renderDepotsPage();
  renderAll();
}

// Fix openDepotModal to set depotModalEditId correctly

