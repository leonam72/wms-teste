// ╔══════════════════════════════════════════════════════════════════╗
// ║  04-expiry-alerts.js     Helpers de validade e barra de alertas      ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— EXPIRY HELPERS ———
// Each product has p.expiries = ['2025-04-01', '2025-06-01', ...]
// For backwards compat, p.exit (single string) is also accepted.

function getExpiries(p) {
  if (p.expiries && p.expiries.length) return p.expiries;
  if (p.exit) return [p.exit];
  return [];
}

function nearestExpiry(p) {
  const list = getExpiries(p).filter(Boolean).sort();
  return list[0] || null;
}

function expiryStatus(dateStr) {
  if (!dateStr) return 'ok';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((d - today) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'expiring';
  return 'ok';
}

function productExpiryStatus(p) {
  return expiryStatus(nearestExpiry(p));
}

function drawerExpiryStatus(prods) {
  let worst = 'ok';
  prods.forEach(p => {
    const s = productExpiryStatus(p);
    if (s === 'expired') worst = 'expired';
    else if (s === 'expiring' && worst !== 'expired') worst = 'expiring';
  });
  return worst;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.floor((new Date(dateStr + 'T00:00:00') - today) / 86400000);
}

function fmtDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ——— ALERTS BAR ———
function renderAlerts() {
  const expired = [], expiring = [];
  Object.entries(products).forEach(([key, prods]) => {
    prods.forEach(p => {
      const s = productExpiryStatus(p);
      if (s === 'expired') expired.push({ key, p });
      else if (s === 'expiring') expiring.push({ key, p });
    });
  });
  const bar = document.getElementById('alerts-bar');
  let h = '';
  if (expired.length)  h += `<div class="alert-banner expired"  onclick="openExpiryModal('expired')" title="Clique para ver detalhes">⛔ ${expired.length} produto(s) com validade VENCIDA — clique para detalhar</div>`;
  if (expiring.length) h += `<div class="alert-banner expiring" onclick="openExpiryModal('expiring')" title="Clique para ver detalhes">⚠ ${expiring.length} produto(s) vencem em até 30 dias — clique para detalhar</div>`;
  bar.innerHTML = h;
}

function openExpiryModal(filter) {
  const rows = [];
  Object.entries(products).forEach(([key, prods]) => {
    prods.forEach(p => {
      const s = productExpiryStatus(p);
      if (filter === 'expired' && s !== 'expired') return;
      if (filter === 'expiring' && s !== 'expiring') return;
      rows.push({ key, p, s });
    });
  });
  rows.sort((a,b) => (nearestExpiry(a.p)||'9').localeCompare(nearestExpiry(b.p)||'9'));

  const title = filter === 'expired' ? '⛔ Validades Vencidas' : '⚠ Vencimentos Próximos (30 dias)';
  document.getElementById('expiry-modal-title').textContent = title;

  const tbody = document.getElementById('expiry-modal-tbody');
  tbody.innerHTML = rows.map(({key,p,s}) => {
    const expiries = getExpiries(p).filter(Boolean).sort();
    const nearest = expiries[0];
    const days = daysUntil(nearest);
    const daysLabel = days === null ? '—' : days < 0 ? `${Math.abs(days)}d atrás` : days === 0 ? 'HOJE' : `${days}d`;
    const statusTag = s === 'expired'
      ? `<span class="exp-tag expired">VENCIDO</span>`
      : `<span class="exp-tag expiring">⚠ ${daysLabel}</span>`;

    let valHtml;
    if (expiries.length === 1) {
      valHtml = `<span class="val-date">${fmtDate(nearest)}</span>`;
    } else {
      valHtml = `<div class="multi-val-wrap">
        <div class="val-row"><span class="val-date">${fmtDate(nearest)}</span><span class="val-badge nearest">mais próxima</span></div>
        ${expiries.slice(1).map(d => `<div class="val-row"><span class="val-date" style="color:var(--text2)">${fmtDate(d)}</span><span class="val-badge more">+${daysUntil(d)}d</span></div>`).join('')}
      </div>`;
    }

    return `<tr class="row-${s}" onclick="navigateToDrawer('${key}','${p.code}')" title="Clique para ir até a gaveta ${key}">
      <td><span style="color:#004499;font-weight:800">${p.code}</span></td>
      <td>${p.name}</td>
      <td style="font-size:10px;color:var(--text2)">${key}</td>
      <td>${statusTag}</td>
      <td>${valHtml}</td>
    </tr>`;
  }).join('');

  document.getElementById('expiry-modal').classList.add('open');
}


function handleWorkspaceClick(e) {
  // if click lands on workspace bg (not a drawer), clear focus
  if (!e.target.closest('.drawer')) {
    clearFocus();
  }
}




// ── Expiry chip helpers for global add form ──
function gpAddExpiry() {
  const val = document.getElementById('gp-expiry-input').value;
  if (!val) return;
  if (gpExpiries.includes(val)) { document.getElementById('gp-expiry-input').value = ''; return; }
  gpExpiries.push(val);
  gpExpiries.sort();
  document.getElementById('gp-expiry-input').value = '';
  renderGpChips();
}

function renderGpChips() {
  const container = document.getElementById('gp-expiry-chips');
  if (!gpExpiries.length) {
    container.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
    return;
  }
  container.innerHTML = gpExpiries.map((d, i) => {
    const st = expiryStatus(d);
    return `<span class="exp-chip ${st}">${fmtDate(d)}
      <button class="chip-edit" onclick="gpEditExpiry(${i})" title="Editar">✏</button>
    </span>`;
  }).join('');
}

function gpEditExpiry(idx) {
  dateEditCtx = {
    type: 'gpForm',
    dateIdx: idx,
    list: [...gpExpiries],
    save: (newList) => { gpExpiries = newList; renderGpChips(); }
  };
  document.getElementById('date-edit-title').textContent = 'EDITAR VALIDADE';
  document.getElementById('date-edit-input').value = gpExpiries[idx] || '';
  document.getElementById('date-edit-modal').classList.add('open');
}

// ── Date edit modal actions ──
function closeDateEditModal() {
  document.getElementById('date-edit-modal').classList.remove('open');
  dateEditCtx = null;
}

function saveDateEdit() {
  if (!dateEditCtx) return;
  const val = document.getElementById('date-edit-input').value;
  if (!val) return;
  const list = [...dateEditCtx.list];
  list[dateEditCtx.dateIdx] = val;
  list.sort();
  dateEditCtx.save(list);
  closeDateEditModal();
}

function deleteDateEdit() {
  if (!dateEditCtx) return;
  const list = [...dateEditCtx.list];
  list.splice(dateEditCtx.dateIdx, 1);
  dateEditCtx.save(list);
  closeDateEditModal();
}

// ── ESC closes all modals ──
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (fpActiveTool) { fpCancelTool(); return; }
  if (mvState) { cancelMoveMode(); return; }
  const modals = ['depot-modal','prod-detail-modal','move-confirm-modal','dnd-move-modal','date-edit-modal','product-form-modal','drawer-modal','add-product-modal','settings-modal','expiry-modal','fp-shelf-modal'];
  for (const id of modals) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')) {
      el.classList.remove('open');
      if (id === 'drawer-modal') { currentDrawerKey = null; }
      if (id === 'product-form-modal') { pfEditIdx = null; pfExpiries = []; }
      if (id === 'fp-shelf-modal') { fpFocusedShelf = null; renderFloorPlan(); }
      if (id === 'move-modal')   { moveProductIdx = null; moveFromKey = null; }
      if (id === 'date-edit-modal') { dateEditCtx = null; }
      break; // only close topmost
    }
  }
});

// ── Enter on date inputs ──
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('pf-expiry-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pfAddExpiry(); } });
  document.getElementById('pf-expiry-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pfAddExpiry(); } });
  document.getElementById('gp-expiry-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); gpAddExpiry(); } });
  document.getElementById('date-edit-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveDateEdit(); } });

  // attach date-edit-modal overlay close
  const dem = document.getElementById('date-edit-modal');
  if (dem) dem.addEventListener('click', e => { if (e.target === dem) closeDateEditModal(); });
  const pfm = document.getElementById('product-form-modal');
  if (pfm) pfm.addEventListener('click', e => { if (e.target === pfm) closeProductForm(); });
  const fpm = document.getElementById('fp-shelf-modal');
  if (fpm) fpm.addEventListener('click', e => { if (e.target === fpm) closeFpModal(); });
  document.getElementById('fp-canvas')?.addEventListener('mouseleave', () => { if(fpActiveTool){ const p=document.getElementById('fp-place-preview'); if(p)p.style.display='none'; } });
});






