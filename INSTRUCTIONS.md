# Deploy do zero → produção

Guia ponto-a-ponto para subir o **ktagmanagement** num projeto Firebase/GCP **zerado**, do nada até estar rodando em `ktagfinder.app` (ou domínio equivalente) com CI/CD automatizado.

> Convenção do projeto:
> - **Sandbox** GCP project ID: `saastagmanager` — secrets `SAASTAGMANAGER_*`
> - **Produção** GCP project ID: `ktagfinder-prod` — secrets `KTAGFINDER_PROD_*`
>
> Este guia usa **produção** como alvo. Para sandbox, troque os nomes nos comandos.

---

## 0. Pré-requisitos locais (uma vez)

```bash
# Ferramentas
gcloud --version            # gcloud CLI
firebase --version          # Firebase CLI ≥13: npm install -g firebase-tools
node --version              # Node ≥20
gh --version                # GitHub CLI (opcional, ajuda nos secrets)

# Clone + deps
git clone git@github.com:lucasmateuslid/ktagmanagement.git
cd ktagmanagement
npm ci
(cd functions && npm ci)
```

---

## 1. Criar o projeto Firebase + GCP

1. **Firebase Console** → "Adicionar projeto" → nome `ktagfinder-prod` (ou o seu).
2. Anote o **Project ID** real (gerado pelo Firebase — pode ter sufixo numérico).
3. **Faturamento**: Plano Blaze (Cloud Functions exige). Vincule uma conta de faturamento.
4. **Authentication** → Sign-in method → habilite **Email/Password**.
5. **Firestore Database** → Criar banco → **Modo de produção** → região `us-central` (ou outra fixa — não pode mudar depois).
6. **Project Settings** → Configurações gerais → "Suas apps" → ícone Web (`</>`) → registre o app (nome `ktag-web`). Anote o objeto `firebaseConfig`:
   ```js
   { apiKey: "...", authDomain: "...", projectId: "...",
     storageBucket: "...", messagingSenderId: "...", appId: "..." }
   ```
   Você vai usar isso no passo 4.

---

## 2. Service account local (para os seeds)

Você precisa de uma chave JSON para rodar os scripts Admin SDK localmente (criar superadmin, criar tenants). **GCP/CI não precisam disso** — usam Workload Identity Federation.

1. **GCP Console** → IAM & Admin → Service Accounts → escolha **`firebase-adminsdk-...@<project>.iam.gserviceaccount.com`** (criada automaticamente pelo Firebase).
2. Aba **Keys** → Add Key → Create new key → JSON → baixa.
3. Renomeie para `serviceAccount.json` e coloque na raiz do repo.
4. **Confirme que está ignorado** pelo Git e Docker:
   ```bash
   git check-ignore -v serviceAccount.json   # deve casar com .gitignore:33
   grep -q "serviceAccount" .dockerignore && echo "ok docker"
   ```
5. Configure a env var (uma vez no shell, ou no `.zshrc`):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="$PWD/serviceAccount.json"
   ```

---

## 3. Setup automatizado do GCP (uma vez)

Roda APIs, IAM, Workload Identity Federation, e Artifact Registry. Idempotente.

```bash
gcloud auth login
gcloud config set project ktagfinder-prod

PROJECT_ID=ktagfinder-prod \
GITHUB_REPO=lucasmateuslid/ktagmanagement \
  bash scripts/setup-gcp-wif.sh
```

Saída do script: **3 valores** que você coloca no GitHub (próximo passo).

---

## 4. Configurar secrets no GitHub

Em **Settings → Secrets and variables → Actions** do repo, adicione **9 secrets** para produção:

### 4.1. Do output do `setup-gcp-wif.sh`
| Nome | Valor |
|---|---|
| `KTAGFINDER_PROD_PROJECT_ID` | linha "GCP_PROJECT_ID" |
| `KTAGFINDER_PROD_WIF_PROVIDER` | linha "GCP_WIF_PROVIDER" |
| `KTAGFINDER_PROD_SERVICE_ACCOUNT` | linha "GCP_SERVICE_ACCOUNT" |

### 4.2. Do `firebaseConfig` (passo 1.6)
| Nome | Valor |
|---|---|
| `KTAGFINDER_PROD_FIREBASE_API_KEY` | `apiKey` |
| `KTAGFINDER_PROD_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `KTAGFINDER_PROD_FIREBASE_PROJECT_ID` | `projectId` |
| `KTAGFINDER_PROD_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `KTAGFINDER_PROD_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `KTAGFINDER_PROD_FIREBASE_APP_ID` | `appId` |

### Atalho via `gh` CLI
```bash
gh secret set KTAGFINDER_PROD_FIREBASE_API_KEY --body "AIza..."
# ... repita pra cada um
```

---

## 5. Configurar secrets do Cloud Functions (automatizado)

