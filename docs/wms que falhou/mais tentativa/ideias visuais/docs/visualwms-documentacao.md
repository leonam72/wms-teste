# VisualWMS

Documentacao funcional e tecnica do frontend entregue em React + TypeScript + Tailwind.

## 1. Visao geral

O projeto representa um frontend operacional de WMS com foco em:

- operacao rapida de armazem
- visualizacao 2D do layout
- gestao de bins, paletes e produtos
- fluxo de recebimento com conferencia cega
- validacao antes da entrada em estoque real
- auditoria e seguranca
- analytics e overview gerencial

O sistema foi construido para funcionar hoje com dados mockados consistentes e ficar pronto para integracao futura com backend, autenticacao real e APIs transacionais.

## 2. Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- React Router
- Recharts
- Lucide React

## 3. Estrutura do projeto

```text
src/
  app/
    App.tsx
  components/
    layout/
      AppShell.tsx
    ui.tsx
  context/
    AppContext.tsx
  data/
    mockData.ts
  pages/
    AnalyticsPage.tsx
    AuditPage.tsx
    BlindCountPage.tsx
    DocksPage.tsx
    LayoutEditorPage.tsx
    LoginPage.tsx
    MapPage.tsx
    OverviewPage.tsx
    ProductsPage.tsx
    ReceivingPage.tsx
    SecurityPage.tsx
    SettingsPage.tsx
    ValidationPage.tsx
    helpers.ts
  types/
    wms.ts
```

## 4. Arquitetura de frontend

### 4.1 Modulos

- `auth`
  Responsavel por login mockado, selecao de perfil e sessao.
- `shell`
  Sidebar, topbar, seletor de armazem, busca global e navegacao.
- `overview`
  KPIs executivos, ocupacao, giro e alertas.
- `map`
  Mapa 2D, bins, pilhas de paletes, drawer de detalhes e busca inteligente.
- `layout-editor`
  Edicao protegida por senha com undo, redo, save e cancel.
- `products`
  Catalogo com filtros, localizacoes, validade e historico resumido.
- `docks`
  Gestão de fila, docas, timers e movimentacao por drag and drop.
- `receiving`
  Checklist documental, lotes, validade, avarias e fotos.
- `blind-count`
  Conferencia sem exibir o esperado, com cronometro e divergencias.
- `validation`
  Aprovacao, recontagem ou rejeicao com justificativa.
- `audit`
  Linha do tempo de eventos com filtros.
- `security`
  Usuarios, perfis, bloqueio e redefinicao de senha.
- `analytics`
  Produtividade, hotspots e leitura gerencial.
- `settings`
  Parametros operacionais e preferencias visuais.

### 4.2 Rotas

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

### 4.3 Estrategia de estado

O estado global esta centralizado em `AppContext`, que concentra:

- usuario atual
- armazem atual
- busca global
- modo da interface: `operacao` ou `gestao`
- dados mockados de todas as entidades
- toasts
- rascunho do editor de layout
- historico e futuro para undo/redo

Essa abordagem foi escolhida porque:

- o sistema precisa de consistencia entre telas
- os mocks devem refletir a mesma operacao em multiplos modulos
- o custo de uma arquitetura maior com Redux/Zustand ainda nao se justifica nesta fase

### 4.4 Estrategia de permissao

As permissoes sao feitas no frontend por `role`.

Perfis:

- `administrador`
- `gestor`
- `operador`
- `conferente`
- `auditor`

Regras atuais:

- editor de planta: apenas `administrador` e `gestor`
- o editor exige senha adicional mesmo para perfis autorizados
- login respeita status do usuario ativo/inativo

### 4.5 Estrategia de responsividade

- layout principal com sidebar fixa em desktop
- conteudo em grids que quebram para colunas unicas em viewport menor
- cards e paineis com leitura compacta
- foco em acao contextual proxima ao elemento selecionado

### 4.6 Estrategia de drag and drop

Foi usado drag and drop com HTML5 e validacoes aplicadas no estado:

- mover paletes entre bins
- reorganizar ordem de pilha dentro do mesmo bin
- mover bins no editor de layout
- mover veiculos da fila para docas

Restricoes implementadas:

- bloqueio de bin interditado
- limite de empilhamento
- limite de carga maxima

