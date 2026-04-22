import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getDrawerKey } from '../../../utils/helpers';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './ShelfGrid.css';

interface DrawerProps {
  shelfId: string;
  floor: number;
  drawer: number;
  onClick: (key: string) => void;
}

const EMPTY_ARRAY: any[] = [];

const Drawer: React.FC<DrawerProps> = ({ shelfId, floor, drawer, onClick }) => {
  const key = getDrawerKey(shelfId, floor, drawer);
  
  const products = useWMSStore((state) => {
    const depotProducts = state.productsAll[state.activeDepotId];
    return (depotProducts && depotProducts[key]) ? depotProducts[key] : EMPTY_ARRAY;
  });
  
  const isOccupied = products.length > 0;

  const drawerStatus = isOccupied 
    ? getProductExpiryStatus(products.flatMap(p => p.expiries))
    : 'none';

  return (
    <div 
      className={`drawer ${isOccupied ? 'occupied' : ''} status-${drawerStatus}`}
      onClick={() => onClick(key)}
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
