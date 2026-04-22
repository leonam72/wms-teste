# Documentação Técnica e Funcional - WMS Agora Vai (Sessão 001)
**Data:** 17 de Abril de 2026
**Objetivo:** Consolidar o resgate da inteligência do sistema anterior para a nova arquitetura modular.

## 1. Brainstorms e Decisões de Arquitetura
- **Fim do Monolito de Estado:** O sistema anterior falia porque tentava sincronizar um Banco SQL com um Snapshot JSON global de 125KB. Decidimos por **SQL puro (SSoT)**.
- **Camada de Serviços (Services):** Toda regra de negócio (Cálculos de WMS) foi isolada das rotas HTTP.
- **Hardware Local:** Uso do **Phi4-mini** para tarefas pesadas de I/O e análise de código, poupando tokens do Gemini.
- **Segurança Nativa:** Proteção contra SQL Injection (SQLAlchemy 2.0) e XSS/Clickjacking (Middleware de Headers).

## 2. Resumo da Obra (Implementado nesta Sessão)
- **Estrutura de Pastas:** Criada árvore modular `backend/app/[api,core,models,schemas,services]` e `frontend/static/[js,css]`.
- **Core Operacional:** Implementados 10 serviços fundamentais (Auth, Inventory, Separation, NFe, Receiving, CSV, Audit, Floorplan, Quality, Locking).
- **Banco de Dados:** Inicializado com `init_db.py`, tabelas criadas e usuário `master` (senha: `wms123`) provisionado.
- **Frontend Shell:** Layout industrial industrial com Nav Rail, Sidebar e sistema de troca de páginas (SPA) funcional.

## 3. Mapeamento de Funcionalidades (Resgatado do Antigo & .md)
Este é o inventário de inteligência que deve ser mantido ou implementado no novo sistema:

### 3.1 Módulo Inbound (Recebimento)
- [x] **Parser NFe XML:** Extração de Chave de Acesso, CNPJ e itens (Implementado no `NFeService`).
- [ ] **Conferência Cega com Cronômetro:** O operador bipa sem saber o saldo; o sistema registra tempo de descarga (Mapeado de `conferência_cega_com_cronômetro`).
- [ ] **Checklist de Recebimento:** Validação de temperatura e avarias (Mapeado de `checklist_de_recebimento`).

### 3.2 Módulo Outbound (Saída)
- [x] **Algoritmo FEFO:** Prioridade automática por data de vencimento (Portado do `routes_wms.py`).
- [x] **Roteirização Geográfica:** Ordenação de picking por corredor/nível/gaveta para evitar deslocamento inútil (Portado).
- [x] **Tratamento de Faltas:** Função `mark_separation_task_not_found` para gerar divergência imediata (Portado).
- [ ] **Doca de Saída com Timer:** Monitoramento de tempo de carregamento (Mapeado de `gestão_de_docas`).

### 3.3 Módulo Inventário e Estrutura
- [x] **Controle de Capacidade:** Validação de peso máximo (KG) por gaveta (Implementado no `InventoryService`).
- [x] **Multi-Armazém:** Suporte a múltiplos depósitos (Mapeado no modelo `Depot`).
- [x] **Layout Floorplan:** Persistência de coordenadas (X, Y) e rotação das prateleiras (Implementado).
- [ ] **Editor de Mapa Drag & Drop:** Interface visual para mover prateleiras (Mapeado de `editor_de_mapa_visualwms`).

### 3.4 Qualidade e Auditoria
- [x] **Status de Validade:** Cálculo automático de dias para vencimento e alertas de pulso visual (Portado).
- [x] **Quarentena/Bloqueio:** Estados lógicos de prateleira que impedem o picking (Portado).
- [x] **Timeline de Auditoria:** Visão de "Antes vs Depois" de cada movimentação (Modelo `AuditLog` mapeado).

### 3.5 Visão Disruptiva (Mapeado do `ideias_disruptivas.md`)
- [ ] **Snapshot-to-Count:** Uso de IA para contar itens por foto.
- [ ] **Gamificação:** Ranking de produtividade entre separadores.

## 4. Estado Atual e Próximos Passos
- **Backend:** Banco pronto. Servidor pendente de ajuste final no `ImportError` de pacotes.
- **Frontend:** Shell visual pronto. Falta o `api.js` para conexão real.

## 5. Dívida Técnica e Alertas
- **Import Circular:** O pacote `backend.app.api` precisa de revisão no `__init__.py` para não travar o boot.
- **VRAM/Timeout:** O Phi4 local precisa de prompts curtos. Evitar `list_symbols` em arquivos > 150 linhas sem fatiar.
- **Segurança de Senha:** A senha `wms123` é temporária e deve ser alterada no primeiro login.
