// ═══════════════════════════════════════════════════════════
// MODULE: qr.js
// ═══════════════════════════════════════════════════════════

// QR Constants
const QR_PREFIX = 'WMSQR1';
const ALL_DEPOTS_VALUE = '__ALL__'; // Constant for representing all depots

// QR Workflow State
let qrWorkflow = { depotId: null, shelfId: null, drawerKey: null, productCode: null, locationDrawerKey: null, payload: null };

// QR Scanner State
let qrVideoStream = null;
let qrScanTimer = null;

// QR Generator State
let qrProductCatalogCache = null; // Cache for product catalog used in QR generator

// Helper Functions for QR Module

// Builds the payload string for different QR code types
function buildQrPayloadForType(type, { depotId = '', shelfId = '', drawerKey = '', productCode = '' } = {}) {
  if (type === 'depot') return `${QR_PREFIX}|DEPOT|${depotId}`;
  if (type === 'shelf') return `${QR_PREFIX}|SHELF|${depotId}|${shelfId}`;
  if (type === 'drawer') return `${QR_PREFIX}|DRAWER|${depotId}|${drawerKey}`;
  if (type === 'product') return `${QR_PREFIX}|PRODUCT|${productCode}`;
  return `${QR_PREFIX}|LOCATION|${depotId}|${drawerKey}|${productCode}`;
}

// Builds the QR payload based on current generator selections
function buildQrPayload() {
  const type = document.getElementById('qr-gen-type')?.value || 'depot';
  const depotValue = document.getElementById('qr-gen-depot')?.value || activeDepotId;
  const shelfValue = document.getElementById('qr-gen-shelf')?.value || '';
  const drawerValueRaw = document.getElementById('qr-gen-drawer')?.value || '';
  const productCode = document.getElementById('qr-gen-product')?.value || '';

  const shelfDepotId = shelfValue.includes('::') ? shelfValue.split('::')[0] : depotValue;
  const shelfId = shelfValue.includes('::') ? shelfValue.split('::')[1] : shelfValue;

  const drawerDepotId = drawerValueRaw.includes('::') ? drawerValueRaw.split('::')[0] : shelfDepotId;
  const drawerValue = drawerValueRaw.includes('::') ? drawerValueRaw.split('::')[1] : drawerValueRaw;

  const depotId = type === 'product' ? '' : (drawerDepotId || shelfDepotId || depotValue);
  return buildQrPayloadForType(type, { depotId, shelfId, drawerKey: drawerValue, productCode });
}

// Parses a QR payload string into its components
function parseQrPayload(text) {
  const raw = sanitizeTextInput(text, { maxLength: 400 });
  const parts = raw.split('|');
  if (parts[0] !== QR_PREFIX) throw new Error('Payload QR inválido para este WMS.');
  const type = parts[1];
  if (type === 'DEPOT') return { type: 'depot', depotId: parts[2] };
  if (type === 'SHELF') return { type: 'shelf', depotId: parts[2], shelfId: parts[3] };
  if (type === 'DRAWER') return { type: 'drawer', depotId: parts[2], drawerKey: parts[3] };
  if (type === 'PRODUCT') return { type: 'product', productCode: parts[2] };
  if (type === 'LOCATION') return { type: 'location', depotId: parts[2], drawerKey: parts[3], productCode: parts[4] || null };
  throw new Error('Tipo de QR não reconhecido.');
}

// Initializes the QR page UI elements
function renderQrPage() {
  const userBadge = document.getElementById('qr-user-badge');
  if (userBadge) userBadge.textContent = `Usuário: ${getCurrentUserLabel()}`; // Assuming getCurrentUserLabel() is available globally
  populateQrSelectors();
  renderQrProductLookup();
  renderQrGenerator();
  renderQrWorkflow();
}

// Fetches and filters product catalog for QR generator and form selectors
function getQrProductCatalog() {
  if (qrProductCatalogCache) return qrProductCatalogCache;

  const map = new Map();
  Object.entries(productsAll || {}).forEach(([depotId, productMap]) => {
    Object.entries(productMap || {}).forEach(([drawer, items]) => {
      (items || []).forEach(product => {
        if (!product?.code) return;
        const key = product.code;
        if (!map.has(key)) {
          map.set(key, {
            code: product.code, name: product.name || '', unit: product.unit || 'un',
            lot: product.lot || '', brand: product.brand || '', category: product.category || '',
            qty: 0, kg: 0, depots: new Set(), drawers: new Set(), product,
          });
        }
        const rec = map.get(key);
        rec.qty++;
        rec.kg += parseFloat(product.kgTotal ?? product.kg) || 0;
        rec.depots.add(depotId);
        rec.drawers.add(drawer);
        if (!rec.name && product.name) rec.name = product.name;
        if (!rec.brand && product.brand) rec.brand = product.brand;
        if (!rec.family && product.family) rec.family = product.family;
        if (!rec.category && product.category) rec.category = product.category;
        if (!rec.lot && product.lot) rec.lot = product.lot;
        if (!rec.unit && product.unit) rec.unit = product.unit;
        rec.product = { ...rec.product, ...product }; // Merge to keep latest details
      });
    });
  });
  qrProductCatalogCache = [...map.values()]
    .map(item => ({ ...item, depots: [...item.depots], drawers: [...item.drawers] }))
    .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  return qrProductCatalogCache;
}

