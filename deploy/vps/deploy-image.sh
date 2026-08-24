#!/usr/bin/env bash
set -Eeuo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_REPOSITORY="${1:?Uso: deploy-image.sh REPOSITORY TAG}"
IMAGE_TAG="${2:?Uso: deploy-image.sh REPOSITORY TAG}"

cd "$DEPLOY_DIR"
test -f .env.vps || { echo ".env.vps ausente." >&2; exit 1; }
test -f secrets/firebase-service-account.json || { echo "Service account Firebase ausente." >&2; exit 1; }
chmod 600 .env.vps secrets/firebase-service-account.json
# A imagem roda como USER node (UID/GID 1000). O bind mount preserva o dono do
# arquivo no host, então root:root 0600 impede o Firebase Admin de lê-lo.
chown 1000:1000 secrets/firebase-service-account.json

CURRENT_IMAGE="$(docker inspect --format '{{.Config.Image}}' ktag-platform-backend-1 2>/dev/null || true)"
if [ -n "$CURRENT_IMAGE" ]; then printf '%s\n' "$CURRENT_IMAGE" > .previous-image; fi

cd "$DEPLOY_DIR"
export KTAG_IMAGE_REPOSITORY="$IMAGE_REPOSITORY" KTAG_IMAGE_TAG="$IMAGE_TAG"
docker compose --env-file .env.vps config --quiet
docker compose --env-file .env.vps pull backend worker
docker compose --env-file .env.vps up -d --no-build --remove-orphans backend worker

for attempt in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ktag-platform-backend-1 2>/dev/null || true)"
  if [ "$status" = healthy ]; then
    worker_status="$(docker inspect --format '{{.State.Status}}' ktag-platform-worker-1 2>/dev/null || true)"
    if [ "$worker_status" != running ]; then
      sleep 2
      continue
    fi
    echo "Deploy concluído: ${IMAGE_REPOSITORY}:${IMAGE_TAG} saudável."
    exit 0
  fi
  sleep 2
done
docker compose --env-file .env.vps logs --tail=100 backend worker
echo "Nova versão não ficou saudável; execute ./rollback.sh." >&2
exit 1
