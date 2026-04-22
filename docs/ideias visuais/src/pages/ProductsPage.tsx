import { useMemo, useState } from "react";
import { Filter, History, Printer, Search, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Input, SectionHeader, Select } from "../components/ui";
import { useApp } from "../context/AppContext";
import { expiryTone, findProductByQuery } from "./helpers";

export function ProductsPage() {
  const { products, pallets, settings, warehouses, selectedWarehouseId, pushToast, setGlobalQuery } = useApp();
  const warehouse = warehouses.find((item) => item.id === selectedWarehouseId)!;
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const filtered = useMemo(() => findProductByQuery(products, query).filter((product) => statusFilter === "todos" || product.status === statusFilter), [products, query, statusFilter]);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Cadastro integrado"
        title="Produtos, estoque e rastreabilidade resumida"
        description="SKU, lote, validade, curva ABC, prioridade de picking e histórico rápido usando a mesma malha de bins e paletes do mapa."
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por SKU, descrição, fabricante ou fornecedor" />
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="normal">Normal</option>
            <option value="baixo">Baixo</option>
            <option value="quarentena">Quarentena</option>
            <option value="bloqueado">Bloqueado</option>
          </Select>
          <Button variant="ghost" onClick={() => { setQuery(""); setStatusFilter("todos"); }}>Limpar filtros</Button>
        </div>
      </Card>

      {filtered.length === 0 ? <EmptyState title="Nenhum produto encontrado" description="Ajuste os filtros ou limpe a busca para recuperar o catálogo completo." /> : null}

      <div className="space-y-3">
        {filtered.map((product) => {
          const inBins = pallets.filter((pallet) => pallet.items.some((item) => item.productId === product.id)).map((pallet) => warehouse.bins.find((bin) => bin.id === pallet.binId)?.code).filter(Boolean);
          const tone = expiryTone(product.expiresAt, settings.expiryWarningDays);
          return (
            <Card key={product.id} className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-2xl font-bold">{product.description}</h3>
                  <Badge tone="slate">{product.sku}</Badge>
                  <Badge tone={tone === "red" ? "red" : tone === "yellow" ? "yellow" : "green"}>{product.expiresAt.slice(0, 10)}</Badge>
                  <Badge tone="blue">Curva {product.abcCurve}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                  <div><span className="font-semibold">Categoria:</span> {product.category}</div>
                  <div><span className="font-semibold">Peso:</span> {product.weightKg} kg</div>
                  <div><span className="font-semibold">Empilhamento:</span> {product.maxStack}</div>
                  <div><span className="font-semibold">Estoque:</span> {product.stockUnits} un.</div>
                  <div><span className="font-semibold">Fornecedor:</span> {product.supplier}</div>
                  <div><span className="font-semibold">Fabricante:</span> {product.manufacturer}</div>
                  <div><span className="font-semibold">Prioridade:</span> {product.pickingPriority}</div>
                  <div><span className="font-semibold">Lote:</span> {product.lot}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => { setGlobalQuery(product.sku); navigate("/map"); }} title="Destacar bins com este SKU"><Search size={16} /> Localizar bins</Button>
                  <Button variant="ghost" onClick={() => pushToast(`Etiqueta de ${product.sku} preparada.`, "success")} title="Imprimir identificação"><Printer size={16} /> Etiqueta</Button>
                  <Button variant="ghost" onClick={() => pushToast(`Histórico de ${product.sku}: ${product.history.join(" | ")}`, "info")} title="Exibir movimentações"><History size={16} /> Histórico</Button>
                  <Button variant="ghost" onClick={() => pushToast(`Tarefa de movimentação criada para ${product.sku}.`, "success")} title="Gerar reposição"><Truck size={16} /> Gerar tarefa</Button>
                </div>
              </div>
              <div className="rounded-[28px] bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Status de estoque</div>
                  <Button variant="ghost" className="px-3 py-1.5" onClick={() => pushToast(`Filtro operacional aplicado para ${product.sku}.`, "info")}><Filter size={15} /> Filtrar</Button>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div>{product.notes}</div>
                  <div className="font-semibold text-slate-900">Localizações</div>
                  {inBins.length ? inBins.map((bin) => <Badge key={bin} tone="purple" className="mr-2">{bin}</Badge>) : <div>Sem bin ativo no armazém selecionado.</div>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
