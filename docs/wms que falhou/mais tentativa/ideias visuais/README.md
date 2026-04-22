# VisualWMS Frontend

Frontend operacional em React + TypeScript + Tailwind para o sistema VisualWMS.

## Etapa 1. Arquitetura

### Modulos

- `auth`: login, perfis e contexto de sessao
- `overview`: KPIs, alertas, ocupacao, giro e saude operacional
- `map`: mapa 2D, busca inteligente, pilhas de paletes, quick actions e drawer lateral
- `layout-editor`: edicao protegida por senha, undo/redo/save/cancel, mini mapa e geracao de bins
- `products`: CRUD visual, filtros, status de validade e rastreabilidade resumida
- `docks`: inbound/outbound, fila, agendamentos e timer de doca
- `receiving`: recebimento documental, checklist, avarias e lotes
- `blind-count`: conferencia cega com cronometro e divergencias
- `validation`: aprovacao, recontagem, rejeicao parcial/total e justificativas
- `audit`: timeline, filtros e visao de antes/depois
- `security`: usuarios, perfis, bloqueio e redefinicao de senha
- `analytics`: produtividade, ocupacao, divergencias e mapa de calor
- `settings`: regras operacionais e preferencias

### Rotas

- `/login`
- `/overview`
- `/map`
- `/layout-editor`
- `/products`
- `/docks`
- `/receiving`
- `/blind-count`
- `/validation`
- `/audit`
- `/security`
- `/analytics`
- `/settings`

### Estrutura de pastas

- `src/app`: bootstrap, router e shell principal
- `src/components`: layout e componentes reutilizaveis
- `src/context`: store global com mocks e acoes
- `src/data`: massa mockada consistente entre modulos
- `src/pages`: telas funcionais
- `src/types`: entidades TypeScript

### Estado e permissoes

- `AppContext` centraliza sessao, warehouse atual, busca global, toasts, dados mockados e acoes
- Permissoes por `role` controlam botoes de seguranca, layout editor e configuracoes
- O editor exige senha operacional adicional antes de liberar edicoes estruturais

### Responsividade e drag and drop

- Layout mobile-first com sidebar recolhivel por contexto de viewport
- Grid e tabelas quebram em cards compactos quando necessario
- Drag and drop via HTML5 para paletes, bins do editor e fila/docas

## Etapa 2. Componentes reutilizaveis

- `Button`, `Card`, `Badge`, `Input`, `Select`, `Toggle`
- `Modal`, `Drawer`, `ToastViewport`
- `SectionHeader`, `StatCard`, `EmptyState`, `DataTable`
- `Sidebar`, `Topbar`, `Shell`
- `WarehouseMap`, `BinCard`, `PalletChip`, `DockLane`, `MetricPanel`

## Etapa 3. Entidades principais

- `User`, `Role`, `Warehouse`, `Zone`, `Bin`, `Pallet`, `Product`
- `Dock`, `Shipment`, `ReceivingSession`, `BlindCountSession`
- `ValidationCase`, `AuditLog`, `SystemSettings`, `NotificationItem`

## Credenciais mockadas

- Administrador: `admin` / `Admin@123`
- Gestor: `gestor` / `Gestor@123`
- Operador: `operador` / `Operador@123`
- Conferente: `conferente` / `Conferente@123`
- Auditor: `auditor` / `Auditor@123`

Senha adicional do editor de planta: `layout123`

## Documentacao adicional

- Visao tecnica e funcional completa: [docs/visualwms-documentacao.md](/home/leonamramosfoli/Downloads/stitch/stitch/docs/visualwms-documentacao.md)
- Credenciais e acessos: [docs/credenciais-e-acessos.md](/home/leonamramosfoli/Downloads/stitch/stitch/docs/credenciais-e-acessos.md)
