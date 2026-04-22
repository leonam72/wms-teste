// ═══════════════════════════════════════════════════════════
// MODULE: blind-count.js
// ═══════════════════════════════════════════════════════════

function buildProductSignature(product = {}) {
  return [
    product.code || '',
    product.name || '',
    product.lot || '',
    product.entry || '',
    (product.expiries || []).join(','),
    product.sku || '',
    product.ean || '',
  ].join('|');
}

function getShippingSelectedDepotValue() {
  return document.getElementById('shipping-source-depot')?.value || ALL_DEPOTS_VALUE;
}

function getShippingSourceDepotIds(selectedValue = getShippingSelectedDepotValue()) {
  return selectedValue === ALL_DEPOTS_VALUE ? depots.map(depot => depot.id) : [selectedValue];
}

function renderShippingRecordCount() {
  const el = document.getElementById('shipping-record-count');
  if (!el) return;
  el.textContent = `${outboundRecords.length} registro${outboundRecords.length === 1 ? '' : 's'}`;
}

function recordMatchesDepotScope(record, depotId = getDepotTabsContextId()) {
  if (!record || depotId === ALL_DEPOTS_VALUE) return true;
  return (record.items || []).some(item =>
    item.targetDepotId === depotId ||
    item.fromDepotId === depotId ||
    item.approvedDepotId === depotId ||
    item.sourceDepotId === depotId ||
    item.depotId === depotId
  );
}

function renderBlindCountRecordCount() {
  const el = document.getElementById('blind-count-record-count');
  if (!el) return;
  const total = blindCountRecords.length;
  el.textContent = `${total} descarga${total === 1 ? '' : 's'}`;
}

function getBlindTargetDepotValue() {
  return document.getElementById('blind-target-depot')?.value || ALL_DEPOTS_VALUE;
}

function getBlindOperationalDepots() {
  return depots.filter(depot => !isDiscardDepot(depot));
}

function getBlindTargetDepotIds(selectedValue = getBlindTargetDepotValue()) {
  const allowed = getBlindOperationalDepots().map(depot => depot.id);
  return selectedValue === ALL_DEPOTS_VALUE ? allowed : allowed.filter(id => id === selectedValue);
}

function getBlindCurrentUserKey() {
  const user = getCurrentUserObject();
  return user?.id || user?.username || getCurrentUserLabel();
}

function getBlindProductCatalog() {
  const byCode = new Map();
  depots.forEach(depot => {
    Object.values(productsAll[depot.id] || {}).forEach(list => {
      (list || []).forEach(product => {
        if (!product?.code) return;
        if (!byCode.has(product.code)) byCode.set(product.code, deepClone(product));
      });
    });
  });
  return Array.from(byCode.values()).sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
}

function renderBlindProductSuggestions() {
  return getBlindProductCatalog().slice(0, 500);
}

function parseBlindProductLookup(rawValue = '') {
  const raw = sanitizeTextInput(rawValue || '', { maxLength: 160 });
  const combined = raw.match(/^([A-Z0-9._-]+)\s*-\s*(.+)$/i);
  return {
    raw,
    code: sanitizeTextInput(combined?.[1] || raw, { maxLength: 40, uppercase: true }),
    name: sanitizeTextInput(combined?.[2] || raw, { maxLength: 120 }),
  };
}

function resolveBlindProductMatch(codeRawValue = '', nameRawValue = '', source = 'code') {
  const codeLookup = parseBlindProductLookup(codeRawValue);
  const nameLookup = parseBlindProductLookup(nameRawValue);
  const catalog = getBlindProductCatalog();
  const exactCombined = value => `${value.code || ''} - ${value.name || ''}`.trim();
  const codeNeedle = codeLookup.code.toUpperCase();
  const nameNeedle = nameLookup.name.toLowerCase();
  if (source === 'code' && codeLookup.raw) {
    return catalog.find(product => (product.code || '').toUpperCase() === codeNeedle)
      || catalog.find(product => exactCombined(product).toUpperCase() === codeLookup.raw.toUpperCase())
      || catalog.find(product => (product.name || '').toLowerCase() === codeLookup.name.toLowerCase())
      || catalog.find(product => (product.code || '').toUpperCase().startsWith(codeNeedle))
      || catalog.find(product => (product.name || '').toLowerCase().startsWith(codeLookup.name.toLowerCase()))
      || catalog.find(product => (product.code || '').toUpperCase().includes(codeNeedle))
      || catalog.find(product => (product.name || '').toLowerCase().includes(codeLookup.name.toLowerCase()));
  }
  if (source === 'name' && nameLookup.raw) {
    return catalog.find(product => (product.name || '').toLowerCase() === nameNeedle)
      || catalog.find(product => exactCombined(product).toLowerCase() === nameLookup.raw.toLowerCase())
      || catalog.find(product => (product.code || '').toUpperCase() === nameLookup.code)
      || catalog.find(product => (product.name || '').toLowerCase().startsWith(nameNeedle))
      || catalog.find(product => (product.code || '').toUpperCase().startsWith(nameLookup.code))
      || catalog.find(product => (product.name || '').toLowerCase().includes(nameNeedle))
      || catalog.find(product => (product.code || '').toUpperCase().includes(nameLookup.code));
  }
  return null;
}

function findBlindProductMatch(source = 'code') {
  return resolveBlindProductMatch(document.getElementById('bcp-code')?.value || '', document.getElementById('bcp-name')?.value || '', source);
}

function handleBlindProductInput(source = 'code') {
  const match = findBlindProductMatch(source);
  if (!match) return;
  fillBlindProductModalFromMatch(match);
}

function fillBlindProductModalFromMatch(match) {
  if (!match) return false;
  const combined = `${match.code || ''} - ${match.name || ''}`.trim();
  if (document.getElementById('bcp-product-lookup')) document.getElementById('bcp-product-lookup').value = combined;
  if (document.getElementById('bcp-code')) document.getElementById('bcp-code').value = match.code || '';
  if (document.getElementById('bcp-name')) document.getElementById('bcp-name').value = match.name || '';
  if (document.getElementById('bcp-unit')) document.getElementById('bcp-unit').value = match.unit || 'un';
  if (document.getElementById('bcp-kg-unit') && match.kgPerUnit != null) document.getElementById('bcp-kg-unit').value = String(match.kgPerUnit);
  if (document.getElementById('bcp-supplier') && match.supplier) document.getElementById('bcp-supplier').value = match.supplier;
  if (document.getElementById('bcp-reference') && match.reference) document.getElementById('bcp-reference').value = match.reference;
  if (document.getElementById('bcp-lot') && match.lot) document.getElementById('bcp-lot').value = match.lot;
  if (document.getElementById('bcp-notes') && match.notes) document.getElementById('bcp-notes').value = match.notes;
  if (document.getElementById('bcp-expiry') && match.expiries?.[0]) document.getElementById('bcp-expiry').value = match.expiries[0];
  syncWeightFields('bcp', 'qty');
  return true;
}

let blindLookupHideTimer = null;
let blindLookupMatches = [];

function hideBlindProductLookupMenu() {
  if (blindLookupHideTimer) {
    clearTimeout(blindLookupHideTimer);
    blindLookupHideTimer = null;
  }
  const menu = document.getElementById('bcp-product-lookup-menu');
  if (menu) {
    menu.classList.add('blind-lookup-hidden');
    menu.innerHTML = '';
  }
  blindLookupMatches = [];
}

function scheduleHideBlindProductLookupMenu() {
  if (blindLookupHideTimer) clearTimeout(blindLookupHideTimer);
  blindLookupHideTimer = setTimeout(() => hideBlindProductLookupMenu(), 120);
}

function selectBlindProductLookup(match) {
  fillBlindProductModalFromMatch(match);
  hideBlindProductLookupMenu();
}

function selectBlindProductLookupByIndex(index) {
  const match = blindLookupMatches[index];
  if (!match) return;
  selectBlindProductLookup(match);
}

function handleBlindProductLookupInput(rawValue = '') {
  const cleaned = sanitizeTextInput(rawValue || '', { maxLength: 160 });
  const lookupEl = document.getElementById('bcp-product-lookup');
  const codeEl = document.getElementById('bcp-code');
  const nameEl = document.getElementById('bcp-name');
  const menu = document.getElementById('bcp-product-lookup-menu');
  if (!lookupEl || !codeEl || !nameEl || !menu) return false;
  if (!cleaned) {
    codeEl.value = '';
    nameEl.value = '';
    hideBlindProductLookupMenu();
    return false;
  }
  const catalog = renderBlindProductSuggestions();
  const lookup = parseBlindProductLookup(cleaned);
  const results = catalog.filter(product => {
    const code = (product.code || '').toUpperCase();
    const name = (product.name || '').toLowerCase();
    return code.includes(lookup.code) || name.includes(lookup.name.toLowerCase()) || `${product.code || ''} - ${product.name || ''}`.toLowerCase().includes(cleaned.toLowerCase());
  }).slice(0, 8);
  codeEl.value = '';
  nameEl.value = '';
  blindLookupMatches = results.map(product => deepClone(product));
  if (!results.length) {
    menu.innerHTML = '<div class="pli__empty">Nenhum produto encontrado.</div>';
  } else {
    menu.innerHTML = results.map((product, index) => {
      const qty = parseFloat(product.qty || 0);
      const kg  = parseFloat(product.kgTotal || product.kg || 0);
      const meta = [
        qty > 0 ? `${qty} ${product.unit || 'un'}` : null,
        kg  > 0 ? `${kg.toFixed(3)} kg` : null,
        product.lot ? `lote ${product.lot}` : null,
      ].filter(Boolean).join(' · ');
      return `<button type="button" class="pli__item" data-blind-lookup-index="${index}">
        <span class="pli__code">${escapeHtml(product.code || '—')}</span>
        <span class="pli__name">${escapeHtml(product.name || '')}</span>
        ${meta ? `<span class="pli__meta">${escapeHtml(meta)}</span>` : ''}
      </button>`;
    }).join('');
  }
  menu.classList.remove('blind-lookup-hidden');
  menu.classList.add('pli--open');
  menu.querySelectorAll('[data-blind-lookup-index]').forEach(el => {
    el.addEventListener('mousedown', event => {
      event.preventDefault();
      selectBlindProductLookupByIndex(Number(el.dataset.blindLookupIndex));
    });
  });
  return false;
}

function previewBlindDamagePhoto(event, mode = 'pool') {
  const file = event?.target?.files?.[0];
  const previewEl = document.getElementById(mode === 'allocation' ? 'bca-damage-photo-preview' : 'bcp-damage-photo-preview');
  if (!previewEl) return;
  if (!file) {
    if (mode === 'allocation') blindAllocationDamagePhotoDataUrl = '';
    else blindDamagePhotoDataUrl = '';
    previewEl.textContent = mode === 'allocation' ? 'Obrigatória para avaria' : 'Sem imagem';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    if (mode === 'allocation') blindAllocationDamagePhotoDataUrl = result;
    else blindDamagePhotoDataUrl = result;
    previewEl.innerHTML = `<img src="${escapeAttr(result)}" alt="Foto anexada">`;
  };
  reader.readAsDataURL(file);
}

function syncBlindDamagePhotoState() {
  const condition = getCheckedOptionValue('bca-condition', 'normal');
  const row = document.getElementById('bca-damage-photo-row');
  if (row) row.style.display = condition === 'damaged' ? '' : 'none';
}

function parseBlindExpectedRows(text = '', type = 'csv') {
  if (!text.trim()) return [];
  if (type === 'xml') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const nodes = [...doc.querySelectorAll('det, item, produto')];
    return nodes.map((node, index) => {
      const code = (node.querySelector('cProd, code, codigo')?.textContent || '').trim().toUpperCase();
      const name = (node.querySelector('xProd, name, nome')?.textContent || '').trim();
      const qty = parseFloat((node.querySelector('qCom, quantidade, qty')?.textContent || '0').replace(',', '.')) || 0;
      return { id: `xml-${index}`, code, name, qty };
    }).filter(row => row.code || row.name);
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(col => col.trim().toLowerCase());
  const codeIdx = headers.findIndex(col => ['codigo', 'código', 'code', 'sku'].includes(col));
  const nameIdx = headers.findIndex(col => ['nome', 'produto', 'name', 'descricao', 'descrição'].includes(col));
  const qtyIdx = headers.findIndex(col => ['quantidade', 'qtd', 'qty'].includes(col));
  return lines.slice(1).map((line, index) => {
    const cols = line.split(',').map(part => part.trim());
    return {
      id: `csv-${index}`,
      code: sanitizeTextInput(cols[codeIdx] || '', { maxLength: 40, uppercase: true }),
      name: sanitizeTextInput(cols[nameIdx] || '', { maxLength: 120 }),
      qty: parseFloat((cols[qtyIdx] || '0').replace(',', '.')) || 0,
    };
  }).filter(row => row.code || row.name);
}

function buildBlindExpectedComparison() {
  const expectedRows = Array.isArray(blindExpectedManifest?.items) ? blindExpectedManifest.items : [];
  const expectedByCode = new Map();
  expectedRows.forEach(row => {
    const key = row.code || row.name;
    if (!key) return;
    if (!expectedByCode.has(key)) expectedByCode.set(key, { code: row.code || '', name: row.name || '', qty: 0 });
    expectedByCode.get(key).qty += parseFloat(row.qty || 0) || 0;
  });
  const current = getBlindCurrentDraft();
  const receivedByCode = new Map();
  const currentItems = [...(blindCountPool || []), ...((current?.items) || [])];
  currentItems.forEach(item => {
    const key = item.code || item.name;
    if (!key) return;
    if (!receivedByCode.has(key)) receivedByCode.set(key, { code: item.code || '', name: item.name || '', qty: 0 });
    receivedByCode.get(key).qty += parseFloat(item.qty || 0) || 0;
  });
  const allKeys = new Set([...expectedByCode.keys(), ...receivedByCode.keys()]);
  const rows = [...allKeys].map(key => {
    const expected = expectedByCode.get(key) || { code: '', name: '', qty: 0 };
    const received = receivedByCode.get(key) || { code: '', name: '', qty: 0 };
    const diff = parseFloat((received.qty - expected.qty).toFixed(3));
    return { key, code: expected.code || received.code || '', name: expected.name || received.name || '', expectedQty: expected.qty, receivedQty: received.qty, diff };
  }).sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  return rows;
}

function renderBlindExpectedSummary() {
  const container = document.getElementById('blind-expected-summary');
  const preview = document.getElementById('blind-expected-file-preview');
  if (!container) return;
  if (!blindExpectedManifest?.items?.length) {
    container.innerHTML = '<div class="conf2-received-card"><div class="conf2-received-label">SEM ARQUIVO</div><div class="conf2-received-value">0</div><div class="conf2-received-note">Importe XML ou CSV para comparar esperado x conferido.</div></div>';
    if (preview) preview.style.display = 'none';
    return;
  }
  const rows = buildBlindExpectedComparison();
  const divergences = rows.filter(row => Math.abs(row.diff) > 0.0001);
  const matched = rows.length - divergences.length;
  container.innerHTML = [
    ['Linhas esperadas', String(blindExpectedManifest.items.length), `${blindExpectedManifest.type.toUpperCase()} · ${blindExpectedManifest.filename}`],
    ['SKUs conciliados', String(matched), divergences.length ? `${divergences.length} divergência(s) encontrada(s).` : 'Tudo conciliado até o momento.'],
    ['Diferenças', String(divergences.length), divergences.slice(0, 2).map(row => `${row.code || row.name}: ${row.diff > 0 ? '+' : ''}${row.diff.toFixed(3)}`).join(' · ') || 'Sem divergência.'],
  ].map(([label, value, note]) => `<div class="conf2-received-card"><div class="conf2-received-label">${escapeHtml(label)}</div><div class="conf2-received-value">${escapeHtml(value)}</div><div class="conf2-received-note">${escapeHtml(note)}</div></div>`).join('');
  if (preview) {
    preview.style.display = 'block';
    preview.innerHTML = `<pre>${rows.slice(0, 8).map(row => `${escapeHtml(row.code || '—')} | esp ${row.expectedQty.toFixed(3)} | conf ${row.receivedQty.toFixed(3)} | diff ${row.diff.toFixed(3)}`).join('\n')}${rows.length > 8 ? '\n...' : ''}</pre>`;
  }
}

