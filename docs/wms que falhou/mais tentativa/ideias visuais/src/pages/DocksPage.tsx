import { useMemo, useState } from "react";
import { Clock3, Plus, Truck, Workflow } from "lucide-react";
import { Badge, Button, Card, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";

export function DocksPage() {
  const { docks, shipments, selectedWarehouseId, moveShipment, pushToast } = useApp();
  const warehouseDocks = docks.filter((dock) => dock.warehouseId === selectedWarehouseId);
  const warehouseShipments = shipments.filter((shipment) => shipment.warehouseId === selectedWarehouseId);
  const queue = warehouseShipments.filter((shipment) => !shipment.dockId);
  const [dragShipmentId, setDragShipmentId] = useState<string | null>(null);

  const productivity = useMemo(() => warehouseDocks.reduce((sum, dock) => sum + dock.timerMinutes, 0), [warehouseDocks]);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Inbound / Outbound"
        title="Docas, fila e cronômetro operacional"
        description="Arraste veículos entre fila e docas. O tempo de carga e descarga alimenta recebimento, conferência e analytics."
        action={<Button onClick={() => pushToast("Novo agendamento mockado inserido na fila.", "success")}><Plus size={16} /> Novo agendamento</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[0.55fr_1.45fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold">Fila</h3>
            <Badge tone="yellow">{queue.length} aguardando</Badge>
          </div>
          <div className="space-y-3">
            {queue.map((shipment) => (
              <button
                key={shipment.id}
                draggable
                onDragStart={() => setDragShipmentId(shipment.id)}
                onDragEnd={() => setDragShipmentId(null)}
                className="w-full rounded-[24px] bg-slate-50 p-4 text-left"
                title="Arraste para uma doca"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{shipment.carrier}</div>
                  <Badge tone={shipment.priority === "alta" ? "red" : shipment.priority === "media" ? "yellow" : "green"}>{shipment.priority}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-600">{shipment.plate} · ETA {shipment.eta}</div>
              </button>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-3">
          {warehouseDocks.map((dock) => {
            const shipment = warehouseShipments.find((item) => item.id === dock.shipmentId);
            return (
              <Card
                key={dock.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!dragShipmentId) return;
                  moveShipment(dragShipmentId, dock.id);
                  setDragShipmentId(null);
                }}
                className="min-h-72"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold">{dock.name}</h3>
                    <div className="text-sm text-slate-500">{dock.mode}</div>
                  </div>
                  <Badge tone={dock.status === "ocupada" ? "blue" : dock.status === "manutencao" ? "red" : "green"}>{dock.status}</Badge>
                </div>

                {shipment ? (
                  <div className="space-y-3">
                    <div className="rounded-[24px] bg-slate-900 p-4 text-white">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{shipment.carrier}</div>
                        <Badge tone="blue" className="bg-white/10 text-white">{shipment.direction}</Badge>
                      </div>
                      <div className="mt-3 text-sm text-slate-300">{shipment.plate}</div>
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-300"><Clock3 size={15} /> {dock.timerMinutes} min ativos</div>
                    </div>
                    <div className="grid gap-3 text-sm text-slate-600">
                      <div>Contado {shipment.countedItems}/{shipment.expectedItems} volumes</div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => pushToast(`Cronômetro reforçado para ${dock.name}.`, "info")}><Clock3 size={16} /> Reiniciar timer</Button>
                        <Button variant="ghost" onClick={() => moveShipment(shipment.id)}><Workflow size={16} /> Voltar fila</Button>
                        <Button variant="ghost" onClick={() => pushToast(`Conferência da ${dock.name} aberta.`, "success")}><Truck size={16} /> Abrir conferência</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                    Solte um veículo aqui para alocar esta doca.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold">Indicadores rápidos</h3>
            <p className="text-sm text-slate-500">Tempo total de doca ativo no armazém selecionado: {productivity} minutos.</p>
          </div>
          <Button variant="ghost" onClick={() => pushToast("Fila reordenada por prioridade e ETA.", "success")}>Reordenar fila</Button>
        </div>
      </Card>
    </div>
  );
}
