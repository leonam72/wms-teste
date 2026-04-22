// ═══════════════════════════════════════════════════════════
// MODULE: floorplan.js
// ═══════════════════════════════════════════════════════════

// ══ FLOOR PLAN ════════════════════════════════════════════════════════

// ─── State ────────────────────────────────────────────────────────────
let fpLayout   = {};      // { shelfId: {x,y} }
let fpObjects  = [];      // [{ id,type,style,text,x,y,w,h }]
let fpEditMode = false;
let fpSnapOn   = false;
const FP_GRID  = 40;
const FP_CARD_W = 140;
let fpObjIdSeq  = 0;
let fpSnapshot  = null;
let fpUndoStack = [];   // array of {layout, objects, objSeq} snapshots
let fpRedoStack = [];   // redo stack
const FP_MAX_HISTORY = 50;

function fpHistoryPush() {
  // push current state onto undo stack
  fpUndoStack.push(structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq, shelvesAll }));
  if (fpUndoStack.length > FP_MAX_HISTORY) fpUndoStack.shift();
  fpRedoStack = []; // any new action clears redo
  fpUpdateUndoButtons();
}

function fpUndo() {
  if (!hasPermission('layout.edit')) return;
  if (!fpUndoStack.length) return;
  // push current to redo
  fpRedoStack.push(structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq, shelvesAll }));
  const prev = fpUndoStack.pop();
  fpLayout   = prev.layout   || {};
  fpObjects  = prev.objects  || [];
  fpObjIdSeq = prev.objSeq   || 0;
  if (prev.shelvesAll) {
    shelvesAll = prev.shelvesAll;
    // update shims
    shelves = shelvesAll[activeDepotId] || [];
    products = productsAll[activeDepotId] || {};
  }
  fpUpdateUndoButtons();
  renderFloorPlan();
}

function fpRedo() {
  if (!hasPermission('layout.edit')) return;
  if (!fpRedoStack.length) return;
  fpUndoStack.push(structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq, shelvesAll }));
  const next = fpRedoStack.pop();
  fpLayout   = next.layout   || {};
  fpObjects  = next.objects  || [];
  fpObjIdSeq = next.objSeq   || 0;
  if (next.shelvesAll) {
    shelvesAll = next.shelvesAll;
    // update shims
    shelves = shelvesAll[activeDepotId] || [];
    products = productsAll[activeDepotId] || {};
  }
  fpUpdateUndoButtons();
  renderFloorPlan();
}

function fpUpdateUndoButtons() {
  const undoBtn = document.getElementById('fp-undo-btn');
  const redoBtn = document.getElementById('fp-redo-btn');
  if (undoBtn) { undoBtn.disabled = fpUndoStack.length === 0; undoBtn.style.opacity = fpUndoStack.length?'1':'.35'; }
  if (redoBtn) { redoBtn.disabled = fpRedoStack.length === 0; redoBtn.style.opacity = fpRedoStack.length?'1':'.35'; }
}

let fpFocusedShelf = null;
let fpFocusedDepotId = null;
let fpRenderShelfMap = {};
let fpScale     = 1;
let fpSearchQuery  = '';
let fpSearchFilter = '';

// drag: kind = 'shelf'|'obj'|'pan'
let fpDrag     = null;
let fpResizing = null;

// ── Multi-select state ──
let fpSelection = new Set(); // Set of { kind:'shelf'|'obj', id:string }
let fpLasso     = null;      // { startX, startY, x, y, w, h } in world coords

// active placement tool
let fpActiveTool = null; // null | 'textbox'|'street'|'blocked'|'zone'|'entry'

// ─── Object z-index rules ─────────────────────────────────────────────
// street  → z=1  (bottom)
// zone    → z=2  (above streets)
// textbox → z=3  (labels)
// shelf   → z=4  (above zones)
// blocked → z=5  (above everything, blocks shelves)
// entry   → z=5  (same as blocked, blocks shelves)
const FP_OBJ_Z = { street:1, zone:2, textbox:3, blocked:5, entry:5 };
const SHELF_Z  = 4;

// Objects that prevent shelves from overlapping
function fpIsBlocker(obj) { return obj.type==='blocked' || obj.type==='entry' || obj.type==='street'; }
// Objects that zone-allow (shelf can sit on top visually)
function fpIsUnder(obj)   { return obj.type==='zone' || obj.type==='street' || obj.type==='textbox'; }

// ─── Sizing helpers ───────────────────────────────────────────────────
function fpCardH(shelf) { return 100; } // fp-shelf-card is always ~100px tall (compact summary)
function fpSnap(v) { return fpSnapOn ? Math.round(v/FP_GRID)*FP_GRID : v; }

// ─── Coordinate helpers ───────────────────────────────────────────────
function fpS2W(sx, sy) {
  const c = document.getElementById('fp-canvas');
  if (!c) return {x:0,y:0};
  const r = c.getBoundingClientRect();
  return { x:(sx-r.left+c.scrollLeft)/fpScale, y:(sy-r.top+c.scrollTop)/fpScale };
}

// ─── Collision ────────────────────────────────────────────────────────
function fpRects(a, b) {
  return a.x+a.w > b.x && b.x+b.w > a.x && a.y+a.h > b.y && b.y+b.h > a.y;
}
function fpCollidesShelf(shelfId, tx, ty, shList) {
  const shelf = shList.find(s=>s.id===shelfId); if (!shelf) return false;
  const sr = {x:tx, y:ty, w:FP_CARD_W, h:fpCardH(shelf)};
  // blockers (blocked + entry)
  for (const o of fpObjects)
    if (fpIsBlocker(o) && fpRects(sr, {x:o.x,y:o.y,w:o.w,h:o.h})) return true;
  // other shelves
  for (const s of shList) {
    if (s.id===shelfId) continue;
    const sp = fpLayout[getScopedShelfId(s.id, activeDepotId)]; if (!sp) continue;
    if (fpRects(sr, {x:sp.x,y:sp.y,w:FP_CARD_W,h:fpCardH(s)})) return true;
  }
  return false;
}
function fpCollides(shelfId, tx, ty) {
  const did = fpGetViewDepotId();
  const sl  = did ? (shelvesAll[did]||[]) : Object.values(shelvesAll).flat();
  return fpCollidesShelf(shelfId, tx, ty, sl);
}

// ─── Zoom & transform ─────────────────────────────────────────────────
function fpApplyTransform() {
  const inner = document.getElementById('fp-canvas-inner');
  if (inner) {
    const W = 6000, H = 4000;
    inner.style.width  = (W * fpScale) + 'px';
    inner.style.height = (H * fpScale) + 'px';
    inner.style.transform = `scale(${fpScale})`;
    inner.style.transformOrigin = '0 0';
  }
  const p = document.getElementById('fp-zoom-pct');
  if (p) p.textContent = Math.round(fpScale*100)+'%';
}
function fpZoom(delta, cx, cy) {
  const c = document.getElementById('fp-canvas'); if (!c) return;
  const ns = Math.max(0.15, Math.min(3, fpScale+delta)); if (ns===fpScale) return;
  const r = c.getBoundingClientRect();
  const px = (cx!=null ? cx-r.left : r.width/2);
  const py = (cy!=null ? cy-r.top  : r.height/2);
  // world point under cursor before scale change
  const wx = (c.scrollLeft + px) / fpScale;
  const wy = (c.scrollTop  + py) / fpScale;
  fpScale = ns;
  fpApplyTransform();
  // scroll so same world point stays under cursor
  requestAnimationFrame(() => {
    c.scrollLeft = wx * fpScale - px;
    c.scrollTop  = wy * fpScale - py;
  });
}
function fpZoomReset() {
  const c = document.getElementById('fp-canvas'); if (!c) return;
  fpScale=1; fpApplyTransform();
  requestAnimationFrame(() => { c.scrollLeft=0; c.scrollTop=0; });
}

// ─── Edit mode ────────────────────────────────────────────────────────
function fpEnterEditMode() {
  if (!hasPermission('layout.edit')) return;
  if (fpShowAllDepots) {
    showNotice({
      title: 'EDIÇÃO BLOQUEADA',
      icon: '⛔',
      desc: 'Edite a planta baixa de um depósito por vez. Selecione um depósito específico antes de entrar em modo de edição.',
    });
    return;
  }
  fpEditMode = true;
  fpUndoStack = []; fpRedoStack = [];
  fpSnapshot = structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq });
  document.getElementById('fp-view-tools').style.display = 'none';
  document.getElementById('fp-edit-tools').style.display = 'flex';
  document.getElementById('fp-canvas')?.classList.add('edit-mode');
  renderFloorPlan();
}
async function fpExitEditMode() {
  if (!hasPermission('layout.edit')) return;
  fpCancelTool();
  fpEditMode = false; fpDrag = null; fpResizing = null;
  document.getElementById('fp-view-tools').style.display = 'flex';
  document.getElementById('fp-edit-tools').style.display = 'none';
  document.getElementById('fp-canvas')?.classList.remove('edit-mode');
  await fpSaveLayout();
  fpSnapshot = structuredClone({ layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq });
  renderFloorPlan();
}
function fpToggleSnap() {
  if (!hasPermission('layout.edit')) return;
  fpSnapOn = !fpSnapOn;
  const b = document.getElementById('fp-snap-btn');
  if (b) { b.textContent='⊞ SNAP:'+(fpSnapOn?'ON':'OFF'); b.classList.toggle('active',fpSnapOn); }
  document.getElementById('page-floorplan')?.classList.toggle('fp-snap-on', fpSnapOn);
}

