// ╔══════════════════════════════════════════════════════════════════╗
// ║  20-focus-drag.js        Modo foco de gaveta e drag interno          ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— DRAWER FOCUS MODE ———
const setFocusedDrawer = (key) => {
  // clear old active outline
  document.querySelectorAll('.drawer.active-drawer').forEach(d => d.classList.remove('active-drawer'));
  focusedDrawerKey = key;
  selectedProductCode = null;
  // switch sidebar to products tab and show focus panel
  switchTab('products-tab');
  renderProductTable();
  // highlight the active drawer
  requestAnimationFrame(() => {
    const el = document.querySelector(`.drawer[data-key="${key}"]`);
    if (el) el.classList.add('active-drawer');
  });
}

const clearFocus = () => {
  focusedDrawerKey = null;
  document.querySelectorAll('.drawer.active-drawer').forEach(d => d.classList.remove('active-drawer'));
  renderProductTable();
}

// ——— DRAG AND DROP ———
let dragIdx = null;
let dragFromKey = null;

const onDragStart = (e, idx, fromKey) => {
  dragIdx = idx;
  dragFromKey = fromKey;
  e.dataTransfer.effectAllowed = 'move';
  const el = e.currentTarget;
  setTimeout(() => el.classList.add('dragging'), 0);
  // make ALL drawers drop-ready
  document.querySelectorAll('.drawer').forEach(d => {
    d.addEventListener('dragover',  onDrawerDragOver);
    d.addEventListener('dragleave', onDrawerDragLeave);
    d.addEventListener('drop',      onDrawerDrop);
  });
}

const onDragEnd = (e) => {
  e.currentTarget && e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drawer').forEach(d => {
    d.classList.remove('drop-target');
    d.removeEventListener('dragover',  onDrawerDragOver);
    d.removeEventListener('dragleave', onDrawerDragLeave);
    d.removeEventListener('drop',      onDrawerDrop);
  });
}

const onDrawerDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drop-target');
}

const onDrawerDragLeave = (e) => {
  this.classList.remove('drop-target');
}

const onDrawerDrop = (e) => {
  e.preventDefault();
  this.classList.remove('drop-target');
  const destKey = this.dataset.key;
  if (!destKey || dragIdx === null || !dragFromKey) return;
  if (destKey === dragFromKey) return;

  const prod = (products[dragFromKey] || [])[dragIdx];
  if (!prod) return;

  // perform move
  products[dragFromKey].splice(dragIdx, 1);
  if (!products[destKey]) products[destKey] = [];
  products[destKey].push(prod);
  logHistory('🔀', `Movido: ${prod.code} — ${prod.name}`, `${dragFromKey} → ${destKey}`);

  // flash the target drawer
  this.classList.add('drop-ok');
  setTimeout(() => this.classList.remove('drop-ok'), 600);

  dragIdx = null; dragFromKey = null;

  // stay focused on source if it still has products, else clear
  if (focusedDrawerKey === dragFromKey && (products[dragFromKey] || []).length === 0) {
    focusedDrawerKey = destKey;
  }
  renderAll();
}

