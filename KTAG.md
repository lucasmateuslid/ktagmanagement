# K-Tag Manager Pro — Documentação Unificada

> Documento único de referência: o que é o KTAG, suas funcionalidades, rotas (frontend + backend),
> modelo de dados, integrações, segurança e deploy. Substitui os antigos docs fragmentados
> (`CODEBASE_SUMMARY`, `MULTITENANT_*`, `PROMPT_*`, `INSTRUCOES/INSTRUCTIONS`, `SECURITY_AUDIT`).

---

## 1. Para que serve o KTAG

O **K-Tag Manager Pro** é uma plataforma **SaaS multi-tenant** de gestão para empresas de
**rastreamento veicular, telemetria e serviços técnicos de campo**. Em uma única aplicação ela cobre
todo o ciclo operacional de uma empresa de rastreio:

- **Ativos**: cadastro e vínculo de equipamentos rastreadores (Tags / Trackers), veículos e clientes.
- **Operação de campo**: ordens de serviço (agendamentos) para instalação, manutenção, retirada e
  vistoria — com cálculo automático de margem financeira do técnico, deslocamento e SLA.
- **Rastreamento ao vivo**: localização em tempo real da frota num mapa, cruzando hardware (Tags) com
  o negócio (veículos), com histórico de trajeto.
- **Logística**: emissão e acompanhamento de envios de equipamentos aos técnicos via transportadoras
  (integração Melhor Envio), incluindo etiquetas e rastreio de pacotes.
- **Inteligência**: dashboards analíticos, relatórios PDF/Excel e um assistente de IA com *function
  calling* que consulta os dados da operação.
- **Plataforma**: cada empresa é um *tenant* isolado (subdomínio próprio + whitelabel), com cobrança
  recorrente (Asaas) gerida por um painel super-admin.

**Público de uso:** empresas associativas/de proteção veicular, instaladoras e despachantes de
rastreadores que precisam orquestrar técnicos em campo e acompanhar a frota dos associados.

---

## 2. Stack & Tecnologias

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Router DOM (HashRouter), Tailwind CSS, Framer Motion, Lucide React, Recharts |
| **Mapas** | Leaflet, React-Leaflet, React-Leaflet-Cluster |
| **Backend (BFF)** | Node.js + Express 5 (`server.ts`) — serve o SPA e atua como proxy/integrações |
| **Serverless** | Firebase Cloud Functions v2 (`functions/index.js`) — triggers, callables, schedulers, webhooks |
| **Dados** | Firebase Firestore (NoSQL, offline-first via IndexedDB multi-tab), Firebase Authentication |
| **IA** | Google Gemini (`@google/genai`), com fallback configurável para Claude (Anthropic), Llama 3 (Groq) e Deepseek |
| **Billing** | Asaas (assinaturas, faturas, PIX, boleto, cartão) |
| **Utilitários** | XLSX/ExcelJS, jsPDF + AutoTable, html5-qrcode, AES-GCM (Web Crypto API) |
| **Infra** | Cloud Run (container do `server.ts`), Cloudflare (DNS/SSL wildcard + proxy), GitHub Actions (CI/CD com Workload Identity Federation) |

Versão: `package.json` → `5.0.0`.

---

## 3. Arquitetura

### 3.1. Frontend — SPA React
- Entrada: `index.tsx` → `App.tsx`. Rotas com **lazy loading** por módulo.
- Estado global via Contexts: `AuthContext`, `TenantContext`, `ThemeContext`, `NotificationContext`,
  `ConnectionContext`, `LanguageContext`, `SystemAdminContext`.
- Camada de dados abstraída em `services/storage.ts` (estratégia híbrida: Firestore → cache local
  offline). Acesso a coleções **sempre** via helpers tenant-aware em `lib/firestore.ts`.

