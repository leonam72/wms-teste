// ═══════════════════════════════════════════════════════════
// MODULE: history.js
// ═══════════════════════════════════════════════════════════

function clearTransientOperationalState() {
  outboundCart = [];
  shippingSelected = { depotId: null, drawerKey: null };
  shippingAddCtx = null;
  shippingDragCtx = null;
  blindCountSelected = { depotId: null, drawerKey: null };
  blindCountAllocationCtx = null;
  blindCountDragItemId = null;
  activeBlindUnloadId = null;
  blindUnloadDraft = null;
  blindPendingInvoiceBarcodes = [];
  blindPendingVehiclePlate = '';
  separationLookupResults = [];
  separationSelectedLookupItem = null;
  separationSelectedRequestId = null;
  separationSelectedRequestDetail = null;
  receivingSession = null;
  receivingItems = [];
  receivingSelectedNfe = null;
  receivingClosePreview = null;
  receivingDoubleCheckRequired = false;
  if (blindTimerInterval) {
    clearInterval(blindTimerInterval);
    blindTimerInterval = null;
  }
  stopReceivingTimer();
}

window.clearTransientOperationalState = clearTransientOperationalState;
window.addEventListener('beforeunload', event => {
  if (window.hasPendingBlindUnloads && window.hasPendingBlindUnloads()) {
    event.preventDefault();
    event.returnValue = window.getPendingBlindUnloadWarning();
  }
});

function getBlindCurrentDraft() {
  if (activeBlindUnloadId) {
    blindUnloadDraft = blindCountRecords.find(record => record.id === activeBlindUnloadId) || null;
  }
  return blindUnloadDraft;
}

function setActiveBlindUnload(recordId = null) {
  if (activeBlindUnloadId) {
    const previous = blindCountRecords.find(record => record.id === activeBlindUnloadId);
    if (previous) previous.poolItems = deepClone(blindCountPool);
  }
  activeBlindUnloadId = recordId || null;
  blindUnloadDraft = recordId ? (blindCountRecords.find(record => record.id === recordId) || null) : null;
  if (!blindUnloadDraft) {
    blindCountPool = [];
    blindPendingInvoiceBarcodes = [];
    blindPendingVehiclePlate = '';
  } else {
    blindCountPool = Array.isArray(blindUnloadDraft.poolItems) ? deepClone(blindUnloadDraft.poolItems) : [];
  }
}

function getPendingBlindUnloads() {
  return blindCountRecords.filter(record => record.status === 'in_progress' || record.status === 'rejected');
}

window.hasPendingBlindUnloads = function hasPendingBlindUnloads() {
  return getPendingBlindUnloads().length > 0;
};

window.getPendingBlindUnloadWarning = function getPendingBlindUnloadWarning() {
  const rows = getPendingBlindUnloads();
  if (!rows.length) return '';
  return `Há ${rows.length} descarga(s) pendente(s) em andamento/reprovadas.`;
};

// ——— HISTORY ———
function logHistory(icon, action, detail, meta = {}) {
  const depotId = meta.depotId || activeDepotId || null;
  auditHistory.unshift({
    ts: new Date().toISOString(),
    icon,
    action,
    detail,
    type: meta.type || inferHistoryType(action, icon),
    user: meta.user || getCurrentUserLabel(),
    depotId,
    depotName: meta.depotName || getDepotById(depotId)?.name || '',
    from: meta.from || '',
    to: meta.to || '',
    shelfId: meta.shelfId || '',
    drawerKey: meta.drawerKey || '',
    productCode: meta.productCode || '',
  });
  if (auditHistory.length > 200) auditHistory.pop();

}

function renderHistory() {
  const el = document.getElementById('page-history-list');
  if (!el) return;
  el.replaceChildren();
  if (!auditHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-msg';
    empty.style.padding = '12px';
    empty.style.fontSize = '11px';
    empty.textContent = 'Nenhuma movimentação';
    el.appendChild(empty);
    return;
  }
  auditHistory.forEach(h => {
    const d = new Date(h.ts);
    const time = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const parts = [
      h.depotName ? `depósito ${h.depotName}` : '',
      h.from ? `de ${h.from}` : '',
      h.to ? `para ${h.to}` : '',
      h.drawerKey ? `gaveta ${h.drawerKey}` : '',
      h.productCode ? `produto ${h.productCode}` : '',
      h.user ? `por ${h.user}` : '',
    ].filter(Boolean).join(' · ');
    const item = document.createElement('div');
    item.className = 'hist-item-sm';
    const icon = document.createElement('div');
    icon.className = 'hist-icon-sm';
    icon.textContent = h.icon || '•';
    const body = document.createElement('div');
    body.className = 'hist-body-sm';
    const action = document.createElement('div');
    action.className = 'hist-action-sm';
    action.textContent = h.action || 'Evento';
    const meta = document.createElement('div');
    meta.className = 'hist-meta-sm';
    meta.textContent = `${h.detail || ''}${parts ? ' · ' + parts : ''}`;
    const timeEl = document.createElement('div');
    timeEl.className = 'hist-time-sm';
    timeEl.textContent = time;
    body.appendChild(action);
    body.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(body);
    item.appendChild(timeEl);
    el.appendChild(item);
  });
}

