# Deploy e Ambientes

## Objetivo

Registrar o que pode ser afirmado sobre execução e ambientes do sistema.

## Escopo

Restringe-se ao que o inventário confirma sobre runtime local, PWA e configuração de banco.

## Conteúdo

Aspectos confirmados:

- aplicação HTTP principal iniciada por `uvicorn`
- diretório `run/` para PID, metadados e logs
- banco principal SQLite
- possibilidade de configuração de PostgreSQL
- frontend servido pelo próprio backend
- Service Worker e manifesto web app

Aspectos não confirmados:

- segregação formal entre desenvolvimento, homologação e produção
- containerização
- CI/CD
- orquestração

## Lacunas

- Estratégia de deploy, provisionamento e observabilidade não foi identificada no código atual.