// Populates dropdown selectors for QR generator and form
function populateQrSelectors() {
  const buildDepotOptionsHtml = ({ includeAll = false, selected = '' } = {}) => {
    const options = [];
    if (includeAll) options.push(`<option value="${ALL_DEPOTS_VALUE}" ${selected === ALL_DEPOTS_VALUE ? 'selected' : ''}>Todos os depósitos</option>`);
    depots.forEach(depot => {
      options.push(`<option value="${depot.id}" ${selected === depot.id ? 'selected' : ''}>${escapeHtml(depot.name)}</option>`);
    });
    return options.join('');
  };

  const genDepot = document.getElementById('qr-gen-depot');
  const formDepot = document.getElementById('qr-form-depot');
  if (genDepot) genDepot.innerHTML = buildDepotOptionsHtml({ includeAll: true, selected: genDepot.value || ALL_DEPOTS_VALUE });
  if (formDepot) formDepot.innerHTML = buildDepotOptionsHtml({ selected: formDepot.value || qrWorkflow.depotId || activeDepotId });
  if (genDepot && !genDepot.value) genDepot.value = ALL_DEPOTS_VALUE;
  if (formDepot && !formDepot.value) formDepot.value = qrWorkflow.depotId || activeDepotId;

  const genDepotId = genDepot?.value || ALL_DEPOTS_VALUE;
  const formDepotId = formDepot?.value || activeDepotId;

  const genShelves = genDepotId === ALL_DEPOTS_VALUE
    ? depots.flatMap(depot => (shelvesAll[depot.id] || []).map(shelf => ({ ...shelf, depotId: depot.id })))
    : (shelvesAll[genDepotId] || []).map(shelf => ({ ...shelf, depotId: genDepotId }));
  const formShelves = shelvesAll[formDepotId] || [];

  const genShelf = document.getElementById('qr-gen-shelf');
  const formShelf = document.getElementById('qr-form-shelf');
  if (genShelf) genShelf.innerHTML = genShelves.map(s => {
    const value = genDepotId === ALL_DEPOTS_VALUE ? `${s.depotId}::${s.id}` : s.id;
    return `<option value="${value}">${escapeHtml(s.id)}${genDepotId === ALL_DEPOTS_VALUE ? ' · ' + escapeHtml(getDepotById(s.depotId)?.name || s.depotId) : ''}</option>`;
  }).join('');
  if (formShelf) formShelf.innerHTML = formShelves.map(s => `<option value="${s.id}">${s.id}</option>`).join('');

  if (qrWorkflow.shelfId && formShelf && formShelves.some(s => s.id === qrWorkflow.shelfId)) formShelf.value = qrWorkflow.shelfId;
  if (genShelf && !genShelf.value && genShelves[0]) genShelf.value = genDepotId === ALL_DEPOTS_VALUE ? `${genShelves[0].depotId}::${genShelves[0].id}` : genShelves[0].id;

  populateQrDrawerSelectors();
  populateQrProductSelectors();
}

function populateQrDrawerSelectors() {
  const buildDrawerOptions = (depotId, shelfId) => {
    const resolvedDepotId = depotId === ALL_DEPOTS_VALUE && shelfId.includes('::') ? shelfId.split('::')[0] : depotId;
    const resolvedShelfId = shelfId.includes('::') ? shelfId.split('::')[1] : shelfId;
    const shelf = (shelvesAll[resolvedDepotId] || []).find(s => s.id === resolvedShelfId);
    if (!shelf) return '';
    const options = [];
    for (let floor = 1; floor <= shelf.floors; floor++) {
      for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
        const key = drawerKey(shelf.id, floor, drawer);
        const value = resolvedDepotId === depotId ? key : `${resolvedDepotId}::${key}`;
        options.push(`<option value="${value}">${escapeHtml(key)}${depotId === ALL_DEPOTS_VALUE ? ' · ' + escapeHtml(getDepotById(resolvedDepotId)?.name || resolvedDepotId) : ''}</option>`);
      }
    }
    return options.join('');
  };
  const genDepotId = document.getElementById('qr-gen-depot')?.value || ALL_DEPOTS_VALUE;
  const genShelfId = document.getElementById('qr-gen-shelf')?.value || '';
  const formDepotId = document.getElementById('qr-form-depot')?.value || activeDepotId;
  const formShelfId = document.getElementById('qr-form-shelf')?.value || '';
  const genDrawer = document.getElementById('qr-gen-drawer');
  const formDrawer = document.getElementById('qr-form-drawer');
  if (genDrawer) genDrawer.innerHTML = buildDrawerOptions(genDepotId, genShelfId);
  if (formDrawer) formDrawer.innerHTML = buildDrawerOptions(formDepotId, formShelfId);
  if (qrWorkflow.drawerKey && formDrawer && [...formDrawer.options].some(opt => opt.value === qrWorkflow.drawerKey)) formDrawer.value = qrWorkflow.drawerKey;
}

function populateQrProductSelectors() {
  const search = (document.getElementById('qr-gen-product-search')?.value || '').trim().toLowerCase();
  const catalog = getQrProductCatalog().filter(item => {
    const hay = [item.code, item.name, item.brand, item.category, item.lot].join(' ').toLowerCase();
    return !search || hay.includes(search);
  });
  const genProduct = document.getElementById('qr-gen-product');
  if (genProduct) {
    genProduct.innerHTML = catalog.map(item => `<option value="${escapeAttr(item.code)}">${escapeHtml(item.code)} - ${escapeHtml(item.name || 'Sem nome')}</option>`).join('');
    if (qrWorkflow.productCode && catalog.some(item => item.code === qrWorkflow.productCode)) genProduct.value = qrWorkflow.productCode;
  }
}

function filterQrGeneratorProducts() {
  populateQrProductSelectors();
  renderQrGenerator();
}

function renderQrProductLookup() {
  const resultEl = document.getElementById('qr-form-product-results');
  if (!resultEl) return;
  const query = (document.getElementById('qr-form-product-search')?.value || '').trim().toLowerCase();
  const catalog = getQrProductCatalog().filter(item => {
    const hay = [item.code, item.name, item.brand, item.category, item.lot, ...item.depots].join(' ').toLowerCase();
    return !query || hay.includes(query);
  }).slice(0, 10);
  if (!catalog.length) {
    resultEl.innerHTML = '<div class="empty-msg" style="padding:10px 12px">Nenhum produto encontrado.</div>';
    return;
  }
  resultEl.innerHTML = catalog.map(item => {
    const meta = [
      item.qty > 0 ? `${item.qty} un` : null,
      item.kg  > 0 ? `${item.kg.toFixed(3)} kg` : null,
      item.brand || null,
      item.category || null,
      item.lot ? `lote ${item.lot}` : null,
      item.depots?.join(', ') || null,
    ].filter(Boolean).join(' · ');
    const active = qrWorkflow.productCode === item.code ? 'pli__item--focused' : '';
    return `<button type="button" class="pli__item ${active}" onclick="selectQrFormProduct('${escapeJs(item.code)}')">
      <span class="pli__code">${escapeHtml(item.code)}</span>
      <span class="pli__name">${escapeHtml(item.name || 'Sem nome')}</span>
      ${meta ? `<span class="pli__meta">${escapeHtml(meta)}</span>` : ''}
    </button>`;
  }).join('');
  resultEl.classList.add('pli--open');
}

