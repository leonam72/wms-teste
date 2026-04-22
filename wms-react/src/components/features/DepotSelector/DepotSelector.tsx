import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './DepotSelector.css';

const DepotSelector: React.FC = () => {
  const depots = useWMSStore(state => state.depots);
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const setActiveDepot = useWMSStore(state => state.setActiveDepot);
  const addDepot = useWMSStore(state => state.addDepot);

  const handleAddDepot = () => {
    const name = prompt('Nome do novo depósito:');
    if (name) {
      const id = 'dep-' + Math.random().toString(36).substr(2, 9);
      addDepot({ id, name });
    }
  };

  return (
    <div className="depot-selector-bar">
      <div className="depot-tabs">
        {depots.map(depot => (
          <button
            key={depot.id}
            className={`depot-tab ${activeDepotId === depot.id ? 'active' : ''}`}
            onClick={() => setActiveDepot(depot.id)}
          >
            {depot.name}
            {activeDepotId === depot.id && <span className="active-indicator">⮕</span>}
          </button>
        ))}
        <button className="add-depot-btn" onClick={handleAddDepot}>
          + DEPÓSITO
        </button>
      </div>
    </div>
  );
};

export default DepotSelector;
