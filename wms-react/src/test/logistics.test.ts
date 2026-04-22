import { describe, it, expect, beforeEach } from 'vitest';
import { useWMSStore } from '../store/useWMSStore';

describe('WMS Logistics - Transfer Logic', () => {
  beforeEach(() => {
    // Resetar o estado se necessário ou garantir dados iniciais
  });

  it('should transfer product from A to B correctly', () => {
    const { addProductToDrawer, executeTransfer } = useWMSStore.getState();
    const sku = 'MOVE-001';
    
    // Setup: Adiciona 10 itens na gaveta A1.G1
    addProductToDrawer('A1.G1', {
      code: sku, name: 'Produto Move', kg: 1, qty: 10, unit: 'un', entry: '2025-01-01', expiries: []
    });

    // Ação: Move 4 itens para B1.G1
    const success = executeTransfer('A1.G1', 'B1.G1', sku, 4);
    
    const state = useWMSStore.getState();
    const source = state.productsAll['dep1']['A1.G1'].find(p => p.code === sku);
    const dest = state.productsAll['dep1']['B1.G1'].find(p => p.code === sku);
    const history = state.appHistory[0];

    expect(success).toBe(true);
    expect(source?.qty).toBe(6); // 10 - 4
    expect(dest?.qty).toBe(4);   // 0 + 4
    expect(history.action).toContain(sku);
    expect(history.detail).toContain('A1.G1 ⮕ B1.G1');
  });

  it('should remove product from source if all qty is moved', () => {
    const { addProductToDrawer, executeTransfer } = useWMSStore.getState();
    const sku = 'TOTAL-MOVE';
    
    addProductToDrawer('A2.G2', {
      code: sku, name: 'Produto Total', kg: 1, qty: 5, unit: 'un', entry: '2025-01-01', expiries: []
    });

    executeTransfer('A2.G2', 'B2.G2', sku, 5);
    
    const state = useWMSStore.getState();
    const sourceProds = state.productsAll['dep1']['A2.G2'];
    const dest = state.productsAll['dep1']['B2.G2'].find(p => p.code === sku);

    expect(sourceProds.find(p => p.code === sku)).toBeUndefined();
    expect(dest?.qty).toBe(5);
  });

  it('should fail if moving more than available quantity', () => {
    const { addProductToDrawer, executeTransfer } = useWMSStore.getState();
    const sku = 'FAIL-MOVE';
    
    addProductToDrawer('A3.G3', {
      code: sku, name: 'Produto Falha', kg: 1, qty: 2, unit: 'un', entry: '2025-01-01', expiries: []
    });

    const success = executeTransfer('A3.G3', 'B3.G3', sku, 5); // Tenta mover 5 tendo 2
    expect(success).toBe(false);
  });
});
