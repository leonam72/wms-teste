# MIGRATION MAP — WMS Controle de Prateleiras

Mapeamento completo: cada função do monolito → arquivo modular de destino.

> Gerado por auditoria automatizada em 2026-04-19.  
> Monolito de referência: `ideia-inicial-nuca-editar.html`  
> **Total de funções: 187 — todas mapeadas (100%)**

| Função | Linha no Monolito | Arquivo Modular |
|---|---|---|
| `showConfirm` | L1648 | `js/core/confirm.js` |
| `confirmResolve` | L1670 | `js/core/confirm.js` |
| `switchDepot` | L1699 | `js/domain/state.js` |
| `addDepot` | L1712 | `js/domain/state.js` |
| `removeDepot` | L1714 | `js/domain/state.js` |
| `renameDepot` | L1742 | `js/domain/state.js` |
| `renderDepotTabs` | L1744 | `js/controllers/depotsPageController.js` |
| `logHistory` | L1769 | `js/domain/state.js` |
| `renderHistory` | L1775 | `js/controllers/historyController.js` |
| `clearHistory` | L1793 | `js/controllers/historyController.js` |
| `getExpiries` | L1803 | `js/domain/expiry.js` |
| `nearestExpiry` | L1809 | `js/domain/expiry.js` |
| `expiryStatus` | L1814 | `js/domain/expiry.js` |
| `productExpiryStatus` | L1824 | `js/domain/expiry.js` |
| `drawerExpiryStatus` | L1828 | `js/domain/expiry.js` |
| `daysUntil` | L1838 | `js/domain/expiry.js` |
| `fmtDate` | L1844 | `js/domain/expiry.js` |
| `renderAlerts` | L1851 | `js/controllers/alertsController.js` |
| `openExpiryModal` | L1867 | `js/controllers/alertsController.js` |
| `handleWorkspaceClick` | L1915 | `js/controllers/productDetailController.js` |
| `gpAddExpiry` | L1926 | `js/controllers/addProductController.js` |
| `renderGpChips` | L1936 | `js/controllers/addProductController.js` |
| `gpEditExpiry` | L1950 | `js/controllers/addProductController.js` |
| `closeDateEditModal` | L1963 | `js/controllers/dateEditController.js` |
| `saveDateEdit` | L1968 | `js/controllers/dateEditController.js` |
| `deleteDateEdit` | L1979 | `js/controllers/dateEditController.js` |
| `openProductDetail` | L2030 | `js/controllers/productDetailController.js` |
| `closePdmAndNavigate` | L2090 | `js/controllers/productDetailController.js` |
| `showDrawerTooltip` | L2097 | `js/controllers/productDetailController.js` |
| `hideDrawerTooltip` | L2123 | `js/controllers/productDetailController.js` |
| `updatePoKpiActiveState` | L2130 | `js/controllers/productsController.js` |
| `setPoKpiFilter` | L2133 | `js/controllers/productsController.js` |
| `pfSwitchTab` | L2141 | `js/controllers/productFormController.js` |
| `pfUpdateExpiryTab` | L2150 | `js/controllers/productFormController.js` |
| `pfUpdateDaysInfo` | L2158 | `js/controllers/productFormController.js` |
| `saveDepotModal` | L2174 | `js/controllers/depotModalController.js` |
| `fpHistoryPush` | L2226 | `js/domain/floorplan.js` |
| `fpUndo` | L2234 | `js/domain/floorplan.js` |
| `fpRedo` | L2246 | `js/domain/floorplan.js` |
| `fpUpdateUndoButtons` | L2257 | `js/domain/floorplan.js` |
| `fpIsBlocker` | L2291 | `js/domain/floorplan.js` |
| `fpIsUnder` | L2293 | `js/domain/floorplan.js` |
| `fpCardH` | L2296 | `js/domain/floorplan.js` |
| `fpSnap` | L2297 | `js/domain/floorplan.js` |
| `fpS2W` | L2300 | `js/domain/floorplan.js` |
| `fpRects` | L2308 | `js/domain/floorplan.js` |
| `fpCollidesShelf` | L2311 | `js/domain/floorplan.js` |
| `fpCollides` | L2325 | `js/domain/floorplan.js` |
| `fpApplyTransform` | L2332 | `js/domain/floorplan.js` |
| `fpZoom` | L2344 | `js/domain/floorplan.js` |
| `fpZoomReset` | L2361 | `js/domain/floorplan.js` |
| `fpEnterEditMode` | L2368 | `js/domain/floorplan.js` |
| `fpExitEditMode` | L2377 | `js/domain/floorplan.js` |
| `fpToggleSnap` | L2387 | `js/domain/floorplan.js` |
| `fpSelectTool` | L2403 | `js/domain/floorplan.js` |
| `fpCancelTool` | L2416 | `js/domain/floorplan.js` |
| `_fpUpdatePreview` | L2424 | `js/domain/floorplan.js` |
| `fpMovePreview` | L2440 | `js/domain/floorplan.js` |
| `fpPlaceObject` | L2463 | `js/domain/floorplan.js` |
| `fpAutoPlace` | L2478 | `js/domain/floorplan.js` |
| `fpRenameObject` | L2489 | `js/domain/floorplan.js` |
| `renderFloorPlan` | L2501 | `js/ui/floorPlanRenderer.js` |
| `fpSelKey` | L2688 | `js/ui/floorPlanRenderer.js` |
| `fpSelAdd` | L2689 | `js/ui/floorPlanRenderer.js` |
| `fpSelRemove` | L2690 | `js/ui/floorPlanRenderer.js` |
| `fpSelHas` | L2691 | `js/ui/floorPlanRenderer.js` |
| `fpSelClear` | L2692 | `js/ui/floorPlanRenderer.js` |
| `fpSelAll` | L2693 | `js/ui/floorPlanRenderer.js` |
| `fpUpdateAlignBar` | L2700 | `js/ui/floorPlanRenderer.js` |
| `fpToggleSelect` | L2708 | `js/ui/floorPlanRenderer.js` |
| `_fpApplySelectionClass` | L2724 | `js/ui/floorPlanRenderer.js` |
| `fpLassoUpdate` | L2736 | `js/ui/floorPlanRenderer.js` |
| `fpLassoCommit` | L2751 | `js/ui/floorPlanRenderer.js` |
| `fpAlign` | L2777 | `js/ui/floorPlanRenderer.js` |
| `fpDeleteSelected` | L2831 | `js/ui/floorPlanRenderer.js` |
| `openFpModal` | L3006 | `js/controllers/floorPlanController.js` |
| `closeFpModal` | L3017 | `js/controllers/floorPlanController.js` |
| `fpOpenAddProduct` | L3021 | `js/controllers/floorPlanController.js` |
| `renderFpModalBody` | L3030 | `js/controllers/floorPlanController.js` |
| `fpDrawerClick` | L3080 | `js/controllers/floorPlanController.js` |
| `fpSaveLayout` | L3090 | `js/controllers/floorPlanController.js` |
| `fpLoadLayout` | L3097 | `js/controllers/floorPlanController.js` |
| `fpResetLayout` | L3103 | `js/controllers/floorPlanController.js` |
| `fpSwitchDepot` | L3121 | `js/controllers/floorPlanController.js` |
| `fpToggleAllDepots` | L3127 | `js/controllers/floorPlanController.js` |
| `fpGetViewDepotId` | L3132 | `js/controllers/floorPlanController.js` |
| `fpPopulateDepotSelect` | L3136 | `js/controllers/floorPlanController.js` |
| `fpSearch` | L3142 | `js/controllers/floorPlanController.js` |
| `fpClearSearch` | L3143 | `js/controllers/floorPlanController.js` |
| `fpSetFilter` | L3144 | `js/controllers/floorPlanController.js` |
| `fpApplySearch` | L3154 | `js/controllers/floorPlanController.js` |
| `openDepotModal` | L3195 | `js/controllers/depotModalController.js` |
| `closeDepotModal` | L3207 | `js/controllers/depotModalController.js` |
| `doAddDepot` | L3211 | `js/controllers/depotModalController.js` |
| `renderDepotsPage` | L3213 | `js/controllers/depotsPageController.js` |
| `poReorderCol` | L3339 | `js/controllers/productsController.js` |
| `sbReorderCol` | L3359 | `js/controllers/productsController.js` |
| `showPage` | L3367 | `js/controllers/productsController.js` |
| `poToggleColMenu` | L3392 | `js/controllers/productsController.js` |
| `poToggleCol` | L3401 | `js/controllers/productsController.js` |
| `poSort` | L3411 | `js/controllers/productsController.js` |
| `poRenderHeaders` | L3417 | `js/controllers/productsController.js` |
| `poRenderRow` | L3423 | `js/controllers/productsController.js` |
| `getAllProductsDetail` | L3476 | `js/controllers/productsController.js` |
| `renderProductsPage` | L3501 | `js/controllers/productsController.js` |
| `renderPageHistory` | L3579 | `js/controllers/historyController.js` |
| `openProductForm` | L3595 | `js/controllers/productFormController.js` |
| `closeProductForm` | L3658 | `js/controllers/productFormController.js` |
| `pfAddExpiry` | L3664 | `js/controllers/productFormController.js` |
| `renderPfChips` | L3674 | `js/controllers/productFormController.js` |
| `pfEditExpiry` | L3689 | `js/controllers/productFormController.js` |
| `saveProductForm` | L3699 | `js/controllers/productFormController.js` |
| `pfDeleteProduct` | L3744 | `js/controllers/productFormController.js` |
| `saveDrawerChanges` | L3756 | `js/controllers/productFormController.js` |
| `dndInit` | L3773 | `js/controllers/dndController.js` |
| `dndSwapDrawers` | L3830 | `js/controllers/dndController.js` |
| `openDndMoveModal` | L3861 | `js/controllers/dndController.js` |
| `confirmDndMove` | L3888 | `js/controllers/dndController.js` |
| `closeDndMoveModal` | L3915 | `js/controllers/dndController.js` |
| `setScope` | L3963 | `js/controllers/depotController.js` |
| `toggleChip` | L3971 | `js/controllers/depotController.js` |
| `clearSearch` | L3978 | `js/controllers/depotController.js` |
| `clearAllFilters` | L3983 | `js/controllers/depotController.js` |
| `applyFilters` | L3990 | `js/controllers/depotController.js` |
| `navigateToDrawer` | L4070 | `js/controllers/depotController.js` |
| `init` | L4101 | `js/controllers/initController.js` |
| `renderAll` | L4108 | `js/controllers/initController.js` |
| `syncSbChips` | L4128 | `js/controllers/initController.js` |
| `drawerKey` | L4136 | `js/domain/drawerKey.js` |
| `parseKey` | L4140 | `js/domain/drawerKey.js` |
| `renderShelfGrid` | L4147 | `js/ui/shelfGrid.js` |
| `getAllProducts` | L4279 | `js/ui/productTable.js` |
| `setSbFilter` | L4298 | `js/domain/state.js` |
| `setSbSort` | L4308 | `js/domain/state.js` |
| `getAllProductsDetail2` | L4321 | `js/ui/productTable.js` |
| `renderProductTable` | L4345 | `js/ui/productTable.js` |
| `renderFocusPanel` | L4398 | `js/ui/productTable.js` |
| `selectProduct` | L4431 | `js/ui/productTable.js` |
| `renderStats` | L4449 | `js/ui/statsPanel.js` |
| `renderShelfList` | L4475 | `js/controllers/shelfListController.js` |
| `toggleAddShelfPanel` | L4507 | `js/controllers/shelfListController.js` |
| `openEditShelfPanel` | L4527 | `js/controllers/shelfListController.js` |
| `closeEditShelfPanel` | L4546 | `js/controllers/shelfListController.js` |
| `saveEditShelf` | L4552 | `js/controllers/shelfListController.js` |
| `selectShelf` | L4575 | `js/controllers/shelfListController.js` |
| `addShelf` | L4609 | `js/controllers/shelfListController.js` |
| `removeShelf` | L4622 | `js/controllers/shelfListController.js` |
| `openDrawerModal` | L4639 | `js/controllers/drawerModalController.js` |
| `closeDrawerModal` | L4648 | `js/controllers/drawerModalController.js` |
| `renderDrawerProducts` | L4655 | `js/controllers/drawerModalController.js` |
| `openDateEditForProduct` | L4737 | `js/controllers/drawerModalController.js` |
| `dpAddExpiry` | L4759 | `js/controllers/drawerModalController.js` |
| `renderDpChips` | L4760 | `js/controllers/drawerModalController.js` |
| `dpEditExpiry` | L4761 | `js/controllers/drawerModalController.js` |
| `addProductToDrawer` | L4762 | `js/controllers/drawerModalController.js` |
| `removeProductFromDrawer` | L4764 | `js/controllers/drawerModalController.js` |
| `openAddProductModal` | L4774 | `js/controllers/addProductController.js` |
| `addGlobalProduct` | L4778 | `js/controllers/addProductController.js` |
| `switchTab` | L4805 | `js/controllers/tabsController.js` |
| `attachModalListeners` | L4816 | `js/controllers/tabsController.js` |
| `setFocusedDrawer` | L5109 | `js/controllers/focusController.js` |
| `clearFocus` | L5124 | `js/controllers/focusController.js` |
| `onDragStart` | L5134 | `js/controllers/dragDropController.js` |
| `onDragEnd` | L5148 | `js/controllers/dragDropController.js` |
| `onDrawerDragOver` | L5158 | `js/controllers/dragDropController.js` |
| `onDrawerDragLeave` | L5164 | `js/controllers/dragDropController.js` |
| `onDrawerDrop` | L5168 | `js/controllers/dragDropController.js` |
| `openMoveModal` | L5202 | `js/controllers/moveController.js` |
| `applyMoveHighlights` | L5222 | `js/controllers/moveController.js` |
| `mvSelectDest` | L5248 | `js/controllers/moveController.js` |
| `executeMoveConfirmed` | L5279 | `js/controllers/moveController.js` |
| `cancelMoveMode` | L5316 | `js/controllers/moveController.js` |
| `openSettingsModal` | L5362 | `js/controllers/settingsController.js` |
| `closeSettingsModal` | L5370 | `js/controllers/settingsController.js` |
| `switchStab` | L5372 | `js/controllers/settingsController.js` |
| `downloadSampleCSV` | L5383 | `js/controllers/settingsController.js` |
| `handleCSVFile` | L5398 | `js/controllers/settingsController.js` |
| `parseCSV` | L5413 | `js/controllers/settingsController.js` |
| `previewImport` | L5434 | `js/controllers/settingsController.js` |
| `confirmImport` | L5455 | `js/controllers/settingsController.js` |
| `exportProductsCSV` | L5486 | `js/controllers/settingsController.js` |
| `exportShelvesCSV` | L5494 | `js/controllers/settingsController.js` |
| `exportSummaryCSV` | L5500 | `js/controllers/settingsController.js` |
| `exportFullJSON` | L5508 | `js/controllers/settingsController.js` |
| `handleJSONFile` | L5513 | `js/controllers/settingsController.js` |
| `clearAllData` | L5538 | `js/controllers/settingsController.js` |
| `downloadFile` | L5546 | `js/core/utils.js` |

---

## Status da Migração

| Status | Significado |
|---|---|
| ✅ Stub criado | Arquivo existe em `js/`, função mapeada, implementação pendente |
| 🔄 Em migração | `addEventListener` substituindo `onclick` inline |
| ✔ Completo | Testado e validado |

## Próximo Passo

1. Criar `js/monolito-legacy.js` copiando o `<script>` original
2. Para cada linha da tabela acima: mover implementação para o arquivo de destino
3. Remover o `onclick` inline do HTML correspondente
4. Rodar o app e validar que a função continua operando
