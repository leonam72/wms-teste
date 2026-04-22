// ╔══════════════════════════════════════════════════════════════════╗
// ║  10-product-form.js      Formulário unificado de produto (add/edit)  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══ DRAWER INLINE EDIT ════════════════════════════════════════════════
// ══ UNIFIED PRODUCT FORM MODAL ════════════════════════════════════════
let pfEditIdx = null;    // null = add mode, number = edit mode
let pfExpiries = [];     // working expiry list for this form

const openProductForm = (idx) => {
  pfEditIdx = idx;
  pfExpiries = [];
  pfSwitchTab('basic');

  const isEdit = idx !== null && idx !== undefined;
  document.getElementById('pf-title').textContent = isEdit ? '✏ EDITAR PRODUTO' : '+ ADICIONAR PRODUTO';

  const today = new Date().toISOString().slice(0,10);

  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const newFields = ['pf-ean','pf-sku','pf-category','pf-supplier','pf-unit','pf-qty','pf-lot','pf-temp-max','pf-temp-min','pf-anvisa','pf-ncm','pf-cost','pf-price','pf-perishable','pf-expiry-control','pf-notes'];

  if (isEdit) {
    const p = (products[currentDrawerKey] || [])[idx];
    if (!p) return;
    pfExpiries = [...getExpiries(p).filter(Boolean)];
    setV('pf-code',  p.code);
    setV('pf-name',  p.name);
    setV('pf-kg',    p.kg);
    setV('pf-entry', p.entry || today);
    // extended fields
    setV('pf-ean',      p.ean      || '');
    setV('pf-sku',      p.sku      || '');
    setV('pf-category', p.category || '');
    setV('pf-supplier', p.supplier || '');
    setV('pf-unit',     p.unit     || 'un');
    setV('pf-qty',      p.qty      || 1);
    setV('pf-lot',      p.lot      || '');
    setV('pf-temp-max', p.tempMax  != null ? p.tempMax : '');
    setV('pf-temp-min', p.tempMin  != null ? p.tempMin : '');
    setV('pf-anvisa',   p.anvisa   || '');
    setV('pf-ncm',      p.ncm      || '');
    setV('pf-cost',     p.cost     != null ? p.cost : '');
    setV('pf-price',    p.price    != null ? p.price : '');
    setV('pf-perishable',    p.perishable    || 'no');
    setV('pf-expiry-control', p.expiryControl || 'yes');
    setV('pf-notes',    p.notes    || '');

    const footer = document.getElementById('pf-footer');
    if (footer) footer.innerHTML = `
      <button class="btn btn-danger" onclick="pfDeleteProduct()">✕ EXCLUIR</button>
      <div style="flex:1"></div>
      <button class="btn" onclick="closeProductForm()">CANCELAR</button>
      <button class="btn btn-accent" onclick="saveProductForm()">✓ SALVAR EDIÇÃO</button>
    `;
  } else {
    setV('pf-code',  ''); setV('pf-name',  ''); setV('pf-kg',    ''); setV('pf-entry', today);
    newFields.forEach(id => { const el=document.getElementById(id); if(el&&el.tagName==='SELECT')el.selectedIndex=0; else if(el)el.value=''; });
    setV('pf-qty', 1); setV('pf-unit','un');
    const footer = document.getElementById('pf-footer');
    if (footer) footer.innerHTML = `
      <button class="btn" onclick="closeProductForm()">CANCELAR</button>
      <button class="btn btn-accent" onclick="saveProductForm()">+ ADICIONAR</button>
    `;
  }

  renderPfChips();
  const pfExpIn = document.getElementById('pf-expiry-input');
  if (pfExpIn) pfExpIn.value = '';
  document.getElementById('product-form-modal').classList.add('open');
}

const closeProductForm = () => {
  document.getElementById('product-form-modal').classList.remove('open');
  pfEditIdx = null;
  pfExpiries = [];
}

