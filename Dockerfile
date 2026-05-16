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
RUN npm ci --omit=dev --no-audit --no-fund

# tsx é dev dep no projeto; precisamos dele em runtime porque server.ts é TS.
# Solução: instala apenas tsx (e seu peer) sem voltar a instalar devDependencies.
RUN npm i --no-save --no-audit --no-fund tsx@4

# Bundle do front e código do servidor
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/lib ./lib

EXPOSE 8080

# Não rodar como root
USER node

CMD ["npx", "tsx", "server.ts"]
