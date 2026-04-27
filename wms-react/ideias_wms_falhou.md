# Ideias e Lógicas do Backend (WMS que falhou)

| Ideia | Arquivo | Linhas |
|-------|---------|--------|
| **Consolidação de Estoque**: Adição de quantidade ao StockItem existente se produto, gaveta, lote e status coincidirem. | `backend/app/services/inventory_service.py` | 25-48 |
| **Movimentação de Estoque**: Validação de status 'AVAILABLE' e saldo suficiente antes de transferir entre gavetas. | `backend/app/services/inventory_service.py` | 74-110 |
| **Sugestão de Picking FEFO**: Ordenação de itens por data de validade (First Expired, First Out) para sugestão de retirada. | `backend/app/services/separation_service.py` | 27-58 |
| **Reserva de Estoque**: Divisão (split) de StockItem para reserva parcial ou total durante o processo de separação. | `backend/app/services/separation_service.py` | 67-101 |
| **Cálculo de Status de Validade**: Classificação em 'expired', 'expiring' (30 dias) ou 'ok' baseada na data atual. | `backend/app/services/quality_service.py` | 8-16 |
| **Controle de Qualidade (Quarentena)**: Bloqueio ou envio para quarentena baseado no tipo de prateleira (shelf_type). | `backend/app/services/quality_service.py` | 18-45 |
| **Relatório de Divergência**: Comparação entre quantidade esperada (NF-e) e contada, gerando status de 'FALTA' ou 'SOBRA'. | `backend/app/services/receiving_service.py` | 55-93 |
| **Validações Pydantic**: Uso de `Field(gt=0)` para garantir quantidades positivas em operações de alocação e movimentação. | `backend/app/schemas/inventory.py` | 12-25 |
| **Inclusão Modular de Rotas**: Organização do FastAPI usando `app.include_router` para separar domínios (inventory, audit, receiving). | `backend/app/main.py` | 60-70 |
| **Sessão de Recebimento via NF-e**: Criação automática de itens esperados a partir de dados estruturados de uma nota fiscal. | `backend/app/services/receiving_service.py` | 10-47 |

