# Convenções de Código — WMS Frontend

> Padrões obrigatórios para manter consistência entre módulos e sessões de desenvolvimento.  
> Ao pedir alterações a um LLM, envie este arquivo junto com o módulo relevante.

---

## Segurança — regras inegociáveis

### innerHTML só com escape
Todo dado de usuário ou banco inserido via `.innerHTML` **deve** passar por `escapeHtml()` ou `escapeAttr()`:

```js
// ✅ correto
el.innerHTML = `<span>${escapeHtml(product.name)}</span>`;
el.innerHTML = `<option value="${escapeAttr(depot.id)}">${escapeHtml(depot.name)}</option>`;

// ❌ proibido
el.innerHTML = `<span>${product.name}</span>`;
el.innerHTML = `<option value="${depot.id}">`;
```

Campos numéricos puros (`.toFixed()`, `.length`, índices) não precisam de escape — não são string de usuário.

### Funções de escape disponíveis
- `escapeHtml(value)` — para conteúdo visível no DOM
- `escapeAttr(value)` — para valores de atributos HTML (`value=""`, `data-*=""`)
- `escapeJs(value)` — para strings dentro de `onclick="..."` (evitar quando possível)
- `sanitizeTextInput(value, { maxLength, uppercase })` — para inputs do usuário antes de salvar

### Dados de texto em `<pre>` também precisam de escape
```js
// ✅
preview.innerHTML = `<pre>${rows.map(r => escapeHtml(r.code)).join('\n')}</pre>`;
```

---

## Estado global

### Onde declarar variáveis globais
**Somente em `state.js`.** Nenhum outro módulo deve declarar variáveis no escopo global.

```js
// ✅ em state.js
let depots = [];
let activeDepotId = null;

// ❌ em qualquer outro módulo
let minhaVariavelGlobal = []; // não fazer
```

### Depois de qualquer mutação de estado, chamar `ensureDepotState()`
```js
depots.push(novoDepot);
ensureDepotState(); // normaliza, valida, atualiza shims
```

### Nunca persistir sem debounce ou controle de concorrência
Use `saveAppState()` (com debounce interno) para persistências reativas.  
Use as funções `persist*State()` para saves intencionais por módulo:
- `persistStructureState()` — depósitos, prateleiras
- `persistInventoryState()` — produtos, histórico
- `persistBlindUnloadsState()` — descargas
- `persistOutboundRecordsState()` — saídas
- `persistFloorplanState()` — planta baixa

---

## CSS

### Sempre usar variáveis CSS — nunca hex hardcoded
```css
/* ✅ */
color: var(--danger);
background: var(--surface-danger);
border-color: var(--warn);

/* ❌ */
color: #cc2222;
background: #fff0f0;
```

### Variáveis semânticas disponíveis (além das base)
```css
--surface-danger      /* fundo vermelho claro */
--surface-warn        /* fundo laranja claro */
--surface-success     /* fundo verde claro */
--surface-info        /* fundo azul claro */
--surface-overlay     /* fundo de overlay escuro */
--color-code          /* azul para códigos de produto */
--color-name-alt      /* verde para nomes alternativos */
--shadow-soft         /* sombra padrão de card */
--z-modal-*           /* escala de z-index para modais */
```

### Z-index via variáveis no HTML
```html
<!-- ✅ -->
<div class="modal-overlay" style="z-index:var(--z-modal-drawer)">

<!-- ❌ -->
<div class="modal-overlay" style="z-index:1010">
```

