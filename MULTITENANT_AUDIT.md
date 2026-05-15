# MULTITENANT_AUDIT — K-TAG Manager Pro

> Auditoria gerada na TAREFA 1 do roteiro multi-tenant.
> Objetivo: dar a base factual sobre o **código real** antes de qualquer refactor, e apontar onde o roteiro genérico precisa ser adaptado a esta codebase.

---

## 0. Resumo executivo (leia primeiro)

O sistema **não é** o single-tenant "padrão" que o roteiro assume. Em particular:

- **Não usa Firebase Auth.** A autenticação é caseira: senha hash SHA-256 com pepper global (`services/security.ts`), sessão JWT custom em `localStorage` (`services/jwt.ts`), checagem em `contexts/AuthContext.tsx`. Toda a seção do roteiro sobre `setCustomUserClaims`, `revokeRefreshTokens`, `reauthenticateWithCredential`, MFA via Firebase Auth, e regras `request.auth.token.tenantId` **não se aplica como está** — precisa ser portada para o modelo JWT custom (ou trocar pra Firebase Auth, decisão estratégica).
- **Já existe um conceito parcial de tenant:** `User.companySlug` é usado como *seed* da chave de criptografia AES-GCM (`storage.initEncryption`). Mas **não é usado para filtrar dados** — todas as consultas leem dados globalmente.
- **Coleção `ktag_companies` ≠ tenant.** Hoje ela representa *regionais internas* de uma única instalação (campo `prefix`, vínculo via `Vehicle.companyId` e `Schedule.companyId`). Reaproveitar esse nome para "tenant" geraria conflito semântico — recomenda-se introduzir uma nova coleção `tenants` separada.
- **`boletos` não existem.** O roteiro pressupõe um produto de cobrança; este produto é gestão de frotas + tags GPS + agendamentos técnicos + envios via Melhor Envio. As páginas do painel admin propostas (`/admin/boletos`) precisam ser reinterpretadas (ver §6).
- **Settings é um singleton global** (`ktag_settings_v3/config`) com **credenciais de terceiros embutidas** (K-TAG, Hinova, Melhor Envio OAuth tokens, Gemini/Claude/OpenAI/Groq/Deepseek API keys). Em multi-tenant, isso **precisa ser por-tenant**, senão um tenant usa os tokens OAuth (e fatura) de outro.
- **Cloud Functions já existe**, com Admin SDK, triggers (`onScheduleCreate`, `onScheduleUpdate`, `onVehicleUpdate`, `onFeedbackCreate`), job agendado (`scheduledTagUpdate` a cada 3h varrendo *todas* as tags), proxy CORS (`proxyApi`) e push notifications. **Todos os triggers e o cron precisam virar tenant-aware** — hoje fazem queries globais (`db.collection('ktag_tags').get()`).
- **Hospedagem atual:** Firebase Hosting (`ktag-manager.web.app`), não Cloud Run. Migrar para Cloud Run é a TAREFA 6 — viável, mas envolve mover o `server.ts` (Express proxy + Vite middleware) para imagem Docker e refazer DNS wildcard.
- **HashRouter** é usado (`<HashRouter>` em `App.tsx`). Para subdomain routing isso é OK (o subdomínio resolve antes do hash), mas qualquer link absoluto precisa preservar o subdomínio.

> **⚠️ Decisões críticas pendentes — ver §7.** Recomendo não iniciar as tarefas 2–9 antes de o gestor decidir os 6 pontos listados lá.

---

## 1. Inventário de arquivos Firebase

### 1.1 Frontend (cliente Firebase JS SDK v10)

