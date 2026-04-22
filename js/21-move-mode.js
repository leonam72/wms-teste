// ╔══════════════════════════════════════════════════════════════════╗
// ║  21-move-mode.js         State machine de mover produto              ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— MOVE PRODUCT ———
// ══ MOVE MODE STATE MACHINE ══════════════════════════════════════════
let mvState = null;
// { prodIdx, srcKey, product, destKey }

const openMoveModal = (prodIdx) => {
  const p = (products[currentDrawerKey] || [])[prodIdx];
  if (!p) return;

  mvState = { prodIdx, srcKey: currentDrawerKey, product: p, destKey: null };

  // close the drawer modal — we'll highlight the entire grid
  closeDrawerModal();
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open')) closeFpModal();

  // activate move mode
  document.getElementById('move-mode-banner').classList.add('active');
  document.getElementById('move-banner-text').textContent =
    `Movendo: ${p.code} — ${p.name} · de ${mvState.srcKey}`;
  document.body.classList.add('move-mode');

  // highlight drawers
  applyMoveHighlights();
}

const applyMoveHighlights = () => {
  if (!mvState) return;
  const src = mvState.srcKey;
  // highlight in depot grid
  document.querySelectorAll('.drawer[data-key]').forEach(el => {
    const key = el.dataset.key;
    el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
    if (key === src) { el.classList.add('mv-source'); return; }
    const prods = products[key] || [];
    if (prods.length === 0) el.classList.add('mv-empty');
    else el.classList.add('mv-has-room');
    el.onclick = (e) => { e.stopPropagation(); mvSelectDest(key); };
  });
  // if floor plan modal open, highlight there too
  if (document.getElementById('fp-shelf-modal')?.classList.contains('open')) {
    document.querySelectorAll('#fp-modal-body .drawer[data-key]').forEach(el => {
      const key = el.dataset.key;
      el.classList.remove('mv-empty','mv-has-room','mv-source');
      if (key === src) { el.classList.add('mv-source'); return; }
      const prods = products[key] || [];
      el.classList.add(prods.length === 0 ? 'mv-empty' : 'mv-has-room');
      el.onclick = (e) => { e.stopPropagation(); mvSelectDest(key); };
    });
  }
}

const mvSelectDest = (destKey) => {
  if (!mvState) return;
  mvState.destKey = destKey;
  const p = mvState.product;
  const expiries = getExpiries(p).filter(Boolean).sort();

  // fill confirm modal
  document.getElementById('cm-product').textContent = `${p.code} — ${p.name}`;
  document.getElementById('cm-from').textContent = mvState.srcKey;
  document.getElementById('cm-to').textContent = destKey;

  // expiry selection
  const expSection = document.getElementById('cm-expiry-section');
  const expList = document.getElementById('cm-expiry-list');
  if (expiries.length > 0) {
    expSection.style.display = 'block';
    expList.innerHTML = expiries.map((d, i) => {
      const st = expiryStatus(d);
      const stLabel = st === 'expired' ? ' 🔴 VENCIDA' : st === 'expiring' ? ' 🟡 A VENCER' : ' 🟢 OK';
      return `<div class="cm-expiry-row">
        <input type="checkbox" id="cmexp-${i}" value="${d}" checked>
        <label for="cmexp-${i}" style="cursor:pointer">${fmtDate(d)}${stLabel}</label>
      </div>`;
    }).join('');
  } else {
    expSection.style.display = 'none';
  }

  document.getElementById('move-confirm-modal').classList.add('open');
}

const executeMoveConfirmed = () => {
  if (!mvState || !mvState.destKey) return;
  const { prodIdx, srcKey, destKey, product: p } = mvState;

  // get selected expiries
  const expiries = getExpiries(p).filter(Boolean).sort();
  let movedExpiries = expiries; // default: all
  if (expiries.length > 0) {
    movedExpiries = [];
    document.querySelectorAll('#cm-expiry-list input[type=checkbox]').forEach(cb => {
      if (cb.checked) movedExpiries.push(cb.value);
    });
  }

  // remove from source
  const srcProds = products[srcKey] || [];
  srcProds.splice(prodIdx, 1);
  if (!srcProds.length) delete products[srcKey];

  // add to dest with only selected expiries
  if (!products[destKey]) products[destKey] = [];
  products[destKey].push({ ...p, expiries: movedExpiries });

  // if some expiries were NOT moved, keep product at source with remaining
  const remainingExp = expiries.filter(d => !movedExpiries.includes(d));
  if (remainingExp.length > 0) {
    if (!products[srcKey]) products[srcKey] = [];
    products[srcKey].push({ ...p, expiries: remainingExp });
  }

  logHistory('🔀', `Movido: ${p.code} — ${p.name}`,
    `${srcKey} → ${destKey}${remainingExp.length ? ' ('+movedExpiries.length+' val. de '+expiries.length+')' : ''}`);

  cancelMoveMode();
  renderAll();
}

