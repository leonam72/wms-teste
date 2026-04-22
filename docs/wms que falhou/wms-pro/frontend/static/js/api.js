const API_URL = '/api';
function getAuthTokenStorageKey() {
  return window.AUTH_TOKEN_STORAGE_KEY || 'token';
}

function getLoginPath() {
  return window.AUTH_LOGIN_PATH || '/login';
}

function readStoredAuthToken() {
  return sessionStorage.getItem(getAuthTokenStorageKey());
}

function writeStoredAuthToken(token) {
  if (!token) {
    sessionStorage.removeItem(getAuthTokenStorageKey());
    return;
  }
  sessionStorage.setItem(getAuthTokenStorageKey(), token);
}

let AUTH_TOKEN = readStoredAuthToken();
let SERVER_RECOVERY_TIMER = null;
let SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY = false;
let SERVER_AVAILABILITY_TIMER = null;
let SERVER_LOCK_GUARDS_BOUND = false;
let LAST_HEALTHCHECK_AT = 0;
let LAST_HEALTHCHECK_RESULT = true;
const HEALTHCHECK_MIN_INTERVAL_MS = 4000;
const HEALTHCHECK_MONITOR_INTERVAL_MS = 5000;
const HEALTHCHECK_RECOVERY_INTERVAL_MS = 5000;
const SYNC_QUEUE_DB_NAME = 'wms_sync_queue';
const SYNC_QUEUE_STORE = 'actions';
window.IS_SERVER_UNAVAILABLE = false;

function openSyncQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_QUEUE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const store = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueSyncAction(key, requestData) {
  const db = await openSyncQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    tx.objectStore(SYNC_QUEUE_STORE).put({ key, ...requestData, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getQueuedSyncActions() {
  const db = await openSyncQueueDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const req = tx.objectStore(SYNC_QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
}

async function deleteQueuedSyncAction(key) {
  const db = await openSyncQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    tx.objectStore(SYNC_QUEUE_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function flushSyncQueue() {
  if (!AUTH_TOKEN) return;
  const actions = await getQueuedSyncActions();
  const failed = [];
  for (const action of actions) {
    try {
      await apiCall(action.endpoint, action.method, action.body, { skipQueueOnFail: true });
      await deleteQueuedSyncAction(action.key);
    } catch (err) {
      // FIX M-09: conflito de revisão (409) ou erro — notificar usuário, não silenciar
      console.warn('Falha ao reaplicar ação offline:', action.key, err);
      failed.push(action.key);
      break;
    }
  }
  if (failed.length > 0) {
    // Notificar o usuário que dados offline não puderam ser sincronizados
    const msg = 'Algumas ações realizadas offline não puderam ser sincronizadas com o servidor ' +
      '(possível conflito de versão). Recarregue a página e verifique se os dados estão corretos.';
    if (typeof window.showNotice === 'function') {
      window.showNotice({ title: 'SINCRONIZAÇÃO INCOMPLETA', desc: msg, icon: '⚠' });
    } else {
      console.error('[WMS] Sync queue flush falhou:', msg);
      // Aviso visual mínimo caso showNotice não esteja disponível ainda
      setSyncStatusPill('warn', '☁ CONFLITO OFFLINE');
    }
  }
}

function setSyncStatusPill(state = 'sync', label = '') {
  const el = document.getElementById('sync-status-pill');
  if (!el) return;
  el.className = `sync-status-pill sync-status-${state}`;
  el.textContent = label || (
    state === 'offline' ? '☁ OFFLINE'
    : state === 'warn' ? '☁ SINCRONIZANDO'
    : '☁ SINCRONIZADO'
  );
}

function isLoginRoute() {
  return window.location.pathname === getLoginPath();
}

function setServerOverlay(open, title = 'CARREGANDO SISTEMA', desc = 'Aguardando resposta do servidor.') {
  const overlay = document.getElementById('server-status-overlay');
  const titleEl = document.getElementById('server-status-title');
  const descEl = document.getElementById('server-status-desc');
  window.IS_SERVER_UNAVAILABLE = !!open;
  document.body.classList.toggle('server-locked', !!open);
  if (overlay) overlay.classList.toggle('open', !!open);
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
}

function setLoginFormEnabled(enabled) {
  ['login-username', 'login-password', 'login-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

function setButtonLoading(button, loading, loadingLabel = 'PROCESSANDO...') {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent || '';
    button.textContent = loadingLabel;
    button.classList.add('is-loading');
    button.disabled = true;
    return;
  }
  const original = button.dataset.originalLabel;
  if (original) button.textContent = original;
  button.classList.remove('is-loading');
}

async function checkServerHealth() {
  const now = Date.now();
  if (now - LAST_HEALTHCHECK_AT < HEALTHCHECK_MIN_INTERVAL_MS) {
    return LAST_HEALTHCHECK_RESULT;
  }
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    LAST_HEALTHCHECK_AT = now;
    LAST_HEALTHCHECK_RESULT = res.ok;
    setSyncStatusPill(res.ok ? 'sync' : 'offline');
    return res.ok;
  } catch (err) {
    LAST_HEALTHCHECK_AT = now;
    LAST_HEALTHCHECK_RESULT = false;
    setSyncStatusPill('offline');
    return false;
  }
}

function clearAuthState() {
  AUTH_TOKEN = null;
  sessionStorage.removeItem(getAuthTokenStorageKey());
  sessionStorage.removeItem('current_user');
  sessionStorage.removeItem('separator_current_user');
  window.CURRENT_USER = null;
  window.SEPARATOR_CURRENT_USER = null;
}

function clearTransientUiState() {
  if (typeof window.clearTransientOperationalState === 'function') {
    window.clearTransientOperationalState();
  }
}

function isServerLocked() {
  return !!window.IS_SERVER_UNAVAILABLE;
}

function bindServerLockGuards() {
  if (SERVER_LOCK_GUARDS_BOUND) return;
  SERVER_LOCK_GUARDS_BOUND = true;
  const shouldBlock = event => {
    if (!isServerLocked()) return false;
    const overlay = document.getElementById('server-status-overlay');
    if (!overlay) return false;
    return !overlay.contains(event.target);
  };
  [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
    'contextmenu',
    'dragstart',
    'dragover',
    'drop',
    'submit',
    'change',
    'input',
    'keydown',
    'keypress',
    'keyup',
  ].forEach(type => {
    document.addEventListener(type, event => {
      if (!shouldBlock(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }, true);
  });
}

function startServerRecoveryPolling() {
  if (SERVER_RECOVERY_TIMER) return;
  setSyncStatusPill('warn');
  SERVER_RECOVERY_TIMER = window.setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    const ok = await checkServerHealth();
    if (!ok) return;
    window.clearInterval(SERVER_RECOVERY_TIMER);
    SERVER_RECOVERY_TIMER = null;
    if (SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY && !isLoginRoute()) {
      clearAuthState();
      window.location.replace('/login');
      return;
    }
    SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY = false;
    setServerOverlay(false);
    setSyncStatusPill('sync');
    flushSyncQueue().catch(err => console.warn('Falha ao drenar fila offline:', err));
    if (isLoginRoute()) setLoginFormEnabled(true);
  }, HEALTHCHECK_RECOVERY_INTERVAL_MS);
}

function startServerAvailabilityMonitor(options = {}) {
  const { redirectToLoginOnRecovery = !isLoginRoute() } = options;
  SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY = SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY || redirectToLoginOnRecovery;
  if (SERVER_AVAILABILITY_TIMER) return;
  SERVER_AVAILABILITY_TIMER = window.setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    if (isServerLocked()) return;
    const ok = await checkServerHealth();
    if (ok) return;
    handleServerUnavailable(
      isLoginRoute()
        ? 'O backend está fora do ar. O login ficará bloqueado até o servidor responder.'
        : 'O backend está fora do ar. O painel ficará bloqueado e retornará ao login quando a API voltar.',
      { redirectToLoginOnRecovery: !isLoginRoute() || redirectToLoginOnRecovery }
    );
  }, HEALTHCHECK_MONITOR_INTERVAL_MS);
}

function handleServerUnavailable(message = 'Servidor indisponível.', options = {}) {
  const { redirectToLoginOnRecovery = !isLoginRoute() } = options;
  SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY = SERVER_REDIRECT_TO_LOGIN_ON_RECOVERY || redirectToLoginOnRecovery;
  clearTransientUiState();
  setSyncStatusPill('offline');
  setServerOverlay(true, 'SERVIDOR INDISPONÍVEL', message);
  if (isLoginRoute()) setLoginFormEnabled(false);
  startServerRecoveryPolling();
}

window.setServerOverlay = setServerOverlay;
window.handleServerUnavailable = handleServerUnavailable;
window.checkServerHealth = checkServerHealth;
window.startServerAvailabilityMonitor = startServerAvailabilityMonitor;
window.queueSyncAction = queueSyncAction;
window.flushSyncQueue = flushSyncQueue;

document.addEventListener('DOMContentLoaded', bindServerLockGuards, { once: true });
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.warn('Falha ao registrar service worker:', err);
    });
  }
  window.addEventListener('online', () => {
    flushSyncQueue().catch(err => console.warn('Falha ao reprocessar fila após online:', err));
  });
}, { once: true });