// ─── Tool selection & placement ───────────────────────────────────────
const FP_OBJ_DEF = {
  textbox: {w:120,h:44, text:'TEXTO',          style:'label' },
  street:  {w:360,h:60, text:'RUA / CORREDOR',  style:'street'},
  blocked: {w:160,h:120,text:'BLOQUEADO',        style:'block' },
  zone:    {w:200,h:160,text:'ZONA',             style:'zone'  },
  entry:   {w:100,h:50, text:'🚪 ENTRADA/SAÍDA', style:'entry' },
};

function fpSelectTool(type) {
  if (!hasPermission('layout.edit')) return;
  if (fpActiveTool===type) { fpCancelTool(); return; }
  fpActiveTool = type;
  // update button states
  Object.keys(FP_OBJ_DEF).forEach(t => {
    const b = document.getElementById('fptool-'+t);
    if (b) b.classList.toggle('placing-active', t===type);
  });
  document.getElementById('fp-canvas')?.classList.add('placing');
  // prepare preview element
  _fpUpdatePreview(type);
}

function fpCancelTool() {
  fpActiveTool = null;
  Object.keys(FP_OBJ_DEF).forEach(t => document.getElementById('fptool-'+t)?.classList.remove('placing-active'));
  document.getElementById('fp-canvas')?.classList.remove('placing');
  const prev = document.getElementById('fp-place-preview');
  if (prev) prev.style.display = 'none';
}

function _fpUpdatePreview(type) {
  const prev = document.getElementById('fp-place-preview');
  if (!prev) return;
  const d = FP_OBJ_DEF[type];
  // apply correct classes
  const typeClass = type==='street' ? 'fp-street'
                  : type==='blocked'? 'fp-blocked'
                  : 'fp-textbox style-'+d.style;
  prev.className = typeClass;
  prev.id = 'fp-place-preview'; // keep id
  prev.style.width  = d.w+'px';
  prev.style.height = d.h+'px';
  prev.style.display= 'none';
  prev.textContent  = d.text;
}

function fpMovePreview(sx, sy) {
  if (!fpActiveTool) return;
  const prev = document.getElementById('fp-place-preview');
  if (!prev) return;
  const c = document.getElementById('fp-canvas');
  // check if mouse is over canvas
  const hit = document.elementFromPoint(sx, sy);
  if (!c || !c.contains(hit)) { prev.style.display='none'; return; }
  const d = FP_OBJ_DEF[fpActiveTool];
  // snap in world coords, convert back to screen for display
  const w  = fpS2W(sx, sy);
  const nx = fpSnap(w.x), ny = fpSnap(w.y);
  const r  = c.getBoundingClientRect();
  // screen position of snapped world point
  const screenX = (nx * fpScale) - c.scrollLeft + r.left;
  const screenY = (ny * fpScale) - c.scrollTop  + r.top;
  prev.style.left    = screenX + 'px';
  prev.style.top     = screenY + 'px';
  prev.style.width   = (d.w * fpScale) + 'px';
  prev.style.height  = (d.h * fpScale) + 'px';
  prev.style.display = 'flex';
}

function fpPlaceObject(wx, wy) {
  if (!fpActiveTool || !fpEditMode) return;
  fpHistoryPush();
  const type = fpActiveTool;
  const d    = FP_OBJ_DEF[type];
  const obj  = {
    id:'obj'+(++fpObjIdSeq), type, style:d.style, text:d.text,
    x:fpSnap(wx), y:fpSnap(wy), w:d.w, h:d.h
  };
  fpObjects.push(obj);
  fpCancelTool();
  renderFloorPlan();
}

// ─── Auto-place helper ────────────────────────────────────────────────
function fpAutoPlace(shelf) {
  const did = fpGetViewDepotId();
  const sl  = did ? (shelvesAll[did]||[]) : Object.values(shelvesAll).flat();
  for (let r=0; r<20; r++) for (let c=0; c<10; c++) {
    const tx=fpSnap(40+c*(FP_CARD_W+20)), ty=fpSnap(40+r*300);
    if (!fpCollidesShelf(shelf.id,tx,ty,sl)) return {x:tx,y:ty};
  }
  return {x:40, y:40};
}

// ─── Rename helper (view + edit mode) ────────────────────────────────
async function fpRenameObject(objId) {
  const obj = fpObjects.find(o=>o.id===objId); if (!obj) return;
  const t = await showTextPrompt({
    title: 'RENOMEAR ELEMENTO',
    label: 'TEXTO',
    value: obj.text,
    placeholder: 'Novo rótulo',
    okLabel: 'SALVAR',
    maxLength: 80,
  });
  if (t === null) return;
  const next = sanitizeTextInput(t, { maxLength: 80 }) || obj.text;
  obj.text = next;
  const lbl = document.querySelector(`[data-obj-id="${objId}"] .fp-obj-lbl`);
  if (lbl) lbl.textContent = obj.text;
  else renderFloorPlan();
}

function getFloorPlanShelfViews() {
  if (!fpShowAllDepots) {
    const depotId = fpGetViewDepotId();
    return (shelvesAll[depotId] || []).map(shelf => ({
      shelf,
      depotId,
      viewKey: `${depotId}::${shelf.id}`,
      pos: fpLayout[getScopedShelfId(shelf.id, depotId)] || fpAutoPlace(shelf),
      positionMode: 'saved',
    }));
  }

  const views = [];
  let yOffset = 60;
  depots.forEach(depot => {
    const depotShelves = shelvesAll[depot.id] || [];
    const depotViews = depotShelves.map(shelf => {
      const scopedId = getScopedShelfId(shelf.id, depot.id);
      const saved = fpLayout[scopedId] || fpAutoPlace(shelf);
      return {
        shelf,
        depotId: depot.id,
        viewKey: `${depot.id}::${shelf.id}`,
        rawPos: saved,
      };
    });
    const minX = depotViews.length ? Math.min(...depotViews.map(view => view.rawPos.x)) : 0;
    const minY = depotViews.length ? Math.min(...depotViews.map(view => view.rawPos.y)) : 0;
    const maxY = depotViews.length ? Math.max(...depotViews.map(view => view.rawPos.y + fpCardH(view.shelf))) : 0;
    const headerTop = yOffset - 42;
    depotViews.forEach(view => {
      views.push({
        shelf: view.shelf,
        depotId: view.depotId,
        viewKey: view.viewKey,
        pos: {
          x: fpSnap(40 + (view.rawPos.x - minX)),
          y: fpSnap(yOffset + (view.rawPos.y - minY)),
        },
        headerTop,
        positionMode: 'saved',
      });
    });
    yOffset += Math.max(220, maxY - minY + 90) + 70;
  });
  return views;
}

