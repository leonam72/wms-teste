import React, { useMemo, useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { getProductExpiryStatus } from '../../../utils/expiry';
import './InventoryPage.css';

const EMPTY_PRODUCTS = {};

const InventoryPage: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || EMPTY_PRODUCTS);
  const updateProductInfo = useWMSStore(state => state.updateProductInfo);
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

  const handleNameChange = (code: string, newName: string) => {
    if (newName.trim()) {
        updateProductInfo(code, newName);
    }
  };

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
          <button className="btn">Exportar Tudo (XLSX)</button>
        </div>
      </div>

      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>NOME DO PRODUTO (EDITÁVEL)</th>
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
                  <td 
                    contentEditable 
                    suppressContentEditableWarning
                    onBlur={(e) => handleNameChange(p.code, e.currentTarget.innerText)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="editable-cell"
                    title="Clique para editar o nome"
                  >
                    {p.name}
                  </td>
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
