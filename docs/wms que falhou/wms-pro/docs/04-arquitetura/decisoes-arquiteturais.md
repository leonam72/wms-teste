# Decisões Arquiteturais

## Objetivo

Registrar decisões arquiteturais inferíveis com segurança a partir dos documentos-base.

## Escopo

Inclui apenas decisões sustentadas por evidência direta já consolidada.

## Conteúdo

Decisões observáveis:

- frontend entregue pelo backend em templates e assets locais
- SPA em JavaScript puro com múltiplas páginas internas
- persistência central por snapshot do estado do WMS
- controle de concorrência por revisão esperada
- banco principal SQLite
- autenticação baseada em JWT
- suporte offline parcial via IndexedDB e Service Worker
- uso de APIs nativas de navegador para QR quando disponíveis

## Lacunas

- ADRs formais, racional de escolha de tecnologias e trade-offs documentados não foram identificados no código atual.
