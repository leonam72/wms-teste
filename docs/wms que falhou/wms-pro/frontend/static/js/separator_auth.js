const SEPARATOR_ROLE = 'separador';

function isSeparatorLoginPage() {
  return window.location.pathname === '/separador/login';
}

function isSeparatorAppPage() {
  return window.location.pathname === '/separador';
}

function getSeparatorStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem('separator_current_user') || 'null');
  } catch (err) {
    return null;
  }
}

function setSeparatorUser(user) {
  if (!user) {
    sessionStorage.removeItem('separator_current_user');
    window.SEPARATOR_CURRENT_USER = null;
    return;
  }
  const safeUser = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
  };
  sessionStorage.setItem('separator_current_user', JSON.stringify(safeUser));
  window.SEPARATOR_CURRENT_USER = safeUser;
}

function redirectToSeparatorApp() {
  window.location.replace('/separador');
}

function redirectToSeparatorLogin() {
  if (!isSeparatorLoginPage()) window.location.replace('/separador/login');
}

function showSeparatorLoginError(message) {
  const errorEl = document.getElementById('separator-login-error');
  if (errorEl) errorEl.textContent = message || '';
}

function ensureSeparatorRole(user) {
  if (user?.role !== SEPARATOR_ROLE) {
    throw new Error('Acesso permitido apenas para usuarios do tipo separador.');
  }
  return user;
}

async function loadSeparatorSession() {
  AUTH_TOKEN = window.readStoredAuthToken();
  if (!AUTH_TOKEN) throw new Error('Sessao nao encontrada.');
  const me = await apiCall('/auth/me');
  ensureSeparatorRole(me);
  setSeparatorUser(me);
  return me;
}

async function doSeparatorLogin() {
  const username = document.getElementById('separator-login-username')?.value?.trim() || '';
  const password = document.getElementById('separator-login-password')?.value || '';
  const btn = document.getElementById('separator-login-btn');
  showSeparatorLoginError('');
  setButtonLoading(btn, true, 'Entrando...');

  try {
    const healthOk = await checkServerHealth();
    if (!healthOk) {
      handleServerUnavailable('O backend esta indisponivel. O login sera liberado automaticamente quando a API voltar.', {
        redirectToLoginOnRecovery: false,
      });
      throw new Error('Servidor indisponivel');
    }

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!res.ok) throw new Error('Credenciais invalidas');

    const data = await res.json();
    AUTH_TOKEN = data.access_token;
    window.writeStoredAuthToken(AUTH_TOKEN);

    const me = await apiCall('/auth/me');
    ensureSeparatorRole(me);
    setSeparatorUser(me);
    redirectToSeparatorApp();
  } catch (err) {
    window.writeStoredAuthToken(null);
    AUTH_TOKEN = null;
    setSeparatorUser(null);
    showSeparatorLoginError(err.message || 'Falha ao autenticar.');
  } finally {
    setButtonLoading(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!isSeparatorLoginPage() && !isSeparatorAppPage()) return;

  const healthOk = await checkServerHealth();
  if (!healthOk) {
    handleServerUnavailable(
      isSeparatorLoginPage()
        ? 'O backend esta fora do ar. O login ficara bloqueado ate o servidor responder.'
        : 'O backend esta fora do ar. O modulo do separador ficara bloqueado e retornara ao login quando a API voltar.',
      { redirectToLoginOnRecovery: !isSeparatorLoginPage() }
    );
    return;
  }

  if (isSeparatorLoginPage()) {
    startServerAvailabilityMonitor({ redirectToLoginOnRecovery: false });
    const btn = document.getElementById('separator-login-btn');
    const username = document.getElementById('separator-login-username');
    const password = document.getElementById('separator-login-password');
    if (btn) btn.onclick = doSeparatorLogin;
    if (username) username.addEventListener('keydown', event => { if (event.key === 'Enter') doSeparatorLogin(); });
    if (password) password.addEventListener('keydown', event => { if (event.key === 'Enter') doSeparatorLogin(); });

    try {
      await loadSeparatorSession();
      redirectToSeparatorApp();
    } catch (err) {
      window.writeStoredAuthToken(null);
      AUTH_TOKEN = null;
      setSeparatorUser(null);
    }
    return;
  }

  try {
    const user = await loadSeparatorSession();
    startServerAvailabilityMonitor({ redirectToLoginOnRecovery: true });
    const userNameEl = document.getElementById('separator-user-name');
    if (userNameEl) userNameEl.textContent = user.full_name || user.username;
  } catch (err) {
    window.writeStoredAuthToken(null);
    AUTH_TOKEN = null;
    setSeparatorUser(null);
    redirectToSeparatorLogin();
  }
});
