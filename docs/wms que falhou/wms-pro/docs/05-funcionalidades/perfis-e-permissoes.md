# Perfis e Permissões

## Objetivo

Documentar os papéis de usuário e suas permissões, derivados de `backend/app/models/auth.py`.

---

## Roles disponíveis

Os roles são definidos em ordem crescente de privilégio:

| Role (valor no banco) | Label de exibição |
|---|---|
| `visualizador` | Visualizador |
| `separador` | Separador |
| `conferente` | Conferente |
| `qualidade` | Qualidade |
| `supervisor` | Supervisor |
| `gerente` | Gerente |
| `admin` | Admin |
| `master` | Master |

---

## Permissões por role

Fonte: `ROLE_PERMISSIONS` em `backend/app/models/auth.py`.

| Permissão | visualizador | separador | conferente | qualidade | supervisor | gerente | admin | master |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `view.basic` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `separation.execute` | | ✅ | | | | | | ✅ |
| `entry.register` | | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `shipment.process` | | | ✅ | | ✅ | ✅ | ✅ | ✅ |
| `product.manage` | | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `quality.manage` | | | | ✅ | ✅ | ✅ | ✅ | ✅ |
| `discard.process` | | | | ✅ | ✅ | ✅ | ✅ | ✅ |
| `blind.count` | | | | | ✅ | ✅ | ✅ | ✅ |
| `structure.manage` | | | | | ✅ | ✅ | ✅ | ✅ |
| `user.manage.low` | | | | | ✅ | | | |
| `layout.edit` | | | | | | ✅ | ✅ | ✅ |
| `settings.manage` | | | | | | ✅ | ✅ | ✅ |
| `user.manage.mid` | | | | | | ✅ | | |
| `user.manage.high` | | | | | | | ✅ | |
| `clear.all` | | | | | | | ✅ | ✅ |
| `user.manage.master` | | | | | | | | ✅ |

---

## Hierarquia de gestão de usuários

Um role só pode criar ou editar usuários de roles inferiores:

| Role do gestor | Pode gerenciar roles |
|---|---|
| `supervisor` | `visualizador`, `separador`, `conferente`, `qualidade` |
| `gerente` | + `supervisor` |
| `admin` | + `gerente` |
| `master` | todos |

Implementado em `deps.allowed_manage_roles()` em `backend/app/api/deps.py`.

---

## Permissões no frontend

O frontend usa `hasPermission(perm)` de `utils.js` para esconder botões e controles.
**Isso é apenas conveniência visual** — toda ação sensível é validada novamente no backend
via `deps.ensure_permission(current_user, "permissao")`.

O role do usuário atual é lido de `sessionStorage` (issue S-03 pendente — ver `ISSUES_AND_FIXES.md`).
