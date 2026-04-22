# Contratos

## Objetivo

Registrar os contratos de API que podem ser afirmados com segurança a partir dos documentos-base.

## Escopo

Inclui contratos em nível funcional, sem inventar schemas ausentes.

## Conteúdo

Contratos confirmados em nível funcional:

- `POST /api/auth/login`
  - entrada: credenciais de autenticação
  - saída: token JWT em caso de sucesso
- `GET /api/auth/me`
  - entrada: token do usuário autenticado
  - saída: dados do usuário atual
- `GET /api/wms/bootstrap`
  - saída: `revision` e `state` do snapshot
- `PUT /api/wms/structure-state`
  - entrada: patch estrutural com controle por revisão esperada
  - saída: nova revisão em caso de sucesso
- `PUT /api/wms/inventory-state`
  - entrada: patch de inventário com validação de capacidade e revisão
  - saída: nova revisão em caso de sucesso
- `PUT /api/wms/unloads-state`
  - entrada: estado de descargas
  - saída: persistência do novo estado
- `PUT /api/wms/outbound-records-state`
  - entrada: registros de saída
  - saída: persistência do novo estado
- `GET /api/wms/quality/states`
  - saída: estados de qualidade calculados
- `GET /api/wms/quality/summary`
  - saída: resumo agregado de qualidade
- `GET /api/wms/admin/backup`
  - saída: arquivo ZIP para download

Comportamentos contratuais confirmados:

- uso de revisão esperada para prevenção de sobrescrita concorrente
- resposta `409 Conflict` em divergência de revisão
- proteção por token e permissões em rotas sensíveis

- arquivo: `docs/processos/autenticacao.md`
  artefato: fluxo técnico
  motivo: confirma login, armazenamento de token e leitura de `/api/auth/me`.
- arquivo: `docs/processos/bootstrap_estado_inicial.md`
  artefato: fluxo técnico
  motivo: confirma retorno de `revision` e `state`.

## Lacunas

- Schemas JSON completos, campos obrigatórios por rota e exemplos formais de request/response não foram identificados no código atual.
