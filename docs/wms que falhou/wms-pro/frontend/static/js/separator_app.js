let separatorTasks = [];
let separatorSelectedTaskId = null;
let separatorFeedTimer = null;

function formatSeparatorDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function escapeSeparatorHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSelectedSeparatorTask() {
  return separatorTasks.find(task => task.entity_id === separatorSelectedTaskId) || null;
}

function setSeparatorScreen(detailOpen) {
  document.getElementById('separator-home-screen')?.classList.toggle('active', !detailOpen);
  document.getElementById('separator-detail-screen')?.classList.toggle('active', !!detailOpen);
}

function renderSeparatorTaskList() {
  const listEl = document.getElementById('separator-task-list');
  const pendingCountEl = document.getElementById('separator-pending-count');
  const progressCountEl = document.getElementById('separator-progress-count');
  if (!listEl) return;

  const pendingCount = separatorTasks.filter(task => task.task_status === 'pendente').length;
  const progressCount = separatorTasks.filter(task => task.task_status === 'em_andamento').length;
  if (pendingCountEl) pendingCountEl.textContent = String(pendingCount);
  if (progressCountEl) progressCountEl.textContent = String(progressCount);

  if (!separatorTasks.length) {
    listEl.innerHTML = '<div class="separator-empty">Nenhuma tarefa publicada para este separador.</div>';
    return;
  }

  listEl.innerHTML = separatorTasks.map(task => `
    <button type="button" class="separator-task-card" onclick="openSeparatorTask('${escapeSeparatorHtml(task.entity_id)}')">
      <div class="separator-task-meta status-${escapeSeparatorHtml(task.task_status || 'pendente')}">${escapeSeparatorHtml((task.task_status || 'pendente').replace('_', ' '))}</div>
      <div class="separator-task-card-title">${escapeSeparatorHtml(task.produto?.nome || '-')}</div>
      <div class="separator-task-card-grid">
        <div class="separator-task-line"><span>Romaneio</span><strong>${escapeSeparatorHtml(task.romaneio || '-')}</strong></div>
        <div class="separator-task-line"><span>Codigo</span><strong>${escapeSeparatorHtml(task.produto?.codigo || '-')}</strong></div>
        <div class="separator-task-line"><span>Quantidade</span><strong>${escapeSeparatorHtml(String(task.quantidade || 0))}</strong></div>
        <div class="separator-task-line"><span>Endereco</span><strong>${escapeSeparatorHtml(task.endereco?.label || '-')}</strong></div>
      </div>
    </button>
  `).join('');
}

function renderSeparatorTaskDetail() {
  const task = getSelectedSeparatorTask();
  if (!task) {
    separatorSelectedTaskId = null;
    setSeparatorScreen(false);
    return;
  }

  document.getElementById('separator-detail-status').textContent = (task.task_status || 'pendente').replace('_', ' ');
  document.getElementById('separator-detail-status').className = `separator-detail-status status-${task.task_status || 'pendente'}`;
  document.getElementById('separator-detail-title').textContent = task.produto?.nome || '-';
  document.getElementById('detail-romaneio').textContent = task.romaneio || '-';
  document.getElementById('detail-produto').textContent = task.produto?.nome || '-';
  document.getElementById('detail-codigo').textContent = task.produto?.codigo || '-';
  document.getElementById('detail-quantidade').textContent = String(task.quantidade || 0);
  document.getElementById('detail-deposito').textContent = task.deposito || '-';
  document.getElementById('detail-prateleira').textContent = task.prateleira || '-';
  document.getElementById('detail-gaveta').textContent = task.gaveta || '-';
  document.getElementById('detail-validade').textContent = formatSeparatorDate(task.validade);

  const cancelBtn = document.getElementById('separator-cancel-btn');
  const naoAcheiBtn = document.getElementById('separator-nao-achei-btn');
  const startBtn = document.getElementById('separator-start-btn');
  const completeBtn = document.getElementById('separator-complete-btn');
  const noteEl = document.getElementById('separator-occurrence-note');
  const reservedByMe = !!task.reserved_by_me;
  if (cancelBtn) cancelBtn.disabled = !reservedByMe || task.task_status === 'concluida';
  if (naoAcheiBtn) naoAcheiBtn.disabled = !reservedByMe || task.task_status === 'concluida';
  if (startBtn) startBtn.disabled = !reservedByMe || task.task_status !== 'pendente';
  if (completeBtn) completeBtn.disabled = !reservedByMe || task.task_status === 'concluida';
  if (noteEl && separatorSelectedTaskId !== noteEl.dataset.taskId) {
    noteEl.value = '';
    noteEl.dataset.taskId = separatorSelectedTaskId || '';
  }
  setSeparatorScreen(true);
}

