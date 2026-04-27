// wms-react/src/types/index.ts

export type Unit = 'un' | 'cx' | 'kg' | 'lt' | 'mt' | 'pc' | 'pr';

export interface Product {
  code: string;
  name: string;
  kg: number;
  entry: string; // ISO Date string
  lot?: string;
  expiries: string[]; // Array of ISO Date strings
  location?: string; // e.g. "A1.G2"
  qty: number;
  unit: Unit;
  category?: string;
  supplier?: string;
  notes?: string;
}

export interface Shelf {
  id: string; // e.g. "A"
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
  ts: string; // ISO Date string
  icon: string;
  action: string;
  detail: string;
  user?: string;
  sku?: string;
  from?: string;
  to?: string;
  device?: string;
}

export type PageID = 'depot' | 'depots' | 'products' | 'floorplan' | 'history' | 'receiving' | 'quality' | 'logistics-v2' | 'audit' | 'debug';

export type FilterType = 'occupied' | 'empty' | 'expired' | 'expiring' | 'multi' | 'selected' | 'low_stock' | 'no_expiry' | null;

export interface FPObject {
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

export interface AppState {
  depots: Depot[];
  activeDepotId: string;
  shelvesAll: Record<string, Shelf[]>;
  productsAll: Record<string, Record<string, Product[]>>;
  appHistory: HistoryItem[];
  // FloorPlan State
  fpObjects: Record<string, FPObject[]>;
  fpZoom: number;
  drawerLocks: Record<string, boolean>;
  // Move Mode State
  moveContext: {
    fromKey: string;
    product: Product;
  } | null;
}
