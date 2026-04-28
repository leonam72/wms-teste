import React, { useState, useEffect } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './LogisticsControlV2.css';

interface Dock {
  id: string;
  code: string;
  type: string;
  status: string;
  carrier?: string;
  startTime?: number;
}

const LogisticsControlV2: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const fetchDocks = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/state/${activeDepotId}`);
        const data = await response.json();
        if (data.depot?.docks) {
            setDocks(data.depot.docks);
        }
      } catch (err) {
        console.error("Erro ao carregar docas reais");
      }
    };
    fetchDocks();
  }, [activeDepotId]);

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
          <h1>Logística de Docas (SQL Real)</h1>
          <p>Monitoramento ativo das unidades de carga.</p>
        </div>
        <div className="v2-status-pill">
          <span className="online-indicator"></span>
          BACKEND SQL ONLINE
        </div>
      </div>

      <div className="docks-grid">
        {docks.map((dock) => (
          <div key={dock.id} className={`dock-card ${dock.status.toLowerCase()}`}>
            <div className="dock-label">{dock.code}</div>
            <div className="dock-content">
              <div className="dock-info">
                <h3>{dock.type === 'Inbound' ? '📦 Descarga' : '🚚 Carga'}</h3>
                <p className="carrier">{dock.carrier || 'Livre'}</p>
                <div className={`status-badge ${dock.status.toLowerCase()}`}>{dock.status}</div>
              </div>
              {dock.status === 'Ativo' && dock.startTime && (
                <div className="dock-timer">
                  <span className="timer-icon">🕒</span>
                  <span className="timer-value">{formatTime(now - dock.startTime)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogisticsControlV2;
