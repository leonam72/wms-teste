import { createContext, useContext, useMemo, useState } from "react";
import {
  mockAudit,
  mockBlindCounts,
  mockDocks,
  mockPallets,
  mockProducts,
  mockReceiving,
  mockSettings,
  mockShipments,
  mockUsers,
  mockValidation,
  mockWarehouses,
} from "../data/mockData";
import {
  AuditLog,
  Bin,
  BlindCountSession,
  Dock,
  Pallet,
  Product,
  ReceivingSession,
  Role,
  Shipment,
  SystemSettings,
  ToastItem,
  User,
  ValidationCase,
  Warehouse,
} from "../types/wms";

type LoginResult = { ok: true } | { ok: false; message: string };

interface AppContextShape {
  currentUser: User | null;
  users: User[];
  warehouses: Warehouse[];
  products: Product[];
  pallets: Pallet[];
  docks: Dock[];
  shipments: Shipment[];
  receiving: ReceivingSession[];
  blindCounts: BlindCountSession[];
  validationCases: ValidationCase[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  selectedWarehouseId: string;
  globalQuery: string;
  mapShowOnlyAlerts: boolean;
  mode: "gestao" | "operacao";
  toasts: ToastItem[];
  layoutDraftBins: Bin[];
  layoutHistory: Bin[][];
  layoutFuture: Bin[][];
  layoutUnlocked: boolean;
  login: (username: string, password: string) => LoginResult;
  logout: () => void;
  setSelectedWarehouseId: (id: string) => void;
  setGlobalQuery: (value: string) => void;
  setMapShowOnlyAlerts: (value: boolean) => void;
  setMode: (mode: "gestao" | "operacao") => void;
  pushToast: (title: string, tone?: ToastItem["tone"]) => void;
  dismissToast: (id: string) => void;
  movePallet: (palletId: string, targetBinId: string, targetIndex?: number) => { ok: boolean; message: string };
  reorderPalletInsideBin: (palletId: string, targetIndex: number) => void;
  moveProductBetweenBins: (productId: string, sourceBinId: string, targetBinId: string, quantity: number) => { ok: boolean; message: string };
  toggleBinLock: (binId: string) => void;
  toggleBinFavorite: (binId: string) => void;
  unlockLayoutEditor: (password: string) => boolean;
  updateDraftBins: (bins: Bin[]) => void;
  addDraftBin: () => void;
  duplicateDraftBin: (binId: string) => void;
  saveLayout: () => void;
  undoLayout: () => void;
  redoLayout: () => void;
  cancelLayout: () => void;
  moveShipment: (shipmentId: string, dockId?: string) => void;
  toggleChecklistItem: (receivingId: string, index: number) => void;
  addReceivingPhoto: (receivingId: string) => void;
  updateBlindCount: (blindId: string, productId: string, countedQty: number) => void;
  setValidationDecision: (validationId: string, decision: ValidationCase["decision"], justification: string) => void;
  toggleUserStatus: (userId: string) => void;
  resetUserPassword: (userId: string) => void;
  updateSettings: (patch: Partial<SystemSettings>) => void;
  hasPermission: (roles: Role[]) => boolean;
}

const AppContext = createContext<AppContextShape | null>(null);

const cloneBins = (warehouses: Warehouse[], selectedWarehouseId: string) =>
  warehouses.find((warehouse) => warehouse.id === selectedWarehouseId)?.bins.map((bin) => ({ ...bin })) ?? [];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(mockUsers[0]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(mockWarehouses);
  const [products] = useState<Product[]>(mockProducts);
  const [pallets, setPallets] = useState<Pallet[]>(mockPallets.map((item) => ({ ...item, items: [...item.items] })));
  const [docks, setDocks] = useState<Dock[]>(mockDocks);
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [receiving, setReceiving] = useState<ReceivingSession[]>(mockReceiving);
  const [blindCounts, setBlindCounts] = useState<BlindCountSession[]>(mockBlindCounts);
  const [validationCases, setValidationCases] = useState<ValidationCase[]>(mockValidation);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAudit);
  const [settings, setSettings] = useState<SystemSettings>(mockSettings);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("wh1");
  const [globalQuery, setGlobalQuery] = useState("");
  const [mapShowOnlyAlerts, setMapShowOnlyAlerts] = useState(false);
  const [mode, setMode] = useState<"gestao" | "operacao">("operacao");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [layoutDraftBins, setLayoutDraftBins] = useState<Bin[]>(cloneBins(mockWarehouses, "wh1"));
  const [layoutHistory, setLayoutHistory] = useState<Bin[][]>([]);
  const [layoutFuture, setLayoutFuture] = useState<Bin[][]>([]);
  const [layoutUnlocked, setLayoutUnlocked] = useState(false);

