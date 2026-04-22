import React, { useMemo } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { Product } from '../../../types';
import './ProductTable.css';

interface ProductTableProps {
  searchTerm: string;
}

const ProductTable: React.FC<ProductTableProps> = ({ searchTerm }) => {
  const activeDepotId = useWMSStore((state) => state.activeDepotId);
  const productsAll = useWMSStore((state) => state.productsAll[activeDepotId] || {});

  // Otimiza a lista de produtos (globaliza a busca entre todas as gavetas)
  const flattenedProducts = useMemo(() => {
    const list: (Product & { location: string })[] = [];
    Object.entries(productsAll).forEach(([location, products]) => {
      products.forEach(p => {
        if (
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.code.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          list.push({ ...p, location });
        }
      });
    });
    return list;
  }, [productsAll, searchTerm]);

  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>CÓD</th>
          <th>NOME</th>
          <th style={{ textAlign: 'right' }}>QTD</th>
          <th style={{ textAlign: 'center' }}>ST</th>
        </tr>
      </thead>
      <tbody>
        {flattenedProducts.length > 0 ? (
          flattenedProducts.map((p, idx) => (
            <tr key={`${p.code}-${p.location}-${idx}`}>
              <td className="td-code">{p.code}</td>
              <td className="td-name" title={p.name}>{p.name}</td>
              <td className="td-qty">{p.qty}</td>
              <td className="td-status">
                {/* Lógica de status simplificada para o React */}
                {p.expiries.length > 0 ? '🟢' : '⚪'}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="empty-row">Nenhum produto</td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default ProductTable;
