# Protocolo de Teste A/B de Fidelidade (Monolito vs. Modular)

> **Objetivo:** Garantir que o comportamento visual, a hierarquia de modais e a resposta de cada ação sejam 100% idênticos entre o monolito (`ideia inicial, nuca editar.html`) e o sistema modular (`index.html`).

---

## 🚀 Metodologia de Teste (Protocolo A/B)

Para cada ação do usuário, o sistema deve:
1. **Identificar o Alvo:** Selecionar o botão/elemento baseado em seu papel (ex: "Botão de Mover Produto").
2. **Executar A (Monolito):** Disparar o evento no monolito e capturar:
   - ID da página resultante (`activeSection`).
   - ID do modal aberto (`.modal-overlay.open`).
   - Logs de console.
3. **Executar B (Modular):** Disparar o mesmo evento no modular e capturar:
   - ID da página resultante.
   - ID do modal aberto.
   - Logs de console.
4. **Validar:** Se `A.ID != B.ID` ou `A.Modal != B.Modal`, registrar como **REGRESSÃO** no `ERROR_TRACKING.md`.

---

## 🛠 Script de Auditoria Automatizada

O robô de teste segue este padrão de interação:
```javascript
// Exemplo de verificação de fidelidade
const check = (desc, monolithId, modularId) => {
  if (monolithId !== modularId) {
    logError(`REGRESSÃO: ${desc} | Monolito: ${monolithId} | Modular: ${modularId}`);
  }
};
```

---

## 📋 Registro de Testes (A-B Fidelity)

| Data | Ação | Status | Desvio Detectado |
|---|---|---|---|
| 2026-04-19 | Navegação Tabs (Depot/Prod/Planta/Hist) | ✅ OK | Nenhum. Ambas apontam para o ID correto. |
| 2026-04-19 | Abertura de Gaveta (Drawer) | ✅ OK | Ambos disparam `drawer-modal`. |
| 2026-04-19 | Abertura de PDM (Detalhe Produto) | ✅ OK | Ambos disparam `prod-detail-modal`. |
| 2026-04-19 | Edição de Planta Baixa | ✅ OK | Ambos disparam `fp-shelf-modal`. |

---

## ⚠️ Regras de Ouro para a Paridade
1. **Sem "Just-in-case":** Não implementar comportamentos "melhores" ou "diferentes" do original. Se o original abre o modal X e fecha o Y, o modular DEVE fazer o mesmo.
2. **Ordem de Fechamento:** Se o monolito fecha o modal pai ao abrir um filho, nossa versão modular deve replicar essa cascata de fechamento para não lotar a tela com modais inúteis.
3. **Persistência de Estado:** O `localStorage` do sistema modular deve ser capaz de importar um dump do estado original e gerar uma interface idêntica pixel-a-pixel.
