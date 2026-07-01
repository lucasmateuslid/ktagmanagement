#!/bin/bash
# K-Tag Manager — startup-script da VM do Traccar (Container-Optimized OS)
#
# Roda dois containers via rede do host (--network=host):
#   1) cloud-sql-proxy — tunela até o Cloud SQL via IAM da service account da
#      VM (roles/cloudsql.client), sem expor o banco publicamente.
#   2) traccar-server — imagem customizada (infra/traccar/Dockerfile), com
#      --add-host=postgres:127.0.0.1 para reaproveitar o traccar.xml.tmpl sem
#      alteração (o template aponta para o hostname "postgres", igual ao
#      docker-compose local; aqui o proxy escuta em 127.0.0.1:5432).
#
# Segredos: lidos do Secret Manager em runtime via um container gcloud
# (autentica sozinho pela service account anexada à VM) — nunca gravados em
# metadata de instância nem em disco.
set -e

# COS: raiz é somente-leitura (/root não é gravável) — docker login precisa
# de um $HOME gravável para escrever ~/.docker/config.json.
export HOME=/tmp

# PROJECT_ID e região vêm do metadata server — o mesmo script serve sandbox e
# produção sem edição (só troque a imagem/instância se os nomes diferirem).
PROJECT_ID="$(curl -s -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/project/project-id')"
REGION="us-central1"
INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:ktag-postgres"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/ktag/traccar-server:latest"
GCLOUD_IMAGE="google/cloud-sdk:slim"

fetch_secret() {
  docker run --rm "$GCLOUD_IMAGE" \
    gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID" 2>/dev/null
}

POSTGRES_PASSWORD="$(fetch_secret POSTGRES_PASSWORD)"
INTERNAL_SECRET="$(fetch_secret INTERNAL_SECRET)"
BACKEND_URL="$(fetch_secret KTAG_BACKEND_URL || echo '')"

# Autentica o Docker do host no Artifact Registry (região us-central1-docker.pkg.dev
# não é coberta pelas credenciais automáticas do COS, diferente do gcr.io legado).
docker run --rm "$GCLOUD_IMAGE" gcloud auth print-access-token \
  | docker login -u oauth2accesstoken --password-stdin https://us-central1-docker.pkg.dev

# Sempre puxa a tag latest — sem isso, um reboot reusa a imagem cacheada e
# ignora deploys novos (a tag latest é mutável; docker run só puxa se ausente).
docker pull "$IMAGE"

# COS tem INPUT policy DROP no iptables do host. Como o Traccar roda com
# --network=host, as portas GPS precisam ser explicitamente liberadas no host
# (a firewall do GCP sozinha não basta — o pacote é dropado pelo host antes de
# chegar ao container). 8082 NÃO é liberada: fica só via SSH+localhost/IAP.
for p in 5001 5020 5023 5027 5055; do
  iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || \
    iptables -A INPUT -p tcp --dport "$p" -j ACCEPT
done

docker rm -f cloudsql-proxy traccar 2>/dev/null || true

docker run -d --name cloudsql-proxy --restart=always --network=host \
  gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.2 \
  --port=5432 "$INSTANCE_CONNECTION_NAME"

# Aguarda o proxy abrir a porta antes de subir o Traccar.
for i in $(seq 1 30); do
  (echo > /dev/tcp/127.0.0.1/5432) >/dev/null 2>&1 && break
  sleep 2
done

docker run -d --name traccar --restart=always --network=host \
  --add-host=postgres:127.0.0.1 \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e INTERNAL_SECRET="$INTERNAL_SECRET" \
  -e BACKEND_URL="$BACKEND_URL" \
  "$IMAGE"
