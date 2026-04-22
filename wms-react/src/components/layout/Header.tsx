import React from 'react';
import './Header.css';

interface HeaderProps {
  onAddProduct: () => void;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddProduct, onOpenSettings }) => {
  return (
    <header className="main-header">
      <div className="logo">
        WMS<span> // CONTROLE DE PRATELEIRAS</span>
      </div>
      <div className="header-actions">
        <button className="btn btn-accent" onClick={onAddProduct}>
          + PRODUTO
        </button>
        <button className="btn" onClick={onOpenSettings}>
          ⚙ CONFIG
        </button>
      </div>
    </header>
  );
};

export default Header;
