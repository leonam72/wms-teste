import { create } from 'zustand';
import type { AppState, Depot, Shelf, Product, HistoryItem, FPObject, FilterType } from '../types';
import { isItemOperable } from '../utils/expiry';
import { logAuditAction, updateProductDetails } from '../services/api';

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

// --- DADOS MOCADOS PROFISSIONAIS (FALLBACK) ---
const MOCK_DEPOTS: Depot[] = [{ id: 'dep1', name: 'CD Norte - Leonam', address: 'Av. Industrial, 500' }];
const MOCK_SHELVES: Record<string, Shelf[]> = { dep1: [] };
const MOCK_PRODUCTS: Record<string, Record<string, Product[]>> = { dep1: {} };
const MOCK_FP_OBJECTS: Record<string, FPObject[]> = { dep1: [] };
const MOCK_HISTORY: HistoryItem[] = [];

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
    
    // Mapear inventário do banco para o formato do frontend
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
    } catch (err) {
      console.error('Erro ao sincronizar produto com DB', err);
    }
  },

  logAction: async (icon, action, detail, productCode, qty, extra) => {
    try {
      const serverLog = await logAuditAction({ action, detail, productCode, qty });
      set((state) => ({
        appHistory: [
          { 
            ts: serverLog.timestamp, 
            icon, 
            action: serverLog.actionType, 
            detail: serverLog.notes,
            user: 'Leonam Admin',
            sku: productCode,
            ...extra
          }, 
          ...state.appHistory
        ].slice(0, 500)
      }));
    } catch (err) {
      set((state) => ({
        appHistory: [
          { 
            ts: new Date().toISOString(), 
            icon, 
            action, 
            detail,
            user: 'Leonam Admin',
            sku: productCode,
            ...extra 
          }, 
          ...state.appHistory
        ].slice(0, 500)
      }));
    }
  },

  // ... (manter as outras funções como addDepot, addProductToDrawer etc para suporte offline/local temporário)
  addDepot: (depot) => set((state) => ({ depots: [...state.depots, depot] })),
  removeDepot: (id) => {},
  updateDepot: (id, data) => {},
  addShelf: (depotId, shelf) => {},
  removeShelf: (depotId, shelfId) => {},
  
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

    if (!isItemOperable(productToMove.expiries)) {
      state.logAction('⚠️', 'Bloqueio', `Transferência abortada: ${productCode} está VENCIDO.`);
      return false;
    }

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
    return { 
      fpObjects: { 
        ...state.fpObjects, 
        [depotId]: objs.map(o => ids.includes(o.id) ? { ...o, selected } : o) 
      } 
    };
  }),

  clearSelection: (depotId) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { 
      fpObjects: { 
        ...state.fpObjects, 
        [depotId]: objs.map(o => ({ ...o, selected: false })) 
      } 
    };
  }),

  deleteSelectedObjects: (depotId) => set((state) => {
    const objs = state.fpObjects[depotId] || [];
    return { 
      fpObjects: { 
        ...state.fpObjects, 
        [depotId]: objs.filter(o => !o.selected) 
      } 
    };
  }),

  generateShelves: (depotId, count, startPrefix, floors, drawers, maxKg) => set((state) => {
    const newShelves: Shelf[] = [];
    let startChar = startPrefix.toUpperCase().charCodeAt(0);
    for (let i = 0; i < count; i++) {
      const code = String.fromCharCode(startChar + i);
      newShelves.push({ id: `sh-${code}`, code, floors, drawers, maxKg, depotId } as any);
    }
    return { shelvesAll: { ...state.shelvesAll, [depotId]: [...(state.shelvesAll[depotId] || []), ...newShelves] } };
  }),
}));
