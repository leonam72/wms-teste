import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, MapPinned, SearchCheck, ShieldAlert, Star, Undo2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, Card, Drawer, EmptyState, Input, Modal, SectionHeader, Select } from "../components/ui";
import { expiryTone } from "./helpers";

export function MapPage() {
  const {
    warehouses,
    selectedWarehouseId,
    pallets,
    products,
    settings,
    globalQuery,
    moveProductBetweenBins,
    mapShowOnlyAlerts,
    setMapShowOnlyAlerts,
    toggleBinFavorite,
    toggleBinLock,
    pushToast,
  } = useApp();
  const warehouse = warehouses.find((item) => item.id === selectedWarehouseId)!;
  const [selectedBinId, setSelectedBinId] = useState<string | null>(warehouse.bins[0]?.id ?? null);
  const [moveProductState, setMoveProductState] = useState<{
    sourceBinId: string;
    productId: string;
    quantity: number;
    targetBinId: string;
    productLabel: string;
  } | null>(null);

  useEffect(() => setSelectedBinId(warehouse.bins[0]?.id ?? null), [warehouse.id]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedBinId(null);
      if (event.key.toLowerCase() === "h") setMapShowOnlyAlerts(!mapShowOnlyAlerts);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mapShowOnlyAlerts, setMapShowOnlyAlerts]);

  const matchProductIds = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) return new Set<string>();
    return new Set(
      products
        .filter((product) => [product.description, product.sku].some((value) => value.toLowerCase().includes(query)))
        .map((product) => product.id),
    );
  }, [globalQuery, products]);

  const binsWithQuery = useMemo(() => {
    if (!globalQuery.trim()) return new Set<string>();
    return new Set(
      pallets
        .filter((pallet) => pallet.items.some((item) => matchProductIds.has(item.productId)))
        .map((pallet) => pallet.binId),
    );
  }, [globalQuery, matchProductIds, pallets]);

  const filteredBins = warehouse.bins.filter((bin) => {
    if (!mapShowOnlyAlerts) return true;
    const binPallets = pallets.filter((pallet) => pallet.binId === bin.id);
    return bin.locked || bin.status !== "ativo" || binPallets.some((pallet) => pallet.items.some((item) => expiryTone(products.find((product) => product.id === item.productId)?.expiresAt ?? new Date().toISOString(), settings.expiryWarningDays) !== "green"));
  });

  const selectedBin = warehouse.bins.find((bin) => bin.id === selectedBinId) ?? null;
  const selectedPallets = selectedBin ? pallets.filter((pallet) => pallet.binId === selectedBin.id).sort((a, b) => a.stackLevel - b.stackLevel) : [];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Operação 2D"
        title="Mapa visual do armazém"
        description="Busca inteligente destaca bins relevantes, os demais ficam atenuados. Fora do editor não existe drag estrutural; a movimentação operacional de produto exige confirmação."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMapShowOnlyAlerts(!mapShowOnlyAlerts)} title="Atalho H">
              <ShieldAlert size={16} /> {mapShowOnlyAlerts ? "Mostrar todos" : "Filtrar alertas"}
            </Button>
            <Button onClick={() => pushToast("Resumo rápido do armazém enviado para exportação visual.", "success")} title="Exportar visão atual">
              <SearchCheck size={16} /> Exportar visão
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <Badge tone="blue"><MapPinned size={14} /> {warehouse.name}</Badge>
              <Badge tone="slate">{warehouse.address}</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelectedBinId(null)} title="Esc limpa a seleção"><Undo2 size={16} /> Limpar</Button>
              <Button variant="ghost" onClick={() => pushToast("Tarefa de movimentação gerada a partir da seleção atual.", "success")} title="Criar tarefa para o WMS">Gerar tarefa</Button>
            </div>
          </div>
          <div className="app-grid scrollbar-thin relative h-[650px] overflow-auto bg-slate-100 p-6">
            <div className="relative h-[520px] min-w-[760px]">
              {filteredBins.map((bin) => {
                const binPallets = pallets.filter((pallet) => pallet.binId === bin.id).sort((a, b) => a.stackLevel - b.stackLevel);
                const highlighted = !globalQuery.trim() || binsWithQuery.has(bin.id) || bin.code.toLowerCase().includes(globalQuery.toLowerCase());
                const dimmed = globalQuery.trim() && !highlighted;
                return (
                  <button
                    key={bin.id}
                    onClick={() => setSelectedBinId(bin.id)}
                    className={`absolute rounded-[24px] border p-3 text-left transition ${selectedBinId === bin.id ? "ring-4 ring-brand/30" : ""} ${
                      bin.locked ? "border-red-300 bg-red-50" : "border-white bg-white shadow-lg"
                    } ${dimmed ? "opacity-25" : "opacity-100"}`}
                    style={{ left: bin.x, top: bin.y, width: bin.width, height: bin.height }}
                    title={`Bin ${bin.code}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{bin.code}</div>
                        <div className="text-xs text-slate-500">{warehouse.zones.find((zone) => zone.id === bin.zoneId)?.name}</div>
                      </div>
                      <div className="flex gap-1">
                        {bin.favorite ? <Star size={16} className="fill-amber-400 text-amber-400" /> : null}
                        {bin.locked ? <ShieldAlert size={16} className="text-red-500" /> : null}
                      </div>
                    </div>
                    <div className="mt-auto flex h-full items-end gap-2">
                      {binPallets.length === 0 ? <span className="text-xs text-slate-400">vazio</span> : null}
                      {binPallets.map((pallet) => {
                        const severe = pallet.items.some((item) => expiryTone(products.find((product) => product.id === item.productId)?.expiresAt ?? new Date().toISOString(), settings.expiryWarningDays) === "red");
                        const warning = pallet.items.some((item) => expiryTone(products.find((product) => product.id === item.productId)?.expiresAt ?? new Date().toISOString(), settings.expiryWarningDays) === "yellow");
                        return (
                          <div
                            key={pallet.id}
                            className={`flex h-12 w-9 items-center justify-center rounded-t-xl text-[10px] font-bold text-white shadow-sm ${
                              severe ? "bg-red-500" : warning ? "bg-amber-500" : "bg-slate-900"
                            }`}
                            title={`${pallet.code} - movimentação operacional por confirmação`}
                          >
                            {pallet.stackLevel}
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="font-display text-2xl font-bold">Ocorrências da busca</h3>
            <p className="mb-4 text-sm text-slate-500">Clique para centralizar e selecionar o bin correspondente.</p>
            <div className="space-y-3">
              {[...binsWithQuery].map((binId) => {
                const bin = warehouse.bins.find((item) => item.id === binId);
                if (!bin) return null;
                return (
                  <button key={bin.id} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left" onClick={() => setSelectedBinId(bin.id)}>
                    <span className="font-semibold text-slate-900">{bin.code}</span>
                    <Badge tone="blue">{warehouse.zones.find((zone) => zone.id === bin.zoneId)?.name}</Badge>
                  </button>
                );
              })}
              {!binsWithQuery.size ? <EmptyState title="Sem destaque ativo" description="Use a busca global para localizar SKUs e bins em segundos." /> : null}
            </div>
          </Card>

          <Card>
            <h3 className="font-display text-2xl font-bold">Legenda operacional</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-3"><span className="h-4 w-4 rounded bg-slate-900" /> Palete normal</div>
              <div className="flex items-center gap-3"><span className="h-4 w-4 rounded bg-amber-500" /> Produto a vencer</div>
              <div className="flex items-center gap-3"><span className="h-4 w-4 rounded bg-red-500" /> Produto vencido</div>
              <div className="flex items-center gap-3"><span className="h-4 w-4 rounded border border-red-400 bg-red-50" /> Bin interditado</div>
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={!!selectedBin} onClose={() => setSelectedBinId(null)} title={selectedBin ? `Bin ${selectedBin.code}` : "Detalhes"}>
        {selectedBin ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="rounded-[24px] p-4">
                <div className="text-sm text-slate-500">Zona</div>
                <div className="mt-1 font-semibold">{warehouse.zones.find((zone) => zone.id === selectedBin.zoneId)?.name}</div>
              </Card>
              <Card className="rounded-[24px] p-4">
                <div className="text-sm text-slate-500">Capacidade</div>
                <div className="mt-1 font-semibold">{selectedPallets.length}/{selectedBin.stackLimit} paletes</div>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => toggleBinFavorite(selectedBin.id)} title="Favoritar área">Favoritar</Button>
              <Button variant="ghost" onClick={() => toggleBinLock(selectedBin.id)} title="Travar ou liberar posição">Travar posição</Button>
              <Button variant="ghost" onClick={() => pushToast("Bin marcado para quarentena.", "warning")} title="Mover posição para quarentena">Quarentena</Button>
              <Button variant="ghost" onClick={() => pushToast("Contagem cíclica aberta para este bin.", "success")} title="Iniciar inventário cíclico">Contagem cíclica</Button>
              <Button variant="ghost" onClick={() => pushToast("Etiqueta do endereço preparada para impressão.", "info")} title="Imprimir etiqueta do bin">Imprimir etiqueta</Button>
            </div>

            <div className="space-y-3">
              {selectedPallets.map((pallet) => (
                <Card key={pallet.id} className="rounded-[24px] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{pallet.code}</div>
                      <div className="text-xs text-slate-500">Stack {pallet.stackLevel} · {pallet.currentWeightKg} kg</div>
                    </div>
                    <Badge tone={pallet.status === "quarentena" ? "red" : "green"}>{pallet.status}</Badge>
                  </div>
                  <div className="space-y-2">
                    {pallet.items.map((item) => {
                      const product = products.find((product) => product.id === item.productId)!;
                      const tone = expiryTone(product.expiresAt, settings.expiryWarningDays);
                      return (
                        <div key={`${pallet.id}-${item.productId}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">{product.description}</div>
                              <div className="text-xs text-slate-500">{product.sku} · lote {product.lot}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={tone === "red" ? "red" : tone === "yellow" ? "yellow" : "green"}>{item.quantity} un.</Badge>
                              <Button
                                variant="ghost"
                                className="px-3 py-2"
                                onClick={() =>
                                  setMoveProductState({
                                    sourceBinId: selectedBin.id,
                                    productId: product.id,
                                    quantity: item.quantity,
                                    targetBinId: warehouse.bins.find((bin) => bin.id !== selectedBin.id && !bin.locked && bin.status === "ativo")?.id ?? selectedBin.id,
                                    productLabel: `${product.sku} · ${product.description}`,
                                  })
                                }
                                title="Mover este produto para outro bin"
                              >
                                <ArrowRightLeft size={14} /> Mover
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => pushToast(`Historico de ${pallet.code} aberto.`, "info")} title="Abrir trilha do palete">Histórico</Button>
                    <Button variant="ghost" onClick={() => pushToast(`Observação anexada a ${pallet.code}.`, "success")} title="Anexar observação">Observação</Button>
                    <Button variant="ghost" onClick={() => pushToast(`Rastreio de ${pallet.code} gerado.`, "success")} title="Rastrear movimentações">Rastrear</Button>
                    <Button variant="ghost" onClick={() => pushToast(`Resumo rápido de ${pallet.code} exibido.`, "info")} title="Abrir resumo do palete">Resumo rápido</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal open={!!moveProductState} onClose={() => setMoveProductState(null)} title="Confirmar movimentação de produto">
        {moveProductState ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Produto: <span className="font-semibold text-slate-900">{moveProductState.productLabel}</span>
              <br />
              Origem: <span className="font-semibold text-slate-900">{warehouse.bins.find((bin) => bin.id === moveProductState.sourceBinId)?.code}</span>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Bin de destino</label>
              <Select
                value={moveProductState.targetBinId}
                onChange={(event) => setMoveProductState({ ...moveProductState, targetBinId: event.target.value })}
              >
                {warehouse.bins.filter((bin) => bin.id !== moveProductState.sourceBinId).map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code} · {warehouse.zones.find((zone) => zone.id === bin.zoneId)?.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Quantidade</label>
              <Input
                type="number"
                min={1}
                max={moveProductState.quantity}
                value={moveProductState.quantity}
                onChange={(event) => setMoveProductState({ ...moveProductState, quantity: Number(event.target.value) })}
              />
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Confirme para mover o produto entre bins fora do modo editor.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMoveProductState(null)}>Cancelar</Button>
              <Button
                onClick={() => {
                  const result = moveProductBetweenBins(
                    moveProductState.productId,
                    moveProductState.sourceBinId,
                    moveProductState.targetBinId,
                    moveProductState.quantity,
                  );
                  if (!result.ok) {
                    pushToast(result.message, "error");
                    return;
                  }
                  setMoveProductState(null);
                }}
              >
                Confirmar movimentação
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
