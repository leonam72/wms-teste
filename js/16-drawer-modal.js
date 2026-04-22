// ╔══════════════════════════════════════════════════════════════════╗
// ║  16-drawer-modal.js      Modal de gaveta e remoção                   ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— ADD SHELF ———
const addShelf = () => {
  const name = document.getElementById('new-shelf-name').value.trim().toUpperCase();
  const floors = parseInt(document.getElementById('new-shelf-floors').value);
  const drawers = parseInt(document.getElementById('new-shelf-drawers').value);
  const maxKg = parseFloat(document.getElementById('new-shelf-maxkg').value) || 50;
  if (!name || isNaN(floors) || isNaN(drawers)) return alert('Preencha todos os campos.');
  if (/^[0-9]+$/.test(name)) return alert('Nome da prateleira não pode ser apenas números. Use letras como A, B, C ou combinações como A1.');
  if (shelves.find(s => s.id === name)) return alert('Prateleira já existe.');
  shelves.push({ id: name, floors, drawers, maxKg });
  document.getElementById('new-shelf-name').value = '';
  renderAll();
}

const removeShelf = async (id) => {
  const shelf = shelves.find(s => s.id === id);
  if (!shelf) return;
  // verify truly empty
  for (let f = 1; f <= shelf.floors; f++)
    for (let d = 1; d <= shelf.drawers; d++)
      if ((products[drawerKey(shelf.id, f, d)] || []).length > 0) {
        alert(`Prateleira ${id} ainda tem produtos. Esvazie todas as gavetas antes de remover.`);
        return;
      }
  const ok2 = await showConfirm({ title:'REMOVER PRATELEIRA', icon:'🗑', desc:'Remover a prateleira vazia?', summary:{'PRATELEIRA':id,'ANDARES':shelf.floors,'GAVETAS':shelf.floors*shelf.drawers}, okLabel:'REMOVER' }); if(!ok2) return;
  shelves = shelves.filter(s => s.id !== id);
  Object.keys(products).forEach(k => { if (k.startsWith(id + '.') || k.startsWith(id + '0') || k.match(new RegExp('^' + id + '\\d')) ) delete products[k]; });
  renderAll();
}

// ——— DRAWER MODAL ———
const openDrawerModal = (key) => {
  currentDrawerKey = key;
  document.getElementById('drawer-modal-title').textContent = `GAVETA — ${key}`;
  const p = parseKey(key);
  document.getElementById('drawer-modal-loc').textContent = p ? `Prateleira ${p.shelf} · Andar ${p.floor} · Gaveta ${p.drawer}` : key;
  renderDrawerProducts();
  document.getElementById('drawer-modal').classList.add('open');
}

const closeDrawerModal = () => {
  document.getElementById('drawer-modal').classList.remove('open');
  currentDrawerKey = null;
  dpExpiries = [];
  pfExpiries = [];
}

