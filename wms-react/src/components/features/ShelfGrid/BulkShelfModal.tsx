import React, { useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './BulkShelfModal.css';

interface BulkShelfModalProps {
  onClose: () => void;
}

const BulkShelfModal: React.FC<BulkShelfModalProps> = ({ onClose }) => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const generateShelves = useWMSStore((state) => state.generateShelves);
  const showDialog = useWMSStore(state => state.showDialog);

  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState('D');
  const [floors, setFloors] = useState(6);
  const [drawers, setDrawers] = useState(4);
  const [maxKg, setMaxKg] = useState(500);

  const handleGenerate = () => {
    if (!prefix || count <= 0) {
      showDialog({
        type: 'alert',
        title: 'CAMPOS INVÁLIDOS',
        message: 'Por favor, preencha o prefixo e a quantidade de prateleiras para gerar o lote.'
      });
      return;
    }
    generateShelves(activeDepotId, count, prefix, floors, drawers, maxKg);
    showDialog({
        type: 'alert',
        title: 'LOTE GERADO',
        message: `${count} novas prateleiras foram inseridas no layout do depósito ${activeDepotId}.`
    });
    onClose();
  };

  return (
    <div className="bulk-shelf-modal">
      <div className="form-grid">
        <div className="form-group">
          <label>Quantidade de Prateleiras</label>
          <input type="number" value={count} onChange={(e) => setCount(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>Letra Inicial (Prefixo)</label>
          <input type="text" maxLength={1} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Níveis (Andares)</label>
          <input type="number" value={floors} onChange={(e) => setFloors(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>Gavetas por Nível</label>
          <input type="number" value={drawers} onChange={(e) => setDrawers(parseInt(e.target.value))} />
        </div>
        <div className="form-group full-width">
          <label>Capacidade Máxima por Gaveta (kg)</label>
          <input type="number" value={maxKg} onChange={(e) => setMaxKg(parseInt(e.target.value))} />
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button className="btn" onClick={onClose}>CANCELAR</button>
        <button className="btn btn-accent" onClick={handleGenerate}>GERAR EM LOTE</button>
      </div>
    </div>
  );
};

export default BulkShelfModal;
