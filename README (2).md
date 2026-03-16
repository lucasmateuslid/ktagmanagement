# K-Tag Manager Pro — Stack Completa com Traccar

Guia passo a passo para subir toda a stack em Docker:
**PostgreSQL + Redis + Traccar Server + Backend BFF + Frontend SPA**.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Download |
|---|---|---|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2+ | (incluído no Docker Desktop) |

---

## Estrutura de arquivos adicionados

```
ktag-stack/                       ← raiz
├── docker-compose.yml            ← orquestra todos os serviços
├── .env.example                  ← modelo de variáveis (copiar para .env)
├── setup.sh                      ← script de inicialização automática
│
├── traccar/
│   └── config/
│       └── traccar.xml           ← configuração do Traccar (porta, DB, protocolos)
│
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── services/
│       │   └── traccar.ts        ← cliente TypeScript para a API REST do Traccar
│       └── routes/
│           └── traccar.routes.ts ← rotas Express expostas ao frontend
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        └── hooks/
            └── useTraccar.ts     ← hook React com polling ao vivo
```

---

## Passo 1 — Copiar os arquivos para o projeto

Copie cada arquivo para o seu repositório respeitando os caminhos acima.

Os arquivos novos se integram ao projeto **sem modificar** os existentes — apenas adicione.

---

## Passo 2 — Configurar o .env

```bash
cp .env.example .env
```

Edite o `.env` e troque **obrigatoriamente**:

| Variável | O que é |
|---|---|
| `POSTGRES_PASSWORD` | Senha do banco PostgreSQL |
| `REDIS_PASSWORD` | Senha do Redis |
| `TRACCAR_PASS` | Senha do admin do Traccar |
| `API_BEARER_TOKEN` | Token que o frontend usa para chamar o BFF |
| `SESSION_TOKEN_SECRET` | Secret para assinar tokens de sessão |
| `ADMIN_EMAIL` | E-mail do administrador |

> **Importante:** a mesma `POSTGRES_PASSWORD` precisa estar no `.env` e no `traccar/config/traccar.xml`.
> O `setup.sh` faz isso automaticamente. Se subir manualmente, edite o XML também.

---

## Passo 3 — Iniciar a stack

### Opção A — Script automático (recomendado)

```bash
bash setup.sh
```

O script:
1. Verifica Docker e docker-compose
2. Cria o `.env` se não existir
3. Sincroniza a senha no `traccar.xml`
4. Sobe PostgreSQL e Redis (aguarda healthcheck)
5. Sobe o Traccar e aguarda inicialização
6. Sobe o Backend e Frontend

### Opção B — Manual

```bash
# 1. Infra
docker compose up -d postgres redis

# 2. Traccar (aguarde ~60s na primeira vez — ele cria as tabelas)
docker compose up -d traccar

# 3. Aplicação
docker compose up -d backend frontend
```

---

## Passo 4 — Registrar rotas no backend

No arquivo `backend/src/index.ts` (ou onde estão as outras rotas), adicione:

```typescript
import traccarRoutes from './routes/traccar.routes';

// Junto com as outras rotas:
app.use('/api/traccar', traccarRoutes);
```

---

## Passo 5 — Configurar o primeiro admin no Traccar

1. Acesse **http://localhost:8082**
2. Faça login com `admin` / senha do `.env` (TRACCAR_PASS)
3. Vá em **Configurações → Conta** e troque a senha padrão
4. Cadastre os dispositivos em **Dispositivos → +**

---

## Passo 6 — Usar o hook no frontend

### Mapa ao vivo (substitui o polling manual do LiveMap.tsx)

```tsx
import { useTraccar } from '../hooks/useTraccar';

export function LiveMap() {
  const { devices, positions, loading, error } = useTraccar(30_000); // polling 30s

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error} />;

  return (
    <MapContainer>
      {positions.map(pos => (
        <Marker key={pos.deviceId} position={[pos.latitude, pos.longitude]}>
          <Popup>
            {devices.find(d => d.id === pos.deviceId)?.name}
            <br />
            {pos.speed} km/h · {pos.attributes.ignition ? 'Ligado' : 'Desligado'}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

### Histórico de rota

```tsx
import { useTraccarHistory } from '../hooks/useTraccar';

const { history } = useTraccarHistory(
  deviceId,
  new Date('2025-01-01'),
  new Date('2025-01-02'),
);
```

---

## Endpoints disponíveis no BFF

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/traccar/server` | Health check do Traccar |
| GET | `/api/traccar/devices` | Lista dispositivos |
| GET | `/api/traccar/positions` | Posições atuais |
| GET | `/api/traccar/positions/history` | Histórico `?deviceId&from&to` |
| GET | `/api/traccar/geofences` | Lista geofences |
| POST | `/api/traccar/geofences` | Cria geofence |
| DELETE | `/api/traccar/geofences/:id` | Remove geofence |
| GET | `/api/traccar/events` | Eventos `?deviceId&from&to` |

Todos os endpoints exigem `Authorization: Bearer <API_BEARER_TOKEN>`.

---

## Comandos úteis

```bash
# Ver todos os serviços
docker compose ps

# Logs em tempo real
docker compose logs -f traccar
docker compose logs -f backend

# Reiniciar um serviço
docker compose restart traccar

# Parar tudo (preserva dados)
docker compose down

# Parar tudo e apagar volumes (CUIDADO: apaga banco)
docker compose down -v

# Acessar o PostgreSQL diretamente
docker compose exec postgres psql -U ktag -d ktagmanagement

# Acessar o Redis
docker compose exec redis redis-cli -a SUA_SENHA_REDIS
```

---

## Portas dos protocolos GPS

O Traccar está configurado para receber dispositivos nestes protocolos:

| Porta | Protocolo | Dispositivos comuns |
|---|---|---|
| 5055 | OsmAnd | Aplicativos mobile |
| 5001 | Teltonika | FMB120, FMB140, FMT100 |
| 5013 | Queclink | GV55, GL300, GMT100 |
| 5023 | Coban | TK103, TK303 |
| 5093 | Wialon IPS | Plataformas Wialon |

Para adicionar outros protocolos, edite `traccar/config/traccar.xml` e consulte:
https://www.traccar.org/documentation/

---

## Diagrama da stack

```
Dispositivos GPS
      │ TCP/UDP
      ▼
 Traccar Server (:8082)
      │ REST API
      ▼
 Backend BFF (:8080)  ←──── Frontend SPA (:3000)
      │                            │
      ├── PostgreSQL (:5432)       └── Firestore (legado/offline)
      └── Redis (:6379)
```
