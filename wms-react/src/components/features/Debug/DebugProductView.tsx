import React, { useState } from 'react';
import './DebugProductView.css';
import { useWMSStore } from '../../../store/useWMSStore';

const DebugProductView: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || {});
  const updateProductInfo = useWMSStore(state => state.updateProductInfo);
  const [theme, setTheme] = useState('default');

  const themes = ['default', 'ocean', 'sunset', 'forest', 'purple', 'dark'];

  const toggleTheme = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    document.body.setAttribute('data-theme', next);
  };

  const handleBlur = (code: string, e: React.FocusEvent<HTMLTableCellElement>) => {
    const newName = e.target.innerText.trim();
    if (newName) {
      updateProductInfo(code, newName);
    }
  };

  // Coletar todos os produtos de todas as gavetas para visão de debug
  const allProducts = Object.values(productsAll).flat();

  return (
    <div className={`debug-view-container theme-${theme}`}>
      <div className="workspace-header">
        <div className="ws-title"><strong>DEBUG & INSPEÇÃO</strong> — Motor de Ajustes Rápidos</div>
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          🎨 TEMA: {theme.toUpperCase()}
        </button>
      </div>

      <div className="debug-stats-grid">
        <div className="stat-pill">Total: {allProducts.length}</div>
        <div className="stat-pill success">Sincronizados: {allProducts.length}</div>
        <div className="stat-pill warn">Ajustes Locais: 0</div>
      </div>

      <div className="debug-table-wrapper">
        <table className="debug-table">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>DESCRIÇÃO (EDITÁVEL)</th>
              <th>EAN</th>
              <th>ESTOQUE</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {allProducts.map((p, i) => (
              <tr key={`${p.code}-${i}`}>
                <td className="code-cell">{p.code}</td>
                <td 
                  contentEditable 
                  suppressContentEditableWarning
                  className="editable-cell"
                  onBlur={(e) => handleBlur(p.code, e)}
                >
                  {p.name}
                </td>
                <td 
                  contentEditable 
                  suppressContentEditableWarning
                  className="editable-cell"
                >
                  {p.code}
                </td>
                <td className="qty-cell">{p.qty} {p.unit}</td>
                <td>
                  <button className="btn-action">VALIDAR</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DebugProductView;
