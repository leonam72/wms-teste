import { describe, it, expect } from 'vitest';
import { useWMSStore } from '../store/useWMSStore';

describe('WMS PDCA - Full Logistics Flow', () => {
  it('should complete a full movement cycle', () => {
    const { addProductToDrawer, executeTransfer, logAction } = useWMSStore.getState();
    const sku = 'PDCA-FLOW';
    
    // 1. Entrada (PLAN/DO)
    addProductToDrawer('A1.G1', {
      code: sku, name: 'Produto Fluxo', kg: 1, qty: 50, unit: 'un', entry: '2025-01-01', expiries: []
    });

    // 2. Iniciar Movimentação (CHECK/UI logic)
    const store = useWMSStore.getState();
    const prod = store.productsAll['dep1']['A1.G1'][0];
    
    // Simula a UI setando o contexto de movimento
    useWMSStore.setState({ moveContext: { fromKey: 'A1.G1', product: prod } });
    
    // 3. Executar (ACT)
    const success = executeTransfer('A1.G1', 'B5.G4', sku, 50);
    
    const finalState = useWMSStore.getState();
    expect(success).toBe(true);
    expect(finalState.productsAll['dep1']['A1.G1']).toHaveLength(0);
    expect(finalState.productsAll['dep1']['B5.G4'][0].qty).toBe(50);
    expect(finalState.appHistory[0].detail).toContain('A1.G1 ⮕ B5.G4');
  });
});