function selectQrFormProduct(code) {
  qrWorkflow.productCode = code;
  const codeInput = document.getElementById('qr-form-code');
  if (codeInput) codeInput.value = code;
  const searchInput = document.getElementById('qr-form-product-search');
  const match = getQrProductCatalog().find(item => item.code === code);
  if (searchInput && match) searchInput.value = `${match.code} - ${match.name || ''}`;
  hydrateQrProductForm();
  renderQrProductLookup();
  renderQrWorkflow();
}

function renderQrGenerator() {
  populateQrSelectors();
  const payload = buildQrPayload();
  const payloadEl = document.getElementById('qr-payload');
  if (payloadEl) payloadEl.value = payload;
  const preview = document.getElementById('qr-code-preview');
  if (!preview) return;
  preview.innerHTML = '';
  if (window.QRCode) {
    new window.QRCode(preview, { text: payload, width: 220, height: 220 });
  } else {
    preview.textContent = 'Biblioteca QR indisponível.';
  }
}

function copyQrPayload() {
  const payload = document.getElementById('qr-payload')?.value || '';
  if (!payload) return;
  navigator.clipboard?.writeText(payload);
}

function downloadQrImage() {
  const img = document.querySelector('#qr-code-preview img') || document.querySelector('#qr-code-preview canvas');
  if (!img) return;
  const href = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
  const a = document.createElement('a');
  a.href = href;
  a.download = 'wms_qr.png';
  a.click();
}

function openEntityQrModal({ title, subtitle, type, depotId = '', shelfId = '', drawerKey = '', productCode = '' }) {
  const payload = buildQrPayloadForType(type, { depotId, shelfId, drawerKey, productCode });
  const titleEl = document.getElementById('entity-qr-title');
  const subtitleEl = document.getElementById('entity-qr-subtitle');
  const payloadEl = document.getElementById('entity-qr-payload');
  const preview = document.getElementById('entity-qr-preview');
  if (titleEl) titleEl.textContent = title || 'QR CODE';
  if (subtitleEl) subtitleEl.textContent = subtitle || '';
  if (payloadEl) payloadEl.value = payload;
  if (preview) {
    preview.innerHTML = '';
    if (window.QRCode) new window.QRCode(preview, { text: payload, width: 220, height: 220 });
    else preview.textContent = 'Biblioteca QR indisponível.';
  }
  document.getElementById('entity-qr-modal')?.classList.add('open');
}

function closeEntityQrModal() {
  document.getElementById('entity-qr-modal')?.classList.remove('open');
}

function copyEntityQrPayload() {
  const payload = document.getElementById('entity-qr-payload')?.value || '';
  if (payload) navigator.clipboard?.writeText(payload);
}

function downloadEntityQrImage() {
  const img = document.querySelector('#entity-qr-preview img') || document.querySelector('#entity-qr-preview canvas');
  if (!img) return;
  const href = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
  const a = document.createElement('a');
  a.href = href;
  a.download = 'wms_entity_qr.png';
  a.click();
}

function openDrawerQrModal() {
  if (!currentDrawerKey) return;
  const parsed = parseKey(currentDrawerKey);
  openEntityQrModal({
    title: `QR GAVETA ${currentDrawerKey}`,
    subtitle: parsed ? `${getDepotById(activeDepotId)?.name || activeDepotId} · Prateleira ${parsed.shelf} · Andar ${parsed.floor} · Gaveta ${parsed.drawer}` : currentDrawerKey,
    type: 'drawer',
    depotId: activeDepotId,
    drawerKey: currentDrawerKey,
  });
}

function openShelfQrModal() {
  if (!fpFocusedShelf) return;
  const depotId = fpFocusedDepotId || activeDepotId;
  const shelf = (shelvesAll[depotId] || []).find(item => item.id === fpFocusedShelf);
  openEntityQrModal({
    title: `QR PRATELEIRA ${fpFocusedShelf}`,
    subtitle: `${getDepotById(depotId)?.name || depotId}${shelf ? ` · ${shelf.floors} andares · ${shelf.drawers} gavetas` : ''}`,
    type: 'shelf',
    depotId,
    shelfId: fpFocusedShelf,
  });
}

function renderQrWorkflow() {
  const context = document.getElementById('qr-context');
  if (!context) return;
  const drawerParsed = qrWorkflow.drawerKey ? parseKey(qrWorkflow.drawerKey) : null;
  const values = [
    ['DEPÓSITO', getDepotById(qrWorkflow.depotId)?.name || qrWorkflow.depotId || '—'],
    ['ESTANTE', qrWorkflow.shelfId || drawerParsed?.shelf || '—'],
    ['GAVETA', qrWorkflow.drawerKey || '—'],
    ['PRODUTO', qrWorkflow.productCode || '—'],
    ['PAYLOAD', qrWorkflow.payload || '—'],
  ];
  context.innerHTML = values.map(([label, value]) => `<div class="qr-context-item"><span class="qr-context-label">${escapeHtml(label)}</span><span class="qr-context-value">${escapeHtml(value)}</span></div>`).join('');
}

function applyQrContext(data, rawPayload) {
  qrWorkflow.payload = rawPayload;
  if (data.depotId) qrWorkflow.depotId = data.depotId;
  if (data.shelfId) qrWorkflow.shelfId = data.shelfId;
  if (data.drawerKey) {
    qrWorkflow.drawerKey = data.drawerKey;
    qrWorkflow.locationDrawerKey = data.drawerKey;
    qrWorkflow.shelfId = parseKey(data.drawerKey)?.shelf || qrWorkflow.shelfId;
  }
  if (data.productCode) qrWorkflow.productCode = data.productCode;

  if (qrWorkflow.depotId) document.getElementById('qr-form-depot').value = qrWorkflow.depotId;
  populateQrSelectors();
  if (qrWorkflow.shelfId && document.getElementById('qr-form-shelf')) document.getElementById('qr-form-shelf').value = qrWorkflow.shelfId;
  populateQrDrawerSelectors();
  if (qrWorkflow.drawerKey && document.getElementById('qr-form-drawer')) document.getElementById('qr-form-drawer').value = qrWorkflow.drawerKey;
  if (qrWorkflow.productCode) document.getElementById('qr-form-code').value = qrWorkflow.productCode;
  hydrateQrProductForm();
  renderQrProductLookup();
  renderQrWorkflow();
}

