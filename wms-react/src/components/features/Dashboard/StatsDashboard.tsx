import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './StatsDashboard.css';

const StatsDashboard: React.FC = () => {
  const productsAll = useWMSStore((state) => state.productsAll);
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const products = productsAll[activeDepotId] || {};

  const stats = useMemo(() => {
    let totalQty = 0;
    let totalSKUs = 0;
    const itemsList: any[] = [];

    Object.values(products).forEach(items => {
      totalSKUs += items.length;
      items.forEach(i => {
        totalQty += i.qty;
        itemsList.push(i);
      });
    });

    return {
      totalQty,
      totalSKUs,
      occupancy: 78.4, // Simulação
      efficiency: 92.1 // Simulação
    };
  }, [products]);

  return (
    <div className="stats-dashboard">
      <div className="stats-header">
        <div className="title-group">
          <h1>Analytics & Produtividade</h1>
          <p>Visão gerencial do desempenho operacional e ocupação do armazém.</p>
        </div>
        <div className="header-actions">
          <div className="time-selector">
            <button className="active">Hoje</button>
            <button>Semana</button>
            <button>Mês</button>
          </div>
          <button className="btn btn-accent">Exportar PDF</button>
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
            <span className="kpi-label">Meta: 1.500</span>
          </div>
          <span className="kpi-label">Volume Movimentado</span>
          <h3 className="kpi-value">12.4t</h3>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h3>Eficiência de Picking por Hora</h3>
          <div className="bar-chart">
            <div className="bar-wrapper"><div className="bar" style={{ height: '40%' }}><span className="bar-tooltip">45 p/h</span></div><span>08h</span></div>
            <div className="bar-wrapper"><div className="bar" style={{ height: '65%' }}><span className="bar-tooltip">72 p/h</span></div><span>10h</span></div>
            <div className="bar-wrapper"><div className="bar" style={{ height: '85%' }}><span className="bar-tooltip">94 p/h</span></div><span>12h</span></div>
            <div className="bar-wrapper"><div className="bar active" style={{ height: '95%' }}><span className="bar-tooltip">105 p/h</span></div><span>14h</span></div>
            <div className="bar-wrapper"><div className="bar" style={{ height: '60%' }}><span className="bar-tooltip">68 p/h</span></div><span>16h</span></div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Ocupação por Zona (Hotspots)</h3>
          <div className="hotspots-list">
            <div className="hotspot-item">
              <div className="hotspot-info">
                <span>Zona A (Picking)</span>
                <span>88%</span>
              </div>
              <div className="progress-bar"><div className="progress" style={{ width: '88%', background: '#ef4444' }} /></div>
            </div>
            <div className="hotspot-item">
              <div className="hotspot-info">
                <span>Zona B (Pulmão)</span>
                <span>65%</span>
              </div>
              <div className="progress-bar"><div className="progress" style={{ width: '65%', background: '#f59e0b' }} /></div>
            </div>
            <div className="hotspot-item">
              <div className="hotspot-info">
                <span>Zona C (Docas)</span>
                <span>32%</span>
              </div>
              <div className="progress-bar"><div className="progress" style={{ width: '32%', background: '#10b981' }} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
