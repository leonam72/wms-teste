import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import ShelfBlock from './ShelfBlock';
import type { FilterType } from '../../../types';
import './ShelfGrid.css';

interface ShelfGridProps {
  onDrawerClick: (drawerKey: string) => void;
  activeFilter: FilterType;
  addressSearch: string;
}

const EMPTY_SHELVES: any[] = [];

const ShelfGrid: React.FC<ShelfGridProps> = ({ onDrawerClick, activeFilter, addressSearch }) => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const shelves = useWMSStore((state) => state.shelvesAll[activeDepotId] || EMPTY_SHELVES);

  return (
    <div className="shelves-grid">
      {shelves.map((shelf) => (
        <ShelfBlock 
          key={shelf.id} 
          shelf={shelf} 
          onDrawerClick={onDrawerClick} 
          activeFilter={activeFilter}
          addressSearch={addressSearch}
        />
      ))}
    </div>
  );
};

export default ShelfGrid;
