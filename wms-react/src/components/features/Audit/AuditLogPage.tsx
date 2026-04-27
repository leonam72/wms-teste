import React, { useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './AuditLogPage.css';

const AuditLogPage: React.FC = () => {
  const history = useWMSStore((state) => state.appHistory);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter(h => 
    h.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.sku && h.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportCSV = () => {
    const header = 'Data;Usuário;Ação;Detalhe;SKU;Origem;Destino;Dispositivo\n';
    const rows = filteredHistory.map(h => [
      new Date(h.ts).toLocaleString(),
      h.user || 'Leonam Admin',
      h.action,
      h.detail.replace(/;/g, ','),
      h.sku || '',
      h.from || '',
      h.to || '',
      h.device || 'Web Desktop'
    ].join(';')).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div className="header-info">
          <h1>Rastro de Auditoria</h1>
          <p>Log completo de eventos, movimentações e alterações de layout.</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={handleExportCSV}>Exportar CSV</button>
          <button className="btn btn-accent">Atualizar Logs</button>
        </div>
      </div>

      <div className="audit-stats">
        <div className="stat-card">
          <span className="stat-icon">🔀</span>
          <div className="stat-data">
            <span className="stat-label">Movimentações Hoje</span>
            <span className="stat-value">{history.filter(h => h.action.includes('Movimentação')).length}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👤</span>
          <div className="stat-data">
            <span className="stat-label">Usuários Ativos</span>
            <span className="stat-value">1</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚠️</span>
          <div className="stat-data">
            <span className="stat-label">Alertas de Sistema</span>
            <span className="stat-value">0</span>
          </div>
        </div>
      </div>

      <div className="audit-filters">
        <div className="filter-group">
          <label>Pesquisar</label>
          <input 
            placeholder="Buscar SKU, ação ou detalhe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Tipo de Ação</label>
          <select>
            <option>Todas as Ações</option>
            <option>Movimentação</option>
            <option>Alteração de Layout</option>
            <option>Login</option>
          </select>
        </div>
      </div>

      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Data & Hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>SKU / ID</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Dispositivo</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length > 0 ? filteredHistory.map((h, i) => (
              <tr key={i}>
                <td>{new Date(h.ts).toLocaleString()}</td>
                <td>
                  <div className="user-pill">
                    <span className="user-avatar">{h.user?.substring(0,2) || 'LA'}</span>
                    {h.user || 'Leonam Admin'}
                  </div>
                </td>
                <td>
                  <span className={`action-badge ${h.action.toLowerCase()}`}>
                    {h.icon} {h.action}
                  </span>
                </td>
                <td className="mono">{h.sku || '-'}</td>
                <td className="dim">{h.from || '-'}</td>
                <td className="dim">{h.to || '-'}</td>
                <td className="dim small">{h.device || 'Web Desktop'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogPage;
