// ╔══════════════════════════════════════════════════════════════════╗
// ║  01-confirm.js           Sistema de confirmação unificado            ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ UNIFIED CONFIRMATION SYSTEM ══════════════════════════════════════
let _confirmResolve = null;

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
        `<div class="confirm-sum-row"><span class="confirm-sum-label">${k}</span><span class="confirm-sum-val">${v}</span></div>`
      ).join('');
    } else {
      sumEl.style.display = 'none';
    }
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okLabel;
    okBtn.className   = 'confirm-btn-ok' + (okStyle === 'safe' ? ' safe' : okStyle === 'accent' ? ' accent' : '');
    document.getElementById('confirm-overlay').classList.add('open');
  });
}

function confirmResolve(result) {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}