function hydrateQrProductForm() {
  const code = sanitizeTextInput(document.getElementById('qr-form-code')?.value || qrWorkflow.productCode || '', { maxLength: 40, uppercase: true });
  if (!code) return;
  const all = Object.values(productsAll).flatMap(productMap => Object.values(productMap).flat());
  const match = all.find(product => product.code === code);
  if (!match) return;
  qrWorkflow.productCode = match.code;
  document.getElementById('qr-form-code').value = match.code;
  document.getElementById('qr-form-name').value = match.name || '';
  document.getElementById('qr-form-unit').value = match.unit || 'un';
  document.getElementById('qr-form-lot').value = match.lot || '';
  document.getElementById('qr-form-qty').value = String(match.qty || 1);
  document.getElementById('qr-form-kg-unit').value = match.kgPerUnit != null ? String(match.kgPerUnit) : '';
  document.getElementById('qr-form-kg-total').value = match.kgTotal != null ? String(match.kgTotal) : String(match.kg || '');
  const searchInput = document.getElementById('qr-form-product-search');
  if (searchInput) searchInput.value = `${match.code} - ${match.name || ''}`;
  syncWeightFields('qr', 'qty');
}

function syncQrFormFromSelectors() {
  qrWorkflow.depotId = document.getElementById('qr-form-depot')?.value || qrWorkflow.depotId;
  qrWorkflow.shelfId = document.getElementById('qr-form-shelf')?.value || qrWorkflow.shelfId;
  populateQrDrawerSelectors();
  qrWorkflow.drawerKey = document.getElementById('qr-form-drawer')?.value || qrWorkflow.drawerKey;
  renderQrWorkflow();
}

async function applyManualQrPayload() {
  const raw = document.getElementById('qr-manual-payload')?.value || '';
  try {
    const data = parseQrPayload(raw);
    applyQrContext(data, raw);
  } catch (err) {
    await showNotice({ title: 'QR INVÁLIDO', icon: '⛔', desc: err.message });
  }
}

function resetQrWorkflow() {
  qrWorkflow = { depotId: activeDepotId, shelfId: null, drawerKey: null, productCode: null, locationDrawerKey: null, payload: null };
  document.getElementById('qr-manual-payload').value = '';
  const genSearch = document.getElementById('qr-gen-product-search');
  if (genSearch) genSearch.value = '';
  const formSearch = document.getElementById('qr-form-product-search');
  if (formSearch) formSearch.value = '';
  renderQrPage();
}

async function startQrScanner() {
  if (!('BarcodeDetector' in window)) {
    await showNotice({ title: 'LEITURA NÃO SUPORTADA', icon: 'ℹ', desc: 'Seu navegador não oferece BarcodeDetector para QR. Use imagem ou payload manual.' });
    return;
  }
  const video = document.getElementById('qr-video');
  if (!video) return;
  qrVideoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = qrVideoStream;
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const tick = async () => {
    if (!qrVideoStream) return;
    try {
      const codes = await detector.detect(video);
      if (codes[0]?.rawValue) {
        document.getElementById('qr-manual-payload').value = codes[0].rawValue;
        await applyManualQrPayload();
      }
    } catch (err) {}
    qrScanTimer = setTimeout(tick, 700);
  };
  tick();
}

function stopQrScanner() {
  if (qrScanTimer) { clearTimeout(qrScanTimer); qrScanTimer = null; }
  if (qrVideoStream) {
    qrVideoStream.getTracks().forEach(track => track.stop());
    qrVideoStream = null;
  }
  const video = document.getElementById('qr-video');
  if (video) video.srcObject = null;
}

async function handleQrImage(file) {
  if (!file) return;
  if (!('BarcodeDetector' in window)) {
    await showNotice({ title: 'LEITURA NÃO SUPORTADA', icon: 'ℹ', desc: 'Seu navegador não oferece leitura por imagem. Use payload manual.' });
    return;
  }
  const bitmap = await createImageBitmap(file);
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const codes = await detector.detect(bitmap);
  if (codes[0]?.rawValue) {
    document.getElementById('qr-manual-payload').value = codes[0].rawValue;
    await applyManualQrPayload();
  } else {
    await showNotice({ title: 'QR NÃO ENCONTRADO', icon: 'ℹ', desc: 'Nenhum QR code foi detectado na imagem enviada.' });
  }
}

async function submitQrEntry() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode registrar entradas via QR.')) return;
  syncWeightFields('qr', 'qty');
  const depotId = document.getElementById('qr-form-depot')?.value || qrWorkflow.depotId || activeDepotId;
  const shelfId = document.getElementById('qr-form-shelf')?.value || qrWorkflow.shelfId || '';
  const drawerValue = document.getElementById('qr-form-drawer')?.value || qrWorkflow.drawerKey || '';
  const code = sanitizeTextInput(document.getElementById('qr-form-code')?.value, { maxLength: 40, uppercase: true });
  const name = sanitizeTextInput(document.getElementById('qr-form-name')?.value, { maxLength: 120 });
  const unit = document.getElementById('qr-form-unit')?.value || 'un';
  const qty = parseInt(document.getElementById('qr-form-qty')?.value, 10) || 1;
  const kgPerUnit = parseFloat(document.getElementById('qr-form-kg-unit')?.value) || 0;
  const kgTotal = parseFloat(document.getElementById('qr-form-kg-total')?.value) || 0;
  const entry = document.getElementById('qr-form-entry')?.value || new Date().toISOString().slice(0, 10);
  const expiry = document.getElementById('qr-form-expiry')?.value || '';
  const lot = sanitizeTextInput(document.getElementById('qr-form-lot')?.value, { maxLength: 60, uppercase: true });
  const notes = sanitizeTextInput(document.getElementById('qr-form-notes')?.value, { maxLength: 180 });

  if (!depotId || !shelfId || !drawerValue || !code || !name) {
    await showNotice({ title: 'DADOS INCOMPLETOS', icon: '⛔', desc: 'Depósito, estante, gaveta, código e nome são obrigatórios para registrar a entrada.' });
    return;
  }
  const validation = validateDrawerPlacement({ depotId, drawerKeyValue: drawerValue, incomingKg: kgTotal });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  if (!productsAll[depotId]) productsAll[depotId] = {};
  if (!productsAll[depotId][drawerValue]) productsAll[depotId][drawerValue] = [];
  const existingTemplate = Object.values(productsAll[depotId]).flat().find(product => product.code === code)
    || Object.values(productsAll).flatMap(productMap => Object.values(productMap).flat()).find(product => product.code === code);
  productsAll[depotId][drawerValue].push({
    ...(existingTemplate || {}),
    code, name, unit, qty, kg: kgTotal, kgTotal, kgPerUnit, entry,
    lot, notes: notes || existingTemplate?.notes || '',
    expiries: expiry ? [expiry] : [],
  });

  logHistory('🔳', `Entrada via QR/manual: ${code} — ${name}`, `${drawerValue} · ${kgTotal.toFixed(3)}kg · ${qty} ${unit}${notes ? ' · ' + notes : ''}`, { depotId, to: drawerValue, drawerKey: drawerValue, productCode: code });
  switchDepot(depotId);
  document.getElementById('qr-form-code').value = '';
  document.getElementById('qr-form-name').value = '';
  document.getElementById('qr-form-lot').value = '';
  document.getElementById('qr-form-expiry').value = '';
  document.getElementById('qr-form-notes').value = '';
  document.getElementById('qr-form-qty').value = '1';
  document.getElementById('qr-form-kg-unit').value = '';
  document.getElementById('qr-form-kg-total').value = '';
  syncWeightFields('qr', 'qty');
  resetQrWorkflow();
  renderAll();
}

