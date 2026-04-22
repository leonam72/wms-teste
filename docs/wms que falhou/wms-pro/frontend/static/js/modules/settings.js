// ═══════════════════════════════════════════════════════════
// MODULE: settings.js
// ═══════════════════════════════════════════════════════════


// ——— SETTINGS MODAL ———
let csvParsedData = null;

function openSettingsModal() {
  showPage('settings');
}
function closeSettingsModal() { document.getElementById('settings-modal').classList.remove('open'); }

function switchStab(name) {
  document.querySelectorAll('.stab').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.stab-panel').forEach(e => e.classList.remove('active'));
  document.getElementById('stab-' + name).classList.add('active');
  document.getElementById('spanel-' + name).classList.add('active');
}

// ——— DRAG & DROP ———


// ——— SAMPLE CSV ———
function downloadSampleCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = [
    'location,code,name,kg,entry,exit',
    'A1.G1,P001,Parafuso M6,0.50,2025-01-10,',
    'A1.G2,P002,Porca M6,0.30,2025-01-12,',
    'A2.G1,P001,Parafuso M6,0.50,2025-01-15,2025-06-30',
    'A2.G3,P003,Arruela Aco,0.10,2025-02-01,',
    'B1.G1,P004,Chave Allen 3mm,1.20,2025-01-20,',
    'B1.G2,P005,Chave Allen 5mm,1.50,2025-01-20,',
    'B3.G4,P006,Rebite 4mm,0.05,2025-03-01,2025-08-01',
  ];
  downloadFile('wms_exemplo.csv', rows.join('\n'), 'text/csv');
}

// ——— CSV IMPORT ———
function handleCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    document.getElementById('csv-preview-text').textContent = text.split('\n').slice(0, 8).join('\n') + (text.split('\n').length > 8 ? '\n...' : '');
    document.getElementById('csv-preview-box').style.display = 'block';
    document.getElementById('import-result-box').style.display = 'none';
    document.getElementById('btn-preview-import').style.display = 'inline-block';
    document.getElementById('btn-confirm-import').style.display = 'none';
    csvParsedData = text;
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const required = ['location','code','name','kg','entry','exit'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) throw new Error('Colunas faltando: ' + missing.join(', '));
  const idx = h => headers.indexOf(h);
  return lines.slice(1).map((line, i) => {
    const cols = line.split(',');
    if (cols.length < headers.length) throw new Error(`Linha ${i+2}: colunas insuficientes`);
    return {
      location: sanitizeTextInput(cols[idx('location')], { maxLength: 20, uppercase: true }),
      code: sanitizeTextInput(cols[idx('code')], { maxLength: 40, uppercase: true }),
      name: sanitizeTextInput(cols[idx('name')], { maxLength: 120 }),
      kg: parseFloat(cols[idx('kg')]) || 0,
      entry: cols[idx('entry')].trim(),
      exit: cols[idx('exit')].trim(),
    };
  }).filter(r => r.location && r.code && r.name);
}

