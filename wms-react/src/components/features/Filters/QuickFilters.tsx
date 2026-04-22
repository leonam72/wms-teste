import React from 'react';
import type { FilterType } from '../../../types';
import './QuickFilters.css';

interface QuickFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const QuickFilters: React.FC<QuickFiltersProps> = ({ activeFilter, onFilterChange }) => {
  const chips: { id: FilterType; label: string; icon: string }[] = [
    { id: 'occupied', label: 'OCUPADAS', icon: '📦' },
    { id: 'empty',    label: 'VAZIAS',    icon: '⚪' },
    { id: 'expired',  label: 'VENCIDAS',  icon: '🔴' },
    { id: 'expiring', label: 'A VENCER',  icon: '🟡' },
    { id: 'multi',    label: 'MULTI-SKU', icon: '👥' },
  ];

  return (
    <div className="quick-filters">
      {chips.map(chip => (
        <button
          key={chip.id}
          className={`chip ${activeFilter === chip.id ? 'active' : ''}`}
          onClick={() => onFilterChange(activeFilter === chip.id ? null : chip.id)}
        >
          <span className="chip-icon">{chip.icon}</span>
          {chip.label}
        </button>
      ))}
      {activeFilter && (
        <button className="chip chip-clear" onClick={() => onFilterChange(null)}>
          ✕ LIMPAR
        </button>
      )}
    </div>
  );
};

export default QuickFilters;
