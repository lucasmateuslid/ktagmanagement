#!/bin/bash
# K-Tag Manager — Setup inicial do Traccar
#
# Cria o usuário admin no Traccar e gera um token de acesso.
# Salve o token no .env como TRACCAR_ADMIN_TOKEN.
#
# Uso:
#   chmod +x infra/traccar/setup.sh
#   ./infra/traccar/setup.sh
#   # ou, com credenciais customizadas:
#   TRACCAR_EMAIL=seu@email.com TRACCAR_PASS=suasenha ./infra/traccar/setup.sh

set -e

TRACCAR_URL="${TRACCAR_URL:-http://localhost:8082}"
ADMIN_EMAIL="${TRACCAR_EMAIL:-admin@ktag.local}"
ADMIN_PASS="${TRACCAR_PASS:-}"
ADMIN_NAME="${TRACCAR_NAME:-KTag Admin}"

# ── Cores ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERRO]${NC}  $1"; exit 1; }

# ── Solicitar senha se não fornecida ──────────────────────────────────────────
if [ -z "$ADMIN_PASS" ]; then
  echo -n "Senha para o admin do Traccar ($ADMIN_EMAIL): "
  read -rs ADMIN_PASS
  echo
fi

[ -z "$ADMIN_PASS" ] && error "Senha não pode ser vazia."

# ── Aguardar Traccar subir ─────────────────────────────────────────────────────
info "Aguardando Traccar em $TRACCAR_URL ..."
MAX_WAIT=120
ELAPSED=0
until curl -sf "$TRACCAR_URL/api/server" > /dev/null 2>&1; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    error "Traccar não respondeu em ${MAX_WAIT}s. Verifique: docker compose logs traccar"
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo -n "."
done
echo
success "Traccar disponível."

# ── Verificar se já existe usuário admin ──────────────────────────────────────
info "Verificando usuários existentes..."
USERS_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
  -u "$ADMIN_EMAIL:$ADMIN_PASS" \
  "$TRACCAR_URL/api/users" 2>/dev/null || echo "000")

if [ "$USERS_RESP" = "200" ]; then
  warn "Admin já existe com essas credenciais — pulando criação."
else
  # ── Criar usuário admin ──────────────────────────────────────────────────────
  info "Criando usuário admin ($ADMIN_EMAIL)..."
  CREATE_RESP=$(curl -sf -X POST "$TRACCAR_URL/api/users" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$ADMIN_NAME\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\",\"administrator\":true}" \
    2>&1) || true

  if echo "$CREATE_RESP" | grep -q '"id"'; then
    success "Admin criado com sucesso."
  elif echo "$CREATE_RESP" | grep -qi "duplicate\|exists\|already"; then
    warn "Admin já existe — continuando."
  else
    warn "Resposta inesperada ao criar admin: $CREATE_RESP"
    warn "O Traccar pode ter registrado o admin de outra forma."
  fi
fi

# ── Gerar token de API ─────────────────────────────────────────────────────────
info "Gerando token de API..."
TOKEN_RESP=$(curl -sf -X POST "$TRACCAR_URL/api/session/token" \
  -u "$ADMIN_EMAIL:$ADMIN_PASS" \
  -H "Content-Type: application/json" \
  -d '{"expiration":0}' 2>&1) || TOKEN_RESP=""

# Traccar retorna o token como string plana (sem JSON wrapper)
TOKEN=$(echo "$TOKEN_RESP" | tr -d '"' | tr -d '\n' | xargs)

if [ -z "$TOKEN" ] || echo "$TOKEN" | grep -q "error\|Error\|401"; then
  warn "Não foi possível gerar token automático."
  warn "Gere manualmente: curl -X POST $TRACCAR_URL/api/session/token -u '$ADMIN_EMAIL:SENHA'"
else
  success "Token gerado."
  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  TOKEN GERADO — adicione ao seu .env:${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  TRACCAR_ADMIN_TOKEN=$TOKEN"
  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"

  # Atualizar .env se existir
  ENV_FILE="$(dirname "$0")/../../.env"
  if [ -f "$ENV_FILE" ]; then
    if grep -q "^TRACCAR_ADMIN_TOKEN=" "$ENV_FILE"; then
      sed -i "s|^TRACCAR_ADMIN_TOKEN=.*|TRACCAR_ADMIN_TOKEN=$TOKEN|" "$ENV_FILE"
      success ".env atualizado com o novo token."
    else
      echo "TRACCAR_ADMIN_TOKEN=$TOKEN" >> "$ENV_FILE"
      success "Token adicionado ao .env."
    fi
  fi
fi

echo ""
info "Setup concluído. Próximos passos:"
echo "  1. Confirme o token no .env: TRACCAR_ADMIN_TOKEN=..."
echo "  2. Execute: ./scripts/validate.sh"
echo "  3. Painel interno Traccar (dev): $TRACCAR_URL"
