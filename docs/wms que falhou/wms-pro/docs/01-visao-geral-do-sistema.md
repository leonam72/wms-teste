# Visão Geral do Sistema

## Objetivo

Consolidar a visão funcional e técnica de alto nível do sistema.

## Escopo

Resume propósito, módulos e fluxos principais confirmados nos documentos-base.

## Conteúdo

O sistema implementa um WMS com autenticação JWT, operação de depósitos, controle estrutural de prateleiras e gavetas, inventário por localização, conferência cega, saídas e descarte, qualidade, planta baixa, QR e funções administrativas de importação, exportação e backup.

Módulos principais identificados:

- Aplicação FastAPI e entrega do frontend
- Autenticação e sessão
- Snapshot de estado do WMS
- Estrutura física de depósitos
- Inventário e movimentações
- Conferência cega e descargas
- Saídas e descarte
- Qualidade
- Planta baixa
- QR e recebimento assistido
- Configurações, importação, exportação e manutenção

Fluxos principais identificados:

- autenticação
- bootstrap do estado inicial
- gestão estrutural de depósitos e prateleiras
- cadastro e edição manual de produtos
- movimentação manual entre gavetas
- conferência cega de descarga
- aprovação e reprovação de descarga
- alocação de itens conferidos no estoque
- separação e carrinho para saída
- geração de saída ou descarte
- validação FEFO e bloqueio por validade
- geração e leitura de QR
- cálculo de qualidade e destinação
- importação, exportação e restauração local
- geração de backup do banco

## Lacunas

- Indicadores de negócio consolidados e metas operacionais não foram identificados no código atual.
