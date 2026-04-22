# Issues e Correções — WMS

> Registro consolidado de problemas encontrados, status e como foram resolvidos.  
> Novos bugs encontrados devem ser adicionados aqui com status `[ ]` antes de serem corrigidos.

---

## Legenda de status

| Símbolo | Significado |
|---|---|
| `[x]` | Corrigido e entregue |
| `[~]` | Parcialmente resolvido / mitigado |
| `[ ]` | Pendente |

---

## Segurança

| # | Severidade | Problema | Status | Como foi resolvido |
|---|---|---|---|---|
| S-01 | 🔴 Grave | XSS via `innerHTML` sem sanitização consistente — `row.code` inserido diretamente em `<pre>` nos previews NF-e/CSV | `[x]` | Corrigido em `blind-count.js` L4317 e L5169: `${row.code}` → `${escapeHtml(row.code)}`. Valor de `<option>` no QR: `${item.code}` → `${escapeAttr(item.code)}`. |
| S-02 | 🔴 Grave | Lógica de autorização apenas no frontend — `hasPermission()` lê `sessionStorage`, qualquer usuário pode se auto-elevar via console | `[~]` | Backend já valida via `deps.ensure_permission()` e `_ensure_inventory_permission()` em todos os PUTs sensíveis. Frontend continua como conveniência visual, não como barreira de segurança. |
| S-03 | 🔴 Grave | Dados sensíveis (role, permissions, username) serializados inteiros no `sessionStorage` | `[ ]` | Pendente — idealmente armazenar só token opaco e buscar perfil via endpoint autenticado. |
| S-04 | 🔴 Grave | Script QR code de CDN externo (`qrcode.min.js`) sem atributo `integrity` (SRI) | `[ ]` | Pendente — gerar hash SHA-384 e adicionar `integrity="sha384-..." crossorigin="anonymous"`. Avaliar hospedar localmente. |

---

## JavaScript

| # | Severidade | Problema | Status | Como foi resolvido |
|---|---|---|---|---|
| J-01 | 🔴 Grave | Colisão de nome: `let history` sobrescrevia `window.history` (API de navegação do browser) | `[x]` | Já renomeado para `auditHistory` em versão anterior do projeto. |
| J-02 | 🟡 Médio | `deepClone` usava `JSON.parse(JSON.stringify())` — perdia `undefined`, `Date`, referências circulares | `[x]` | Substituído por `structuredClone()` nativo. |
| J-03 | 🔴 Grave | Estado global massivo exposto no escopo global (12.000+ linhas num único arquivo) | `[x]` | `app.js` dividido em 14 módulos em `frontend/static/js/modules/`. Ver `MODULES.md`. |
| J-04 | 🔴 Grave | Código de demo/seed (`buildFrontendDemoSeedData`, helpers, `auditHistory` hardcoded) dentro do `app.js` de produção | `[x]` | 558 linhas removidas. Sistema depende exclusivamente do banco de dados. |
| J-05 | 🟡 Médio | Sincronização sem controle robusto de concorrência — debounce de 250ms podia descartar saves intermediários | `[~]` | Backend usa UPDATE atômico com WHERE na versão + controle de revisão (`expected_revision`). Cliente ainda usa debounce simples. Fila robusta pendente (ver ROADMAP). |
| J-06 | 🟢 Melhoria | Ausência de TypeScript ou JSDoc — shapes de dados sem tipagem | `[ ]` | Pendente — adicionar `@typedef` JSDoc nas funções principais como primeiro passo. |
| J-07 | 🟢 Melhoria | Ausência de testes automatizados para lógica de capacidade e validações críticas | `[ ]` | Pendente — `validateDrawerPlacement()`, `getShelfUsedKg()` são candidatas prioritárias. |

---

## CSS

