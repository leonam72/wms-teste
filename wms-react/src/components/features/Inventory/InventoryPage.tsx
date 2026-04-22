import React, { useMemo, useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './InventoryPage.css';

const EMPTY_PRODUCTS = {};
const EMPTY_SHELVES: any[] = [];
const EMPTY_FPOBJECTS: any[] = [];

const InventoryPage: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || EMPTY_PRODUCTS);
  const [localSearch, setLocalSearch] = useState('');

  const flattenedProducts = useMemo(() => {
    const list: any[] = [];
    Object.entries(productsAll).forEach(([location, products]) => {
      products.forEach(p => {
        if (
          p.name.toLowerCase().includes(localSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(localSearch.toLowerCase())
        ) {
          list.push({ ...p, location });
        }
      });
    });
    return list;
  }, [productsAll, localSearch]);

  return (
    <div className="inventory-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>INVENTÁRIO GERAL</strong> {' - '} Lista de SKUs
        </div>
        <div className="inventory-actions">
          <input 
            type="text" 
            className="inventory-search" 
            placeholder="BUSCAR SKU OU NOME..." 
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>NOME DO PRODUTO</th>
              <th>LOCALIZAÇÃO</th>
              <th>QTD</th>
              <th>UN</th>
              <th>PESO TOTAL</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {flattenedProducts.length > 0 ? (
              flattenedProducts.map((p, i) => (
                <tr key={`${p.code}-${i}`}>
                  <td className="sku-cell">{p.code}</td>
                  <td>{p.name}</td>
                  <td className="loc-cell">{p.location}</td>
                  <td className="qty-cell">{p.qty}</td>
                  <td>{p.unit.toUpperCase()}</td>
                  <td>{(p.qty * p.kg).toFixed(2)} KG</td>
                  <td>
                    <span className={`status-dot-sm ${getProductExpiryStatus(p.expiries)}`} />
                    {getProductExpiryStatus(p.expiries).toUpperCase()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>Nenhum item encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryPage;