## 5. Componentes reutilizaveis

Em `src/components/ui.tsx`:

- `Button`
- `Card`
- `Badge`
- `Input`
- `Select`
- `Toggle`
- `SectionHeader`
- `EmptyState`
- `Drawer`
- `Modal`

Em `src/components/layout/AppShell.tsx`:

- shell autenticado
- sidebar
- topbar
- seletor de armazem
- busca global
- alternancia entre modo operacional e gerencial

## 6. Entidades TypeScript

Definidas em `src/types/wms.ts`.

Principais entidades:

- `Role`
- `User`
- `Zone`
- `Product`
- `PalletItem`
- `Pallet`
- `Bin`
- `Warehouse`
- `Dock`
- `Shipment`
- `ReceivingItem`
- `ReceivingSession`
- `BlindCountItem`
- `BlindCountSession`
- `ValidationCase`
- `AuditLog`
- `SystemSettings`
- `ToastItem`

## 7. Dados mockados

Definidos em `src/data/mockData.ts`.

Cobertura atual:

- usuarios com perfis e credenciais
- produtos com SKU, lote, validade, curva ABC e historico
- armazens com zonas e bins
- paletes ligados a bins e produtos
- docas e fila de veiculos
- sessoes de recebimento
- sessoes de conferencia cega
- casos de validacao
- trilha de auditoria
- configuracoes do sistema

## 8. Comportamento por tela

### 8.1 Login

Arquivo: `src/pages/LoginPage.tsx`

Funcionalidades:

- login mockado
- loading simulado
- erro de credencial
- lembrar acesso
- link de recuperacao com feedback
- credenciais padrao visiveis

### 8.2 Shell principal

Arquivo: `src/components/layout/AppShell.tsx`

Funcionalidades:

- navegacao global
- seletor de armazem
- busca global
- modo operacional x gerencial
- acesso ao perfil
- logout
- destaque de rota ativa

### 8.3 Overview

Arquivo: `src/pages/OverviewPage.tsx`

Funcionalidades:

- cards de KPI
- ocupacao por zona
- giro de estoque
- alertas operacionais
- exportacao visual mockada

### 8.4 Mapa

Arquivo: `src/pages/MapPage.tsx`

Funcionalidades:

- renderizacao 2D de bins por coordenada
- clique para abrir detalhes do bin
- visualizacao de pilha de paletes
- destaque por busca global
- atenuacao de bins nao relacionados
- filtro de alertas
- movimentacao de produto entre bins por confirmacao
- drawer de detalhes com quick actions

Quick actions implementadas:

- favoritar bin
- travar posicao
- mover para quarentena
- iniciar contagem ciclica
- imprimir etiqueta
- abrir historico
- anexar observacao
- rastrear palete
- abrir resumo rapido

Regra adicional:

- fora do modo editor nao existe drag and drop estrutural
- a movimentacao operacional ocorre por prompt/modal de confirmacao

Atalhos:

- `Esc` limpa a selecao
- `H` alterna filtro de alertas

### 8.5 Editor de planta

Arquivo: `src/pages/LayoutEditorPage.tsx`

Funcionalidades:

- senha adicional para liberar edicao
- novo bin
- clonar bin
- gerar lote mockado
- arrastar bin no canvas apenas com editor desbloqueado
- bins com tamanho fixo
- quick edit
- mudar zona, rua, stack, carga
- travar ou mover para quarentena
- desfazer
- refazer
- salvar
- cancelar

Atalho:

- `E` abre o modal de desbloqueio

### 8.6 Produtos

Arquivo: `src/pages/ProductsPage.tsx`

Funcionalidades:

- busca
- filtro por status
- leitura de validade
- localizacao em bins do armazem atual
- enviar SKU para busca global e abrir mapa
- imprimir etiqueta
- historico rapido
- gerar tarefa

### 8.7 Docas

Arquivo: `src/pages/DocksPage.tsx`

Funcionalidades:

- fila de veiculos
- alocacao por drag and drop
- retorno de doca para fila
- cronometro por doca
- abertura de conferencia
- reordenacao mockada da fila
- novo agendamento mockado

### 8.8 Recebimento

Arquivo: `src/pages/ReceivingPage.tsx`

Funcionalidades:

