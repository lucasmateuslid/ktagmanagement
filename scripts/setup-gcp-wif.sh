#!/usr/bin/env bash
#
# Setup Workload Identity Federation (WIF) entre GitHub Actions e este projeto GCP.
#
# Roda UMA VEZ por projeto. Idempotente — pode rodar de novo sem quebrar nada.
#
# Pré-requisitos:
#   - gcloud autenticado como owner/editor do projeto: gcloud auth login
#   - projeto definido: gcloud config set project saastagmanager
#
# Saída: imprime os 3 valores que você cola em Settings → Secrets and variables → Actions
# do repositório no GitHub.

set -euo pipefail

# ── parâmetros (ajuste se trocar de repo/projeto) ─────────────────────────────
PROJECT_ID="${PROJECT_ID:-saastagmanager}"
GITHUB_REPO="${GITHUB_REPO:-lucasmateuslid/ktagmanagement}"
SA_NAME="github-actions-deployer"
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "▶ Projeto:  $PROJECT_ID (#$PROJECT_NUMBER)"
echo "▶ Repo:     $GITHUB_REPO"
echo "▶ SA:       $SA_EMAIL"
echo

# ── 1. APIs necessárias ───────────────────────────────────────────────────────
echo "▶ Habilitando APIs (pode demorar na 1ª vez)…"
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudfunctions.googleapis.com \
  eventarc.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  firebaserules.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# ── 2. Service Account dedicada ───────────────────────────────────────────────
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "▶ Criando service account $SA_EMAIL…"
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions Deployer" \
    --project="$PROJECT_ID"
else
  echo "▶ Service account $SA_EMAIL já existe (ok)."
fi

# ── 3. IAM roles ──────────────────────────────────────────────────────────────
# Roles mínimas para: Cloud Run, Artifact Registry push, deploy de Functions,
# regras Firestore, leitura de secrets em runtime.
ROLES=(
  roles/run.admin
  roles/iam.serviceAccountUser
  roles/artifactregistry.writer
  roles/storage.admin              # cache Cloud Build / Artifact Registry staging
  roles/cloudbuild.builds.editor
  roles/cloudfunctions.admin
  roles/firebase.admin
  roles/firebaserules.admin
  roles/datastore.owner            # firestore rules + indexes
  roles/secretmanager.admin        # leitura/escrita de secrets dos functions
  roles/serviceusage.serviceUsageConsumer
)

echo "▶ Concedendo IAM roles ao SA…"
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
  echo "   ✓ $ROLE"
done

# ── 4. Workload Identity Pool + Provider ──────────────────────────────────────
if ! gcloud iam workload-identity-pools describe "$POOL_NAME" \
      --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "▶ Criando WIF pool…"
  gcloud iam workload-identity-pools create "$POOL_NAME" \
    --location=global \
    --display-name="GitHub Actions Pool" \
    --project="$PROJECT_ID"
else
  echo "▶ WIF pool $POOL_NAME já existe (ok)."
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
      --workload-identity-pool="$POOL_NAME" \
      --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "▶ Criando WIF provider (restrito a $GITHUB_REPO)…"
  # repository_owner==... bloqueia forks/sequestro: só o owner real autentica.
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
    --location=global \
    --workload-identity-pool="$POOL_NAME" \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository_owner=='${GITHUB_REPO%%/*}'" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --project="$PROJECT_ID"
else
  echo "▶ WIF provider $PROVIDER_NAME já existe (ok)."
fi

# ── 5. Permite ao repo do GitHub impersonar a SA ─────────────────────────────
echo "▶ Liberando impersonation do repo $GITHUB_REPO no SA…"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}" \
  --project="$PROJECT_ID" \
  --quiet >/dev/null

# ── 6. Artifact Registry repository ───────────────────────────────────────────
REGION="us-central1"
REPO_NAME="ktag"
if ! gcloud artifacts repositories describe "$REPO_NAME" \
      --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "▶ Criando Artifact Registry repo '$REPO_NAME' em $REGION…"
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Imagens Docker do ktag-app" \
    --project="$PROJECT_ID"
else
  echo "▶ Artifact Registry '$REPO_NAME' já existe (ok)."
fi

# ── 7. Output dos secrets pra colar no GitHub ─────────────────────────────────
WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"

cat <<EOF

═══════════════════════════════════════════════════════════════════
✅ Setup concluído. Adicione estes secrets em:
   https://github.com/${GITHUB_REPO}/settings/secrets/actions

GCP_PROJECT_ID
$PROJECT_ID

GCP_WIF_PROVIDER
$WIF_PROVIDER

GCP_SERVICE_ACCOUNT
$SA_EMAIL
═══════════════════════════════════════════════════════════════════

Depois, vai em Actions → "Deploy" → "Run workflow" para o 1º deploy.
EOF
