// ═══════════════════════════════════════════════════════════
// MODULE: indicators.js
// ═══════════════════════════════════════════════════════════

function formatCurrencyBr(value = 0) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value || 0) || 0);
}

function collectInventoryRows(scopeDepotId = getDepotTabsContextId()) {
  const rows = [];
  depots.forEach(depot => {
    if (scopeDepotId !== ALL_DEPOTS_VALUE && depot.id !== scopeDepotId) return;
    Object.entries(productsAll[depot.id] || {}).forEach(([drawerKeyValue, list]) => {
      (list || []).forEach(product => {
        rows.push({ depotId: depot.id, depotName: depot.name, drawerKey: drawerKeyValue, product });
      });
    });
  });
  return rows;
}

function getHistoryRowsForIndicators(scopeDepotId = getDepotTabsContextId()) {
  return auditHistory.filter(item => scopeDepotId === ALL_DEPOTS_VALUE || item.depotId === scopeDepotId);
}

function renderIndicatorsPage() {
  const executiveEl = document.getElementById('ind-executive-grid');
  const abcEl = document.getElementById('ind-abc-table');
  const turnoverEl = document.getElementById('ind-turnover-table');
  const occupancyEl = document.getElementById('ind-occupancy-table');
  const wasteEl = document.getElementById('ind-waste-table');
  const operatorEl = document.getElementById('ind-operator-table');
  if (!executiveEl || !abcEl || !turnoverEl || !occupancyEl || !wasteEl || !operatorEl) return;

  const scopeDepotId = getDepotTabsContextId();
  const inventoryRows = collectInventoryRows(scopeDepotId);
  const historyRows = getHistoryRowsForIndicators(scopeDepotId);
  const outboundRows = historyRows.filter(item => (item.type || inferHistoryType(item.action, item.icon)) === 'saida');
  const entryRows = historyRows.filter(item => (item.type || inferHistoryType(item.action, item.icon)) === 'entrada');
  const movementRows = historyRows.filter(item => (item.type || inferHistoryType(item.action, item.icon)) === 'movimentacao');
  const expiredRows = inventoryRows.filter(row => productExpiryStatus(row.product) === 'expired');
  const expiringRows = inventoryRows.filter(row => productExpiryStatus(row.product) === 'expiring');
  const pendingUnloads = blindCountRecords.filter(record => ['in_progress', 'pending_review', 'rejected'].includes(record.status) && (scopeDepotId === ALL_DEPOTS_VALUE || getUnloadRecordDepotIds(record).includes(scopeDepotId)));

  const totalUsedKg = inventoryRows.reduce((sum, row) => sum + (parseFloat(row.product.kgTotal ?? row.product.kg) || 0), 0);
  const totalCapKg = depots.reduce((sum, depot) => {
    if (scopeDepotId !== ALL_DEPOTS_VALUE && depot.id !== scopeDepotId) return sum;
    return sum + collectDepotMetrics(depot.id).totalCapKg;
  }, 0);
  const occupancyPct = totalCapKg ? Math.round((totalUsedKg / totalCapKg) * 100) : 0;
  const estimatedLoss = expiredRows.reduce((sum, row) => {
    const qty = parseFloat(row.product.qty || 0) || 0;
    const cost = parseFloat(row.product.cost || 0) || 0;
    return sum + (qty * cost);
  }, 0);

  executiveEl.innerHTML = [
    ['Giro de estoque', `${outboundRows.length}`, `${entryRows.length} entradas e ${movementRows.length} movimentações no histórico filtrado.`],
    ['Ocupação kg', `${occupancyPct}%`, `${totalUsedKg.toFixed(1)} / ${totalCapKg.toFixed(0)} kg no escopo atual.`],
    ['Itens vencidos', `${expiredRows.length}`, `${expiringRows.length} itens a vencer ainda disponíveis.`],
    ['Perda estimada', formatCurrencyBr(estimatedLoss), 'Baseada em custo cadastrado dos itens vencidos em estoque.'],
    ['Descargas pendentes', `${pendingUnloads.length}`, 'Descargas em andamento, pendentes ou reprovadas aguardando ação.'],
  ].map(([label, value, note]) => `<div class="ind-kpi-card"><div class="ind-kpi-label">${escapeHtml(label)}</div><div class="ind-kpi-value">${escapeHtml(value)}</div><div class="ind-kpi-note">${escapeHtml(note)}</div></div>`).join('');

  const outboundByProduct = {};
  outboundRows.forEach(item => {
    const code = item.productCode || 'SEM-COD';
    if (!outboundByProduct[code]) outboundByProduct[code] = { code, moves: 0 };
    outboundByProduct[code].moves += 1;
  });
  const abcRows = Object.values(outboundByProduct).sort((a, b) => b.moves - a.moves);
  const totalMoves = abcRows.reduce((sum, row) => sum + row.moves, 0) || 1;
  let cumulative = 0;
  abcEl.innerHTML = abcRows.length ? `<table class="ind-table"><thead><tr><th>Classe</th><th>Produto</th><th>Saídas</th><th>% acum.</th></tr></thead><tbody>${
    abcRows.slice(0, 20).map(row => {
      cumulative += row.moves;
      const pct = (cumulative / totalMoves) * 100;
      const klass = pct <= 80 ? 'a' : pct <= 95 ? 'b' : 'c';
      const productName = (inventoryRows.find(item => item.product.code === row.code)?.product.name) || row.code;
      return `<tr><td><span class="ind-badge ${klass}">${klass.toUpperCase()}</span></td><td>${escapeHtml(row.code)} — ${escapeHtml(productName)}</td><td>${row.moves}</td><td>${pct.toFixed(1)}%</td></tr>`;
    }).join('')
  }</tbody></table>` : '<div class="review-empty">Ainda não há saídas suficientes para classificar curva ABC.</div>';

  const stockByProduct = {};
  inventoryRows.forEach(({ product }) => {
    if (!stockByProduct[product.code]) stockByProduct[product.code] = { code: product.code, name: product.name || product.code, qty: 0, kg: 0, outbound: 0 };
    stockByProduct[product.code].qty += parseFloat(product.qty || 0) || 0;
    stockByProduct[product.code].kg += parseFloat(product.kgTotal ?? product.kg) || 0;
  });
  outboundRows.forEach(item => {
    if (!stockByProduct[item.productCode]) stockByProduct[item.productCode] = { code: item.productCode, name: item.productCode, qty: 0, kg: 0, outbound: 0 };
    stockByProduct[item.productCode].outbound += 1;
  });
  const turnoverRows = Object.values(stockByProduct)
    .map(row => ({ ...row, turnover: row.qty > 0 ? row.outbound / row.qty : row.outbound }))
    .sort((a, b) => b.turnover - a.turnover);
  turnoverEl.innerHTML = turnoverRows.length ? `<table class="ind-table"><thead><tr><th>Produto</th><th>Giro</th><th>Qtd atual</th><th>Kg</th></tr></thead><tbody>${
    turnoverRows.slice(0, 10).map(row => `<tr><td>${escapeHtml(row.code)} — ${escapeHtml(row.name)}</td><td>${row.turnover.toFixed(3)}</td><td>${row.qty.toFixed(3)}</td><td>${row.kg.toFixed(3)}</td></tr>`).join('')
  }</tbody></table><div class="ind-kpi-note" style="margin-top:10px">Top 10 por giro. Itens com saída zero ficam implicitamente como estoque parado.</div>` : '<div class="review-empty">Sem dados de estoque para calcular giro.</div>';

  const occupancyRows = depots
    .filter(depot => scopeDepotId === ALL_DEPOTS_VALUE || depot.id === scopeDepotId)
    .map(depot => collectDepotMetrics(depot.id))
    .sort((a, b) => b.loadPct - a.loadPct);
  occupancyEl.innerHTML = occupancyRows.length ? `<table class="ind-table"><thead><tr><th>Depósito</th><th>Ocupação</th><th>Kg</th><th>Gavetas</th></tr></thead><tbody>${
    occupancyRows.map(row => `<tr><td>${escapeHtml(row.depot?.name || row.depot?.id || '—')}</td><td>${row.loadPct}%</td><td>${row.usedKg.toFixed(1)} / ${row.totalCapKg.toFixed(0)}</td><td>${row.occupiedDrawers}/${row.totalDrawers}</td></tr>`).join('')
  }</tbody></table>` : '<div class="review-empty">Nenhum depósito disponível.</div>';

  const wasteRows = [
    { label: 'Vencidos em estoque', qty: expiredRows.length, value: estimatedLoss, note: 'Itens com validade vencida ainda presentes.' },
    { label: 'A vencer (30 dias)', qty: expiringRows.length, value: expiringRows.reduce((sum, row) => sum + ((parseFloat(row.product.qty || 0) || 0) * (parseFloat(row.product.cost || 0) || 0)), 0), note: 'Perda evitável potencial.' },
    { label: 'Descartes registrados', qty: historyRows.filter(item => /descarte/i.test(`${item.action} ${item.detail}`)).length, value: 0, note: 'Ocorrências de descarte no histórico.' },
  ];
  wasteEl.innerHTML = `<table class="ind-table"><thead><tr><th>Categoria</th><th>Qtd</th><th>Impacto</th><th>Observação</th></tr></thead><tbody>${
    wasteRows.map(row => `<tr><td>${escapeHtml(row.label)}</td><td>${row.qty}</td><td>${formatCurrencyBr(row.value)}</td><td>${escapeHtml(row.note)}</td></tr>`).join('')
  }</tbody></table>`;

  const operatorMap = {};
  historyRows.forEach(item => {
    const user = item.user || 'sistema';
    if (!operatorMap[user]) operatorMap[user] = { user, entries: 0, exits: 0, moves: 0, total: 0 };
    const row = operatorMap[user];
    const type = item.type || inferHistoryType(item.action, item.icon);
    if (type === 'entrada') row.entries += 1;
    else if (type === 'saida') row.exits += 1;
    else if (type === 'movimentacao') row.moves += 1;
    row.total += 1;
  });
  const operatorRows = Object.values(operatorMap).sort((a, b) => b.total - a.total);
  operatorEl.innerHTML = operatorRows.length ? `<table class="ind-table"><thead><tr><th>Usuário</th><th>Total</th><th>Entradas</th><th>Saídas</th><th>Movs.</th></tr></thead><tbody>${
    operatorRows.map(row => `<tr><td>${escapeHtml(row.user)}</td><td>${row.total}</td><td>${row.entries}</td><td>${row.exits}</td><td>${row.moves}</td></tr>`).join('')
  }</tbody></table>` : '<div class="review-empty">Sem movimentações suficientes para medir produtividade.</div>';
}

function renderHelpPage() {}

