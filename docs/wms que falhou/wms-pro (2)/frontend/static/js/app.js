


// ══ UNIFIED CONFIRMATION SYSTEM ══════════════════════════════════════
let _confirmResolve = null;
let _textPromptResolve = null;
let _lastUndoAction = null;
let SOUND_ENABLED = true;
let HIGH_CONTRAST_ENABLED = false;
let blindExpectedManifest = null;
let blindDamagePhotoDataUrl = '';
let blindAllocationDamagePhotoDataUrl = '';
let fpHeatmapEnabled = false;
let fpExpiryMaxDays = 0;
let userPermissionsInitialized = false;
let lastAppliedUserRole = null;
let tableResizeObserver = null;
let tableResizeEnhanceQueued = false;

function hydrateCurrentUserFromStorage() {
  if (window.CURRENT_USER) return window.CURRENT_USER;
  const raw = sessionStorage.getItem('current_user');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    window.CURRENT_USER = parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.warn('Falha ao restaurar usuário da sessão:', err);
    sessionStorage.removeItem('current_user');
    window.CURRENT_USER = null;
  }
  return window.CURRENT_USER;
}

hydrateCurrentUserFromStorage();

function playUiSound(type = 'success') {
  if (!SOUND_ENABLED) return;
  try {
    if (navigator?.vibrate) {
      navigator.vibrate(type === 'success' ? [90] : type === 'warn' ? [120, 60, 120] : [220, 80, 220]);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.__wmsAudioCtx) window.__wmsAudioCtx = new AudioCtx();
    const ctx = window.__wmsAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const success = type === 'success';
    const warn = type === 'warn';
    osc.type = success ? 'triangle' : warn ? 'square' : 'sawtooth';
    osc.frequency.value = success ? 980 : warn ? 540 : 220;
    gain.gain.value = 0.0001;
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (success ? 0.12 : 0.2));
    if (success) osc.frequency.exponentialRampToValueAtTime(1280, now + 0.12);
    osc.start(now);
    osc.stop(now + (success ? 0.14 : 0.22));
  } catch (err) {
    console.warn('Falha ao tocar som da UI:', err);
  }
}

function setUndoAction(label, handler) {
  _lastUndoAction = typeof handler === 'function' ? { label, handler } : null;
}

function clearUndoAction() {
  _lastUndoAction = null;
}

function triggerLastUndoAction() {
  if (!_lastUndoAction?.handler) return false;
  const action = _lastUndoAction;
  _lastUndoAction = null;
  try {
    action.handler();
    playUiSound('warn');
    showToast(`Desfeito: ${action.label}`, 'info', 2400);
    return true;
  } catch (err) {
    console.error('Falha ao desfazer ação:', err);
    return false;
  }
}

function applyHighContrastPreference() {
  document.body.classList.toggle('high-contrast', !!HIGH_CONTRAST_ENABLED);
  const toggle = document.getElementById('settings-high-contrast-toggle');
  if (toggle) toggle.checked = !!HIGH_CONTRAST_ENABLED;
}

function toggleHighContrast(enabled) {
  HIGH_CONTRAST_ENABLED = !!enabled;
  sessionStorage.setItem('wms_high_contrast', HIGH_CONTRAST_ENABLED ? '1' : '0');
  applyHighContrastPreference();
}

function showConfirm({ title, desc, summary, icon='⚠', okLabel='CONFIRMAR', okStyle='danger' }) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-desc').textContent  = desc || '';
    document.getElementById('confirm-icon').textContent  = icon;
    const sumEl = document.getElementById('confirm-summary');
    if (summary && Object.keys(summary).length) {
      sumEl.style.display = 'flex';
      sumEl.innerHTML = Object.entries(summary).map(([k,v]) =>
        `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(k)}</span><span class="confirm-sum-val">${escapeHtml(v)}</span></div>`
      ).join('');
    } else {
      sumEl.style.display = 'none';
    }
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okLabel;
    okBtn.className   = 'confirm-btn-ok' + (okStyle === 'safe' ? ' safe' : okStyle === 'accent' ? ' accent' : '');
    document.getElementById('confirm-footer')?.classList.remove('single');
    document.getElementById('confirm-overlay').classList.add('open');
  });
}

function showNotice({ title, desc, summary, icon='ℹ', okLabel='OK', okStyle='accent' }) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-desc').textContent = desc || '';
    document.getElementById('confirm-icon').textContent = icon;
    const sumEl = document.getElementById('confirm-summary');
    if (summary && Object.keys(summary).length) {
      sumEl.style.display = 'flex';
      sumEl.innerHTML = Object.entries(summary).map(([k, v]) =>
        `<div class="confirm-sum-row"><span class="confirm-sum-label">${escapeHtml(k)}</span><span class="confirm-sum-val">${escapeHtml(v)}</span></div>`
      ).join('');
    } else {
      sumEl.style.display = 'none';
    }
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okLabel;
    okBtn.className = 'confirm-btn-ok' + (okStyle === 'safe' ? ' safe' : okStyle === 'accent' ? ' accent' : '');
    document.getElementById('confirm-footer')?.classList.add('single');
    document.getElementById('confirm-overlay').classList.add('open');
  });
}

function confirmResolve(result) {
  document.getElementById('confirm-overlay').classList.remove('open');
  document.getElementById('confirm-footer')?.classList.remove('single');
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

function showTextPrompt({ title, label, value='', placeholder='', help='', okLabel='SALVAR', maxLength=80, uppercase=false }) {
  return new Promise(resolve => {
    _textPromptResolve = resolve;
    document.getElementById('text-input-title').textContent = title;
    document.getElementById('text-input-label').textContent = label;
    document.getElementById('text-input-help').textContent = help || '';
    document.getElementById('text-input-ok-btn').textContent = okLabel;
    const input = document.getElementById('text-input-field');
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.dataset.maxLength = String(maxLength);
    input.dataset.uppercase = uppercase ? '1' : '0';
    document.getElementById('text-input-modal').classList.add('open');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 20);
  });
}

function submitTextPrompt() {
  const input = document.getElementById('text-input-field');
  const value = sanitizeTextInput(input.value, {
    maxLength: parseInt(input.dataset.maxLength || '80', 10),
    uppercase: input.dataset.uppercase === '1',
  });
  textPromptResolve(value);
}

function textPromptResolve(value) {
  document.getElementById('text-input-modal').classList.remove('open');
  if (_textPromptResolve) { _textPromptResolve(value); _textPromptResolve = null; }
}

function showToast(message, type = 'success', duration = 2600) {
  const el = document.getElementById('app-toast');
  if (!el) return;
  el.innerHTML = '';
  el.className = `app-toast open ${type}${_lastUndoAction ? ' undo-ready' : ''}`;
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (_lastUndoAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = 'DESFAZER';
    btn.onclick = () => {
      triggerLastUndoAction();
      el.classList.remove('open');
    };
    el.appendChild(btn);
  }
  if (type === 'success') playUiSound('success');
  else if (type === 'warn') playUiSound('warn');
  else if (type === 'error' || type === 'danger') playUiSound('error');
  if (appToastTimer) clearTimeout(appToastTimer);
  appToastTimer = setTimeout(() => {
    el.classList.remove('open');
    clearUndoAction();
  }, duration);
}

let serverRevision = '0';
let stateHydrating = false;
let syncDebounceTimer = null;
let syncInFlight = false;
let revisionPollTimer = null;
let suppressAutoPersist = false;
let inventoryPersistBlockedReason = '';
const ALL_DEPOTS_VALUE = '__all__';
let depotTabsContextId = null;

function buildDepotOptionsHtml({ includeAll = false, allLabel = 'Todos os depósitos', selected = '' } = {}) {
  const options = [];
  if (includeAll) options.push(`<option value="${ALL_DEPOTS_VALUE}" ${selected === ALL_DEPOTS_VALUE ? 'selected' : ''}>${escapeHtml(allLabel)}</option>`);
  depots.forEach(depot => {
    options.push(`<option value="${depot.id}" ${selected === depot.id ? 'selected' : ''}>${escapeHtml(depot.name)}</option>`);
  });
  return options.join('');
}

function deepClone(value) {
  return structuredClone(value);
}

function byId(id) {
  return document.getElementById(id);
}

function getDepotTabsContextId() {
  return depotTabsContextId || activeDepotId || ALL_DEPOTS_VALUE;
}

function isDepotPageAllContext() {
  return getCurrentPageName() === 'depot' && getDepotTabsContextId() === ALL_DEPOTS_VALUE;
}

function getScopedDepotIds(contextId = getDepotTabsContextId()) {
  return contextId === ALL_DEPOTS_VALUE ? depots.map(depot => depot.id) : [contextId].filter(Boolean);
}

function getDepotViewScopeIds() {
  return isDepotPageAllContext() ? depots.map(depot => depot.id) : [activeDepotId].filter(Boolean);
}

function getDrawerProductsForDepotView(depotId, drawerKeyValue) {
  return (productsAll[depotId] || {})[drawerKeyValue] || [];
}

function readInputValue(id, fallback = '') {
  const el = byId(id);
  return el ? el.value : fallback;
}

function writeInputValue(id, value) {
  const el = byId(id);
  if (el) el.value = value;
  return el;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJs(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getResizableTableKey(table) {
  if (!table) return '';
  const hostId = table.id || table.closest('[id]')?.id || '';
  const head = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim()).join('|');
  return `${hostId}::${head}`;
}

function getStoredTableWidths(table) {
  try {
    return JSON.parse(localStorage.getItem(`wms_table_widths:${getResizableTableKey(table)}`) || '{}');
  } catch (err) {
    return {};
  }
}

function storeTableWidths(table, widths) {
  try {
    localStorage.setItem(`wms_table_widths:${getResizableTableKey(table)}`, JSON.stringify(widths));
  } catch (err) {}
}

function getTableColumnStorageKey(th, index) {
  return th?.dataset?.colKey || `idx-${index}`;
}

function ensureTableColGroup(table, count) {
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  while (colgroup.children.length < count) colgroup.appendChild(document.createElement('col'));
  while (colgroup.children.length > count) colgroup.removeChild(colgroup.lastChild);
  return Array.from(colgroup.children);
}

function measureTableCellWidth(cell) {
  if (!cell) return 72;
  const computed = getComputedStyle(cell);
  const probe = document.createElement('div');
  probe.className = 'table-autofit-probe';
  probe.innerHTML = cell.innerHTML;
  probe.querySelectorAll('.table-col-resizer').forEach(node => node.remove());
  probe.style.fontFamily = computed.fontFamily;
  probe.style.fontSize = computed.fontSize;
  probe.style.fontWeight = computed.fontWeight;
  probe.style.letterSpacing = computed.letterSpacing;
  document.body.appendChild(probe);
  const width = Math.ceil(probe.scrollWidth) + parseFloat(computed.paddingLeft || '0') + parseFloat(computed.paddingRight || '0') + 18;
  probe.remove();
  return Math.max(64, width);
}

function autofitTableColumn(table, colIndex) {
  const header = table.querySelectorAll('thead th')[colIndex];
  if (!header) return;
  const cells = [
    header,
    ...Array.from(table.querySelectorAll(`tbody tr`)).map(row => row.children[colIndex]).filter(Boolean),
  ];
  const width = Math.min(520, Math.max(...cells.map(measureTableCellWidth), 72));
  const cols = ensureTableColGroup(table, table.querySelectorAll('thead th').length);
  if (cols[colIndex]) cols[colIndex].style.width = `${width}px`;
  header.style.width = `${width}px`;
  const stored = getStoredTableWidths(table);
  stored[getTableColumnStorageKey(header, colIndex)] = width;
  storeTableWidths(table, stored);
}

function attachTableResizerHandle(th, table, colIndex) {
  if (th.querySelector('.table-col-resizer')) return;
  const handle = document.createElement('div');
  handle.className = 'table-col-resizer';
  handle.title = 'Arraste para redimensionar. Duplo clique para autofit.';
  handle.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();
    const cols = ensureTableColGroup(table, table.querySelectorAll('thead th').length);
    const startX = event.clientX;
    const startWidth = cols[colIndex]?.getBoundingClientRect().width || th.getBoundingClientRect().width || 90;
    document.body.classList.add('table-resize-active');

    const onMove = moveEvent => {
      const nextWidth = Math.max(64, Math.round(startWidth + (moveEvent.clientX - startX)));
      if (cols[colIndex]) cols[colIndex].style.width = `${nextWidth}px`;
      th.style.width = `${nextWidth}px`;
    };

    const onUp = () => {
      document.body.classList.remove('table-resize-active');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const finalWidth = cols[colIndex]?.getBoundingClientRect().width || th.getBoundingClientRect().width || startWidth;
      const stored = getStoredTableWidths(table);
      stored[getTableColumnStorageKey(th, colIndex)] = Math.round(finalWidth);
      storeTableWidths(table, stored);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  handle.addEventListener('dblclick', event => {
    event.preventDefault();
    event.stopPropagation();
    autofitTableColumn(table, colIndex);
  });
  th.appendChild(handle);
}

function enhanceResizableTable(table) {
  const headers = Array.from(table.querySelectorAll('thead th'));
  if (!headers.length) return;
  table.classList.add('table-resizable');
  table.parentElement?.classList.add('table-scroll-wrap');
  const cols = ensureTableColGroup(table, headers.length);
  const stored = getStoredTableWidths(table);
  headers.forEach((th, index) => {
    attachTableResizerHandle(th, table, index);
    const width = stored[getTableColumnStorageKey(th, index)];
    if (width) {
      cols[index].style.width = `${width}px`;
      th.style.width = `${width}px`;
    }
  });
}

function enhanceResizableTables(root = document) {
  root.querySelectorAll('table').forEach(table => {
    if (table.querySelector('thead th')) enhanceResizableTable(table);
  });
}

function queueEnhanceResizableTables() {
  if (tableResizeEnhanceQueued) return;
  tableResizeEnhanceQueued = true;
  requestAnimationFrame(() => {
    tableResizeEnhanceQueued = false;
    enhanceResizableTables(document);
  });
}

function startTableResizeObserver() {
  if (tableResizeObserver) return;
  tableResizeObserver = new MutationObserver(() => queueEnhanceResizableTables());
  tableResizeObserver.observe(document.body, { childList: true, subtree: true });
  queueEnhanceResizableTables();
}

function sanitizeTextInput(value, { maxLength = 200, uppercase = false } = {}) {
  let text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (uppercase) text = text.toUpperCase();
  if (text.length > maxLength) text = text.slice(0, maxLength);
  return text;
}

function getCurrentUserObject() {
  return window.CURRENT_USER || hydrateCurrentUserFromStorage() || null;
}

function getCurrentUserLabel() {
  const user = getCurrentUserObject();
  return user?.full_name || user?.username || 'sistema';
}

const USER_ROLE_ORDER = ['visualizador', 'separador', 'conferente', 'qualidade', 'supervisor', 'gerente', 'admin', 'master'];
const ROLE_LABELS = {
  visualizador: 'VISUALIZADOR',
  separador: 'SEPARADOR',
  conferente: 'CONFERENTE',
  qualidade: 'QUALIDADE',
  supervisor: 'SUPERVISOR',
  gerente: 'GERENTE',
  admin: 'ADMIN',
  master: 'MASTER',
};

let usersCache = [];

function getCurrentUserRole() {
  return getCurrentUserObject()?.role || 'visualizador';
}

const CLIENT_ROLE_PERMISSIONS = {
  visualizador: ['view.basic'],
  separador: ['view.basic', 'separation.execute'],
  conferente: ['entry.register', 'shipment.process', 'product.manage', 'view.basic'],
  qualidade: ['entry.register', 'quality.manage', 'discard.process', 'product.manage', 'view.basic'],
  supervisor: ['entry.register', 'blind.count', 'shipment.process', 'quality.manage', 'discard.process', 'structure.manage', 'product.manage', 'user.manage.low', 'view.basic'],
  gerente: ['entry.register', 'blind.count', 'shipment.process', 'quality.manage', 'discard.process', 'layout.edit', 'structure.manage', 'settings.manage', 'product.manage', 'user.manage.mid', 'view.basic'],
  admin: ['entry.register', 'blind.count', 'shipment.process', 'quality.manage', 'discard.process', 'layout.edit', 'structure.manage', 'settings.manage', 'product.manage', 'user.manage.high', 'clear.all', 'view.basic'],
  master: ['entry.register', 'blind.count', 'shipment.process', 'quality.manage', 'discard.process', 'layout.edit', 'structure.manage', 'settings.manage', 'product.manage', 'user.manage.master', 'clear.all', 'view.basic'],
};

function getCurrentPermissions() {
  return CLIENT_ROLE_PERMISSIONS[getCurrentUserRole()] || CLIENT_ROLE_PERMISSIONS.visualizador;
}

function hasPermission(permission) {
  return getCurrentPermissions().includes(permission) || getCurrentUserRole() === 'master';
}

async function requirePermission(permission, message = 'Seu perfil não pode executar esta ação.') {
  if (hasPermission(permission)) return true;
  await showNotice({ title: 'ACESSO NEGADO', icon: '⛔', desc: message });
  return false;
}

function getAllowedManagedRoles() {
  const role = getCurrentUserRole();
  if (role === 'supervisor') return ['visualizador', 'separador', 'conferente', 'qualidade'];
  if (role === 'gerente') return ['supervisor', 'visualizador', 'separador', 'conferente', 'qualidade'];
  if (role === 'admin') return ['gerente', 'supervisor', 'visualizador', 'separador', 'conferente', 'qualidade'];
  if (role === 'master') return [...USER_ROLE_ORDER];
  return [];
}

function canManageUsers() {
  return getAllowedManagedRoles().length > 0;
}

function hasBlindCountAccess() {
  return ['conferente', 'supervisor', 'gerente', 'admin', 'master'].includes(getCurrentUserRole());
}

function canReviewBlindUnloads() {
  return ['supervisor', 'gerente', 'admin', 'master'].includes(getCurrentUserRole());
}

function canEditAllPendingBlindUnloads() {
  return canReviewBlindUnloads();
}

function canEditApprovedBlindUnloads() {
  return ['admin', 'master'].includes(getCurrentUserRole());
}

function canManageProducts() {
  return hasPermission('product.manage');
}

function inferHistoryType(action = '', icon = '') {
  const text = `${icon} ${action}`.toLowerCase();
  if (text.includes('entrada') || icon === '📥' || icon === '🔳') return 'entrada';
  if (text.includes('saída') || icon === '📤') return 'saida';
  if (text.includes('movido') || text.includes('trocadas') || icon === '🔀') return 'movimentacao';
  if (text.includes('edit') || icon === '✏') return 'edicao';
  if (text.includes('qr')) return 'qr';
  return 'outros';
}

function syncWeightFields(prefix, source = 'qty') {
  const qtyEl = byId(`${prefix}-qty`) || byId(`${prefix}-form-qty`);
  const unitEl = byId(`${prefix}-kg-unit`) || byId(`${prefix}-form-kg-unit`);
  const totalEl = byId(`${prefix}-kg-total`) || byId(`${prefix}-form-kg-total`);
  const hiddenEl = byId(`${prefix}-kg`) || byId(`${prefix}-form-kg`);
  if (!qtyEl || !unitEl || !totalEl) return;

  const qty = Math.max(1, parseFloat(qtyEl.value) || 1);
  let kgUnit = parseFloat(unitEl.value) || 0;
  let kgTotal = parseFloat(totalEl.value) || 0;

  if (source === 'total' && qty > 0) {
    kgUnit = kgTotal / qty;
    unitEl.value = kgUnit ? kgUnit.toFixed(3) : '';
  } else {
    kgTotal = qty * kgUnit;
    totalEl.value = kgTotal ? kgTotal.toFixed(3) : '';
  }

  if (hiddenEl) hiddenEl.value = kgTotal ? kgTotal.toFixed(3) : '';
}

function getDepotById(depotId = activeDepotId) {
  return depots.find(d => d.id === depotId) || null;
}

function isDiscardDepot(depot) {
  return !!depot && (depot.id === 'dep_discard' || depot.special === 'discard' || /descarte/i.test(depot.name || ''));
}

function getShelvesForDepot(depotId = activeDepotId) {
  return shelvesAll[depotId] || [];
}

function getProductsForDepot(depotId = activeDepotId) {
  return productsAll[depotId] || {};
}

function getShelfById(shelfId, depotId = activeDepotId) {
  return getShelvesForDepot(depotId).find(s => s.id === shelfId) || null;
}

function normalizeShelfType(value) {
  return ['normal', 'quarantine', 'blocked'].includes(value) ? value : 'normal';
}

function getCheckedOptionValue(name, fallback = '') {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked?.value || fallback;
}

function getShelfTypeLabel(value) {
  const shelfType = normalizeShelfType(value);
  return shelfType === 'quarantine' ? 'QUARENTENA' : shelfType === 'blocked' ? 'BLOQUEIO' : 'NORMAL';
}

function getShelfTypeClass(value) {
  const shelfType = normalizeShelfType(value);
  return shelfType === 'quarantine' ? 'shelf-type-quarantine' : shelfType === 'blocked' ? 'shelf-type-blocked' : 'shelf-type-normal';
}

function getScopedShelfId(shelfId, depotId = activeDepotId) {
  return `${depotId}::${shelfId}`;
}

function getDrawerCapacityKg(drawerKeyValue, depotId = activeDepotId) {
  const parsed = parseKey(drawerKeyValue);
  if (!parsed) return 0;
  return getShelfById(parsed.shelf, depotId)?.maxKg || 50;
}

function getDrawerProducts(drawerKeyValue, depotId = activeDepotId) {
  return getProductsForDepot(depotId)[drawerKeyValue] || [];
}

function getDrawerUsedKg(drawerKeyValue, depotId = activeDepotId, excludeProductIdx = null) {
  return getDrawerProducts(drawerKeyValue, depotId).reduce((sum, product, idx) => {
    if (excludeProductIdx !== null && idx === excludeProductIdx) return sum;
    return sum + (parseFloat(product.kg) || 0);
  }, 0);
}

function getShelfCapacityKg(shelf) {
  if (!shelf) return 0;
  return shelf.floors * shelf.drawers * (shelf.maxKg || 50);
}

function getShelfUsedKg(shelfId, depotId = activeDepotId, options = {}) {
  const shelf = getShelfById(shelfId, depotId);
  if (!shelf) return 0;
  const productsMap = getProductsForDepot(depotId);
  const { excludeDrawerKey = null, excludeProductIdx = null } = options;
  let total = 0;
  for (let floor = 1; floor <= shelf.floors; floor++) {
    for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
      const key = drawerKey(shelf.id, floor, drawer);
      const list = productsMap[key] || [];
      list.forEach((product, idx) => {
        if (key === excludeDrawerKey && excludeProductIdx !== null && idx === excludeProductIdx) return;
        total += parseFloat(product.kg) || 0;
      });
    }
  }
  return total;
}

function getDepotCapacityKg(depotId = activeDepotId) {
  return getShelvesForDepot(depotId).reduce((sum, shelf) => sum + getShelfCapacityKg(shelf), 0);
}

function getDepotDrawerCapacity(depotId = activeDepotId) {
  return getShelvesForDepot(depotId).reduce((sum, shelf) => sum + ((parseInt(shelf.floors, 10) || 0) * (parseInt(shelf.drawers, 10) || 0)), 0);
}

function getDepotUsedKg(depotId = activeDepotId, options = {}) {
  return getShelvesForDepot(depotId).reduce((sum, shelf) => {
    return sum + getShelfUsedKg(shelf.id, depotId, options);
  }, 0);
}

function buildCapacityError(title, detail, summary = {}) {
  return { ok: false, title, detail, summary };
}

const CAPACITY_EPSILON_KG = 0.11;

function normalizeDiscardDrawerKey(key = '') {
  const match = /^DESC(\d+)\.G1$/i.exec(String(key || '').trim());
  if (!match) return key;
  const drawer = parseInt(match[1], 10);
  if (!Number.isFinite(drawer) || drawer < 1 || drawer > 100) return key;
  return `DESC1.G${drawer}`;
}

function normalizeDiscardInventoryState() {
  const depotId = 'dep_discard';
  const depotProducts = productsAll?.[depotId];
  if (!depotProducts || typeof depotProducts !== 'object') return;
  const normalized = {};
  Object.entries(depotProducts).forEach(([rawKey, items]) => {
    const key = normalizeDiscardDrawerKey(rawKey);
    if (!normalized[key]) normalized[key] = [];
    normalized[key].push(...(Array.isArray(items) ? items : []));
  });
  productsAll[depotId] = normalized;
}

function validateDrawerPlacement({ depotId = activeDepotId, drawerKeyValue, incomingKg, sourceDrawerKey = null, sourceProductIdx = null, sourceDepotId = depotId, allowExistingSameDrawer = false }) {
  const parsed = parseKey(drawerKeyValue);
  if (!parsed) {
    return buildCapacityError('ENDEREÇO INVÁLIDO', 'O endereço informado não segue o padrão esperado.', { LOCAL: drawerKeyValue || '—' });
  }

  const shelf = getShelfById(parsed.shelf, depotId);
  if (!shelf) {
    return buildCapacityError('PRATELEIRA INEXISTENTE', 'A prateleira de destino não existe neste depósito.', { PRATELEIRA: parsed.shelf });
  }
  if (parsed.floor < 1 || parsed.floor > shelf.floors || parsed.drawer < 1 || parsed.drawer > shelf.drawers) {
    return buildCapacityError('POSIÇÃO INVÁLIDA', 'O andar ou a gaveta informados não existem nesta prateleira.', {
      PRATELEIRA: parsed.shelf,
      ANDAR: String(parsed.floor),
      GAVETA: String(parsed.drawer),
    });
  }

  if (getDepotById(depotId)?.allowOvercapacity) {
    return { ok: true, overcapacity: true };
  }

  const isSameDrawer = sourceDrawerKey === drawerKeyValue;
  const sameSourceDepot = sourceDrawerKey !== null && sourceProductIdx !== null && sourceDepotId === depotId;

  const drawerCapacity = getDrawerCapacityKg(drawerKeyValue, depotId);
  const drawerUsed = getDrawerUsedKg(drawerKeyValue, depotId, isSameDrawer && allowExistingSameDrawer ? sourceProductIdx : null);
  const drawerProjected = drawerUsed + incomingKg;
  if (drawerProjected - drawerCapacity > CAPACITY_EPSILON_KG) {
    return buildCapacityError('CAPACIDADE DA GAVETA EXCEDIDA', 'A movimentação ultrapassa a capacidade máxima da gaveta.', {
      LOCAL: drawerKeyValue,
      'ATUAL (KG)': drawerUsed.toFixed(2),
      'ENTRADA (KG)': incomingKg.toFixed(2),
      'CAP. MÁX (KG)': drawerCapacity.toFixed(2),
    });
  }

  const shelfUsed = getShelfUsedKg(parsed.shelf, depotId, sameSourceDepot
    ? { excludeDrawerKey: sourceDrawerKey, excludeProductIdx: sourceProductIdx }
    : {});
  const shelfCapacity = getShelfCapacityKg(shelf);
  const shelfProjected = shelfUsed + incomingKg;
  if (shelfProjected - shelfCapacity > CAPACITY_EPSILON_KG) {
    return buildCapacityError('CAPACIDADE DA PRATELEIRA EXCEDIDA', 'A prateleira atingiria peso acima do permitido.', {
      PRATELEIRA: parsed.shelf,
      'ATUAL (KG)': shelfUsed.toFixed(2),
      'ENTRADA (KG)': incomingKg.toFixed(2),
      'CAP. MÁX (KG)': shelfCapacity.toFixed(2),
    });
  }

  const depotUsed = getDepotUsedKg(depotId, sameSourceDepot
    ? { excludeDrawerKey: sourceDrawerKey, excludeProductIdx: sourceProductIdx }
    : {});
  const depotCapacity = getDepotCapacityKg(depotId);
  const depotProjected = depotUsed + incomingKg;
  if (depotProjected - depotCapacity > CAPACITY_EPSILON_KG) {
    return buildCapacityError('CAPACIDADE DO DEPÓSITO EXCEDIDA', 'O depósito ultrapassaria o limite total de carga.', {
      DEPÓSITO: getDepotById(depotId)?.name || depotId,
      'ATUAL (KG)': depotUsed.toFixed(2),
      'ENTRADA (KG)': incomingKg.toFixed(2),
      'CAP. MÁX (KG)': depotCapacity.toFixed(2),
    });
  }

  return { ok: true };
}


// ——— STATE ———
// ── Multi-depot: each depot has id, name, and its own shelves/products
let depots = [
  
];
let activeDepotId = null;

// shelves and products are now per-depot
// shelves['dep1'] = [...], products['dep1'] = {...}
let shelvesAll = {
  
};
let productsAll = {};

// Compatibility shims — shelves/products point to active depot
let shelves = [];
let products = {};

function ensureDepotState() {
  if (!Array.isArray(depots)) depots = [];
  if (!shelvesAll || typeof shelvesAll !== 'object') shelvesAll = {};
  if (!productsAll || typeof productsAll !== 'object') productsAll = {};
  normalizeDiscardDepotState();
  depots.forEach(d => {
    d.allowOvercapacity = !!d.allowOvercapacity;
    if (!Array.isArray(shelvesAll[d.id])) shelvesAll[d.id] = [];
    if (!productsAll[d.id] || typeof productsAll[d.id] !== 'object') productsAll[d.id] = {};
    shelvesAll[d.id] = shelvesAll[d.id].map(shelf => ({
      ...shelf,
      type: normalizeShelfType(shelf?.type),
    }));
  });
  if (!depots.some(d => d.id === activeDepotId)) activeDepotId = depots[0]?.id || null;
  shelves = activeDepotId ? (shelvesAll[activeDepotId] || []) : [];
  products = activeDepotId ? (productsAll[activeDepotId] || {}) : {};
  if (!Array.isArray(auditHistory)) auditHistory = [];
}

function saveAppState() {
  if (stateHydrating || syncInFlight) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    persistAppState().catch(err => console.error('Falha ao persistir estado do WMS:', err));
  }, 250);
}

async function persistAppState(force = false) {
  if ((stateHydrating || syncInFlight) && !force) return;
  syncInFlight = true;
  try {
    const response = await apiCall('/wms/inventory-state', 'PUT', {
      expected_revision: serverRevision,
      productsAll: deepClone(productsAll),
      history: deepClone(auditHistory),
    });
    if (response?.revision) serverRevision = response.revision;
    suppressAutoPersist = false;
    inventoryPersistBlockedReason = '';
  } catch (err) {
    const errMsg = String(err.message || '');
    if (errMsg.includes('Capacidade da gaveta excedida')) {
      if (inventoryPersistBlockedReason !== errMsg) {
        inventoryPersistBlockedReason = errMsg;
        showNotice({
          title: 'ESTOQUE ACIMA DA CAPACIDADE',
          icon: '⛔',
          desc: `${errMsg}. O sistema vai parar de tentar persistir automaticamente até você corrigir a lotação deste endereço.`,
        }).catch(() => {});
      }
      suppressAutoPersist = true;
      return;
    }
    if (String(err.message || '').includes('Estado desatualizado') || String(err.message || '').includes('Conflict')) {
      await showNotice({ title: 'CONFLITO DE EDIÇÃO', icon: '⛔', desc: 'Outro usuário alterou os dados antes desta gravação. O sistema vai recarregar o estado mais recente do banco.' });
      await loadAppState(false);
      renderAll();
      return;
    }
    throw err;
  } finally {
    syncInFlight = false;
  }
}

async function loadAppState(seedIfEmpty = false) {
  try {
    stateHydrating = true;
    const response = await apiCall('/wms/bootstrap');
    const data = response?.state || {};
    serverRevision = response?.revision || '0';
    const hasServerData = Array.isArray(data.depots) && data.depots.length > 0;
    if (!hasServerData) {
      depots = [];
      activeDepotId = null;
      shelvesAll = {};
      productsAll = {};
      auditHistory = [];
      outboundRecords = [];
      blindCountPool = [];
      blindCountRecords = [];
      blindUnloadDraft = null;
      activeBlindUnloadId = null;
      fpLayout = {};
      fpObjects = [];
      fpObjIdSeq = 0;
      ensureDepotState();
      stateHydrating = false;
      return false;
    }
    depots = Array.isArray(data.depots) ? data.depots : depots;
    activeDepotId = typeof data.activeDepotId === 'string' && data.activeDepotId ? data.activeDepotId : depots[0]?.id || activeDepotId;
    shelvesAll = data.shelvesAll && typeof data.shelvesAll === 'object' ? data.shelvesAll : shelvesAll;
    productsAll = data.productsAll && typeof data.productsAll === 'object' ? data.productsAll : productsAll;
    normalizeDiscardInventoryState();
    auditHistory = Array.isArray(data.history) ? data.history : auditHistory;
    outboundRecords = Array.isArray(data.outboundRecords) ? data.outboundRecords : [];
    blindCountRecords = Array.isArray(data.blindCountRecords) ? data.blindCountRecords : [];
    activeBlindUnloadId = typeof data.activeBlindUnloadId === 'string' ? data.activeBlindUnloadId : null;
    blindCountPool = [];
    blindUnloadDraft = null;
    const fp = data.floorplan || {};
    fpLayout = fp.layout || {};
    fpObjects = fp.objects || [];
    fpObjIdSeq = fp.objSeq || fpObjects.length || 0;
    ensureDepotState();
    await loadOperationalState();
    return true;
  } catch (err) {
    console.error('Falha ao carregar estado do WMS:', err);
    return null;
  } finally {
    stateHydrating = false;
  }
}

async function loadOperationalState() {
  const [inventoryResult, unloadsResult, outboundResult] = await Promise.allSettled([
    apiCall('/wms/inventory-state'),
    apiCall('/wms/unloads-state'),
    apiCall('/wms/outbound-records-state'),
  ]);
  if (inventoryResult.status === 'fulfilled') {
    const inventoryResponse = inventoryResult.value;
    productsAll = inventoryResponse?.productsAll && typeof inventoryResponse.productsAll === 'object' ? inventoryResponse.productsAll : productsAll;
    normalizeDiscardInventoryState();
    auditHistory = Array.isArray(inventoryResponse?.history) ? inventoryResponse.history : auditHistory;
  } else {
    console.error('Falha ao carregar inventário incremental do WMS:', inventoryResult.reason);
  }
  if (unloadsResult.status === 'fulfilled') {
    const unloadsResponse = unloadsResult.value;
    blindCountRecords = Array.isArray(unloadsResponse?.blindCountRecords) ? unloadsResponse.blindCountRecords : blindCountRecords;
    activeBlindUnloadId = typeof unloadsResponse?.activeBlindUnloadId === 'string' ? unloadsResponse.activeBlindUnloadId : activeBlindUnloadId;
    setActiveBlindUnload(activeBlindUnloadId);
  } else {
    console.error('Falha ao carregar descargas incrementais do WMS:', unloadsResult.reason);
  }
  if (outboundResult.status === 'fulfilled') {
    const outboundResponse = outboundResult.value;
    outboundRecords = Array.isArray(outboundResponse?.outboundRecords) ? outboundResponse.outboundRecords : outboundRecords;
  } else {
    console.error('Falha ao carregar saídas incrementais do WMS:', outboundResult.reason);
  }
  ensureDepotState();
}

