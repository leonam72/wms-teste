# 💡 Ideias e Roteiro de Expansão (WMS v2 React)

Este documento mapeia as funcionalidades avançadas identificadas nos projetos legados e propõe melhorias profissionais.

## 1. Mapeamento de Referências Técnicas (Código Legado)
Use estas referências para consultar a lógica bruta original e portá-la para o React.

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

## 2. Funcionalidades "Engenharia" a serem Portadas
- **Heatmap Ocupação:** Portar lógica de volume/peso para visualização cromática (calor) por setor.
- **Slotting Advisor:** IA para sugerir realocação de SKUs baseada em Curva ABC (Giro).
- **Picking Roadmap:** Algoritmo de menor caminho (A*/Dijkstra) entre prateleiras para coleta rápida.
- **Audit Timeline:** Histórico visual estilo "timeline" para rastreabilidade total de lotes e LPNs.
- **Modo Dark Logístico:** Interface de alto contraste para operações noturnas ou galpões com baixa luminosidade.
- **Integração NFe XML:** Parser robusto para entrada automática de estoque via upload de nota fiscal.
- **QR Inventory:** Geração de etiquetas dinâmicas para cada gaveta vinculada ao ID do banco.

## 3. Extrações de Elite (Projetos Legados)
| Ideia Resumida | Localização Completa do Arquivo Extraído | Linhas Exatas da Função |
| :--- | :--- | :--- |
| **Alocação (Melhorada)** | `docs/wms que falhou/mais tentativa/backend/app/services/inventory_service.py` | L10 - L65 |
| **Sugestão de Picking FEFO** | `docs/wms-neo/backend/app/services/separation_service.py` | L33 - L68 |
| **Parser Robusto de XML NF-e** | `docs/WMS-PRO/backend/app/core/nfe_parser.py` | L56 - L115 |
| **Mapa Tático Interativo (Matrix UI)** | `docs/wms-neo/frontend/static/js/pages/MapPage.js` | L56 - L120 |
| **Recebimento e Conferência Cega** | `docs/wms-neo/frontend/static/js/pages/ReceivingPage.js` | L80 - L145 |
| **Rate Limit de Segurança** | `docs/WMS-PRO/backend/app/core/rate_limit.py` | L10 - L45 |
| **Movimentação com Auditoria** | `docs/wms-neo/backend/app/services/inventory_service.py` | L60 - L110 |
| **Rastreadibilidade Operacional (Audit UI)** | `docs/wms-neo/frontend/static/js/pages/AuditPage.js` | L18 - L48 |
| **Conferência Cega (Scan UI)** | `docs/wms-neo/frontend/static/js/pages/BlindCountPage.js` | L24 - L70 |
| **Validação de Divergências (Lack/Surplus)** | `docs/ideias visuais/valida_o_de_diverg_ncias/code.html` | L85 - L135 |
| **Cálculo de Status de Qualidade** | `docs/wms-neo/backend/app/services/quality_service.py` | L8 - L20 |
| **Controle de Bloqueio/Quarentena** | `docs/wms-neo/backend/app/services/quality_service.py` | L22 - L50 |
| **Smart Guides (Planta Baixa)** | `docs/ideias visuais/editor_de_planta_baixa_inteligente/code.html` | L34 - L50 |
| **Mini-mapa de Navegação** | `docs/ideias visuais/editor_de_planta_baixa_inteligente/code.html` | L197 - L210 |
| **KPIs com Tendência (Analytics)** | `docs/ideias visuais/analytics_e_produtividade/code.html` | L120 - L150 |
| **Cronômetro de Doca Ativo** | `docs/ideias visuais/gest_o_de_docas_com_cron_metro_ativo/code.html` | L140 - L160 |

## 4. Sugestões "Logistics 2025" (O Futuro)
- **IA Slotting Assistant:** Basear-se na lógica de "Giro ABC" (visto em planos de melhoria do WMS-PRO).
- **Offline-First:** Usar o `localStorage` (Zustand persist) que já iniciamos para suportar quedas de rede.
- **Etiquetas QR:** Gerar links dinâmicos para `wms.com/drawer/A1.G2` baseados no ID do banco SQL.

## 5. Análise de Débitos Técnicos
- **Fragmentação:** O monolito tinha a mesma função repetida em arquivos diferentes (visto no `grep` de `fpLasso`). O React resolve isso com **Centralização em Hooks**.
- **Segurança:** O monolito não tinha autenticação. O `wms-maps/auth.py` deve ser nossa base para o novo login.

## 6. Protocolo de Registro (Como salvar dados aqui)
Para manter a organização e a autoridade dos dados, siga este padrão rigoroso:

1.  **Formato de Extração:** Adicione sempre na tabela da **Seção 3**.
    - Padrão: `| Ideia Resumida | Localização Completa (docs/...) | Linhas Início - Fim |`
2.  **Critério de Seleção:** Priorize códigos da pasta `docs/wms que falhou/mais tentativa/` (versão mais evoluída).
3.  **Registro Visual:** Para ideias de UI, aponte para os arquivos `code.html` dentro de `docs/ideias visuais/`.
4.  **Sincronização Git:** Após cada atualização neste arquivo, execute `git commit` imediatamente para persistir o conhecimento.
