import { create } from 'zustand';
import { isItemOperable } from '../utils/expiry';
import { logAuditAction, updateProductDetails } from '../services/api';

// --- INLINE TYPES TO FIX VITE IMPORT BUG ---
export interface IFloorPlanObject {
  id: string;
  type: 'shelf' | 'wall' | 'area' | 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  color?: string;
  rotation?: number;
  selected?: boolean;
}

export type Unit = 'un' | 'cx' | 'kg' | 'lt' | 'mt' | 'pc' | 'pr';

export interface Product {
  code: string;
  name: string;
  kg: number;
  entry: string;
  lot?: string;
  expiries: string[];
  location?: string;
  qty: number;
  unit: Unit;
  category?: string;
  supplier?: string;
  notes?: string;
}

export interface Shelf {
  id: string;
  code: string;
  floors: number;
  drawers: number;
  maxKg: number;
}

export interface Depot {
  id: string;
  name: string;
  address?: string;
  city?: string;
  manager?: string;
  phone?: string;
  notes?: string;
}

export type HistoryItem = {
  ts: string;
  icon: string;
  action: string;
  detail: string;
  user?: string;
  sku?: string;
  from?: string;
  to?: string;
  device?: string;
}

export type FilterType = 'occupied' | 'empty' | 'expired' | 'expiring' | 'multi' | 'selected' | 'low_stock' | 'no_expiry' | null;

export interface AppState {
  depots: Depot[];
  activeDepotId: string;
  shelvesAll: Record<string, Shelf[]>;
  productsAll: Record<string, Record<string, Product[]>>;
  appHistory: HistoryItem[];
  fpObjects: Record<string, IFloorPlanObject[]>;
  fpZoom: number;
  drawerLocks: Record<string, boolean>;
  moveContext: {
    fromKey: string;
    product: Product;
  } | null;
}

interface WMSActions {
  setActiveDepot: (id: string) => void;
  addDepot: (depot: Depot) => void;
  removeDepot: (id: string) => void;
  updateDepot: (id: string, depot: Partial<Depot>) => void;
  addShelf: (depotId: string, shelf: Shelf) => void;
  removeShelf: (depotId: string, shelfId: string) => void;
  addProductToDrawer: (drawerKey: string, product: Product) => void;
  removeProductFromDrawer: (drawerKey: string, productCode: string, qty: number) => void;
  updateFPObject: (depotId: string, id: string, data: Partial<IFloorPlanObject>) => void;
  setFpZoom: (zoom: number) => void;
  setObjectSelection: (depotId: string, ids: string[], selected: boolean) => void;
  clearSelection: (depotId: string) => void;
  deleteSelectedObjects: (depotId: string) => void;
  logAction: (icon: string, action: string, detail: string, productCode?: string, qty?: number, extra?: Partial<HistoryItem>) => Promise<void>;
  updateProductInfo: (code: string, name: string) => Promise<void>;
  setMoveContext: (ctx: { fromKey: string, product: Product } | null) => void;
  setFullState: (apiData: any) => void;
  executeTransfer: (fromKey: string, toKey: string, productCode: string, qty: number) => boolean;
  setDrawerLock: (drawerKey: string, locked: boolean) => void;
  generateShelves: (depotId: string, count: number, startPrefix: string, floors: number, drawers: number, maxKg: number) => void;
}

// --- RESTAURAÇÃO DOS DADOS MOCADOS ORIGINAIS ---
const MOCK_DEPOTS: Depot[] = [
  { id: 'dep1', name: 'CD Norte - Leonam (Modo Local)', address: 'Av. Industrial, 500' }
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
      { code: 'Q004', name: 'Fita Isolante 20m', kg: 0.05, qty: 20, unit: 'un', entry: '2025-02-01', expiries: ['2024-05-10'] } 
    ],
    'A6.G1': [
      { code: 'M001', name: 'Trena 5m Emborrachada', kg: 0.25, qty: 10, unit: 'un', entry: '2025-03-15', expiries: [] }
    ]
  }
};

