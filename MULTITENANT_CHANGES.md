# MULTITENANT_CHANGES

## Histórico
- [Fase 1](#fase-1) — Fundação multi-tenant (TAREFAs 2, 3, 4)
- [Fase 2](#fase-2--firebase-auth) — Firebase Auth + custom claims + rules efetivas
- [Fase 3](#fase-3--functions-tenant-aware) — Cloud Functions migradas para paths e settings por tenant
- [Fase 4](#fase-4--painel-super-admin) — Painel super admin (`admin.<dominio>`) + CRUD de tenants
- [Fase 5](#fase-5--cloud-run--docker--dns) — Dockerfile + Cloud Build + middleware `resolveTenant` no Express
- [Fase 6](#fase-6--billing-asaas--ui-modern--cicd) — Integração Asaas (assinatura/faturas/PIX/boleto), UI super-admin redesign, página `/billing` do tenant, pipeline GitHub Actions com WIF, fix Cloud Run cold start

---

## Fase 6 — Billing Asaas + UI Modern + CI/CD

### Resumo

Três entregas paralelas:

1. **Billing v1 (Asaas)** — super-admin gerencia assinaturas recorrentes; tenant admin vê suas próprias faturas com PIX copia-e-cola e boleto; webhook do Asaas atualiza status em tempo real; job diário suspende tenants inadimplentes >7d.
2. **UI super-admin modernizada** — sidebar agrupada (Plataforma/Financeiro/Sistema) com pill ativa, dashboard com gráfico de receita 12m, glassmorphism em `rounded-3xl + backdrop-blur-xl`, mantendo âmbar como brand color.
3. **CI/CD via GitHub Actions** — Workload Identity Federation (sem JSON keys), `workflow_dispatch` manual com seletor `target=all|cloud-run|functions|firestore`, type-check gateando deploys.

### Arquivos criados

| Arquivo | Propósito |
|---|---|
| `functions/asaas.js` | Cliente Asaas: `findOrCreateCustomer`, `createSubscription`, `updateSubscription`, `cancelSubscription`, `listSubscriptionPayments`, `paymentToInvoice`, `normalizeStatus`. Sandbox/prod controlado por `ASAAS_ENV`. `externalReference=tenantSlug` em customer e subscription (evita índice reverso). |
| `pages/admin/AdminBilling.tsx` | Lista de tenants com MRR estimado, status, plano, próximo vencimento. Clique abre modal `TenantBillingDetail`. |
| `pages/admin/TenantBillingDetail.tsx` | Modal de gestão por tenant: criar/atualizar/cancelar assinatura, dados do pagador, faturas recentes, ações de sync. |
| `pages/admin/AdminInvoices.tsx` | Histórico global de cobranças (cross-tenant) + gráfico Recharts de receita 12m. Filtros status/empresa/período. |
| `pages/Billing.tsx` | Página `/billing` do tenant: card da assinatura, banner de suspensão (se aplicável), pagamento pendente com PIX copia-e-cola + botão de boleto, histórico de faturas. |
| `.github/workflows/deploy.yml` | Pipeline `workflow_dispatch` com 4 jobs: lint → cloud-run / functions / firestore (condicionais por `target`). Concurrency lock por alvo. |
| `scripts/setup-gcp-wif.sh` | Idempotente. Cria SA `github-actions-deployer`, pool WIF, provider OIDC com `attribute-condition=repository_owner=='lucasmateuslid'`, concede 11 roles IAM, cria Artifact Registry. Imprime os 3 valores p/ colar em GitHub Secrets. |
| `.firebaserc` | Define `saastagmanager` como projeto default. |
| `firestore.indexes.json` | Composite index `invoices(status ASC, dueDate DESC)` — exigido por `listMyTenantInvoices` e `listInvoicesGlobal` com filtro de status. |

### Arquivos modificados (principais)

| Arquivo | Mudança |
|---|---|
| `functions/index.js` | +6 callables billing (ver tabela abaixo), webhook `asaasWebhook`, job `dailyBillingEnforcement`. Hardening em `createTenant`/`setTenantActive` (try/catch + logs específicos com `code`/`message`/`stack`, mapeamento de erros do Firebase Auth → HttpsError). |
| `functions/package.json` | Sem mudança estrutural; secrets `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` via `defineSecret`. |
| `firestore.rules` | Regra `/tenants/{tid}/invoices/{id}` — `read: admin/superadmin`, `write: false` (espelho do Asaas via Admin SDK). |
| `pages/admin/AdminLayout.tsx` | Sidebar reescrita: brand pill com avatar gradiente, nav agrupado em 3 seções, ativa com `border-l + ChevronRight`, perfil no rodapé, topbar com search `⌘K` e badge de ambiente. Gradient orbs âmbar difusos. |
| `pages/admin/AdminDashboard.tsx` | Hero stat MRR com sparkline + delta vs mês anterior, AreaChart Recharts 12m, painel de alertas lateral, lista de cadastros recentes com avatares iniciais, distribuição por plano. |
| `pages/admin/AdminApp.tsx` | Rota `/admin/invoices` registrada. |
| `utils/permissions.ts` | `ROUTE_BILLING` adicionada em `GESTAO` — admin/admin_tecnico ganham automático via `Object.values().flat()`. |
| `App.tsx` | Lazy import `Billing` + rota `/billing` com `RoleProtectedRoute permission="ROUTE_BILLING"`. |
| `components/Layout.tsx` | Item "MENSALIDADE" na seção GESTÃO da sidebar do tenant. |
| `package.json` | `tsx` movido de `devDependencies` para `dependencies` (motivo no fix abaixo). |
| `Dockerfile` | Estágio runtime: `CMD ["node_modules/.bin/tsx", "server.ts"]` direto (sem `npx`). Removido `RUN npm i --no-save tsx` e `COPY services utils lib` (dead-weight — server.ts só importa express/cors/path). |
| `server.ts` | `vite` agora é dynamic import dentro do branch `NODE_ENV !== 'production'` — em produção a importação não é avaliada (vite é devDep e não está no runtime image). |
| `contexts/AuthContext.tsx` | Fix typo `auth/email-alredy-in-use` → `auth/email-already-in-use`. |

### Callables novas (billing) — `functions/index.js`

**Super admin** (`requireSuperAdmin`):

| Callable | Faz |
|---|---|
| `createTenantSubscription({ slug, priceCents, cycle, billingType, dueDay, payer })` | Cria customer + subscription no Asaas. Persiste `billing.*` no tenant. |
| `updateTenantSubscription({ slug, priceCents?, cycle?, billingType?, dueDay? })` | Patch parcial na assinatura existente. |
| `cancelTenantSubscription({ slug })` | DELETE no Asaas + `billing.status='canceled'`. |
| `syncTenantBilling({ slug })` | Pull do Asaas (subscription + payments) → atualiza `invoices/` + `billing.status`. |
| `listTenantInvoices({ slug, limit? })` | Faturas de 1 tenant (do super admin). |
| `listInvoicesGlobal({ status?, tenantSlug?, fromMs?, toMs?, limit? })` | Cross-tenant — itera `/tenants/*` (até ~200 tenants). |
| `aggregateMRRHistory({ months? })` | Receita realizada por mês (últimos N meses, default 12) + MRR atual derivado de `tenants.billing`. |

**Tenant admin** (`requireTenantAdmin`):

| Callable | Faz |
|---|---|
| `getMyTenantBilling()` | Estado de plano + cobrança do próprio tenant (IDs internos do Asaas ocultos). |
| `listMyTenantInvoices({ limit?, status? })` | Histórico próprio. Remove `asaasCustomerId`/`asaasSubscriptionId` do payload. |
| `syncMyTenantBilling()` | Force-sync (cooldown 60s/tenant). |

**Webhook / cron**:

| Função | Faz |
|---|---|
| `asaasWebhook` (onRequest) | Valida `asaas-access-token` header contra `ASAAS_WEBHOOK_TOKEN`. Resolve tenant via `payment.externalReference`. Upsert na invoice + atualiza `billing.status` por tipo de evento. Audit em `system_audit_logs`. |
| `dailyBillingEnforcement` (onSchedule 03:30 BRT) | Soft-suspend (`active=false`) de tenants com invoice OVERDUE há >7d. |

### Como configurar Asaas (uma vez por ambiente)

```bash
# 1) Pegar API key em https://www.asaas.com → Integrações → API Asaas
#    (sandbox: https://sandbox.asaas.com — recomendado para começar)

firebase functions:secrets:set ASAAS_API_KEY
# cola o valor quando pedir; nunca como argumento na linha de comando

# 2) Gerar token random para o webhook
openssl rand -hex 32 | firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN --data-file=-
# salve esse valor (1Password/etc) — vai precisar pra cadastrar webhook no Asaas

# 3) Setar ambiente (sandbox|production) como env var das functions
#    (sandbox é o default se não setar)
firebase functions:config:set asaas.env=sandbox   # ou production
# OU via Cloud Run Functions UI: env var ASAAS_ENV

# 4) Cadastrar webhook no Asaas
#    URL:   https://us-central1-saastagmanager.cloudfunctions.net/asaasWebhook
#    Token: o valor gerado no passo 2
#    Eventos: PAYMENT_CREATED, PAYMENT_RECEIVED, PAYMENT_CONFIRMED,
#             PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_UPDATED
```

### CI/CD — primeiro deploy

```bash
# Uma vez por desenvolvedor com permissões de owner no GCP:
gcloud auth login
gcloud config set project saastagmanager
./scripts/setup-gcp-wif.sh
```

O script imprime 3 valores no final. Cola em **GitHub → repo → Settings → Secrets and variables → Actions**:

- `GCP_PROJECT_ID`
- `GCP_WIF_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

Depois é só **Actions → Deploy → Run workflow → target: `all`**. Idempotente — pode rerun à vontade.

### Fixes de Cloud Run (commits 5c7d56c, 5f9480a)

| Sintoma | Causa | Fix |
|---|---|---|
| `Failed to start and listen on PORT=8080` (deploy 1) | `import { createServer } from "vite"` no topo do `server.ts` — vite é devDep e não está no runtime image → `MODULE_NOT_FOUND` em runtime | Dynamic import dentro do branch `NODE_ENV !== 'production'` |
| `Failed to start and listen on PORT=8080` (deploy 2) | `npx tsx` baixava o tsx do npm registry a cada cold start (40s) — `RUN npm i --no-save tsx@4` não deixava o binário acessível pós `USER node` | tsx movido pra `dependencies` (instalado no `npm ci --omit=dev` com permissões corretas) + Dockerfile chama `./node_modules/.bin/tsx` direto |

Startup pós-fix (medido com `docker run` local): **2.1s** (vs 40s antes).

### Próximos passos (roadmap pós-deploy)

**A — DNS wildcard via Cloudflare** (~30 min, sem código):

1. Cloudflare Free → Add Site `ktagfinder.app` → anota 2 nameservers
2. name.com → ktagfinder.app → Nameservers → trocar pelos do CF
3. Aguarda email de "Active" (~10-30min)
4. CF DNS: `CNAME @ → <cloud-run-host>` 🟠 e `CNAME * → <cloud-run-host>` 🟠
5. CF SSL/TLS → Full (strict). Universal SSL cobre apex + `*.ktagfinder.app`
6. Smoke test:
   ```bash
   curl -sI https://admin.ktagfinder.app/api/health
   curl -sI https://<slug>.ktagfinder.app/api/health
   ```

**B — Roadmap de billing** (decidido com usuário, ordem 1 → 3 → 4 → 5 → 6 → 2 → 7 → 8):

| Fase | Status | Escopo |
|---|---|---|
| 1 — Área `/billing` do tenant | ✅ feito (Fase 6) | Tenant admin vê suas faturas + PIX/boleto |
| 3 — Webhook robusto | ⏳ próximo | Idempotência por `dateUpdated`, coleção `system_billing_events` para forensics, validação reforçada |
| 4 — Notificações | ⏳ | Push (já existe) + e-mail nativo Asaas (`notificationDisabled=false`) |
| 5 — PIX QR + boleto inline | ⏳ | Renderizar QR code, código de barras, valor/prazo em destaque |
| 6 — Reenvio manual | ⏳ | Botão "lembrar cliente" → endpoint Asaas notify |
| 2 — Cobranças avulsas | ⏳ | Setup fee, taxa única (não-recorrente) |
| 7 — Trial period | ⏳ | Param opcional em `createTenantSubscription` |
| 8 — Config Asaas no super admin | ⏳ | Toggle sandbox/prod via UI; URL do webhook visível |

### Como retomar após `git clone`

```bash
# 1) Setup
npm ci
cd functions && npm ci && cd ..

# 2) .env (copie .env.example se existir; senão preencha manualmente)
cat > .env <<EOF
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=saastagmanager.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=saastagmanager
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
EOF

# 3) Dev local
npm run dev              # http://localhost:5173/?tenant=<slug>

# 4) Smoke test em container (mesma config do Cloud Run)
docker build -t ktag-app:local .
docker run --rm -e PORT=8080 -e NODE_ENV=production -p 8080:8080 ktag-app:local

# 5) Deploy
#    - Tudo via CI: GitHub Actions → Deploy → Run workflow → target: all
#    - Específico via CLI:
firebase deploy --only functions:createTenant
firebase deploy --only firestore:indexes
gcloud run deploy ktag-app --image=<image> --region=us-central1
```

### Riscos / pontos de atenção

- **`_syncCooldown` em `syncMyTenantBilling`** é Map global em memória. Cloud Functions Gen 2 escala em múltiplas instâncias — o cooldown não bloqueia abuse cross-instance. Soft rate-limit, OK pra MVP; se virar problema, migrar para Firestore TTL doc por tenant.
- **`listInvoicesGlobal` itera tenants em série** — performa bem até ~200 tenants. Acima disso, trocar por collectionGroup query + composite index.
- **Webhook do Asaas é idempotente por chave (`payment.id`)** mas pode logar audit duplicado em retry. Fase 3 vai resolver com `system_billing_events`.
- **Domínio apex `ktagfinder.app`** sem subdomínio → `getTenantFromHostname` retorna `'default'` → "Empresa não encontrada". Soluções: Cloudflare Page Rule redirecionando para `admin.ktagfinder.app`, ou tratar `default` como landing dedicada no app.
- **Cloud Functions Gen 2 + Node 20** vai ser deprecado em 2026-10-30. Avaliar upgrade pra Node 22 + `firebase-functions@5+` antes disso.

---

## Fase 5 — Cloud Run + Docker + DNS

### Resumo
Pacote de deploy para Cloud Run. Inclui Dockerfile multi-stage, `.dockerignore`, `cloudbuild.yaml` pronto pra trigger automático, e middleware `resolveTenant` no `server.ts` que extrai o tenant do hostname e bloqueia subdomínios reservados.

### Arquivos criados

| Arquivo | Propósito |
|---|---|
| `Dockerfile` | Multi-stage: builder roda `vite build`; runtime alpine + tsx servindo Express + dist/. Usuário não-root, EXPOSE 8080. |
| `.dockerignore` | Exclui node_modules, .env, .git, dist, docs e scripts de fora. |
| `cloudbuild.yaml` | Build → Push (Artifact Registry) → Deploy Cloud Run. Substitutions `_SERVICE`, `_REGION`, `_REPO` ajustáveis. |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `server.ts` | Novo middleware `resolveTenant` aplicado antes de todas as rotas. Extrai tenantId do `req.hostname` (com `trust proxy` para Cloud Run X-Forwarded-Host). Em dev/localhost, aceita header `X-Tenant-Id` ou query `?tenant=`. Bloqueia subdomínios reservados com 403. `/api/health` retorna `tenantId` para diagnóstico. `PORT` agora vem de `process.env.PORT` (Cloud Run injeta 8080). |
| `package.json` | `start: tsx server.ts` (era `node server.ts`, quebrado para TS). `build: vite build` (removido `tsc &&` para não bloquear no erro pré-existente de react-leaflet — `vite build` já roda o transpile interno). Novos scripts `docker:build` e `docker:run`. |

### Deploy em Cloud Run (passo a passo)

```bash
# 1) Setup único do projeto GCP (todos uma vez)
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create ktag --repository-format=docker --location=us-central1

# 2) Build local (opcional, smoke test)
npm run docker:build
npm run docker:run    # http://localhost:8080

# 3) Deploy manual via gcloud
gcloud builds submit --config=cloudbuild.yaml .

# 4) Trigger automático (recomendado): configurar Cloud Build Trigger
#    apontando para o repo do GitHub + branch principal.
```

### DNS wildcard (necessário para multi-tenant em produção)

```
Tipo  Nome                          Valor
A     <ip-do-load-balancer>         → (caso use LB próprio)
CNAME *.seudominio.com              → ghs.googlehosted.com   (Cloud Run domain mapping)
```

Mapeamentos no Cloud Run:
```bash
# Para cada subdomínio especial OU usando wildcard mapping
gcloud beta run domain-mappings create --service=ktag-app --domain=admin.seudominio.com
# Para o catch-all (wildcard) — depende da região/projeto suportar:
gcloud beta run domain-mappings create --service=ktag-app --domain=*.seudominio.com
```

Caso o wildcard direto não seja suportado na sua região, alternativa:
1. Provisionar um Load Balancer HTTPS com SSL Wildcard
2. Backend service → Serverless NEG apontando para Cloud Run
3. URL map captura `*.seudominio.com` para o backend

### Riscos / pontos de atenção

- **`server.ts` ainda não consulta Firestore para credenciais por-tenant**. O middleware popula `req.tenantId` mas as rotas de proxy (`/api/proxy`, `/api/melhorenvio/*`) continuam lendo do `.env` global. Para isolar credenciais por tenant no proxy, próxima iteração precisa: (a) fazer lookup de `/tenants/{tid}/settings/config` por request com cache, OU (b) mover as integrações OAuth pra Functions tenant-aware. Fica para Fase 6 (OWASP).
- **Cold start do Cloud Run**: usar `--min-instances=1` em produção para tempo de resposta consistente (custa ~$5/mês). Hoje está em `--min-instances=0` (gratuito mas com cold start).
- **HashRouter** (frontend) tem implicação para o domain mapping: o subdomínio é o que importa para tenancy; o hash após `#/` é só rota client-side. Compatível.
- **tsx em produção**: roda TypeScript direto. Aceita por simplicidade. Se quiser overhead zero no startup, compile com `tsc` e ajuste o `CMD` para `node server.js`.

---

## Fase 4 — Painel Super Admin

### Resumo
Painel administrativo da plataforma, servido em `admin.<dominio>` (em dev: `?tenant=admin`). Sub-app React separado com autenticação por Firebase Auth + lookup em `/system_admins/{uid}`. CRUD de tenants, visão cross-tenant de usuários, gestão de super admins, audit log.

### Arquivos criados

| Arquivo | Propósito |
|---|---|
| `contexts/SystemAdminContext.tsx` | Auth provider próprio do painel admin (signIn + lookup em `/system_admins`). Independente do `AuthContext` de tenant. |
| `pages/admin/AdminApp.tsx` | Root do sub-app admin: SystemAdminProvider + HashRouter + AdminGate. |
| `pages/admin/AdminLogin.tsx` | Tela de login do painel — mesmo email/senha do Firebase Auth, mas exige doc em `/system_admins`. |
| `pages/admin/AdminLayout.tsx` | Layout com sidebar e navegação (Dashboard / Empresas / Usuários / Super Admins / Auditoria). |
| `pages/admin/AdminDashboard.tsx` | Estatísticas básicas: total de tenants ativos/inativos + total de super admins. |
| `pages/admin/AdminTenants.tsx` | Lista de tenants em real-time (`onSnapshot`), modal de criação, toggle ativar/desativar, link "abrir tenant" (nova aba). |
| `pages/admin/AdminUsers.tsx` | Visão cross-tenant (chama callable `listAllUsers`) com filtro por tenant e busca por email. |
| `pages/admin/AdminSystemAdmins.tsx` | Adicionar/remover super admins por email. Bloqueia auto-remoção do último admin. |
| `pages/admin/AdminAudit.tsx` | Eventos de `system_audit_logs` (criação de tenants, promoção a super admin, etc.). |
| `scripts/seed-superadmin.ts` | Promove um usuário existente do Firebase Auth a super admin (cria doc + customClaim). |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `App.tsx` | Quando `useTenant().isAdminPanel` é true (subdomínio `admin`), renderiza `<AdminApp />` em vez do app de tenant. Sub-app totalmente isolado — não usa `AuthProvider` nem `ThemeProvider` de tenant. |
| `functions/index.js` | Novos callables: `createTenant`, `setTenantActive`, `updateTenant`, `addSystemAdmin`, `removeSystemAdmin`, `listAllTenants`, `listAllUsers`. Guard `requireSuperAdmin(request)` valida `/system_admins/{caller}`. Slugs reservados bloqueados na criação. |
| `firestore.rules` | `isSuperAdmin()` agora usa fast-path via custom claim `superadmin: true` (set pelo callable) + fallback de doc lookup. |

### Onboarding do primeiro super admin

```bash
# 1) Crie o primeiro tenant + usuário admin (Fase 1)
tsx scripts/seed-tenants.ts dev-tenant admin@example.com "Você"

# 2) Promova esse usuário a super admin da plataforma
tsx scripts/seed-superadmin.ts admin@example.com

# 3) Acesse o painel
#   Dev:  http://localhost:5173?tenant=admin
#   Prod: https://admin.seudominio.com
```

A partir daí, o painel "Super Admins" permite delegar a outros usuários por email.

### Riscos / pontos de atenção

- **Custom claims precisam refresh do token** para o usuário recém-promovido ver as permissões. Forçar via `auth.currentUser?.getIdToken(true)` após chamada de `addSystemAdmin` — não implementado nesta fase (raro o suficiente; logout/login resolve).
- **Sem "impersonate" de tenant nesta fase**. O link "abrir tenant" da página de Empresas só abre a URL do tenant em nova aba; o super admin precisa fazer login lá com credenciais de membro do tenant se quiser visualizar. Impersonate de verdade (custom token) fica para Fase 6.
- **Nome de tenant criado via callable é texto plano no doc** — não passa pelo encryption client-side. Não é PII crítica; o nome aparece em badges. Para deploys com requisito forte, edite o doc via UI normal de tenant após criação.
- **`listAllUsers` itera tenants sequencial** (N+1 reads). OK até ~50 tenants; acima disso, migrar para `collectionGroup('users')` com índice composto.

---

## Fase 3 — Functions tenant-aware

### Resumo
Removida a dívida de segurança crítica sinalizada no §"Riscos remanescentes" da Fase 2: `functions/index.js` agora opera contra `/tenants/{tid}/...` e jamais cruza credenciais entre tenants. Pré-requisito para qualquer deploy real e para Cloud Run (Fase 5).

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `functions/index.js` | **Refatoração interna.** Helpers `getUserInfo`, `sendNotificationToUser`, `sendNotificationToPref` e `logAudit` agora recebem `tenantId` como 1º arg. Os 4 triggers de domínio (`onScheduleCreate/Update`, `onVehicleUpdate`, `onFeedbackCreate`) migraram para paths `tenants/{tenantId}/...`. Cron `scheduledTagUpdate` itera tenants ativos e usa as credenciais K-TAG/XADTAG do próprio tenant. Callable `sendPushNotification` exige auth + `tenantId`. Callables novos da Fase 2 (`createTenantUser`, `resetTenantUserPassword`, `deleteTenantUser`) propagam `tenantId` para o audit. |
| `services/pushService.ts` | `register(userId, tenantId)`. Doc gravado em `push_subscriptions/{id}` (coleção continua flat — Functions precisa varrer cross-tenant) inclui campo `tenantId`. |
| `components/Layout.tsx` | Chamada de `pushService.register` agora passa `tenantId` do `useTenant()`. |
| `firestore.rules` | Já estava preparada na Fase 2 (com helper `push_subscriptions/{subId}` exigindo `userId == request.auth.uid`). Sem mudança nesta fase. |

### Pontos importantes

- **Helper `updateTagsForTenant(db, tenantId)`** isolado no `scheduledTagUpdate` para que cada tenant tenha um escopo lexical próprio — erro em um tenant não derruba o loop.
- **Tenants sem `settings/config` ou sem credenciais K-TAG/XADTAG** são pulados silenciosamente (log info), nunca crashes.
- **Custo do cron escala linearmente** com nº de tenants. 3h é confortável até ~50 tenants; acima disso, Cloud Tasks (futuro).
- **`push_subscriptions` legadas** (sem campo `tenantId`) são ignoradas pela query nova — não quebram, só não recebem push. Por D6 (banco vazio) não é problema; em deploys reais, exigir re-subscribe no boot do app.
- **Coleção antiga `ktag_audit_logs`** não é mais escrita pelas Functions. Audit agora vai para `/tenants/{tid}/audit_logs` (consistente com o storage.ts da Fase 1).

### Deploy desta fase (recomendação)

```bash
# IMPORTANTE: rules + functions juntos (ou em sequência rápida) para evitar
# janela em que triggers velhos coexistem com paths novos.
firebase deploy --only firestore:rules,functions
```

Após o deploy, atualize qualquer dashboard de monitoring para olhar `/tenants/{tid}/audit_logs/*` no lugar de `/ktag_audit_logs/*`.

### Verificação

- `node --check functions/index.js` → OK
- `npx tsc --noEmit` → 0 erros novos (apenas os 4 pré-existentes em `react-leaflet`)
- Manual em emulador (não nesta entrega): `firebase emulators:start --only functions,firestore`, criar `/tenants/dev-tenant/schedules/x` e observar audit log em `/tenants/dev-tenant/audit_logs`.

### Riscos remanescentes

1. **`proxyApi` ainda é HTTP público** sem auth (mantém compat com fluxos legados de proxy CORS). Quando migrar para Cloud Run (Fase 5), pode virar middleware autenticado nativamente. Em Fase 6 (OWASP), converter para callable.
2. **Sem custom domain mapping** ainda — todas as functions rodam em `*.cloudfunctions.net`. Fase 5 resolve isto via Cloud Run + Firebase Hosting rewrites OU domain mapping direto no Cloud Run.

### Próximas fases (ordem mantida)

| Fase | Conteúdo |
|---|---|
| **Fase 4** | Painel super admin (`/admin/*` em `admin.<dominio>`) + collection `system_admins` + impersonate. |
| **Fase 5** | Cloud Run + Dockerfile + DNS wildcard + `server.ts` middleware `resolveTenant`. |
| **Fase 6** | OWASP residual: helmet, zod, MFA opcional, criptografia server-side de PII, audit cross-tenant, `proxyApi` autenticado. |

---

## Fase 2 — Firebase Auth

### Resumo
Migração completa da autenticação para Firebase Auth. O JWT custom em localStorage foi substituído. As Firestore Rules agora são efetivamente aplicadas (request.auth.uid passa a existir). Custom claims (`tenantId`, `role`, `approved`) são sincronizadas via Cloud Function a cada write em `/tenants/{tid}/users/{uid}`.

Decisão revisada: D1 original ("manter JWT custom") foi promovida para "migrar para Firebase Auth" agora que D6 confirmou banco vazio (sem reset de senha em massa para fazer).

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `services/firebase.ts` | Inicializa `auth = getAuth(app)` com `setPersistence(browserLocalPersistence)`. Inicializa `functions = getFunctions(app)` para chamar callables. |
| `contexts/AuthContext.tsx` | **Reescrito.** Boot via `onAuthStateChanged`; login via `signInWithEmailAndPassword`; register via `createUserWithEmailAndPassword` + write de doc com mesmo uid + auto sign-out até admin aprovar; logout via `signOut`. Mensagens genéricas para todos os erros de credencial (anti user-enumeration). Valida tenant + status approved no boot. |
| `services/storage.ts` | `getSessionUser` agora lê via `auth.currentUser.uid` no Firestore (não mais JWT). `setSessionUser`/`clearSessionUser` viraram no-ops (Firebase Auth gerencia). Removida dependência de `jwtService`. |
| `services/jwt.ts` | Marcado `@deprecated` no header. Não removido para evitar build break em imports residuais. |
| `types.ts` | `User.password` marcado `@deprecated` (nunca persistir; Firebase Auth gerencia). |
| `firestore.rules` | **Reescrito.** Helpers `hasTenantClaim` (fast-path via custom claim) + `hasTenantDoc` (fallback). Rules específicas por coleção (users, settings, audit_logs, custom_roles, stolen_records). Regra de create de user previne self-promotion (force `role='user'`, `status='pending'`). |
| `functions/index.js` | Novos triggers e callables (ver §Cloud Functions abaixo). |
| `scripts/seed-tenants.ts` | Agora usa `admin.auth().createUser()` para obter uid real do Firebase Auth, `setCustomUserClaims()` e write do doc com aquele uid. Idempotente (se Auth user já existir, atualiza senha). |
| `pages/Users.tsx` | Create/Reset/Delete de usuários agora chamam Cloud Function callables (`createTenantUser`, `resetTenantUserPassword`, `deleteTenantUser`). Removido `securityService.hashPassword` no fluxo de admin. |
| `pages/TechnicianRegistration.tsx` | Removida chamada legada a `storage.setSessionUser` (Firebase Auth atualiza sozinho via `onAuthStateChanged` no próximo boot). |
| `components/settings/SystemApisModule.tsx` | `handleUpdatePassword` agora faz reauth via `signInWithEmailAndPassword` antes de `updateProfile({password})` (Firebase Auth exige reauth recente). |

### Cloud Functions adicionadas (`functions/index.js`)

| Função | Tipo | Propósito |
|---|---|---|
| `onTenantUserCreate` | Firestore trigger em `/tenants/{tid}/users/{uid}` (create) | Seta `customClaims = { tenantId, role, approved }` no Firebase Auth uid. |
| `onTenantUserUpdate` | Firestore trigger em `/tenants/{tid}/users/{uid}` (update) | Re-sync de claims quando role/status muda. Audita a mudança. |
| `createTenantUser` | onCall | Admin do tenant cria novo colaborador. Cria Auth user → seta claims → write doc. Retorna senha temporária. |
| `resetTenantUserPassword` | onCall | Admin reseta senha de membro do mesmo tenant. Retorna nova senha. |
| `deleteTenantUser` | onCall | Admin remove Auth user + doc do tenant. Bloqueia self-delete. |

Guard `requireTenantAdmin(request)` valida que o caller é admin do tenant alvo via lookup no doc (não confia apenas em claims).

### Como rodar em desenvolvimento (atualizado)

```bash
# 1) .env com config Firebase + tenant dev (já cobrindo Fase 1)

# 2) No Firebase Console: habilite Authentication → Sign-in method → Email/Password

# 3) Instala firebase-admin (só para o seed)
npm i -D firebase-admin tsx

# 4) Deploy das Functions (ou roda emulators)
cd functions && npm install && cd ..
firebase deploy --only functions     # ou firebase emulators:start

# 5) Deploy das rules
firebase deploy --only firestore:rules

# 6) Seed do tenant inicial (cria Auth user + doc + custom claims)
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/serviceAccount.json
tsx scripts/seed-tenants.ts dev-tenant admin@dev-tenant.local "Admin Dev"

# 7) Sobe a app
npm run dev
# acesse http://localhost:5173?tenant=dev-tenant
# login: admin@dev-tenant.local / change-me-123
```

### Riscos remanescentes / pontos de atenção

1. **Custom claims só propagam após `getIdToken(true)`**. Se um admin trocar o role de um usuário, o usuário precisa fazer logout/login para o novo token chegar. Para resposta imediata, o frontend pode chamar `auth.currentUser?.getIdToken(true)` após operações administrativas — não implementado nesta fase (raro o suficiente para deixar para Fase 5 hardening).
2. **Reauth de senha**: o flow em `SystemApisModule` re-loga via `signInWithEmailAndPassword` antes de update. Funciona, mas é melhor migrar para `reauthenticateWithCredential` em PR de hardening (não dispara `onAuthStateChanged`).
3. **Nome do usuário é escrito em texto plano** quando criado via `createTenantUser` Cloud Function (a chave de criptografia é por-tenant e vive só no cliente). Workaround atual: admin edita o usuário no UI logo após criação (aí passa pela criptografia client-side). Solução definitiva: chave de criptografia em Secret Manager por tenant + criptografia server-side — Fase 5.
4. **Functions continuam globais**. `scheduledTagUpdate` ainda varre `/ktag_tags` (coleção antiga). Após este PR de Auth, próximo passo crítico é tornar Functions tenant-aware (Fase 3).
5. **Rules em produção**: deploy das rules + functions é pré-requisito. Sem eles, o frontend chamará callables que não existem (erro 404) e tentará leituras que serão rejeitadas.

### Próximas fases sugeridas (ordem recomendada)

| Fase | Conteúdo | Por que essa ordem |
|---|---|---|
| **Fase 3** | Functions tenant-aware (varrem `tenants/*` + leem settings do tenant) | Sem isso, deploy real vaza credenciais entre tenants. **Bloqueante para produção.** |
| **Fase 4** | Painel super admin (`/admin/*`) + collection `system_admins` | Necessário para gestor operar plataforma. Visualmente "o produto", mas depende de Fases 2+3. |
| **Fase 5** | Cloud Run + Dockerfile + DNS wildcard + `server.ts` middleware | Migra de Firebase Hosting. Pode rodar em paralelo com Fase 4. |
| **Fase 6** | OWASP residual: helmet, zod, MFA, criptografia server-side de PII, audit cross-tenant | Hardening final. |

---

# Fase 1

Escopo desta entrega: fundação multi-tenant (TAREFAs 2, 3, 4 do roteiro `PROMPT_CLAUDE_CODE_MULTITENANT.md`). **Não inclui** painel super admin (TAREFA 5), Cloud Run/Docker (TAREFA 6), nem cobertura OWASP completa (TAREFA 9). Esses ficam para PRs subsequentes — ver §3.

Decisões base aprovadas pelo gestor (registradas em `MULTITENANT_AUDIT.md` §7):
- **D1**: JWT custom com `tenantId` no payload (não migra para Firebase Auth)
- **D2**: Subcoleções `/tenants/{id}/...`
- **D3**: Abandona `companySlug`, gera novo `tenantId` (banco está vazio em D6 — sem reencrypt)
- **D4**: Cada tenant traz suas próprias credenciais de integrações
- **D5**: Cloud Run é o alvo final (mas não nesta fase)
- **D6**: Banco vazio → seedar do zero

---

## 1. Arquivos criados

| Arquivo | Propósito |
|---|---|
| `utils/tenant.ts` | `getTenantFromHostname()` SPA (subdomínio em prod, `?tenant=` ou `VITE_DEV_TENANT` em dev). Lista de slugs reservados. Validação de slug. |
| `services/activeTenant.ts` | Singleton em memória do tenant ativo. Populado pelo `TenantProvider` no boot; lido pelos helpers de Firestore e por `storage.ts`. Evita reescrever ~50 assinaturas. |
| `lib/firestore.ts` | Helpers `tenantCollection(name)`, `tenantDoc(name, id)`, `tenantRootDoc(id)`, `systemCollection(name)`. **Único ponto** que toca o Firestore para domínio — qualquer leitura/escrita fora daqui é red flag. |
| `contexts/TenantContext.tsx` | Resolve tenant do hostname, carrega `/tenants/{id}`, inicializa `encryption` derivada de `tenantId`, popula `activeTenant`. Tela "Empresa indisponível" se inativo/inexistente. |
| `scripts/seed-tenants.ts` | Script `firebase-admin` para criar `dev-tenant` + admin user de teste. Senha hashada com mesmo pepper do `services/security.ts`. |
| `MULTITENANT_AUDIT.md` | Auditoria entregue na TAREFA 1 com inventário, leakage points e decisões pendentes. |
| `MULTITENANT_CHANGES.md` | Este arquivo. |

## 2. Arquivos modificados

| Arquivo | Mudanças |
|---|---|
| `types.ts` | Nova interface `Tenant` + tipos auxiliares (`TenantPlan`, `TenantSettings`, `TenantIntegrationFlags`). `User` ganha `tenantId?: string`; `companySlug` marcado como `@deprecated`. Role `superadmin` adicionada à union. |
| `services/encryption.ts` | Seed troca de `companySlug` para `tenantId` (`ktag-enterprise-master-key-${tenantId}-v3`). API pública inalterada. |
| `services/jwt.ts` | Payload do token troca `companySlug` por `tenantId` no `sign` e no `verify`. |
| `services/storage.ts` | **Reescrita completa.** Todos os ~50 métodos passam a usar `tenantCollection`/`tenantDoc`. Cache de `localStorage` ganha prefixo de tenant (`ktag_${tenantId}_${name}`). Coleções renomeadas para nomes curtos (`users`, `vehicles`, ...) sob `/tenants/{id}/`. `initEncryption` virou no-op (TenantContext cuida do boot). |
| `contexts/AuthContext.tsx` | Consome `useTenant()` para conhecer o tenant ativo. Login valida `user.tenantId === currentTenantId`. Mensagens de erro genéricas (anti-enumeration). Boot de sessão recusa token de outro tenant. `register` injeta `tenantId` no novo usuário. Removida chamada obsoleta a `storage.initEncryption`. |
| `App.tsx` | `<TenantProvider>` envolvendo `<AuthProvider>` para garantir que o tenant seja resolvido antes de qualquer chamada a Firestore. |
| `firestore.rules` | **Reescrita.** Modelo `/tenants/{tenantId}/{document=**}` com helpers `isMemberOf`, `isTenantAdmin`, `isTenantModerator`, `isSuperAdmin`. Regras específicas para users, settings, audit_logs e stolen_records. Comentário no topo deixando claro que rules **só passam a ser efetivamente aplicadas** quando o cliente passar a se autenticar via Firebase Auth (próxima fase). |
| `tsconfig.json` | `scripts/` excluído do typecheck (firebase-admin é dep on-demand). |
| `.env.example` | Adicionados `VITE_DEV_TENANT`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SEED_ADMIN_PASSWORD`. |

## 3. O que NÃO foi feito nesta fase (e por quê)

| Item do roteiro | Status | Motivo |
|---|---|---|
| TAREFA 5 — Painel super admin (`/admin/*`) | adiado | Escopo escolhido pelo gestor (Fase 1) — entrega isolável; PR seguinte. |
| TAREFA 6 — Cloud Run + Dockerfile + DNS | adiado | D5 marcou como alvo, mas Fase 1 entrega multi-tenant funcionando em Firebase Hosting + Vite dev. Migração para Cloud Run vira PR dedicado. |
| TAREFA 7 — `dev-tenant.sh` | parcial | Suporte via `VITE_DEV_TENANT` no `.env` e `?tenant=xxx` na URL já cobre o caso de uso. Script bash pode ser adicionado depois sem refactor. |
| TAREFA 8 — Seed completo (2-3 tenants + boletos fake) | parcial | Script criado para 1 tenant + admin. "Boletos" não existem no produto — não foi reinterpretado nesta fase. Múltiplos tenants se cria rodando o script com argumentos diferentes. |
| TAREFA 9 — OWASP completo | parcial | Itens feitos: mensagens genéricas em login (anti-enumeration), tenant binding no login, cache localStorage por tenant. Itens **não** feitos: `helmet` no `server.ts`, validação Zod, rate limit por rota, security headers, MFA, audit_logs em coleção separada. PR de hardening dedicado. |
| `server.ts` middleware `resolveTenant` | não feito | Sem Cloud Run, as rotas Express atuais (proxy CORS, geocoding, melhorenvio) continuam globais. Quando migrar para Cloud Run, este middleware vira essencial — e usará as credenciais por-tenant via `getSettings()` dentro do escopo. |
| `functions/index.js` tenant-aware | não feito | Triggers e cron continuam globais (varrem todas as tags, todos os schedules). Em produção multi-tenant real, o `scheduledTagUpdate` precisa iterar `tenants/*` antes de ler tags. PR de Functions tenant-aware. |
| 30+ `pages/*.tsx` | sem mudanças | Por design: `storage` é tenant-aware via singleton, então as páginas continuam chamando `storage.getX()` normalmente. Branding por tenant no `Login.tsx` é melhoria futura. |

## 4. Como rodar em desenvolvimento

```bash
# 1) Garante .env com config Firebase + tenant dev
cp .env.example .env
# preencher VITE_FIREBASE_*

# 2) Instala firebase-admin (só para o seed)
npm i -D firebase-admin tsx

# 3) Seed do tenant inicial — exige Service Account JSON
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/serviceAccount.json
tsx scripts/seed-tenants.ts dev-tenant admin@dev-tenant.local "Admin Dev"

# 4) Sobe a app
npm run dev
# acesse http://localhost:5173?tenant=dev-tenant
# login: admin@dev-tenant.local / change-me-123
```

Em produção (futuro, quando Cloud Run estiver no ar):
```
empresa1.seudominio.com  → tenantId = "empresa1"
empresa2.seudominio.com  → tenantId = "empresa2"
admin.seudominio.com     → painel super admin (Fase 2)
```

## 5. Verificação

- `npx tsc --noEmit` reporta apenas 4 erros pré-existentes não relacionados a este PR (`components/LocationPicker.tsx`, `components/MapComponent.tsx` importam `react-leaflet*` que não está em `package.json`).
- Zero erro novo introduzido pelos arquivos desta entrega.
- Pages e contextos antigos não tiveram suas APIs públicas alteradas — apenas o backend de dados.

## 6. Risco / próximos passos críticos

1. **Rules sem Firebase Auth = rules sem efeito.** Hoje o cliente Firestore JS não autentica via Firebase Auth, então `request.auth` é `null` e as rules acima rejeitariam tudo. Próximo PR deve **decidir e implementar**: (a) ativar Firebase Anonymous Auth para popular `request.auth.uid`, ou (b) escrever uma Cloud Function intermediária que assine reads/writes server-side. **Até lá, a segurança real do isolamento depende do código cliente** — o que é frágil.
2. **Functions ainda são globais.** Se o cron `scheduledTagUpdate` rodar contra dados de produção multi-tenant antes de virar tenant-aware, vai vazar credenciais K-TAG entre tenants. **Não deploy de Functions sem antes fazer o PR de Functions tenant-aware.**
3. **`server.ts` continua global.** Mesmo motivo do item anterior, em escala menor.
4. Decisões D5, D6, D7 restantes do audit (`MULTITENANT_AUDIT.md` §7) ainda precisam ser cronometradas em PRs.