### 3.2. Backend — `server.ts` (Express)
Arquivo único com 3 propósitos:
1. **Hospedagem do SPA**: em produção serve `dist/`; em dev usa o Vite como middleware.
2. **Proxy CORS**: o navegador não pode chamar diretamente APIs de terceiros que bloqueiam origem
   (telemetria K-Tag legada, Hinova/SGA, motores de IA). O endpoint `/api/proxy` assina e repassa.
3. **Endpoints nativos**: geocodificação multi-provedor, rastreio de pacotes e toda a camada
   Melhor Envio (`/api/melhorenvio/*`), protegendo client secrets.

### 3.3. Serverless — Cloud Functions
`functions/index.js` (+ `functions/asaas.js` como helper) hospeda triggers do Firestore,
funções *callable*, *schedulers* (cron) e os *webhooks* (Asaas, Melhor Envio). É o backend de
mutação privilegiada: criação de tenants/usuários, billing, push notifications e atualização
agendada de localização das Tags.

### 3.4. Multi-tenancy
- Roteamento por **subdomínio**: `acme.ktagfinder.app` → tenant `acme`.
- **apex** (`ktagfinder.app` sem subdomínio) → landing/placeholder (`ApexPlaceholder`).
- **`admin.`** → painel super-admin (sub-app `AdminApp` com auth próprio).
- Subdomínios reservados: `admin api www mail ftp static cdn auth app system root localhost lock`.
- Isolamento de dados: todas as coleções de domínio vivem sob `/tenants/{tenantId}/...`.
- Espelho público `/tenants/{id}/public_settings/meta` (`{ name, active, plan }`) é legível sem auth
  para o boot pré-login (checagem de existência/suspensão e whitelabel).
- Em dev, o tenant é resolvido por `VITE_DEV_TENANT` (ou `?tenant=xxx` na URL).

### 3.5. Offline-first
`enableMultiTabIndexedDbPersistence` permite leitura/escrita sem rede; as escritas sincronizam
quando a conexão volta. Dados sensíveis (CPF/CNPJ) são criptografados antes de persistir.

---

## 4. Módulos & Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | KPIs e gráficos analíticos da operação (frota, agendamentos, financeiro). Tem variante específica para técnicos (`TechnicianDashboard`). |
| **Mapa ao Vivo** (`LiveMap`) | Rastreamento da frota em tempo real (polling ~30s), clusterização de marcadores, histórico de trajeto, busca, HUD de status da frota, exportação. |
| **Veículos** | CRUD de veículos, filtros, importação/exportação, lookup FIPE e lookup de placa (Hinova/SGA), KPIs por veículo. |
| **Tags / Rastreadores** | Cadastro de hardware (K-Tag e XADTAG), vínculo com veículos, atualização em lote. |
| **Clientes** | Cadastro de clientes/associados e vínculo com veículos. |
| **Agendamentos** | Módulo central: criação de ordens de serviço, fluxo de status, cálculo de margem/SLA, filtros, cards admin/usuário, dashboards de tipos de serviço/dispositivo e resumo financeiro. |
| **Calendário** | Visão de calendário dos agendamentos. |
| **Técnicos** | Cadastro/escalonamento de técnicos, alerta de disponibilidade, registro inicial (CPF + chave PIX obrigatórios). |
| **Financeiro de Técnicos** | Pagamentos por serviço, detalhamento financeiro, exportação. |
| **Envios (Shipments)** | Logística de equipamentos: lista, formulário, detalhes, impressão, cotação e fluxo Melhor Envio (carrinho → etiqueta → rastreio). |
| **Relatórios** | Geração de relatórios PDF (jsPDF) e Excel (XLSX). |
| **Auditoria** | Logs de auditoria de ações sensíveis (toda deleção é mapeada). |
| **Segurança** | Registro de veículos roubados (`stolen_records`) e ações de segurança. |
| **Feedback** | Sugestões, bugs e melhorias dos usuários. |
| **Configurações** | APIs do sistema, perfil, permissões/roles, anúncios, geocoding, whitelabel, IA. |
| **Billing (tenant)** | Visão da assinatura, faturas, status de pagamento do próprio tenant. |
| **Assistente de IA** | Chat com *function calling*: `analyze_operations` (consultoria executiva sobre frota/SLA/técnicos) e `search_external_data` (queries em integrações como o SGA). Provedor configurável. |
| **Rastreamento Público** | Página `/track/:token` sem login para o cliente final acompanhar um envio/veículo. |
| **Painel Super-Admin** | Gestão de tenants, usuários, billing/faturas globais, MRR, admins de sistema, config Asaas, planos e auditoria. |

