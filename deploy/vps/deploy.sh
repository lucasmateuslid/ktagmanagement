#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
cd "$DEPLOY_DIR"

test -f .env.vps || { echo "Crie deploy/vps/.env.vps a partir do exemplo." >&2; exit 1; }
test -f secrets/firebase-service-account.json || { echo "Service account Firebase ausente em deploy/vps/secrets/." >&2; exit 1; }

chmod 600 .env.vps secrets/firebase-service-account.json
CURRENT_IMAGE="$(docker inspect --format '{{.Config.Image}}' ktag-platform-backend-1 2>/dev/null || true)"
if [ -n "$CURRENT_IMAGE" ]; then printf '%s\n' "$CURRENT_IMAGE" > .previous-image; fi
export KTAG_IMAGE_TAG="${KTAG_IMAGE_TAG_OVERRIDE:-$(date -u +%Y%m%d%H%M%S)}"
docker compose --env-file .env.vps config --quiet

cd "$REPO_DIR"
git pull --ff-only
cd "$DEPLOY_DIR"

docker compose --env-file .env.vps build --pull backend
docker compose --env-file .env.vps up -d --remove-orphans backend

for attempt in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ktag-platform-backend-1 2>/dev/null || true)"
  if [ "$status" = healthy ]; then
    docker image prune -f --filter 'until=168h' >/dev/null
    echo "Deploy concluído: backend saudável."
    exit 0
  fi
  sleep 2
done

docker compose --env-file .env.vps logs --tail=100 backend
echo "Backend não ficou saudável. Execute ./rollback.sh para restaurar a imagem anterior." >&2
exit 1
