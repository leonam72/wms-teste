import React from 'react';
import type { PageID } from '../../types';
import './NavRail.css';

interface NavRailProps {
  activePage: PageID;
  onPageChange: (page: PageID) => void;
}

const NavRail: React.FC<NavRailProps> = ({ activePage, onPageChange }) => {
  const items: { id: PageID; icon: string; label: string }[] = [
    { id: 'receiving', icon: '📥', label: 'RECEB.' },
    { id: 'depot', icon: '🏭', label: 'DEPOT' },
    { id: 'quality', icon: '🛡️', label: 'QUALID.' },
    { id: 'depots', icon: '🏢', label: 'DEPÓS.' },
    { id: 'products', icon: '📦', label: 'PROD' },
    { id: 'floorplan', icon: '🗺', label: 'PLANTA' },
    { id: 'logistics-v2', icon: '🚀', label: 'EXPERT' },
    { id: 'history', icon: '📋', label: 'HIST' },
  ];

  return (
    <nav className="nav-rail">
      {items.map((item) => (
        <React.Fragment key={item.id}>
          {item.id === 'floorplan' && <div className="nav-sep" />}
          <button
            className={`nav-btn ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onPageChange(item.id)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default NavRail;