---

## 5. Rotas

### 5.1. Frontend — App do Tenant (`App.tsx`)
Rotas protegidas por permissão (`ROUTE_*`) e/ou role.

| Rota | Página | Permissão |
|---|---|---|
| `/login` | Login | pública |
| `/track/:token` | PublicTracking | pública |
| `/technician-registration` | TechnicianRegistration | role `technician` |
| `/` | Dashboard | `ROUTE_DASHBOARD` |
| `/map` | LiveMap | `ROUTE_MAP` |
| `/vehicles` | Vehicles | `ROUTE_VEHICLES` |
| `/tags` | Tags | `ROUTE_TAGS` |
| `/clients` | Clients | `ROUTE_CLIENTS` |
| `/security` | Security | `ROUTE_SECURITY` |
| `/settings` | Settings | — (módulos internos: `ROUTE_SETTINGS_MODULE_*`) |
| `/schedule/new` | ScheduleRequest | `ROUTE_SCHEDULE_NEW` |
| `/schedules` | Schedules | — |
| `/calendar` | Calendar | `ROUTE_CALENDAR` |
| `/technicians` | Technicians | `ROUTE_TECHNICIANS` |
| `/technicians/financials` | TechnicianFinancials | `ROUTE_FINANCIAL` |
| `/envios` | ShipmentsList | `ROUTE_SHIPMENTS` |
| `/envios/nova` · `/envios/:id/editar` | ShipmentForm | `ROUTE_SHIPMENTS` |
| `/envios/:id` | ShipmentDetails | `ROUTE_SHIPMENTS` |
| `/envios/:id/imprimir` | ShipmentPrint | `ROUTE_SHIPMENTS` |
| `/feedback` | FeedbackPage | `ROUTE_FEEDBACK` |
| `/reports` | Reports | `ROUTE_REPORTS` |
| `/audit` | AuditLogs | `ROUTE_AUDIT` |
| `/billing` | Billing | `ROUTE_BILLING` |

### 5.2. Frontend — Painel Super-Admin (`pages/admin/AdminApp.tsx`)
Montado quando o tenant resolvido é `admin`.

| Rota | Página |
|---|---|
| `/admin` | AdminDashboard |
| `/admin/tenants` | AdminTenants |
| `/admin/billing` | AdminBilling |
| `/admin/invoices` | AdminInvoices |
| `/admin/users` | AdminUsers |
| `/admin/system-admins` | AdminSystemAdmins |
| `/admin/audit` | AdminAudit |
| `/admin/asaas-config` | AdminAsaasConfig |
| `/admin/account` | AdminAccount |
| `/admin/plans` | AdminPlansConfig |

### 5.3. Backend — API Express (`server.ts`)
Prefixo `/api`, com rate-limit e resolução de tenant (`resolveTenant`).

| Método | Rota | Função |
|---|---|---|
| GET | `/api/health` | Healthcheck (retorna `tenantId`) |
| POST | `/api/geocode` | Geocodificação (multi-provedor: Photon → Nominatim → Google → ...) |
| POST | `/api/reverse-geocode` | Geocodificação reversa |
| POST | `/api/proxy` | Proxy CORS para APIs externas (telemetria K-Tag, Hinova/SGA, IA) |
| POST | `/api/track` | Rastreio de pacote |
| POST | `/api/melhorenvio/oauth/exchange` · `/oauth/refresh` | OAuth Melhor Envio |
| POST | `/api/melhorenvio/calculate` | Cotação de frete |
| POST | `/api/melhorenvio/companies` | Transportadoras |
| POST | `/api/melhorenvio/cart` · `/checkout` | Carrinho e compra de etiqueta |
| POST | `/api/melhorenvio/generate` · `/print` | Geração e impressão de etiqueta |
| POST | `/api/melhorenvio/tracking` · `/sync-tracking` | Rastreio e sincronização |
| POST | `/api/melhorenvio/cancel` | Cancelamento de etiqueta |

