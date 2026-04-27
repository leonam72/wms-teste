import React, { useState, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useWMSStore } from '../../../store/useWMSStore';
import ShelfMatrixPreview from './ShelfMatrixPreview';
import './FloorPlanPage.css';

const EMPTY_FPOBJECTS: any[] = [];

const FloorPlanPage: React.FC = () => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const objects = useWMSStore((state) => state.fpObjects[activeDepotId] || EMPTY_FPOBJECTS);
  const zoom = useWMSStore((state) => state.fpZoom);
  const setFpZoom = useWMSStore((state) => state.setFpZoom);
  const updateFPObject = useWMSStore((state) => state.updateFPObject);
  const addFPObject = useWMSStore((state) => state.addFPObject);
  const setObjectSelection = useWMSStore((state) => state.setObjectSelection);
  const clearSelection = useWMSStore((state) => state.clearSelection);
  const deleteSelectedObjects = useWMSStore((state) => state.deleteSelectedObjects);

  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingLasso = useRef(false);
  const lassoStart = useRef({ x: 0, y: 0 });

  const selectedObjects = objects.filter((o: any) => o.selected);
  const lastSelected = selectedObjects[selectedObjects.length - 1];

  const handleAddObject = (type: 'shelf' | 'wall' | 'area' | 'text') => {
    const id = `fp-${Date.now()}`;
    const newObj = {
      id,
      type,
      x: 100,
      y: 100,
      w: type === 'shelf' ? 200 : type === 'wall' ? 20 : 150,
      h: type === 'shelf' ? 60 : type === 'wall' ? 100 : 150,
      label: type.toUpperCase() + ' ' + (objects.length + 1),
      selected: false
    };
    addFPObject(activeDepotId, newObj);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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
      const idsToSelect = objects.filter((obj: any) => {
        return (
          obj.x < lasso.x + lasso.w &&
          obj.x + obj.w > lasso.x &&
          obj.y < lasso.y + lasso.h &&
          obj.y + obj.h > lasso.y
        );
      }).map((o: any) => o.id);

      if (idsToSelect.length > 0) {
        setObjectSelection(activeDepotId, idsToSelect, true);
      }
    }
    isDraggingLasso.current = false;
    setLasso(null);
  };

  const syncCurrentFloorPlan = useWMSStore((state) => state.syncCurrentFloorPlan);

  const handleSave = async () => {
    await syncCurrentFloorPlan();
    alert('Layout sincronizado com o banco de dados SQL!');
  };

  return (
    <div className="floorplan-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>EDITOR DE LAYOUT</strong> {' - '} Planta Baixa Inteligente
        </div>
        <div className="flex gap-2">
           <button className="btn" onClick={() => deleteSelectedObjects(activeDepotId)}>EXCLUIR</button>
           <button className="btn btn-accent" onClick={handleSave}>SALVAR LAYOUT</button>
        </div>
      </div>

      <div className="fp-workspace">
        <aside className="fp-sidebar">
          <div className="fp-tool-group">
            <h3>Elementos do Armazém</h3>
            <div className="tool-grid">
              <button className="btn-tool" onClick={() => handleAddObject('shelf')}>
                <span className="icon">🧱</span> Prateleira
              </button>
              <button className="btn-tool" onClick={() => handleAddObject('wall')}>
                <span className="icon">➖</span> Parede / Divisória
              </button>
              <button className="btn-tool" onClick={() => handleAddObject('area')}>
                <span className="icon">⬛</span> Área / Doca
              </button>
              <button className="btn-tool" onClick={() => handleAddObject('text')}>
                <span className="icon">📝</span> Rótulo de Texto
              </button>
            </div>
          </div>

          <div className="fp-tool-group">
            <h3>Dicas de Atalho</h3>
            <p style={{fontSize: '11px', color: 'var(--text2)'}}>
              • <b>CTRL + Clique</b> para seleção múltipla.<br/>
              • <b>Clique e Arraste</b> no fundo para selecionar em massa (Lasso).<br/>
              • <b>Grid Snap</b> ativo em 20px.
            </p>
          </div>
        </aside>

        <div className="fp-container" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} ref={canvasRef}>
          <div 
            className="fp-canvas" 
            style={{ 
              transform: `scale(${zoom})`, 
              transformOrigin: '0 0',
              width: '3000px',
              height: '2000px'
            }}
          >
            {objects.map((obj: any) => (
              <Rnd
                key={obj.id}
                size={{ width: obj.w, height: obj.h }}
                position={{ x: obj.x, y: obj.y }}
                scale={zoom}
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
                <div className="fp-obj-inner">
                  {obj.type === 'shelf' ? (
                    <div className="flex flex-col items-center">
                      <span className="fp-label">{obj.label}</span>
                      <ShelfMatrixPreview label={obj.label || ''} />
                    </div>
                  ) : (
                    <span className="fp-label">{obj.label}</span>
                  )}
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
            <span style={{ fontSize: '13px', fontWeight: '800', width: '45px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn-icon" onClick={() => setFpZoom(zoom + 0.1)}>➕</button>
            <div style={{width: '1px', height: '16px', background: 'var(--border)'}} />
            <button className="btn-icon" onClick={() => setFpZoom(1)} title="Resetar Zoom">🏠</button>
          </div>
        </div>

        {lastSelected && (
          <aside className="fp-properties-panel">
            <div className="prop-header">
              <h3>Propriedades</h3>
              <p style={{fontSize: '11px', color: 'var(--text2)', marginTop: '-8px'}}>{lastSelected.type.toUpperCase()} - {lastSelected.id}</p>
            </div>
            
            <div className="prop-group">
              <label>Etiqueta / Nome</label>
              <input 
                value={lastSelected.label || ''} 
                onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { label: e.target.value })}
              />
            </div>

            <div className="prop-group">
              <label>Dimensões (Px)</label>
              <div className="flex gap-2">
                <div className="flex-1">
                   <span style={{fontSize: '9px', fontWeight: 'bold'}}>LARGURA</span>
                   <input 
                    type="number" 
                    value={lastSelected.w} 
                    onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { w: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                   <span style={{fontSize: '9px', fontWeight: 'bold'}}>ALTURA</span>
                   <input 
                    type="number" 
                    value={lastSelected.h} 
                    onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { h: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="prop-group">
              <label>Cor de Preenchimento</label>
              <input 
                type="color" 
                value={lastSelected.color || '#ffffff'} 
                onChange={(e) => updateFPObject(activeDepotId, lastSelected.id, { color: e.target.value })}
              />
            </div>
            
            <div className="prop-group" style={{marginTop: 'auto'}}>
               <button className="btn btn-danger w-full" onClick={() => deleteSelectedObjects(activeDepotId)}>
                  REMOVER ELEMENTO
               </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default FloorPlanPage;