// ─── Main render ──────────────────────────────────────────────────────
function renderFloorPlan() {
  const inner = document.getElementById('fp-canvas-inner');
  if (!inner) return;

  const shelfViews = getFloorPlanShelfViews();
  fpRenderShelfMap = Object.fromEntries(shelfViews.map(view => [view.viewKey, view]));

  // auto-place new shelves in single-depot mode
  shelfViews.forEach(view => {
    const scopedId = getScopedShelfId(view.shelf.id, view.depotId);
    if (view.positionMode === 'saved' && !fpLayout[scopedId]) fpLayout[scopedId] = fpAutoPlace(view.shelf);
  });
  // clean up removed shelves
  const allShelfIds = new Set(depots.flatMap(depot => (shelvesAll[depot.id] || []).map(shelf => getScopedShelfId(shelf.id, depot.id))));
  Object.keys(fpLayout).forEach(id => { if (!allShelfIds.has(id)) delete fpLayout[id]; });

  inner.innerHTML = '';
  fpApplyTransform();
  // selection re-applied after DOM rebuild
  requestAnimationFrame(_fpApplySelectionClass);

  // ── 1. Objects (sorted by z-index so lower ones render first) ──
  const sortedObjs = [...fpObjects].sort((a,b) => (FP_OBJ_Z[a.type]||3) - (FP_OBJ_Z[b.type]||3));

  sortedObjs.forEach(obj => {
    const z = FP_OBJ_Z[obj.type] || 3;
    const typeClass = obj.type==='street' ? 'fp-street'
                    : obj.type==='blocked'? 'fp-blocked'
                    : 'fp-textbox style-'+obj.style;

    const el = document.createElement('div');
    el.className = 'fp-object '+typeClass+(fpEditMode?' fp-edit-mode-item':'');
    el.style.cssText = `left:${obj.x}px;top:${obj.y}px;width:${obj.w}px;height:${obj.h}px;`
                     + `z-index:${z};position:absolute;box-sizing:border-box;`;
    el.dataset.objId = obj.id;

    // label (bottom-left)
    const lbl = document.createElement('span');
    lbl.className = 'fp-obj-lbl';
    lbl.textContent = obj.text;
    lbl.style.cssText = 'position:absolute;bottom:5px;left:7px;right:7px;'
      +'font-family:IBM Plex Mono,monospace;font-size:11px;font-weight:700;'
      +'pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    el.appendChild(lbl);

    // ─── Double-click to rename (BOTH modes) ───
    el.addEventListener('dblclick', ev => {
      ev.stopPropagation(); ev.preventDefault();
      if (fpActiveTool) return;
      fpRenameObject(obj.id);
    });

    if (fpEditMode) {
      // Close button
      const cb = document.createElement('button');
      cb.className = 'fp-obj-close'; cb.textContent = '×'; cb.style.display='flex';
      cb.onclick = ev => { ev.stopPropagation(); fpObjects=fpObjects.filter(o=>o.id!==obj.id); renderFloorPlan(); };
      el.appendChild(cb);

      // Resize handle
      const rh = document.createElement('div');
      rh.className = 'fp-obj-handle'; rh.style.opacity='0.8';
      rh.addEventListener('mousedown', ev => {
        ev.stopPropagation(); ev.preventDefault();
        fpResizing = {el, obj, startX:ev.clientX, startY:ev.clientY, startW:obj.w, startH:obj.h};
      });
      el.appendChild(rh);

      // Drag (only in edit mode)
      el.addEventListener('mousedown', ev => {
        if (ev.target===rh || ev.target===cb) return;
        if (fpActiveTool) return;
        ev.preventDefault(); ev.stopPropagation();
        fpToggleSelect('obj', obj.id, ev.ctrlKey||ev.metaKey);
        const w = fpS2W(ev.clientX, ev.clientY);
        if(fpSelHas('obj',obj.id) && fpSelection.size>1){
          const selItems=[];
          fpSelection.forEach(key=>{
            const [kind,id2]=fpSelParse(key);
            if(kind==='shelf'){const p2=fpLayout[id2];if(p2)selItems.push({kind,id:id2,ox:w.x-p2.x,oy:w.y-p2.y,lastX:p2.x,lastY:p2.y});}
            else{const o2=fpObjects.find(o3=>o3.id===id2);if(o2)selItems.push({kind,id:id2,ox:w.x-o2.x,oy:w.y-o2.y,lastX:o2.x,lastY:o2.y});}
          });
          fpDrag={kind:'multi',el,items:selItems};
        } else {
          fpDrag={kind:'obj', id:obj.id, el, offX:w.x-obj.x, offY:w.y-obj.y};
        }
        el._wasDrag = false;
      });
    }

    inner.appendChild(el);
  });

  // ── 2. Depot dividers (all-depots mode) ──
  if (fpShowAllDepots) {
    depots.forEach((dep, di) => {
      const depotViews = shelfViews.filter(view => view.depotId === dep.id);
      if (!depotViews.length && di > 0) return;
      const top = depotViews[0]?.headerTop ?? 18;
      const div = document.createElement('div');
      div.style.cssText = `position:absolute;left:0;right:0;top:${top}px;`
        +`pointer-events:none;z-index:0;min-height:60px;`;
      div.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:800;`
        +`color:var(--accent);padding:8px 16px;background:rgba(0,102,204,.06);`
        +`border-bottom:2px solid var(--accent);${di>0?'border-top:3px solid var(--border);':''}">`
        +`${escapeHtml(dep.name)}</div>`;
      inner.appendChild(div);
    });
  }

  // ── 3. Shelf cards ──
  shelfViews.forEach(view => {
    const s = view.shelf;
    const depotId = view.depotId;
    const pos = view.pos;
    const fp = productsAll[depotId] || {};
    let occ=0, total=s.floors*s.drawers, expN=0, wrnN=0, totalKg=0;
    let movementScore = 0;
    const skus=new Set();
    for (let f=1;f<=s.floors;f++) for (let d=1;d<=s.drawers;d++) {
      const prods=fp[drawerKey(s.id,f,d)]||[];
      if(prods.length)occ++;
      prods.forEach(p=>{
        skus.add(p.code); totalKg+=parseFloat(p.kg)||0;
        const st=productExpiryStatus(p);
        if(st==='expired')expN++; else if(st==='expiring')wrnN++;
        movementScore += auditHistory.filter(entry => (entry.productCode || '').includes(p.code)).length;
      });
    }
    const pct=total>0?Math.round((occ/total)*100):0;
    const pc=pct>=90?'var(--danger)':pct>=60?'var(--warn)':'var(--accent3)';
    let tags='';
    if(expN)  tags+=`<span class="fp-tag fp-tag-exp">⛔${expN}</span>`;
    if(wrnN)  tags+=`<span class="fp-tag fp-tag-warn">⚠${wrnN}</span>`;
    if(!expN&&!wrnN&&occ>0) tags+=`<span class="fp-tag fp-tag-ok">✓</span>`;

    const card=document.createElement('div');
    let cls='fp-shelf-card'+(fpFocusedShelf===s.id && fpFocusedDepotId===depotId?' fp-selected':'')+(fpEditMode?' fp-edit-mode-item':'');
    cls += ` ${getShelfTypeClass(s.type)}`;
    card.className=cls;
    card.dataset.shelf=s.id;
    card.dataset.viewKey=view.viewKey;
    card.dataset.depotId=depotId;
    const heatCss = fpHeatmapEnabled
      ? (() => {
          const heat = Math.min(1, ((pct / 100) * 0.6) + Math.min(movementScore, 10) / 25);
          return `box-shadow:0 0 0 1px rgba(0,0,0,.04), 0 0 0 3px rgba(255,90,0,${heat.toFixed(2)});background:linear-gradient(180deg, rgba(255,165,0,${(heat * 0.28).toFixed(2)}), rgba(255,0,0,${(heat * 0.12).toFixed(2)}));`;
        })()
      : '';
    card.style.cssText=`left:${pos.x}px;top:${pos.y}px;z-index:${SHELF_Z};position:absolute;width:${FP_CARD_W}px;${heatCss}`;
    card.innerHTML=`
      <div class="fp-card-head">
        <div class="fp-card-id">${escapeHtml(s.id)}</div>
        <div class="fp-card-pct" style="color:${pc}">${escapeHtml(String(pct))}%${tags?'&nbsp;'+tags:''}</div>
      </div>
      <div class="fp-card-body">
        ${fpShowAllDepots ? `<div class="fp-card-row"><span>depósito</span><strong>${escapeHtml(getDepotById(depotId)?.name || depotId)}</strong></div>` : ''}
        <div class="fp-card-row"><span>tipo</span><strong>${getShelfTypeLabel(s.type)}</strong></div>
        <div class="fp-card-row"><span>${occ}/${total} gav.</span><strong>${skus.size} SKUs</strong></div>
        <div class="fp-card-row"><span>${s.floors}×${s.drawers}</span><strong>${totalKg.toFixed(1)}kg</strong></div>
        <div class="fp-cap-bar"><div class="fp-cap-fill" style="width:${pct}%;background:${pc}"></div></div>
      </div>`;

    if (fpEditMode && !fpShowAllDepots) {
      card.style.cursor='grab';
      card.addEventListener('mousedown', ev=>{
        if(ev.button!==0||fpActiveTool) return;
        ev.preventDefault(); ev.stopPropagation();
        const scopedId = getScopedShelfId(s.id, depotId);
        fpToggleSelect('shelf', scopedId, ev.ctrlKey||ev.metaKey);
        const w=fpS2W(ev.clientX,ev.clientY);
        // if multiple selected and this is in selection, drag all selected
        if(fpSelHas('shelf',scopedId) && fpSelection.size>1){
          // compute offsets for all selected items
          const selItems=[];
          fpSelection.forEach(key=>{
            const [kind,id2]=fpSelParse(key);
            if(kind==='shelf'){const p2=fpLayout[id2];if(p2)selItems.push({kind,id:id2,ox:w.x-p2.x,oy:w.y-p2.y,lastX:p2.x,lastY:p2.y});}
            else{const o=fpObjects.find(o2=>o2.id===id2);if(o)selItems.push({kind,id:id2,ox:w.x-o.x,oy:w.y-o.y,lastX:o.x,lastY:o.y});}
          });
          fpDrag={kind:'multi',el:card,items:selItems};
        } else {
          fpDrag={kind:'shelf',id:scopedId,el:card,offX:w.x-pos.x,offY:w.y-pos.y,lastX:pos.x,lastY:pos.y};
        }
        card.style.cursor='grabbing'; card._wasDrag=false;
      });
    } else {
      card.style.cursor='pointer';
      card.addEventListener('click', ()=>{
        if(card._wasDrag){card._wasDrag=false;return;}
        if(fpActiveTool) return;
        if (fpShowAllDepots) {
          switchDepot(depotId);
          fpViewDepotId = depotId;
          fpShowAllDepots = false;
          document.getElementById('fp-all-btn')?.classList.remove('active');
          fpPopulateDepotSelect();
        }
        openFpModal(s.id, depotId);
      });
    }
    inner.appendChild(card);
  });
}