async function persistBlindUnloadsState() {
  const currentBlind = getBlindCurrentDraft();
  if (currentBlind) currentBlind.poolItems = deepClone(blindCountPool);
  const response = await apiCall('/wms/unloads-state', 'PUT', {
    expected_revision: serverRevision,
    blindCountRecords: deepClone(blindCountRecords),
    activeBlindUnloadId,
  });
  if (response?.revision) serverRevision = response.revision;
}

async function persistOutboundRecordsState() {
  const response = await apiCall('/wms/outbound-records-state', 'PUT', {
    expected_revision: serverRevision,
    outboundRecords: deepClone(outboundRecords),
  });
  if (response?.revision) serverRevision = response.revision;
}

async function persistStructureState() {
  const response = await apiCall('/wms/structure-state', 'PUT', {
    expected_revision: serverRevision,
    depots: deepClone(depots),
    activeDepotId,
    shelvesAll: deepClone(shelvesAll),
  });
  if (response?.revision) serverRevision = response.revision;
}

async function persistFloorplanState() {
  const response = await apiCall('/wms/floorplan-state', 'PUT', {
    expected_revision: serverRevision,
    floorplan: {
      layout: deepClone(fpLayout),
      objects: deepClone(fpObjects),
      objSeq: fpObjIdSeq,
    },
  });
  if (response?.revision) serverRevision = response.revision;
}

function switchDepot(depotId) {
  if (!shelvesAll[depotId])  { shelvesAll[depotId]  = []; }
  if (!productsAll[depotId]) { productsAll[depotId] = {}; }
  activeDepotId = depotId;
  shelves  = shelvesAll[depotId];
  products = productsAll[depotId];
  selectedProductCode = null;
  selectedShelfId = null;
  sbFilter = '';
  renderAll(true);
  renderDepotTabs();
  persistStructureState().catch(err => console.error('Falha ao persistir troca de depósito:', err));
}

function addDepot(name) { openDepotModal(null); }

async function removeDepot(id) {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode excluir depósitos.')) return;
  normalizeDiscardDepotState();
  if (depots.length <= 1) {
    await showNotice({ title: 'OPERAÇÃO BLOQUEADA', icon: '⛔', desc: 'Não é possível remover o único depósito cadastrado.' });
    return;
  }
  const depot = depots.find(d => d.id === id);
  if (id === 'dep_discard') {
    await showNotice({ title: 'DEPÓSITO FIXO', icon: '⛔', desc: 'O depósito de descarte é estrutural do sistema e não pode ser removido.' });
    return;
  }
  const slist = shelvesAll[id] || [];
  const p     = productsAll[id] || {};
  const prodCount  = Object.values(p).reduce((s, a) => s + a.length, 0);
  const skuCount   = new Set(Object.values(p).flat().map(pr => pr.code)).size;
  if (prodCount > 0) {
    await showNotice({
      title: 'DEPÓSITO COM PRODUTOS',
      icon: '⛔',
      desc: `Não é possível excluir "${depot?.name}" enquanto houver produtos armazenados.`,
      summary: { PRODUTOS: String(prodCount), SKUS: String(skuCount) },
    });
    return;
  }
  if (slist.length > 0) {
    await showNotice({
      title: 'DEPÓSITO COM PRATELEIRAS',
      icon: '⛔',
      desc: `Não é possível excluir "${depot?.name}" enquanto houver prateleiras cadastradas.`,
      summary: { PRATELEIRAS: String(slist.length), CÓDIGOS: slist.map(item => item.id).join(', ') || '—' },
    });
    return;
  }
  const ok = await showConfirm({
    title: 'EXCLUIR DEPÓSITO', icon: '🗑',
    desc: 'Esta ação é permanente. O depósito será removido do sistema.',
    summary: { 'NOME': depot?.name||id, 'PRATELEIRAS': slist.length, 'PRODUTOS': prodCount },
    okLabel: 'EXCLUIR', okStyle: 'danger'
  });
  if (!ok) return;
  depots = depots.filter(d => d.id !== id);
  delete shelvesAll[id]; delete productsAll[id];
  Object.keys(fpLayout || {}).forEach(key => { if (key.startsWith(`${id}::`)) delete fpLayout[key]; });
  fpObjects = (fpObjects || []).filter(obj => obj.depotId !== id);
  const removedWasActive = activeDepotId === id;
  if (removedWasActive && depots[0]?.id) activeDepotId = depots[0].id;
  await Promise.all([
    persistStructureState(),
    persistFloorplanState(),
  ]);
  if (removedWasActive && depots[0]?.id) switchDepot(depots[0].id);
  else { renderDepotTabs(); renderAll(true); }
}

function renameDepot(id) { openDepotModal(id); }

function getCurrentPageName() {
  const activePage = document.querySelector('.page.active');
  return activePage?.id?.replace(/^page-/, '') || 'depot';
}

function canOpenPage(name) {
  if (!name) return false;
  if (name === 'saidas') return hasPermission('shipment.process') || hasPermission('discard.process');
  if (name === 'separation') return hasPermission('shipment.process');
  if (name === 'unloads') return hasBlindCountAccess();
  if (name === 'receiving') return hasPermission('entry.register');
  if (name === 'unload-review') return canReviewBlindUnloads();
  return true;
}

function getVisibleNavPages() {
  return Array.from(document.querySelectorAll('.nav-rail .nav-btn[data-page]'))
    .filter(btn => {
      if (!btn.id?.startsWith('nav-')) return false;
      if (btn.disabled) return false;
      const style = getComputedStyle(btn);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map(btn => btn.dataset.page)
    .filter(Boolean);
}

function getFallbackPageName(preferred = '') {
  if (preferred && canOpenPage(preferred)) {
    const preferredBtn = document.getElementById(`nav-${preferred}`);
    if (preferredBtn && getComputedStyle(preferredBtn).display !== 'none') return preferred;
  }
  return getVisibleNavPages().find(pageName => canOpenPage(pageName)) || 'depot';
}

function ensurePageNavigationConsistency(preferredPage = '') {
  const current = getCurrentPageName();
  const pageName = document.getElementById(`page-${current}`) ? current : '';
  const btn = pageName ? document.getElementById(`nav-${pageName}`) : null;
  const currentVisible = pageName && canOpenPage(pageName) && (!btn || getComputedStyle(btn).display !== 'none');
  const target = currentVisible ? pageName : getFallbackPageName(preferredPage || pageName || 'depot');
  if (!target) return;
  if (target !== pageName) {
    showPage(target);
    return;
  }
  const page = document.getElementById(`page-${target}`);
  if (page && !page.classList.contains('active')) page.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(node => {
    const active = node.dataset.page === target;
    node.classList.toggle('active', active);
    if (active) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
}

function applyDepotContextForCurrentPage(depotId) {
  const pageName = getCurrentPageName();
  depotTabsContextId = depotId;
  if (pageName === 'depots') {
    renderDepotTabs();
    renderDepotsPage();
    return;
  }
  if (pageName === 'floorplan') {
    fpSwitchDepot(depotId);
    renderDepotTabs();
    return;
  }
  if (pageName === 'quality') {
    const select = byId('quality-filter-depot');
    if (select) select.value = depotId === ALL_DEPOTS_VALUE ? '' : depotId;
    renderQualityPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'history') {
    const select = byId('history-filter-depot');
    if (select) select.value = depotId === ALL_DEPOTS_VALUE ? '' : (getDepotById(depotId)?.name || depotId);
    renderPageHistory();
    renderDepotTabs();
    return;
  }
  if (pageName === 'saidas') {
    const select = byId('shipping-source-depot');
    if (select) select.value = depotId;
    renderShippingPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'products') {
    renderProductsPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'unloads') {
    renderUnloadsPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'unload-review') {
    renderUnloadReviewPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'outbound') {
    renderOutboundRecordsPage();
    renderDepotTabs();
    return;
  }
  if (pageName === 'depot') {
    if (depotId === ALL_DEPOTS_VALUE) {
      depotTabsContextId = ALL_DEPOTS_VALUE;
      renderAll(true);
      renderDepotTabs();
      return;
    }
    depotTabsContextId = depotId;
    switchDepot(depotId);
    return;
  }
  if (depotId === ALL_DEPOTS_VALUE) {
    renderDepotTabs();
    return;
  }
  switchDepot(depotId);
}

function renderDepotTabs() {
  const bar = document.getElementById('depot-tabs-bar');
  if (!bar) return;
  const pageName = getCurrentPageName();
  const supportedPages = new Set(['depot', 'depots', 'unloads', 'unload-review', 'saidas', 'products', 'floorplan', 'quality', 'outbound', 'history']);
  const shouldHide = !supportedPages.has(pageName);
  bar.style.display = shouldHide ? 'none' : '';
  if (shouldHide) {
    bar.replaceChildren();
    return;
  }
  const canManageDepots = hasPermission('settings.manage');
  const depotsPageActive = pageName === 'depots';
  bar.replaceChildren();

  const allTab = document.createElement('div');
  const currentSelection = pageName === 'floorplan'
    ? (fpShowAllDepots ? ALL_DEPOTS_VALUE : (fpViewDepotId || activeDepotId))
    : getDepotTabsContextId();
  allTab.className = `depot-tab ${currentSelection === ALL_DEPOTS_VALUE || depotsPageActive ? 'active' : ''}`.trim();
  allTab.title = 'Visão consolidada de todos os depósitos';
  allTab.addEventListener('click', () => applyDepotContextForCurrentPage(ALL_DEPOTS_VALUE));
  const allLabel = document.createElement('span');
  allLabel.textContent = 'TODOS OS DEPÓSITOS';
  allTab.appendChild(allLabel);
  bar.appendChild(allTab);

  depots.forEach(d => {
    const tab = document.createElement('div');
    tab.className = `depot-tab ${d.id === currentSelection ? 'active' : ''} ${isDiscardDepot(d) ? 'discard' : ''}`.trim();
    tab.addEventListener('click', () => applyDepotContextForCurrentPage(d.id));

    const label = document.createElement('span');
    label.textContent = d.name || d.id;
    tab.appendChild(label);

    if (canManageDepots) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'depot-tab-edit';
      editBtn.title = 'Renomear';
      editBtn.textContent = '✏';
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        renameDepot(d.id);
      });
      tab.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'depot-tab-del';
      delBtn.title = 'Remover';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', event => {
        event.stopPropagation();
        removeDepot(d.id);
      });
      tab.appendChild(delBtn);
    }

    bar.appendChild(tab);
  });
  if (canManageDepots) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'depot-tab-add';
    addBtn.title = 'Adicionar depósito';
    addBtn.textContent = '+ DEPÓSITO';
    addBtn.addEventListener('click', () => openDepotModal(null));
    bar.appendChild(addBtn);
  }
}
// products is now productsAll[activeDepotId] — see shim above
let auditHistory = []; // { ts, action, detail, icon, user, depotId, depotName, from, to, shelfId, drawerKey, productCode }
let selectedProductCode = null;
let currentDrawerKey = null;
let moveProductIdx = null;
let moveFromKey = null;
let dpExpiries = [];   // working list for drawer modal add form
let gpExpiries = [];   // working list for global add product modal
let dateEditCtx = null; // { list, idx, renderFn }
let selectedEditIdx = null; // product index being edited in drawer modal
let poSortCol = 'code'; let poSortDir = 1;
let focusedDrawerKey = null;
let qualityMoveCtx = null;
let shippingSelected = { depotId: null, drawerKey: null };
let shippingAddCtx = null;
let shippingDragCtx = null;
let outboundEditIdx = null;
let outboundCart = [];
let appToastTimer = null;
let outboundRecords = [];
let blindCountSelected = { depotId: null, drawerKey: null };
let blindCountFocusedItemId = null;
let blindCountAllocationCtx = null;
let blindCountDragItemId = null;
let blindCountPool = [];
let blindCountRecords = [];
let blindUnloadDraft = null;
let activeBlindUnloadId = null;
let blindTimerInterval = null;
let blindPendingInvoiceBarcodes = [];
let blindPendingVehiclePlate = '';
let separationDraftItems = [];
let separationLookupResults = [];
let separationSelectedLookupItem = null;
let separationRecentRequests = [];
let separationSelectedRequestId = null;
let separationSelectedRequestDetail = null;
let separationLoadedOnce = false;
let separationSearchTimer = null;
let separationSearchRequestId = 0;
let receivingSession = null;
let receivingItems = [];
let receivingTimerInterval = null;
let receivingStartedAt = null;
let receivingStep = 1;
let receivingAvailableNfes = [];
let receivingHistoryRecords = [];
let receivingSelectedNfe = null;
let receivingClosePreview = null;
let receivingDoubleCheckRequired = false;

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

function bindStaticUiControls() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => showPage(el.dataset.page));
  });
  byId('btn-header-logout')?.addEventListener('click', () => logout());
  document.querySelectorAll('[data-tab-target]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tabTarget));
  });
  byId('product-search-input')?.addEventListener('input', () => renderProductTable());
  document.querySelectorAll('[data-sb-filter]').forEach(el => {
    el.addEventListener('click', () => setSbFilter(el.dataset.sbFilter || ''));
  });
  document.querySelectorAll('[data-sb-sort]').forEach(el => {
    el.addEventListener('click', () => setSbSort(el.dataset.sbSort));
  });
  byId('focus-clear-btn')?.addEventListener('click', () => clearFocus());
  document.querySelectorAll('[data-scope]').forEach(el => {
    el.addEventListener('click', () => setScope(el.dataset.scope));
  });
  byId('grid-search')?.addEventListener('input', () => applyFilters());
  byId('grid-search-clear')?.addEventListener('click', () => clearSearch());
  document.querySelectorAll('[data-filter-chip]').forEach(el => {
    el.addEventListener('click', () => toggleChip(el.dataset.filterChip));
  });
  byId('depot-filters-clear-btn')?.addEventListener('click', () => clearAllFilters());
  const blindLookup = byId('bcp-product-lookup');
  blindLookup?.addEventListener('input', event => handleBlindProductLookupInput(event.target.value));
  blindLookup?.addEventListener('focus', event => handleBlindProductLookupInput(event.target.value));
  blindLookup?.addEventListener('blur', () => scheduleHideBlindProductLookupMenu());
  byId('bcp-qty')?.addEventListener('input', () => syncWeightFields('bcp', 'qty'));
  byId('bcp-kg-unit')?.addEventListener('input', () => syncWeightFields('bcp', 'qty'));
  byId('bcp-kg-total')?.addEventListener('input', () => syncWeightFields('bcp', 'kg'));
  byId('blind-pool-close-btn')?.addEventListener('click', () => closeBlindPoolModal());
  byId('blind-pool-cancel-btn')?.addEventListener('click', () => closeBlindPoolModal());
  byId('blind-pool-save-btn')?.addEventListener('click', () => saveBlindPoolItem());
  byId('bca-qty')?.addEventListener('input', () => syncBlindAllocateFields('qty'));
  byId('bca-kg-total')?.addEventListener('input', () => syncBlindAllocateFields('kg'));
  byId('blind-allocate-close-btn')?.addEventListener('click', () => closeBlindAllocateModal());
  byId('blind-allocate-cancel-btn')?.addEventListener('click', () => closeBlindAllocateModal());
  byId('blind-allocate-confirm-btn')?.addEventListener('click', () => confirmBlindAllocation());
}






// ══ PRODUCT DETAIL MODAL ═════════════════════════════════════════════
let currentViewedProduct = null;

function openProductDetail(code) {
  const allProds = productsAll[activeDepotId] || products;
  const instances = [];
  Object.entries(allProds).forEach(([key, prods]) => {
    prods.forEach((p) => { if (p.code === code) instances.push({key, p}); });
  });
  if (!instances.length) return;
  const first = instances[0].p;
  currentViewedProduct = first;

  const editBtn = document.getElementById('pdm-edit-btn');
  if (editBtn) editBtn.style.display = canManageProducts() ? '' : 'none';

  document.getElementById('pdm-title').textContent = first.code + ' — ' + first.name;
  const stKey = productExpiryStatus(first);
  const stLabel = stKey==='expired'?'VENCIDO':stKey==='expiring'?'A VENCER':stKey==='ok'?'OK':'SEM VALIDADE';
  document.getElementById('pdm-subtitle').textContent = instances.length + ' entrada(s) · Status: ' + stLabel;
  const body = document.getElementById('pdm-body');
  let h2 = '<div class="pdm-section"><div class="pdm-section-title">IDENTIFICAÇÃO</div><div class="pdm-grid">';
  [['CÓDIGO',first.code],['EAN/GTIN',first.ean||'—'],['SKU',first.sku||'—'],
   ['NCM',first.ncm||'—'],['ANVISA',first.anvisa||'—'],['FAMÍLIA',first.family||'—'],['GRUPO',first.category||'—'],
   ['MARCA',first.brand||'—'],['FABRICANTE',first.manufacturer||'—'],['MODELO',first.model||'—'],
   ['FORNECEDOR',first.supplier||'—'],['UNIDADE',first.unit||'un'],
   ['PERECÍVEL',first.perishable==='yes'?'Sim':first.perishable==='frozen'?'Congelado':'Não'],
   ['CONTROLE SÉRIE', first.serialControl==='serial'?'Serial':first.serialControl==='lot'?'Lote':'Não']
  ].forEach(([l,v]) => { h2 += '<div class="pdm-field"><span class="pdm-label">'+escapeHtml(l)+'</span><span class="pdm-value">'+escapeHtml(v)+'</span></div>'; });
  h2 += '</div></div>';
  if (first.cost!=null||first.price!=null) {
    h2 += '<div class="pdm-section"><div class="pdm-section-title">FINANCEIRO</div><div class="pdm-grid">';
    if(first.cost!=null)  h2 += '<div class="pdm-field"><span class="pdm-label">CUSTO</span><span class="pdm-value">R$ '+escapeHtml(parseFloat(first.cost).toFixed(2))+'</span></div>';
    if(first.price!=null) h2 += '<div class="pdm-field"><span class="pdm-label">PREÇO</span><span class="pdm-value accent">R$ '+escapeHtml(parseFloat(first.price).toFixed(2))+'</span></div>';
    h2 += '</div></div>';
  }
  if (first.tempMax!=null||first.tempMin!=null||first.notes) {
    h2 += '<div class="pdm-section"><div class="pdm-section-title">ARMAZENAMENTO</div><div class="pdm-grid">';
    if(first.tempMax!=null) h2 += '<div class="pdm-field"><span class="pdm-label">TEMP. MÁX</span><span class="pdm-value">'+escapeHtml(String(first.tempMax))+'°C</span></div>';
    if(first.tempMin!=null) h2 += '<div class="pdm-field"><span class="pdm-label">TEMP. MÍN</span><span class="pdm-value">'+escapeHtml(String(first.tempMin))+'°C</span></div>';
    if(first.minStock!=null) h2 += '<div class="pdm-field"><span class="pdm-label">ESTOQUE MÍN</span><span class="pdm-value">'+escapeHtml(String(first.minStock))+'</span></div>';
    if(first.reorderPoint!=null) h2 += '<div class="pdm-field"><span class="pdm-label">REPOSIÇÃO</span><span class="pdm-value">'+escapeHtml(String(first.reorderPoint))+'</span></div>';
    if(first.maxStock!=null) h2 += '<div class="pdm-field"><span class="pdm-label">ESTOQUE MÁX</span><span class="pdm-value">'+escapeHtml(String(first.maxStock))+'</span></div>';
    if(first.lengthCm!=null || first.widthCm!=null || first.heightCm!=null) h2 += '<div class="pdm-field"><span class="pdm-label">DIMENSÕES</span><span class="pdm-value">'+[first.lengthCm||'—', first.widthCm||'—', first.heightCm||'—'].map(v=>escapeHtml(String(v))).join(' × ')+' cm</span></div>';
    if(first.notes) h2 += '<div class="pdm-field" style="grid-column:1/-1"><span class="pdm-label">OBS.</span><span class="pdm-value" style="font-weight:400">'+escapeHtml(first.notes)+'</span></div>';
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
      +'<div style="flex:1"><span style="font-size:10px;color:var(--text2)">'+escapeHtml((p.qty||1)+' un · '+(p.kgTotal ?? p.kg ?? 0)+'kg total · '+(p.kgPerUnit ?? ((p.qty||1)?((parseFloat(p.kg||0)/(p.qty||1)).toFixed(3)):0))+'kg/un · Lote: '+(p.lot||'—')+' · Entrada: '+(p.entry?fmtDate(p.entry):'—'))+'</span><br>'
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
    const depotId = ev?.currentTarget?.dataset?.depot || activeDepotId;
    const depotLabel = getDepotById(depotId)?.name || depotId;
    const prods = getDrawerProductsForDepotView(depotId, key);
    let inner = '<div class="dtt-key">'+escapeHtml(isDepotPageAllContext() ? `${depotLabel} · ${key}` : key)+'</div>';
    if (!prods.length) {
      inner += '<div class="dtt-empty">Gaveta vazia</div>';
    } else {
      prods.forEach(p => {
        const st = productExpiryStatus(p);
        const ne = nearestExpiry(p);
        const dot = st==='expired'?'🔴':st==='expiring'?'🟡':'🟢';
        const days = ne ? (daysUntil(ne)===null?'':daysUntil(ne)<0?' (VENC.)':' ('+daysUntil(ne)+'d)') : '';
        inner += '<div class="dtt-prod">'+dot+' <strong>'+escapeHtml(p.code)+'</strong> '+escapeHtml(p.name.slice(0,22))+escapeHtml(days)+'</div>';
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
  if (!await requirePermission('settings.manage', 'Seu perfil não pode criar ou editar depósitos.')) return;
  const name = sanitizeTextInput(readInputValue('dm-name'), { maxLength: 80 });
  if (!name) {
    await showNotice({ title: 'CAMPO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o nome do depósito antes de salvar.' });
    return;
  }
  const data = {
    name,
    address: sanitizeTextInput(readInputValue('dm-address'), { maxLength: 140 }),
    city:    sanitizeTextInput(readInputValue('dm-city'), { maxLength: 80 }),
    manager: sanitizeTextInput(readInputValue('dm-manager'), { maxLength: 80 }),
    phone:   sanitizeTextInput(readInputValue('dm-phone'), { maxLength: 40 }),
    notes:   sanitizeTextInput(readInputValue('dm-notes'), { maxLength: 240 }),
    allowOvercapacity: !!byId('dm-allow-overcapacity')?.checked,
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
    await persistStructureState();
    closeDepotModal();
    renderDepotTabs();
    renderDepotsPage();
    switchDepot(id);
    return;
  }
  await persistStructureState();
  closeDepotModal();
  renderDepotTabs();
  renderDepotsPage();
  renderAll(true);
}

// Fix openDepotModal to set depotModalEditId correctly

// ══ FLOOR PLAN ════════════════════════════════════════════════════════

// ─── State ────────────────────────────────────────────────────────────
let fpLayout   = {};      // { shelfId: {x,y} }
let fpObjects  = [];      // [{ id,type,style,text,x,y,w,h }]
let fpEditMode = false;
let fpSnapOn   = false;
const FP_GRID  = 40;
const FP_CARD_W = 140;
let fpObjIdSeq  = 0;
let fpSnapshot  = null;
let fpUndoStack = [];   // array of {layout, objects, objSeq} snapshots
let fpRedoStack = [];   // redo stack
const FP_MAX_HISTORY = 50;

function fpHistoryPush() {
  // push current state onto undo stack
  fpUndoStack.push(structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq, shelvesAll }));
  if (fpUndoStack.length > FP_MAX_HISTORY) fpUndoStack.shift();
  fpRedoStack = []; // any new action clears redo
  fpUpdateUndoButtons();
}

function fpUndo() {
  if (!hasPermission('layout.edit')) return;
  if (!fpUndoStack.length) return;
  // push current to redo
  fpRedoStack.push(structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq, shelvesAll }));
  const prev = fpUndoStack.pop();
  fpLayout   = prev.layout   || {};
  fpObjects  = prev.objects  || [];
  fpObjIdSeq = prev.objSeq   || 0;
  if (prev.shelvesAll) {
    shelvesAll = prev.shelvesAll;
    // update shims
    shelves = shelvesAll[activeDepotId] || [];
    products = productsAll[activeDepotId] || {};
  }
  fpUpdateUndoButtons();
  renderFloorPlan();
}

function fpRedo() {
  if (!hasPermission('layout.edit')) return;
  if (!fpRedoStack.length) return;
  fpUndoStack.push(structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq, shelvesAll }));
  const next = fpRedoStack.pop();
  fpLayout   = next.layout   || {};
  fpObjects  = next.objects  || [];
  fpObjIdSeq = next.objSeq   || 0;
  if (next.shelvesAll) {
    shelvesAll = next.shelvesAll;
    // update shims
    shelves = shelvesAll[activeDepotId] || [];
    products = productsAll[activeDepotId] || {};
  }
  fpUpdateUndoButtons();
  renderFloorPlan();
}

function fpUpdateUndoButtons() {
  const undoBtn = document.getElementById('fp-undo-btn');
  const redoBtn = document.getElementById('fp-redo-btn');
  if (undoBtn) { undoBtn.disabled = fpUndoStack.length === 0; undoBtn.style.opacity = fpUndoStack.length?'1':'.35'; }
  if (redoBtn) { redoBtn.disabled = fpRedoStack.length === 0; redoBtn.style.opacity = fpRedoStack.length?'1':'.35'; }
}

let fpFocusedShelf = null;
let fpFocusedDepotId = null;
let fpRenderShelfMap = {};
let fpScale     = 1;
let fpSearchQuery  = '';
let fpSearchFilter = '';

// drag: kind = 'shelf'|'obj'|'pan'
let fpDrag     = null;
let fpResizing = null;

// ── Multi-select state ──
let fpSelection = new Set(); // Set of { kind:'shelf'|'obj', id:string }
let fpLasso     = null;      // { startX, startY, x, y, w, h } in world coords

// active placement tool
let fpActiveTool = null; // null | 'textbox'|'street'|'blocked'|'zone'|'entry'

// ─── Object z-index rules ─────────────────────────────────────────────
// street  → z=1  (bottom)
// zone    → z=2  (above streets)
// textbox → z=3  (labels)
// shelf   → z=4  (above zones)
// blocked → z=5  (above everything, blocks shelves)
// entry   → z=5  (same as blocked, blocks shelves)
const FP_OBJ_Z = { street:1, zone:2, textbox:3, blocked:5, entry:5 };
const SHELF_Z  = 4;

// Objects that prevent shelves from overlapping
function fpIsBlocker(obj) { return obj.type==='blocked' || obj.type==='entry' || obj.type==='street'; }
// Objects that zone-allow (shelf can sit on top visually)
function fpIsUnder(obj)   { return obj.type==='zone' || obj.type==='street' || obj.type==='textbox'; }

// ─── Sizing helpers ───────────────────────────────────────────────────
function fpCardH(shelf) { return 100; } // fp-shelf-card is always ~100px tall (compact summary)
function fpSnap(v) { return fpSnapOn ? Math.round(v/FP_GRID)*FP_GRID : v; }

// ─── Coordinate helpers ───────────────────────────────────────────────
function fpS2W(sx, sy) {
  const c = document.getElementById('fp-canvas');
  if (!c) return {x:0,y:0};
  const r = c.getBoundingClientRect();
  return { x:(sx-r.left+c.scrollLeft)/fpScale, y:(sy-r.top+c.scrollTop)/fpScale };
}

// ─── Collision ────────────────────────────────────────────────────────
function fpRects(a, b) {
  return a.x+a.w > b.x && b.x+b.w > a.x && a.y+a.h > b.y && b.y+b.h > a.y;
}
function fpCollidesShelf(shelfId, tx, ty, shList) {
  const shelf = shList.find(s=>s.id===shelfId); if (!shelf) return false;
  const sr = {x:tx, y:ty, w:FP_CARD_W, h:fpCardH(shelf)};
  // blockers (blocked + entry)
  for (const o of fpObjects)
    if (fpIsBlocker(o) && fpRects(sr, {x:o.x,y:o.y,w:o.w,h:o.h})) return true;
  // other shelves
  for (const s of shList) {
    if (s.id===shelfId) continue;
    const sp = fpLayout[getScopedShelfId(s.id, activeDepotId)]; if (!sp) continue;
    if (fpRects(sr, {x:sp.x,y:sp.y,w:FP_CARD_W,h:fpCardH(s)})) return true;
  }
  return false;
}
function fpCollides(shelfId, tx, ty) {
  const did = fpGetViewDepotId();
  const sl  = did ? (shelvesAll[did]||[]) : Object.values(shelvesAll).flat();
  return fpCollidesShelf(shelfId, tx, ty, sl);
}

// ─── Zoom & transform ─────────────────────────────────────────────────
function fpApplyTransform() {
  const inner = document.getElementById('fp-canvas-inner');
  if (inner) {
    const W = 6000, H = 4000;
    inner.style.width  = (W * fpScale) + 'px';
    inner.style.height = (H * fpScale) + 'px';
    inner.style.transform = `scale(${fpScale})`;
    inner.style.transformOrigin = '0 0';
  }
  const p = document.getElementById('fp-zoom-pct');
  if (p) p.textContent = Math.round(fpScale*100)+'%';
}
function fpZoom(delta, cx, cy) {
  const c = document.getElementById('fp-canvas'); if (!c) return;
  const ns = Math.max(0.15, Math.min(3, fpScale+delta)); if (ns===fpScale) return;
  const r = c.getBoundingClientRect();
  const px = (cx!=null ? cx-r.left : r.width/2);
  const py = (cy!=null ? cy-r.top  : r.height/2);
  // world point under cursor before scale change
  const wx = (c.scrollLeft + px) / fpScale;
  const wy = (c.scrollTop  + py) / fpScale;
  fpScale = ns;
  fpApplyTransform();
  // scroll so same world point stays under cursor
  requestAnimationFrame(() => {
    c.scrollLeft = wx * fpScale - px;
    c.scrollTop  = wy * fpScale - py;
  });
}
function fpZoomReset() {
  const c = document.getElementById('fp-canvas'); if (!c) return;
  fpScale=1; fpApplyTransform();
  requestAnimationFrame(() => { c.scrollLeft=0; c.scrollTop=0; });
}

// ─── Edit mode ────────────────────────────────────────────────────────
function fpEnterEditMode() {
  if (!hasPermission('layout.edit')) return;
  if (fpShowAllDepots) {
    showNotice({
      title: 'EDIÇÃO BLOQUEADA',
      icon: '⛔',
      desc: 'Edite a planta baixa de um depósito por vez. Selecione um depósito específico antes de entrar em modo de edição.',
    });
    return;
  }
  fpEditMode = true;
  fpUndoStack = []; fpRedoStack = [];
  fpSnapshot = structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq });
  document.getElementById('fp-view-tools').style.display = 'none';
  document.getElementById('fp-edit-tools').style.display = 'flex';
  document.getElementById('fp-canvas')?.classList.add('edit-mode');
  renderFloorPlan();
}
async function fpExitEditMode() {
  if (!hasPermission('layout.edit')) return;
  fpCancelTool();
  fpEditMode = false; fpDrag = null; fpResizing = null;
  document.getElementById('fp-view-tools').style.display = 'flex';
  document.getElementById('fp-edit-tools').style.display = 'none';
  document.getElementById('fp-canvas')?.classList.remove('edit-mode');
  await fpSaveLayout();
  fpSnapshot = structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq });
  renderFloorPlan();
}
function fpToggleSnap() {
  if (!hasPermission('layout.edit')) return;
  fpSnapOn = !fpSnapOn;
  const b = document.getElementById('fp-snap-btn');
  if (b) { b.textContent='⊞ SNAP:'+(fpSnapOn?'ON':'OFF'); b.classList.toggle('active',fpSnapOn); }
  document.getElementById('page-floorplan')?.classList.toggle('fp-snap-on', fpSnapOn);
}

// ─── Tool selection & placement ───────────────────────────────────────
const FP_OBJ_DEF = {
  textbox: {w:120,h:44, text:'TEXTO',          style:'label' },
  street:  {w:360,h:60, text:'RUA / CORREDOR',  style:'street'},
  blocked: {w:160,h:120,text:'BLOQUEADO',        style:'block' },
  zone:    {w:200,h:160,text:'ZONA',             style:'zone'  },
  entry:   {w:100,h:50, text:'🚪 ENTRADA/SAÍDA', style:'entry' },
};

function fpSelectTool(type) {
  if (!hasPermission('layout.edit')) return;
  if (fpActiveTool===type) { fpCancelTool(); return; }
  fpActiveTool = type;
  // update button states
  Object.keys(FP_OBJ_DEF).forEach(t => {
    const b = document.getElementById('fptool-'+t);
    if (b) b.classList.toggle('placing-active', t===type);
  });
  document.getElementById('fp-canvas')?.classList.add('placing');
  // prepare preview element
  _fpUpdatePreview(type);
}

function fpCancelTool() {
  fpActiveTool = null;
  Object.keys(FP_OBJ_DEF).forEach(t => document.getElementById('fptool-'+t)?.classList.remove('placing-active'));
  document.getElementById('fp-canvas')?.classList.remove('placing');
  const prev = document.getElementById('fp-place-preview');
  if (prev) prev.style.display = 'none';
}

function _fpUpdatePreview(type) {
  const prev = document.getElementById('fp-place-preview');
  if (!prev) return;
  const d = FP_OBJ_DEF[type];
  // apply correct classes
  const typeClass = type==='street' ? 'fp-street'
                  : type==='blocked'? 'fp-blocked'
                  : 'fp-textbox style-'+d.style;
  prev.className = typeClass;
  prev.id = 'fp-place-preview'; // keep id
  prev.style.width  = d.w+'px';
  prev.style.height = d.h+'px';
  prev.style.display= 'none';
  prev.textContent  = d.text;
}

