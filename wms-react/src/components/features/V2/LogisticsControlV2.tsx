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
  const updateDockStatus = useWMSStore(state => state.updateDockStatus);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    fetchDocks();
  }, [activeDepotId]);

  const handleStart = async (dockId: string) => {
    const carrier = prompt('Nome da Transportadora:');
    if (carrier) {
        await updateDockStatus(dockId, 'Ativo', carrier, Date.now());
        fetchDocks();
    }
  };

  const handleFinish = async (dockId: string) => {
    if (confirm('Deseja finalizar a operação e liberar a doca?')) {
        await updateDockStatus(dockId, 'Livre', '', 0);
        fetchDocks();
    }
  };

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
            <div className="dock-actions">
              <button className="btn-v2 btn-outline">Ver Detalhes</button>
              {dock.status === 'Ativo' ? (
                <button className="btn-v2 btn-danger" onClick={() => handleFinish(dock.id)}>Finalizar</button>
              ) : (
                <button className="btn-v2 btn-primary" onClick={() => handleStart(dock.id)}>Iniciar</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogisticsControlV2;