// ─── Global pointer handlers (IIFE, runs once) ────────────────────────

// ─── Multi-select helpers ─────────────────────────────────────────────
function fpSelKey(kind, id) { return kind+'||'+id; }
function fpSelParse(value) {
  const sep = value.indexOf('||');
  if (sep === -1) return ['obj', value];
  return [value.slice(0, sep), value.slice(sep + 2)];
}
function fpSelAdd(kind, id) { fpSelection.add(fpSelKey(kind,id)); }
function fpSelRemove(kind, id) { fpSelection.delete(fpSelKey(kind,id)); }
function fpSelHas(kind, id) { return fpSelection.has(fpSelKey(kind,id)); }
function fpSelClear() { fpSelection.clear(); fpUpdateAlignBar(); }
function fpSelAll() {
  fpSelection.clear();
  shelves.forEach(s => fpSelAdd('shelf', getScopedShelfId(s.id, activeDepotId)));
  fpObjects.forEach(o => fpSelAdd('obj', o.id));
  fpUpdateAlignBar(); renderFloorPlan();
}

function fpUpdateAlignBar() {
  const bar = document.getElementById('fp-align-bar');
  const cnt = document.getElementById('fp-sel-count');
  const n   = fpSelection.size;
  if (bar) bar.classList.toggle('visible', n > 0 && fpEditMode);
  if (cnt) cnt.textContent = n + ' sel.';
}

function fpToggleSelect(kind, id, ctrlKey) {
  if (!ctrlKey) {
    // single click without ctrl: clear and select only this
    const wasAlreadySingle = fpSelection.size===1 && fpSelHas(kind,id);
    fpSelection.clear();
    if (!wasAlreadySingle) fpSelAdd(kind, id);
  } else {
    // ctrl: toggle this item
    if (fpSelHas(kind,id)) fpSelRemove(kind,id);
    else fpSelAdd(kind,id);
  }
  fpUpdateAlignBar();
  // update visual selection without full re-render
  _fpApplySelectionClass();
}

function _fpApplySelectionClass() {
  document.querySelectorAll('.fp-selected-item').forEach(el => el.classList.remove('fp-selected-item'));
  fpSelection.forEach(key => {
    const [kind, id] = fpSelParse(key);
    const sel = kind==='shelf'
      ? document.querySelector(`.fp-shelf-card[data-view-key="${id}"]`)
      : document.querySelector(`[data-obj-id="${id}"]`);
    if (sel) sel.classList.add('fp-selected-item');
  });
}

// ─── Lasso select ─────────────────────────────────────────────────────
function fpLassoUpdate(wx, wy) {
  if (!fpLasso) return;
  const lx = Math.min(fpLasso.startX, wx);
  const ly = Math.min(fpLasso.startY, wy);
  const lw = Math.abs(wx - fpLasso.startX);
  const lh = Math.abs(wy - fpLasso.startY);
  fpLasso.x=lx; fpLasso.y=ly; fpLasso.w=lw; fpLasso.h=lh;
  const el = document.getElementById('fp-lasso');
  if (el) {
    el.style.left   = lx+'px'; el.style.top    = ly+'px';
    el.style.width  = lw+'px'; el.style.height = lh+'px';
    el.style.display= 'block';
  }
}

function fpLassoCommit(ctrlKey) {
  const el = document.getElementById('fp-lasso');
  if (el) el.style.display = 'none';
  if (!fpLasso) return;
  const {x,y,w,h} = fpLasso;
  if (w < 4 && h < 4) { fpLasso=null; return; } // tiny lasso = ignore
  if (!ctrlKey) fpSelection.clear();
  // check shelves
  const did = fpGetViewDepotId();
  const sl  = did ? (shelvesAll[did]||[]) : Object.values(shelvesAll).flat();
  sl.forEach(s => {
    const scopedId = getScopedShelfId(s.id, did || activeDepotId);
    const p = fpLayout[scopedId]; if (!p) return;
    if (p.x < x+w && p.x+FP_CARD_W > x && p.y < y+h && p.y+fpCardH(s) > y)
      fpSelAdd('shelf', scopedId);
  });
  // check objects
  fpObjects.forEach(o => {
    if (o.x < x+w && o.x+o.w > x && o.y < y+h && o.y+o.h > y)
      fpSelAdd('obj', o.id);
  });
  fpLasso = null;
  fpUpdateAlignBar();
  _fpApplySelectionClass();
}

// ─── Align selected items ─────────────────────────────────────────────
function fpAlign(mode) {
  if (fpSelection.size < 2 && !['left','right','top','bottom','cx','cy'].includes(mode)) return;
  if (fpSelection.size < 1) return;
  fpHistoryPush();

  // gather bounding boxes
  const items = [];
  fpSelection.forEach(key => {
    const [kind, id] = fpSelParse(key);
    if (kind==='shelf') {
      const shelfId = id.split('::')[1] || id;
      const pos=fpLayout[id]; const shelf=shelves.find(s=>s.id===shelfId);
      if(pos&&shelf) items.push({kind,id,x:pos.x,y:pos.y,w:FP_CARD_W,h:fpCardH(shelf)});
    } else {
      const obj=fpObjects.find(o=>o.id===id);
      if(obj) items.push({kind,id,x:obj.x,y:obj.y,w:obj.w,h:obj.h});
    }
  });
  if (!items.length) return;

  const minX = Math.min(...items.map(i=>i.x));
  const minY = Math.min(...items.map(i=>i.y));
  const maxX = Math.max(...items.map(i=>i.x+i.w));
  const maxY = Math.max(...items.map(i=>i.y+i.h));
  const cx   = (minX+maxX)/2;
  const cy   = (minY+maxY)/2;

  const setPos = (item, nx, ny) => {
    if (item.kind==='shelf') { fpLayout[item.id]={x:fpSnap(nx),y:fpSnap(ny)}; }
    else { const o=fpObjects.find(o=>o.id===item.id); if(o){o.x=fpSnap(nx);o.y=fpSnap(ny);} }
  };

  if (mode==='left')   items.forEach(i => setPos(i, minX,  i.y));
  if (mode==='right')  items.forEach(i => setPos(i, maxX-i.w, i.y));
  if (mode==='top')    items.forEach(i => setPos(i, i.x, minY));
  if (mode==='bottom') items.forEach(i => setPos(i, i.x, maxY-i.h));
  if (mode==='cx')     items.forEach(i => setPos(i, cx-i.w/2, i.y));
  if (mode==='cy')     items.forEach(i => setPos(i, i.x, cy-i.h/2));
  if (mode==='distH' && items.length>=3) {
    const sorted=[...items].sort((a,b)=>a.x-b.x);
    const totalW=sorted.reduce((s,i)=>s+i.w,0);
    const gap=(maxX-minX-totalW)/(sorted.length-1);
    let cx2=minX;
    sorted.forEach(i=>{setPos(i,cx2,i.y);cx2+=i.w+gap;});
  }
  if (mode==='distV' && items.length>=3) {
    const sorted=[...items].sort((a,b)=>a.y-b.y);
    const totalH=sorted.reduce((s,i)=>s+i.h,0);
    const gap=(maxY-minY-totalH)/(sorted.length-1);
    let cy2=minY;
    sorted.forEach(i=>{setPos(i,i.x,cy2);cy2+=i.h+gap;});
  }
  renderFloorPlan();
}

