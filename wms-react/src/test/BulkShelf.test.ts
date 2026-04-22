import { describe, it, expect } from 'vitest';
import { useWMSStore } from '../store/useWMSStore';

describe('WMS Store - Bulk Generate Shelves', () => {
  it('should generate multiple shelves with the correct parameters', () => {
    // Initial state setup if needed
    const { addDepot, setActiveDepot, generateShelves } = useWMSStore.getState();
    addDepot({ id: 'dep-test', name: 'Test Depot' });
    setActiveDepot('dep-test');

    // Action: Generate 3 shelves starting from prefix 'E', floors=4, drawers=5
    generateShelves('dep-test', 3, 'E', 4, 5, 50);

    const state = useWMSStore.getState();
    const shelves = state.shelvesAll['dep-test'];

    expect(shelves.length).toBeGreaterThanOrEqual(3);
    
    // Check if E, F, G were generated
    const e = shelves.find(s => s.code === 'E');
    const f = shelves.find(s => s.code === 'F');
    const g = shelves.find(s => s.code === 'G');

    expect(e).toBeDefined();
    expect(e?.floors).toBe(4);
    expect(e?.drawers).toBe(5);
    expect(e?.maxKg).toBe(50);

    expect(f).toBeDefined();
    expect(g).toBeDefined();
  });
});
