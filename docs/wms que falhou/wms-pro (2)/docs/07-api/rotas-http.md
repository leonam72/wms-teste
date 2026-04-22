# Rotas HTTP

## Objetivo

Documentar todas as rotas HTTP da aplicação, derivadas diretamente do código em
`backend/app/api/routes_auth.py`, `routes_wms.py` e `routes_receiving.py`.

---

## Autenticação — prefixo `/api/auth`

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/login` | Login OAuth2 Password Flow — retorna token JWT. Rate limiting por IP/usuário. |
| `GET` | `/api/auth/me` | Retorna dados do usuário autenticado |
| `POST` | `/api/auth/change-password` | Altera a própria senha |
| `GET` | `/api/auth/users` | Lista usuários (requer permissão de gestão) |
| `POST` | `/api/auth/users` | Cria usuário |
| `PATCH` | `/api/auth/users/{user_id}` | Atualiza role ou status de um usuário |
| `POST` | `/api/auth/users/{user_id}/reset-password` | Redefine senha de usuário |
| `DELETE` | `/api/auth/users/{user_id}` | Remove usuário |

---

## WMS — Estado e estrutura — prefixo `/api/wms`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/wms/bootstrap` | Estado inicial completo para montar a interface |
| `GET` | `/api/wms/meta` | Metadados de revisão para polling de concorrência |
| `PUT` | `/api/wms/state` | Substituição de snapshot global (legado — preferir endpoints incrementais) |
| `GET` | `/api/wms/structure-state` | Depósitos, prateleiras e depósito ativo |
| `PUT` | `/api/wms/structure-state` | Persiste estrutura incrementalmente |
| `GET` | `/api/wms/inventory-state` | Produtos por gaveta e histórico operacional |
| `PUT` | `/api/wms/inventory-state` | Persiste inventário com validação de capacidade |
| `GET` | `/api/wms/unloads-state` | Descargas e pool de conferência |
| `PUT` | `/api/wms/unloads-state` | Persiste descargas |
| `GET` | `/api/wms/outbound-records-state` | Registros de saída |
| `PUT` | `/api/wms/outbound-records-state` | Persiste registros de saída |
| `GET` | `/api/wms/floorplan-state` | Layout e objetos da planta baixa |
| `PUT` | `/api/wms/floorplan-state` | Persiste planta baixa |

---

## WMS — Leituras operacionais — prefixo `/api/wms`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/wms/depots` | Lista depósitos persistidos no banco |
| `GET` | `/api/wms/shelves` | Lista prateleiras (filtráveis por depósito) |
| `GET` | `/api/wms/drawers` | Lista gavetas (filtráveis por depósito) |
| `GET` | `/api/wms/movements` | Lista movimentações para auditoria |

---

## WMS — Produtos — prefixo `/api/wms`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/wms/products` | Lista produtos do cadastro |
| `POST` | `/api/wms/products` | Cria produto (requer `product.manage`) |
| `PUT` | `/api/wms/products/{product_id}` | Edita produto (requer `product.manage`) |
| `DELETE` | `/api/wms/products/{product_id}` | Remove produto sem estoque vinculado |
| `GET` | `/api/wms/products/export/csv` | Exporta cadastro para CSV |
| `POST` | `/api/wms/products/import/csv` | Importa produtos de CSV |

---

## WMS — Qualidade — prefixo `/api/wms`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/wms/quality/states` | Estados de validade, bloqueio e quarentena por item |
| `GET` | `/api/wms/quality/summary` | Indicadores agregados de qualidade por depósito |

---

## WMS — Separação — prefixo `/api/wms`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/wms/separation/products` | Autocomplete de produtos para romaneio |
| `GET` | `/api/wms/separation/requests` | Lista romaneios recentes |
| `POST` | `/api/wms/separation/requests` | Cria romaneio, gera rota FEFO, publica tarefas |

---

## WMS — Recebimento NF-e — prefixo `/api/wms`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/wms/nfe/list` | Lista XMLs de NF-e disponíveis no diretório configurado |
| `GET` | `/api/wms/nfe/{chave_acesso}` | Detalha NF-e para conferência (sem quantidades — blind) |
| `GET` | `/api/wms/nfe/receiving/sessions` | Lista sessões de recebimento em andamento |
| `GET` | `/api/wms/nfe/receiving/pending-approval` | Lista conferências aguardando aprovação (supervisor+) |
| `POST` | `/api/wms/nfe/receiving/start` | Inicia sessão de conferência |
| `POST` | `/api/wms/nfe/receiving/close` | Fecha conferência → status `pending_review` (não persiste no estoque) |
| `POST` | `/api/wms/nfe/receiving/{session_id}/approve` | Supervisor aprova → itens aplicados ao estoque |
| `POST` | `/api/wms/nfe/receiving/{session_id}/reject` | Supervisor reprova → volta para reconferência |

---

## Frontend / Sistema — raiz

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Entrega `index.html` (interface principal) |
| `GET` | `/login` | Entrega `login.html` |
| `GET` | `/separador` | Interface isolada do separador |
| `GET` | `/separador/login` | Login do separador |
| `GET` | `/service-worker.js` | Service worker PWA |
| `GET, HEAD` | `/favicon.ico` | Ícone |
| `GET` | `/api/health` | Health check — retorna `{"status": "ok"}` |

---

## Observações

- Toda rota sensível valida o token JWT via `deps.get_current_active_user`.
- Permissões específicas são verificadas via `deps.ensure_permission(current_user, "permissao.nome")`.
- Rotas de estado usam controle de revisão otimista (`expected_revision`) para prevenir sobrescrita concorrente.
- O backup é feito localmente no frontend — não há endpoint de backup no backend.