async function fpDeleteSelected() {
  if (!await requirePermission('layout.edit', 'Seu perfil não pode editar a planta.')) return;
  if (!fpSelection.size) return;
  // collect what will be deleted
  const shelfIds = [], objIds = [];
  fpSelection.forEach(key => {
    const [kind,id] = fpSelParse(key);
    if (kind==='shelf') shelfIds.push(id);
    else objIds.push(id);
  });
  // check shelves for occupied (search ALL depots)
  const allS = Object.values(shelvesAll).flat();
  const occupied = shelfIds.filter(id => {
    const s = allS.find(s2=>s2.id===id); if(!s) return false;
    // Find which depot this shelf belongs to for products check
    let pMap = products;
    for(const [did, sl] of Object.entries(shelvesAll)) {
       if (sl.find(sx=>sx.id===id)) { pMap = productsAll[did] || {}; break; }
    }
    for(let f=1;f<=s.floors;f++) for(let d=1;d<=s.drawers;d++)
      if((pMap[drawerKey(s.id,f,d)]||[]).length) return true;
    return false;
  });
  if (occupied.length) {
    await showNotice({
      title: 'EXCLUSÃO BLOQUEADA',
      icon: '⛔',
      desc: 'Algumas prateleiras selecionadas ainda contêm produtos e não podem ser excluídas.',
      summary: { PRATELEIRAS: occupied.join(', ') },
    });
    return;
  }
  showConfirm({title:'EXCLUIR SELECIONADOS',icon:'🗑',
    desc:'Excluir '+fpSelection.size+' item(s) selecionado(s)?',
    summary:{'PRATELEIRAS':shelfIds.length,'OBJETOS':objIds.length},
    okLabel:'EXCLUIR'
  }).then(ok=>{
    if(!ok) return;
    fpHistoryPush();
    // Delete from all depots
    shelfIds.forEach(id=>{
      for(const did in shelvesAll) {
        shelvesAll[did] = shelvesAll[did].filter(s=>s.id!==id);
      }
      delete fpLayout[id];
    });
    // update current shim
    shelves = shelvesAll[activeDepotId] || [];
    fpObjects = fpObjects.filter(o=>!objIds.includes(o.id));
    fpSelClear(); renderAll(); if(typeof renderShelfList === 'function') renderShelfList();
  });
}


(function(){
  const cv = ()=>document.getElementById('fp-canvas');

  document.addEventListener('mousedown', ev=>{
    const c=cv(); if(!c||!c.contains(ev.target)) return;
    const inner=document.getElementById('fp-canvas-inner');

    // Placement click
    if(fpActiveTool && ev.button===0){
      ev.preventDefault(); ev.stopPropagation();
      const w=fpS2W(ev.clientX,ev.clientY);
      fpPlaceObject(w.x,w.y);
      return;
    }
    // Lasso or pan on bg
    if((ev.target===c||ev.target===inner) && ev.button===0 && !fpDrag && !fpResizing){
      if(fpEditMode){
        // start lasso
        const w=fpS2W(ev.clientX,ev.clientY);
        fpLasso={startX:w.x,startY:w.y,x:w.x,y:w.y,w:0,h:0};
        fpDrag={kind:'lasso',el:null,startScreenX:ev.clientX,startScreenY:ev.clientY,
                startScrollLeft:c.scrollLeft,startScrollTop:c.scrollTop};
        if(!ev.ctrlKey&&!ev.metaKey){fpSelClear();}
        ev.preventDefault();
      } else {
        fpDrag={kind:'pan',el:null,startScreenX:ev.clientX,startScreenY:ev.clientY,
                startScrollLeft:c.scrollLeft,startScrollTop:c.scrollTop};
        c.classList.add('panning'); ev.preventDefault();
      }
    }
  });

  document.addEventListener('mousemove', ev=>{
    // Preview always runs (independent of drag)
    if(fpActiveTool) { fpMovePreview(ev.clientX, ev.clientY); }

    if(!fpDrag && !fpResizing) return;

    if(fpDrag?.kind==='pan'){
      const c=cv(); if(!c) return;
      c.scrollLeft=fpDrag.startScrollLeft-(ev.clientX-fpDrag.startScreenX);
      c.scrollTop =fpDrag.startScrollTop -(ev.clientY-fpDrag.startScreenY);
      return;
    }
    if(fpDrag?.kind==='lasso'){
      const w=fpS2W(ev.clientX,ev.clientY);
      fpLassoUpdate(w.x,w.y);
      return;
    }

    if(fpDrag?.kind==='shelf'){
      const w=fpS2W(ev.clientX,ev.clientY);
      let nx=fpSnap(Math.max(0,w.x-fpDrag.offX));
      let ny=fpSnap(Math.max(0,w.y-fpDrag.offY));
      // axis-split collision sliding
      if(fpCollides(fpDrag.id,nx,ny)){
        if(!fpCollides(fpDrag.id,nx,fpDrag.lastY))      ny=fpDrag.lastY;
        else if(!fpCollides(fpDrag.id,fpDrag.lastX,ny)) nx=fpDrag.lastX;
        else { nx=fpDrag.lastX; ny=fpDrag.lastY; }
      }
      fpDrag.lastX=nx; fpDrag.lastY=ny;
      fpLayout[fpDrag.id]={x:nx,y:ny};
      fpDrag.el.style.left=nx+'px'; fpDrag.el.style.top=ny+'px';
      fpDrag.el._wasDrag=true;
      return;
    }

    if(fpDrag?.kind==='obj'){
      const w=fpS2W(ev.clientX,ev.clientY);
      const nx=fpSnap(Math.max(0,w.x-fpDrag.offX));
      const ny=fpSnap(Math.max(0,w.y-fpDrag.offY));
      const obj=fpObjects.find(o=>o.id===fpDrag.id);
      if(obj){obj.x=nx;obj.y=ny;}
      fpDrag.el.style.left=nx+'px'; fpDrag.el.style.top=ny+'px';
      fpDrag.el._wasDrag=true;
      return;
    }
    if(fpDrag?.kind==='multi'){
      const w=fpS2W(ev.clientX,ev.clientY);
      fpDrag.items.forEach(item=>{
        const nx=fpSnap(Math.max(0,w.x-item.ox));
        const ny=fpSnap(Math.max(0,w.y-item.oy));
        if(item.kind==='shelf'){
          // collision check per-shelf
          if(!fpCollides(item.id,nx,ny)){item.lastX=nx;item.lastY=ny;fpLayout[item.id]={x:nx,y:ny};}
          const el2=document.querySelector(`.fp-shelf-card[data-shelf="${item.id}"]`);
          const pos2=fpLayout[item.id];
          if(el2&&pos2){el2.style.left=pos2.x+'px';el2.style.top=pos2.y+'px';}
        } else {
          const obj2=fpObjects.find(o=>o.id===item.id);
          if(obj2){obj2.x=nx;obj2.y=ny;}
          const el2=document.querySelector(`[data-obj-id="${item.id}"]`);
          if(el2){el2.style.left=nx+'px';el2.style.top=ny+'px';}
        }
      });
      fpDrag.el._wasDrag=true;
      return;
    }

    if(fpResizing){
      const dx=ev.clientX-fpResizing.startX, dy=ev.clientY-fpResizing.startY;
      const nw=fpSnap(Math.max(60,fpResizing.startW+dx/fpScale));
      const nh=fpSnap(Math.max(30,fpResizing.startH+dy/fpScale));
      fpResizing.obj.w=nw; fpResizing.obj.h=nh;
      fpResizing.el.style.width=nw+'px'; fpResizing.el.style.height=nh+'px';
    }
  });

  document.addEventListener('mouseup', ev=>{
    const c=cv();
    if(fpDrag){
      if(fpDrag.kind==='pan'&&c) c.classList.remove('panning');
      if(fpDrag.kind==='shelf'&&fpDrag.el) { fpDrag.el.style.cursor='grab'; if(fpDrag.el._wasDrag) fpHistoryPush(); }
      if(fpDrag.kind==='obj'  &&fpDrag.el._wasDrag) fpHistoryPush();
      if(fpDrag.kind==='multi') fpHistoryPush();
      if(fpDrag.kind==='lasso') fpLassoCommit(ev.ctrlKey||ev.metaKey);
      fpDrag=null;
    }
    if(fpResizing) { fpHistoryPush(); fpResizing=null; } else fpResizing=null;
  });

  document.addEventListener('wheel', ev=>{
    const c=cv(); if(!c||!c.contains(ev.target)) return;
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    fpZoom(ev.deltaY<0?0.1:-0.1, ev.clientX, ev.clientY);
  },{passive:false});
})();

// ─── Keyboard shortcuts ────────────────────────────────────────────────
document.addEventListener('keydown', ev => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    if (document.activeElement?.id === 'blind-invoice-barcode' && ev.key === 'Escape') {
      document.activeElement.blur();
    } else if (document.activeElement?.id !== 'blind-invoice-barcode') {
      return;
    }
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !fpEditMode) {
    if (triggerLastUndoAction()) {
      ev.preventDefault();
      return;
    }
  }
  if (ev.key === 'F2') {
    if (getCurrentPageName() === 'conference') {
      ev.preventDefault();
      openBlindPoolModal();
      return;
    }
  }
  if (ev.key === 'F4') {
    ev.preventDefault();
    showPage('qr');
    return;
  }
  if (ev.key === 'Escape') {
    if (getCurrentPageName() === 'conference') {
      blindCountFocusedItemId = null;
      clearBlindTargetSelection();
      return;
    }
    clearFocus();
  }
  if (!fpEditMode) return;
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='z' && !ev.shiftKey) { ev.preventDefault(); fpUndo(); return; }
  if ((ev.ctrlKey||ev.metaKey) && (ev.key==='y' || (ev.key==='z'&&ev.shiftKey))) { ev.preventDefault(); fpRedo(); return; }
  if ((ev.ctrlKey||ev.metaKey) && ev.key==='a') {
    ev.preventDefault(); fpSelAll();
  }
  if (ev.key==='Escape') { fpSelClear(); _fpApplySelectionClass(); }
  if ((ev.key==='Delete'||ev.key==='Backspace') && fpSelection.size>0) {
    // only if not typing in an input
    if (document.activeElement.tagName!=='INPUT') fpDeleteSelected();
  }
});

