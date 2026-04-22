import { create } from 'zustand';
import type { AppState, Depot, Shelf, Product, HistoryItem, FPObject, FilterType } from '../types';

interface WMSActions {
  setActiveDepot: (id: string) => void;
  addDepot: (depot: Depot) => void;
  removeDepot: (id: string) => void;
  updateDepot: (id: string, depot: Partial<Depot>) => void;
  addShelf: (depotId: string, shelf: Shelf) => void;
  removeShelf: (depotId: string, shelfId: string) => void;
  addProductToDrawer: (drawerKey: string, product: Product) => void;
  removeProductFromDrawer: (drawerKey: string, productCode: string, qty: number) => void;
  updateFPObject: (depotId: string, id: string, data: Partial<FPObject>) => void;
  logAction: (icon: string, action: string, detail: string) => void;
  setMoveContext: (ctx: { fromKey: string, product: Product } | null) => void;
  setFullState: (apiData: any) => void;
  executeTransfer: (fromKey: string, toKey: string, productCode: string, qty: number) => boolean;
  generateShelves: (depotId: string, count: number, startPrefix: string, floors: number, drawers: number, maxKg: number) => void;
}

// --- DADOS MOCADOS PROFISSIONAIS (FALLBACK) ---

const MOCK_DEPOTS: Depot[] = [
  { id: 'dep1', name: 'CD Norte - Leonam (Offline)', address: 'Av. Industrial, 500' }
];

const MOCK_SHELVES: Record<string, Shelf[]> = {
  dep1: [
    { id: 'sh-a', code: 'A', floors: 6, drawers: 4, maxKg: 500 },
    { id: 'sh-b', code: 'B', floors: 6, drawers: 4, maxKg: 500 },
    { id: 'sh-c', code: 'C', floors: 5, drawers: 3, maxKg: 800 },
  ]
};

const MOCK_PRODUCTS: Record<string, Record<string, Product[]>> = {
  dep1: {
    'A1.G1': [
      { code: 'P001', name: 'Parafuso M6x20', kg: 0.012, qty: 500, unit: 'un', entry: '2025-01-10', expiries: [] },
      { code: 'P002', name: 'Parafuso M8x30', kg: 0.018, qty: 250, unit: 'un', entry: '2025-01-10', expiries: [] }
    ],
    'B2.G1': [
      { code: 'E011', name: 'Lâmpada LED 9W', kg: 0.08, qty: 45, unit: 'un', entry: '2025-02-01', expiries: ['2025-12-31'] },
      { code: 'Q004', name: 'Fita Isolante 20m', kg: 0.05, qty: 20, unit: 'un', entry: '2025-02-01', expiries: ['2024-05-10'] } // VENCIDO
    ],
    'A6.G1': [
      { code: 'M001', name: 'Trena 5m Emborrachada', kg: 0.25, qty: 10, unit: 'un', entry: '2025-03-15', expiries: [] }
    ]
  }
};

const MOCK_FP_OBJECTS: Record<string, FPObject[]> = {
  dep1: [
    { id: 'sh1', type: 'shelf', x: 100, y: 100, w: 200, h: 60, label: 'PRATELEIRA A' },
    { id: 'sh2', type: 'shelf', x: 100, y: 180, w: 200, h: 60, label: 'PRATELEIRA B' },
    { id: 'sh3', type: 'shelf', x: 350, y: 100, w: 60, h: 200, label: 'PRATELEIRA C' },
    { id: 'ar1', type: 'area', x: 500, y: 50, w: 150, h: 150, label: 'DOCA RECEBIMENTO', color: '#eef6ee' },
  ]
};

const MOCK_HISTORY: HistoryItem[] = [
  { ts: new Date().toISOString(), icon: '📥', action: 'Sistema Iniciado', detail: 'Modo Offline Ativado com sucesso.' },
  { ts: new Date(Date.now() - 3600000).toISOString(), icon: '➕', action: 'Entrada: P001', detail: '500 unidades na A1.G1' },
  { ts: new Date(Date.now() - 7200000).toISOString(), icon: '🔀', action: 'Transferência: E011', detail: 'Doca ⮕ B2.G1' }
];

