# Regras de Comportamento e Interação (UX/UI) — WMS Modular

> Baseado na engenharia reversa do DOM (`ideia inicial, nuca editar.html`).
> Objetivo: Garantir que a versão modular se comporte de forma 100% idêntica à visão original idealizada pelo engenheiro.

---

## 1. Modais da Aplicação (Overlays)

O sistema original gerencia **11 modais distintos**. Eles não usam a tag `<dialog>` nativa, mas sim divs com classe `.modal-overlay` que recebem a classe `.open` para exibir.

| ID do Modal | Propósito / Comportamento Observado |
|---|---|
| `drawer-modal` | Exibe o conteúdo de uma gaveta clicada na Planta Baixa ou no Grid. Controlado por `openDrawerModal`. |
| `product-form-modal` | Formulário para adicionar/editar as propriedades e validades de um produto (SKU, Kg, Nome, Vencimentos). |
| `add-product-modal` | Cadastro global rápido de um novo SKU ao catálogo mestre do Depósito. |
| `settings-modal` | Configurações do sistema (Avisos de Vencimento, Cor, Temas, Exportação de Dados). |
| `expiry-modal` | Popup que lista exclusivamente os produtos vencidos e a vencer para tomada rápida de ação. |
| `date-edit-modal` | Edição rápida de data de validade in-line na tabela de expirações. |
| `fp-shelf-modal` | Modal do FloorPlan (Planta Baixa) para edição e propriedades de uma Prateleira no modo de edição (Edit Mode). |
| `move-confirm-modal` | Modal de Confirmação visual exibindo 'DE' -> 'PARA' quando um produto é movido logicamente via botão "Mover". |
| `dnd-move-modal` | Modal específico invocado quando um "Drag and Drop" (Arrastar e Soltar) de uma gaveta sobre a outra é finalizado. |
| `depot-modal` | Gerenciamento de Depósitos (Criar, Excluir e Alternar entre galpões físicos). |
| `prod-detail-modal` | Tooltip de PDM (Product Data Management) que surge ao clicar no código de um produto na listagem global (aba PROD). |

---

## 2. Motor de Filtros Globais (Grid Search)

Os filtros de busca operam de maneira **reativa (on-type)** combinando um campo de texto e **6 "Chips" de filtro rápido**. Todos disparam a função global `applyFilters()`.

### Escopos de Busca
1. **`scope-product` (Padrão):** O `grid-search` busca via Regex por "Código" (`P001`) ou "Nome" (`Parafuso`).
2. **`scope-address`:** O `grid-search` busca especificamente pela árvore de Localização (Prateleira `A` ou Gaveta exata `A2.G3`). Muda o *placeholder* do input automaticamente.

### Chips Dinâmicos (Atuam com classe `.active`)
- **OCUPADAS (`chip-occupied`)**: Mostra gavetas com `length > 0`. Oculta vazias.
- **VAZIAS (`chip-empty`)**: Oculta as ocupadas.
- **VENCIDAS (`chip-expired`)**: Mostra apenas gavetas cujo motor calculou `status === 'expired'`.
- **A VENCER (`chip-expiring`)**: Mostra gavetas cujo motor calculou `status === 'expiring'`.
- **MULTI-SKU (`chip-multi`)**: Mostra gavetas contendo 2 ou mais *códigos distintos*.
- **SELECIONADO (`chip-selected`)**: Filtro de "Focus". É ativado quando se clica em um código de produto na aba "PROD", filtrando a tela de Prateleiras apenas para as gavetas que contêm aquele exato SKU.
- **✕ LIMPAR**: Invoca `clearAllFilters()` que varre o Set() de `activeChips` e zera a barra de busca, restaurando as 80 gavetas na tela.

---

## 3. Ações Críticas e Roteamento (Controllers)

A arquitetura usa "Tabs" que escondem e exibem `div.page`. A renderização não refaz o DOM de todas as telas (para economizar processamento), ela é orquestrada por `renderAll()` e os listeners de clique.

- O clique nas **Abas de Navegação (Depósito, Prateleiras, Produtos, Planta, Histórico)** chama a função mestre de roteamento `showPage()` no `viewManager.js` (anteriormente `switchTab`).
- O clique em um botão **Depósito (ex: "Depósito Principal")** aciona `switchDepot(id)`, recarrega todo o inventário local do objeto Mestre global e executa uma re-renderização total da interface (hidratando KPIs e Tabelas de produtos).

---

## 4. O Comportamento do Arrastar e Soltar (Drag & Drop)

- A interface não possui cliques explícitos mapeados na sintaxe HTML inline do `ideia inicial` (`onclick=""`) para os itens das prateleiras. Isso significa que **os listeners (Event Listeners de clique e mouse) são atrelados dinamicamente via JS** durante a fase de renderização (provavelmente no `shelfGrid.js` e `dragDropController.js`).
- A "Sobreposição" não é permitida. Se tentarem jogar um conteúdo na gaveta que não cabe ou mistura SKUs incompatíveis, um alerta ("⛔ Sobreposição não permitida") deve piscar visualmente sem fechar ou interromper a UI.

---

## 5. Diretrizes para Modificações Futuras
Ao desenvolver ou depurar partes do WMS, garanta que:
1. **Não feche Modais arbitrariamente**. Os fluxos originais são feitos de modais sobre modais (Ex: *FloorPlan* abre um modal de edição *fp-shelf-modal* que deve se fechar voltando ao *FloorPlan*, sem fechar o original).
2. **Respeite o Singleton Global**. Nunca reatribua variáveis importadas (ex: `shelves = []`). Use sempre os setters (`setShelvesAll()`) ou manipulação direta da array mutável.
3. **Mantenha os listeners não intrusivos**. Se for alterar o DOM da planta baixa ou do painel de gavetas, o arquivo `.js` correspondente deve injetar o listener dinamicamente via `.addEventListener`.
