import React, { useState } from 'react';
import Header from './components/layout/Header';
import NavRail from './components/layout/NavRail';
import type { PageID, Product } from './types';
import Sidebar from './components/layout/Sidebar';
import ShelfGrid from './components/features/ShelfGrid/ShelfGrid';
import HistoryPage from './components/features/History/HistoryPage';
import FloorPlanPage from './components/features/FloorPlan/FloorPlanPage';
import Modal from './components/ui/Modal';
import ProductForm from './components/features/ProductForm/ProductForm';
import { useWMSStore } from './store/useWMSStore';
import './App.css';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageID>('depot');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetDrawer, setTargetDrawer] = useState<string | null>(null);

  const addProductToDrawer = useWMSStore(state => state.addProductToDrawer);
  const logAction = useWMSStore(state => state.logAction);

  const handleOpenAddProduct = (drawerKey?: string) => {
    setTargetDrawer(drawerKey || null);
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = (product: Product) => {
    // Se não houver drawer alvo, o produto fica 'solto' (em branco) ou podemos exigir um
    const drawerKey = targetDrawer || 'RECEBIMENTO'; 
    addProductToDrawer(drawerKey, product);
    logAction('➕', `Entrada: ${product.code} - ${product.name}`, `Adicionado em ${drawerKey} (${product.qty} ${product.unit})`);
    
    setIsAddModalOpen(false);
    setTargetDrawer(null);
  };

  return (
    <div className="app-container">
      <Header 
        onAddProduct={() => handleOpenAddProduct()} 
        onOpenSettings={() => console.log('Open Settings')} 
      />
      
      <div className="main-layout">
        <NavRail activePage={activePage} onPageChange={setActivePage} />
        
        {activePage === 'depot' && <Sidebar />}
        
        <main className="workspace">
          <div className="workspace-content">
            {activePage === 'depot' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title">
                    <strong>DEPÓSITO</strong> {' - '} Vista Geral
                  </div>
                </div>
                <ShelfGrid onDrawerClick={handleOpenAddProduct} />
              </div>
            )}
            
            {activePage === 'products' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title">
                    <strong>PRODUTOS</strong> {' - '} Visão Geral
                  </div>
                </div>
                <div className="placeholder-msg">Página de produtos em construção...</div>
              </div>
            )}

            {activePage === 'floorplan' && (
              <div className="page" style={{ height: '100%' }}>
                <FloorPlanPage />
              </div>
            )}

            {activePage === 'history' && (
              <div className="page" style={{ height: '100%' }}>
                <HistoryPage />
              </div>
            )}
          </div>
        </main>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title={targetDrawer ? `ADICIONAR PRODUTO NA GAVETA ${targetDrawer}` : "ADICIONAR NOVO PRODUTO"}
      >
        <ProductForm 
          onSave={handleSaveProduct} 
          onCancel={() => setIsAddModalOpen(false)} 
        />
      </Modal>
    </div>
  );
};

export default App;