const pfAddExpiry = () => {
  const pfIn = document.getElementById('pf-expiry-input');
  const val = pfIn ? pfIn.value : '';
  if (!val) return;
  if (!pfExpiries.includes(val)) pfExpiries.push(val);
  pfExpiries.sort();
  if (pfIn) pfIn.value = '';
  renderPfChips();
}

const renderPfChips = () => {
  const c = document.getElementById('pf-expiry-chips');
  if (!c) return;
  if (!pfExpiries.length) {
    c.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
    return;
  }
  c.innerHTML = pfExpiries.map((d,i) => {
    const st = expiryStatus(d);
    return `<span class="exp-chip ${st}">${fmtDate(d)}
      <button class="chip-edit" onclick="pfEditExpiry(${i})">✏</button>
    </span>`;
  }).join('');
}

const pfEditExpiry = (idx) => {
  dateEditCtx = {
    type: 'pfForm', dateIdx: idx, list: [...pfExpiries],
    save: (newList) => { pfExpiries = newList; renderPfChips(); }
  };
  document.getElementById('date-edit-title').textContent = 'EDITAR VALIDADE';
  document.getElementById('date-edit-input').value = pfExpiries[idx] || '';
  document.getElementById('date-edit-modal').classList.add('open');
}

const saveProductForm = async () => {
  const code  = (document.getElementById('pf-code')?.value || '').trim().toUpperCase();
  const name  = (document.getElementById('pf-name')?.value || '').trim();
  const kg    = parseFloat(document.getElementById('pf-kg')?.value) || 0;
  const entry = document.getElementById('pf-entry')?.value || '';
  const expiryControl = document.getElementById('pf-expiry-control')?.value || 'yes';
  const extFields = {
    ean:      (document.getElementById('pf-ean')?.value||'').trim(),
    sku:      (document.getElementById('pf-sku')?.value||'').trim(),
    category: (document.getElementById('pf-category')?.value||'').trim(),
    supplier: (document.getElementById('pf-supplier')?.value||'').trim(),
    unit:     document.getElementById('pf-unit')?.value||'un',
    qty:      parseInt(document.getElementById('pf-qty')?.value)||1,
    lot:      (document.getElementById('pf-lot')?.value||'').trim(),
    tempMax:  document.getElementById('pf-temp-max')?.value!==''?parseFloat(document.getElementById('pf-temp-max').value):null,
    tempMin:  document.getElementById('pf-temp-min')?.value!==''?parseFloat(document.getElementById('pf-temp-min').value):null,
    anvisa:   (document.getElementById('pf-anvisa')?.value||'').trim(),
    ncm:      (document.getElementById('pf-ncm')?.value||'').trim(),
    cost:     document.getElementById('pf-cost')?.value!==''?parseFloat(document.getElementById('pf-cost').value):null,
    price:    document.getElementById('pf-price')?.value!==''?parseFloat(document.getElementById('pf-price').value):null,
    perishable: document.getElementById('pf-perishable')?.value||'no',
    expiryControl,
    notes:    (document.getElementById('pf-notes')?.value||'').trim(),
  };
  const finalExpiries = expiryControl==='no' ? [] : [...pfExpiries];
  if (!code || !name) return alert('Código e nome são obrigatórios.');

  if (!products[currentDrawerKey]) products[currentDrawerKey] = [];

  if (pfEditIdx !== null) {
    const okEdit = await showConfirm({ title:'EDITAR PRODUTO', icon:'✏', desc:'Sallet as alterações neste produto?', summary:{'CÓDIGO':code,'NOME':name,'PESO':kg+'kg','GAVETA':currentDrawerKey}, okLabel:'SALVAR', okStyle:'accent' }); if(!okEdit) return;
    const p = products[currentDrawerKey][pfEditIdx];
    products[currentDrawerKey][pfEditIdx] = { ...p, code, name, kg, entry, expiries: finalExpiries, ...extFields };
    logHistory('✏', `Editado: ${code} — ${name}`, `${currentDrawerKey}`);
  } else {
    // add new
    products[currentDrawerKey].push({ code, name, kg, entry, expiries: finalExpiries, ...extFields });
    logHistory('📥', `Entrada: ${code} — ${name}`, `${currentDrawerKey} · ${kg}kg`);
  }

  closeProductForm();
  renderDrawerProducts();
  renderAll();
}