function validateImportRows(rows) {
  const tempShelves = deepClone(shelves);
  const tempProducts = deepClone(products);
  const shelfRows = {};

  rows.forEach(row => {
    const parsed = parseKey(row.location);
    if (!parsed) return;
    if (!shelfRows[parsed.shelf]) shelfRows[parsed.shelf] = [];
    shelfRows[parsed.shelf].push(parsed);
  });

  const errors = [];
  let createdShelves = 0;
  let addedRows = 0;

  rows.forEach(row => {
    const parsed = parseKey(row.location);
    if (!parsed) {
      errors.push(`Local inválido: ${row.location}`);
      return;
    }

    let shelf = tempShelves.find(item => item.id === parsed.shelf);
    if (!shelf) {
      const shelfParsedRows = shelfRows[parsed.shelf] || [];
      shelf = {
        id: parsed.shelf,
        floors: Math.max(...shelfParsedRows.map(item => item.floor), 1),
        drawers: Math.max(...shelfParsedRows.map(item => item.drawer), 1),
        maxKg: 50,
      };
      tempShelves.push(shelf);
      createdShelves++;
    }

    if (parsed.floor < 1 || parsed.floor > shelf.floors) {
      errors.push(`Andar inválido: ${row.location}`);
      return;
    }
    if (parsed.drawer < 1 || parsed.drawer > shelf.drawers) {
      errors.push(`Gaveta inválida: ${row.location}`);
      return;
    }

    const existingProducts = tempProducts[row.location] || [];
    const existingDrawerKg = existingProducts.reduce((sum, product) => sum + (parseFloat(product.kg) || 0), 0);
    const incomingKg = parseFloat(row.kg) || 0;
    const drawerCapacity = shelf.maxKg || 50;
    if (existingDrawerKg + incomingKg > drawerCapacity) {
      errors.push(`Peso acima da gaveta em ${row.location}`);
      return;
    }

    const shelfUsedKg = Object.entries(tempProducts).reduce((sum, [key, items]) => {
      const keyParsed = parseKey(key);
      if (!keyParsed || keyParsed.shelf !== shelf.id) return sum;
      return sum + items.reduce((acc, product) => acc + (parseFloat(product.kg) || 0), 0);
    }, 0);
    const shelfProjectedKg = shelfUsedKg + incomingKg;
    const shelfCapacityKg = getShelfCapacityKg(shelf);
    if (shelfProjectedKg > shelfCapacityKg) {
      errors.push(`Capacidade da prateleira excedida: ${row.location}`);
      return;
    }

    const depotUsedKg = Object.values(tempProducts).reduce((sum, items) => {
      return sum + items.reduce((acc, product) => acc + (parseFloat(product.kg) || 0), 0);
    }, 0);
    const depotCapacityKg = tempShelves.reduce((sum, item) => sum + getShelfCapacityKg(item), 0);
    if (depotUsedKg + incomingKg > depotCapacityKg) {
      errors.push(`Capacidade do depósito excedida: ${row.location}`);
      return;
    }

    if (!tempProducts[row.location]) tempProducts[row.location] = [];
    tempProducts[row.location].push({ code: row.code, name: row.name, kg: row.kg, entry: row.entry, exit: row.exit });
    addedRows++;
  });

  return { errors, createdShelves, addedRows };
}

function previewImport() {
  const resultBox = document.getElementById('import-result-box');
  resultBox.style.display = 'block';
  try {
    const rows = parseCSV(csvParsedData);
    const preview = validateImportRows(rows);
    if (preview.errors.length) { resultBox.className = 'import-result error'; resultBox.textContent = preview.errors.slice(0,5).join(' | '); return; }
    resultBox.className = 'import-result success';
    resultBox.textContent = `✔ ${preview.addedRows} registros válidos encontrados${preview.createdShelves ? `, ${preview.createdShelves} nova(s) prateleira(s)` : ''}. Clique em CONFIRMAR para importar.`;
    document.getElementById('btn-confirm-import').style.display = 'inline-block';
  } catch(err) {
    resultBox.className = 'import-result error';
    resultBox.textContent = '✖ Erro: ' + err.message;
  }
}

async function confirmImport() {
  if (!await requirePermission('settings.manage', 'Seu perfil não pode importar dados.')) return;
  const resultBox = document.getElementById('import-result-box');
  try {
    const rows = parseCSV(csvParsedData);
    const preview = validateImportRows(rows);
    if (preview.errors.length) throw new Error(preview.errors[0]);
    let added = 0, newShelves = 0;
    rows.forEach(r => {
      const p = parseKey(r.location);
      if (!p) return;
      // auto-create shelf if not exists
      if (!shelves.find(s => s.id === p.shelf)) {
        const maxFloor = rows.filter(x => parseKey(x.location)?.shelf === p.shelf).reduce((m, x) => Math.max(m, parseKey(x.location)?.floor || 0), 0);
        const maxDrawer = rows.filter(x => parseKey(x.location)?.shelf === p.shelf).reduce((m, x) => Math.max(m, parseKey(x.location)?.drawer || 0), 0);
        shelves.push({ id: p.shelf, floors: Math.max(maxFloor, 6), drawers: Math.max(maxDrawer, 4) });
        newShelves++;
      }
      if (!products[r.location]) products[r.location] = [];
      products[r.location].push({ code: r.code, name: r.name, kg: r.kg, entry: r.entry, exit: r.exit });
      added++;
    });
    resultBox.className = 'import-result success';
    resultBox.textContent = `✔ Importado com sucesso! ${added} produto(s) adicionados${newShelves ? ', ' + newShelves + ' prateleira(s) criada(s)' : ''}.`;
    document.getElementById('btn-confirm-import').style.display = 'none';
    csvParsedData = null;
    renderAll();
  } catch(err) {
    resultBox.className = 'import-result error';
    resultBox.textContent = '✖ Erro: ' + err.message;
  }
}

