import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ShelfMatrixPreview from '../components/features/FloorPlan/ShelfMatrixPreview';
import { useWMSStore } from '../store/useWMSStore';

// Mock getProductExpiryStatus to test status coloring
vi.mock('../utils/expiry', () => ({
  getProductExpiryStatus: (expiries: string[]) => {
    if (expiries.includes('expired')) return 'expired';
    if (expiries.includes('warn')) return 'warn';
    return 'ok';
  }
}));

describe('ShelfMatrixPreview Component', () => {
  beforeEach(() => {
    // Reset store state
    useWMSStore.setState({
      activeDepotId: 'dep1',
      shelvesAll: {
        'dep1': [
          { id: 'sh1', code: 'A', floors: 2, drawers: 2, maxKg: 80 }
        ]
      },
      productsAll: {
        'dep1': {
          'A1.G1': [{ code: 'P1', name: 'P1', qty: 1, unit: 'un', kg: 1, entry: '2025-01-01', expiries: [] }],
          'A1.G2': [{ code: 'P2', name: 'P2', qty: 1, unit: 'un', kg: 1, entry: '2025-01-01', expiries: ['expired'] }],
          'A2.G1': [{ code: 'P3', name: 'P3', qty: 1, unit: 'un', kg: 1, entry: '2025-01-01', expiries: ['warn'] }]
          // A2.G2 is empty
        }
      }
    });
  });

  it('should render correct number of matrix cells based on shelf floors and drawers', () => {
    const { container } = render(<ShelfMatrixPreview label="PRATELEIRA A" />);
    // Shelf A has 2 floors * 2 drawers = 4 cells
    const cells = container.querySelectorAll('.fp-matrix-cell');
    expect(cells.length).toBe(4);
  });

  it('should apply occupied class to occupied cells', () => {
    const { container } = render(<ShelfMatrixPreview label="PRATELEIRA A" />);
    // A1.G1, A1.G2, A2.G1 are occupied (3 total)
    const occupiedCells = container.querySelectorAll('.fp-matrix-cell.occupied');
    expect(occupiedCells.length).toBe(3);
  });

  it('should apply status classes correctly', () => {
    const { container } = render(<ShelfMatrixPreview label="PRATELEIRA A" />);
    
    // A1.G2 has 'expired'
    const expiredCells = container.querySelectorAll('.fp-matrix-cell.status-expired');
    expect(expiredCells.length).toBe(1);

    // A2.G1 has 'warn'
    const warnCells = container.querySelectorAll('.fp-matrix-cell.status-warn');
    expect(warnCells.length).toBe(1);
  });

  it('should return null if label is invalid or shelf not found', () => {
    const { container } = render(<ShelfMatrixPreview label="INVALID LABEL" />);
    expect(container.firstChild).toBeNull();
  });
});
