# syntax=docker/dockerfile:1
# K-Tag Backend — Express API
#
# Cloud Run injeta PORT (padrão 8080). O server lê via process.env.PORT.

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src/ ./src/

EXPOSE 8080

USER node

CMD ["node_modules/.bin/tsx", "src/server.ts"]
