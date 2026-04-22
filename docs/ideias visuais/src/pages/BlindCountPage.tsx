import { Camera, TimerReset, Timer } from "lucide-react";
import { Badge, Button, Card, Input, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";

export function BlindCountPage() {
  const { blindCounts, products, updateBlindCount, pushToast } = useApp();
  const session = blindCounts[0];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Conferência cega"
        title="Apontamento sem exibir quantidade esperada"
        description="O operador vê produto, lote e progresso, mas não vê o esperado. Cronômetro e divergências seguem junto para validação posterior."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => pushToast("Cronômetro reiniciado para nova doca.", "warning")}><TimerReset size={16} /> Reiniciar</Button>
            <Button variant="ghost" onClick={() => pushToast("Foto de divergência anexada ao turno.", "success")}><Camera size={16} /> Foto</Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.48fr_1.52fr]">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <Badge tone="blue"><Timer size={14} /> {Math.floor(session.timerSeconds / 60)}m {session.timerSeconds % 60}s</Badge>
            <Badge tone="yellow">{session.status}</Badge>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div>Operação desenhada para coletor ou tablet com poucos campos e ações próximas.</div>
            <div>Fotos anexadas: {session.photos.length}</div>
            <div>Divergências abertas: {session.items.filter((item) => item.divergence).length}</div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-display text-2xl font-bold">Itens em conferência</h3>
          <div className="space-y-3">
            {session.items.map((item) => {
              const product = products.find((product) => product.id === item.productId)!;
              return (
                <div key={product.id} className="grid gap-3 rounded-[24px] bg-slate-50 p-4 md:grid-cols-[1fr_180px_180px] md:items-center">
                  <div>
                    <div className="font-semibold text-slate-900">{product.description}</div>
                    <div className="text-xs text-slate-500">{product.sku} · lote {product.lot}</div>
                  </div>
                  <Input type="number" value={item.countedQty} onChange={(event) => updateBlindCount(session.id, product.id, Number(event.target.value))} />
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={item.divergence ? "red" : "green"}>{item.divergence ? "divergente" : "ok"}</Badge>
                    <Button variant="ghost" onClick={() => pushToast(item.divergence ?? "Sem divergência para este item.", item.divergence ? "warning" : "success")}>Detalhar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
