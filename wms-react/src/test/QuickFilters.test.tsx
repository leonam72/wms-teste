import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuickFilters from '../components/features/Filters/QuickFilters';
import type { FilterType } from '../types';

describe('QuickFilters Component', () => {
  it('renders all filter chips', () => {
    const handleFilterChange = vi.fn();
    render(<QuickFilters activeFilter={null} onFilterChange={handleFilterChange} />);

    expect(screen.getByText('OCUPADAS')).toBeInTheDocument();
    expect(screen.getByText('VAZIAS')).toBeInTheDocument();
    expect(screen.getByText('VENCIDAS')).toBeInTheDocument();
    expect(screen.getByText('A VENCER')).toBeInTheDocument();
    expect(screen.getByText('MULTI-SKU')).toBeInTheDocument();
    
    // O botão LIMPAR não deve aparecer se nenhum filtro estiver ativo
    expect(screen.queryByText('✕ LIMPAR')).not.toBeInTheDocument();
  });

  it('calls onFilterChange with correct id when a chip is clicked', async () => {
    const handleFilterChange = vi.fn();
    render(<QuickFilters activeFilter={null} onFilterChange={handleFilterChange} />);

    const expiredChip = screen.getByText('VENCIDAS');
    await fireEvent.click(expiredChip);

    expect(handleFilterChange).toHaveBeenCalledWith('expired');
    expect(handleFilterChange).toHaveBeenCalledTimes(1);
  });

  it('clears the filter when clicking an already active chip', async () => {
    const handleFilterChange = vi.fn();
    // Inicia com o filtro 'occupied' ativo
    render(<QuickFilters activeFilter="occupied" onFilterChange={handleFilterChange} />);

    const occupiedChip = screen.getByText('OCUPADAS');
    // Verifica se a classe 'active' está presente
    expect(occupiedChip).toHaveClass('active');

    // Clicar novamente deve enviar null para limpar
    await fireEvent.click(occupiedChip);
    expect(handleFilterChange).toHaveBeenCalledWith(null);
  });

  it('renders the CLEAR button when a filter is active and handles its click', async () => {
    const handleFilterChange = vi.fn();
    render(<QuickFilters activeFilter="expiring" onFilterChange={handleFilterChange} />);

    const clearBtn = screen.getByText('✕ LIMPAR');
    expect(clearBtn).toBeInTheDocument();

    await fireEvent.click(clearBtn);
    expect(handleFilterChange).toHaveBeenCalledWith(null);
  });
});
