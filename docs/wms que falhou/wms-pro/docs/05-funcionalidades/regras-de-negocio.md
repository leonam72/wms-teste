# Regras de Negócio

## Objetivo

Consolidar as regras de negócio confirmadas nos documentos-base.

## Escopo

Inclui apenas regras explicitamente listadas no inventário ou refletidas diretamente nos processos.

## Conteúdo

- Toda gravação relevante de estado usa revisão esperada para evitar sobrescrita concorrente.
- O inventário salvo é validado contra capacidade por gaveta, prateleira e depósito.
- Perfis possuem permissões distintas.
- Gestão de usuários respeita hierarquia de perfis.
- Backup e limpeza total dependem de permissão específica.
- Login possui rate limiting por IP e usuário.
- Expiração, quarentena e bloqueio são derivados de validade e tipo da prateleira.
- Saída pode ser bloqueada por validade mínima.
- Saída e descarte exigem permissões específicas.
- FEFO pode exigir autorização de quebra por item.
- O depósito de descarte tem tratamento fixo especial na interface.

- arquivo: `docs/processos/validacao_fefo_bloqueio_validade.md`
  artefato: fluxo funcional e técnico
  motivo: reforça a aplicação das regras de FEFO e validade.
- arquivo: `docs/processos/geracao_saida_ou_descarte.md`
  artefato: pré-condições e fluxo técnico
  motivo: confirma validação de permissões na saída e descarte.

## Lacunas

- Regras de priorização operacional entre depósitos, filas de trabalho e SLA não foram identificadas no código atual.
