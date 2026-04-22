// ═══════════════════════════════════════════════════════════
// MODULE: receiving.js
// Conferência cega de NF-e com fila de aprovação hierárquica.
//
// Fluxo:
//   1. Identificação — conferente bipa/digita chave da NF-e
//   2. Conferência   — tabela Produto | Qtd | OK | Avariadas | Devolvidas
//   3. Divergências  — revisão antes de fechar
//   4. Recibo        — confirmação; status → pending_review
//
// Os itens NÃO entram no estoque ao fechar.
// Supervisor aprova/reprova no módulo APR. (page-unload-review).
// ═══════════════════════════════════════════════════════════

// ── Estado local ──────────────────────────────────────────
let receivingSession       = null;   // sessão aberta no backend
let receivingSelectedNfe   = null;   // payload blind da NF-e selecionada
let receivingItems         = [];     // linhas da tabela de conferência
let receivingAvailableNfes = [];     // lista de XMLs disponíveis
let receivingHistoryRecords = [];    // histórico de sessões
let receivingClosePreview  = null;   // resposta do /close
let receivingStep          = 1;
let receivingTimerInterval = null;
let receivingStartedAt     = null;

// ── Navegação entre etapas ────────────────────────────────
function setReceivingStep(step = 1) {
  receivingStep = Math.max(1, Math.min(4, parseInt(step, 10) || 1));
  document.querySelectorAll('#receiving-stepper .receiving-step').forEach(node => {
    node.classList.toggle('active', String(node.dataset.step) === String(receivingStep));
  });
  document.querySelectorAll('#page-receiving .receiving-stage').forEach(node => {
    node.classList.toggle('active', node.id === `receiving-stage-${receivingStep}`);
  });
}

// ── Lookup de produto no catálogo local ───────────────────
function getReceivingItemCatalogMatch(rawCode = '', rawDesc = '', rawEan = '') {
  const code = String(rawCode || '').trim().toUpperCase();
  const desc = String(rawDesc || '').trim().toUpperCase();
  const ean  = String(rawEan  || '').trim().toUpperCase();
  for (const depotMap of Object.values(productsAll || {})) {
    for (const items of Object.values(depotMap || {})) {
      for (const item of items || []) {
        if (code && String(item.code || '').trim().toUpperCase() === code) return item;
        if (ean  && String(item.ean  || '').trim().toUpperCase() === ean)  return item;
        if (desc && String(item.name || '').trim().toUpperCase() === desc) return item;
      }
    }
  }
  return null;
}

// ── Banner de info da NF-e selecionada ────────────────────
function refreshReceivingSelectedInfo() {
  const infoEl = document.getElementById('receiving-selected-xml');
  if (!infoEl) return;
  const sel = receivingSelectedNfe;
  if (!sel) {
    infoEl.innerHTML = '<div class="empty-msg">Nenhuma NF-e selecionada.</div>';
    return;
  }
  infoEl.innerHTML = `
    <div><strong>NF:</strong> ${escapeHtml(sel.numero_nf || '—')} / série ${escapeHtml(sel.serie || '—')}</div>
    <div><strong>Emitente:</strong> ${escapeHtml(sel.emitente?.nome || '—')} (${escapeHtml(sel.emitente?.cnpj || '—')})</div>
    <div><strong>Emissão:</strong> ${escapeHtml(fmtDateTime(sel.data_emissao))}</div>
    <div><strong>Itens na nota:</strong> ${escapeHtml(String((sel.produtos || []).length))} (quantidades ocultas — conferência às cegas)</div>
  `;
}

function populateReceivingDepotSelect() {
  const select = document.getElementById('receiving-depot-select');
  if (!select) return;
  select.innerHTML = buildDepotOptionsHtml({ selected: select.value || activeDepotId || depots[0]?.id || '' });
  if (!select.value && activeDepotId) select.value = activeDepotId;
}

// ── Badge de pendência no menu ────────────────────────────
function renderReceivingMenuBadge() {
  const badge = document.getElementById('receiving-menu-badge');
  if (!badge) return;
  const now = Date.now();
  const pending = receivingHistoryRecords.filter(
    item => item.status === 'em_conferencia' && item.started_at &&
    (now - new Date(item.started_at).getTime()) > 2 * 3600 * 1000
  ).length;
  badge.style.display = (pending > 0 && hasPermission('blind.count')) ? '' : 'none';
  if (pending > 0) badge.textContent = `${pending} PENDÊNCIA${pending > 1 ? 'S' : ''} > 2H`;
}