- resumo do embarque
- checklist clicavel
- fotos anexadas
- validacao documental
- lotes e quantidades recebidas
- avancar para conferencia cega

### 8.9 Conferencia cega

Arquivo: `src/pages/BlindCountPage.tsx`

Funcionalidades:

- cronometro
- itens sem expor o esperado ao operador
- apontamento de quantidade contada
- divergencia automatica
- anexar foto mockada
- reiniciar cronometro

### 8.10 Validacao

Arquivo: `src/pages/ValidationPage.tsx`

Funcionalidades:

- comparacao esperado x recebido
- recontagem
- aprovacao para estoque real
- rejeicao
- justificativa editavel

### 8.11 Auditoria

Arquivo: `src/pages/AuditPage.tsx`

Funcionalidades:

- busca por ator, acao, entidade ou local
- filtro por modulo
- timeline em cards
- antes e depois resumidos
- exportacao mockada

### 8.12 Seguranca

Arquivo: `src/pages/SecurityPage.tsx`

Funcionalidades:

- listar usuarios
- bloquear e desbloquear
- redefinir senha mockada
- abrir gestao de permissoes futura

### 8.13 Analytics

Arquivo: `src/pages/AnalyticsPage.tsx`

Funcionalidades:

- curva de produtividade
- heatmap clicavel
- filtro por turno
- acao de tempo de doca

### 8.14 Configuracoes

Arquivo: `src/pages/SettingsPage.tsx`

Funcionalidades:

- alterar dias de alerta de validade
- alterar stack padrao
- mudar tema operacional
- alternar modo compacto
- alternar notificacoes
- restaurar senha do editor

## 9. Regras de negocio implementadas

### 9.1 Validade

Funcao base: `expiryTone` em `src/pages/helpers.ts`

Regras:

- vencido: vermelho
- abaixo do limite configurado: amarelo
- normal: verde

### 9.2 Movimentacao de palete

Funcao base: `movePallet` em `src/context/AppContext.tsx`

Regras:

- impede mover para bin bloqueado
- impede exceder stack limit
- impede exceder carga maxima
- grava toast
- grava auditoria

### 9.3 Controle de edicao

Funcionalidades:

- rascunho separado do layout persistido
- undo
- redo
- cancel
- save

### 9.4 Busca inteligente

Regras:

- a busca global encontra SKU e descricao
- bins com ocorrencias ficam em destaque
- bins sem correspondencia ficam atenuados
- lista lateral de ocorrencias permite selecionar o bin

## 10. Credenciais padrao

- Administrador: `admin` / `Admin@123`
- Gestor: `gestor` / `Gestor@123`
- Operador: `operador` / `Operador@123`
- Conferente: `conferente` / `Conferente@123`
- Auditor: `auditor` / `Auditor@123`

Senha do editor de planta:

- `layout123`

## 11. Como rodar

Desenvolvimento:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

Servidor Python para o build:

```bash
python3 -m http.server 8008 --directory dist
```

## 12. Como integrar com backend depois

### 12.1 Pontos naturais de substituicao

- `mockData.ts` por services HTTP
- `AppContext` por camada de query/cache ou store distribuido
- `login` mockado por auth real
- toasts mantidos como estao
- validacoes de UI reaproveitadas

### 12.2 Recomendacoes de evolucao

- criar pasta `src/services`
- separar DTOs de dominio
- mover mutacoes do contexto para hooks por modulo
- adicionar React Query para sincronizacao com APIs
- dividir bundle com lazy loading por rota
- adicionar testes de fluxo para mapa, docas e validacao

## 13. Limites atuais

- sem backend real
- sem persistencia fora da memoria do navegador
- drag and drop feito com HTML5 simples, nao com motor visual mais avancado
- alguns graficos e exportacoes ainda sao simulados por toasts
- nao ha upload real de imagem

## 14. Melhorias praticas recomendadas

- persistir sessao e preferencias em storage
- implementar `lazy()` por rota para reduzir bundle inicial
- substituir mapa por engine com zoom, pan e snap mais robustos
- adicionar tabela virtualizada para auditoria e produtos
- separar componentes por dominio para reduzir tamanho dos arquivos de pagina
- criar testes para `movePallet`, `unlockLayoutEditor` e `setValidationDecision`
- adicionar camada de feature flags