> Fallback: qualquer rota não-API serve o SPA (`dist/index.html`).

### 5.4. Backend — Cloud Functions (`functions/index.js`)

**HTTP / Webhooks (`onRequest`)**: `proxyApi`, `asaasWebhook`.

**Triggers Firestore**: `onScheduleCreate`, `onScheduleUpdate`, `onVehicleUpdate`,
`onFeedbackCreate`, `onTenantUserCreate`, `onTenantUserUpdate`.

**Schedulers (cron)**: `scheduledTagUpdate` (a cada 3h, atualiza localização das Tags),
`dailyBillingEnforcement` (enforcement diário de cobrança/suspensão).

**Callables (`onCall`)** — agrupadas por domínio:
- *Tenants/Usuários*: `createTenant`, `updateTenant`, `setTenantActive`, `deleteTenant`,
  `listAllTenants`, `backfillTenantPublicMeta`, `createTenantUser`, `resetTenantUserPassword`,
  `deleteTenantUser`, `listAllUsers`, `superAdminResetUserPassword`.
- *Admins de sistema*: `addSystemAdmin`, `removeSystemAdmin`.
- *Billing/Asaas*: `createTenantSubscription`, `updateTenantSubscription`,
  `cancelTenantSubscription`, `syncTenantBilling`, `markSetupFeePaid`, `listTenantInvoices`,
  `getMyTenantBilling`, `listMyTenantInvoices`, `syncMyTenantBilling`, `listInvoicesGlobal`,
  `aggregateMRRHistory`, `remindTenantPayment`, `createOneTimeCharge`, `getAsaasConfig`,
  `testAsaasConnection`.
- *Limites/Planos/Uso*: `getTenantUsage`, `updateTenantLimits`, `getPlansConfig`,
  `updatePlansConfig`, `aggregateTenantsStats`.
- *Notificações*: `sendPushNotification`.

---

## 6. Modelo de Dados (Firestore)

### Coleções por tenant — `/tenants/{tenantId}/{coleção}`
Definidas em `services/storage.ts` (`COLLECTIONS`):

`users`, `tags`, `trackers`, `vehicles`, `clients`, `settings`, `companies`, `categories`,
`stolen_records`, `audit_logs`, `schedules`, `technicians`, `feedbacks`, `system_updates`,
`shipments`, `shipping_addresses`, `technician_payments`, `custom_roles`, `public_settings`.

### Coleções de sistema (cross-tenant) — raiz
- `/tenants/{id}` — documento raiz do tenant (incl. `billing.*`, plano, status).
- `/tenants/{id}/public_settings/meta` — espelho público (`name`, `active`, `plan`).
- `/tenants/{id}/public_settings/whitelabel` — tema/logo público (pré-login).
- `/system_admins/{uid}` — admins da plataforma.
- `/push_subscriptions/{auto}` — inscrições Web Push.

### Principais entidades (`types.ts`)
`Tenant`, `TenantBilling`, `Invoice`, `PlanConfig`, `User`, `CustomRole`, `Tag` (`K_TAG`|`XADTAG`),
`Tracker`, `Vehicle`, `Client`, `Schedule` (+ `ScheduleStatus`, `ChecklistItem`), `Technician`
(+ `TechnicianPayment`), `Shipment` (+ `ShipmentItem`, `ShipmentStatus`), `StolenRecord`,
`AuditLog`, `Feedback`, `AppSettings`, `AppAnnouncement`, `LocationHistory`, `KTagLocationResult`.

---

## 7. Perfis de Acesso (RBAC)

