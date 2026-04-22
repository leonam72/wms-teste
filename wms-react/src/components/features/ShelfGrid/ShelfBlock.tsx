import React from 'react';
import { Shelf } from '../../../types';
import Drawer from './Drawer';
import './ShelfGrid.css';

interface ShelfBlockProps {
  shelf: Shelf;
}

const ShelfBlock: React.FC<ShelfBlockProps> = ({ shelf }) => {
  // Gera os andares do maior para o menor (ex: 6, 5, 4...)
  const floorNumbers = Array.from({ length: shelf.floors }, (_, i) => shelf.floors - i);

  return (
    <div className="shelf-block">
      <div className="shelf-block-header">
        <div className="shelf-block-name">PRATELEIRA {shelf.id}</div>
        <div className="shelf-block-stats">{shelf.floors} andares</div>
      </div>
      <div className="floors">
        {floorNumbers.map((floorNum) => (
          <div key={floorNum} className="floor">
            <div className="floor-label">F{floorNum}</div>
            <div className="drawers">
              {Array.from({ length: shelf.drawers }, (_, i) => i + 1).map((drawerNum) => (
                <Drawer 
                  key={drawerNum}
                  shelfId={shelf.id}
                  floor={floorNum}
                  drawer={drawerNum}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShelfBlock;
