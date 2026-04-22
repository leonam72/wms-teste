# Auditoria Técnica - WMS Neo

# Este documento lista incongruências encontradas e o plano de ação para resolução.

issues:
  - id: SECURITY-001
    title: Política de CORS excessivamente permissiva
    severity: high
    description: O backend permite requisições de qualquer origem (*).
    fix_strategy: |
      No arquivo 'backend/app/main.py', substituir '*' por uma lista de origens 
      permitidas ou carregar de variáveis de ambiente (.env).

  - id: LOGIC-001
    title: Inconsistência na Gestão de Sessões de Recebimento
    severity: medium
    description: Uso de flush() sem tratamento de erro robusto pode gerar cabeçalhos de NF-e sem itens no banco.
    fix_strategy: |
      Em 'backend/app/services/receiving_service.py', envolver a criação da 
      sessão e dos itens em um bloco 'async with db.begin():' para garantir atomicidade.

  - id: API-001
    title: Falta de Endpoint de Confirmação de Picking
    severity: high
    description: O frontend tem botão de confirmação, mas o backend não processa a baixa de estoque real.
    fix_strategy: |
      1. Criar método 'confirm_pick' em 'SeparationService' que subtrai 'StockItem.quantity'.
      2. Criar rota 'POST /separation/confirm' no router de separação.
      3. Registrar log de auditoria [OUT] na confirmação.

  - id: UI-001
    title: Acoplamento de ID de Depósito no Mapa
    severity: low
    description: 'MapPage.js' busca o layout do depot '1' de forma hardcoded.
    fix_strategy: |
      Implementar 'API.inventory.listDepots()' e permitir que o usuário 
      selecione qual armazém deseja visualizar no mapa.

  - id: PERF-001
    title: Carregamento de Relacionamentos N+1
    severity: medium
    description: Algumas rotas de inventário não usam 'selectinload', causando múltiplas consultas ao banco para cada item.
    fix_strategy: |
      Revisar 'backend/app/api/inventory.py' e garantir que 'product' e 'drawer' 
      sejam carregados na consulta principal.
