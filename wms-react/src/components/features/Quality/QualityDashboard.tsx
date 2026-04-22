import React, { useMemo, useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './QualityDashboard.css';

const EMPTY_PRODUCTS = {};

const QualityDashboard: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || EMPTY_PRODUCTS);
  const [search, setSearch] = useState('');

  const qualityData = useMemo(() => {
    const list: any[] = [];
    let noVal = 0, near = 0, expired = 0;

    Object.entries(productsAll).forEach(([location, products]) => {
      products.forEach(p => {
        const status = getProductExpiryStatus(p.expiries);
        const isNoVal = p.expiries.length === 0;

        if (status === 'expired') expired++;
        if (status === 'warn') near++;
        if (isNoVal) noVal++;

        if (status !== 'ok' || isNoVal) {
          if (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())) {
            list.push({ ...p, location, status, isNoVal });
          }
        }
      });
    });

    return { list, stats: { noVal, near, expired } };
  }, [productsAll, search]);

  return (
    <div className="quality-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>GESTÃO DE QUALIDADE</strong> {' - '} Alertas e Conformidade
        </div>
      </div>

      <div className="quality-stats">
        <div className="q-stat-card no-val">
          <div className="q-val">{qualityData.stats.noVal}</div>
          <div className="q-label">Sem Validade</div>
        </div>
        <div className="q-stat-card near">
          <div className="q-val">{qualityData.stats.near}</div>
          <div className="q-label">A Vencer (30d)</div>
        </div>
        <div className="q-stat-card expired">
          <div className="q-val">{qualityData.stats.expired}</div>
          <div className="q-label">Vencidos</div>
        </div>
      </div>

      <div className="quality-filters-row">
        <input 
          type="text" 
          placeholder="🔍 Filtrar por SKU ou Nome..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      <div className="quality-grid">
        {qualityData.list.length > 0 ? (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>PRODUTO</th>
                <th>LOCAL</th>
                <th>STATUS</th>
                <th>VALIDADES</th>
              </tr>
            </thead>
            <tbody>
              {qualityData.list.map((p, i) => (
                <tr key={`${p.code}-${i}`} className={`quality-row ${p.status}`}>
                  <td className="sku-cell">{p.code}</td>
                  <td>{p.name}</td>
                  <td className="loc-cell">{p.location}</td>
                  <td>
                    <span className={`status-tag ${p.isNoVal ? 'none' : p.status}`}>
                      {p.isNoVal ? 'SEM DATA' : p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="expiry-cell">{p.expiries.join(', ') || '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="placeholder-msg">Nenhuma pendência de qualidade encontrada.</div>
        )}
      </div>
    </div>
  );
};

export default QualityDashboard;