// ——— EXPORTS ———
function exportProductsCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = ['location,code,name,kg,entry,exit'];
  Object.entries(products).forEach(([loc, prods]) => {
    prods.forEach(p => rows.push([loc, p.code, p.name, p.kg, p.entry, p.exit].join(',')));
  });
  downloadFile('wms_produtos.csv', rows.join('\n'), 'text/csv');
}

function exportShelvesCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = ['id,floors,drawers'];
  shelves.forEach(s => rows.push([s.id, s.floors, s.drawers].join(',')));
  downloadFile('wms_prateleiras.csv', rows.join('\n'), 'text/csv');
}

function exportSummaryCSV() {
  if (!hasPermission('settings.manage')) return;
  const rows = ['code,name,qty,total_kg,locations'];
  getAllProducts().forEach(p => {
    rows.push([p.code, p.name, p.qty, p.kg.toFixed(2), '"' + p.locations.join(';') + '"'].join(','));
  });
  downloadFile('wms_resumo.csv', rows.join('\n'), 'text/csv');
}

function exportFullJSON() {
  if (!hasPermission('settings.manage')) return;
  const data = JSON.stringify({
    depots,
    activeDepotId,
    shelvesAll,
    productsAll,
    history: auditHistory,
    outboundRecords,
    blindCountPool,
    blindCountRecords,
    activeBlindUnloadId,
    floorplan: { layout: fpLayout, objects: fpObjects, objSeq: fpObjIdSeq },
  }, null, 2);
  downloadFile('wms_backup.json', data, 'application/json');
}

function handleJSONFile(file) {
  if (!hasPermission('settings.manage')) return;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const resultBox = document.getElementById('json-result-box');
    resultBox.style.display = 'block';
    try {
      const data = JSON.parse(e.target.result);
      const isLegacy = Array.isArray(data.shelves) && data.products && typeof data.products === 'object';
      const isFullBackup = Array.isArray(data.depots) && data.shelvesAll && data.productsAll;
      if (!isLegacy && !isFullBackup) throw new Error('Formato inválido.');
      showConfirm({ title:'RESTAURAR BACKUP', icon:'📂', desc:'Isto substituirá todos os dados atuais. Continuar?', okLabel:'RESTAURAR', okStyle:'danger' }).then(ok => {
        if (!ok) return;
        if (isFullBackup) {
          depots = data.depots;
          activeDepotId = data.activeDepotId || data.depots[0]?.id || 'dep1';
          shelvesAll = data.shelvesAll;
          productsAll = data.productsAll;
          auditHistory = Array.isArray(data.history) ? data.history : [];
          outboundRecords = Array.isArray(data.outboundRecords) ? data.outboundRecords : [];
          blindCountPool = Array.isArray(data.blindCountPool) ? data.blindCountPool : [];
          blindCountRecords = Array.isArray(data.blindCountRecords) ? data.blindCountRecords : [];
          ensureDepotState();
          const fp = data.floorplan || {};
          fpLayout = fp.layout || {};
          fpObjects = fp.objects || [];
          fpObjIdSeq = fp.objSeq || 0;
          fpSaveLayout();
        } else {
          shelvesAll[activeDepotId] = data.shelves;
          productsAll[activeDepotId] = data.products;
          shelves = shelvesAll[activeDepotId];
          products = productsAll[activeDepotId];
        }
        renderAll();
        resultBox.className = 'import-result success';
        resultBox.textContent = '✔ Backup restaurado com sucesso!';
      });
    } catch(err) {
      resultBox.className = 'import-result error';
      resultBox.textContent = '✖ Erro: ' + err.message;
    }
  };
  reader.readAsText(file);
}

async function clearAllData() {
  if (!await requirePermission('clear.all', 'Somente admin e master podem limpar tudo.')) return;
  const okAll = await showConfirm({ title:'APAGAR TODOS OS DADOS', icon:'💀', desc:'ATENÇÃO: Esta ação apaga TODOS os depósitos, prateleiras e produtos permanentemente. Não pode ser desfeita!', okLabel:'APAGAR TUDO', okStyle:'danger' }); if(!okAll) return;
  depots = [];
  activeDepotId = null;
  shelvesAll = {};
  productsAll = {};
  shelves = [];
  products = {};
  auditHistory = [];
  outboundRecords = [];
  blindCountPool = [];
  blindCountRecords = [];
  fpLayout = {};
  fpObjects = [];
  fpObjIdSeq = 0;
  renderAll();
  closeSettingsModal();
}

