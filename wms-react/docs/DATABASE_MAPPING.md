# Mapeamento de Banco de Dados (WMS)

Este documento mapeia o estado em memória (Zustand/Legacy JS) para um esquema de Banco de Dados Relacional (SQL - PostgreSQL/SQLite).

## Tabelas Principais (Entidades)

### 1. `users` (Usuários do Sistema)
- `id` (UUID, PK)
- `name` (String)
- `email` (String, Unique)
- `role` (Enum: 'admin', 'operator', 'viewer')
- `password_hash` (String)
- `created_at` (Timestamp)

### 2. `depots` (Depósitos)
- `id` (UUID, PK) - *No legado: 'dep1'*
- `name` (String)
- `address` (String, Nullable)
- `manager_id` (UUID, FK -> users.id, Nullable)
- `created_at` (Timestamp)

### 3. `shelves` (Prateleiras)
- `id` (UUID, PK)
- `depot_id` (UUID, FK -> depots.id)
- `code` (String) - *No legado: 'A', 'B'*
- `floors` (Integer)
- `drawers` (Integer)
- `max_kg` (Decimal)

### 4. `products` (Catálogo de Produtos - SKU)
- `code` (String, PK) - *ex: 'P001'*
- `name` (String)
- `kg` (Decimal) - *Peso unitário*
- `unit` (Enum: 'un', 'cx', 'kg', 'lt', 'mt', 'pc', 'pr')
- `category` (String, Nullable)

### 5. `inventory` (Estoque Físico / Gavetas)
- `id` (UUID, PK)
- `depot_id` (UUID, FK -> depots.id)
- `shelf_id` (UUID, FK -> shelves.id)
- `floor` (Integer)
- `drawer` (Integer)
- `product_code` (String, FK -> products.code)
- `qty` (Decimal)
- `expiry_date` (Date, Nullable) - *Trata as múltiplas datas do legado separando em lotes físicos*
- `lot_code` (String, Nullable)
- `entry_date` (Date)

### 6. `floorplan_objects` (Planta Baixa)
- `id` (UUID, PK)
- `depot_id` (UUID, FK -> depots.id)
- `type` (Enum: 'shelf', 'wall', 'area', 'text')
- `reference_id` (UUID, FK -> shelves.id, Nullable) - *Link visual com a prateleira real*
- `x` (Integer)
- `y` (Integer)
- `width` (Integer)
- `height` (Integer)
- `rotation` (Integer, Default 0)
- `label` (String, Nullable)
- `color` (String, Nullable)

### 7. `movement_history` (Histórico de Auditoria)
- `id` (UUID, PK)
- `depot_id` (UUID, FK -> depots.id)
- `user_id` (UUID, FK -> users.id)
- `action_type` (Enum: 'entry', 'exit', 'move', 'adjustment')
- `product_code` (String, FK -> products.code)
- `from_location` (String, Nullable) - *ex: 'B2.G1'*
- `to_location` (String, Nullable) - *ex: 'A1.G2'*
- `qty` (Decimal)
- `timestamp` (Timestamp)
- `notes` (Text, Nullable)

---
**Nota Arquitetural:** 
No legado (HTML monolítico), os lotes de validade (`expiries`) eram um array de strings dentro do produto. No banco relacional, a tabela `inventory` resolve isso tratando cada data de validade/lote diferente como uma linha única na gaveta, permitindo rastreabilidade perfeita e cumprimento de normas fiscais (FIFO/FEFO).

