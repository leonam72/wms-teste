import React from 'react';
import { Rnd } from 'react-rnd';
import { useWMSStore } from '../../../store/useWMSStore';
import ShelfMatrixPreview from './ShelfMatrixPreview';
import './FloorPlanPage.css';

const EMPTY_FPOBJECTS: any[] = [];

const FloorPlanPage: React.FC = () => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const objects = useWMSStore((state) => state.fpObjects[activeDepotId] || EMPTY_FPOBJECTS);
  const zoom = useWMSStore((state) => state.fpZoom);
  const updateFPObject = useWMSStore((state) => state.updateFPObject);

  return (
    <div className="floorplan-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>PLANTA BAIXA</strong> {' - '} Layout do Depósito
        </div>
        <div className="fp-toolbar">
          <button className="btn btn-accent">MODO EDIÇÃO</button>
          <button className="btn">ADICIONAR ITEM</button>
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
            <Rnd
              key={obj.id}
              size={{ width: obj.w, height: obj.h }}
              position={{ x: obj.x, y: obj.y }}
              onDragStop={(_, d) => {
                updateFPObject(activeDepotId, obj.id, { x: d.x, y: d.y });
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                updateFPObject(activeDepotId, obj.id, {
                  w: parseInt(ref.style.width),
                  h: parseInt(ref.style.height),
                  ...position,
                });
              }}
              bounds="parent"
              enableResizing={true}
              dragGrid={[20, 20]}
              resizeGrid={[20, 20]}
              className={`fp-obj-wrapper ${obj.type}`}
            >
              <div className="fp-obj-inner" style={{ flexDirection: 'column' }}>
                <span className="fp-label">{obj.label}</span>
                {obj.type === 'shelf' && <ShelfMatrixPreview label={obj.label} />}
              </div>
            </Rnd>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FloorPlanPage;