Roles checadas em `utils/permissions.ts` e nas regras do Firestore:

- **Admin** — acesso global; configurações de sistema, financeiro, lixeira/expurgo, auditoria.
- **Manager / Moderator** — frota, estoque, clientes e escalonamento de técnicos; sem auditoria/config.
- **User (Operador)** — operacional: agendamentos e status; sem deleção permanente.
- **Technician (`technician` / `admin_tecnico`)** — recebe ordens de serviço e vê sua carteira de pagamentos.
- **Client** — acesso restrito aos próprios veículos e ao mapa; pode emitir notificação de roubo.

Além dos roles, há **permissões granulares** (`ROUTE_*`) e **custom roles** por tenant.

---

## 8. Integrações Externas

| Integração | Uso | Onde |
|---|---|---|
| **K-Tag (telemetria legada)** | Localização de rastreadores (via proxy) | `services/api.ts` → `/api/proxy` |
| **XADTAG** | Tipo alternativo de Tag/telemetria | `services/xadtag.ts` |
| **Hinova / SGA** | ERP associativo: lookup de placa/veículo | `services/hinova.ts` |
| **Melhor Envio** | Frete, etiquetas e rastreio de envios | `services/melhorEnvio.ts` → `/api/melhorenvio/*` |
| **Asaas** | Billing recorrente (assinatura/fatura/PIX/boleto/cartão) | `functions/asaas.js` + webhook |
| **Google Gemini / Claude / Groq / Deepseek** | Assistente de IA (function calling) | `components/ai-assistant/*` |
| **Geocoding** | Photon → Nominatim → Google Maps → Radar/Geoapify/HERE (fallback) | `services/geocoding.ts` + `server.ts` |
| **FIPE** | Consulta de valor/modelo de veículo | `services/fipe.ts` |
| **WhatsApp** | Compartilhamento de links/credenciais | `services/whatsappService.ts` |
| **Web Push (VAPID)** | Notificações push | `services/pushService.ts` + `sendPushNotification` |

---

## 9. Segurança

- **Criptografia local**: dados sensíveis (CPF/CNPJ/nomes) cifrados com AES-GCM (Web Crypto API),
  chave derivada via PBKDF2 (`services/encryption.ts`). ⚠️ Alterar a semente quebra a leitura de
  dados antigos.
- **Origin secret**: em produção o `server.ts` valida o header `X-Origin-Secret` (injetado pela
  Cloudflare Transform Rule) e retorna 403/503 sem ele — bloqueia bypass do proxy via `*.run.app`.
- **Hardening do Express**: `helmet`, CORS allowlist, `express-rate-limit` (limiter geral +
  `sensitiveLimiter` no proxy), allowlist de headers no proxy.
- **Auth**: Firebase Authentication (Email/Password); custom claims `tenantId`/`role`/`approved`.
- **Auditoria**: `audit_logs` por tenant registra ações sensíveis (ex.: deleções).
- **Firestore Rules**: regras restritas por tenant (`firestore.rules`); `trackers`/`stolen_records`
  com escrita controlada.
- Histórico completo da auditoria OWASP estava em `SECURITY_AUDIT_2026-05.md` (consolidado aqui).

---

## 10. Setup & Deploy

### 10.1. Local
```bash
npm ci
(cd functions && npm ci)
npm run dev        # tsx server.ts (Vite como middleware)
npm run lint       # tsc --noEmit (gate de tipo)
npm run build      # vite build → dist/
```
Variáveis em `.env` (ver `.env.example`): `VITE_FIREBASE_*` (config web do Firebase),
`VITE_DEV_TENANT`, `GEOCODING_GOOGLE_API_KEY`, `CF_ORIGIN_SECRET`, e credenciais de seed.
A maior parte das configurações de runtime (URLs de API, tokens Hinova/SGA, proxy) **não** fica no
`.env` — é salva no Firestore (`settings`) e editável via tela **Configurações**.

