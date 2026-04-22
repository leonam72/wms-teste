# Saídas

## Objetivo

Montar carrinho operacional e finalizar saída ou descarte.

## Escopo

Descreve a tela de saídas e seus modais principais.

## Conteúdo

## Como é acessada

Botão `data-page="saidas"` no painel principal.

## Campos

- `#shipping-source-depot`
- `#shipping-source-search`
- `#shipping-shelves-grid`
- `#shipping-source-products`
- `#shipping-cart-dropzone`
- `#shipping-cart-list`
- `#shipping-add-modal`
- `#shipping-finalize-modal`

## Ações

- selecionar origem
- buscar itens
- adicionar item ao carrinho
- revisar carrinho
- abrir modal de finalização
- confirmar saída ou descarte

## Validações

- permissão para saída ou descarte
- carrinho com itens
- FEFO e bloqueios de validade

## Estados da tela

- seleção de origem
- carrinho vazio
- carrinho preenchido
- modal adicionar aberto
- modal finalização aberto
- operação bloqueada ou concluída

## Dependências

- inventário carregado
- processos de separação, finalização e FEFO

- arquivo: `docs/processos/separacao_carrinho_saida.md`
  artefato: fluxo funcional
  motivo: detalha a reserva de itens.
- arquivo: `docs/processos/geracao_saida_ou_descarte.md`
  artefato: fluxo funcional e técnico
  motivo: detalha a finalização.
- arquivo: `docs/processos/validacao_fefo_bloqueio_validade.md`
  artefato: objetivo e fluxo técnico
  motivo: confirma as validações de FEFO e validade.

## Lacunas

- Ordem exata de seleção automática de estoque para saída não foi identificada no código atual.
