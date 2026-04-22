// ═══════════════════════════════════════════════════════════
// MODULE: shipping.js
// ═══════════════════════════════════════════════════════════

function clearShippingDrawerSelection() {
  const searchEl = document.getElementById('shipping-source-search');
  if (searchEl) searchEl.value = '';
  shippingSelected = { depotId: null, drawerKey: null };
  renderShippingPage();
}

function getShippingSourceSearchTerm() {
  return (document.getElementById('shipping-source-search')?.value || '').trim().toLowerCase();
}

function getShippingDrawerProducts(depotId, drawerKeyValue) {
  return (productsAll[depotId] || {})[drawerKeyValue] || [];
}

function getShippingReservedForSource(depotId, drawerKeyValue, signature) {
  return outboundCart.reduce((acc, item) => {
    if (item.sourceDepotId === depotId && item.sourceDrawerKey === drawerKeyValue && item.sourceSignature === signature) {
      acc.qty += parseFloat(item.qty || 0) || 0;
      acc.kg += parseFloat(item.kg || 0) || 0;
    }
    return acc;
  }, { qty: 0, kg: 0 });
}

function getShippingAvailableForSource(depotId, drawerKeyValue, product) {
  const signature = buildProductSignature(product);
  const reserved = getShippingReservedForSource(depotId, drawerKeyValue, signature);
  const qty = Math.max(0, (parseFloat(product.qty || 1) || 0) - reserved.qty);
  const kg = Math.max(0, (parseFloat(product.kgTotal ?? product.kg) || 0) - reserved.kg);
  return { signature, qty, kg };
}

function getShippingPriorityDate(product) {
  const nearest = nearestExpiry(product);
  const status = productExpiryStatus(product);
  if (!nearest) return { tier: 2, date: '9999-12-31' };
  if (status === 'expired') return { tier: 3, date: nearest };
  if (status === 'expiring') return { tier: 0, date: nearest };
  return { tier: 1, date: nearest };
}

function compareShippingProducts(a, b) {
  const pa = getShippingPriorityDate(a);
  const pb = getShippingPriorityDate(b);
  return pa.tier - pb.tier
    || pa.date.localeCompare(pb.date)
    || (a.entry || '9999-12-31').localeCompare(b.entry || '9999-12-31')
    || `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`);
}

function getDrawerShippingPriority(list = []) {
  if (!list.length) return { tier: 9, date: '9999-12-31' };
  return [...list].sort(compareShippingProducts).map(getShippingPriorityDate)[0] || { tier: 9, date: '9999-12-31' };
}

function getShelfShippingPriority(depotId, shelf) {
  const values = [];
  for (let floor = 1; floor <= shelf.floors; floor++) {
    for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
      const key = drawerKey(shelf.id, floor, drawer);
      const list = getShippingDrawerProducts(depotId, key);
      if (list.length) values.push(getDrawerShippingPriority(list));
    }
  }
  return values.sort((a, b) => a.tier - b.tier || a.date.localeCompare(b.date))[0] || { tier: 9, date: '9999-12-31' };
}

function getDepotShippingPriority(depotId) {
  const values = (shelvesAll[depotId] || [])
    .filter(shelf => shelf.id !== 'DESC' || depotId === 'dep_discard')
    .map(shelf => getShelfShippingPriority(depotId, shelf));
  return values.sort((a, b) => a.tier - b.tier || a.date.localeCompare(b.date))[0] || { tier: 9, date: '9999-12-31' };
}

function normalizeDiscardDepotState() {
  const { depot: fixedDepot, shelf: fixedShelf } = ensureFixedDiscardDepot();
  const legacyDiscardIds = depots
    .filter(item => item.id !== fixedDepot.id && (item.special === 'discard' || /descarte/i.test(item.name || '')))
    .map(item => item.id);
  if (!legacyDiscardIds.length) return;

  legacyDiscardIds.forEach(legacyId => {
    Object.entries(productsAll[legacyId] || {}).forEach(([drawerKeyValue, list]) => {
      (list || []).forEach(product => {
        const requiredKg = parseFloat(product.kgTotal ?? product.kg) || 0;
        const target = findDiscardDrawerForKg(requiredKg);
        const destinationKey = target?.drawerKeyValue || drawerKey(fixedShelf.id, 1, 100);
        if (!Array.isArray(productsAll[fixedDepot.id][destinationKey])) productsAll[fixedDepot.id][destinationKey] = [];
        productsAll[fixedDepot.id][destinationKey].push(product);
      });
    });
    delete shelvesAll[legacyId];
    delete productsAll[legacyId];
  });
  depots = depots.filter(item => !legacyDiscardIds.includes(item.id));
}

function ensureFixedDiscardDepot() {
  let depot = depots.find(item => item.id === 'dep_discard');
  if (!depot) {
    depot = {
      id: 'dep_discard',
      name: 'DEPÓSITO DE DESCARTE',
      address: '',
      city: '',
      manager: '',
      phone: '',
      notes: 'Depósito fixo para descarte controlado.',
      special: 'discard',
    };
    depots.push(depot);
  }
  if (!Array.isArray(shelvesAll[depot.id])) shelvesAll[depot.id] = [];
  if (!productsAll[depot.id] || typeof productsAll[depot.id] !== 'object') productsAll[depot.id] = {};
  let shelf = shelvesAll[depot.id].find(item => item.id === 'DESC');
  if (!shelf) {
    shelf = { id: 'DESC', type: 'blocked', floors: 1, drawers: 100, maxKg: 500 };
    shelvesAll[depot.id] = [shelf];
  } else {
    shelf.type = 'blocked';
    shelf.floors = 1;
    shelf.drawers = 100;
    shelf.maxKg = Math.max(parseFloat(shelf.maxKg || 0) || 0, 500);
    shelvesAll[depot.id] = [shelf];
  }
  for (let drawer = 1; drawer <= 100; drawer++) {
    const key = drawerKey(shelf.id, 1, drawer);
    if (!Array.isArray(productsAll[depot.id][key])) productsAll[depot.id][key] = [];
  }
  return { depot, shelf };
}

function findDiscardDrawerForKg(requiredKg, plannedByDrawer = new Map()) {
  const { depot, shelf } = ensureFixedDiscardDepot();
  const candidates = [];
  for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
    const key = drawerKey(shelf.id, 1, drawer);
    const list = getShippingDrawerProducts(depot.id, key);
    const usedKg = getDrawerUsedKg(key, depot.id) + (plannedByDrawer.get(key) || 0);
    if (usedKg + requiredKg > (shelf.maxKg || 500)) continue;
    candidates.push({ key, empty: list.length === 0 && !(plannedByDrawer.get(key) > 0), usedKg });
  }
  candidates.sort((a, b) => Number(b.empty) - Number(a.empty) || a.usedKg - b.usedKg || a.key.localeCompare(b.key));
  return candidates[0] ? { depot, shelf, drawerKeyValue: candidates[0].key } : null;
}

function buildDiscardPlan(cartItems = outboundCart) {
  const plannedByDrawer = new Map();
  const lines = [];
  for (const item of cartItems) {
    const kg = parseFloat(item.kg || 0) || 0;
    const target = findDiscardDrawerForKg(kg, plannedByDrawer);
    if (!target) return { ok: false, lines: [], message: 'Não há gaveta compatível livre no depósito fixo de descarte.' };
    plannedByDrawer.set(target.drawerKeyValue, (plannedByDrawer.get(target.drawerKeyValue) || 0) + kg);
    lines.push({ itemId: item.id, depot: target.depot, shelf: target.shelf, drawerKeyValue: target.drawerKeyValue });
  }
  return { ok: true, lines };
}

function resetSeparationLookup() {
  separationLookupResults = [];
  separationSelectedLookupItem = null;
  const menu = document.getElementById('separation-product-menu');
  if (menu) {
    menu.classList.add('blind-lookup-hidden');
    menu.innerHTML = '';
  }
}

function getSeparationDraftSummary() {
  return {
    lines: separationDraftItems.length,
    quantity: separationDraftItems.reduce((sum, item) => sum + (parseInt(item.quantity || 0, 10) || 0), 0),
  };
}

function formatSeparationDuration(value) {
  const totalSeconds = Math.max(0, parseInt(value || 0, 10) || 0);
  if (!totalSeconds) return '—';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  if (minutes) return `${minutes}min`;
  return `${totalSeconds}s`;
}

function formatSeparationItemAddresses(addresses) {
  if (!Array.isArray(addresses) || !addresses.length) return '—';
  return addresses.map(address => {
    const parts = [address.deposito, address.prateleira, address.gaveta].filter(Boolean).filter(value => value !== '-');
    const base = parts.join(' / ') || address.gaveta || '—';
    const qty = parseInt(address.quantidade || 0, 10) || 0;
    return `${base} (${qty} un)`;
  }).join(' · ');
}

