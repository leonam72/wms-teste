// ╔══════════════════════════════════════════════════════════════════╗
// ║  03-history.js           Histórico de movimentações                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— HISTORY ———
const logHistory = (icon, action, detail) => {
  history.unshift({ ts: new Date().toISOString(), icon, action, detail });
  if (history.length > 200) history.pop();

}

const renderHistory = () => {
  const el = document.getElementById('page-history-list');
  if (!el) return;
  if (!history.length) { el.innerHTML = '<div class="empty-msg" style="padding:12px;font-size:11px">Nenhuma movimentação</div>'; return; }
  el.innerHTML = history.map(h => {
    const d = new Date(h.ts);
    const time = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return `<div class="hist-item-sm">
      <div class="hist-icon-sm">${h.icon}</div>
      <div class="hist-body-sm">
        <div class="hist-action-sm">${h.action}</div>
        <div class="hist-meta-sm">${h.detail}</div>
      </div>
      <div class="hist-time-sm">${time}</div>
    </div>`;
  }).join('');
}

const clearHistory = async () => {
  const okCH = await showConfirm({ title:'LIMPAR HISTÓRICO', icon:'🗑', desc:'Apagar todas as movimentações registradas? Esta ação não pode ser desfeita.', okLabel:'LIMPAR' }); if(!okCH) return;
  history = [];
  renderHistory();
}

