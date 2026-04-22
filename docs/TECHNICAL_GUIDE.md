# Guia Técnico — WMS Modular

Este documento descreve a arquitetura de sincronização e os mecanismos de compatibilidade utilizados na migração do monolito para a estrutura modular.

## 1. Fluxo de Renderização: `renderAll()`

O `renderAll()` (localizado em `js/controllers/initController.js`) é o "batimento cardíaco" da interface do usuário. Ele garante que a UI reflita fielmente o estado atual dos dados (`state.js`).

### Quando é disparado?
- **Inicialização:** No `DOMContentLoaded` através do `initApp()`.
- **Mudanças de Estado:** Após qualquer operação de escrita (adicionar produto, mover prateleira, trocar depósito).
- **Interações do Usuário:** Filtros, ordenação e troca de abas.

### O que ele faz?
1. **Sincronização de Componentes:** Chama as funções de renderização específicas de cada módulo UI:
   - `renderShelfGrid()`: Atualiza a grade de gavetas.
   - `renderProductTable()`: Atualiza a tabela de inventário abaixo da grade.
   - `renderStatsPanel()`: Recalcula KPIs (capacidade, itens, valor).
   - `renderHistory()`: Atualiza o log de atividades na sidebar.
2. **Renderização Condicional:** Verifica qual página está ativa (ex: só renderiza o `FloorPlan` se a aba de prateleiras estiver aberta).
3. **Persistência:** Dispara o `saveData()` para espelhar o estado no `localStorage`.

---

## 2. Pontes de Compatibilidade (`window.*`)

Como o projeto original é um monolito em um único arquivo HTML com milhares de atributos `onclick`, `onchange` e `oninput`, a modularização utiliza o padrão **Strangler Fig** com pontes para o escopo global.

### Por que usar `window`?
O navegador não consegue acessar funções dentro de módulos ES (`import/export`) a partir de atributos HTML inline.
*Exemplo que falharia sem a ponte:*
```html
<button onclick="showPage('settings')">Config</button>
```

### Implementação da Ponte
No final de cada módulo controlador ou de interface, as funções necessárias são exportadas explicitamente para o objeto `window`:

```javascript
// js/ui/viewManager.js
export function showPage(name) { ... }

// Ponte para o legado:
window.showPage = showPage;
```

### Benefícios dessa Abordagem
1. **Migração Incremental:** Podemos mover a lógica para arquivos JS modernos sem precisar refatorar todo o HTML de uma vez.
2. **Desacoplamento:** O código interno usa `imports` limpos, enquanto a "borda" do módulo mantém a compatibilidade.
3. **Debugging:** Facilita o teste de funções diretamente pelo console do desenvolvedor.

---

## 3. Gerenciamento de Estado

O estado é centralizado em `js/domain/state.js`. 
- **Fontes da Verdade:** `shelvesAll` e `productsAll`.
- **Shims de Referência:** `shelves` e `products` são atalhos para os dados do depósito atualmente selecionado (`activeDepotId`).

Qualquer módulo que precise de dados deve importar do `state.js`, garantindo que não existam cópias dessincronizadas da informação.
