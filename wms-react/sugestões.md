# 📋 Sugestões de Implementação Funcional (WMS Expert)

Este documento registra as funcionalidades mapeadas para transformar elementos visuais em operações reais no banco de dados SQL.

## 1. Gestão e Relatórios
- **Home [Relatório Global]:** Rota `/api/reports/global` para extrair KPIs consolidados de todas as unidades em PDF/XLSX.
- **Inventory [Exportar XLSX]:** Migração do CSV para XLSX formatado (tabelas industriais).
- **Settings [Apagar Auditoria]:** Limpeza seletiva da tabela `MovementHistory` por depósito via `DELETE`.
- **Settings [Excluir Depósito]:** Remoção em cascata (Prateleiras, Estoque, Planta) e redirecionamento para Home.

## 2. Operações de Qualidade (FEFO)
- **Quality [Bloquear Vencidos]:** Atualização massiva no SQL da flag `is_freeze` para itens com data ultrapassada.
- **Quality [Mover para Descarte]:** Integração com `moveContext` para fluxo direcionado a áreas de sucata.
- **Quality [Auditar SKU]:** Redirecionamento para Audit Log com filtro automático de SKU.

## 3. Recebimento e Conferência
- **Receiving [Imprimir Divergências]:** Template de impressão (Window.print) para discrepâncias de conferência cega.
- **Receiving [Recontar]:** Reset local de `counted` e foco no input para nova leitura de coletor.
- **Receiving [Concluir/Putaway]:** Persistência no SQL e redirecionamento para fila de alocação da IA (Slotting).

## 4. Inteligência e Logística (Doca/Slotting)
- **Doca [Iniciar/Finalizar]:** Persistência de `startTime` e alteração de `status` (Ativo/Livre) na tabela `Dock`.
- **Doca [Chamar Fila]:** Vinculação de transportadora da fila a uma doca disponível no banco.
- **Slotting [Executar]:** Automação de transferência via `syncInventoryTransfer` baseada na sugestão da IA.

---
**Protocolo de Execução:** Estrutura lógica sequencial, validação de diff pré-commit e confirmação do usuário.
