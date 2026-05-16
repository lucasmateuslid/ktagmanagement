# PROMPT — Claude Code: Implementação Multi-Tenant + Painel Gestor

> Cole este prompt diretamente no Claude Code na raiz do projeto.

---

## CONTEXTO GERAL

Você é um engenheiro sênior responsável por transformar este sistema (atualmente single-tenant hospedado no Firebase) em uma plataforma **multi-tenant** pronta para produção, com subdomain routing via Cloud Run e um painel administrativo de gestor.

Antes de escrever qualquer linha de código, **leia e mapeie toda a codebase**. Entenda:
- Qual framework está sendo usado (React, Next.js, Vue, etc.)
- Como o Firebase está integrado (Auth, Firestore, Storage, Functions)
- Onde ficam as regras de negócio, autenticação e acesso a dados
- Como as rotas estão estruturadas
- Se existe algum contexto/provider global de usuário ou empresa

Só depois de ter esse mapa mental completo, execute as tarefas abaixo na ordem indicada.

---

## ARQUITETURA ALVO

```
tenant1.seudominio.com  ──┐
tenant2.seudominio.com  ──┤──▶  1 Cloud Run Service  ──▶  Firebase (multi-tenant)
tenant3.seudominio.com  ──┘

DNS: *.seudominio.com → CNAME → ghs.googlehosted.com
```

- **Um único serviço Cloud Run** serve todos os tenants
- O **subdomínio** é a fonte da verdade do tenant (`req.hostname` ou `window.location.hostname`)
- O Firebase **não é replicado** por tenant — a separação é feita por `tenantId` nos documentos
- O painel do gestor fica em `admin.seudominio.com` (ou rota `/admin` com guard)

---

## TAREFA 1 — MAPEAMENTO E RELATÓRIO

Gere um arquivo `MULTITENANT_AUDIT.md` na raiz com:

1. **Inventário de arquivos Firebase** — liste cada arquivo que usa `firebase`, `firestore`, `auth`, `storage` e o que ele faz
2. **Pontos de vazamento de tenant** — onde dados de um tenant poderiam vazar para outro se não houver isolamento
3. **Estrutura de dados atual** — como as coleções do Firestore estão organizadas hoje
4. **Estrutura proposta** — como as coleções devem ficar após multi-tenancy (com `tenantId` como campo obrigatório ou como prefixo de coleção)
5. **Componentes que precisam de tenant context** — liste todos

---

## TAREFA 2 — TENANT RESOLUTION (BACKEND/MIDDLEWARE)

Crie o mecanismo de resolução de tenant a partir do subdomínio.

### Se o projeto tiver servidor (Express, Next.js API routes, etc.):

Crie `src/middleware/tenantMiddleware.ts` (ou `.js`):

```typescript
// Lógica esperada — adapte ao framework do projeto
export function resolveTenant(req, res, next) {
  const hostname = req.hostname || req.headers.host
  const parts = hostname.split('.')

  // admin.dominio.com → tenant especial
  // tenant1.dominio.com → tenant normal
  // localhost → fallback para desenvolvimento

  const subdomain = parts.length >= 3 ? parts[0] : 'localhost'

  req.tenantId = subdomain === 'www' ? 'default' : subdomain
  req.isAdmin = subdomain === 'admin'

  next()
}
```

Aplique este middleware **antes de todas as rotas**.

### Se for SPA (React/Vue sem SSR):

Crie `src/utils/tenant.ts`:

```typescript
export function getTenantFromHostname(): string {
  const hostname = window.location.hostname
  const parts = hostname.split('.')

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Em dev, use query param: ?tenant=empresa1
    const params = new URLSearchParams(window.location.search)
    return params.get('tenant') || 'dev-tenant'
  }

  return parts.length >= 3 ? parts[0] : 'default'
}

export function isAdminPanel(): boolean {
  return getTenantFromHostname() === 'admin'
}
```

---

## TAREFA 3 — TENANT CONTEXT GLOBAL

Crie um Provider/Context global de tenant que toda a aplicação vai consumir.

