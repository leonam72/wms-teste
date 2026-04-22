import React from 'react';
import type { Product } from '../../../types';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './ProductDetail.css';

interface ProductDetailProps {
  product: Product;
  location?: string;
  onClose: () => void;
  onRemove: (qty: number) => void;
  onMove: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, location, onClose, onRemove, onMove }) => {
  const status = getProductExpiryStatus(product.expiries);

  return (
    <div className="product-detail">
      <div className="pd-header">
        <div className="pd-title">
          <span className="pd-sku">{product.code}</span>
          <h2>{product.name}</h2>
        </div>
        <div className={`pd-status-badge ${status}`}>
          {status === 'expired' ? '🔴 VENCIDO' : status === 'warn' ? '🟡 A VENCER' : '🟢 EM DIA'}
        </div>
      </div>

      <div className="pd-info-grid">
        <div className="pd-info-item">
          <label>LOCALIZAÇÃO</label>
          <div className="pd-val">{location || '---'}</div>
        </div>
        <div className="pd-info-item">
          <label>QUANTIDADE</label>
          <div className="pd-val">{product.qty} {product.unit.toUpperCase()}</div>
        </div>
        <div className="pd-info-item">
          <label>PESO TOTAL</label>
          <div className="pd-val">{(product.qty * product.kg).toFixed(2)} KG</div>
        </div>
        <div className="pd-info-item">
          <label>ENTRADA</label>
          <div className="pd-val">{new Date(product.entry).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <div className="pd-expiries">
        <label>DATAS DE VALIDADE ATRELADAS</label>
        {product.expiries.length > 0 ? (
          <div className="pd-expiry-list">
            {product.expiries.map((d, i) => (
              <div key={i} className={`pd-expiry-row ${getProductExpiryStatus([d])}`}>
                {new Date(d).toLocaleDateString('pt-BR')}
              </div>
            ))}
          </div>
        ) : (
          <div className="pd-no-data">Nenhuma validade registrada</div>
        )}
      </div>

      <div className="pd-actions">
        <button className="btn btn-accent" onClick={onMove}>
          MOVER ITEM
        </button>
        <button className="btn btn-danger" onClick={() => onRemove(1)}>
          RETIRAR 1 UN
        </button>
        <button className="btn" onClick={() => onRemove(product.qty)}>
          BAIXA TOTAL
        </button>
        <button className="btn" onClick={onClose}>
          FECHAR
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
