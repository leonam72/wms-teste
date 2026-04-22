// ╔══════════════════════════════════════════════════════════════════╗
// ║  02-state.js             Estado global e gerenciamento de depósitos  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— STATE ———
// ── Multi-depot: each depot has id, name, and its own shelves/products
let depots = [
  { id: 'dep1', name: 'Depósito Principal', address: '', city: '', manager: '', phone: '', notes: '' }
];
let activeDepotId = 'dep1';

// shelves and products are now per-depot
// shelves['dep1'] = [...], products['dep1'] = {...}
let shelvesAll = {
  dep1: [
    { id: 'A', floors: 6, drawers: 4, maxKg: 80  },
    { id: 'B', floors: 6, drawers: 4, maxKg: 60  },
    { id: 'C', floors: 5, drawers: 4, maxKg: 100 },
    { id: 'D', floors: 4, drawers: 3, maxKg: 30  },
  ]
};
let productsAll = { dep1: {} };

// Compatibility shims — shelves/products point to active depot
let shelves = shelvesAll['dep1'];
let products = productsAll['dep1'];

const switchDepot = (depotId) => {
  if (!shelvesAll[depotId])  { shelvesAll[depotId]  = []; }
  if (!productsAll[depotId]) { productsAll[depotId] = {}; }
  activeDepotId = depotId;
  shelves  = shelvesAll[depotId];
  products = productsAll[depotId];
  selectedProductCode = null;
  selectedShelfId = null;
  sbFilter = '';
  renderAll();
  renderDepotTabs();
}

const addDepot = (name) => { openDepotModal(null); }

const removeDepot = async (id) => {
  if (depots.length <= 1) { alert('Não é possível remover o único depósito.'); return; }
  const depot = depots.find(d => d.id === id);
  const slist = shelvesAll[id] || [];
  const p     = productsAll[id] || {};
  const prodCount  = Object.values(p).reduce((s, a) => s + a.length, 0);
  const skuCount   = new Set(Object.values(p).flat().map(pr => pr.code)).size;
  if (prodCount > 0) {
    alert(`Não é possível excluir "${depot?.name}" — ainda contém ${prodCount} produto(s) em ${skuCount} SKU(s). Remova todos os produtos antes.`);
    return;
  }
  if (slist.length > 0) {
    alert(`Não é possível excluir "${depot?.name}" — ainda contém ${slist.length} prateleira(s). Remova-as antes.`);
    return;
  }
  const ok = await showConfirm({
    title: 'EXCLUIR DEPÓSITO', icon: '🗑',
    desc: 'Esta ação é permanente. O depósito será removido do sistema.',
    summary: { 'NOME': depot?.name||id, 'PRATELEIRAS': slist.length, 'PRODUTOS': prodCount },
    okLabel: 'EXCLUIR', okStyle: 'danger'
  });
  if (!ok) return;
  depots = depots.filter(d => d.id !== id);
  delete shelvesAll[id]; delete productsAll[id];
  if (activeDepotId === id) switchDepot(depots[0].id);
  else { renderDepotTabs(); renderDepotsPage(); }
}

const renameDepot = (id) => { openDepotModal(id); }

const renderDepotTabs = () => {
  const bar = document.getElementById('depot-tabs-bar');
  if (!bar) return;
  bar.innerHTML = depots.map(d => `
    <div class="depot-tab ${d.id===activeDepotId?'active':''}" onclick="switchDepot('${d.id}')">
      <span>${d.name}</span>
      <button class="depot-tab-edit" onclick="event.stopPropagation();renameDepot('${d.id}')" title="Renomear">✏</button>
      <button class="depot-tab-del"  onclick="event.stopPropagation();removeDepot('${d.id}')"  title="Remover">×</button>
    </div>
  `).join('') + `<button class="depot-tab-add" onclick="openDepotModal(null)" title="Adicionar depósito">+ DEPÓSITO</button>`;
}
// products is now productsAll[activeDepotId] — see shim above
let history = []; // { ts, action, detail, icon }
let selectedProductCode = null;
let currentDrawerKey = null;
let moveProductIdx = null;
let moveFromKey = null;
let dpExpiries = [];   // working list for drawer modal add form
let gpExpiries = [];   // working list for global add product modal
let dateEditCtx = null; // { list, idx, renderFn }
let selectedEditIdx = null; // product index being edited in drawer modal
let poSortCol = 'code'; let poSortDir = 1;
let focusedDrawerKey = null;

