#!/usr/bin/env bash
set -Eeuo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"
test -f .env.vps || { echo ".env.vps ausente." >&2; exit 1; }
test -f .previous-image || { echo "Nenhuma imagem anterior registrada." >&2; exit 1; }
PREVIOUS_IMAGE="$(tr -d '\r\n' < .previous-image)"
test -n "$PREVIOUS_IMAGE" || { echo "Registro de imagem anterior vazio." >&2; exit 1; }
docker image inspect "$PREVIOUS_IMAGE" >/dev/null
export KTAG_IMAGE_TAG="${PREVIOUS_IMAGE##*:}"
docker compose --env-file .env.vps up -d --no-build backend
echo "Rollback iniciado para $PREVIOUS_IMAGE"
