# Glossário

## Objetivo

Padronizar termos recorrentes encontrados na documentação-base.

## Escopo

Inclui apenas termos explicitamente derivados dos documentos de inventário, mapa do sistema e processos.

## Conteúdo

- WMS: sistema de gestão de armazém descrito nesta documentação.
- Snapshot: estado persistido do WMS com `revision`, ver `08-modelo-de-dados/entidades.md`.
- Revisão: identificador usado para controle de concorrência em gravações do estado.
- Depósito: unidade estrutural de armazenagem.
- Prateleira: estrutura física vinculada a um depósito.
- Gaveta: subdivisão da prateleira onde itens são armazenados.
- Produto: cadastro base de item.
- Stock item: saldo localizado de produto em gaveta.
- Expiry: validade associada a item de estoque.
- Movimentação: registro histórico operacional.
- Conferência cega: fluxo de descarga com pool de itens conferidos.
- Pool da conferência: conjunto persistido de itens da descarga aguardando uso ou alocação.
- Saída: operação de expedição registrada pelo sistema.
- Descarte: operação de remoção controlada com tratamento especial na interface.
- FEFO: validação operacional baseada na validade mais próxima.
- Qualidade: visão derivada de validade, quarentena e bloqueio.
- Planta baixa: layout do depósito com posicionamento de prateleiras e objetos.
- QR: geração e leitura de payloads operacionais.
- Fila offline: persistência em IndexedDB para ações de sincronização do cliente.

- arquivo: `docs/processos/validacao_fefo_bloqueio_validade.md`
  artefato: título e fluxo funcional
  motivo: confirma o uso do termo FEFO.
- arquivo: `docs/processos/conferencia_cega_descarga.md`
  artefato: objetivo e fluxo técnico
  motivo: confirma o conceito de conferência cega e pool.

## Lacunas

- Definições de termos de domínio externo ao sistema não foram identificadas no código atual.
