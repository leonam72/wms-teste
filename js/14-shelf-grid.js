// ╔══════════════════════════════════════════════════════════════════╗
// ║  14-shelf-grid.js        Grade de prateleiras e tabela (sidebar)     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— SHELF GRID ———
const renderShelfGrid = () => {
  const grid = document.getElementById('shelves-grid');
  grid.innerHTML = '';
  shelves.forEach(shelf => {
    const block = document.createElement('div');
    block.className = 'shelf-block';
    // count occupied + expiry stats
    let occupied=0, total=shelf.floors*shelf.drawers;
    let nExpired=0, nExpiring=0, nOk=0, nNoVal=0, nearestDays=null;
    for (let f=1;f<=shelf.floors;f++) for (let d=1;d<=shelf.drawers;d++) {
      const prods = products[drawerKey(shelf.id,f,d)]||[];
      if (prods.length) occupied++;
      prods.forEach(p=>{
        const st = productExpiryStatus(p);
        if(st==='expired') nExpired++;
        else if(st==='expiring') { nExpiring++; const nd=daysUntil(nearestExpiry(p)); if(nd!==null&&(nearestDays===null||nd<nearestDays))nearestDays=nd; }
        else if(st==='ok') nOk++;
        else nNoVal++;
      });
    }
    const occPct = total>0?Math.round((occupied/total)*100):0;
    const occCls = occPct>=90?'var(--danger)':occPct>=60?'var(--warn)':'var(--accent3)';
    let statsHtml='';
    if(nExpired)  statsHtml+=`<span class="shelf-stat-badge ssb-exp">⛔ ${nExpired} vencido${nExpired>1?'s':''}</span>`;
    if(nExpiring) statsHtml+=`<span class="shelf-stat-badge ssb-warn">⚠ ${nExpiring} a vencer${nearestDays!==null?' ('+nearestDays+'d)':''}</span>`;
    if(nOk)       statsHtml+=`<span class="shelf-stat-badge ssb-ok">✓ ${nOk} ok</span>`;
    if(nNoVal)    statsHtml+=`<span class="shelf-stat-badge ssb-noval">— ${nNoVal} sem val.</span>`;
    block.innerHTML = `
      <div class="shelf-block-header" style="align-items:center">
        <div style="flex:1;min-width:0">
          <div class="shelf-block-name">PRATELEIRA ${shelf.id}</div>
          <div style="margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
            <span class="shelf-block-stats">${occupied}/${total} gav.</span>
            ${statsHtml ? statsHtml : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="text-align:right">
            <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:800;color:${occCls};line-height:1">${occPct}%</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--text3);margin-top:1px">ocupação</div>
          </div>
        </div>
      </div>
      <div class="floors" id="floors-${shelf.id}"></div>`;
    grid.appendChild(block);

    const floorsEl = document.getElementById(`floors-${shelf.id}`);
    // shelfIdx: 0=A,2=C,4=E → reversed (highest floor on top)
    //           1=B,3=D,5=F → forward  (lowest floor on top)
    const shelfIdx = shelves.indexOf(shelf);
    const isReversed = shelfIdx % 2 === 0;
    floorsEl.style.flexDirection = isReversed ? 'column-reverse' : 'column';
    for (let f = 1; f <= shelf.floors; f++) {
      const floorEl = document.createElement('div');
      floorEl.className = 'floor';
      floorEl.innerHTML = `<div class="floor-label">${shelf.id}${f}</div><div class="drawers" id="drawers-${shelf.id}-${f}"></div>`;
      floorsEl.appendChild(floorEl);

      const drawersEl = document.getElementById(`drawers-${shelf.id}-${f}`);
      for (let d = 1; d <= shelf.drawers; d++) {
        const key = drawerKey(shelf.id, f, d);
        const prods = products[key] || [];
        const isOccupied = prods.length > 0;
        const isHighlighted = selectedProductCode && prods.some(p => p.code === selectedProductCode);

        const expSt = isOccupied ? drawerExpiryStatus(prods) : 'ok';
        const totalKgDrawer = prods.reduce((s,p) => s + (parseFloat(p.kg)||0), 0);
        const maxKg = shelf.maxKg || 50;
        const capPct = Math.min(100, (totalKgDrawer / maxKg) * 100);
        const capCls = capPct >= 90 ? 'high' : capPct >= 60 ? 'mid' : 'low';

        const dEl = document.createElement('div');
        let cls = 'drawer' + (isOccupied ? ' occupied' : '') + (isHighlighted ? ' highlighted' : '');
        if (expSt === 'expired') cls += ' expired';
        else if (expSt === 'expiring') cls += ' expiring';
        dEl.className = cls;
        dEl.title = key + ' · Clique: focar | Duplo clique: abrir';
        if (isOccupied) {
          const maxShow = 2;
          const shown = prods.slice(0, maxShow);
          const extra = prods.length - maxShow;
          // Find nearest expiry across ALL occurrences of same code in this drawer
          // to decide which copy is the "soonest" one
          const codeExpMap = {};
          prods.forEach(p => {
            const ne = nearestExpiry(p);
            if (!codeExpMap[p.code] || (ne && ne < codeExpMap[p.code])) codeExpMap[p.code] = ne;
          });

          const prodsHtml = shown.map(p => {
            const es = productExpiryStatus(p);
            const ne = nearestExpiry(p);
            const isSoonest = ne && ne === codeExpMap[p.code];
            // count how many of same code are in this drawer
            const sameCount = prods.filter(x => x.code === p.code).length;
            const dot = es !== 'ok' ? `<span class="exp-dot ${es === 'expired' ? 'danger' : 'warn'}"></span>` : '';
            // urgency stripe: if same product appears multiple times, show which is nearest
            const urgencyStyle = (sameCount > 1 && isSoonest && es !== 'ok')
              ? 'background:' + (es === 'expired' ? '#ffd6d6' : '#fff0cc') + ';border-radius:2px;padding:0 2px;'
              : '';
            const urgencyTitle = sameCount > 1 && isSoonest ? ' title="Validade mais próxima"' : '';
            return `<div class="drawer-prod-entry" style="flex-direction:row;align-items:center;gap:2px;${urgencyStyle}"${urgencyTitle}>
              ${dot}<span class="drawer-prod-code">${p.code}</span>
              <span class="drawer-prod-name" style="margin-left:2px">${p.name}</span>
            </div>`;
          }).join('');
          dEl.innerHTML = `
            <div class="drawer-key">${key}</div>
            <div class="drawer-prod-list">${prodsHtml}${extra > 0 ? `<div class="drawer-more">+${extra} mais</div>` : ''}</div>
            <div class="cap-bar-wrap" style="margin-top:auto"><div class="cap-bar ${capCls}" style="width:${capPct}%"></div></div>`;
        } else {
          dEl.innerHTML = `<div class="drawer-key">${key}</div><div class="drawer-empty-label">vazia</div>`;
        }
        dEl.dataset.key = key;
        dEl.onclick = (e) => {
          if (mvState) { mvSelectDest(key); return; }
          setFocusedDrawer(key);
        };
        dEl.ondblclick = (e) => {
          e.stopPropagation();
          openDrawerModal(key, shelf.id, f, d);
        };
        dndInit(dEl, key);
        dEl.addEventListener('mouseenter', ev => showDrawerTooltip(ev, key));
        dEl.addEventListener('mouseleave', hideDrawerTooltip);
        drawersEl.appendChild(dEl);
      }
    }
  });
}

