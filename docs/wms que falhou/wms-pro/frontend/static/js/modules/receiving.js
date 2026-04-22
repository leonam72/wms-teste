// ═══════════════════════════════════════════════════════════
// MODULE: receiving.js
// ═══════════════════════════════════════════════════════════

// Constants relevant to receiving
const ALLOWED_UNITS = {"UN", "KG", "CX", "LT", "PT", "PC", "FD"};

// Helper function for unit normalization (moved from render.js)
function _normalize_unit(unit) {
    const u = String(unit || "UN").trim().toUpperCase();
    return u in ALLOWED_UNITS ? u : "UN";
}

// Helper function for parsing drawer key (moved from render.js, might be general)
function parseKey(key) {
  const m = key.match(/^([A-Z]+)(\d+)\.G(\d+)$/);
  if (!m) return null;
  return { shelf: m[1], floor: parseInt(m[2]), drawer: parseInt(m[3]) };
}

// Helper function for input sanitization (moved from render.js, likely general)
function sanitizeTextInput(text, options = {}) {
    if (typeof text !== 'string') return '';
    let sanitized = text.trim();
    if (options.maxLength) sanitized = sanitized.substring(0, options.maxLength);
    if (options.uppercase) sanitized = sanitized.toUpperCase();
    return sanitized;
}

// Helper function for reading input value (moved from render.js, likely general)
function readInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
function writeInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

// Helper function to validate drawer placement (moved from render.js, critical for receiving)
function validateDrawerPlacement({ depotId, drawerKeyValue, incomingKg, sourceDepotId = null, sourceDrawerKey = null, sourceProductIdx = null, allowExistingSameDrawer = false }) {
    const shelfId = drawerKeyValue?.split('.')[0];
    const drawerKey = drawerKeyValue;
    const shelf = (shelvesAll[depotId] || []).find(s => s.id === shelfId);
    if (!shelf) return { ok: false, title: 'PRATELEIRA INEXISTENTE', detail: `A prateleira ${shelfId} não existe neste depósito.`, summary: { DEPÓSITO: getDepotById(depotId)?.name || depotId, PRATELEIRA: shelfId } };

    const parsed = parseKey(drawerKey);
    if (!parsed) return { ok: false, title: 'FORMATO DE GAVETA INVÁLIDO', detail: `O formato da gaveta '${drawerKey}' não é válido. Use A1.G2.` };
    if (parsed.floor < 1 || parsed.floor > shelf.floors) return { ok: false, title: 'ANDAR INVÁLIDO', detail: `O andar ${parsed.floor} não existe na prateleira ${shelfId}.`, summary: { PRATELEIRA: shelfId, 'ANDARES': shelf.floors } };
    if (parsed.drawer < 1 || parsed.drawer > shelf.drawers) return { ok: false, title: 'GAVETA INVÁLIDA', detail: `O número da gaveta ${parsed.drawer} excede o limite da prateleira ${shelfId}.`, summary: { PRATELEIRA: shelfId, GAVETAS: shelf.drawers } };

    let currentKg = 0;
    const existingProducts = productsAll[depotId]?.[drawerKey] || [];
    existingProducts.forEach((p, idx) => {
        if (sourceDepotId === depotId && sourceDrawerKey === drawerKey && idx === sourceProductIdx && allowExistingSameDrawer) return; // Skip self if same source
        currentKg += parseFloat(p.kgTotal ?? p.kg) || 0;
    });
    const maxKg = parseFloat(shelf.maxKg) || 50;
    if (currentKg + incomingKg > maxKg + CAPACITY_EPSILON_KG) return { ok: false, title: 'CAPACIDADE DE GAVETA EXCEDIDA', detail: `A gaveta ${drawerKey} ficaria com ${currentKg + incomingKg} kg, excedendo o limite de ${maxKg} kg.`, summary: { GAVETA: drawerKey, 'PESO ATUAL': currentKg.toFixed(2)+'kg', 'PESO ENTRANTE': incomingKg.toFixed(3)+'kg', LIMITE: maxKg+'kg' } };

    return { ok: true };
}

// Helper for syncing weight fields (moved from render.js)
function syncWeightFields(prefix, qtyFieldId) {
    const qtyEl = document.getElementById(`${prefix}-${qtyFieldId}`);
    const kgUnitEl = document.getElementById(`${prefix}-kg-unit`);
    const kgTotalEl = document.getElementById(`${prefix}-kg-total`);
    const kgEl = document.getElementById(`${prefix}-kg`);

    if (!qtyEl || !kgUnitEl || !kgTotalEl || !kgEl) return;

    const qty = Math.max(0, parseFloat(qtyEl.value) || 0);
    const kgUnit = Math.max(0, parseFloat(kgUnitEl.value) || 0);
    const kgTotal = Math.max(0, parseFloat(kgTotalEl.value) || 0);

    let finalKg = kgTotal;
    if (qty > 0 && kgUnit > 0) {
        finalKg = qty * kgUnit;
        if (kgTotalEl) kgTotalEl.value = finalKg.toFixed(3);
        if (kgEl) kgEl.value = finalKg.toFixed(3);
    } else if (kgTotalEl) { // if kgTotalEl is manually set, use it
        finalKg = kgTotal;
        if (qtyEl) qtyEl.value = (finalKg / kgUnit).toFixed(3);
        if (kgEl) kgEl.value = finalKg.toFixed(3);
    } else if (kgEl) { // if kgEl is manually set, use it
        finalKg = kgTotal;
        if (qtyEl) qtyEl.value = (finalKg / kgUnit).toFixed(3);
        if (kgTotalEl) kgTotalEl.value = finalKg.toFixed(3);
    } else { // fallback to qty if no kg set
        if (qtyEl) qtyEl.value = qty.toFixed(3);
        if (kgEl) kgEl.value = finalKg.toFixed(3);
    }
}

