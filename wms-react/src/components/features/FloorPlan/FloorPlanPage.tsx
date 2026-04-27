import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useWMSStore } from '../../../store/useWMSStore';
import ShelfMatrixPreview from './ShelfMatrixPreview';
import { FPObject } from '../../../types';
import './FloorPlanPage.css';

const EMPTY_FPOBJECTS: FPObject[] = [];

const FloorPlanPage: React.FC = () => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const objects = useWMSStore((state) => state.fpObjects[activeDepotId] || EMPTY_FPOBJECTS);
  const zoom = useWMSStore((state) => state.fpZoom);
  const setFpZoom = useWMSStore((state) => state.setFpZoom);
  const updateFPObject = useWMSStore((state) => state.updateFPObject);
  const setObjectSelection = useWMSStore((state) => state.setObjectSelection);
  const clearSelection = useWMSStore((state) => state.clearSelection);
  const deleteSelectedObjects = useWMSStore((state) => state.deleteSelectedObjects);

  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingLasso = useRef(false);
  const lassoStart = useRef({ x: 0, y: 0 });

  const selectedObjects = objects.filter(o => o.selected);
  const lastSelected = selectedObjects[selectedObjects.length - 1];

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains('fp-canvas')) return;

    isDraggingLasso.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      lassoStart.current = { x, y };
      setLasso({ x, y, w: 0, h: 0 });
    }
    
    if (!e.ctrlKey && !e.shiftKey) {
      clearSelection(activeDepotId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingLasso.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const curX = (e.clientX - rect.left) / zoom;
      const curY = (e.clientY - rect.top) / zoom;
      const x = Math.min(lassoStart.current.x, curX);
      const y = Math.min(lassoStart.current.y, curY);
      const w = Math.abs(curX - lassoStart.current.x);
      const h = Math.abs(curY - lassoStart.current.y);
      setLasso({ x, y, w, h });
    }
  };

  const handleMouseUp = () => {
    if (isDraggingLasso.current && lasso) {
      const idsToSelect = objects.filter(obj => {
        return (
          obj.x < lasso.x + lasso.w &&
          obj.x + obj.w > lasso.x &&
          obj.y < lasso.y + lasso.h &&
          obj.y + obj.h > lasso.y
        );
      }).map(o => o.id);

      if (idsToSelect.length > 0) {
        setObjectSelection(activeDepotId, idsToSelect, true);
      }
    }
    isDraggingLasso.current = false;
    setLasso(null);
  };

  return (
    <div className="floorplan-page" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="workspace-header">
        <div className="ws-title">
          <strong>PLANTA BAIXA</strong> {' - '} Layout do Depósito
        </div>
        <div className="fp-toolbar">
          <button className="btn btn-accent">MODO EDIÇÃO</button>
          <button className="btn" onClick={() => deleteSelectedObjects(activeDepotId)}>EXCLUIR SELECIONADOS</button>
          <div className="sep" />
          <div className="zoom-info">ZOOM: {Math.round(zoom * 100)}%</div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="fp-container flex-1" onMouseDown={handleMouseDown} ref={canvasRef}>
          <div 
            className="fp-canvas" 
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: '0 0',
              width: '3000px',
              height: '3000px'
            }}
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
                onMouseDown={(e) => {
                   e.stopPropagation();
                   if (!e.ctrlKey && !obj.selected) {
                     clearSelection(activeDepotId);
                   }
                   setObjectSelection(activeDepotId, [obj.id], true);
                }}
                bounds="parent"
                enableResizing={true}
                dragGrid={[20, 20]}
                resizeGrid={[20, 20]}
                className={`fp-obj-wrapper ${obj.type} ${obj.selected ? 'selected' : ''}`}
              >
                <div className="fp-obj-inner" style={{ flexDirection: 'column' }}>
                  <span className="fp-label">{obj.label}</span>
                  {obj.type === 'shelf' && <ShelfMatrixPreview label={obj.label || ''} />}
                </div>
              </Rnd>
            ))}

            {lasso && (
              <div 
                className="fp-lasso"
                style={{
                  left: lasso.x,
                  top: lasso.y,
                  width: lasso.w,
                  height: lasso.h
                }}
              />
            )}
          </div>

          <div className="zoom-controls">
            <button className="btn-icon" onClick={() => setFpZoom(zoom - 0.1)}>➖</button>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn-icon" onClick={() => setFpZoom(zoom + 0.1)}>➕</button>
            <button className="btn-icon" onClick={() => setFpZoom(1)}>🏠</button>
          </div>
        </div>

        {lastSelected && (
          <aside className="fp-properties-panel">
            <div className="prop-header">
              <h3>Propriedades</h3>
              <p>{lastSelected.type.toUpperCase()} - {lastSelected.id}</p>
            </div>
            
            <div className="prop-group">
              <label>Etiqueta</label>
              <input 
                value={lastSelected.label || ''} 
                onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { label: e.target.value })}
              />
            </div>

            <div className="prop-group">
              <label>Dimensões (L x A)</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={lastSelected.w} 
                  onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { w: parseInt(e.target.value) })}
                />
                <input 
                  type="number" 
                  value={lastSelected.h} 
                  onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { h: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="prop-group">
              <label>Cor</label>
              <input 
                type="color" 
                value={lastSelected.color || '#ffffff'} 
                onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { color: e.target.value })}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default FloorPlanPage;
