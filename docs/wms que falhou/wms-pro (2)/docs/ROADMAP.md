# Roadmap — WMS Pro

> Pendências organizadas por prioridade e horizonte.  
> Itens já entregues ficam em `CHANGELOG.md`.  
> Ao retomar desenvolvimento, ler este arquivo primeiro.

---

## 🔴 Prioridade imediata

### Código / Arquitetura

- [ ] **Dividir `render.js`** (2.720 linhas) em `receiving.js` e `qr.js` — candidato mais urgente de modularização
- [ ] **Validações de negócio no backend por operação** — capacidade, coerência de estoque e permissões de campo não devem depender do frontend para serem aplicadas
- [ ] **Migrar módulos restantes para endpoints incrementais** — reduzir dependência do `PUT /api/wms/state` legado; cada domínio deve ter seu próprio endpoint
- [ ] **Índices compostos no banco** — combinações de produto + lote + depósito + localização para consultas críticas

### Conferência e Recebimento

- [ ] **Persistência atômica por item na conferência cega** — sem dependência residual de snapshot global
- [ ] **Fluxo de recebimento sem re-render destrutivo** — preservar foco e valores de campos durante atualizações
- [ ] **Modo de escaneamento contínuo** na conferência cega
- [ ] **Produto inexistente no recebimento** não deve limpar o campo — oferecer cadastro guiado inline
- [ ] **Contagem de verificação imediata** quando tentativa de saída excede saldo/peso disponível

---

## 🟡 Curto prazo

### UI / UX

- [ ] **Revisão de navegação por teclado** — controles não semânticos precisam de `tabindex` e atalhos corretos
- [ ] **Loading states universais** — todos os botões e ações críticas, não só parte da interface
- [ ] **Reduzir modais no fluxo de conferência** — manter ações principais na página sempre que possível
- [ ] **Teclado numérico otimizado para tablet/coletor** no campo de quantidade
- [ ] **Tema noturno completo** além do modo high-contrast atual
- [ ] **Mecanismo global de desfazer** para operações rápidas e reversíveis (base já existe em `utils.js`)

### Qualidade e Validade

- [ ] **Bloquear expedição automaticamente** para produtos abaixo do prazo mínimo configurável por categoria
- [ ] **Regras automáticas por família** para quarentena, bloqueio e expedição

### Indicadores

- [ ] **Custo unitário / histórico de custo** para indicadores financeiros de perda e giro
- [ ] **Snapshots históricos agendados** para comparação temporal
- [ ] **Exportação automática periódica** de relatórios gerenciais

---

## 🔵 Médio prazo

### Arquitetura

- [ ] **Migrar para PostgreSQL** quando uso concorrente justificar — locks de linha e controle transacional mais forte
- [ ] **Fila de tarefas assíncronas** para relatórios, integrações e cálculos pesados
- [ ] **Arquitetura de eventos imutáveis** para trilha completa de movimentação (substitui snapshot)

### Operação Avançada

- [ ] **Directed putaway** — sugestão automática de localização baseada em giro, família, peso e contexto
- [ ] **LPN (License Plate Number)** — rastrear caixas/paletes/containers além do produto
- [ ] **Multi-UOM nativo** — conversões operacionais completas
- [ ] **Inventário cíclico automático** com missões dirigidas
- [ ] **Wave picking**
- [ ] **Cross-docking**
- [ ] **Gestão de doca / YMS**

### Rastreabilidade

- [ ] **Registro `antes/depois`** explícito em movimentações — contexto e motivo operacional
- [ ] **Devolução / logística reversa** com fluxo dedicado para quarentena e liberação
- [ ] **Assinatura digital mais robusta** em saídas críticas com evidência e auditoria

---

## 🟢 Longo prazo / Plataforma

### Hardware e Integrações

- [ ] **Impressão térmica direta** via ZPL/EPL
- [ ] **Interface otimizada para coletores rugged** e integração com DataWedge
- [ ] **RFID** — preparar modelo de dados
- [ ] **QR codes com payloads mais ricos** e gatilhos operacionais expandidos

### Plataforma

- [ ] **API externa estável** com contratos versionados e webhooks
- [ ] **PWA offline robusto** — sincronização posterior segura com fila local
- [ ] **Dashboard de produtividade** com métricas históricas e comparativos

---

## Próximas divisões de módulo planejadas

| Módulo atual | Extrair | Justificativa |
|---|---|---|
| `render.js` (2.720 linhas) | `receiving.js` | Fluxo de recebimento NF-e é grande e independente |
| `render.js` (2.720 linhas) | `qr.js` | QR Code é feature isolada, ~300 linhas |
| `blind-count.js` (2.289 linhas) | `unload-review.js` | Aprovação/rejeição de descargas é fluxo separado |
| `shipping.js` (1.595 linhas) | `separation.js` | Separação tem estado e fluxo próprios |
