# QR e Recebimento

## Objetivo

Gerar QR, ler QR e preencher contexto de recebimento.

## Escopo

Descreve a tela de QR e recebimento identificada no inventário.

## Conteúdo

## Como é acessada

Botão `data-page="qr"` no painel principal.

## Campos

- `#qr-gen-type`
- `#qr-code-preview`
- `#qr-video`
- `#qr-manual-payload`
- `#qr-form-product-search`
- `#qr-form-depot`
- `#qr-form-shelf`
- `#qr-form-drawer`

## Ações

- gerar QR
- ler QR por câmera
- ler QR por imagem
- informar payload manual
- preencher formulário de recebimento

## Validações

- usuário autenticado
- APIs de navegador disponíveis quando aplicável

## Estados da tela

- geração de QR
- leitura por câmera
- leitura por imagem
- preenchimento manual
- formulário preenchido

## Dependências

- biblioteca de QR
- câmera do navegador
- BarcodeDetector

- arquivo: `docs/processos/geracao_leitura_qr.md`
  artefato: fluxo funcional e técnico
  motivo: detalha as formas de geração e leitura.

## Lacunas

- Estrutura exata do payload QR não foi identificada no código atual.
