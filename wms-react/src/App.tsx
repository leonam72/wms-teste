import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/layout/Header';
import NavRail from './components/layout/NavRail';
import type { FilterType, PageID, Product } from './types';
import Sidebar from './components/layout/Sidebar';
import StatsDashboard from './components/features/Dashboard/StatsDashboard';
import ShelfGrid from './components/features/ShelfGrid/ShelfGrid';
import HistoryPage from './components/features/History/HistoryPage';
import FloorPlanPage from './components/features/FloorPlan/FloorPlanPage';
import QuickFilters from './components/features/Filters/QuickFilters';
import ProductDetail from './components/features/ProductDetail/ProductDetail';
import MoveOverlay from './components/features/ShelfGrid/MoveOverlay';
import Modal from './components/ui/Modal';
import ToastContainer from './components/ui/Toast/ToastContainer';
import DrawerModal from './components/features/ShelfGrid/DrawerModal';
import BulkShelfModal from './components/features/ShelfGrid/BulkShelfModal';
import ProductForm from './components/features/ProductForm/ProductForm';
import InventoryPage from './components/features/Inventory/InventoryPage';
import ReceivingPage from './components/features/Receiving/ReceivingPage';
import QualityDashboard from './components/features/Quality/QualityDashboard';
import SettingsPage from './components/features/Settings/SettingsPage';
import LogisticsControlV2 from './components/features/V2/LogisticsControlV2';
import { useWMSStore } from './store/useWMSStore';
import { useToasts } from './hooks/useToasts';
import { getProductExpiryStatus } from './utils/expiry';
import { getWMSState } from './services/api';
import './App.css';