| Arquivo | O que faz | Coleções tocadas |
|---|---|---|
| `services/firebase.ts` | Inicializa `app` + `initializeFirestore` com long-polling forçado e `enableMultiTabIndexedDbPersistence` (offline-first). Lê `VITE_FIREBASE_*`. | — |
| `services/storage.ts` | Camada de dados única. ~50 métodos CRUD + `onSnapshot` em tempo real. Aplica `encryption.encrypt/decrypt` em campos sensíveis e `securityService.generateSearchIndex` (blind index) em placa/CPF. | **Todas as 18 coleções** abaixo (§3) |
| `services/encryption.ts` | AES-GCM via WebCrypto, chave derivada PBKDF2 a partir de `ktag-enterprise-master-key-${user.companySlug}-v2`. | — (puro crypto) |
| `services/jwt.ts` | Assina/verifica token de sessão local (HMAC custom). Não é JWT padrão de servidor. | — |
| `services/security.ts` | Hash SHA-256 com pepper global `KTAG_SECURE_SALT_V3_2025` para senhas. Hash determinístico para blind index (`KTAG_BLIND_INDEX_KEY_X9`). | — |
| `services/rateLimit.ts` | Rate limit local (em memória/localStorage) para login. | — |
| `services/api.ts` | Wrapper de `fetch('/api/proxy')` para chamadas externas (K-TAG/SGA/Hinova). | — |
| `services/melhorEnvio.ts` | Cliente OAuth Melhor Envio (tokens vêm de `ktag_settings_v3`). | — |
| `services/geocoding.ts` | Multi-provider (Photon → Nominatim → Google Maps). | — |
| `services/pushService.ts` | Subscribe Web Push. Persiste em `ktag_push_subscriptions`. | `ktag_push_subscriptions` |
| `services/whatsappService.ts` | Cliente Evolution API. | — |
| `contexts/AuthContext.tsx` | Boot da sessão, login, register, logout. Chama `storage.findUserByEmail` (queries `ktag_users_db`). | `ktag_users_db` (indireto) |
| `App.tsx` | Roteamento + guards (`ProtectedLayout`, `RoleProtectedRoute`). | — |
| **Todos os 30+ `pages/*.tsx`** | Consomem `storage.*` direto. Sem qualquer filtro de tenant. | Várias |

### 1.2 Backend Node/Express

| Arquivo | O que faz |
|---|---|
| `server.ts` (~28KB) | Express 5 + Vite dev middleware + rotas: `/api/proxy`, `/api/geocode*`, `/api/melhorenvio/*`, `/api/track-package`. Em prod serve `dist/`. **Não tem middleware de tenant.** |
| `update_server.cjs` | Script auxiliar (não no fluxo de request). |

### 1.3 Cloud Functions (Admin SDK)

| Arquivo | O que faz | Coleções/escopo |
|---|---|---|
| `functions/index.js` | `proxyApi` (HTTP + rate limit IP), `scheduledTagUpdate` (cron 3h — varre TODAS as tags + vehicles globalmente), `onScheduleCreate/Update`, `onVehicleUpdate`, `onFeedbackCreate`, `sendPushNotification` (callable). Lê settings de `ktag_settings_v3/config`. Auditoria via `logAudit` → `ktag_audit_logs`. | Praticamente todas |

### 1.4 Configuração Firebase

| Arquivo | Conteúdo relevante |
|---|---|
| `firebase.json` | Apenas `functions` + `firestore.rules`. **Sem `hosting:` configurado neste arquivo** (o deploy real provavelmente usa CLI separado). |
| `firestore.rules` | Regras por coleção baseadas em `getUserData().role` (lê `ktag_users_db/{uid}`). Roles: `admin`, `moderator`. **Sem isolamento por tenant.** |

---

## 2. Pontos de vazamento de tenant (cross-tenant leakage)

Se hoje virarmos a chave para multi-tenant sem mudar nada, cada um destes pontos vaza dados de tenant A para tenant B:

### 2.1 Camada `storage.ts` — leakage massivo
Todos os métodos abaixo fazem `collection(db, KEYS.X)` sem `where('tenantId', '==', ...)` nem subcoleção por tenant:

- `findUserByEmail`, `getAllUsers`, `registerUserRequest`, `updateUserProfile`, `updateUserStatus`, `deleteUser` (`ktag_users_db`)
- `getVehicles`, `subscribeVehicles`, `saveVehicle`, `updateVehiclePosition`, `deleteVehicle`, `getPublicVehicleLocation` (`ktag_vehicles`)
- `getClients`, `saveClient`, `deleteClient` (`ktag_clients`)
- `getTags`, `subscribeTags`, `saveTag`, `deleteTag` (`ktag_tags`)
- `getCompanies`, `saveCompany`, `deleteCompany`, `getCategories`, `saveCategory`, `deleteCategory` (`ktag_companies`, `ktag_categories`)
- `getStolenRecords`, `reportTheft`, `recoverTheft`, `getStolenRecordByToken`, `markAsLost` (`ktag_stolen_records`)
- `getSchedules`, `subscribeToSchedules`, `saveSchedule`, `deleteSchedule` (`ktag_schedules`) — filtra por role+userId mas não por tenant
- `getTechnicians`, `saveTechnician`, `deleteTechnician` (`ktag_technicians`)
- `saveFeedback`, `getFeedbacks` (`ktag_feedbacks`)
- `saveSystemUpdate`, `getSystemUpdates`, `deleteSystemUpdate` (`ktag_system_updates`)
- `subscribeShipments`, `saveShipment`, `updateShipmentStatus`, `updateShipment`, `deleteShipment` (`ktag_shipments`)
- `subscribeShippingAddresses`, `saveShippingAddress`, `deleteShippingAddress` (`ktag_shipping_addresses`)
- `getTechnicianPayments`, `saveTechnicianPayment`, `deleteTechnicianPayment` (`ktag_technician_payments`)
- `getCustomRoles`, `saveCustomRole`, `deleteCustomRole` (`ktag_custom_roles`)
- `getAuditLogs`, `logAction` (`ktag_audit_logs`)
- `getSettings`, `saveSettings` (`ktag_settings_v3/config`) — **doc singleton compartilhado**

### 2.2 Functions (`functions/index.js`)
- `scheduledTagUpdate` cron: `db.collection('ktag_tags').get()` → varre tags de TODOS os tenants e tenta atualizar localização com as credenciais K-TAG de **um único `ktag_settings_v3/config`**.
- `onScheduleCreate/Update/onVehicleUpdate/onFeedbackCreate`: triggers em coleção raiz, sem distinção por tenant.
- `sendNotificationToPref`: varre todos os `ktag_users_db` para decidir destinatários — pode notificar usuários de outro tenant.

### 2.3 Segurança no nível de chave criptográfica
- Pepper de senha (`SALT`) e de blind index (`INDEX_SALT`) **são constantes globais hardcoded**. Em multi-tenant isso ainda funciona (não vaza dado), mas comprometer o pepper compromete todos os tenants. Considerar pepper via Secret Manager + chave por tenant (decisão de threat model).

### 2.4 `Vehicle.status == 'stolen'` é leitura pública
`firestore.rules` permite leitura de qualquer veículo roubado por qualquer um (rastreamento policial). Em multi-tenant, alguém de tenant A pode listar veículos roubados de tenant B. Solução: adicionar `tenantId` na rule e exigir match com subdomínio (mas isso bate na arquitetura — leitura pública sem auth não tem subdomínio confiável; melhor mover para rota `/track/:token` autenticada por token único, que já existe parcialmente em `StolenRecord.trackingToken`).

### 2.5 Cache local (`localStorage`)
`cache` em `storage.ts` grava sob chaves `ktag_*` globais sem prefixo de tenant. Se um usuário trocar de subdomínio na mesma máquina (improvável mas possível em dev), vê resíduo do tenant anterior. Mitigação: prefixar `cache` por `tenantId`.

---

## 3. Estrutura de dados atual (Firestore)

Modelo **flat**, prefixo `ktag_*`. 18 coleções identificadas (`services/storage.ts` + `functions/index.js`):