async function handleBlindExpectedFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const text = await file.text();
  const isXml = /\.xml$/i.test(file.name) || /xml/i.test(file.type);
  const rows = parseBlindExpectedRows(text, isXml ? 'xml' : 'csv');
  blindExpectedManifest = {
    filename: file.name,
    type: isXml ? 'xml' : 'csv',
    importedAt: new Date().toISOString(),
    items: rows,
  };
  const current = getBlindCurrentDraft();
  if (current) {
    current.expectedManifest = deepClone(blindExpectedManifest);
    current.updatedAt = new Date().toISOString();
    persistBlindUnloadsState().catch(err => console.error('Falha ao persistir manifesto esperado:', err));
  }
  renderBlindExpectedSummary();
  showToast(`Arquivo ${file.name} carregado para comparação.`, 'success');
}

function formatBlindDuration(startAt, endAt = null) {
  if (!startAt) return '00:00:00';
  const start = Date.parse(startAt);
  const end = endAt ? Date.parse(endAt) : Date.now();
  const diff = Math.max(0, Math.floor((end - start) / 1000));
  const h = String(Math.floor(diff / 3600)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getBlindDraftSummary() {
  const current = getBlindCurrentDraft();
  const items = Array.isArray(current?.items) ? current.items : [];
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
  const totalKg = items.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
  const damagedKg = items.filter(item => item.condition === 'damaged').reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
  const returnedKg = items.filter(item => item.condition === 'return').reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
  return {
    lines: items.length,
    totalQty,
    totalKg,
    damagedKg,
    returnedKg,
    uniqueProducts: new Set(items.map(item => item.code)).size,
  };
}

function ensureBlindUnloadDraft() {
  const current = getBlindCurrentDraft();
  if (current) return current;
  blindUnloadDraft = {
    id: `unl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    invoiceBarcode: '',
    invoiceBarcodes: deepClone(blindPendingInvoiceBarcodes),
    vehiclePlate: '',
    createdBy: getCurrentUserLabel(),
    createdByKey: getBlindCurrentUserKey(),
    items: [],
    poolItems: [],
    sourceRecordId: null,
    updatedAt: new Date().toISOString(),
    overdueAlertedAt: null,
    cancelledAt: null,
    cancellationReason: '',
    expectedManifest: deepClone(blindExpectedManifest),
  };
  blindCountRecords.unshift(blindUnloadDraft);
  activeBlindUnloadId = blindUnloadDraft.id;
  return blindUnloadDraft;
}

function syncBlindDraftMetaFromForm() {
  const plate = sanitizeTextInput(document.getElementById('blind-vehicle-plate')?.value || '', { maxLength: 16, uppercase: true });
  blindPendingVehiclePlate = plate;
  const current = getBlindCurrentDraft();
  if (current) {
    current.updatedAt = new Date().toISOString();
    current.invoiceBarcodes = deepClone(blindPendingInvoiceBarcodes);
    current.invoiceBarcode = blindPendingInvoiceBarcodes.join(' | ');
    current.vehiclePlate = plate;
  }
}

function renderBlindInvoiceBarcodeChips() {
  const listEl = document.getElementById('blind-invoice-chip-list');
  const inputEl = document.getElementById('blind-invoice-barcode');
  if (!listEl || !inputEl) return;
  inputEl.value = '';
  listEl.innerHTML = blindPendingInvoiceBarcodes.length
    ? blindPendingInvoiceBarcodes.map((code, index) => `<span class="mini-pill" style="color:var(--accent2);border-color:rgba(0,84,255,.25);background:rgba(0,84,255,.06)">${escapeHtml(code)} <button type="button" class="btn" style="padding:0 4px;min-width:auto;border:none;background:none;color:inherit" onclick="removeBlindInvoiceBarcode(${index})">×</button></span>`).join('')
    : '<span class="shipping-cart-meta">Nenhuma NF adicionada.</span>';
}

function addBlindInvoiceBarcode(rawValue) {
  const code = sanitizeTextInput(rawValue || '', { maxLength: 120, uppercase: true });
  if (!code) return false;
  if (!blindPendingInvoiceBarcodes.includes(code)) blindPendingInvoiceBarcodes.push(code);
  syncBlindDraftMetaFromForm();
  renderBlindInvoiceBarcodeChips();
  renderBlindUnloadHeader();
  renderBlindCountCardsPage();
  if (getBlindCurrentDraft()) persistBlindUnloadsState().catch(err => console.error('Falha ao persistir NF da descarga:', err));
  return true;
}

function handleBlindInvoiceBarcodeKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addBlindInvoiceBarcode(event.currentTarget?.value || '');
}

function removeBlindInvoiceBarcode(index) {
  blindPendingInvoiceBarcodes.splice(index, 1);
  syncBlindDraftMetaFromForm();
  renderBlindInvoiceBarcodeChips();
  renderBlindUnloadHeader();
  renderBlindCountCardsPage();
  if (getBlindCurrentDraft()) persistBlindUnloadsState().catch(err => console.error('Falha ao persistir remoção de NF da descarga:', err));
}

function startBlindUnloadTimer() {
  if (blindTimerInterval) return;
  blindTimerInterval = setInterval(() => {
    evaluateBlindUnloadDeadlines();
    const current = getBlindCurrentDraft();
    const value = current ? formatBlindDuration(current.startedAt, current.endedAt) : '00:00:00';
    const timer = document.getElementById('blind-unload-timer');
    const timerV2 = document.getElementById('blind2-unload-timer');
    const timerV3 = document.getElementById('blind3-unload-timer');
    if (timer) timer.textContent = value;
    if (timerV2) timerV2.textContent = value;
    if (timerV3) timerV3.textContent = value;
  }, 1000);
}

function stopBlindUnloadTimer() {
  if (!blindTimerInterval) return;
  clearInterval(blindTimerInterval);
  blindTimerInterval = null;
}

function renderBlindUnloadHeader() {
  const invoiceEl = document.getElementById('blind-invoice-barcode');
  const plateEl = document.getElementById('blind-vehicle-plate');
  const timerEl = document.getElementById('blind-unload-timer');
  const summaryEl = document.getElementById('blind-unload-summary-card');
  const startBtn = document.getElementById('blind-start-btn');
  const addItemBtn = document.getElementById('blind-add-item-btn');
  const finalizeBtn = document.getElementById('blind-finalize-btn');
  const cancelBtn = document.getElementById('blind-cancel-btn');
  const receivedEl = document.getElementById('blind-unload-received-summary');
  if (!invoiceEl || !plateEl || !timerEl || !summaryEl) return;
  const current = getBlindCurrentDraft();
  const hasActiveUnload = Boolean(current);
  if (current?.invoiceBarcodes?.length) {
    blindPendingInvoiceBarcodes = deepClone(current.invoiceBarcodes);
  }
  if (current?.vehiclePlate) blindPendingVehiclePlate = current.vehiclePlate;
  blindExpectedManifest = current?.expectedManifest ? deepClone(current.expectedManifest) : blindExpectedManifest;
  plateEl.value = blindPendingVehiclePlate || '';
  invoiceEl.disabled = false;
  plateEl.disabled = false;
  if (startBtn) startBtn.textContent = hasActiveUnload ? 'NOVA DESCARGA' : 'INICIAR DESCARGA';
  if (startBtn) startBtn.disabled = false;
  if (addItemBtn) addItemBtn.disabled = !hasActiveUnload;
  if (finalizeBtn) finalizeBtn.disabled = !hasActiveUnload;
  if (cancelBtn) cancelBtn.disabled = !hasActiveUnload;
  timerEl.textContent = current ? formatBlindDuration(current.startedAt, current.endedAt) : '00:00:00';
  renderBlindInvoiceBarcodeChips();
  const summary = getBlindDraftSummary();
  summaryEl.innerHTML = [
    ['STATUS', current ? (current.status === 'in_progress' ? 'DESCARGA EM ANDAMENTO' : current.status) : 'SEM DESCARGA ATIVA'],
    ['NFS', String(blindPendingInvoiceBarcodes.length)],
    ['LINHAS ALOCADAS', String(summary.lines)],
    ['POOL', String(blindCountPool.length)],
    ['QTD ALOCADA', summary.totalQty.toFixed(3)],
    ['KG ALOCADO', summary.totalKg.toFixed(3)],
    ['AVARIADOS', summary.damagedKg.toFixed(3) + ' kg'],
    ['DEVOLVIDOS', summary.returnedKg.toFixed(3) + ' kg'],
  ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
  if (receivedEl) {
    const currentItems = Array.isArray(current?.items) ? current.items : [];
    const poolCodes = new Set(blindCountPool.map(item => item.code));
    const allocatedCodes = new Set(currentItems.map(item => item.code));
    const destinations = [...new Set(currentItems.map(item => `${getDepotById(item.targetDepotId)?.name || item.targetDepotId} · ${item.targetDrawerKey || '—'}`))];
    const notes = [...new Set(currentItems.map(item => item.reference).filter(Boolean))];
    receivedEl.innerHTML = [
      ['Recebido na pool', `${blindCountPool.length} item(ns)`, `${poolCodes.size} SKU(s) conferidos e ainda pendentes de destino.`],
      ['Já direcionado', `${currentItems.length} linha(s)`, destinations.length ? destinations.slice(0, 3).join(' · ') : 'Nenhum destino confirmado ainda.'],
      ['Dados conferidos', `${allocatedCodes.size} SKU(s) alocados`, notes.length ? `Referências: ${notes.slice(0, 3).join(', ')}` : 'Lote, validade, fornecedor e referência seguem por item.' ],
    ].map(([label, value, note]) => `<div class="conf2-received-card"><div class="conf2-received-label">${escapeHtml(label)}</div><div class="conf2-received-value">${escapeHtml(value)}</div><div class="conf2-received-note">${escapeHtml(note)}</div></div>`).join('');
  }
  renderBlindExpectedSummary();
}

async function startBlindUnload() {
  if (!hasBlindCountAccess()) {
    await showNotice({ title: 'ACESSO NEGADO', icon: '⛔', desc: 'Somente conferentes, supervisores, gerentes e cargos acima podem operar a conferência cega.' });
    return;
  }
  const current = getBlindCurrentDraft();
  if (current) {
    setActiveBlindUnload(null);
    blindCountPool = [];
    blindCountSelected = { depotId: null, drawerKey: null };
  blindPendingInvoiceBarcodes = [];
  blindPendingVehiclePlate = '';
  blindExpectedManifest = null;
  renderBlindConferenceViews();
    document.getElementById('blind-invoice-barcode')?.focus();
    return;
  }
  const pendingInputValue = document.getElementById('blind-invoice-barcode')?.value || '';
  if (pendingInputValue.trim()) addBlindInvoiceBarcode(pendingInputValue);
  const plate = sanitizeTextInput(document.getElementById('blind-vehicle-plate')?.value || '', { maxLength: 16, uppercase: true });
  blindPendingVehiclePlate = plate;
  if (!blindPendingInvoiceBarcodes.length) {
    await showNotice({ title: 'NF OBRIGATÓRIA', icon: '⛔', desc: 'Adicione ao menos um código de barras de nota fiscal antes de iniciar a descarga.' });
    return;
  }
  if (!plate) {
    await showNotice({ title: 'PLACA OBRIGATÓRIA', icon: '⛔', desc: 'Informe a placa do veículo antes de iniciar a descarga.' });
    return;
  }
  setActiveBlindUnload(null);
  blindUnloadDraft = ensureBlindUnloadDraft();
  syncBlindDraftMetaFromForm();
  logHistory('🚛', 'Descarga iniciada', `NF ${blindUnloadDraft.invoiceBarcode || 'sem NF'} · placa ${blindUnloadDraft.vehiclePlate || 'sem placa'}`, { type: 'entrada' });
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir descarga iniciada:', err));
  showToast('Descarga iniciada com sucesso.', 'success');
  renderBlindConferenceViews();
}

async function cancelBlindUnload() {
  const current = getBlindCurrentDraft();
  if (!current) return;
  if (current.status === 'rejected') {
    await showNotice({ title: 'CANCELAMENTO BLOQUEADO', icon: '⛔', desc: 'Descargas reprovadas não podem sumir. Reabra pela tela DESCARGAS e ajuste para reenviar.' });
    return;
  }
  const ok = await showConfirm({
    title: 'CANCELAR DESCARGA',
    icon: '⚠',
    desc: 'A descarga será cancelada, mas continuará registrada na tela DESCARGAS com status explícito.',
    summary: {
      NFS: String(blindPendingInvoiceBarcodes.length),
      POOL: String(blindCountPool.length),
      ALOCADOS: String(Array.isArray(current.items) ? current.items.length : 0),
    },
    okLabel: 'CANCELAR DESCARGA',
    okStyle: 'danger',
  });
  if (!ok) return;
  current.status = 'cancelled';
  current.cancelledAt = new Date().toISOString();
  current.endedAt = current.endedAt || current.cancelledAt;
  current.cancellationReason = 'Cancelada manualmente';
  current.updatedAt = current.cancelledAt;
  logHistory('🗑', 'Descarga cancelada', `NF ${current.invoiceBarcode || 'sem NF'} · placa ${current.vehiclePlate || 'sem placa'}`, { type: 'entrada' });
  setActiveBlindUnload(null);
  blindCountPool = [];
  blindCountSelected = { depotId: null, drawerKey: null };
  blindExpectedManifest = null;
  const plateEl = document.getElementById('blind-vehicle-plate');
  const invoiceEl = document.getElementById('blind-invoice-barcode');
  if (plateEl) plateEl.value = '';
  if (invoiceEl) invoiceEl.value = '';
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir cancelamento de descarga:', err));
  showToast('Descarga cancelada e mantida no histórico.', 'info');
  renderBlindConferenceViews();
}

function clearBlindTargetSelection() {
  const searchEl = document.getElementById('blind-target-search');
  if (searchEl) searchEl.value = '';
  blindCountSelected = { depotId: null, drawerKey: null };
  blindCountFocusedItemId = null;
  renderBlindCountPage();
}

function getBlindTargetSearchTerm() {
  return (document.getElementById('blind-target-search')?.value || '').trim().toLowerCase();
}

function buildBlindDrawerCard(depotId, shelf, drawerKeyValue, list) {
  const usedKg = list.reduce((sum, product) => sum + (parseFloat(product.kgTotal ?? product.kg) || 0), 0);
  const isSelected = blindCountSelected.depotId === depotId && blindCountSelected.drawerKey === drawerKeyValue;
  const itemCount = list.length;
  return `<div class="drawer blind-drop-target ${itemCount ? 'occupied' : ''} ${isSelected ? 'active-drawer' : ''}" data-blind-drawer="1" data-depot="${escapeHtml(depotId)}" data-key="${escapeHtml(drawerKeyValue)}" style="width:112px;height:80px">
    <div class="drawer-key">${escapeHtml(drawerKeyValue)}</div>
    <div class="drawer-prod-list">
      <div class="drawer-prod-entry"><span class="drawer-prod-code">${itemCount ? escapeHtml(String(itemCount)) : 'VAZIA'}</span><span class="drawer-prod-name">${itemCount ? 'item(ns)' : 'disponível'}</span></div>
      <div class="drawer-more">${usedKg.toFixed(3)} kg armazenados</div>
      <div class="drawer-more" style="color:var(--accent3)">SOLTE ITEM DA POOL AQUI</div>
    </div>
  </div>`;
}

function renderBlindTargetGrid() {
  const grid = document.getElementById('blind-target-grid');
  if (!grid) return;
  const search = getBlindTargetSearchTerm();
  const depotIds = getBlindTargetDepotIds();
  let html = '';
  let firstSelectable = null;
  depotIds.forEach(depotId => {
    const depot = getDepotById(depotId);
    const shelvesList = (shelvesAll[depotId] || []).filter(shelf => !isDiscardDepot(depot));
    const shelfBlocks = shelvesList.map(shelf => {
      const rows = [];
      for (let floor = 1; floor <= shelf.floors; floor++) {
        const cards = [];
        for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
          const key = drawerKey(shelf.id, floor, drawer);
          const list = getShippingDrawerProducts(depotId, key);
          const haystack = `${depot?.name || depotId} ${shelf.id} ${key} ${list.map(product => `${product.code} ${product.name}`).join(' ')}`.toLowerCase();
          if (search && !haystack.includes(search)) continue;
          cards.push(buildBlindDrawerCard(depotId, shelf, key, list));
          if (!firstSelectable) firstSelectable = { depotId, drawerKey: key };
        }
        if (cards.length) rows.push(`<div class="floor" style="padding:6px 8px"><div class="floor-label">${escapeHtml(shelf.id)}${floor}</div><div class="drawers">${cards.join('')}</div></div>`);
      }
      if (!rows.length) return '';
      return `<div class="shelf-block ${escapeHtml(getShelfTypeClass(shelf.type))}">
        <div class="shelf-block-header">
          <div>
            <div class="shelf-block-name">${escapeHtml(shelf.id)}</div>
            <div class="shelf-block-stats">${escapeHtml(getShelfTypeLabel(shelf.type))} · ${shelf.floors} and. · ${shelf.drawers} gav.</div>
          </div>
        </div>
        <div class="floors">${rows.join('')}</div>
      </div>`;
    }).filter(Boolean).join('');
    if (!shelfBlocks) return;
    html += `<div class="shipping-depot-group">
      ${depotIds.length > 1 ? `<div class="shipping-depot-group-title">${escapeHtml(depot?.name || depotId)}</div>` : ''}
      <div class="shelves-grid">${shelfBlocks}</div>
    </div>`;
  });
  grid.innerHTML = html || '<div class="empty-msg">Nenhuma gaveta de destino encontrada com os filtros atuais.</div>';
  grid.classList.toggle('blind-target-grid-focused', Boolean(blindCountFocusedItemId));
  if ((!blindCountSelected.depotId || !blindCountSelected.drawerKey) && firstSelectable) {
    blindCountSelected = firstSelectable;
    renderBlindTargetDetail();
  }
  grid.querySelectorAll('[data-blind-drawer]').forEach(el => {
    el.onclick = () => {
      blindCountSelected = { depotId: el.dataset.depot, drawerKey: el.dataset.key };
      if (blindCountFocusedItemId) {
        openBlindAllocateModal(blindCountFocusedItemId, el.dataset.depot, el.dataset.key);
        return;
      }
      renderBlindCountPage();
    };
    el.addEventListener('dragover', event => {
      if (!blindCountDragItemId) return;
      event.preventDefault();
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', event => {
      event.preventDefault();
      el.classList.remove('dragover');
      if (!blindCountDragItemId) return;
      blindCountSelected = { depotId: el.dataset.depot, drawerKey: el.dataset.key };
      openBlindAllocateModal(blindCountDragItemId, el.dataset.depot, el.dataset.key);
      blindCountDragItemId = null;
    });
  });
}

function renderBlindTargetDetail() {
  const label = document.getElementById('blind-selected-target-label');
  const detail = document.getElementById('blind-target-detail');
  if (!label || !detail) return;
  if (!blindCountSelected.depotId || !blindCountSelected.drawerKey) {
    label.textContent = 'Selecione uma gaveta de destino.';
    detail.innerHTML = '<div class="empty-msg">Nenhum destino selecionado.</div>';
    return;
  }
  const depot = getDepotById(blindCountSelected.depotId);
  const list = getShippingDrawerProducts(blindCountSelected.depotId, blindCountSelected.drawerKey);
  const usedKg = list.reduce((sum, product) => sum + (parseFloat(product.kgTotal ?? product.kg) || 0), 0);
  label.textContent = `${depot?.name || blindCountSelected.depotId} · ${blindCountSelected.drawerKey}`;
  detail.innerHTML = `<div class="shipping-product-row">
    <div class="shipping-product-main">
      <div class="shipping-product-title">DESTINO ATUAL</div>
      <div class="shipping-product-meta">${list.length} item(ns) · ${usedKg.toFixed(3)} kg · capacidade validada antes da alocação</div>
    </div>
  </div>` + (list.length ? list.map(product => `<div class="shipping-product-row">
    <div class="shipping-product-main">
      <div class="shipping-product-title">${escapeHtml(product.code)} — ${escapeHtml(product.name || '')}</div>
      <div class="shipping-product-meta">Lote ${escapeHtml(product.lot || '—')} · ${(parseFloat(product.qty || 0) || 0).toFixed(3)} ${escapeHtml(product.unit || 'un')} · ${(parseFloat(product.kgTotal ?? product.kg) || 0).toFixed(3)} kg</div>
    </div>
  </div>`).join('') : '<div class="empty-msg">Gaveta vazia e pronta para receber itens.</div>');
}

function renderBlindCountPool() {
  const listEl = document.getElementById('blind-count-pool-list');
  const summaryEl = document.getElementById('blind-count-pool-summary');
  if (!listEl || !summaryEl) return;
  const poolSearch = (document.getElementById('blind-pool-search')?.value || '').trim().toLowerCase();
  if (!blindCountPool.length) {
    listEl.innerHTML = '<div class="empty-msg">Nenhum item conferido na pool.</div>';
    summaryEl.innerHTML = '<div class="confirm-sum-row"><span class="confirm-sum-label">STATUS</span><span class="confirm-sum-val">Pool vazia.</span></div>';
    return;
  }
  const totalQty = blindCountPool.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
  const totalKg = blindCountPool.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
  const filteredPool = blindCountPool.filter(item => {
    if (!poolSearch) return true;
    const haystack = `${item.code} ${item.name || ''} ${item.lot || ''} ${item.reference || ''} ${item.supplier || ''}`.toLowerCase();
    return haystack.includes(poolSearch);
  });
  listEl.classList.toggle('blind-pool-list-focused', Boolean(blindCountFocusedItemId));
  listEl.innerHTML = filteredPool.length ? filteredPool.map(item => `<div class="shipping-cart-row ${blindCountFocusedItemId === item.id ? 'blind-pool-row-selected' : ''}" data-blind-pool-item="${escapeHtml(item.id)}">
    <div class="shipping-cart-main">
      <div class="shipping-cart-title">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')}</div>
      <div class="shipping-cart-meta">${(parseFloat(item.qty || 0) || 0).toFixed(3)} ${escapeHtml(item.unit || 'un')} · ${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg · lote ${escapeHtml(item.lot || '—')} · ref. ${escapeHtml(item.reference || '—')}</div>
      <div class="shipping-cart-meta">Fornecedor ${escapeHtml(item.supplier || '—')} · validade ${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')} · conferido por ${escapeHtml(item.checkedBy || '—')}</div>
    </div>
    <div class="shipping-cart-actions">
      <button class="btn" onclick="blindAllocateSelected('${escapeJs(item.id)}')">ALOCAR</button>
      <button class="btn btn-danger" onclick="removeBlindPoolItem('${escapeJs(item.id)}')">REMOVER</button>
    </div>
  </div>`).join('') : '<div class="empty-msg">Nenhum item da pool corresponde à busca atual.</div>';
  listEl.querySelectorAll('[data-blind-pool-item]').forEach(el => {
    const itemId = el.dataset.blindPoolItem;
    el.setAttribute('draggable', 'true');
    el.title = 'Arraste este item para uma gaveta de destino';
    el.addEventListener('click', () => {
      blindCountFocusedItemId = blindCountFocusedItemId === itemId ? null : itemId;
      renderBlindCountPage();
    });
    el.addEventListener('dragstart', () => {
      blindCountDragItemId = itemId;
      blindCountFocusedItemId = itemId;
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      blindCountDragItemId = null;
      el.classList.remove('dragging');
    });
  });
  summaryEl.innerHTML = [
    ['ITENS', String(blindCountPool.length)],
    ['VISÍVEIS', String(filteredPool.length)],
    ['QTD TOTAL', totalQty.toFixed(3)],
    ['KG TOTAL', totalKg.toFixed(3)],
    ['STATUS', blindCountFocusedItemId ? 'ITEM EM FOCO' : blindCountSelected.drawerKey ? 'PRONTO PARA ALOCAR' : 'SELECIONE DESTINO'],
  ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
}

function renderBlindCountRecordList() {
  const el = document.getElementById('blind-count-record-list');
  if (!el) return;
  const current = getBlindCurrentDraft();
  const items = Array.isArray(current?.items) ? current.items : [];
  if (!items.length) {
    el.innerHTML = '<div class="empty-msg">Nenhum item alocado nesta descarga.</div>';
    return;
  }
  el.innerHTML = `<div style="display:grid;gap:12px">${buildBlindRecordItemCards(items, { editable: true })}</div>`;
}

function renderBlindCountPage() {
  if (!hasBlindCountAccess()) return;
  renderBlindProductSuggestions();
  const depotSelect = document.getElementById('blind-target-depot');
  if (depotSelect) {
    const current = getDepotTabsContextId() || depotSelect.value || ALL_DEPOTS_VALUE;
    const options = [];
    options.push(`<option value="${ALL_DEPOTS_VALUE}" ${current === ALL_DEPOTS_VALUE ? 'selected' : ''}>Todos os depósitos</option>`);
    getBlindOperationalDepots().forEach(depot => {
      options.push(`<option value="${depot.id}" ${current === depot.id ? 'selected' : ''}>${escapeHtml(depot.name)}</option>`);
    });
    depotSelect.innerHTML = options.join('');
    depotSelect.value = current;
    depotTabsContextId = depotSelect.value || ALL_DEPOTS_VALUE;
  }
  if (blindCountSelected.depotId) {
    const allowed = new Set(getBlindTargetDepotIds(depotSelect?.value || ALL_DEPOTS_VALUE));
    if (!allowed.has(blindCountSelected.depotId)) blindCountSelected = { depotId: null, drawerKey: null };
  }
  startBlindUnloadTimer();
  renderBlindCountRecordCount();
  renderBlindUnloadHeader();
  renderBlindTargetGrid();
  renderBlindTargetDetail();
  renderBlindCountPool();
  renderBlindCountRecordList();
  notifyBlindRejectionsForCurrentUser();
}

function renderBlindConferenceViews() {
  renderUnloadsPage();
}

function syncBlindDraftMetaFromConferenceV2Form() {
  const plate = sanitizeTextInput(byId('blind2-vehicle-plate')?.value || '', { maxLength: 16, uppercase: true });
  const pendingInput = sanitizeTextInput(byId('blind2-invoice-input')?.value || '', { maxLength: 120, uppercase: true });
  blindPendingVehiclePlate = plate;
  const legacyPlate = byId('blind-vehicle-plate');
  if (legacyPlate) legacyPlate.value = plate;
  const legacyInvoice = byId('blind-invoice-barcode');
  if (legacyInvoice) legacyInvoice.value = pendingInput;
  const current = getBlindCurrentDraft();
  if (current) {
    current.vehiclePlate = plate;
    current.invoiceBarcodes = deepClone(blindPendingInvoiceBarcodes);
    current.invoiceBarcode = blindPendingInvoiceBarcodes.join(' | ');
    current.updatedAt = new Date().toISOString();
  }
}

function handleBlindInvoiceBarcodeV2Keydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addBlindInvoiceBarcode(event.currentTarget?.value || '');
}

function startBlindUnloadV2() {
  syncBlindDraftMetaFromConferenceV2Form();
  const value = byId('blind2-invoice-input')?.value || '';
  if (value.trim()) addBlindInvoiceBarcode(value);
  return startBlindUnload();
}

function openBlindUnloadInConferenceV2(recordId) {
  setActiveBlindUnload(recordId);
  showPage('unloads');
}

function getBlindVisibleConferenceRows(options = {}) {
  const scopeDepotId = getDepotTabsContextId();
  const search = (byId(options.searchId || 'blind2-record-search')?.value || '').trim().toLowerCase();
  const status = byId(options.statusId || 'blind2-record-status')?.value || '';
  return getBlindRecordsVisibleToCurrentUser()
    .filter(record => scopeDepotId === ALL_DEPOTS_VALUE || getUnloadRecordDepotIds(record).includes(scopeDepotId))
    .filter(record => !status || record.status === status)
    .filter(record => {
      if (!search) return true;
      const haystack = [
        record.invoiceBarcode,
        ...(record.invoiceBarcodes || []),
        record.vehiclePlate,
        record.createdBy,
        record.rejectionReason,
        ...(record.items || []).flatMap(item => [
          item.code,
          item.name,
          item.reference,
          item.lot,
          item.targetDrawerKey,
          getDepotById(item.targetDepotId)?.name || item.targetDepotId,
        ]),
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
}

function buildBlindConferenceKpis(rows = []) {
  const inProgress = rows.filter(record => record.status === 'in_progress').length;
  const pending = rows.filter(record => record.status === 'pending_review').length;
  const totalKg = rows.reduce((sum, record) => sum + (record.items || []).reduce((acc, item) => acc + (parseFloat(item.kgTotal ?? item.kg) || 0), 0), 0);
  const damagedKg = rows.reduce((sum, record) => sum + (record.items || []).filter(item => item.condition === 'damaged').reduce((acc, item) => acc + (parseFloat(item.kgTotal ?? item.kg) || 0), 0), 0);
  const nfs = rows.reduce((sum, record) => sum + (Array.isArray(record.invoiceBarcodes) ? record.invoiceBarcodes.length : 0), 0);
  return [
    ['Em descarga', String(inProgress), 'Descargas abertas e ainda editáveis.'],
    ['Pendentes', String(pending), 'Aguardando revisão do supervisor.'],
    ['NFs lidas', String(nfs), 'Somatório das notas vinculadas aos cards visíveis.'],
    ['Kg conferidos', totalKg.toFixed(3), `Avariados: ${damagedKg.toFixed(3)} kg`],
  ].map(([label, value, note]) => `<div class="conf3-kpi-card"><div class="conf3-kpi-label">${escapeHtml(label)}</div><div class="conf3-kpi-value">${escapeHtml(value)}</div><div class="conf3-kpi-note">${escapeHtml(note)}</div></div>`).join('');
}

function buildBlindConferenceRecordCard(record) {
  const summary = {
    lines: Array.isArray(record?.items) ? record.items.length : 0,
    totalKg: (record?.items || []).reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0),
    damagedKg: (record?.items || []).filter(item => item.condition === 'damaged').reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0),
  };
  const recordDepotIds = getUnloadRecordDepotIds(record);
  const depotsLabel = recordDepotIds.length
    ? recordDepotIds.map(id => getDepotById(id)?.name || id).join(' · ')
    : 'Sem destino definido';
  const active = record.id === activeBlindUnloadId;
  return `<article class="conf3-unload-card ${escapeHtml(record.status || '')} ${active ? 'active' : ''}">
    <div class="conf3-unload-head">
      <div>
        <div class="conf3-unload-title">NF ${escapeHtml(record.invoiceBarcode || 'sem NF')}</div>
        <div class="conf3-unload-meta">Placa ${escapeHtml(record.vehiclePlate || '—')} · ${escapeHtml(getBlindStatusLabel(record.status))} · ${escapeHtml(formatBlindDuration(record.startedAt, record.endedAt))}</div>
      </div>
      <span class="mini-pill">${escapeHtml(record.items?.length || 0)} linha(s)</span>
    </div>
    <div class="conf3-unload-summary">
      <div class="conf3-unload-cell"><span>Depósitos</span><strong>${escapeHtml(depotsLabel)}</strong></div>
      <div class="conf3-unload-cell"><span>Kg</span><strong>${summary.totalKg.toFixed(3)} kg</strong></div>
      <div class="conf3-unload-cell"><span>Avariados</span><strong>${summary.damagedKg.toFixed(3)} kg</strong></div>
    </div>
    <div class="conf3-unload-actions">
      <button class="btn btn-accent" onclick="setActiveBlindUnload('${escapeJs(record.id)}');renderBlindConferenceViews()">ABRIR</button>
      <button class="btn" onclick="openBlindUnloadInConferenceV2('${escapeJs(record.id)}')">FOCAR</button>
    </div>
  </article>`;
}

function buildBlindConferencePoolCards(items = []) {
  return items.map(item => `<article class="conf3-item-card" data-blind-pool-card="${escapeHtml(item.id)}">
    <div class="conf3-item-head">
      <div>
        <div class="conf3-item-title">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')}</div>
        <div class="conf3-item-meta">${(parseFloat(item.qty || 0) || 0).toFixed(3)} ${escapeHtml(item.unit || 'un')} · ${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg · lote ${escapeHtml(item.lot || '—')}</div>
      </div>
      <button class="btn btn-accent" onclick="blindAllocateSelected('${escapeJs(item.id)}')">ALOCAR</button>
    </div>
    <div class="conf3-item-foot">Fornecedor ${escapeHtml(item.supplier || '—')} · validade ${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')} · conferido por ${escapeHtml(item.checkedBy || '—')}</div>
  </article>`).join('');
}

function renderBlindCountCardsPage() {
  if (!hasBlindCountAccess()) return;
  const page = byId('page-conference-cards');
  if (!page) return;
  renderBlindProductSuggestions();
  const current = getBlindCurrentDraft();
  const countEl = byId('blind2-record-count');
  const rows = getBlindVisibleConferenceRows();
  if (countEl) countEl.textContent = `${rows.length} descarga(s)`;
  const kpisEl = byId('blind2-kpis');
  if (kpisEl) kpisEl.innerHTML = buildBlindConferenceKpis(rows);

  const boardEl = byId('blind2-unload-board');
  if (boardEl) {
    boardEl.innerHTML = rows.length
      ? rows.map(buildBlindConferenceRecordCard).join('')
      : '<div class="empty-msg">Nenhuma descarga encontrada neste escopo.</div>';
  }

  const depotSelect = byId('blind2-target-depot');
  if (depotSelect) {
    const currentDepot = getDepotTabsContextId() || depotSelect.value || ALL_DEPOTS_VALUE;
    depotSelect.innerHTML = `<option value="${ALL_DEPOTS_VALUE}">Todos os depósitos</option>` + getBlindOperationalDepots().map(depot => `<option value="${escapeHtml(depot.id)}">${escapeHtml(depot.name)}</option>`).join('');
    depotSelect.value = currentDepot;
  }

  const activeBadge = byId('blind2-active-badge');
  if (activeBadge) activeBadge.textContent = current ? `Ativa: ${current.invoiceBarcode || current.id}` : 'Sem descarga ativa';
  const invoiceInput = byId('blind2-invoice-input');
  if (invoiceInput && document.activeElement !== invoiceInput) invoiceInput.value = '';
  const plateInput = byId('blind2-vehicle-plate');
  if (plateInput) plateInput.value = current?.vehiclePlate || blindPendingVehiclePlate || '';
  const timerEl = byId('blind2-unload-timer');
  if (timerEl) timerEl.textContent = current ? formatBlindDuration(current.startedAt, current.endedAt) : '00:00:00';
  const chipEl = byId('blind2-invoice-chip-list');
  if (chipEl) {
    chipEl.innerHTML = blindPendingInvoiceBarcodes.length
      ? blindPendingInvoiceBarcodes.map((code, index) => `<span class="mini-pill">${escapeHtml(code)} <button type="button" class="btn" style="padding:0 4px;min-width:auto;border:none;background:none;color:inherit" onclick="removeBlindInvoiceBarcode(${index})">×</button></span>`).join('')
      : '<span class="shipping-cart-meta">Nenhuma NF adicionada.</span>';
  }

  const summary = getBlindDraftSummary();
  const summaryEl = byId('blind2-active-summary');
  if (summaryEl) {
    summaryEl.innerHTML = [
      ['Status', current ? getBlindStatusLabel(current.status) : 'Sem descarga ativa'],
      ['NFs', String(blindPendingInvoiceBarcodes.length)],
      ['Linhas', String(summary.lines)],
      ['Produtos', String(summary.uniqueProducts)],
      ['Kg', `${summary.totalKg.toFixed(3)} kg`],
      ['Avariados', `${summary.damagedKg.toFixed(3)} kg`],
    ].map(([label, value]) => `<div class="conf3-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  }

  const receivedEl = byId('blind2-received-summary');
  if (receivedEl) {
    const currentItems = Array.isArray(current?.items) ? current.items : [];
    const targetPairs = [...new Set(currentItems.map(item => `${getDepotById(item.targetDepotId)?.name || item.targetDepotId} · ${item.targetDrawerKey || '—'}`))];
    const qtyPool = blindCountPool.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
    const qtyAllocated = currentItems.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
    receivedEl.innerHTML = [
      ['Recebido', `${blindCountPool.length} item(ns) na pool`, `${qtyPool.toFixed(3)} un conferidas e aguardando endereço.`],
      ['Direcionado', `${currentItems.length} linha(s) alocadas`, targetPairs.length ? targetPairs.slice(0, 4).join(' · ') : 'Nenhum destino confirmado ainda.' ],
      ['Dados conferidos', `${qtyAllocated.toFixed(3)} un já endereçadas`, current?.invoiceBarcodes?.length ? `NFs: ${current.invoiceBarcodes.join(', ')}` : 'Sem NF associada.' ],
    ].map(([label, value, note]) => `<div class="conf3-received-card"><div class="conf3-received-label">${escapeHtml(label)}</div><div class="conf3-received-value">${escapeHtml(value)}</div><div class="conf3-received-note">${escapeHtml(note)}</div></div>`).join('');
  }

  const poolSearch = (byId('blind2-pool-search')?.value || '').trim().toLowerCase();
  const filteredPool = blindCountPool.filter(item => {
    if (!poolSearch) return true;
    const hay = `${item.code} ${item.name || ''} ${item.lot || ''} ${item.reference || ''} ${item.supplier || ''}`.toLowerCase();
    return hay.includes(poolSearch);
  });
  const poolList = byId('blind2-pool-list');
  if (poolList) {
    poolList.innerHTML = filteredPool.length
      ? buildBlindConferencePoolCards(filteredPool)
      : '<div class="empty-msg">Nenhum item na pool para o filtro atual.</div>';
    poolList.querySelectorAll('[data-blind-pool-card]').forEach(el => {
      const itemId = el.dataset.blindPoolCard;
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', () => { blindCountDragItemId = itemId; blindCountFocusedItemId = itemId; });
      el.addEventListener('dragend', () => { blindCountDragItemId = null; });
    });
  }
  const poolSummary = byId('blind2-pool-summary');
  if (poolSummary) {
    const totalKg = filteredPool.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
    poolSummary.innerHTML = [
      ['Itens', String(filteredPool.length)],
      ['Kg', `${totalKg.toFixed(3)} kg`],
      ['Status', blindCountSelected.drawerKey ? `Destino ${blindCountSelected.drawerKey}` : 'Selecione uma gaveta'],
    ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
  }

  const targetSearch = (byId('blind2-target-search')?.value || '').trim().toLowerCase();
  const targetDepotIds = getBlindTargetDepotIds(byId('blind2-target-depot')?.value || ALL_DEPOTS_VALUE);
  const targetList = byId('blind2-target-list');
  if (targetList) {
    const blocks = [];
    targetDepotIds.forEach(depotId => {
      const depot = getDepotById(depotId);
      (shelvesAll[depotId] || []).filter(shelf => !isDiscardDepot(depot)).forEach(shelf => {
        for (let floor = 1; floor <= shelf.floors; floor++) {
          for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
            const key = drawerKey(shelf.id, floor, drawer);
            const list = getShippingDrawerProducts(depotId, key);
            const hay = `${depot?.name || depotId} ${shelf.id} ${key} ${list.map(item => `${item.code} ${item.name}`).join(' ')}`.toLowerCase();
            if (targetSearch && !hay.includes(targetSearch)) continue;
            const usedKg = list.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
            const selected = blindCountSelected.depotId === depotId && blindCountSelected.drawerKey === key;
            blocks.push(`<article class="conf3-target-card ${selected ? 'active' : ''}" data-blind2-target="${escapeHtml(key)}" data-depot="${escapeHtml(depotId)}" data-key="${escapeHtml(key)}">
              <div class="conf3-target-title">${escapeHtml(depot?.name || depotId)}</div>
              <div class="conf3-target-key">${escapeHtml(key)}</div>
              <div class="conf3-target-meta">${escapeHtml(shelf.id)} · ${list.length} item(ns) · ${usedKg.toFixed(3)} kg</div>
            </article>`);
          }
        }
      });
    });
    targetList.innerHTML = blocks.length ? blocks.join('') : '<div class="empty-msg">Nenhuma gaveta de destino encontrada.</div>';
    targetList.querySelectorAll('[data-blind2-target]').forEach(el => {
      el.addEventListener('click', () => {
        blindCountSelected = { depotId: el.dataset.depot, drawerKey: el.dataset.key };
        if (blindCountFocusedItemId) {
          openBlindAllocateModal(blindCountFocusedItemId, el.dataset.depot, el.dataset.key);
          return;
        }
        renderBlindCountCardsPage();
      });
      el.addEventListener('dragover', event => {
        if (!blindCountDragItemId) return;
        event.preventDefault();
        el.classList.add('dragover');
      });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', event => {
        event.preventDefault();
        el.classList.remove('dragover');
        if (!blindCountDragItemId) return;
        blindCountSelected = { depotId: el.dataset.depot, drawerKey: el.dataset.key };
        openBlindAllocateModal(blindCountDragItemId, el.dataset.depot, el.dataset.key);
        blindCountDragItemId = null;
      });
    });
  }

  const targetDetail = byId('blind2-target-detail');
  if (targetDetail) {
    if (!blindCountSelected.depotId || !blindCountSelected.drawerKey) {
      targetDetail.innerHTML = '<div class="empty-msg">Selecione uma gaveta para ver a ocupação atual e alocar itens.</div>';
    } else {
      const depot = getDepotById(blindCountSelected.depotId);
      const list = getShippingDrawerProducts(blindCountSelected.depotId, blindCountSelected.drawerKey);
      targetDetail.innerHTML = `<div class="conf3-target-detail-head"><strong>${escapeHtml(depot?.name || blindCountSelected.depotId)} · ${escapeHtml(blindCountSelected.drawerKey)}</strong><span>${escapeHtml(list.length)} item(ns)</span></div>` +
        (list.length ? list.map(item => `<div class="conf3-target-line">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')} · ${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg</div>`).join('') : '<div class="empty-msg">Gaveta vazia e pronta para receber itens.</div>');
    }
  }

  const allocatedList = byId('blind2-allocated-list');
  if (allocatedList) {
    const items = Array.isArray(current?.items) ? current.items : [];
    allocatedList.innerHTML = items.length
      ? buildBlindRecordItemCards(items, { editable: true })
      : '<div class="empty-msg">Nenhum item direcionado nesta descarga.</div>';
  }
  notifyBlindRejectionsForCurrentUser();
}

function syncBlindDraftMetaFromConferenceV3Form() {
  const plate = sanitizeTextInput(byId('blind3-vehicle-plate')?.value || '', { maxLength: 16, uppercase: true });
  const pendingInput = sanitizeTextInput(byId('blind3-invoice-input')?.value || '', { maxLength: 120, uppercase: true });
  blindPendingVehiclePlate = plate;
  const legacyPlate = byId('blind-vehicle-plate');
  if (legacyPlate) legacyPlate.value = plate;
  const legacyInvoice = byId('blind-invoice-barcode');
  if (legacyInvoice) legacyInvoice.value = pendingInput;
  const cardsPlate = byId('blind2-vehicle-plate');
  if (cardsPlate) cardsPlate.value = plate;
  const cardsInvoice = byId('blind2-invoice-input');
  if (cardsInvoice && document.activeElement !== cardsInvoice) cardsInvoice.value = pendingInput;
  const current = getBlindCurrentDraft();
  if (current) {
    current.vehiclePlate = plate;
    current.invoiceBarcodes = deepClone(blindPendingInvoiceBarcodes);
    current.invoiceBarcode = blindPendingInvoiceBarcodes.join(' | ');
    current.updatedAt = new Date().toISOString();
  }
}

function handleBlindInvoiceBarcodeV3Keydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addBlindInvoiceBarcode(event.currentTarget?.value || '');
}

function startBlindUnloadV3() {
  syncBlindDraftMetaFromConferenceV3Form();
  const value = byId('blind3-invoice-input')?.value || '';
  if (value.trim()) addBlindInvoiceBarcode(value);
  return startBlindUnload();
}

function renderBlindExpectedSummaryClassic() {
  const container = byId('blind3-expected-summary');
  const preview = byId('blind3-expected-file-preview');
  if (!container) return;
  if (!blindExpectedManifest?.items?.length) {
    container.innerHTML = '<div class="conf4-expected-card"><div class="conf4-expected-label">Manifesto</div><div class="conf4-expected-value">Sem arquivo</div><div class="conf4-expected-note">Importe XML ou CSV para comparar esperado x conferido.</div></div>';
    if (preview) preview.style.display = 'none';
    return;
  }
  const rows = buildBlindExpectedComparison();
  const divergences = rows.filter(row => Math.abs(row.diff) > 0.0001);
  const matched = rows.length - divergences.length;
  container.innerHTML = [
    ['Arquivo', blindExpectedManifest.filename || 'manifesto', `${(blindExpectedManifest.type || 'arquivo').toUpperCase()} importado em ${fmtDateTime(blindExpectedManifest.importedAt || new Date().toISOString())}`],
    ['Linhas', String(blindExpectedManifest.items.length), `${matched} SKU(s) conciliados até agora.`],
    ['Divergências', String(divergences.length), divergences.slice(0, 3).map(row => `${row.code || row.name}: ${row.diff > 0 ? '+' : ''}${row.diff.toFixed(3)}`).join(' · ') || 'Sem diferença entre esperado e conferido.'],
  ].map(([label, value, note]) => `<div class="conf4-expected-card"><div class="conf4-expected-label">${escapeHtml(label)}</div><div class="conf4-expected-value">${escapeHtml(value)}</div><div class="conf4-expected-note">${escapeHtml(note)}</div></div>`).join('');
  if (preview) {
    preview.style.display = 'block';
    preview.innerHTML = `<pre>${rows.slice(0, 10).map(row => `${escapeHtml(row.code || '—')} | esp ${row.expectedQty.toFixed(3)} | conf ${row.receivedQty.toFixed(3)} | diff ${row.diff.toFixed(3)}`).join('\n')}${rows.length > 10 ? '\n...' : ''}</pre>`;
  }
}

function renderBlindCountClassicPage() {
  if (!hasBlindCountAccess()) return;
  const page = byId('page-conference-table');
  if (!page) return;
  renderBlindProductSuggestions();
  startBlindUnloadTimer();

  const rows = getBlindVisibleConferenceRows({ searchId: 'blind3-record-search', statusId: 'blind3-record-status' });
  const countEl = byId('blind3-record-count');
  if (countEl) countEl.textContent = `${rows.length} descarga(s)`;
  const kpisEl = byId('blind3-kpis');
  if (kpisEl) kpisEl.innerHTML = buildBlindConferenceKpis(rows);

  const queueBody = byId('blind3-queue-body');
  if (queueBody) {
    queueBody.innerHTML = rows.length
      ? rows.map(record => {
          const active = record.id === activeBlindUnloadId;
          const depotLabels = getUnloadRecordDepotIds(record).map(id => getDepotById(id)?.name || id).join(' · ') || '—';
          const totalKg = (record.items || []).reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
          return `<tr class="${active ? 'conf4-row-active' : ''}">
            <td><span class="review-status-pill ${escapeHtml(record.status || '')}">${escapeHtml(getBlindStatusLabel(record.status))}</span></td>
            <td>${escapeHtml(record.invoiceBarcode || '—')}</td>
            <td>${escapeHtml(record.vehiclePlate || '—')}</td>
            <td>${escapeHtml(formatBlindDuration(record.startedAt, record.endedAt))}</td>
            <td>${escapeHtml(String(record.items?.length || 0))}</td>
            <td>${escapeHtml(totalKg.toFixed(3))}</td>
            <td>${escapeHtml(depotLabels)}</td>
            <td class="table-actions-cell"><button class="btn btn-accent" onclick="setActiveBlindUnload('${escapeJs(record.id)}');renderBlindConferenceViews()">ABRIR</button></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="8"><div class="empty-msg">Nenhuma descarga encontrada neste escopo.</div></td></tr>';
  }

  const depotSelect = byId('blind3-target-depot');
  if (depotSelect) {
    const currentDepot = getDepotTabsContextId() || depotSelect.value || ALL_DEPOTS_VALUE;
    depotSelect.innerHTML = `<option value="${ALL_DEPOTS_VALUE}">Todos os depósitos</option>` + getBlindOperationalDepots().map(depot => `<option value="${escapeHtml(depot.id)}">${escapeHtml(depot.name)}</option>`).join('');
    depotSelect.value = currentDepot;
  }

  const current = getBlindCurrentDraft();
  const activeBadge = byId('blind3-active-badge');
  if (activeBadge) activeBadge.textContent = current ? `Ativa: ${current.invoiceBarcode || current.id}` : 'Sem descarga ativa';
  const invoiceInput = byId('blind3-invoice-input');
  if (invoiceInput && document.activeElement !== invoiceInput) invoiceInput.value = '';
  const plateInput = byId('blind3-vehicle-plate');
  if (plateInput) plateInput.value = current?.vehiclePlate || blindPendingVehiclePlate || '';
  const timerEl = byId('blind3-unload-timer');
  if (timerEl) timerEl.textContent = current ? formatBlindDuration(current.startedAt, current.endedAt) : '00:00:00';
  const chipEl = byId('blind3-invoice-chip-list');
  if (chipEl) {
    chipEl.innerHTML = blindPendingInvoiceBarcodes.length
      ? blindPendingInvoiceBarcodes.map((code, index) => `<span class="mini-pill">${escapeHtml(code)} <button type="button" class="btn" style="padding:0 4px;min-width:auto;border:none;background:none;color:inherit" onclick="removeBlindInvoiceBarcode(${index})">×</button></span>`).join('')
      : '<span class="shipping-cart-meta">Nenhuma NF adicionada.</span>';
  }
  const summary = getBlindDraftSummary();
  const summaryEl = byId('blind3-active-summary');
  if (summaryEl) {
    summaryEl.innerHTML = [
      ['Status', current ? getBlindStatusLabel(current.status) : 'Sem descarga ativa'],
      ['NFs', String(blindPendingInvoiceBarcodes.length)],
      ['Linhas', String(summary.lines)],
      ['SKUs', String(summary.uniqueProducts)],
      ['Kg', `${summary.totalKg.toFixed(3)} kg`],
      ['Avariados', `${summary.damagedKg.toFixed(3)} kg`],
    ].map(([label, value]) => `<div class="conf3-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  }
  renderBlindExpectedSummaryClassic();

  const poolSearch = (byId('blind3-pool-search')?.value || '').trim().toLowerCase();
  const filteredPool = blindCountPool.filter(item => {
    if (!poolSearch) return true;
    const hay = `${item.code} ${item.name || ''} ${item.lot || ''} ${item.reference || ''} ${item.supplier || ''}`.toLowerCase();
    return hay.includes(poolSearch);
  });
  const poolSummary = byId('blind3-pool-summary');
  if (poolSummary) {
    const totalQty = filteredPool.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
    const totalKg = filteredPool.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
    poolSummary.innerHTML = [
      ['ITENS', String(filteredPool.length)],
      ['QTD', totalQty.toFixed(3)],
      ['KG', `${totalKg.toFixed(3)} kg`],
      ['STATUS', blindCountSelected.drawerKey ? `Destino ${blindCountSelected.drawerKey}` : 'Selecione uma gaveta'],
    ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
  }
  const poolBody = byId('blind3-pool-body');
  if (poolBody) {
    poolBody.innerHTML = filteredPool.length
      ? filteredPool.map(item => `<tr class="${blindCountFocusedItemId === item.id ? 'conf4-row-active' : ''}">
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(item.name || '—')}</td>
          <td>${escapeHtml(item.lot || '—')}</td>
          <td>${escapeHtml((parseFloat(item.qty || 0) || 0).toFixed(3))}</td>
          <td>${escapeHtml((parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3))}</td>
          <td>${escapeHtml(item.supplier || '—')}</td>
          <td>${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')}</td>
          <td class="table-actions-cell"><button class="btn btn-accent" onclick="blindCountFocusedItemId='${escapeJs(item.id)}';renderBlindCountClassicPage()">FOCAR</button><button class="btn" onclick="blindAllocateSelected('${escapeJs(item.id)}')">ALOCAR</button></td>
        </tr>`).join('')
      : '<tr><td colspan="8"><div class="empty-msg">Nenhum item na pool para o filtro atual.</div></td></tr>';
  }

  const targetSearch = (byId('blind3-target-search')?.value || '').trim().toLowerCase();
  const targetDepotIds = getBlindTargetDepotIds(byId('blind3-target-depot')?.value || ALL_DEPOTS_VALUE);
  const targetRows = [];
  targetDepotIds.forEach(depotId => {
    const depot = getDepotById(depotId);
    (shelvesAll[depotId] || []).filter(shelf => !isDiscardDepot(depot)).forEach(shelf => {
      const shelfTypeLabel = getShelfTypeLabel(shelf.type);
      const maxKg = parseFloat((shelf.maxKg ?? shelf.max_kg_per_drawer) || 0) || 0;
      for (let floor = 1; floor <= shelf.floors; floor++) {
        for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
          const key = drawerKey(shelf.id, floor, drawer);
          const list = getShippingDrawerProducts(depotId, key);
          const usedKg = list.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
          const fill = maxKg > 0 ? Math.min(999, (usedKg / maxKg) * 100) : 0;
          const hay = `${depot?.name || depotId} ${shelf.id} ${key} ${shelfTypeLabel} ${list.map(item => `${item.code} ${item.name || ''}`).join(' ')}`.toLowerCase();
          if (targetSearch && !hay.includes(targetSearch)) continue;
          targetRows.push({ depotId, depotName: depot?.name || depotId, key, shelfTypeLabel, usedKg, maxKg, fill, itemCount: list.length });
        }
      }
    });
  });
  targetRows.sort((a, b) => (a.fill - b.fill) || a.depotName.localeCompare(b.depotName) || a.key.localeCompare(b.key));
  if ((!blindCountSelected.depotId || !blindCountSelected.drawerKey) && targetRows.length) {
    blindCountSelected = { depotId: targetRows[0].depotId, drawerKey: targetRows[0].key };
  }
  const targetBody = byId('blind3-target-body');
  if (targetBody) {
    targetBody.innerHTML = targetRows.length
      ? targetRows.map(row => {
          const selected = blindCountSelected.depotId === row.depotId && blindCountSelected.drawerKey === row.key;
          const fillClass = row.fill >= 95 ? 'danger' : row.fill >= 70 ? 'warn' : 'ok';
          return `<tr class="${selected ? 'conf4-row-active' : ''}">
            <td>${escapeHtml(row.depotName)}</td>
            <td>${escapeHtml(row.key)}</td>
            <td>${escapeHtml(row.shelfTypeLabel)}</td>
            <td>${escapeHtml(String(row.itemCount))}</td>
            <td>${escapeHtml(row.usedKg.toFixed(3))} / ${escapeHtml(row.maxKg.toFixed(3))} kg</td>
            <td><span class="conf4-fill ${fillClass}">${escapeHtml(row.fill.toFixed(1))}%</span></td>
            <td class="table-actions-cell"><button class="btn" onclick="blindCountSelected={ depotId: '${escapeJs(row.depotId)}', drawerKey: '${escapeJs(row.key)}' };renderBlindCountClassicPage()">SELECIONAR</button></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7"><div class="empty-msg">Nenhuma gaveta de destino encontrada.</div></td></tr>';
  }

  const targetDetail = byId('blind3-target-detail');
  if (targetDetail) {
    if (!blindCountSelected.depotId || !blindCountSelected.drawerKey) {
      targetDetail.innerHTML = '<div class="empty-msg">Selecione uma gaveta para ver a ocupação atual.</div>';
    } else {
      const depot = getDepotById(blindCountSelected.depotId);
      const list = getShippingDrawerProducts(blindCountSelected.depotId, blindCountSelected.drawerKey);
      targetDetail.innerHTML = `<div class="conf3-target-detail-head"><strong>${escapeHtml(depot?.name || blindCountSelected.depotId)} · ${escapeHtml(blindCountSelected.drawerKey)}</strong><span>${escapeHtml(String(list.length))} item(ns)</span></div>` +
        (list.length ? list.map(item => `<div class="conf3-target-line">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')} · ${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg</div>`).join('') : '<div class="empty-msg">Gaveta vazia e pronta para receber itens.</div>');
    }
  }

  const allocatedBody = byId('blind3-allocated-body');
  if (allocatedBody) {
    const items = Array.isArray(current?.items) ? current.items : [];
    allocatedBody.innerHTML = items.length
      ? items.map(item => {
          const depotLabel = getDepotById(item.targetDepotId)?.name || item.targetDepotId || '—';
          return `<tr>
            <td>${escapeHtml(item.code)}</td>
            <td>${escapeHtml(item.name || '—')}</td>
            <td><span class="mini-pill">${escapeHtml(getBlindConditionLabel(item.condition))}</span></td>
            <td>${escapeHtml(item.qty.toFixed(3))} ${escapeHtml(item.unit || 'un')}</td>
            <td>${escapeHtml(item.kgTotal.toFixed(3))} kg</td>
            <td>${escapeHtml(`${depotLabel} · ${item.targetDrawerKey || '—'}`)}</td>
            <td>${escapeHtml(item.lot || '—')}</td>
            <td>${escapeHtml(item.checkedBy || '—')}</td>
            <td class="table-actions-cell"><button class="btn btn-accent" onclick="editBlindAllocatedItem('${escapeJs(item.id)}')">EDITAR</button><button class="btn btn-danger" onclick="returnBlindAllocatedItemToPool('${escapeJs(item.id)}')">RETORNAR</button></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="9"><div class="empty-msg">Nenhum item direcionado nesta descarga.</div></td></tr>';
  }

  queueEnhanceResizableTables(page);
  notifyBlindRejectionsForCurrentUser();
}

function openBlindPoolModal() {
  if (!hasBlindCountAccess()) return;
  if (!blindUnloadDraft) {
    showNotice({ title: 'DESCARGA NÃO INICIADA', icon: '🚛', desc: 'Inicie a descarga antes de conferir qualquer item na pool.' });
    return;
  }
  renderBlindProductSuggestions();
  document.getElementById('bcp-product-lookup').value = '';
  document.getElementById('bcp-code').value = '';
  document.getElementById('bcp-name').value = '';
  document.getElementById('bcp-unit').value = 'un';
  document.getElementById('bcp-qty').value = '1';
  document.getElementById('bcp-kg-unit').value = '';
  document.getElementById('bcp-kg-total').value = '';
  document.getElementById('bcp-lot').value = '';
  document.getElementById('bcp-entry').value = new Date().toISOString().slice(0, 10);
  document.getElementById('bcp-expiry').value = '';
  document.getElementById('bcp-supplier').value = '';
  document.getElementById('bcp-reference').value = '';
  document.getElementById('bcp-notes').value = '';
  blindDamagePhotoDataUrl = '';
  const photoInput = document.getElementById('bcp-damage-photo');
  if (photoInput) photoInput.value = '';
  const photoPreview = document.getElementById('bcp-damage-photo-preview');
  if (photoPreview) photoPreview.textContent = 'Sem imagem';
  hideBlindProductLookupMenu();
  document.getElementById('blind-pool-modal').classList.add('open');
}

function closeBlindPoolModal() {
  hideBlindProductLookupMenu();
  document.getElementById('blind-pool-modal')?.classList.remove('open');
}

async function saveBlindPoolItem() {
  if (!hasBlindCountAccess()) {
    await showNotice({ title: 'ACESSO NEGADO', icon: '⛔', desc: 'Somente conferentes, supervisores, gerentes e cargos acima podem operar a conferência cega.' });
    return;
  }
  if (!blindUnloadDraft) {
    await showNotice({ title: 'DESCARGA NÃO INICIADA', icon: '🚛', desc: 'Inicie a descarga antes de registrar itens conferidos.' });
    return;
  }
  const lookupValue = sanitizeTextInput(document.getElementById('bcp-product-lookup')?.value || '', { maxLength: 160 });
  if ((!document.getElementById('bcp-code')?.value || !document.getElementById('bcp-name')?.value) && lookupValue) {
    const fallbackMatch = resolveBlindProductMatch(lookupValue, lookupValue, 'code') || resolveBlindProductMatch(lookupValue, lookupValue, 'name');
    if (fallbackMatch) fillBlindProductModalFromMatch(fallbackMatch);
  }
  syncWeightFields('bcp', 'qty');
  const code = sanitizeTextInput(document.getElementById('bcp-code')?.value, { maxLength: 40, uppercase: true });
  const name = sanitizeTextInput(document.getElementById('bcp-name')?.value, { maxLength: 120 });
  const unit = sanitizeTextInput(document.getElementById('bcp-unit')?.value, { maxLength: 10 }) || 'un';
  const qty = parseFloat(document.getElementById('bcp-qty')?.value || '0') || 0;
  const kgPerUnit = parseFloat(document.getElementById('bcp-kg-unit')?.value || '0') || 0;
  const kgTotal = parseFloat(document.getElementById('bcp-kg-total')?.value || '0') || 0;
  const lot = sanitizeTextInput(document.getElementById('bcp-lot')?.value, { maxLength: 60, uppercase: true });
  const entry = document.getElementById('bcp-entry')?.value || new Date().toISOString().slice(0, 10);
  const expiry = document.getElementById('bcp-expiry')?.value || '';
  const supplier = sanitizeTextInput(document.getElementById('bcp-supplier')?.value, { maxLength: 120 });
  const reference = sanitizeTextInput(document.getElementById('bcp-reference')?.value, { maxLength: 80 });
  const notes = sanitizeTextInput(document.getElementById('bcp-notes')?.value, { maxLength: 180 });
  if (lookupValue && (!code || !name)) {
    await showNotice({ title: 'SELECIONE O PRODUTO', icon: '🔎', desc: 'Escolha um item da lista de sugestões ou digite um código/nome cadastrado completo.' });
    return;
  }
  if (!code || !name || qty <= 0 || kgTotal <= 0) {
    await showNotice({ title: 'DADOS INCOMPLETOS', icon: '⛔', desc: 'Código, nome, quantidade e kg total são obrigatórios para incluir o item na pool.' });
    return;
  }
  syncBlindDraftMetaFromForm();
  const item = {
    id: `bcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code,
    name,
    unit,
    qty: parseFloat(qty.toFixed(3)),
    kgPerUnit: parseFloat(kgPerUnit.toFixed(3)),
    kgTotal: parseFloat(kgTotal.toFixed(3)),
    kg: parseFloat(kgTotal.toFixed(3)),
    lot,
    entry,
    expiries: expiry ? [expiry] : [],
    supplier,
    reference,
    notes,
    damagePhoto: blindDamagePhotoDataUrl || '',
    checkedAt: new Date().toISOString(),
    checkedBy: getCurrentUserLabel(),
  };
  blindCountPool.unshift(item);
  setUndoAction(`remoção do item ${code} da pool`, () => {
    blindCountPool = blindCountPool.filter(entry => entry.id !== item.id);
    persistBlindUnloadsState().catch(err => console.error('Falha ao persistir desfazer na pool:', err));
    renderBlindConferenceViews();
  });
  logHistory('📥', `Item conferido na pool: ${code} — ${name}`, `${qty.toFixed(3)} ${unit} · ${kgTotal.toFixed(3)} kg${reference ? ' · ref. ' + reference : ''}`, { type: 'entrada', productCode: code });
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir item na pool:', err));
  closeBlindPoolModal();
  showToast(`Item ${code} conferido e enviado para a pool.`, 'success');
  renderBlindConferenceViews();
}

function findBlindPoolItem(itemId) {
  return blindCountPool.find(item => item.id === itemId) || null;
}

function blindAllocateSelected(itemId) {
  if (!blindUnloadDraft) {
    showNotice({ title: 'DESCARGA NÃO INICIADA', icon: '🚛', desc: 'Inicie a descarga antes de alocar itens conferidos.' });
    return;
  }
  if (!blindCountSelected.depotId || !blindCountSelected.drawerKey) {
    showNotice({ title: 'DESTINO OBRIGATÓRIO', icon: '⛔', desc: 'Selecione primeiro a gaveta de destino para alocar o item conferido.' });
    return;
  }
  openBlindAllocateModal(itemId, blindCountSelected.depotId, blindCountSelected.drawerKey);
}

function openBlindAllocateModal(itemId, depotId, drawerKeyValue) {
  if (!blindUnloadDraft) {
    showNotice({ title: 'DESCARGA NÃO INICIADA', icon: '🚛', desc: 'Inicie a descarga antes de alocar itens conferidos.' });
    return;
  }
  const item = findBlindPoolItem(itemId);
  if (!item) return;
  blindCountAllocationCtx = { itemId, depotId, drawerKeyValue };
  document.getElementById('blind-allocate-subtitle').textContent = `${getDepotById(depotId)?.name || depotId} · ${drawerKeyValue}`;
  document.getElementById('blind-allocate-summary').innerHTML = [
    ['PRODUTO', `${item.code} — ${item.name || ''}`],
    ['POOL', `${(parseFloat(item.qty || 0) || 0).toFixed(3)} ${item.unit || 'un'} · ${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg`],
    ['LOTE', item.lot || '—'],
    ['VALIDADE', item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—'],
  ].map(([key, value]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(key)}</span><span class="confirm-sum-val">${escapeHtml(value)}</span></div>`).join('');
  document.getElementById('bca-qty').value = (parseFloat(item.qty || 0) || 0).toFixed(3);
  document.getElementById('bca-kg-total').value = (parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3);
  document.getElementById('bca-note').value = '';
  const normalRadio = document.querySelector('input[name="bca-condition"][value="normal"]');
  if (normalRadio) normalRadio.checked = true;
  blindAllocationDamagePhotoDataUrl = item.damagePhoto || '';
  const fileInput = document.getElementById('bca-damage-photo');
  if (fileInput) fileInput.value = '';
  const photoPreview = document.getElementById('bca-damage-photo-preview');
  if (photoPreview) {
    photoPreview.innerHTML = blindAllocationDamagePhotoDataUrl
      ? `<img src="${escapeAttr(blindAllocationDamagePhotoDataUrl)}" alt="Foto da avaria">`
      : 'Obrigatória para avaria';
  }
  syncBlindDamagePhotoState();
  document.getElementById('blind-allocate-modal').classList.add('open');
}

function closeBlindAllocateModal() {
  document.getElementById('blind-allocate-modal')?.classList.remove('open');
  blindCountAllocationCtx = null;
}

function syncBlindAllocateFields(source = 'qty') {
  if (!blindCountAllocationCtx) return;
  const item = findBlindPoolItem(blindCountAllocationCtx.itemId);
  if (!item) return;
  const qtyEl = document.getElementById('bca-qty');
  const kgEl = document.getElementById('bca-kg-total');
  const maxQty = Math.max(0, parseFloat(item.qty || 0) || 0);
  const maxKg = Math.max(0, parseFloat(item.kgTotal ?? item.kg) || 0);
  let qty = Math.max(0, parseFloat(qtyEl.value || '0') || 0);
  let kg = Math.max(0, parseFloat(kgEl.value || '0') || 0);
  if (maxQty <= 0 || maxKg <= 0 || qty === 0 || kg === 0) {
    if (source === 'kg') qtyEl.value = '0.000';
    if (source === 'qty') kgEl.value = '0.000';
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

async function confirmBlindAllocation() {
  if (!blindCountAllocationCtx) return;
  if (!blindUnloadDraft) {
    await showNotice({ title: 'DESCARGA NÃO INICIADA', icon: '🚛', desc: 'A descarga não está ativa. Inicie novamente antes de alocar itens.' });
    closeBlindAllocateModal();
    return;
  }
  const item = findBlindPoolItem(blindCountAllocationCtx.itemId);
  if (!item) return;
  syncBlindDraftMetaFromForm();
  const qty = parseFloat(document.getElementById('bca-qty')?.value || '0') || 0;
  const kgTotal = parseFloat(document.getElementById('bca-kg-total')?.value || '0') || 0;
  const note = sanitizeTextInput(document.getElementById('bca-note')?.value || '', { maxLength: 180 });
  const condition = getCheckedOptionValue('bca-condition', 'normal');
  if (qty <= 0 || kgTotal <= 0 || qty - (parseFloat(item.qty || 0) || 0) > 0.0001 || kgTotal - (parseFloat(item.kgTotal ?? item.kg) || 0) > 0.0001) {
    await showNotice({ title: 'VALOR INVÁLIDO', icon: '⛔', desc: 'A quantidade ou o peso informado excedem o saldo disponível na pool.' });
    return;
  }
  if (condition === 'damaged' && !blindAllocationDamagePhotoDataUrl) {
    await showNotice({ title: 'FOTO OBRIGATÓRIA', icon: '⛔', desc: 'Itens avariados exigem uma foto anexada antes da alocação.' });
    return;
  }
  blindUnloadDraft.items.push({
    id: `bli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: item.code,
    name: item.name,
    unit: item.unit || 'un',
    qty: parseFloat(qty.toFixed(3)),
    kgPerUnit: qty > 0 ? parseFloat((kgTotal / qty).toFixed(3)) : parseFloat(item.kgPerUnit || 0),
    kg: parseFloat(kgTotal.toFixed(3)),
    kgTotal: parseFloat(kgTotal.toFixed(3)),
    lot: item.lot || '',
    entry: item.entry || new Date().toISOString().slice(0, 10),
    expiries: deepClone(item.expiries || []),
    supplier: item.supplier || '',
    reference: item.reference || '',
    notes: item.notes || '',
    note,
    condition,
    damagePhoto: condition === 'damaged' ? blindAllocationDamagePhotoDataUrl : (item.damagePhoto || ''),
    targetDepotId: blindCountAllocationCtx.depotId,
    targetDrawerKey: blindCountAllocationCtx.drawerKeyValue,
    checkedBy: item.checkedBy || getCurrentUserLabel(),
    checkedAt: item.checkedAt || new Date().toISOString(),
  });
  const itemQty = parseFloat(item.qty || 0) || 0;
  const itemKg = parseFloat(item.kgTotal ?? item.kg) || 0;
  if (qty >= itemQty - 0.0001 || kgTotal >= itemKg - 0.0001) {
    blindCountPool = blindCountPool.filter(entry => entry.id !== item.id);
  } else {
    item.qty = parseFloat((itemQty - qty).toFixed(3));
    item.kg = parseFloat((itemKg - kgTotal).toFixed(3));
    item.kgTotal = item.kg;
  }
  setUndoAction(`alocação do item ${item.code}`, () => {
    const rollbackItem = blindUnloadDraft.items.pop();
    if (rollbackItem) {
      blindCountPool.unshift({
        id: `bcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        code: rollbackItem.code,
        name: rollbackItem.name,
        unit: rollbackItem.unit,
        qty: rollbackItem.qty,
        kgPerUnit: rollbackItem.kgPerUnit,
        kgTotal: rollbackItem.kgTotal,
        kg: rollbackItem.kgTotal,
        lot: rollbackItem.lot,
        entry: rollbackItem.entry,
        expiries: deepClone(rollbackItem.expiries || []),
        supplier: rollbackItem.supplier || '',
        reference: rollbackItem.reference || '',
        notes: rollbackItem.notes || '',
        checkedAt: rollbackItem.checkedAt,
        checkedBy: rollbackItem.checkedBy,
        damagePhoto: rollbackItem.damagePhoto || '',
      });
      persistBlindUnloadsState().catch(err => console.error('Falha ao persistir undo de alocação:', err));
      renderBlindConferenceViews();
    }
  });
  logHistory('🔀', `Item alocado na descarga: ${item.code} — ${item.name}`, `${blindCountAllocationCtx.drawerKeyValue} · ${qty.toFixed(3)} ${item.unit || 'un'} · ${kgTotal.toFixed(3)} kg · ${condition === 'damaged' ? 'avariado' : condition === 'return' ? 'devolvido' : 'normal'}`, {
    depotId: blindCountAllocationCtx.depotId,
    to: blindCountAllocationCtx.drawerKeyValue,
    drawerKey: blindCountAllocationCtx.drawerKeyValue,
    productCode: item.code,
    type: 'entrada',
  });
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir alocação de descarga:', err));
  showToast(`Item ${item.code} alocado em ${blindCountAllocationCtx.drawerKeyValue}.`, 'success');
  closeBlindAllocateModal();
  renderBlindConferenceViews();
}

function removeBlindPoolItem(itemId) {
  blindCountPool = blindCountPool.filter(item => item.id !== itemId);
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir remoção da pool:', err));
  renderBlindConferenceViews();
}

function returnBlindAllocatedItemToPool(itemId) {
  if (!blindUnloadDraft) return;
  const idx = blindUnloadDraft.items.findIndex(item => item.id === itemId);
  if (idx < 0) return;
  const item = blindUnloadDraft.items[idx];
  blindCountPool.unshift({
    id: `bcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: item.qty,
    kgPerUnit: item.kgPerUnit,
    kgTotal: item.kgTotal,
    kg: item.kgTotal,
    lot: item.lot,
    entry: item.entry,
    expiries: deepClone(item.expiries || []),
    supplier: item.supplier || '',
    reference: item.reference || '',
    notes: [item.notes, item.note].filter(Boolean).join(' · '),
    checkedAt: item.checkedAt,
    checkedBy: item.checkedBy,
    damagePhoto: item.damagePhoto || '',
  });
  blindUnloadDraft.items.splice(idx, 1);
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir retorno à pool:', err));
  renderBlindConferenceViews();
}

function editBlindAllocatedItem(itemId) {
  if (!blindUnloadDraft) return;
  const idx = blindUnloadDraft.items.findIndex(item => item.id === itemId);
  if (idx < 0) return;
  const item = blindUnloadDraft.items[idx];
  const poolItem = {
    id: `bcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: item.qty,
    kgPerUnit: item.kgPerUnit,
    kgTotal: item.kgTotal,
    kg: item.kgTotal,
    lot: item.lot,
    entry: item.entry,
    expiries: deepClone(item.expiries || []),
    supplier: item.supplier || '',
    reference: item.reference || '',
    notes: item.notes || '',
    checkedAt: item.checkedAt,
    checkedBy: item.checkedBy,
    damagePhoto: item.damagePhoto || '',
  };
  blindCountPool.unshift(poolItem);
  blindUnloadDraft.items.splice(idx, 1);
  blindCountSelected = { depotId: item.targetDepotId, drawerKey: item.targetDrawerKey };
  renderBlindConferenceViews();
  openBlindAllocateModal(poolItem.id, item.targetDepotId, item.targetDrawerKey);
  document.getElementById('bca-note').value = item.note || '';
  const conditionRadio = document.querySelector(`input[name="bca-condition"][value="${item.condition || 'normal'}"]`);
  if (conditionRadio) conditionRadio.checked = true;
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir edição de item alocado:', err));
}

async function clearBlindCountPool() {
  if (!blindCountPool.length) return;
  const ok = await showConfirm({
    title: 'ESVAZIAR POOL',
    icon: '⚠',
    desc: 'Isso remove todos os itens conferidos ainda não alocados no estoque.',
    summary: { ITENS: String(blindCountPool.length) },
    okLabel: 'ESVAZIAR',
    okStyle: 'danger',
  });
  if (!ok) return;
  blindCountPool = [];
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir limpeza da pool:', err));
  renderBlindConferenceViews();
}

async function finalizeBlindUnload() {
  const current = getBlindCurrentDraft();
  if (!current) {
    await showNotice({ title: 'SEM DESCARGA ATIVA', icon: '⛔', desc: 'Inicie uma descarga antes de enviar para aprovação.' });
    return;
  }
  syncBlindDraftMetaFromForm();
  if (!Array.isArray(current.invoiceBarcodes) || !current.invoiceBarcodes.length) {
    await showNotice({ title: 'NF OBRIGATÓRIA', icon: '⛔', desc: 'Informe o código de barras da nota fiscal antes de encerrar a descarga.' });
    return;
  }
  if (!current.vehiclePlate) {
    await showNotice({ title: 'PLACA OBRIGATÓRIA', icon: '⛔', desc: 'Informe a placa do veículo antes de encerrar a descarga.' });
    return;
  }
  if (!current.items.length) {
    await showNotice({ title: 'SEM ITENS ALOCADOS', icon: '⛔', desc: 'A descarga precisa ter ao menos um item alocado antes do envio para aprovação.' });
    return;
  }
  if (blindCountPool.length) {
    await showNotice({ title: 'POOL PENDENTE', icon: '⛔', desc: 'Ainda existem itens conferidos na pool sem destino definido. Alocar tudo antes de encerrar.' });
    return;
  }
  const summary = getBlindDraftSummary();
  const ok = await showConfirm({
    title: 'ENCERRAR DESCARGA',
    icon: '📥',
    desc: 'A descarga será enviada para revisão do supervisor. Se houver erro, cancele e ajuste antes de enviar.',
    summary: {
      NFS: current.invoiceBarcodes.join(', '),
      PLACA: current.vehiclePlate,
      LINHAS: String(summary.lines),
      PRODUTOS: String(summary.uniqueProducts),
      'KG TOTAL': summary.totalKg.toFixed(3),
      TEMPO: formatBlindDuration(current.startedAt),
    },
    okLabel: 'ENVIAR PARA APROVAÇÃO',
    okStyle: 'accent',
  });
  if (!ok) return;
  current.endedAt = new Date().toISOString();
  current.status = 'pending_review';
  current.invoiceBarcode = current.invoiceBarcodes.join(' | ');
  current.durationSeconds = Math.max(0, Math.floor((Date.parse(current.endedAt) - Date.parse(current.startedAt)) / 1000));
  current.updatedAt = current.endedAt;
  current.expectedManifest = deepClone(blindExpectedManifest);
  logHistory('📥', 'Descarga encerrada para aprovação', `NF ${current.invoiceBarcode} · ${summary.lines} linha(s) · ${summary.totalKg.toFixed(3)} kg`, { type: 'entrada' });
  setActiveBlindUnload(null);
  blindCountPool = [];
  blindCountSelected = { depotId: null, drawerKey: null };
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir descarga finalizada:', err));
  renderAll();
  showToast('Descarga enviada para aprovação.', 'success');
  showPage('unloads');
}

function getBlindRecordsVisibleToCurrentUser() {
  if (canReviewBlindUnloads()) return blindCountRecords;
  const key = getBlindCurrentUserKey();
  return blindCountRecords.filter(record => record.createdByKey === key);
}

function getBlindStatusLabel(status) {
  return status === 'pending_review' ? 'PENDENTE APROVAÇÃO'
    : status === 'rejected' ? 'REPROVADA'
    : status === 'approved' ? 'APROVADA'
    : status === 'in_progress' ? 'EM DESCARGA'
    : status === 'cancelled' ? 'CANCELADA'
    : status === 'auto_cancelled' ? 'AUTO-CANCELADA'
    : (status || '—').toUpperCase();
}

function getUnloadRecordDepotIds(record) {
  const ids = new Set();
  if (record?.depotId) ids.add(record.depotId);
  (record?.items || []).forEach(item => {
    [
      item.targetDepotId,
      item.fromDepotId,
      item.approvedDepotId,
      item.sourceDepotId,
      item.depotId,
    ].filter(Boolean).forEach(id => ids.add(id));
  });
  return Array.from(ids);
}

async function evaluateBlindUnloadDeadlines() {
  const now = Date.now();
  let changed = false;
  for (const record of blindCountRecords) {
    if (record.status !== 'in_progress') continue;
    const started = Date.parse(record.startedAt || record.createdAt || new Date().toISOString());
    const elapsedHours = (now - started) / 3600000;
    if (elapsedHours >= 5) {
      record.status = 'auto_cancelled';
      record.cancelledAt = new Date().toISOString();
      record.endedAt = record.cancelledAt;
      record.updatedAt = record.cancelledAt;
      record.cancellationReason = 'Auto-cancelada após 5 horas em aberto';
      if (activeBlindUnloadId === record.id) setActiveBlindUnload(null);
      changed = true;
      logHistory('⏱', 'Descarga auto-cancelada', `NF ${record.invoiceBarcode || 'sem NF'} · ultrapassou 5 horas em aberto`, { type: 'entrada' });
      continue;
    }
    if (elapsedHours >= 4 && !record.overdueAlertedAt) {
      record.overdueAlertedAt = new Date().toISOString();
      changed = true;
      if (activeBlindUnloadId === record.id) {
        await showNotice({
          title: 'DESCARGA ACIMA DE 4 HORAS',
          icon: '⚠',
          desc: 'Esta descarga está aberta há mais de 4 horas. Se continuar sem conclusão, será auto-cancelada ao atingir 5 horas.',
          summary: {
            NFS: record.invoiceBarcode || '—',
            PLACA: record.vehiclePlate || '—',
            TEMPO: formatBlindDuration(record.startedAt),
          },
        });
      }
    }
  }
  if (changed) renderAll();
}

function getBlindConditionLabel(condition) {
  return condition === 'damaged' ? 'AVARIADO'
    : condition === 'return' ? 'DEVOLVIDO'
    : 'NORMAL';
}

function buildBlindRecordItemCards(items = [], options = {}) {
  const editable = Boolean(options.editable);
  return items.map(item => {
    const depotLabel = getDepotById(item.targetDepotId)?.name || item.targetDepotId || '—';
    const conditionLabel = getBlindConditionLabel(item.condition);
    const conditionTone = item.condition === 'damaged'
      ? 'color:var(--danger);border-color:rgba(217,4,41,.35);background:rgba(217,4,41,.08)'
      : item.condition === 'return'
        ? 'color:#8a5a00;border-color:rgba(216,178,0,.45);background:rgba(216,178,0,.09)'
        : 'color:var(--accent2);border-color:rgba(0,84,255,.25);background:rgba(0,84,255,.06)';
    return `<div class="blind-record-item-card" style="border:1px solid var(--line);padding:12px 14px;background:#fff;display:grid;gap:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div>
          <div class="outbound-record-title">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')}</div>
          <div class="outbound-record-meta">${escapeHtml(depotLabel)} / ${escapeHtml(item.targetDrawerKey || '—')} · lote ${escapeHtml(item.lot || '—')} · validade ${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="mini-pill" style="${conditionTone}">${escapeHtml(conditionLabel)}</span>
          ${editable ? `<button class="btn btn-accent" onclick="editBlindAllocatedItem('${escapeJs(item.id)}')">EDITAR</button><button class="btn btn-danger" onclick="returnBlindAllocatedItemToPool('${escapeJs(item.id)}')">RETORNAR À POOL</button>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
        <div class="confirm-sum-row"><span class="confirm-sum-label">QUANTIDADE</span><span class="confirm-sum-val">${item.qty.toFixed(3)} ${escapeHtml(item.unit || 'un')}</span></div>
        <div class="confirm-sum-row"><span class="confirm-sum-label">KG</span><span class="confirm-sum-val">${item.kgTotal.toFixed(3)} kg</span></div>
        <div class="confirm-sum-row"><span class="confirm-sum-label">CONFERIDO POR</span><span class="confirm-sum-val">${escapeHtml(item.checkedBy || '—')}</span></div>
        <div class="confirm-sum-row"><span class="confirm-sum-label">LOCALIZAÇÃO</span><span class="confirm-sum-val">${escapeHtml(item.targetDrawerKey || '—')}</span></div>
      </div>
      ${item.damagePhoto ? `<div class="blind-photo-preview" style="justify-content:flex-start"><img src="${escapeAttr(item.damagePhoto)}" alt="Foto da avaria"></div>` : ''}
      ${item.note || item.notes ? `<div class="outbound-record-meta">Observações: ${escapeHtml([item.notes, item.note].filter(Boolean).join(' · '))}</div>` : ''}
    </div>`;
  }).join('');
}

function blindRecordCanEdit(record) {
  if (!record) return false;
  const own = record.createdByKey === getBlindCurrentUserKey();
  if (record.status === 'approved') return canEditApprovedBlindUnloads();
  if (record.status === 'pending_review' || record.status === 'rejected') {
    return own || canEditAllPendingBlindUnloads();
  }
  return false;
}

function clearUnloadReviewFilters() {
  clearFilterBar('unload-review-filter-bar', renderUnloadReviewPage);
  return;
  const search = document.getElementById('unload-review-search');
  const status = document.getElementById('unload-review-status');
  const condition = document.getElementById('unload-review-condition');
  if (search) search.value = '';
  if (status) status.value = '';
  if (condition) condition.value = '';
  renderUnloadReviewPage();
}

function getFilteredUnloadReviewRows() {
  const scopeDepotId = getDepotTabsContextId();
  const search = (document.getElementById('unload-review-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('unload-review-status')?.value || '';
  const conditionFilter = document.getElementById('unload-review-condition')?.value || '';
  return blindCountRecords
    .filter(record => scopeDepotId === ALL_DEPOTS_VALUE || getUnloadRecordDepotIds(record).includes(scopeDepotId))
    .filter(record => ['pending_review', 'rejected'].includes(record.status))
    .filter(record => !statusFilter || record.status === statusFilter)
    .filter(record => {
      if (!conditionFilter) return true;
      const conditions = new Set((record.items || []).map(item => item.condition || 'normal'));
      if (conditionFilter === 'normal') return conditions.size === 1 && conditions.has('normal');
      return conditions.has(conditionFilter);
    })
    .filter(record => {
      if (!search) return true;
      const haystack = [
        record.invoiceBarcode,
        ...(record.invoiceBarcodes || []),
        record.vehiclePlate,
        record.createdBy,
        record.rejectedBy,
        record.rejectionReason,
        ...(record.items || []).flatMap(item => [
          item.code,
          item.name,
          item.targetDrawerKey,
          getDepotById(item.targetDepotId)?.name || item.targetDepotId,
          item.checkedBy,
          item.reference,
          item.supplier,
          item.lot,
        ]),
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
}

function renderUnloadReviewKpis(rows = []) {
  const kpiEl = document.getElementById('unload-review-kpis');
  if (!kpiEl) return;
  const pending = rows.filter(record => record.status === 'pending_review');
  const rejected = rows.filter(record => record.status === 'rejected');
  const totalKg = rows.reduce((sum, record) => sum + (record.items || []).reduce((acc, item) => acc + (parseFloat(item.kgTotal ?? item.kg) || 0), 0), 0);
  const damagedKg = rows.reduce((sum, record) => sum + (record.items || []).filter(item => item.condition === 'damaged').reduce((acc, item) => acc + (parseFloat(item.kgTotal ?? item.kg) || 0), 0), 0);
  const uniqueProducts = new Set(rows.flatMap(record => (record.items || []).map(item => item.code))).size;
  kpiEl.innerHTML = [
    ['Pendentes', String(pending.length), 'Aguardando decisão do revisor.'],
    ['Reprovadas', String(rejected.length), 'Precisam de ajuste antes de nova aprovação.'],
    ['Produtos', String(uniqueProducts), 'SKUs envolvidos nas descargas filtradas.'],
    ['Kg em análise', totalKg.toFixed(3), `Avariados: ${damagedKg.toFixed(3)} kg`],
  ].map(([label, value, note]) => `<div class="review-kpi-card"><div class="review-kpi-label">${escapeHtml(label)}</div><div class="review-kpi-value">${escapeHtml(value)}</div><div class="review-kpi-note">${escapeHtml(note)}</div></div>`).join('');
}

function buildBlindReviewItemCards(items = []) {
  return items.map(item => {
    const depotLabel = getDepotById(item.targetDepotId)?.name || item.targetDepotId || '—';
    const condition = item.condition || 'normal';
    const pillClass = condition === 'damaged' ? 'rejected' : condition === 'return' ? '' : 'pending';
    return `<article class="review-item-card">
      <div class="review-item-head">
        <div>
          <div class="review-item-title">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')}</div>
          <div class="review-item-meta">${escapeHtml(depotLabel)} · ${escapeHtml(item.targetDrawerKey || '—')} · lote ${escapeHtml(item.lot || '—')} · validade ${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')}</div>
        </div>
        <span class="review-status-pill ${pillClass}">${escapeHtml(getBlindConditionLabel(condition))}</span>
      </div>
      <div class="review-item-grid">
        <div class="review-item-cell"><div class="review-item-cell-label">Quantidade</div><div class="review-item-cell-value">${(parseFloat(item.qty || 0) || 0).toFixed(3)} ${escapeHtml(item.unit || 'un')}</div></div>
        <div class="review-item-cell"><div class="review-item-cell-label">Kg</div><div class="review-item-cell-value">${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg</div></div>
        <div class="review-item-cell"><div class="review-item-cell-label">Conferido por</div><div class="review-item-cell-value">${escapeHtml(item.checkedBy || '—')}</div></div>
        <div class="review-item-cell"><div class="review-item-cell-label">Referência</div><div class="review-item-cell-value">${escapeHtml(item.reference || '—')}</div></div>
      </div>
      ${item.note || item.notes ? `<div class="review-warning">Observações: ${escapeHtml([item.notes, item.note].filter(Boolean).join(' · '))}</div>` : ''}
    </article>`;
  }).join('');
}

function buildBlindReviewRecordCard(record, mode = 'pending') {
  const totalKg = (record.items || []).reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
  const totalQty = (record.items || []).reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
  const damagedKg = (record.items || []).filter(item => item.condition === 'damaged').reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
  const uniqueProducts = new Set((record.items || []).map(item => item.code)).size;
  const canEdit = blindRecordCanEdit(record);
  const badgeClass = record.status === 'rejected' ? 'rejected' : 'pending';
  const sectionClass = record.status === 'rejected' ? 'rejected' : 'pending';
  return `<article class="review-record-card ${sectionClass}">
    <div class="review-record-head">
      <div>
        <div class="review-record-topline">
          <div class="review-record-title">NF ${escapeHtml(record.invoiceBarcode || '—')} · placa ${escapeHtml(record.vehiclePlate || '—')}</div>
          <span class="review-status-pill ${badgeClass}">${escapeHtml(getBlindStatusLabel(record.status))}</span>
        </div>
        <div class="review-record-subtitle">Criada em ${escapeHtml(fmtDateTime(record.createdAt))} · conferente ${escapeHtml(record.createdBy || '—')} · tempo ${escapeHtml(formatBlindDuration(record.startedAt, record.endedAt))}</div>
      </div>
      <div class="review-record-actions">
        ${canEdit ? `<button class="btn" onclick="loadBlindRecordIntoDraft('${escapeJs(record.id)}')">EDITAR</button>` : ''}
        ${mode === 'pending' ? `<button class="btn btn-danger" onclick="rejectBlindRecord('${escapeJs(record.id)}')">REPROVAR</button><button class="btn btn-accent" onclick="approveBlindRecord('${escapeJs(record.id)}')">APROVAR</button>` : ''}
      </div>
    </div>
    <div class="review-summary-grid">
      <div class="review-summary-cell"><div class="review-summary-label">Notas fiscais</div><div class="review-summary-value">${escapeHtml((record.invoiceBarcodes || []).join(', ') || record.invoiceBarcode || '—')}</div></div>
      <div class="review-summary-cell"><div class="review-summary-label">Linhas / produtos</div><div class="review-summary-value">${String((record.items || []).length)} linhas · ${String(uniqueProducts)} SKUs</div></div>
      <div class="review-summary-cell"><div class="review-summary-label">Quantidade / kg</div><div class="review-summary-value">${totalQty.toFixed(3)} un · ${totalKg.toFixed(3)} kg</div></div>
      <div class="review-summary-cell"><div class="review-summary-label">Avariados</div><div class="review-summary-value">${damagedKg.toFixed(3)} kg</div></div>
    </div>
    ${record.rejectionReason ? `<div class="review-warning">Motivo da reprovação: ${escapeHtml(record.rejectionReason)}</div>` : ''}
    <div class="review-items-grid">${buildBlindReviewItemCards(record.items || [])}</div>
  </article>`;
}

function loadBlindRecordIntoDraft(recordId) {
  const record = blindCountRecords.find(item => item.id === recordId);
  if (!blindRecordCanEdit(record)) return;
  setActiveBlindUnload(record.id);
  blindPendingInvoiceBarcodes = Array.isArray(record.invoiceBarcodes) && record.invoiceBarcodes.length
    ? deepClone(record.invoiceBarcodes)
    : (record.invoiceBarcode ? record.invoiceBarcode.split('|').map(item => sanitizeTextInput(item, { maxLength: 120, uppercase: true })).filter(Boolean) : []);
  blindPendingVehiclePlate = record.vehiclePlate || '';
  blindCountPool = [];
  blindCountSelected = { depotId: null, drawerKey: null };
  persistBlindUnloadsState().catch(err => console.error('Falha ao restaurar descarga na conferência:', err));
  renderAll();
  showPage('unloads');
}

function clearUnloadFilters() {
  clearFilterBar('unloads-filter-bar', renderUnloadsPage);
  return;
  const search = document.getElementById('unloads-filter-search');
  const status = document.getElementById('unloads-filter-status');
  const condition = document.getElementById('unloads-filter-condition');
  if (search) search.value = '';
  if (status) status.value = '';
  if (condition) condition.value = '';
  renderUnloadsPage();
}

function getFilteredUnloadRows() {
  const scopeDepotId = getDepotTabsContextId();
  const rows = getBlindRecordsVisibleToCurrentUser().filter(record => scopeDepotId === ALL_DEPOTS_VALUE || getUnloadRecordDepotIds(record).includes(scopeDepotId));
  const search = (document.getElementById('unloads-filter-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('unloads-filter-status')?.value || '';
  const condition = document.getElementById('unloads-filter-condition')?.value || '';
  return rows.filter(record => {
    if (status && record.status !== status) return false;
    if (condition) {
      const conditions = new Set((record.items || []).map(item => item.condition || 'normal'));
      if (condition === 'normal' && !(conditions.size === 1 && conditions.has('normal'))) return false;
      if (condition !== 'normal' && !conditions.has(condition)) return false;
    }
    if (!search) return true;
    const haystack = [
      record.invoiceBarcode,
      ...(record.invoiceBarcodes || []),
      record.vehiclePlate,
      record.createdBy,
      record.rejectionReason,
      ...(record.items || []).flatMap(item => [
        item.code,
        item.name,
        item.lot,
        item.reference,
        item.supplier,
        item.targetDrawerKey,
        getDepotById(item.targetDepotId)?.name || item.targetDepotId,
      ]),
    ].join(' ').toLowerCase();
    return haystack.includes(search);
  });
}

function renderUnloadsKpis(rows = []) {
  const el = document.getElementById('unloads-kpis');
  const resultEl = document.getElementById('unloads-filter-result');
  if (!el) return;
  const totalKg = rows.reduce((sum, record) => sum + (record.items || []).reduce((acc, item) => acc + (parseFloat(item.kgTotal ?? item.kg) || 0), 0), 0);
  const pending = rows.filter(record => ['in_progress', 'pending_review', 'rejected'].includes(record.status)).length;
  const approved = rows.filter(record => record.status === 'approved').length;
  const damaged = rows.reduce((sum, record) => sum + (record.items || []).filter(item => item.condition === 'damaged').reduce((acc, item) => acc + (parseFloat(item.kgTotal ?? item.kg) || 0), 0), 0);
  el.innerHTML = [
    ['Descargas', String(rows.length), 'Registros visíveis com o filtro atual.'],
    ['Pendências', String(pending), 'Em andamento, pendentes ou reprovadas.'],
    ['Aprovadas', String(approved), 'Entradas já liberadas para o estoque.'],
    ['Kg em fluxo', totalKg.toFixed(3), `Avariados: ${damaged.toFixed(3)} kg`],
  ].map(([label, value, note]) => `<div class="review-kpi-card"><div class="review-kpi-label">${escapeHtml(label)}</div><div class="review-kpi-value">${escapeHtml(value)}</div><div class="review-kpi-note">${escapeHtml(note)}</div></div>`).join('');
  if (resultEl) resultEl.textContent = `${rows.length} descarga(s) encontradas`;
}

function buildUnloadItemLines(items = []) {
  return items.map(item => {
    const depotLabel = getDepotById(item.targetDepotId)?.name || item.targetDepotId || '—';
    const conditionLabel = getBlindConditionLabel(item.condition || 'normal');
    const pillClass = item.condition === 'damaged' ? 'rejected' : item.condition === 'return' ? '' : 'pending';
    return `<div class="unload-line">
      <div class="unload-line-head">
        <div>
          <div class="unload-line-title">${escapeHtml(item.code)} — ${escapeHtml(item.name || '')}</div>
          <div class="unload-line-meta">${escapeHtml(depotLabel)} · ${escapeHtml(item.targetDrawerKey || '—')} · lote ${escapeHtml(item.lot || '—')} · validade ${escapeHtml(item.expiries?.[0] ? fmtDate(item.expiries[0]) : '—')}</div>
        </div>
        <span class="review-status-pill ${pillClass}">${escapeHtml(conditionLabel)}</span>
      </div>
      <div class="unload-line-grid">
        <div class="unload-record-cell"><div class="unload-record-cell-label">Quantidade</div><div class="unload-record-cell-value">${(parseFloat(item.qty || 0) || 0).toFixed(3)} ${escapeHtml(item.unit || 'un')}</div></div>
        <div class="unload-record-cell"><div class="unload-record-cell-label">Kg</div><div class="unload-record-cell-value">${(parseFloat(item.kgTotal ?? item.kg) || 0).toFixed(3)} kg</div></div>
        <div class="unload-record-cell"><div class="unload-record-cell-label">Conferido por</div><div class="unload-record-cell-value">${escapeHtml(item.checkedBy || '—')}</div></div>
        <div class="unload-record-cell"><div class="unload-record-cell-label">Referência</div><div class="unload-record-cell-value">${escapeHtml(item.reference || '—')}</div></div>
      </div>
    </div>`;
  }).join('');
}

function renderUnloadsPage() {
  const listEl = document.getElementById('unloads-list');
  if (!listEl) return;
  const filtered = getFilteredUnloadRows();
  renderUnloadsKpis(filtered);
  if (!filtered.length) {
    listEl.innerHTML = '<div class="review-empty">Nenhuma descarga encontrada com os filtros atuais.</div>';
    return;
  }
  listEl.innerHTML = filtered.map(record => {
    const items = Array.isArray(record.items) ? record.items : [];
    const totalKg = items.reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
    const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) || 0), 0);
    const totalProducts = new Set(items.map(item => item.code)).size;
    const damagedKg = items.filter(item => item.condition === 'damaged').reduce((sum, item) => sum + (parseFloat(item.kgTotal ?? item.kg) || 0), 0);
    const canEdit = blindRecordCanEdit(record);
    const canOpen = record.status !== 'approved' && record.status !== 'cancelled' && record.status !== 'auto_cancelled';
    const badgeClass = record.status === 'approved' ? 'pending' : record.status === 'rejected' || record.status === 'cancelled' || record.status === 'auto_cancelled' ? 'rejected' : '';
    return `<article class="unload-record-card ${escapeAttr(record.status)}">
      <div class="unload-record-head">
        <div>
          <div class="unload-record-topline">
            <div class="unload-record-title">NF ${escapeHtml(record.invoiceBarcode || '—')} · placa ${escapeHtml(record.vehiclePlate || '—')}</div>
            <span class="review-status-pill ${badgeClass}">${escapeHtml(getBlindStatusLabel(record.status))}</span>
          </div>
          <div class="unload-record-meta">Criada em ${escapeHtml(fmtDateTime(record.createdAt))} · por ${escapeHtml(record.createdBy || '—')} · tempo ${escapeHtml(formatBlindDuration(record.startedAt, record.endedAt))}</div>
          ${record.rejectionReason ? `<div class="review-warning" style="margin-top:8px">Motivo da reprovação: ${escapeHtml(record.rejectionReason)}</div>` : ''}
          ${record.cancellationReason ? `<div class="review-warning" style="margin-top:8px">Cancelamento: ${escapeHtml(record.cancellationReason)}</div>` : ''}
        </div>
        <div class="unload-record-actions">
          ${canOpen ? `<button class="btn btn-accent" onclick="loadBlindRecordIntoDraft('${escapeJs(record.id)}')">ABRIR NA CONFERÊNCIA</button>` : ''}
          ${canEdit && !canOpen ? `<button class="btn btn-accent" onclick="loadBlindRecordIntoDraft('${escapeJs(record.id)}')">EDITAR</button>` : ''}
        </div>
      </div>
      <div class="unload-record-summary">
        <div class="unload-record-cell"><div class="unload-record-cell-label">Notas fiscais</div><div class="unload-record-cell-value">${escapeHtml((record.invoiceBarcodes || []).join(', ') || record.invoiceBarcode || '—')}</div></div>
        <div class="unload-record-cell"><div class="unload-record-cell-label">Linhas / produtos</div><div class="unload-record-cell-value">${items.length} linhas · ${totalProducts} SKUs</div></div>
        <div class="unload-record-cell"><div class="unload-record-cell-label">Quantidade / kg</div><div class="unload-record-cell-value">${totalQty.toFixed(3)} un · ${totalKg.toFixed(3)} kg</div></div>
        <div class="unload-record-cell"><div class="unload-record-cell-label">Avariados</div><div class="unload-record-cell-value">${damagedKg.toFixed(3)} kg</div></div>
      </div>
      <div class="unload-record-lines">${buildUnloadItemLines(items)}</div>
    </article>`;
  }).join('');
}

function findSpecialDrawerForKg(depotId, shelfType, requiredKg) {
  const candidates = [];
  (shelvesAll[depotId] || []).filter(shelf => normalizeShelfType(shelf.type) === shelfType).forEach(shelf => {
    for (let floor = 1; floor <= shelf.floors; floor++) {
      for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
        const key = drawerKey(shelf.id, floor, drawer);
        const validation = validateDrawerPlacement({ depotId, drawerKeyValue: key, incomingKg: requiredKg });
        if (validation.ok) candidates.push({ shelf, key });
      }
    }
  });
  return candidates[0] || null;
}

function applyApprovedBlindRecordToStock(record) {
  for (const item of record.items || []) {
    let targetDepotId = item.targetDepotId;
    let targetDrawerKey = item.targetDrawerKey;
    if (item.condition === 'damaged') {
      const blockedTarget = findSpecialDrawerForKg(item.targetDepotId, 'blocked', parseFloat(item.kgTotal ?? item.kg) || 0);
      if (!blockedTarget) throw new Error(`Não existe gaveta de bloqueio disponível para ${item.code} no depósito ${getDepotById(item.targetDepotId)?.name || item.targetDepotId}.`);
      targetDepotId = item.targetDepotId;
      targetDrawerKey = blockedTarget.key;
    } else {
      const validation = validateDrawerPlacement({ depotId: targetDepotId, drawerKeyValue: targetDrawerKey, incomingKg: parseFloat(item.kgTotal ?? item.kg) || 0 });
      if (!validation.ok) throw new Error(validation.detail);
    }
    if (!productsAll[targetDepotId]) productsAll[targetDepotId] = {};
    if (!productsAll[targetDepotId][targetDrawerKey]) productsAll[targetDepotId][targetDrawerKey] = [];
    productsAll[targetDepotId][targetDrawerKey].push({
      code: item.code,
      name: item.name,
      unit: item.unit || 'un',
      qty: item.qty,
      kgPerUnit: item.kgPerUnit,
      kg: item.kgTotal,
      kgTotal: item.kgTotal,
      lot: item.lot || '',
      entry: item.entry || new Date().toISOString().slice(0, 10),
      expiries: deepClone(item.expiries || []),
      supplier: item.supplier || '',
      reference: item.reference || '',
      notes: [item.notes, item.note, item.condition === 'return' ? 'DEVOLVIDO' : '', item.condition === 'damaged' ? 'AVARIADO/BLOQUEADO' : ''].filter(Boolean).join(' · '),
    });
    item.approvedDrawerKey = targetDrawerKey;
  }
}

async function approveBlindRecord(recordId) {
  const record = blindCountRecords.find(item => item.id === recordId);
  if (!record || !canReviewBlindUnloads()) return;
  try {
    applyApprovedBlindRecordToStock(record);
  } catch (err) {
    await showNotice({ title: 'APROVAÇÃO BLOQUEADA', icon: '⛔', desc: err.message || 'Falha ao aplicar a descarga no estoque.' });
    return;
  }
  record.status = 'approved';
  record.approvedAt = new Date().toISOString();
  record.approvedBy = getCurrentUserLabel();
  logHistory('✅', 'Descarga aprovada', `NF ${record.invoiceBarcode} · ${(record.items || []).length} linha(s)`, { type: 'entrada' });
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir aprovação de descarga:', err));
  showToast(`Descarga ${record.invoiceBarcode || record.id} aprovada.`, 'success');
  renderAll();
}

async function rejectBlindRecord(recordId) {
  const record = blindCountRecords.find(item => item.id === recordId);
  if (!record || !canReviewBlindUnloads()) return;
  const reason = await showTextPrompt({
    title: 'REPROVAR DESCARGA',
    label: 'MOTIVO',
    placeholder: 'Diferença na nota, avaria sem tratamento, item não confere...',
    okLabel: 'REPROVAR',
    maxLength: 180,
  });
  if (reason === null) return;
  const cleanReason = sanitizeTextInput(reason, { maxLength: 180 });
  if (!cleanReason) {
    await showNotice({ title: 'MOTIVO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o motivo da reprovação.' });
    return;
  }
  record.status = 'rejected';
  record.rejectionReason = cleanReason;
  record.rejectedAt = new Date().toISOString();
  record.rejectedBy = getCurrentUserLabel();
  record.rejectionSeenAt = null;
  logHistory('⛔', 'Descarga reprovada', `NF ${record.invoiceBarcode} · motivo ${cleanReason}`, { type: 'entrada' });
  persistBlindUnloadsState().catch(err => console.error('Falha ao persistir reprovação de descarga:', err));
  showToast(`Descarga ${record.invoiceBarcode || record.id} reprovada.`, 'error');
  renderAll();
}

function renderUnloadReviewPage() {
  const kpiEl = document.getElementById('unload-review-kpis');
  const listEl = document.getElementById('unload-review-list');
  if (!listEl || !kpiEl) return;
  if (!canReviewBlindUnloads()) {
    kpiEl.innerHTML = '';
    listEl.innerHTML = '<div class="empty-msg">Seu perfil não pode revisar descargas.</div>';
    return;
  }
  const rows = getFilteredUnloadReviewRows();
  renderUnloadReviewKpis(rows);
  const pendingRows = rows.filter(record => record.status === 'pending_review');
  const rejectedRows = rows.filter(record => record.status === 'rejected');
  if (!pendingRows.length && !rejectedRows.length) {
    listEl.innerHTML = '<div class="review-empty">Nenhuma descarga encontrada com os filtros atuais.</div>';
    return;
  }
  listEl.innerHTML = `
    ${pendingRows.length ? `<section class="review-section"><div class="review-section-head"><div class="review-section-title">Pendentes de aprovação</div><div class="review-section-count">${pendingRows.length} descarga(s)</div></div><div class="review-section-list">${pendingRows.map(record => buildBlindReviewRecordCard(record, 'pending')).join('')}</div></section>` : ''}
    ${rejectedRows.length ? `<section class="review-section"><div class="review-section-head"><div class="review-section-title">Reprovadas em ajuste</div><div class="review-section-count">${rejectedRows.length} descarga(s)</div></div><div class="review-section-list">${rejectedRows.map(record => buildBlindReviewRecordCard(record, 'rejected')).join('')}</div></section>` : ''}
  `;
}

async function notifyBlindRejectionsForCurrentUser() {
  const ownRejected = blindCountRecords.find(record => record.status === 'rejected' && record.createdByKey === getBlindCurrentUserKey() && !record.rejectionSeenAt);
  if (!ownRejected) return;
  ownRejected.rejectionSeenAt = new Date().toISOString();
  await showNotice({
    title: 'DESCARGA REPROVADA',
    icon: '⛔',
    desc: `A descarga da NF ${ownRejected.invoiceBarcode || 'sem NF'} foi reprovada. Abra a página DESCARGAS para editar e reenviar.`,
    summary: {
      MOTIVO: ownRejected.rejectionReason || '—',
      PLACA: ownRejected.vehiclePlate || '—',
    },
  });
}

