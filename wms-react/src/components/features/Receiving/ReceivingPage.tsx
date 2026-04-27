import React, { useState, useMemo, useRef } from 'react';
import { parseNFeXML } from '../../../services/nfeService';
import './ReceivingPage.css';

interface ReceivingItem {
  sku: string;
  name: string;
  expected: number;
  counted: number;
}

const ReceivingPage: React.FC = () => {
  const [items, setItems] = useState<ReceivingItem[]>([
    { sku: 'SKU-9082', name: 'Parafuso Sextavado M8x40', expected: 500, counted: 485 },
    { sku: 'SKU-1124', name: 'Arruela de Pressão 8mm', expected: 120, counted: 125 },
    { sku: 'SKU-4432', name: 'Porca Autotravante M8', expected: 300, counted: 300 },
    { sku: 'SKU-7721', name: 'Pino Elástico 5x30', expected: 100, counted: 92 },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const totalDivergences = items.filter(i => i.expected !== i.counted).length;
    return {
      totalItems: items.length,
      divergences: totalDivergences,
      accuracy: items.length > 0 ? ((items.length - totalDivergences) / items.length * 100).toFixed(1) : '100.0'
    };
  }, [items]);

  const handleXMLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xml = event.target?.result as string;
        const parsedItems = parseNFeXML(xml);
        
        if (parsedItems.length > 0) {
          const newItems = parsedItems.map(p => ({
            sku: p.code,
            name: p.name,
            expected: p.qty,
            counted: 0 // Inicia zerado para contagem cega
          }));
          setItems(newItems);
        } else {
          alert('Nenhum produto encontrado no XML.');
        }
      } catch (err) {
        console.error('Erro ao processar XML da NF-e:', err);
        alert('Erro ao processar o arquivo XML. Formato inválido.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="receiving-page">
      <div className="receiving-header">
        <div className="header-info">
          <h1>Validação de Conferência (Recebimento)</h1>
          <p>Lote #REC-2023-0892 - Status: Aguardando Validação</p>
        </div>
        <div className="header-actions">
          <input 
            type="file" 
            accept=".xml" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={handleXMLUpload}
          />
          <button className="btn" onClick={() => fileInputRef.current?.click()}>Importar XML NF-e</button>
          <button className="btn">Imprimir Divergências</button>
          <button className="btn btn-accent">Concluir Recebimento</button>
        </div>
      </div>

      <div className="receiving-stats">
        <div className="r-stat">
          <span className="r-lab">Total de SKUs</span>
          <span className="r-val">{stats.totalItems}</span>
        </div>
        <div className={`r-stat ${stats.divergences > 0 ? 'alert' : ''}`}>
          <span className="r-lab">Divergências</span>
          <span className="r-val">{stats.divergences}</span>
        </div>
        <div className="r-stat">
          <span className="r-lab">Acuracidade</span>
          <span className="r-val">{stats.accuracy}%</span>
        </div>
      </div>

      <div className="divergence-table-container">
        <table className="receiving-table">
          <thead>
            <tr>
              <th>SKU / Produto</th>
              <th>Qtd. Esperada (NF)</th>
              <th>Qtd. Contada (Cega)</th>
              <th>Diferença (Delta)</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const delta = item.counted - item.expected;
              const status = delta === 0 ? 'ok' : delta < 0 ? 'falta' : 'sobra';
              return (
                <tr key={idx} className={status}>
                  <td>
                    <div className="sku-cell">
                      <strong>{item.sku}</strong>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>{item.expected}</td>
                  <td className="bold">{item.counted}</td>
                  <td>
                    <span className={`delta-val ${status}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  </td>
                  <td>
                    <span className={`receiving-badge ${status}`}>{status.toUpperCase()}</span>
                  </td>
                  <td>
                    <button className="btn-small">Recontar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="receiving-footer-actions">
        <button className="btn btn-big btn-outline">Solicitar Recontagem Total</button>
        <button className="btn btn-big btn-accent">Aprovar e Liberar para Putaway</button>
      </div>
    </div>
  );
};

export default ReceivingPage;
