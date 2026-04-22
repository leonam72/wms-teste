# WMS Pro - Guia Mestre de Operação (Gemini CLI)

Este arquivo consolida as regras globais do ambiente e as diretrizes específicas da arquitetura WMS-Pro.

---

## 1. Regras Operacionais (Globais)

### Prioridade de Ferramentas (Economia de Tokens/GPU)
1. **Sem Ollama:** `find_files`, `count_tokens`, `git_summary`, `summarize_directory`, `run_command`, `http_get`.
2. **Com Ollama:** `summarize_file`, `analyze_log`, `generate_code`, `refactor_code`.
3. **Contexto Gemini:** Leitura direta de arquivos (usar apenas para arquivos < 200 linhas).

### Fluxo de Trabalho
- **Antes de editar:** `find_files` (confirmar existência) -> `count_tokens` (decidir se lê ou delega) -> `list_symbols` (mapear módulo).
- **Busca:** SEMPRE passar o path do projeto específico em `search_in_files` para evitar varrer `node_modules`.
- **Debugging:** `run_command` para reproduzir -> `analyze_stderr` -> `search_in_files` para localizar -> Propor correção.

---

## 2. Fluxo de Uso da IA Local (Contexto Cirúrgico)

Para garantir aproveitamento > 90% do Ollama/Qwen:

1. **Mapeamento Prévio:** Antes de gerar ou refatorar, ler os modelos (`.py`) envolvidos.
2. **Injeção de Contexto:** No parâmetro `context`, passar o schema real (campos, tipos, relações). **NUNCA gerar código baseado em suposições.**
3. **Referência de Estilo:** Fornecer exemplo de função existente para replicar padrões de logs e erros do projeto.
4. **Validação:** Tratar o output como rascunho e validar atributos/imports antes da aplicação final.

---

## 3. Diretrizes de Arquitetura WMS-Pro

### Padrões de Dados
- **Banco Híbrido:** Consistência obrigatória entre o Relacional (`StockItem`, `LicensePlate`, `Task`) e o Snapshot JSON (`SyncState`).
- **LPN (License Plate Number):** Uso sistemático de identificadores de volume para movimentação em massa.
- **Task Engine:** Toda operação de chão de fábrica deve ser dirigida por registros na tabela `tasks`.

### Lógica de Negócio (Slotting)
- **Consolidação:** Priorizar gavetas com o mesmo SKU.
- **Giro ABC:** Produtos de alto giro em andares baixos (F1, F2).
- **Qualidade:** Segregação estrita entre áreas 'normal' e 'quarantine'.

---

## 4. Checklist de Finalização de Tarefa
- [ ] O código segue o estilo do projeto?
- [ ] O banco relacional e o JSON do SyncState estão sincronizados?
- [ ] Foi gerado log de auditoria (`AuditLog`)?
- [ ] Testou a rota via `http_get` ou script de fumaça?
