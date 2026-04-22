# Metodologia de Busca Cirúrgica — WMS Modular

> Criado em: 2026-04-19  
> Propósito: guiar MCP e desenvolvedor a localizar código no monolito sem ler o arquivo inteiro (290KB)

---

## O Princípio

Uma função tem **3 fronteiras naturais**:
1. **Imports** — o que ela precisa (topo do bloco ou do arquivo)
2. **Declaração** — `function nomeDaFuncao(` ou `const nomeDaFuncao =`
3. **Fechamento** — o `}` correspondente ao bloco de abertura

Usando essas 3 fronteiras conseguimos extrair cirurgicamente qualquer função sem ler o arquivo inteiro.

---

## Fluxo de Busca (PDCA aplicado)

### PLAN — Antes de tocar qualquer arquivo

```
1. Consulte MIGRATION_MAP.md
   └── Coluna "Função" → localize o nome exato
   └── Coluna "Linha no Monolito" → anote o número (ex: L4070)
   └── Coluna "Arquivo Modular" → é onde a função DEVE estar

2. Leia o arquivo modular destino
   └── Verifique se a função JÁ EXISTE
   └── Se sim: está exposta via window.*? Se não: adicionar
   └── Se não: precisa ser copiada do monolito
```

### DO — Buscando no monolito original

```
Arquivo de referência: "ideia inicial, nuca editar.html"
URL GitHub: /blob/main/ideia%20inicial%2C%20nuca%20editar.html

Passo a passo:
1. Abra o arquivo no GitHub (botão Raw ou navegue até a linha)
2. Vá até a linha indicada no MIGRATION_MAP
3. Leia ±20 linhas antes (para capturar variáveis locais e contexto)
4. Leia até encontrar o fechamento } do bloco da função
5. Identifique:
   a) Quais variáveis globais ela usa (→ verificar se estão em state.js)
   b) Quais funções ela chama (→ verificar se existem nos módulos)
   c) Se ela expõe window.nomeDaFuncao no final
```

### CHECK — Validação de coerência

```
Antes de fazer push, verificar:
□ Todos os imports no topo do arquivo destino estão corretos?
□ A função foi adicionada ao bloco de window exports no final?
□ Se a função era chamada via onclick="X" em algum HTML,
  window.X está declarado?
□ Se initController.renderAll() chama window.X,
  o módulo X expõe window.X?
□ Nenhuma outra linha do arquivo foi alterada além do necessário?
```

### ACT — Aplicar correção mínima

```
Regra de ouro: altere SOMENTE as linhas necessárias.
  - Função faltando window export → adicionar apenas a linha window.X = X
  - Função não existe → adicionar apenas o bloco da função + window export
  - Import faltando → adicionar apenas a linha de import

NUNCA reescrever o arquivo inteiro para corrigir uma linha.
```

---

## Tabela de Referência Rápida

| Sintoma | Causa provável | Onde corrigir |
|---|---|---|
| `onclick="X"` não funciona | `window.X` não declarado | Adicionar `window.X = X` no final do controller |
| `renderAll()` não atualiza view Y | `window.renderY` não declarado | Adicionar `window.renderY = renderY` no módulo Y |
| Import falha (module not found) | Caminho errado ou export faltando | Verificar caminho relativo e `export function` |
| Função existe mas usa variável `undefined` | Estado não exportado de state.js | Adicionar `export let varX` em state.js |
| `removeDepot` / `navigateToDrawer` etc não existem | Função não migrada do monolito | Consultar MIGRATION_MAP.md → linha → copiar bloco |

---

## Estrutura de Busca para o MCP

Quando o MCP precisar achar uma função no monolito:

```
# Em vez de ler o arquivo inteiro (290KB = inviável):

1. Ler MIGRATION_MAP.md (12KB) → achar a linha
2. Usar get_file_contents com página/range se disponível
3. OU usar search_code com "function nomeDaFuncao repo:leonam72/..."
4. OU usar fetch_url na URL raw com âncora de linha:
   https://raw.githubusercontent.com/leonam72/wms-controle-prateleiras/main/...

# Lógica de fronteiras para delimitar o bloco:
Início: linha com "function nomeDaFuncao" ou "async function nomeDaFuncao"
Fim:    próxima linha com apenas "}" no mesmo nível de indentação
Contexto extra: ler ±10 linhas antes para capturar variáveis locais
```

---

## Gaps Resolvidos (2026-04-19)

| Função | Estava faltando em | Corrigido em | Commit |
|---|---|---|---|
| `window.renderHistory` | `historyController.js` | `historyController.js` linha final | fix/gaps-window-exports |
| `window.navigateToDrawer` | não existia em nenhum módulo | `depotController.js` | fix/gaps-window-exports |
| `window.removeDepot` | `depotModalController.js` | `depotModalController.js` | fix/gaps-window-exports |

---

## Arquivo de Referência Arqueológica

`js/monolito-legacy.js` — não importar, não executar.  
Existe apenas como marcador e documentação de intenção.  
O código original real está em: `ideia inicial, nuca editar.html`
