import { useApp } from "../context/AppContext";
import { Button, Card, SectionHeader, Select, Toggle, Input } from "../components/ui";

export function SettingsPage() {
  const { settings, updateSettings } = useApp();

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Configurações"
        title="Regras operacionais e preferências visuais"
        description="O frontend já suporta alteração de parâmetros de validade, empilhamento, notificações e preferências de visualização."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold">Dias para alerta de validade</label>
            <Input type="number" value={settings.expiryWarningDays} onChange={(event) => updateSettings({ expiryWarningDays: Number(event.target.value) })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Stack padrão</label>
            <Input type="number" value={settings.defaultStackLimit} onChange={(event) => updateSettings({ defaultStackLimit: Number(event.target.value) })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Tema operacional</label>
            <Select value={settings.operationalTheme} onChange={(event) => updateSettings({ operationalTheme: event.target.value as typeof settings.operationalTheme })}>
              <option value="padrao">Padrão</option>
              <option value="alto-contraste">Alto contraste</option>
            </Select>
          </div>
        </Card>
        <Card className="space-y-5">
          <Toggle checked={settings.compactMode} onChange={(value) => updateSettings({ compactMode: value })} label="Visualização compacta para operação" />
          <Toggle checked={settings.notificationsEnabled} onChange={(value) => updateSettings({ notificationsEnabled: value })} label="Notificações operacionais ativas" />
          <Button onClick={() => updateSettings({ editorPassword: "layout123" })}>Restaurar senha padrão do editor</Button>
        </Card>
      </div>
    </div>
  );
}