Arquivo: `src/contexts/TenantContext.tsx` (adapte à stack):

```typescript
// O context deve expor:
// - tenantId: string
// - tenant: TenantData | null  (dados da empresa do Firestore)
// - isLoading: boolean
// - isAdmin: boolean

// TenantData deve conter no mínimo:
// - id: string
// - name: string
// - slug: string (= subdomínio)
// - plan: 'basic' | 'pro' | 'enterprise'
// - active: boolean
// - createdAt: Timestamp
// - settings: objeto de configurações do tenant
```

Envolva o `App` principal com este Provider. O Provider deve:
1. Resolver o tenantId do hostname
2. Buscar os dados do tenant no Firestore (`/tenants/{tenantId}`)
3. Se o tenant não existir ou estiver inativo, mostrar uma página de "Empresa não encontrada"
4. Disponibilizar os dados via hook `useTenant()`

---

## TAREFA 4 — FIREBASE: ISOLAMENTO DE DADOS POR TENANT

### 4.1 — Estrutura do Firestore

Adote o modelo **subcoleções por tenant**:

```
/tenants/{tenantId}/                    ← dados da empresa
/tenants/{tenantId}/users/{userId}      ← usuários deste tenant
/tenants/{tenantId}/boletos/{boletoId}  ← boletos deste tenant
/tenants/{tenantId}/[qualquer_entidade]/{docId}
```

> Se o projeto usar coleções flat (ex: `/users`, `/boletos`), migre para este modelo ou adicione `tenantId` como campo em todos os documentos E adicione nas queries.

### 4.2 — Helper de Firestore com tenant

Crie `src/lib/firestore.ts`:

```typescript
import { collection, doc, getFirestore } from 'firebase/firestore'

export function tenantCollection(tenantId: string, collectionName: string) {
  const db = getFirestore()
  return collection(db, 'tenants', tenantId, collectionName)
}

export function tenantDoc(tenantId: string, collectionName: string, docId: string) {
  const db = getFirestore()
  return doc(db, 'tenants', tenantId, collectionName, docId)
}
```

**Substitua TODOS os usos diretos de `collection(db, 'users')` etc. pelo helper acima.**

### 4.3 — Firebase Auth: isolamento por tenant

Ao criar usuário, salve o `tenantId` no Firestore (`/tenants/{tenantId}/users/{uid}`) e no `customClaims` via Firebase Admin SDK:

```typescript
// Cloud Function ou backend
await admin.auth().setCustomUserClaims(uid, { tenantId })
```

No frontend, após login, valide que o `tenantId` do claim bate com o subdomínio atual. Se não bater, deslogue.

### 4.4 — Firestore Security Rules

