import React, { useState, useEffect } from 'react';
import './Header.css';

interface HeaderProps {
  onAddProduct: () => void;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAddProduct, onOpenSettings }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <header className="main-header">
      <div className="logo">
        WMS<span> // CONTROLE DE PRATELEIRAS</span>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={() => setIsDark(!isDark)} title="Alternar Modo Escuro">
          {isDark ? '☀️ CLARO' : '🌙 DARK'}
        </button>
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

