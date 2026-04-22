# Inventário JS — WMS Controle de Prateleiras

> Atualizado em: 2026-04-19 17:14 BRT
> Migração concluída via MCP em 3 sessões.

---

## ✅ Progresso Final

| Concluídos | Pendentes | Total |
|---:|---:|---:|
| **34 (100%)** | 0 | 34 |

---

## Todos os arquivos — menor → maior

| # | Arquivo | Status | Obs |
|---|---|---|---|
| 1 | `js/monolito-legacy.js` | ✅ DESCONTINUADO | placeholder vazio, pode ser removido |
| 2 | `js/ui/statsPanel.js` | ✅ MIGRADO | renderStats com KPIs reais |
| 3 | `js/controllers/focusController.js` | ✅ MIGRADO | setFocusedDrawer, clearFocus, renderFocusPanel |
| 4 | `js/domain/drawerKey.js` | ✅ CORRETO | drawerKey(), parseKey() |
| 5 | `js/ui/shelfGrid.js` | ✅ MIGRADO | renderShelfGrid completo |
| 6 | `js/controllers/initController.js` | ✅ MIGRADO | loadData, saveData, initApp, renderAll |
| 7 | `js/ui/productTable.js` | ✅ MIGRADO | renderProductTable com status de validade |
| 8 | `js/ui/floorPlanRenderer.js` | ✅ MIGRADO | renderFloorPlan canvas 2D |
| 9 | `js/controllers/dndController.js` | ✅ MIGRADO | onDragStart/End/Over/Leave/Drop |
| 10 | `js/controllers/moveController.js` | ✅ MIGRADO | openMoveModal, executeMoveConfirmed |
| 11 | `js/controllers/dragDropController.js` | ✅ MIGRADO | handleFocusDrop |
| 12 | `js/controllers/tabsController.js` | ✅ MIGRADO | switchTab, attachModalListeners |
| 13 | `js/controllers/productsController.js` | ✅ MIGRADO | renderProductsPage, filtros, KPIs |
| 14 | `js/controllers/addProductController.js` | ✅ MIGRADO | openAddProductModal, saveGlobalAdd |
| 15 | `js/controllers/depotsPageController.js` | ✅ MIGRADO | renderDepotTabs, switchDepot |
| 16 | `js/controllers/drawerModalController.js` | ✅ MIGRADO | openDrawerModal, removeFromDrawer |
| 17 | `js/controllers/productFormController.js` | ✅ MIGRADO | openProductForm, saveProductForm |
| 18 | `js/ui/viewManager.js` | ✅ CORRETO | showView, initViewManager |
| 19 | `js/controllers/dateEditController.js` | ✅ MIGRADO | openDateEditModal, saveDateEdit |
| 20 | `js/controllers/shelfListController.js` | ✅ MIGRADO | renderShelfList, addShelf, CRUD |
| 21 | `js/controllers/productDetailController.js` | ✅ MIGRADO | showDrawerTooltip, openProductDetail |
| 22 | `js/controllers/depotController.js` | ✅ MIGRADO | applyFilters, setScope, toggleChip |
| 23 | `js/domain/importExport.js` | ✅ MIGRADO | export CSV/JSON, parseCSV |
| 24 | `js/domain/expiry.js` | ✅ CORRETO | productExpiryStatus, nearestExpiry |
| 25 | `js/core/confirm.js` | ✅ CORRETO | showConfirm modal |
| 26 | `js/controllers/historyController.js` | ✅ CORRETO | renderHistory |
| 27 | `js/controllers/depotModalController.js` | ✅ MIGRADO | openDepotModal, saveDepotModal |
| 28 | `js/controllers/settingsController.js` | ✅ MIGRADO | import/export, tabs, download |
| 29 | `js/controllers/floorPlanController.js` | ✅ MIGRADO | zoom, pan, atalhos teclado |
| 30 | `js/domain/floorplan.js` | ✅ MIGRADO | fpZoom, fpUndo/Redo, fpSnap |
| 31 | `js/core/utils.js` | ✅ CORRETO | utilitários gerais |
| 32 | `js/controllers/alertsController.js` | ✅ CORRETO | renderAlerts |
| 33 | `js/domain/state.js` | ✅ EXPANDIDO | todos exports adicionados (gridChips, currentShelfId, ensureDepotStructures...) |
| 34 | `js/main.js` | ✅ CORRETO | bootstrap DOMContentLoaded |

---

## Estrutura final de módulos

```
js/
├── main.js                      ← bootstrap
├── monolito-legacy.js           ← placeholder (descontinuado)
├── core/
│   ├── confirm.js
│   └── utils.js
├── domain/
│   ├── state.js
│   ├── drawerKey.js
│   ├── expiry.js
│   ├── floorplan.js
│   └── importExport.js
├── ui/
│   ├── viewManager.js
│   ├── shelfGrid.js
│   ├── productTable.js
│   ├── floorPlanRenderer.js
│   └── statsPanel.js
└── controllers/
    ├── initController.js
    ├── tabsController.js
    ├── focusController.js
    ├── dndController.js
    ├── dragDropController.js
    ├── moveController.js
    ├── drawerModalController.js
    ├── productFormController.js
    ├── addProductController.js
    ├── productsController.js
    ├── productDetailController.js
    ├── dateEditController.js
    ├── shelfListController.js
    ├── depotsPageController.js
    ├── depotController.js
    ├── depotModalController.js
    ├── historyController.js
    ├── alertsController.js
    ├── settingsController.js
    └── floorPlanController.js
```

---

> Migração concluída. Próximo passo: testes end-to-end e remoção de `monolito-legacy.js`.
