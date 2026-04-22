import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import ShelfBlock from './ShelfBlock';
import './ShelfGrid.css';

interface ShelfGridProps {
  onDrawerClick: (drawerKey: string) => void;
}

const ShelfGrid: React.FC<ShelfGridProps> = ({ onDrawerClick }) => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const shelves = useWMSStore((state) => state.shelvesAll[activeDepotId] || []);

  return (
    <div className="shelves-grid">
      {shelves.map((shelf) => (
        <ShelfBlock key={shelf.id} shelf={shelf} onDrawerClick={onDrawerClick} />
      ))}
    </div>
  );
};

export default ShelfGrid;
