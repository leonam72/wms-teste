import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/layout/Header';
import NavRail from './components/layout/NavRail';
import type { FilterType, PageID, Product } from './types';
import Sidebar from './components/layout/Sidebar';
import HomePage from './components/features/Home/HomePage';
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
import PickingPage from './components/features/Picking/PickingPage';
import QualityDashboard from './components/features/Quality/QualityDashboard';
import SlottingAdvisorPage from './components/features/Slotting/SlottingAdvisorPage';
import SettingsPage from './components/features/Settings/SettingsPage';
import LogisticsControlV2 from './components/features/V2/LogisticsControlV2';
import AuditLogPage from './components/features/Audit/AuditLogPage';
import DebugProductView from './components/features/Debug/DebugProductView';
import DepotSelector from './components/features/DepotSelector/DepotSelector';
import ExpiryModal from './components/features/Quality/ExpiryModal';
import { useWMSStore } from './store/useWMSStore';
import { useToasts } from './hooks/useToasts';
import './App.css';

const EMPTY_PRODUCTS = {};

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageID>('home');
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isExpiryModalOpen, setIsExpiryModalOpen] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState<'expired' | 'expiring'>('expired');
  const [selectedProduct, setSelectedProduct] = useState<{product: Product, location: string} | null>(null);
  const [targetDrawer, setTargetDrawer] = useState<string | null>(null);

  const { toasts, addToast, removeToast } = useToasts();

  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAllMap = useWMSStore(state => state.productsAll);
  const moveContext = useWMSStore(state => state.moveContext);
  const depots = useWMSStore(state => state.depots);
  
  const setFullState = useWMSStore(state => state.setFullState);
  const refreshState = useWMSStore(state => state.refreshState);
  const fetchDepots = useWMSStore(state => state.fetchDepots);
  const executeTransfer = useWMSStore(state => state.executeTransfer);
  const addProductToDrawer = useWMSStore(state => state.addProductToDrawer);
  const removeProductFromDrawer = useWMSStore(state => state.removeProductFromDrawer);
  const logAction = useWMSStore(state => state.logAction);
  const setMoveContext = useWMSStore(state => state.setMoveContext);

  useEffect(() => {
    fetchDepots();
  }, [fetchDepots]);

  useEffect(() => {
    if (activeDepotId) {
        refreshState();
    }
  }, [activeDepotId, refreshState]);

  const productsAll = useMemo(() => {
    return productsAllMap[activeDepotId] || EMPTY_PRODUCTS;
  }, [productsAllMap, activeDepotId]);

  const totalExpired = useMemo(() => {
    let count = 0;
    Object.values(productsAllMap).forEach(depotProds => {
      Object.values(depotProds).forEach(items => {
        if (items.some(p => p.expiries.some(e => new Date(e) < new Date()))) count++;
      });
    });
    return count;
  }, [productsAllMap]);

  const handleNavigateToDrawer = (drawerKey: string) => {
    setIsExpiryModalOpen(false);
    setActivePage('depot');
    setAddressSearch(drawerKey);
    addToast(`Focado em ${drawerKey} para resolução`, 'info');
  };

  const handleDrawerClick = (drawerKey: string) => {
    if (moveContext) {
      const success = executeTransfer(moveContext.fromKey, drawerKey, moveContext.product.code, moveContext.product.qty);
      if (success) {
        setMoveContext(null);
        addToast('Transferência concluída!', 'success');
      } else {
        addToast('Falha na transferência. Verifique validade/peso.', 'error');
      }
    } else {
      setTargetDrawer(drawerKey);
      setIsDrawerModalOpen(true);
    }
  };

  const handleOpenProductDetail = (product: Product, location: string) => {
    setSelectedProduct({ product, location });
    setIsDetailModalOpen(true);
  };

  const handleStartMove = (product: Product, location: string) => {
    setMoveContext({ fromKey: location, product });
    setIsDetailModalOpen(false);
    addToast('Selecione o destino no grid', 'info');
  };

  const handleOpenAddProduct = (drawerKey: string | null = null) => {
    setTargetDrawer(drawerKey);
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async (product: Product) => {
    const drawerKey = targetDrawer || 'RECEBIMENTO'; 
    await addProductToDrawer(drawerKey, product);
    setIsAddModalOpen(false);
    setTargetDrawer(null);
    addToast(`${product.name} salvo com sucesso!`, 'success');
  };

  const handleRemoveProduct = async (qty: number) => {
    if (!selectedProduct) return;
    const { product, location } = selectedProduct;
    await removeProductFromDrawer(location, product.code, qty);
    
    if (qty >= product.qty) {
      setIsDetailModalOpen(false);
      setSelectedProduct(null);
    }
    addToast(`Operação concluída em ${product.code}`, 'warning');
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

      <DepotSelector />
      
      <div className="main-layout">
        <NavRail activePage={activePage} onPageChange={setActivePage} />
        {activePage === 'depot' && <Sidebar onProductClick={handleOpenProductDetail} onBulkAddClick={() => setIsBulkModalOpen(true)} />}
        
        <main className="workspace">
          {totalExpired > 0 && (
            <div className="critical-alert-banner clickable" onClick={() => { setExpiryFilter('expired'); setIsExpiryModalOpen(true); }}>
              ⛔ {totalExpired} produto(s) com validade VENCIDA — clique para detalhar e resolver
            </div>
          )}
          <div className="workspace-content">
            {activePage === 'home' && (
              <div className="page" style={{ height: '100%' }}>
                <HomePage />
              </div>
            )}
            {activePage === 'depot' && (
              <div className="page">
                <div className="workspace-header">
                  <div className="ws-title"><strong>DEPÓSITO</strong> {' - '} {depots.find(d => d.id === activeDepotId)?.name || 'Vista Geral'}</div>
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
            {activePage === 'slotting' && (
              <div className="page" style={{ height: '100%' }}>
                <SlottingAdvisorPage />
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
            {activePage === 'picking' && (
              <div className="page" style={{ height: '100%' }}><PickingPage /></div>
            )}
            {activePage === 'logistics-v2' && (
              <div className="page" style={{ height: '100%' }}><LogisticsControlV2 /></div>
            )}
            {activePage === 'audit' && (
              <div className="page" style={{ height: '100%' }}><AuditLogPage /></div>
            )}
            {activePage === 'debug' && (
              <div className="page" style={{ height: '100%' }}><DebugProductView /></div>
            )}
          </div>
        </main>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="ADICIONAR PRODUTO">
        <ProductForm 
          onSave={handleSaveProduct} 
          onCancel={() => setIsAddModalOpen(false)} 
          targetDrawer={targetDrawer}
        />
      </Modal>

      <Modal isOpen={isDrawerModalOpen} onClose={() => setIsDrawerModalOpen(false)} title={`GAVETA ${targetDrawer}`}>
        {targetDrawer && (
          <DrawerModal 
            drawerKey={targetDrawer} 
            onClose={() => setIsDrawerModalOpen(false)}
            onAddProduct={() => {
              setIsDrawerModalOpen(false);
              handleOpenAddProduct(targetDrawer);
            }}
            onProductClick={handleOpenProductDetail}
          />
        )}
      </Modal>

      <Modal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} title="GERAR PRATELEIRAS EM MASSA">
         <BulkShelfModal onClose={() => setIsBulkModalOpen(false)} />
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

      <Modal isOpen={isExpiryModalOpen} onClose={() => setIsExpiryModalOpen(false)} title="DETALHES DE VALIDADE">
         <ExpiryModal 
            filter={expiryFilter} 
            onClose={() => setIsExpiryModalOpen(false)} 
            onNavigate={handleNavigateToDrawer}
         />
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default App;
