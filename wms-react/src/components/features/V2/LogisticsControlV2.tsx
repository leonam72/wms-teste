import React from 'react';
import './LogisticsControlV2.css';
import { useWMSStore } from '../../../store/useWMSStore';

const LogisticsControlV2: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const shelves = useWMSStore(state => state.shelvesAll[activeDepotId] || []);

  // KPIs de Analytics - Ref: analytics_e_produtividade/code.html L120
  const kpis = [
    { label: 'Tempo Médio Tarefa', value: '12.5 min', trend: '-5%', up: false },
    { label: 'Eficiência Geral', value: '94.2%', trend: '+2.1%', up: true },
    { label: 'Tarefas Concluídas', value: '1.280', trend: '+12%', up: true },
    { label: 'Volume Movimentado', value: '12.4t', trend: 'Meta: 15t', up: null },
  ];

  // Sugestões de Slotting - Ref: gerenciamento_de_produtos_visualwms/code.html L258
  const slottingSuggestions = [
    { sku: 'P001', action: 'Mover para F1', reason: 'Prioridade Alta (A)', type: 'fast' },
    { sku: 'E011', action: 'Consolidar em B2', reason: 'Otimização de Espaço', type: 'normal' },
    { sku: 'M001', action: 'Subir para F6', reason: 'Baixo Giro (C)', type: 'slow' }
  ];

  return (
    <div className="logistics-v2-container">
      <div className="workspace-header">
        <div className="ws-title"><strong>WMS PRO EXPERT</strong> — Cockpit de Alta Performance</div>
        <div className="v2-time-badge">
          <span className="material-symbols-outlined">timer</span>
          Turno: 06:42:15
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="v2-kpi-grid">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="v2-kpi-card">
            <span className="kpi-label">{kpi.label}</span>
            <div className="kpi-value-row">
              <span className="kpi-value">{kpi.value}</span>
              {kpi.trend && (
                <span className={`kpi-trend ${kpi.up === true ? 'up' : kpi.up === false ? 'down' : ''}`}>
                  {kpi.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="v2-main-grid">
        {/* Heatmap Card - Ref: editor_de_planta_baixa_inteligente/code.html L34 */}
        <div className="v2-card heatmap-card">
          <div className="card-header">
            <h3>📊 Mapa de Calor (Ocupação)</h3>
            <span className="v2-badge">LIVE</span>
          </div>
          <div className="heatmap-preview">
            {shelves.map(s => {
              const occupancy = Math.random() * 100;
              return (
                <div key={s.id} className="heatmap-bar">
                  <span className="bar-label">{s.id}</span>
                  <div className="bar-outer">
                    <div 
                      className="bar-inner" 
                      style={{ 
                        width: `${occupancy}%`, 
                        backgroundColor: occupancy > 80 ? '#ef4444' : occupancy > 50 ? '#f59e0b' : '#137fec' 
                      }}
                    />
                  </div>
                  <span className="bar-pct">{Math.round(occupancy)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Slotting Advisor (IA) */}
        <div className="v2-card">
          <div className="card-header">
            <h3>🧠 Slotting Advisor (IA)</h3>
          </div>
          <div className="v2-list">
            {slottingSuggestions.map((s, i) => (
              <div key={i} className={`v2-list-item ${s.type}`}>
                <div className="item-main">
                  <strong>{s.sku}</strong>: {s.action}
                </div>
                <span className="v2-tag">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dock Management - Ref: gestao_de_docas/code.html L140 */}
        <div className="v2-card">
          <div className="card-header">
            <h3>🚛 Monitoramento de Docas</h3>
            <span className="status-dot green"></span>
          </div>
          <div className="dock-item active">
            <div className="dock-info">
              <span className="dock-id">DOCA 01</span>
              <span className="dock-op">Descarregamento</span>
            </div>
            <div className="dock-timer">00:42:15</div>
          </div>
          <div className="dock-item idle">
            <span className="dock-id">DOCA 02</span>
            <span className="dock-status">DISPONÍVEL</span>
          </div>
        </div>

        {/* Picking Roadmap - Ref: visualwms_movimentação_avançada/code.html L106 */}
        <div className="v2-card">
          <div className="card-header">
            <h3>🚀 Rota de Picking Otimizada (A*)</h3>
          </div>
          <div className="roadmap-preview">
            <div className="path-node start">DOCA</div>
            <div className="path-arrow">↓</div>
            <div className="path-node accent">SETOR A (P001)</div>
            <div className="path-arrow">↓</div>
            <div className="path-node accent">SETOR C (E011)</div>
            <div className="path-arrow">↓</div>
            <div className="path-node end">EXPEDIÇÃO</div>
          </div>
        </div>
      </div>
    </div>
  );
};
};

export default LogisticsControlV2;