// ── Carregar lista de XMLs e histórico ────────────────────
async function refreshReceivingPage(force = false) {
  if (!hasPermission('entry.register')) return;
  populateReceivingDepotSelect();
  if (!force && receivingAvailableNfes.length && receivingHistoryRecords.length) {
    renderReceivingHistory();
    renderReceivingMenuBadge();
    refreshReceivingSelectedInfo();
    return;
  }
  const [nfeResponse, historyResponse] = await Promise.all([
    apiCall('/wms/nfe/list'),
    apiCall('/wms/nfe/receiving/sessions'),
  ]);
  receivingAvailableNfes  = Array.isArray(nfeResponse?.items)   ? nfeResponse.items   : [];
  receivingHistoryRecords = Array.isArray(historyResponse?.items) ? historyResponse.items : [];

  const xmlSelect = document.getElementById('receiving-xml-select');
  if (xmlSelect) {
    const current = xmlSelect.value || document.getElementById('receiving-key-input')?.value || '';
    xmlSelect.innerHTML = `<option value="">Selecione uma NF-e</option>` +
      receivingAvailableNfes.map(item => {
        const statusLabel = {
          nova: '🆕 NOVA',
          aguardando_conferencia: '⏳ AGUARDANDO',
          em_conferencia: '🔄 EM CONF.',
          pending_review: '🕐 AGUARD. APROVAÇÃO',
          approved: '✅ APROVADA',
          rejected: '❌ REPROVADA',
        }[item.status] || item.status;
        return `<option value="${escapeAttr(item.chave_acesso)}">${escapeHtml(`NF ${item.numero_nf || '—'} · ${item.emitente?.nome || 'Emitente'} · ${statusLabel}`)}</option>`;
      }).join('');
    if (current && receivingAvailableNfes.some(i => i.chave_acesso === current)) xmlSelect.value = current;
  }
  renderReceivingHistory();
  renderReceivingMenuBadge();
  refreshReceivingSelectedInfo();
}

async function handleReceivingXmlSelect(chaveAcesso) {
  const keyInput = document.getElementById('receiving-key-input');
  if (keyInput) keyInput.value = chaveAcesso || '';
  if (!chaveAcesso) {
    receivingSelectedNfe = null;
    refreshReceivingSelectedInfo();
    return;
  }
  receivingSelectedNfe = await apiCall(`/wms/nfe/${encodeURIComponent(chaveAcesso)}`);
  if (!receivingSession) {
    // Pré-popula linhas com os produtos da nota (sem quantidades — conferência às cegas)
    receivingItems = (receivingSelectedNfe.produtos || []).map((item, index) => _makeBlankLine(item, index));
  }
  refreshReceivingSelectedInfo();
  renderReceivingTable();
}

function _makeBlankLine(nfeItem, index) {
  return {
    id: `rx-${index}-${nfeItem.codigo || 'item'}`,
    codigo_produto:   nfeItem.codigo      || '',
    descricao:        nfeItem.descricao   || '',
    ean:              nfeItem.ean         || '',
    ncm:              nfeItem.ncm         || '',
    unidade_conferida: nfeItem.unidade_comercial || nfeItem.unidade_tributaria || 'UN',
    qty_conferida: '',   // total contado
    qty_ok:        '',   // OK para estoque
    qty_avariadas: '',   // avariadas → bloqueado
    qty_devolvidas:'',   // devolvidas → não entra
    lote:      '',
    validade:  '',
    observacao:'',
    foto_avaria_base64: '',
    item_extra: false,
  };
}

// ── Timer ─────────────────────────────────────────────────
function receivingTimerTick() {
  const timerEl = document.getElementById('receiving-timer');
  const badgeEl = document.getElementById('receiving-session-timer-badge');
  const seconds = receivingStartedAt
    ? Math.floor((Date.now() - new Date(receivingStartedAt).getTime()) / 1000)
    : 0;
  const label = formatSecondsHms(seconds);
  if (timerEl) timerEl.textContent = label;
  if (badgeEl) {
    badgeEl.textContent = label;
    badgeEl.classList.toggle('status-alert', seconds >= 7200);
  }
}

function stopReceivingTimer() {
  if (receivingTimerInterval) clearInterval(receivingTimerInterval);
  receivingTimerInterval = null;
  receivingStartedAt = null;
  receivingTimerTick();
}