function buildPrintableSeparationRequestHtml(detail) {
  const items = Array.isArray(detail?.itens) ? detail.itens : [];
  const divergencias = Array.isArray(detail?.divergencias) ? detail.divergencias : [];
  const enderecos = Array.isArray(detail?.enderecos) ? detail.enderecos : [];
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Romaneio ${escapeHtml(detail?.codigo || '—')}</title><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111} h1{font-size:22px;margin:0 0 8px} h2{font-size:15px;margin:24px 0 10px}
    .meta{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:8px 20px;margin:16px 0 18px;font-size:13px}
    .meta div{padding:8px 10px;border:1px solid #d9d9d9;background:#f7f7f7}.label{display:block;font-size:10px;font-weight:700;letter-spacing:.08em;color:#666;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top} th{background:#f2f2f2}
    .muted{color:#666}.empty{padding:12px;border:1px dashed #bbb;color:#666}
  </style></head><body>
    <h1>Detalhes do Romaneio ${escapeHtml(detail?.codigo || '—')}</h1>
    <div class="meta">
      <div><span class="label">ROMANEIO</span>${escapeHtml(detail?.codigo || '—')}</div>
      <div><span class="label">STATUS</span>${escapeHtml(String(detail?.status || '—').toUpperCase())}</div>
      <div><span class="label">CONFERENTE</span>${escapeHtml(detail?.conferente || '—')}</div>
      <div><span class="label">SEPARADOR</span>${escapeHtml(detail?.separador || '—')}</div>
      <div><span class="label">ITENS</span>${escapeHtml(String(detail?.item_count ?? items.length ?? 0))}</div>
      <div><span class="label">QUANTIDADES</span>Solicitado ${escapeHtml(String(detail?.summary?.requested_units ?? 0))} · Separado ${escapeHtml(String(detail?.summary?.separated_units ?? 0))} · Não encontrado ${escapeHtml(String(detail?.summary?.not_found_units ?? 0))}</div>
    </div>
    <h2>Itens</h2>
    <table><thead><tr><th>Seq</th><th>Produto</th><th>Status</th><th>Quantidades</th><th>Endereços</th><th>Separador</th></tr></thead><tbody>
      ${items.length ? items.map(item => `<tr>
        <td>${escapeHtml(String(item.sequencia ?? '—'))}</td>
        <td>${escapeHtml(item.codigo || '—')} - ${escapeHtml(item.nome || '—')}</td>
        <td>${escapeHtml(String(item.status || '—').toUpperCase())}</td>
        <td>Sol: ${escapeHtml(String(item.quantidade_solicitada ?? 0))}<br>Res: ${escapeHtml(String(item.quantidade_reservada ?? 0))}<br>Col: ${escapeHtml(String(item.quantidade_coletada ?? 0))}</td>
        <td>${escapeHtml(formatSeparationItemAddresses(item.enderecos))}</td>
        <td>${escapeHtml(Array.isArray(item.separadores) && item.separadores.length ? item.separadores.join(', ') : '—')}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="muted">Nenhum item encontrado.</td></tr>'}
    </tbody></table>
    <h2>Endereços</h2>
    ${enderecos.length ? `<table><thead><tr><th>Depósito</th><th>Prateleira</th><th>Gaveta</th><th>Quantidade</th><th>Lote</th><th>Validade</th></tr></thead><tbody>
      ${enderecos.map(address => `<tr>
        <td>${escapeHtml(address.deposito || '—')}</td>
        <td>${escapeHtml(address.prateleira || '—')}</td>
        <td>${escapeHtml(address.gaveta || '—')}</td>
        <td>${escapeHtml(String(address.quantidade ?? 0))}</td>
        <td>${escapeHtml(address.lote || '—')}</td>
        <td>${escapeHtml(address.validade ? fmtDate(address.validade) : '—')}</td>
      </tr>`).join('')}
    </tbody></table>` : '<div class="empty">Nenhum endereço associado ao romaneio.</div>'}
    <h2>Divergências</h2>
    ${divergencias.length ? `<table><thead><tr><th>Tipo</th><th>Status</th><th>Item</th><th>Descrição</th><th>Reportado por</th><th>Data</th></tr></thead><tbody>
      ${divergencias.map(div => `<tr>
        <td>${escapeHtml(String(div.tipo || '—').toUpperCase())}</td>
        <td>${escapeHtml(String(div.status || '—').toUpperCase())}</td>
        <td>${escapeHtml(div.codigo || '—')}${div.nome ? ` - ${escapeHtml(div.nome)}` : ''}</td>
        <td>${escapeHtml(div.descricao || div.observacao || '—')}</td>
        <td>${escapeHtml(div.reportado_por || '—')}</td>
        <td>${escapeHtml(fmtDateTime(div.aberta_at || div.created_at))}</td>
      </tr>`).join('')}
    </tbody></table>` : '<div class="empty">Nenhuma divergência registrada.</div>'}
  </body></html>`;
}

function renderSeparationSummary() {
  const summaryEl = document.getElementById('separation-summary');
  const countEl = document.getElementById('separation-record-count');
  if (summaryEl) {
    const summary = getSeparationDraftSummary();
    summaryEl.innerHTML = [
      ['ROMANEIO', sanitizeTextInput(document.getElementById('separation-romaneio')?.value || '', { maxLength: 60, uppercase: true }) || '—'],
      ['LINHAS', String(summary.lines)],
      ['QTD TOTAL', String(summary.quantity)],
      ['FEFO', 'OBRIGATÓRIO'],
      ['VENCIDOS', 'IGNORAR'],
      ['COMPLEMENTO', 'VALIDADE MAIS PRÓXIMA'],
    ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
  }
  if (countEl) countEl.textContent = `${separationRecentRequests.length} romaneio${separationRecentRequests.length === 1 ? '' : 's'}`;
}

function renderSeparationDraftProducts() {
  const listEl = document.getElementById('separation-selected-products');
  if (!listEl) return;
  if (!separationDraftItems.length) {
    listEl.innerHTML = '<div class="empty-msg">Nenhum produto adicionado ao romaneio.</div>';
    renderSeparationSummary();
    return;
  }
  listEl.innerHTML = separationDraftItems.map((item, index) => `<div class="separation-selected-row">
    <div class="separation-selected-main">
      <div class="separation-selected-title">${escapeHtml(item.name)} - ${escapeHtml(item.code)}</div>
      <div class="separation-selected-meta">Disponível ${escapeHtml(String(item.available_quantity || 0))} un · ${escapeHtml((parseFloat(item.available_kg || 0) || 0).toFixed(3))} kg · validade mais curta ${escapeHtml(item.nearest_expiry ? fmtDate(item.nearest_expiry) : '—')}</div>
    </div>
    <div class="separation-selected-actions">
      <input type="number" min="1" step="1" value="${escapeAttr(item.quantity)}" onchange="updateSeparationDraftQuantity(${index}, this.value)">
      <button class="btn btn-danger" type="button" onclick="removeSeparationDraftItem(${index})">REMOVER</button>
    </div>
  </div>`).join('');
  renderSeparationSummary();
}

function renderSeparationRecentList() {
  const listEl = document.getElementById('separation-recent-list');
  if (!listEl) return;
  if (!separationRecentRequests.length) {
    listEl.innerHTML = '<div class="empty-msg">Nenhum romaneio de separação confirmado ainda.</div>';
    return;
  }
  listEl.innerHTML = separationRecentRequests.map(item => {
    const naoAcheiCount = parseInt(item.nao_achei_count || 0, 10) || 0;
    const openDivergenceCount = parseInt(item.open_divergence_count || 0, 10) || 0;
    const latestDivergence = item.latest_divergence || null;
    const alertMeta = openDivergenceCount > 0
      ? ` · ${openDivergenceCount} ocorrência(s) aberta(s)`
      : naoAcheiCount > 0
        ? ` · ${naoAcheiCount} item(ns) não achado(s)`
        : '';
    const alertLine = latestDivergence
      ? `<div class="separation-recent-meta" style="color:var(--warn)">${escapeHtml(String(latestDivergence.tipo || 'ocorrencia').toUpperCase())} · ${escapeHtml(latestDivergence.descricao || 'Ocorrência pendente para análise do conferente.')}</div>`
      : '';
    const activeClass = separationSelectedRequestId === item.id ? ' active' : '';
    return `<button type="button" class="separation-recent-row${activeClass}" onclick="loadSeparationRequestDetail('${escapeJs(item.id)}', true)">
      <div class="separation-recent-title">${escapeHtml(item.codigo || '—')} · ${escapeHtml(String(item.status || '').toUpperCase())}</div>
      <div class="separation-recent-meta">${escapeHtml(fmtDateTime(item.created_at))} · ${escapeHtml(String(item.item_count || 0))} item(ns) · ${escapeHtml(String(item.route_count || 0))} rota(s) · ${escapeHtml(String(item.task_count || 0))} tarefa(s)${escapeHtml(alertMeta)}</div>
      ${alertLine}
    </button>`;
  }).join('');
}

function renderSeparationFinalSummary() {
  const detailEl = document.getElementById('separation-final-summary');
  if (!detailEl) return;
  const detail = separationSelectedRequestDetail;
  if (!detail) {
    detailEl.innerHTML = '<div class="empty-msg">Selecione um romaneio recente para conferir o fechamento final.</div>';
    return;
  }
  const summary = detail.summary || {};
  detailEl.innerHTML = `
    <div class="separation-final-head">
      <div class="separation-final-title">${escapeHtml(detail.codigo || '—')}</div>
      <div class="separation-final-status">${escapeHtml(String(detail.status || '').toUpperCase())}</div>
    </div>
    <div class="confirm-summary" style="display:flex">
      ${[
        ['ITENS SOLICITADOS', String(summary.requested_units ?? 0)],
        ['ITENS SEPARADOS', String(summary.separated_units ?? 0)],
        ['ITENS NÃO ENCONTRADOS', String(summary.not_found_units ?? 0)],
        ['CONFERENTE', String(detail.conferente || '—')],
        ['SEPARADOR RESPONSÁVEL', String(summary.responsible_separator || '—')],
        ['TEMPO SEPARAÇÃO', formatSeparationDuration(summary.duration_seconds)],
      ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('')}
    </div>
    <div class="separation-final-block">
      <div class="separation-final-block-title">ITENS</div>
      ${(Array.isArray(detail.itens) && detail.itens.length)
        ? detail.itens.map(item => `<div class="separation-final-line">
            <strong>${escapeHtml(item.codigo || '—')} - ${escapeHtml(item.nome || '—')}</strong>
            <span>${escapeHtml(String(item.status || '—').toUpperCase())} · Qtd ${escapeHtml(String(item.quantidade_solicitada ?? 0))} / coletado ${escapeHtml(String(item.quantidade_coletada ?? 0))}</span>
            <span>${escapeHtml(formatSeparationItemAddresses(item.enderecos))}</span>
          </div>`).join('')
        : '<div class="empty-msg">Nenhum item vinculado ao romaneio.</div>'}
    </div>
    <div class="separation-final-block">
      <div class="separation-final-block-title">DIVERGÊNCIAS</div>
      ${(Array.isArray(detail.divergencias) && detail.divergencias.length)
        ? detail.divergencias.map(div => `<div class="separation-final-line separation-final-line-warn">
            <strong>${escapeHtml(String(div.tipo || 'ocorrencia').toUpperCase())} · ${escapeHtml(String(div.status || '—').toUpperCase())}</strong>
            <span>${escapeHtml(div.codigo || '—')}${div.nome ? ` - ${escapeHtml(div.nome)}` : ''}</span>
            <span>${escapeHtml(div.descricao || div.observacao || '—')}</span>
          </div>`).join('')
        : '<div class="empty-msg">Nenhuma divergência registrada.</div>'}
    </div>
    <div class="separation-final-meta">${escapeHtml(fmtDateTime(detail.separacao_concluida_at || detail.conferencia_final_at || detail.saida_confirmada_at || detail.created_at))}</div>
  `;
}

function printSeparationRequestDetail() {
  const detail = separationSelectedRequestDetail;
  if (!detail?.id) return;
  const printWindow = window.open('', '_blank', 'width=1120,height=820');
  if (!printWindow) return;
  printWindow.document.write(buildPrintableSeparationRequestHtml(detail));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

let separationLoadingDetail = false;

async function loadSeparationRequestDetail(requestId, force = false) {
  if (!requestId || requestId === 'null' || requestId === 'undefined' || (separationLoadingDetail && !force)) return;
  if (separationSelectedRequestDetail && separationSelectedRequestDetail.id === requestId && !force) return;
  
  separationSelectedRequestId = requestId;
  separationLoadingDetail = true;
  renderSeparationRecentList();
  
  const detailEl = document.getElementById('separation-final-summary');
  if (detailEl) detailEl.innerHTML = '<div class="empty-msg">Carregando resumo final do romaneio...</div>';
  
  try {
    const response = await apiCall(`/wms/separation/requests/${encodeURIComponent(requestId)}`);
    separationSelectedRequestDetail = response || null;
    renderSeparationFinalSummary();
    renderSeparationRecentList();
  } catch (err) {
    separationSelectedRequestDetail = null;
    renderSeparationFinalSummary();
    console.error('Falha ao carregar detalhe do romaneio:', requestId, err);
    // Só mostra o modal se for uma ação explícita (force) para evitar popups infinitos no polling
    if (force) {
      await showNotice({
        title: 'FALHA NA CONFERÊNCIA FINAL',
        icon: '⛔',
        desc: err.message || 'Não foi possível carregar o resumo do romaneio.',
      });
    }
  } finally {
    separationLoadingDetail = false;
  }
}

async function finalizeSeparationRequest(button = null) {
  const detail = separationSelectedRequestDetail;
  if (!detail?.id) {
    await showNotice({ title: 'ROMANEIO NÃO SELECIONADO', icon: '⛔', desc: 'Selecione um romaneio para concluir a conferência final.' });
    return;
  }
  if (!detail.can_finalize) {
    await showNotice({ title: 'SAÍDA BLOQUEADA', icon: '⛔', desc: 'Este romaneio ainda não está pronto para confirmação final.' });
    return;
  }
  const ok = await showConfirm({
    title: 'CONFIRMAÇÃO FINAL',
    icon: '✓',
    desc: 'A saída só será liberada após esta confirmação final do conferente.',
    okLabel: 'CONFIRMAR SAÍDA',
    okStyle: 'accent',
    summary: {
      ROMANEIO: detail.codigo || '—',
      'ITENS SOLICITADOS': String(detail.summary?.requested_units ?? 0),
      'ITENS SEPARADOS': String(detail.summary?.separated_units ?? 0),
      'ITENS NÃO ENCONTRADOS': String(detail.summary?.not_found_units ?? 0),
      'SEPARADOR RESPONSÁVEL': String(detail.summary?.responsible_separator || '—'),
      'TEMPO SEPARAÇÃO': formatSeparationDuration(detail.summary?.duration_seconds),
    },
  });
  if (!ok) return;
  setButtonLoading(button, true, 'CONFIRMANDO...');
  try {
    await apiCall(`/wms/separation/requests/${encodeURIComponent(detail.id)}/finalize`, 'POST', { confirmed: true });
    separationLoadedOnce = false;
    await loadSeparationRequests(true);
    await loadSeparationRequestDetail(detail.id);
    await showNotice({
      title: 'SAÍDA CONFIRMADA',
      icon: '✓',
      desc: 'O fechamento final do romaneio foi confirmado pelo conferente.',
      summary: {
        ROMANEIO: detail.codigo || '—',
        STATUS: 'SAIDA_CONFIRMADA',
      },
    });
  } catch (err) {
    await showNotice({
      title: 'FALHA NA CONFIRMAÇÃO FINAL',
      icon: '⛔',
      desc: err.message || 'Não foi possível concluir a conferência final.',
    });
  } finally {
    setButtonLoading(button, false);
  }
}

async function loadSeparationRequests(force = false) {
  if (separationLoadedOnce && !force) return;
  try {
    const response = await apiCall('/wms/separation/requests?limit=20');
    separationRecentRequests = Array.isArray(response?.items) ? response.items : [];
    if (separationSelectedRequestId && !separationRecentRequests.some(item => item.id === separationSelectedRequestId)) {
      separationSelectedRequestId = null;
      separationSelectedRequestDetail = null;
    }
    if (!separationSelectedRequestId && separationRecentRequests.length) {
      separationSelectedRequestId = separationRecentRequests[0].id;
    }
    separationLoadedOnce = true;
    renderSeparationRecentList();
    renderSeparationFinalSummary();
    renderSeparationSummary();
  } catch (err) {
    console.error('Falha ao carregar romaneios de separação:', err);
  }
}

function renderSeparationProductMenu() {
  const menu = document.getElementById('separation-product-menu');
  if (!menu) return;
  if (!separationLookupResults.length) {
    menu.classList.add('blind-lookup-hidden');
    menu.innerHTML = '';
    return;
  }
  menu.innerHTML = separationLookupResults.map((item, index) => {
    const qty = parseFloat(item.available_quantity || 0);
    const kg  = parseFloat(item.available_kg || 0);
    const meta = [
      qty > 0 ? `${qty} un` : null,
      kg  > 0 ? `${kg.toFixed(3)} kg` : null,
      item.nearest_expiry ? `val. ${fmtDate(item.nearest_expiry)}` : null,
    ].filter(Boolean).join(' · ');
    return `<button type="button" class="pli__item" data-separation-lookup-index="${index}">
      <span class="pli__code">${escapeHtml(item.code || '')}</span>
      <span class="pli__name">${escapeHtml(item.name || item.label || '')}</span>
      ${meta ? `<span class="pli__meta">${escapeHtml(meta)}</span>` : ''}
    </button>`;
  }).join('');
  menu.classList.remove('blind-lookup-hidden');
  menu.classList.add('pli--open');
  menu.querySelectorAll('[data-separation-lookup-index]').forEach(el => {
    el.onclick = () => {
      const selected = separationLookupResults[parseInt(el.dataset.separationLookupIndex || '-1', 10)];
      if (!selected) return;
      separationSelectedLookupItem = selected;
      const input = document.getElementById('separation-product-search');
      if (input) input.value = selected.label || `${selected.name} - ${selected.code}`;
      resetSeparationLookup();
    };
  });
}

async function handleSeparationProductSearch() {
  const input = document.getElementById('separation-product-search');
  if (!input) return;
  const query = sanitizeTextInput(input.value || '', { maxLength: 120 });
  if (!query) {
    resetSeparationLookup();
    return;
  }
  if (separationSearchTimer) clearTimeout(separationSearchTimer);
  separationSearchTimer = setTimeout(async () => {
    const requestId = ++separationSearchRequestId;
    try {
      const response = await apiCall(`/wms/separation/products?q=${encodeURIComponent(query)}&limit=12`);
      if (requestId !== separationSearchRequestId) return;
      separationLookupResults = Array.isArray(response?.items) ? response.items : [];
      renderSeparationProductMenu();
    } catch (err) {
      console.error('Falha no autocomplete de separação:', err);
    }
  }, 120);
}

function addSelectedSeparationProduct() {
  const selected = separationSelectedLookupItem;
  const qtyEl = document.getElementById('separation-product-qty');
  const quantity = Math.max(1, parseInt(qtyEl?.value || '1', 10) || 1);
  if (!selected?.code) {
    showNotice({ title: 'PRODUTO OBRIGATÓRIO', icon: '⛔', desc: 'Selecione um produto válido na lista de autocomplete.' });
    return;
  }
  const existing = separationDraftItems.find(item => item.code === selected.code);
  const nextQuantity = (existing?.quantity || 0) + quantity;
  if (nextQuantity > (parseInt(selected.available_quantity || '0', 10) || 0)) {
    showNotice({
      title: 'SALDO INSUFICIENTE',
      icon: '⛔',
      desc: 'A quantidade solicitada supera o saldo disponível para separação.',
      summary: {
        PRODUTO: selected.label || `${selected.name} - ${selected.code}`,
        DISPONIVEL: `${selected.available_quantity || 0} un`,
      },
    });
    return;
  }
  if (existing) {
    existing.quantity = nextQuantity;
  } else {
    separationDraftItems.push({
      ...selected,
      quantity,
    });
  }
  const input = document.getElementById('separation-product-search');
  if (input) input.value = '';
  if (qtyEl) qtyEl.value = '1';
  separationSelectedLookupItem = null;
  resetSeparationLookup();
  renderSeparationDraftProducts();
}

function updateSeparationDraftQuantity(index, value) {
  const item = separationDraftItems[index];
  if (!item) return;
  const nextQuantity = Math.max(1, parseInt(value || '1', 10) || 1);
  const available = parseInt(item.available_quantity || '0', 10) || 0;
  item.quantity = Math.min(nextQuantity, Math.max(1, available || nextQuantity));
  renderSeparationDraftProducts();
}

function removeSeparationDraftItem(index) {
  separationDraftItems.splice(index, 1);
  renderSeparationDraftProducts();
}

function cancelSeparationDraft() {
  separationDraftItems = [];
  separationSelectedLookupItem = null;
  const romaneioEl = document.getElementById('separation-romaneio');
  const searchEl = document.getElementById('separation-product-search');
  const qtyEl = document.getElementById('separation-product-qty');
  if (romaneioEl) romaneioEl.value = '';
  if (searchEl) searchEl.value = '';
  if (qtyEl) qtyEl.value = '1';
  resetSeparationLookup();
  renderSeparationDraftProducts();
}

async function confirmSeparationRequest(button = null) {
  const romaneio = sanitizeTextInput(document.getElementById('separation-romaneio')?.value || '', { maxLength: 60, uppercase: true });
  if (!romaneio) {
    await showNotice({ title: 'ROMANEIO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o romaneio antes de confirmar.' });
    return;
  }
  if (!separationDraftItems.length) {
    await showNotice({ title: 'SEM PRODUTOS', icon: '⛔', desc: 'Adicione pelo menos um produto para gerar a separação.' });
    return;
  }
  setButtonLoading(button, true, 'CONFIRMANDO...');
  try {
    const response = await apiCall('/wms/separation/requests', 'POST', {
      romaneio,
      items: separationDraftItems.map(item => ({
        product_code: item.code,
        product_name: item.name,
        quantity: parseInt(item.quantity || 0, 10) || 0,
        unit: item.unit || 'un',
      })),
    });
    await showNotice({
      title: 'ROMANEIO PUBLICADO',
      icon: '✓',
      desc: 'Romaneio salvo, produtos reservados, rotas geradas e tarefas publicadas para separação.',
      summary: {
        ROMANEIO: response?.codigo || romaneio,
        ITENS: String(response?.summary?.total_items || separationDraftItems.length),
        ROTAS: String(response?.summary?.total_routes || 0),
        TAREFAS: String(response?.summary?.task_count || 0),
      },
    });
    cancelSeparationDraft();
    separationLoadedOnce = false;
    await loadSeparationRequests(true);
  } catch (err) {
    await showNotice({
      title: 'FALHA AO GERAR SEPARAÇÃO',
      icon: '⛔',
      desc: err.message || 'Não foi possível confirmar o romaneio.',
    });
  } finally {
    setButtonLoading(button, false);
  }
}

function renderSeparationPage() {
  renderSeparationDraftProducts();
  renderSeparationRecentList();
  renderSeparationFinalSummary();
  renderSeparationSummary();
  loadSeparationRequests().then(() => {
    if (separationSelectedRequestId && !separationSelectedRequestDetail) {
      return loadSeparationRequestDetail(separationSelectedRequestId);
    }
    return null;
  }).catch(err => console.error('Falha ao carregar página de separação:', err));
}

function renderShippingPage() {
  ensureFixedDiscardDepot();
  const depotSelect = document.getElementById('shipping-source-depot');
  const opSelect = document.getElementById('shipping-operation-type');
  if (!depotSelect) return;
  if (opSelect) {
    const current = opSelect.value || 'shipment';
    opSelect.innerHTML = [
      hasPermission('shipment.process') ? '<option value="shipment">SAÍDA</option>' : '',
      hasPermission('discard.process') ? '<option value="discard">DESCARTE</option>' : '',
    ].filter(Boolean).join('');
    if (!opSelect.innerHTML) {
      opSelect.innerHTML = '<option value="">Sem permissão operacional</option>';
      opSelect.disabled = true;
    } else {
      opSelect.disabled = false;
      if (!Array.from(opSelect.options).some(option => option.value === current)) opSelect.value = opSelect.options[0].value;
      else opSelect.value = current;
    }
  }
  const scopedDepotValue = getDepotTabsContextId();
  depotSelect.innerHTML = buildDepotOptionsHtml({ includeAll: true, selected: scopedDepotValue || depotSelect.value || ALL_DEPOTS_VALUE });
  depotSelect.value = scopedDepotValue || depotSelect.value || ALL_DEPOTS_VALUE;
  depotTabsContextId = depotSelect.value || ALL_DEPOTS_VALUE;
  if (getCurrentPageName() === 'saidas') renderDepotTabs();
  if (shippingSelected.depotId) {
    const allowedDepots = new Set(getShippingSourceDepotIds(depotSelect.value));
    if (!allowedDepots.has(shippingSelected.depotId) || !getShippingDrawerProducts(shippingSelected.depotId, shippingSelected.drawerKey).length) {
      shippingSelected = { depotId: null, drawerKey: null };
    }
  }
  renderShippingRecordCount();
  renderShippingShelfSource();
  renderShippingSourceProducts();
  renderShippingCart();
  setupShippingCartDropzone();
}

function buildShippingDrawerCard(depotId, shelf, drawerKeyValue, list) {
  const sortedList = [...list].sort(compareShippingProducts);
  const usedKg = list.reduce((sum, product) => sum + (parseFloat(product.kgTotal ?? product.kg) || 0), 0);
  const capPct = Math.min(100, (usedKg / Math.max(1, shelf.maxKg || 50)) * 100);
  const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';
  const isSelected = shippingSelected.depotId === depotId && shippingSelected.drawerKey === drawerKeyValue;
  const meta = `${list.length} item(ns) · ${usedKg.toFixed(3)} kg`;
  const topProduct = sortedList[0] || null;
  const topPriority = topProduct ? getShippingPriorityDate(topProduct) : { tier: 9 };
  const priorityBadge = topProduct
    ? `<div class="drawer-more" style="color:${topPriority.tier === 0 ? 'var(--warn)' : topPriority.tier === 1 ? 'var(--accent3)' : topPriority.tier === 3 ? 'var(--danger)' : 'var(--text2)'}">${topPriority.tier === 0 ? 'FEFO PRIORIDADE' : topPriority.tier === 1 ? 'PRÓXIMO LOTE' : topPriority.tier === 3 ? 'VENCIDO' : meta}</div>`
    : '';
  return `<div class="drawer occupied ${isSelected ? 'active-drawer' : ''}" data-shipping-drawer="1" data-depot="${escapeHtml(depotId)}" data-key="${escapeHtml(drawerKeyValue)}" style="width:112px;height:80px">
    <div class="drawer-key">${escapeHtml(drawerKeyValue)}</div>
    <div class="drawer-prod-list">
      <div class="drawer-prod-entry"><span class="drawer-prod-code">${escapeHtml(topProduct?.code || '')}</span><span class="drawer-prod-name">${escapeHtml(topProduct?.name || '')}</span></div>
      ${list.length > 1 ? `<div class="drawer-more">+${list.length - 1} itens</div>` : ''}
      ${priorityBadge}
    </div>
    <div class="cap-bar-wrap" style="margin-top:auto"><div class="cap-bar ${capCls}" style="width:${capPct}%"></div></div>
  </div>`;
}

function renderShippingShelfSource() {
  const grid = document.getElementById('shipping-shelves-grid');
  if (!grid) return;
  const search = getShippingSourceSearchTerm();
  const depotIds = getShippingSourceDepotIds().sort((a, b) => {
    const pa = getDepotShippingPriority(a);
    const pb = getDepotShippingPriority(b);
    return pa.tier - pb.tier || pa.date.localeCompare(pb.date) || a.localeCompare(b);
  });
  let html = '';
  let firstSelectable = null;
  depotIds.forEach(depotId => {
    const depot = getDepotById(depotId);
    const shelfBlocks = (shelvesAll[depotId] || [])
      .filter(shelf => shelf.id !== 'DESC' || depotId === 'dep_discard')
      .map(shelf => {
      const drawerRows = [];
      let drawersHtml = '';
      for (let floor = 1; floor <= shelf.floors; floor++) {
        const drawerCards = [];
        for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
          const key = drawerKey(shelf.id, floor, drawer);
          const list = getShippingDrawerProducts(depotId, key);
          if (!list.length) continue;
          const haystack = `${key} ${list.map(product => `${product.code} ${product.name}`).join(' ')}`.toLowerCase();
          if (search && !haystack.includes(search)) continue;
          const priority = getDrawerShippingPriority(list);
          drawerCards.push({ key, html: buildShippingDrawerCard(depotId, shelf, key, list), priority });
          if (!firstSelectable || priority.tier < firstSelectable.priority.tier || (priority.tier === firstSelectable.priority.tier && priority.date < firstSelectable.priority.date)) {
            firstSelectable = { depotId, drawerKey: key, priority };
          }
        }
        drawerCards.sort((a, b) => a.priority.tier - b.priority.tier || a.priority.date.localeCompare(b.priority.date) || a.key.localeCompare(b.key));
        if (drawerCards.length) drawerRows.push(`<div class="floor" style="padding:6px 8px"><div class="floor-label">${escapeHtml(shelf.id)}${floor}</div><div class="drawers">${drawerCards.map(item => item.html).join('')}</div></div>`);
      }
      drawersHtml = drawerRows.join('');
      if (!drawersHtml) return '';
      const shelfPriority = getShelfShippingPriority(depotId, shelf);
      return `<div class="shelf-block ${escapeHtml(getShelfTypeClass(shelf.type))}">
        <div class="shelf-block-header">
          <div>
            <div class="shelf-block-name">${escapeHtml(shelf.id)}</div>
            <div class="shelf-block-stats">${escapeHtml(getShelfTypeLabel(shelf.type))} · ${shelf.floors} and. · ${shelf.drawers} gav. · ${shelfPriority.tier === 0 ? 'FEFO prioritária' : shelfPriority.tier === 1 ? 'validade curta depois' : shelfPriority.tier === 3 ? 'somente vencidos' : 'sem validade'}</div>
          </div>
        </div>
        <div class="floors">${drawersHtml}</div>
      </div>`;
    }).map((htmlBlock, index, arr) => {
      if (!htmlBlock) return null;
      const shelf = (shelvesAll[depotId] || []).filter(item => item.id !== 'DESC' || depotId === 'dep_discard')[index];
      return { html: htmlBlock, priority: getShelfShippingPriority(depotId, shelf) };
    }).filter(Boolean).sort((a, b) => a.priority.tier - b.priority.tier || a.priority.date.localeCompare(b.priority.date)).map(item => item.html).join('');
    if (!shelfBlocks) return;
    html += `<div class="shipping-depot-group">
      ${depotIds.length > 1 ? `<div class="shipping-depot-group-title">${escapeHtml(depot?.name || depotId)}</div>` : ''}
      <div class="shelves-grid">${shelfBlocks}</div>
    </div>`;
  });
  grid.innerHTML = html || '<div class="empty-msg">Nenhuma gaveta ocupada encontrada com os filtros atuais.</div>';
  if ((!shippingSelected.depotId || !shippingSelected.drawerKey) && firstSelectable) {
    shippingSelected = { depotId: firstSelectable.depotId, drawerKey: firstSelectable.drawerKey };
    return renderShippingShelfSource();
  }
  grid.querySelectorAll('[data-shipping-drawer]').forEach(el => {
    el.onclick = () => {
      shippingSelected = { depotId: el.dataset.depot, drawerKey: el.dataset.key };
      renderShippingPage();
    };
  });
}

function renderShippingSourceProducts() {
  const label = document.getElementById('shipping-selected-drawer-label');
  const listEl = document.getElementById('shipping-source-products');
  if (!label || !listEl) return;
  if (!shippingSelected.depotId || !shippingSelected.drawerKey) {
    label.textContent = 'Selecione uma gaveta para listar os produtos.';
    listEl.innerHTML = '<div class="empty-msg">Nenhum local selecionado.</div>';
    return;
  }
  const depot = getDepotById(shippingSelected.depotId);
  label.textContent = `${depot?.name || shippingSelected.depotId} · ${shippingSelected.drawerKey}`;
  const productsList = getShippingDrawerProducts(shippingSelected.depotId, shippingSelected.drawerKey)
    .map((product, index) => ({ product, index }))
    .sort((a, b) => compareShippingProducts(a.product, b.product));
  if (!productsList.length) {
    listEl.innerHTML = '<div class="empty-msg">Gaveta sem produtos disponíveis.</div>';
    return;
  }
  listEl.innerHTML = productsList.map(({ product, index }, position) => {
    const available = getShippingAvailableForSource(shippingSelected.depotId, shippingSelected.drawerKey, product);
    const nearest = nearestExpiry(product);
    const status = productExpiryStatus(product);
    const isPriority = position === 0 && status !== 'expired';
    return `<div class="shipping-product-row ${available.qty <= 0.0001 ? 'cancelled' : ''}" data-shipping-source="1" data-index="${index}" data-signature="${escapeHtml(available.signature)}">
      <div class="shipping-product-main">
        <div class="shipping-product-title">${escapeHtml(product.code)} — ${escapeHtml(product.name || '')}</div>
        <div class="shipping-product-meta">${escapeHtml(shippingSelected.drawerKey)} · disponível ${available.qty.toFixed(3)} un · ${available.kg.toFixed(3)} kg · lote ${escapeHtml(product.lot || '—')} · entrada ${escapeHtml(product.entry || '—')} · validade ${escapeHtml(nearest ? fmtDate(nearest) : '—')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${isPriority ? '<span class="shipping-badge safe">FEFO 1º</span>' : ''}
          <span class="shipping-badge ${status === 'expired' ? 'danger' : 'safe'}">${status === 'expired' ? 'VENCIDO' : status === 'expiring' ? 'A VENCER' : 'OK'}</span>
          ${available.qty <= 0.0001 ? '<span class="shipping-badge danger">RESERVADO NO CARRINHO</span>' : ''}
        </div>
      </div>
      <div class="shipping-product-actions">
        <button class="btn" type="button" data-shipping-add="1" ${available.qty <= 0.0001 ? 'disabled' : ''}>ADICIONAR</button>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('[data-shipping-source]').forEach(el => {
    const signature = el.dataset.signature;
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', () => {
      shippingDragCtx = { depotId: shippingSelected.depotId, drawerKey: shippingSelected.drawerKey, signature };
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      shippingDragCtx = null;
    });
  });
  listEl.querySelectorAll('[data-shipping-add]').forEach(button => {
    button.onclick = ev => {
      const row = ev.currentTarget.closest('[data-shipping-source]');
      openShippingAddModalBySignature(shippingSelected.depotId, shippingSelected.drawerKey, row?.dataset.signature || '');
    };
  });
}

function resolveShippingSource(depotId, drawerKeyValue, signature) {
  const list = getShippingDrawerProducts(depotId, drawerKeyValue);
  const index = list.findIndex(product => buildProductSignature(product) === signature);
  if (index < 0) return null;
  return { index, product: list[index], list };
}

function openShippingAddModalBySignature(depotId, drawerKeyValue, signature) {
  const source = resolveShippingSource(depotId, drawerKeyValue, signature);
  if (!source) return;
  const available = getShippingAvailableForSource(depotId, drawerKeyValue, source.product);
  if (available.qty <= 0.0001 || available.kg <= 0.0001) {
    showNotice({ title: 'ITEM JÁ RESERVADO', icon: '⛔', desc: 'Todo o saldo disponível deste item já está no carrinho.' });
    return;
  }
  shippingAddCtx = { depotId, drawerKeyValue, signature, index: source.index, product: source.product, availableQty: available.qty, availableKg: available.kg };
  document.getElementById('shipping-add-subtitle').textContent = `${getDepotById(depotId)?.name || depotId} · ${drawerKeyValue}`;
  document.getElementById('shipping-add-summary').innerHTML = [
    ['PRODUTO', `${source.product.code} — ${source.product.name || ''}`],
    ['SALDO', `${available.qty.toFixed(3)} un · ${available.kg.toFixed(3)} kg`],
    ['LOTE', source.product.lot || '—'],
    ['VALIDADE', nearestExpiry(source.product) ? fmtDate(nearestExpiry(source.product)) : '—'],
  ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
  document.getElementById('shipping-add-qty').value = available.qty.toFixed(3);
  document.getElementById('shipping-add-kg').value = available.kg.toFixed(3);
  document.getElementById('shipping-add-note').value = '';
  document.getElementById('shipping-add-modal').classList.add('open');
}

function closeShippingAddModal() {
  document.getElementById('shipping-add-modal')?.classList.remove('open');
  shippingAddCtx = null;
}

function syncShippingAddFields(source = 'qty') {
  if (!shippingAddCtx) return;
  const qtyEl = document.getElementById('shipping-add-qty');
  const kgEl = document.getElementById('shipping-add-kg');
  const maxQty = Math.max(0, shippingAddCtx.availableQty);
  const maxKg = Math.max(0, shippingAddCtx.availableKg);
  let qty = Math.max(0, parseFloat(qtyEl.value || '0') || 0);
  let kg = Math.max(0, parseFloat(kgEl.value || '0') || 0);
  if (maxQty <= 0 || maxKg <= 0 || qty === 0 || kg === 0) {
    if (source === 'kg') qtyEl.value = '0.000';
    if (source === 'qty') kgEl.value = '0.000';
    if (qty === 0 || source === 'kg') qty = 0;
    if (kg === 0 || source === 'qty') kg = 0;
    return;
  }
  if (source === 'kg') {
    qty = (kg / maxKg) * maxQty;
    qtyEl.value = qty.toFixed(3);
  } else {
    kg = (qty / maxQty) * maxKg;
    kgEl.value = kg.toFixed(3);
  }
}

async function confirmShippingAdd() {
  if (!shippingAddCtx) return;
  const qty = parseFloat(document.getElementById('shipping-add-qty')?.value || '0') || 0;
  const kg = parseFloat(document.getElementById('shipping-add-kg')?.value || '0') || 0;
  const note = sanitizeTextInput(document.getElementById('shipping-add-note')?.value || '', { maxLength: 180 });
  if (qty <= 0 || kg <= 0 || qty - shippingAddCtx.availableQty > 0.0001 || kg - shippingAddCtx.availableKg > 0.0001) {
    await showNotice({ title: 'SALDO INVÁLIDO', icon: '⛔', desc: 'A quantidade ou peso informados excedem o disponível na origem.' });
    return;
  }
  outboundCart.push({
    id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceDepotId: shippingAddCtx.depotId,
    sourceDepotName: getDepotById(shippingAddCtx.depotId)?.name || shippingAddCtx.depotId,
    sourceDrawerKey: shippingAddCtx.drawerKeyValue,
    sourceSignature: shippingAddCtx.signature,
    productCode: shippingAddCtx.product.code,
    productName: shippingAddCtx.product.name || '',
    lot: shippingAddCtx.product.lot || '',
    entry: shippingAddCtx.product.entry || '',
    expiries: deepClone(getExpiries(shippingAddCtx.product)),
    qty: parseFloat(qty.toFixed(3)),
    kg: parseFloat(kg.toFixed(3)),
    note,
  });
  const addedId = outboundCart[outboundCart.length - 1].id;
  setUndoAction(`adição do item ${shippingAddCtx.product.code} ao carrinho`, () => {
    outboundCart = outboundCart.filter(item => item.id !== addedId);
    renderShippingPage();
  });
  closeShippingAddModal();
  renderShippingPage();
}

function setupShippingCartDropzone() {
  const dropzone = document.getElementById('shipping-cart-dropzone');
  if (!dropzone || dropzone.dataset.bound === '1') return;
  dropzone.dataset.bound = '1';
  dropzone.addEventListener('dragover', ev => {
    if (!shippingDragCtx) return;
    ev.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', ev => {
    ev.preventDefault();
    dropzone.classList.remove('dragover');
    if (!shippingDragCtx) return;
    openShippingAddModalBySignature(shippingDragCtx.depotId, shippingDragCtx.drawerKey, shippingDragCtx.signature);
    shippingDragCtx = null;
  });
}

function removeShippingCartItem(cartId) {
  const removed = outboundCart.find(item => item.id === cartId);
  outboundCart = outboundCart.filter(item => item.id !== cartId);
  if (removed) {
    setUndoAction(`remoção do item ${removed.productCode} do carrinho`, () => {
      outboundCart.push(removed);
      renderShippingPage();
    });
  }
  renderShippingPage();
}

function clearShippingCart() {
  const previous = deepClone(outboundCart);
  outboundCart = [];
  if (previous.length) {
    setUndoAction('limpeza do carrinho', () => {
      outboundCart = previous;
      renderShippingPage();
    });
  }
  renderShippingPage();
}

function toggleCartFefoBreak(cartId, checked) {
  const item = outboundCart.find(entry => entry.id === cartId);
  if (!item) return;
  item.allowFefoBreak = !!checked;
  renderShippingPage();
}

function renderShippingCart() {
  const listEl = document.getElementById('shipping-cart-list');
  const summaryEl = document.getElementById('shipping-cart-summary');
  const card = document.querySelector('.shipping-cart-card');
  const discardBanner = document.getElementById('shipping-discard-banner');
  if (!listEl || !summaryEl) return;
  const mode = document.getElementById('shipping-operation-type')?.value || 'shipment';
  const fefo = evaluateFefoBreak(outboundCart);
  if (card) card.classList.toggle('discard-mode', mode === 'discard');
  if (discardBanner) discardBanner.style.display = mode === 'discard' ? 'block' : 'none';
  if (!outboundCart.length) {
    listEl.innerHTML = '<div class="empty-msg">Carrinho vazio.</div>';
    summaryEl.innerHTML = '<div class="confirm-sum-row"><span class="confirm-sum-label">STATUS</span><span class="confirm-sum-val">Nenhum item reservado.</span></div>';
    return;
  }
  const totalQty = outboundCart.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
  const totalKg = outboundCart.reduce((sum, item) => sum + (parseFloat(item.kg || 0) || 0), 0);
  listEl.innerHTML = outboundCart.map(item => {
    const expiryLabel = item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—';
    const requiresFefoBreak = fefo.brokenItemIds.has(item.id);
    return `<div class="shipping-cart-row">
      <div class="shipping-cart-main">
        <div class="shipping-cart-title">${escapeHtml(item.productCode)} — ${escapeHtml(item.productName)}</div>
        <div class="shipping-cart-meta">${escapeHtml(item.sourceDepotName)} · ${escapeHtml(item.sourceDrawerKey)} · ${item.qty.toFixed(3)} un · ${item.kg.toFixed(3)} kg${item.note ? ' · ' + escapeHtml(item.note) : ''}</div>
        <div class="shipping-cart-meta shipping-cart-meta-row">
          <span>VALIDADE: <strong>${escapeHtml(expiryLabel)}</strong></span>
          ${requiresFefoBreak ? '<span class="shipping-badge danger">QUEBRA FEFO NECESSÁRIA</span>' : '<span class="shipping-badge safe">ORDEM FEFO OK</span>'}
        </div>
        <label class="shelf-type-option shipping-fefo-toggle ${requiresFefoBreak ? 'shelf-type-option-blocked' : ''}">
          <input type="checkbox" ${item.allowFefoBreak ? 'checked' : ''} ${requiresFefoBreak ? '' : 'disabled'} onchange="toggleCartFefoBreak('${escapeJs(item.id)}', this.checked)">
          <span>${requiresFefoBreak ? 'AUTORIZAR QUEBRA DE FEFO NESTE PRODUTO / VALIDADE' : 'SEM QUEBRA DE FEFO NESTE PRODUTO / VALIDADE'}</span>
        </label>
      </div>
      <div class="shipping-cart-actions">
        <button class="btn btn-danger" onclick="removeShippingCartItem('${escapeJs(item.id)}')">REMOVER</button>
      </div>
    </div>`;
  }).join('');
  summaryEl.innerHTML = [
    ['TIPO', mode === 'discard' ? 'DESCARTE' : 'SAÍDA'],
    ['ITENS', String(outboundCart.length)],
    ['QTD TOTAL', totalQty.toFixed(3)],
    ['KG TOTAL', totalKg.toFixed(3)],
    ['FEFO', fefo.broken ? 'REVISÃO PENDENTE' : 'OK'],
  ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
}

function buildShippingEntriesForCode(code) {
  const entries = [];
  depots.forEach(depot => {
    Object.entries(productsAll[depot.id] || {}).forEach(([drawerKeyValue, list]) => {
      (list || []).forEach(product => {
        if (product.code !== code) return;
        entries.push({
          depotId: depot.id,
          depotName: depot.name,
          drawerKey: drawerKeyValue,
          signature: buildProductSignature(product),
          qty: parseFloat(product.qty || 0) || 0,
          entry: product.entry || '9999-12-31',
          nearestExpiry: nearestExpiry(product),
          status: productExpiryStatus(product),
        });
      });
    });
  });
  return entries;
}

function evaluateFefoBreak(cartItems = outboundCart) {
  const selectedByCode = new Map();
  cartItems.forEach(item => {
    if (!selectedByCode.has(item.productCode)) selectedByCode.set(item.productCode, []);
    selectedByCode.get(item.productCode).push(item);
  });
  const brokenKeys = new Set();
  const brokenItemIds = new Set();
  const warnings = [];
  selectedByCode.forEach((items, code) => {
    const entries = buildShippingEntriesForCode(code).filter(entry => entry.status !== 'expired');
    if (!entries.length) return;
    entries.sort((a, b) => {
      const expA = a.nearestExpiry || '9999-12-31';
      const expB = b.nearestExpiry || '9999-12-31';
      return expA.localeCompare(expB) || a.entry.localeCompare(b.entry) || a.drawerKey.localeCompare(b.drawerKey);
    });
    const selectedQtyBySignature = new Map();
    items.forEach(item => {
      const key = `${item.sourceDepotId}::${item.sourceDrawerKey}::${item.sourceSignature}`;
      selectedQtyBySignature.set(key, (selectedQtyBySignature.get(key) || 0) + (parseFloat(item.qty || 0) || 0));
      const sourceStatus = productExpiryStatus({ expiries: item.expiries || [] });
      if (sourceStatus === 'expired') brokenKeys.add(key);
    });
    let remaining = items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
    const recommendedBySignature = new Map();
    entries.forEach(entry => {
      if (remaining <= 0.0001) return;
      const take = Math.min(entry.qty, remaining);
      remaining -= take;
      recommendedBySignature.set(`${entry.depotId}::${entry.drawerKey}::${entry.signature}`, take);
    });
    selectedQtyBySignature.forEach((selectedQty, key) => {
      if (selectedQty - (recommendedBySignature.get(key) || 0) > 0.0001) brokenKeys.add(key);
    });
    items.forEach(item => {
      const key = `${item.sourceDepotId}::${item.sourceDrawerKey}::${item.sourceSignature}`;
      if (brokenKeys.has(key)) brokenItemIds.add(item.id);
    });
    if (items.some(item => brokenItemIds.has(item.id))) {
      warnings.push(`${code}: há item selecionado fora da ordem FEFO.`);
    }
  });
  return {
    broken: brokenKeys.size > 0,
    brokenKeys,
    brokenItemIds,
    warnings,
  };
}

function getMinimumShipmentDaysForCategory(category = '') {
  const normalized = String(category || '').trim().toLowerCase();
  if (!normalized) return 0;
  if (/quim|tinta|solvent|cola/.test(normalized)) return 20;
  if (/alim|food|bebid|farm|medic|higiene/.test(normalized)) return 30;
  return 15;
}

function evaluateShipmentExpiryBlocks(cartItems = outboundCart) {
  const blocked = [];
  cartItems.forEach(item => {
    const source = resolveShippingSource(item.sourceDepotId, item.sourceDrawerKey, item.sourceSignature);
    const product = source?.product || item;
    const nearest = nearestExpiry(product);
    if (!nearest) return;
    const days = daysUntil(nearest);
    const minDays = getMinimumShipmentDaysForCategory(product.category || item.category || '');
    if (days >= 0 && days < minDays) {
      blocked.push({
        item,
        nearest,
        days,
        minDays,
        category: product.category || item.category || 'geral',
      });
    }
  });
  return blocked;
}

function isCriticalShippingOperation(cartItems = outboundCart) {
  const totalKg = cartItems.reduce((sum, item) => sum + (parseFloat(item.kg || 0) || 0), 0);
  const highValueLines = cartItems.filter(item => (parseFloat(item.cost || 0) || 0) * (parseFloat(item.qty || 0) || 0) >= 500);
  return totalKg >= 80 || highValueLines.length > 0 || cartItems.length >= 8;
}

function openFinalizeShippingModal() {
  const mode = document.getElementById('shipping-operation-type')?.value || 'shipment';
  if (mode === 'discard' && !hasPermission('discard.process')) return;
  if (mode !== 'discard' && !hasPermission('shipment.process')) return;
  if (!outboundCart.length) {
    showNotice({ title: 'CARRINHO VAZIO', icon: '⛔', desc: 'Adicione ao menos um item ao carrinho antes de gerar a saída.' });
    return;
  }
  document.getElementById('shipping-final-type').value = document.getElementById('shipping-operation-type')?.value || 'shipment';
  document.getElementById('shipping-final-signer-operator').value = getCurrentUserLabel();
  document.getElementById('shipping-final-signer-driver').value = '';
  document.getElementById('shipping-final-signature-confirm').checked = false;
  syncFinalizeShippingType();
  renderFinalizeShippingSummary();
  document.getElementById('shipping-finalize-modal').classList.add('open');
}

function closeFinalizeShippingModal() {
  document.getElementById('shipping-finalize-modal')?.classList.remove('open');
}

function syncFinalizeShippingType() {
  const type = document.getElementById('shipping-final-type')?.value || 'shipment';
  const discardGroup = document.getElementById('shipping-final-discard-group');
  if (discardGroup) discardGroup.style.display = type === 'discard' ? '' : 'none';
  renderFinalizeShippingSummary();
}

function renderFinalizeShippingSummary() {
  const summaryEl = document.getElementById('shipping-final-summary');
  const warningEl = document.getElementById('shipping-fefo-warning');
  if (!summaryEl || !warningEl) return;
  const type = document.getElementById('shipping-final-type')?.value || 'shipment';
  const fefo = evaluateFefoBreak(outboundCart);
  const expiryBlocks = type === 'shipment' ? evaluateShipmentExpiryBlocks(outboundCart) : [];
  const discardPlan = type === 'discard' ? buildDiscardPlan(outboundCart) : null;
  const totalQty = outboundCart.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
  const totalKg = outboundCart.reduce((sum, item) => sum + (parseFloat(item.kg || 0) || 0), 0);
  const critical = isCriticalShippingOperation(outboundCart);
  if (type === 'discard' && discardPlan && !discardPlan.ok) {
    warningEl.style.display = 'block';
    warningEl.innerHTML = `Alerta de descarte: ${escapeHtml(discardPlan.message)}`;
  } else if (expiryBlocks.length) {
    warningEl.style.display = 'block';
    warningEl.innerHTML = `Bloqueio de validade para expedição:<br>${expiryBlocks.map(row => `${escapeHtml(row.item.productCode)} vence em ${row.days}d e exige mínimo de ${row.minDays}d para a categoria ${escapeHtml(row.category)}.`).join('<br>')}`;
  } else if (fefo.broken) {
    warningEl.style.display = 'block';
    warningEl.innerHTML = `Risco operacional: esta saída quebra FEFO.<br>${fefo.warnings.map(item => escapeHtml(item)).join('<br>')}`;
  } else {
    warningEl.style.display = 'none';
    warningEl.innerHTML = '';
  }
  summaryEl.innerHTML = `<div class="shipping-final-card ${type === 'discard' ? 'discard' : ''}">
    <div class="confirm-summary" style="display:flex">
      ${[
        ['TIPO', type === 'discard' ? 'DESCARTE' : 'SAÍDA'],
        ['LINHAS', String(outboundCart.length)],
        ['QTD TOTAL', totalQty.toFixed(3)],
        ['KG TOTAL', totalKg.toFixed(3)],
        ['FEFO', fefo.broken ? 'QUEBRADO' : 'OK'],
        ['ASSINATURA', critical ? 'OBRIGATÓRIA' : 'NÃO OBRIGATÓRIA'],
        ...(type === 'discard' ? [['DEPÓSITO DESTINO', 'DEPÓSITO DE DESCARTE']] : []),
      ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('')}
    </div>
  </div>
  <div class="shipping-final-lines">
    ${outboundCart.map(item => {
      const discardLine = type === 'discard' ? discardPlan?.lines.find(line => line.itemId === item.id) : null;
      const fefoTag = fefo.brokenItemIds.has(item.id) ? ' (quebra de fefo)' : '';
      return `<div class="shipping-final-line">
      <strong>${escapeHtml(item.productCode)} — ${escapeHtml(item.productName)}</strong><br>
      ${escapeHtml(item.sourceDepotName)} · ${escapeHtml(item.sourceDrawerKey)} · ${item.qty.toFixed(3)} un · ${item.kg.toFixed(3)} kg · lote ${escapeHtml(item.lot || '—')} · validade ${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')}${escapeHtml(fefoTag)}
      ${discardLine ? `<br><span style="color:var(--danger);font-family:'IBM Plex Mono',monospace">DESCARTE: ${escapeHtml(discardLine.depot.name)} · ${escapeHtml(discardLine.drawerKeyValue)}</span>` : ''}
    </div>`;
    }).join('')}
  </div>`;
}

function buildExpiryBreakdown(item) {
  const expiries = Array.isArray(item.expiries) && item.expiries.length ? item.expiries : [''];
  const totalQty = parseFloat(item.qty || 0) || 0;
  const totalKg = parseFloat(item.kg || 0) || 0;
  const count = expiries.length;
  return expiries.map((expiry, index) => {
    const qty = index === count - 1
      ? parseFloat((totalQty - ((Math.floor((totalQty / count) * 1000) / 1000) * (count - 1))).toFixed(3))
      : parseFloat((totalQty / count).toFixed(3));
    const kg = index === count - 1
      ? parseFloat((totalKg - ((Math.floor((totalKg / count) * 1000) / 1000) * (count - 1))).toFixed(3))
      : parseFloat((totalKg / count).toFixed(3));
    return { expiry, qty, kg };
  });
}

function buildPrintableRecordHtml(record) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Resumo ${record.code || record.id}</title><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111} h1{font-size:20px;margin:0 0 12px} .meta{margin-bottom:18px;font-size:13px;line-height:1.6}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #ccc;padding:8px;text-align:left} th{background:#f2f2f2}
  </style></head><body>
    <h1>${record.kind === 'discard' ? 'Resumo de Descarte' : 'Resumo de Saída'}</h1>
    <div class="meta">Código: ${escapeHtml(record.code || '—')}<br>Cliente: ${escapeHtml(record.customer || '—')}<br>Documento: ${escapeHtml(record.document || '—')}<br>Usuário: ${escapeHtml(record.createdBy || '—')}<br>Data: ${escapeHtml(fmtDateTime(record.createdAt))}</div>
    <table><thead><tr><th>Produto</th><th>Origem</th><th>Validade</th><th>Qtd</th><th>Kg</th><th>Lote</th></tr></thead><tbody>
      ${record.items.map(item => buildExpiryBreakdown(item).map(row => `<tr><td>${escapeHtml(item.productCode)} - ${escapeHtml(item.productName)}</td><td>${escapeHtml(item.fromDepotName)} · ${escapeHtml(item.fromDrawerKey)}</td><td>${escapeHtml(row.expiry ? fmtDate(row.expiry) : '—')}${item.allowFefoBreak ? ' (quebra de fefo)' : ''}</td><td>${row.qty.toFixed(3)}</td><td>${row.kg.toFixed(3)}</td><td>${escapeHtml(item.lot || '—')}</td></tr>`).join('')).join('')}
    </tbody></table>
  </body></html>`;
}

function printFinalizeShippingSummary() {
  const record = buildCurrentShippingRecordPreview();
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) return;
  printWindow.document.write(buildPrintableRecordHtml(record));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function buildCurrentShippingRecordPreview() {
  const type = document.getElementById('shipping-final-type')?.value || 'shipment';
  return {
    id: 'preview',
    kind: type,
    code: sanitizeTextInput(document.getElementById('shipping-final-code')?.value || '', { maxLength: 60, uppercase: true }),
    customer: sanitizeTextInput(document.getElementById('shipping-final-customer')?.value || '', { maxLength: 120 }),
    document: sanitizeTextInput(document.getElementById('shipping-final-document')?.value || '', { maxLength: 60 }),
    createdBy: getCurrentUserLabel(),
    createdAt: new Date().toISOString(),
    items: outboundCart.map(item => ({
      productCode: item.productCode,
      productName: item.productName,
      fromDepotName: item.sourceDepotName,
      fromDrawerKey: item.sourceDrawerKey,
      qty: parseFloat(item.qty || 0) || 0,
      kg: parseFloat(item.kg || 0) || 0,
      lot: item.lot || '',
      expiries: deepClone(item.expiries || []),
      allowFefoBreak: !!item.allowFefoBreak,
    })),
  };
}

async function confirmFinalizeShipping() {
  if (!outboundCart.length) return;
  const type = document.getElementById('shipping-final-type')?.value || 'shipment';
  if (type === 'discard' && !await requirePermission('discard.process', 'Seu perfil não pode registrar descartes.')) return;
  if (type !== 'discard' && !await requirePermission('shipment.process', 'Seu perfil não pode registrar saídas.')) return;
  const customer = sanitizeTextInput(document.getElementById('shipping-final-customer')?.value || '', { maxLength: 120 });
  const code = sanitizeTextInput(document.getElementById('shipping-final-code')?.value || '', { maxLength: 60, uppercase: true });
  const documentCode = sanitizeTextInput(document.getElementById('shipping-final-document')?.value || '', { maxLength: 60 });
  const note = sanitizeTextInput(document.getElementById('shipping-final-note')?.value || '', { maxLength: 180 });
  const discardReason = sanitizeTextInput(document.getElementById('shipping-final-discard-reason')?.value || '', { maxLength: 180 });
  const signerOperator = sanitizeTextInput(document.getElementById('shipping-final-signer-operator')?.value || '', { maxLength: 120 });
  const signerDriver = sanitizeTextInput(document.getElementById('shipping-final-signer-driver')?.value || '', { maxLength: 120 });
  const signatureConfirmed = !!document.getElementById('shipping-final-signature-confirm')?.checked;
  const fefo = evaluateFefoBreak(outboundCart);
  const expiryBlocks = type === 'shipment' ? evaluateShipmentExpiryBlocks(outboundCart) : [];
  const discardPlan = type === 'discard' ? buildDiscardPlan(outboundCart) : null;
  const critical = isCriticalShippingOperation(outboundCart);

  if (!customer) {
    await showNotice({ title: 'CLIENTE OBRIGATÓRIO', icon: '⛔', desc: 'Informe cliente ou destinatário antes de confirmar.' });
    return;
  }
  if (!code) {
    await showNotice({ title: 'CÓDIGO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o código do pedido, OS ou referência manual.' });
    return;
  }
  if (type === 'discard' && !discardReason) {
    await showNotice({ title: 'MOTIVO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o motivo do descarte antes de confirmar.' });
    return;
  }
  if (expiryBlocks.length) {
    await showNotice({
      title: 'EXPEDIÇÃO BLOQUEADA POR VALIDADE',
      icon: '⛔',
      desc: 'Há itens abaixo da validade mínima configurada para expedição nesta categoria.',
      summary: { ITENS: expiryBlocks.map(row => `${row.item.productCode} (${row.days}d/${row.minDays}d)`).join(', ') },
    });
    return;
  }
  if (type === 'discard' && discardPlan && !discardPlan.ok) {
    await showNotice({ title: 'SEM ESPAÇO NO DESCARTE', icon: '⛔', desc: discardPlan.message, summary: { DESTINO: 'DEPÓSITO DE DESCARTE · PRATELEIRA DESC' } });
    return;
  }
  if (critical && (!signerOperator || !signerDriver || !signatureConfirmed)) {
    await showNotice({
      title: 'ASSINATURA DIGITAL OBRIGATÓRIA',
      icon: '✍',
      desc: 'Saídas críticas exigem identificação do conferente, do motorista/recebedor e confirmação explícita.',
      summary: { MOTIVO: 'alto peso, alto valor ou operação com muitas linhas' },
    });
    return;
  }
  const unauthorizedBreakItems = outboundCart.filter(item => fefo.brokenItemIds.has(item.id) && !item.allowFefoBreak);
  if (unauthorizedBreakItems.length) {
    await showNotice({
      title: 'QUEBRA DE FEFO BLOQUEADA',
      icon: '⛔',
      desc: 'Há itens fora da ordem FEFO sem autorização individual. Ajuste o lote ou autorize a quebra no próprio item do carrinho.',
      summary: {
        RISCO: 'expedir lote fora da menor validade disponível',
        ITENS: unauthorizedBreakItems.map(item => `${item.productCode}@${item.sourceDrawerKey}`).join(', '),
      },
    });
    return;
  }
  if (fefo.broken) {
    const okRisk = await showConfirm({
      title: 'CONFIRMAR QUEBRA DE FEFO',
      icon: '⚠',
      desc: 'Você está assumindo o risco de retirar fora da ordem FEFO.',
      summary: { RISCO: 'sobras com validade mais curta podem vencer primeiro', AÇÃO: 'registrar exceção no log' },
      okLabel: 'ASSUMIR RISCO',
      okStyle: 'danger',
    });
    if (!okRisk) return;
  }

  const grouped = new Map();
  outboundCart.forEach(item => {
    const key = `${item.sourceDepotId}::${item.sourceDrawerKey}::${item.sourceSignature}`;
    if (!grouped.has(key)) grouped.set(key, { qty: 0, kg: 0, item });
    grouped.get(key).qty += parseFloat(item.qty || 0) || 0;
    grouped.get(key).kg += parseFloat(item.kg || 0) || 0;
  });

  for (const [key, group] of grouped.entries()) {
    const source = resolveShippingSource(group.item.sourceDepotId, group.item.sourceDrawerKey, group.item.sourceSignature);
    if (!source) {
      await showNotice({ title: 'ORIGEM ALTERADA', icon: '⛔', desc: `O item ${group.item.productCode} mudou desde a montagem do carrinho. Recarregue a página.` });
      return;
    }
    const currentQty = parseFloat(source.product.qty || 0) || 0;
    const currentKg = parseFloat(source.product.kgTotal ?? source.product.kg) || 0;
    if (group.qty - currentQty > 0.0001 || group.kg - currentKg > 0.0001) {
      await showNotice({ title: 'SALDO INSUFICIENTE', icon: '⛔', desc: `O item ${group.item.productCode} não possui mais saldo suficiente na origem.` });
      return;
    }
  }

  const record = {
    id: `out-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: type,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: getCurrentUserLabel(),
    customer,
    code,
    document: documentCode,
    note,
    discardReason,
    fefoBreak: fefo.broken,
    shipmentExpiryBlocked: false,
    signatures: critical ? {
      operator: signerOperator,
      driver: signerDriver,
      confirmedAt: new Date().toISOString(),
    } : null,
    items: [],
  };

  grouped.forEach(group => {
    const source = resolveShippingSource(group.item.sourceDepotId, group.item.sourceDrawerKey, group.item.sourceSignature);
    if (!source) return;
    const product = source.product;
    const currentQty = parseFloat(product.qty || 0) || 0;
    const currentKg = parseFloat(product.kgTotal ?? product.kg) || 0;
    if (group.qty >= currentQty - 0.0001) {
      source.list.splice(source.index, 1);
      if (!source.list.length) delete productsAll[group.item.sourceDepotId][group.item.sourceDrawerKey];
    } else {
      product.qty = parseFloat((currentQty - group.qty).toFixed(3));
      product.kg = parseFloat((currentKg - group.kg).toFixed(3));
      product.kgTotal = product.kg;
    }
  });

  outboundCart.forEach(item => {
    const line = {
      productCode: item.productCode,
      productName: item.productName,
      qty: parseFloat(item.qty || 0) || 0,
      kg: parseFloat(item.kg || 0) || 0,
      fromDepotId: item.sourceDepotId,
      fromDepotName: item.sourceDepotName,
      fromDrawerKey: item.sourceDrawerKey,
      lot: item.lot || '',
      entry: item.entry || '',
      expiries: deepClone(item.expiries || []),
      note: item.note || '',
      allowFefoBreak: !!item.allowFefoBreak,
    };
    if (type === 'discard') {
      const discardTarget = discardPlan?.lines.find(entry => entry.itemId === item.id);
      if (!discardTarget) return;
      productsAll[discardTarget.depot.id][discardTarget.drawerKeyValue].push({
        code: item.productCode,
        name: item.productName,
        qty: line.qty,
        kg: line.kg,
        kgTotal: line.kg,
        lot: item.lot || '',
        entry: item.entry || new Date().toISOString().slice(0, 10),
        expiries: deepClone(item.expiries || []),
        notes: `DESCARTE · ${discardReason || 'sem motivo informado'}`,
      });
      line.toDepotId = discardTarget.depot.id;
      line.toDepotName = discardTarget.depot.name;
      line.toDrawerKey = discardTarget.drawerKeyValue;
    }
    record.items.push(line);
  });

  outboundRecords.unshift(record);
  logHistory(type === 'discard' ? '🟥' : '📤', `${type === 'discard' ? 'Descarte' : 'Saída'} registrada: ${code}`, `${customer} · ${record.items.length} linha(s) · ${record.items.map(item => `${item.productCode}@${item.fromDrawerKey}`).join(', ')}${type === 'discard' ? ' · destino DEPÓSITO DE DESCARTE' : ''}${note ? ' · ' + note : ''}`, {
    depotId: record.items[0]?.fromDepotId || activeDepotId,
    type: 'saida',
    productCode: record.items.map(item => item.productCode).join(','),
  });
  if (type === 'discard') {
    logHistory('⚠', 'Transferência para descarte controlado', `${code} · ${record.items.map(item => `${item.productCode} ${item.fromDrawerKey}→${item.toDrawerKey}`).join(', ')} · motivo ${discardReason}`, {
      depotId: 'dep_discard',
      type: 'saida',
      productCode: record.items.map(item => item.productCode).join(','),
    });
  }
  if (fefo.broken) {
    logHistory('⚠', 'Quebra de FEFO autorizada na saída', `${code} · ${customer} · ${record.items.map(item => `${item.productCode}@${item.fromDrawerKey}`).join(', ')}`, {
      depotId: record.items[0]?.fromDepotId || activeDepotId,
      type: 'saida',
      productCode: record.items.map(item => item.productCode).join(','),
    });
  }
  if (critical) {
    logHistory('✍', 'Assinatura digital de saída', `${code} · conferente ${signerOperator} · motorista/recebedor ${signerDriver}`, {
      type: 'saida',
      depotId: outboundCart[0]?.sourceDepotId || '',
    });
  }
  outboundCart = [];
  persistOutboundRecordsState().catch(err => console.error('Falha ao persistir registro de saída:', err));
  closeFinalizeShippingModal();
  renderAll();
}

function renderOutboundRecordsPage() {
  const listEl = document.getElementById('outbound-record-list');
  if (!listEl) return;
  const search = (document.getElementById('outbound-filter-search')?.value || '').trim().toLowerCase();
  const type = document.getElementById('outbound-filter-type')?.value || '';
  const status = document.getElementById('outbound-filter-status')?.value || '';
  const rows = outboundRecords.filter(record => {
    if (!recordMatchesDepotScope(record)) return false;
    if (type && record.kind !== type) return false;
    if (status && record.status !== status) return false;
    if (!search) return true;
    const haystack = `${record.customer} ${record.code} ${record.document} ${record.note} ${record.discardReason} ${record.items.map(item => `${item.productCode} ${item.productName}`).join(' ')}`.toLowerCase();
    return haystack.includes(search);
  });
  if (!rows.length) {
    listEl.innerHTML = '<div class="empty-msg">Nenhum registro de saída encontrado.</div>';
    return;
  }
  listEl.innerHTML = rows.map(record => {
    const realIndex = outboundRecords.findIndex(item => item.id === record.id);
    return `<div class="outbound-record-card" style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start">
      <div class="outbound-record-main">
        <div class="outbound-record-title">${escapeHtml(record.code || record.id)} — ${escapeHtml(record.customer || 'Sem cliente')}</div>
        <div class="outbound-record-meta">${record.kind === 'discard' ? 'DESCARTE' : 'SAÍDA'} · ${escapeHtml(record.status || 'confirmed')} · ${escapeHtml(fmtDateTime(record.createdAt))} · por ${escapeHtml(record.createdBy || '—')}</div>
        <div class="outbound-record-meta" style="margin-top:6px">${record.items.map(item => `${escapeHtml(item.productCode)} @ ${escapeHtml(item.fromDrawerKey)} (${item.qty.toFixed(3)} un / ${item.kg.toFixed(3)} kg)`).join(' · ')}</div>
      </div>
      <div class="outbound-record-actions">
        <button class="btn" data-idx="${realIndex}" onclick="printOutboundRecord(parseInt(this.dataset.idx))">IMPRIMIR</button>
        <button class="btn btn-accent" data-idx="${realIndex}" onclick="openOutboundEditModal(parseInt(this.dataset.idx))">EDITAR</button>
      </div>
    </div>`;
  }).join('');
}

function clearOutboundFilters() {
  clearFilterBar('outbound-filter-bar', renderOutboundRecordsPage);
  return;
  ['outbound-filter-search'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['outbound-filter-type', 'outbound-filter-status'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderOutboundRecordsPage();
}

function printOutboundRecord(index) {
  const record = outboundRecords[index];
  if (!record) return;
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) return;
  printWindow.document.write(buildPrintableRecordHtml(record));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function openOutboundEditModal(index) {
  const record = outboundRecords[index];
  if (!record) return;
  outboundEditIdx = index;
  document.getElementById('outbound-edit-subtitle').textContent = `${record.code || record.id} · ${record.kind === 'discard' ? 'DESCARTE' : 'SAÍDA'}`;
  document.getElementById('outbound-edit-customer').value = record.customer || '';
  document.getElementById('outbound-edit-code').value = record.code || '';
  document.getElementById('outbound-edit-document').value = record.document || '';
  document.getElementById('outbound-edit-status').value = record.status || 'confirmed';
  document.getElementById('outbound-edit-discard-reason').value = record.discardReason || '';
  document.getElementById('outbound-edit-note').value = record.note || '';
  document.getElementById('outbound-edit-reason-group').style.display = record.kind === 'discard' ? '' : 'none';
  document.getElementById('outbound-edit-summary').innerHTML = record.items.map(item => `<div class="shipping-final-line">
    <strong>${escapeHtml(item.productCode)} — ${escapeHtml(item.productName)}</strong><br>
    ${escapeHtml(item.fromDepotName)} · ${escapeHtml(item.fromDrawerKey)} · ${item.qty.toFixed(3)} un · ${item.kg.toFixed(3)} kg
  </div>`).join('');
  document.getElementById('outbound-edit-modal').classList.add('open');
}

function closeOutboundEditModal() {
  document.getElementById('outbound-edit-modal')?.classList.remove('open');
  outboundEditIdx = null;
}

function saveOutboundEdit() {
  if (outboundEditIdx === null || !outboundRecords[outboundEditIdx]) return;
  const record = outboundRecords[outboundEditIdx];
  record.customer = sanitizeTextInput(document.getElementById('outbound-edit-customer')?.value || '', { maxLength: 120 });
  record.code = sanitizeTextInput(document.getElementById('outbound-edit-code')?.value || '', { maxLength: 60, uppercase: true });
  record.document = sanitizeTextInput(document.getElementById('outbound-edit-document')?.value || '', { maxLength: 60 });
  record.status = document.getElementById('outbound-edit-status')?.value || 'edited';
  record.discardReason = sanitizeTextInput(document.getElementById('outbound-edit-discard-reason')?.value || '', { maxLength: 180 });
  record.note = sanitizeTextInput(document.getElementById('outbound-edit-note')?.value || '', { maxLength: 180 });
  record.updatedAt = new Date().toISOString();
  logHistory('✏', `Registro de saída editado: ${record.code || record.id}`, `${record.customer || 'Sem cliente'} · status ${record.status}`, {
    depotId: record.items[0]?.fromDepotId || activeDepotId,
    type: 'saida',
    productCode: record.items.map(item => item.productCode).join(','),
  });
  persistOutboundRecordsState().catch(err => console.error('Falha ao persistir edição de saída:', err));
  closeOutboundEditModal();
  renderAll();
}

function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
