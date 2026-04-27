import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getExpiryStatus, daysUntil } from '../../../utils/expiry';
import './QualityDashboard.css';

const QualityDashboard: React.FC = () => {
  const productsAll = useWMSStore((state) => state.productsAll);
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const products = productsAll[activeDepotId] || {};

  const allItems = useMemo(() => {
    const list: any[] = [];
    Object.entries(products).forEach(([drawerKey, items]) => {
      items.forEach(item => {
        const latestExpiry = item.expiries.length > 0 ? item.expiries[0] : '';
        list.push({
          ...item,
          drawerKey,
          latestExpiry,
          status: getExpiryStatus(latestExpiry),
          days: latestExpiry ? daysUntil(latestExpiry) : Infinity
        });
      });
    });
    return list;
  }, [products]);

  const stats = useMemo(() => {
    return {
      expired: allItems.filter(i => i.status === 'expired').length,
      warn: allItems.filter(i => i.status === 'warn').length,
      ok: allItems.filter(i => i.status === 'ok').length,
      total: allItems.length
    };
  }, [allItems]);

  const criticalItems = useMemo(() => {
    return allItems
      .filter(i => i.status === 'expired' || i.status === 'warn')
      .sort((a, b) => a.days - b.days);
  }, [allItems]);

  return (
    <div className="quality-dashboard">
      <div className="quality-header">
        <div className="title-group">
          <h1>Controle de Qualidade & Validade</h1>
          <p>Monitoramento preventivo de lotes (FEFO) e gestão de quarentena.</p>
        </div>
        <div className="header-actions">
          <button className="btn">Relatório de Perdas</button>
          <button className="btn btn-accent">Bloquear Lotes Vencidos</button>
        </div>
      </div>

      <div className="quality-stats">
        <div className="q-stat expired">
          <span className="q-val">{stats.expired}</span>
          <span className="q-lab">Vencidos</span>
        </div>
        <div className="q-stat warn">
          <span className="q-val">{stats.warn}</span>
          <span className="q-lab">Atenção (30 dias)</span>
        </div>
        <div className="q-stat ok">
          <span className="q-val">{stats.ok}</span>
          <span className="q-lab">Status Ok</span>
        </div>
      </div>

      <div className="critical-section">
        <h2>Itens Críticos (Ação Necessária)</h2>
        <div className="critical-list">
          {criticalItems.length > 0 ? criticalItems.map((item, idx) => (
            <div key={idx} className={`critical-card ${item.status}`}>
              <div className="card-indicator" />
              <div className="card-info">
                <div className="card-row">
                  <span className="item-name">{item.name}</span>
                  <span className={`status-badge ${item.status}`}>
                    {item.status === 'expired' ? 'VENCIDO' : `EM ${item.days} DIAS`}
                  </span>
                </div>
                <div className="card-details">
                  <span>SKU: {item.code}</span>
                  <span>Local: {item.drawerKey}</span>
                  <span>Qtd: {item.qty} {item.unit}</span>
                </div>
              </div>
              <div className="card-actions">
                <button className="btn-small">Mover para Descarte</button>
                <button className="btn-small btn-outline">Auditar</button>
              </div>
            </div>
          )) : (
            <div className="empty-state">
              <span className="icon">✅</span>
              <p>Nenhum item em estado crítico encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;
