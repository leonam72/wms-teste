// ╔══════════════════════════════════════════════════════════════════╗
// ║  11-sidebar-resize.js    Resize da sidebar                           ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ SIDEBAR RESIZE ═══════════════════════════════════════════════════
(function() {
  const MIN = 180, MAX = () => Math.floor(window.innerWidth * 0.6);
  let dragging = false, startX = 0, startW = 0;
  const sidebar  = document.getElementById('sidebar');
  const resizer  = document.getElementById('sidebar-resizer');
  if (!sidebar || !resizer) return;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW  = Math.min(Math.max(startW + delta, MIN), MAX());
    sidebar.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });

  // double-click resets to default
  resizer.addEventListener('dblclick', () => {
    sidebar.style.width = '320px';
  });
})();

