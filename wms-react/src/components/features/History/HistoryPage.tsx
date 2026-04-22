import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { formatDateTime } from '../../../utils/helpers';
import './HistoryPage.css';

const HistoryPage: React.FC = () => {
  const history = useWMSStore((state) => state.appHistory);

  return (
    <div className="history-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>HISTÓRICO</strong> — Movimentações
        </div>
      </div>
      
      <div className="history-list">
        {history.length === 0 ? (
          <div className="empty-msg">Nenhuma movimentação registrada</div>
        ) : (
          history.map((h, idx) => (
            <div key={`${h.ts}-${idx}`} className="hist-item">
              <div className="hist-icon">{h.icon}</div>
              <div className="hist-body">
                <div className="hist-action">{h.action}</div>
                <div className="hist-meta">{h.detail}</div>
              </div>
              <div className="hist-time">{formatDateTime(h.ts)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
