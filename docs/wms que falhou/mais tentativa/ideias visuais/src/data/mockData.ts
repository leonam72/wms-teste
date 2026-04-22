import {
  AuditLog,
  Bin,
  BlindCountSession,
  Dock,
  Product,
  ReceivingSession,
  Shipment,
  SystemSettings,
  User,
  ValidationCase,
  Warehouse,
} from "../types/wms";

const now = new Date();
const inDays = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();

export const mockUsers: User[] = [
  { id: "u1", username: "admin", password: "Admin@123", name: "Helena Rocha", role: "administrador", warehouseIds: ["wh1", "wh2"], active: true, lastAccess: "2026-03-06 08:10" },
  { id: "u2", username: "gestor", password: "Gestor@123", name: "Marcos Vieira", role: "gestor", warehouseIds: ["wh1", "wh2"], active: true, lastAccess: "2026-03-06 07:45" },
  { id: "u3", username: "operador", password: "Operador@123", name: "Tamires Costa", role: "operador", warehouseIds: ["wh1"], active: true, lastAccess: "2026-03-06 09:02" },
  { id: "u4", username: "conferente", password: "Conferente@123", name: "Rafael Pires", role: "conferente", warehouseIds: ["wh1"], active: true, lastAccess: "2026-03-06 08:56" },
  { id: "u5", username: "auditor", password: "Auditor@123", name: "Bianca Freitas", role: "auditor", warehouseIds: ["wh1", "wh2"], active: true, lastAccess: "2026-03-05 18:20" },
];

export const mockProducts: Product[] = [
  { id: "p1", sku: "SKU-1001", description: "Leite UHT Integral 1L", category: "Laticinios", unit: "cx", dimensions: "40x30x20", weightKg: 12, volumeM3: 0.024, maxStack: 4, pickingPriority: "alta", lot: "LT2401", expiresAt: inDays(8), manufacturer: "LactoSul", supplier: "Distribuidora Alfa", abcCurve: "A", status: "normal", notes: "Separar para picking frontal.", stockUnits: 1480, history: ["Recebido em 01/03", "Movido para ZP-A em 03/03"] },
  { id: "p2", sku: "SKU-1044", description: "Suco de Laranja 900ml", category: "Bebidas", unit: "cx", dimensions: "35x25x18", weightKg: 10.5, volumeM3: 0.018, maxStack: 5, pickingPriority: "alta", lot: "SJ8821", expiresAt: inDays(-2), manufacturer: "Citrus Brasil", supplier: "Fresco Distrib.", abcCurve: "A", status: "quarentena", notes: "Lote vencido aguardando descarte.", stockUnits: 320, history: ["Bloqueado em 04/03 por validade"] },
  { id: "p3", sku: "SKU-2400", description: "Arroz Tipo 1 5kg", category: "Graos", unit: "fd", dimensions: "55x35x18", weightKg: 25, volumeM3: 0.034, maxStack: 6, pickingPriority: "media", lot: "AR3321", expiresAt: inDays(65), manufacturer: "Campos do Sul", supplier: "Agro Mix", abcCurve: "B", status: "normal", notes: "Curva B com alto giro regional.", stockUnits: 2140, history: ["Reabastecido em 28/02"] },
  { id: "p4", sku: "SKU-7790", description: "Biscoito Integral 140g", category: "Mercearia", unit: "cx", dimensions: "28x22x16", weightKg: 7, volumeM3: 0.011, maxStack: 7, pickingPriority: "alta", lot: "BK9012", expiresAt: inDays(32), manufacturer: "Gran Vita", supplier: "Food Service Norte", abcCurve: "A", status: "baixo", notes: "Atenção para reabastecimento.", stockUnits: 560, history: ["Baixo estoque em 06/03"] },
  { id: "p5", sku: "SKU-8899", description: "Detergente Neutro 500ml", category: "Limpeza", unit: "cx", dimensions: "32x21x20", weightKg: 9, volumeM3: 0.013, maxStack: 5, pickingPriority: "media", lot: "DT500", expiresAt: inDays(180), manufacturer: "Casa Limpa", supplier: "HigiePro", abcCurve: "C", status: "normal", notes: "Sem restricoes.", stockUnits: 980, history: ["Transferido de reserva para picking em 05/03"] },
  { id: "p6", sku: "SKU-9302", description: "Cafe Torrado 500g", category: "Mercearia", unit: "cx", dimensions: "30x24x15", weightKg: 8, volumeM3: 0.010, maxStack: 6, pickingPriority: "alta", lot: "CF2026", expiresAt: inDays(25), manufacturer: "Cafe Serra", supplier: "Distribuidora Alfa", abcCurve: "B", status: "normal", notes: "Priorizar saida FEFO.", stockUnits: 1230, history: ["Recebido em 02/03", "Contagem ciclica em 05/03"] },
];

