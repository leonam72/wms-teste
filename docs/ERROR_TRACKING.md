# Registro de Rastreamento de Erros e Regressões (Error Tracking)

> Este documento serve como memória de curto e longo prazo para os testes automatizados via Chrome MCP.
> **Regra de Ouro:** Se um erro listado como "CORRIGIDO" voltar a aparecer na próxima rodada de testes, a última alteração DEVE ser revertida e uma nova abordagem deve ser tentada.

## 🐛 Erros Conhecidos e Status

### Sessão: 2026-04-19 (Transplante Modular e Bootstrap)

| ID | Mensagem de Erro / Sintoma | Módulo Afetado | Status | Ação de Correção (Como foi resolvido) |
|---|---|---|---|---|
| ERR-01 | `ReferenceError: openAddProductModal is not defined` (e outras de UI) | `main.js` (Bootstrap falhou) | ✅ CORRIGIDO | Ocorria porque um erro de sintaxe no `state.js` impedia o carregamento do restante dos módulos. |
| ERR-02 | `SyntaxError: module '../domain/state.js' does not provide an export named 'ensureDepotStructures'` | `state.js` | ✅ CORRIGIDO | A função não havia sido migrada do monolito. Foi adicionada e exportada no `state.js`. |
| ERR-03 | `SyntaxError: module '../domain/state.js' does not provide an export named 'setActiveDepot'` | `depotModalController.js` | ✅ CORRIGIDO | Erro de nomenclatura. O export do state era `setActiveDepotId`. Importação corrigida no controller. |
| ERR-04 | `SyntaxError: module './controllers/depotsPageController.js' does not provide an export named 'addDepot'` | `main.js` | ✅ CORRIGIDO | Importação no `main.js` apontava para o arquivo errado. Corrigido para puxar de `depotModalController.js`. |
| ERR-05 | `SyntaxError: module './controllers/productFormController.js' does not provide an export named 'deleteProduct'` | `productFormController.js` | ✅ CORRIGIDO | A função `pfDeleteProduct` do monolito foi extraída, adaptada e exportada como `deleteProduct`. |
| ERR-06 | `SyntaxError: module './controllers/floorPlanController.js' does not provide an export named 'fpDeleteSelected'` | `floorPlanController.js` | ✅ CORRIGIDO | Função faltante foi extraída diretamente do monolito e injetada no controlador. |
| ERR-07 | `SyntaxError: Unexpected token ')'` | `floorPlanController.js` / `depotController.js` | ✅ CORRIGIDO | Erros de duplicação de blocos de fechamento ao usar replace. Código extra removido no final dos arquivos. |
| ERR-08 | `SyntaxError: module './controllers/depotController.js' does not provide an export named 'setScope'` | `depotController.js` | ✅ CORRIGIDO | Função extraída do monolito, adaptada e exportada corretamente. |

### Sessão: Migração para API Backend (Teste de Estresse com Massa SQL)
| ID | Mensagem de Erro / Sintoma | Módulo Afetado | Status | Ação de Correção (Como foi resolvido) |
|---|---|---|---|---|
| INFO | Nenhum erro detectado no Console ou nas simulações de UI | Frontend (Todos) | ✅ OK | A aplicação lidou com 95 SKUs / 199.8Kg / 55 gavetas perfeitamente. O Seed de teste e a estrutura SQL estão pareados. |

---

## 🔄 Procedimento de Teste Contínuo
1. **Antes** de novas implementações complexas, o script de simulação (Point and Click via `mcp_chrome`) será rodado.
2. A lista de `errors` e a captura do `console.error` do navegador serão comparadas com esta tabela.
3. Se um `ERR-XX` ressurgir, a sessão é pausada, a alteração é **revertida** via `git checkout` (ou via deleção direta) e uma nova solução arquitetada.