Atualize as rules para garantir isolamento:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Tenant só acessa seus próprios dados
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.tenantId == tenantId;
    }

    // Apenas admins do sistema acessam a coleção raiz de tenants
    match /tenants/{tenantId} {
      allow read: if request.auth != null
        && request.auth.token.tenantId == tenantId;
      allow write: if request.auth != null
        && request.auth.token.role == 'superadmin';
    }
  }
}
```

---

## TAREFA 5 — PAINEL DO GESTOR (SUPERADMIN)

Crie um painel acessível via `admin.seudominio.com` (ou `/admin` com guard de role `superadmin`).

### 5.1 — Guard de acesso

```typescript
// Só entra no painel quem tem token.role === 'superadmin'
// Redireciona para /login caso contrário
```

### 5.2 — Páginas do painel (crie todas)

#### `/admin` — Dashboard
- Total de tenants ativos/inativos
- Total de boletos por status (pago, pendente, vencido)
- Receita total consolidada
- Últimos tenants criados
- Alertas (tenants sem boleto há X dias, planos expirando)

#### `/admin/empresas` — Gestão de Tenants
Tabela com:
- Nome da empresa
- Slug (subdomínio)
- Plano atual
- Status (ativo/inativo)
- Data de criação
- Ações: Editar | Ativar/Desativar | Acessar como (impersonate) | Deletar

Formulário de criação/edição de tenant:
```typescript
interface TenantForm {
  name: string           // Nome da empresa
  slug: string           // Subdomínio (validar: apenas letras, números, hífens)
  plan: 'basic' | 'pro' | 'enterprise'
  active: boolean
  adminEmail: string     // Email do admin desta empresa
  settings: {
    maxUsers: number
    features: string[]
  }
}
```

#### `/admin/boletos` — Gestão de Boletos (visão consolidada)
- Todos os boletos de todos os tenants
- Filtros: tenant, status, período, valor
- Ações em lote: marcar como pago, cancelar
- Exportar CSV

#### `/admin/usuarios` — Gestão de Usuários
- Todos os usuários de todos os tenants
- Filtro por tenant
- Ações: redefinir senha, desativar, trocar de tenant

#### `/admin/configuracoes` — Configurações globais
- Configurações do sistema (nome da plataforma, domínio base)
- Planos disponíveis e limites
- Webhooks globais

### 5.3 — Componentes obrigatórios do painel

- `<TenantSelector />` — dropdown para filtrar por tenant em qualquer página
- `<StatusBadge status="active|inactive|pending" />`
- `<PlanBadge plan="basic|pro|enterprise" />`
- Sidebar com navegação entre seções
- Header com info do usuário logado e botão de logout

---

## TAREFA 6 — CLOUD RUN: CONFIGURAÇÃO

Crie ou atualize os arquivos de deploy:

### `Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
```

### `.env.production` (template — não commitar valores reais)
```env
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
DOMAIN_BASE=seudominio.com
ADMIN_SUBDOMAIN=admin
NODE_ENV=production
PORT=8080
```

### `cloudbuild.yaml`
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/app:$COMMIT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/app:$COMMIT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - app
      - --image=gcr.io/$PROJECT_ID/app:$COMMIT_SHA
      - --region=us-central1
      - --platform=managed
      - --allow-unauthenticated
```

---

## TAREFA 7 — DESENVOLVIMENTO LOCAL

Crie `scripts/dev-tenant.sh`:

```bash
#!/bin/bash
# Uso: ./scripts/dev-tenant.sh empresa1
# Inicia o servidor com ?tenant=empresa1 simulado

TENANT=${1:-dev-tenant}
echo "🚀 Iniciando com tenant: $TENANT"
VITE_DEV_TENANT=$TENANT npm run dev
```

Atualize o `tenant.ts` para ler `VITE_DEV_TENANT` em desenvolvimento:

```typescript
if (import.meta.env.DEV) {
  return import.meta.env.VITE_DEV_TENANT || 'dev-tenant'
}
```

---

## TAREFA 8 — SEED DE DADOS

Crie `scripts/seed-tenants.ts` para popular o Firestore com dados iniciais:

```typescript
// Deve criar:
// 1. Tenant "admin" com role superadmin
// 2. 2-3 tenants de exemplo com dados fake
// 3. Boletos de exemplo em cada tenant
// Usar firebase-admin SDK
```

---

## TAREFA 9 — SEGURANÇA (OWASP)

Aplique os controles mínimos de segurança baseados no **OWASP Cheat Sheet Series**. Para cada item, implemente o controle e registre no `MULTITENANT_AUDIT.md` o que foi feito.

---

### 9.1 — Autenticação (OWASP Authentication Cheat Sheet)

**Implemente ou valide:**

```typescript
// Política de senha mínima no Firebase Auth (via backend ao criar usuário)
// Mínimo: 12 caracteres, 1 maiúscula, 1 número, 1 caractere especial
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
}

// Bloqueio após tentativas falhas (rate limiting no endpoint de login)
// Implemente via middleware com contador por IP + por email
const LOGIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutos
  blockDurationMs: 30 * 60 * 1000, // bloqueia por 30 min
}
```

