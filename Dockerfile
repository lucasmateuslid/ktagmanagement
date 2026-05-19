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

# Vite injeta variáveis VITE_* no bundle no momento do build. O CI/CD passa
# esses valores via --build-arg para que a SPA conecte no Firebase correto
# (sandbox ou produção) sem precisar de configuração em runtime.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

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
