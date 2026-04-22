# Aprovações

## Objetivo

Revisar descargas pendentes ou reprovadas e decidir sua aprovação.

## Escopo

Descreve a tela de aprovação de descargas.

## Conteúdo

## Como é acessada

Botão `data-page="unload-review"` no painel principal.

## Campos

- `#page-unload-review`

## Ações

- selecionar descarga
- aprovar
- reprovar

## Validações

- permissão compatível com revisão
- existência de descargas para revisão

## Estados da tela

- descarga pendente
- descarga aprovada
- descarga reprovada

## Dependências

- módulo de descargas
- processo de aprovação e reprovação de descarga

- arquivo: `docs/processos/aprovacao_reprovacao_descarga.md`
  artefato: fluxo funcional e técnico
  motivo: detalha as ações da revisão.

## Lacunas

- Estados completos possíveis da descarga fora de pendente e reprovada não foram identificados no código atual.
