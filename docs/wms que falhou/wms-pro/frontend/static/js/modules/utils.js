// ═══════════════════════════════════════════════════════════
// MODULE: utils.js
// ═══════════════════════════════════════════════════════════




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



// ══════════════════════════════════════════════════════
// SISTEMA DE BUSCA UNIFICADO
// ══════════════════════════════════════════════════════

/**
 * Ativa/desativa a classe .filter-bar--active numa barra de filtros,
 * tornando o botão "✕ Limpar" visível quando há filtro ativo.
 * Deve ser chamado em todo oninput/onchange de filtro.
 */
function updateFilterBarState(barId) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const hasFilter = [...bar.querySelectorAll('input[type="text"], input[type="date"], select')]
    .some(el => {
      if (el.tagName === 'SELECT') return el.value !== '' && el.selectedIndex > 0;
      return el.value.trim() !== '';
    });
  bar.classList.toggle('filter-bar--active', hasFilter);
}

/**
 * Limpa todos os inputs e selects de uma barra de filtros
 * e dispara o re-render correspondente.
 */
function clearFilterBar(barId, renderFn) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.querySelectorAll('input[type="text"], input[type="date"]').forEach(el => { el.value = ''; });
  bar.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
  bar.classList.remove('filter-bar--active');
  if (typeof renderFn === 'function') renderFn();
}

/**
 * Componente de produto unificado (.pli).
 * Renderiza um dropdown com código + nome + meta.
 *
 * @param {string} menuId   — ID do elemento .pli
 * @param {Array}  results  — array de { code, name, qty, kg, unit, depots[] }
 * @param {Function} onSelect — callback(item)
 */
function renderProductLookup(menuId, results, onSelect) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  if (!results || !results.length) {
    menu.innerHTML = '<div class="pli__empty">Nenhum produto encontrado.</div>';
    menu.classList.add('pli--open');
    return;
  }
  menu.innerHTML = results.slice(0, 12).map((item, i) => {
    const qty  = parseFloat(item.qty  || item.available_quantity || 0);
    const kg   = parseFloat(item.kg   || item.available_kg       || 0);
    const unit = item.unit || item.unidade || 'UN';
    const meta = [
      qty > 0 ? `${qty} ${unit}` : null,
      kg  > 0 ? `${kg.toFixed(3)} kg` : null,
      item.nearest_expiry ? `val. ${item.nearest_expiry}` : null,
      Array.isArray(item.depots) && item.depots.length ? item.depots.slice(0,2).join(', ') : null,
    ].filter(Boolean).join(' · ');
    return `<button type="button" class="pli__item" data-pli-index="${i}"
      onclick="(${onSelect.toString()})(${JSON.stringify(item)})">
      <span class="pli__code">${escapeHtml(item.code || item.codigo || '')}</span>
      <span class="pli__name">${escapeHtml(item.name || item.nome || item.descricao || '')}</span>
      ${meta ? `<span class="pli__meta">${escapeHtml(meta)}</span>` : ''}
    </button>`;
  }).join('');
  menu.classList.add('pli--open');
}

function hideProductLookup(menuId) {
  const menu = document.getElementById(menuId);
  if (menu) menu.classList.remove('pli--open');
}

/**
 * Feedback ao vivo no campo de chave NF-e.
 * Mostra progresso (barra), valida 44 dígitos e busca o XML.
 */
async function handleNfeKeyInput(value) {
  const progress  = document.getElementById('nfe-key-progress');
  const feedback  = document.getElementById('nfe-key-feedback');
  const xmlSelect = document.getElementById('receiving-xml-select');
  if (!feedback) return;

  const clean = (value || '').replace(/\D/g, '').slice(0, 44);
  const pct   = Math.round((clean.length / 44) * 100);

  if (progress) progress.style.width = pct + '%';

  if (clean.length < 44) {
    feedback.className  = 'nfe-key-feedback nfe-key-feedback--typing';
    feedback.textContent = clean.length > 0 ? `${clean.length}/44 dígitos` : '';
    return;
  }

  // 44 dígitos — buscar na lista de XMLs disponíveis
  feedback.className   = 'nfe-key-feedback nfe-key-feedback--typing';
  feedback.textContent = 'Buscando XML…';

  // Verificar na lista já carregada
  const found = (receivingAvailableNfes || []).find(n => n.chave_acesso === clean);
  if (found) {
    feedback.className   = 'nfe-key-feedback nfe-key-feedback--found';
    feedback.textContent = `✓ ${found.emitente?.nome || 'XML encontrado'} — NF ${found.numero_nf || '—'}`;
    // Sincronizar o select
    if (xmlSelect) xmlSelect.value = clean;
    if (typeof handleReceivingXmlSelect === 'function') handleReceivingXmlSelect(clean);
  } else {
    // Tentar fetch direto
    try {
      const detail = await apiCall(`/wms/nfe/${encodeURIComponent(clean)}`);
      if (detail?.emitente) {
        feedback.className   = 'nfe-key-feedback nfe-key-feedback--found';
        feedback.textContent = `✓ ${detail.emitente.nome || 'Emitente'} — NF ${detail.numero_nf || '—'}`;
        if (typeof handleReceivingXmlSelect === 'function') {
          receivingSelectedNfe = detail;
          refreshReceivingSelectedInfo && refreshReceivingSelectedInfo();
        }
      }
    } catch {
      feedback.className   = 'nfe-key-feedback nfe-key-feedback--missing';
      feedback.textContent = '✗ XML não encontrado na pasta monitorada';
    }
  }
}
