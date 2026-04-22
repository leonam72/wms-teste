import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { exportInventoryToCSV, parseInventoryCSV } from '../../../utils/csv';
import './SettingsPage.css';

const EMPTY_PRODUCTS = {};
const EMPTY_SHELVES: any[] = [];
const EMPTY_FPOBJECTS: any[] = [];

const SettingsPage: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || EMPTY_PRODUCTS);
  const logAction = useWMSStore(state => state.logAction);

  const handleExport = () => {
    const csv = exportInventoryToCSV(productsAll);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${activeDepotId}.csv`;
    link.click();
    logAction('💾', 'Exportação CSV', `Inventário exportado (${Object.keys(productsAll).length} locais)`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      try {
        const importedData = parseInventoryCSV(csv);
        // Aqui precisaríamos de uma ação no store para 'replace' ou 'merge' do inventário
        console.log('Dados importados:', importedData);
        alert('Dados processados! Verifique o console.');
        logAction('📥', 'Importação CSV', `Arquivo ${file.name} carregado.`);
      } catch (err) {
        alert('Erro ao processar CSV.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>CONFIGURAÇÕES</strong> {' - '} Gestão de Dados
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h3>EXPORTAR DADOS</h3>
          <p>Baixe todo o inventário do depósito atual no formato CSV para Excel.</p>
          <button className="btn btn-accent" onClick={handleExport}>EXPORTAR INVENTÁRIO (.CSV)</button>
        </section>

        <section className="settings-card">
          <h3>IMPORTAR DADOS</h3>
          <p>Suba uma planilha CSV para carregar o estoque em massa.</p>
          <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} id="import-csv" />
          <label htmlFor="import-csv" className="btn">SELECIONAR ARQUIVO (.CSV)</label>
        </section>

        <section className="settings-card danger">
          <h3>ZONA DE PERIGO</h3>
          <p>Apagar todos os dados do depósito atual. Esta ação é irreversível.</p>
          <button className="btn btn-danger">LIMPAR DEPÓSITO ATUAL</button>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