const renderDrawerProducts = () => {
  const list = document.getElementById('drawer-products-list');
  const prods = products[currentDrawerKey] || [];

  // capacity bar
  const shelf = shelves.find(s => currentDrawerKey.startsWith(s.id));
  const maxKg = shelf ? (shelf.maxKg || 50) : 50;
  const usedKg = prods.reduce((s,p) => s + (parseFloat(p.kg)||0), 0);
  const capPct = Math.min(100, (usedKg / maxKg) * 100);
  const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';
  const capBar = document.getElementById('drawer-cap-bar');
  const capInfo = document.getElementById('drawer-cap-info');
  if (capBar) { capBar.style.width = capPct + '%'; capBar.className = 'cap-bar ' + capCls; }
  if (capInfo) capInfo.textContent = usedKg.toFixed(1) + ' / ' + maxKg + ' kg (' + Math.round(capPct) + '%)';

  if (!prods.length) { list.innerHTML = '<div class="empty-msg">Gaveta vazia</div>'; return; }

  // group by code to find soonest per code
  const codeMinExp = {};
  prods.forEach(p => {
    const ne = nearestExpiry(p);
    if (!codeMinExp[p.code] || (ne && ne < codeMinExp[p.code])) codeMinExp[p.code] = ne;
  });

  list.innerHTML = prods.map((p, i) => {
    const es = productExpiryStatus(p);
    const expiries = getExpiries(p).filter(Boolean).sort();
    const nearest = expiries[0];
    const sameCodeProds = prods.filter(x => x.code === p.code);
    const isSoonest = nearest && nearest === codeMinExp[p.code] && sameCodeProds.length > 1;
    const isLatest  = nearest && nearest !== codeMinExp[p.code] && sameCodeProds.length > 1;

    const expBadge = es === 'expired'
      ? ' <span style="color:var(--danger);font-size:10px;font-weight:700">VENCIDO</span>'
      : es === 'expiring'
      ? ` <span style="color:var(--warn);font-size:10px;font-weight:700">⚠ ${daysUntil(nearest)}d</span>`
      : '';

    let urgencyRibbon = '';
    if (isSoonest) {
      const ribbonColor = es==='expired'?'var(--danger)':es==='expiring'?'var(--warn)':'#1a8a3a';
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:${ribbonColor};margin-top:2px">⬆ VALIDADE MAIS PRÓXIMA</div>`;
    } else if (isLatest && es === 'ok') {
      // only show "validade mais longa" ribbon when THIS entry is truly within date
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;color:var(--accent3);margin-top:2px">✓ validade mais longa</div>`;
    } else if (isLatest && es !== 'ok') {
      urgencyRibbon = `<div style="font-size:9px;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--danger);margin-top:2px">⚠ ${es==='expired'?'VENCIDO':'A VENCER'} (lote mais antigo)</div>`;
    }

    // expiry chips display inside product card
    let valChips = '';
    if (expiries.length === 0) {
      valChips = '<span style="font-size:10px;color:var(--text3);font-family:IBM Plex Mono,monospace">Sem validade</span>';
    } else {
      valChips = expiries.map((d, di) => {
        const st = expiryStatus(d);
        return `<span class="exp-chip ${st}" onclick="openDateEditForProduct(${i},${di})" title="Clique para editar">${fmtDate(d)} <button class="chip-edit" onclick="event.stopPropagation();openDateEditForProduct(${i},${di})">✏</button></span>`;
      }).join('');
    }

    const borderStyle = es === 'expired'
      ? (isSoonest ? 'border-color:#cc2222;border-width:2px;background:#fff0f0' : 'border-color:#e88;background:#fff0f0')
      : es === 'expiring'
      ? (isSoonest ? 'border-color:#cc7700;border-width:2px;background:#fff8ee' : 'border-color:#e8a800;background:#fff8ee')
      : isSoonest ? 'border-color:#1a8a3a;border-width:2px;background:#f0fdf4'
      : isLatest  ? 'border-color:#7ec87e;background:#f6fff6'
      : '';

    return `<div class="dp-item" style="${borderStyle};cursor:pointer" onclick="openProductForm(${i})">
      <div class="dp-code">${p.code}</div>
      <div class="dp-info" style="min-width:0">
        <div class="dp-name">${p.name}${expBadge}</div>
        <div class="dp-meta">${p.kg ? p.kg + ' kg' : '—'}${p.entry ? ' · Entrada: ' + p.entry : ''}</div>
        <div class="exp-chip-list" style="margin-top:4px">${valChips}</div>
        ${urgencyRibbon}
      </div>
      <button class="dp-move" onclick="openMoveModal(${i})" title="Mover">⇄</button>
      <button class="dp-remove" onclick="removeProductFromDrawer(${i})">✕</button>
    </div>`;
  }).join('');
}

const openDateEditForProduct = (prodIdx, dateIdx) => {
  const p = (products[currentDrawerKey] || [])[prodIdx];
  if (!p) return;
  const expiries = getExpiries(p).filter(Boolean).sort();
  dateEditCtx = {
    type: 'product',
    prodIdx,
    dateIdx,
    list: [...expiries],
    save: (newList) => {
      products[currentDrawerKey][prodIdx].expiries = newList;
      products[currentDrawerKey][prodIdx].exit = undefined;
      renderDrawerProducts();
      renderAll();
    }
  };
  document.getElementById('date-edit-title').textContent = `VALIDADE — ${p.code}`;
  document.getElementById('date-edit-input').value = expiries[dateIdx] || '';
  document.getElementById('date-edit-modal').classList.add('open');
}

// dp-* helpers now delegate to unified pf- form
const dpAddExpiry = ()    { pfAddExpiry(); }
const renderDpChips = ()  { renderPfChips(); }
const dpEditExpiry = (i)  { pfEditExpiry(i); }
const addProductToDrawer = () => { openProductForm(null); }

const removeProductFromDrawer = async (idx) => {
  const p = products[currentDrawerKey][idx];
  const okRm = await showConfirm({ title:'REMOVER PRODUTO', icon:'🗑', desc:'Remover este produto da gaveta?', summary:{'CÓDIGO':p.code,'NOME':p.name,'GAVETA':currentDrawerKey}, okLabel:'REMOVER' }); if(!okRm) return;
  logHistory('📤', `Saída: ${p.code} — ${p.name}`, `Removido de ${currentDrawerKey}`);
  products[currentDrawerKey].splice(idx, 1);
  renderDrawerProducts();
  renderAll();
}

