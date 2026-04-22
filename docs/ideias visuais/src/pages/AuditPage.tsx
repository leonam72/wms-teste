import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Badge, Button, Card, Input, SectionHeader, Select } from "../components/ui";
import { useApp } from "../context/AppContext";

export function AuditPage() {
  const { auditLogs, pushToast } = useApp();
  const [moduleFilter, setModuleFilter] = useState("todos");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => auditLogs.filter((log) => {
    const moduleOk = moduleFilter === "todos" || log.module === moduleFilter;
    const queryOk = !query || [log.actor, log.entity, log.location, log.action].some((value) => value.toLowerCase().includes(query.toLowerCase()));
    return moduleOk && queryOk;
  }), [auditLogs, moduleFilter, query]);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Auditoria"
        title="Linha do tempo operacional"
        description="Quem fez, quando, onde, em qual módulo e qual foi o antes/depois resumido."
        action={<Button onClick={() => pushToast("Exportação visual preparada em CSV/PDF para integração futura.", "success")}><Download size={16} /> Exportar</Button>}
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ator, ação, entidade ou local" />
          <Select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="todos">Todos os módulos</option>
            {Array.from(new Set(auditLogs.map((item) => item.module))).map((module) => <option key={module}>{module}</option>)}
          </Select>
          <Button variant="ghost" onClick={() => { setQuery(""); setModuleFilter("todos"); }}><Search size={16} /> Limpar</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {filtered.map((log) => (
          <Card key={log.id} className="rounded-[28px]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{log.action}</h3>
                  <Badge tone="blue">{log.module}</Badge>
                  <Badge tone="slate">{log.role}</Badge>
                </div>
                <div className="mt-2 text-sm text-slate-500">{log.actor} · {log.when} · {log.location}</div>
              </div>
              <Button variant="ghost" onClick={() => pushToast(`Detalhe: ${log.before ?? "-"} -> ${log.after ?? "-"}`, "info")}>Detalhes</Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3 text-sm"><span className="font-semibold">Entidade:</span> {log.entity}</div>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm"><span className="font-semibold">Antes:</span> {log.before ?? "n/a"}</div>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm"><span className="font-semibold">Depois:</span> {log.after ?? "n/a"}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
