import React, { useState } from 'react';
import Header from './components/layout/Header';
import NavRail, { PageID } from './components/layout/NavRail';
import Sidebar from './components/layout/Sidebar';
import ShelfGrid from './components/features/ShelfGrid/ShelfGrid';
import './App.css';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageID>('depot');

  const handleAddProduct = () => {
    console.log('Open Add Product Modal');
  };

  const handleOpenSettings = () => {
    console.log('Open Settings Modal');
  };

  return (
    <div className="app-container">
      <Header onAddProduct={handleAddProduct} onOpenSettings={handleOpenSettings} />
      
      <div className="main-layout">
        <NavRail activePage={activePage} onPageChange={setActivePage} />
        
        {activePage === 'depot' && <Sidebar />}
        
        <main className="workspace">
          <div className="workspace-content">
            {activePage === 'depot' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title">
                    <strong>DEPÓSITO</strong> — Vista Geral
                  </div>
                </div>
                <ShelfGrid />
              </div>
            )}
            
            {activePage === 'products' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title">
                    <strong>PRODUTOS</strong> — Visão Geral
                  </div>
                </div>
                <div className="placeholder-msg">Página de produtos em construção...</div>
              </div>
            )}

            {activePage === 'history' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title">
                    <strong>HISTÓRICO</strong> — Movimentações
                  </div>
                </div>
                <div className="placeholder-msg">Histórico em construção...</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
