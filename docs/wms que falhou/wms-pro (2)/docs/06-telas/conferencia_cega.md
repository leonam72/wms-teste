# Conferência Cega

## Objetivo

Iniciar e conduzir descargas com conferência cega.

## Escopo

Descreve a tela principal de conferência cega.

## Conteúdo

## Como é acessada

Botão `data-page="conference"` no painel principal.

## Campos

- `#blind-invoice-barcode`
- `#blind-vehicle-plate`
- `#blind-pool-dropzone`
- `#blind-target-grid`
- `#blind-count-record-list`

## Ações

- iniciar descarga
- registrar dados da descarga
- adicionar itens à pool
- encerrar e enviar descarga

## Validações

- usuário autenticado
- estado de descargas carregado

## Estados da tela

- descarga não iniciada
- descarga em andamento
- pool preenchida
- descarga finalizada para continuidade

## Dependências

- módulo de descargas
- processo de conferência cega

- arquivo: `docs/processos/conferencia_cega_descarga.md`
  artefato: fluxo funcional e técnico
  motivo: detalha as ações da tela.

## Lacunas

- Regras visuais completas do `dropzone` não foram identificadas no código atual.
