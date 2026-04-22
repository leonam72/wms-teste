import { Grid3X3, Timer, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";

export function AnalyticsPage() {
  const { pushToast } = useApp();
  const trend = [
    { hora: "08h", produtividade: 76, divergencias: 2 },
    { hora: "10h", produtividade: 88, divergencias: 3 },
    { hora: "12h", produtividade: 72, divergencias: 1 },
    { hora: "14h", produtividade: 96, divergencias: 4 },
    { hora: "16h", produtividade: 84, divergencias: 2 },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Analytics"
        title="Produtividade, ocupação e mapa de calor operacional"
        description="Painel gerencial para comparar produtividade, tempo de doca, divergências de recebimento e utilização por zona."
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold">Curva de produtividade</h3>
              <p className="text-sm text-slate-500">Volume processado e pressão de divergências ao longo do turno.</p>
            </div>
            <Badge tone="green"><TrendingUp size={14} /> +12% vs ontem</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="hora" />
                <YAxis />
                <Tooltip />
                <Area dataKey="produtividade" fill="#0f766e" stroke="#0f766e" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="font-display text-2xl font-bold">Heatmap operacional</h3>
          <p className="mb-4 text-sm text-slate-500">Leitura rápida de hotspots por zona e doca.</p>
          <div className="grid grid-cols-4 gap-2">
            {[42, 55, 78, 31, 88, 64, 37, 29, 72, 91, 58, 46].map((value, index) => (
              <button
                key={index}
                className="aspect-square rounded-2xl text-xs font-bold text-white"
                style={{ backgroundColor: `rgba(15,118,110,${Math.max(0.18, value / 100)})` }}
                onClick={() => pushToast(`Hotspot ${index + 1} com intensidade ${value}.`, "info")}
                title="Abrir resumo do hotspot"
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => pushToast("Mapa de calor filtrado por turno da manhã.", "info")}><Grid3X3 size={16} /> Filtrar turno</Button>
            <Button variant="ghost" onClick={() => pushToast("Tempo médio de doca exportado.", "success")}><Timer size={16} /> Tempo de doca</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