// ——— CLOSE MODALS ON OVERLAY CLICK ———
// modal overlay click handlers — deferred so DOM is ready
function attachModalListeners() {
  const em = document.getElementById('expiry-modal');
  if (em) em.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
  const dm = document.getElementById('drawer-modal');
  if (dm) dm.addEventListener('click', function(e) { if (e.target === this) closeDrawerModal(); });
  const apm = document.getElementById('add-product-modal');
  if (apm) apm.addEventListener('click', function(e) { if (e.target === this) document.getElementById('add-product-modal').classList.remove('open'); });
  const sm = document.getElementById('settings-modal');
  if (sm) sm.addEventListener('click', function(e) { if (e.target === this) closeSettingsModal(); });
  const bpm = document.getElementById('blind-pool-modal');
  if (bpm) bpm.addEventListener('click', function(e) { if (e.target === this) closeBlindPoolModal(); });
  const bam = document.getElementById('blind-allocate-modal');
  if (bam) bam.addEventListener('click', function(e) { if (e.target === this) closeBlindAllocateModal(); });
  const tim = document.getElementById('text-input-modal');
  if (tim) tim.addEventListener('click', function(e) { if (e.target === this) textPromptResolve(null); });
  const tif = document.getElementById('text-input-field');
  if (tif) tif.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitTextPrompt(); } });
  document.getElementById('qr-gen-depot')?.addEventListener('change', () => { populateQrSelectors(); renderQrGenerator(); });
  document.getElementById('qr-gen-shelf')?.addEventListener('change', () => { populateQrDrawerSelectors(); renderQrGenerator(); });
  document.getElementById('qr-form-depot')?.addEventListener('change', () => { populateQrSelectors(); syncQrFormFromSelectors(); });
  document.getElementById('qr-form-shelf')?.addEventListener('change', () => { populateQrDrawerSelectors(); syncQrFormFromSelectors(); });
  document.getElementById('qr-form-code')?.addEventListener('change', hydrateQrProductForm);
  document.getElementById('qr-form-code')?.addEventListener('input', () => { qrWorkflow.productCode = sanitizeTextInput(document.getElementById('qr-form-code')?.value || '', { maxLength: 40, uppercase: true }); renderQrProductLookup(); renderQrWorkflow(); });
  const dz = document.getElementById('csv-drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); });
  }
}
document.addEventListener('DOMContentLoaded', attachModalListeners);

// ——— DRAWER FOCUS MODE ———
function setFocusedDrawer(key) {
  // clear old active outline
  document.querySelectorAll('.drawer.active-drawer').forEach(d => d.classList.remove('active-drawer'));
  focusedDrawerKey = key;
  selectedProductCode = null;
  // switch sidebar to products tab and show focus panel
  switchTab('products-tab');
  renderProductTable();
  // highlight the active drawer
  requestAnimationFrame(() => {
    const el = document.querySelector(`.drawer[data-key="${key}"]`);
    if (el) el.classList.add('active-drawer');
  });
}

function clearFocus() {
  focusedDrawerKey = null;
  document.querySelectorAll('.drawer.active-drawer').forEach(d => d.classList.remove('active-drawer'));
  renderProductTable();
}

function getQualityRowById(rowId) {
  return qualityRowsCurrent.find(row => row.rowId === rowId) || null;
}

function getAvailableDrawersForShelf(shelf, depotId, incomingKg, excludeDrawerKey = null, excludeIndex = null) {
  const options = [];
  if (!shelf) return options;
  for (let floor = 1; floor <= shelf.floors; floor++) {
    for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
      const key = drawerKey(shelf.id, floor, drawer);
      const validation = validateDrawerPlacement({
        depotId,
        drawerKeyValue: key,
        incomingKg,
        sourceDepotId: depotId,
        sourceDrawerKey: excludeDrawerKey,
        sourceProductIdx: excludeIndex,
        allowExistingSameDrawer: true,
      });
      if (validation.ok) options.push(key);
    }
  }
  return options;
}

