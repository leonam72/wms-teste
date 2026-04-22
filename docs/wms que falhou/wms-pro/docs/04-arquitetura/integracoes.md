# Integrações

## Objetivo

Consolidar as integrações e dependências externas identificadas.

## Escopo

Inclui banco, autenticação, bibliotecas e APIs de navegador confirmadas nos documentos-base.

## Conteúdo

Integrações identificadas:

- SQLite local
- PostgreSQL opcional configurável
- JWT via `jose`
- `bcrypt`
- Service Worker e manifesto PWA
- IndexedDB no navegador
- Google Fonts
- biblioteca local de QR
- câmera do navegador
- `BarcodeDetector`

Classificação:

- Persistência: SQLite, PostgreSQL opcional
- Segurança: JWT, bcrypt
- Runtime cliente: IndexedDB, Service Worker, câmera, BarcodeDetector
- UI/recursos estáticos: Google Fonts, biblioteca de QR

## Lacunas

- APIs externas de terceiros além de Google Fonts não foram identificadas no código atual.
- Uso efetivo de PostgreSQL além da configuração não foi identificado no código atual.