const MOCK_FP_OBJECTS: Record<string, IFloorPlanObject[]> = {
  dep1: [
    { id: 'sh1', type: 'shelf', x: 100, y: 100, w: 200, h: 60, label: 'PRATELEIRA A' },
    { id: 'sh2', type: 'shelf', x: 100, y: 180, w: 200, h: 60, label: 'PRATELEIRA B' },
    { id: 'sh3', type: 'shelf', x: 350, y: 100, w: 60, h: 200, label: 'PRATELEIRA C' },
    { id: 'ar1', type: 'area', x: 500, y: 50, w: 150, h: 150, label: 'DOCA RECEBIMENTO', color: '#eef6ee' },
  ]
};

const MOCK_HISTORY: HistoryItem[] = [
  { ts: new Date().toISOString(), icon: '📥', action: 'Sistema Iniciado', detail: 'Modo Offline Ativado com sucesso.', user: 'SISTEMA' },
];

export const useWMSStore = create<AppState & WMSActions>((set, get) => ({
  depots: MOCK_DEPOTS,
  activeDepotId: 'dep1',
  shelvesAll: MOCK_SHELVES,
  productsAll: MOCK_PRODUCTS,
  appHistory: MOCK_HISTORY,
  fpObjects: MOCK_FP_OBJECTS,
  fpZoom: 1,
  drawerLocks: {},
  moveContext: null,

  setDrawerLock: (drawerKey, locked) => set((state) => ({
    drawerLocks: { ...state.drawerLocks, [drawerKey]: locked }
  })),

  setFullState: (apiData) => {
    if (!apiData || !apiData.depot) return;
    const invMap: Record<string, Product[]> = {};
    apiData.depot.inventory.forEach((item: any) => {
      const key = `${item.shelf.code}${item.floor}.G${item.drawer}`;
      if (!invMap[key]) invMap[key] = [];
      invMap[key].push({
        code: item.product.code,
        name: item.product.name,
        qty: item.qty,
        unit: item.product.unit,
        kg: item.product.kg,
        entry: item.entryDate,
        expiries: item.expiryDate ? [item.expiryDate] : []
      });
    });
    set({
      depots: [{ id: apiData.depot.id, name: apiData.depot.name, address: apiData.depot.address }],
      shelvesAll: { [apiData.depot.id]: apiData.depot.shelves },
      productsAll: { [apiData.depot.id]: invMap },
      appHistory: apiData.history.map((h: any) => ({
        ts: h.timestamp,
        icon: h.actionType === 'entry' ? '📥' : h.actionType === 'ajuste' ? '🛠️' : '📋',
        action: h.actionType,
        detail: h.notes
      }))
    });
  },

  setActiveDepot: (id) => set({ activeDepotId: id }),

  // --- RESTAURAÇÃO DAS FUNÇÕES LÓGICAS COMPLETAS ---
  addDepot: (depot) => set((state) => ({ 
    depots: [...state.depots, depot],
    shelvesAll: { ...state.shelvesAll, [depot.id]: [] },
    productsAll: { ...state.productsAll, [depot.id]: {} },
    fpObjects: { ...state.fpObjects, [depot.id]: [] }
  })),

  removeDepot: (id) => set((state) => {
    const { [id]: _, ...remainingShelves } = state.shelvesAll;
    const { [id]: __, ...remainingProducts } = state.productsAll;
    const { [id]: ___, ...remainingFP } = state.fpObjects;
    return {
      depots: state.depots.filter(d => d.id !== id),
      shelvesAll: remainingShelves,
      productsAll: remainingProducts,
      fpObjects: remainingFP
    };
  }),

  updateDepot: (id, data) => set((state) => ({
    depots: state.depots.map(d => d.id === id ? { ...d, ...data } : d)
  })),

  addShelf: (depotId, shelf) => set((state) => ({
    shelvesAll: { ...state.shelvesAll, [depotId]: [...(state.shelvesAll[depotId] || []), shelf] }
  })),

  removeShelf: (depotId, shelfId) => set((state) => ({
    shelvesAll: { ...state.shelvesAll, [depotId]: (state.shelvesAll[depotId] || []).filter(s => s.id !== shelfId) }
  })),

  updateProductInfo: async (code, name) => {
    try {
      await updateProductDetails(code, { name });
      const state = get();
      const depotId = state.activeDepotId;
      const currentDepotProds = state.productsAll[depotId] || {};
      const newProductsAll = { ...state.productsAll };
      Object.keys(currentDepotProds).forEach(drawerKey => {
        newProductsAll[depotId][drawerKey] = currentDepotProds[drawerKey].map(p => 
          p.code === code ? { ...p, name } : p
        );
      });
      set({ productsAll: newProductsAll });
    } catch (err) { console.error(err); }
  },

  logAction: async (icon, action, detail, productCode, qty, extra) => {
    try {
      const serverLog = await logAuditAction({ action, detail, productCode, qty });
      set((state) => ({
        appHistory: [{ ts: serverLog.timestamp, icon, action: serverLog.actionType, detail: serverLog.notes, user: 'Admin', sku: productCode, ...extra }, ...state.appHistory].slice(0, 500)
      }));
    } catch (err) {
      set((state) => ({
        appHistory: [{ ts: new Date().toISOString(), icon, action, detail, user: 'Admin', sku: productCode, ...extra }, ...state.appHistory].slice(0, 500)
      }));
    }
  },

  addProductToDrawer: (drawerKey, product) => set((state) => {
    if (state.drawerLocks[drawerKey]) {
        console.warn(`Operação cancelada: ${drawerKey} está BLOQUEADA.`);
        return state;
    }
    const depotId = state.activeDepotId;
    const currentDepotProds = { ...state.productsAll[depotId] } || {};
    const drawerProds = [...(currentDepotProds[drawerKey] || [])];
    const idx = drawerProds.findIndex(p => p.code === product.code);
    if (idx > -1) drawerProds[idx] = { ...drawerProds[idx], qty: drawerProds[idx].qty + product.qty };
    else drawerProds.push(product);
    return { productsAll: { ...state.productsAll, [depotId]: { ...currentDepotProds, [drawerKey]: drawerProds } } };
  }),

  removeProductFromDrawer: (drawerKey, productCode, qty) => set((state) => {
    if (state.drawerLocks[drawerKey]) {
        console.warn(`Operação cancelada: ${drawerKey} está BLOQUEADA.`);
        return state;
    }
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
    if (!isItemOperable(productToMove.expiries)) return false;
    state.removeProductFromDrawer(fromKey, productCode, qty);
    state.addProductToDrawer(toKey, { ...productToMove, qty });
    state.logAction('🔀', `Movimentação: ${productCode}`, `${fromKey} ⮕ ${toKey} (${qty} ${productToMove.unit})`);
    return true;
  },

  updateFPObject: (depotId, id, data) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { fpObjects: { ...state.fpObjects, [depotId]: objs.map(o => o.id === id ? { ...o, ...data } : o) } };
  }),

  setFpZoom: (zoom) => set({ fpZoom: Math.max(0.1, Math.min(zoom, 5)) }),

  setObjectSelection: (depotId, ids, selected) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { fpObjects: { ...state.fpObjects, [depotId]: objs.map(o => ids.includes(o.id) ? { ...o, selected } : o) } };
  }),

  clearSelection: (depotId) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { fpObjects: { ...state.fpObjects, [depotId]: objs.map(o => ({ ...o, selected: false })) } };
  }),

  deleteSelectedObjects: (depotId) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { fpObjects: { ...state.fpObjects, [depotId]: objs.filter(o => !o.selected) } };
  }),

  generateShelves: (depotId, count, startPrefix, floors, drawers, maxKg) => set((state) => {
    const newShelves: Shelf[] = [];
    let startChar = startPrefix.toUpperCase().charCodeAt(0);
    for (let i = 0; i < count; i++) {
      const code = String.fromCharCode(startChar + i);
      newShelves.push({ id: `sh-${code}`, code, floors, drawers, maxKg } as any);
    }
    return { shelvesAll: { ...state.shelvesAll, [depotId]: [...(state.shelvesAll[depotId] || []), ...newShelves] } };
  }),
}));
