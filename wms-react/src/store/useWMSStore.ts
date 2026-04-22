import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Depot, Shelf, Product, HistoryItem } from '../types';
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

export const useWMSStore = create<AppState & WMSActions>()(
  persist(
    (set) => ({
      depots: initialDepots,
      activeDepotId: 'dep1',
      shelvesAll: initialShelves,
      productsAll: initialProducts,
      appHistory: [],

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

      logAction: (icon, action, detail) => set((state) => ({
        appHistory: [{ ts: new Date().toISOString(), icon, action, detail }, ...state.appHistory].slice(0, 200)
      })),

      moveProduct: (fromLoc, toLoc, code, qty) => set((state) => {
        const depotId = state.activeDepotId;
        const products = { ...state.productsAll[depotId] };
        
        // Simples lógica de transferência (precisa ser expandida para lidar com arrays de produtos por gaveta)
        // No React, faremos isso de forma muito mais limpa usando sub-métodos
        return state; // Placeholder para implementação detalhada no componente
      }),
    }),
    {
      name: 'wms-storage',
    }
  )
);
