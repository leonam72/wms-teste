# Qualidade

## Objetivo

Exibir indicadores e lista de itens para análise e destinação por qualidade.

## Escopo

Descreve a tela de qualidade identificada no inventário.

## Conteúdo

## Como é acessada

Botão `data-page="quality"` no painel principal.

## Campos

- `#quality-kpi-grid`
- `#quality-filter-type`
- `#quality-filter-depot`
- `#quality-filter-search`
- `#quality-list`
- `#quality-move-modal`

## Ações

- consultar KPIs
- filtrar itens
- abrir modal de destinação

## Validações

- estoque existente
- usuário autenticado

## Estados da tela

- lista carregada
- filtros aplicados
- modal de destinação aberto

## Dependências

- APIs de qualidade
- processo de cálculo de qualidade e destinação

- arquivo: `docs/processos/calculo_qualidade_destinacao.md`
  artefato: fluxo funcional e técnico
  motivo: detalha a destinação de itens.

## Lacunas

- Persistência exata da destinação foi marcada como fluxo incompleto no código atual.
