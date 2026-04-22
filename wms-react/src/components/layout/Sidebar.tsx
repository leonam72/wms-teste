import React, { useState } from 'react';
import ProductTable from '../features/ProductTable/ProductTable';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'shelves'>('products');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <aside className="sidebar">
      <div className="sidebar-resizer" />
      <div className="sidebar-tabs">
        <div 
          className={`tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          PRODUTOS
        </div>
        <div 
          className={`tab ${activeTab === 'shelves' ? 'active' : ''}`}
          onClick={() => setActiveTab('shelves')}
        >
          PRATELEIRAS
        </div>
      </div>

      <div className="sidebar-content">
        {activeTab === 'products' ? (
          <div className="tab-panel">
            <div className="product-search">
              <input 
                type="text" 
                placeholder="BUSCAR PRODUTO..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <ProductTable searchTerm={searchTerm} />
            </div>
          </div>
        ) : (
          <div className="tab-panel">
            <div className="shelf-mgmt">
              <div className="section-title-row">
                <span className="section-title">PRATELEIRAS</span>
                <button className="btn btn-accent" style={{ fontSize: '10px', padding: '3px 10px' }}>+ NOVA</button>
              </div>
              <div className="placeholder-msg">Lista de prateleiras em breve...</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