async function clearHistory() {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode limpar o histórico.')) return;
  const okCH = await showConfirm({ title:'LIMPAR HISTÓRICO', icon:'🗑', desc:'Apagar todas as movimentações registradas? Esta ação não pode ser desfeita.', okLabel:'LIMPAR' }); if(!okCH) return;
  auditHistory = [];
  renderHistory();
}

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

    return `<tr class="row-${s}" onclick="navigateToDrawer(this.dataset.key, this.dataset.code)" data-key="${escapeAttr(key)}" data-code="${escapeAttr(p.code)}" title="Clique para ir até a gaveta ${escapeAttr(key)}">
      <td><span style="color:#004499;font-weight:800">${escapeHtml(p.code)}</span></td>
      <td>${escapeHtml(p.name)}</td>
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
  const modals = ['confirm-overlay','text-input-modal','depot-modal','prod-detail-modal','move-confirm-modal','dnd-move-modal','date-edit-modal','product-form-modal','drawer-modal','add-product-modal','settings-modal','expiry-modal','fp-shelf-modal','entity-qr-modal','shipping-add-modal','shipping-finalize-modal','outbound-edit-modal'];
  for (const id of modals) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')) {
      el.classList.remove('open');
      if (id === 'confirm-overlay') { confirmResolve(false); }
      if (id === 'text-input-modal') { textPromptResolve(null); }
      if (id === 'drawer-modal') { currentDrawerKey = null; }
      if (id === 'product-form-modal') { pfEditIdx = null; pfExpiries = []; }
      if (id === 'fp-shelf-modal') { fpFocusedShelf = null; fpFocusedDepotId = null; renderFloorPlan(); }
      if (id === 'dnd-move-modal') { dndSrcKey_pending = null; dndDstKey_pending = null; }
      if (id === 'move-confirm-modal') { mvSrcKey = null; mvDstKey = null; }
      if (id === 'date-edit-modal') { dateEditCtx = null; }
      break; // only close topmost
    }
  }
});

// ── Enter on date inputs ──
document.addEventListener('DOMContentLoaded', function() {
  hydrateCurrentUserFromStorage();
  HIGH_CONTRAST_ENABLED = sessionStorage.getItem('wms_high_contrast') === '1';
  applyHighContrastPreference();
  bindStaticUiControls();
  startTableResizeObserver();
  applyRolePermissions();
  renderDepotTabs();
  ensurePageNavigationConsistency('depot');
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
  const eqm = document.getElementById('entity-qr-modal');
  if (eqm) eqm.addEventListener('click', e => { if (e.target === eqm) closeEntityQrModal(); });
  document.getElementById('fp-canvas')?.addEventListener('mouseleave', () => { if(fpActiveTool){ const p=document.getElementById('fp-place-preview'); if(p)p.style.display='none'; } });
  document.getElementById('bcp-damage-photo')?.addEventListener('change', event => previewBlindDamagePhoto(event, 'pool'));
  document.getElementById('bca-damage-photo')?.addEventListener('change', event => previewBlindDamagePhoto(event, 'allocation'));
  document.querySelectorAll('input[name="bca-condition"]').forEach(radio => {
    radio.addEventListener('change', syncBlindDamagePhotoState);
  });
});

window.addEventListener('wms:current-user-changed', () => {
  const user = getCurrentUserObject();
  if (!user) {
    userPermissionsInitialized = false;
    lastAppliedUserRole = null;
    applyRolePermissions();
    ensurePageNavigationConsistency('depot');
    return;
  }
  const roleChanged = lastAppliedUserRole !== user.role;
  applyRolePermissions();
  ensurePageNavigationConsistency(getCurrentPageName());
  if (roleChanged && Object.keys(productsAll).length) {
    renderAll(true);
  }
});