| Coleção | Doc-id | Conteúdo |
|---|---|---|
| `ktag_users_db` | `{uid}` | User (nome/cpf criptografados) |
| `ktag_vehicles` | `{vehicleId}` | Vehicle (placa/chassis criptografados, `plateHash` blind index, `lastPosition` embedded) |
| `ktag_tags` | `{tagId}` | Tag (chaves Apple FindMy criptografadas) |
| `ktag_trackers` | `{trackerId}` | Tracker (rastreador físico) — declarada em KEYS mas pouco usada |
| `ktag_clients` | `{clientId}` | Client (nome/cpf/telefone/email/endereço criptografados, `cpfHash` blind index) |
| `ktag_settings_v3` | `config` (singleton) | AppSettings com credenciais de terceiros |
| `ktag_companies` | `{companyId}` | "Regionais" internas |
| `ktag_categories` | `{categoryId}` | Categorias de veículo (FIPE type) |
| `ktag_stolen_records` | `{recordId}` | Sinistros + token público de rastreio |
| `ktag_audit_logs` | auto | Logs de auditoria (campo `details` criptografado) |
| `ktag_notifications` | auto | App notifications |
| `ktag_schedules` | `{scheduleId}` | Ordens de serviço/agendamentos |
| `ktag_technicians` | `{techId}` | Técnicos despachantes |
| `ktag_feedbacks` | `{feedbackId}` | Feedback de usuários |
| `ktag_system_updates` | `{updateId}` | Changelog público |
| `ktag_shipments` | `{shipmentId}` | Envios Melhor Envio (destinatário criptografado) |
| `ktag_shipping_addresses` | `{addrId}` | Endereços de origem de envio |
| `ktag_technician_payments` | `{payId}` | Pagamentos de técnicos |
| `ktag_custom_roles` | `{roleId}` | Roles customizadas (lista de permissions) |
| `ktag_push_subscriptions` | auto | Subscriptions Web Push (referenciada em functions) |
| `ktag_vehicles/{id}/history` | auto | Subcoleção de histórico de posições (criada em `scheduledTagUpdate`) |

---

## 4. Estrutura proposta

Duas opções viáveis — **escolha do gestor** (decisão D2 em §7):

### Opção A — Subcoleções por tenant (recomendada)

```
/tenants/{tenantId}                       ← TenantData (nome, slug, plan, active, settings_overlay…)
/tenants/{tenantId}/users/{userId}
/tenants/{tenantId}/vehicles/{vehicleId}
/tenants/{tenantId}/tags/{tagId}
/tenants/{tenantId}/clients/{clientId}
/tenants/{tenantId}/schedules/{id}
/tenants/{tenantId}/technicians/{id}
/tenants/{tenantId}/shipments/{id}
/tenants/{tenantId}/shipping_addresses/{id}
/tenants/{tenantId}/technician_payments/{id}
/tenants/{tenantId}/feedbacks/{id}
/tenants/{tenantId}/audit_logs/{id}
/tenants/{tenantId}/companies/{id}        ← "regionais" continuam abaixo do tenant
/tenants/{tenantId}/categories/{id}
/tenants/{tenantId}/stolen_records/{id}
/tenants/{tenantId}/custom_roles/{id}
/tenants/{tenantId}/settings/config       ← settings por tenant (com fallback para defaults globais)

/tenants/{tenantId}/vehicles/{id}/history/{id}   ← já é subcoleção, só desce um nível

/system_settings/global                   ← defaults globais (planos, features flags, fallback de API keys do dono da plataforma)
/system_admins/{uid}                      ← superadmins (acessam admin.dominio.com)
/system_audit_logs/auto                   ← auditoria do painel admin (cross-tenant)
/push_subscriptions/{auto}                ← com campo tenantId (mantém flat por causa de queries globais raras)
/system_updates/{id}                      ← changelog global da plataforma
```

**Prós:** isolamento físico claro; rules ficam triviais (`/tenants/{tenantId}/{document=**}`); migração tem ferramenta natural (copy de root → tenant root); IDs de doc preservados.
**Contras:** queries cross-tenant ficam mais caras para o superadmin (precisa usar `collectionGroup`).

### Opção B — Campo `tenantId` em todos os docs (flat)