// ─── Shelf detail modal ───────────────────────────────────────────────
function openFpModal(shelfId, depotId = activeDepotId) {
  if(fpEditMode) return;
  const shelf=(shelvesAll[depotId] || []).find(s=>s.id===shelfId); if(!shelf) return;
  fpFocusedShelf=shelfId;
  fpFocusedDepotId=depotId;
  renderFloorPlan();
  document.getElementById('fp-modal-title').textContent  = 'PRATELEIRA '+shelfId;
  document.getElementById('fp-modal-subtitle').textContent = `${getDepotById(depotId)?.name || depotId} · ${shelf.floors} andares · ${shelf.drawers} gav. · cap.${shelf.maxKg||50}kg/gav.`;
  document.getElementById('fp-add-btn').onclick = ()=>fpOpenAddProduct();
  renderFpModalBody(shelf, depotId);
  document.getElementById('fp-shelf-modal').classList.add('open');
  if(mvState) setTimeout(applyMoveHighlights,50);
}
function closeFpModal() {
  document.getElementById('fp-shelf-modal').classList.remove('open');
  fpFocusedShelf=null;
  fpFocusedDepotId=null;
  renderFloorPlan();
}
async function fpOpenAddProduct() {
  if (!await requirePermission('entry.register', 'Seu perfil não pode adicionar produtos pela planta.')) return;
  if(!fpFocusedShelf) return;
  const depotId = fpFocusedDepotId || activeDepotId;
  const shelf=(shelvesAll[depotId] || []).find(s=>s.id===fpFocusedShelf); if(!shelf) return;
  const dest = await showTextPrompt({
    title: 'ADICIONAR PRODUTO NA PLANTA',
    label: 'ENDEREÇO DA GAVETA',
    value: `${fpFocusedShelf}1.G1`,
    placeholder: `${fpFocusedShelf}1.G1`,
    help: 'Use o formato A1.G2',
    okLabel: 'CONTINUAR',
    maxLength: 20,
    uppercase: true,
  });
  if (dest === null) return;
  const normalized = sanitizeTextInput(dest, { maxLength: 20, uppercase: true });
  const parsed=parseKey(normalized);
  if(!parsed || parsed.shelf!==fpFocusedShelf) {
    await showNotice({
      title: 'ENDEREÇO INVÁLIDO',
      icon: '⛔',
      desc: 'Informe uma gaveta da mesma prateleira selecionada.',
      summary: { PRATELEIRA: fpFocusedShelf, LOCAL: normalized || '—' },
    });
    return;
  }
  currentDrawerKey=normalized;
  openProductForm(null);
}
function renderFpModalBody(shelf, depotId = fpFocusedDepotId || activeDepotId) {
  const body=document.getElementById('fp-modal-body'); if(!body) return;
  const fp=productsAll[depotId] || {};
  const si=Object.values(shelvesAll).flat().indexOf(shelf), rev=si%2===0;
  const floors=Array.from({length:shelf.floors},(_,i)=>i+1);
  const ordered=rev?[...floors].reverse():floors;
  const maxKg=shelf.maxKg||50;
  let h='<div class="fp-modal-floors">';
  ordered.forEach(f=>{
    h+=`<div class="floor" style="border-top:1px solid var(--border);padding:5px 10px"><div class="floor-label">${shelf.id}${f}</div><div class="drawers">`;
    for(let d=1;d<=shelf.drawers;d++){
      const key=drawerKey(shelf.id,f,d);
      const prods=fp[key]||[];
      const isOcc=prods.length>0;
      const expSt=isOcc?drawerExpiryStatus(prods):'ok';
      const usedKg=prods.reduce((s,p)=>s+(parseFloat(p.kg)||0),0);
      const capPct=Math.min(100,(usedKg/maxKg)*100);
      const capCls=capPct>=90?'high':capPct>=60?'mid':'low';
      let cls='drawer'+(isOcc?' occupied':'');
      if(expSt==='expired')cls+=' expired'; else if(expSt==='expiring')cls+=' expiring';
      const cme={};
      prods.forEach(p=>{const ne=nearestExpiry(p);if(!cme[p.code]||(ne&&ne<cme[p.code]))cme[p.code]=ne;});
      let ph='';
      if(isOcc){
        const shown=prods.slice(0,2),extra=prods.length-2;
        ph=shown.map(p=>{
          const es=productExpiryStatus(p);
          const dot=es!=='ok'?`<span class="exp-dot ${es==='expired'?'danger':'warn'}"></span>`:'';
          return `<div class="drawer-prod-entry" style="flex-direction:row;align-items:center;gap:2px">${dot}<span class="drawer-prod-code">${escapeHtml(p.code)}</span><span class="drawer-prod-name" style="margin-left:2px">${escapeHtml(p.name)}</span></div>`;
        }).join('')+(extra>0?`<div class="drawer-more">+${extra}</div>`:'');
      }
      h+=`<div class="${cls}" data-key="${key}" style="cursor:pointer" title="${key}">
        <div class="drawer-key">${key}</div>
        ${isOcc?`<div class="drawer-prod-list">${ph}</div><div class="cap-bar-wrap" style="margin-top:auto"><div class="cap-bar ${capCls}" style="width:${capPct}%"></div></div>`:'<div class="drawer-empty-label">vazia</div>'}
      </div>`;
    }
    h+='</div></div>';
  });
  h+='</div>';
  body.innerHTML=h;
  body.querySelectorAll('.drawer[data-key]').forEach(el=>{
    dndInit(el,el.dataset.key);
    el.onclick=()=>{ if(mvState)mvSelectDest(el.dataset.key); else fpDrawerClick(el.dataset.key); };
    el.ondblclick=ev=>{ ev.stopPropagation(); openDrawerModal(el.dataset.key); };
  });
  if(mvState) setTimeout(applyMoveHighlights,10);
}
function fpDrawerClick(key) {
  currentDrawerKey=key;
  const p=parseKey(key);
  document.getElementById('drawer-modal-title').textContent='GAVETA — '+key;
  document.getElementById('drawer-modal-loc').textContent=p?`Prateleira ${p.shelf} · Andar ${p.floor} · Gaveta ${p.drawer}`:key;
  renderDrawerProducts();
  document.getElementById('drawer-modal').classList.add('open');
}

// ─── Persistence ─────────────────────────────────────────────────────
async function fpSaveLayout() {
  const data={layout:fpLayout,objects:fpObjects,objSeq:fpObjIdSeq};
  fpSnapshot = structuredClone(data);
  await persistFloorplanState();
  const btn=document.querySelector('#fp-edit-tools .fp-tool-btn.active:not(#fp-snap-btn)');
  if(btn){const o=btn.textContent;btn.textContent='✓ SALVO!';setTimeout(()=>btn.textContent=o,1500);}
}
function fpLoadLayout() {
  fpLayout = fpLayout || {};
  fpObjects = fpObjects || [];
  fpObjIdSeq = fpObjIdSeq || fpObjects.length || 0;
}
async function fpResetLayout() {
  if (!await requirePermission('layout.edit', 'Seu perfil não pode resetar a planta.')) return;
  if(fpSnapshot){
    const ok=await showConfirm({title:'RESETAR PLANTA',icon:'↺',desc:'Desfazer todas as alterações desde o último salvamento?',okLabel:'RESETAR'});
    if(!ok) return;
    const d = structuredClone(fpSnapshot);
    fpLayout=d.layout||{}; fpObjects=d.objects||[]; fpObjIdSeq=d.objSeq||0;
  } else {
    const ok=await showConfirm({title:'RESETAR PLANTA',icon:'↺',desc:'Resetar toda a planta (sem salvamento anterior)?',okLabel:'RESETAR'});
    if(!ok) return;
    fpLayout={}; fpObjects=[];
  }
  renderFloorPlan();
}

// ─── Depot selector ───────────────────────────────────────────────────
let fpShowAllDepots = false;
let fpViewDepotId   = null;

