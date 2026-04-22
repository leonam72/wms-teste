import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import HistoryPage from '../components/features/History/HistoryPage';
import { useWMSStore } from '../store/useWMSStore';

describe('HistoryPage Component', () => {
  beforeEach(() => {
    useWMSStore.setState({
      appHistory: [
        { ts: '2025-01-01T10:00:00.000Z', icon: '➕', action: 'Entrada', detail: 'P001 na A1.G1' },
        { ts: '2025-01-02T10:00:00.000Z', icon: '📤', action: 'Saída', detail: 'P002 da B1.G1' },
        { ts: '2025-01-03T10:00:00.000Z', icon: '🔀', action: 'Movimentação', detail: 'P003 para C1.G1' },
      ]
    });
  });

  it('renders all history items initially', () => {
    const { container } = render(<HistoryPage />);
    const items = container.querySelectorAll('.hist-item');
    expect(items.length).toBe(3);
  });

  it('filters history items by text input (SKU/Detail)', () => {
    const { container } = render(<HistoryPage />);
    const input = screen.getByPlaceholderText('Buscar SKU ou Detalhe...');
    
    fireEvent.change(input, { target: { value: 'P001' } });
    
    const items = container.querySelectorAll('.hist-item');
    expect(items.length).toBe(1);
    expect(screen.getByText('P001 na A1.G1')).toBeInTheDocument();
  });

  it('filters history items by action select', () => {
    const { container } = render(<HistoryPage />);
    const select = screen.getByRole('combobox');
    
    fireEvent.change(select, { target: { value: 'Saída' } });
    
    const items = container.querySelectorAll('.hist-item');
    expect(items.length).toBe(1);
    expect(screen.getByText('P002 da B1.G1')).toBeInTheDocument();
  });

  it('shows empty message when no items match the filter', () => {
    render(<HistoryPage />);
    const input = screen.getByPlaceholderText('Buscar SKU ou Detalhe...');
    
    fireEvent.change(input, { target: { value: 'XYZ-999' } });
    
    expect(screen.getByText('Nenhuma movimentação encontrada')).toBeInTheDocument();
  });
});