export const useWMSStore = create<AppState & WMSActions>((set, get) => ({
  depots: MOCK_DEPOTS,
  activeDepotId: 'dep1',
  shelvesAll: MOCK_SHELVES,
  productsAll: MOCK_PRODUCTS,
  appHistory: MOCK_HISTORY,
  fpObjects: MOCK_FP_OBJECTS,
  fpZoom: 1,
  moveContext: null,

  setFullState: (apiData) => {
    if (!apiData || !apiData.depot) return;
    set({
      depots: [{ id: apiData.depot.id, name: apiData.depot.name, address: apiData.depot.address }],
      shelvesAll: { [apiData.depot.id]: apiData.depot.shelves },
      appHistory: apiData.history || []
    });
  },

  setActiveDepot: (id) => set({ activeDepotId: id }),
  addDepot: (depot) => set((state) => ({ 
    depots: [...state.depots, depot],
    shelvesAll: { ...state.shelvesAll, [depot.id]: [] },
    productsAll: { ...state.productsAll, [depot.id]: {} },
    fpObjects: { ...state.fpObjects, [depot.id]: [] }
  })),
  generateShelves: (depotId, count, startPrefix, floors, drawers, maxKg) => set((state) => {
    const newShelves: Shelf[] = [];
    let startChar = startPrefix.toUpperCase().charCodeAt(0);
    for (let i = 0; i < count; i++) {
      const code = String.fromCharCode(startChar + i);
      newShelves.push({ id: `sh-${code}`, code, floors, drawers, maxKg, depotId } as any);
    }
    return { shelvesAll: { ...state.shelvesAll, [depotId]: [...(state.shelvesAll[depotId] || []), ...newShelves] } };
  }),
  addProductToDrawer: (drawerKey, product) => set((state) => {
    const depotId = state.activeDepotId;
    const currentDepotProds = { ...state.productsAll[depotId] } || {};
    const drawerProds = [...(currentDepotProds[drawerKey] || [])];
    const idx = drawerProds.findIndex(p => p.code === product.code);
    if (idx > -1) drawerProds[idx] = { ...drawerProds[idx], qty: drawerProds[idx].qty + product.qty };
    else drawerProds.push(product);
    return { productsAll: { ...state.productsAll, [depotId]: { ...currentDepotProds, [drawerKey]: drawerProds } } };
  }),
  removeProductFromDrawer: (drawerKey, productCode, qty) => set((state) => {
    const depotId = state.activeDepotId;
    const currentDepotProds = { ...state.productsAll[depotId] } || {};
    const drawerProds = [...(currentDepotProds[drawerKey] || [])];
    const idx = drawerProds.findIndex(p => p.code === productCode);
    if (idx > -1) {
      if (drawerProds[idx].qty <= qty) drawerProds.splice(idx, 1);
      else drawerProds[idx] = { ...drawerProds[idx], qty: drawerProds[idx].qty - qty };
    }
    return { productsAll: { ...state.productsAll, [depotId]: { ...currentDepotProds, [drawerKey]: drawerProds } } };
  }),
  setMoveContext: (moveContext) => set({ moveContext }),
  executeTransfer: (fromKey, toKey, productCode, qty) => {
    const state = get();
    const depotId = state.activeDepotId;
    const productToMove = state.productsAll[depotId]?.[fromKey]?.find(p => p.code === productCode);
    if (!productToMove || productToMove.qty < qty) return false;
    state.removeProductFromDrawer(fromKey, productCode, qty);
    state.addProductToDrawer(toKey, { ...productToMove, qty });
    state.logAction('🔀', `Movimentação: ${productCode}`, `${fromKey} ⮕ ${toKey} (${qty} ${productToMove.unit})`);
    return true;
  },
  updateFPObject: (depotId, id, data) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { fpObjects: { ...state.fpObjects, [depotId]: objs.map(o => o.id === id ? { ...o, ...data } : o) } };
  }),
  logAction: (icon, action, detail) => set((state) => ({
    appHistory: [{ ts: new Date().toISOString(), icon, action, detail }, ...state.appHistory].slice(0, 200)
  })),
}));
