import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getDrawerKey } from '../../../utils/helpers';
import { getProductExpiryStatus } from '../../../utils/expiry';
import type { FilterType } from '../../types';
import './ShelfGrid.css';

interface DrawerProps {
  shelfId: string;
  floor: number;
  drawer: number;
  onClick: (key: string) => void;
  activeFilter: FilterType;
  addressSearch: string;
}

const EMPTY_ARRAY: any[] = [];

const Drawer: React.FC<DrawerProps> = ({ shelfId, floor, drawer, onClick, activeFilter, addressSearch }) => {
  const key = getDrawerKey(shelfId, floor, drawer);
  
  const products = useWMSStore((state) => {
    const depotProducts = state.productsAll[state.activeDepotId];
    return (depotProducts && depotProducts[key]) ? depotProducts[key] : EMPTY_ARRAY;
  });

  const shelfObj = useWMSStore((state) => {
    const depotShelves = state.shelvesAll[state.activeDepotId] || [];
    return depotShelves.find(s => s.id === shelfId);
  });
  
  const isOccupied = products.length > 0;
  const drawerStatus = isOccupied 
    ? getProductExpiryStatus(products.flatMap(p => p.expiries))
    : 'none';

  const heatmapStyle = useMemo(() => {
    if (!isOccupied || !shelfObj || !shelfObj.maxKg) return {};
    const totalKg = products.reduce((acc, p) => acc + (p.kg * p.qty), 0);
    const capacityDrawer = shelfObj.maxKg / (shelfObj.floors * shelfObj.drawers);
    const ratio = Math.min(totalKg / capacityDrawer, 1);
    
    // Gradient from Green (0%) to Yellow (50%) to Red (100%)
    const hue = ((1 - ratio) * 120).toString(10);
    return {
      background: `hsl(${hue}, 80%, 90%)`,
      borderBottom: `4px solid hsl(${hue}, 80%, 45%)`
    };
  }, [products, isOccupied, shelfObj]);

  let isVisible = true;
  
  if (activeFilter === 'occupied') isVisible = isOccupied;
  if (activeFilter === 'empty')    isVisible = !isOccupied;
  if (activeFilter === 'expired')  isVisible = drawerStatus === 'expired';
  if (activeFilter === 'expiring') isVisible = drawerStatus === 'warn';
  if (activeFilter === 'multi') {
    const uniqueSkus = new Set(products.map(p => p.code));
    isVisible = uniqueSkus.size >= 2;
  }

  if (addressSearch && !key.toLowerCase().includes(addressSearch.toLowerCase())) {
    isVisible = false;
  }

  if (!isVisible) return <div className="drawer hidden" />;

  return (
    <div 
      className={`drawer ${isOccupied ? 'occupied' : ''} status-${drawerStatus}`}
      onClick={() => onClick(key)}
      style={isOccupied ? heatmapStyle : {}}
      title={isOccupied && shelfObj ? `Ocupação: ${Math.round((products.reduce((acc, p) => acc + (p.kg * p.qty), 0) / (shelfObj.maxKg / (shelfObj.floors * shelfObj.drawers))) * 100)}%` : ''}
    >
      <div className="drawer-key">{key}</div>
      {isOccupied ? (
        <div className="drawer-prod-list">
          {products.slice(0, 2).map((p, idx) => (
            <div key={`${p.code}-${idx}`} className="drawer-prod-entry">
              <span className={`drawer-prod-code status-${getProductExpiryStatus(p.expiries)}`}>
                {p.code}
              </span>
              <span className="drawer-prod-name">{p.name}</span>
            </div>
          ))}
          {products.length > 2 && (
            <div className="drawer-more">+{products.length - 2} mais</div>
          )}
        </div>
      ) : (
        <div className="drawer-empty-label">VAZIO</div>
      )}
    </div>
  );
};

export default Drawer;