// ——— PRODUCT TABLE ———
const getAllProducts = () => {
  const map = {};
  Object.entries(products).forEach(([key, prods]) => {
    prods.forEach(p => {
      if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [] };
      map[p.code].qty++;
      map[p.code].kg += parseFloat(p.kg) || 0;
      map[p.code].locations.push(key);
    });
  });
  return Object.values(map);
}

// ── Sidebar product list state ──
let sbFilter = '';
let selectedShelfId = null;     // '' | 'expired' | 'expiring' | 'multi' | 'none' | 'missing'
let sbSortCol = 'code';
let sbSortDir = 1;

const setSbFilter = (f) => {
  sbFilter = sbFilter === f ? '' : f;
  // sync chip active states
  ['all','expired','expiring','multi','none','missing'].forEach(k => {
    const el = document.getElementById('sbf-' + k);
    if (el) el.classList.toggle('active', (k === 'all' && sbFilter === '') || k === sbFilter);
  });
  renderProductTable();
}

const setSbSort = (col) => {
  if (sbSortCol === col) sbSortDir = -sbSortDir;
  else { sbSortCol = col; sbSortDir = 1; }
  // update header indicators
  ['code','name','qty','status'].forEach(c => {
    const th = document.getElementById('sbth-' + c);
    if (!th) return;
    th.classList.remove('sort-asc','sort-desc');
    if (c === sbSortCol) th.classList.add(sbSortDir === 1 ? 'sort-asc' : 'sort-desc');
  });
  renderProductTable();
}

