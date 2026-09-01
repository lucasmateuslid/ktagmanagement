# syntax=docker/dockerfile:1
# K-Tag Manager — monorepo multi-stage build
#
# Stage 1: build do frontend Vite (packages/web)
# Stage 2: runtime Node minimal com Express + dist estático
#
# Cloud Run injeta PORT (padrão 8080). O server lê via process.env.PORT.

# ---------- STAGE 1: build ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Copia manifests do workspace root e de cada package
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json     ./packages/web/
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --no-audit --no-fund

# Copia código-fonte de todos os packages
COPY packages/ ./packages/
COPY constants/ ./constants/

# Firebase build-time args (injetados pelo CI via --build-arg)
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

# Build do frontend → packages/web/dist
RUN npm run build --workspace=@ktag/web

# ---------- STAGE 2: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Instala só deps de produção do backend (inclui @ktag/shared via workspace symlink)
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json  ./packages/shared/
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --workspace=@ktag/backend --workspace=@ktag/shared

# Código do servidor, shared e dist do frontend
COPY --from=builder /app/packages/backend/src ./packages/backend/src
COPY --from=builder /app/packages/shared/src  ./packages/shared/src
COPY --from=builder /app/packages/web/dist    ./dist

EXPOSE 8080

USER node

CMD ["node_modules/.bin/tsx", "packages/backend/src/server.ts"]
