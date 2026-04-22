import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './StatsDashboard.css';

const EMPTY_PRODUCTS = {};
const EMPTY_SHELVES: any[] = [];
const EMPTY_FPOBJECTS: any[] = [];

const StatsDashboard: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const shelves = useWMSStore(state => state.shelvesAll[activeDepotId] || EMPTY_SHELVES);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || EMPTY_PRODUCTS);

  const stats = useMemo(() => {
    const totalDrawers = shelves.reduce((acc, s) => acc + (s.floors * s.drawers), 0);
    const occupiedDrawers = Object.keys(productsAll).filter(key => productsAll[key].length > 0).length;
    const occupationPercent = totalDrawers > 0 ? Math.round((occupiedDrawers / totalDrawers) * 100) : 0;
    
    let totalWeight = 0;
    const uniqueSkus = new Set<string>();

    Object.values(productsAll).forEach(drawerProducts => {
      drawerProducts.forEach(p => {
        totalWeight += (p.qty * p.kg);
        uniqueSkus.add(p.code);
      });
    });

    return {
      totalDrawers,
      occupiedDrawers,
      occupationPercent,
      skuCount: uniqueSkus.size,
      totalWeight: totalWeight.toFixed(1)
    };
  }, [shelves, productsAll]);

  return (
    <div className="stats-dashboard">
      <div className="stat-card">
        <label>PRATELEIRAS</label>
        <div className="stat-val">{shelves.length}</div>
        <div className="stat-sub">{stats.totalDrawers} gavetas total</div>
      </div>
      <div className="stat-card">
        <label>OCUPAÇÃO</label>
        <div className="stat-val">{stats.occupationPercent}%</div>
        <div className="stat-sub">{stats.occupiedDrawers} de {stats.totalDrawers} gavetas</div>
      </div>
      <div className="stat-card">
        <label>PRODUTOS</label>
        <div className="stat-val">{stats.skuCount}</div>
        <div className="stat-sub">SKUs distintos</div>
      </div>
      <div className="stat-card">
        <label>PESO TOTAL</label>
        <div className="stat-val">{stats.totalWeight}</div>
        <div className="stat-sub">kg armazenados</div>
      </div>
    </div>
  );
};

export default StatsDashboard;
