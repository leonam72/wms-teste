// ═══════════════════════════════════════════════════════════
// MODULE: depot.js
// ═══════════════════════════════════════════════════════════

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
  const hasItems = Object.values(p).some(list => list.length > 0);
  if (slist.length > 0 || hasItems) {
    await showNotice({ title: 'CONTEÚDO DETECTADO', icon: '⛔', desc: 'Este depósito possui prateleiras ou estoque e não pode ser removido.' });
    return;
  }
  if (!await showConfirm({ title: 'REMOVER DEPÓSITO', icon: '🗑', desc: `Deseja remover permanentemente o depósito "${depot.name}"?` })) return;
  depots = depots.filter(d => d.id !== id);
  delete shelvesAll[id];
  delete productsAll[id];
  if (activeDepotId === id) activeDepotId = depots[0].id;
  renderAll();
  logHistory('🗑', `Depósito removido: ${depot.name}`, `ID: ${id}`);
}

async function openDepotModal(depotId = null) {
  const isNew = !depotId;
  const depot = isNew ? { name: '', address: '', city: '', manager: '', phone: '', notes: '', allow_overcapacity: false } : depots.find(d => d.id === depotId);
  const title = isNew ? 'ADICIONAR DEPÓSITO' : 'EDITAR DEPÓSITO';
  const html = `
    <div class="modal-form">
      <div class="form-row">
        <label>Nome do Depósito:</label>
        <input type="text" id="depot-modal-name" value="${depot.name}" placeholder="Ex: Central / Logística">
      </div>
      <div class="form-row">
        <label>Endereço / Localização:</label>
        <input type="text" id="depot-modal-address" value="${depot.address || ''}">
      </div>
      <div class="form-row">
        <label>Gerente / Responsável:</label>
        <input type="text" id="depot-modal-manager" value="${depot.manager || ''}">
      </div>
      <div class="form-row">
        <label>Notas Internas:</label>
        <textarea id="depot-modal-notes">${depot.notes || ''}</textarea>
      </div>
      <div class="form-row">
        <label class="checkbox-label">
          <input type="checkbox" id="depot-modal-overcapacity" ${depot.allow_overcapacity ? 'checked' : ''}>
          Permitir ultrapassar capacidade teórica das gavetas
        </label>
      </div>
    </div>
  `;
  const confirm = await showConfirm({ title, icon: '🏢', desc: html, okText: isNew ? 'CRIAR' : 'SALVAR' });
  if (!confirm) return;
  const name = sanitizeTextInput(document.getElementById('depot-modal-name').value, { maxLength: 100 });
  if (!name) return;
  if (isNew) {
    const id = `dep_${Date.now()}`;
    depots.push({ id, name, address: document.getElementById('depot-modal-address').value, city: '', manager: document.getElementById('depot-modal-manager').value, phone: '', notes: document.getElementById('depot-modal-notes').value, allow_overcapacity: document.getElementById('depot-modal-overcapacity').checked });
    shelvesAll[id] = [];
    productsAll[id] = {};
    activeDepotId = id;
    logHistory('🏢', `Novo depósito criado: ${name}`, `ID: ${id}`);
  } else {
    const d = depots.find(it => it.id === depotId);
    d.name = name;
    d.address = document.getElementById('depot-modal-address').value;
    d.manager = document.getElementById('depot-modal-manager').value;
    d.notes = document.getElementById('depot-modal-notes').value;
    d.allow_overcapacity = document.getElementById('depot-modal-overcapacity').checked;
    logHistory('✏', `Depósito editado: ${name}`, `ID: ${depotId}`);
  }
  renderAll();
}

function normalizeDiscardDepotState() {
  if (!depots.find(d => d.id === 'dep_discard')) {
    depots.push({ id: 'dep_discard', name: '📦 ÁREA DE DESCARTE / BLOQUEIO', address: 'Setor de Avarias', notes: 'Depósito reservado para itens descartados ou em quarentena de destruição.', allow_overcapacity: true });
    shelvesAll['dep_discard'] = [];
    productsAll['dep_discard'] = {};
  }
}

function renderDepotTabs() {
  const bar = document.getElementById('depot-tabs-bar');
  if (!bar) return;
  bar.innerHTML = '';
  const canManageDepots = checkPermission('structure.manage');
  const contextId = getDepotTabsContextId();
  const allTab = document.createElement('button');
  allTab.type = 'button';
  allTab.className = `depot-tab-item ${contextId === ALL_DEPOTS_VALUE ? 'active' : ''}`;
  allTab.textContent = '📦 TODOS';
  allTab.addEventListener('click', () => { setDepotTabsContextId(ALL_DEPOTS_VALUE); renderAll(); });
  bar.appendChild(allTab);
  depots.forEach(depot => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `depot-tab-item ${contextId === depot.id ? 'active' : ''}`;
    tab.innerHTML = `<span class="tab-name">${depot.name}</span>`;
    if (canManageDepots && depot.id !== 'dep_discard') {
      const editBtn = document.createElement('span');
      editBtn.className = 'tab-edit-icon';
      editBtn.innerHTML = '✏';
      editBtn.onclick = (e) => { e.stopPropagation(); openDepotModal(depot.id); };
      tab.appendChild(editBtn);
    }
    tab.addEventListener('click', () => { setDepotTabsContextId(depot.id); if (activeDepotId !== depot.id) activeDepotId = depot.id; renderAll(); });
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

let auditHistory = []; 
let selectedProductCode = null;
let currentDrawerKey = null;
let moveProductIdx = null;
let moveFromKey = null;
let dpExpiries = [];   
let gpExpiries = [];   
let dateEditCtx = null; 
let selectedEditIdx = null; 
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
