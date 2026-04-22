# Mapa de Módulos — WMS Frontend

> **Última atualização:** março 2026  
> Guia de referência rápida para localizar código, entender dependências e saber onde mexer.  
> Ao pedir uma alteração num LLM, envie este arquivo + o módulo específico — não o `app.js` inteiro.

---

## Estrutura de arquivos JS

```
frontend/static/js/
├── api.js                   # Chamadas HTTP, health-check, sync queue offline
├── auth.js                  # Login, logout, token JWT
├── app.js                   # Fonte monolítica (mantida como referência; não editar diretamente)
└── modules/                 # Módulos ativos carregados pelo HTML
    ├── utils.js             # Utilitários globais
    ├── state.js             # Estado global e persistência
    ├── depot.js             # Gestão de depósitos
    ├── history.js           # Histórico, validade, alertas
    ├── ui-core.js           # Modais e componentes centrais de UI
    ├── floorplan.js         # Planta baixa
    ├── navigation.js        # Navegação, permissões, usuários, qualidade
    ├── blind-count.js       # Conferência cega e descargas
    ├── shipping.js          # Saídas, separação, expedição
    ├── indicators.js        # KPIs e indicadores operacionais
    ├── products-page.js     # Tabela e formulário de produtos
    ├── drawer-ops.js        # Operações de gaveta, drag & drop, filtros
    ├── render.js            # Init, renderização principal, recebimento, QR
    └── settings.js          # Configurações, importação, exportação
```

---

## De-para: tarefa → módulo

| Quero mexer em… | Arquivo |
|---|---|
| Login, logout, token | `auth.js` |
| Chamadas à API, offline queue | `api.js` |
| `escapeHtml`, `showToast`, `showConfirm` | `utils.js` |
| Permissões do usuário (`hasPermission`, roles) | `utils.js` |
| Helpers de capacidade (`validateDrawerPlacement`) | `utils.js` |
| `depots[]`, `shelvesAll`, `productsAll` (variáveis globais) | `state.js` |
| Persistência (`persistAppState`, `loadAppState`) | `state.js` |
| Criação / remoção / renomeação de depósito | `depot.js` |
| Tabs de depósito, navegação entre depósitos | `depot.js` |
| Histórico operacional (`logHistory`, `renderHistory`) | `history.js` |
| Validade, vencimento, alertas de prazo | `history.js` |
| Modal de detalhe do produto | `ui-core.js` |
| Tooltip de gaveta, KPI, modal de depósito | `ui-core.js` |
| Planta baixa (layout, zoom, snap, seleção) | `floorplan.js` |
| `showPage`, troca de página | `navigation.js` |
| Permissões visuais por role (`applyRolePermissions`) | `navigation.js` |
| CRUD de usuários, alterar senha | `navigation.js` |
| Página de qualidade (quarentena, bloqueio) | `navigation.js` |
| Conferência cega, pool de itens, descargas | `blind-count.js` |
| Aprovação / rejeição de descargas | `blind-count.js` |
| Carrinho de saída, FEFO, finalização | `shipping.js` |
| Separação (romaneio, rota, tarefas) | `shipping.js` |
| Registros de saída (outbound records) | `shipping.js` |
| Indicadores operacionais, KPIs | `indicators.js` |
| Tabela de produtos, formulário de produto | `products-page.js` |
| Histórico de movimentações (página) | `products-page.js` |
| Salvar gaveta, drag & drop entre gavetas | `drawer-ops.js` |
| Modo mover produto, filtros do sidebar | `drawer-ops.js` |
| `init()`, `renderAll()`, grid de prateleiras | `render.js` |
| Recebimento de NF-e, sessão de recebimento | `render.js` |
| QR Code (gerador, scanner, workflow) | `render.js` |
| Modal de gaveta, adicionar produto a gaveta | `render.js` |
| Move mode (mover produto entre gavetas) | `render.js` |
| Importação CSV/JSON, exportação | `settings.js` |
| Limpar dados, backup admin | `settings.js` |

---

## Módulos em detalhe

### `utils.js` — 764 linhas
**Responsabilidade:** fundação. Tudo que qualquer outro módulo usa.  
**Regra:** nunca importa de outros módulos. Zero efeitos colaterais no DOM.

Grupos de funções:
- **UI primitiva:** `showConfirm`, `showNotice`, `showToast`, `showTextPrompt`, `playUiSound`
- **Segurança/escape:** `escapeHtml`, `escapeAttr`, `escapeJs`, `sanitizeTextInput`
- **DOM helpers:** `byId`, `readInputValue`, `writeInputValue`, `deepClone`
- **Tabelas redimensionáveis:** `enhanceResizableTable`, `attachTableResizerHandle`
- **Permissões (cliente):** `hasPermission`, `requirePermission`, `canManageUsers`, `canManageProducts`
- **Queries de estoque:** `getDepotById`, `getShelfById`, `getDrawerProducts`, `getDrawerUsedKg`, `validateDrawerPlacement`
- **Normalização:** `normalizeShelfType`, `normalizeDiscardDrawerKey`, `normalizeDiscardInventoryState`

