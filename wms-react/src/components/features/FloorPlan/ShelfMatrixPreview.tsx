import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './ShelfMatrixPreview.css';

interface ShelfMatrixPreviewProps {
  label?: string;
}

const EMPTY_PRODUCTS = {};
const EMPTY_SHELVES: any[] = [];
const EMPTY_FPOBJECTS: any[] = [];

const ShelfMatrixPreview: React.FC<ShelfMatrixPreviewProps> = ({ label }) => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const shelves = useWMSStore(state => state.shelvesAll[activeDepotId] || EMPTY_SHELVES);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || EMPTY_PRODUCTS);

  if (!label) return null;

  // Extract shelf code from label (e.g. "PRATELEIRA A" -> "A")
  const match = label.match(/PRATELEIRA\s+([A-Z0-9]+)/i);
  if (!match) return null;

  const shelfCode = match[1];
  const shelf = shelves.find(s => s.code === shelfCode || s.id === shelfCode); // fallback to id just in case

  if (!shelf) return null;

  const floors = Array.from({ length: shelf.floors }, (_, i) => shelf.floors - i);
  const drawers = Array.from({ length: shelf.drawers }, (_, i) => i + 1);

  return (
    <div className="fp-shelf-matrix">
      {floors.map(floor => (
        <div key={floor} className="fp-matrix-row">
          {drawers.map(drawer => {
            const key = `${shelfCode}${floor}.G${drawer}`;
            const products = productsAll[key] || [];
            const isOccupied = products.length > 0;
            const status = isOccupied ? getProductExpiryStatus(products.flatMap(p => p.expiries)) : 'none';
            
            return (
              <div 
                key={drawer} 
                className={`fp-matrix-cell ${isOccupied ? 'occupied' : ''} status-${status}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ShelfMatrixPreview;
