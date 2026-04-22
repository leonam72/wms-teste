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


## 3. Roteiro para "Páginas Novas"
1.  **Dashboard de Recebimento (NFe):**
    - Referência: `wms-neo/frontend/static/js/pages/ReceivingPage.js`
    - Ação: Criar tela de upload de XML usando o parser Python como base para o JS.
2.  **Gestão de Lotes (Audit):**
    - Referência: `wms-neo/backend/app/services/audit_service.py`
    - Ação: Criar tela de timeline para rastreabilidade total.

## 4. Sugestões "Logistics 2025" (O Futuro)
- **IA Slotting Assistant:** Basear-se na lógica de "Giro ABC" (visto em planos de melhoria do WMS-PRO).
- **Offline-First:** Usar o `localStorage` (Zustand persist) que já iniciamos para suportar quedas de rede.
- **Etiquetas QR:** Gerar links dinâmicos para `wms.com/drawer/A1.G2` baseados no ID do banco SQL.

## 5. Análise de Débitos Técnicos
- **Fragmentação:** O monolito tinha a mesma função repetida em arquivos diferentes (visto no `grep` de `fpLasso`). O React resolve isso com **Centralização em Hooks**.
- **Segurança:** O monolito não tinha autenticação. O `wms-maps/auth.py` deve ser nossa base para o novo login.
