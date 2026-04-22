import React from 'react';
import type { Product } from '../../../types';
import { useWMSStore } from '../../../store/useWMSStore';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './DrawerModal.css';

interface DrawerModalProps {
  drawerKey: string;
  onClose: () => void;
  onAddClick: () => void;
}

const EMPTY_PRODUCTS: any[] = [];

const DrawerModal: React.FC<DrawerModalProps> = ({ drawerKey, onClose, onAddClick }) => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const products = useWMSStore((state) => state.productsAll[activeDepotId]?.[drawerKey] || EMPTY_PRODUCTS);
  const removeProduct = useWMSStore((state) => state.removeProductFromDrawer);
  const logAction = useWMSStore(state => state.logAction);

  const handleRemove = (product: Product, qty: number) => {
    removeProduct(drawerKey, product.code, qty);
    logAction('📤', `Saída: ${product.code} - ${product.name}`, `Retirado ${qty} de ${drawerKey}`);
  };

  return (
    <div className="drawer-modal-content">
      <div className="dm-actions">
        <button className="btn btn-accent" onClick={onAddClick}>+ ADC. PRODUTO</button>
      </div>
      
      <div className="dm-prod-list">
        {products.length === 0 ? (
          <div className="pd-no-data">Gaveta Vazia</div>
        ) : (
          products.map((p, i) => (
            <div key={`${p.code}-${i}`} className="dm-prod-row">
              <div className="dm-prod-info">
                <div className={`dm-prod-code status-${getProductExpiryStatus(p.expiries)}`}>
                  {p.code}
                </div>
                <div className="dm-prod-name">{p.name}</div>
                <div className="dm-prod-qty">
                  {p.qty} {p.unit.toUpperCase()}
                </div>
              </div>
              <button 
                className="btn btn-danger" 
                style={{ padding: '4px 8px', fontSize: '9px' }}
                onClick={() => handleRemove(p, p.qty)}
              >
                REMOVER
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DrawerModal;