function fpSwitchDepot(id) {
  if (id === ALL_DEPOTS_VALUE) {
    fpShowAllDepots = true;
    fpViewDepotId = null;
    document.getElementById('fp-all-btn')?.classList.add('active');
    fpPopulateDepotSelect();
    renderFloorPlan();
    return;
  }
  fpShowAllDepots=false; fpViewDepotId=id;
  document.getElementById('fp-all-btn')?.classList.remove('active');
  fpPopulateDepotSelect();
  renderFloorPlan();
}
function fpToggleAllDepots() {
  fpShowAllDepots=!fpShowAllDepots;
  fpViewDepotId = fpShowAllDepots ? null : activeDepotId;
  fpFocusedShelf = null;
  fpFocusedDepotId = null;
  document.getElementById('fp-all-btn')?.classList.toggle('active',fpShowAllDepots);
  document.getElementById('fp-shelf-modal')?.classList.remove('open');
  fpPopulateDepotSelect();
  renderFloorPlan();
  if(fpSearchQuery||fpSearchFilter) fpApplySearch();
}
function fpGetViewDepotId() {
  if(fpShowAllDepots) return null;
  return fpViewDepotId || activeDepotId;
}
function fpPopulateDepotSelect() {
  const sel=document.getElementById('fp-depot-select'); if(!sel) return;
  sel.innerHTML = buildDepotOptionsHtml({ includeAll: true, selected: fpShowAllDepots ? ALL_DEPOTS_VALUE : (fpViewDepotId || activeDepotId) });
  sel.disabled = false;
}

// ─── Search ───────────────────────────────────────────────────────────
function fpSearch(q){fpSearchQuery=q.trim().toLowerCase();fpApplySearch();}
function fpClearSearch(){fpSearchQuery='';const el=document.getElementById('fp-search');if(el)el.value='';fpApplySearch();}
function fpToggleHeatmap() {
  fpHeatmapEnabled = !fpHeatmapEnabled;
  document.getElementById('fp-heatmap-btn')?.classList.toggle('active', fpHeatmapEnabled);
  renderFloorPlan();
  if (fpSearchQuery || fpSearchFilter || fpExpiryMaxDays) fpApplySearch();
}
function fpSetExpiryRange(value) {
  fpExpiryMaxDays = parseInt(value || '0', 10) || 0;
  const label = document.getElementById('fp-expiry-slider-label');
  if (label) label.textContent = fpExpiryMaxDays > 0 ? `≤ ${fpExpiryMaxDays}D` : 'TODAS';
  fpApplySearch();
}
function fpSetFilter(f){
  fpSearchFilter=fpSearchFilter===f?'':f;
  ['all','expired','expiring','empty','full'].forEach(k=>{
    const el=document.getElementById('fpsf-'+k);
    if(el)el.classList.toggle('active',k!=='all'&&k===fpSearchFilter);
  });
  document.getElementById('fpsf-active')?.style &&
    (document.getElementById('fpsf-active').style.display=fpSearchFilter?'inline-flex':'none');
  fpApplySearch();
}
function fpApplySearch(){
  const q=fpSearchQuery,filter=fpSearchFilter;
  let mc=0;
  const fpMatchPriority = match => {
    if (match.st === 'expiring') return 0;
    if (match.st === 'ok') return 1;
    if (match.st === 'none') return 2;
    if (match.st === 'expired') return 3;
    return 4;
  };
  const totalCards = document.querySelectorAll('.fp-shelf-card[data-view-key]').length;
  document.querySelectorAll('.fp-shelf-card[data-view-key]').forEach(card=>{
    const view = fpRenderShelfMap[card.dataset.viewKey];
    const shelf = view?.shelf;
    const depotId = view?.depotId;
    if(!shelf || !depotId) return;
    const productsMap = productsAll[depotId] || {};
    let occ=0,total=shelf.floors*shelf.drawers;
    const matches=[];
    for(let f=1;f<=shelf.floors;f++) for(let d=1;d<=shelf.drawers;d++){
      const key=drawerKey(shelf.id,f,d); const prods=productsMap[key]||[];
      if(prods.length)occ++;
      prods.forEach(p=>{
        const st=productExpiryStatus(p); const expiries=getExpiries(p).filter(Boolean);
        const nearest = nearestExpiry(p);
        const days = nearest ? daysUntil(nearest) : null;
        const src=[p.code,p.name,key,p.entry||'',...expiries].join(' ').toLowerCase();
        if(q&&!src.includes(q))return;
        if(filter==='expired'&&st!=='expired')return;
        if(filter==='expiring'&&st!=='expiring')return;
        if(fpExpiryMaxDays > 0 && (days === null || days < 0 || days > fpExpiryMaxDays)) return;
        const lbl=p.code.toLowerCase().includes(q)?p.code:p.name.toLowerCase().includes(q)?p.name.slice(0,16):key;
        matches.push({lbl,st,nearest});
      });
    }
    matches.sort((a,b)=>{
      const prioDiff = fpMatchPriority(a) - fpMatchPriority(b);
      if (prioDiff !== 0) return prioDiff;
      const dateA = a.nearest || '9999-12-31';
      const dateB = b.nearest || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a.lbl.localeCompare(b.lbl);
    });
    if(filter==='empty'&&occ>0){card.classList.remove('fp-match');card.classList.add('fp-no-match');return;}
    if(filter==='full'&&occ<total){card.classList.remove('fp-match');card.classList.add('fp-no-match');return;}
    const hasMatch=(!q&&!filter&&!fpExpiryMaxDays)||matches.length>0;
    card.classList.remove('fp-match','fp-no-match');
    card.querySelector('.fp-match-badges')?.remove();
    if(!q&&!filter&&!fpExpiryMaxDays)return;
    if(hasMatch){
      card.classList.add('fp-match'); mc++;
      if(q&&matches.length){
        const bd=document.createElement('div');bd.className='fp-match-badges';
        matches.slice(0,5).forEach(m=>{const b=document.createElement('span');b.className='fp-match-badge'+(m.st==='expired'?' exp':m.st==='expiring'?' warn':'');b.textContent=m.lbl;bd.appendChild(b);});
        if(matches.length>5){const b=document.createElement('span');b.className='fp-match-badge';b.style.background='var(--text3)';b.textContent='+' + (matches.length-5);bd.appendChild(b);}
        card.appendChild(bd);
      }
    } else {card.classList.add('fp-no-match');}
  });
  const ce=document.getElementById('fp-search-count');
  if(ce){if(!q&&!filter&&!fpExpiryMaxDays)ce.textContent=totalCards+' prateleiras';else{ce.textContent=mc+' de '+totalCards+' prateleiras';ce.style.color=mc===0?'var(--danger)':'var(--text3)';}}
}

// ─── Depot overview (depots page) JS lives here since it uses FP state ─
function openDepotModal(editId) {
  if (!hasPermission('settings.manage')) return;
  depotModalEditId = editId || null;  // declared above
  const dm = depots.find(d => d.id === editId);
  const titleEl = byId('depot-modal-title');
  if (titleEl) titleEl.textContent = editId ? '✏ EDITAR DEPÓSITO' : '+ NOVO DEPÓSITO';
  writeInputValue('dm-name', dm?.name || '');
  writeInputValue('dm-address', dm?.address || '');
  writeInputValue('dm-city', dm?.city || '');
  writeInputValue('dm-manager', dm?.manager || '');
  writeInputValue('dm-phone', dm?.phone || '');
  writeInputValue('dm-notes', dm?.notes || '');
  const overcapacityEl = byId('dm-allow-overcapacity');
  if (overcapacityEl) overcapacityEl.checked = !!dm?.allowOvercapacity;
  byId('depot-modal')?.classList.add('open');
}
function closeDepotModal() {
  byId('depot-modal')?.classList.remove('open');
  depotModalEditId = null;
}
function doAddDepot() { openDepotModal(null); }

async function saveDepotCard(depotId) {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode criar ou editar depósitos.')) return;
  const depot = getDepotById(depotId);
  if (!depot) return;
  const prefix = `do-${depotId}`;
  const name = sanitizeTextInput(document.getElementById(`${prefix}-name`)?.value, { maxLength: 80 });
  if (!name) {
    await showNotice({ title: 'CAMPO OBRIGATÓRIO', icon: '⛔', desc: 'Informe o nome do depósito antes de salvar.' });
    return;
  }
  const payload = {
    name,
    address: sanitizeTextInput(document.getElementById(`${prefix}-address`)?.value, { maxLength: 140 }),
    city: sanitizeTextInput(document.getElementById(`${prefix}-city`)?.value, { maxLength: 80 }),
    manager: sanitizeTextInput(document.getElementById(`${prefix}-manager`)?.value, { maxLength: 80 }),
    phone: sanitizeTextInput(document.getElementById(`${prefix}-phone`)?.value, { maxLength: 40 }),
    notes: sanitizeTextInput(document.getElementById(`${prefix}-notes`)?.value, { maxLength: 240 }),
    allowOvercapacity: !!document.getElementById(`${prefix}-allow-overcapacity`)?.checked,
  };
  const confirmed = await showConfirm({
    title: 'SALVAR DEPÓSITO',
    icon: '💾',
    desc: 'Aplicar as alterações deste depósito?',
    summary: {
      NOME: payload.name,
      CIDADE: payload.city || '—',
      OVERCAPACITY: payload.allowOvercapacity ? 'ATIVO' : 'INATIVO',
    },
    okLabel: 'SALVAR',
    okStyle: 'accent',
  });
  if (!confirmed) return;
  Object.assign(depot, payload);
  await persistStructureState();
  renderDepotsPage();
  renderDepotTabs();
  renderAll(true);
}

