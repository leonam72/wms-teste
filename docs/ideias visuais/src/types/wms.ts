export type Role = "administrador" | "gestor" | "operador" | "conferente" | "auditor";

export type EntityStatus = "ativo" | "bloqueado" | "interditado" | "quarentena" | "manutencao";
export type DockMode = "inbound" | "outbound" | "misto";
export type ShipmentStatus = "fila" | "em_doca" | "conferencia" | "finalizado" | "alerta";
export type ValidationDecision = "pendente" | "aprovado" | "recontagem" | "rejeitado";

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
  warehouseIds: string[];
  active: boolean;
  lastAccess: string;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  purpose: string;
}

export interface Product {
  id: string;
  sku: string;
  description: string;
  category: string;
  unit: string;
  dimensions: string;
  weightKg: number;
  volumeM3: number;
  maxStack: number;
  pickingPriority: "alta" | "media" | "baixa";
  lot: string;
  expiresAt: string;
  manufacturer: string;
  supplier: string;
  abcCurve: "A" | "B" | "C";
  status: "normal" | "baixo" | "quarentena" | "bloqueado";
  notes: string;
  stockUnits: number;
  history: string[];
}

export interface PalletItem {
  productId: string;
  quantity: number;
}

export interface Pallet {
  id: string;
  code: string;
  binId: string;
  stackLevel: number;
  maxWeightKg: number;
  currentWeightKg: number;
  status: EntityStatus;
  items: PalletItem[];
  note?: string;
}

export interface Bin {
  id: string;
  code: string;
  warehouseId: string;
  zoneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stackLimit: number;
  maxLoadKg: number;
  locked: boolean;
  status: EntityStatus;
  aisle: string;
  favorite?: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  address: string;
  capacityPallets: number;
  zones: Zone[];
  bins: Bin[];
}

export interface Dock {
  id: string;
  warehouseId: string;
  name: string;
  mode: DockMode;
  status: "livre" | "ocupada" | "manutencao";
  shipmentId?: string;
  timerMinutes: number;
}

export interface Shipment {
  id: string;
  warehouseId: string;
  direction: DockMode;
  carrier: string;
  plate: string;
  status: ShipmentStatus;
  expectedItems: number;
  countedItems: number;
  eta: string;
  priority: "alta" | "media" | "baixa";
  dockId?: string;
}

export interface ReceivingItem {
  productId: string;
  expectedQty: number;
  receivedQty: number;
  lot: string;
  expiresAt: string;
}

export interface ReceivingSession {
  id: string;
  shipmentId: string;
  checklist: { label: string; done: boolean }[];
  photos: string[];
  notes: string;
  items: ReceivingItem[];
  status: "documental" | "cega" | "validacao" | "estoque";
}

export interface BlindCountItem {
  productId: string;
  expectedQty: number;
  countedQty: number;
  divergence?: string;
}

export interface BlindCountSession {
  id: string;
  receivingId: string;
  operatorId: string;
  timerSeconds: number;
  status: "em_andamento" | "aguardando_validacao" | "concluida";
  photos: string[];
  items: BlindCountItem[];
}

export interface ValidationCase {
  id: string;
  blindCountId: string;
  decision: ValidationDecision;
  justification: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  role: Role;
  when: string;
  module: string;
  action: string;
  entity: string;
  location: string;
  before?: string;
  after?: string;
}

export interface SystemSettings {
  expiryWarningDays: number;
  defaultStackLimit: number;
  compactMode: boolean;
  notificationsEnabled: boolean;
  operationalTheme: "padrao" | "alto-contraste";
  editorPassword: string;
}

export interface ToastItem {
  id: string;
  title: string;
  tone: "info" | "success" | "warning" | "error";
}