const wh1Bins: Bin[] = [
  { id: "b1", code: "A-01-01", warehouseId: "wh1", zoneId: "z1", x: 40, y: 60, width: 120, height: 78, stackLimit: 3, maxLoadKg: 1200, locked: false, status: "ativo", aisle: "Rua A" },
  { id: "b2", code: "A-01-02", warehouseId: "wh1", zoneId: "z1", x: 190, y: 60, width: 120, height: 78, stackLimit: 3, maxLoadKg: 1200, locked: false, status: "ativo", aisle: "Rua A", favorite: true },
  { id: "b3", code: "A-02-01", warehouseId: "wh1", zoneId: "z2", x: 40, y: 190, width: 120, height: 78, stackLimit: 4, maxLoadKg: 1800, locked: false, status: "ativo", aisle: "Rua B" },
  { id: "b4", code: "A-02-02", warehouseId: "wh1", zoneId: "z2", x: 190, y: 190, width: 120, height: 78, stackLimit: 4, maxLoadKg: 1800, locked: false, status: "quarentena", aisle: "Rua B" },
  { id: "b5", code: "Q-01-01", warehouseId: "wh1", zoneId: "z3", x: 360, y: 60, width: 130, height: 88, stackLimit: 2, maxLoadKg: 900, locked: true, status: "interditado", aisle: "Quarentena" },
  { id: "b6", code: "R-01-01", warehouseId: "wh1", zoneId: "z4", x: 360, y: 190, width: 130, height: 88, stackLimit: 5, maxLoadKg: 2200, locked: false, status: "ativo", aisle: "Reserva" },
];

const wh2Bins: Bin[] = [
  { id: "b7", code: "C-01-01", warehouseId: "wh2", zoneId: "z5", x: 60, y: 80, width: 140, height: 84, stackLimit: 4, maxLoadKg: 1500, locked: false, status: "ativo", aisle: "Rua C" },
  { id: "b8", code: "C-01-02", warehouseId: "wh2", zoneId: "z5", x: 220, y: 80, width: 140, height: 84, stackLimit: 4, maxLoadKg: 1500, locked: false, status: "ativo", aisle: "Rua C" },
  { id: "b9", code: "D-01-01", warehouseId: "wh2", zoneId: "z6", x: 60, y: 220, width: 140, height: 84, stackLimit: 6, maxLoadKg: 2400, locked: false, status: "ativo", aisle: "Rua D" },
];

export const mockWarehouses: Warehouse[] = [
  {
    id: "wh1",
    name: "CD Guarulhos",
    city: "Guarulhos/SP",
    address: "Av. das Docas, 2400",
    capacityPallets: 420,
    zones: [
      { id: "z1", name: "Picking Frontal", color: "#0f766e", purpose: "Separacao de alto giro" },
      { id: "z2", name: "Reserva", color: "#2563eb", purpose: "Reabastecimento" },
      { id: "z3", name: "Quarentena", color: "#dc2626", purpose: "Bloqueios e avarias" },
      { id: "z4", name: "Pulmao", color: "#7c3aed", purpose: "Overflow operacional" },
    ],
    bins: wh1Bins,
  },
  {
    id: "wh2",
    name: "Hub Campinas",
    city: "Campinas/SP",
    address: "Rod. Anhanguera, km 92",
    capacityPallets: 260,
    zones: [
      { id: "z5", name: "Cross Dock", color: "#f97316", purpose: "Transito rapido" },
      { id: "z6", name: "Reserva Fria", color: "#0891b2", purpose: "Controle termico" },
    ],
    bins: wh2Bins,
  },
];

export const mockPallets = [
  { id: "pl1", code: "PLT-001", binId: "b1", stackLevel: 1, maxWeightKg: 1200, currentWeightKg: 820, status: "ativo", items: [{ productId: "p1", quantity: 160 }, { productId: "p6", quantity: 80 }], note: "FEFO prioritario" },
  { id: "pl2", code: "PLT-002", binId: "b1", stackLevel: 2, maxWeightKg: 1200, currentWeightKg: 610, status: "ativo", items: [{ productId: "p4", quantity: 120 }], note: "Picking dinamico" },
  { id: "pl3", code: "PLT-003", binId: "b2", stackLevel: 1, maxWeightKg: 1200, currentWeightKg: 740, status: "ativo", items: [{ productId: "p3", quantity: 75 }], note: "Reserva limpa" },
  { id: "pl4", code: "PLT-004", binId: "b4", stackLevel: 1, maxWeightKg: 1500, currentWeightKg: 580, status: "quarentena", items: [{ productId: "p2", quantity: 64 }], note: "Lote vencido" },
  { id: "pl5", code: "PLT-005", binId: "b6", stackLevel: 1, maxWeightKg: 2200, currentWeightKg: 930, status: "ativo", items: [{ productId: "p5", quantity: 110 }, { productId: "p3", quantity: 40 }], note: "Pulmao outbound" },
  { id: "pl6", code: "PLT-006", binId: "b7", stackLevel: 1, maxWeightKg: 1400, currentWeightKg: 500, status: "ativo", items: [{ productId: "p6", quantity: 90 }], note: "Cross dock inbound" },
] as const;