function startReceivingTimer(startedAt) {
  receivingStartedAt = startedAt || new Date().toISOString();
  if (receivingTimerInterval) clearInterval(receivingTimerInterval);
  receivingTimerInterval = setInterval(receivingTimerTick, 1000);
  receivingTimerTick();
}

// ── Banner de sessão ──────────────────────────────────────
function renderReceivingSessionBanner() {
  const titleEl    = document.getElementById('receiving-session-title');
  const metaEl     = document.getElementById('receiving-session-meta');
  const plateEl    = document.getElementById('receiving-session-plate');
  const operatorEl = document.getElementById('receiving-session-operator');
  if (!titleEl) return;
  if (!receivingSession) {
    titleEl.textContent    = 'NF —';
    metaEl.textContent     = 'Aguardando sessão.';
    plateEl.textContent    = 'Placa: —';
    operatorEl.textContent = `Operador: ${getCurrentUserLabel()}`;
    return;
  }
  titleEl.textContent    = `NF ${receivingSession.numero_nf || '—'} · ${receivingSession.emitente?.nome || 'Emitente'}`;
  metaEl.textContent     = `Chave ${receivingSession.chave_acesso || '—'} · ${receivingSession.emitente?.cnpj || '—'}`;
  plateEl.textContent    = `Placa: ${receivingSession.placa_veiculo || '—'}`;
  operatorEl.textContent = `Operador: ${receivingSession.operador || getCurrentUserLabel()}`;
}

// ── Atualização de campo em linha ─────────────────────────
function updateReceivingItem(index, field, value) {
  const item = receivingItems[index];
  if (!item) return;

  const numFields = ['qty_conferida', 'qty_ok', 'qty_avariadas', 'qty_devolvidas'];
  if (numFields.includes(field)) {
    item[field] = value === '' ? '' : String(Math.max(0, parseFloat(value || '0') || 0));
  } else if (field === 'unidade_conferida') {
    item[field] = sanitizeTextInput(value || 'UN', { maxLength: 8, uppercase: true }) || 'UN';
  } else {
    item[field] = sanitizeTextInput(value || '', { maxLength: field === 'observacao' ? 240 : 80 });
  }

  // Auto-lookup no catálogo se for item extra
  if (['codigo_produto', 'descricao', 'ean'].includes(field) && item.item_extra) {
    const match = getReceivingItemCatalogMatch(item.codigo_produto, item.descricao, item.ean);
    if (match) {
      item.codigo_produto    = item.codigo_produto    || match.code || '';
      item.descricao         = item.descricao         || match.name || '';
      item.ean               = item.ean               || match.ean  || '';
      item.ncm               = item.ncm               || match.ncm  || '';
      item.unidade_conferida = item.unidade_conferida || match.unit || 'UN';
    }
  }

  // Validação ao vivo: soma das condições
  _renderLineSumWarning(index);
  renderReceivingTable();
}

function _getLineSum(item) {
  const ok  = parseFloat(item.qty_ok        || '0') || 0;
  const av  = parseFloat(item.qty_avariadas || '0') || 0;
  const dev = parseFloat(item.qty_devolvidas|| '0') || 0;
  return { ok, av, dev, total: ok + av + dev };
}

function _lineSumValid(item) {
  const total = parseFloat(item.qty_conferida || '0') || 0;
  if (total === 0) return true; // linha não preenchida — ignorar
  const { total: subtotal } = _getLineSum(item);
  return Math.abs(subtotal - total) < 0.001;
}

function _renderLineSumWarning(index) {
  const warnEl = document.getElementById(`rx-sum-warn-${index}`);
  if (!warnEl) return;
  const item = receivingItems[index];
  if (!item) return;
  const total = parseFloat(item.qty_conferida || '0') || 0;
  if (total === 0) { warnEl.style.display = 'none'; return; }
  const { ok, av, dev, total: sub } = _getLineSum(item);
  const diff = Math.abs(sub - total);
  if (diff < 0.001) {
    warnEl.style.display = 'none';
  } else {
    warnEl.style.display = '';
    warnEl.textContent = `⚠ OK(${ok}) + Av(${av}) + Dev(${dev}) = ${sub.toFixed(3)} ≠ ${total.toFixed(3)}`;
  }
}

function handleReceivingPhotoUpload(index, input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (receivingItems[index]) receivingItems[index].foto_avaria_base64 = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}