---

### `state.js` — 225 linhas
**Responsabilidade:** variáveis globais de estado + todas as funções de persistência com o backend.

Variáveis globais principais:
```js
depots[]          // lista de depósitos
shelvesAll{}      // prateleiras por depósito
productsAll{}     // produtos por depósito e gaveta
auditHistory[]    // histórico operacional
outboundRecords[] // registros de saída
activeDepotId     // depósito ativo
```

Funções:
- `ensureDepotState()` — normaliza e valida o estado após qualquer mutação
- `loadAppState()` — carrega tudo do backend no boot
- `persistAppState()` / `persistStructureState()` / `persistInventoryState()` — saves incrementais
- `switchDepot(id)` — troca o depósito ativo e re-aponta `shelves` / `products`

---

### `depot.js` — 314 linhas
**Responsabilidade:** CRUD de depósitos e navegação entre páginas.

Funções principais:
- `addDepot()`, `removeDepot(id)`, `renameDepot(id)`
- `renderDepotTabs()` — barra de abas no topo
- `showPage(name)` está em `navigation.js`, mas `getCurrentPageName()` e `canOpenPage()` ficam aqui

---

### `history.js` — 414 linhas
**Responsabilidade:** histórico operacional e tudo relacionado a validade.

Funções principais:
- `logHistory(icon, action, detail, meta)` — registra entrada no histórico
- `renderHistory()` — renderiza o widget lateral
- `getExpiries(p)`, `nearestExpiry(p)`, `expiryStatus(dateStr)`, `daysUntil(dateStr)`
- `renderAlerts()` — barra de alertas de vencimento
- `openExpiryModal(filter)` — modal de produtos vencidos/a vencer

---

### `ui-core.js` — 255 linhas
**Responsabilidade:** componentes de UI que não cabem em um módulo de domínio específico.

Funções principais:
- `openProductDetail(code)` — modal de detalhe do produto com KPIs
- `showDrawerTooltip(ev, key)` / `hideDrawerTooltip()`
- `bindStaticUiControls()` — registra eventos em controles fixos do HTML
- `saveDepotModal()` — salva o formulário de depósito

---

### `floorplan.js` — 1.406 linhas
**Responsabilidade:** toda a lógica da planta baixa.

Subgrupos internos (comentários `// ───`):
- Estado: `fpLayout`, `fpObjects`, `fpSelection`, undo/redo stack
- Coordenadas: `fpS2W`, `fpSnap`, `fpRects`
- Colisão: `fpCollides`, `fpCollidesShelf`
- Zoom/transform: `fpZoom`, `fpZoomReset`, `fpApplyTransform`
- Edição: `fpEnterEditMode`, `fpExitEditMode`, `fpSelectTool`
- Seleção múltipla: `fpSelAll`, `fpLassoUpdate`, `fpLassoCommit`, `fpAlign`
- Render: `renderFloorPlan`, `getFloorPlanShelfViews`

---

### `navigation.js` — 651 linhas
**Responsabilidade:** navegação entre páginas, permissões visuais, usuários e qualidade.

Funções principais:
- `showPage(name)` — ponto central de troca de página
- `applyRolePermissions()` — mostra/esconde elementos por role
- `renderUsersPage()`, `createManagedUser()`, `deleteManagedUser()`
- `renderQualityPage()`, `fetchQualityData()`, `renderQualityContent()`

---

### `blind-count.js` — 2.289 linhas
**Responsabilidade:** fluxo completo de conferência cega (recebimento físico sem NF prévia).

Fluxo principal:
1. `startBlindUnload()` — inicia uma descarga
2. `handleBlindProductInput()` → `resolveBlindProductMatch()` — lookup de produto
3. `saveBlindPoolItem()` — adiciona item à pool
4. `confirmBlindAllocation()` — aloca item a uma gaveta
5. `finalizeBlindUnload()` — encerra e salva a descarga
6. `approveBlindRecord()` / `rejectBlindRecord()` — fluxo de aprovação

Também inclui: views V2 (cards) e V3 (clássico), renderização de descargas pendentes, contagem de registros.

---

### `shipping.js` — 1.595 linhas
**Responsabilidade:** saídas de estoque, separação e expedição.