export const mockDocks: Dock[] = [
  { id: "d1", warehouseId: "wh1", name: "Doca 01", mode: "inbound", status: "ocupada", shipmentId: "s1", timerMinutes: 42 },
  { id: "d2", warehouseId: "wh1", name: "Doca 02", mode: "outbound", status: "livre", timerMinutes: 0 },
  { id: "d3", warehouseId: "wh1", name: "Doca 03", mode: "misto", status: "ocupada", shipmentId: "s2", timerMinutes: 18 },
  { id: "d4", warehouseId: "wh2", name: "Doca 01", mode: "misto", status: "livre", timerMinutes: 0 },
];

export const mockShipments: Shipment[] = [
  { id: "s1", warehouseId: "wh1", direction: "inbound", carrier: "TransLog", plate: "ABC1D23", status: "em_doca", expectedItems: 320, countedItems: 180, eta: "10:10", priority: "alta", dockId: "d1" },
  { id: "s2", warehouseId: "wh1", direction: "outbound", carrier: "Expresso Sul", plate: "QWE4R56", status: "conferencia", expectedItems: 210, countedItems: 208, eta: "11:00", priority: "media", dockId: "d3" },
  { id: "s3", warehouseId: "wh1", direction: "inbound", carrier: "Rota Verde", plate: "TRK9P11", status: "fila", expectedItems: 280, countedItems: 0, eta: "12:20", priority: "alta" },
  { id: "s4", warehouseId: "wh2", direction: "outbound", carrier: "Carga Rápida", plate: "MNO7K21", status: "fila", expectedItems: 150, countedItems: 0, eta: "09:40", priority: "baixa" },
];

export const mockReceiving: ReceivingSession[] = [
  {
    id: "r1",
    shipmentId: "s1",
    checklist: [
      { label: "Nota fiscal conferida", done: true },
      { label: "Lacre fotografado", done: true },
      { label: "Avarias registradas", done: false },
      { label: "Temperatura de bau validada", done: true },
    ],
    photos: ["Lacre frontal", "Avaria lateral caixa 8"],
    notes: "Avaria leve em 2 caixas de suco.",
    status: "cega",
    items: [
      { productId: "p1", expectedQty: 180, receivedQty: 175, lot: "LT2401", expiresAt: inDays(8) },
      { productId: "p4", expectedQty: 90, receivedQty: 90, lot: "BK9012", expiresAt: inDays(32) },
      { productId: "p6", expectedQty: 50, receivedQty: 52, lot: "CF2026", expiresAt: inDays(25) },
    ],
  },
];

export const mockBlindCounts: BlindCountSession[] = [
  {
    id: "bc1",
    receivingId: "r1",
    operatorId: "u4",
    timerSeconds: 1575,
    status: "aguardando_validacao",
    photos: ["Avaria caixa 8", "Selo rompido palete 3"],
    items: [
      { productId: "p1", expectedQty: 180, countedQty: 175, divergence: "5 caixas faltantes" },
      { productId: "p4", expectedQty: 90, countedQty: 90 },
      { productId: "p6", expectedQty: 50, countedQty: 52, divergence: "2 caixas extras" },
    ],
  },
];

export const mockValidation: ValidationCase[] = [
  { id: "v1", blindCountId: "bc1", decision: "pendente", justification: "" },
];

export const mockAudit: AuditLog[] = [
  { id: "a1", actor: "Helena Rocha", role: "administrador", when: "2026-03-06 08:10", module: "Seguranca", action: "Redefiniu senha", entity: "Usuario gestor", location: "CD Guarulhos", before: "Senha expirada", after: "Senha redefinida" },
  { id: "a2", actor: "Marcos Vieira", role: "gestor", when: "2026-03-06 08:32", module: "Mapa", action: "Moveu palete", entity: "PLT-005", location: "R-01-01 -> A-02-01", before: "Pulmao", after: "Reserva" },
  { id: "a3", actor: "Rafael Pires", role: "conferente", when: "2026-03-06 09:01", module: "Conferencia cega", action: "Registrou divergencia", entity: "Recebimento r1", location: "Doca 01", before: "Sem divergencia", after: "5 caixas faltantes" },
  { id: "a4", actor: "Bianca Freitas", role: "auditor", when: "2026-03-05 17:15", module: "Auditoria", action: "Exportou trilha", entity: "Movimentacoes 24h", location: "Todos armazens" },
];

export const mockSettings: SystemSettings = {
  expiryWarningDays: 40,
  defaultStackLimit: 4,
  compactMode: false,
  notificationsEnabled: true,
  operationalTheme: "padrao",
  editorPassword: "layout123",
};
