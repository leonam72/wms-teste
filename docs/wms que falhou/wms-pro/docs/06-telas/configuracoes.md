# Configurações

## Objetivo

Concentrar funções administrativas, usuários e manutenção.

## Escopo

Descreve a tela administrativa de configurações identificada no inventário.

## Conteúdo

## Como é acessada

Botão `data-page="settings"` ou `#btn-header-settings`.

## Campos

- `#settings-role-badge`
- `#users-create-*`
- `#users-filter-*`
- `#settings-backup-btn`

## Ações

- visualizar perfil atual
- gerir usuários
- alterar senha
- importar e exportar dados
- restaurar backup local
- gerar backup ZIP

## Validações

- permissões administrativas compatíveis

## Estados da tela

- painel administrativo carregado
- lista de usuários carregada
- operação de manutenção em execução

## Dependências

- gestão de usuários
- importação/exportação
- backup administrativo

- arquivo: `docs/processos/importacao_exportacao_restauracao_local.md`
  artefato: fluxo funcional e técnico
  motivo: detalha parte das ações da tela.
- arquivo: `docs/processos/backup_banco_zip.md`
  artefato: fluxo funcional e técnico
  motivo: detalha o backup ZIP.

## Lacunas

- CRUD detalhado de usuários na tela e regras visuais de alteração de senha não foram identificados no código atual.
