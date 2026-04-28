import React, { useState } from 'react';
import './PickingPage.css';

interface PickingItem {
  id: string;
  sku: string;
  name: string;
  location: string;
  qty: number;
  status: 'Pendente' | 'Coletado';
}

const PickingPage: React.FC = () => {
  const [items, setItems] = useState<PickingItem[]>([
    { id: '1', sku: 'P001', name: 'Parafuso M6x20', location: 'A1.G1', qty: 50, status: 'Pendente' },
    { id: '2', sku: 'E011', name: 'Lâmpada LED 9W', location: 'B2.G1', qty: 5, status: 'Pendente' },
    { id: '3', sku: 'Q004', name: 'Fita Isolante 20m', location: 'B2.G2', qty: 2, status: 'Pendente' },
  ]);

  const handlePick = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, status: 'Coletado' } : item));
  };

  return (
    <div className="picking-page">
      <div className="picking-header">
        <div className="header-info">
          <h1>Lista de Separação (Picking)</h1>
          <p>Rota otimizada via Algoritmo A* para menor percurso.</p>
        </div>
        <div className="picking-stats">
          <div className="p-stat"><strong>{items.filter(i => i.status === 'Coletado').length}</strong> / {items.length} Itens</div>
        </div>
      </div>

      <div className="picking-roadmap">
        <div className="roadmap-path">
          <span className="node start">Doca</span>
          <span className="link"></span>
          <span className="node">A1</span>
          <span className="link"></span>
          <span className="node">B2</span>
          <span className="link"></span>
          <span className="node end">Expedição</span>
        </div>
      </div>

      <div className="picking-list">
        {items.map((item) => (
          <div key={item.id} className={`picking-card ${item.status.toLowerCase()}`}>
            <div className="card-loc">{item.location}</div>
            <div className="card-main">
              <div className="card-sku">{item.sku}</div>
              <div className="card-name">{item.name}</div>
              <div className="card-qty">Coletar: <strong>{item.qty} un</strong></div>
            </div>
            {item.status === 'Pendente' ? (
              <button className="btn btn-accent" onClick={() => handlePick(item.id)}>CONFIRMAR COLETA</button>
            ) : (
              <div className="card-done">✅ COLETADO</div>
            )}
          </div>
        ))}
      </div>

      <div className="picking-footer">
        <button className="btn btn-big btn-accent" disabled={items.some(i => i.status === 'Pendente')}>
          FINALIZAR E GERAR ETIQUETAS DE EXPEDIÇÃO
        </button>
      </div>
    </div>
  );
};

export default PickingPage;
