# Persistência e Dados

## Objetivo

Documentar como o sistema persiste estado e quais conjuntos de dados foram identificados.

## Escopo

Inclui SQLite, snapshots de estado, fila de sincronização, entidades de negócio e persistência local no navegador.

## Conteúdo

Persistência confirmada:

- SQLite como banco principal
- tabelas de domínio para usuários, estrutura, inventário, qualidade, planta e auditoria
- `wms_state_snapshots` para estado persistido da interface e do negócio
- `sync_state` para metadados de sincronização e revisão
- `sync_queue` modelada no backend
- IndexedDB no navegador para fila offline

Grupos de dados:

- identidade e permissões
- estrutura física
- estoque e validade
- eventos e auditoria
- qualidade
- planta baixa
- sincronização e snapshots
- conferência cega

## Referências

- Entidades: [`../08-modelo-de-dados/entidades.md`](../08-modelo-de-dados/entidades.md)
- Campos: [`../08-modelo-de-dados/campos.md`](../08-modelo-de-dados/campos.md)
- Relacionamentos: [`../08-modelo-de-dados/relacionamentos.md`](../08-modelo-de-dados/relacionamentos.md)

## Lacunas

- Estratégia formal de retenção, arquivamento e versionamento histórico não foi identificada no código atual.
