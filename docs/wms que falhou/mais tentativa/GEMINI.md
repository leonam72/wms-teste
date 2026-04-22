# 📜 WMS Agora Vai - Local Mandates

## 🧠 Task Orchestration
- **Obsidian First:** O agente DEVE ler o cofre do Obsidian (`Engineering/`) no início de cada turno ou nova tarefa para sincronizar o status e as regras de negócio.
- **Protocolo GAP:** Seguir rigorosamente o fluxo *Think/Test -> Annotate -> Execute -> Validate -> Mark Done*.
- **Verdade Única:** As notas no Obsidian são a autoridade máxima sobre "o que deve ser feito" e "como deve funcionar".

## 🛠️ Engineering Standards
- **Modularidade:** Manter a separação entre `engines` (matemática/lógica pura) e `ui` (renderização).
- **Fidelidade Visual:** A reconstrução do mapa tático deve ser 100% fiel ao arquivo de referência `ideia inicial, nuca editar.html`.
- **Segurança:** Nunca remover as proteções JWT e Pydantic implementadas na fase de estabilização.
- **Roteamento de Agentes MCP:** Sempre que precisar delegar tarefas de criação ou refatoração de código para um modelo local (como o Phi4) através do servidor MCP do Ollama, você deve explicitamente invocar a ferramenta/namespace correspondente ao perfil 'coder' (ex: coder.generate_code). É estritamente proibido usar o namespace 'generalist' para tarefas de programação.

## 🔗 Referências
- **Repositório Principal:** https://github.com/leonam72/wms-neo
- **Repositório de Inteligência (Decupado):** https://github.com/leonam72/wms-controle-prateleiras
