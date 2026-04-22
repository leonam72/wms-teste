// ╔══════════════════════════════════════════════════════════════════╗
// ║  15-stats-shelflist.js   Stats e lista de prateleiras                ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— STATS ———
const renderStats = () => {
  const prods = getAllProducts();
  const totalKg = prods.reduce((s, p) => s + p.kg, 0);
  let occupied = 0, total = 0;
  shelves.forEach(s => {
    total += s.floors * s.drawers;
    for (let f = 1; f <= s.floors; f++)
      for (let d = 1; d <= s.drawers; d++)
        if ((products[drawerKey(s.id, f, d)] || []).length > 0) occupied++;
  });

  const occPctGlobal = total > 0 ? Math.round((occupied/total)*100) : 0;
  const occColor = occPctGlobal >= 90 ? 'var(--danger)' : occPctGlobal >= 60 ? 'var(--warn)' : 'var(--accent3)';
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card"><div class="stat-label">PRATELEIRAS</div><div class="stat-value">${shelves.length}</div><div class="stat-sub">${total} gavetas total</div></div>
    <div class="stat-card">
      <div class="stat-label">OCUPAÇÃO</div>
      <div class="stat-value" style="color:${occColor}">${occPctGlobal}%</div>
      <div class="stat-sub">${occupied} de ${total} gavetas</div>
    </div>
    <div class="stat-card"><div class="stat-label">PRODUTOS</div><div class="stat-value" style="color:var(--accent2)">${prods.length}</div><div class="stat-sub">SKUs distintos</div></div>
    <div class="stat-card"><div class="stat-label">PESO TOTAL</div><div class="stat-value" style="color:var(--warn)">${totalKg.toFixed(1)}</div><div class="stat-sub">kg armazenados</div></div>
  `;
}

// ——— SHELF LIST ———
const renderShelfList = () => {
  const el = document.getElementById('shelf-list');
  if (!shelves.length) { el.innerHTML = '<div class="empty-msg">Nenhuma prateleira</div>'; return; }
  el.innerHTML = shelves.map(s => {
    // count occupied drawers for this shelf
    let occ = 0;
    for (let f = 1; f <= s.floors; f++)
      for (let d = 1; d <= s.drawers; d++)
        if ((products[drawerKey(s.id, f, d)] || []).length > 0) occ++;
    const isEmpty = occ === 0;
    const delBtn = isEmpty
      ? `<button class="icon-btn del" onclick="event.stopPropagation();removeShelf('${s.id}')" title="Remover prateleira vazia">✕</button>`
      : `<button class="icon-btn" style="opacity:.35;cursor:not-allowed" title="${occ} gaveta(s) ocupada(s) — esvazie antes de remover" disabled onclick="event.stopPropagation()">✕</button>`;
    return `<div class="shelf-item ${selectedShelfId === s.id ? 'active' : ''}" onclick="selectShelf('${s.id}')">
      <div>
        <div class="shelf-name">${s.id}</div>
        <div class="shelf-meta">${s.floors} andares × ${s.drawers} gavetas</div>
        <div class="shelf-meta" style="margin-top:2px;color:${isEmpty ? 'var(--accent3)' : 'var(--text3)'}">
          ${isEmpty ? '✓ vazia' : occ + ' gaveta(s) com produtos'}
        </div>
      </div>
      <div class="shelf-actions" style="display:flex;gap:4px">
        <button class="icon-btn" onclick="event.stopPropagation();openEditShelfPanel('${s.id}')" title="Editar prateleira">✏</button>
        ${delBtn}
      </div>
    </div>`;
  }).join('');
}



// ── Shelf panel toggle ────────────────────────────────────────────────
const toggleAddShelfPanel = () => {
  const panel = document.getElementById('add-shelf-panel');
  const editPanel = document.getElementById('edit-shelf-panel');
  const btn = document.getElementById('btn-add-shelf');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (editPanel) editPanel.style.display = 'none';
  if (btn) btn.textContent = isOpen ? '+ NOVA' : '✕ FECHAR';
  if (!isOpen) {
    // reset fields
    ['new-shelf-name','new-shelf-floors','new-shelf-drawers','new-shelf-maxkg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { if(id==='new-shelf-floors')el.value='6'; else if(id==='new-shelf-drawers')el.value='4'; else if(id==='new-shelf-maxkg')el.value='50'; else el.value=''; }
    });
    setTimeout(() => document.getElementById('new-shelf-name')?.focus(), 50);
  }
}

let _editShelfId = null;
const openEditShelfPanel = (shelfId) => {
  const shelf = shelves.find(s => s.id === shelfId); if (!shelf) return;
  _editShelfId = shelfId;
  const addPanel = document.getElementById('add-shelf-panel');
  if (addPanel) addPanel.style.display = 'none';
  const btn = document.getElementById('btn-add-shelf');
  if (btn) btn.textContent = '+ NOVA';
  const panel = document.getElementById('edit-shelf-panel');
  const lbl   = document.getElementById('edit-shelf-id-label');
  if (lbl) lbl.textContent = shelfId;
  const setV = (id, v) => { const el=document.getElementById(id); if(el) el.value=v; };
  setV('edit-shelf-floors',  shelf.floors);
  setV('edit-shelf-drawers', shelf.drawers);
  setV('edit-shelf-maxkg',   shelf.maxKg || 50);
  if (panel) panel.style.display = 'block';
  // scroll panel into view
  panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const closeEditShelfPanel = () => {
  const panel = document.getElementById('edit-shelf-panel');
  if (panel) panel.style.display = 'none';
  _editShelfId = null;
}

const saveEditShelf = async () => {
  if (!_editShelfId) return;
  const shelf = shelves.find(s => s.id === _editShelfId); if (!shelf) return;
  const floors  = parseInt(document.getElementById('edit-shelf-floors')?.value) || shelf.floors;
  const drawers = parseInt(document.getElementById('edit-shelf-drawers')?.value) || shelf.drawers;
  const maxKg   = parseFloat(document.getElementById('edit-shelf-maxkg')?.value) || shelf.maxKg || 50;
  const ok = await showConfirm({
    title: 'EDITAR PRATELEIRA ' + _editShelfId, icon: '✏',
    desc: 'Sallet alterações nas propriedades da prateleira?',
    summary: { 'ANDARES': floors, 'GAVETAS': drawers, 'CAP. MÁX': maxKg + ' kg/gav.' },
    okLabel: 'SALVAR', okStyle: 'accent'
  });
  if (!ok) return;
  shelf.floors  = floors;
  shelf.drawers = drawers;
  shelf.maxKg   = maxKg;
  logHistory('✏', `Prateleira editada: ${_editShelfId}`, `${floors} and. × ${drawers} gav. · ${maxKg}kg`);
  closeEditShelfPanel();
  renderAll();
  renderShelfList();
}

// ——— SCROLL TO SHELF ———
const selectShelf = (id) => {
  selectedShelfId = selectedShelfId === id ? null : id;
  renderShelfList();

  if (!selectedShelfId) {
    document.querySelectorAll('.shelf-block.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));
    return;
  }

  // switch to depot page if not already there
  showPage('depot');

  requestAnimationFrame(() => {
    // find shelf block by its name text
    const blocks = document.querySelectorAll('.shelf-block');
    let target = null;
    blocks.forEach(b => {
      const nameEl = b.querySelector('.shelf-block-name');
      if (nameEl && nameEl.textContent.trim() === 'PRATELEIRA ' + selectedShelfId) target = b;
    });

    // remove previous highlight
    document.querySelectorAll('.shelf-block.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));

    if (target) {
      target.classList.add('shelf-highlighted');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // remove highlight after 2.5s
      setTimeout(() => target.classList.remove('shelf-highlighted'), 2500);
    }
  });
}