// ── Tabela principal de conferência ───────────────────────
function renderReceivingTable() {
  const tbody = document.getElementById('receiving-table-body');
  if (!tbody) return;
  renderReceivingSessionBanner();

  const query = (document.getElementById('receiving-table-search')?.value || '').trim().toLowerCase();
  const rows  = receivingItems.filter(item => {
    if (!query) return true;
    return [item.codigo_produto, item.descricao, item.ean]
      .some(v => String(v || '').toLowerCase().includes(query));
  });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">Nenhum item em conferência.</td></tr>';
    queueEnhanceResizableTables();
    return;
  }

  tbody.innerHTML = rows.map(item => {
    const index = receivingItems.indexOf(item);
    const valid = _lineSumValid(item);
    const rowClass = !valid ? 'receiving-row-invalid'
      : item.qty_avariadas > 0 ? 'receiving-row-damaged' : '';
    const expiryWarn = item.validade
      ? Math.ceil((new Date(item.validade).getTime() - Date.now()) / 86400000) < 30
      : false;

    return `
      <tr class="${escapeAttr(rowClass)}" id="rx-row-${index}">
        <td>
          <div class="rx-code-wrap">
            <input type="text" value="${escapeAttr(item.codigo_produto || '')}" placeholder="Código / EAN"
              oninput="updateReceivingItem(${index}, 'codigo_produto', this.value)">
            <div class="receiving-muted-line">${escapeHtml(item.ean || 'SEM GTIN')} · NCM ${escapeHtml(item.ncm || '—')}</div>
          </div>
          ${item.item_extra ? '<span class="status-badge status-pending">ITEM EXTRA</span>' : ''}
        </td>
        <td>
          <input type="text" value="${escapeAttr(item.descricao || '')}" placeholder="Descrição"
            oninput="updateReceivingItem(${index}, 'descricao', this.value)">
        </td>
        <td class="rx-qty-cell">
          <input type="number" min="0" step="0.001"
            value="${escapeAttr(item.qty_conferida || '')}" placeholder="0"
            oninput="updateReceivingItem(${index}, 'qty_conferida', this.value)">
          <span class="rx-unit">${escapeHtml(item.unidade_conferida || 'UN')}</span>
        </td>
        <td class="rx-qty-cell rx-ok">
          <input type="number" min="0" step="0.001"
            value="${escapeAttr(item.qty_ok || '')}" placeholder="0"
            oninput="updateReceivingItem(${index}, 'qty_ok', this.value)">
        </td>
        <td class="rx-qty-cell rx-damaged">
          <input type="number" min="0" step="0.001"
            value="${escapeAttr(item.qty_avariadas || '')}" placeholder="0"
            oninput="updateReceivingItem(${index}, 'qty_avariadas', this.value)">
        </td>
        <td class="rx-qty-cell rx-returned">
          <input type="number" min="0" step="0.001"
            value="${escapeAttr(item.qty_devolvidas || '')}" placeholder="0"
            oninput="updateReceivingItem(${index}, 'qty_devolvidas', this.value)">
        </td>
        <td>
          <div class="receiving-line-meta">
            <input type="text" value="${escapeAttr(item.lote || '')}" placeholder="Lote"
              oninput="updateReceivingItem(${index}, 'lote', this.value)">
            <input type="date" value="${escapeAttr(item.validade || '')}"
              oninput="updateReceivingItem(${index}, 'validade', this.value)">
            <input type="text" value="${escapeAttr(item.observacao || '')}" placeholder="Observação"
              oninput="updateReceivingItem(${index}, 'observacao', this.value)">
            <input type="file" accept="image/*" onchange="handleReceivingPhotoUpload(${index}, this)">
          </div>
          ${expiryWarn ? '<span class="status-badge status-alert">VALIDADE &lt; 30 DIAS</span>' : ''}
          <div class="rx-sum-warning" id="rx-sum-warn-${index}" style="display:none;color:var(--danger);font-size:11px;margin-top:4px"></div>
        </td>
      </tr>
    `;
  }).join('');

  // Re-aplicar avisos de soma após render
  rows.forEach(item => {
    const index = receivingItems.indexOf(item);
    _renderLineSumWarning(index);
  });

  queueEnhanceResizableTables();
}

