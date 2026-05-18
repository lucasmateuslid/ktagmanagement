# syntax=docker/dockerfile:1
# K-Tag Manager Pro — multi-tenant Cloud Run image
#
# Etapa 1: build do front-end Vite e instalação completa de deps
# Etapa 2: runtime Node minimal servindo dist/ + Express proxy
#
# Cloud Run injeta a env PORT (padrão 8080). O server lê via process.env.PORT.

# ---------- STAGE 1: build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Cache friendly: copia manifests primeiro
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copia o resto do código-fonte
COPY . .

# Vite build → produz /app/dist
RUN npm run build

# ---------- STAGE 2: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copia apenas o necessário para rodar (sem node_modules de build)
COPY --from=builder /app/package.json /app/package-lock.json ./
# tsx agora é dep de produção (precisamos dele para executar server.ts).
# npm ci --omit=dev já instala tsx no node_modules/.bin com permissões corretas.
RUN npm ci --omit=dev --no-audit --no-fund

# Bundle do front e código do servidor
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 8080

# Não rodar como root
USER node

# Chama o binário direto (sem npx) para evitar download em runtime.
CMD ["node_modules/.bin/tsx", "server.ts"]
