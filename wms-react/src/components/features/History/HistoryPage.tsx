import React, { useState, useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { formatDateTime } from '../../../utils/helpers';
import './HistoryPage.css';

const HistoryPage: React.FC = () => {
  const history = useWMSStore((state) => state.appHistory);
  const [skuFilter, setSkuFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const matchSku = skuFilter === '' || h.action.toLowerCase().includes(skuFilter.toLowerCase()) || h.detail.toLowerCase().includes(skuFilter.toLowerCase());
      const matchAction = actionFilter === '' || h.action.toLowerCase().includes(actionFilter.toLowerCase());
      return matchSku && matchAction;
    });
  }, [history, skuFilter, actionFilter]);

  return (
    <div className="history-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>HISTÓRICO / AUDITORIA</strong> {' - '} Movimentações
        </div>
        <div className="history-filters">
          <input 
            type="text" 
            className="hist-input" 
            placeholder="Buscar SKU ou Detalhe..." 
            value={skuFilter}
            onChange={(e) => setSkuFilter(e.target.value)}
          />
          <select 
            className="hist-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">TODAS AS AÇÕES</option>
            <option value="Entrada">ENTRADAS</option>
            <option value="Saída">SAÍDAS</option>
            <option value="Movimentação">TRANSFERÊNCIAS</option>
          </select>
        </div>
      </div>
      
      <div className="history-list">
        {filteredHistory.length === 0 ? (
          <div className="empty-msg">Nenhuma movimentação encontrada</div>
        ) : (
          filteredHistory.map((h, idx) => (
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
