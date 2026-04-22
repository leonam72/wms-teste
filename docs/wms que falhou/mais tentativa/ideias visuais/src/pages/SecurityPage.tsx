import { KeyRound, Shield, UserRoundX } from "lucide-react";
import { Badge, Button, Card, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";

export function SecurityPage() {
  const { users, toggleUserStatus, resetUserPassword, pushToast } = useApp();

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Segurança"
        title="Usuários, perfis e bloqueios"
        description="Papéis sugeridos já estão configurados: administrador, gestor, operador, conferente e auditor."
        action={<Button onClick={() => pushToast("Novo usuário mockado pode ser incluído no próximo passo de integração.", "info")}><Shield size={16} /> Novo usuário</Button>}
      />

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-bold">{user.name}</h3>
                <Badge tone="blue">{user.role}</Badge>
                <Badge tone={user.active ? "green" : "red"}>{user.active ? "ativo" : "bloqueado"}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <div><span className="font-semibold">Usuário:</span> {user.username}</div>
                <div><span className="font-semibold">Último acesso:</span> {user.lastAccess}</div>
                <div><span className="font-semibold">Armazéns:</span> {user.warehouseIds.join(", ")}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="ghost" onClick={() => toggleUserStatus(user.id)}><UserRoundX size={16} /> {user.active ? "Bloquear" : "Desbloquear"}</Button>
              <Button variant="ghost" onClick={() => resetUserPassword(user.id)}><KeyRound size={16} /> Redefinir senha</Button>
              <Button variant="ghost" onClick={() => pushToast(`Permissões de ${user.name} abertas em modo edição futura.`, "info")}>Permissões</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