- Implemente **Multi-Factor Authentication (MFA)** opcional via Firebase Auth (TOTP ou SMS)
- Tokens de sessão devem ter **expiração curta** (1h) com refresh token de 7 dias
- Ao trocar senha, invalide **todas as sessões ativas** do usuário (`revokeRefreshTokens`)
- Login com Google/OAuth deve também validar o `tenantId` do usuário após autenticação
- Nunca retorne mensagens de erro que revelem se o email existe (`"Email ou senha inválidos"` — nunca `"Email não encontrado"`)

---

### 9.2 — Autorização e Controle de Acesso (OWASP Authorization Cheat Sheet)

**Modelo RBAC por tenant:**

```typescript
// src/types/roles.ts
export type SuperAdminRole = 'superadmin'

export type TenantRole = 'admin' | 'manager' | 'viewer'

export interface UserClaims {
  tenantId: string
  role: TenantRole | SuperAdminRole
  permissions: Permission[]
}

export type Permission =
  | 'boletos:read'
  | 'boletos:write'
  | 'boletos:delete'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'settings:read'
  | 'settings:write'
  | 'reports:read'

// Mapa de permissões por role
export const ROLE_PERMISSIONS: Record<TenantRole, Permission[]> = {
  admin:   ['boletos:read','boletos:write','boletos:delete','users:read','users:write','settings:read','settings:write','reports:read'],
  manager: ['boletos:read','boletos:write','users:read','reports:read'],
  viewer:  ['boletos:read','reports:read'],
}
```

```typescript
// src/hooks/usePermission.ts
export function usePermission(permission: Permission): boolean {
  const { tenant } = useTenant()
  const { user } = useAuth()
  if (!user || !tenant) return false
  const claims = user.customClaims as UserClaims
  // Superadmin bypassa tudo
  if (claims.role === 'superadmin') return true
  // Tenant correto + permissão
  if (claims.tenantId !== tenant.id) return false
  return ROLE_PERMISSIONS[claims.role]?.includes(permission) ?? false
}
```

- **Nunca confie apenas no frontend** — todas as permissões devem ser validadas nas Firestore Security Rules e/ou no backend
- Implemente **Principle of Least Privilege**: cada usuário tem o mínimo de permissões necessário
- Ações destrutivas (deletar empresa, deletar boleto) devem exigir **confirmação + re-autenticação** (`reauthenticateWithCredential`)

---

### 9.3 — Proteção contra Injeção (OWASP Injection Prevention Cheat Sheet)

**Validação e sanitização de inputs:**

Instale e use `zod` para validar todos os inputs antes de qualquer operação:

```typescript
// src/lib/validators.ts
import { z } from 'zod'

export const TenantSlugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens')
  .refine(s => !RESERVED_SLUGS.includes(s), 'Slug reservado pelo sistema')

// Slugs que não podem ser usados como tenant (proteção contra path traversal)
const RESERVED_SLUGS = ['admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'static', 'cdn', 'auth']

export const BoletoSchema = z.object({
  valor: z.number().positive().max(999999.99),
  vencimento: z.string().datetime(),
  descricao: z.string().max(255).trim(),
  // Nunca aceite HTML em campos de texto livre
})

export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).trim(),
  role: z.enum(['admin', 'manager', 'viewer']),
})
```

- **Nunca** interpole inputs de usuário diretamente em queries do Firestore como IDs de documento sem validar
- Sanitize campos que serão renderizados como HTML (use `DOMPurify` se necessário)
- Implemente validação tanto no frontend quanto no backend/Cloud Functions

---

### 9.4 — Proteção de Dados Sensíveis (OWASP Cryptographic Storage Cheat Sheet)

```typescript
// NUNCA armazene no Firestore:
// - Senhas (Firebase Auth gerencia isso)
// - Chaves de API em texto plano → use Google Secret Manager
// - Números de cartão de crédito completos
// - CPF/CNPJ em texto plano em coleções públicas

// Para dados sensíveis no Firestore, use campos com acesso restrito nas Security Rules:
match /tenants/{tenantId}/users/{userId} {
  // CPF só acessível pelo próprio usuário ou admin do tenant
  allow read: if request.auth.uid == userId
    || request.auth.token.role == 'admin';
}
```