function addReceivingManualItem() {
  receivingItems.push({
    id: `manual-${Date.now()}`,
    codigo_produto: '', descricao: '', ean: '', ncm: '',
    unidade_conferida: 'UN',
    qty_conferida: '', qty_ok: '', qty_avariadas: '', qty_devolvidas: '',
    lote: '', validade: '', observacao: '', foto_avaria_base64: '',
    item_extra: true,
  });
  renderReceivingTable();
}

// ── Iniciar sessão de conferência ─────────────────────────
async function startReceivingSession(button = null) {
  const key     = sanitizeTextInput(document.getElementById('receiving-key-input')?.value || '', { maxLength: 44, uppercase: true });
  const plate   = sanitizeTextInput(document.getElementById('receiving-plate-input')?.value || '', { maxLength: 8, uppercase: true });
  const depotId = document.getElementById('receiving-depot-select')?.value || activeDepotId || '';

  if (!key || key.length !== 44) {
    await showNotice({ title: 'CHAVE INVÁLIDA', icon: '⛔', desc: 'Informe a chave NF-e com 44 dígitos para iniciar.' });
    return;
  }
  if (!depotId) {
    await showNotice({ title: 'DEPÓSITO NÃO SELECIONADO', icon: '⛔', desc: 'Selecione o depósito de destino.' });
    return;
  }

  setButtonLoading(button, true, 'INICIANDO...');
  try {
    if (!receivingSelectedNfe || receivingSelectedNfe.chave_acesso !== key) {
      receivingSelectedNfe = await apiCall(`/wms/nfe/${encodeURIComponent(key)}`);
    }
    const response = await apiCall('/wms/nfe/receiving/start', 'POST', {
      chave_acesso:    key,
      placa_veiculo:   plate,
      operador_id:     getCurrentUserObject()?.id || null,
      depot_id:        depotId,
      reconferencia_de: null,
    });
    receivingSession = response?.session || null;
    // Pré-popula linhas com produtos da nota (sem qtds — às cegas)
    receivingItems = (response?.blind?.produtos || receivingSelectedNfe?.produtos || [])
      .map((item, index) => _makeBlankLine(item, index));
    startReceivingTimer(receivingSession?.started_at || new Date().toISOString());
    setReceivingStep(2);
    renderReceivingTable();
    await refreshReceivingPage(true);
    showToast('Conferência iniciada. Quantidades esperadas ocultas.', 'success');
  } catch (err) {
    showToast(`Falha ao iniciar: ${err.message}`, 'danger');
  } finally {
    setButtonLoading(button, false);
  }
}

async function cancelReceivingSession() {
  if (!receivingSession) { setReceivingStep(1); return; }
  const ok = await showConfirm({
    title: 'CANCELAR CONFERÊNCIA',
    icon: '⚠',
    desc: 'A sessão local será descartada. A sessão permanecerá aberta no backend.',
    okLabel: 'CANCELAR',
  });
  if (!ok) return;
  _resetReceivingLocals();
  setReceivingStep(1);
  renderReceivingTable();
  refreshReceivingSelectedInfo();
}

// ── Validação e fechamento ────────────────────────────────
function _buildClosePayload() {
  return {
    session_id: receivingSession?.id,
    placa_veiculo: sanitizeTextInput(
      document.getElementById('receiving-plate-input')?.value || receivingSession?.placa_veiculo || '',
      { maxLength: 8, uppercase: true }
    ),
    observacao_fechamento: sanitizeTextInput(
      document.getElementById('receiving-close-observation')?.value || '',
      { maxLength: 1000 }
    ),
    expected_revision: serverRevision,
    itens_conferidos: receivingItems
      .filter(item => parseFloat(item.qty_conferida || '0') > 0)
      .map(item => ({
        codigo_produto:   sanitizeTextInput(item.codigo_produto  || '', { maxLength: 80,  uppercase: true }),
        descricao:        sanitizeTextInput(item.descricao       || '', { maxLength: 255 }),
        ean:              sanitizeTextInput(item.ean             || '', { maxLength: 40,  uppercase: true }),
        ncm:              sanitizeTextInput(item.ncm             || '', { maxLength: 16,  uppercase: true }),
        unidade_conferida:sanitizeTextInput(item.unidade_conferida||'UN',{ maxLength: 8, uppercase: true }),
        qty_conferida:    parseFloat(item.qty_conferida  || '0') || 0,
        qty_ok:           parseFloat(item.qty_ok         || '0') || 0,
        qty_avariadas:    parseFloat(item.qty_avariadas  || '0') || 0,
        qty_devolvidas:   parseFloat(item.qty_devolvidas || '0') || 0,
        lote:             sanitizeTextInput(item.lote     || '', { maxLength: 80 }),
        validade:         item.validade || null,
        observacao:       sanitizeTextInput(item.observacao || '', { maxLength: 240 }),
        foto_avaria_base64: item.foto_avaria_base64 || null,
        item_extra:       !!item.item_extra,
      })),
  };
}

