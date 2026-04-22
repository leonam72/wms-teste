import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Dock,
  LayoutTemplate,
  Map,
  PackageSearch,
  ScanSearch,
  Settings,
  Shield,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { Badge, Button, Input } from "../ui";

const navItems = [
  { to: "/overview", icon: Warehouse, label: "Overview" },
  { to: "/map", icon: Map, label: "Mapa" },
  { to: "/layout-editor", icon: LayoutTemplate, label: "Editor" },
  { to: "/products", icon: Boxes, label: "Produtos" },
  { to: "/docks", icon: Dock, label: "Docas" },
  { to: "/receiving", icon: ClipboardCheck, label: "Recebimento" },
  { to: "/blind-count", icon: ScanSearch, label: "Conferência cega" },
  { to: "/validation", icon: PackageSearch, label: "Validação" },
  { to: "/audit", icon: Activity, label: "Auditoria" },
  { to: "/security", icon: Shield, label: "Segurança" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, globalQuery, setGlobalQuery, warehouses, selectedWarehouseId, setSelectedWarehouseId, logout, mode, setMode } = useApp();

  const title = navItems.find((item) => location.pathname.startsWith(item.to))?.label ?? "VisualWMS";

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-4 p-3 lg:p-4">
        <aside className="glass hidden w-72 shrink-0 rounded-[32px] border border-white/70 px-4 py-5 shadow-[var(--shadow-soft)] lg:flex lg:flex-col">
          <Link to="/overview" className="mb-6 flex items-center gap-4 px-3">
            <div className="rounded-[24px] bg-brand px-3 py-3 text-white shadow-lg">
              <Warehouse size={22} />
            </div>
            <div>
              <div className="font-display text-2xl font-bold">VisualWMS</div>
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Operação visual</div>
            </div>
          </Link>

          <div className="mb-6 rounded-[28px] bg-slate-900 px-4 py-5 text-white">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Modo atual</span>
              <Badge tone="blue" className="bg-white/15 text-white">{mode}</Badge>
            </div>
            <p className="text-sm text-slate-300">Altere entre foco operacional e visão gerencial sem trocar de tela.</p>
            <div className="mt-4 flex gap-2">
              <Button variant={mode === "operacao" ? "primary" : "ghost"} className={mode === "operacao" ? "bg-brand text-white" : "bg-white/10 text-white ring-white/20"} onClick={() => setMode("operacao")} title="Prioriza ações rápidas">Operação</Button>
              <Button variant={mode === "gestao" ? "primary" : "ghost"} className={mode === "gestao" ? "bg-white text-slate-900" : "bg-white/10 text-white ring-white/20"} onClick={() => setMode("gestao")} title="Prioriza métricas e analytics">Gestão</Button>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive ? "bg-brand text-white shadow-lg" : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-[28px] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Sparkles size={16} />
              Atalhos ativos
            </div>
            <p>`/` busca global, `Esc` limpa seleção, `E` alterna editor nas telas operacionais.</p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col gap-4">
          <header className="glass sticky top-0 z-20 flex flex-col gap-4 rounded-[32px] border border-white/70 px-4 py-4 shadow-[var(--shadow-soft)] lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-brand">VisualWMS / {title}</div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl font-bold text-slate-900">{title}</h2>
                  <Badge tone="slate">{warehouses.find((warehouse) => warehouse.id === selectedWarehouseId)?.city}</Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium"
                  title="Trocar armazém"
                >
                  {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                </select>
                <div className="min-w-[260px] flex-1 xl:w-80">
                  <Input
                    value={globalQuery}
                    onChange={(event) => setGlobalQuery(event.target.value)}
                    placeholder="Buscar SKU, produto, bin ou palete"
                    title="Busca global"
                  />
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-3 py-2 text-white">
                  <div className="text-right">
                    <div className="text-sm font-semibold">{currentUser?.name}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{currentUser?.role}</div>
                  </div>
                  <Button variant="ghost" className="bg-white/10 text-white ring-white/20 hover:bg-white/20" onClick={() => navigate("/security")} title="Abrir gestão de usuários">Perfil</Button>
                  <Button variant="ghost" className="bg-white/10 text-white ring-white/20 hover:bg-white/20" onClick={logout} title="Encerrar sessão">Sair</Button>
                </div>
              </div>
            </div>
          </header>

          <main className="pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
