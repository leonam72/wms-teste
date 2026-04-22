# Regras de Desenvolvimento - WMS Agora Vai

## 1. Arquitetura Modular
- **Backend:** Proibido colocar lógica de negócio em `api/routes`. Use `services/`.
- **Frontend:** Proibido arquivos JS > 500 linhas. Use `components/` e ES Modules.
- **Database:** A ÚNICA fonte de verdade é o SQLite Relacional. Proibido snapshots JSON de estado global.

## 2. Padrões Técnicos
- **SQLAlchemy 2.0:** Use `Mapped` e `mapped_column`.
- **Async:** Todo o I/O deve ser assíncrono.
- **Frontend:** Use `textContent` em vez de `innerHTML` para dados vindos da API.

## 4. Otimização MCP (Phi4/GPU)
- **Força Bruta (Ollama MCP):** Use para digitação em massa, boilerplates extensos, CRUDs repetitivos e geração de dados fake. Se houver erro de sintaxe ou bug bobo, não peça para ele tentar de novo infinitamente.
- **Lógica Fina (Gemini):** Eu (Gemini) assumo a correção cirúrgica de bugs, ajustes de namespaces XML, correções de import circular e refatoração de alta complexidade.
- **Geração Atômica:** Mesmo para força bruta, fatie em blocos para evitar timeouts de hardware.