  const pushToast = (title: string, tone: ToastItem["tone"] = "info") => {
    const toast = { id: crypto.randomUUID(), title, tone };
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 3200);
  };

  const dismissToast = (id: string) => setToasts((current) => current.filter((item) => item.id !== id));

  const hasPermission = (roles: Role[]) => (currentUser ? roles.includes(currentUser.role) : false);

  const login = (username: string, password: string): LoginResult => {
    const found = users.find((user) => user.username === username && user.password === password && user.active);
    if (!found) {
      return { ok: false, message: "Usuario, senha ou status invalidos." };
    }
    setCurrentUser(found);
    setSelectedWarehouseId(found.warehouseIds[0] ?? "wh1");
    pushToast(`Sessao iniciada para ${found.name}.`, "success");
    return { ok: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setLayoutUnlocked(false);
    pushToast("Sessao encerrada.", "info");
  };

  const currentWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? warehouses[0];

  const logAction = (entry: Omit<AuditLog, "id" | "when" | "actor" | "role">) => {
    if (!currentUser) return;
    setAuditLogs((current) => [
      {
        id: crypto.randomUUID(),
        when: new Date().toISOString().slice(0, 16).replace("T", " "),
        actor: currentUser.name,
        role: currentUser.role,
        ...entry,
      },
      ...current,
    ]);
  };

  const syncLayoutDraftToWarehouse = (warehouseId: string) => {
    setLayoutDraftBins(cloneBins(warehouses, warehouseId));
    setLayoutHistory([]);
    setLayoutFuture([]);
  };

  const safeSetWarehouse = (id: string) => {
    setSelectedWarehouseId(id);
    syncLayoutDraftToWarehouse(id);
  };

  const movePallet = (palletId: string, targetBinId: string, targetIndex?: number) => {
    const pallet = pallets.find((item) => item.id === palletId);
    const targetBin = currentWarehouse.bins.find((bin) => bin.id === targetBinId);
    if (!pallet || !targetBin) return { ok: false, message: "Origem ou destino nao encontrado." };
    const targetStack = pallets.filter((item) => item.binId === targetBinId && item.id !== palletId);
    const totalWeight = targetStack.reduce((sum, item) => sum + item.currentWeightKg, 0) + pallet.currentWeightKg;
    if (targetBin.locked || targetBin.status === "interditado") return { ok: false, message: "Bin destino bloqueado." };
    if (targetStack.length >= targetBin.stackLimit) return { ok: false, message: "Limite de empilhamento excedido." };
    if (totalWeight > targetBin.maxLoadKg) return { ok: false, message: "Carga maxima do bin excedida." };

    setPallets((current) => {
      const moved = current.map((item) => item.id === palletId ? { ...item, binId: targetBinId } : item);
      const inTarget = moved.filter((item) => item.binId === targetBinId && item.id !== palletId);
      const moving = moved.find((item) => item.id === palletId)!;
      const reordered = [...inTarget];
      const index = Math.min(targetIndex ?? reordered.length, reordered.length);
      reordered.splice(index, 0, moving);
      const targetIds = reordered.map((item) => item.id);
      return moved.map((item) => {
        if (item.binId !== targetBinId) return item;
        return { ...item, stackLevel: targetIds.indexOf(item.id) + 1 };
      }).map((item) => {
        if (item.binId === pallet.binId && item.binId !== targetBinId) {
          const sourceOrder = moved.filter((candidate) => candidate.binId === pallet.binId && candidate.id !== palletId).map((candidate) => candidate.id);
          return { ...item, stackLevel: sourceOrder.indexOf(item.id) + 1 };
        }
        return item;
      });
    });
    pushToast(`Palete ${pallet.code} movido para ${targetBin.code}.`, "success");
    logAction({ module: "Mapa", action: "Moveu palete", entity: pallet.code, location: targetBin.code, before: pallet.binId, after: targetBin.id });
    return { ok: true, message: "Movimentacao concluida." };
  };

  const reorderPalletInsideBin = (palletId: string, targetIndex: number) => {
    const pallet = pallets.find((item) => item.id === palletId);
    if (!pallet) return;
    const siblings = pallets.filter((item) => item.binId === pallet.binId);
    const ordered = siblings.filter((item) => item.id !== palletId);
    ordered.splice(Math.max(0, Math.min(targetIndex, ordered.length)), 0, pallet);
    setPallets((current) =>
      current.map((item) => {
        if (item.binId !== pallet.binId) return item;
        return { ...item, stackLevel: ordered.findIndex((candidate) => candidate.id === item.id) + 1 };
      }),
    );
    pushToast(`Pilha de ${pallet.code} reorganizada.`, "info");
  };

  const moveProductBetweenBins = (productId: string, sourceBinId: string, targetBinId: string, quantity: number) => {
    const sourceBin = currentWarehouse.bins.find((bin) => bin.id === sourceBinId);
    const targetBin = currentWarehouse.bins.find((bin) => bin.id === targetBinId);
    const product = products.find((item) => item.id === productId);
    if (!sourceBin || !targetBin || !product) return { ok: false, message: "Origem, destino ou produto invalido." };
    if (sourceBinId === targetBinId) return { ok: false, message: "Escolha um bin de destino diferente." };
    if (quantity <= 0) return { ok: false, message: "Informe uma quantidade valida." };
    if (targetBin.locked || targetBin.status === "interditado") return { ok: false, message: "Bin destino bloqueado." };

    const sourcePallet = pallets.find((pallet) =>
      pallet.binId === sourceBinId &&
      pallet.items.some((item) => item.productId === productId && item.quantity >= quantity),
    );
    if (!sourcePallet) return { ok: false, message: "Nao existe saldo suficiente no bin de origem." };

    const targetPallets = pallets.filter((pallet) => pallet.binId === targetBinId);
    const compatibleTarget = targetPallets.find((pallet) => pallet.items.some((item) => item.productId === productId));
    if (!compatibleTarget && targetPallets.length >= targetBin.stackLimit) {
      return { ok: false, message: "Destino sem stack disponivel para novo palete." };
    }

    const weightDelta = Math.max(1, Math.round((product.weightKg * quantity) / 10));
    const targetWeight = targetPallets.reduce((sum, pallet) => sum + pallet.currentWeightKg, 0) + weightDelta;
    if (targetWeight > targetBin.maxLoadKg) return { ok: false, message: "Carga maxima do bin destino excedida." };

    setPallets((current) => {
      const next = current
        .map((pallet) => {
          if (pallet.id === sourcePallet.id) {
            return {
              ...pallet,
              currentWeightKg: Math.max(0, pallet.currentWeightKg - weightDelta),
              items: pallet.items
                .map((item) => item.productId === productId ? { ...item, quantity: item.quantity - quantity } : item)
                .filter((item) => item.quantity > 0),
            };
          }

          if (compatibleTarget && pallet.id === compatibleTarget.id) {
            return {
              ...pallet,
              currentWeightKg: pallet.currentWeightKg + weightDelta,
              items: pallet.items.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item),
            };
          }

          return pallet;
        })
        .filter((pallet) => pallet.items.length > 0);

      if (!compatibleTarget) {
        next.push({
          id: crypto.randomUUID(),
          code: `PLT-${String(next.length + 1).padStart(3, "0")}`,
          binId: targetBinId,
          stackLevel: targetPallets.length + 1,
          maxWeightKg: Math.max(800, weightDelta + 250),
          currentWeightKg: weightDelta,
          status: "ativo",
          items: [{ productId, quantity }],
          note: `Movimentacao operacional de ${sourceBin.code}`,
        });
      }

      const sourceIds = next.filter((pallet) => pallet.binId === sourceBinId).map((pallet) => pallet.id);
      const targetIds = next.filter((pallet) => pallet.binId === targetBinId).map((pallet) => pallet.id);

      return next.map((pallet) => {
        if (pallet.binId === sourceBinId) return { ...pallet, stackLevel: sourceIds.indexOf(pallet.id) + 1 };
        if (pallet.binId === targetBinId) return { ...pallet, stackLevel: targetIds.indexOf(pallet.id) + 1 };
        return pallet;
      });
    });

    pushToast(`${quantity} un. de ${product.sku} movidas para ${targetBin.code}.`, "success");
    logAction({
      module: "Mapa",
      action: "Moveu produto entre bins",
      entity: product.sku,
      location: `${sourceBin.code} -> ${targetBin.code}`,
      before: `${quantity} un. em ${sourceBin.code}`,
      after: `${quantity} un. em ${targetBin.code}`,
    });
    return { ok: true, message: "Movimentacao concluida." };
  };

  const toggleBinLock = (binId: string) => {
    setWarehouses((current) => current.map((warehouse) => ({
      ...warehouse,
      bins: warehouse.bins.map((bin) => bin.id === binId ? { ...bin, locked: !bin.locked, status: !bin.locked ? "interditado" : "ativo" } : bin),
    })));
    setLayoutDraftBins((current) => current.map((bin) => bin.id === binId ? { ...bin, locked: !bin.locked, status: !bin.locked ? "interditado" : "ativo" } : bin));
    pushToast("Status do bin atualizado.", "warning");
  };

  const toggleBinFavorite = (binId: string) => {
    setWarehouses((current) => current.map((warehouse) => ({
      ...warehouse,
      bins: warehouse.bins.map((bin) => bin.id === binId ? { ...bin, favorite: !bin.favorite } : bin),
    })));
    pushToast("Favorito atualizado.", "info");
  };

  const unlockLayoutEditor = (password: string) => {
    if (password !== settings.editorPassword) {
      pushToast("Senha operacional incorreta.", "error");
      return false;
    }
    setLayoutUnlocked(true);
    pushToast("Editor estrutural liberado.", "success");
    return true;
  };

  const updateDraftBins = (bins: Bin[]) => {
    setLayoutHistory((current) => [...current, layoutDraftBins.map((bin) => ({ ...bin }))].slice(-25));
    setLayoutFuture([]);
    setLayoutDraftBins(bins);
  };

  const addDraftBin = () => {
    const zoneId = currentWarehouse.zones[0]?.id ?? "";
    updateDraftBins([
      ...layoutDraftBins,
      {
        id: crypto.randomUUID(),
        code: `NOVO-${layoutDraftBins.length + 1}`,
        warehouseId: currentWarehouse.id,
        zoneId,
        x: 80 + layoutDraftBins.length * 12,
        y: 80 + layoutDraftBins.length * 12,
        width: 132,
        height: 88,
        stackLimit: settings.defaultStackLimit,
        maxLoadKg: 1200,
        locked: false,
        status: "ativo",
        aisle: "Nova rua",
      },
    ]);
    pushToast("Novo bin adicionado ao rascunho.", "success");
  };

  const duplicateDraftBin = (binId: string) => {
    const source = layoutDraftBins.find((bin) => bin.id === binId);
    if (!source) return;
    addDraftBin();
    updateDraftBins([
      ...layoutDraftBins,
      { ...source, id: crypto.randomUUID(), code: `${source.code}-CLONE`, x: source.x + 28, y: source.y + 28, width: 132, height: 88 },
    ]);
    pushToast(`Bin ${source.code} clonado.`, "info");
  };

  const saveLayout = () => {
    setWarehouses((current) => current.map((warehouse) => warehouse.id === selectedWarehouseId ? { ...warehouse, bins: layoutDraftBins.map((bin) => ({ ...bin })) } : warehouse));
    setLayoutHistory([]);
    setLayoutFuture([]);
    pushToast("Layout salvo no mock compartilhado.", "success");
    logAction({ module: "Editor de planta", action: "Salvou layout", entity: currentWarehouse.name, location: currentWarehouse.city });
  };

  const undoLayout = () => {
    const previous = layoutHistory[layoutHistory.length - 1];
    if (!previous) return;
    setLayoutFuture((current) => [layoutDraftBins.map((bin) => ({ ...bin })), ...current]);
    setLayoutHistory((current) => current.slice(0, -1));
    setLayoutDraftBins(previous.map((bin: Bin) => ({ ...bin })));
  };

  const redoLayout = () => {
    const next = layoutFuture[0];
    if (!next) return;
    setLayoutHistory((current) => [...current, layoutDraftBins.map((bin) => ({ ...bin }))]);
    setLayoutFuture((current) => current.slice(1));
    setLayoutDraftBins(next.map((bin) => ({ ...bin })));
  };

  const cancelLayout = () => {
    syncLayoutDraftToWarehouse(selectedWarehouseId);
    pushToast("Rascunho descartado.", "warning");
  };

  const moveShipment = (shipmentId: string, dockId?: string) => {
    setShipments((current) => current.map((shipment) => shipment.id === shipmentId ? {
      ...shipment,
      dockId,
      status: dockId ? "em_doca" : "fila",
    } : shipment));
    setDocks((current) => current.map((dock) => {
      if (dock.shipmentId === shipmentId && dock.id !== dockId) return { ...dock, shipmentId: undefined, status: "livre", timerMinutes: 0 };
      if (dock.id === dockId) return { ...dock, shipmentId, status: "ocupada", timerMinutes: 1 };
      return dock;
    }));
    pushToast(dockId ? "Veiculo alocado em doca." : "Veiculo retornou para fila.", "success");
  };

  const toggleChecklistItem = (receivingId: string, index: number) => {
    setReceiving((current) => current.map((session) => session.id === receivingId ? {
      ...session,
      checklist: session.checklist.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item),
    } : session));
  };

  const addReceivingPhoto = (receivingId: string) => {
    setReceiving((current) => current.map((session) => session.id === receivingId ? {
      ...session,
      photos: [...session.photos, `Foto ${session.photos.length + 1} - ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`],
    } : session));
    pushToast("Foto mockada anexada ao recebimento.", "success");
  };

  const updateBlindCount = (blindId: string, productId: string, countedQty: number) => {
    setBlindCounts((current) => current.map((session) => session.id === blindId ? {
      ...session,
      items: session.items.map((item) => item.productId === productId ? {
        ...item,
        countedQty,
        divergence: countedQty !== item.expectedQty ? `${Math.abs(countedQty - item.expectedQty)} unidade(s) divergentes` : undefined,
      } : item),
    } : session));
  };

  const setValidationDecision = (validationId: string, decision: ValidationCase["decision"], justification: string) => {
    setValidationCases((current) => current.map((item) => item.id === validationId ? { ...item, decision, justification } : item));
    pushToast(`Validacao marcada como ${decision}.`, decision === "aprovado" ? "success" : "warning");
  };

  const toggleUserStatus = (userId: string) => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, active: !user.active } : user));
    pushToast("Status do usuario atualizado.", "warning");
  };

  const resetUserPassword = (userId: string) => {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, password: `${user.role}@123` } : user));
    pushToast("Senha mockada redefinida.", "success");
  };

  const updateSettings = (patch: Partial<SystemSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    pushToast("Configuracoes atualizadas no frontend.", "success");
  };

  const value = useMemo<AppContextShape>(() => ({
    currentUser,
    users,
    warehouses,
    products,
    pallets,
    docks,
    shipments,
    receiving,
    blindCounts,
    validationCases,
    auditLogs,
    settings,
    selectedWarehouseId,
    globalQuery,
    mapShowOnlyAlerts,
    mode,
    toasts,
    layoutDraftBins,
    layoutHistory,
    layoutFuture,
    layoutUnlocked,
    login,
    logout,
    setSelectedWarehouseId: safeSetWarehouse,
    setGlobalQuery,
    setMapShowOnlyAlerts,
    setMode,
    pushToast,
    dismissToast,
    movePallet,
    reorderPalletInsideBin,
    moveProductBetweenBins,
    toggleBinLock,
    toggleBinFavorite,
    unlockLayoutEditor,
    updateDraftBins,
    addDraftBin,
    duplicateDraftBin,
    saveLayout,
    undoLayout,
    redoLayout,
    cancelLayout,
    moveShipment,
    toggleChecklistItem,
    addReceivingPhoto,
    updateBlindCount,
    setValidationDecision,
    toggleUserStatus,
    resetUserPassword,
    updateSettings,
    hasPermission,
  }), [currentUser, users, warehouses, products, pallets, docks, shipments, receiving, blindCounts, validationCases, auditLogs, settings, selectedWarehouseId, globalQuery, mapShowOnlyAlerts, mode, toasts, layoutDraftBins, layoutHistory, layoutFuture, layoutUnlocked]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};