Mantém estrutura atual, adiciona `tenantId: string` indexado em cada documento e força `where('tenantId', '==', ...)` em todo `query`. Settings vira `ktag_settings_v3/{tenantId}` (doc por tenant).
**Prós:** migração mais leve (só backfill de campo); queries do superadmin são triviais.
**Contras:** rules ficam mais frágeis (cada coleção precisa repetir checagem); um esquecimento em uma query vaza dados.

### 4.1 `TenantData` (estrutura mínima)
```ts
interface TenantData {
  id: string;
  name: string;
  slug: string;            // = subdomínio, validado em §9 do roteiro
  plan: 'basic' | 'pro' | 'enterprise';
  active: boolean;
  createdAt: number;
  ownerUserId: string;     // admin do tenant
  settings: {
    maxUsers: number;
    features: string[];    // feature flags
    integrations: {
      ktag?: { enabled: boolean };
      hinova?: { enabled: boolean };
      melhorEnvio?: { enabled: boolean };
      ai?: { provider?: string };
    };
  };
}
```

---

## 5. Componentes/arquivos que precisam de tenant context

### 5.1 Frontend
| Arquivo | Mudança |
|---|---|
| `services/firebase.ts` | Adicionar `getTenantFromHostname()` (criar em `utils/tenant.ts`). |
| `services/storage.ts` | **Reescrever** todos os ~50 métodos para receber `tenantId` (ou ler de um contexto). Helper `tenantCollection(t, name)` e `tenantDoc(t, name, id)`. |
| `services/encryption.ts` | Trocar seed para `f(tenantId)`; remover dependência de `user.companySlug`. |
| `contexts/AuthContext.tsx` | Após login, validar `user.tenantId === currentTenantId` (do subdomínio). Se diferente, recusar. |
| `App.tsx` | Envolver com `<TenantProvider>` antes de `<AuthProvider>`. Adicionar rota `/admin/*` com `<SuperAdminGuard>`. Tela "Empresa não encontrada". |
| Todas as `pages/*.tsx` (30+) | Substituir chamadas diretas `storage.getX()` pelo padrão tenant-aware. |
| `components/Layout.tsx`, `WhitelabelStyles.tsx` | Ler `tenant.settings.themeColors` em vez de `AppSettings.themeColors`. |
| `pages/Settings.tsx`, `SettingsV2.tsx` | Settings vira por tenant (admin do tenant edita o próprio). Globais ficam no painel super admin. |
| `pages/Login.tsx` | Mostrar branding do tenant atual. Bloquear se tenant inativo. |
| `pages/PublicTracking.tsx` | Token-only; precisa lookup cross-tenant (via `collectionGroup` ou armazenar `tenantId` no token). |
| `hooks/useScheduleNotifications.ts`, `hooks/useShipments.ts` | Receber/usar tenantId. |
| `utils/permissions.ts` | Adicionar permission `SUPERADMIN_*`. |

### 5.2 Backend Express (`server.ts`)
- Inserir middleware `resolveTenant` antes de todas as rotas `/api/*`.
- Helpers de proxy precisam usar `settings` do tenant atual (Melhor Envio OAuth, K-TAG creds, Hinova creds), não singleton global.
- Geocoding ainda pode usar fallback global (API keys do dono da plataforma).

### 5.3 Cloud Functions (`functions/index.js`)
- `scheduledTagUpdate`: iterar `tenants/*` e, para cada tenant, ler suas tags + settings tenant-aware.
- Todos os triggers: ler `tenantId` do path do doc (`tenants/{tenantId}/schedules/{id}`).
- `sendNotificationToPref`: limitar query a usuários do mesmo tenant da entidade que disparou.
- `proxyApi`: validar header `X-Tenant-Id` (assinado) e checar plano/feature flag.