| # | Severidade | Problema | Status | Como foi resolvido |
|---|---|---|---|---|
| C-01 | 🔴 Grave | Seletor `btn` sem ponto (selecionava elemento HTML inexistente `<btn>`) | `[x]` | Já estava como `.btn` no projeto. Confirmado na auditoria. |
| C-02 | 🟡 Médio | ~189 cores hardcoded fora das variáveis CSS (`#fff0f0`, `#cc2222`, etc.) — não respondiam ao tema | `[x]` | 17 novas variáveis semânticas adicionadas ao `:root` (`--surface-danger`, `--surface-warn`, `--color-code`, etc.). ~40 ocorrências substituídas por variáveis. |
| C-03 | 🟡 Médio | Z-index desordenado — valores como `9998`, `10005` no HTML ignoravam o sistema de variáveis CSS | `[x]` | 16 variáveis de z-index adicionadas (`--z-modal-base` → `--z-modal-top`). 15 z-indexes hardcoded no HTML substituídos por `var(--z-modal-*)`. |
| C-04 | 🟡 Médio | `prefers-reduced-motion` ausente — animações rodavam sem respeitar preferência do usuário | `[x]` | `@media (prefers-reduced-motion: reduce)` adicionado ao final do `app.css`. |
| C-05 | 🟡 Médio | Seletores duplicados — `.shelf-item`, `table.ptable thead th`, `.drawer-prod-list` definidos em dois blocos separados | `[x]` | Propriedades additive fundidas no primeiro bloco; segundo bloco removido. |
| C-06 | 🟢 Melhoria | CSS monolítico de 3.600+ linhas sem separação por módulo | `[ ]` | Pendente — não prioritário enquanto não houver build tool (Vite/esbuild). |

---

## HTML

| # | Severidade | Problema | Status | Como foi resolvido |
|---|---|---|---|---|
| H-01 | 🔴 Grave | Handlers de evento via atributos `on*` (216 ocorrências) — impede CSP estrita e impossibilita testes | `[ ]` | Pendente — migração gradual para `addEventListener` em JS. Alto esforço, baixo risco imediato. |
| H-02 | 🔴 Grave | Ausência de atributos ARIA em modais, abas e navegação | `[~]` | Emojis decorativos na nav-rail já têm `aria-hidden="true"` (16 elementos). Modais, abas e `aria-current` ainda pendentes. |
| H-03 | 🟡 Médio | Estilos inline (`style="..."`) em 253 elementos — ignora variáveis CSS e não responde ao tema | `[ ]` | Pendente — extrair para classes CSS progressivamente. |

---

## Como registrar um novo issue

Adicione uma linha na tabela da categoria correspondente:

```md
| X-NN | 🔴/🟡/🟢 | Descrição do problema | `[ ]` | — |
```

Quando corrigido, atualize o status para `[x]` e preencha a coluna "Como foi resolvido".

---

## Erros de runtime (detectados em console do browser)

| # | Severidade | Problema | Status | Como foi resolvido |
|---|---|---|---|---|
| R-01 | 🔴 Grave | `PUT /api/wms/inventory-state 400` — "Depósito inválido no inventário: dep_discard" | `[x]` | `dep_discard` é um depósito virtual criado pelo frontend para descartes controlados. O backend rejeitava porque o ID não existe na tabela `depots`. Corrigido em `routes_wms.py` (`_validate_products_snapshot_state`): quando `depot_id == "dep_discard"`, injeta um depot sintético com `allowOvercapacity: True` antes da validação, em vez de rejeitar. |
| R-02 | 🔴 Grave | `GET /api/wms/nfe/list 500` e `GET /api/wms/nfe/receiving/sessions 500` | `[x]` | Duas causas independentes: **(a)** `nfe_watcher.py` usava `Observer` como type annotation na linha de módulo (`_observer: Observer | None = None`), mas `Observer` só é importado dentro do `try/except`. Se `watchdog` não estiver instalado, `Observer` não existe e a importação inteira do módulo crashava com `NameError`, derrubando o FastAPI e causando 500 em todas as rotas. Corrigido com `"Observer | None"` (string annotation). **(b)** `_session_summary()` acessava colunas novas (`aprovador_username`, `aprovado_em`, `itens_ok_json`, etc.) diretamente via atributo. Em bancos não migrados (migration `a1b2c3d4e5f6` ausente), isso lançava `OperationalError` → 500. Corrigido com `getattr(session, "coluna", None)` em todos os campos da migration. |
| R-03 | 🟡 Médio | `POST /api/auth/login 400` — credenciais inválidas | `[~]` | Não é bug de código: o backend está correto. A causa é o usuário `admin` criado com senha `"admin"` (5 chars) por uma versão anterior do `initial_data.py`, antes da regra de mínimo de 8 caracteres existir. O script foi corrigido para usar `"Admin@123"`. Em bancos existentes com a senha antiga: redefinir via `python -m backend.ensure_role_users` ou pela interface CONFIG → Usuários. |

