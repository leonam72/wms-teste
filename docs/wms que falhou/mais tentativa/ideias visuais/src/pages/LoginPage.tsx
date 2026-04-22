import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Button, Card, Input } from "../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin@123");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    window.setTimeout(() => {
      const result = login(username, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (remember) localStorage.setItem("visualwms-user", username);
      navigate("/overview");
    }, 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-[36px] bg-slate-950 p-8 text-white shadow-2xl lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.5),transparent_30%),linear-gradient(135deg,#0f172a_10%,#1e293b_55%,#0f766e_100%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-12">
            <div>
              <div className="mb-6 inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em]">VisualWMS</div>
              <h1 className="font-display text-5xl font-bold leading-tight">WMS visual para operação rápida, segura e auditável.</h1>
              <p className="mt-6 max-w-2xl text-lg text-slate-200">Mapa 2D, recebimento, conferência cega, validação, docas e analytics no mesmo fluxo, com mínimo deslocamento de mouse e ação contextual próxima da decisão.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["98,7%", "assertividade de endereçamento"],
                ["42 min", "média de descarga controlada"],
                ["24h", "trilha completa de auditoria"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[28px] border border-white/10 bg-white/10 p-4">
                  <div className="text-3xl font-bold">{value}</div>
                  <div className="mt-2 text-sm text-slate-200">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card className="self-center rounded-[36px] p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand">Acesso autenticado</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Entrar no VisualWMS</h2>
            <p className="mt-2 text-sm text-slate-500">Estrutura pronta para autenticação real. Os perfis mockados já carregam permissões e armazéns diferentes.</p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Usuário</label>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Senha</label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand" />
                Lembrar acesso
              </label>
              <button type="button" className="font-semibold text-brand" onClick={() => setError("Fluxo de recuperação preparado para integração com backend e e-mail transacional.")}>
                Recuperar senha
              </button>
            </div>
            {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <Button type="submit" className="w-full py-3" disabled={loading}>
              {loading ? "Validando acesso..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-8 rounded-[28px] bg-slate-50 p-5">
            <div className="mb-3 text-sm font-semibold text-slate-900">Perfis padrão</div>
            <div className="grid gap-3 text-sm text-slate-600">
              <div>`admin` / `Admin@123`</div>
              <div>`gestor` / `Gestor@123`</div>
              <div>`operador` / `Operador@123`</div>
              <div>`conferente` / `Conferente@123`</div>
              <div>`auditor` / `Auditor@123`</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
