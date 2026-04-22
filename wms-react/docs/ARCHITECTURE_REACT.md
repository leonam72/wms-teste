# WMS React — Arquitetura e Guia para IAs

Este documento serve como a fonte da verdade sobre a arquitetura da versão React (v2) do sistema WMS. **Qualquer IA ou desenvolvedor deve ler este arquivo antes de propor mudanças arquiteturais ou adicionar novas features.**

## 1. Stack Tecnológico
- **Core:** React 18 + TypeScript + Vite.
- **Estado Global:** Zustand (com middleware `persist` para `localStorage`). *Nota: o persist pode estar temporariamente desativado para debug de loops.*
- **Estilização:** Vanilla CSS (sem Tailwind). Usamos variáveis CSS globais definidas no `src/index.css` (ex: `--accent`, `--surface`, `--danger`) para manter a estética industrial.
- **Tipagem:** Estrita. Todas as interfaces core (`Product`, `Shelf`, `Depot`, `HistoryItem`) estão centralizadas em `src/types/index.ts`.

## 2. Estrutura de Diretórios
- `/src/components/layout/`: Componentes estruturais (Header, Sidebar, NavRail).
- `/src/components/features/`: Componentes de negócio complexos agrupados por domínio (ex: `ShelfGrid`, `ProductTable`).
- `/src/store/`: Gerenciamento de estado (Zustand) e dados iniciais (`initialData.ts`).
- `/src/utils/`: Funções puras e isoladas (ex: cálculo de validade em `expiry.ts`, sanitização em `helpers.ts`). NUNCA coloque estado do React aqui.

## 3. Padrões de Projeto (Regras Estritas)
1. **Zustand como Fonte da Verdade:** Nenhum componente deve gerenciar listas de produtos ou prateleiras localmente via `useState`. Tudo deve ser lido e escrito no `useWMSStore`.
2. **Imutabilidade e Performance:** Use seletores granulares no Zustand ou `useMemo` em arrays grandes para evitar re-renderizações desnecessárias (ex: veja como o `Drawer.tsx` busca apenas seus próprios produtos).
3. **Validade (Expiries):** O status de validade ('ok', 'warn', 'expired') é calculado on-the-fly usando `src/utils/expiry.ts`. O banco armazena apenas as datas ISO (`YYYY-MM-DD`).
4. **Sem Módulos CSS (por enquanto):** Usamos classes CSS tradicionais importadas diretamente nos componentes. Evite conflitos de nome usando prefixos (ex: `.drawer-prod-name`).

## 4. Estado da Migração (do Vanilla para React)
- **Migrados:** Layout Base, `ShelfGrid`, `Drawer`, `ProductTable` (Sidebar), Lógica de Expiry, Estado Centralizado.
- **Pendentes:** 
  - Planta Baixa (Drag & Drop, Canvas, Zoom).
  - Modais (Adicionar Produto, Configurações, Edição de Gaveta).
  - Página de Histórico (Timeline).

## 5. Dicas para IAs
- **Sempre verifique o `useWMSStore`:** Se precisar alterar como um produto é salvo, modifique a `interface Product` e depois as `WMSActions` no store.
- **Cores Padrão:** Para alertas, use `.status-expired` (vermelho/danger) e `.status-warn` (amarelo/warn).
- **Ícones:** Não adicione bibliotecas de ícones pesadas (FontAwesome, etc). O projeto usa emojis padronizados (📦, 🏭, 🔴) ou SVGs simples para manter a performance máxima.
