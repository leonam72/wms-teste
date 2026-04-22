# Guia de Inicialização do WMS

Este guia descreve como subir o servidor backend e o frontend React para o WMS, garantindo a sincronização do banco de dados.

## Pré-requisitos
- Node.js (v20+)
- npm

## 1. Preparação do Backend
O backend utiliza SQLite e Prisma v5 para maior estabilidade.

```bash
cd wms-backend

# Instalar dependências (Garante Prisma v5)
npm install

# Sincronizar o esquema com o banco de dados (SQLite)
npx prisma db push

# Gerar o cliente Prisma
npx prisma generate

# Popular o banco com dados iniciais (Seed)
npx tsx prisma/seed.ts

# Iniciar o servidor
npx tsx src/server.ts
```
*O backend rodará em: `http://localhost:3001`*

## 2. Preparação do Frontend
O frontend é uma aplicação React utilizando Vite.

```bash
cd wms-react

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```
*O frontend rodará em: `http://localhost:5173`*

## 3. Comandos Rápidos (Terminal Único)

Se desejar rodar ambos em paralelo (e possuir o `tsx` global ou via npx):

**Backend:** `cd wms-backend && npx tsx src/server.ts`
**Frontend:** `cd wms-react && npm run dev`

---
**Nota de Auditoria:** Caso o Prisma apresente erro de versão (v7), execute `npm install prisma@5 @prisma/client@5` na pasta do backend para restaurar a compatibilidade com o esquema atual.
