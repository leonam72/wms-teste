import { useEffect, useMemo, useState } from "react";
import { Copy, Grid2X2, Lock, Plus, Save, Undo2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, Card, Input, Modal, SectionHeader, Select } from "../components/ui";

const FIXED_BIN_WIDTH = 132;
const FIXED_BIN_HEIGHT = 88;
const GRID_SIZE = 16;

export function LayoutEditorPage() {
  const {
    warehouses,
    selectedWarehouseId,
    layoutDraftBins,
    layoutUnlocked,
    layoutHistory,
    layoutFuture,
    unlockLayoutEditor,
    updateDraftBins,
    addDraftBin,
    duplicateDraftBin,
    saveLayout,
    undoLayout,
    redoLayout,
    cancelLayout,
    hasPermission,
    pushToast,
  } = useApp();
  const warehouse = warehouses.find((item) => item.id === selectedWarehouseId)!;
  const [password, setPassword] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(!layoutUnlocked);
  const [selectedId, setSelectedId] = useState<string | null>(layoutDraftBins[0]?.id ?? null);
  const [dragging, setDragging] = useState<{ binId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => setSelectedId(layoutDraftBins[0]?.id ?? null), [selectedWarehouseId, layoutDraftBins]);
  useEffect(() => setPasswordOpen(!layoutUnlocked), [layoutUnlocked]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "e" && hasPermission(["administrador", "gestor"])) setPasswordOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasPermission]);

  const selectedBin = useMemo(() => layoutDraftBins.find((bin) => bin.id === selectedId) ?? null, [layoutDraftBins, selectedId]);

  const updateBin = (binId: string, patch: Partial<(typeof layoutDraftBins)[number]>) => {
    updateDraftBins(layoutDraftBins.map((bin) => bin.id === binId ? { ...bin, ...patch } : bin));
  };

  const setLayoutPosition = (binId: string, x: number, y: number) => {
    setSelectedId(binId);
    updateDraftBins(
      layoutDraftBins.map((bin) =>
        bin.id === binId ? { ...bin, x, y, width: FIXED_BIN_WIDTH, height: FIXED_BIN_HEIGHT } : bin,
      ),
    );
  };

  useEffect(() => {
    if (!dragging || !layoutUnlocked) return;
    const handleMove = (event: MouseEvent) => {
      const canvas = document.getElementById("layout-editor-canvas");
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.round((event.clientX - rect.left - dragging.offsetX) / GRID_SIZE) * GRID_SIZE);
      const y = Math.max(0, Math.round((event.clientY - rect.top - dragging.offsetY) / GRID_SIZE) * GRID_SIZE);
      setLayoutPosition(dragging.binId, x, y);
    };
    const handleUp = () => setDragging(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, layoutUnlocked, layoutDraftBins]);

  if (!hasPermission(["administrador", "gestor"])) {
    return <Card><p className="text-sm text-slate-600">Seu perfil nao pode alterar planta baixa. Use um perfil gestor ou administrador.</p></Card>;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Editor protegido"
        title="Editor de planta baixa com rascunho reversível"
        description="Toda edição estrutural fica em rascunho até o salvar. Undo, redo, cancelar e quick edit agem sobre a mesma malha de bins usada pelo mapa operacional."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={undoLayout} disabled={!layoutHistory.length} title="Desfazer última ação"><Undo2 size={16} /> Desfazer</Button>
            <Button variant="ghost" onClick={redoLayout} disabled={!layoutFuture.length} title="Refazer última ação">Refazer</Button>
            <Button variant="ghost" onClick={cancelLayout} title="Descartar rascunho">Cancelar</Button>
            <Button onClick={saveLayout} title="Persistir rascunho do layout"><Save size={16} /> Salvar</Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <Badge tone={layoutUnlocked ? "green" : "red"}>{layoutUnlocked ? "edição liberada" : "bloqueado"}</Badge>
              <span className="text-sm text-slate-500">{warehouse.name}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={addDraftBin} disabled={!layoutUnlocked} title="Atalho visual para criar novo bin"><Plus size={16} /> Novo bin</Button>
              <Button variant="ghost" onClick={() => selectedId && duplicateDraftBin(selectedId)} disabled={!layoutUnlocked || !selectedId} title="Clonar posição"><Copy size={16} /> Clonar</Button>
              <Button variant="ghost" onClick={() => pushToast("Geração em lote mockada: 6 bins adicionados ao plano lógico.", "info")} disabled={!layoutUnlocked} title="Criar posições em lote">Gerar lote</Button>
            </div>
          </div>
          <div className="app-grid relative h-[680px] overflow-auto bg-slate-100">
            <div className="absolute left-5 top-5 flex gap-2">
              <div className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold shadow"><Grid2X2 size={14} className="inline" /> Grid {GRID_SIZE}px</div>
              <div className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold shadow">{layoutUnlocked ? "Arraste liberado" : "Arraste desativado"}</div>
            </div>
            <div id="layout-editor-canvas" className="relative h-[560px] min-w-[760px] p-6">
              {layoutDraftBins.map((bin) => (
                <div
                  key={bin.id}
                  onMouseDown={(event) => {
                    if (!layoutUnlocked) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setDragging({ binId: bin.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
                  }}
                  onClick={() => setSelectedId(bin.id)}
                  className={`absolute rounded-[24px] border-2 bg-white p-3 shadow-lg ${selectedId === bin.id ? "border-brand ring-4 ring-brand/20" : "border-white"} ${layoutUnlocked ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                  style={{ left: bin.x, top: bin.y, width: FIXED_BIN_WIDTH, height: FIXED_BIN_HEIGHT }}
                  title={layoutUnlocked ? "Segure e arraste para reposicionar" : "Edicao bloqueada"}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{bin.code}</div>
                    {bin.locked ? <Lock size={15} className="text-red-500" /> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{warehouse.zones.find((zone) => zone.id === bin.zoneId)?.name}</div>
                  <div className="mt-3 text-xs text-slate-500">{bin.aisle}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="font-display text-2xl font-bold">Quick edit</h3>
            {selectedBin ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Código</label>
                  <Input value={selectedBin.code} disabled={!layoutUnlocked} onChange={(event) => updateBin(selectedBin.id, { code: event.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Rua</label>
                  <Input value={selectedBin.aisle} disabled={!layoutUnlocked} onChange={(event) => updateBin(selectedBin.id, { aisle: event.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Zona</label>
                  <Select value={selectedBin.zoneId} disabled={!layoutUnlocked} onChange={(event) => updateBin(selectedBin.id, { zoneId: event.target.value })}>
                    {warehouse.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Stack</label>
                    <Input type="number" disabled={!layoutUnlocked} value={selectedBin.stackLimit} onChange={(event) => updateBin(selectedBin.id, { stackLimit: Number(event.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold">Carga máxima</label>
                    <Input type="number" disabled={!layoutUnlocked} value={selectedBin.maxLoadKg} onChange={(event) => updateBin(selectedBin.id, { maxLoadKg: Number(event.target.value) })} />
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Tamanho fixo do bin no editor: {FIXED_BIN_WIDTH} x {FIXED_BIN_HEIGHT}px.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => updateBin(selectedBin.id, { locked: !selectedBin.locked, status: selectedBin.locked ? "ativo" : "interditado" })} disabled={!layoutUnlocked}>Travar</Button>
                  <Button variant="ghost" onClick={() => updateBin(selectedBin.id, { status: "quarentena" })} disabled={!layoutUnlocked}>Quarentena</Button>
                  <Button variant="ghost" onClick={() => pushToast("Visualização restaurada para o centro do layout.", "info")}>Centralizar</Button>
                </div>
              </div>
            ) : null}
          </Card>
          <Card>
            <h3 className="font-display text-2xl font-bold">Ferramentas flutuantes</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>Reposicionamento direto por clique e arraste</div>
              <div>Duplicação de bin preservando zona, stack e carga</div>
              <div>Tamanho fixo para leitura consistente do layout</div>
              <div>Drag estrutural desativado quando o editor estiver bloqueado</div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Liberar modo de edição">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Proteção adicional por senha operacional. A planta continua navegável sem liberar alterações.</p>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha do editor" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>Fechar</Button>
            <Button onClick={() => { if (unlockLayoutEditor(password)) setPasswordOpen(false); }}>Liberar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
