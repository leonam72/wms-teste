# Matriz de Funcionalidades

## Objetivo

Mapear as funcionalidades confirmadas e relacioná-las aos módulos e processos documentados.

## Escopo

Inclui apenas funcionalidades com respaldo nos documentos-base.

## Conteúdo

| Funcionalidade | Módulo | Processo relacionado | Status documental |
|---|---|---|---|
| Login e sessão | Autenticação e sessão | autenticação | Confirmado |
| Bootstrap do estado | Snapshot de estado do WMS | bootstrap do estado inicial | Confirmado |
| Gestão de depósitos | Estrutura física de depósitos | gestão estrutural de depósitos e prateleiras | Confirmado |
| Gestão de prateleiras e gavetas | Estrutura física de depósitos | gestão estrutural de depósitos e prateleiras | Confirmado |
| Cadastro e edição de produtos | Inventário e movimentações | cadastro e edição manual de produtos | Confirmado |
| Movimentação entre gavetas | Inventário e movimentações | movimentação manual entre gavetas | Confirmado |
| Conferência cega | Conferência cega e descargas | conferência cega de descarga | Confirmado |
| Aprovação ou reprovação de descarga | Conferência cega e descargas | aprovação e reprovação de descarga | Confirmado |
| Alocação pós-conferência | Conferência cega e descargas | alocação de itens conferidos no estoque | Confirmado com ressalva |
| Carrinho de saída | Saídas e descarte | separação e carrinho para saída | Confirmado |
| Finalização de saída/descarte | Saídas e descarte | geração de saída ou descarte | Confirmado com ressalva |
| FEFO e bloqueio por validade | Saídas e descarte | validação FEFO e bloqueio por validade | Confirmado |
| Qualidade e destinação | Qualidade | cálculo de qualidade e destinação | Confirmado com ressalva |
| Planta baixa | Planta baixa | Não identificado no código atual como processo separado | Confirmado como módulo e tela |
| Geração e leitura de QR | QR e recebimento assistido | geração e leitura de QR | Confirmado |
| Gestão de usuários | Autenticação e sessão / Configurações | Não identificado no código atual como processo separado | Confirmado como módulo e rotas |
| Importação e exportação local | Configurações e manutenção | importação, exportação e restauração local | Confirmado com ressalva |
| Backup ZIP | Configurações e manutenção | geração de backup do banco | Confirmado |

- arquivo: `docs/processos/*.md`
  artefato: títulos e objetivos
  motivo: detalha os fluxos principais confirmados.

## Lacunas

- CRUD formal separado para usuários, indicadores e ajuda como processo documental dedicado não foi identificado no código atual.
