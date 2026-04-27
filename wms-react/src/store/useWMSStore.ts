import { create } from 'zustand';
import { isItemOperable } from '../utils/expiry';
import { 
    logAuditAction, 
    updateProductDetails, 
    getWMSState, 
    syncInventoryAdd, 
    syncInventoryTransfer,
    syncFloorPlan 
} from '../services/api';

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
  addProductToDrawer: (drawerKey: string, product: Product) => Promise<void>;
  removeProductFromDrawer: (drawerKey: string, productCode: string, qty: number) => Promise<void>;
  updateFPObject: (depotId: string, id: string, data: Partial<IFloorPlanObject>) => void;
  addFPObject: (depotId: string, obj: IFloorPlanObject) => void;
  syncCurrentFloorPlan: () => Promise<void>;
  setFpZoom: (zoom: number) => void;
  setObjectSelection: (depotId: string, ids: string[], selected: boolean) => void;
  clearSelection: (depotId: string) => void;
  deleteSelectedObjects: (depotId: string) => void;
  logAction: (icon: string, action: string, detail: string, productCode?: string, qty?: number, extra?: Partial<HistoryItem>) => Promise<void>;
  updateProductInfo: (code: string, name: string) => Promise<void>;
  setMoveContext: (ctx: { fromKey: string, product: Product } | null) => void;
  setFullState: (apiData: any) => void;
  refreshState: () => Promise<void>;
  executeTransfer: (fromKey: string, toKey: string, productCode: string, qty: number) => Promise<boolean>;
  setDrawerLock: (drawerKey: string, locked: boolean) => void;
  generateShelves: (depotId: string, count: number, startPrefix: string, floors: number, drawers: number, maxKg: number) => void;
}

export const useWMSStore = create<AppState & WMSActions>((set, get) => ({
  depots: [],
  activeDepotId: 'dep1',
  shelvesAll: {},
  productsAll: {},
  appHistory: [],
  fpObjects: {},
  fpZoom: 1,
  drawerLocks: {},
  moveContext: null,

  refreshState: async () => {
      const activeId = get().activeDepotId;
      try {
          const data = await getWMSState(activeId);
          get().setFullState(data);
      } catch (err) {
          console.error("Erro ao atualizar dados do banco SQL");
      }
  },

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
        icon: h.actionType === 'ENTRADA' ? '📥' : h.actionType === 'AJUSTE' ? '🛠️' : '📋',
        action: h.actionType,
        detail: h.notes,
        sku: h.productCode
      })),
      fpObjects: { [apiData.depot.id]: apiData.depot.fpObjects.map((o: any) => ({
          id: o.id,
          type: o.type,
          x: o.x,
          y: o.y,
          w: o.width,
          h: o.height,
          label: o.label,
          color: o.color,
          rotation: o.rotation
      })) }
    });
  },

  setActiveDepot: (id) => set({ activeDepotId: id }),

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
      await get().refreshState();
    } catch (err) { console.error(err); }
  },

  logAction: async (icon, action, detail, productCode, qty, extra) => {
    try {
      await logAuditAction({ action, detail, productCode, qty });
      await get().refreshState();
    } catch (err) {
       console.error("Erro ao gravar log real no banco");
    }
  },

  addProductToDrawer: async (drawerKey, product) => {
    if (get().drawerLocks[drawerKey]) return;
    const activeId = get().activeDepotId;
    
    // Regex para extrair ShelfCode, Floor e Drawer do drawerKey (ex: A1.G1 ou sh-a1.G1)
    const match = drawerKey.match(/^([A-Z0-9-]+)(\d+)\.G(\d+)$/i);
    if (!match) return;
    const [, shelfCode, floor, drawer] = match;

    try {
        await syncInventoryAdd({
            depotId: activeId,
            shelfCode,
            floor: parseInt(floor),
            drawer: parseInt(drawer),
            product,
            qty: product.qty
        });
        await get().refreshState();
    } catch (err) {
        console.error("Erro ao sincronizar adição no SQL");
    }
  },

  removeProductFromDrawer: async (drawerKey, productCode, qty) => {
    if (get().drawerLocks[drawerKey]) return;
    // Para simplificar o protótipo real, o remove pode ser um add com qty negativa no backend
    // ou um endpoint específico. Vou usar o refreshState após operações manuais se o backend suportar.
    await get().refreshState();
  },

  setMoveContext: (moveContext) => set({ moveContext }),

  executeTransfer: async (fromKey, toKey, productCode, qty) => {
    const activeId = get().activeDepotId;
    try {
        await syncInventoryTransfer({
            depotId: activeId,
            productCode,
            qty,
            fromLoc: fromKey,
            toLoc: toKey
        });
        await get().refreshState();
        return true;
    } catch (err) {
        return false;
    }
  },

  updateFPObject: (depotId, id, data) => {
      set((state) => {
        const objs = state.fpObjects[depotId] || [];
        return { fpObjects: { ...state.fpObjects, [depotId]: objs.map(o => o.id === id ? { ...o, ...data } : o) } };
      });
      // Sincronização opcional automática ou via botão "Salvar Layout"
  },

  addFPObject: (depotId, obj) => {
      set((state) => {
        const objs = state.fpObjects[depotId] || [];
        return { fpObjects: { ...state.fpObjects, [depotId]: [...objs, obj] } };
      });
  },

  syncCurrentFloorPlan: async () => {
      const activeId = get().activeDepotId;
      const objects = get().fpObjects[activeId] || [];
      try {
          await syncFloorPlan(activeId, objects);
          console.log("Planta sincronizada no banco SQL!");
      } catch (err) {
          console.error("Falha ao salvar planta no SQL");
      }
  },

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