const EMPTY_PRODUCTS = {};

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageID>('depot');
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{product: Product, location: string} | null>(null);
  const [targetDrawer, setTargetDrawer] = useState<string | null>(null);

  const { toasts, addToast, removeToast } = useToasts();

  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAllMap = useWMSStore(state => state.productsAll);
  const moveContext = useWMSStore(state => state.moveContext);
  
  const setMoveContext = useWMSStore(state => state.setMoveContext);
  const setFullState = useWMSStore(state => state.setFullState);
  const executeTransfer = useWMSStore(state => state.executeTransfer);
  const addProductToDrawer = useWMSStore(state => state.addProductToDrawer);
  const removeProductFromDrawer = useWMSStore(state => state.removeProductFromDrawer);
  const logAction = useWMSStore(state => state.logAction);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getWMSState(activeDepotId);
        if (data) setFullState(data);
      } catch (err) {
        // Silencia erro de rede para manter a UI estável no modo offline
        console.log("WMS operando em modo local (Servidor offline)");
      }
    };
    loadData();
  }, [activeDepotId, setFullState]);

  const productsAll = useMemo(() => {
    return productsAllMap[activeDepotId] || EMPTY_PRODUCTS;
  }, [productsAllMap, activeDepotId]);

  const totalExpired = useMemo(() => {
    let count = 0;
    Object.values(productsAll).forEach(drawer => {
      if (Array.isArray(drawer)) {
        drawer.forEach(p => {
          if (getProductExpiryStatus(p.expiries) === 'expired') count++;
        });
      }
    });
    return count;
  }, [productsAll]);

  const handleDrawerClick = (drawerKey: string) => {
    if (moveContext) {
      const success = executeTransfer(moveContext.fromKey, drawerKey, moveContext.product.code, moveContext.product.qty);
      if (success) {
        setMoveContext(null);
        addToast(`Transferido: ${moveContext.product.code} para ${drawerKey}`, 'success');
      } else {
        addToast('Falha na movimentação. Verifique o saldo.', 'error');
      }
      return;
    }
    setTargetDrawer(drawerKey);
    setIsDrawerModalOpen(true);
  };

  const handleStartMove = () => {
    if (!selectedProduct) return;
    setMoveContext({ fromKey: selectedProduct.location, product: selectedProduct.product });
    setIsDetailModalOpen(false);
    addToast('Modo Movimentação: Clique no destino.', 'info');
  };

  const handleOpenAddProduct = (drawerKey?: string) => {
    setTargetDrawer(drawerKey || null);
    setIsAddModalOpen(true);
  };

  const handleOpenProductDetail = (product: Product, location: string) => {
    setSelectedProduct({ product, location });
    setIsDetailModalOpen(true);
  };

  const handleSaveProduct = (product: Product) => {
    const drawerKey = targetDrawer || 'RECEBIMENTO'; 
    addProductToDrawer(drawerKey, product);
    logAction('➕', `Entrada: ${product.code} - ${product.name}`, `Adicionado em ${drawerKey} (${product.qty} ${product.unit})`);
    setIsAddModalOpen(false);
    setTargetDrawer(null);
    addToast(`${product.name} salvo com sucesso!`, 'success');
  };

  const handleRemoveProduct = (qty: number) => {
    if (!selectedProduct) return;
    const { product, location } = selectedProduct;
    removeProductFromDrawer(location, product.code, qty);
    logAction('📤', `Saída: ${product.code} - ${product.name}`, `Retirado ${qty} de ${location}`);
    addToast(`Retirado ${qty} ${product.unit} de ${product.code}`, 'warning');
    
    if (qty >= product.qty) {
      setIsDetailModalOpen(false);
      setSelectedProduct(null);
    }
  };

  return (
    <div className="app-container">
      {moveContext && (
        <MoveOverlay 
          productName={moveContext.product.name} 
          fromKey={moveContext.fromKey} 
          onCancel={() => setMoveContext(null)} 
        />
      )}
      
      <Header 
        onAddProduct={() => handleOpenAddProduct()} 
        onOpenSettings={() => setActivePage('depots')} 
      />
      
      <div className="main-layout">
        <NavRail activePage={activePage} onPageChange={setActivePage} />
        {activePage === 'depot' && <Sidebar onProductClick={handleOpenProductDetail} onBulkAddClick={() => setIsBulkModalOpen(true)} />}
        
        <main className="workspace">
          {totalExpired > 0 && (
            <div className="critical-alert-banner">
              ⛔ {totalExpired} produto(s) com validade VENCIDA — resolva no grid
            </div>
          )}
          <div className="workspace-content">
            {activePage === 'depot' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title"><strong>DEPÓSITO</strong> {' - '} Vista Geral</div>
                  <div className="address-search-container">
                    <input 
                      type="text" 
                      placeholder="Ir para Endereço (ex: A1)..." 
                      className="address-search-input"
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <StatsDashboard />
                <QuickFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
                <ShelfGrid 
                  onDrawerClick={handleDrawerClick} 
                  activeFilter={activeFilter} 
                  addressSearch={addressSearch} 
                />
              </div>
            )}
            {activePage === 'quality' && (
              <div className="page" style={{ height: '100%' }}>
                <QualityDashboard />
              </div>
            )}
            {activePage === 'products' && (
              <div className="page" style={{ height: '100%' }}>
                <InventoryPage />
              </div>
            )}
            {activePage === 'depots' && (
              <div className="page" style={{ height: '100%' }}>
                <SettingsPage />
              </div>
            )}
            {activePage === 'floorplan' && (
              <div className="page" style={{ height: '100%' }}><FloorPlanPage /></div>
            )}
            {activePage === 'history' && (
              <div className="page" style={{ height: '100%' }}><HistoryPage /></div>
            )}
            {activePage === 'receiving' && (
              <div className="page" style={{ height: '100%' }}><ReceivingPage /></div>
            )}
            {activePage === 'logistics-v2' && (
              <div className="page" style={{ height: '100%' }}><LogisticsControlV2 /></div>
            )}
          </div>
        </main>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="ADICIONAR PRODUTO">
        <ProductForm onSave={handleSaveProduct} onCancel={() => setIsAddModalOpen(false)} />
      </Modal>

      <Modal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} title="CRIAR PRATELEIRAS EM LOTE">
        <BulkShelfModal onClose={() => setIsBulkModalOpen(false)} />
      </Modal>

      <Modal isOpen={isDrawerModalOpen} onClose={() => setIsDrawerModalOpen(false)} title={`GAVETA ${targetDrawer}`}>
        {targetDrawer && (
          <DrawerModal 
            drawerKey={targetDrawer} 
            onClose={() => setIsDrawerModalOpen(false)} 
            onAddClick={() => handleOpenAddProduct(targetDrawer)} 
          />
        )}
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="DETALHES DO PRODUTO">
        {selectedProduct && (
          <ProductDetail 
            product={selectedProduct.product} 
            location={selectedProduct.location}
            onClose={() => setIsDetailModalOpen(false)}
            onRemove={handleRemoveProduct}
            onMove={handleStartMove}
          />
        )}
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default App;