const getAllProductsDetail2 = () => {
  // Like getAllProductsDetail but also enriches with status/nearest for sidebar
  const map = {};
  Object.entries(products).forEach(([key, prods]) => {
    prods.forEach(p => {
      if (!map[p.code]) map[p.code] = { code: p.code, name: p.name, qty: 0, kg: 0, locations: [], allExpiries: [], entries: [] };
      const rec = map[p.code];
      rec.qty++;
      rec.kg += parseFloat(p.kg) || 0;
      if (!rec.locations.includes(key)) rec.locations.push(key);
      if (p.entry) rec.entries.push(p.entry);
      if (p.expiryControl!=='no') getExpiries(p).filter(Boolean).forEach(d => { if (!rec.allExpiries.includes(d)) rec.allExpiries.push(d); });
      // merge extended fields (take first non-empty)
      ['ean','sku','category','supplier','unit','lot','perishable','cost','price'].forEach(f=>{ if(!rec[f]&&p[f]) rec[f]=p[f]; });
    });
  });
  return Object.values(map).map(r => {
    r.allExpiries.sort();
    r.nearest = r.nearest || r.allExpiries[0] || null;
    r.statusKey = r.nearest ? expiryStatus(r.nearest) : 'none';
    return r;
  });
}

const renderProductTable = () => {
  if (focusedDrawerKey) { renderFocusPanel(); return; }

  const q = (document.getElementById('product-search-input')?.value || '').toLowerCase();
  let prods = getAllProductsDetail2();

  // text filter
  if (q) prods = prods.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));

  // chip filter
  if (sbFilter === 'expired')  prods = prods.filter(p => p.statusKey === 'expired');
  else if (sbFilter === 'expiring') prods = prods.filter(p => p.statusKey === 'expiring');
  else if (sbFilter === 'multi')    prods = prods.filter(p => p.locations.length > 1);
  else if (sbFilter === 'none')     prods = prods.filter(p => p.statusKey === 'none');
  else if (sbFilter === 'missing')  prods = prods.filter(p => p.qty === 0); // shouldn't happen normally

  // sort
  prods.sort((a, b) => {
    let va = a[sbSortCol], vb = b[sbSortCol];
    if (sbSortCol === 'status') { va = a.statusKey; vb = b.statusKey; }
    if (va === undefined) va = '';
    if (vb === undefined) vb = '';
    if (typeof va === 'number') return (va - vb) * sbSortDir;
    return va.toString().localeCompare(vb.toString()) * sbSortDir;
  });

  const tbody = document.getElementById('product-table-body');
  if (!tbody) return;

  if (!prods.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="font-size:10px">Nenhum produto</td></tr>`;
    return;
  }

  // sidebar cell definitions
  const _sbCells = {
    code:   p => { let x=''; if(p.locations.length>1)x+=`<span class="xref-badge xref-multi">${p.locations.length}L</span>`; if(p.statusKey==='expired')x+=`<span class="xref-badge xref-expired">V!</span>`; else if(p.statusKey==='expiring')x+=`<span class="xref-badge xref-expiring">${daysUntil(p.nearest)}d</span>`; return `<td class="td-code" style="font-size:10px">${p.code}${x}</td>`; },
    name:   p => `<td style="font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.name}">${p.name}</td>`,
    qty:    p => `<td class="td-qty" style="font-size:10px">${p.qty}</td>`,
    status: p => { const ic=p.statusKey==='expired'?'🔴':p.statusKey==='expiring'?'🟡':p.statusKey==='ok'?'🟢':'⚪'; return `<td style="text-align:center;font-size:11px" title="${p.nearest?fmtDate(p.nearest):'Sem validade'}">${ic}</td>`; },
  };
  // update header order to match sbColOrder
  sbColOrder.forEach(k => {
    const th = document.getElementById('sbth-'+k);
    if (th && th.parentElement) th.parentElement.appendChild(th);
  });
  tbody.innerHTML = prods.map(p => {
    const isSelected = p.code === selectedProductCode;
    const rowCls = isSelected ? 'selected' : p.statusKey === 'expired' ? 'row-expired' : p.statusKey === 'expiring' ? 'row-expiring' : '';
    return `<tr class="${rowCls}" onclick="selectProduct('${p.code}')">${sbColOrder.map(k => _sbCells[k] ? _sbCells[k](p) : '<td>—</td>').join('')}</tr>`;
  }).join('');
}

const renderFocusPanel = () => {
  // focus panel elements no longer in sidebar HTML — skip gracefully
  const prods = products[focusedDrawerKey] || [];
  const list = document.getElementById('focus-prod-list');
  if (!list) return;

  if (!list) return;
  if (!prods.length) {
    list.innerHTML = '<div class="empty-msg">Gaveta vazia</div>';
    return;
  }

  list.innerHTML = prods.map((p, i) => {
    const es = productExpiryStatus(p);
    const ne = nearestExpiry(p);
    const expiries = getExpiries(p).filter(Boolean).sort();
    const expLabel = ne ? (es === 'expired' ? '<span style="color:var(--danger);font-weight:700">VENCIDO</span>' : es === 'expiring' ? '<span style="color:var(--warn);font-weight:700">⚠ ' + daysUntil(ne) + 'd</span>' : fmtDate(ne)) : '—';
    const bg = es === 'expired' ? 'background:#fff0f0' : es === 'expiring' ? 'background:#fff8ee' : '';
    return `<div class="focus-prod-item" draggable="true"
        data-idx="${i}" data-from="${focusedDrawerKey}"
        style="${bg}"
        ondragstart="onDragStart(event,${i},'${focusedDrawerKey}')"
        ondragend="onDragEnd(event)">
      <div class="focus-prod-code">${p.code}</div>
      <div class="focus-prod-info">
        <div class="focus-prod-name">${p.name}</div>
        <div class="focus-prod-meta">${p.kg ? p.kg+'kg' : ''} · Val: ${expLabel}${expiries.length > 1 ? ' <span style="color:var(--accent);font-size:9px">+' + (expiries.length-1) + '</span>' : ''}</div>
      </div>
      <span style="font-size:14px;color:var(--text3)" title="Arraste para mover">⠿</span>
    </div>`;
  }).join('');
}

const selectProduct = (code) => {
  selectedProductCode = selectedProductCode === code ? null : code;
  renderAll();
  if (selectedProductCode) {
    // find first drawer that has this product and scroll to it
    requestAnimationFrame(() => {
      const target = document.querySelector(`.drawer.highlighted[data-key]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // brief extra pulse to catch the eye
        target.style.outline = '2px solid var(--accent)';
        setTimeout(() => { target.style.outline = ''; }, 1200);
      }
    });
  }
}