```bash
PROJECT_ID=ktagfinder-prod \
  bash scripts/setup-functions-secrets.sh
```

O script vai pedir:

| Secret | De onde vem |
|---|---|
| `ASAAS_API_KEY` | Painel Asaas → Configurações → Integrações → API Key |
| `ASAAS_WEBHOOK_TOKEN` | Você escolhe um token aleatório forte agora (vai colar no webhook depois) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Pressione `g` (gerar) — o script auto-gera |

**Importante:** quando o script imprimir a nova `VAPID_PUBLIC_KEY`, **copie**. Você precisa dela no próximo passo.

---

## 6. Atualizar VAPID public key no frontend

Único passo manual (até automatizarmos via env var):

Edite `services/pushService.ts:6`:
```ts
const PUBLIC_VAPID_KEY = '<cole_aqui_a_nova_public_key_do_passo_5>';
```

Commit e siga adiante:
```bash
git add services/pushService.ts
git commit -m "chore(vapid): rotate public key for ktagfinder-prod"
```

---

## 7. Configurar Asaas webhook (após primeiro deploy)

Pule este passo agora e volte depois do deploy. A URL do webhook só existe quando o Cloud Functions estiver deployado.

URL será algo como:
```
https://us-central1-ktagfinder-prod.cloudfunctions.net/asaasWebhook
```

No painel Asaas → Configurações → Integrações → Notificações → adicionar webhook:
- **URL**: acima
- **Token**: o mesmo `ASAAS_WEBHOOK_TOKEN` do passo 5
- **Eventos**: `PAYMENT_*` (todos os payment events)

---

## 8. Primeiro deploy

```bash
# Sanity check local
npm run lint          # tsc --noEmit deve passar
npm run build         # vite build deve passar

# Confirme que está no master
git checkout master
git status            # deve estar limpo

# Push → dispara o workflow auto-deploy
git push -u origin master
```

Acompanhe em **GitHub → Actions → Deploy**. O job `Deploy` tem 4 sub-jobs:
1. `Type-check` — gate (tsc --noEmit)
2. `Resolve env secrets` — escolhe sandbox/prod
3. `Cloud Run` — build + push imagem + deploy
4. `Firebase Functions` — `firebase deploy --only functions`
5. `Firestore rules + indexes` — `firebase deploy --only firestore`

**Se algo falhar** no primeiro deploy, é quase sempre:
- Secret faltando no GitHub
- API GCP não habilitada (re-rode `setup-gcp-wif.sh`)
- Quota de Cloud Build esgotada (verifique GCP Console → Cloud Build → History)

---

## 9. Seeds: superadmin + primeiro tenant

Após o deploy passar com sucesso:

```bash
# Confirma que tem credencial local
echo "$GOOGLE_APPLICATION_CREDENTIALS"   # deve apontar pro serviceAccount.json

# (a) Cria o primeiro tenant com seu admin
SEED_ADMIN_PASSWORD='SenhaForteTemp123!' \
  npx tsx scripts/seed-tenants.ts \
  acme acme-admin@empresa.com "Admin Acme"

# (b) Promove você a superadmin da plataforma
#     (o email precisa já existir no Firebase Auth — passo (a) cria)
npx tsx scripts/seed-superadmin.ts acme-admin@empresa.com
```

O `seed-tenants.ts` cria:
- `/tenants/acme` (root doc)
- `/tenants/acme/users/{uid}` (admin doc, status=approved)
- `/tenants/acme/settings/config` (vazio)
- `/tenants/acme/public_settings/whitelabel` (espelho público — passo 6 do guia)
- Firebase Auth user + customClaims (`tenantId`, `role=admin`, `approved=true`)

---

## 10. Configurar domínio custom (subdomínios por tenant)

O multi-tenant funciona via **subdomínio**: `acme.ktagfinder.app` → tenant `acme`.

### 10.1. Cloud Run → mapeamento de domínio

```bash
# 1. Verifica o domínio (uma vez por domínio)
gcloud beta run domain-mappings create \
  --service=ktag-app \
  --domain=ktagfinder.app \
  --region=us-central1 \
  --project=ktagfinder-prod

# 2. Pega os registros DNS exigidos
gcloud beta run domain-mappings describe \
  --domain=ktagfinder.app \
  --region=us-central1 \
  --project=ktagfinder-prod
```

### 10.2. DNS no seu registrar

Adicione no painel do seu registrar (Cloudflare/Registro.br/etc):

| Tipo | Nome | Valor |
|---|---|---|
| A/AAAA | `@` (apex) | (valores do Cloud Run domain mapping) |
| CNAME | `*` (wildcard) | `ghs.googlehosted.com` |

> ⚠️ Wildcard subdomain é **obrigatório** para multi-tenant. Sem `*`, só o apex funciona.

