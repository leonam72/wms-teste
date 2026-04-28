import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './HomePage.css';

const HomePage: React.FC = () => {
  const productsAll = useWMSStore((state) => state.productsAll);
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const products = productsAll[activeDepotId] || {};

  const stats = useMemo(() => {
    let totalQty = 0;
    let totalSKUs = 0;
    Object.values(products).forEach(items => {
      totalSKUs += items.length;
      items.forEach(i => {
        totalQty += i.qty;
      });
    });

    return {
      totalQty,
      totalSKUs,
      occupancy: 78.4, 
      efficiency: 92.1 
    };
  }, [products]);

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="title-group">
          <h1>Bem-vindo ao WMS Pro</h1>
          <p>Visão geral consolidada da sua operação logística.</p>
        </div>
        <div className="header-actions">
           <button className="btn btn-accent">Relatório Global</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-icon blue">🕒</span>
            <span className="kpi-trend down">-5%</span>
          </div>
          <span className="kpi-label">Tempo Médio Tarefa</span>
          <h3 className="kpi-value">12.5 min</h3>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-icon green">⚡</span>
            <span className="kpi-trend up">+2.1%</span>
          </div>
          <span className="kpi-label">Eficiência Geral</span>
          <h3 className="kpi-value">{stats.efficiency}%</h3>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-icon purple">✅</span>
            <span className="kpi-trend up">+12%</span>
          </div>
          <span className="kpi-label">Tarefas Concluídas</span>
          <h3 className="kpi-value">1,280</h3>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-icon amber">📦</span>
            <span className="kpi-label">Total SKUs</span>
          </div>
          <span className="kpi-label">Itens em Estoque</span>
          <h3 className="kpi-value">{stats.totalSKUs}</h3>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h3>Eficiência por Unidade</h3>
          <div className="bar-chart">
             {/* Mock chart rows */}
            <div className="bar-wrapper"><div className="bar" style={{ height: '70%' }}></div><span>CD NORTE</span></div>
            <div className="bar-wrapper"><div className="bar active" style={{ height: '85%' }}></div><span>CD SUL</span></div>
            <div className="bar-wrapper"><div className="bar" style={{ height: '40%' }}></div><span>CD LESTE</span></div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Ocupação por Unidade</h3>
          <div className="hotspots-list">
            <div className="hotspot-item">
              <div className="hotspot-info"><span>CD NORTE</span><span>88%</span></div>
              <div className="progress-bar"><div className="progress" style={{ width: '88%', background: '#ef4444' }} /></div>
            </div>
            <div className="hotspot-item">
              <div className="hotspot-info"><span>CD SUL</span><span>12%</span></div>
              <div className="progress-bar"><div className="progress" style={{ width: '12%', background: '#10b981' }} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
