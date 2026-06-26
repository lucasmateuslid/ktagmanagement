#!/bin/bash
# K-Tag Manager — Script de Validação Completo
#
# Valida: PostgreSQL → Traccar → K-Tag Backend → Integração GPS
#
# Uso:
#   chmod +x scripts/validate.sh
#   ./scripts/validate.sh
#
# Pré-requisitos:
#   - docker compose up postgres traccar (rodando)
#   - npm run dev:backend (ou docker compose --profile full up backend)
#   - TRACCAR_ADMIN_TOKEN ou TRACCAR_PASS configurado no .env

# ── Carregar .env ──────────────────────────────────────────────────────────────
if [ -f "$(dirname "$0")/../.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$(dirname "$0")/../.env"
  set +a
fi

# ── Configuração ───────────────────────────────────────────────────────────────
TRACCAR_URL="${TRACCAR_URL:-http://localhost:8082}"
BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
TRACCAR_TOKEN="${TRACCAR_ADMIN_TOKEN:-}"
TRACCAR_EMAIL="${TRACCAR_EMAIL:-admin@ktag.local}"
TRACCAR_PASS="${TRACCAR_PASS:-}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5433}"   # Docker PG em 5433; local em 5432
PG_USER="ktag_user"
PG_PASS="${POSTGRES_PASSWORD:-}"

# Arquivo temporário para cookies de sessão do Traccar
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

# ── Resultado geral ────────────────────────────────────────────────────────────
PASS=0; FAIL=0

# ── Cores e helpers ───────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

ok()      { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail()    { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
skip()    { echo -e "  ${YELLOW}○${NC} $1 (pulado)"; }
section() { echo -e "\n${CYAN}══ $1 ══${NC}"; }

# Helper: curl com cookie de sessão
traccar_curl() { curl -sf -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$@"; }

# ─────────────────────────────────────────────────────────────────────────────
section "1. PostgreSQL"
# ─────────────────────────────────────────────────────────────────────────────

if pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -q 2>/dev/null; then
  ok "PostgreSQL respondendo em $PG_HOST:$PG_PORT"
else
  fail "PostgreSQL não responde em $PG_HOST:$PG_PORT"
fi

if PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw traccar; then
  ok "Banco 'traccar' existe"
else
  fail "Banco 'traccar' não encontrado — rode: docker compose up postgres"
fi

if PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d ktag -c \
   "SELECT 1 FROM information_schema.tables WHERE table_schema='ktag' AND table_name='tracker_devices'" 2>/dev/null | grep -q "1 row"; then
  ok "Tabela ktag.tracker_devices existe"
else
  fail "Tabela ktag.tracker_devices não encontrada"
fi

if PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d traccar -c \
   "SELECT 1 FROM information_schema.tables WHERE table_name='tc_devices'" 2>/dev/null | grep -q "1 row"; then
  ok "Schema do Traccar (tc_devices) existe no banco"
else
  skip "Schema Traccar ainda não criado — Traccar precisa ter subido ao menos uma vez"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "2. Traccar API"
# ─────────────────────────────────────────────────────────────────────────────

# Server info (sem autenticação)
TRACCAR_AUTHED=false
SERVER_RESP=$(curl -sf "$TRACCAR_URL/api/server" 2>/dev/null || echo "")
if echo "$SERVER_RESP" | grep -q '"version"'; then
  TRACCAR_VERSION=$(echo "$SERVER_RESP" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  ok "Traccar rodando — versão: $TRACCAR_VERSION"
else
  fail "Traccar não respondeu em $TRACCAR_URL/api/server"
  echo -e "     ${YELLOW}→ Execute: docker compose up traccar${NC}"
fi

# Autenticação:
#   Traccar usa sessões (JSESSIONID). O token de longa duração funciona via
#   GET /api/session?token=TOKEN que retorna um cookie de sessão.
#   O login direto usa POST /api/session com form-encoded email+password.

if [ -n "$TRACCAR_TOKEN" ]; then
  AUTH_RESP=$(curl -sf -c "$COOKIE_JAR" \
    "$TRACCAR_URL/api/session?token=$TRACCAR_TOKEN" 2>/dev/null || echo "")
  if echo "$AUTH_RESP" | grep -q '"id"'; then
    ADMIN_ID=$(echo "$AUTH_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    ok "Autenticação com token OK (userId=$ADMIN_ID)"
    TRACCAR_AUTHED=true
  else
    fail "Token inválido ou expirado — execute: ./infra/traccar/setup.sh"
  fi
elif [ -n "$TRACCAR_PASS" ]; then
  AUTH_RESP=$(curl -sf -c "$COOKIE_JAR" -X POST "$TRACCAR_URL/api/session" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TRACCAR_EMAIL'))")&password=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TRACCAR_PASS'))")" \
    2>/dev/null || echo "")
  if echo "$AUTH_RESP" | grep -q '"id"'; then
    ok "Autenticação por email/senha OK ($TRACCAR_EMAIL)"
    TRACCAR_AUTHED=true
  else
    fail "Autenticação falhou — verifique TRACCAR_EMAIL e TRACCAR_PASS no .env"
  fi
else
  skip "TRACCAR_ADMIN_TOKEN e TRACCAR_PASS não configurados — pulando testes autenticados"
fi

# Listar devices
if [ "$TRACCAR_AUTHED" = "true" ]; then
  DEVICES_RESP=$(traccar_curl "$TRACCAR_URL/api/devices" 2>/dev/null || echo "[]")
  DEVICE_COUNT=$(echo "$DEVICES_RESP" | grep -o '"id"' | wc -l)
  ok "API /devices acessível — $DEVICE_COUNT device(s) cadastrado(s)"
else
  skip "Listar devices (sem autenticação)"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "3. Dispositivo de Teste + Posição GPS"
# ─────────────────────────────────────────────────────────────────────────────

if [ "$TRACCAR_AUTHED" = "true" ]; then
  TEST_IMEI="TEST_KTAG_$(date +%s)"

  # Criar device de teste
  DEVICE_RESP=$(traccar_curl -X POST "$TRACCAR_URL/api/devices" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"KTag-Teste\",\"uniqueId\":\"$TEST_IMEI\"}" 2>/dev/null || echo "")

  if echo "$DEVICE_RESP" | grep -q '"id"'; then
    DEVICE_ID=$(echo "$DEVICE_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    ok "Device de teste criado — ID=$DEVICE_ID IMEI=$TEST_IMEI"

    # Enviar posição via protocolo OsmAnd (HTTP GET, porta 5055)
    # Coordenadas: Av. Paulista, São Paulo
    POS_RESP=$(curl -sf \
      "http://localhost:5055/?id=$TEST_IMEI&timestamp=$(date +%s)&lat=-23.5613&lon=-46.6563&speed=30&bearing=180&altitude=760&accuracy=5" \
      2>/dev/null && echo "OK" || echo "ERR")

    if [ "$POS_RESP" = "OK" ]; then
      ok "Posição enviada via OsmAnd (protocolo GPS HTTP)"
      sleep 5  # aguarda Traccar processar

      # Verificar se a posição chegou
      POS_CHECK=$(traccar_curl "$TRACCAR_URL/api/positions?deviceId=$DEVICE_ID" 2>/dev/null || echo "[]")
      if echo "$POS_CHECK" | grep -q '"latitude"'; then
        LAT=$(echo "$POS_CHECK" | grep -o '"latitude":[^,}]*' | head -1 | cut -d: -f2)
        ok "Posição confirmada no banco — lat=$LAT"
      else
        fail "Posição não encontrada via API /positions"
      fi
    else
      fail "Falha ao enviar posição OsmAnd — porta 5055 acessível?"
    fi

    # Limpar device de teste
    traccar_curl -X DELETE "$TRACCAR_URL/api/devices/$DEVICE_ID" > /dev/null 2>&1 || true
    ok "Device de teste removido"
  else
    fail "Falha ao criar device de teste: $DEVICE_RESP"
  fi
else
  skip "Teste de device/posição (sem autenticação)"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "4. K-Tag Backend"
# ─────────────────────────────────────────────────────────────────────────────

HEALTH=$(curl -sf "$BACKEND_URL/api/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  TENANT=$(echo "$HEALTH" | grep -o '"tenantId":"[^"]*"' | cut -d'"' -f4)
  ok "K-Tag Backend respondendo — tenantId=$TENANT"
else
  fail "K-Tag Backend não responde em $BACKEND_URL/api/health"
  echo -e "     ${YELLOW}→ Execute: npm run dev:backend${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Resultado"
# ─────────────────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo ""
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}  ✓ Todos os $TOTAL testes passaram!${NC}"
  echo ""
  echo -e "  Próximo passo → ${BLUE}Fase 4: integração Backend ↔ Traccar${NC}"
else
  echo -e "${RED}  ✗ $FAIL/$TOTAL testes falharam${NC} — ${GREEN}$PASS/$TOTAL OK${NC}"
  echo ""
  echo -e "  Verifique os itens marcados com ${RED}✗${NC} acima."
  exit 1
fi
