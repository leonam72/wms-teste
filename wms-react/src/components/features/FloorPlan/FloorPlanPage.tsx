import React from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import './FloorPlanPage.css';

const FloorPlanPage: React.FC = () => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const objects = useWMSStore((state) => state.fpObjects[activeDepotId] || []);
  const zoom = useWMSStore((state) => state.fpZoom);

  return (
    <div className="floorplan-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>PLANTA BAIXA</strong> {' - '} Layout do Depósito
        </div>
        <div className="fp-toolbar">
          <button className="btn">MOVER</button>
          <button className="btn">DESENHAR</button>
          <div className="sep" />
          <button className="btn">ZOOM: {Math.round(zoom * 100)}%</button>
        </div>
      </div>

      <div className="fp-container">
        <div 
          className="fp-canvas" 
          style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {objects.map((obj) => (
            <div 
              key={obj.id}
              className={`fp-obj ${obj.type}`}
              style={{
                left: obj.x,
                top: obj.y,
                width: obj.w,
                height: obj.h,
                backgroundColor: obj.color,
                transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined
              }}
            >
              <span className="fp-label">{obj.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FloorPlanPage;
