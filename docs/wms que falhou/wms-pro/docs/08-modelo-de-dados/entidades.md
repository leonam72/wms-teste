# Entidades

## Objetivo

Listar as entidades de domínio persistidas no banco, derivadas dos models em `backend/app/models/`.

---

## Entidades de domínio

Entidades definidas nos models do projeto:

- `users` — usuários autenticados com role e controle de login
- `depots` — depósitos físicos
- `shelves` — prateleiras dentro de um depósito
- `drawers` — gavetas dentro de uma prateleira
- `products` — cadastro de produtos
- `stock_items` — itens de estoque por gaveta (produto + localização + lote + peso)
- `expiries` — validades associadas a um stock_item
- `inventory_movements` — trilha de movimentações operacionais
- `stock_quality_states` — estado de qualidade de um item (quarentena / bloqueado)
- `quality_summaries` — agregados de qualidade por depósito
- `floorplan_shelves` — posições das prateleiras na planta baixa
- `floorplan_objects` — objetos livres na planta (zonas, bloqueios, ruas)
- `audit_logs` — log de auditoria de operações sensíveis
- `sync_state` — controle de versão/revisão do estado global
- `wms_state_snapshots` — snapshot serializado do estado do WMS
- `sync_queue` — fila de operações pendentes para sincronização com PostgreSQL
- `blind_count_pool_items` — itens da pool de conferência cega

### Separação

- `romaneio_separacao` — cabeçalho de um romaneio (pedido de separação)
- `itens_separacao` — itens individuais de um romaneio com produto, quantidade e endereço
- `rotas_separacao` — rota FEFO gerada para execução do romaneio
- `tarefas_separador` — tarefas atribuídas a separadores para execução
- `locks_separador` — locks de concorrência por separador ativo
- `historico_separacao` — histórico de etapas concluídas de um romaneio
- `divergencias_separacao` — divergências reportadas durante a separação

---

## Tabelas de sistema (não são entidades do domínio)

- `alembic_version` — controle interno de migrações (gerenciado pelo Alembic, não pelos models)

---

## Observações

- Todas as entidades de domínio usam `Base` de `backend/app/models/base_class.py`.
- `sync_queue` e `sync_state` existem para suportar futura sincronização com PostgreSQL remoto — o fluxo ainda está incompleto.
- Para campos detalhados de cada entidade, ver [`campos.md`](./campos.md).
- Para relacionamentos entre entidades, ver [`relacionamentos.md`](./relacionamentos.md).