function renderDepotsPage() {
  const grid = document.getElementById('do-grid');
  if (!grid) return;
  const canManageDepots = hasPermission('settings.manage');
  let html2 = '';
  const scopeDepotId = getDepotTabsContextId();
  depots.filter(depot => scopeDepotId === ALL_DEPOTS_VALUE || depot.id === scopeDepotId).forEach(depot => {
    const discardDepot = isDiscardDepot(depot);
    const slist  = shelvesAll[depot.id]  || [];
    const prods  = productsAll[depot.id] || {};
    let totalDrawers=0, occupiedDrawers=0, totalCapKg=0, usedKg=0, totalProducts=0, expiredCount=0, expiringCount=0;
    const skus=new Set();
    const shelfRows = slist.map(s => {
      let sOcc=0, sTot=s.floors*s.drawers, sUsedKg=0;
      const sCapKg=sTot*(s.maxKg||50);
      for(let f=1;f<=s.floors;f++) for(let d=1;d<=s.drawers;d++){
        const key=drawerKey(s.id,f,d); const p=prods[key]||[];
        if(p.length)sOcc++;
        p.forEach(pr=>{
          skus.add(pr.code); const k=parseFloat(pr.kg)||0; sUsedKg+=k; usedKg+=k; totalProducts++;
          const st=productExpiryStatus(pr);
          if(st==='expired')expiredCount++; else if(st==='expiring')expiringCount++;
        });
      }
      totalDrawers+=sTot; occupiedDrawers+=sOcc; totalCapKg+=sCapKg;
      const pct=sTot>0?Math.round((sOcc/sTot)*100):0;
      const capKgPct=sCapKg>0?Math.round((sUsedKg/sCapKg)*100):0;
      const barColor=pct>=90?'var(--danger)':pct>=60?'var(--warn)':'var(--accent3)';
      return `<div class="do-shelf-row">
        <div class="do-shelf-id">${s.id}</div>
        <div class="do-shelf-bar-wrap"><div class="do-shelf-bar" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="do-shelf-stats">${sOcc}/${sTot} gav · ${sUsedKg.toFixed(1)}kg${depot.allowOvercapacity ? ` · ${capKgPct}%` : ''}</div>
      </div>`;
    }).join('');
    const occPct=totalDrawers>0?Math.round((occupiedDrawers/totalDrawers)*100):0;
    const kgPct=totalCapKg>0?Math.round((usedKg/totalCapKg)*100):0;
    const occColor=occPct>=90?'var(--danger)':occPct>=60?'var(--warn)':'var(--accent3)';
    const kgColor=kgPct>=100?'var(--danger)':kgPct>=60?'var(--warn)':'var(--accent)';
    const loadLabel = depot.allowOvercapacity ? `${usedKg.toFixed(1)} / ${totalCapKg.toFixed(0)} kg · ${kgPct}%` : `${usedKg.toFixed(1)} / ${totalCapKg.toFixed(0)} kg`;
    const prefix = `do-${depot.id}`;
    let expBadges='';
    if(expiredCount)  expBadges+=`<span class="status-badge expired">⛔ ${expiredCount} vencidos</span>`;
    if(expiringCount) expBadges+=`<span class="status-badge expiring">⚠ ${expiringCount} a vencer</span>`;
    if(!expiredCount&&!expiringCount&&totalProducts>0) expBadges+=`<span class="status-badge ok">✓ Validades OK</span>`;
    if(depot.allowOvercapacity) expBadges+=`<span class="status-badge blocked">↕ OVERCAPACITY ATIVO</span>`;
    if(discardDepot) expBadges+=`<span class="status-badge expired">🟥 DESCARTE CONTROLADO</span>`;
    const detailHtml = canManageDepots ? `
      <div class="do-card-detail do-card-form">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>NOME</label>
            <input type="text" id="${prefix}-name" value="${escapeAttr(depot.name || '')}">
          </div>
          <div class="form-group">
            <label>CIDADE</label>
            <input type="text" id="${prefix}-city" value="${escapeAttr(depot.city || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>ENDEREÇO</label>
            <input type="text" id="${prefix}-address" value="${escapeAttr(depot.address || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>RESPONSÁVEL</label>
            <input type="text" id="${prefix}-manager" value="${escapeAttr(depot.manager || '')}">
          </div>
          <div class="form-group">
            <label>TELEFONE</label>
            <input type="text" id="${prefix}-phone" value="${escapeAttr(depot.phone || '')}">
          </div>
        </div>
        <div class="form-group">
          <label>OBSERVAÇÕES</label>
          <input type="text" id="${prefix}-notes" value="${escapeAttr(depot.notes || '')}">
        </div>
        <label class="shelf-type-option shelf-type-option-blocked do-overcapacity-toggle">
          <input type="checkbox" id="${prefix}-allow-overcapacity" ${depot.allowOvercapacity ? 'checked' : ''}>
          <span>PERMITIR OVERCAPACITY NESTE DEPÓSITO</span>
        </label>
        <div class="do-inline-actions">
          <button class="btn btn-accent" onclick="saveDepotCard('${escapeJs(depot.id)}')">💾 SALVAR</button>
        </div>
      </div>
    ` : `${(depot.address||depot.manager||depot.phone||depot.notes)?'<div class="do-card-detail">'
        +(depot.address?'<div class="do-detail-row"><span class="do-detail-label">ENDEREÇO</span><span class="do-detail-value">'+escapeHtml(depot.address)+'</span></div>':'')
        +(depot.manager?'<div class="do-detail-row"><span class="do-detail-label">RESPONS.</span><span class="do-detail-value">'+escapeHtml(depot.manager)+'</span></div>':'')
        +(depot.phone  ?'<div class="do-detail-row"><span class="do-detail-label">TELEFONE</span><span class="do-detail-value">'+escapeHtml(depot.phone)+'</span></div>':'')
        +(depot.notes  ?'<div class="do-detail-row"><span class="do-detail-label">OBS.</span><span class="do-detail-value">'+escapeHtml(depot.notes)+'</span></div>':'')
        +'</div>':''}`;
    html2+=`<div class="do-card ${discardDepot ? 'discard' : ''}">
      <div class="do-card-head ${discardDepot ? 'discard' : ''}">
        <div><div class="do-card-name ${discardDepot ? 'discard' : ''}">${escapeHtml(depot.name)}</div>
        ${depot.city?'<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:var(--text3);margin-top:2px">'+escapeHtml(depot.city)+'</div>':''}</div>
        <div class="do-card-actions">
          <button class="btn" onclick="switchDepot('${depot.id}');showPage('depot')" style="font-size:10px;padding:4px 10px">🏭 ABRIR</button>
          ${canManageDepots ? `<button class="icon-btn del" onclick="removeDepot('${depot.id}')" title="Remover">✕</button>` : ''}
        </div>
      </div>
      ${detailHtml}
      <div class="do-kpi-row">
        <div class="do-kpi"><div class="do-kpi-label">CAP. ESTRUTURAL</div><div class="do-kpi-value" style="color:${occColor}">${totalDrawers}</div><div class="do-kpi-sub">${occupiedDrawers} gavetas ocupadas · ${occPct}%</div></div>
        <div class="do-kpi"><div class="do-kpi-label">CARGA KG</div><div class="do-kpi-value" style="color:${kgColor}">${kgPct}%</div><div class="do-kpi-sub">${loadLabel}</div></div>
        <div class="do-kpi"><div class="do-kpi-label">PRODUTOS</div><div class="do-kpi-value" style="color:var(--accent2)">${skus.size}</div><div class="do-kpi-sub">${totalProducts} entradas · ${slist.length} prat.</div></div>
      </div>
      ${slist.length?'<div class="do-shelves">'+shelfRows+'</div>':'<div style="padding:14px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--text3)">Nenhuma prateleira</div>'}
      ${expBadges?'<div class="do-exp-badges">'+expBadges+'</div>':''}
    </div>`;
  });
  if (canManageDepots) html2+=`<div class="do-add-card" onclick="doAddDepot()"><span>+ NOVO DEPÓSITO</span></div>`;
  grid.innerHTML=html2;
}



