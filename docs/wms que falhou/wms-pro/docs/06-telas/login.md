# Login

## Objetivo

Autenticar o usuário e liberar acesso ao painel principal.

## Escopo

Descreve a tela de login identificada no inventário.

## Conteúdo

## Como é acessada

Rota `/login`.

## Campos

- `#login-username`
- `#login-password`

## Ações

- envio do formulário de login
- monitoramento visual de status do servidor

## Validações

- credenciais válidas
- backend disponível

## Estados da tela

- pronta para autenticação
- erro de autenticação
- autenticação concluída com redirecionamento

## Dependências

- autenticação JWT
- verificação de saúde do backend

- arquivo: `docs/processos/autenticacao.md`
  artefato: fluxo funcional e técnico
  motivo: detalha o comportamento da tela.

## Lacunas

- Mensagens exatas de erro e regras de bloqueio visual da UI não foram identificadas no código atual.