async function apiCall(endpoint, method='GET', body=null, options={}) {
  const { skipQueueOnFail = false } = options;
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(API_URL + endpoint, opts);
  } catch (err) {
    if (!skipQueueOnFail && method !== 'GET' && typeof window.queueSyncAction === 'function') {
      await queueSyncAction(`${method}:${endpoint}`, { endpoint, method, body });
      setSyncStatusPill('warn', '☁ FILA OFFLINE');
    }
    handleServerUnavailable('A conexão com o backend foi perdida. A interface ficará bloqueada até a API responder novamente.');
    throw new Error('Servidor indisponível');
  }
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  if (res.status >= 500) {
    handleServerUnavailable('O backend não respondeu corretamente. A interface ficará bloqueada até a API voltar a responder.');
    throw new Error('Servidor indisponível');
  }
  if (!res.ok) {
      if (res.status === 409) {
        // FIX: Se houver conflito de revisão, força o recarregamento do estado global
        console.warn('Conflito de revisão detectado. Forçando ressincronização...');
        if (typeof window.loadAppState === 'function') {
          window.loadAppState(true).catch(e => console.error('Erro ao ressincronizar após 409:', e));
        }
      }
      let msg = res.statusText;
      try {
        const json = await res.json();
        if (typeof json.detail === 'string') msg = json.detail;
        else if (json.detail?.message) msg = json.detail.message;
      } catch(e){}
      throw new Error(msg);
  }
  setSyncStatusPill('sync');
  if (res.status === 204) {
    return null;
  }
  const contentLength = res.headers.get('content-length');
  if (contentLength === '0') {
    return null;
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return res.json();
}

function logout() {
  if (typeof window.hasPendingBlindUnloads === 'function' && window.hasPendingBlindUnloads()) {
    const msg = typeof window.getPendingBlindUnloadWarning === 'function'
      ? window.getPendingBlindUnloadWarning()
      : 'Há descargas pendentes.';
    if (!window.confirm(`${msg} Deseja mesmo sair?`)) return;
  }
  clearTransientUiState();
  clearAuthState();
  if (window.location.pathname !== getLoginPath()) {
    window.location.replace(getLoginPath());
  }
}

window.readStoredAuthToken = readStoredAuthToken;
window.writeStoredAuthToken = writeStoredAuthToken;
