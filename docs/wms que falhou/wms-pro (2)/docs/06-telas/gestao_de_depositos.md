# Gestão de Depósitos

## Objetivo

Permitir manutenção da estrutura de depósitos.

## Escopo

Descreve a tela dedicada à gestão estrutural de depósitos.

## Conteúdo

## Como é acessada

Botão `data-page="depots"` no painel principal.

## Campos

- `#page-depots`
- `#depot-modal`

## Ações

- abrir modal de depósito
- criar, editar ou ajustar dados estruturais

## Validações

- permissão compatível com gerenciamento estrutural
- revisão esperada no salvamento

## Estados da tela

- listagem estrutural
- modal aberto para edição
- estrutura salva com nova revisão

## Dependências

- módulo de estrutura física
- processo de gestão estrutural de depósitos e prateleiras

- arquivo: `docs/processos/gestao_estrutural_depositos_prateleiras.md`
  artefato: objetivo e fluxo técnico
  motivo: detalha a persistência estrutural.

## Lacunas

- Campos internos do modal de depósito não foram identificados no código atual.