function fpMovePreview(sx, sy) {
  if (!fpActiveTool) return;
  const prev = document.getElementById('fp-place-preview');
  if (!prev) return;
  const c = document.getElementById('fp-canvas');
  // check if mouse is over canvas
  const hit = document.elementFromPoint(sx, sy);
  if (!c || !c.contains(hit)) { prev.style.display='none'; return; }
  const d = FP_OBJ_DEF[fpActiveTool];
  // snap in world coords, convert back to screen for display
  const w  = fpS2W(sx, sy);
  const nx = fpSnap(w.x), ny = fpSnap(w.y);
  const r  = c.getBoundingClientRect();
  // screen position of snapped world point
  const screenX = (nx * fpScale) - c.scrollLeft + r.left;
  const screenY = (ny * fpScale) - c.scrollTop  + r.top;
  prev.style.left    = screenX + 'px';
  prev.style.top     = screenY + 'px';
  prev.style.width   = (d.w * fpScale) + 'px';
  prev.style.height  = (d.h * fpScale) + 'px';
  prev.style.display = 'flex';
}

function fpPlaceObject(wx, wy) {
  if (!fpActiveTool || !fpEditMode) return;
  fpHistoryPush();
  const type = fpActiveTool;
  const d    = FP_OBJ_DEF[type];
  const obj  = {
    id:'obj'+(++fpObjIdSeq), type, style:d.style, text:d.text,
    x:fpSnap(wx), y:fpSnap(wy), w:d.w, h:d.h
  };
  fpObjects.push(obj);
  fpCancelTool();
  renderFloorPlan();
}

// ─── Auto-place helper ────────────────────────────────────────────────
function fpAutoPlace(shelf) {
  const did = fpGetViewDepotId();
  const sl  = did ? (shelvesAll[did]||[]) : Object.values(shelvesAll).flat();
  for (let r=0; r<20; r++) for (let c=0; c<10; c++) {
    const tx=fpSnap(40+c*(FP_CARD_W+20)), ty=fpSnap(40+r*300);
    if (!fpCollidesShelf(shelf.id,tx,ty,sl)) return {x:tx,y:ty};
  }
  return {x:40, y:40};
}

// ─── Rename helper (view + edit mode) ────────────────────────────────
async function fpRenameObject(objId) {
  const obj = fpObjects.find(o=>o.id===objId); if (!obj) return;
  const t = await showTextPrompt({
    title: 'RENOMEAR ELEMENTO',
    label: 'TEXTO',
    value: obj.text,
    placeholder: 'Novo rótulo',
    okLabel: 'SALVAR',
    maxLength: 80,
  });
  if (t === null) return;
  const next = sanitizeTextInput(t, { maxLength: 80 }) || obj.text;
  obj.text = next;
  const lbl = document.querySelector(`[data-obj-id="${objId}"] .fp-obj-lbl`);
  if (lbl) lbl.textContent = obj.text;
  else renderFloorPlan();
}

function getFloorPlanShelfViews() {
  if (!fpShowAllDepots) {
    const depotId = fpGetViewDepotId();
    return (shelvesAll[depotId] || []).map(shelf => ({
      shelf,
      depotId,
      viewKey: `${depotId}::${shelf.id}`,
      pos: fpLayout[getScopedShelfId(shelf.id, depotId)] || fpAutoPlace(shelf),
      positionMode: 'saved',
    }));
  }

  const views = [];
  let yOffset = 60;
  depots.forEach(depot => {
    const depotShelves = shelvesAll[depot.id] || [];
    const depotViews = depotShelves.map(shelf => {
      const scopedId = getScopedShelfId(shelf.id, depot.id);
      const saved = fpLayout[scopedId] || fpAutoPlace(shelf);
      return {
        shelf,
        depotId: depot.id,
        viewKey: `${depot.id}::${shelf.id}`,
        rawPos: saved,
      };
    });
    const minX = depotViews.length ? Math.min(...depotViews.map(view => view.rawPos.x)) : 0;
    const minY = depotViews.length ? Math.min(...depotViews.map(view => view.rawPos.y)) : 0;
    const maxY = depotViews.length ? Math.max(...depotViews.map(view => view.rawPos.y + fpCardH(view.shelf))) : 0;
    const headerTop = yOffset - 42;
    depotViews.forEach(view => {
      views.push({
        shelf: view.shelf,
        depotId: view.depotId,
        viewKey: view.viewKey,
        pos: {
          x: fpSnap(40 + (view.rawPos.x - minX)),
          y: fpSnap(yOffset + (view.rawPos.y - minY)),
        },
        headerTop,
        positionMode: 'saved',
      });
    });
    yOffset += Math.max(220, maxY - minY + 90) + 70;
  });
  return views;
}

// ─── Main render ──────────────────────────────────────────────────────
function renderFloorPlan() {
  const inner = document.getElementById('fp-canvas-inner');
  if (!inner) return;

  const shelfViews = getFloorPlanShelfViews();
  fpRenderShelfMap = Object.fromEntries(shelfViews.map(view => [view.viewKey, view]));

  // auto-place new shelves in single-depot mode
  shelfViews.forEach(view => {
    const scopedId = getScopedShelfId(view.shelf.id, view.depotId);
    if (view.positionMode === 'saved' && !fpLayout[scopedId]) fpLayout[scopedId] = fpAutoPlace(view.shelf);
  });
  // clean up removed shelves
  const allShelfIds = new Set(depots.flatMap(depot => (shelvesAll[depot.id] || []).map(shelf => getScopedShelfId(shelf.id, depot.id))));
  Object.keys(fpLayout).forEach(id => { if (!allShelfIds.has(id)) delete fpLayout[id]; });

  inner.innerHTML = '';
  fpApplyTransform();
  // selection re-applied after DOM rebuild
  requestAnimationFrame(_fpApplySelectionClass);

  // ── 1. Objects (sorted by z-index so lower ones render first) ──
  const sortedObjs = [...fpObjects].sort((a,b) => (FP_OBJ_Z[a.type]||3) - (FP_OBJ_Z[b.type]||3));

  sortedObjs.forEach(obj => {
    const z = FP_OBJ_Z[obj.type] || 3;
    const typeClass = obj.type==='street' ? 'fp-street'
                    : obj.type==='blocked'? 'fp-blocked'
                    : 'fp-textbox style-'+obj.style;

    const el = document.createElement('div');
    el.className = 'fp-object '+typeClass+(fpEditMode?' fp-edit-mode-item':'');
    el.style.cssText = `left:${obj.x}px;top:${obj.y}px;width:${obj.w}px;height:${obj.h}px;`
                     + `z-index:${z};position:absolute;box-sizing:border-box;`;
    el.dataset.objId = obj.id;

    // label (bottom-left)
    const lbl = document.createElement('span');
    lbl.className = 'fp-obj-lbl';
    lbl.textContent = obj.text;
    lbl.style.cssText = 'position:absolute;bottom:5px;left:7px;right:7px;'
      +'font-family:IBM Plex Mono,monospace;font-size:11px;font-weight:700;'
      +'pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    el.appendChild(lbl);

    // ─── Double-click to rename (BOTH modes) ───
    el.addEventListener('dblclick', ev => {
      ev.stopPropagation(); ev.preventDefault();
      if (fpActiveTool) return;
      fpRenameObject(obj.id);
    });

    if (fpEditMode) {
      // Close button
      const cb = document.createElement('button');
      cb.className = 'fp-obj-close'; cb.textContent = '×'; cb.style.display='flex';
      cb.onclick = ev => { ev.stopPropagation(); fpObjects=fpObjects.filter(o=>o.id!==obj.id); renderFloorPlan(); };
      el.appendChild(cb);

      // Resize handle
      const rh = document.createElement('div');
      rh.className = 'fp-obj-handle'; rh.style.opacity='0.8';
      rh.addEventListener('mousedown', ev => {
        ev.stopPropagation(); ev.preventDefault();
        fpResizing = {el, obj, startX:ev.clientX, startY:ev.clientY, startW:obj.w, startH:obj.h};
      });
      el.appendChild(rh);

      // Drag (only in edit mode)
      el.addEventListener('mousedown', ev => {
        if (ev.target===rh || ev.target===cb) return;
        if (fpActiveTool) return;
        ev.preventDefault(); ev.stopPropagation();
        fpToggleSelect('obj', obj.id, ev.ctrlKey||ev.metaKey);
        const w = fpS2W(ev.clientX, ev.clientY);
        if(fpSelHas('obj',obj.id) && fpSelection.size>1){
          const selItems=[];
          fpSelection.forEach(key=>{
            const [kind,id2]=fpSelParse(key);
            if(kind==='shelf'){const p2=fpLayout[id2];if(p2)selItems.push({kind,id:id2,ox:w.x-p2.x,oy:w.y-p2.y,lastX:p2.x,lastY:p2.y});}
            else{const o2=fpObjects.find(o3=>o3.id===id2);if(o2)selItems.push({kind,id:id2,ox:w.x-o2.x,oy:w.y-o2.y,lastX:o2.x,lastY:o2.y});}
          });
          fpDrag={kind:'multi',el,items:selItems};
        } else {
          fpDrag={kind:'obj', id:obj.id, el, offX:w.x-obj.x, offY:w.y-obj.y};
        }
        el._wasDrag = false;
      });
    }

    inner.appendChild(el);
  });

  // ── 2. Depot dividers (all-depots mode) ──
  if (fpShowAllDepots) {
    depots.forEach((dep, di) => {
      const depotViews = shelfViews.filter(view => view.depotId === dep.id);
      if (!depotViews.length && di > 0) return;
      const top = depotViews[0]?.headerTop ?? 18;
      const div = document.createElement('div');
      div.style.cssText = `position:absolute;left:0;right:0;top:${top}px;`
        +`pointer-events:none;z-index:0;min-height:60px;`;
      div.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:800;`
        +`color:var(--accent);padding:8px 16px;background:rgba(0,102,204,.06);`
        +`border-bottom:2px solid var(--accent);${di>0?'border-top:3px solid var(--border);':''}">`
        +`${escapeHtml(dep.name)}</div>`;
      inner.appendChild(div);
    });
  }

  // ── 3. Shelf cards ──
  shelfViews.forEach(view => {
    const s = view.shelf;
    const depotId = view.depotId;
    const pos = view.pos;
    const fp = productsAll[depotId] || {};
    let occ=0, total=s.floors*s.drawers, expN=0, wrnN=0, totalKg=0;
    let movementScore = 0;
    const skus=new Set();
    for (let f=1;f<=s.floors;f++) for (let d=1;d<=s.drawers;d++) {
      const prods=fp[drawerKey(s.id,f,d)]||[];
      if(prods.length)occ++;
      prods.forEach(p=>{
        skus.add(p.code); totalKg+=parseFloat(p.kg)||0;
        const st=productExpiryStatus(p);
        if(st==='expired')expN++; else if(st==='expiring')wrnN++;
        movementScore += auditHistory.filter(entry => (entry.productCode || '').includes(p.code)).length;
      });
    }
    const pct=total>0?Math.round((occ/total)*100):0;
    const pc=pct>=90?'var(--danger)':pct>=60?'var(--warn)':'var(--accent3)';
    let tags='';
    if(expN)  tags+=`<span class="fp-tag fp-tag-exp">⛔${expN}</span>`;
    if(wrnN)  tags+=`<span class="fp-tag fp-tag-warn">⚠${wrnN}</span>`;
    if(!expN&&!wrnN&&occ>0) tags+=`<span class="fp-tag fp-tag-ok">✓</span>`;

    const card=document.createElement('div');
    let cls='fp-shelf-card'+(fpFocusedShelf===s.id && fpFocusedDepotId===depotId?' fp-selected':'')+(fpEditMode?' fp-edit-mode-item':'');
    cls += ` ${getShelfTypeClass(s.type)}`;
    card.className=cls;
    card.dataset.shelf=s.id;
    card.dataset.viewKey=view.viewKey;
    card.dataset.depotId=depotId;
    const heatCss = fpHeatmapEnabled
      ? (() => {
          const heat = Math.min(1, ((pct / 100) * 0.6) + Math.min(movementScore, 10) / 25);
          return `box-shadow:0 0 0 1px rgba(0,0,0,.04), 0 0 0 3px rgba(255,90,0,${heat.toFixed(2)});background:linear-gradient(180deg, rgba(255,165,0,${(heat * 0.28).toFixed(2)}), rgba(255,0,0,${(heat * 0.12).toFixed(2)}));`;
        })()
      : '';
    card.style.cssText=`left:${pos.x}px;top:${pos.y}px;z-index:${SHELF_Z};position:absolute;width:${FP_CARD_W}px;${heatCss}`;
    card.innerHTML=`
      <div class="fp-card-head">
        <div class="fp-card-id">${escapeHtml(s.id)}</div>
        <div class="fp-card-pct" style="color:${pc}">${escapeHtml(String(pct))}%${tags?'&nbsp;'+tags:''}</div>
      </div>
      <div class="fp-card-body">
        ${fpShowAllDepots ? `<div class="fp-card-row"><span>depósito</span><strong>${escapeHtml(getDepotById(depotId)?.name || depotId)}</strong></div>` : ''}
        <div class="fp-card-row"><span>tipo</span><strong>${getShelfTypeLabel(s.type)}</strong></div>
        <div class="fp-card-row"><span>${occ}/${total} gav.</span><strong>${skus.size} SKUs</strong></div>
        <div class="fp-card-row"><span>${s.floors}×${s.drawers}</span><strong>${totalKg.toFixed(1)}kg</strong></div>
        <div class="fp-cap-bar"><div class="fp-cap-fill" style="width:${pct}%;background:${pc}"></div></div>
      </div>`;

    if (fpEditMode && !fpShowAllDepots) {
      card.style.cursor='grab';
      card.addEventListener('mousedown', ev=>{
        if(ev.button!==0||fpActiveTool) return;
        ev.preventDefault(); ev.stopPropagation();
        const scopedId = getScopedShelfId(s.id, depotId);
        fpToggleSelect('shelf', scopedId, ev.ctrlKey||ev.metaKey);
        const w=fpS2W(ev.clientX,ev.clientY);
        // if multiple selected and this is in selection, drag all selected
        if(fpSelHas('shelf',scopedId) && fpSelection.size>1){
          // compute offsets for all selected items
          const selItems=[];
          fpSelection.forEach(key=>{
            const [kind,id2]=fpSelParse(key);
            if(kind==='shelf'){const p2=fpLayout[id2];if(p2)selItems.push({kind,id:id2,ox:w.x-p2.x,oy:w.y-p2.y,lastX:p2.x,lastY:p2.y});}
            else{const o=fpObjects.find(o2=>o2.id===id2);if(o)selItems.push({kind,id:id2,ox:w.x-o.x,oy:w.y-o.y,lastX:o.x,lastY:o.y});}
          });
          fpDrag={kind:'multi',el:card,items:selItems};
        } else {
          fpDrag={kind:'shelf',id:scopedId,el:card,offX:w.x-pos.x,offY:w.y-pos.y,lastX:pos.x,lastY:pos.y};
        }
        card.style.cursor='grabbing'; card._wasDrag=false;
      });
    } else {
      card.style.cursor='pointer';
      card.addEventListener('click', ()=>{
        if(card._wasDrag){card._wasDrag=false;return;}
        if(fpActiveTool) return;
        if (fpShowAllDepots) {
          switchDepot(depotId);
          fpViewDepotId = depotId;
          fpShowAllDepots = false;
          document.getElementById('fp-all-btn')?.classList.remove('active');
          fpPopulateDepotSelect();
        }
        openFpModal(s.id, depotId);
      });
    }
    inner.appendChild(card);
  });
}

// ─── Global pointer handlers (IIFE, runs once) ────────────────────────

// ─── Multi-select helpers ─────────────────────────────────────────────
function fpSelKey(kind, id) { return kind+'||'+id; }
function fpSelParse(value) {
  const sep = value.indexOf('||');
  if (sep === -1) return ['obj', value];
  return [value.slice(0, sep), value.slice(sep + 2)];
}
function fpSelAdd(kind, id) { fpSelection.add(fpSelKey(kind,id)); }
function fpSelRemove(kind, id) { fpSelection.delete(fpSelKey(kind,id)); }
function fpSelHas(kind, id) { return fpSelection.has(fpSelKey(kind,id)); }
function fpSelClear() { fpSelection.clear(); fpUpdateAlignBar(); }
function fpSelAll() {
  fpSelection.clear();
  shelves.forEach(s => fpSelAdd('shelf', getScopedShelfId(s.id, activeDepotId)));
  fpObjects.forEach(o => fpSelAdd('obj', o.id));
  fpUpdateAlignBar(); renderFloorPlan();
}

function fpUpdateAlignBar() {
  const bar = document.getElementById('fp-align-bar');
  const cnt = document.getElementById('fp-sel-count');
  const n   = fpSelection.size;
  if (bar) bar.classList.toggle('visible', n > 0 && fpEditMode);
  if (cnt) cnt.textContent = n + ' sel.';
}

function fpToggleSelect(kind, id, ctrlKey) {
  if (!ctrlKey) {
    // single click without ctrl: clear and select only this
    const wasAlreadySingle = fpSelection.size===1 && fpSelHas(kind,id);
    fpSelection.clear();
    if (!wasAlreadySingle) fpSelAdd(kind, id);
  } else {
    // ctrl: toggle this item
    if (fpSelHas(kind,id)) fpSelRemove(kind,id);
    else fpSelAdd(kind,id);
  }
  fpUpdateAlignBar();
  // update visual selection without full re-render
  _fpApplySelectionClass();
}

function _fpApplySelectionClass() {
  document.querySelectorAll('.fp-selected-item').forEach(el => el.classList.remove('fp-selected-item'));
  fpSelection.forEach(key => {
    const [kind, id] = fpSelParse(key);
    const sel = kind==='shelf'
      ? document.querySelector(`.fp-shelf-card[data-view-key="${id}"]`)
      : document.querySelector(`[data-obj-id="${id}"]`);
    if (sel) sel.classList.add('fp-selected-item');
  });
}

// ─── Lasso select ─────────────────────────────────────────────────────
function fpLassoUpdate(wx, wy) {
  if (!fpLasso) return;
  const lx = Math.min(fpLasso.startX, wx);
  const ly = Math.min(fpLasso.startY, wy);
  const lw = Math.abs(wx - fpLasso.startX);
  const lh = Math.abs(wy - fpLasso.startY);
  fpLasso.x=lx; fpLasso.y=ly; fpLasso.w=lw; fpLasso.h=lh;
  const el = document.getElementById('fp-lasso');
  if (el) {
    el.style.left   = lx+'px'; el.style.top    = ly+'px';
    el.style.width  = lw+'px'; el.style.height = lh+'px';
    el.style.display= 'block';
  }
}

function fpLassoCommit(ctrlKey) {
  const el = document.getElementById('fp-lasso');
  if (el) el.style.display = 'none';
  if (!fpLasso) return;
  const {x,y,w,h} = fpLasso;
  if (w < 4 && h < 4) { fpLasso=null; return; } // tiny lasso = ignore
  if (!ctrlKey) fpSelection.clear();
  // check shelves
  const did = fpGetViewDepotId();
  const sl  = did ? (shelvesAll[did]||[]) : Object.values(shelvesAll).flat();
  sl.forEach(s => {
    const scopedId = getScopedShelfId(s.id, did || activeDepotId);
    const p = fpLayout[scopedId]; if (!p) return;
    if (p.x < x+w && p.x+FP_CARD_W > x && p.y < y+h && p.y+fpCardH(s) > y)
      fpSelAdd('shelf', scopedId);
  });
  // check objects
  fpObjects.forEach(o => {
    if (o.x < x+w && o.x+o.w > x && o.y < y+h && o.y+o.h > y)
      fpSelAdd('obj', o.id);
  });
  fpLasso = null;
  fpUpdateAlignBar();
  _fpApplySelectionClass();
}

// ─── Align selected items ─────────────────────────────────────────────
function fpAlign(mode) {
  if (fpSelection.size < 2 && !['left','right','top','bottom','cx','cy'].includes(mode)) return;
  if (fpSelection.size < 1) return;
  fpHistoryPush();

  // gather bounding boxes
  const items = [];
  fpSelection.forEach(key => {
    const [kind, id] = fpSelParse(key);
    if (kind==='shelf') {
      const shelfId = id.split('::')[1] || id;
      const pos=fpLayout[id]; const shelf=shelves.find(s=>s.id===shelfId);
      if(pos&&shelf) items.push({kind,id,x:pos.x,y:pos.y,w:FP_CARD_W,h:fpCardH(shelf)});
    } else {
      const obj=fpObjects.find(o=>o.id===id);
      if(obj) items.push({kind,id,x:obj.x,y:obj.y,w:obj.w,h:obj.h});
    }
  });
  if (!items.length) return;

  const minX = Math.min(...items.map(i=>i.x));
  const minY = Math.min(...items.map(i=>i.y));
  const maxX = Math.max(...items.map(i=>i.x+i.w));
  const maxY = Math.max(...items.map(i=>i.y+i.h));
  const cx   = (minX+maxX)/2;
  const cy   = (minY+maxY)/2;

  const setPos = (item, nx, ny) => {
    if (item.kind==='shelf') { fpLayout[item.id]={x:fpSnap(nx),y:fpSnap(ny)}; }
    else { const o=fpObjects.find(o=>o.id===item.id); if(o){o.x=fpSnap(nx);o.y=fpSnap(ny);} }
  };

  if (mode==='left')   items.forEach(i => setPos(i, minX,  i.y));
  if (mode==='right')  items.forEach(i => setPos(i, maxX-i.w, i.y));
  if (mode==='top')    items.forEach(i => setPos(i, i.x, minY));
  if (mode==='bottom') items.forEach(i => setPos(i, i.x, maxY-i.h));
  if (mode==='cx')     items.forEach(i => setPos(i, cx-i.w/2, i.y));
  if (mode==='cy')     items.forEach(i => setPos(i, i.x, cy-i.h/2));
  if (mode==='distH' && items.length>=3) {
    const sorted=[...items].sort((a,b)=>a.x-b.x);
    const totalW=sorted.reduce((s,i)=>s+i.w,0);
    const gap=(maxX-minX-totalW)/(sorted.length-1);
    let cx2=minX;
    sorted.forEach(i=>{setPos(i,cx2,i.y);cx2+=i.w+gap;});
  }
  if (mode==='distV' && items.length>=3) {
    const sorted=[...items].sort((a,b)=>a.y-b.y);
    const totalH=sorted.reduce((s,i)=>s+i.h,0);
    const gap=(maxY-minY-totalH)/(sorted.length-1);
    let cy2=minY;
    sorted.forEach(i=>{setPos(i,i.x,cy2);cy2+=i.h+gap;});
  }
  renderFloorPlan();
}

async function fpDeleteSelected() {
  if (!await requirePermission('layout.edit', 'Seu perfil não pode editar a planta.')) return;
  if (!fpSelection.size) return;
  // collect what will be deleted
  const shelfIds = [], objIds = [];
  fpSelection.forEach(key => {
    const [kind,id] = fpSelParse(key);
    if (kind==='shelf') shelfIds.push(id);
    else objIds.push(id);
  });
  // check shelves for occupied (search ALL depots)
  const allS = Object.values(shelvesAll).flat();
  const occupied = shelfIds.filter(id => {
    const s = allS.find(s2=>s2.id===id); if(!s) return false;
    // Find which depot this shelf belongs to for products check
    let pMap = products;
    for(const [did, sl] of Object.entries(shelvesAll)) {
       if (sl.find(sx=>sx.id===id)) { pMap = productsAll[did] || {}; break; }
    }
    for(let f=1;f<=s.floors;f++) for(let d=1;d<=s.drawers;d++)
      if((pMap[drawerKey(s.id,f,d)]||[]).length) return true;
    return false;
  });
  if (occupied.length) {
    await showNotice({
      title: 'EXCLUSÃO BLOQUEADA',
      icon: '⛔',
      desc: 'Algumas prateleiras selecionadas ainda contêm produtos e não podem ser excluídas.',
      summary: { PRATELEIRAS: occupied.join(', ') },
    });
    return;
  }
  showConfirm({title:'EXCLUIR SELECIONADOS',icon:'🗑',
    desc:'Excluir '+fpSelection.size+' item(s) selecionado(s)?',
    summary:{'PRATELEIRAS':shelfIds.length,'OBJETOS':objIds.length},
    okLabel:'EXCLUIR'
  }).then(ok=>{
    if(!ok) return;
    fpHistoryPush();
    // Delete from all depots
    shelfIds.forEach(id=>{
      for(const did in shelvesAll) {
        shelvesAll[did] = shelvesAll[did].filter(s=>s.id!==id);
      }
      delete fpLayout[id];
    });
    // update current shim
    shelves = shelvesAll[activeDepotId] || [];
    fpObjects = fpObjects.filter(o=>!objIds.includes(o.id));
    fpSelClear(); renderAll(); if(typeof renderShelfList === 'function') renderShelfList();
  });
}


(function(){
  const cv = ()=>document.getElementById('fp-canvas');

  document.addEventListener('mousedown', ev=>{
    const c=cv(); if(!c||!c.contains(ev.target)) return;
    const inner=document.getElementById('fp-canvas-inner');

    // Placement click
    if(fpActiveTool && ev.button===0){
      ev.preventDefault(); ev.stopPropagation();
      const w=fpS2W(ev.clientX,ev.clientY);
      fpPlaceObject(w.x,w.y);
      return;
    }
    // Lasso or pan on bg
    if((ev.target===c||ev.target===inner) && ev.button===0 && !fpDrag && !fpResizing){
      if(fpEditMode){
        // start lasso
        const w=fpS2W(ev.clientX,ev.clientY);
        fpLasso={startX:w.x,startY:w.y,x:w.x,y:w.y,w:0,h:0};
        fpDrag={kind:'lasso',el:null,startScreenX:ev.clientX,startScreenY:ev.clientY,
                startScrollLeft:c.scrollLeft,startScrollTop:c.scrollTop};
        if(!ev.ctrlKey&&!ev.metaKey){fpSelClear();}
        ev.preventDefault();
      } else {
        fpDrag={kind:'pan',el:null,startScreenX:ev.clientX,startScreenY:ev.clientY,
                startScrollLeft:c.scrollLeft,startScrollTop:c.scrollTop};
        c.classList.add('panning'); ev.preventDefault();
      }
    }
  });

  document.addEventListener('mousemove', ev=>{
    // Preview always runs (independent of drag)
    if(fpActiveTool) { fpMovePreview(ev.clientX, ev.clientY); }

    if(!fpDrag && !fpResizing) return;

    if(fpDrag?.kind==='pan'){
      const c=cv(); if(!c) return;
      c.scrollLeft=fpDrag.startScrollLeft-(ev.clientX-fpDrag.startScreenX);
      c.scrollTop =fpDrag.startScrollTop -(ev.clientY-fpDrag.startScreenY);
      return;
    }
    if(fpDrag?.kind==='lasso'){
      const w=fpS2W(ev.clientX,ev.clientY);
      fpLassoUpdate(w.x,w.y);
      return;
    }

    if(fpDrag?.kind==='shelf'){
      const w=fpS2W(ev.clientX,ev.clientY);
      let nx=fpSnap(Math.max(0,w.x-fpDrag.offX));
      let ny=fpSnap(Math.max(0,w.y-fpDrag.offY));
      // axis-split collision sliding
      if(fpCollides(fpDrag.id,nx,ny)){
        if(!fpCollides(fpDrag.id,nx,fpDrag.lastY))      ny=fpDrag.lastY;
        else if(!fpCollides(fpDrag.id,fpDrag.lastX,ny)) nx=fpDrag.lastX;
        else { nx=fpDrag.lastX; ny=fpDrag.lastY; }
      }
      fpDrag.lastX=nx; fpDrag.lastY=ny;
      fpLayout[fpDrag.id]={x:nx,y:ny};
      fpDrag.el.style.left=nx+'px'; fpDrag.el.style.top=ny+'px';
      fpDrag.el._wasDrag=true;
      return;
    }

    if(fpDrag?.kind==='obj'){
      const w=fpS2W(ev.clientX,ev.clientY);
      const nx=fpSnap(Math.max(0,w.x-fpDrag.offX));
      const ny=fpSnap(Math.max(0,w.y-fpDrag.offY));
      const obj=fpObjects.find(o=>o.id===fpDrag.id);
      if(obj){obj.x=nx;obj.y=ny;}
      fpDrag.el.style.left=nx+'px'; fpDrag.el.style.top=ny+'px';
      fpDrag.el._wasDrag=true;
      return;
    }
    if(fpDrag?.kind==='multi'){
      const w=fpS2W(ev.clientX,ev.clientY);
      fpDrag.items.forEach(item=>{
        const nx=fpSnap(Math.max(0,w.x-item.ox));
        const ny=fpSnap(Math.max(0,w.y-item.oy));
        if(item.kind==='shelf'){
          // collision check per-shelf
          if(!fpCollides(item.id,nx,ny)){item.lastX=nx;item.lastY=ny;fpLayout[item.id]={x:nx,y:ny};}
          const el2=document.querySelector(`.fp-shelf-card[data-shelf="${item.id}"]`);
          const pos2=fpLayout[item.id];
          if(el2&&pos2){el2.style.left=pos2.x+'px';el2.style.top=pos2.y+'px';}
        } else {
          const obj2=fpObjects.find(o=>o.id===item.id);
          if(obj2){obj2.x=nx;obj2.y=ny;}
          const el2=document.querySelector(`[data-obj-id="${item.id}"]`);
          if(el2){el2.style.left=nx+'px';el2.style.top=ny+'px';}
        }
      });
      fpDrag.el._wasDrag=true;
      return;
    }

    if(fpResizing){
      const dx=ev.clientX-fpResizing.startX, dy=ev.clientY-fpResizing.startY;
      const nw=fpSnap(Math.max(60,fpResizing.startW+dx/fpScale));
      const nh=fpSnap(Math.max(30,fpResizing.startH+dy/fpScale));
      fpResizing.obj.w=nw; fpResizing.obj.h=nh;
      fpResizing.el.style.width=nw+'px'; fpResizing.el.style.height=nh+'px';
    }
  });

  document.addEventListener('mouseup', ev=>{
    const c=cv();
    if(fpDrag){
      if(fpDrag.kind==='pan'&&c) c.classList.remove('panning');
      if(fpDrag.kind==='shelf'&&fpDrag.el) { fpDrag.el.style.cursor='grab'; if(fpDrag.el._wasDrag) fpHistoryPush(); }
      if(fpDrag.kind==='obj'  &&fpDrag.el._wasDrag) fpHistoryPush();
      if(fpDrag.kind==='multi') fpHistoryPush();
      if(fpDrag.kind==='lasso') fpLassoCommit(ev.ctrlKey||ev.metaKey);
      fpDrag=null;
    }
    if(fpResizing) { fpHistoryPush(); fpResizing=null; } else fpResizing=null;
  });

  document.addEventListener('wheel', ev=>{
    const c=cv(); if(!c||!c.contains(ev.target)) return;
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    fpZoom(ev.deltaY<0?0.1:-0.1, ev.clientX, ev.clientY);
  },{passive:false});
})();

// ─── Keyboard shortcuts ────────────────────────────────────────────────
document.addEventListener('keydown', ev => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    if (document.activeElement?.id === 'blind-invoice-barcode' && ev.key === 'Escape') {
      document.activeElement.blur();
    } else if (document.activeElement?.id !== 'blind-invoice-barcode') {
      return;
    }
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !fpEditMode) {
    if (triggerLastUndoAction()) {
      ev.preventDefault();
      return;
    }
  }
  if (ev.key === 'F2') {
    if (getCurrentPageName() === 'conference') {
      ev.preventDefault();
      openBlindPoolModal();
      return;
    }
  }
  if (ev.key === 'F4') {
    ev.preventDefault();
    showPage('qr');
    return;
  }
  if (ev.key === 'Escape') {
    if (getCurrentPageName() === 'conference') {
      blindCountFocusedItemId = null;
      clearBlindTargetSelection();
      return;
    }
    clearFocus();
  }
  if (!fpEditMode) return;
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='z' && !ev.shiftKey) { ev.preventDefault(); fpUndo(); return; }
  if ((ev.ctrlKey||ev.metaKey) && (ev.key==='y' || (ev.key==='z'&&ev.shiftKey))) { ev.preventDefault(); fpRedo(); return; }
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='a') {
    ev.preventDefault(); fpSelAll();
  }
  if (ev.key==='Escape') { fpSelClear(); _fpApplySelectionClass(); }
  if ((ev.key==='Delete'||ev.key==='Backspace') && fpSelection.size>0) {
    // only if not typing in an input
    if (document.activeElement.tagName!=='INPUT') fpDeleteSelected();
  }
});

