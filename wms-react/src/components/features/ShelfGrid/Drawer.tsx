import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getDrawerKey } from '../../../utils/helpers';
import './ShelfGrid.css';

interface DrawerProps {
  shelfId: string;
  floor: number;
  drawer: number;
}

const Drawer: React.FC<DrawerProps> = ({ shelfId, floor, drawer }) => {
  const key = getDrawerKey(shelfId, floor, drawer);
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const products = useWMSStore((state) => state.productsAll[activeDepotId]?.[key] || []);
  
  const isOccupied = products.length > 0;

  return (
    <div 
      className={`drawer ${isOccupied ? 'occupied' : ''}`}
      onClick={() => console.log('Open Drawer Modal', key)}
    >
      <div className="drawer-key">{key}</div>
      {isOccupied ? (
        <div className="drawer-prod-list">
          {products.slice(0, 2).map((p, idx) => (
            <div key={`${p.code}-${idx}`} className="drawer-prod-entry">
              <span className="drawer-prod-code">{p.code}</span>
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