### 5.4 Firestore Rules
Reescrever do zero (atual usa `getUserData().role` global). Modelo proposto:
```
match /tenants/{tenantId} {
  allow read: if isAuthenticated() && userTenantId() == tenantId;
  allow write: if isSuperAdmin();
}
match /tenants/{tenantId}/{document=**} {
  allow read, write: if isAuthenticated() && userTenantId() == tenantId;
}
match /system_admins/{uid} { allow read, write: if isSuperAdmin(); }
```
Onde `userTenantId()` lê de `/tenants/{x}/users/{uid}.tenantId` ou de custom claim (depende da decisão D1).

---

## 6. Reinterpretação do "painel do gestor" (TAREFA 5 do roteiro)

O roteiro fala em `/admin/boletos` — não existe boleto aqui. Tradução para este produto:

| Página do roteiro | Página real proposta | Conteúdo |
|---|---|---|
| `/admin` | `/admin` Dashboard | Tenants ativos/inativos, total de veículos rastreados, agendamentos no mês por status, envios pendentes, alertas (tenants sem atividade, planos expirando) |
| `/admin/empresas` | `/admin/tenants` | Igual ao do roteiro |
| `/admin/boletos` | `/admin/billing` (futuro) ou **omitir** | Não há boleto; se quiser cobrança, é projeto separado. **Recomendo omitir nesta entrega.** |
| `/admin/usuarios` | `/admin/users` | Usuários cross-tenant com filtro |
| `/admin/configuracoes` | `/admin/settings` | Planos disponíveis, features por plano, domínio base, defaults de API keys do dono da plataforma |
| — | `/admin/audit` (novo) | Audit trail cross-tenant + eventos `CROSS_TENANT_ATTEMPT` (críticos) |

---

## 7. ⚠️ DECISÕES CRÍTICAS PENDENTES

Estas decisões mudam a arquitetura. Recomendo NÃO iniciar TAREFAs 2–9 antes de o gestor responder.

**D1. Autenticação:** Manter o JWT custom atual (com `tenantId` dentro do payload) ou migrar para Firebase Auth com `customClaims` (mais alinhado ao roteiro, mas refactor pesado)?
- *Manter JWT custom:* menos código mexido, mas precisa portar MFA/refresh tokens/policy à mão.
- *Migrar para Firebase Auth:* todo o roteiro de OWASP §9.1 funciona out-of-the-box, mas exige migrar todos os usuários (reset de senha em massa) e reescrever AuthContext.

**D2. Modelo de dados:** Subcoleção `/tenants/{id}/...` (Opção A) ou flat com campo `tenantId` (Opção B)?
- A é mais segura/limpa, B é mais barato migrar.

**D3. `companySlug` existente:** Vira `tenantId` (1:1) ou é abandonado?
- Se virar `tenantId`, precisa-se garantir que a chave de criptografia derivada continue válida (senão dados criptografados ficam ilegíveis).
- Se for abandonado, precisamos de migração de dados criptografados sob nova chave por tenant.

**D4. Settings (credenciais de terceiros):** Cada tenant traz suas próprias credenciais (K-TAG, Hinova, Melhor Envio OAuth, Gemini/Claude/etc), ou o dono da plataforma rateia tudo numa conta única?
- *Por tenant:* mais isolamento e cobrança limpa; cada tenant precisa configurar.
- *Compartilhado:* tenant não configura nada; mas custo e abusos viram seu problema; OAuth do Melhor Envio fica complicado (escopos cruzam empresas).

**D5. Hospedagem:** Mudar de Firebase Hosting para Cloud Run agora, ou primeiro fazer multi-tenant em Hosting e migrar depois?
- Cloud Run é necessário para subdomain wildcard com customização server-side (middleware). Firebase Hosting suporta wildcard mas com limitações de roteamento dinâmico (cada subdomínio precisa de site separado, ou usar Hosting com Cloud Run como backend).
- Decisão tem impacto em DNS/SSL/billing.

**D6. Migração de dados existentes:** O sistema já roda em produção? Há dados de clientes vivos?
- Se *sim*, definir tenant default (ex: `tenant-original`) onde TODOS os dados existentes vão (script de seed `scripts/migrate-to-tenants.ts`).
- Se *não*, podemos quebrar e seedar dados novos sem preocupação.