// ─── Shelf detail modal ───────────────────────────────────────────────
function openFpModal(shelfId, depotId = activeDepotId) {
  if(fpEditMode) return;
  const shelf=(shelvesAll[depotId] || []).find(s=>s.id===shelfId); if(!shelf) return;
  fpFocusedShelf=shelfId;
  fpFocusedDepotId=depotId;
  renderFloorPlan();
  document.getElementById('fp-modal-title').textContent  = 'PRATELEIRA '+shelfId;
  document.getElementById('fp-modal-subtitle').textContent = `${getDepotById(depotId)?.name || depotId} · ${shelf.floors} andares · ${shelf.drawers} gav. · cap.${shelf.maxKg||50}kg/gav.`;
  document.getElementById('fp-add-btn').onclick = ()=>fpOpenAddProduct();
  renderFpModalBody(shelf, depotId);
  document.getElementById('fp-shelf-modal').classList.add('open');
  if(mvState) setTimeout(applyMoveHighlights,50);
}
function closeFpModal() {
  document.getElementById('fp-shelf-modal').classList.remove('open');
  fpFocusedShelf=null;
  fpFocusedDepotId=null;
  renderFloorPlan();
}
async function fpOpenAddProduct() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode adicionar produtos pela planta.')) return;
  if(!fpFocusedShelf) return;
  const depotId = fpFocusedDepotId || activeDepotId;
  const shelf=(shelvesAll[depotId] || []).find(s=>s.id===fpFocusedShelf); if(!shelf) return;
  const dest = await showTextPrompt({
    title: 'ADICIONAR PRODUTO NA PLANTA',
    label: 'ENDEREÇO DA GAVETA',
    value: `${fpFocusedShelf}1.G1`,
    placeholder: `${fpFocusedShelf}1.G1`,
    help: 'Use o formato A1.G2',
    okLabel: 'CONTINUAR',
    maxLength: 20,
    uppercase: true,
  });
  if (dest === null) return;
  const normalized = sanitizeTextInput(dest, { maxLength: 20, uppercase: true });
  const parsed=parseKey(normalized);
  if(!parsed || parsed.shelf!==fpFocusedShelf) {
    await showNotice({
      title: 'ENDEREÇO INVÁLIDO',
      icon: '⛔',
      desc: 'Informe uma gaveta da mesma prateleira selecionada.',
      summary: { PRATELEIRA: fpFocusedShelf, LOCAL: normalized || '—' },
    });
    return;
  }
  currentDrawerKey=normalized;
  openProductForm(null);
}
function renderFpModalBody(shelf, depotId = fpFocusedDepotId || activeDepotId) {
  const body=document.getElementById('fp-modal-body'); if(!body) return;
  const fp=productsAll[depotId] || {};
  const si=Object.values(shelvesAll).flat().indexOf(shelf), rev=si%2===0;
  const floors=Array.from({length:shelf.floors},(_,i)=>i+1);
  const ordered=rev?[...floors].reverse():floors;
  const maxKg=shelf.maxKg||50;
  let h='<div class="fp-modal-floors">';
  ordered.forEach(f=>{
    h+=`<div class="floor" style="border-top:1px solid var(--border);padding:5px 10px"><div class="floor-label">${shelf.id}${f}</div><div class="drawers">`;
    for(let d=1;d<=shelf.drawers;d++){
      const key=drawerKey(shelf.id,f,d);
      const prods=fp[key]||[];
      const isOcc=prods.length>0;
      const expSt=isOcc?drawerExpiryStatus(prods):'ok';
      const usedKg=prods.reduce((s,p)=>s+(parseFloat(p.kg)||0),0);
      const capPct=Math.min(100,(usedKg/maxKg)*100);
      const capCls=capPct>=90?'high':capPct>=60?'mid':'low';
      let cls='drawer'+(isOcc?' occupied':'');
      if(expSt==='expired')cls+=' expired'; else if(expSt==='expiring')cls+=' expiring';
      const cme={};
      prods.forEach(p=>{const ne=nearestExpiry(p);if(!cme[p.code]||(ne&&ne<cme[p.code]))cme[p.code]=ne;});
      let ph='';
      if(isOcc){
        const shown=prods.slice(0,2),extra=prods.length-2;
        ph=shown.map(p=>{
          const es=productExpiryStatus(p);
          const dot=es!=='ok'?`<span class="exp-dot ${es==='expired'?'danger':'warn'}"></span>`:'';
          return `<div class="drawer-prod-entry" style="flex-direction:row;align-items:center;gap:2px">${dot}<span class="drawer-prod-code">${escapeHtml(p.code)}</span><span class="drawer-prod-name" style="margin-left:2px">${escapeHtml(p.name)}</span></div>`;
        }).join('')+(extra>0?`<div class="drawer-more">+${extra}</div>`:'');
      }
      h+=`<div class="${cls}" data-key="${key}" style="cursor:pointer" title="${key}">
        <div class="drawer-key">${key}</div>
        ${isOcc?`<div class="drawer-prod-list">${ph}</div><div class="cap-bar-wrap" style="margin-top:auto"><div class="cap-bar ${capCls}" style="width:${capPct}%"></div></div>`:'<div class="drawer-empty-label">vazia</div>'}
      </div>`;
    }
    h+='</div></div>';
  });
  h+='</div>';
  body.innerHTML=h;
  body.querySelectorAll('.drawer[data-key]').forEach(el=>{
    dndInit(el,el.dataset.key);
    el.onclick=()=>{ if(mvState)mvSelectDest(el.dataset.key); else fpDrawerClick(el.dataset.key); };
    el.ondblclick=ev=>{ ev.stopPropagation(); openDrawerModal(el.dataset.key); };
  });
  if(mvState) setTimeout(applyMoveHighlights,10);
}
function fpDrawerClick(key) {
  currentDrawerKey=key;
  const p=parseKey(key);
  document.getElementById('drawer-modal-title').textContent='GAVETA — '+key;
  document.getElementById('drawer-modal-loc').textContent=p?`Prateleira ${p.shelf} · Andar ${p.floor} · Gaveta ${p.drawer}`:key;
  renderDrawerProducts();
  document.getElementById('drawer-modal').classList.add('open');
}

// ─── Persistence ─────────────────────────────────────────────────────
async function fpSaveLayout() {
  const data={layout:fpLayout,objects:fpObjects,objSeq:fpObjIdSeq};
  fpSnapshot = structuredClone(data);
  await persistFloorplanState();
  const btn=document.querySelector('#fp-edit-tools .fp-tool-btn.active:not(#fp-snap-btn)');
  if(btn){const o=btn.textContent;btn.textContent='✓ SALVO!';setTimeout(()=>btn.textContent=o,1500);}
}
function fpLoadLayout() {
  fpLayout = fpLayout || {};
  fpObjects = fpObjects || [];
  fpObjIdSeq = fpObjIdSeq || fpObjects.length || 0;
}
async function fpResetLayout() {
  if (!await requirePermission('layout.edit', 'Seu perfil não pode resetar a planta.')) return;
  if(fpSnapshot){
    const ok=await showConfirm({title:'RESETAR PLANTA',icon:'↺',desc:'Desfazer todas as alterações desde o último salvamento?',okLabel:'RESETAR'});
    if(!ok) return;
    const d = structuredClone(fpSnapshot);
    fpLayout=d.layout||{}; fpObjects=d.objects||[]; fpObjIdSeq=d.objSeq||0;
  } else {
    const ok=await showConfirm({title:'RESETAR PLANTA',icon:'↺',desc:'Resetar toda a planta (sem salvamento anterior)?',okLabel:'RESETAR'});
    if(!ok) return;
    fpLayout={}; fpObjects=[];
  }
  renderFloorPlan();
}

// ─── Depot selector ───────────────────────────────────────────────────
let fpShowAllDepots = false;
let fpViewDepotId   = null;

function fpSwitchDepot(id) {
  if (id === ALL_DEPOTS_VALUE) {
    fpShowAllDepots = true;
    fpViewDepotId = null;
    document.getElementById('fp-all-btn')?.classList.add('active');
    fpPopulateDepotSelect();
    renderFloorPlan();
    return;
  }
  fpShowAllDepots=false; fpViewDepotId=id;
  document.getElementById('fp-all-btn')?.classList.remove('active');
  fpPopulateDepotSelect();
  renderFloorPlan();
}
function fpToggleAllDepots() {
  fpShowAllDepots=!fpShowAllDepots;
  fpViewDepotId = fpShowAllDepots ? null : activeDepotId;
  fpFocusedShelf = null;
  fpFocusedDepotId = null;
  document.getElementById('fp-all-btn')?.classList.toggle('active',fpShowAllDepots);
  document.getElementById('fp-shelf-modal')?.classList.remove('open');
  fpPopulateDepotSelect();
  renderFloorPlan();
  if(fpSearchQuery||fpSearchFilter) fpApplySearch();
}
function fpGetViewDepotId() {
  if(fpShowAllDepots) return null;
  return fpViewDepotId || activeDepotId;
}
function fpPopulateDepotSelect() {
  const sel=document.getElementById('fp-depot-select'); if(!sel) return;
  sel.innerHTML = buildDepotOptionsHtml({ includeAll: true, selected: fpShowAllDepots ? ALL_DEPOTS_VALUE : (fpViewDepotId || activeDepotId) });
  sel.disabled = false;
}

// ─── Search ───────────────────────────────────────────────────────────
function fpSearch(q){fpSearchQuery=q.trim().toLowerCase();fpApplySearch();}
function fpClearSearch(){fpSearchQuery='';const el=document.getElementById('fp-search');if(el)el.value='';fpApplySearch();}
function fpToggleHeatmap() {
  fpHeatmapEnabled = !fpHeatmapEnabled;
  document.getElementById('fp-heatmap-btn')?.classList.toggle('active', fpHeatmapEnabled);
  renderFloorPlan();
  if (fpSearchQuery || fpSearchFilter || fpExpiryMaxDays) fpApplySearch();
}
function fpSetExpiryRange(value) {
  fpExpiryMaxDays = parseInt(value || '0', 10) || 0;
  const label = document.getElementById('fp-expiry-slider-label');
  if (label) label.textContent = fpExpiryMaxDays > 0 ? `≤ ${fpExpiryMaxDays}D` : 'TODAS';
  fpApplySearch();
}
function fpSetFilter(f){
  fpSearchFilter=fpSearchFilter===f?'':f;
  ['all','expired','expiring','empty','full'].forEach(k=>{
    const el=document.getElementById('fpsf-'+k);
    if(el)el.classList.toggle('active',k!=='all'&&k===fpSearchFilter);
  });
  document.getElementById('fpsf-active')?.style &&
    (document.getElementById('fpsf-active').style.display=fpSearchFilter?'inline-flex':'none');
  fpApplySearch();
}
function fpApplySearch(){
  const q=fpSearchQuery,filter=fpSearchFilter;
  let mc=0;
  const fpMatchPriority = match => {
    if (match.st === 'expiring') return 0;
    if (match.st === 'ok') return 1;
    if (match.st === 'none') return 2;
    if (match.st === 'expired') return 3;
    return 4;
  };
  const totalCards = document.querySelectorAll('.fp-shelf-card[data-view-key]').length;
  document.querySelectorAll('.fp-shelf-card[data-view-key]').forEach(card=>{
    const view = fpRenderShelfMap[card.dataset.viewKey];
    const shelf = view?.shelf;
    const depotId = view?.depotId;
    if(!shelf || !depotId) return;
    const productsMap = productsAll[depotId] || {};
    let occ=0,total=shelf.floors*shelf.drawers;
    const matches=[];
    for(let f=1;f<=shelf.floors;f++) for(let d=1;d<=shelf.drawers;d++){
      const key=drawerKey(shelf.id,f,d); const prods=productsMap[key]||[];
      if(prods.length)occ++;
      prods.forEach(p=>{
        const st=productExpiryStatus(p); const expiries=getExpiries(p).filter(Boolean);
        const nearest = nearestExpiry(p);
        const days = nearest ? daysUntil(nearest) : null;
        const src=[p.code,p.name,key,p.entry||'',...expiries].join(' ').toLowerCase();
        if(q&&!src.includes(q))return;
        if(filter==='expired'&&st!=='expired')return;
        if(filter==='expiring'&&st!=='expiring')return;
        if(fpExpiryMaxDays > 0 && (days === null || days < 0 || days > fpExpiryMaxDays)) return;
        const lbl=p.code.toLowerCase().includes(q)?p.code:p.name.toLowerCase().includes(q)?p.name.slice(0,16):key;
        matches.push({lbl,st,nearest});
      });
    }
    matches.sort((a,b)=>{
      const prioDiff = fpMatchPriority(a) - fpMatchPriority(b);
      if (prioDiff !== 0) return prioDiff;
      const dateA = a.nearest || '9999-12-31';
      const dateB = b.nearest || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a.lbl.localeCompare(b.lbl);
    });
    if(filter==='empty'&&occ>0){card.classList.remove('fp-match');card.classList.add('fp-no-match');return;}
    if(filter==='full'&&occ<total){card.classList.remove('fp-match');card.classList.add('fp-no-match');return;}
    const hasMatch=(!q&&!filter&&!fpExpiryMaxDays)||matches.length>0;
    card.classList.remove('fp-match','fp-no-match');
    card.querySelector('.fp-match-badges')?.remove();
    if(!q&&!filter&&!fpExpiryMaxDays)return;
    if(hasMatch){
      card.classList.add('fp-match'); mc++;
      if(q&&matches.length){
        const bd=document.createElement('div');bd.className='fp-match-badges';
        matches.slice(0,5).forEach(m=>{const b=document.createElement('span');b.className='fp-match-badge'+(m.st==='expired'?' exp':m.st==='expiring'?' warn':'');b.textContent=m.lbl;bd.appendChild(b);});
        if(matches.length>5){const b=document.createElement('span');b.className='fp-match-badge';b.style.background='var(--text3)';b.textContent='+' + (matches.length-5);bd.appendChild(b);}
        card.appendChild(bd);
      }
    } else {card.classList.add('fp-no-match');}
  });
  const ce=document.getElementById('fp-search-count');
  if(ce){if(!q&&!filter&&!fpExpiryMaxDays)ce.textContent=totalCards+' prateleiras';else{ce.textContent=mc+' de '+totalCards+' prateleiras';ce.style.color=mc===0?'var(--danger)':'var(--text3)';}}
}

// ─── Depot overview (depots page) JS lives here since it uses FP state ─
function openDepotModal(editId) {
  if (!hasPermission('settings.manage')) return;
  depotModalEditId = editId || null;  // declared above
  const dm = depots.find(d => d.id === editId);
  const titleEl = byId('depot-modal-title');
  if (titleEl) titleEl.textContent = editId ? '✏ EDITAR DEPÓSITO' : '+ NOVO DEPÓSITO';
  writeInputValue('dm-name', dm?.name || '');
  writeInputValue('dm-address', dm?.address || '');
  writeInputValue('dm-city', dm?.city || '');
  writeInputValue('dm-manager', dm?.manager || '');
  writeInputValue('dm-phone', dm?.phone || '');
  writeInputValue('dm-notes', dm?.notes || '');
  const overcapacityEl = byId('dm-allow-overcapacity');
  if (overcapacityEl) overcapacityEl.checked = !!dm?.allowOvercapacity;
  byId('depot-modal')?.classList.add('open');
}
function closeDepotModal() {
  byId('depot-modal')?.classList.remove('open');
  depotModalEditId = null;
}
function doAddDepot() { openDepotModal(null); }

async function saveDepotCard(depotId) {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode criar ou editar depósitos.')) return;
  const depot = getDepotById(depotId);
  if (!depot) return;
  const prefix = `do-${depotId}`;
  const name = sanitizeTextInput(document.getElementById(`${prefix}-name`)?.value, { maxLength: 80 });
  if (!name) {
    await showNotice({ title: 'CAMPO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o nome do depósito antes de salvar.' });
    return;
  }
  const payload = {
    name,
    address: sanitizeTextInput(document.getElementById(`${prefix}-address`)?.value, { maxLength: 140 }),
    city: sanitizeTextInput(document.getElementById(`${prefix}-city`)?.value, { maxLength: 80 }),
    manager: sanitizeTextInput(document.getElementById(`${prefix}-manager`)?.value, { maxLength: 80 }),
    phone: sanitizeTextInput(document.getElementById(`${prefix}-phone`)?.value, { maxLength: 40 }),
    notes: sanitizeTextInput(document.getElementById(`${prefix}-notes`)?.value, { maxLength: 240 }),
    allowOvercapacity: !!document.getElementById(`${prefix}-allow-overcapacity`)?.checked,
  };
  const confirmed = await showConfirm({
    title: 'SALVAR DEPÓSITO',
    icon: '💾',
    desc: 'Aplicar as alterações deste depósito?',
    summary: {
      NOME: payload.name,
      CIDADE: payload.city || '—',
      OVERCAPACITY: payload.allowOvercapacity ? 'ATIVO' : 'INATIVO',
    },
    okLabel: 'SALVAR',
    okStyle: 'accent',
  });
  if (!confirmed) return;
  Object.assign(depot, payload);
  await persistStructureState();
  renderDepotsPage();
  renderDepotTabs();
  renderAll(true);
}

function renderDepotsPage() {
  const grid = document.getElementById('do-grid');
  if (!grid) return;
  const canManageDepots = hasPermission('settings.manage');
  let html2 = '';
  const scopeDepotId = getDepotTabsContextId();
  depots.filter(depot => scopeDepotId === ALL_DEPOTS_VALUE || depot.id === scopeDepotId).forEach(depot => {
    const discardDepot = isDiscardDepot(depot);
    const slist  = shelvesAll[depot.id]  || [];
    const prods  = productsAll[depot.id] || {};
    let totalDrawers=0, occupiedDrawers=0, totalCapKg=0, usedKg=0, totalProducts=0, expiredCount=0, expiringCount=0;
    const skus=new Set();
    const shelfRows = slist.map(s => {
      let sOcc=0, sTot=s.floors*s.drawers, sUsedKg=0;
      const sCapKg=sTot*(s.maxKg||50);
      for(let f=1;f<=s.floors;f++) for(let d=1;d<=s.drawers;d++){
        const key=drawerKey(s.id,f,d); const p=prods[key]||[];
        if(p.length)sOcc++;
        p.forEach(pr=>{
          skus.add(pr.code); const k=parseFloat(pr.kg)||0; sUsedKg+=k; usedKg+=k; totalProducts++;
          const st=productExpiryStatus(pr);
          if(st==='expired')expiredCount++; else if(st==='expiring')expiringCount++;
        });
      }
      totalDrawers+=sTot; occupiedDrawers+=sOcc; totalCapKg+=sCapKg;
      const pct=sTot>0?Math.round((sOcc/sTot)*100):0;
      const capKgPct=sCapKg>0?Math.round((sUsedKg/sCapKg)*100):0;
      const barColor=pct>=90?'var(--danger)':pct>=60?'var(--warn)':'var(--accent3)';
      return `<div class="do-shelf-row">
        <div class="do-shelf-id">${s.id}</div>
        <div class="do-shelf-bar-wrap"><div class="do-shelf-bar" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="do-shelf-stats">${sOcc}/${sTot} gav · ${sUsedKg.toFixed(1)}kg${depot.allowOvercapacity ? ` · ${capKgPct}%` : ''}</div>
      </div>`;
    }).join('');
    const occPct=totalDrawers>0?Math.round((occupiedDrawers/totalDrawers)*100):0;
    const kgPct=totalCapKg>0?Math.round((usedKg/totalCapKg)*100):0;
    const occColor=occPct>=90?'var(--danger)':occPct>=60?'var(--warn)':'var(--accent3)';
    const kgColor=kgPct>=100?'var(--danger)':kgPct>=60?'var(--warn)':'var(--accent)';
    const loadLabel = depot.allowOvercapacity ? `${usedKg.toFixed(1)} / ${totalCapKg.toFixed(0)} kg · ${kgPct}%` : `${usedKg.toFixed(1)} / ${totalCapKg.toFixed(0)} kg`;
    const prefix = `do-${depot.id}`;
    let expBadges='';
    if(expiredCount)  expBadges+=`<span class="status-badge expired">⛔ ${expiredCount} vencidos</span>`;
    if(expiringCount) expBadges+=`<span class="status-badge expiring">⚠ ${expiringCount} a vencer</span>`;
    if(!expiredCount&&!expiringCount&&totalProducts>0) expBadges+=`<span class="status-badge ok">✓ Validades OK</span>`;
    if(depot.allowOvercapacity) expBadges+=`<span class="status-badge blocked">↕ OVERCAPACITY ATIVO</span>`;
    if(discardDepot) expBadges+=`<span class="status-badge expired">🟥 DESCARTE CONTROLADO</span>`;
    const detailHtml = canManageDepots ? `
      <div class="do-card-detail do-card-form">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>NOME</label>
            <input type="text" id="${prefix}-name" value="${escapeAttr(depot.name || '')}">
          </div>
          <div class="form-group">
            <label>CIDADE</label>
            <input type="text" id="${prefix}-city" value="${escapeAttr(depot.city || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>ENDEREÇO</label>
            <input type="text" id="${prefix}-address" value="${escapeAttr(depot.address || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>RESPONSÁVEL</label>
            <input type="text" id="${prefix}-manager" value="${escapeAttr(depot.manager || '')}">
          </div>
          <div class="form-group">
            <label>TELEFONE</label>
            <input type="text" id="${prefix}-phone" value="${escapeAttr(depot.phone || '')}">
          </div>
        </div>
        <div class="form-group">
          <label>OBSERVAÇÕES</label>
          <input type="text" id="${prefix}-notes" value="${escapeAttr(depot.notes || '')}">
        </div>
        <label class="shelf-type-option shelf-type-option-blocked do-overcapacity-toggle">
          <input type="checkbox" id="${prefix}-allow-overcapacity" ${depot.allowOvercapacity ? 'checked' : ''}>
          <span>PERMITIR OVERCAPACITY NESTE DEPÓSITO</span>
        </label>
        <div class="do-inline-actions">
          <button class="btn btn-accent" onclick="saveDepotCard('${escapeJs(depot.id)}')">💾 SALVAR</button>
        </div>
      </div>
    ` : `${(depot.address||depot.manager||depot.phone||depot.notes)?'<div class="do-card-detail">'
        +(depot.address?'<div class="do-detail-row"><span class="do-detail-label">ENDEREÇO</span><span class="do-detail-value">'+escapeHtml(depot.address)+'</span></div>':'')
        +(depot.manager?'<div class="do-detail-row"><span class="do-detail-label">RESPONS.</span><span class="do-detail-value">'+escapeHtml(depot.manager)+'</span></div>':'')
        +(depot.phone  ?'<div class="do-detail-row"><span class="do-detail-label">TELEFONE</span><span class="do-detail-value">'+escapeHtml(depot.phone)+'</span></div>':'')
        +(depot.notes  ?'<div class="do-detail-row"><span class="do-detail-label">OBS.</span><span class="do-detail-value">'+escapeHtml(depot.notes)+'</span></div>':'')
        +'</div>':''}`;
    html2+=`<div class="do-card ${discardDepot ? 'discard' : ''}">
      <div class="do-card-head ${discardDepot ? 'discard' : ''}">
        <div><div class="do-card-name ${discardDepot ? 'discard' : ''}">${escapeHtml(depot.name)}</div>
        ${depot.city?'<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:var(--text3);margin-top:2px">'+escapeHtml(depot.city)+'</div>':''}</div>
        <div class="do-card-actions">
          <button class="btn" onclick="switchDepot('${depot.id}');showPage('depot')" style="font-size:10px;padding:4px 10px">🏭 ABRIR</button>
          ${canManageDepots ? `<button class="icon-btn del" onclick="removeDepot('${depot.id}')" title="Remover">✕</button>` : ''}
        </div>
      </div>
      ${detailHtml}
      <div class="do-kpi-row">
        <div class="do-kpi"><div class="do-kpi-label">CAP. ESTRUTURAL</div><div class="do-kpi-value" style="color:${occColor}">${totalDrawers}</div><div class="do-kpi-sub">${occupiedDrawers} gavetas ocupadas · ${occPct}%</div></div>
        <div class="do-kpi"><div class="do-kpi-label">CARGA KG</div><div class="do-kpi-value" style="color:${kgColor}">${kgPct}%</div><div class="do-kpi-sub">${loadLabel}</div></div>
        <div class="do-kpi"><div class="do-kpi-label">PRODUTOS</div><div class="do-kpi-value" style="color:var(--accent2)">${skus.size}</div><div class="do-kpi-sub">${totalProducts} entradas · ${slist.length} prat.</div></div>
      </div>
      ${slist.length?'<div class="do-shelves">'+shelfRows+'</div>':'<div style="padding:14px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--text3)">Nenhuma prateleira</div>'}
      ${expBadges?'<div class="do-exp-badges">'+expBadges+'</div>':''}
    </div>`;
  });
  if (canManageDepots) html2+=`<div class="do-add-card" onclick="doAddDepot()"><span>+ NOVO DEPÓSITO</span></div>`;
  grid.innerHTML=html2;
}



// ══ COLUMN DRAG REORDER ══════════════════════════════════════════════
// Works on any table. After drop, calls the provided reorderFn(fromIdx, toIdx).
(function() {
  let _cdSrc = null; // { th, tableId, colIdx }

  document.addEventListener('dragstart', ev => {
    const th = ev.target.closest('th[draggable]');
    if (!th) return;
    const tr = th.parentElement;
    const ths = Array.from(tr.querySelectorAll('th'));
    _cdSrc = { th, tableId: th.closest('table')?.id, colIdx: ths.indexOf(th) };
    th.classList.add('col-drag-src');
    ev.dataTransfer.effectAllowed = 'move';
  });

  document.addEventListener('dragover', ev => {
    const th = ev.target.closest('th[draggable]');
    if (!th || !_cdSrc) return;
    if (th.closest('table')?.id !== _cdSrc.tableId) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    // remove over from all, add to this
    th.closest('tr').querySelectorAll('th').forEach(t => t.classList.remove('col-drag-over'));
    if (th !== _cdSrc.th) th.classList.add('col-drag-over');
  });

  document.addEventListener('dragleave', ev => {
    const th = ev.target.closest('th[draggable]');
    if (th) th.classList.remove('col-drag-over');
  });

  document.addEventListener('drop', ev => {
    const th = ev.target.closest('th[draggable]');
    if (!th || !_cdSrc || th === _cdSrc.th) { _cdDone(); return; }
    if (th.closest('table')?.id !== _cdSrc.tableId) { _cdDone(); return; }
    ev.preventDefault();
    const tr = th.parentElement;
    const ths = Array.from(tr.querySelectorAll('th'));
    const toIdx = ths.indexOf(th);
    const fromIdx = _cdSrc.colIdx;
    // call the right reorder handler based on table id
    const tblId = _cdSrc.tableId;
    if (tblId === 'po-table-el')   poReorderCol(fromIdx, toIdx);
    if (tblId === 'sidebar-ptable') sbReorderCol(fromIdx, toIdx);
    _cdDone();
  });

  document.addEventListener('dragend', () => _cdDone());

  function _cdDone() {
    if (_cdSrc) { _cdSrc.th.classList.remove('col-drag-src'); _cdSrc = null; }
    document.querySelectorAll('th.col-drag-over').forEach(t => t.classList.remove('col-drag-over'));
  }
})();

// ── Products page column reorder ─────────────────────────────────────
function poReorderCol(from, to) {
  const keys = Object.keys(poColumns).filter(k => poColumns[k]);
  if (from < 0 || to < 0 || from >= keys.length || to >= keys.length || from === to) return;
  // Reorder the keys in poColumns by rebuilding in new order
  const allKeys = Object.keys(poColumns);
  const visKeys = allKeys.filter(k => poColumns[k]);
  const hidKeys = allKeys.filter(k => !poColumns[k]);
  // move visKeys[from] to position to
  const moved = visKeys.splice(from, 1)[0];
  visKeys.splice(to, 0, moved);
  // rebuild poColumns preserving hidden ones at end
  const newCols = {};
  [...visKeys, ...hidKeys].forEach(k => { newCols[k] = poColumns[k]; });
  poColumns = newCols;
  // rebuild PO_COL_LABELS order doesn't matter — it's a lookup
  renderProductsPage();
}

// ── Sidebar ptable column reorder ────────────────────────────────────
const sbColOrder = ['code', 'name', 'qty', 'status']; // mutable order
function sbReorderCol(from, to) {
  if (from < 0 || to < 0 || from >= sbColOrder.length || to >= sbColOrder.length || from === to) return;
  const moved = sbColOrder.splice(from, 1)[0];
  sbColOrder.splice(to, 0, moved);
  renderProductTable();
}

// ══ PAGE NAVIGATION ══════════════════════════════════════════════════
function showPage(name) {
  if (!canOpenPage(name)) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  const page = document.getElementById('page-' + name);
  const btn  = document.getElementById('nav-' + name);
  if (page) page.classList.add('active');
  if (btn)  {
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
  }
  renderDepotTabs();

  // hide sidebar on non-depot pages
  const sidebar = document.getElementById('sidebar');
  const sidebarVisible = name === 'depot';
  if (sidebar) sidebar.style.display = sidebarVisible ? '' : 'none';
  // also hide the resizer handle visual
  const sres = document.getElementById('sidebar-resizer');
  if (sres) sres.style.display = sidebarVisible ? '' : 'none';

  if (name === 'products')  { renderProductsPage(); poKpiFilter = ''; updatePoKpiActiveState(); }
  if (name === 'unloads') renderUnloadsPage();
  if (name === 'receiving') openReceivingPage();
  if (name === 'unload-review') renderUnloadReviewPage();
  if (name === 'depots')    renderDepotsPage();
  if (name === 'saidas')    renderShippingPage();
  if (name === 'separation') renderSeparationPage();
  if (name === 'history')   renderPageHistory();
  if (name === 'outbound')  renderOutboundRecordsPage();
  if (name === 'floorplan') { fpLoadLayout(); fpPopulateDepotSelect(); renderFloorPlan(); setTimeout(() => { if(fpSearchQuery||fpSearchFilter) fpApplySearch(); }, 50); }
  if (name === 'quality')   renderQualityPage();
  if (name === 'indicators') renderIndicatorsPage();
  if (name === 'qr')        renderQrPage();
  if (name === 'settings')  renderSettingsPage();
  if (name === 'help')      renderHelpPage();
}

function applyRolePermissions() {
  const settingsNav = document.getElementById('nav-settings');
  if (settingsNav) settingsNav.style.display = '';
  const clearAllBtn = document.getElementById('btn-clear-all-data');
  if (clearAllBtn) clearAllBtn.style.display = hasPermission('clear.all') ? '' : 'none';
  const clearHistoryBtn = document.getElementById('btn-clear-history');
  if (clearHistoryBtn) clearHistoryBtn.style.display = hasPermission('settings.manage') ? '' : 'none';
  const addShelfBtn = document.getElementById('btn-add-shelf');
  if (addShelfBtn) addShelfBtn.style.display = hasPermission('structure.manage') ? '' : 'none';
  const depotsNav = document.getElementById('nav-depots');
  if (depotsNav) depotsNav.style.display = '';
  const unloadsNav = document.getElementById('nav-unloads');
  if (unloadsNav) unloadsNav.style.display = hasBlindCountAccess() ? '' : 'none';
  const receivingNav = document.getElementById('nav-receiving');
  if (receivingNav) receivingNav.style.display = hasPermission('entry.register') ? '' : 'none';
  const unloadReviewNav = document.getElementById('nav-unload-review');
  if (unloadReviewNav) unloadReviewNav.style.display = canReviewBlindUnloads() ? '' : 'none';
  const fpEditBtn = document.getElementById('fp-edit-entry-btn');
  if (fpEditBtn) fpEditBtn.style.display = hasPermission('layout.edit') ? '' : 'none';
  const shippingNav = document.getElementById('nav-saidas');
  if (shippingNav) shippingNav.style.display = (hasPermission('shipment.process') || hasPermission('discard.process')) ? '' : 'none';
  const separationNav = document.getElementById('nav-separation');
  if (separationNav) separationNav.style.display = hasPermission('shipment.process') ? '' : 'none';
  const settingsRoleBadge = document.getElementById('settings-role-badge');
  if (settingsRoleBadge) settingsRoleBadge.textContent = ROLE_LABELS[getCurrentUserRole()] || getCurrentUserRole().toUpperCase();
  const userAdminSection = document.getElementById('settings-user-admin-section');
  if (userAdminSection) userAdminSection.style.display = canManageUsers() ? '' : 'none';
  const userAdminActions = document.getElementById('settings-user-admin-actions');
  if (userAdminActions) userAdminActions.style.display = canManageUsers() ? '' : 'none';
  const userAdminBlock = document.getElementById('settings-managed-user-block');
  if (userAdminBlock) userAdminBlock.style.display = canManageUsers() ? '' : 'none';
  const maintenanceBlock = document.getElementById('settings-maintenance-block');
  if (maintenanceBlock) maintenanceBlock.style.display = hasPermission('clear.all') ? '' : 'none';
  const dataManagementBlock = document.getElementById('settings-data-management-block');
  if (dataManagementBlock) dataManagementBlock.style.display = canManageProducts() ? '' : 'none';
  const fpSaveDrawerBtn = document.getElementById('fp-save-drawer-btn');
  if (fpSaveDrawerBtn) fpSaveDrawerBtn.style.display = hasPermission('entry.register') ? '' : 'none';
  const fpAddBtn = document.getElementById('fp-add-btn');
  if (fpAddBtn) fpAddBtn.style.display = hasPermission('entry.register') ? '' : 'none';
  const productsAddBtn = document.getElementById('products-add-btn');
  if (productsAddBtn) productsAddBtn.style.display = canManageProducts() ? '' : 'none';
  const currentUser = getCurrentUserObject();
  userPermissionsInitialized = !!currentUser;
  lastAppliedUserRole = currentUser?.role || null;
}

async function fetchManagedUsers(force = false) {
  if (!canManageUsers()) {
    usersCache = [];
    return [];
  }
  if (!force && usersCache.length) return usersCache;
  usersCache = await apiCall('/auth/users');
  return usersCache;
}

function populateManagedRoleSelects() {
  const allowedRoles = getAllowedManagedRoles();
  const createRole = document.getElementById('users-create-role');
  if (createRole) {
    createRole.innerHTML = allowedRoles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(ROLE_LABELS[role] || role.toUpperCase())}</option>`).join('');
  }
  const roleFilter = document.getElementById('users-filter-role');
  if (roleFilter) {
    const current = roleFilter.value || '';
    roleFilter.innerHTML = `<option value="">Todos os perfis</option>${USER_ROLE_ORDER.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(ROLE_LABELS[role] || role.toUpperCase())}</option>`).join('')}`;
    roleFilter.value = current;
  }
}

async function renderSettingsPage() {
  applyRolePermissions();
  populateManagedRoleSelects();
  const usernameHidden = document.getElementById('settings-password-username');
  if (usernameHidden) usernameHidden.value = getCurrentUserObject()?.username || '';
  if (!canManageUsers()) {
    const listEl = document.getElementById('users-list');
    if (listEl) listEl.innerHTML = '<div class="empty-msg">Seu perfil pode alterar a própria senha, mas não pode administrar usuários.</div>';
    return;
  }
  await fetchManagedUsers();
  renderUsersPage();
}

function clearUsersFilters() {
  const ids = ['users-filter-search', 'users-filter-role', 'users-filter-status'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = '';
    else el.value = '';
  });
  renderUsersPage();
}

