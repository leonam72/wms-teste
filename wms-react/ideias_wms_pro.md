# Achados WMS-PRO: Segurança, Rate Limit, Parsers NFe e Infraestrutura

| Ideia | Arquivo | Linhas |
| :--- | :--- | :--- |
| **Segurança** | | |
| Hierarquia de Papéis e Permissões (ACL) | backend/app/models/auth.py | 29-105 |
| Implementação de Tokens de Acesso JWT | backend/app/core/security.py | 9-16 |
| Hashing e Verificação de Senhas com Bcrypt | backend/app/core/security.py | 18-30 |
| Middleware de Cabeçalhos de Segurança (CSP, HSTS, Frame Options) | backend/app/main.py | 49-77 |
| Injeção de Nonce por Request para mitigação de XSS | backend/app/main.py | 52-54 |
| Proteção contra CORS Configurável via Variáveis de Ambiente | backend/app/main.py | 40-47 |
| Dependências de Autenticação para Rotas FastAPI | backend/app/api/deps.py | 30-37 |
| Credenciais de Teste Expostas em Scripts de Automação | scripts/api_smoke.py | 4-5 |
| **Rate Limit** | | |
| Estratégia de Rate Limit Persistido em SQLite (Anti-Restart) | backend/app/core/rate_limit.py | 2-132 |
| Definição de Janela Deslizante de Tentativas de Login | backend/app/core/rate_limit.py | 12-13 |
| Implementação Assíncrona de Verificação de Rate Limit | backend/app/core/rate_limit.py | 99-113 |
| Criação Automática da Tabela de Tentativas de Login | backend/app/core/rate_limit.py | 31-41 |
| Limpeza Periódica de Registros de Tentativas Obsoletos | backend/app/core/rate_limit.py | 71-75 |
| **Parsers de NFe** | | |
| Parser XML de NF-e usando ElementTree | backend/app/core/nfe_parser.py | 7-121 |
| Mapeamento de Namespaces Fiscais (NFE_NS) | backend/app/core/nfe_parser.py | 9 |
| Extração de Chave de Acesso e Validação de Formato | backend/app/core/nfe_parser.py | 68-71 |
| Processamento de Dados do Emitente e Transportadora do XML | backend/app/core/nfe_parser.py | 107-114 |
| Estrutura de Payload para Conferência Cega e Recebimento | backend/app/core/nfe_parser.py | 121-145 |
| Configuração Centralizada de Diretório de Armazenamento XML | backend/app/core/config.py | 36 |
| **Infraestrutura** | | |
| Setup de Engine Assíncrona Híbrida (SQLite/Postgres) | backend/app/core/database.py | 6-11 |
| Gerenciamento de Migrações de Banco de Dados via Alembic | backend/alembic/env.py | 1-70 |
| Configurações Centralizadas via Pydantic BaseSettings | backend/app/core/config.py | 16-31 |
| Script de Inicialização Automatizada (Venv + Migrations) | start.sh | 14-60 |
| Registro Modular de Rotas e Tags de API no FastAPI | backend/app/main.py | 80-82 |
| Factory de Sessões de Banco de Dados com AsyncSession | backend/app/core/database.py | 13-19 |

