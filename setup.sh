#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  K-Tag Manager Pro — Setup da stack completa com Traccar
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[PASSO $1]${NC} $2"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err()  { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

# ── Verifica pré-requisitos ──────────────────────────────────────
step 1 "Verificando pré-requisitos..."
command -v docker        >/dev/null 2>&1 || err "Docker não encontrado. Instale: https://docs.docker.com/get-docker/"
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || err "docker-compose não encontrado."
echo "✓ Docker e docker-compose disponíveis"

# ── Cria o .env a partir do .env.example ────────────────────────
step 2 "Configurando variáveis de ambiente..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Arquivo .env criado a partir de .env.example"
  warn "Edite o arquivo .env antes de continuar e troque as senhas!"
  warn "Em especial: POSTGRES_PASSWORD, REDIS_PASSWORD, TRACCAR_PASS, API_BEARER_TOKEN"
  echo -e "\nPressione ENTER para continuar após ajustar o .env (ou Ctrl+C para sair)..."
  read -r
else
  echo "✓ Arquivo .env já existe, pulando"
fi

# ── Substitui a senha no traccar.xml ────────────────────────────
step 3 "Sincronizando senha do PostgreSQL no traccar.xml..."
PG_PASS=$(grep POSTGRES_PASSWORD .env | cut -d= -f2)
sed -i "s/TROQUE_ESTA_SENHA/${PG_PASS}/g" traccar/config/traccar.xml
echo "✓ traccar.xml atualizado"

# ── Sobe os serviços de infraestrutura primeiro ─────────────────
step 4 "Subindo PostgreSQL e Redis..."
docker compose up -d postgres redis
echo "⏳ Aguardando PostgreSQL ficar saudável..."
until docker compose exec -T postgres pg_isready -U ktag >/dev/null 2>&1; do
  sleep 2; printf "."
done
echo -e "\n✓ PostgreSQL pronto"

# ── Sobe o Traccar ───────────────────────────────────────────────
step 5 "Subindo Traccar Server..."
docker compose up -d traccar
echo "⏳ Aguardando Traccar inicializar (pode levar ~60s na primeira vez)..."
for i in $(seq 1 30); do
  if docker compose exec -T traccar curl -sf http://localhost:8082/api/server >/dev/null 2>&1; then
    echo -e "\n✓ Traccar online"
    break
  fi
  sleep 3; printf "."
  if [ "$i" -eq 30 ]; then
    warn "Traccar ainda não respondeu. Verifique os logs: docker compose logs traccar"
  fi
done

# ── Sobe backend e frontend ──────────────────────────────────────
step 6 "Subindo Backend (BFF) e Frontend..."
docker compose up -d backend frontend
echo "✓ Todos os serviços iniciados"

# ── Resumo ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  K-Tag Manager Pro — Stack online!     ${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  Frontend:       http://localhost:3000"
echo "  Backend API:    http://localhost:8080"
echo "  Traccar Web:    http://localhost:8082"
echo "  PostgreSQL:     localhost:5432"
echo "  Redis:          localhost:6379"
echo ""
echo "  Credenciais Traccar padrão:"
echo "    Usuário: admin"
echo "    Senha:   (a que você definiu em TRACCAR_PASS no .env)"
echo ""
echo "  Comandos úteis:"
echo "    docker compose logs -f traccar    # logs do Traccar"
echo "    docker compose logs -f backend    # logs do backend"
echo "    docker compose down               # para tudo"
echo "    docker compose down -v            # para tudo + apaga volumes"
echo ""