### 10.3. Custom Audiences (Firebase Auth)

Firebase Console → Authentication → Settings → **Authorized domains** → adicione:
- `ktagfinder.app`
- (subdomínios são cobertos automaticamente)

---

## 11. Validação final

Abra cada URL e teste:

```
https://ktagfinder.app                  # apex landing (ApexPlaceholder)
https://admin.ktagfinder.app            # painel super admin (login com superadmin)
https://acme.ktagfinder.app             # tenant criado no seed (login com admin)
```

Checklist:
- [ ] Login funciona em `acme.ktagfinder.app`
- [ ] Whitelabel (logo/cor) carrega na tela de Login sem erros no console
- [ ] Após login, dashboard carrega
- [ ] Super admin consegue listar tenants em `admin.ktagfinder.app`
- [ ] Web Push funciona (configure no perfil → permita notificações → admin envia teste)
- [ ] Webhook Asaas configurado (passo 7)

---

## Operação contínua

### Deploys subsequentes
```bash
git checkout master
git merge <feature-branch>
git push                              # workflow dispara auto-deploy em prod
```

### Deploy só de um subset
GitHub → Actions → Deploy → "Run workflow" → escolha:
- `target`: `cloud-run` | `functions` | `firestore` | `all`
- `environment`: `production` | `sandbox`

### Rotação de secret do Asaas
```bash
PROJECT_ID=ktagfinder-prod bash scripts/setup-functions-secrets.sh
# Diga "y" para sobrescrever apenas o secret que mudou.
firebase deploy --only functions --project ktagfinder-prod   # picka a nova versão
```

### Rotação de VAPID
```bash
PROJECT_ID=ktagfinder-prod bash scripts/setup-functions-secrets.sh
# Escolha "r" para regenerar
# Copie a nova public key, edite services/pushService.ts:6, commit, push
```

### Adicionar um novo tenant
```bash
SEED_ADMIN_PASSWORD='senha-temp' \
  npx tsx scripts/seed-tenants.ts <slug> <admin@empresa.com> "Admin Nome"
```

### Backup do Firestore
```bash
gcloud firestore export gs://<bucket>/backups/$(date +%Y%m%d) \
  --project=ktagfinder-prod
```
Schedule via Cloud Scheduler para automatizar.

---

## Troubleshooting

### `PERMISSION_DENIED` na tela de Login
- O usuário Firebase Auth não tem doc em `/tenants/{slug}/users/{uid}` deste tenant.
- Verifique: `gcloud firestore documents list "tenants/<slug>/users" --project ktagfinder-prod`
- Solução: re-rode `seed-tenants.ts` ou crie o doc manualmente.

### Whitelabel não aparece (tela de login com defaults)
- Doc `/tenants/{slug}/public_settings/whitelabel` não existe ainda.
- Solução: admin entra → Settings → salva (`storage.saveSettings` espelha automaticamente).

### `Settings Fetch failed, using local cache.` em loop
- Era o bug que o commit `b267058` corrigiu. Se ainda vê, confirme que está rodando o build mais recente do master.

### Functions deploy falha com "Secret not found"
- Esqueceu de rodar `setup-functions-secrets.sh` antes do deploy.
- Solução: rode o script, depois redeploy.

### Cloud Run 503 logo após deploy
- Cold start + container demorando. Aguarde 30s.
- Se persistir: `gcloud run services logs read ktag-app --region us-central1 --project ktagfinder-prod`

### Wildcard subdomain não resolve
- DNS pode levar até 48h, mas geralmente 5 min.
- Teste: `dig acme.ktagfinder.app` → deve apontar pra `ghs.googlehosted.com`.

---

## Estrutura de secrets (referência rápida)

```
GitHub Secrets (CI/CD):
├── KTAGFINDER_PROD_PROJECT_ID
├── KTAGFINDER_PROD_WIF_PROVIDER
├── KTAGFINDER_PROD_SERVICE_ACCOUNT
├── KTAGFINDER_PROD_FIREBASE_API_KEY
├── KTAGFINDER_PROD_FIREBASE_AUTH_DOMAIN
├── KTAGFINDER_PROD_FIREBASE_PROJECT_ID
├── KTAGFINDER_PROD_FIREBASE_STORAGE_BUCKET
├── KTAGFINDER_PROD_FIREBASE_MESSAGING_SENDER_ID
└── KTAGFINDER_PROD_FIREBASE_APP_ID

GCP Secret Manager (Cloud Functions runtime):
├── ASAAS_API_KEY
├── ASAAS_WEBHOOK_TOKEN
├── VAPID_PUBLIC_KEY
└── VAPID_PRIVATE_KEY

Local (.env / shell):
└── GOOGLE_APPLICATION_CREDENTIALS  →  ./serviceAccount.json (gitignored)
```