function openQualityMoveModal(rowId, targetType) {
  if (!hasPermission('quality.manage')) return;
  const row = getQualityRowById(rowId);
  if (!row) return;
  const specialDepots = depots.filter(depot => (shelvesAll[depot.id] || []).some(shelf => normalizeShelfType(shelf.type) === targetType));
  if (!specialDepots.length) {
    showNotice({
      title: 'SEM PRATELEIRA ESPECIAL',
      icon: '⛔',
      desc: `Não existe nenhuma prateleira de ${targetType === 'quarantine' ? 'quarentena' : 'bloqueio'} cadastrada.`,
      summary: { AÇÃO: 'Crie uma prateleira especial na aba PRATELEIRAS.' },
    });
    return;
  }
  qualityMoveCtx = { rowId, targetType };
  document.getElementById('quality-move-title').textContent = targetType === 'quarantine' ? 'ENVIAR PARA QUARENTENA' : 'ENVIAR PARA BLOQUEIO';
  document.getElementById('quality-move-subtitle').textContent = `${row.product.code} — ${row.product.name} · origem ${row.drawerKey}`;
  document.getElementById('quality-move-summary').innerHTML = [
    ['DEPÓSITO ORIGEM', row.depotName],
    ['LOCAL ORIGEM', row.drawerKey],
    ['LOTE', row.product.lot || '—'],
    ['QTD', parseFloat(row.product.qty || 1).toFixed(3)],
    ['KG', (parseFloat(row.product.kgTotal ?? row.product.kg) || 0).toFixed(3)],
  ].map(([k, v]) => `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(k)}</span><span class="confirm-sum-val">${escapeHtml(v)}</span></div>`).join('');
  const depotSelect = document.getElementById('quality-move-depot');
  depotSelect.innerHTML = specialDepots.map(depot => `<option value="${depot.id}">${escapeHtml(depot.name)}</option>`).join('');
  depotSelect.value = specialDepots.some(depot => depot.id === row.depotId) ? row.depotId : specialDepots[0].id;
  document.getElementById('quality-move-note').value = targetType === 'quarantine' ? 'Segregado para análise de qualidade.' : 'Produto bloqueado pela qualidade.';
  syncQualityMoveDestinations();
  document.getElementById('quality-move-modal').classList.add('open');
}

function syncQualityMoveDestinations() {
  if (!qualityMoveCtx) return;
  const row = getQualityRowById(qualityMoveCtx.rowId);
  if (!row) return;
  const depotId = document.getElementById('quality-move-depot')?.value || row.depotId;
  const shelfSelect = document.getElementById('quality-move-shelf');
  const drawerSelect = document.getElementById('quality-move-drawer');
  const incomingKg = parseFloat(row.product.kgTotal ?? row.product.kg) || 0;
  const specialShelves = (shelvesAll[depotId] || []).filter(shelf => normalizeShelfType(shelf.type) === qualityMoveCtx.targetType);
  shelfSelect.innerHTML = specialShelves.map(shelf => `<option value="${shelf.id}">${escapeHtml(shelf.id)} · ${escapeHtml(getShelfTypeLabel(shelf.type))}</option>`).join('');
  if (!specialShelves.length) {
    drawerSelect.innerHTML = '<option value="">Nenhuma prateleira disponível</option>';
    return;
  }
  if (!Array.from(shelfSelect.options).some(option => option.value === shelfSelect.value)) shelfSelect.value = specialShelves[0].id;
  const selectedShelf = specialShelves.find(shelf => shelf.id === shelfSelect.value) || specialShelves[0];
  const drawerOptions = getAvailableDrawersForShelf(
    selectedShelf,
    depotId,
    incomingKg,
    row.depotId === depotId ? row.drawerKey : null,
    row.depotId === depotId ? row.productIndex : null,
  );
  drawerSelect.innerHTML = drawerOptions.length
    ? drawerOptions.map(key => `<option value="${key}">${escapeHtml(key)}</option>`).join('')
    : '<option value="">Sem gaveta compatível</option>';
}

function closeQualityMoveModal() {
  document.getElementById('quality-move-modal').classList.remove('open');
  qualityMoveCtx = null;
}

async function executeQualityMove() {
  if (!await requirePermission('quality.manage', 'Seu perfil não pode fazer destinação de qualidade.')) return;
  if (!qualityMoveCtx) return;
  const row = getQualityRowById(qualityMoveCtx.rowId);
  if (!row) return;
  const depotId = document.getElementById('quality-move-depot')?.value || row.depotId;
  const drawerValue = document.getElementById('quality-move-drawer')?.value || '';
  const note = sanitizeTextInput(document.getElementById('quality-move-note')?.value || '', { maxLength: 180 });
  if (!drawerValue) {
    await showNotice({ title: 'DESTINO INVÁLIDO', icon: '⛔', desc: 'Selecione uma gaveta válida para a destinação de qualidade.' });
    return;
  }
  if (depotId === row.depotId && drawerValue === row.drawerKey) {
    await showNotice({ title: 'DESTINO INVÁLIDO', icon: '⛔', desc: 'Escolha uma gaveta diferente da origem.' });
    return;
  }
  const incomingKg = parseFloat(row.product.kgTotal ?? row.product.kg) || 0;
  const validation = validateDrawerPlacement({ depotId, drawerKeyValue: drawerValue, incomingKg, sourceDepotId: row.depotId });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }
  const sourceMap = productsAll[row.depotId] || {};
  const sourceList = sourceMap[row.drawerKey] || [];
  if (row.productIndex < 0) {
    await showNotice({ title: 'ITEM NÃO LOCALIZADO', icon: '⛔', desc: 'Este registro veio do banco, mas não foi possível vinculá-lo ao item carregado no frontend. Recarregue a página antes de mover.' });
    return;
  }
  const product = sourceList[row.productIndex];
  if (!product) {
    await showNotice({ title: 'ITEM NÃO ENCONTRADO', icon: '⛔', desc: 'O item mudou desde a abertura desta ação. Recarregue a página de qualidade.' });
    closeQualityMoveModal();
    return;
  }
  sourceList.splice(row.productIndex, 1);
  if (!sourceList.length) delete sourceMap[row.drawerKey];
  if (!productsAll[depotId]) productsAll[depotId] = {};
  if (!productsAll[depotId][drawerValue]) productsAll[depotId][drawerValue] = [];
  productsAll[depotId][drawerValue].push(product);
  const actionLabel = qualityMoveCtx.targetType === 'quarantine' ? 'Quarentena' : 'Bloqueio';
  logHistory('🛡', `${actionLabel}: ${product.code} — ${product.name}`, `${row.drawerKey} → ${drawerValue}${note ? ' · ' + note : ''}`, {
    depotId,
    from: row.drawerKey,
    to: drawerValue,
    drawerKey: drawerValue,
    productCode: product.code,
    type: 'movimentacao',
  });
  if (row.depotId === activeDepotId || depotId === activeDepotId) switchDepot(activeDepotId === row.depotId ? activeDepotId : depotId);
  qualityDataCache.fetchedAt = 0;
  qualityDataCache.states = null;
  qualityDataCache.summary = null;
  qualityRowsCurrent = [];
  closeQualityMoveModal();
  renderAll();
  setTimeout(() => renderQualityPage(true), 700);
}

