import React, { useState, useEffect } from 'react';
import './LogisticsControlV2.css';

interface DockOperation {
  id: string;
  dock: string;
  type: 'Inbound' | 'Outbound';
  status: 'Ativo' | 'Aguardando' | 'Finalizado';
  carrier: string;
  startTime: number; // timestamp
}

const LogisticsControlV2: React.FC = () => {
  const [operations, setOperations] = useState<DockOperation[]>([
    { id: '1', dock: 'Doca 01', type: 'Inbound', status: 'Ativo', carrier: 'Express Logística S.A.', startTime: Date.now() - 3600000 },
    { id: '2', dock: 'Doca 02', type: 'Outbound', status: 'Ativo', carrier: 'TransNorte BR', startTime: Date.now() - 1200000 },
    { id: '3', dock: 'Doca 03', type: 'Inbound', status: 'Aguardando', carrier: 'Vargas Transp.', startTime: 0 },
  ]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="logistics-v2-page">
      <div className="v2-header">
        <div className="v2-title">
          <h1>Logística de Docas</h1>
          <p>Monitoramento em tempo real de entrada e saída (Inbound/Outbound).</p>
        </div>
        <div className="v2-status-pill">
          <span className="online-indicator"></span>
          SISTEMA ONLINE
        </div>
      </div>

      <div className="v2-tabs">
        <button className="v2-tab active">INBOUND</button>
        <button className="v2-tab">OUTBOUND</button>
        <button className="v2-tab">AGENDAMENTOS</button>
      </div>

      <div className="docks-grid">
        {operations.map((op) => (
          <div key={op.id} className={`dock-card ${op.status.toLowerCase()}`}>
            <div className="dock-label">{op.dock}</div>
            <div className="dock-content">
              <div className="dock-info">
                <h3>{op.type === 'Inbound' ? '📦 Descarregamento' : '🚚 Carregamento'}</h3>
                <p className="carrier">{op.carrier}</p>
                <div className={`status-badge ${op.status.toLowerCase()}`}>{op.status}</div>
              </div>
              {op.status === 'Ativo' && (
                <div className="dock-timer">
                  <span className="timer-icon">🕒</span>
                  <span className="timer-value">{formatTime(now - op.startTime)}</span>
                </div>
              )}
            </div>
            <div className="dock-actions">
              <button className="btn-v2 btn-outline">Ver Detalhes</button>
              {op.status === 'Ativo' ? (
                <button className="btn-v2 btn-danger">Finalizar</button>
              ) : (
                <button className="btn-v2 btn-primary">Iniciar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="queue-section">
        <h2>Fila de Espera</h2>
        <div className="queue-list">
          <div className="queue-item">
            <span className="queue-pos">#1</span>
            <div className="queue-info">
              <strong>Swift Cargo</strong>
              <span>Placa: ABC-1234</span>
            </div>
            <div className="queue-time">Esp: 45 min</div>
            <button className="btn-v2 btn-small">Chamar</button>
          </div>
          <div className="queue-item">
            <span className="queue-pos">#2</span>
            <div className="queue-info">
              <strong>LogiTrans</strong>
              <span>Placa: XYZ-9090</span>
            </div>
            <div className="queue-time">Esp: 12 min</div>
            <button className="btn-v2 btn-small">Chamar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsControlV2;
