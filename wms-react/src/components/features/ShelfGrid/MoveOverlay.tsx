import React from 'react';
import './MoveOverlay.css';

interface MoveOverlayProps {
  productName: string;
  fromKey: string;
  onCancel: () => void;
}

const MoveOverlay: React.FC<MoveOverlayProps> = ({ productName, fromKey, onCancel }) => {
  return (
    <div className="move-overlay">
      <div className="move-message">
        <span className="move-icon">🚚</span>
        MOVENDO: <strong>{productName}</strong> DE <strong>{fromKey}</strong>
        <span className="move-hint">CLIQUE NA GAVETA DE DESTINO PARA TRANSFERIR</span>
      </div>
      <button className="btn btn-danger" onClick={onCancel}>CANCELAR MOVIMENTAÇÃO</button>
    </div>
  );
};

export default MoveOverlay;
