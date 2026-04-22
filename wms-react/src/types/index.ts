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
}

export type PageID = 'depot' | 'depots' | 'products' | 'floorplan' | 'history';

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
}
