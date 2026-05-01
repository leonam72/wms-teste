import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './DepotSelector.css';

const DepotSelector: React.FC = () => {
  const depots = useWMSStore(state => state.depots);
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const setActiveDepot = useWMSStore(state => state.setActiveDepot);
  const addDepot = useWMSStore(state => state.addDepot);
  const showDialog = useWMSStore(state => state.showDialog);

  const handleAddDepot = () => {
    showDialog({
      type: 'prompt',
      title: 'NOVO DEPÓSITO',
      message: 'Informe o nome da nova unidade logística:',
      onConfirm: (name) => {
        if (name) {
          addDepot({ id: '', name, createdAt: Date.now() });
        }
      }
    });
  };

  return (
    <div className="depot-selector-bar">
      <div className="depot-tabs">
        {depots.map((depot) => (
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