async function closeReceivingSession() {
  if (!receivingSession) {
    await showNotice({ title: 'SEM SESSÃO ATIVA', icon: '⛔', desc: 'Inicie uma conferência antes.' });
    return;
  }

  // Validar soma em cada linha antes de enviar
  const invalidLines = receivingItems
    .filter(item => parseFloat(item.qty_conferida || '0') > 0 && !_lineSumValid(item));
  if (invalidLines.length) {
    await showNotice({
      title: 'SOMA INCORRETA',
      icon: '⛔',
      desc: `${invalidLines.length} linha(s) com erro: OK + Avariadas + Devolvidas ≠ Quantidade conferida. Corrija antes de fechar.`,
    });
    // Destacar linhas inválidas
    invalidLines.forEach(item => {
      const index = receivingItems.indexOf(item);
      _renderLineSumWarning(index);
    });
    return;
  }

  const payload = _buildClosePayload();
  if (!payload.itens_conferidos.length) {
    await showNotice({ title: 'SEM ITENS', icon: '⛔', desc: 'Informe ao menos uma quantidade antes de fechar.' });
    return;
  }

  try {
    receivingClosePreview = await apiCall('/wms/nfe/receiving/close', 'POST', payload);
    const divergencias = receivingClosePreview?.divergencias || [];
    if (divergencias.length) {
      // Exibe tela de divergências para confirmação
      renderReceivingDivergences();
      setReceivingStep(3);
    } else {
      // Sem divergências — confirmar diretamente
      await _confirmClosureWithDivergenceCheck();
    }
  } catch (err) {
    if (String(err.message || '').includes('Soma de condições')) {
      await showNotice({ title: 'ERRO DE VALIDAÇÃO', icon: '⛔', desc: err.message });
      return;
    }
    showToast(`Falha ao fechar: ${err.message}`, 'danger');
  }
}

// ── Tela de divergências (etapa 3) ────────────────────────
function renderReceivingDivergences() {
  const tbody  = document.getElementById('receiving-divergence-body');
  const banner = document.getElementById('receiving-divergence-banner');
  if (!tbody) return;

  const divergencias = receivingClosePreview?.divergencias || [];
  if (!divergencias.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhuma divergência detectada.</td></tr>';
    if (banner) banner.style.display = 'none';
    queueEnhanceResizableTables();
    return;
  }

  const hasExcess = divergencias.some(i => i.divergencia_tipo === 'excesso' || i.divergencia_tipo === 'extra');
  if (banner) {
    banner.style.display = hasExcess ? '' : 'none';
    banner.textContent   = hasExcess ? 'EXCESSO / EXTRA' : 'DIVERGÊNCIA';
  }

  tbody.innerHTML = divergencias.map(item => {
    const badge = {
      avaria:  'status-blocked',
      falta:   'status-alert',
      excesso: 'status-pending',
      extra:   'status-pending',
    }[item.divergencia_tipo] || '';
    return `
      <tr>
        <td>${escapeHtml(item.descricao || item.codigo_produto || 'Item')}</td>
        <td>${escapeHtml(String(item.qty_nota ?? '—'))}</td>
        <td>${escapeHtml(String(item.qty_conferida ?? 0))}</td>
        <td>${escapeHtml(String(item.qty_ok        ?? 0))}</td>
        <td>${escapeHtml(String(item.qty_avariadas ?? 0))}</td>
        <td>${escapeHtml(String(item.qty_devolvidas?? 0))}</td>
        <td>${escapeHtml(String(item.diff ?? 0))}</td>
        <td><span class="status-badge ${badge}">${escapeHtml((item.divergencia_tipo || 'ok').toUpperCase())}</span></td>
      </tr>
    `;
  }).join('');
  queueEnhanceResizableTables();
}