const cancelMoveMode = () => {
  // close confirm modal
  document.getElementById('move-confirm-modal').classList.remove('open');
  // remove banner
  document.getElementById('move-mode-banner').classList.remove('active');
  document.body.classList.remove('move-mode');
  // remove all move highlights and restore onclick
  document.querySelectorAll('.drawer[data-key]').forEach(el => {
    el.classList.remove('mv-empty','mv-has-room','mv-full','mv-source');
    const key = el.dataset.key;
    // restore original onclick
    el.onclick = (e) => { e.stopPropagation(); openDrawerModal(key); };
  });
  mvState = null;
}

// hook ESC to also cancel move mode




// ——— SEED HISTORY ———
history = [
  { ts: new Date(Date.now() - 3600000*0.5).toISOString(), icon: '📥', action: 'Entrada: Q017 — Pano Microfibra',       detail: 'D4.G3 · 0.06kg · Entrada: 2025-03-20' },
  { ts: new Date(Date.now() - 3600000*1  ).toISOString(), icon: '⚠',  action: 'ALERTA: Q015 Acetona 500ml — VENCIDA', detail: 'D4.G1 · val: 2025-03-10' },
  { ts: new Date(Date.now() - 3600000*2  ).toISOString(), icon: '📥', action: 'Entrada: Q012 — Spray Dielétrico',      detail: 'D2.G2 · 0.28kg · val: 2026-03-10' },
  { ts: new Date(Date.now() - 3600000*4  ).toISOString(), icon: '🔀', action: 'Movido: E011 — Lâmpada LED 9W',        detail: 'B3.G1 → B2.G1' },
  { ts: new Date(Date.now() - 3600000*6  ).toISOString(), icon: '📥', action: 'Entrada: E001 — Cabo PP 2x1.5mm',      detail: 'B4.G2 · 2.0kg (3ª localização)' },
  { ts: new Date(Date.now() - 86400000*1 ).toISOString(), icon: '📥', action: 'Entrada: H001 — Cano PVC 1/2"',        detail: 'C5.G1 · 0.90kg (overflow A→C)' },
  { ts: new Date(Date.now() - 86400000*1 ).toISOString(), icon: '⚠',  action: 'ALERTA: Q009 Veda Rosca — VENCIDA',   detail: 'C2.G1 · val: 2025-02-20' },
  { ts: new Date(Date.now() - 86400000*2 ).toISOString(), icon: '📥', action: 'Entrada: Q004 — Fita Isolante lote2',  detail: 'A2.G1 · val: 2025-04-10, 2025-09-30' },
  { ts: new Date(Date.now() - 86400000*2 ).toISOString(), icon: '🔀', action: 'Movido: Q010 — Silicone Branco',       detail: 'C2.G2 → C2.G3 (overflow)' },
  { ts: new Date(Date.now() - 86400000*3 ).toISOString(), icon: '📥', action: 'Entrada: P001 — Parafuso M6x20 lote3', detail: 'A1.G3 · 0.6kg (3ª localização)' },
  { ts: new Date(Date.now() - 86400000*4 ).toISOString(), icon: '📤', action: 'Saída: Q004 — Fita Isolante VENCIDA',  detail: 'Lote removido de A2.G1 (vencido 2025-02-28)' },
  { ts: new Date(Date.now() - 86400000*5 ).toISOString(), icon: '📥', action: 'Entrada: D3.G2 — Tinta Spray Preta',   detail: 'D3.G2 · 2 lotes, val: 2025-04-08 e 2025-04-30' },
  { ts: new Date(Date.now() - 86400000*6 ).toISOString(), icon: '📥', action: 'Entrada: P012 — Caixa Rebite Sortido', detail: 'A6.G2 · 35kg · ocupação crítica!' },
  { ts: new Date(Date.now() - 86400000*7 ).toISOString(), icon: '🔀', action: 'Movido: E003 — Disjuntor 10A',         detail: 'B1.G2 → B3.G3 (reorganização)' },
  { ts: new Date(Date.now() - 86400000*10).toISOString(), icon: '📥', action: 'Entrada: Q001 — WD-40 300ml lote2',    detail: 'D1.G1 · val: 2026-07-10, 2027-01-10' },
  { ts: new Date(Date.now() - 86400000*12).toISOString(), icon: '📤', action: 'Saída: Q012 — Spray Dielétrico',       detail: 'B6.G1 — lote vencido detectado e removido' },
];

init();

