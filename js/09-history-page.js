// ╔══════════════════════════════════════════════════════════════════╗
// ║  09-history-page.js      Página de histórico                         ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ PAGE HISTORY ═════════════════════════════════════════════════════
const renderPageHistory = () => {
  const el = document.getElementById('page-history-list');
  if (!el) return;
  if (!history.length) { el.innerHTML = '<div class="empty-msg">Nenhuma movimentação registrada</div>'; return; }
  el.innerHTML = history.map(h => {
    const d = new Date(h.ts);
    const time = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return `<div class="hist-item"><div class="hist-icon">${h.icon}</div><div class="hist-body"><div class="hist-action">${h.action}</div><div class="hist-meta">${h.detail}</div></div><div class="hist-time">${time}</div></div>`;
  }).join('');
}

