// ╔══════════════════════════════════════════════════════════════════╗
// ║  11-sidebar-resize.js    Resize da sidebar                           ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ SIDEBAR RESIZE ═══════════════════════════════════════════════════
const _sbResizeMin = 180;
const _sbResizeMax = () => Math.floor(window.innerWidth * 0.6);
let   _sbDragging  = false;
let   _sbStartX    = 0;
let   _sbStartW    = 0;

const _sbSidebar  = document.getElementById('sidebar');
const _sbResizer  = document.getElementById('sidebar-resizer');

if (_sbSidebar && _sbResizer) {
  _sbResizer.addEventListener('mousedown', e => {
    _sbDragging = true;
    _sbStartX   = e.clientX;
    _sbStartW   = _sbSidebar.offsetWidth;
    _sbResizer.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!_sbDragging) return;
    const delta = e.clientX - _sbStartX;
    const newW  = Math.min(Math.max(_sbStartW + delta, _sbResizeMin), _sbResizeMax());
    _sbSidebar.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!_sbDragging) return;
    _sbDragging = false;
    _sbResizer.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });

  // double-click resets to default
  _sbResizer.addEventListener('dblclick', () => {
    _sbSidebar.style.width = '320px';
  });
}