### 10.2. Ambientes
- **Sandbox**: GCP project `saastagmanager` — secrets `SAASTAGMANAGER_*`.
- **Produção**: GCP project `ktagfinder-prod` — secrets `KTAGFINDER_PROD_*`, domínio `ktagfinder.app`.

### 10.3. CI/CD (GitHub Actions → `.github/workflows/deploy.yml`)
Push no branch principal dispara o deploy (autentica via Workload Identity Federation, sem chave JSON):
1. **Type-check** (`tsc --noEmit`) — gate.
2. **Resolve env secrets** (sandbox/prod).
3. **Cloud Run** — build + push da imagem (`Dockerfile`) + deploy do `ktag-app`.
4. **Firebase Functions** — `firebase deploy --only functions`.
5. **Firestore** — rules + indexes.

Deploy manual de subset: Actions → Deploy → *Run workflow* → `target` (`cloud-run`|`functions`|`firestore`|`all`) + `environment`.

### 10.4. Secrets
- **GitHub (CI/CD)**: `*_PROJECT_ID`, `*_WIF_PROVIDER`, `*_SERVICE_ACCOUNT`, `*_FIREBASE_*` (6).
- **GCP Secret Manager (Functions runtime)**: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`,
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CF_ORIGIN_SECRET`.
- **Local**: `GOOGLE_APPLICATION_CREDENTIALS` → `serviceAccount.json` (gitignored).

Scripts auxiliares em `scripts/`: `setup-gcp-wif.sh`, `setup-functions-secrets.sh`,
`seed-tenants.ts` (cria tenant + admin), `seed-superadmin.ts` (promove superadmin).

### 10.5. Domínio multi-tenant
Cloudflare Free (DNS + Universal SSL wildcard + proxy) na frente do Cloud Run:
CNAMEs `@` e `*` proxied → service `ktag-app`; SSL mode **Full**; Transform Rule injeta
`X-Origin-Secret`; domínios autorizados no Firebase Auth.
> Cloud Run domain mapping **não** suporta wildcard cert — por isso o Cloudflare na frente.

### 10.6. Web Push (VAPID)
Ao rotacionar VAPID, copie a nova public key para `services/pushService.ts` e faça commit.

---

## 11. Estrutura de Pastas

```
.
├── App.tsx, index.tsx        # entrada do SPA + rotas (lazy)
├── server.ts                 # backend Express (SPA host + proxy + Melhor Envio)
├── types.ts                  # interfaces/tipos TypeScript do domínio
├── components/               # UI reutilizável
│   ├── ui/                   # design system (button, input, table, modal, ...)
│   ├── ai-assistant/         # assistente IA (logic + tools + UI)
│   └── settings/             # módulos da tela de Configurações
├── contexts/                 # estado global (Auth, Tenant, Theme, ...)
├── hooks/                    # hooks compartilhados (notificações, shipments, tenants)
├── lib/                      # helpers tenant-aware do Firestore + utils
├── pages/                    # telas (Dashboard, LiveMap, Vehicles, Schedules, Shipments, ...)
│   └── admin/                # sub-app do super-admin
├── services/                 # integrações e lógica de negócio
│   ├── storage.ts            # camada de dados (Firestore + cache offline)
│   ├── encryption.ts         # AES-GCM / PBKDF2
│   ├── api.ts, xadtag.ts     # telemetria
│   ├── hinova.ts, fipe.ts    # ERP / FIPE
│   ├── melhorEnvio.ts        # logística
│   ├── geocoding.ts          # geocoding multi-provedor
│   └── pushService.ts, ...   # push, jwt, rate-limit, segurança
├── utils/                    # permissions, tenant helpers
├── functions/                # Cloud Functions (index.js, asaas.js)
├── scripts/                  # setup GCP/WIF, secrets, seeds
├── firestore.rules           # regras de segurança do Firestore
├── Dockerfile, cloudbuild.yaml
└── .github/workflows/deploy.yml
```

---

**K-Tag Manager Pro** · Desenvolvido por Lucas Mateus.