const pfDeleteProduct = async () => {
  if (pfEditIdx === null) return;
  const p = products[currentDrawerKey][pfEditIdx];
  const okDel = await showConfirm({ title:'EXCLUIR PRODUTO', icon:'🗑', desc:'Remover este produto permanentemente desta gaveta?', summary:{'CÓDIGO':p.code,'NOME':p.name,'GAVETA':currentDrawerKey,'PESO':(p.kg||0)+'kg'}, okLabel:'EXCLUIR' }); if(!okDel) return;
  logHistory('📤', `Saída: ${p.code} — ${p.name}`, `Removido de ${currentDrawerKey}`);
  products[currentDrawerKey].splice(pfEditIdx, 1);
  closeProductForm();
  renderDrawerProducts();
  renderAll();
}

// ══ SAVE DRAWER CHANGES ═══════════════════════════════════════════════
const saveDrawerChanges = () => {
  if (!currentDrawerKey) return;
  logHistory('💾', `Gaveta salva: ${currentDrawerKey}`, `${(products[currentDrawerKey]||[]).length} produto(s)`);
  const btn = document.querySelector('.modal-footer .btn[onclick="saveDrawerChanges()"]');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ SALVO!'; btn.style.color='var(--accent3)'; setTimeout(()=>{btn.textContent=orig;btn.style.color='';},1500); }
  renderAll();
}




// ══ DRAWER DRAG & DROP ════════════════════════════════════════════════
let dndSrcKey  = null;   // source drawer key
let dndSrcIdx  = null;   // product index (null = whole drawer, future)
let dndOverKey = null;
const dndGhost = () => document.getElementById('dnd-ghost');

const dndInit = (drawerEl, key) => {
  // Make the whole drawer div draggable
  drawerEl.setAttribute('draggable', 'true');

  drawerEl.addEventListener('dragstart', (e) => {
    dndSrcKey = key;
    drawerEl.classList.add('dnd-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
    const prods = products[key] || [];
    const ghost = dndGhost();
    if (ghost) {
      ghost.textContent = '⠿ ' + (prods.length ? prods.map(p=>p.code).join(', ') : 'vazia') + ' → ?';
      ghost.style.display = 'block';
    }
  });

  drawerEl.addEventListener('dragend', () => {
    drawerEl.classList.remove('dnd-dragging');
    if (dndGhost()) dndGhost().style.display = 'none';
    // remove all dnd-over classes
    document.querySelectorAll('.drawer.dnd-over').forEach(el => el.classList.remove('dnd-over'));
    dndSrcKey = null; dndOverKey = null;
  });

  drawerEl.addEventListener('dragover', (e) => {
    if (!dndSrcKey || dndSrcKey === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dndOverKey !== key) {
      document.querySelectorAll('.drawer.dnd-over').forEach(el => el.classList.remove('dnd-over'));
      drawerEl.classList.add('dnd-over');
      dndOverKey = key;
    }
    const ghost = dndGhost();
    if (ghost) { ghost.style.left = (e.clientX + 14) + 'px'; ghost.style.top = (e.clientY + 14) + 'px'; }
  });

  drawerEl.addEventListener('dragleave', () => {
    drawerEl.classList.remove('dnd-over');
    if (dndOverKey === key) dndOverKey = null;
  });

  drawerEl.addEventListener('drop', (e) => {
    e.preventDefault();
    drawerEl.classList.remove('dnd-over');
    if (!dndSrcKey || dndSrcKey === key) return;
    // use the move-mode flow: set mvState and open confirm
    const srcProds = products[dndSrcKey] || [];
    if (!srcProds.length) return;
    // pick first product and open move modal
    dndSrcKey_pending = dndSrcKey;
    dndDstKey_pending = key;
    openDndMoveModal();
  });
}

const dndSwapDrawers = (srcKey, dstKey) => {
  const srcProds = products[srcKey] || [];
  const dstProds = products[dstKey] || [];
  if (srcProds.length === 0) return; // nothing to move

  // swap entire contents
  const tmp = [...srcProds];
  products[srcKey] = [...dstProds];
  products[dstKey] = [...tmp];
  // clean up empty
  if (!products[srcKey].length) delete products[srcKey];

  logHistory('🔀', `Gavetas trocadas: ${srcKey} ↔ ${dstKey}`,
    tmp.map(p=>p.code).join(', ') + (dstProds.length ? ' | ← '+dstProds.map(p=>p.code).join(', ') : ''));

  // refresh whichever modal is currently showing
  if (document.getElementById('drawer-modal')?.classList.contains('open')) {
    renderDrawerProducts();
  }
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open') && fpFocusedShelf) {
    const shelf = shelves.find(s => s.id === fpFocusedShelf);
    if (shelf) renderFpModalBody(shelf);
  }
  renderAll();
}