// ——— DRAG AND DROP ———
let dragIdx = null;
let dragFromKey = null;

function onDragStart(e, idx, fromKey) {
  dragIdx = idx;
  dragFromKey = fromKey;
  e.dataTransfer.effectAllowed = 'move';
  const el = e.currentTarget;
  setTimeout(() => el.classList.add('dragging'), 0);
  // make ALL drawers drop-ready
  document.querySelectorAll('.drawer').forEach(d => {
    d.addEventListener('dragover',  onDrawerDragOver);
    d.addEventListener('dragleave', onDrawerDragLeave);
    d.addEventListener('drop',      onDrawerDrop);
  });
}

function onDragEnd(e) {
  e.currentTarget && e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drawer').forEach(d => {
    d.classList.remove('drop-target');
    d.removeEventListener('dragover',  onDrawerDragOver);
    d.removeEventListener('dragleave', onDrawerDragLeave);
    d.removeEventListener('drop',      onDrawerDrop);
  });
}

function onDrawerDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drop-target');
}

function onDrawerDragLeave(e) {
  this.classList.remove('drop-target');
}

function onDrawerDrop(e) {
  e.preventDefault();
  this.classList.remove('drop-target');
  const destKey = this.dataset.key;
  if (!destKey || dragIdx === null || !dragFromKey) return;
  if (destKey === dragFromKey) return;

  const prod = (products[dragFromKey] || [])[dragIdx];
  if (!prod) return;
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: destKey,
    incomingKg: parseFloat(prod.kg) || 0,
  });
  if (!validation.ok) {
    showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    dragIdx = null; dragFromKey = null;
    return;
  }

  // perform move
  products[dragFromKey].splice(dragIdx, 1);
  if (!products[destKey]) products[destKey] = [];
  products[destKey].push(prod);
  logHistory('🔀', `Movido: ${prod.code} — ${prod.name}`, `${dragFromKey} → ${destKey}`, { depotId: activeDepotId, from: dragFromKey, to: destKey, drawerKey: destKey, productCode: prod.code });

  // flash the target drawer
  this.classList.add('drop-ok');
  setTimeout(() => this.classList.remove('drop-ok'), 600);

  dragIdx = null; dragFromKey = null;

  // stay focused on source if it still has products, else clear
  if (focusedDrawerKey === dragFromKey && (products[dragFromKey] || []).length === 0) {
    focusedDrawerKey = destKey;
  }
  renderAll();
}

// ——— MOVE PRODUCT ———
// ══ MOVE MODE STATE MACHINE ══════════════════════════════════════════
let mvState = null;
// { prodIdx, srcKey, product, destKey }

function syncMoveTransferFields(source = 'qty') {
  if (!mvState?.product) return;
  const qtyEl = document.getElementById('cm-move-qty');
  const kgEl = document.getElementById('cm-move-kg');
  if (!qtyEl || !kgEl) return;
  const product = mvState.product;
  const totalQty = Math.max(0.001, parseFloat(product.qty || 1));
  const totalKg = Math.max(0.001, parseFloat(product.kgTotal ?? product.kg) || 0.001);
  const kgPerUnit = totalQty > 0 ? totalKg / totalQty : totalKg;

  if (source === 'kg') {
    const kg = Math.min(totalKg, Math.max(0.001, parseFloat(kgEl.value) || totalKg));
    kgEl.value = kg.toFixed(3);
    qtyEl.value = (kg / kgPerUnit).toFixed(3);
    return;
  }

  const qty = Math.min(totalQty, Math.max(0.001, parseFloat(qtyEl.value) || totalQty));
  qtyEl.value = qty.toFixed(3);
  kgEl.value = (qty * kgPerUnit).toFixed(3);
}

function getMinimumTransferKg(product) {
  const totalQty = Math.max(0.001, parseFloat(product?.qty || 1));
  const totalKg = Math.max(0.001, parseFloat(product?.kgTotal ?? product?.kg) || 0.001);
  const kgPerUnit = parseFloat(product?.kgPerUnit) || (totalKg / totalQty);
  return Math.max(0.001, Math.min(totalKg, kgPerUnit || 0.001));
}

function openMoveModal(prodIdx) {
  if (!hasPermission('entry.register')) return;
  const p = (products[currentDrawerKey] || [])[prodIdx];
  if (!p) return;

  mvState = { prodIdx, srcKey: currentDrawerKey, product: p, destKey: null };

  // close the drawer modal — we'll highlight the entire grid
  closeDrawerModal();
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open')) closeFpModal();

  // activate move mode
  document.getElementById('move-mode-banner').classList.add('active');
  document.getElementById('move-banner-text').textContent =
    `Movendo: ${p.code} — ${p.name} · de ${mvState.srcKey}`;
  document.body.classList.add('move-mode');

  // highlight drawers
  applyMoveHighlights();
}

function applyMoveHighlights() {
  if (!mvState) return;
  const src = mvState.srcKey;
  const incomingKg = getMinimumTransferKg(mvState.product);
  // highlight in depot grid
  document.querySelectorAll('.drawer[data-key]').forEach(el => {
    const key = el.dataset.key;
    el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
    if (key === src) { el.classList.add('mv-source'); return; }
    const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: key, incomingKg });
    if (validation.ok) {
      const prods = products[key] || [];
      el.classList.add(prods.length === 0 ? 'mv-empty' : 'mv-has-room');
      el.onclick = (e) => { e.stopPropagation(); mvSelectDest(key); };
    } else {
      el.classList.add('mv-full');
      el.onclick = (e) => {
        e.stopPropagation();
        showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
      };
    }
  });
  // if floor plan modal open, highlight there too
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open')) {
    document.querySelectorAll('#fp-modal-body .drawer[data-key]').forEach(el => {
      const key = el.dataset.key;
      el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
      if (key === src) { el.classList.add('mv-source'); return; }
      const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: key, incomingKg });
      if (validation.ok) {
        const prods = products[key] || [];
        el.classList.add(prods.length === 0 ? 'mv-empty' : 'mv-has-room');
        el.onclick = (e) => { e.stopPropagation(); mvSelectDest(key); };
      } else {
        el.classList.add('mv-full');
        el.onclick = (e) => {
          e.stopPropagation();
          showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
        };
      }
    });
  }
}

