import { CheckCircle2, RotateCcw, ShieldX } from "lucide-react";
import { Badge, Button, Card, Input, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";

export function ValidationPage() {
  const { validationCases, blindCounts, products, setValidationDecision } = useApp();
  const validationCase = validationCases[0];
  const blind = blindCounts.find((item) => item.id === validationCase.blindCountId)!;

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Validação final"
        title="Comparação entre recebido e apontado"
        description="O conferente ou gestor compara recebido x esperado, aceita, solicita recontagem ou rejeita parcial/total com justificativa rastreável."
      />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-bold">Divergências do recebimento</h3>
          <Badge tone={validationCase.decision === "aprovado" ? "green" : validationCase.decision === "rejeitado" ? "red" : "yellow"}>{validationCase.decision}</Badge>
        </div>
        <div className="space-y-3">
          {blind.items.map((item) => {
            const product = products.find((product) => product.id === item.productId)!;
            const delta = item.countedQty - item.expectedQty;
            return (
              <div key={product.id} className="rounded-[24px] bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{product.description}</div>
                    <div className="text-xs text-slate-500">{product.sku}</div>
                  </div>
                  <div className="text-sm text-slate-700">
                    Esperado <span className="font-semibold">{item.expectedQty}</span> · Recebido <span className="font-semibold">{item.countedQty}</span>
                  </div>
                  <Badge tone={delta === 0 ? "green" : "red"}>{delta === 0 ? "sem divergência" : `${delta > 0 ? "+" : ""}${delta}`}</Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <Input
            placeholder="Justificativa da decisão"
            value={validationCase.justification}
            onChange={(event) => setValidationDecision(validationCase.id, validationCase.decision, event.target.value)}
          />
          <Button variant="ghost" onClick={() => setValidationDecision(validationCase.id, "recontagem", "Solicitada nova contagem com base nas divergências")}><RotateCcw size={16} /> Recontagem</Button>
          <Button onClick={() => setValidationDecision(validationCase.id, "aprovado", "Aprovado para estoque real")}><CheckCircle2 size={16} /> Aprovar</Button>
          <Button variant="danger" onClick={() => setValidationDecision(validationCase.id, "rejeitado", "Rejeição parcial/total registrada")}><ShieldX size={16} /> Rejeitar</Button>
        </div>
      </Card>
    </div>
  );
}
