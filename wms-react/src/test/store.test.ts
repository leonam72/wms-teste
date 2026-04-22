import { describe, it, expect, beforeEach } from 'vitest';
import { useWMSStore } from '../store/useWMSStore';

describe('WMS Store (Zustand)', () => {
  beforeEach(() => {
    // Como o store é global, poderíamos resetá-lo aqui se necessário
  });

  it('should have initial depots', () => {
    const { addDepot, setActiveDepot } = useWMSStore.getState();
    addDepot({ id: 'dep1', name: 'Test' });
    setActiveDepot('dep1');
    const state = useWMSStore.getState();
    expect(state.depots.length).toBeGreaterThan(0);
    expect(state.activeDepotId).toBe('dep1');
  });

  it('should add a product to a drawer', () => {
    const { addProductToDrawer } = useWMSStore.getState();
    const product = {
      code: 'TEST-001',
      name: 'Test Product',
      kg: 1,
      qty: 10,
      unit: 'un' as any,
      entry: '2025-01-01',
      expiries: []
    };

    addProductToDrawer('A1.G1', product);

    const updatedState = useWMSStore.getState();
    const productsInDrawer = updatedState.productsAll['dep1']['A1.G1'];
    expect(productsInDrawer).toContainEqual(product);
  });

  it('should log an action to history', () => {
    const { logAction } = useWMSStore.getState();
    const initialCount = useWMSStore.getState().appHistory.length;

    logAction('🧪', 'Teste de Unidade', 'Detalhe do teste');

    const updatedHistory = useWMSStore.getState().appHistory;
    expect(updatedHistory.length).toBe(initialCount + 1);
    expect(updatedHistory[0].action).toBe('Teste de Unidade');
    expect(updatedHistory[0].icon).toBe('🧪');
  });
});
