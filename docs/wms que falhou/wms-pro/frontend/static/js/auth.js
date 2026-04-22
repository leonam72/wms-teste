function onLoginPage() {
  return window.location.pathname === '/login';
}

function redirectToApp() {
  window.location.replace('/');
}

function redirectToLogin() {
  if (!onLoginPage()) window.location.replace('/login');
}

function setCurrentUser(user) {
  if (!user) {
    window.CURRENT_USER = null;
    sessionStorage.removeItem('current_user');
    window.dispatchEvent(new CustomEvent('wms:current-user-changed', { detail: null }));
    return;
  }
  const safeUser = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    parent_user_id: user.parent_user_id,
    last_login_at: user.last_login_at,
  };
  window.CURRENT_USER = safeUser;
  sessionStorage.setItem('current_user', JSON.stringify(safeUser));
  window.dispatchEvent(new CustomEvent('wms:current-user-changed', { detail: safeUser }));
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('token');

  const healthOk = await checkServerHealth();
  if (!healthOk) {
    handleServerUnavailable(onLoginPage()
      ? 'O backend está fora do ar. O login ficará bloqueado até o servidor responder.'
      : 'O backend está fora do ar. O painel ficará bloqueado e retornará ao login quando a API voltar.', {
      redirectToLoginOnRecovery: !onLoginPage(),
    });
    return;
  }

  if (onLoginPage()) {
    startServerAvailabilityMonitor({ redirectToLoginOnRecovery: false });
    const btn = document.getElementById('login-btn');
    const password = document.getElementById('login-password');
    const username = document.getElementById('login-username');

    if (btn) btn.onclick = doLogin;
    if (password) password.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    if (username) username.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

    if (!token) {
      return;
    }

    try {
      AUTH_TOKEN = token;
      const me = await apiCall('/auth/me');
      setCurrentUser(me);
      redirectToApp();
    } catch (err) {
      sessionStorage.removeItem('token');
      AUTH_TOKEN = null;
      setCurrentUser(null);
    }
    return;
  }

  if (!token) {
    redirectToLogin();
    return;
  }

  try {
    AUTH_TOKEN = token;
    const me = await apiCall('/auth/me');
    setCurrentUser(me);
    startServerAvailabilityMonitor({ redirectToLoginOnRecovery: true });
  } catch (err) {
    sessionStorage.removeItem('token');
    AUTH_TOKEN = null;
    setCurrentUser(null);
    redirectToLogin();
    return;
  }
});

async function doLogin() {
  const username = document.getElementById('login-username')?.value || '';
  const password = document.getElementById('login-password')?.value || '';
  const err = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (err) {
    err.textContent = '';
    err.style.display = 'none';
  }
  if (btn) {
    setButtonLoading(btn, true, 'ENTRANDO...');
  }

  try {
    const healthOk = await checkServerHealth();
    if (!healthOk) {
      handleServerUnavailable('O backend está indisponível. O login será liberado automaticamente quando a API voltar.');
      throw new Error('Servidor indisponível');
    }
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    if (!res.ok) throw new Error('Credenciais invalidas');
    const data = await res.json();
    AUTH_TOKEN = data.access_token;
    sessionStorage.setItem('token', AUTH_TOKEN);
    const me = await apiCall('/auth/me');
    setCurrentUser(me);
    redirectToApp();
  } catch (e) {
    if (err) {
      err.textContent = e.message;
      err.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      setButtonLoading(btn, false);
      btn.textContent = 'ENTRAR';
    }
  }
}