async function confirmReceivingClosureWithDivergence() {
  // Chamado pelo botão "SIM — FECHAR COM DIVERGÊNCIA" na tela de divergências
  const ok = await showConfirm({
    title: 'FECHAR COM DIVERGÊNCIA',
    icon:  '⚠',
    desc:  `Existem ${(receivingClosePreview?.divergencias || []).length} divergência(s). Deseja fechar a conferência assim mesmo?`,
    okLabel: 'SIM — FECHAR',
    okStyle: 'danger',
  });
  if (!ok) return; // volta para correção
  await _applyClose();
}

async function _confirmClosureWithDivergenceCheck() {
  // Sem divergências — confirma direto
  await _applyClose();
}

async function _applyClose() {
  // A sessão já foi fechada no backend (status = pending_review).
  // O /close não precisamos chamar de novo — o preview JÁ fechou.
  // Só atualizamos a UI.
  const summary = receivingClosePreview?.summary;
  renderReceivingConfirmation();
  setReceivingStep(4);
  await refreshReceivingPage(true);
  stopReceivingTimer();
  _resetReceivingLocals();
  showToast('Conferência fechada. Aguardando aprovação do supervisor.', 'success');
}

// ── Tela de confirmação (etapa 4) ─────────────────────────
function renderReceivingConfirmation() {
  const body = document.getElementById('receiving-confirmation-body');
  if (!body) return;
  const summary = receivingClosePreview?.summary;
  const divCount = (receivingClosePreview?.divergencias || []).length;
  if (!summary) {
    body.innerHTML = '<div class="empty-msg">Nenhum recebimento concluído nesta sessão.</div>';
    return;
  }
  body.innerHTML = `
    <div class="receiving-confirm-title">CONFERÊNCIA REGISTRADA</div>
    <div class="receiving-confirm-subtitle" style="color:var(--warn);margin-bottom:12px">
      ⏳ Aguardando aprovação do supervisor antes da entrada no estoque.
    </div>
    <div class="receiving-confirm-grid">
      <div><strong>NF:</strong> ${escapeHtml(summary.numero_nf || '—')}</div>
      <div><strong>Emitente:</strong> ${escapeHtml(summary.emitente || '—')}</div>
      <div><strong>Placa:</strong> ${escapeHtml(summary.placa_veiculo || '—')}</div>
      <div><strong>Duração:</strong> ${escapeHtml(formatSecondsHms(summary.duracao_segundos || 0))}</div>
      <div><strong>Total de itens:</strong> ${escapeHtml(String(summary.total_itens || 0))}</div>
      <div><strong>Itens OK:</strong> ${escapeHtml(String(summary.itens_ok || 0))}</div>
      <div><strong>Avariados:</strong> ${escapeHtml(String(summary.itens_avariados || 0))}</div>
      <div><strong>Devolvidos:</strong> ${escapeHtml(String(summary.itens_devolvidos || 0))}</div>
      <div><strong>Divergências:</strong> ${escapeHtml(String(divCount))}</div>
    </div>
    <div class="receiving-card-actions">
      <button class="btn btn-accent" type="button" onclick="resetReceivingWorkspace()">NOVA CONFERÊNCIA</button>
      <button class="btn" type="button" onclick="showPage('unload-review')">IR PARA APROVAÇÕES</button>
    </div>
  `;
}