function renderUsersPage() {
  const listEl = document.getElementById('users-list');
  if (!listEl) return;
  if (!canManageUsers()) {
    listEl.innerHTML = '<div class="empty-msg">Gestão de usuários indisponível para este perfil.</div>';
    return;
  }
  const search = (document.getElementById('users-filter-search')?.value || '').trim().toLowerCase();
  const roleFilter = document.getElementById('users-filter-role')?.value || '';
  const statusFilter = document.getElementById('users-filter-status')?.value || '';
  const allowedRoles = new Set(getAllowedManagedRoles());
  const currentUserId = getCurrentUserObject()?.id || '';
  const rows = usersCache
    .filter(user => allowedRoles.has(user.role) || user.id === currentUserId)
    .filter(user => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'inactive' && user.is_active) return false;
      if (search) {
        const hay = `${user.username} ${user.full_name || ''} ${user.role}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  listEl.innerHTML = rows.length ? rows.map(user => {
    const manageable = allowedRoles.has(user.role) && user.id !== currentUserId;
    const roleOptions = getAllowedManagedRoles()
      .map(role => `<option value="${escapeHtml(role)}" ${role === user.role ? 'selected' : ''}>${escapeHtml(ROLE_LABELS[role] || role.toUpperCase())}</option>`)
      .join('');
    return `<div class="outbound-record-card">
      <div class="outbound-record-head">
        <div>
          <div class="outbound-record-title">${escapeHtml(user.username)} — ${escapeHtml(user.full_name || 'Sem nome')}</div>
          <div class="outbound-record-meta">${escapeHtml(ROLE_LABELS[user.role] || user.role.toUpperCase())} · ${user.is_active ? 'ATIVO' : 'INATIVO'} · último login ${escapeHtml(user.last_login_at ? fmtDateTime(user.last_login_at) : '—')}</div>
        </div>
      </div>
      <div class="history-filters" style="margin-top:12px">
        ${manageable ? `<select class="po-select" onchange="updateManagedUserRole('${escapeJs(user.id)}', this.value)">${roleOptions}</select>` : `<div class="result-count">${escapeHtml(ROLE_LABELS[user.role] || user.role.toUpperCase())}</div>`}
        ${manageable ? `<button class="btn" onclick="toggleManagedUserActive('${escapeJs(user.id)}', ${user.is_active ? 'false' : 'true'})">${user.is_active ? 'DESATIVAR' : 'REATIVAR'}</button>` : ''}
        ${manageable ? `<button class="btn" onclick="resetManagedUserPassword('${escapeJs(user.id)}')">REDEFINIR SENHA</button>` : ''}
        ${(manageable && (getCurrentUserRole() === 'gerente' || getCurrentUserRole() === 'admin' || getCurrentUserRole() === 'master')) ? `<button class="btn btn-danger" onclick="deleteManagedUser('${escapeJs(user.id)}')">EXCLUIR</button>` : ''}
      </div>
    </div>`;
  }).join('') : '<div class="empty-msg">Nenhum usuário encontrado com os filtros atuais.</div>';
}

async function createManagedUser() {
  if (!canManageUsers()) {
    await showNotice({ title: 'ACESSO NEGADO', icon: '⛔', desc: 'Seu perfil não pode criar usuários.' });
    return;
  }
  const username = sanitizeTextInput(document.getElementById('users-create-username')?.value || '', { maxLength: 60 }).toLowerCase();
  const fullName = sanitizeTextInput(document.getElementById('users-create-full-name')?.value || '', { maxLength: 120 });
  const role = document.getElementById('users-create-role')?.value || '';
  const password = document.getElementById('users-create-password')?.value || '';
  if (!username || !role || !password) {
    await showNotice({ title: 'CAMPOS OBRIGATÓRIOS', icon: '⛔', desc: 'Usuário, perfil e senha inicial são obrigatórios.' });
    return;
  }
  const created = await apiCall('/auth/users', 'POST', { username, full_name: fullName, role, password });
  usersCache.push(created);
  document.getElementById('users-create-username').value = '';
  document.getElementById('users-create-full-name').value = '';
  document.getElementById('users-create-password').value = '';
  await showNotice({ title: 'USUÁRIO CRIADO', icon: '👤', desc: `Usuário ${created.username} criado com perfil ${ROLE_LABELS[created.role] || created.role}.` });
  renderUsersPage();
}

async function updateManagedUserRole(userId, role) {
  const updated = await apiCall(`/auth/users/${userId}`, 'PATCH', { role });
  usersCache = usersCache.map(user => user.id === userId ? updated : user);
  renderUsersPage();
}

async function toggleManagedUserActive(userId, isActive) {
  const updated = await apiCall(`/auth/users/${userId}`, 'PATCH', { is_active: !!isActive });
  usersCache = usersCache.map(user => user.id === userId ? updated : user);
  renderUsersPage();
}

async function resetManagedUserPassword(userId) {
  const password = await showTextPrompt({ title: 'REDEFINIR SENHA', label: 'NOVA SENHA', placeholder: 'mínimo 8 caracteres', okLabel: 'REDEFINIR', maxLength: 120 });
  if (!password) return;
  const updated = await apiCall(`/auth/users/${userId}/reset-password`, 'POST', { password });
  usersCache = usersCache.map(user => user.id === userId ? updated : user);
  await showNotice({ title: 'SENHA REDEFINIDA', icon: '🔐', desc: `Senha do usuário ${updated.username} atualizada.` });
  renderUsersPage();
}

async function deleteManagedUser(userId) {
  const target = usersCache.find(user => user.id === userId);
  if (!target) return;
  const ok = await showConfirm({
    title: 'EXCLUIR USUÁRIO',
    icon: '🗑',
    desc: 'Esta conta será removida permanentemente do sistema.',
    summary: { USUÁRIO: target.username, PERFIL: ROLE_LABELS[target.role] || target.role.toUpperCase() },
    okLabel: 'EXCLUIR',
    okStyle: 'danger',
  });
  if (!ok) return;
  await apiCall(`/auth/users/${userId}`, 'DELETE');
  usersCache = usersCache.filter(user => user.id !== userId);
  renderUsersPage();
}

async function changeMyPassword() {
  const currentPassword = document.getElementById('settings-current-password')?.value || '';
  const newPassword = document.getElementById('settings-new-password')?.value || '';
  if (!currentPassword || !newPassword) {
    await showNotice({ title: 'CAMPOS OBRIGATÓRIOS', icon: '⛔', desc: 'Informe a senha atual e a nova senha.' });
    return;
  }
  const me = await apiCall('/auth/change-password', 'POST', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  window.CURRENT_USER = {
    id: me.id,
    username: me.username,
    full_name: me.full_name,
    role: me.role,
    is_active: me.is_active,
    parent_user_id: me.parent_user_id,
    last_login_at: me.last_login_at,
  };
  sessionStorage.setItem('current_user', JSON.stringify(window.CURRENT_USER));
  window.dispatchEvent(new CustomEvent('wms:current-user-changed', { detail: window.CURRENT_USER }));
  document.getElementById('settings-current-password').value = '';
  document.getElementById('settings-new-password').value = '';
  await showNotice({ title: 'SENHA ALTERADA', icon: '🔐', desc: 'Sua senha foi alterada com sucesso.' });
}

async function downloadAdminBackup() {
  if (!hasPermission('clear.all')) {
    await showNotice({ title: 'ACESSO NEGADO', icon: '⛔', desc: 'Somente admin e master podem gerar backup do banco.' });
    return;
  }
  const btn = document.getElementById('settings-backup-btn');
  try {
    setButtonLoading(btn, true, 'GERANDO...');
    const token = sessionStorage.getItem('token');
    const res = await fetch('/api/wms/admin/backup', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) {
      let message = 'Falha ao gerar o backup.';
      try {
        const data = await res.json();
        message = data?.detail || message;
      } catch (err) {}
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] || `wms-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await showNotice({ title: 'BACKUP GERADO', icon: '💾', desc: `Arquivo ${filename} pronto para download.` });
  } catch (err) {
    await showNotice({ title: 'FALHA NO BACKUP', icon: '⛔', desc: err?.message || 'Não foi possível gerar o backup agora.' });
  } finally {
    setButtonLoading(btn, false);
  }
}

let qualityRowsCurrent = [];
let qualitySummaryCurrent = [];
let qualityDataCache = { states: null, summary: null, fetchedAt: 0, inFlight: null };

