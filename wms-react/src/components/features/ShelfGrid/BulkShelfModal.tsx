import React, { useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './BulkShelfModal.css';

interface BulkShelfModalProps {
  onClose: () => void;
}

const BulkShelfModal: React.FC<BulkShelfModalProps> = ({ onClose }) => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const generateShelves = useWMSStore(state => state.generateShelves);
  const logAction = useWMSStore(state => state.logAction);

  const [count, setCount] = useState(1);
  const [prefix, setPrefix] = useState('A');
  const [floors, setFloors] = useState(6);
  const [drawers, setDrawers] = useState(4);
  const [maxKg, setMaxKg] = useState(100);

  const handleGenerate = () => {
    if (!prefix || count < 1 || floors < 1 || drawers < 1 || maxKg < 1) {
      alert('Preencha todos os campos com valores válidos.');
      return;
    }

    generateShelves(activeDepotId, count, prefix.toUpperCase(), floors, drawers, maxKg);
    logAction('🏗️', 'Criação em Lote', `Criadas ${count} prateleiras a partir de ${prefix.toUpperCase()}`);
    onClose();
  };

  return (
    <div className="bulk-shelf-modal">
      <div className="form-row">
        <div className="form-group">
          <label>QTD. DE PRATELEIRAS</label>
          <input type="number" min="1" value={count} onChange={(e) => setCount(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>LETRA INICIAL</label>
          <input type="text" maxLength={1} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
        </div>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>ANDARES POR PRAT.</label>
          <input type="number" min="1" value={floors} onChange={(e) => setFloors(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>GAVETAS POR ANDAR</label>
          <input type="number" min="1" value={drawers} onChange={(e) => setDrawers(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>PESO MAX (KG)</label>
          <input type="number" min="1" value={maxKg} onChange={(e) => setMaxKg(parseInt(e.target.value))} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" onClick={onClose}>CANCELAR</button>
        <button className="btn btn-accent" onClick={handleGenerate}>GERAR EM LOTE</button>
      </div>
    </div>
  );
};

export default BulkShelfModal;
