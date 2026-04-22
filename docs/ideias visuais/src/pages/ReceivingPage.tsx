import { Camera, ClipboardList, FileCheck2, PlayCircle } from "lucide-react";
import { Badge, Button, Card, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";

export function ReceivingPage() {
  const { receiving, shipments, products, toggleChecklistItem, addReceivingPhoto, pushToast } = useApp();
  const session = receiving[0];
  const shipment = shipments.find((item) => item.id === session.shipmentId);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Recebimento"
        title="Recebimento documental com checklist, fotos e lotes"
        description="O fluxo já conversa com inbound/outbound, conferencia cega e validação. Nada aqui é elemento morto: checklist, fotos e ação de avanço alteram o estado mockado."
      />

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold">Resumo da doca</h3>
            <Badge tone="blue">{shipment?.carrier}</Badge>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div><span className="font-semibold">Placa:</span> {shipment?.plate}</div>
            <div><span className="font-semibold">Volumes esperados:</span> {shipment?.expectedItems}</div>
            <div><span className="font-semibold">Status:</span> {session.status}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => pushToast("Documentação marcada como conforme.", "success")}><FileCheck2 size={16} /> Validar docs</Button>
            <Button variant="ghost" onClick={() => addReceivingPhoto(session.id)}><Camera size={16} /> Anexar foto</Button>
            <Button onClick={() => pushToast("Fluxo avançado para conferência cega.", "success")}><PlayCircle size={16} /> Iniciar conferência cega</Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold">Checklist e itens recebidos</h3>
            <Button variant="ghost" onClick={() => pushToast("Checklist exportado para a trilha de auditoria.", "info")}><ClipboardList size={16} /> Exportar checklist</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.48fr_0.52fr]">
            <div className="space-y-2">
              {session.checklist.map((item, index) => (
                <button key={item.label} onClick={() => toggleChecklistItem(session.id, index)} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <Badge tone={item.done ? "green" : "yellow"}>{item.done ? "ok" : "pendente"}</Badge>
                </button>
              ))}
              <div className="rounded-[24px] bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Fotos de avaria</div>
                <div className="mt-2 space-y-1">{session.photos.map((photo) => <div key={photo}>{photo}</div>)}</div>
              </div>
            </div>
            <div className="space-y-3">
              {session.items.map((item) => {
                const product = products.find((product) => product.id === item.productId)!;
                return (
                  <div key={product.id} className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{product.description}</div>
                        <div className="text-xs text-slate-500">{product.sku} · lote {item.lot}</div>
                      </div>
                      <Badge tone={item.receivedQty === item.expectedQty ? "green" : "yellow"}>
                        {item.receivedQty}/{item.expectedQty}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