// Global variables (check if these should be moved or managed differently)
let gpExpiries = []; // Expiry dates for the global product form

// ——— GLOBAL ADD PRODUCT FORM ———
function openAddProductModal() {
    if (!hasPermission('entry.register')) return;
    const today = new Date().toISOString().slice(0, 10);
    writeInputValue('gp-entry', today);
    writeInputValue('gp-qty', '1');
    writeInputValue('gp-unit', 'un');
    writeInputValue('gp-kg-unit', '');
    writeInputValue('gp-kg-total', '');
    writeInputValue('gp-kg', '');
    gpExpiries = []; // Reset expiries when opening modal
    const chips = document.getElementById('gp-expiry-chips');
    if (chips) chips.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';

    document.getElementById('add-product-modal').classList.add('open');
    document.getElementById('gp-code')?.focus();
}

async function addGlobalProduct() {
    if (!await requirePermission('entry.register', 'Seu perfil não pode registrar entradas manuais.')) return;
    const code = sanitizeTextInput(readInputValue('gp-code'), { maxLength: 40, uppercase: true });
    const name = sanitizeTextInput(readInputValue('gp-name'), { maxLength: 120 });
    syncWeightFields('gp', 'qty');
    const qty = parseInt(readInputValue('gp-qty'), 10) || 1;
    const unit = readInputValue('gp-unit') || 'un';
    const kgUnit = parseFloat(readInputValue('gp-kg-unit')) || 0;
    const kg = parseFloat(readInputValue('gp-kg-total') || readInputValue('gp-kg')) || 0;
    const loc = sanitizeTextInput(readInputValue('gp-location'), { maxLength: 20, uppercase: true });
    const entry = readInputValue('gp-entry') || new Date().toISOString().slice(0, 10);
    const lot = sanitizeTextInput(document.getElementById('gp-lot')?.value, { maxLength: 60, uppercase: true });
    const notes = sanitizeTextInput(document.getElementById('gp-notes')?.value, { maxLength: 180 });

    if (!code || !name || !loc) { await showNotice({ title: 'CAMPOS OBRIGATÓRIOS', icon: '⛔', desc: 'Código, nome e local são obrigatórios.' }); return; }
    const p = parseKey(loc);
    if (!p) { await showNotice({ title: 'LOCAL INVÁLIDO', icon: '⛔', desc: 'Use o formato A1.G2 para indicar o local do produto.' }); return; }

    const shelf = shelves.find(s => s.id === p.shelf);
    if (!shelf) { await showNotice({ title: 'PRATELEIRA INEXISTENTE', icon: '⛔', desc: `A prateleira ${p.shelf} não existe neste depósito.` }); return; }
    if (p.floor < 1 || p.floor > shelf.floors) { await showNotice({ title: 'ANDAR INVÁLIDO', icon: '⛔', desc: `O andar ${p.floor} não existe na prateleira ${p.shelf}.` }); return; }
    if (p.drawer < 1 || p.drawer > shelf.drawers) { await showNotice({ title: 'GAVETA INVÁLIDA', icon: '⛔', desc: `A gaveta ${p.drawer} não existe na prateleira ${p.shelf}.` }); return; }

    const validation = validateDrawerPlacement({ depotId: activeDepotId, drawerKeyValue: loc, incomingKg: kg });
    if (!validation.ok) { await showNotice({ title: validation.title, icon: '⛔', desc: validation.detail, summary: validation.summary }); return; }

    // Update global products state
    if (!products[loc]) products[loc] = [];
    products[loc].push({
        code, name, qty, unit, kg, kgTotal: kg, kgPerUnit: kgUnit, lot, entry,
        expiries: gpExpiries, notes,
    });

    logHistory('📥', `Entrada: ${code} — ${name}`, `${loc} · ${kg.toFixed(3)}kg · ${qty} ${unit}${notes ? ' · ' + notes : ''}`, { depotId: activeDepotId, to: loc, drawerKey: loc, productCode: code });

    writeInputValue('gp-code', '');
    writeInputValue('gp-name', '');
    writeInputValue('gp-location', '');
    writeInputValue('gp-kg', '');
    writeInputValue('gp-kg-unit', '');
    writeInputValue('gp-kg-total', '');
    writeInputValue('gp-lot', '');
    writeInputValue('gp-notes', '');
    gpExpiries = []; // Clear expiries for next entry
    const chips = document.getElementById('gp-expiry-chips');
    if (chips) chips.innerHTML = '<span class="exp-chip-empty">Nenhuma validade adicionada</span>';
    writeInputValue('gp-qty', '1');
    writeInputValue('gp-unit', 'un');
    writeInputValue('gp-entry', new Date().toISOString().slice(0, 10));

    document.getElementById('add-product-modal').classList.remove('open');
    renderAll(); // Re-render the main view to reflect changes
}

// Add any other receiving-specific functions here if they exist in render.js and are not general utilities.

// Exported functions that might be used elsewhere (e.g., in render.js or other modules)
export { openAddProductModal, addGlobalProduct, syncWeightFields };