- Logs **não devem conter** dados sensíveis (CPF, senha, token, chave de API)
- Implemente máscara em logs: `"cpf": "***.***.***-**"`
- Variáveis de ambiente com secrets **nunca no repositório** — use Google Secret Manager ou Cloud Run Secrets

---

### 9.5 — HTTP Security Headers (OWASP HTTP Security Response Headers Cheat Sheet)

Se o projeto tiver servidor Express/Next.js, instale e configure `helmet`:

```typescript
// src/server.ts ou next.config.js
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://apis.google.com", "https://*.firebaseapp.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.googleapis.com"],
      connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: { features: { camera: [], microphone: [], geolocation: [] } },
}))
```

Para Next.js, adicione em `next.config.js`:

```javascript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ],
}]
```

---

### 9.6 — Rate Limiting e Proteção contra Abuso (OWASP API Security Cheat Sheet)

```typescript
// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit'

// Rate limit geral da API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 req por IP a cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
})

// Rate limit específico para login (mais restritivo)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // não conta tentativas bem-sucedidas
})

// Rate limit para criação de tenants (apenas superadmin, mas mesmo assim)
export const tenantCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
})
```

- Endpoints de **criação de usuário, login e reset de senha** devem ter rate limiting separado e mais restritivo
- Implemente **CAPTCHA** (Google reCAPTCHA v3) no formulário de login público

---

### 9.7 — Cross-Site Request Forgery — CSRF (OWASP CSRF Cheat Sheet)

- Para SPAs com Firebase Auth usando `Authorization: Bearer`, o CSRF é mitigado naturalmente (não usa cookies de sessão)
- Se usar cookies de sessão, implemente token CSRF via `csurf` ou use o padrão **SameSite=Strict** nos cookies:

```typescript
// Configuração de cookie seguro
res.cookie('session', sessionCookie, {
  httpOnly: true,
  secure: true,         // apenas HTTPS
  sameSite: 'strict',   // bloqueia CSRF
  maxAge: 60 * 60 * 1000,
})
```

---

### 9.8 — Logging e Monitoramento de Segurança (OWASP Logging Cheat Sheet)

Crie `src/lib/securityLogger.ts`:

```typescript
// Eventos que DEVEM ser logados
export const SECURITY_EVENTS = {
  LOGIN_SUCCESS:        'auth.login.success',
  LOGIN_FAILURE:        'auth.login.failure',
  LOGIN_BLOCKED:        'auth.login.blocked',
  LOGOUT:               'auth.logout',
  PASSWORD_RESET:       'auth.password_reset',
  MFA_ENABLED:          'auth.mfa.enabled',
  PERMISSION_DENIED:    'authz.permission_denied',
  CROSS_TENANT_ATTEMPT: 'security.cross_tenant_attempt', // crítico!
  TENANT_CREATED:       'admin.tenant.created',
  TENANT_DISABLED:      'admin.tenant.disabled',
  USER_ROLE_CHANGED:    'admin.user.role_changed',
  SUPERADMIN_LOGIN:     'admin.superadmin.login',
  BULK_DATA_EXPORT:     'data.bulk_export',
}

export async function logSecurityEvent(
  event: string,
  userId: string,
  tenantId: string,
  metadata: Record<string, unknown> = {}
) {
  // Salvar no Firestore em /security_logs/{autoId}
  // NUNCA logue dados sensíveis (senha, CPF, token)
  await addDoc(collection(db, 'security_logs'), {
    event,
    userId,
    tenantId,
    timestamp: serverTimestamp(),
    ip: metadata.ip ?? 'unknown',
    userAgent: metadata.userAgent ?? 'unknown',
    // metadata sem dados sensíveis
  })
}
```

- Logue especialmente **tentativas de acesso cross-tenant** como evento de alta severidade
- Configure alertas no Google Cloud Logging para eventos críticos
- Retenha logs de segurança por no mínimo **90 dias**

---

### 9.9 — Proteção contra Subdomain Takeover (específico para multi-tenant)