Escala de z-index definida em `:root`:
```
--z-modal-base:     999   (fp-shelf-modal)
--z-modal-drawer:   1010  (drawer-modal)
--z-modal-dnd:      1012  (dnd-move-modal)
--z-modal-form:     1020  (product-form-modal)
--z-modal-detail:   1022  (prod-detail-modal)
--z-modal-depot:    1025  (depot-modal)
--z-modal-date:     1030  (date-edit-modal)
--z-modal-quality:  1035  (quality-move-modal, entity-qr-modal)
--z-modal-blind:    1040  (blind-pool-modal, shipping-add-modal)
--z-modal-allocate: 1041  (blind-allocate-modal)
--z-modal-finalize: 1045  (shipping-finalize-modal)
--z-modal-outbound: 1046  (outbound-edit-modal)
--z-modal-move:     1050  (move-confirm-modal)
--z-tooltip:        1100  (drawer-tooltip)
--z-fp-preview:     1150  (fp-place-preview)
--z-modal-top:      1200  (text-input-modal, confirm-overlay)
--z-toast:          1300  (app-toast)
--z-drag-ghost:     1400
```

### Não duplicar seletores entre blocos de CSS
Antes de criar uma regra nova, verificar se o seletor já existe. Se existe, adicionar a propriedade no bloco existente.

---

## Funções de render

### Padrão de nomenclatura
```
render*Page()      — renderiza uma página inteira
render*()          — renderiza um componente/seção
build*Html()       — retorna string HTML (sem efeito colateral no DOM)
open*Modal()       — abre modal específico
close*Modal()      — fecha modal específico
get*(...)          — leitura de estado, sem mutação
collect*(...)      — agrega dados de múltiplas fontes
```

### Funções `build*Html()` nunca tocam o DOM
```js
// ✅ retorna string, quem chama faz o innerHTML
function buildBlindRecordItemCards(items) {
  return items.map(item => `<div>...</div>`).join('');
}
el.innerHTML = buildBlindRecordItemCards(items);

// ❌ função build* não deve fazer innerHTML internamente
function buildBlindRecordItemCards(items) {
  document.getElementById('list').innerHTML = ...; // não fazer
}
```

---

## Acessibilidade

### Emojis decorativos sempre com `aria-hidden="true"`
```html
<!-- ✅ -->
<span aria-hidden="true">🏭</span>

<!-- ❌ -->
<span>🏭</span>
```

### Botões com ação devem ter label descritivo
```html
<!-- ✅ -->
<button aria-label="Fechar modal de gaveta">✕</button>

<!-- ❌ -->
<button>✕</button>
```

---

## Módulos

### Um módulo = uma responsabilidade
Se um módulo ultrapassa ~1.500 linhas, considerar divisão. Candidato atual: `render.js` (2.720 linhas) → extrair `receiving.js` e `qr.js`.

### Estrutura interna de um módulo
```js
// ═══════════════════════════════════════════════════════════
// MODULE: nome-do-modulo.js
// Responsabilidade: descrição em uma linha
// ═══════════════════════════════════════════════════════════

// ── Estado local (se necessário) ──────────────────────────
let estadoLocal = null;

// ── Helpers privados ───────────────────────────────────────
function _helperInterno() { ... }

// ── Funções públicas ───────────────────────────────────────
function funcaoPublica() { ... }
```

### Ao criar um novo módulo
1. Criar o arquivo em `frontend/static/js/modules/`
2. Adicionar `<script>` no `index.html` na posição correta de dependência
3. Atualizar `docs/MODULES.md` com as funções e o de-para
4. `app.js` é o arquivo-fonte original mantido como referência histórica — **não edite diretamente**. Os módulos em `modules/` são a versão ativa.

---

## Backend (Python/FastAPI)

### Permissões sempre validadas no backend
O frontend esconde botões por role, mas **toda** rota sensível chama `deps.ensure_permission()` ou `_ensure_inventory_permission()`. Nunca confiar só no frontend.

```python
# ✅
@router.post("/products")
async def create_product(
    current_user: User = Depends(deps.get_current_active_user),
):
    deps.ensure_permission(current_user, "product.manage")
    ...
```

### Migrations sempre via Alembic
Nunca alterar o banco diretamente. Criar migration:
```bash
alembic revision --autogenerate -m "descricao_da_mudanca"
alembic upgrade head
```

### Configuração via `.env`
Nunca hardcodar URLs, chaves ou caminhos no código Python. Tudo via `settings.*` (pydantic-settings).