function mvSelectDest(destKey) {
  if (!mvState) return;
  mvState.destKey = destKey;
  const p = mvState.product;
  const expiries = getExpiries(p).filter(Boolean).sort();

  // fill confirm modal
  document.getElementById('cm-product').textContent = `${p.code} — ${p.name}`;
  document.getElementById('cm-available').textContent = `${parseFloat(p.qty || 1).toFixed(3)} un · ${(parseFloat(p.kgTotal ?? p.kg) || 0).toFixed(3)} kg`;
  document.getElementById('cm-from').textContent = mvState.srcKey;
  document.getElementById('cm-to').textContent = destKey;
  const qtyInput = document.getElementById('cm-move-qty');
  const kgInput = document.getElementById('cm-move-kg');
  if (qtyInput) qtyInput.value = parseFloat(p.qty || 1).toFixed(3);
  if (kgInput) kgInput.value = (parseFloat(p.kgTotal ?? p.kg) || 0).toFixed(3);

  // expiry selection
  const expSection = document.getElementById('cm-expiry-section');
  const expList = document.getElementById('cm-expiry-list');
  if (expiries.length > 0) {
    expSection.style.display = 'block';
    expList.innerHTML = expiries.map((d, i) => {
      const st = expiryStatus(d);
      const stLabel = st === 'expired' ? ' 🔴 VENCIDA' : st === 'expiring' ? ' 🟡 A VENCER' : ' 🟢 OK';
      return `<div class="cm-expiry-row">
        <input type="checkbox" id="cmexp-${i}" value="${d}" checked>
        <label for="cmexp-${i}" style="cursor:pointer">${fmtDate(d)}${stLabel}</label>
      </div>`;
    }).join('');
  } else {
    expSection.style.display = 'none';
  }

  document.getElementById('move-confirm-modal').classList.add('open');
}

async function executeMoveConfirmed() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode movimentar produtos manualmente.')) return;
  if (!mvState || !mvState.destKey) return;
  const { prodIdx, srcKey, destKey, product: p } = mvState;
  const sourceQty = Math.max(0.001, parseFloat(p.qty || 1));
  const sourceKg = Math.max(0.001, parseFloat(p.kgTotal ?? p.kg) || 0.001);
  const moveQty = Math.max(0.001, parseFloat(document.getElementById('cm-move-qty')?.value || sourceQty));
  const moveKg = Math.max(0.001, parseFloat(document.getElementById('cm-move-kg')?.value || sourceKg));
  if (moveQty - sourceQty > 0.0001 || moveKg - sourceKg > 0.0001) {
    await showNotice({ title: 'TRANSFERÊNCIA INVÁLIDA', icon: '⛔', desc: 'Quantidade ou peso informados excedem o disponível na origem.' });
    return;
  }
  const partialMove = Math.abs(moveQty - sourceQty) > 0.0001 || Math.abs(moveKg - sourceKg) > 0.0001;

  // get selected expiries
  const expiries = getExpiries(p).filter(Boolean).sort();
  let movedExpiries = expiries; // default: all
  if (expiries.length > 0) {
    movedExpiries = [];
    document.querySelectorAll('#cm-expiry-list input[type=checkbox]').forEach(cb => {
      if (cb.checked) movedExpiries.push(cb.value);
    });
  }
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: destKey,
    incomingKg: moveKg,
  });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  // remove from source
  const srcProds = products[srcKey] || [];
  srcProds.splice(prodIdx, 1);
  if (!srcProds.length) delete products[srcKey];

  // add to dest with only selected expiries
  if (!products[destKey]) products[destKey] = [];
  const movedItem = {
    ...p,
    qty: parseFloat(moveQty.toFixed(3)),
    kg: parseFloat(moveKg.toFixed(3)),
    kgTotal: parseFloat(moveKg.toFixed(3)),
    expiries: movedExpiries,
  };
  products[destKey].push(movedItem);

  // if some expiries were NOT moved, keep product at source with remaining
  const remainingExp = expiries.filter(d => !movedExpiries.includes(d));
  const remainingQty = Math.max(0, sourceQty - moveQty);
  const remainingKg = Math.max(0, sourceKg - moveKg);
  if (partialMove || remainingExp.length > 0) {
    if (!products[srcKey]) products[srcKey] = [];
    products[srcKey].push({
      ...p,
      qty: parseFloat(remainingQty.toFixed(3)),
      kg: parseFloat(remainingKg.toFixed(3)),
      kgTotal: parseFloat(remainingKg.toFixed(3)),
      expiries: remainingExp.length > 0 ? remainingExp : expiries,
    });
  }

  logHistory('🔀', `Movido: ${p.code} — ${p.name}`,
    `${srcKey} → ${destKey} · ${moveQty.toFixed(3)} un · ${moveKg.toFixed(3)} kg${remainingExp.length ? ' ('+movedExpiries.length+' val. de '+expiries.length+')' : ''}${partialMove ? ' · parcial' : ''}`,
    { depotId: activeDepotId, from: srcKey, to: destKey, drawerKey: destKey, productCode: p.code });

  cancelMoveMode();
  renderAll();
}

function cancelMoveMode() {
  // close confirm modal
  document.getElementById('move-confirm-modal').classList.remove('open');
  // remove banner
  document.getElementById('move-mode-banner').classList.remove('active');
  document.body.classList.remove('move-mode');
  // remove all move highlights and restore onclick
  document.querySelectorAll('.drawer[data-key]').forEach(el => {
    el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
    const key = el.dataset.key;
    // restore original onclick
    el.onclick = (e) => { e.stopPropagation(); openDrawerModal(key); };
  });
  mvState = null;
}

// hook ESC to also cancel move mode


// ——— EXPORTS ———
// Export functions that need to be accessible from other modules (like render.js)
export {
  openAddProductModal,
  addGlobalProduct,
  syncWeightFields,
  // QR related functions would be exported from qr.js
};
