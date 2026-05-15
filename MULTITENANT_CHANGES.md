# MULTITENANT_CHANGES

## Histórico
- [Fase 1](#fase-1) — Fundação multi-tenant (TAREFAs 2, 3, 4)
- [Fase 2](#fase-2--firebase-auth) — Firebase Auth + custom claims + rules efetivas
- [Fase 3](#fase-3--functions-tenant-aware) — Cloud Functions migradas para paths e settings por tenant

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