Subgrupos:
- **Separação:** `confirmSeparationRequest`, `loadSeparationRequestDetail`, `renderSeparationPage`
- **Carrinho de saída:** `renderShippingCart`, `confirmShippingAdd`, `removeShippingCartItem`
- **FEFO/validade:** `evaluateFefoBreak`, `evaluateShipmentExpiryBlocks`, `getShippingPriorityDate`
- **Finalização:** `openFinalizeShippingModal`, `confirmFinalizeShipping`
- **Registros:** `renderOutboundRecordsPage`, `printOutboundRecord`, `saveOutboundEdit`
- **Descarte:** `buildDiscardPlan`, `findDiscardDrawerForKg`, `ensureFixedDiscardDepot`

---

### `indicators.js` — 138 linhas
**Responsabilidade:** página de indicadores operacionais.

Funções: `renderIndicatorsPage`, `collectInventoryRows`, `getHistoryRowsForIndicators`, `formatCurrencyBr`

---

### `products-page.js` — 519 linhas
**Responsabilidade:** tabela de produtos e formulário de CRUD.

Funções principais:
- `renderProductsPage()` — tabela com colunas reordenáveis
- `openProductForm(idx)` / `saveProductForm()` / `pfDeleteProduct()`
- `renderPageHistory()` — histórico de movimentações com filtros
- `poSort`, `poToggleCol` — controle de colunas da tabela

---

### `drawer-ops.js` — 398 linhas
**Responsabilidade:** operações de gaveta e controles do sidebar.

Funções principais:
- `saveDrawerChanges()` — persiste edições inline na gaveta
- `dndInit(drawerEl, key)` — inicializa drag & drop
- `dndSwapDrawers(srcKey, dstKey)` / `confirmDndMove()` — troca de gaveta
- `setScope`, `toggleChip`, `applyFilters` — filtros do sidebar
- `navigateToDrawer(key, code)` — scroll e foco em gaveta específica

---

### `render.js` — 2.720 linhas
**Responsabilidade:** inicialização do sistema, renderização principal e módulos de UI sem domínio próprio.

Subgrupos internos:
- **Boot:** `init()`, `renderAll()`
- **Recebimento NF-e:** `startReceivingSession`, `closeReceivingSession`, `renderReceivingTable`
- **Grid de prateleiras:** `renderShelfGrid`, `buildDepotShelfBlock`
- **Sidebar de produtos:** `renderProductTable`, `renderFocusPanel`, `selectProduct`
- **Estatísticas:** `renderStats`, `collectDepotMetrics`, `renderDepotSummary`
- **CRUD de prateleiras:** `addShelf`, `removeShelf`, `saveEditShelf`
- **Modal de gaveta:** `openDrawerModal`, `renderDrawerProducts`, `addProductToDrawer`
- **QR Code:** `renderQrPage`, `startQrScanner`, `submitQrEntry`, `renderQrGenerator`
- **Qualidade (move):** `openQualityMoveModal`, `executeQualityMove`
- **Move mode:** `openMoveModal`, `applyMoveHighlights`, `executeMoveConfirmed`

> **Nota:** `render.js` é o maior módulo e candidato à próxima divisão. Prioridades: extrair `receiving.js` e `qr.js`.

---

### `settings.js` — 458 linhas
**Responsabilidade:** configurações, importação e exportação de dados.

Funções principais:
- `confirmImport()` / `previewImport()` — importação CSV de produtos
- `exportProductsCSV()`, `exportShelvesCSV()`, `exportSummaryCSV()`, `exportFullJSON()`
- `importProductsCsv()` / `exportProductsCsv()` — via API backend
- `clearAllData()` — limpa todo o estado local
- `downloadAdminBackup()` — backup completo via backend

---

## Dependências entre módulos

```
utils.js        ← base, sem dependências
state.js        ← usa: utils.js
depot.js        ← usa: state.js, utils.js
history.js      ← usa: state.js, utils.js
ui-core.js      ← usa: state.js, utils.js, history.js
floorplan.js    ← usa: state.js, utils.js
navigation.js   ← usa: state.js, utils.js, ui-core.js
blind-count.js  ← usa: state.js, utils.js, history.js
shipping.js     ← usa: state.js, utils.js, history.js, blind-count.js (parcial)
indicators.js   ← usa: state.js, utils.js, history.js
products-page.js← usa: state.js, utils.js, history.js, ui-core.js
drawer-ops.js   ← usa: state.js, utils.js
render.js       ← usa: todos os anteriores
settings.js     ← usa: state.js, utils.js
```

> A ordem dos `<script>` no `index.html` respeita esse grafo de dependências.

---

## Como adicionar um novo módulo

1. Crie `frontend/static/js/modules/nome-do-modulo.js`
2. Adicione o `<script>` no `index.html` **após** todos os módulos dos quais depende
3. Atualize este arquivo (`MODULES.md`) com as funções e responsabilidades
4. Siga as convenções em `CONVENTIONS.md`
5. `app.js` é o arquivo-fonte original mantido como referência — **não edite diretamente**. Os módulos em `modules/` são a versão ativa carregada pelo HTML.