**D7 (menor). Stack de deploy IaC:** Manter `cloudbuild.yaml` (proposto) ou usar Terraform/gcloud script para wildcard SSL/domain mapping?

---

## 8. Checklist (atualizado, alinhado ao real)

### Multi-Tenant
- [ ] Decisões D1–D7 resolvidas
- [ ] `utils/tenant.ts` com `getTenantFromHostname()` (subdomínio em prod, query param `?tenant=` ou `VITE_DEV_TENANT` em dev)
- [ ] `contexts/TenantContext.tsx` resolvendo tenant + bloqueando se inativo/inexistente
- [ ] `services/storage.ts` reescrito para tenant-aware (helper `tenantCollection`)
- [ ] `services/encryption.ts` ajustado para chave por tenant
- [ ] `contexts/AuthContext.tsx` validando `user.tenantId === currentTenantId`
- [ ] Firestore rules reescritas (§5.4)
- [ ] `server.ts` com middleware `resolveTenant` antes de rotas `/api`
- [ ] `functions/index.js` triggers e cron tenant-aware
- [ ] Slugs reservados bloqueados (`admin`, `api`, `www`, `mail`, `static`, `cdn`, `auth`)
- [ ] Painel super admin em `admin.<dominio>` (D5) com guard

### OWASP (mapeado para a stack real)
- [ ] **9.1 Autenticação:** política de senha 12+ no `registerUserRequest` / `updateProfile`; já há rate limit (`rateLimitService`); falta MFA (depende de D1)
- [ ] **9.1 b:** mensagem genérica em `AuthContext.login` (atualmente revela "Usuário não encontrado" — vazamento mínimo de enumeration)
- [ ] **9.2 RBAC:** já há `utils/permissions.ts` + `customRoles`; estender com `SUPERADMIN_*` e checar `tenantId` em `hasPermission`
- [ ] **9.3 Injeção:** introduzir `zod` (não instalado) para validar inputs em `Schedule`, `Vehicle`, `Client`, `TenantForm`
- [ ] **9.4 Dados sensíveis:** AES-GCM já existe; mover peppers para Secret Manager; reescrever logs para mascarar CPF/IMEI
- [ ] **9.5 HTTP headers:** instalar `helmet` no `server.ts` (não está)
- [ ] **9.6 Rate limit:** já existe no `functions/proxyApi` e em `services/rateLimit.ts` (login); criar limiter em `server.ts` por rota
- [ ] **9.7 CSRF:** SPA + Bearer token = naturalmente mitigado; se adotar cookie de sessão (D1 → Firebase Auth), exigir `sameSite=strict`
- [ ] **9.8 Security logger:** estender `storage.logAction` com eventos `CROSS_TENANT_ATTEMPT`, `SUPERADMIN_LOGIN`, etc. — em coleção separada `system_audit_logs` (não criptografada para permitir alertas)
- [ ] **9.9 Subdomain takeover:** middleware no `server.ts` + checagem no `TenantContext`
- [ ] **9.10 Painel admin:** sessão curta, audit log, MFA obrigatório

---

## 9. Ordem de execução sugerida (após D1–D7 aprovados)

1. Setup: `utils/tenant.ts`, `contexts/TenantContext.tsx`, slugs reservados.
2. Migration script: `scripts/migrate-to-tenants.ts` para colocar dados existentes em `tenant-original` (depende de D6).
3. Reescrever `services/storage.ts` para tenant-aware.
4. Ajustar `services/encryption.ts` (D3).
5. Refazer Firestore rules.
6. Reescrever Functions triggers + cron.
7. Adicionar middleware `resolveTenant` no `server.ts` + `helmet`.
8. Painel super admin (`/admin/*`).
9. Cloud Run + Dockerfile + DNS wildcard (D5).
10. OWASP residual (zod, mensagens de erro genéricas, logs, etc).
11. `MULTITENANT_CHANGES.md` final.

---

*Documento gerado pela TAREFA 1. Próximo passo: aprovação das decisões D1–D7.*
