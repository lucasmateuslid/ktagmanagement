#!/usr/bin/env bash
#
# Configura todos os secrets do Cloud Functions no projeto GCP alvo.
#
# Cria/atualiza no Secret Manager:
#   ASAAS_API_KEY         — API key do Asaas (você fornece)
#   ASAAS_WEBHOOK_TOKEN   — token do webhook Asaas (você fornece)
#   VAPID_PUBLIC_KEY      — pública de Web Push (auto-gera se quiser)
#   VAPID_PRIVATE_KEY     — privada de Web Push (auto-gera se quiser)
#
# Idempotente: ao re-rodar, cada secret pula automaticamente se já existir,
# ou você confirma sobrescrita. Skip simples → enter sem valor.
#
# Uso:
#   PROJECT_ID=ktagfinder-prod bash scripts/setup-functions-secrets.sh
#   PROJECT_ID=saastagmanager  bash scripts/setup-functions-secrets.sh
#
# Pré-requisitos:
#   - gcloud autenticado (gcloud auth login) ou GOOGLE_APPLICATION_CREDENTIALS
#   - firebase CLI ≥13: npm install -g firebase-tools
#   - Node + npx (já vem com o projeto)

set -euo pipefail

# ── parâmetros ────────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-}"
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi
if [ -z "$PROJECT_ID" ]; then
  cat <<EOF
ERRO: PROJECT_ID não definido. Use uma das opções:

  PROJECT_ID=ktagfinder-prod bash $0     # produção
  PROJECT_ID=saastagmanager  bash $0     # sandbox

Ou ajuste o default do gcloud:
  gcloud config set project ktagfinder-prod
EOF
  exit 1
fi

# Sanity: confirma com o usuário antes de mexer em prod por engano.
echo "▶ Projeto alvo: $PROJECT_ID"
if [ "${ASSUME_YES:-0}" != "1" ]; then
  read -r -p "  Confirmar? [y/N]: " confirm
  [[ "$confirm" =~ ^[yY] ]] || { echo "Abortado."; exit 1; }
fi
echo

# ── helpers ───────────────────────────────────────────────────────────────────

# Verifica se um secret já existe no Secret Manager do projeto.
secret_exists() {
  local name="$1"
  gcloud secrets describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1
}

# Cria/atualiza um secret a partir de um valor de stdin.
# Usa firebase CLI (que cria o secret + dá IAM correto pras functions).
write_secret() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | firebase functions:secrets:set "$name" \
    --data-file=- \
    --project "$PROJECT_ID" \
    >/dev/null
  echo "   ✓ $name salvo no Secret Manager"
}

# Prompt mascarado para um secret. Skip se enter vazio.
prompt_and_write() {
  local name="$1"
  local description="$2"

  echo "── $name ──"
  echo "  $description"

  if secret_exists "$name"; then
    read -r -p "  Já existe — sobrescrever? [y/N]: " overwrite
    [[ "$overwrite" =~ ^[yY] ]] || { echo "  ⏭  Mantido."; echo; return; }
  fi

  local value=""
  read -r -s -p "  Valor (enter vazio = pula): " value
  echo
  if [ -z "$value" ]; then
    echo "  ⏭  Pulado."
    echo
    return
  fi
  write_secret "$name" "$value"
  echo
}

# Gera novas chaves VAPID via npx web-push.
generate_vapid() {
  npx -y web-push generate-vapid-keys --json 2>/dev/null
}

# Extrai um campo de um JSON simples sem dependência externa.
json_get() {
  local key="$1"
  node -e "
    let s='';process.stdin.on('data',d=>s+=d);
    process.stdin.on('end',()=>{console.log(JSON.parse(s)['$key'])});
  "
}

# ── 1. Asaas ──────────────────────────────────────────────────────────────────
prompt_and_write "ASAAS_API_KEY" \
  "API key do Asaas. Painel Asaas → Configurações → Integrações."
prompt_and_write "ASAAS_WEBHOOK_TOKEN" \
  "Token do webhook do Asaas. Você define ao criar o webhook."

# ── 2. VAPID ──────────────────────────────────────────────────────────────────
echo "── VAPID (Web Push) ──"
vapid_action="skip"
if secret_exists VAPID_PUBLIC_KEY && secret_exists VAPID_PRIVATE_KEY; then
  read -r -p "  Já existem. [r]egerar / [m]anual / [s]kip [r/m/s]: " choice
  case "$choice" in
    r|R) vapid_action="generate" ;;
    m|M) vapid_action="manual" ;;
    *)   vapid_action="skip" ;;
  esac
else
  read -r -p "  Ausentes. [g]erar novas / [m]anual / [s]kip [g/m/s]: " choice
  case "$choice" in
    m|M) vapid_action="manual" ;;
    s|S) vapid_action="skip" ;;
    *)   vapid_action="generate" ;;
  esac
fi

case "$vapid_action" in
  generate)
    echo "  Gerando via npx web-push…"
    VAPID_JSON="$(generate_vapid)"
    if [ -z "$VAPID_JSON" ]; then
      echo "  ❌ Falha ao gerar — npx/web-push indisponíveis?"
      exit 1
    fi
    PUB="$(printf '%s' "$VAPID_JSON" | json_get publicKey)"
    PRV="$(printf '%s' "$VAPID_JSON" | json_get privateKey)"
    write_secret "VAPID_PUBLIC_KEY"  "$PUB"
    write_secret "VAPID_PRIVATE_KEY" "$PRV"
    cat <<EOF

═══════════════════════════════════════════════════════════════════════
⚠️  ATUALIZE services/pushService.ts (linha 6) com a NOVA public key:

   $PUB

E faça commit + redeploy do frontend. Sem isso, Web Push para no novo
deploy (frontend assina com chave antiga, backend não reconhece).
═══════════════════════════════════════════════════════════════════════
EOF
    ;;
  manual)
    prompt_and_write "VAPID_PUBLIC_KEY"  "Public key VAPID (base64url)."
    prompt_and_write "VAPID_PRIVATE_KEY" "Private key VAPID (base64url)."
    ;;
  skip)
    echo "  ⏭  Pulado."
    ;;
esac
echo

# ── 3. Resumo ─────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────"
echo "Secrets no projeto $PROJECT_ID:"
gcloud secrets list --project="$PROJECT_ID" \
  --format="table(name.basename(), createTime.date('%Y-%m-%d %H:%M'))" \
  --filter="name ~ (ASAAS_|VAPID_)" || true

cat <<EOF

✅ Done.

Para deployar as functions agora, o GitHub Actions já cuida via push em master.
Manualmente: firebase deploy --only functions --project $PROJECT_ID
EOF
