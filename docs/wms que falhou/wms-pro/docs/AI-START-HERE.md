# AI-START-HERE — WMS Pro

> Você acabou de receber acesso a este projeto.
> **Não escreva uma linha de código antes de terminar este arquivo.**
> Ele é curto. Vai te poupar muito mais tempo do que leva para ler.

---

## O que é este projeto

**WMS Pro** — sistema de gestão de armazém (Warehouse Management System).

```
backend/    → Python 3.12, FastAPI, SQLAlchemy async, Alembic
frontend/   → HTML/Jinja2, CSS (app.css), JS (14 módulos em static/js/modules/)
docs/       → toda a documentação — você está aqui
```

Stack resumida: JWT auth · SQLite (padrão) ou PostgreSQL · PWA + service worker · IndexedDB para fila offline.

---

## Leitura obrigatória — nesta ordem

| # | Arquivo | Quando é indispensável |
|:---:|---|---|
| 1 | [`MODULES.md`](./MODULES.md) | Qualquer mudança no frontend — onde fica cada função |
| 2 | [`CONVENTIONS.md`](./CONVENTIONS.md) | Qualquer escrita de código — segurança, CSS, estado, nomes |
| 3 | [`ISSUES_AND_FIXES.md`](./ISSUES_AND_FIXES.md) | Antes de corrigir bug ou tocar área problemática conhecida |
| 4 | [`ROADMAP.md`](./ROADMAP.md) | Ao planejar feature nova ou retomar desenvolvimento |

Se a tarefa envolver **backend**: leia também
[`07-api/rotas-http.md`](./07-api/rotas-http.md) e
[`08-modelo-de-dados/entidades.md`](./08-modelo-de-dados/entidades.md).

Se a tarefa envolver **regras de negócio**: leia o processo em
[`processos/`](./processos/).

---

## Fluxo por tipo de tarefa

### Alterar funcionalidade existente
1. `MODULES.md` → identifique o módulo JS correto
2. Solicite **só esse módulo** — nunca `app.js` inteiro
3. `CONVENTIONS.md` → aplique os padrões antes de escrever
4. Ao terminar → atualize `MODULES.md` se funções mudaram

### Corrigir um bug
1. `ISSUES_AND_FIXES.md` → verifique se já está registrado
2. Se não está: adicione com `[ ]` antes de corrigir
3. Ao terminar → atualize para `[x]` e documente a solução na mesma linha

### Criar feature nova
1. `ROADMAP.md` → verifique se está planejado e em qual prioridade
2. `CONVENTIONS.md` → siga estrutura e padrões de módulo
3. Se criar novo módulo JS → execute o **checklist abaixo**
4. Ao terminar → execute o **checklist de documentação pós-mudança**

---

## Checklist: criar um novo módulo JS

**Antes de criar o arquivo:**
- [ ] O módulo tem responsabilidade única, nomeável em uma linha?
- [ ] As funções não pertencem melhor a um módulo existente?
- [ ] Você sabe onde ele entra na ordem de dependência do `index.html`?

**Ao criar:**
- [ ] Arquivo em `frontend/static/js/modules/nome-do-modulo.js`
- [ ] Header padrão no topo (ver `CONVENTIONS.md > Módulos > Estrutura interna`)
- [ ] Nenhuma variável global declarada fora de `state.js`
- [ ] Todo `innerHTML` com dado de usuário passa por `escapeHtml()` ou `escapeAttr()`

**Ao finalizar — documentar obrigatoriamente:**
- [ ] `MODULES.md` → seção com nome, linhas, responsabilidade, funções e dependências
- [ ] `MODULES.md` → linha(s) na tabela de-para (tarefa → arquivo)
- [ ] `MODULES.md` → grafo de dependências no final do arquivo
- [ ] `frontend/templates/index.html` → `<script>` na posição correta
- [ ] `ROADMAP.md` → marcar item como entregue se era planejado

---

## Checklist: documentação pós-mudança (regra permanente)

Toda vez que algo mudar, atualizar os docs correspondentes:

| O que mudou | Arquivos a atualizar |
|---|---|
| Módulo JS criado / dividido / renomeado / removido | `MODULES.md`, `index.html`, `ROADMAP.md` |
| Rota de API adicionada ou alterada | `07-api/rotas-http.md`, `07-api/contratos.md` |
| Entidade criada via migration | `08-modelo-de-dados/entidades.md`, `campos.md`, `relacionamentos.md` |
| Regra de negócio alterada | `processos/<fluxo>.md`, `05-funcionalidades/regras-de-negocio.md` |
| Bug corrigido | `ISSUES_AND_FIXES.md` → status `[x]` + descrição |
| Bug novo encontrado | `ISSUES_AND_FIXES.md` → linha nova com `[ ]` |
| Feature entregue | `ROADMAP.md` → mover para seção entregue ou remover |

**A documentação descreve o estado atual do código.
O futuro fica em `ROADMAP.md`. Nunca documente o que não existe ainda.**

---

## Regra de revisão — aplicar no início de qualquer sessão substancial

Antes de começar trabalho de maior porte, execute esta verificação rápida:

### 1. MODULES.md bate com o código?
- As funções documentadas existem nos módulos?
- Os módulos documentados estão no `index.html`?
- Se divergir: corrigir `MODULES.md` antes de qualquer outra coisa.

### 2. CONVENTIONS.md bate com o código?
Amostragem rápida:
- `deepClone` usa `structuredClone`? (não `JSON.parse/stringify`)
- Variáveis de estado estão em `state.js` e não espalhadas?
- CSS usa `var(--surface-danger)` e não `#fff0f0`?
- `index.html` não tem `z-index` numérico hardcoded?
- Se divergir: ou o código está errado (registrar em `ISSUES_AND_FIXES.md`), ou a convenção mudou (atualizar `CONVENTIONS.md`).

### 3. Rotas e entidades batem com o backend?
- `07-api/rotas-http.md` lista as rotas que existem em `routes_auth.py`, `routes_wms.py` e `routes_receiving.py`?
- `08-modelo-de-dados/entidades.md` lista apenas entidades reais dos models, não tabelas de sistema?
- Se divergir: atualizar os docs para refletir a realidade — nunca o inverso.

---

## Módulos JS — referência rápida

```
[carregados antes dos módulos]
api.js            → chamadas HTTP, health-check, fila offline (IndexedDB)
auth.js           → login, logout, token JWT, sessionStorage

[módulos em static/js/modules/ — ordem de dependência]
utils.js          → escapeHtml/Attr/Js, DOM helpers, confirm/toast, som, permissões, capacidade
state.js          → depots[], shelvesAll, productsAll — estado global e persistência
depot.js          → CRUD de depósitos, tabs de navegação entre depósitos
history.js        → logHistory, renderHistory, validade, alertas de vencimento
ui-core.js        → openProductDetail, tooltip gaveta, bindStaticUiControls, saveDepotModal
floorplan.js      → planta baixa completa: zoom, snap, seleção, lasso, align, render
navigation.js     → showPage, applyRolePermissions, CRUD usuários, página de qualidade
blind-count.js    → conferência cega, pool de itens, descargas, aprovação/rejeição
shipping.js       → carrinho saída, FEFO, separação, finalização, registros de saída, descarte
indicators.js     → renderIndicatorsPage, KPIs operacionais, collectInventoryRows
products-page.js  → tabela de produtos, formulário CRUD, histórico de movimentações
drawer-ops.js     → saveDrawerChanges, drag&drop, move mode, filtros do sidebar
render.js         → init(), renderAll(), recebimento NF-e, QR, grid prateleiras, modal gaveta
settings.js       → importação CSV/JSON, exportação, backup local, clearAllData
```

**Detalhe completo com de-para e dependências:** [`MODULES.md`](./MODULES.md)

---

## Pendências críticas

| ID | Problema | Status |
|---|---|---|
| S-03 | `sessionStorage` expõe role/permissions completos | `[ ]` 🔴 |
| S-04 | Script QR de CDN sem hash SRI | `[ ]` 🔴 |
| H-01 | 216 handlers `on*` inline no HTML — impede CSP estrita | `[ ]` 🔴 |
| H-02 | ARIA incompleto em modais e abas | `[ ]` 🟡 |

**Lista completa:** [`ISSUES_AND_FIXES.md`](./ISSUES_AND_FIXES.md)

---

## Próximas tarefas (topo do roadmap)

1. Dividir `render.js` (2.720 linhas) → `receiving.js` + `qr.js`
2. Validações de negócio no backend por operação
3. Persistência atômica por item na conferência cega
4. Revisão de navegação por teclado e ARIA

**Roadmap completo:** [`ROADMAP.md`](./ROADMAP.md)