// ── DnD pending move ────────────────────────────────────────────────
let dndSrcKey_pending = null;
let dndDstKey_pending = null;

const openDndMoveModal = () => {
  const src = dndSrcKey_pending, dst = dndDstKey_pending;
  if (!src || !dst) return;
  const srcProds = products[src] || [];
  if (!srcProds.length) { dndSrcKey_pending=null; dndDstKey_pending=null; return; }

  document.getElementById('dnd-move-from').textContent = src;
  document.getElementById('dnd-move-to').textContent   = dst;

  const list = document.getElementById('dnd-product-list');
  list.innerHTML = srcProds.map((p,i) => {
    const expiries = getExpiries(p).filter(Boolean).sort();
    const st = productExpiryStatus(p);
    const stBadge = st==='expired' ? '<span style="color:var(--danger);font-size:9px;font-weight:700">VENCIDO</span>'
                  : st==='expiring'? `<span style="color:var(--warn);font-size:9px;font-weight:700">⚠${daysUntil(nearestExpiry(p))}d</span>` : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);">
      <input type="checkbox" id="dndp-${i}" checked style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;">
      <label for="dndp-${i}" style="flex:1;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px">
        <strong style="color:#004499">${p.code}</strong> — ${p.name} ${stBadge}
        <div style="font-size:10px;color:var(--text2)">${p.kg||0}kg${p.entry?' · Entrada:'+p.entry:''}${expiries.length?' · Val:'+expiries.map(fmtDate).join(', '):''}</div>
      </label>
    </div>`;
  }).join('');

  document.getElementById('dnd-move-modal').classList.add('open');
}

const confirmDndMove = () => {
  const src = dndSrcKey_pending, dst = dndDstKey_pending;
  if (!src || !dst) return;
  const srcProds = [...(products[src] || [])];
  const selected = [];
  const remaining = [];
  srcProds.forEach((p, i) => {
    const cb = document.getElementById('dndp-' + i);
    if (cb && cb.checked) selected.push(p);
    else remaining.push(p);
  });
  if (!selected.length) { closeDndMoveModal(); return; }

  // move selected to dest
  if (!products[dst]) products[dst] = [];
  selected.forEach(p => products[dst].push({...p}));
  products[src] = remaining;
  if (!remaining.length) delete products[src];

  logHistory('🔀', `DnD: ${selected.map(p=>p.code).join(',')}`, `${src} → ${dst}`);
  closeDndMoveModal();
  // refresh open modals
  if (document.getElementById('drawer-modal')?.classList.contains('open')) renderDrawerProducts();
  if (fpFocusedShelf) { const sh=shelves.find(s=>s.id===fpFocusedShelf); if(sh) renderFpModalBody(sh); }
  renderAll();
}

const closeDndMoveModal = () => {
  document.getElementById('dnd-move-modal').classList.remove('open');
  dndSrcKey_pending = null; dndDstKey_pending = null;
}

