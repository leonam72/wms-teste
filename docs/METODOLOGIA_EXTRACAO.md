# Metodologia de Busca e Extração (GAP-EXT-001)

> [!abstract] Objetivo
> Definir o protocolo padrão para extração de blocos lógicos gigantescos de monolitos (ex: `ideia inicial.html`) para arquivos modulares ES6 sem sobrecarregar a janela de contexto ou gerar alucinações da IA.

## 🧠 Lógica de Borda Funcional (Function Boundaries)

O maior erro ao extrair código é "cortar" funções pela metade. Para evitar isso, a IA deve mapear rigorosamente o início e o fim de cada função.

### 1. Assinatura Inicial (Start Bound)
A busca (grep/leitura) deve sempre mirar na declaração exata mapeada no `MIGRATION_MAP.md`.
*   **Padrões Comuns:** `function nomeDaFuncao(`, `const nomeDaFuncao = (`, `let nomeDaFuncao = function(`.
*   *Exemplo:* Para achar `showConfirm`, a busca exata é `function showConfirm(`.

### 2. Fechamento de Chaves (End Bound)
A leitura nunca deve se basear apenas em um "número fixo de linhas adicionais" (ex: "leia mais 50 linhas"). A leitura deve terminar EXATAMENTE onde o bloco da função se encerra.
*   **O Desafio do Aninhamento:** O código original tem chaves dentro de chaves (if, for, map, Promise).
*   **Protocolo Visual/Lógico:** A IA deve ler o arquivo em "janelas" (chunks) de 200 linhas a partir da assinatura inicial. Se a função não terminar nessas 200 linhas, a IA deve ler o *próximo* chunk (201-400), e assim por diante, até identificar a chave final `}` que não possui indentação (ou que corresponde à indentação da assinatura inicial).

### 3. A Técnica do "Buffer em Disco"
Para não se perder de contexto e economizar tokens, a IA não deve tentar memorizar o arquivo todo.
1.  **Ler:** Localiza a função X (Linhas 150 a 185).
2.  **Copiar:** Extrai apenas o texto entre as linhas 150 e 185.
3.  **Filtrar:** O que já foi mapeado com sucesso (Início/Fim confirmados) é anotado no Obsidian como "MAP: L150-185". Se estivéssemos refatorando, poderíamos virtualmente "apagar" isso do nosso buffer mental, sabendo que já foi resolvido.

## 🔍 O Processo de Checagem Cruzada
1.  Ler o `INVENTARIO_JS.md` para saber qual arquivo analisar.
2.  Verificar os `imports` no topo do arquivo modular para garantir que não faltam dependências.
3.  Ler as funções do arquivo modular e verificar se o corpo lógico existe (não é stub).
4.  Se faltar lógica, ir ao Monolito usando a *Lógica de Borda Funcional* para encontrar o código exato.
5.  Anotar o status atualizado no Obsidian.
