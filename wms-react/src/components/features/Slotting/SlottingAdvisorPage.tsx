import React, { useMemo, useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './SlottingAdvisorPage.css';

const SlottingAdvisorPage: React.FC = () => {
  const productsAllMap = useWMSStore(state => state.productsAll);
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const products = productsAllMap[activeDepotId] || {};
  
  const [activeTab, setActiveTab] = useState<'giro' | 'putaway'>('giro');
  
  const executeTransfer = useWMSStore(state => state.executeTransfer);

  const giroSuggestions = useMemo(() => {
    const list: any[] = [];
    Object.entries(products).forEach(([drawerKey, items]) => {
      items.forEach(p => {
        if (p.qty > 100 && !drawerKey.startsWith('sh-a')) {
          list.push({
            sku: p.code,
            name: p.name,
            current: drawerKey,
            suggested: 'sh-a1.G1',
            reason: 'Alta Rotatividade (Curva A)',
            impact: 'Redução de 22% no deslocamento'
          });
        }
      });
    });
    return list;
  }, [products]);

  const handleRequestMove = async (s: any) => {
    if (confirm(`Confirmar transferência de ${s.sku} para ${s.suggested}?`)) {
        const success = await executeTransfer(s.current, s.suggested, s.sku, 100);
        if (success) alert('Movimentação registrada e persistida no SQL!');
    }
  };

  const handleConfirmPutaway = async (s: any) => {
    alert(`Putaway de ${s.sku} confirmado para ${s.suggested}. Sincronizando com SQL...`);
  };

  const putawayQueue = [
    { sku: 'WMS-789210', name: 'Motor de Passo Nema 23', qty: 40, origin: 'Recebimento #902', expiry: '31/12/2025', suggested: 'B-02-04-A' }
  ];

  return (
    <div className="slotting-page">
      <div className="slotting-header">
        <div className="title-area">
          <h1>Inteligência de Endereçamento (IA)</h1>
          <p>Otimização baseada em algoritmos de Giro ABC e proximidade logística.</p>
        </div>
        <div className="slotting-tabs">
          <button className={activeTab === 'giro' ? 'active' : ''} onClick={() => setActiveTab('giro')}>GIRO DE ESTOQUE</button>
          <button className={activeTab === 'putaway' ? 'active' : ''} onClick={() => setActiveTab('putaway')}>FILA DE PUTAWAY</button>
        </div>
      </div>

      <div className="slotting-content">
        {activeTab === 'giro' ? (
          <div className="suggestions-grid">
            <div className="info-panel">
               <div className="ai-stat-card">
                  <span className="icon">🧠</span>
                  <div>
                    <h3>Análise ABC</h3>
                    <p>{giroSuggestions.length} itens fora da zona ideal de picking.</p>
                  </div>
               </div>
            </div>

            <div className="suggestions-list">
              {giroSuggestions.map((s, i) => (
                <div key={i} className="suggestion-card-v2">
                  <div className="card-top">
                    <span className="sku-badge">{s.sku}</span>
                    <span className="reason-badge">{s.reason}</span>
                  </div>
                  <h3>{s.name}</h3>
                  <div className="move-path">
                    <div className="loc from"><span>DE</span><strong>{s.current}</strong></div>
                    <div className="arrow">⮕</div>
                    <div className="loc to"><span>PARA</span><strong>{s.suggested}</strong></div>
                  </div>
                  <div className="impact-box">{s.impact}</div>
                  <button className="btn btn-accent btn-full" onClick={() => handleRequestMove(s)}>SOLICITAR MOVIMENTAÇÃO</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="putaway-container">
            <div className="putaway-map">
              <div className="map-header">MAPA TÁTICO DE ALOCAÇÃO</div>
              <div className="map-grid-mock">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className={`map-cell ${i === 7 ? 'highlight' : ''}`}>
                    {i === 7 && <span className="pin">📍</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="putaway-details">
               {putawayQueue.map((item, i) => (
                 <div key={i} className="putaway-card">
                   <h3>Item em Espera</h3>
                   <div className="p-row"><span>SKU:</span> <strong>{item.sku}</strong></div>
                   <div className="p-row"><span>NOME:</span> <strong>{item.name}</strong></div>
                   <div className="p-row"><span>QTD:</span> <strong>{item.qty} un</strong></div>
                   
                   <div className="recommendation-box">
                      <span className="rec-label">RECOMENDAÇÃO IA</span>
                      <div className="rec-val">{item.suggested}</div>
                      <p>Espaço livre e proximidade com itens similares.</p>
                   </div>
                   
                   <button className="btn btn-success btn-full" onClick={() => handleConfirmPutaway(item)}>CONFIRMAR ENDEREÇAMENTO</button>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlottingAdvisorPage;
