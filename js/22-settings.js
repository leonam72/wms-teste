// ╔══════════════════════════════════════════════════════════════════╗
// ║  22-settings.js          Configurações, CSV import/export, JSON      ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— SETTINGS MODAL ———
let csvParsedData = null;

const openSettingsModal = () => {
  document.getElementById('settings-modal').classList.add('open');
  csvParsedData = null;
  document.getElementById('csv-preview-box').style.display = 'none';
  document.getElementById('import-result-box').style.display = 'none';
  document.getElementById('btn-preview-import').style.display = 'none';
  document.getElementById('btn-confirm-import').style.display = 'none';
}
const closeSettingsModal = () => { document.getElementById('settings-modal').classList.remove('open'); }

const switchStab = (name) => {
  document.querySelectorAll('.stab').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.stab-panel').forEach(e => e.classList.remove('active'));
  document.getElementById('stab-' + name).classList.add('active');
  document.getElementById('spanel-' + name).classList.add('active');
}

// ——— DRAG & DROP ———


// ——— SAMPLE CSV ———
const downloadSampleCSV = () => {
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
const handleCSVFile = (file) => {
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

const parseCSV = (text) => {
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
      location: cols[idx('location')].trim().toUpperCase(),
      code: cols[idx('code')].trim().toUpperCase(),
      name: cols[idx('name')].trim(),
      kg: parseFloat(cols[idx('kg')]) || 0,
      entry: cols[idx('entry')].trim(),
      exit: cols[idx('exit')].trim(),
    };
  }).filter(r => r.location && r.code && r.name);
}

const previewImport = () => {
  const resultBox = document.getElementById('import-result-box');
  resultBox.style.display = 'block';
  try {
    const rows = parseCSV(csvParsedData);
    // validate locations
    const errors = [];
    rows.forEach(r => {
      const p = parseKey(r.location);
      if (!p) errors.push(`Local inválido: ${r.location}`);
    });
    if (errors.length) { resultBox.className = 'import-result error'; resultBox.textContent = errors.slice(0,5).join(' | '); return; }
    resultBox.className = 'import-result success';
    resultBox.textContent = `✔ ${rows.length} registros válidos encontrados. Clique em CONFIRMAR para importar.`;
    document.getElementById('btn-confirm-import').style.display = 'inline-block';
  } catch(err) {
    resultBox.className = 'import-result error';
    resultBox.textContent = '✖ Erro: ' + err.message;
  }
}

const confirmImport = async () => {
  const resultBox = document.getElementById('import-result-box');
  try {
    const rows = parseCSV(csvParsedData);
    let added = 0, skippedShelves = [], newShelves = 0;
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
const exportProductsCSV = () => {
  const rows = ['location,code,name,kg,entry,exit'];
  Object.entries(products).forEach(([loc, prods]) => {
    prods.forEach(p => rows.push([loc, p.code, p.name, p.kg, p.entry, p.exit].join(',')));
  });
  downloadFile('wms_produtos.csv', rows.join('\n'), 'text/csv');
}

const exportShelvesCSV = () => {
  const rows = ['id,floors,drawers'];
  shelves.forEach(s => rows.push([s.id, s.floors, s.drawers].join(',')));
  downloadFile('wms_prateleiras.csv', rows.join('\n'), 'text/csv');
}

const exportSummaryCSV = () => {
  const rows = ['code,name,qty,total_kg,locations'];
  getAllProducts().forEach(p => {
    rows.push([p.code, p.name, p.qty, p.kg.toFixed(2), '"' + p.locations.join(';') + '"'].join(','));
  });
  downloadFile('wms_resumo.csv', rows.join('\n'), 'text/csv');
}

const exportFullJSON = () => {
  const data = JSON.stringify({ shelves, products }, null, 2);
  downloadFile('wms_backup.json', data, 'application/json');
}

const handleJSONFile = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const resultBox = document.getElementById('json-result-box');
    resultBox.style.display = 'block';
    try {
      const data = JSON.parse(e.target.result);
      if (!data.shelves || !data.products) throw new Error('Formato inválido.');
      showConfirm({ title:'RESTAURAR BACKUP', icon:'📂', desc:'Isto substituirá todos os dados atuais. Continuar?', okLabel:'RESTAURAR', okStyle:'danger' }).then(ok => {
        if (!ok) return;
        shelves = data.shelves;
        products = data.products;
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

const clearAllData = async () => {
  const okAll = await showConfirm({ title:'APAGAR TODOS OS DADOS', icon:'💀', desc:'ATENÇÃO: Esta ação apaga TODOS os depósitos, prateleiras e produtos permanentemente. Não pode ser desfeita!', okLabel:'APAGAR TUDO', okStyle:'danger' }); if(!okAll) return;
  shelves = []; products = {};
  renderAll();
  closeSettingsModal();
}

// ——— DOWNLOAD HELPER ———
const downloadFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}



