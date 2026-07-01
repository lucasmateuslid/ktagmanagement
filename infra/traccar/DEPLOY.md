# Traccar — Deploy e Operação

Guia da infraestrutura de produção do Traccar (servidor GPS) em coexistência com
o Cloud Run do K-Tag. Complementa o `docker-compose.yml` (ambiente local).

## Arquitetura

```
Rastreador GPS físico ──TCP──► gps.<domínio>:<porta do protocolo>  (IP estático da VM)
                                     │
                          Compute Engine VM (Container-Optimized OS)
                          ├─ traccar-server  (imagem infra/traccar/Dockerfile, --network=host)
                          └─ cloudsql-proxy  (túnel para o Cloud SQL, 127.0.0.1:5432)
                                     │                         ▲
                                     │ forward.url (webhook)   │ Cloud SQL Auth Proxy (unix socket)
                                     ▼                         │
                          Cloud Run "ktag-app" (Express) ──────┘
                          └─ /api/internal/traccar/position  (X-Internal-Secret)
                                     │
                          Cloud SQL PostgreSQL
                          ├─ ktag     (schema ktag.tracker_devices)
                          └─ traccar  (schema do Traccar, via Liquibase)
```

- **Cloud Run não serve para o Traccar**: só expõe uma porta HTTP; o Traccar
  precisa de várias portas TCP cruas (5001/5020/5023/5027/5055). Por isso o
  Traccar roda numa VM Compute Engine com IP estático.
- **Escala horizontal**: o scaling horizontal oficial do Traccar (v5.4+) exige
  multicast UDP entre nós, que a VPC do GCP **não** entrega entre VMs. Use
  escala vertical (aumentar o `machine-type`) — não prometa multi-nó na GCP.

## Recursos provisionados (sandbox `saastagmanager`, validação)

| Recurso | Nome / valor |
|---|---|
| Cloud SQL Postgres 16 | `ktag-postgres` (us-central1), bancos `ktag` e `traccar` |
| IP estático da VM | `traccar-gps-ip` → **34.69.60.128** |
| VM | `traccar-server` (e2-small, COS, zona us-central1-b, tag `traccar-server`) |
| Imagem | `us-central1-docker.pkg.dev/saastagmanager/ktag/traccar-server:latest` |
| Firewall | `allow-traccar-gps` (5001/5020/5023/5027/5055 de 0.0.0.0/0), `allow-traccar-iap-ssh` e `allow-traccar-iap-8082` (só faixa IAP 35.235.240.0/20) |
| Secrets (Secret Manager) | `POSTGRES_PASSWORD`, `INTERNAL_SECRET`, `DATABASE_URL`, `TRACCAR_ADMIN_TOKEN`, `TRACCAR_ADMIN_PASS`, `KTAG_BACKEND_URL` |

Validado end-to-end: `curl "http://34.69.60.128:5055/?id=IMEI&lat=..&lon=.."`
(protocolo OsmAnd) → posição gravada no Cloud SQL. A porta 8082 (API interna)
fica bloqueada externamente; acesso só via IAP/SSH+localhost.

## Detalhes de operação da VM

- **startup-script** (metadata da instância, ver `infra/traccar/startup-script.sh`
  como referência): a cada boot faz `docker login` no Artifact Registry, puxa a
  tag `latest`, aplica regras de iptables ACCEPT para as portas GPS (o COS tem
  `INPUT policy DROP` — a firewall do GCP sozinha não basta com `--network=host`),
  sobe o `cloudsql-proxy` e o `traccar`.
- **Secrets em runtime**: lidos do Secret Manager pela service account da VM
  (`roles/secretmanager.secretAccessor` + `roles/cloudsql.client`), nunca gravados
  em disco nem em metadata.
- **Redeploy da imagem do Traccar**: `docker build`/`push` de `infra/traccar/`
  para o Artifact Registry e então `gcloud compute instances reset traccar-server`
  (o startup-script puxa a `latest` e recria os containers).
- **Bootstrap do admin (Traccar v6)**: registro aberto não cria admin
  (`administrator:true` sem sessão dá NPE). Fluxo: habilitar `registration` na
  tabela `tc_servers`, criar o 1º usuário via `POST /api/users` (auto-promovido a
  admin), reforçar `administrator=true` em `tc_users`, desabilitar `registration`,
  e gerar o token via `POST /api/session/token`. Feito uma vez; o
  `TRACCAR_ADMIN_TOKEN` está no Secret Manager.

## Passos restantes para o loop completo

1. **DNS**: criar `gps.<domínio>` → `34.69.60.128` na Cloudflare em modo
   **DNS only** (cinza, sem proxy — os protocolos GPS são TCP cru, não HTTP).
   Atualizar o secret `TRACCAR_PUBLIC_HOST` / env do Cloud Run para esse host
   (aparece na tela de cadastro de equipamentos).
2. **Deploy do backend (Cloud Run)**: fazer merge/push para acionar o
   `.github/workflows/deploy.yml`. Antes, garantir no projeto GCP os secrets do
   Secret Manager (`INTERNAL_SECRET`, `TRACCAR_ADMIN_TOKEN`, `DATABASE_URL`) e os
   GitHub Secrets `*_CLOUDSQL_INSTANCE`, `*_TRACCAR_INTERNAL_URL`
   (`http://<IP interno da VM>:8082`), `*_TRACCAR_PUBLIC_HOST`. O workflow já
   passa `--add-cloudsql-instances` e `--update-secrets` quando o
   `CLOUDSQL_INSTANCE` está presente.
   - Nota: o `TRACCAR_INTERNAL_URL` usa o **IP interno** da VM (10.128.x.x) — o
     Cloud Run precisa de um Serverless VPC Access Connector para alcançá-lo, ou
     exponha a 8082 por um caminho privado. (Sandbox: alternativa é abrir a 8082
     para a faixa do connector.)
3. **Vincular um rastreador a um veículo** no K-Tag → a Cloud Function
   `onVehicleTrackerSync` chama `/api/internal/devices/sync`, que cria o device no
   Traccar e popula `ktag.tracker_devices`. A partir daí o webhook de posição
   resolve o tenant e o LiveMap recebe as posições via WebSocket.

## Custo aproximado (sandbox)

e2-small (~US$13/mês) + Cloud SQL db-f1-micro (~US$9-15/mês) + IP estático
(grátis enquanto anexado a VM em uso). Para desligar e parar de faturar:
`gcloud compute instances stop traccar-server` e
`gcloud sql instances patch ktag-postgres --activation-policy=NEVER`.
