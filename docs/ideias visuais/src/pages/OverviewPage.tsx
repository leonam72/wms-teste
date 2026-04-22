import { AlertTriangle, Boxes, CircleGauge, ScanBarcode, Siren, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, SectionHeader, Badge, Button } from "../components/ui";
import { useApp } from "../context/AppContext";
import { expiryTone, warehouseMetrics } from "./helpers";

export function OverviewPage() {
  const { warehouses, selectedWarehouseId, products, pallets, settings, pushToast } = useApp();
  const warehouse = warehouses.find((item) => item.id === selectedWarehouseId)!;
  const warehousePallets = pallets.filter((item) => warehouse.bins.some((bin) => bin.id === item.binId));
  const metrics = warehouseMetrics(warehouse, warehousePallets.length);
  const expired = products.filter((product) => expiryTone(product.expiresAt, settings.expiryWarningDays) === "red").length;
  const expiring = products.filter((product) => expiryTone(product.expiresAt, settings.expiryWarningDays) === "yellow").length;
  const zoneData = warehouse.zones.map((zone) => ({
    name: zone.name,
    pallets: warehousePallets.filter((pallet) => warehouse.bins.find((bin) => bin.id === pallet.binId)?.zoneId === zone.id).length,
    fill: zone.color,
  }));
  const skuData = products.slice(0, 5).map((product) => ({ name: product.sku, ocupacao: product.stockUnits }));
  const giroData = [
    { dia: "Seg", giro: 92 },
    { dia: "Ter", giro: 88 },
    { dia: "Qua", giro: 106 },
    { dia: "Qui", giro: 112 },
    { dia: "Sex", giro: 96 },
  ];

  const summaryCards = [
    { label: "Produtos vencidos", value: String(expired), tone: "red" as const, Icon: AlertTriangle },
    { label: "A vencer", value: String(expiring), tone: "yellow" as const, Icon: Siren },
    { label: "Ocupação total", value: `${metrics.occupancy}%`, tone: "blue" as const, Icon: CircleGauge },
    { label: "Paletes ativos", value: String(warehousePallets.length), tone: "green" as const, Icon: Boxes },
    { label: "Conferências abertas", value: "3", tone: "purple" as const, Icon: ScanBarcode },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Etapas 1 a 3 materializadas"
        title="Arquitetura, componentes e entidades já viraram produto"
        description="Esta visão resume a saúde operacional do armazém selecionado usando a mesma base mockada compartilhada entre mapa, recebimento, conferência, validação, auditoria e segurança."
        action={<Button onClick={() => pushToast("Exportação visual da overview preparada para backend.", "success")}>Exportar visão</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, tone, Icon }) => (
          <Card key={label} className="rounded-[30px]">
            <div className="mb-4 flex items-center justify-between">
              <Badge tone={tone as never}>{label}</Badge>
              <Icon size={18} className="text-slate-500" />
            </div>
            <div className="font-display text-4xl font-bold text-slate-900">{value}</div>
            <div className="mt-3 text-sm text-slate-500">Atualizado com filtros do armazém {warehouse.name}.</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold">Giro de estoque e pressão operacional</h3>
              <p className="text-sm text-slate-500">Indicador rápido para o gestor comparar giro versus alertas.</p>
            </div>
            <Badge tone="green"><TrendingUp size={14} /> +8% na semana</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={giroData}>
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="giro" radius={[12, 12, 0, 0]} fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="font-display text-2xl font-bold">Ocupação por zona</h3>
          <p className="mb-4 text-sm text-slate-500">Leitura visual rápida para rebalancear picking, reserva e quarentena.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={zoneData} dataKey="pallets" nameKey="name" innerRadius={60} outerRadius={95}>
                  {zoneData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold">SKUs com maior ocupação</h3>
            <Button variant="ghost" onClick={() => pushToast("Filtro cruzado aplicado na tela de produtos.", "info")}>Abrir produtos</Button>
          </div>
          <div className="space-y-3">
            {skuData.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">{item.name}</span>
                  <span className="text-slate-500">{item.ocupacao} un.</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-slate-900" style={{ width: `${Math.min(100, item.ocupacao / 24)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold">Alertas operacionais</h3>
            <Button variant="ghost" onClick={() => pushToast("Painel de alertas priorizado para o turno atual.", "warning")}>Priorizar turno</Button>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ["Doca 01 com descarga acima da meta", "warning"],
              ["Lote SKU-1044 vencido em quarentena", "red"],
              ["Picking frontal com 92% de ocupação", "blue"],
              ["2 divergências aguardando validação final", "purple"],
            ].map(([text, tone]) => (
              <div key={text} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-700">{text}</span>
                <Badge tone={tone as never}>ação sugerida</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
