# 💡 Ideias e Roteiro de Expansão (WMS v2 React)

Este documento é a **Autoridade Máxima** de inovação do sistema. 
⚠️ **REGRA DE OURO:** É proibido apagar informações. Novas extrações devem ser apenas adicionadas ao final das tabelas ou listas.

## 1. Mapeamento de Referências Técnicas (Código Legado)
| Ideia / Funcionalidade | Arquivo Original (Base docs/) | Linhas de Referência |
| :--- | :--- | :--- |
| **Lasso Selection** (Seleção em Massa) | `ideia inicial, nuca editar.html` | L2736 - L2804 |
| **Lasso Update/Commit** | `js/06-floorplan.js` | L497 - L530 |
| **Auto-Snap & Alignment** (Grid) | `ideia inicial, nuca editar.html` | L2810 - L2850 |
| **Botões de Alinhamento UI** | `index.html` | L285 - L292 |
| **Motor NFe (XML Parser)** | `wms-neo/backend/app/services/nfe_service.py` | L54 - L115 |
| **Matriz de Prateleira (Preview)** | `wms-neo/frontend/static/js/pages/MapPage.js` | L106 - L160 |
| **Autenticação JWT** | `wms-maps/backend/app/auth.py` | L1 - L80 |
| **Rate Limiter (Segurança)** | `WMS-PRO/backend/app/core/rate_limit.py` | L10 - L45 |

## 2. Decupagem de Elite (ModernWMS - Industrial)
| Ideia Resumida | Localização Completa do Arquivo | Linhas de Lógica |
| :--- | :--- | :--- |
| **Inventário Cíclico (Audit)** | `backend/.../StocktakingService.cs` | L70 - L120 |
| **Segregação (is_freeze)** | `backend/.../Entities/Models/StockEntity.cs` | L35 - L40 |
| **Motor de Exportação XLSX** | `frontend/src/utils/exportTable.ts` | L8 - L60 |
| **Tipificação de Áreas** | `frontend/.../formatWarehouse.ts` | L4 - L25 |
| **Motor de Movimentação** | `backend/.../StockmoveService.cs` | L70 - L150 |
| **Sugestão de Alocação** | `frontend/.../tabToDoGrounding.vue` | L80 - L130 |
| **Conferência de Descarregamento**| `frontend/.../confirm-unload.vue` | L35 - L75 |
| **Separação por ASN (Sorting)** | `frontend/.../tabToDoSorting.vue` | L1 - L120 |
| **Gatilhos de Safety Stock** | `frontend/src/types/WMS/SafetyStock.ts` | L1 - L40 |
| **Matrix de Localização** | `frontend/.../tabStockLocation.vue` | L50 - L150 |
| **Gestão de Recebimento (ASN)** | `ModernWMS.WMS/Services/Asn/AsnService.cs` | 1-1423 |

## 3. Extrações Globais (Home, Obsidian e Projetos Locais)
| Ideia Resumida | Localização Completa do Arquivo | Linhas Exatas |
| :--- | :--- | :--- |
| **Fluxo FEFO (Picking)** | `Documentos/Meu-Obsidian/Engineering/WMS-BR-003...` | Seção 📤 |
| **Reserva de Estoque** | `Documentos/Meu-Obsidian/Engineering/WMS-BR-003...` | Seção 🛠️ |
| **Alocação (Melhorada)** | `docs/wms que falhou/mais tentativa/.../inventory_service.py` | L10 - L65 |
| **Sugestão de Picking FEFO** | `docs/wms-neo/backend/app/services/separation_service.py` | L33 - L68 |
| **Parser Robusto de XML NF-e** | `docs/WMS-PRO/backend/app/core/nfe_parser.py` | L56 - L115 |
| **Mapa Tático Interativo** | `docs/wms-neo/frontend/static/js/pages/MapPage.js` | L56 - L120 |
| **Recebimento/Conferência Cega** | `docs/wms-neo/frontend/static/js/pages/ReceivingPage.js` | L80 - L145 |
| **Movimentação c/ Auditoria** | `docs/wms-neo/backend/app/services/inventory_service.py` | L60 - L110 |
| **Rastreadibilidade (Audit UI)** | `docs/wms-neo/frontend/static/js/pages/AuditPage.js` | L18 - L48 |
| **Conferência Cega (Scan UI)** | `docs/wms-neo/frontend/static/js/pages/BlindCountPage.js` | L24 - L70 |
| **Validação de Divergências** | `docs/ideias visuais/valida_o_de_diverg_ncias/code.html` | L85 - L135 |
| **Status de Qualidade** | `docs/wms-neo/backend/app/services/quality_service.py` | L8 - L20 |
| **Controle de Quarentena** | `docs/wms-neo/backend/app/services/quality_service.py` | L22 - L50 |
| **Smart Guides (Planta)** | `docs/ideias visuais/editor_de_planta_baixa_inteligente/code.html` | L34 - L50 |
| **Mini-mapa** | `docs/ideias visuais/editor_de_planta_baixa_inteligente/code.html` | L197 - L210 |
| **KPIs (Analytics)** | `docs/ideias visuais/analytics_e_produtividade/code.html` | L120 - L150 |
| **Cronômetro de Doca** | `docs/ideias visuais/gest_o_de_docas_com_cron_metro_ativo/code.html` | L140 - L160 |
| **Limpeza SQL Server** | `docs/wms-leonam/listaprodutosdebug.php` | L25 - L40 |
| **Multi-Temas Logísticos** | `docs/wms-leonam/listaprodutosdebug.php` | L70 - L115 |
| **Edição Inline** | `docs/wms-leonam/listaprodutosdebug.php` | L550 - L590 |
| **Persistência Ajustes** | `docs/wms-leonam/listaprodutosdebug.php` | L280 - L350 |
| **Cards de Filtro (Stats)** | `docs/wms-leonam/components/stats.html` | L1 - L30 |

## 4. Funcionalidades a serem Portadas (Roteiro WMS Expert)
- **Heatmap Ocupação:** Visualização cromática (Base: `StockmoveService.cs`).
- **Slotting Advisor:** IA para sugestão de realocação (Base: Giro ABC).
- **Picking Roadmap:** Algoritmo A* (Base: `tabToDoSorting.vue`).
- **Audit Timeline:** Histórico visual de lotes e LPNs.
- **Modo Dark Logístico:** Temas de alto contraste (`listaprodutosdebug.php`).
- **Integração NFe XML:** Upload e parser automático.
- **QR Inventory:** Etiquetas dinâmicas para gavetas.
- **ASN Gateway:** Recebimento cego c/ log de tempo/usuário (`confirm-unload.vue`).
- **Safety Alerts:** Notificações de ruptura (`SafetyStock.ts`).
- **Export Power:** Relatórios Excel nativos via `exportTable.ts`.
- **Áreas Especializadas:** Controle de zonas (Doca/Quarentena).
- **Stock Freeze:** Bloqueio de saldos (`is_freeze`).
- **Lasso Selection:** Seleção massiva na planta.
- **Voice Picking:** API de voz (`voice.js`).
- **Dashboard Gerencial:** Produtividade por operador/zona.

## 5. Protocolo de Registro (Proibido Apagar)
1. **Formato:** `| Ideia Resumida | Localização Completa | Linhas Início - Fim |`
2. **Critério:** Priorize códigos do `ModernWMS` (Industrial) ou `mais tentativa` (Maduro).
3. **Registro:** Sempre adicione novas entradas ao FINAL das tabelas.
4. **Git:** Commit imediato após qualquer alteração neste arquivo.