function collectLocalQualityRows() {
  const rows = [];
  depots.forEach(depot => {
    const depotShelves = shelvesAll[depot.id] || [];
    const depotProducts = productsAll[depot.id] || {};
    Object.entries(depotProducts).forEach(([drawerKeyValue, list]) => {
      const parsed = parseKey(drawerKeyValue);
      const shelf = parsed ? depotShelves.find(item => item.id === parsed.shelf) : null;
      const shelfType = normalizeShelfType(shelf?.type);
      (list || []).forEach((product, index) => {
        const expiryState = productExpiryStatus(product);
        const nearest = nearestExpiry(product);
        const tags = [];
        if (expiryState === 'expired') tags.push('expired');
        else if (expiryState === 'expiring') tags.push('expiring');
        if (shelfType === 'quarantine') tags.push('quarantine');
        if (shelfType === 'blocked') tags.push('blocked');
        if (!tags.length) return;
        rows.push({
          rowId: `${depot.id}::${drawerKeyValue}::${index}`,
          depotId: depot.id,
          depotName: depot.name,
          drawerKey: drawerKeyValue,
          shelfId: shelf?.id || parsed?.shelf || '',
          shelfType,
          product,
          productIndex: index,
          nearest,
          expiryState,
          tags,
          stockItemId: null,
          source: 'local',
        });
      });
    });
  });
  return rows.sort((a, b) => {
    const aTime = a.nearest ? Date.parse(a.nearest) : Number.MAX_SAFE_INTEGER;
    const bTime = b.nearest ? Date.parse(b.nearest) : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

async function fetchQualityData(force = false) {
  const fresh = !force && qualityDataCache.states && (Date.now() - qualityDataCache.fetchedAt) < 15000;
  if (fresh) return qualityDataCache;
  if (qualityDataCache.inFlight) return qualityDataCache.inFlight;
  qualityDataCache.inFlight = (async () => {
    const [states, summary] = await Promise.all([
      apiCall('/wms/quality/states'),
      apiCall('/wms/quality/summary'),
    ]);
    qualityDataCache.states = Array.isArray(states) ? states : [];
    qualityDataCache.summary = Array.isArray(summary) ? summary : [];
    qualityDataCache.fetchedAt = Date.now();
    qualityDataCache.inFlight = null;
    return qualityDataCache;
  })().catch(err => {
    qualityDataCache.inFlight = null;
    throw err;
  });
  return qualityDataCache.inFlight;
}

function buildQualityRowsFromBackend(states) {
  const usage = new Set();
  const rows = (states || []).map((state, stateIndex) => {
    const depotId = state.depot_id || '';
    const drawerKeyValue = state.drawer_key || '';
    const drawerProducts = (productsAll[depotId] || {})[drawerKeyValue] || [];
    let matchedIndex = -1;
    let matchedProduct = null;
    let bestScore = -1;
    drawerProducts.forEach((product, index) => {
      const usageKey = `${depotId}::${drawerKeyValue}::${index}`;
      if (usage.has(usageKey)) return;
      if ((product.code || '') !== (state.product_code || '')) return;
      let score = 0;
      if ((nearestExpiry(product) || null) === (state.nearest_expiry || null)) score += 4;
      if (productExpiryStatus(product) === state.expiry_status) score += 2;
      if ((product.lot || '') && (product.lot || '') === (state.lot || '')) score += 1;
      if (score > bestScore) {
        bestScore = score;
        matchedIndex = index;
        matchedProduct = product;
      }
    });
    if (matchedIndex >= 0) usage.add(`${depotId}::${drawerKeyValue}::${matchedIndex}`);
    const depot = getDepotById(depotId);
    const parsed = parseKey(drawerKeyValue);
    const fallbackProduct = matchedProduct || {
      code: state.product_code || '—',
      name: state.product_code || 'Produto',
      lot: '',
      qty: 0,
      kg: 0,
      kgTotal: 0,
      category: '',
      family: '',
      supplier: '',
    };
    const tags = [];
    if (state.expiry_status === 'expired') tags.push('expired');
    else if (state.expiry_status === 'expiring') tags.push('expiring');
    if (state.is_quarantine) tags.push('quarantine');
    if (state.is_blocked) tags.push('blocked');
    return {
      rowId: matchedIndex >= 0 ? `${depotId}::${drawerKeyValue}::${matchedIndex}` : `db::${state.stock_item_id || stateIndex}`,
      depotId,
      depotName: depot?.name || depotId,
      drawerKey: drawerKeyValue,
      shelfId: parsed?.shelf || '',
      shelfType: normalizeShelfType(state.shelf_type),
      product: fallbackProduct,
      productIndex: matchedIndex,
      nearest: state.nearest_expiry || null,
      expiryState: state.expiry_status || 'none',
      tags,
      stockItemId: state.stock_item_id || null,
      source: 'backend',
    };
  });
  return rows.sort((a, b) => {
    const aTime = a.nearest ? Date.parse(a.nearest) : Number.MAX_SAFE_INTEGER;
    const bTime = b.nearest ? Date.parse(b.nearest) : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function clearQualityFilters() {
  const typeEl = document.getElementById('quality-filter-type');
  const depotEl = document.getElementById('quality-filter-depot');
  const searchEl = document.getElementById('quality-filter-search');
  if (typeEl) typeEl.value = '';
  if (depotEl) depotEl.value = '';
  if (searchEl) searchEl.value = '';
  renderQualityPage();
}

function syncQualityDepotFilterOptions(rows) {
  const select = document.getElementById('quality-filter-depot');
  if (!select) return;
  const current = select.value;
  const options = Array.from(new Set(rows.map(row => row.depotId))).map(id => {
    const depot = getDepotById(id);
    return `<option value="${id}">${escapeHtml(depot?.name || id)}</option>`;
  }).join('');
  select.innerHTML = `<option value="">Todos os depósitos</option>${options}`;
  select.value = Array.from(select.options).some(option => option.value === current) ? current : '';
}

function renderQualityContent(rows, summaryRows = []) {
  qualityRowsCurrent = rows;
  qualitySummaryCurrent = summaryRows;
  syncQualityDepotFilterOptions(rows);
  const typeFilter = document.getElementById('quality-filter-type')?.value || '';
  const depotFilter = document.getElementById('quality-filter-depot')?.value || '';
  const searchFilter = (document.getElementById('quality-filter-search')?.value || '').trim().toLowerCase();

  const filtered = rows.filter(row => {
    if (typeFilter && !row.tags.includes(typeFilter)) return false;
    if (depotFilter && row.depotId !== depotFilter) return false;
    if (searchFilter) {
      const haystack = [
        row.depotName,
        row.drawerKey,
        row.shelfId,
        row.product.code,
        row.product.name,
        row.product.lot,
        row.product.category,
        row.product.family,
      ].join(' ').toLowerCase();
      if (!haystack.includes(searchFilter)) return false;
    }
    return true;
  });

  const kpiEl = document.getElementById('quality-kpi-grid');
  const listEl = document.getElementById('quality-list');
  const emptyEl = document.getElementById('quality-empty-state');
  if (!kpiEl || !listEl || !emptyEl) return;

  const globalSummary = summaryRows.find(row => row.scope_type === 'global') || null;
  const counts = globalSummary ? {
    expired: globalSummary.expired_count || 0,
    expiring: globalSummary.expiring_count || 0,
    quarantine: globalSummary.quarantine_count || 0,
    blocked: globalSummary.blocked_count || 0,
  } : {
    expired: rows.filter(row => row.tags.includes('expired')).length,
    expiring: rows.filter(row => row.tags.includes('expiring')).length,
    quarantine: rows.filter(row => row.tags.includes('quarantine')).length,
    blocked: rows.filter(row => row.tags.includes('blocked')).length,
  };
  kpiEl.innerHTML = [
    { label: 'VENCIDOS', value: counts.expired, cls: 'blocked' },
    { label: 'A VENCER', value: counts.expiring, cls: 'quarantine' },
    { label: 'EM QUARENTENA', value: counts.quarantine, cls: 'quarantine' },
    { label: 'BLOQUEADOS', value: counts.blocked, cls: 'blocked' },
  ].map(card => `<div class="quality-kpi-card ${card.cls}"><div class="quality-kpi-label">${card.label}</div><div class="quality-kpi-value">${card.value}</div></div>`).join('');

  emptyEl.style.display = filtered.length ? 'none' : 'block';
  listEl.innerHTML = filtered.map(row => {
    const product = row.product;
    const expiryLabel = row.nearest ? fmtDate(row.nearest) : 'Sem validade';
    const expiryBadge = row.expiryState === 'expired'
      ? '<span class="status-badge expired">VENCIDO</span>'
      : row.expiryState === 'expiring'
      ? '<span class="status-badge expiring">A VENCER</span>'
      : '';
    const shelfBadge = buildShelfTypeBadge({ type: row.shelfType });
    const qty = parseFloat(product.qty || 1).toFixed(3);
    const kg = (parseFloat(product.kgTotal ?? product.kg) || 0).toFixed(3);
    const canQualityManage = hasPermission('quality.manage');
    return `<div class="quality-row ${getShelfTypeClass(row.shelfType)}">
      <div class="quality-main">
        <div class="quality-head">
          <div class="quality-product">${escapeHtml(product.code)} — ${escapeHtml(product.name)}</div>
          <div class="quality-badges">${expiryBadge}${shelfBadge}</div>
        </div>
        <div class="quality-meta">${escapeHtml(row.depotName)} · ${escapeHtml(row.drawerKey)} · lote ${escapeHtml(product.lot || '—')} · validade ${escapeHtml(expiryLabel)}</div>
        <div class="quality-meta">${qty} un · ${kg} kg · família ${escapeHtml(product.family || '—')} · grupo ${escapeHtml(product.category || '—')} · fornecedor ${escapeHtml(product.supplier || '—')}</div>
      </div>
      <div class="quality-actions">
        <button class="btn" onclick="switchDepot('${escapeJs(row.depotId)}');showPage('depot');setFocusedDrawer('${escapeJs(row.drawerKey)}')">ABRIR</button>
        ${canQualityManage ? `<button class="btn" onclick="openQualityMoveModal('${escapeJs(row.rowId)}','quarantine')">QUARENTENA</button>` : ''}
        ${canQualityManage ? `<button class="btn btn-danger" onclick="openQualityMoveModal('${escapeJs(row.rowId)}','blocked')">BLOQUEIO</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function renderQualityPage(force = false) {
  const kpiEl = document.getElementById('quality-kpi-grid');
  const listEl = document.getElementById('quality-list');
  if (kpiEl && listEl && !qualityRowsCurrent.length) {
    kpiEl.innerHTML = '';
    listEl.innerHTML = '<div class="empty-msg" style="padding:16px">Carregando dados de qualidade do banco...</div>';
  }
  try {
    const data = await fetchQualityData(force);
    renderQualityContent(buildQualityRowsFromBackend(data.states), data.summary || []);
  } catch (err) {
    console.error('Falha ao carregar qualidade do backend:', err);
    renderQualityContent(collectLocalQualityRows(), []);
  }
}

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
  menu.innerHTML = results.length
    ? results.map((product, index) => `<button type="button" class="blind-lookup-option" data-blind-lookup-index="${index}"><span class="blind-lookup-code">${escapeHtml(product.code || '—')}</span><span class="blind-lookup-name">${escapeHtml(product.name || '')}</span></button>`).join('')
    : '<div class="blind-lookup-empty">Nenhum produto encontrado.</div>';
  menu.classList.remove('blind-lookup-hidden');
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
  menu.innerHTML = separationLookupResults.map((item, index) => `<button type="button" class="blind-lookup-item" data-separation-lookup-index="${index}">
    <strong>${escapeHtml(item.label || `${item.name} - ${item.code}`)}</strong>
    <span>${escapeHtml(String(item.available_quantity || 0))} un · ${escapeHtml((parseFloat(item.available_kg || 0) || 0).toFixed(3))} kg · validade ${escapeHtml(item.nearest_expiry ? fmtDate(item.nearest_expiry) : '—')}</span>
  </button>`).join('');
  menu.classList.remove('blind-lookup-hidden');
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
}

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

// ══ SAVE DRAWER CHANGES ═══════════════════════════════════════════════
function saveDrawerChanges() {
  if (!hasPermission('entry.register')) return;
  if (!currentDrawerKey) return;
  logHistory('💾', `Gaveta salva: ${currentDrawerKey}`, `${(products[currentDrawerKey]||[]).length} produto(s)`, { depotId: activeDepotId, drawerKey: currentDrawerKey });
  const btn = document.querySelector('.modal-footer .btn[onclick="saveDrawerChanges()"]');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ SALVO!'; btn.style.color='var(--accent3)'; setTimeout(()=>{btn.textContent=orig;btn.style.color='';},1500); }
  renderAll();
}




// ══ DRAWER DRAG & DROP ════════════════════════════════════════════════
let dndSrcKey  = null;   // source drawer key
let dndSrcIdx  = null;   // product index (null = whole drawer, future)
let dndOverKey = null;
const dndGhost = () => document.getElementById('dnd-ghost');

function dndInit(drawerEl, key) {
  // Make the whole drawer div draggable
  drawerEl.setAttribute('draggable', 'true');

  drawerEl.addEventListener('dragstart', (e) => {
    dndSrcKey = key;
    drawerEl.classList.add('dnd-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
    const prods = products[key] || [];
    const ghost = dndGhost();
    if (ghost) {
      ghost.textContent = '⠿ ' + (prods.length ? prods.map(p=>p.code).join(', ') : 'vazia') + ' → ?';
      ghost.style.display = 'block';
    }
  });

  drawerEl.addEventListener('dragend', () => {
    drawerEl.classList.remove('dnd-dragging');
    if (dndGhost()) dndGhost().style.display = 'none';
    // remove all dnd-over classes
    document.querySelectorAll('.drawer.dnd-over').forEach(el => el.classList.remove('dnd-over'));
    dndSrcKey = null; dndOverKey = null;
  });

  drawerEl.addEventListener('dragover', (e) => {
    if (!dndSrcKey || dndSrcKey === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dndOverKey !== key) {
      document.querySelectorAll('.drawer.dnd-over').forEach(el => el.classList.remove('dnd-over'));
      drawerEl.classList.add('dnd-over');
      dndOverKey = key;
    }
    const ghost = dndGhost();
    if (ghost) { ghost.style.left = (e.clientX + 14) + 'px'; ghost.style.top = (e.clientY + 14) + 'px'; }
  });

  drawerEl.addEventListener('dragleave', () => {
    drawerEl.classList.remove('dnd-over');
    if (dndOverKey === key) dndOverKey = null;
  });

  drawerEl.addEventListener('drop', (e) => {
    e.preventDefault();
    drawerEl.classList.remove('dnd-over');
    if (!dndSrcKey || dndSrcKey === key) return;
    // use the move-mode flow: set mvState and open confirm
    const srcProds = products[dndSrcKey] || [];
    if (!srcProds.length) return;
    // pick first product and open move modal
    dndSrcKey_pending = dndSrcKey;
    dndDstKey_pending = key;
    openDndMoveModal();
  });
}

function dndSwapDrawers(srcKey, dstKey) {
  const srcProds = products[srcKey] || [];
  const dstProds = products[dstKey] || [];
  if (srcProds.length === 0) return; // nothing to move

  // swap entire contents
  const tmp = [...srcProds];
  products[srcKey] = [...dstProds];
  products[dstKey] = [...tmp];
  // clean up empty
  if (!products[srcKey].length) delete products[srcKey];

  logHistory('🔀', `Gavetas trocadas: ${srcKey} ↔ ${dstKey}`,
    tmp.map(p=>p.code).join(', ') + (dstProds.length ? ' | ← '+dstProds.map(p=>p.code).join(', ') : ''),
    { depotId: activeDepotId, from: srcKey, to: dstKey, drawerKey: dstKey, productCode: [...tmp.map(p=>p.code), ...dstProds.map(p=>p.code)].join(',') });

  // refresh whichever modal is currently showing
  if (document.getElementById('drawer-modal')?.classList.contains('open')) {
    renderDrawerProducts();
  }
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open') && fpFocusedShelf) {
    const depotId = fpFocusedDepotId || activeDepotId;
    const shelf = (shelvesAll[depotId] || []).find(s => s.id === fpFocusedShelf);
    if (shelf) renderFpModalBody(shelf, depotId);
  }
  renderAll();
}


// ── DnD pending move ────────────────────────────────────────────────
let dndSrcKey_pending = null;
let dndDstKey_pending = null;

function openDndMoveModal() {
  const src = dndSrcKey_pending, dst = dndDstKey_pending;
  if (!src || !dst) return;
  const srcProds = products[src] || [];
  if (!srcProds.length) { dndSrcKey_pending=null; dndDstKey_pending=null; return; }

  document.getElementById('dnd-move-from').textContent = src;
  document.getElementById('dnd-move-to').textContent   = dst;

  const list = document.getElementById('dnd-product-list');
  list.innerHTML = srcProds.map((p,i) => {
    const expiries = getExpiries(p).filter(Boolean).sort();
    const st = productExpiryStatus(p);
    const stBadge = st==='expired' ? '<span style="color:var(--danger);font-size:9px;font-weight:700">VENCIDO</span>'
                  : st==='expiring'? `<span style="color:var(--warn);font-size:9px;font-weight:700">⚠${daysUntil(nearestExpiry(p))}d</span>` : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);">
      <input type="checkbox" id="dndp-${i}" checked style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;">
      <label for="dndp-${i}" style="flex:1;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px">
        <strong style="color:#004499">${p.code}</strong> — ${p.name} ${stBadge}
        <div style="font-size:10px;color:var(--text2)">${p.kg||0}kg${p.entry?' · Entrada:'+p.entry:''}${expiries.length?' · Val:'+expiries.map(fmtDate).join(', '):''}</div>
      </label>
    </div>`;
  }).join('');

  document.getElementById('dnd-move-modal').classList.add('open');
}

async function confirmDndMove() {
  const src = dndSrcKey_pending, dst = dndDstKey_pending;
  if (!src || !dst) return;
  const srcProds = [...(products[src] || [])];
  const selected = [];
  const remaining = [];
  srcProds.forEach((p, i) => {
    const cb = document.getElementById('dndp-' + i);
    if (cb && cb.checked) selected.push(p);
    else remaining.push(p);
  });
  if (!selected.length) { closeDndMoveModal(); return; }
  const incomingKg = selected.reduce((sum, product) => sum + (parseFloat(product.kg) || 0), 0);
  const validation = validateDrawerPlacement({
    depotId: activeDepotId,
    drawerKeyValue: dst,
    incomingKg,
  });
  if (!validation.ok) {
    await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary });
    return;
  }

  const okMove = await showConfirm({
    title: 'CONFIRMAR TRANSFERÊNCIA',
    icon: '🔀',
    desc: 'Deseja mover os produtos selecionados para a gaveta destino?',
    summary: {
      ORIGEM: src,
      DESTINO: dst,
      ITENS: String(selected.length),
      PESO: `${incomingKg.toFixed(3)} kg`,
    },
    okLabel: 'MOVER',
  });
  if (!okMove) return;

  // move selected to dest
  if (!products[dst]) products[dst] = [];
  selected.forEach(p => products[dst].push({...p}));
  products[src] = remaining;
  if (!remaining.length) delete products[src];

  logHistory('🔀', `DnD: ${selected.map(p=>p.code).join(',')}`, `${src} → ${dst}`, { depotId: activeDepotId, from: src, to: dst, drawerKey: dst, productCode: selected.map(p => p.code).join(',') });
  closeDndMoveModal();
  // refresh open modals
  if (document.getElementById('drawer-modal')?.classList.contains('open')) renderDrawerProducts();
  if (fpFocusedShelf) {
    const depotId = fpFocusedDepotId || activeDepotId;
    const sh=(shelvesAll[depotId] || []).find(s=>s.id===fpFocusedShelf);
    if(sh) renderFpModalBody(sh, depotId);
  }
  renderAll();
}

function closeDndMoveModal() {
  document.getElementById('dnd-move-modal').classList.remove('open');
  dndSrcKey_pending = null; dndDstKey_pending = null;
}

// ══ SIDEBAR RESIZE ═══════════════════════════════════════════════════
(function() {
  const MIN = 180, MAX = () => Math.floor(window.innerWidth * 0.6);
  let dragging = false, startX = 0, startW = 0;
  const sidebar  = document.getElementById('sidebar');
  const resizer  = document.getElementById('sidebar-resizer');
  if (!sidebar || !resizer) return;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW  = Math.min(Math.max(startW + delta, MIN), MAX());
    sidebar.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });

  // double-click resets to default
  resizer.addEventListener('dblclick', () => {
    sidebar.style.width = '320px';
  });
})();

// ══ SEARCH & FILTER STATE ══════════════════════════════════════════════
let searchScope   = 'product'; // 'product' | 'address'
let activeChips   = new Set();   // 'occupied'|'empty'|'expired'|'expiring'|'multi'|'selected'

function setScope(scope) {
  searchScope = scope;
  document.getElementById('scope-product').classList.toggle('active', scope === 'product');
  document.getElementById('scope-address').classList.toggle('active', scope === 'address');
  document.getElementById('grid-search').placeholder = scope === 'product' ? 'Código ou nome...' : 'Ex: A2  ou  A2.G3  ou  B';
  applyFilters();
}

function toggleChip(name) {
  activeChips.has(name) ? activeChips.delete(name) : activeChips.add(name);
  const el = document.getElementById('chip-' + name);
  if (el) el.classList.toggle('active', activeChips.has(name));
  applyFilters();
}

function clearSearch() {
  document.getElementById('grid-search').value = '';
  applyFilters();
}

function clearAllFilters() {
  document.getElementById('grid-search').value = '';
  activeChips.clear();
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  applyFilters();
}

function applyFilters() {
  const q    = (document.getElementById('grid-search')?.value || '').trim().toLowerCase();
  const chips = activeChips;

  let shown = 0, hidden = 0;

  document.querySelectorAll('.shelf-block').forEach(block => {
    const shelfId = block.querySelector('.shelf-block-name')?.textContent.replace('PRATELEIRA ','').trim();
    let anyVisible = false;

    block.querySelectorAll('.drawer[data-key]').forEach(dEl => {
      const key   = dEl.dataset.key;
      const depotId = dEl.dataset.depot || activeDepotId;
      const prods = getDrawerProductsForDepotView(depotId, key);
      const isOccupied = prods.length > 0;

      // ── address scope match ──
      let addrMatch = true;
      if (q && searchScope === 'address') {
        const qUp = q.toUpperCase();
        const parsed = parseKey(key);
        addrMatch =
          key.toUpperCase().startsWith(qUp) ||        // exact prefix  A1.G2
          (parsed && parsed.shelf === qUp) ||          // shelf only    A
          (parsed && `${parsed.shelf}${parsed.floor}` === qUp) || // shelf+floor A1
          key.toUpperCase() === qUp;                   // exact match
      }

      // ── product scope match ──
      let prodMatch = true;
      if (q && searchScope === 'product') {
        prodMatch = prods.some(p =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
        );
      }

      // ── chip filters (AND logic within incompatible groups, OR within same) ──
      let chipPass = true;

      // occupancy group: occupied / empty are mutually exclusive intent
      if (chips.has('occupied') && !chips.has('empty')   && !isOccupied) chipPass = false;
      if (chips.has('empty')    && !chips.has('occupied') && isOccupied)  chipPass = false;

      if (chips.has('expired') && chipPass) {
        const st = drawerExpiryStatus(prods);
        if (st !== 'expired') chipPass = false;
      }
      if (chips.has('expiring') && chipPass) {
        const st = drawerExpiryStatus(prods);
        if (st !== 'expiring') chipPass = false;
      }
      if (chips.has('multi') && chipPass) {
        const skus = new Set(prods.map(p => p.code));
        if (skus.size < 2) chipPass = false;
      }
      if (chips.has('selected') && chipPass) {
        if (!selectedProductCode || !prods.some(p => p.code === selectedProductCode)) chipPass = false;
      }

      const visible = addrMatch && prodMatch && chipPass;
      dEl.classList.toggle('filtered-out', !visible);
      if (visible) { anyVisible = true; shown++; } else { hidden++; }
    });

    block.classList.toggle('all-filtered', !anyVisible);
  });

  const total = shown + hidden;
  const countEl = document.getElementById('filter-result-count');
  if (countEl) {
    if (!q && chips.size === 0) {
      countEl.textContent = `${total} gavetas`;
    } else {
      countEl.textContent = `${shown} / ${total} gavetas`;
      countEl.style.color = shown === 0 ? 'var(--danger)' : shown < total ? 'var(--warn)' : 'var(--text3)';
    }
  }
}

// ——— NAVIGATE TO DRAWER ———
function navigateToDrawer(key, code) {
  // close any open modals
  ['expiry-modal','prod-detail-modal'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
  });

  // switch to depot page
  showPage('depot');

  // highlight the specific product + drawer
  if (code) selectedProductCode = code;
  setFocusedDrawer(key);
  renderAll();

  // scroll and flash the drawer
  requestAnimationFrame(() => {
    const target = document.querySelector(`.drawer[data-key="${key}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.outline = '3px solid var(--accent)';
      target.style.transition = 'none';
      setTimeout(() => {
        target.style.outline = '3px solid transparent';
        target.style.transition = 'outline .8s ease';
        setTimeout(() => { target.style.outline = ''; target.style.transition = ''; }, 900);
      }, 500);
    }
  });
}

function startRevisionPolling() {
  if (revisionPollTimer) clearInterval(revisionPollTimer);
  revisionPollTimer = setInterval(async () => {
    if (syncInFlight || stateHydrating) return;
    try {
      const meta = await apiCall('/wms/meta');
      if (meta?.revision && meta.revision !== serverRevision) {
        await loadAppState(false);
        renderAll();
      }
    } catch (err) {
      console.error('Falha ao consultar revisão do WMS:', err);
    }
  }, 5000);
}

// ——— INIT ———
async function init() {
  hydrateCurrentUserFromStorage();
  applyRolePermissions();
  ensurePageNavigationConsistency('depot');
  const loaded = await loadAppState(false);
  if (loaded === null) return;
  if (typeof startServerAvailabilityMonitor === 'function') {
    startServerAvailabilityMonitor({ redirectToLoginOnRecovery: true });
  }
  fpLoadLayout();
  ensureDepotState();
  qrWorkflow.depotId = activeDepotId;
  const today = new Date().toISOString().slice(0, 10);
  const gpEntry = document.getElementById('gp-entry'); if (gpEntry) gpEntry.value = today;
  const qrEntry = document.getElementById('qr-form-entry'); if (qrEntry) qrEntry.value = today;
  syncWeightFields('gp', 'qty');
  syncWeightFields('pf', 'qty');
  syncWeightFields('qr', 'qty');
  renderDepotTabs();
  renderAll();
  applyRolePermissions();
  ensurePageNavigationConsistency(getCurrentPageName());
  startRevisionPolling();
}

function renderAll(skipPersist = false) {
  // keep shims in sync with active depot
  shelves  = shelvesAll[activeDepotId]  || [];
  products = productsAll[activeDepotId] || {};
  applyRolePermissions();
  ensurePageNavigationConsistency(getCurrentPageName());
  renderDepotTabs();
  renderDepotsPage();
  renderShelfGrid();
  renderProductTable();
  renderShelfList();
  renderStats();
  renderAlerts();
  renderHistory();
  if (typeof renderProductsPage === 'function' && document.getElementById('page-products')) renderProductsPage();
  if (document.getElementById('page-unloads')?.classList.contains('active')) renderUnloadsPage();
  if (document.getElementById('page-receiving')?.classList.contains('active')) openReceivingPage();
  if (document.getElementById('page-unload-review')?.classList.contains('active')) renderUnloadReviewPage();
  if (typeof renderPageHistory === 'function' && document.getElementById('page-history-list')) renderPageHistory();
  if (typeof renderShippingRecordCount === 'function') renderShippingRecordCount();
  if (typeof renderShippingPage === 'function' && document.getElementById('page-saidas')?.classList.contains('active')) renderShippingPage();
  if (typeof renderSeparationPage === 'function' && document.getElementById('page-separation')?.classList.contains('active')) renderSeparationPage();
  if (typeof renderOutboundRecordsPage === 'function' && document.getElementById('page-outbound')?.classList.contains('active')) renderOutboundRecordsPage();
  if (typeof renderQualityPage === 'function' && document.getElementById('page-quality')) renderQualityPage();
  if (typeof renderIndicatorsPage === 'function' && document.getElementById('page-indicators')?.classList.contains('active')) renderIndicatorsPage();
  if (document.getElementById('page-settings')?.classList.contains('active')) renderSettingsPage();
  if (typeof renderQrPage === 'function' && document.getElementById('page-qr')?.classList.contains('active')) renderQrPage();
  applyFilters();
  syncSbChips();
  if (typeof fpPopulateDepotSelect === 'function') fpPopulateDepotSelect();
  if (document.getElementById('page-floorplan')?.classList.contains('active')) { renderFloorPlan(); setTimeout(() => { if(fpSearchQuery||fpSearchFilter) fpApplySearch(); }, 50); }
  // also refresh fp modal body if open
  if (fpFocusedShelf && document.getElementById('fp-shelf-modal')?.classList.contains('open')) {
    const depotId = fpFocusedDepotId || activeDepotId;
    const sh = (shelvesAll[depotId] || []).find(s => s.id === fpFocusedShelf);
    if (sh) renderFpModalBody(sh, depotId);
  }
  if (!stateHydrating && !skipPersist && !suppressAutoPersist) saveAppState();
}

function syncSbChips() {
  ['all','expired','expiring','multi','none','missing'].forEach(k => {
    const el = document.getElementById('sbf-' + k);
    if (el) el.classList.toggle('active', (k === 'all' && sbFilter === '') || k === sbFilter);
  });
}

function formatSecondsHms(totalSeconds = 0) {
  const diff = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(diff / 3600)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function setReceivingStep(step = 1) {
  receivingStep = Math.max(1, Math.min(4, parseInt(step, 10) || 1));
  document.querySelectorAll('#receiving-stepper .receiving-step').forEach(node => {
    node.classList.toggle('active', String(node.dataset.step) === String(receivingStep));
  });
  document.querySelectorAll('#page-receiving .receiving-stage').forEach(node => {
    node.classList.toggle('active', node.id === `receiving-stage-${receivingStep}`);
  });
}

function getReceivingItemCatalogMatch(rawCode = '', rawDesc = '', rawEan = '') {
  const code = String(rawCode || '').trim().toUpperCase();
  const desc = String(rawDesc || '').trim().toUpperCase();
  const ean = String(rawEan || '').trim().toUpperCase();
  for (const depotMap of Object.values(productsAll || {})) {
    for (const items of Object.values(depotMap || {})) {
      for (const item of items || []) {
        if (code && String(item.code || '').trim().toUpperCase() === code) return item;
        if (ean && String(item.ean || '').trim().toUpperCase() === ean) return item;
        if (desc && String(item.name || '').trim().toUpperCase() === desc) return item;
      }
    }
  }
  return null;
}

function refreshReceivingSelectedInfo() {
  const infoEl = document.getElementById('receiving-selected-xml');
  if (!infoEl) return;
  const selected = receivingSelectedNfe;
  if (!selected) {
    infoEl.innerHTML = '<div class="empty-msg">Nenhuma NF-e selecionada.</div>';
    return;
  }
  infoEl.innerHTML = `
    <div><strong>NF:</strong> ${escapeHtml(selected.numero_nf || '—')} / série ${escapeHtml(selected.serie || '—')}</div>
    <div><strong>Emitente:</strong> ${escapeHtml(selected.emitente?.nome || '—')} (${escapeHtml(selected.emitente?.cnpj || '—')})</div>
    <div><strong>Emissão:</strong> ${escapeHtml(fmtDateTime(selected.data_emissao))}</div>
    <div><strong>Itens:</strong> ${escapeHtml(String((selected.produtos || []).length))}</div>
  `;
}

function populateReceivingDepotSelect() {
  const select = document.getElementById('receiving-depot-select');
  if (!select) return;
  select.innerHTML = buildDepotOptionsHtml({ selected: select.value || activeDepotId || depots[0]?.id || '' });
  if (!select.value && activeDepotId) select.value = activeDepotId;
}

function renderReceivingMenuBadge() {
  const badge = document.getElementById('receiving-menu-badge');
  if (!badge) return;
  const now = Date.now();
  const pending = receivingHistoryRecords.filter(item => item.status === 'em_conferencia' && item.started_at && (now - new Date(item.started_at).getTime()) > 2 * 3600 * 1000).length;
  badge.style.display = pending > 0 && canReviewBlindUnloads() ? '' : 'none';
  if (pending > 0) badge.textContent = `${pending} PENDÊNCIA${pending > 1 ? 'S' : ''} > 2H`;
}

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
  receivingAvailableNfes = Array.isArray(nfeResponse?.items) ? nfeResponse.items : [];
  receivingHistoryRecords = Array.isArray(historyResponse?.items) ? historyResponse.items : [];
  const xmlSelect = document.getElementById('receiving-xml-select');
  if (xmlSelect) {
    const current = xmlSelect.value || document.getElementById('receiving-key-input')?.value || '';
    xmlSelect.innerHTML = `<option value="">Selecione uma NF-e</option>${receivingAvailableNfes.map(item => `<option value="${escapeAttr(item.chave_acesso)}">${escapeHtml(`NF ${item.numero_nf || '—'} · ${item.emitente?.nome || 'Emitente'} · ${item.status}`)}</option>`).join('')}`;
    if (current && receivingAvailableNfes.some(item => item.chave_acesso === current)) xmlSelect.value = current;
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
    receivingItems = (receivingSelectedNfe.produtos || []).map((item, index) => ({
      id: `rx-${index}-${item.codigo || 'item'}`,
      codigo_produto: item.codigo || '',
      descricao: item.descricao || '',
      ean: item.ean || '',
      ncm: item.ncm || '',
      unidade_conferida: item.unidade_comercial || item.unidade_tributaria || 'UN',
      qty_conferida: '',
      condicao: 'normal',
      lote: '',
      validade: '',
      observacao: '',
      foto_avaria_base64: '',
      item_extra: false,
    }));
  }
  refreshReceivingSelectedInfo();
  renderReceivingTable();
}

function renderReceivingSessionBanner() {
  const titleEl = document.getElementById('receiving-session-title');
  const metaEl = document.getElementById('receiving-session-meta');
  const plateEl = document.getElementById('receiving-session-plate');
  const operatorEl = document.getElementById('receiving-session-operator');
  if (!titleEl || !metaEl || !plateEl || !operatorEl) return;
  if (!receivingSession) {
    titleEl.textContent = 'NF —';
    metaEl.textContent = 'Aguardando sessão.';
    plateEl.textContent = 'Placa: —';
    operatorEl.textContent = `Operador: ${getCurrentUserLabel()}`;
    return;
  }
  titleEl.textContent = `NF ${receivingSession.numero_nf || '—'} · ${receivingSession.emitente?.nome || 'Emitente'}`;
  metaEl.textContent = `Chave ${receivingSession.chave_acesso || '—'} · Emitente ${receivingSession.emitente?.cnpj || '—'}`;
  plateEl.textContent = `Placa: ${receivingSession.placa_veiculo || '—'}`;
  operatorEl.textContent = `Operador: ${receivingSession.operador || getCurrentUserLabel()}`;
}

function receivingTimerTick() {
  const timerEl = document.getElementById('receiving-timer');
  const badgeEl = document.getElementById('receiving-session-timer-badge');
  const seconds = receivingStartedAt ? Math.floor((Date.now() - new Date(receivingStartedAt).getTime()) / 1000) : 0;
  const label = formatSecondsHms(seconds);
  if (timerEl) timerEl.textContent = label;
  if (badgeEl) {
    badgeEl.textContent = label;
    badgeEl.classList.toggle('status-alert', seconds >= 7200);
    badgeEl.classList.toggle('receiving-timer-alert', seconds >= 7200);
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

function updateReceivingItem(index, field, value) {
  const item = receivingItems[index];
  if (!item) return;
  if (field === 'qty_conferida') {
    item.qty_conferida = value === '' ? '' : String(Math.max(0, parseFloat(value || '0') || 0));
  } else if (field === 'condicao') {
    item.condicao = value || 'normal';
  } else if (field === 'validade') {
    item.validade = value || '';
  } else if (field === 'unidade_conferida') {
    item.unidade_conferida = sanitizeTextInput(value || 'UN', { maxLength: 8, uppercase: true }) || 'UN';
  } else {
    item[field] = sanitizeTextInput(value || '', { maxLength: field === 'observacao' ? 240 : 80 });
  }
  if ((field === 'codigo_produto' || field === 'descricao' || field === 'ean') && item.item_extra) {
    const match = getReceivingItemCatalogMatch(item.codigo_produto, item.descricao, item.ean);
    if (match) {
      item.codigo_produto = item.codigo_produto || match.code || '';
      item.descricao = item.descricao || match.name || '';
      item.ean = item.ean || match.ean || '';
      item.ncm = item.ncm || match.ncm || '';
      item.unidade_conferida = item.unidade_conferida || match.unit || 'UN';
    }
  }
  renderReceivingTable();
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

function renderReceivingTable() {
  const tbody = document.getElementById('receiving-table-body');
  if (!tbody) return;
  renderReceivingSessionBanner();
  const query = (document.getElementById('receiving-table-search')?.value || '').trim().toLowerCase();
  const rows = receivingItems.filter(item => {
    if (!query) return true;
    return [item.codigo_produto, item.descricao, item.ean].some(value => String(value || '').toLowerCase().includes(query));
  });
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhum item em conferência.</td></tr>';
    queueEnhanceResizableTables();
    return;
  }
  tbody.innerHTML = rows.map(item => {
    const index = receivingItems.indexOf(item);
    const validityDays = item.validade ? Math.ceil((new Date(item.validade).getTime() - Date.now()) / 86400000) : null;
    const expiryWarn = validityDays !== null && validityDays < 30;
    const rowClass = item.condicao === 'avariado' ? 'receiving-row-damaged' : expiryWarn ? 'receiving-row-expiry' : '';
    return `
      <tr class="${escapeAttr(rowClass)}">
        <td>
          <input type="text" value="${escapeAttr(item.codigo_produto || '')}" placeholder="Código / EAN" oninput="updateReceivingItem(${index}, 'codigo_produto', this.value)">
          ${item.item_extra ? '<div class="status-badge status-pending">ITEM EXTRA</div>' : ''}
        </td>
        <td>
          <input type="text" value="${escapeAttr(item.descricao || '')}" placeholder="Descrição" oninput="updateReceivingItem(${index}, 'descricao', this.value)">
          <div class="receiving-muted-line">${escapeHtml(item.ean || 'SEM GTIN')} · NCM ${escapeHtml(item.ncm || '—')}</div>
        </td>
        <td><input type="number" min="0" step="0.001" value="${escapeAttr(item.qty_conferida || '')}" placeholder="0" oninput="updateReceivingItem(${index}, 'qty_conferida', this.value)"></td>
        <td><input type="text" value="${escapeAttr(item.unidade_conferida || 'UN')}" maxlength="8" oninput="updateReceivingItem(${index}, 'unidade_conferida', this.value)"></td>
        <td>
          <select onchange="updateReceivingItem(${index}, 'condicao', this.value)">
            <option value="normal" ${item.condicao === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="avariado" ${item.condicao === 'avariado' ? 'selected' : ''}>Avariado</option>
            <option value="retorno" ${item.condicao === 'retorno' ? 'selected' : ''}>Retorno</option>
          </select>
          ${item.condicao === 'avariado' ? '<div class="status-badge status-blocked" title="Será enviado ao estoque bloqueado.">ESTOQUE BLOQUEADO</div>' : ''}
        </td>
        <td>
          <div class="receiving-line-meta">
            <input type="text" value="${escapeAttr(item.lote || '')}" placeholder="Lote" oninput="updateReceivingItem(${index}, 'lote', this.value)">
            <input type="date" value="${escapeAttr(item.validade || '')}" oninput="updateReceivingItem(${index}, 'validade', this.value)">
            <input type="text" value="${escapeAttr(item.observacao || '')}" placeholder="Observação" oninput="updateReceivingItem(${index}, 'observacao', this.value)">
            <input type="file" accept="image/*" onchange="handleReceivingPhotoUpload(${index}, this)">
          </div>
          ${expiryWarn ? '<div class="status-badge status-alert">VALIDADE &lt; 30 DIAS</div>' : ''}
        </td>
      </tr>
    `;
  }).join('');
  queueEnhanceResizableTables();
}

function addReceivingManualItem() {
  receivingItems.push({
    id: `manual-${Date.now()}`,
    codigo_produto: '',
    descricao: '',
    ean: '',
    ncm: '',
    unidade_conferida: 'UN',
    qty_conferida: '',
    condicao: 'normal',
    lote: '',
    validade: '',
    observacao: '',
    foto_avaria_base64: '',
    item_extra: true,
  });
  renderReceivingTable();
}

async function startReceivingSession(button = null) {
  const key = sanitizeTextInput(document.getElementById('receiving-key-input')?.value || '', { maxLength: 44, uppercase: true });
  const plate = sanitizeTextInput(document.getElementById('receiving-plate-input')?.value || '', { maxLength: 8, uppercase: true });
  const depotId = document.getElementById('receiving-depot-select')?.value || activeDepotId || '';
  if (!key || key.length !== 44) {
    await showNotice({ title: 'CHAVE INVÁLIDA', icon: '⛔', desc: 'Informe a chave NF-e com 44 dígitos para iniciar o recebimento.' });
    return;
  }
  setButtonLoading(button, true, 'INICIANDO...');
  try {
    if (!receivingSelectedNfe || receivingSelectedNfe.chave_acesso !== key) {
      receivingSelectedNfe = await apiCall(`/wms/nfe/${encodeURIComponent(key)}`);
    }
    const response = await apiCall('/wms/nfe/receiving/start', 'POST', {
      chave_acesso: key,
      placa_veiculo: plate,
      operador_id: getCurrentUserObject()?.id || null,
      depot_id: depotId,
    });
    receivingSession = response?.session || null;
    receivingItems = (response?.blind?.produtos || receivingSelectedNfe?.produtos || []).map((item, index) => ({
      id: `rx-${index}-${item.codigo || 'item'}`,
      codigo_produto: item.codigo || '',
      descricao: item.descricao || '',
      ean: item.ean || '',
      ncm: item.ncm || '',
      unidade_conferida: item.unidade_comercial || item.unidade_tributaria || 'UN',
      qty_conferida: '',
      condicao: 'normal',
      lote: '',
      validade: '',
      observacao: '',
      foto_avaria_base64: '',
      item_extra: false,
    }));
    startReceivingTimer(receivingSession?.started_at || new Date().toISOString());
    setReceivingStep(2);
    renderReceivingTable();
    await refreshReceivingPage(true);
    showToast('Recebimento iniciado com sucesso.', 'success');
  } catch (err) {
    showToast(`Falha ao iniciar recebimento: ${err.message}`, 'danger');
  } finally {
    setButtonLoading(button, false);
  }
}

async function cancelReceivingSession() {
  if (!receivingSession) {
    setReceivingStep(1);
    return;
  }
  const ok = await showConfirm({
    title: 'CANCELAR RECEBIMENTO',
    icon: '⚠',
    desc: 'A sessão local será descartada. O histórico continuará registrando a sessão aberta até o fechamento via API.',
    okLabel: 'CANCELAR SESSÃO',
  });
  if (!ok) return;
  receivingSession = null;
  receivingItems = [];
  receivingSelectedNfe = null;
  receivingClosePreview = null;
  stopReceivingTimer();
  setReceivingStep(1);
  renderReceivingTable();
  refreshReceivingSelectedInfo();
}

function buildReceivingClosePayload(previewOnly = false) {
  return {
    session_id: receivingSession?.id,
    placa_veiculo: sanitizeTextInput(document.getElementById('receiving-plate-input')?.value || receivingSession?.placa_veiculo || '', { maxLength: 8, uppercase: true }),
    motivo_fechamento: document.getElementById('receiving-close-reason')?.value || 'ok',
    motivo_falta: sanitizeTextInput(document.getElementById('receiving-shortage-reason')?.value || '', { maxLength: 255 }),
    observacao_fechamento: sanitizeTextInput(document.getElementById('receiving-close-observation')?.value || '', { maxLength: 1000 }),
    expected_revision: serverRevision,
    preview_only: !!previewOnly,
    itens_conferidos: receivingItems
      .filter(item => parseFloat(item.qty_conferida || '0') > 0)
      .map(item => ({
        codigo_produto: sanitizeTextInput(item.codigo_produto || '', { maxLength: 80, uppercase: true }),
        descricao: sanitizeTextInput(item.descricao || '', { maxLength: 255 }),
        ean: sanitizeTextInput(item.ean || '', { maxLength: 40, uppercase: true }),
        ncm: sanitizeTextInput(item.ncm || '', { maxLength: 16, uppercase: true }),
        qty_conferida: parseFloat(item.qty_conferida || '0') || 0,
        unidade_conferida: sanitizeTextInput(item.unidade_conferida || 'UN', { maxLength: 8, uppercase: true }),
        condicao: item.condicao || 'normal',
        lote: sanitizeTextInput(item.lote || '', { maxLength: 80 }),
        validade: item.validade || null,
        observacao: sanitizeTextInput(item.observacao || '', { maxLength: 240 }),
        foto_avaria_base64: item.foto_avaria_base64 || null,
        item_extra: !!item.item_extra,
      })),
  };
}

async function closeReceivingSession() {
  if (!receivingSession) {
    await showNotice({ title: 'SEM SESSÃO ATIVA', icon: '⛔', desc: 'Inicie um recebimento antes de fechar a descarga.' });
    return;
  }
  const payload = buildReceivingClosePayload(true);
  if (!payload.itens_conferidos.length) {
    await showNotice({ title: 'SEM ITENS', icon: '⛔', desc: 'Informe ao menos uma quantidade conferida antes de fechar.' });
    return;
  }
  try {
    receivingClosePreview = await apiCall('/wms/nfe/receiving/close', 'POST', payload);
    if ((receivingClosePreview?.divergencias || []).length) {
      renderReceivingDivergences();
      setReceivingStep(3);
      return;
    }
    await confirmReceivingClosure();
  } catch (err) {
    if (String(err.message || '').includes('blind.count')) {
      await showNotice({ title: 'PERMISSÃO ELEVADA', icon: '⛔', desc: 'Fechamento com falta requer um usuário com permissão blind.count.' });
      return;
    }
    showToast(`Falha ao validar fechamento: ${err.message}`, 'danger');
  }
}

function renderReceivingDivergences() {
  const tbody = document.getElementById('receiving-divergence-body');
  const banner = document.getElementById('receiving-divergence-banner');
  if (!tbody) return;
  const divergencias = receivingClosePreview?.divergencias || [];
  if (!divergencias.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Nenhuma divergência detectada.</td></tr>';
    if (banner) banner.style.display = 'none';
    queueEnhanceResizableTables();
    return;
  }
  const hasExcess = divergencias.some(item => item.divergencia_tipo === 'excesso' || item.divergencia_tipo === 'extra');
  if (banner) {
    banner.style.display = hasExcess ? '' : 'none';
    banner.textContent = hasExcess ? 'EXCESSO / EXTRA' : 'DIVERGÊNCIA';
  }
  const suggestedReason = divergencias.some(item => item.divergencia_tipo === 'avaria')
    ? 'avaria'
    : divergencias.some(item => item.divergencia_tipo === 'falta')
      ? 'falta'
      : divergencias.some(item => item.divergencia_tipo === 'excesso' || item.divergencia_tipo === 'extra')
        ? 'excesso'
        : 'ok';
  const reasonSelect = document.getElementById('receiving-close-reason');
  if (reasonSelect && (!reasonSelect.value || reasonSelect.value === 'ok')) reasonSelect.value = suggestedReason;
  tbody.innerHTML = divergencias.map(item => `
    <tr>
      <td>${escapeHtml(item.descricao || item.codigo_produto || 'Item sem descrição')}</td>
      <td>${escapeHtml(`${item.qty_nota ?? 0} ${item.unidade_conferida || 'UN'}`)}</td>
      <td>${escapeHtml(`${item.qty_conferida ?? 0} ${item.unidade_conferida || 'UN'}`)}</td>
      <td>${escapeHtml(String(item.diff ?? 0))}</td>
      <td><span class="status-badge ${item.divergencia_tipo === 'avaria' ? 'status-blocked' : item.divergencia_tipo === 'falta' ? 'status-alert' : 'status-pending'}">${escapeHtml((item.divergencia_tipo || 'ok').toUpperCase())}</span></td>
    </tr>
  `).join('');
  queueEnhanceResizableTables();
}

async function confirmReceivingClosure() {
  if (!receivingSession) return;
  const payload = buildReceivingClosePayload(false);
  try {
    const response = await apiCall('/wms/nfe/receiving/close', 'POST', payload);
    if (response?.revision) serverRevision = response.revision;
    receivingClosePreview = response;
    renderReceivingConfirmation();
    setReceivingStep(4);
    await loadAppState(false);
    renderAll(true);
    await refreshReceivingPage(true);
    stopReceivingTimer();
    receivingSession = null;
    receivingItems = [];
    receivingSelectedNfe = null;
    showToast('Recebimento fechado com sucesso.', 'success');
  } catch (err) {
    if (String(err.message || '').includes('blind.count')) {
      await showNotice({ title: 'PERMISSÃO ELEVADA', icon: '⛔', desc: 'Fechamento com falta requer um usuário com permissão blind.count.' });
      return;
    }
    showToast(`Falha ao fechar recebimento: ${err.message}`, 'danger');
  }
}

function renderReceivingConfirmation() {
  const body = document.getElementById('receiving-confirmation-body');
  if (!body) return;
  const summary = receivingClosePreview?.summary;
  if (!summary) {
    body.innerHTML = '<div class="empty-msg">Nenhum recebimento concluído nesta sessão.</div>';
    return;
  }
  body.innerHTML = `
    <div class="receiving-confirm-title">RECEBIMENTO CONCLUÍDO</div>
    <div class="receiving-confirm-grid">
      <div><strong>NF:</strong> ${escapeHtml(summary.numero_nf || '—')}</div>
      <div><strong>Emitente:</strong> ${escapeHtml(summary.emitente || '—')}</div>
      <div><strong>Placa:</strong> ${escapeHtml(summary.placa_veiculo || '—')}</div>
      <div><strong>Duração:</strong> ${escapeHtml(formatSecondsHms(summary.duracao_segundos || 0))}</div>
      <div><strong>Fechado em:</strong> ${escapeHtml(fmtDateTime(summary.fechado_em || new Date().toISOString()))}</div>
      <div><strong>Divergências:</strong> ${escapeHtml(String(summary.itens_com_divergencia || 0))}</div>
      <div><strong>Avariados:</strong> ${escapeHtml(String(summary.avariados || 0))}</div>
      <div><strong>Motivo da falta:</strong> ${escapeHtml(summary.motivo_falta || '—')}</div>
    </div>
    <div class="receiving-card-actions">
      <button class="btn" type="button" onclick="window.print()">IMPRIMIR RECIBO</button>
      <button class="btn btn-accent" type="button" onclick="resetReceivingWorkspace()">NOVO RECEBIMENTO</button>
      <button class="btn" type="button" onclick="focusReceivingHistory()">VER HISTÓRICO</button>
    </div>
  `;
}

function focusReceivingHistory() {
  document.getElementById('receiving-history-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetReceivingWorkspace() {
  receivingSession = null;
  receivingItems = [];
  receivingSelectedNfe = null;
  receivingClosePreview = null;
  stopReceivingTimer();
  setReceivingStep(1);
  renderReceivingTable();
  renderReceivingConfirmation();
  refreshReceivingSelectedInfo();
}

function renderReceivingHistory() {
  const list = document.getElementById('receiving-history-list');
  const kpis = document.getElementById('receiving-kpis');
  if (!list || !kpis) return;
  const search = (document.getElementById('receiving-history-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('receiving-history-status')?.value || '';
  const from = document.getElementById('receiving-history-from')?.value || '';
  const to = document.getElementById('receiving-history-to')?.value || '';
  const rows = receivingHistoryRecords.filter(item => {
    if (statusFilter && item.status !== statusFilter) return false;
    const startedDate = item.started_at ? item.started_at.slice(0, 10) : '';
    if (from && startedDate && startedDate < from) return false;
    if (to && startedDate && startedDate > to) return false;
    if (!search) return true;
    return [item.numero_nf, item.emitente?.nome, item.operador, item.chave_acesso].some(value => String(value || '').toLowerCase().includes(search));
  });
  const avgSeconds = rows.length ? Math.round(rows.reduce((sum, item) => sum + (item.duracao_segundos || 0), 0) / rows.length) : 0;
  const divergenceRate = rows.length ? Math.round((rows.filter(item => (item.itens_com_divergencia || 0) > 0).length / rows.length) * 100) : 0;
  const supplierRank = Object.entries(rows.reduce((acc, item) => {
    const key = item.emitente?.nome || '—';
    acc[key] = (acc[key] || 0) + (item.itens_com_divergencia || 0);
    return acc;
  }, {})).sort((a, b) => b[1] - a[1])[0];
  kpis.innerHTML = `
    <div class="receiving-kpi"><span>TEMPO MÉDIO</span><strong>${escapeHtml(formatSecondsHms(avgSeconds))}</strong></div>
    <div class="receiving-kpi"><span>TAXA DIVERG.</span><strong>${escapeHtml(String(divergenceRate))}%</strong></div>
    <div class="receiving-kpi"><span>FORNEC. CRÍTICO</span><strong>${escapeHtml(supplierRank?.[0] || '—')}</strong></div>
  `;
  if (!rows.length) {
    list.innerHTML = '<div class="empty-msg">Nenhuma sessão encontrada.</div>';
    return;
  }
  list.innerHTML = rows.slice(0, 20).map(item => `
    <details class="receiving-history-row">
      <summary>
        <div class="receiving-history-main">
          <strong>NF ${escapeHtml(item.numero_nf || '—')}</strong>
          <span>${escapeHtml(item.emitente?.nome || 'Emitente')}</span>
        </div>
        <div class="receiving-history-side">
          <span class="status-badge ${item.status === 'ok' ? 'status-ok' : item.status === 'em_conferencia' ? 'status-pending' : 'status-alert'}">${escapeHtml((item.status || '—').toUpperCase())}</span>
          <span>${escapeHtml(item.operador || '—')}</span>
          <span>${escapeHtml(formatSecondsHms(item.duracao_segundos || 0))}</span>
        </div>
      </summary>
      <div class="receiving-history-detail">
        <div><strong>Chave:</strong> ${escapeHtml(item.chave_acesso || '—')}</div>
        <div><strong>Placa:</strong> ${escapeHtml(item.placa_veiculo || '—')}</div>
        <div><strong>Início:</strong> ${escapeHtml(fmtDateTime(item.started_at))}</div>
        <div><strong>Fim:</strong> ${escapeHtml(fmtDateTime(item.ended_at))}</div>
        <div><strong>Itens:</strong> ${escapeHtml(String(item.total_itens || 0))}</div>
        <div><strong>Divergências:</strong> ${escapeHtml(String(item.itens_com_divergencia || 0))}</div>
        <div><strong>Motivo falta:</strong> ${escapeHtml(item.motivo_falta || '—')}</div>
        <div class="receiving-history-items">${(item.itens || []).map(line => `<div>${escapeHtml(line.codigo_produto || '—')} · ${escapeHtml(line.descricao || '—')} · ${escapeHtml(String(line.qty_conferida || 0))} ${escapeHtml(line.unidade_conferida || 'UN')} ${line.divergencia_tipo ? `· <span class="status-badge status-alert">${escapeHtml(line.divergencia_tipo.toUpperCase())}</span>` : ''}</div>`).join('') || '<div class="empty-msg">Sem itens detalhados.</div>'}</div>
      </div>
    </details>
  `).join('');
}

async function openReceivingPage() {
  renderReceivingSessionBanner();
  receivingTimerTick();
  populateReceivingDepotSelect();
  refreshReceivingSelectedInfo();
  renderReceivingTable();
  renderReceivingConfirmation();
  if (!receivingAvailableNfes.length || !receivingHistoryRecords.length) {
    refreshReceivingPage(true).catch(err => console.error('Falha ao carregar recebimento NF-e:', err));
  } else {
    renderReceivingHistory();
    renderReceivingMenuBadge();
  }
  if (receivingSession) {
    setReceivingStep(receivingClosePreview?.summary ? 4 : receivingClosePreview?.divergencias?.length ? 3 : 2);
  } else if (receivingClosePreview?.summary) {
    setReceivingStep(4);
  } else {
    setReceivingStep(1);
  }
}

// ——— KEY HELPERS ———
function drawerKey(shelfId, floor, drawer) {
  return `${shelfId}${floor}.G${drawer}`;
}

function parseKey(key) {
  const m = key.match(/^([A-Z]+)(\d+)\.G(\d+)$/);
  if (!m) return null;
  return { shelf: m[1], floor: parseInt(m[2]), drawer: parseInt(m[3]) };
}

// ——— SHELF GRID ———
function renderShelfGrid() {
  const grid = document.getElementById('shelves-grid');
  grid.innerHTML = '';
  const depotIds = getDepotViewScopeIds();
  depotIds.forEach((depotId, depotIdx) => {
    const depotShelves = shelvesAll[depotId] || [];
    const depotProducts = productsAll[depotId] || {};
    if (isDepotPageAllContext()) {
      const depotGroup = document.createElement('div');
      depotGroup.className = 'depot-scope-group';
      depotGroup.innerHTML = `<div class="depot-scope-group-title">${escapeHtml(getDepotById(depotId)?.name || depotId)}</div>`;
      grid.appendChild(depotGroup);
      depotShelves.forEach((shelf, shelfIdx) => {
        depotGroup.appendChild(buildDepotShelfBlock(depotId, depotProducts, shelf, shelfIdx + depotIdx));
      });
      return;
    }
    depotShelves.forEach((shelf, shelfIdx) => {
      grid.appendChild(buildDepotShelfBlock(depotId, depotProducts, shelf, shelfIdx));
    });
  });
}

function buildDepotShelfBlock(depotId, depotProducts, shelf, shelfIdx = 0) {
  const block = document.createElement('div');
  block.className = `shelf-block ${getShelfTypeClass(shelf.type)}`;
  let occupied = 0;
  const total = shelf.floors * shelf.drawers;
  let nExpired = 0;
  let nExpiring = 0;
  let nOk = 0;
  let nNoVal = 0;
  let nearestDays = null;
  for (let f = 1; f <= shelf.floors; f++) {
    for (let d = 1; d <= shelf.drawers; d++) {
      const prods = depotProducts[drawerKey(shelf.id, f, d)] || [];
      if (prods.length) occupied++;
      prods.forEach(p => {
        const st = productExpiryStatus(p);
        if (st === 'expired') nExpired++;
        else if (st === 'expiring') {
          nExpiring++;
          const nd = daysUntil(nearestExpiry(p));
          if (nd !== null && (nearestDays === null || nd < nearestDays)) nearestDays = nd;
        } else if (st === 'ok') nOk++;
        else nNoVal++;
      });
    }
  }
  const occPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const occCls = occPct >= 90 ? 'var(--danger)' : occPct >= 60 ? 'var(--warn)' : 'var(--accent3)';
  let statsHtml = '';
  if (nExpired) statsHtml += `<span class="shelf-stat-badge ssb-exp">⛔ ${nExpired} vencido${nExpired > 1 ? 's' : ''}</span>`;
  if (nExpiring) statsHtml += `<span class="shelf-stat-badge ssb-warn">⚠ ${nExpiring} a vencer${nearestDays !== null ? ` (${nearestDays}d)` : ''}</span>`;
  if (nOk) statsHtml += `<span class="shelf-stat-badge ssb-ok">✓ ${nOk} ok</span>`;
  if (nNoVal) statsHtml += `<span class="shelf-stat-badge ssb-noval">— ${nNoVal} sem val.</span>`;
  block.innerHTML = `
    <div class="shelf-block-header" style="align-items:center">
      <div style="flex:1;min-width:0">
        <div class="shelf-block-name">${isDepotPageAllContext() ? `${escapeHtml(getDepotById(depotId)?.name || depotId)} · ` : ''}PRATELEIRA ${escapeHtml(shelf.id)}</div>
        <div style="margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          ${buildShelfTypeBadge(shelf)}
          <span class="shelf-block-stats">${occupied}/${total} gav.</span>
          ${statsHtml}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="text-align:right">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:800;color:${occCls};line-height:1">${occPct}%</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--text3);margin-top:1px">ocupação</div>
        </div>
      </div>
    </div>
    <div class="floors"></div>`;
  block.ondblclick = ev => {
    if (ev.target.closest('.drawer')) return;
    if (depotId !== activeDepotId) switchDepot(depotId);
    openFpModal(shelf.id, depotId);
  };
  const floorsEl = block.querySelector('.floors');
  floorsEl.style.flexDirection = shelfIdx % 2 === 0 ? 'column-reverse' : 'column';
  for (let f = 1; f <= shelf.floors; f++) {
    const floorEl = document.createElement('div');
    floorEl.className = 'floor';
    floorEl.innerHTML = `<div class="floor-label">${escapeHtml(shelf.id)}${f}</div><div class="drawers"></div>`;
    floorsEl.appendChild(floorEl);
    const drawersEl = floorEl.querySelector('.drawers');
    for (let d = 1; d <= shelf.drawers; d++) {
      const key = drawerKey(shelf.id, f, d);
      const prods = depotProducts[key] || [];
      const isOccupied = prods.length > 0;
      const isHighlighted = selectedProductCode && prods.some(p => p.code === selectedProductCode);
      const expSt = isOccupied ? drawerExpiryStatus(prods) : 'ok';
      const totalKgDrawer = prods.reduce((sum, p) => sum + (parseFloat(p.kg) || 0), 0);
      const maxKg = shelf.maxKg || 50;
      const capPct = Math.min(100, (totalKgDrawer / maxKg) * 100);
      const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';
      const dEl = document.createElement('div');
      let cls = `drawer${isOccupied ? ' occupied' : ''}${isHighlighted ? ' highlighted' : ''}`;
      if (expSt === 'expired') cls += ' expired';
      else if (expSt === 'expiring') cls += ' expiring';
      dEl.className = cls;
      dEl.title = isDepotPageAllContext() ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key;
      if (isOccupied) {
        const shown = prods.slice(0, 2);
        const extra = prods.length - shown.length;
        const codeExpMap = {};
        prods.forEach(p => {
          const ne = nearestExpiry(p);
          if (!codeExpMap[p.code] || (ne && ne < codeExpMap[p.code])) codeExpMap[p.code] = ne;
        });
        const prodsHtml = shown.map(p => {
          const es = productExpiryStatus(p);
          const ne = nearestExpiry(p);
          const isSoonest = ne && ne === codeExpMap[p.code];
          const sameCount = prods.filter(x => x.code === p.code).length;
          const dot = es !== 'ok' ? `<span class="exp-dot ${es === 'expired' ? 'danger' : 'warn'}"></span>` : '';
          const urgencyStyle = (sameCount > 1 && isSoonest && es !== 'ok')
            ? `background:${es === 'expired' ? '#ffd6d6' : '#fff0cc'};border-radius:2px;padding:0 2px;`
            : '';
          const urgencyTitle = sameCount > 1 && isSoonest ? ' title="Validade mais próxima"' : '';
          return `<div class="drawer-prod-entry" style="flex-direction:row;align-items:center;gap:2px;${urgencyStyle}"${urgencyTitle}>${dot}<span class="drawer-prod-code">${escapeHtml(p.code)}</span><span class="drawer-prod-name" style="margin-left:2px">${escapeHtml(p.name)}</span></div>`;
        }).join('');
        dEl.innerHTML = `<div class="drawer-key">${escapeHtml(key)}</div><div class="drawer-prod-list">${prodsHtml}${extra > 0 ? `<div class="drawer-more">+${extra} mais</div>` : ''}</div><div class="cap-bar-wrap" style="margin-top:auto"><div class="cap-bar ${capCls}" style="width:${capPct}%"></div></div>`;
      } else {
        dEl.innerHTML = `<div class="drawer-key">${escapeHtml(key)}</div><div class="drawer-empty-label">vazia</div>`;
      }
      dEl.dataset.key = key;
      dEl.dataset.depot = depotId;
      dEl.onclick = () => {
        if (mvState) {
          if (depotId !== activeDepotId) switchDepot(depotId);
          mvSelectDest(key);
          return;
        }
        if (depotId !== activeDepotId) switchDepot(depotId);
        setFocusedDrawer(key);
      };
      dEl.ondblclick = event => {
        event.stopPropagation();
        if (depotId !== activeDepotId) switchDepot(depotId);
        openDrawerModal(key, shelf.id, f, d);
      };
      if (!isDepotPageAllContext() || depotId === activeDepotId) dndInit(dEl, key);
      dEl.addEventListener('mouseenter', ev => showDrawerTooltip(ev, key));
      dEl.addEventListener('mouseleave', hideDrawerTooltip);
      drawersEl.appendChild(dEl);
    }
  }
  return block;
}

// ——— PRODUCT TABLE ———
function getAllProducts() {
  const map = {};
  getDepotViewScopeIds().forEach(depotId => {
    Object.entries(productsAll[depotId] || {}).forEach(([key, prods]) => {
      prods.forEach(p => {
        if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [] };
        map[p.code].qty++;
        map[p.code].kg += parseFloat(p.kg) || 0;
        map[p.code].locations.push(isDepotPageAllContext() ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key);
      });
    });
  });
  return Object.values(map);
}

// ── Sidebar product list state ──
let sbFilter = '';
let selectedShelfId = null;     // '' | 'expired' | 'expiring' | 'multi' | 'none' | 'missing'
let sbSortCol = 'code';
let sbSortDir = 1;

function setSbFilter(f) {
  sbFilter = sbFilter === f ? '' : f;
  // sync chip active states
  ['all','expired','expiring','multi','none','missing'].forEach(k => {
    const el = document.getElementById('sbf-' + k);
    if (el) el.classList.toggle('active', (k === 'all' && sbFilter === '') || k === sbFilter);
  });
  renderProductTable();
}

function setSbSort(col) {
  if (sbSortCol === col) sbSortDir = -sbSortDir;
  else { sbSortCol = col; sbSortDir = 1; }
  // update header indicators
  ['code','name','qty','status'].forEach(c => {
    const th = document.getElementById('sbth-' + c);
    if (!th) return;
    th.classList.remove('sort-asc','sort-desc');
    if (c === sbSortCol) th.classList.add(sbSortDir === 1 ? 'sort-asc' : 'sort-desc');
  });
  renderProductTable();
}

function getAllProductsDetail2() {
  // Like getAllProductsDetail but also enriches with status/nearest for sidebar
  const map = {};
  getDepotViewScopeIds().forEach(depotId => {
    Object.entries(productsAll[depotId] || {}).forEach(([key, prods]) => {
      prods.forEach(p => {
        if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [], allExpiries: [], entries: [] };
        const rec = map[p.code];
        rec.qty++;
        rec.kg += parseFloat(p.kg) || 0;
        const locationLabel = isDepotPageAllContext() ? `${getDepotById(depotId)?.name || depotId} · ${key}` : key;
        if (!rec.locations.includes(locationLabel)) rec.locations.push(locationLabel);
        if (p.entry) rec.entries.push(p.entry);
        if (p.expiryControl!=='no') getExpiries(p).filter(Boolean).forEach(d => { if (!rec.allExpiries.includes(d)) rec.allExpiries.push(d); });
        ['ean','sku','category','supplier','unit','lot','perishable','cost','price','tempMax','tempMin','anvisa','ncm','notes'].forEach(f=>{ if(!rec[f]&&p[f]) rec[f]=p[f]; });
      });
    });
  });
  return Object.values(map).map(r => {
    r.allExpiries.sort();
    r.nearest = r.nearest || r.allExpiries[0] || null;
    r.statusKey = r.nearest ? expiryStatus(r.nearest) : 'none';
    return r;
  });
}

function renderProductTable() {
  renderFocusPanel();
  if (focusedDrawerKey) return;

  const q = (document.getElementById('product-search-input')?.value || '').toLowerCase();
  let prods = getAllProductsDetail2();

  // text filter
  if (q) prods = prods.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));

  // chip filter
  if (sbFilter === 'expired')  prods = prods.filter(p => p.statusKey === 'expired');
  else if (sbFilter === 'expiring') prods = prods.filter(p => p.statusKey === 'expiring');
  else if (sbFilter === 'multi')    prods = prods.filter(p => p.locations.length > 1);
  else if (sbFilter === 'none')     prods = prods.filter(p => p.statusKey === 'none');
  else if (sbFilter === 'missing')  prods = prods.filter(p => p.qty === 0); // shouldn't happen normally

  // sort
  prods.sort((a, b) => {
    let va = a[sbSortCol], vb = b[sbSortCol];
    if (sbSortCol === 'status') { va = a.statusKey; vb = b.statusKey; }
    if (va === undefined) va = '';
    if (vb === undefined) vb = '';
    if (typeof va === 'number') return (va - vb) * sbSortDir;
    return va.toString().localeCompare(vb.toString()) * sbSortDir;
  });

  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  if (!prods.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="font-size:10px">Nenhum produto</td></tr>`;
    return;
  }

  // sidebar cell definitions
  const _sbCells = {
    code:   p => { let x=''; if(p.locations.length>1)x+=`<span class="xref-badge xref-multi">${p.locations.length}L</span>`; if(p.statusKey==='expired')x+=`<span class="xref-badge xref-expired">V!</span>`; else if(p.statusKey==='expiring')x+=`<span class="xref-badge xref-expiring">${daysUntil(p.nearest)}d</span>`; return `<td class="td-code" style="font-size:10px">${p.code}${x}</td>`; },
    name:   p => `<td style="font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>`,
    qty:    p => `<td class="td-qty" style="font-size:10px">${p.qty}</td>`,
    status: p => { const ic=p.statusKey==='expired'?'🔴':p.statusKey==='expiring'?'🟡':p.statusKey==='ok'?'🟢':'⚪'; return `<td style="text-align:center;font-size:11px" title="${p.nearest?fmtDate(p.nearest):'Sem validade'}">${ic}</td>`; },
  };
  // update header order to match sbColOrder
  sbColOrder.forEach(k => {
    const th = document.getElementById('sbth-'+k);
    if (th && th.parentElement) {
      th.dataset.colKey = k;
      th.parentElement.appendChild(th);
    }
  });
  tbody.innerHTML = prods.map(p => {
    const isSelected = p.code === selectedProductCode;
    const rowCls = isSelected ? 'selected' : p.statusKey === 'expired' ? 'row-expired' : p.statusKey === 'expiring' ? 'row-expiring' : '';
    return `<tr class="${rowCls}" data-prod-code="${escapeAttr(p.code)}" onclick="selectProduct(this.dataset.prodCode)">${sbColOrder.map(k => _sbCells[k] ? _sbCells[k](p) : '<td>—</td>').join('')}</tr>`;
  }).join('');
  queueEnhanceResizableTables();
}

function renderFocusPanel() {
  const normal = document.getElementById('sidebar-normal-list');
  const focus  = document.getElementById('sidebar-focus-panel');
  if (!normal || !focus) return;

  if (!focusedDrawerKey) {
    normal.style.display = 'flex';
    focus.style.display  = 'none';
    return;
  }

  normal.style.display = 'none';
  focus.style.display  = 'flex';
  const label = document.getElementById('focus-key-label');
  const parsed = parseKey(focusedDrawerKey);
  if (label) {
    label.textContent = parsed
      ? `Prateleira ${parsed.shelf} andar ${parsed.floor} Gaveta ${parsed.drawer} (${focusedDrawerKey})`
      : focusedDrawerKey;
  }

  const prods = (productsAll[activeDepotId] || products)[focusedDrawerKey] || [];
  const list = document.getElementById('focus-prod-list');
  if (!list) return;

  if (!prods.length) {
    list.innerHTML = '<div class="empty-msg">Gaveta vazia</div>';
    return;
  }

  list.innerHTML = prods.map((p, i) => {
    const es = productExpiryStatus(p);
    const ne = nearestExpiry(p);
    const expiries = getExpiries(p).filter(Boolean).sort();
    const expLabel = ne ? (es === 'expired' ? '<span style="color:var(--danger);font-weight:700">VENCIDO</span>' : es === 'expiring' ? '<span style="color:var(--warn);font-weight:700">⚠ ' + daysUntil(ne) + 'd</span>' : fmtDate(ne)) : '—';
    const bg = es === 'expired' ? 'background:#fff0f0' : es === 'expiring' ? 'background:#fff8ee' : '';
    return `<div class="focus-prod-item" draggable="true"
        data-idx="${i}" data-from="${focusedDrawerKey}"
        style="${bg}"
        ondragstart="onDragStart(event,${i},this.dataset.from)" data-from="${escapeAttr(focusedDrawerKey)}"
        ondragend="onDragEnd(event)">
      <div class="focus-prod-code">${escapeHtml(p.code)}</div>
      <div class="focus-prod-info">
        <div class="focus-prod-name">${escapeHtml(p.name)}</div>
        <div class="focus-prod-meta">${p.kg ? p.kg+'kg' : ''} · Val: ${expLabel}${expiries.length > 1 ? ' <span style="color:var(--accent);font-size:9px">+' + (expiries.length-1) + '</span>' : ''}</div>
      </div>
      <span style="font-size:14px;color:var(--text3)" title="Arraste para mover">⠿</span>
    </div>`;
  }).join('');
}

function selectProduct(code) {
  selectedProductCode = selectedProductCode === code ? null : code;
  renderAll();
  if (selectedProductCode) {
    // find first drawer that has this product and scroll to it
    requestAnimationFrame(() => {
      const target = document.querySelector(`.drawer.highlighted[data-key]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // brief extra pulse to catch the eye
        target.style.outline = '2px solid var(--accent)';
        setTimeout(() => { target.style.outline = ''; }, 1200);
      }
    });
  }
}

// ——— STATS ———
function renderStats() {
  const prods = getAllProducts();
  const totalKg = prods.reduce((s, p) => s + p.kg, 0);
  let occupied = 0, total = 0;
  getDepotViewScopeIds().forEach(depotId => {
    (shelvesAll[depotId] || []).forEach(s => {
      total += s.floors * s.drawers;
      for (let f = 1; f <= s.floors; f++) {
        for (let d = 1; d <= s.drawers; d++) {
          if (getDrawerProductsForDepotView(depotId, drawerKey(s.id, f, d)).length > 0) occupied++;
        }
      }
    });
  });

  const occPctGlobal = total > 0 ? Math.round((occupied/total)*100) : 0;
  const occColor = occPctGlobal >= 90 ? 'var(--danger)' : occPctGlobal >= 60 ? 'var(--warn)' : 'var(--accent3)';
  const scopeLabel = isDepotPageAllContext() ? 'todos os depósitos' : 'depósito ativo';
  document.getElementById('queue-widget')?.remove();
  const queueScope = getDepotViewScopeIds();
  const pendingUnloadCount = blindCountRecords.filter(record => ['in_progress', 'pending_review', 'rejected'].includes(record.status) && getUnloadRecordDepotIds(record).some(id => queueScope.includes(id))).length;
  const pendingApprovalCount = blindCountRecords.filter(record => record.status === 'pending_review' && getUnloadRecordDepotIds(record).some(id => queueScope.includes(id))).length;
  const pendingQualityCount = (qualityRowsCurrent || []).filter(row => queueScope.includes(row.depotId) && (row.expiryState === 'expired' || row.expiryState === 'expiring' || row.shelfType === 'quarantine' || row.shelfType === 'blocked')).length;
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card"><div class="stat-label">PRATELEIRAS</div><div class="stat-value">${getDepotViewScopeIds().reduce((sum, depotId) => sum + ((shelvesAll[depotId] || []).length), 0)}</div><div class="stat-sub">${total} gavetas total · ${scopeLabel}</div></div>
    <div class="stat-card">
      <div class="stat-label">OCUPAÇÃO</div>
      <div class="stat-value" style="color:${occColor}">${occPctGlobal}%</div>
      <div class="stat-sub">${occupied} de ${total} gavetas</div>
    </div>
    <div class="stat-card"><div class="stat-label">PRODUTOS</div><div class="stat-value" style="color:var(--accent2)">${prods.length}</div><div class="stat-sub">SKUs distintos</div></div>
    <div class="stat-card"><div class="stat-label">PESO TOTAL</div><div class="stat-value" style="color:var(--warn)">${totalKg.toFixed(1)}</div><div class="stat-sub">kg armazenados</div></div>
  `;
  document.getElementById('stats-bar').insertAdjacentHTML('afterend', `
    <div class="queue-widget" id="queue-widget">
      <div class="queue-card"><span>Fila de descargas</span><strong>${pendingUnloadCount}</strong><div class="stat-sub">Em andamento, pendentes ou reprovadas</div></div>
      <div class="queue-card"><span>Aprovações</span><strong>${pendingApprovalCount}</strong><div class="stat-sub">Descargas aguardando revisão</div></div>
      <div class="queue-card"><span>Qualidade</span><strong>${pendingQualityCount}</strong><div class="stat-sub">Itens a tratar por validade/quarentena/bloqueio</div></div>
    </div>
  `);
  renderDepotSummary();
}

function collectDepotMetrics(depotId = activeDepotId) {
  const depot = getDepotById(depotId);
  const slist = shelvesAll[depotId] || [];
  const prods = productsAll[depotId] || {};
  let totalDrawers = 0;
  let occupiedDrawers = 0;
  let totalEntries = 0;
  let expired = 0;
  let expiring = 0;
  let shortExpiry = 0;
  let usedKg = 0;
  let totalCapKg = 0;
  const skuSet = new Set();
  const categorySet = new Set();
  const familySet = new Set();
  const supplierSet = new Set();

  slist.forEach(shelf => {
    totalDrawers += shelf.floors * shelf.drawers;
    totalCapKg += shelf.floors * shelf.drawers * (shelf.maxKg || 50);
    for (let floor = 1; floor <= shelf.floors; floor++) {
      for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
        const key = drawerKey(shelf.id, floor, drawer);
        const list = prods[key] || [];
        if (list.length) occupiedDrawers++;
        list.forEach(product => {
          totalEntries++;
          usedKg += parseFloat(product.kgTotal ?? product.kg) || 0;
          skuSet.add(product.code);
          if (product.family) familySet.add(product.family);
          if (product.category) categorySet.add(product.category);
          if (product.supplier) supplierSet.add(product.supplier);
          const status = productExpiryStatus(product);
          if (status === 'expired') expired++;
          if (status === 'expiring') expiring++;
          const nearest = nearestExpiry(product);
          const days = nearest ? daysUntil(nearest) : null;
          if (days !== null && days >= 0 && days <= 15) shortExpiry++;
        });
      }
    }
  });

  const occupancyPct = totalDrawers ? Math.round((occupiedDrawers / totalDrawers) * 100) : 0;
  const loadPct = totalCapKg ? Math.round((usedKg / totalCapKg) * 100) : 0;
  return {
    depot,
    shelves: slist.length,
    totalDrawers,
    occupiedDrawers,
    totalEntries,
    usedKg,
    totalCapKg,
    occupancyPct,
    loadPct,
    skuCount: skuSet.size,
    categoryCount: categorySet.size,
    supplierCount: supplierSet.size,
    expired,
    expiring,
    shortExpiry,
  };
}

function collectCombinedDepotMetrics(depotIds = getDepotViewScopeIds()) {
  const metricsList = depotIds.map(id => collectDepotMetrics(id));
  const depotNames = metricsList.map(item => item.depot?.name || item.depot?.id || '').filter(Boolean);
  const depotCities = metricsList.map(item => item.depot?.city).filter(Boolean);
  const depotManagers = metricsList.map(item => item.depot?.manager).filter(Boolean);
  return {
    depot: {
      name: depotIds.length > 1 ? 'Todos os depósitos' : (metricsList[0]?.depot?.name || activeDepotId),
      city: depotIds.length > 1 ? `${depotCities.length} cidade(s)` : (metricsList[0]?.depot?.city || ''),
      manager: depotIds.length > 1 ? `${depotManagers.length} responsável(eis)` : (metricsList[0]?.depot?.manager || ''),
      address: depotIds.length > 1 ? depotNames.join(' · ') : (metricsList[0]?.depot?.address || ''),
    },
    shelves: metricsList.reduce((sum, item) => sum + item.shelves, 0),
    totalDrawers: metricsList.reduce((sum, item) => sum + item.totalDrawers, 0),
    occupiedDrawers: metricsList.reduce((sum, item) => sum + item.occupiedDrawers, 0),
    totalEntries: metricsList.reduce((sum, item) => sum + item.totalEntries, 0),
    usedKg: metricsList.reduce((sum, item) => sum + item.usedKg, 0),
    totalCapKg: metricsList.reduce((sum, item) => sum + item.totalCapKg, 0),
    occupancyPct: 0,
    loadPct: 0,
    skuCount: metricsList.reduce((sum, item) => sum + item.skuCount, 0),
    categoryCount: metricsList.reduce((sum, item) => sum + item.categoryCount, 0),
    supplierCount: metricsList.reduce((sum, item) => sum + item.supplierCount, 0),
    expired: metricsList.reduce((sum, item) => sum + item.expired, 0),
    expiring: metricsList.reduce((sum, item) => sum + item.expiring, 0),
    shortExpiry: metricsList.reduce((sum, item) => sum + item.shortExpiry, 0),
  };
}

function renderDepotSummary() {
  const el = document.getElementById('depot-summary-grid');
  if (!el) return;
  const metrics = isDepotPageAllContext()
    ? collectCombinedDepotMetrics(getDepotViewScopeIds())
    : collectDepotMetrics(activeDepotId);
  metrics.occupancyPct = metrics.totalDrawers ? Math.round((metrics.occupiedDrawers / metrics.totalDrawers) * 100) : 0;
  metrics.loadPct = metrics.totalCapKg ? Math.round((metrics.usedKg / metrics.totalCapKg) * 100) : 0;
  const occColor = metrics.occupancyPct >= 90 ? 'var(--danger)' : metrics.occupancyPct >= 60 ? 'var(--warn)' : 'var(--accent3)';
  const loadColor = metrics.loadPct >= 90 ? 'var(--danger)' : metrics.loadPct >= 60 ? 'var(--warn)' : 'var(--accent)';
  el.innerHTML = `
    <div class="depot-summary-card">
      <div class="depot-summary-title">DEPÓSITO ATIVO</div>
      <div class="depot-summary-main">${escapeHtml(metrics.depot?.name || activeDepotId)}</div>
      <div class="depot-summary-sub">${escapeHtml(metrics.depot?.city || 'Sem cidade')} · ${escapeHtml(metrics.depot?.manager || 'Sem responsável')}</div>
      <div class="depot-summary-sub">${escapeHtml(metrics.depot?.address || 'Sem endereço cadastrado')}</div>
    </div>
    <div class="depot-summary-card">
      <div class="depot-summary-title">CAPACIDADE OPERACIONAL</div>
      <div class="depot-summary-main" style="color:${loadColor}">${metrics.loadPct}%</div>
      <div class="depot-summary-sub">${metrics.usedKg.toFixed(1)} / ${metrics.totalCapKg.toFixed(0)} kg no depósito</div>
      <div class="depot-summary-sub">${metrics.occupiedDrawers} de ${metrics.totalDrawers} gavetas ocupadas</div>
    </div>
    <div class="depot-summary-card">
      <div class="depot-summary-title">SORTIMENTO</div>
      <div class="depot-summary-list">
        <div class="depot-summary-row"><span>SKUs distintos</span><strong>${metrics.skuCount}</strong></div>
        <div class="depot-summary-row"><span>Entradas totais</span><strong>${metrics.totalEntries}</strong></div>
        <div class="depot-summary-row"><span>Categorias</span><strong>${metrics.categoryCount}</strong></div>
        <div class="depot-summary-row"><span>Fornecedores</span><strong>${metrics.supplierCount}</strong></div>
      </div>
    </div>
    <div class="depot-summary-card">
      <div class="depot-summary-title">RISCO E GIRO</div>
      <div class="depot-summary-list">
        <div class="depot-summary-row"><span>Ocupação</span><strong style="color:${occColor}">${metrics.occupancyPct}%</strong></div>
        <div class="depot-summary-row"><span>Validades curtas</span><strong>${metrics.shortExpiry}</strong></div>
        <div class="depot-summary-row"><span>Produtos vencidos</span><strong>${metrics.expired}</strong></div>
        <div class="depot-summary-row"><span>A vencer</span><strong>${metrics.expiring}</strong></div>
      </div>
    </div>
  `;
}

function getCheckedShelfType(inputName) {
  return normalizeShelfType(document.querySelector(`input[name="${inputName}"]:checked`)?.value || 'normal');
}

function setCheckedShelfType(inputName, value) {
  const target = normalizeShelfType(value);
  document.querySelectorAll(`input[name="${inputName}"]`).forEach(input => {
    input.checked = input.value === target;
  });
}

function buildShelfTypeBadge(shelf) {
  const shelfType = normalizeShelfType(shelf?.type);
  if (shelfType === 'normal') return '';
  return `<span class="status-badge ${shelfType === 'quarantine' ? 'quarantine' : 'blocked'}">${getShelfTypeLabel(shelfType)}</span>`;
}

// ——— SHELF LIST ———
function renderShelfList() {
  const el = document.getElementById('shelf-list');
  const canManageShelves = hasPermission('structure.manage');
  el.replaceChildren();

  const appendAddButton = () => {
    if (!canManageShelves) return;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'do-add-card do-add-card-compact';
    addBtn.innerHTML = '<span>+ NOVA PRATELEIRA</span>';
    addBtn.addEventListener('click', toggleAddShelfPanel);
    el.appendChild(addBtn);
  };

  if (!shelves.length) {
    appendAddButton();
    const empty = document.createElement('div');
    empty.className = 'empty-msg';
    empty.textContent = 'Nenhuma prateleira';
    el.appendChild(empty);
    return;
  }

  shelves.forEach(s => {
    let occ = 0;
    for (let f = 1; f <= s.floors; f++) {
      for (let d = 1; d <= s.drawers; d++) {
        if ((products[drawerKey(s.id, f, d)] || []).length > 0) occ++;
      }
    }
    const isEmpty = occ === 0;
    const shelfItem = document.createElement('div');
    shelfItem.className = `shelf-item ${getShelfTypeClass(s.type)} ${selectedShelfId === s.id ? 'active' : ''}`.trim();
    shelfItem.addEventListener('click', () => selectShelf(s.id));
    shelfItem.addEventListener('dblclick', () => openFpModal(s.id, activeDepotId));

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'shelf-name';
    name.textContent = s.id;
    if (normalizeShelfType(s.type) !== 'normal') {
      const badgeWrap = document.createElement('span');
      badgeWrap.innerHTML = ` ${buildShelfTypeBadge(s)}`;
      name.appendChild(badgeWrap);
    }
    const meta = document.createElement('div');
    meta.className = 'shelf-meta';
    meta.textContent = `${s.floors} andares × ${s.drawers} gavetas`;
    const status = document.createElement('div');
    status.className = 'shelf-meta';
    status.style.marginTop = '2px';
    status.style.color = isEmpty ? 'var(--accent3)' : 'var(--text3)';
    status.textContent = isEmpty ? '✓ vazia' : `${occ} gaveta(s) com produtos`;
    info.append(name, meta, status);

    const actions = document.createElement('div');
    actions.className = 'shelf-actions';
    actions.style.display = 'flex';
    actions.style.gap = '4px';
    if (canManageShelves) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'icon-btn';
      editBtn.title = 'Editar prateleira';
      editBtn.textContent = '✏';
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        openEditShelfPanel(s.id);
      });
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '✕';
      if (isEmpty) {
        delBtn.className = 'icon-btn del';
        delBtn.title = 'Remover prateleira vazia';
        delBtn.addEventListener('click', event => {
          event.stopPropagation();
          removeShelf(s.id);
        });
      } else {
        delBtn.className = 'icon-btn';
        delBtn.disabled = true;
        delBtn.style.opacity = '.35';
        delBtn.style.cursor = 'not-allowed';
        delBtn.title = `${occ} gaveta(s) ocupada(s) — esvazie antes de remover`;
      }
      actions.appendChild(delBtn);
    }

    shelfItem.append(info, actions);
    el.appendChild(shelfItem);
  });

  appendAddButton();
}



// ── Shelf panel toggle ────────────────────────────────────────────────
function toggleAddShelfPanel() {
  if (!hasPermission('structure.manage')) return;
  const panel = document.getElementById('add-shelf-panel');
  const editPanel = document.getElementById('edit-shelf-panel');
  const btn = document.getElementById('btn-add-shelf');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (editPanel) editPanel.style.display = 'none';
  if (btn) btn.textContent = isOpen ? '+ NOVA' : '✕ FECHAR';
  if (!isOpen) {
    // reset fields
    ['new-shelf-name','new-shelf-floors','new-shelf-drawers','new-shelf-maxkg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { if(id==='new-shelf-floors')el.value='6'; else if(id==='new-shelf-drawers')el.value='4'; else if(id==='new-shelf-maxkg')el.value='50'; else el.value=''; }
    });
    setCheckedShelfType('new-shelf-type', 'normal');
    setTimeout(() => document.getElementById('new-shelf-name')?.focus(), 50);
  }
}

let _editShelfId = null;
function openEditShelfPanel(shelfId) {
  if (!hasPermission('structure.manage')) return;
  const shelf = shelves.find(s => s.id === shelfId); if (!shelf) return;
  _editShelfId = shelfId;
  const addPanel = document.getElementById('add-shelf-panel');
  if (addPanel) addPanel.style.display = 'none';
  const btn = document.getElementById('btn-add-shelf');
  if (btn) btn.textContent = '+ NOVA';
  const panel = document.getElementById('edit-shelf-panel');
  const lbl   = document.getElementById('edit-shelf-id-label');
  if (lbl) lbl.textContent = shelfId;
  const setV = (id, v) => { const el=document.getElementById(id); if(el) el.value=v; };
  setV('edit-shelf-floors',  shelf.floors);
  setV('edit-shelf-drawers', shelf.drawers);
  setV('edit-shelf-maxkg',   shelf.maxKg || 50);
  setCheckedShelfType('edit-shelf-type', shelf.type || 'normal');
  if (panel) panel.style.display = 'block';
  // scroll panel into view
  panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeEditShelfPanel() {
  const panel = document.getElementById('edit-shelf-panel');
  if (panel) panel.style.display = 'none';
  _editShelfId = null;
}

async function saveEditShelf() {
  if (!await requirePermission('structure.manage', 'Seu perfil não pode editar prateleiras.')) return;
  if (!_editShelfId) return;
  const shelf = shelves.find(s => s.id === _editShelfId); if (!shelf) return;
  const floors  = parseInt(document.getElementById('edit-shelf-floors')?.value) || shelf.floors;
  const drawers = parseInt(document.getElementById('edit-shelf-drawers')?.value) || shelf.drawers;
  const maxKg   = parseFloat(document.getElementById('edit-shelf-maxkg')?.value) || shelf.maxKg || 50;
  const shelfType = getCheckedShelfType('edit-shelf-type');
  let shelfUsedKg = 0;
  for (let floor = 1; floor <= shelf.floors; floor++) {
    for (let drawer = 1; drawer <= shelf.drawers; drawer++) {
      const key = drawerKey(shelf.id, floor, drawer);
      const drawerProducts = products[key] || [];
      if (floor > floors || drawer > drawers) {
        if (drawerProducts.length) {
          await showNotice({
            title: 'REDUÇÃO BLOQUEADA',
            icon: '⛔',
            desc: 'A nova configuração removeria gavetas que ainda possuem produtos.',
            summary: { GAVETA: key, ITENS: String(drawerProducts.length) },
          });
          return;
        }
        continue;
      }
      const drawerKg = drawerProducts.reduce((sum, product) => sum + (parseFloat(product.kg) || 0), 0);
      shelfUsedKg += drawerKg;
      if (drawerKg > maxKg) {
        await showNotice({
          title: 'CAPACIDADE POR GAVETA EXCEDIDA',
          icon: '⛔',
          desc: 'A nova capacidade por gaveta ficaria abaixo do peso já armazenado.',
          summary: { GAVETA: key, 'ATUAL (KG)': drawerKg.toFixed(2), 'NOVO LIMITE (KG)': maxKg.toFixed(2) },
        });
        return;
      }
    }
  }
  const projectedShelfCapacity = floors * drawers * maxKg;
  if (shelfUsedKg > projectedShelfCapacity) {
    await showNotice({
      title: 'CAPACIDADE DA PRATELEIRA EXCEDIDA',
      icon: '⛔',
      desc: 'A nova configuração da prateleira não suporta o peso atualmente armazenado.',
      summary: { PRATELEIRA: shelf.id, 'ATUAL (KG)': shelfUsedKg.toFixed(2), 'NOVO LIMITE (KG)': projectedShelfCapacity.toFixed(2) },
    });
    return;
  }
  const ok = await showConfirm({
    title: 'EDITAR PRATELEIRA ' + _editShelfId, icon: '✏',
    desc: 'Salvar alterações nas propriedades da prateleira?',
    summary: { 'TIPO': getShelfTypeLabel(shelfType), 'ANDARES': floors, 'GAVETAS': drawers, 'CAP. MÁX': maxKg + ' kg/gav.' },
    okLabel: 'SALVAR', okStyle: 'accent'
  });
  if (!ok) return;
  shelf.floors  = floors;
  shelf.drawers = drawers;
  shelf.maxKg   = maxKg;
  shelf.type    = shelfType;
  logHistory('✏', `Prateleira editada: ${_editShelfId}`, `${getShelfTypeLabel(shelfType)} · ${floors} and. × ${drawers} gav. · ${maxKg}kg`, { depotId: activeDepotId, shelfId: _editShelfId });
  await persistStructureState();
  closeEditShelfPanel();
  renderAll(true);
  renderShelfList();
}

// ——— SCROLL TO SHELF ———
function selectShelf(id) {
  selectedShelfId = selectedShelfId === id ? null : id;
  renderShelfList();

  if (!selectedShelfId) {
    document.querySelectorAll('.shelf-block.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));
    return;
  }

  // switch to depot page if not already there
  showPage('depot');

  requestAnimationFrame(() => {
    // find shelf block by its name text
    const blocks = document.querySelectorAll('.shelf-block');
    let target = null;
    blocks.forEach(b => {
      const nameEl = b.querySelector('.shelf-block-name');
      if (nameEl && nameEl.textContent.trim() === 'PRATELEIRA ' + selectedShelfId) target = b;
    });

    // remove previous highlight
    document.querySelectorAll('.shelf-block.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));

    if (target) {
      target.classList.add('shelf-highlighted');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // remove highlight after 2.5s
      setTimeout(() => target.classList.remove('shelf-highlighted'), 2500);
    }
  });
}

// ——— ADD SHELF ———
async function addShelf() {
  if (!hasPermission('structure.manage')) return;
  const name = sanitizeTextInput(readInputValue('new-shelf-name'), { maxLength: 8, uppercase: true });
  const floors = parseInt(readInputValue('new-shelf-floors'), 10);
  const drawers = parseInt(readInputValue('new-shelf-drawers'), 10);
  const maxKg = parseFloat(readInputValue('new-shelf-maxkg')) || 50;
  const shelfType = getCheckedShelfType('new-shelf-type');
  if (!name || isNaN(floors) || isNaN(drawers)) { showNotice({ title:'DADOS INCOMPLETOS', icon:'⛔', desc:'Preencha nome, andares e gavetas para criar a prateleira.' }); return; }
  if (/^[0-9]+$/.test(name)) { showNotice({ title:'NOME INVÁLIDO', icon:'⛔', desc:'O nome da prateleira não pode ser apenas números.' }); return; }
  if (shelves.find(s => s.id === name)) { showNotice({ title:'PRATELEIRA DUPLICADA', icon:'⛔', desc:'Já existe uma prateleira com esse código neste depósito.', summary:{ DEPÓSITO: getDepotById(activeDepotId)?.name || activeDepotId, PRATELEIRA: name } }); return; }
  shelves.push({ id: name, type: shelfType, floors, drawers, maxKg });
  shelvesAll[activeDepotId] = shelves;
  writeInputValue('new-shelf-name', '');
  setCheckedShelfType('new-shelf-type', 'normal');
  logHistory('🏷', `Prateleira criada: ${name}`, `${getShelfTypeLabel(shelfType)} · ${floors} and. × ${drawers} gav. · ${maxKg}kg`, { depotId: activeDepotId, shelfId: name, type: 'edicao' });
  await persistStructureState();
  renderAll(true);
}

async function removeShelf(id) {
  if (!await requirePermission('structure.manage', 'Seu perfil não pode remover prateleiras.')) return;
  const shelf = shelves.find(s => s.id === id);
  if (!shelf) return;
  // verify truly empty
  for (let f = 1; f <= shelf.floors; f++)
    for (let d = 1; d <= shelf.drawers; d++)
      if ((products[drawerKey(shelf.id, f, d)] || []).length > 0) {
        await showNotice({
          title: 'PRATELEIRA OCUPADA',
          icon: '⛔',
          desc: `A prateleira ${id} ainda possui produtos. Esvazie todas as gavetas antes de removê-la.`,
        });
        return;
      }
  const ok2 = await showConfirm({ title:'REMOVER PRATELEIRA', icon:'🗑', desc:'Remover a prateleira vazia?', summary:{'PRATELEIRA':id,'ANDARES':shelf.floors,'GAVETAS':shelf.floors*shelf.drawers}, okLabel:'REMOVER' }); if(!ok2) return;
  shelves = shelves.filter(s => s.id !== id);
  shelvesAll[activeDepotId] = shelves;
  Object.keys(products).forEach(k => { if (k.startsWith(id + '.') || k.startsWith(id + '0') || k.match(new RegExp('^' + id + '\\d')) ) delete products[k]; });
  await persistStructureState();
  renderAll(true);
}

// ——— DRAWER MODAL ———
function openDrawerModal(key) {
  currentDrawerKey = key;
  document.getElementById('drawer-modal-title').textContent = `GAVETA — ${key}`;
  const p = parseKey(key);
  document.getElementById('drawer-modal-loc').textContent = p ? `Prateleira ${p.shelf} · Andar ${p.floor} · Gaveta ${p.drawer}` : key;
  renderDrawerProducts();
  document.getElementById('drawer-modal').classList.add('open');
}

function closeDrawerModal() {
  document.getElementById('drawer-modal').classList.remove('open');
  currentDrawerKey = null;
  dpExpiries = [];
  pfExpiries = [];
}

function renderDrawerProducts() {
  const list = document.getElementById('drawer-products-list');
  const prods = products[currentDrawerKey] || [];
  const canEditProducts = canManageProducts();

  // capacity bar
  const parsedKey = parseKey(currentDrawerKey || '');
  const shelf = parsedKey ? shelves.find(s => s.id === parsedKey.shelf) : null;
  const maxKg = getDrawerCapacityKg(currentDrawerKey, activeDepotId) || (shelf ? (shelf.maxKg || 50) : 50);
  const usedKg = prods.reduce((s,p) => s + (parseFloat(p.kg)||0), 0);
  const capPct = Math.min(100, (usedKg / maxKg) * 100);
  const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';
  const capBar = document.getElementById('drawer-cap-bar');
  const capInfo = document.getElementById('drawer-cap-info');
  if (capBar) { capBar.style.width = capPct + '%'; capBar.className = 'cap-bar ' + capCls; }
  if (capInfo) capInfo.textContent = usedKg.toFixed(1) + ' / ' + maxKg + ' kg (' + Math.round(capPct) + '%)';

  if (!prods.length) { list.innerHTML = '<div class="empty-msg">Gaveta vazia</div>'; return; }

  // group by code to find soonest per code
  const codeMinExp = {};
  prods.forEach(p => {
    const ne = nearestExpiry(p);
    if (!codeMinExp[p.code] || (ne && ne < codeMinExp[p.code])) codeMinExp[p.code] = ne;
  });

  list.innerHTML = prods.map((p, i) => {
    const es = productExpiryStatus(p);
    const expiries = getExpiries(p).filter(Boolean).sort();
    const nearest = expiries[0];
    const sameCodeProds = prods.filter(x => x.code === p.code);
    const isSoonest = nearest && nearest === codeMinExp[p.code] && sameCodeProds.length > 1;
    const isLatest  = nearest && nearest !== codeMinExp[p.code] && sameCodeProds.length > 1;

    const expBadge = es === 'expired'
      ? ' <span style="color:var(--danger);font-size:10px;font-weight:700">VENCIDO</span>'
      : es === 'expiring'
      ? ` <span style="color:var(--warn);font-size:10px;font-weight:700">⚠ ${daysUntil(nearest)}d</span>`
      : '';

    let urgencyRibbon = '';
    if (isSoonest) {
      const ribbonColor = es==='expired'?'var(--danger)':es==='expiring'?'var(--warn)':'#1a8a3a';
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:${ribbonColor};margin-top:2px">⬆ VALIDADE MAIS PRÓXIMA</div>`;
    } else if (isLatest && es === 'ok') {
      // only show "validade mais longa" ribbon when THIS entry is truly within date
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;color:var(--accent3);margin-top:2px">✓ validade mais longa</div>`;
    } else if (isLatest && es !== 'ok') {
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--danger);margin-top:2px">⚠ ${es==='expired'?'VENCIDO':'A VENCER'} (lote mais antigo)</div>`;
    }

    // expiry chips display inside product card
    let valChips = '';
    if (expiries.length === 0) {
      valChips = '<span style="font-size:10px;color:var(--text3);font-family:IBM Plex Mono,monospace">Sem validade</span>';
    } else {
      valChips = expiries.map((d, di) => {
        const st = expiryStatus(d);
        return `<span class="exp-chip ${st}" ${canEditProducts ? `onclick="openDateEditForProduct(${i},${di})" title="Clique para editar"` : ''}>${fmtDate(d)} ${canEditProducts ? `<button class="chip-edit" onclick="event.stopPropagation();openDateEditForProduct(${i},${di})">✏</button>` : ''}</span>`;
      }).join('');
    }

    const borderStyle = es === 'expired'
      ? (isSoonest ? 'border-color:#cc2222;border-width:2px;background:#fff0f0' : 'border-color:#e88;background:#fff0f0')
      : es === 'expiring'
      ? (isSoonest ? 'border-color:#cc7700;border-width:2px;background:#fff8ee' : 'border-color:#e8a800;background:#fff8ee')
      : isSoonest ? 'border-color:#1a8a3a;border-width:2px;background:#f0fdf4'
      : isLatest  ? 'border-color:#7ec87e;background:#f6fff6'
      : '';

    return `<div class="dp-item" style="${borderStyle};cursor:${canEditProducts ? 'pointer' : 'default'}" ${canEditProducts ? `onclick="openProductForm(${i})"` : ''}>
      <div class="dp-code">${escapeHtml(p.code)}</div>
      <div class="dp-info" style="min-width:0">
        <div class="dp-name">${escapeHtml(p.name)}${expBadge}</div>
        <div class="dp-meta">${p.kg ? p.kg + ' kg' : '—'}${p.entry ? ' · Entrada: ' + p.entry : ''}</div>
        <div class="exp-chip-list" style="margin-top:4px">${valChips}</div>
        ${urgencyRibbon}
      </div>
      ${canEditProducts ? `<button class="dp-move" onclick="openMoveModal(${i})" title="Mover">⇄</button>` : ''}
      ${canEditProducts ? `<button class="dp-remove" onclick="removeProductFromDrawer(${i})">✕</button>` : ''}
    </div>`;
  }).join('');
}

function openDateEditForProduct(prodIdx, dateIdx) {
  if (!canManageProducts()) return;
  const p = (products[currentDrawerKey] || [])[prodIdx];
  if (!p) return;
  const expiries = getExpiries(p).filter(Boolean).sort();
  dateEditCtx = {
    type: 'product',
    prodIdx,
    dateIdx,
    list: [...expiries],
    save: (newList) => {
      products[currentDrawerKey][prodIdx].expiries = newList;
      products[currentDrawerKey][prodIdx].exit = undefined;
      renderDrawerProducts();
      renderAll();
    }
  };
  document.getElementById('date-edit-title').textContent = `VALIDADE — ${p.code}`;
  document.getElementById('date-edit-input').value = expiries[dateIdx] || '';
  document.getElementById('date-edit-modal').classList.add('open');
}

// dp-* helpers now delegate to unified pf- form
function dpAddExpiry()    { pfAddExpiry(); }
function renderDpChips()  { renderPfChips(); }
function dpEditExpiry(i)  { pfEditExpiry(i); }
function addProductToDrawer() {
  if (!canManageProducts()) return;
  openProductForm(null);
}

async function removeProductFromDrawer(idx) {
  if (!canManageProducts()) return;
  const p = products[currentDrawerKey][idx];
  const okRm = await showConfirm({ title:'REMOVER PRODUTO', icon:'🗑', desc:'Remover este produto da gaveta?', summary:{'CÓDIGO':p.code,'NOME':p.name,'GAVETA':currentDrawerKey}, okLabel:'REMOVER' }); if(!okRm) return;
  logHistory('📤', `Saída: ${p.code} — ${p.name}`, `Removido de ${currentDrawerKey}`, { depotId: activeDepotId, from: currentDrawerKey, drawerKey: currentDrawerKey, productCode: p.code });
  products[currentDrawerKey].splice(idx, 1);
  renderDrawerProducts();
  renderAll();
}

// ——— GLOBAL ADD PRODUCT ———
function openAddProductModal() {
  if (!canManageProducts()) return;
  const today = new Date().toISOString().slice(0, 10);
  if (document.getElementById('gp-entry')) document.getElementById('gp-entry').value = today;
  if (document.getElementById('gp-qty')) document.getElementById('gp-qty').value = '1';
  if (document.getElementById('gp-unit')) document.getElementById('gp-unit').value = 'un';
  if (document.getElementById('gp-kg-unit')) document.getElementById('gp-kg-unit').value = '';
  if (document.getElementById('gp-kg-total')) document.getElementById('gp-kg-total').value = '';
  if (document.getElementById('gp-kg')) document.getElementById('gp-kg').value = '';
  document.getElementById('add-product-modal').classList.add('open');
}

async function addGlobalProduct() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode registrar entradas manuais.')) return;
  const code = sanitizeTextInput(document.getElementById('gp-code').value, { maxLength: 40, uppercase: true });
  const name = sanitizeTextInput(document.getElementById('gp-name').value, { maxLength: 120 });
  syncWeightFields('gp', 'qty');
  const qty = parseInt(document.getElementById('gp-qty').value, 10) || 1;
  const unit = document.getElementById('gp-unit')?.value || 'un';
  const kgUnit = parseFloat(document.getElementById('gp-kg-unit').value) || 0;
  const kg = parseFloat(document.getElementById('gp-kg-total').value || document.getElementById('gp-kg').value) || 0;
  const loc = sanitizeTextInput(document.getElementById('gp-location').value, { maxLength: 20, uppercase: true });
  const entry = document.getElementById('gp-entry').value;
  const expiries2 = [...gpExpiries];
  if (!code || !name || !loc) { await showNotice({ title:'CAMPOS OBRIGATÓRIOS', icon:'⛔', desc:'Código, nome e local são obrigatórios.' }); return; }
  const p = parseKey(loc);
  if (!p) { await showNotice({ title:'LOCAL INVÁLIDO', icon:'⛔', desc:'Use o formato A1.G2 para indicar o local do produto.' }); return; }
  const shelf = shelves.find(s => s.id === p.shelf);
  if (!shelf) { await showNotice({ title:'PRATELEIRA INEXISTENTE', icon:'⛔', desc:`A prateleira ${p.shelf} não existe neste depósito.` }); return; }
  if (p.floor < 1 || p.floor > shelf.floors) { await showNotice({ title:'ANDAR INVÁLIDO', icon:'⛔', desc:`O andar ${p.floor} não existe na prateleira ${p.shelf}.` }); return; }
  if (p.drawer < 1 || p.drawer > shelf.drawers) { await showNotice({ title:'GAVETA INVÁLIDA', icon:'⛔', desc:`A gaveta ${p.drawer} não existe na prateleira ${p.shelf}.` }); return; }
  const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: loc, incomingKg: kg });
  if (!validation.ok) { await showNotice({ title: validation.title, icon:'⛔', desc: validation.detail, summary: validation.summary }); return; }
  if (!products[loc]) products[loc] = [];
  const okGp = await showConfirm({ title:'CADASTRAR PRODUTO', icon:'📥', desc:'Confirmar entrada do produto?', summary:{'CÓDIGO':code,'NOME':name,'LOCAL':loc,'PESO':kg+'kg'}, okLabel:'CADASTRAR', okStyle:'accent' }); if(!okGp) return;
  products[loc].push({ code, name, kg, kgTotal: kg, kgPerUnit: kgUnit, qty, unit, entry, expiries: expiries2 });
  logHistory('📥', `Entrada: ${code} — ${name}`, `${loc} · ${kg}kg`, { depotId: activeDepotId, to: loc, drawerKey: loc, productCode: code });
  ['gp-code','gp-name','gp-location','gp-kg','gp-kg-unit','gp-kg-total'].forEach(id => document.getElementById(id).value = '');
  if (document.getElementById('gp-qty')) document.getElementById('gp-qty').value = '1';
  if (document.getElementById('gp-unit')) document.getElementById('gp-unit').value = 'un';
  gpExpiries = [];
  const gpChips = document.getElementById('gp-expiry-chips');
  if (gpChips) gpChips.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
  document.getElementById('add-product-modal').classList.remove('open');
  renderAll();
}

// ——— TABS ———
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabMap = {'products-tab':'tab-products','shelves-tab':'tab-shelves'};
  if (tabMap[id]) document.getElementById(tabMap[id]).classList.add('active');

}

// ——— QR OPERATIONS ———
const QR_PREFIX = 'WMSQR1';
let qrWorkflow = { depotId: null, shelfId: null, drawerKey: null, productCode: null, locationDrawerKey: null, payload: null };
let qrVideoStream = null;
let qrScanTimer = null;

function buildQrPayloadForType(type, { depotId = '', shelfId = '', drawerKey = '', productCode = '' } = {}) {
  if (type === 'depot') return `${QR_PREFIX}|DEPOT|${depotId}`;
  if (type === 'shelf') return `${QR_PREFIX}|SHELF|${depotId}|${shelfId}`;
  if (type === 'drawer') return `${QR_PREFIX}|DRAWER|${depotId}|${drawerKey}`;
  if (type === 'product') return `${QR_PREFIX}|PRODUCT|${productCode}`;
  return `${QR_PREFIX}|LOCATION|${depotId}|${drawerKey}|${productCode}`;
}

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

function renderQrPage() {
  const userBadge = document.getElementById('qr-user-badge');
  if (userBadge) userBadge.textContent = `Usuário: ${getCurrentUserLabel()}`;
  populateQrSelectors();
  renderQrProductLookup();
  renderQrGenerator();
  renderQrWorkflow();
}

function getQrProductCatalog() {
  const map = new Map();
  Object.entries(productsAll || {}).forEach(([depotId, productMap]) => {
    Object.entries(productMap || {}).forEach(([drawer, items]) => {
      (items || []).forEach(product => {
        if (!product?.code) return;
        const key = product.code;
        if (!map.has(key)) {
          map.set(key, {
            code: product.code,
            name: product.name || '',
            unit: product.unit || 'un',
            lot: product.lot || '',
            brand: product.brand || '',
            family: product.family || '',
            category: product.category || '',
            qty: 0,
            kg: 0,
            depots: new Set(),
            drawers: new Set(),
            product,
          });
        }
        const rec = map.get(key);
        rec.qty += parseInt(product.qty, 10) || 1;
        rec.kg += parseFloat(product.kgTotal ?? product.kg) || 0;
        rec.depots.add(depotId);
        rec.drawers.add(drawer);
        if (!rec.name && product.name) rec.name = product.name;
        if (!rec.brand && product.brand) rec.brand = product.brand;
        if (!rec.family && product.family) rec.family = product.family;
        if (!rec.category && product.category) rec.category = product.category;
        if (!rec.lot && product.lot) rec.lot = product.lot;
        if (!rec.unit && product.unit) rec.unit = product.unit;
        rec.product = { ...rec.product, ...product };
      });
    });
  });
  return [...map.values()]
    .map(item => ({ ...item, depots: [...item.depots], drawers: [...item.drawers] }))
    .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
}

function populateQrSelectors() {
  const genDepot = document.getElementById('qr-gen-depot');
  const formDepot = document.getElementById('qr-form-depot');
  if (genDepot) genDepot.innerHTML = buildDepotOptionsHtml({ includeAll: true, selected: genDepot.value || ALL_DEPOTS_VALUE });
  if (formDepot) formDepot.innerHTML = buildDepotOptionsHtml({ selected: formDepot.value || qrWorkflow.depotId || activeDepotId });
  if (genDepot && !genDepot.value) genDepot.value = ALL_DEPOTS_VALUE;
  if (formDepot && !formDepot.value) formDepot.value = qrWorkflow.depotId || activeDepotId;

  const genDepotId = genDepot?.value || ALL_DEPOTS_VALUE;
  const formDepotId = formDepot?.value || activeDepotId;
  const genShelves = genDepotId === ALL_DEPOTS_VALUE ? depots.flatMap(depot => (shelvesAll[depot.id] || []).map(shelf => ({ ...shelf, depotId: depot.id }))) : (shelvesAll[genDepotId] || []).map(shelf => ({ ...shelf, depotId: genDepotId }));
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
  resultEl.innerHTML = catalog.map(item => `
    <button class="qr-product-result ${qrWorkflow.productCode === item.code ? 'active' : ''}" type="button" onclick="selectQrFormProduct('${escapeJs(item.code)}')">
      <div class="qr-product-result-head">
        <span class="qr-product-code">${escapeHtml(item.code)}</span>
        <span class="qr-product-meta">${escapeHtml((item.qty || 0) + ' un · ' + (item.kg || 0).toFixed(3) + ' kg')}</span>
      </div>
      <div class="qr-product-name">${escapeHtml(item.name || 'Sem nome')}</div>
      <div class="qr-product-meta">${escapeHtml([item.brand, item.category, item.lot ? `lote ${item.lot}` : '', item.depots.join(', ')].filter(Boolean).join(' · ') || 'Sem complementos')}</div>
    </button>
  `).join('');
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
    code,
    name,
    unit,
    qty,
    kg: kgTotal,
    kgTotal,
    kgPerUnit,
    entry,
    lot,
    expiries: expiry ? [expiry] : [],
    notes: notes || existingTemplate?.notes || '',
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




init().catch(err => console.error('Falha ao inicializar o WMS:', err));

// ——— SETTINGS MODAL ———
let csvParsedData = null;

function openSettingsModal() {
  showPage('settings');
}
function closeSettingsModal() { document.getElementById('settings-modal').classList.remove('open'); }

function switchStab(name) {
  document.querySelectorAll('.stab').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.stab-panel').forEach(e => e.classList.remove('active'));
  document.getElementById('stab-' + name).classList.add('active');
  document.getElementById('spanel-' + name).classList.add('active');
}

// ——— DRAG & DROP ———


// ——— SAMPLE CSV ———
function downloadSampleCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = [
    'location,code,name,kg,entry,exit',
    'A1.G1,P001,Parafuso M6,0.50,2025-01-10,',
    'A1.G2,P002,Porca M6,0.30,2025-01-12,',
    'A2.G1,P001,Parafuso M6,0.50,2025-01-15,2025-06-30',
    'A2.G3,P003,Arruela Aco,0.10,2025-02-01,',
    'B1.G1,P004,Chave Allen 3mm,1.20,2025-01-20,',
    'B1.G2,P005,Chave Allen 5mm,1.50,2025-01-20,',
    'B3.G4,P006,Rebite 4mm,0.05,2025-03-01,2025-08-01',
  ];
  downloadFile('wms_exemplo.csv', rows.join('\n'), 'text/csv');
}

// ——— CSV IMPORT ———
function handleCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    document.getElementById('csv-preview-text').textContent = text.split('\n').slice(0, 8).join('\n') + (text.split('\n').length > 8 ? '\n...' : '');
    document.getElementById('csv-preview-box').style.display = 'block';
    document.getElementById('import-result-box').style.display = 'none';
    document.getElementById('btn-preview-import').style.display = 'inline-block';
    document.getElementById('btn-confirm-import').style.display = 'none';
    csvParsedData = text;
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const required = ['location','code','name','kg','entry','exit'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) throw new Error('Colunas faltando: ' + missing.join(', '));
  const idx = h => headers.indexOf(h);
  return lines.slice(1).map((line, i) => {
    const cols = line.split(',');
    if (cols.length < headers.length) throw new Error(`Linha ${i+2}: colunas insuficientes`);
    return {
      location: sanitizeTextInput(cols[idx('location')], { maxLength: 20, uppercase: true }),
      code: sanitizeTextInput(cols[idx('code')], { maxLength: 40, uppercase: true }),
      name: sanitizeTextInput(cols[idx('name')], { maxLength: 120 }),
      kg: parseFloat(cols[idx('kg')]) || 0,
      entry: cols[idx('entry')].trim(),
      exit: cols[idx('exit')].trim(),
    };
  }).filter(r => r.location && r.code && r.name);
}

function validateImportRows(rows) {
  const tempShelves = deepClone(shelves);
  const tempProducts = deepClone(products);
  const shelfRows = {};

  rows.forEach(row => {
    const parsed = parseKey(row.location);
    if (!parsed) return;
    if (!shelfRows[parsed.shelf]) shelfRows[parsed.shelf] = [];
    shelfRows[parsed.shelf].push(parsed);
  });

  const errors = [];
  let createdShelves = 0;
  let addedRows = 0;

  rows.forEach(row => {
    const parsed = parseKey(row.location);
    if (!parsed) {
      errors.push(`Local inválido: ${row.location}`);
      return;
    }

    let shelf = tempShelves.find(item => item.id === parsed.shelf);
    if (!shelf) {
      const shelfParsedRows = shelfRows[parsed.shelf] || [];
      shelf = {
        id: parsed.shelf,
        floors: Math.max(...shelfParsedRows.map(item => item.floor), 1),
        drawers: Math.max(...shelfParsedRows.map(item => item.drawer), 1),
        maxKg: 50,
      };
      tempShelves.push(shelf);
      createdShelves++;
    }

    if (parsed.floor < 1 || parsed.floor > shelf.floors) {
      errors.push(`Andar inválido: ${row.location}`);
      return;
    }
    if (parsed.drawer < 1 || parsed.drawer > shelf.drawers) {
      errors.push(`Gaveta inválida: ${row.location}`);
      return;
    }

    const existingProducts = tempProducts[row.location] || [];
    const existingDrawerKg = existingProducts.reduce((sum, product) => sum + (parseFloat(product.kg) || 0), 0);
    const incomingKg = parseFloat(row.kg) || 0;
    const drawerCapacity = shelf.maxKg || 50;
    if (existingDrawerKg + incomingKg > drawerCapacity) {
      errors.push(`Peso acima da gaveta em ${row.location}`);
      return;
    }

    const shelfUsedKg = Object.entries(tempProducts).reduce((sum, [key, items]) => {
      const keyParsed = parseKey(key);
      if (!keyParsed || keyParsed.shelf !== shelf.id) return sum;
      return sum + items.reduce((acc, product) => acc + (parseFloat(product.kg) || 0), 0);
    }, 0);
    const shelfProjectedKg = shelfUsedKg + incomingKg;
    const shelfCapacityKg = getShelfCapacityKg(shelf);
    if (shelfProjectedKg > shelfCapacityKg) {
      errors.push(`Capacidade da prateleira excedida: ${row.location}`);
      return;
    }

    const depotUsedKg = Object.values(tempProducts).reduce((sum, items) => {
      return sum + items.reduce((acc, product) => acc + (parseFloat(product.kg) || 0), 0);
    }, 0);
    const depotCapacityKg = tempShelves.reduce((sum, item) => sum + getShelfCapacityKg(item), 0);
    if (depotUsedKg + incomingKg > depotCapacityKg) {
      errors.push(`Capacidade do depósito excedida: ${row.location}`);
      return;
    }

    if (!tempProducts[row.location]) tempProducts[row.location] = [];
    tempProducts[row.location].push({ code: row.code, name: row.name, kg: row.kg, entry: row.entry, exit: row.exit });
    addedRows++;
  });

  return { errors, createdShelves, addedRows };
}

function previewImport() {
  const resultBox = document.getElementById('import-result-box');
  resultBox.style.display = 'block';
  try {
    const rows = parseCSV(csvParsedData);
    const preview = validateImportRows(rows);
    if (preview.errors.length) { resultBox.className = 'import-result error'; resultBox.textContent = preview.errors.slice(0,5).join(' | '); return; }
    resultBox.className = 'import-result success';
    resultBox.textContent = `✔ ${preview.addedRows} registros válidos encontrados${preview.createdShelves ? `, ${preview.createdShelves} nova(s) prateleira(s)` : ''}. Clique em CONFIRMAR para importar.`;
    document.getElementById('btn-confirm-import').style.display = 'inline-block';
  } catch(err) {
    resultBox.className = 'import-result error';
    resultBox.textContent = '✖ Erro: ' + err.message;
  }
}

async function confirmImport() {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode importar dados.')) return;
  const resultBox = document.getElementById('import-result-box');
  try {
    const rows = parseCSV(csvParsedData);
    const preview = validateImportRows(rows);
    if (preview.errors.length) throw new Error(preview.errors[0]);
    let added = 0, newShelves = 0;
    rows.forEach(r => {
      const p = parseKey(r.location);
      if (!p) return;
      // auto-create shelf if not exists
      if (!shelves.find(s => s.id === p.shelf)) {
        const maxFloor = rows.filter(x => parseKey(x.location)?.shelf === p.shelf).reduce((m, x) => Math.max(m, parseKey(x.location)?.floor || 0), 0);
        const maxDrawer = rows.filter(x => parseKey(x.location)?.shelf === p.shelf).reduce((m, x) => Math.max(m, parseKey(x.location)?.drawer || 0), 0);
        shelves.push({ id: p.shelf, floors: Math.max(maxFloor, 6), drawers: Math.max(maxDrawer, 4) });
        newShelves++;
      }
      if (!products[r.location]) products[r.location] = [];
      products[r.location].push({ code: r.code, name: r.name, kg: r.kg, entry: r.entry, exit: r.exit });
      added++;
    });
    resultBox.className = 'import-result success';
    resultBox.textContent = `✔ Importado com sucesso! ${added} produto(s) adicionados${newShelves ? ', ' + newShelves + ' prateleira(s) criada(s)' : ''}.`;
    document.getElementById('btn-confirm-import').style.display = 'none';
    csvParsedData = null;
    renderAll();
  } catch(err) {
    resultBox.className = 'import-result error';
    resultBox.textContent = '✖ Erro: ' + err.message;
  }
}

// ——— EXPORTS ———
function exportProductsCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = ['location,code,name,kg,entry,exit'];
  Object.entries(products).forEach(([loc, prods]) => {
    prods.forEach(p => rows.push([loc, p.code, p.name, p.kg, p.entry, p.exit].join(',')));
  });
  downloadFile('wms_produtos.csv', rows.join('\n'), 'text/csv');
}

function exportShelvesCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = ['id,floors,drawers'];
  shelves.forEach(s => rows.push([s.id, s.floors, s.drawers].join(',')));
  downloadFile('wms_prateleiras.csv', rows.join('\n'), 'text/csv');
}

function exportSummaryCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = ['code,name,qty,total_kg,locations'];
  getAllProducts().forEach(p => {
    rows.push([p.code, p.name, p.qty, p.kg.toFixed(2), '"' + p.locations.join(';') + '"'].join(','));
  });
  downloadFile('wms_resumo.csv', rows.join('\n'), 'text/csv');
}

function exportFullJSON() {
  if (!hasPermission('settings.manage')) return;
  const data = JSON.stringify({
    depots,
    activeDepotId,
    shelvesAll,
    productsAll,
    history: auditHistory,
    outboundRecords,
    blindCountPool,
    blindCountRecords,
    activeBlindUnloadId,
    floorplan: { layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq },
  }, null, 2);
  downloadFile('wms_backup.json', data, 'application/json');
}

function handleJSONFile(file) {
  if (!hasPermission('settings.manage')) return;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const resultBox = document.getElementById('json-result-box');
    resultBox.style.display = 'block';
    try {
      const data = JSON.parse(e.target.result);
      const isLegacy = Array.isArray(data.shelves) && data.products && typeof data.products === 'object';
      const isFullBackup = Array.isArray(data.depots) && data.shelvesAll && data.productsAll;
      if (!isLegacy && !isFullBackup) throw new Error('Formato inválido.');
      showConfirm({ title:'RESTAURAR BACKUP', icon:'📂', desc:'Isto substituirá todos os dados atuais. Continuar?', okLabel:'RESTAURAR', okStyle:'danger' }).then(ok => {
        if (!ok) return;
        if (isFullBackup) {
          depots = data.depots;
          activeDepotId = data.activeDepotId || data.depots[0]?.id || 'dep1';
          shelvesAll = data.shelvesAll;
          productsAll = data.productsAll;
          auditHistory = Array.isArray(data.history) ? data.history : [];
          outboundRecords = Array.isArray(data.outboundRecords) ? data.outboundRecords : [];
          blindCountPool = Array.isArray(data.blindCountPool) ? data.blindCountPool : [];
          blindCountRecords = Array.isArray(data.blindCountRecords) ? data.blindCountRecords : [];
          ensureDepotState();
          const fp = data.floorplan || {};
          fpLayout = fp.layout || {};
          fpObjects = fp.objects || [];
          fpObjIdSeq = fp.objSeq || 0;
          fpSaveLayout();
        } else {
          shelvesAll[activeDepotId] = data.shelves;
          productsAll[activeDepotId] = data.products;
          shelves = shelvesAll[activeDepotId];
          products = productsAll[activeDepotId];
        }
        renderAll();
        resultBox.className = 'import-result success';
        resultBox.textContent = '✔ Backup restaurado com sucesso!';
      });
    } catch(err) {
      resultBox.className = 'import-result error';
      resultBox.textContent = '✖ Erro: ' + err.message;
    }
  };
  reader.readAsText(file);
}