async function openSeparatorTask(taskId) {
  try {
    await apiCall(`/wms/separation/tasks/${encodeURIComponent(taskId)}/open`, 'POST');
    await refreshSeparatorFeed();
    separatorSelectedTaskId = taskId;
    renderSeparatorTaskDetail();
  } catch (err) {
    await refreshSeparatorFeed();
    window.alert(err.message || 'Falha ao reservar a tarefa.');
  }
}

function closeSeparatorTask() {
  separatorSelectedTaskId = null;
  setSeparatorScreen(false);
}

async function refreshSeparatorFeed() {
  if (window.location.pathname !== '/separador' || !AUTH_TOKEN) return;
  const response = await apiCall('/wms/separation/module-feed?limit=100');
  separatorTasks = Array.isArray(response?.items) ? response.items : [];
  renderSeparatorTaskList();
  if (separatorSelectedTaskId) renderSeparatorTaskDetail();
}

async function updateSeparatorTaskStatus(nextStatus, buttonId, loadingLabel) {
  const task = getSelectedSeparatorTask();
  if (!task) return;
  const btn = document.getElementById(buttonId);
  setButtonLoading(btn, true, loadingLabel);
  try {
    const response = await apiCall(`/wms/separation/tasks/${encodeURIComponent(task.entity_id)}`, 'PATCH', { status: nextStatus });
    await refreshSeparatorFeed();
    if (response.status === 'concluida') {
      setTimeout(() => {
        closeSeparatorTask();
      }, 400);
    }
  } finally {
    setButtonLoading(btn, false);
  }
}

async function startSeparatorTask() {
  await updateSeparatorTaskStatus('em_andamento', 'separator-start-btn', 'Iniciando...');
}

async function completeSeparatorTask() {
  await updateSeparatorTaskStatus('concluida', 'separator-complete-btn', 'Concluindo...');
}

async function markSeparatorTaskNaoAchei() {
  const task = getSelectedSeparatorTask();
  if (!task) return;
  const btn = document.getElementById('separator-nao-achei-btn');
  const noteEl = document.getElementById('separator-occurrence-note');
  const observacao = String(noteEl?.value || '').trim();
  setButtonLoading(btn, true, 'Registrando...');
  try {
    await apiCall(`/wms/separation/tasks/${encodeURIComponent(task.entity_id)}/nao-achei`, 'POST', {
      observacao,
    });
    await refreshSeparatorFeed();
    if (noteEl) noteEl.value = '';
    closeSeparatorTask();
  } finally {
    setButtonLoading(btn, false);
  }
}

async function cancelSeparatorTask() {
  const task = getSelectedSeparatorTask();
  if (!task) return;
  const btn = document.getElementById('separator-cancel-btn');
  setButtonLoading(btn, true, 'Cancelando...');
  try {
    await apiCall(`/wms/separation/tasks/${encodeURIComponent(task.entity_id)}/release`, 'POST', { reason: 'cancel' });
    await refreshSeparatorFeed();
    closeSeparatorTask();
  } finally {
    setButtonLoading(btn, false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname !== '/separador') return;
  try {
    await refreshSeparatorFeed();
  } catch (err) {
    console.warn('Falha ao carregar feed inicial do separador:', err);
  }
  if (separatorFeedTimer) window.clearInterval(separatorFeedTimer);
  separatorFeedTimer = window.setInterval(() => {
    refreshSeparatorFeed().catch(err => console.warn('Falha ao atualizar feed do separador:', err));
  }, 20000);
});