```typescript
// src/middleware/tenantMiddleware.ts — adicione validação extra
export async function resolveTenant(req, res, next) {
  const tenantId = extractSubdomain(req.hostname)

  // 1. Valide contra lista de slugs reservados
  if (RESERVED_SLUGS.includes(tenantId)) {
    return res.status(403).json({ error: 'Subdomínio reservado' })
  }

  // 2. Verifique se o tenant existe E está ativo no Firestore
  const tenantDoc = await getDoc(doc(db, 'tenants', tenantId))
  if (!tenantDoc.exists() || !tenantDoc.data().active) {
    return res.status(404).send(renderTenantNotFound())
  }

  // 3. Só então prossiga
  req.tenantId = tenantId
  req.tenantData = tenantDoc.data()
  next()
}
```

- Um subdomínio **nunca deve resolver** se não tiver um tenant correspondente ativo no banco
- Isso previne que alguém registre um slug e se passe por um tenant legítimo

---

### 9.10 — Segurança no Painel Admin

- O painel `admin.seudominio.com` deve ter **IP allowlist** configurada no Cloud Run (restringir a IPs conhecidos se possível)
- Sessões do superadmin devem ter **expiração de 1 hora** sem renovação automática
- Toda ação destrutiva no painel deve gerar entrada no `security_log` e enviar email de notificação
- Implemente **audit trail** para o painel: cada mudança registra `quem`, `o que`, `quando` e `valor anterior`

```typescript
// src/lib/auditLog.ts
export async function auditLog(action: {
  adminId: string
  action: string
  targetType: 'tenant' | 'user' | 'boleto' | 'settings'
  targetId: string
  before: unknown
  after: unknown
}) {
  await addDoc(collection(db, 'audit_logs'), {
    ...action,
    timestamp: serverTimestamp(),
  })
}
```

---

## CHECKLIST FINAL

Antes de terminar, valide cada item:

**Multi-Tenant**
- [ ] `getTenantFromHostname()` funciona em dev (query param) e prod (subdomínio)
- [ ] `TenantContext` bloqueia acesso se tenant não existe no Firestore
- [ ] Todas as queries do Firestore usam `tenantId` — nenhuma busca dados globais sem filtro
- [ ] Firebase Security Rules impedem cross-tenant data access
- [ ] Painel `/admin` só é acessível com role `superadmin`
- [ ] Dockerfile expõe porta 8080
- [ ] Variáveis de ambiente documentadas
- [ ] `MULTITENANT_AUDIT.md` gerado e atualizado

**OWASP — Segurança**
- [ ] Política de senha mínima implementada (12+ chars, complexidade)
- [ ] Rate limiting em login, criação de usuário e reset de senha
- [ ] Todos os inputs validados com `zod` antes de qualquer operação
- [ ] Slugs reservados bloqueados no tenant resolution
- [ ] HTTP security headers configurados (`helmet` ou `next.config.js`)
- [ ] Cookies com `httpOnly`, `secure`, `sameSite: strict`
- [ ] RBAC implementado com `usePermission()` + Firestore Rules
- [ ] Dados sensíveis não aparecem em logs
- [ ] `securityLogger` logando eventos críticos (cross-tenant, login failure, role change)
- [ ] `auditLog` registrando todas as ações do painel admin
- [ ] Sem segredos hardcoded — tudo via variáveis de ambiente ou Secret Manager
- [ ] Mensagens de erro de auth não revelam se email existe ou não

---

## NOTAS IMPORTANTES

1. **Não quebre o que já funciona.** Se algo estava funcionando single-tenant, garanta que continue funcionando para o primeiro tenant após a migração.
2. **Nenhuma coleção do Firestore deve ser acessada sem `tenantId`** — se encontrar, corrija ou documente no audit.
3. **Se encontrar ambiguidade** (ex: não saber se uma entidade deve ser por-tenant ou global), pergunte antes de implementar.
4. **Mantenha o código tipado** — se o projeto usar TypeScript, não use `any`.
5. **Gere um resumo final** `MULTITENANT_CHANGES.md` listando cada arquivo modificado e o que foi alterado.