// ── Histórico de sessões ──────────────────────────────────
function renderReceivingHistory() {
  const listEl = document.getElementById('receiving-history-list');
  if (!listEl) return;

  const statusFilter = document.getElementById('receiving-history-status')?.value || '';
  const from         = document.getElementById('receiving-history-from')?.value || '';
  const to           = document.getElementById('receiving-history-to')?.value || '';
  const search       = (document.getElementById('receiving-history-search')?.value || '').toLowerCase();

  const filtered = receivingHistoryRecords.filter(item => {
    if (statusFilter && item.status !== statusFilter) return false;
    const startDate = item.started_at ? item.started_at.slice(0, 10) : '';
    if (from && startDate < from) return false;
    if (to   && startDate > to)   return false;
    if (search) {
      const haystack = [item.emitente?.nome, item.numero_nf, item.operador, item.placa_veiculo]
        .join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-msg">Nenhuma sessão encontrada.</div>';
    return;
  }

  const statusLabel = {
    aguardando_conferencia: '⏳ Aguardando',
    em_conferencia:  '🔄 Em conferência',
    pending_review:  '🕐 Aguard. aprovação',
    approved:        '✅ Aprovada',
    rejected:        '❌ Reprovada',
    falta:   '⚠ Falta',
    excesso: '⚠ Excesso',
    avaria:  '⚠ Avaria',
    ok:      '✅ OK',
  };

  listEl.innerHTML = filtered.map(item => {
    const badge = {
      approved:              'status-active',
      rejected:              'status-blocked',
      pending_review:        'status-pending',
      em_conferencia:        'status-pending',
      aguardando_conferencia:'status-pending',
    }[item.status] || 'status-pending';

    return `<div class="receiving-history-item">
      <div class="receiving-history-head">
        <div>
          <strong>NF ${escapeHtml(item.numero_nf || '—')}</strong>
          · ${escapeHtml(item.emitente?.nome || '—')}
          <span class="status-badge ${badge}">${escapeHtml(statusLabel[item.status] || item.status)}</span>
          ${item.motivo_reprovacao ? `<div style="color:var(--danger);font-size:11px;margin-top:2px">Reprovação: ${escapeHtml(item.motivo_reprovacao)}</div>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);text-align:right">
          ${escapeHtml(fmtDateTime(item.started_at))}<br>
          ${escapeHtml(item.operador || '—')} · ${escapeHtml(formatSecondsHms(item.duracao_segundos || 0))}
        </div>
      </div>
      <div class="receiving-history-meta">
        Itens: ${escapeHtml(String(item.total_itens || 0))} ·
        OK: ${escapeHtml(String(item.itens_ok || 0))} ·
        Avariados: ${escapeHtml(String(item.itens_avariados || 0))} ·
        Devolvidos: ${escapeHtml(String(item.itens_devolvidos || 0))}
        ${item.status === 'rejected'
          ? `<button class="btn btn-accent" style="margin-left:12px" onclick="startReconferencia('${escapeJs(item.session_id)}', '${escapeJs(item.chave_acesso)}')">RECONFERIR</button>`
          : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Iniciar reconferência após reprovação ─────────────────
async function startReconferencia(rejectedSessionId, chaveAcesso) {
  const depotId = document.getElementById('receiving-depot-select')?.value || activeDepotId || '';
  if (!depotId) {
    await showNotice({ title: 'DEPÓSITO NECESSÁRIO', icon: '⛔', desc: 'Selecione o depósito antes de reconferir.' });
    return;
  }
  const ok = await showConfirm({
    title: 'INICIAR RECONFERÊNCIA',
    icon:  '🔄',
    desc:  'A conferência anterior foi reprovada. Uma nova sessão será aberta para reconferência.',
    okLabel: 'INICIAR',
    okStyle: 'accent',
  });
  if (!ok) return;

  try {
    const plate = sanitizeTextInput(document.getElementById('receiving-plate-input')?.value || '', { maxLength: 8, uppercase: true });
    const response = await apiCall('/wms/nfe/receiving/start', 'POST', {
      chave_acesso:    chaveAcesso,
      placa_veiculo:   plate,
      operador_id:     getCurrentUserObject()?.id || null,
      depot_id:        depotId,
      reconferencia_de: rejectedSessionId,
    });
    receivingSession   = response?.session || null;
    receivingSelectedNfe = await apiCall(`/wms/nfe/${encodeURIComponent(chaveAcesso)}`);
    receivingItems     = (response?.blind?.produtos || []).map((item, index) => _makeBlankLine(item, index));
    startReceivingTimer(receivingSession?.started_at || new Date().toISOString());
    setReceivingStep(2);
    renderReceivingTable();
    showPage('receiving');
    showToast('Reconferência iniciada.', 'success');
  } catch (err) {
    showToast(`Falha ao iniciar reconferência: ${err.message}`, 'danger');
  }
}

// ── Reset e utilitários ───────────────────────────────────
function _resetReceivingLocals() {
  receivingSession     = null;
  receivingItems       = [];
  receivingSelectedNfe = null;
  receivingClosePreview = null;
}

function resetReceivingWorkspace() {
  _resetReceivingLocals();
  stopReceivingTimer();
  setReceivingStep(1);
  renderReceivingTable();
  refreshReceivingSelectedInfo();
}

function focusReceivingHistory() {
  document.getElementById('receiving-history-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openReceivingPage() {
  if (!hasPermission('entry.register')) return;
  populateReceivingDepotSelect();
  await refreshReceivingPage(true);
}

function clearReceivingHistoryFilters() {
  clearFilterBar('receiving-history-filter-bar', renderReceivingHistory);
}
