import React, { useState } from 'react';
import { parseNFeXML } from '../../../services/nfeService';
import type { ParsedNFeItem } from '../../../services/nfeService';
import { useWMSStore } from '../../../store/useWMSStore';
import './ReceivingPage.css';

const ReceivingPage: React.FC = () => {
  const [parsedItems, setParsedItems] = useState<ParsedNFeItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const addProductToDrawer = useWMSStore(state => state.addProductToDrawer);
  const logAction = useWMSStore(state => state.logAction);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const xmlString = event.target?.result as string;
      try {
        const items = parseNFeXML(xmlString);
        setParsedItems(items);
      } catch (err) {
        alert('Erro ao processar o arquivo XML da NFe.');
        setParsedItems([]);
      }
    };
    reader.readAsText(file);
  };

  const handleReceiveAll = () => {
    if (parsedItems.length === 0) return;

    // Coloca todos os itens na doca de entrada (RECEBIMENTO)
    // Num sistema complexo, haveria um slotting inteligente aqui
    parsedItems.forEach(item => {
      addProductToDrawer('RECEBIMENTO', {
        code: item.code,
        name: item.name,
        qty: item.qty,
        unit: item.unit as any,
        kg: item.kg,
        entry: new Date().toISOString().split('T')[0],
        expiries: item.expiry ? [item.expiry] : []
      });
    });

    logAction('📥', `Entrada em Massa (NFe)`, `${parsedItems.length} SKUs adicionados na Doca via NFe.`);
    alert('Produtos recebidos com sucesso na Doca de Recebimento!');
    setParsedItems([]);
    setFileName(null);
  };

  return (
    <div className="receiving-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>RECEBIMENTO</strong> {' - '} Importação de NF-e (XML)
        </div>
      </div>

      <div className="nfe-upload-zone">
        <p>Faça upload do arquivo XML da Nota Fiscal para dar entrada automática no sistema.</p>
        <input 
          type="file" 
          accept=".xml" 
          id="nfe-upload" 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />
        <label htmlFor="nfe-upload" className="btn btn-accent">
          {fileName ? 'TROCAR ARQUIVO XML' : 'SELECIONAR XML DA NFe'}
        </label>
        {fileName && <span className="nfe-file-name">{fileName}</span>}
      </div>

      {parsedItems.length > 0 && (
        <div className="nfe-results">
          <div className="nfe-results-header">
            <h3>{parsedItems.length} SKUs identificados na Nota</h3>
            <button className="btn btn-accent" onClick={handleReceiveAll}>
              RECEBER TUDO (ENVIAR PARA DOCA)
            </button>
          </div>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>CÓDIGO (SKU)</th>
                <th>DESCRIÇÃO DO PRODUTO</th>
                <th>QTD</th>
                <th>UN</th>
                <th>PESO/VL UNIT</th>
                <th>VALIDADE</th>
              </tr>
            </thead>
            <tbody>
              {parsedItems.map((item, i) => (
                <tr key={`${item.code}-${i}`}>
                  <td className="sku-cell">{item.code}</td>
                  <td>{item.name}</td>
                  <td className="qty-cell">{item.qty}</td>
                  <td>{item.unit}</td>
                  <td>{item.kg}</td>
                  <td>{item.expiry ? new Date(item.expiry).toLocaleDateString('pt-BR') : 'N/D'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReceivingPage;