async function clearAllData() {
  if (!await requirePermission('clear.all', 'Somente admin e master podem limpar tudo.')) return;
  const okAll = await showConfirm({ title:'APAGAR TODOS OS DADOS', icon:'💀', desc:'ATENÇÃO: Esta ação apaga TODOS os depósitos, prateleiras e produtos permanentemente. Não pode ser desfeita!', okLabel:'APAGAR TUDO', okStyle:'danger' }); if(!okAll) return;
  depots = [];
  activeDepotId = null;
  shelvesAll = {};
  productsAll = {};
  shelves = [];
  products = {};
  auditHistory = [];
  outboundRecords = [];
  blindCountPool = [];
  blindCountRecords = [];
  fpLayout = {};
  fpObjects = [];
  fpObjIdSeq = 0;
  renderAll();
  closeSettingsModal();
}

function editCurrentProductBaseData() {
  if (!currentViewedProduct) return;
  // Fecha o modal de detalhes antes de abrir o formulário de edição
  document.getElementById('prod-detail-modal').classList.remove('open');
  openProductFormModal(currentViewedProduct);
}

function openProductFormModal(productData = null) {
  const modal = document.getElementById('product-form-modal');
  const title = document.getElementById('product-form-title');
  const form = document.getElementById('product-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('pf-id').value = '';
  document.getElementById('pf-code').disabled = false;

  if (productData) {
    title.textContent = 'EDITAR PRODUTO';
    document.getElementById('pf-id').value = productData.id || '';
    document.getElementById('pf-code').value = productData.code || '';
    document.getElementById('pf-code').disabled = true; // Código geralmente não muda
    document.getElementById('pf-name').value = productData.name || '';
    document.getElementById('pf-sku').value = productData.sku || '';
    document.getElementById('pf-ean').value = productData.ean || '';
    document.getElementById('pf-unit').value = (productData.unit || 'UN').toUpperCase();
    document.getElementById('pf-family').value = productData.family || '';
    document.getElementById('pf-category').value = productData.category || '';
    document.getElementById('pf-brand').value = productData.brand || '';
    document.getElementById('pf-perishable').checked = !!productData.is_perishable;
    document.getElementById('pf-expiry-control').checked = !!productData.expiry_control;
    document.getElementById('pf-notes').value = productData.notes || '';
  } else {
    title.textContent = 'CADASTRAR PRODUTO';
  }

  modal.classList.add('open');
  document.getElementById('pf-code').focus();
}

function closeProductFormModal() {
  const modal = document.getElementById('product-form-modal');
  if (modal) modal.classList.remove('open');
}

async function saveProduct() {
  const id = document.getElementById('pf-id').value;
  const payload = {
    code: document.getElementById('pf-code').value.trim().toUpperCase(),
    name: document.getElementById('pf-name').value.trim().toUpperCase(),
    sku: document.getElementById('pf-sku').value.trim(),
    ean: document.getElementById('pf-ean').value.trim(),
    unit: document.getElementById('pf-unit').value,
    family: document.getElementById('pf-family').value.trim(),
    category: document.getElementById('pf-category').value.trim(),
    brand: document.getElementById('pf-brand').value.trim(),
    is_perishable: document.getElementById('pf-perishable').checked,
    expiry_control: document.getElementById('pf-expiry-control').checked,
    notes: document.getElementById('pf-notes').value.trim()
  };

  try {
    if (id) {
      await apiCall(`/wms/products/${encodeURIComponent(id)}`, 'PUT', payload);
      showToast('Produto atualizado com sucesso.', 'success');
    } else {
      await apiCall('/wms/products', 'POST', payload);
      showToast('Produto cadastrado com sucesso.', 'success');
    }
    closeProductFormModal();
    if (typeof loadAppState === 'function') await loadAppState(true);
  } catch (err) {
    showToast('Erro ao salvar produto: ' + err.message, 'danger');
  }
}

// ——— DOWNLOAD HELPER ———
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportProductsCsv() {
  if (!canManageProducts()) return;
  try {
    const response = await fetch('/api/wms/products/export/csv', {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem(getAuthTokenStorageKey())}` }
    });
    if (!response.ok) throw new Error('Falha ao exportar');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wms_products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Exportação concluída.', 'success');
  } catch (err) {
    showToast('Erro na exportação: ' + err.message, 'danger');
  }
}

function triggerProductImport() {
  const input = document.getElementById('product-import-input');
  if (input) input.click();
}

async function importProductsCsv(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    try {
      const stats = await apiCall('/wms/products/import/csv', 'POST', text);
      await showNotice({
        title: 'IMPORTAÇÃO CONCLUÍDA',
        icon: '📥',
        desc: `Processamento finalizado com sucesso.`,
        summary: {
          CRIADOS: stats.created,
          ATUALIZADOS: stats.updated,
          ERROS: stats.errors
        }
      });
      input.value = '';
      if (typeof loadAppState === 'function') await loadAppState(true);
    } catch (err) {
      showToast('Falha na importação: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file);
}
