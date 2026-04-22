import { create } from 'zustand';
import type { AppState, Depot, Shelf, Product, HistoryItem } from '../types';
import { initialProducts } from './initialData';

interface WMSActions {
  setActiveDepot: (id: string) => void;
  addDepot: (depot: Depot) => void;
  removeDepot: (id: string) => void;
  updateDepot: (id: string, depot: Partial<Depot>) => void;
  
  addShelf: (depotId: string, shelf: Shelf) => void;
  removeShelf: (depotId: string, shelfId: string) => void;
  
  moveProduct: (
    fromLocation: string,
    toLocation: string,
    productCode: string,
    qty: number
  ) => void;
  
  logAction: (icon: string, action: string, detail: string) => void;
}

const initialDepots: Depot[] = [
  { id: 'dep1', name: 'Depósito Principal' }
];

const initialShelves: Record<string, Shelf[]> = {
  dep1: [
    { id: 'A', floors: 6, drawers: 4, maxKg: 80  },
    { id: 'B', floors: 6, drawers: 4, maxKg: 60  },
    { id: 'C', floors: 5, drawers: 4, maxKg: 100 },
    { id: 'D', floors: 4, drawers: 3, maxKg: 30  },
  ]
};

export const useWMSStore = create<AppState & WMSActions>((set) => ({
  depots: initialDepots,
  activeDepotId: 'dep1',
  shelvesAll: initialShelves,
  productsAll: initialProducts,
  appHistory: [
    { ts: new Date(Date.now() - 3600000).toISOString(), icon: '➕', action: 'Entrada de Produto', detail: 'P001 (Parafuso M6x20) recebido no Depósito Principal.' },
    { ts: new Date(Date.now() - 86400000).toISOString(), icon: '🔀', action: 'Movimentação', detail: 'E011 movido de B2.G1 para A1.G2 por João.' },
    { ts: new Date(Date.now() - 172800000).toISOString(), icon: '🏭', action: 'Criação de Depósito', detail: 'Depósito Principal criado pelo Administrador.' }
  ],
  fpObjects: {
    dep1: [
      { id: 'sh1', type: 'shelf', x: 100, y: 100, w: 200, h: 60, label: 'PRATELEIRA A' },
      { id: 'sh2', type: 'shelf', x: 100, y: 180, w: 200, h: 60, label: 'PRATELEIRA B' },
      { id: 'sh3', type: 'shelf', x: 350, y: 100, w: 60, h: 200, label: 'PRATELEIRA C' },
      { id: 'ar1', type: 'area', x: 500, y: 50, w: 150, h: 150, label: 'DOCA ENTRADA', color: '#eef6ee' },
    ]
  },
  fpZoom: 1,

  setActiveDepot: (id) => set({ activeDepotId: id }),
  
  addDepot: (depot) => set((state) => ({ 
    depots: [...state.depots, depot],
    shelvesAll: { ...state.shelvesAll, [depot.id]: [] },
    productsAll: { ...state.productsAll, [depot.id]: {} }
  })),

  removeDepot: (id) => set((state) => {
    const { [id]: _, ...remainingShelves } = state.shelvesAll;
    const { [id]: __, ...remainingProducts } = state.productsAll;
    return {
      depots: state.depots.filter(d => d.id !== id),
      shelvesAll: remainingShelves,
      productsAll: remainingProducts,
      activeDepotId: state.activeDepotId === id ? state.depots[0]?.id : state.activeDepotId
    };
  }),

  updateDepot: (id, data) => set((state) => ({
    depots: state.depots.map(d => d.id === id ? { ...d, ...data } : d)
  })),

  addShelf: (depotId, shelf) => set((state) => ({
    shelvesAll: {
      ...state.shelvesAll,
      [depotId]: [...(state.shelvesAll[depotId] || []), shelf]
    }
  })),

  removeShelf: (depotId, shelfId) => set((state) => ({
    shelvesAll: {
      ...state.shelvesAll,
      [depotId]: (state.shelvesAll[depotId] || []).filter(s => s.id !== shelfId)
    }
  })),

  addProductToDrawer: (drawerKey, product) => set((state) => {
    const depotId = state.activeDepotId;
    const currentProducts = state.productsAll[depotId] || {};
    const drawerProducts = currentProducts[drawerKey] || [];
    
    return {
      productsAll: {
        ...state.productsAll,
        [depotId]: {
          ...currentProducts,
          [drawerKey]: [...drawerProducts, product]
        }
      }
    };
  }),

  logAction: (icon, action, detail) => set((state) => ({
    appHistory: [{ ts: new Date().toISOString(), icon, action, detail }, ...state.appHistory].slice(0, 200)
  })),

  moveProduct: (fromLoc, toLoc, code, qty) => set((state) => {
    const depotId = state.activeDepotId;
    // Lógica simplificada
    return state;
  }),
}));
