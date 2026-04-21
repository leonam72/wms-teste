// ╔══════════════════════════════════════════════════════════════════╗
// ║  17-add-product.js       Adicionar produto global                    ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— GLOBAL ADD PRODUCT ———
function openAddProductModal() {
  document.getElementById('add-product-modal').classList.add('open');
}

async function addGlobalProduct() {
  const code = document.getElementById('gp-code').value.trim().toUpperCase();
  const name = document.getElementById('gp-name').value.trim();
  const kg = parseFloat(document.getElementById('gp-kg').value) || 0;
  const loc = document.getElementById('gp-location').value.trim().toUpperCase();
  const entry = document.getElementById('gp-entry').value;
  const expiries2 = [...gpExpiries];
  if (!code || !name || !loc) return alert('Código, nome e local são obrigatórios.');
  const p = parseKey(loc);
  if (!p) return alert('Local inválido. Use formato como A1.G2');
  const shelf = shelves.find(s => s.id === p.shelf);
  if (!shelf) return alert(`Prateleira ${p.shelf} não existe.`);
  if (p.floor < 1 || p.floor > shelf.floors) return alert(`Andar ${p.floor} inválido para prateleira ${p.shelf}.`);
  if (p.drawer < 1 || p.drawer > shelf.drawers) return alert(`Gaveta ${p.drawer} inválida para prateleira ${p.shelf}.`);
  if (!products[loc]) products[loc] = [];
  const okGp = await showConfirm({ title:'CADASTRAR PRODUTO', icon:'📥', desc:'Confirmar entrada do produto?', summary:{'CÓDIGO':code,'NOME':name,'LOCAL':loc,'PESO':kg+'kg'}, okLabel:'CADASTRAR', okStyle:'accent' }); if(!okGp) return;
  products[loc].push({ code, name, kg, entry, expiries: expiries2 });
  logHistory('📥', `Entrada: ${code} — ${name}`, `${loc} · ${kg}kg`);
  ['gp-code','gp-name','gp-kg','gp-location'].forEach(id => document.getElementById(id).value = '');
  gpExpiries = [];
  const gpChips = document.getElementById('gp-expiry-chips');
  if (gpChips) gpChips.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
  document.getElementById('add-product-modal').classList.remove('open');
  renderAll();
}

