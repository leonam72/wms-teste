import React, { useMemo } from 'react';
import type { Shelf } from '../../../types';
import Drawer from './Drawer';
import type { FilterType } from '../../types';
import { useWMSStore } from '../../../store/useWMSStore';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './ShelfGrid.css';

interface ShelfBlockProps {
  shelf: Shelf;
  onDrawerClick: (drawerKey: string) => void;
  activeFilter: FilterType;
  addressSearch: string;
}

const ShelfBlock: React.FC<ShelfBlockProps> = ({ shelf, onDrawerClick, activeFilter, addressSearch }) => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAllMap = useWMSStore(state => state.productsAll);
  
  const productsAll = useMemo(() => {
    return productsAllMap[activeDepotId] || {};
  }, [productsAllMap, activeDepotId]);

  const shelfStats = useMemo(() => {
    let occupied = 0;
    let expired = 0;
    let ok = 0;
    const totalDrawers = shelf.floors * shelf.drawers;

    for (let f = 1; f <= shelf.floors; f++) {
      for (let d = 1; d <= shelf.drawers; d++) {
        const key = `${shelf.id}${f}.G${d}`;
        const prods = productsAll[key] || [];
        if (prods.length > 0) {
          occupied++;
          const status = getProductExpiryStatus(prods.flatMap(p => p.expiries));
          if (status === 'expired') expired++;
          else ok++;
        }
      }
    }
    const percent = totalDrawers > 0 ? Math.round((occupied / totalDrawers) * 100) : 0;
    return { occupied, expired, ok, totalDrawers, percent };
  }, [shelf, productsAll]);

  const floorNumbers = Array.from({ length: shelf.floors }, (_, i) => shelf.floors - i);

  return (
    <div className="shelf-block">
      <div className="shelf-block-header">
        <div className="shelf-block-info">
          <div className="shelf-block-name">PRATELEIRA {shelf.id}</div>
          <div className="shelf-block-summary">
            {shelfStats.occupied}/{shelfStats.totalDrawers} gav. | 
            <span className="txt-expired"> ⛔ {shelfStats.expired} venc.</span> | 
            <span className="txt-ok"> ✓ {shelfStats.ok} ok</span>
          </div>
        </div>
        <div className="shelf-block-percent">
          <div className="pct-val">{shelfStats.percent}%</div>
          <div className="pct-label">ocupação</div>
        </div>
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
                  onClick={onDrawerClick}
                  activeFilter={activeFilter}
                  addressSearch={addressSearch}
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
