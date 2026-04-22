// ═══════════════════════════════════════════════════════════
// MODULE: navigation.js
// ═══════════════════════════════════════════════════════════

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
  clearFilterBar('users-filter-bar', renderUsersPage);
  return;
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
  clearFilterBar('quality-filter-bar', () => renderQualityPage(true));
  return;
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

