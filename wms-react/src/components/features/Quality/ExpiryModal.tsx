import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getExpiryStatus, daysUntil } from '../../../utils/expiry';
import { formatDate } from '../../../utils/helpers';
import './ExpiryModal.css';

interface ExpiryModalProps {
  filter: 'expired' | 'expiring';
  onNavigate: (drawerKey: string) => void;
  onClose: () => void;
}

const ExpiryModal: React.FC<ExpiryModalProps> = ({ filter, onNavigate, onClose }) => {
  const productsAll = useWMSStore(state => state.productsAll);
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const products = productsAll[activeDepotId] || {};

  const rows = useMemo(() => {
    const list: any[] = [];
    Object.entries(products).forEach(([drawerKey, items]) => {
      items.forEach(p => {
        const status = getExpiryStatus(p.expiries[0] || '');
        if (filter === 'expired' && status !== 'expired') return;
        if (filter === 'expiring' && status !== 'warn') return;
        
        list.push({
          drawerKey,
          code: p.code,
          name: p.name,
          qty: p.qty,
          unit: p.unit,
          status,
          expiry: p.expiries[0] || '',
          days: p.expiries[0] ? daysUntil(p.expiries[0]) : Infinity
        });
      });
    });
    return list.sort((a, b) => a.days - b.days);
  }, [products, filter]);

  return (
    <div className="expiry-modal-content">
      <div className="expiry-modal-header">
        <h2>{filter === 'expired' ? '⛔ Itens Vencidos' : '⚠ Itens a Vencer'}</h2>
        <p>Clique em um item para localizá-lo instantaneamente no grid.</p>
      </div>

      <div className="expiry-table-container">
        <table className="expiry-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Endereço</th>
              <th>Status</th>
              <th>Validade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} onClick={() => onNavigate(row.drawerKey)} className="clickable-row">
                <td className="sku-cell">{row.code}</td>
                <td>{row.name}</td>
                <td className="addr-cell">{row.drawerKey}</td>
                <td>
                  <span className={`exp-badge ${row.status}`}>
                    {row.status === 'expired' ? 'VENCIDO' : `EM ${row.days}D`}
                  </span>
                </td>
                <td className="date-cell">{formatDate(row.expiry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="expiry-modal-footer">
        <button className="btn" onClick={onClose}>FECHAR</button>
      </div>
    </div>
  );
};

export default ExpiryModal;