function editCurrentProductBaseData() {
  if (!currentViewedProduct) return;
  // Fecha o modal de detalhes antes de abrir o formulário de edição
  document.getElementById('prod-detail-modal').classList.remove('open');
  openProductFormModal(currentViewedProduct);
}

function openProductFormModal(productData = null) {
  const modal = document.getElementById('product-form-modal');
  const title = document.getElementById('product-form-title');
  const form = document.getElementById('product-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('pf-id').value = '';
  document.getElementById('pf-code').disabled = false;

  if (productData) {
    title.textContent = 'EDITAR PRODUTO';
    document.getElementById('pf-id').value = productData.id || '';
    document.getElementById('pf-code').value = productData.code || '';
    document.getElementById('pf-code').disabled = true; // Código geralmente não muda
    document.getElementById('pf-name').value = productData.name || '';
    document.getElementById('pf-sku').value = productData.sku || '';
    document.getElementById('pf-ean').value = productData.ean || '';
    document.getElementById('pf-unit').value = (productData.unit || 'UN').toUpperCase();
    document.getElementById('pf-family').value = productData.family || '';
    document.getElementById('pf-category').value = productData.category || '';
    document.getElementById('pf-brand').value = productData.brand || '';
    document.getElementById('pf-perishable').checked = !!productData.is_perishable;
    document.getElementById('pf-expiry-control').checked = !!productData.expiry_control;
    document.getElementById('pf-notes').value = productData.notes || '';
  } else {
    title.textContent = 'CADASTRAR PRODUTO';
  }

  modal.classList.add('open');
  document.getElementById('pf-code').focus();
}

function closeProductFormModal() {
  const modal = document.getElementById('product-form-modal');
  if (modal) modal.classList.remove('open');
}

async function saveProduct() {
  const id = document.getElementById('pf-id').value;
  const payload = {
    code: document.getElementById('pf-code').value.trim().toUpperCase(),
    name: document.getElementById('pf-name').value.trim().toUpperCase(),
    sku: document.getElementById('pf-sku').value.trim(),
    ean: document.getElementById('pf-ean').value.trim(),
    unit: document.getElementById('pf-unit').value,
    family: document.getElementById('pf-family').value.trim(),
    category: document.getElementById('pf-category').value.trim(),
    brand: document.getElementById('pf-brand').value.trim(),
    is_perishable: document.getElementById('pf-perishable').checked,
    expiry_control: document.getElementById('pf-expiry-control').checked,
    notes: document.getElementById('pf-notes').value.trim()
  };

  try {
    if (id) {
      await apiCall(`/wms/products/${encodeURIComponent(id)}`, 'PUT', payload);
      showToast('Produto atualizado com sucesso.', 'success');
    } else {
      await apiCall('/wms/products', 'POST', payload);
      showToast('Produto cadastrado com sucesso.', 'success');
    }
    closeProductFormModal();
    if (typeof loadAppState === 'function') await loadAppState(true);
  } catch (err) {
    showToast('Erro ao salvar produto: ' + err.message, 'danger');
  }
}

// ——— DOWNLOAD HELPER ———
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportProductsCsv() {
  if (!canManageProducts()) return;
  try {
    const response = await fetch('/api/wms/products/export/csv', {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem(getAuthTokenStorageKey())}` }
    });
    if (!response.ok) throw new Error('Falha ao exportar');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wms_products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Exportação concluída.', 'success');
  } catch (err) {
    showToast('Erro na exportação: ' + err.message, 'danger');
  }
}

function triggerProductImport() {
  const input = document.getElementById('product-import-input');
  if (input) input.click();
}

async function importProductsCsv(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    try {
      const stats = await apiCall('/wms/products/import/csv', 'POST', text);
      await showNotice({
        title: 'IMPORTAÇÃO CONCLUÍDA',
        icon: '📥',
        desc: `Processamento finalizado com sucesso.`,
        summary: {
          CRIADOS: stats.created,
          ATUALIZADOS: stats.updated,
          ERROS: stats.errors
        }
      });
      input.value = '';
      if (typeof loadAppState === 'function') await loadAppState(true);
    } catch (err) {
      showToast('Falha na importação: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file);
}
