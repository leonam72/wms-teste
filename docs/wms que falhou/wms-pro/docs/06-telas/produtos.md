# Produtos

## Objetivo

Permitir cadastro e edição manual de produtos.

## Escopo

Descreve a tela de produtos identificada no inventário.

## Conteúdo

## Como é acessada

Botão `data-page="products"` no painel principal.

## Campos

- `#page-products`
- modal de formulário de produto

## Ações

- listar produtos
- abrir formulário
- criar produto
- editar produto

## Validações

- permissão `entry.register`
- estado de inventário carregado

## Estados da tela

- listagem de produtos
- formulário aberto
- produto salvo

## Dependências

- módulo de inventário
- processo de cadastro e edição manual de produtos

- arquivo: `docs/processos/cadastro_edicao_manual_produtos.md`
  artefato: fluxo funcional e técnico
  motivo: detalha o comportamento operacional.

## Lacunas

- Campos exatos do formulário e regras de validação por campo não foram identificados no código atual.
