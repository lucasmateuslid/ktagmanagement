# K-Tag Manager Pro — Auditoria de Segurança (OWASP)

> **Auditor:** Análise senior contra OWASP Top 10 2021 + OWASP Cheat Sheet Series.
> **Data:** 2026-05-19
> **Branch:** `Multi-tenant-version`
> **Escopo:** Backend Express (`server.ts`), Cloud Functions (`functions/`),
> Firestore Rules, Frontend React, Dockerfile, CI/CD, deps npm.

---

## 1. Resumo executivo

| Severidade | Encontradas | Corrigidas neste PR | Pendentes |
|---|---|---|---|
| Crítica | 4 | 4 | 0 |
| Alta    | 6 | 5 | 1 (xlsx) |
| Média   | 7 | 6 | 1 (jspdf — decisão) |
| Baixa   | 4 | 2 | 2 (informacionais) |

- `npm audit`: **20 → 2** vulnerabilidades. As 2 restantes exigem breaking change.
- `tsc --noEmit`: passa limpo após todas as correções.
- Nenhuma mudança quebra API pública das libs front (jsPDF/xlsx ainda em uso).

---

## 2. Vulnerabilidades corrigidas

### CRÍTICA — SSRF em `/api/proxy` e `proxyApi` (Cloud Function)
**OWASP:** A10:2021 Server-Side Request Forgery
**Arquivos:** `server.ts:344-397` (antes) → reescrito. `functions/index.js:294-382` reescrito.
**Risco:** Cliente podia mandar `POST /api/proxy { url: "http://169.254.169.254/computeMetadata/v1/" }` e obter tokens da service account do Cloud Run (escalada de privilégio para acesso total ao GCP project). Também acesso a localhost (admin panels), RFC1918 (rede interna) e DNS rebinding.
**Fix:** novo guard `assertProxyTargetAllowed` (em `server.ts` e `functions/index.js`):
- bloqueia `metadata.google.internal`, `instance-data`, loopback, link-local (169.254/16), RFC1918, CGNAT (100.64/10), IPv6 ULA e multicast;
- resolve DNS e re-valida cada IP retornado (mitigação DNS rebinding);
- rejeita URLs com `user:pass@`;
- restringe métodos HTTP a `GET/POST/PUT/PATCH/DELETE/HEAD`;
- header allowlist (sem `Cookie`, `Host`, etc);
- `redirect: 'manual'` / `maxRedirects: 0` (evita SSRF via `Location`);
- timeout 15s + cap de 5 MB no body;
- allowlist opcional via `PROXY_ALLOWED_HOSTS` env (recomendado em produção).

### CRÍTICA — VAPID private key hardcoded em `functions/index.js`
**OWASP:** A02:2021 Cryptographic Failures, A05:2021 Security Misconfiguration
**Arquivo:** `functions/index.js:48-51` (antes).
**Risco:** A privada VAPID `"7U_Yyn_NkWjIt8IyjjydcwkcNOP5p6a9b1YqBAwqEEY"` em texto puro no Git permite que qualquer pessoa com acesso ao repo (ou ao Git history) envie push notifications fingindo ser a aplicação — phishing direto no usuário ("Senha resetada, clique aqui").
**Fix:** movidas para Secret Manager via `defineSecret("VAPID_PUBLIC_KEY")` e `defineSecret("VAPID_PRIVATE_KEY")`. Todas as funções que enviam push (`asaasWebhook`, `dailyBillingEnforcement`, `onScheduleCreate/Update`, `onVehicleUpdate`, `onFeedbackCreate`, `sendPushNotification`) declaram `secrets: VAPID_SECRETS`. Helper `configureWebPush()` carrega lazy.

> **AÇÃO PÓS-DEPLOY OBRIGATÓRIA:**
> ```bash
> firebase functions:secrets:set VAPID_PUBLIC_KEY
> firebase functions:secrets:set VAPID_PRIVATE_KEY
> ```
> E **REVOGUE** as keys antigas — elas estão em git history público.

### CRÍTICA — JWT_SECRET hardcoded em `services/jwt.ts`
**OWASP:** A02:2021 Cryptographic Failures
**Arquivo:** `services/jwt.ts:8` (antes): `JWT_SECRET = 'ktag-pro-super-secret-key-2025-v3'`.
**Risco:** Mesmo arquivo "deprecated", o secret estava no bundle Vite — qualquer um podia gerar tokens válidos. Bypass total de auth se algum caller residual ainda existisse.
**Fix:** arquivo reescrito como stub que dispara `Error('descontinuado')`. Toda a auth real passa por Firebase Auth.

### CRÍTICA — Firestore catch-all permissivo neutraliza regras restritas
**OWASP:** A01:2021 Broken Access Control
**Arquivo:** `firestore.rules:89-91` (antes).
**Risco:** Em Firestore Rules, regras múltiplas compõem por **OR** — não há "regra mais específica vence". O catch-all `allow read, write: if isMemberOf(tenantId)` tornava as regras restritivas abaixo dead code. Qualquer membro aprovado podia:
- adulterar `audit_logs` (a regra `update, delete: if false` nunca era aplicada);
- escrever `invoices` (faturas Asaas) — fraude financeira;
- promover-se via `custom_roles` (escalada de privilégio dentro do tenant);
- modificar `stolen_records` de outros usuários do tenant.
**Fix:** catch-all removido. Cada subcoleção declarada explicitamente. Coleções novas começam negadas (default-deny). `stolen_records` agora separa `get` (público via token) de `list` (só membros — evita enumeração).

### ALTA — Webhook Melhor Envio sem validação de assinatura
**OWASP:** A07:2021 Identification and Authentication Failures
**Arquivo:** `server.ts:706-722` (antes).
**Fix:** validação HMAC-SHA-256 do raw body contra `X-Me-Signature`. Sem `MELHOR_ENVIO_WEBHOOK_SECRET` configurado, o endpoint retorna 503 (fail-closed). Comparação com `timingSafeEqual`.

### ALTA — CORS aberto + sem helmet/rate-limit no `server.ts`
**OWASP:** A05:2021 Security Misconfiguration
**Arquivo:** `server.ts:305` (antes): `app.use(cors())`.
**Fix:**
- CORS restrito a `^https://([a-z0-9-]+\.)?ktagfinder\.app$` em produção (override `CORS_ALLOW_ALL` apenas para emergência);
- `helmet` com HSTS, `X-Frame-Options`, `Referrer-Policy: strict-origin-when-cross-origin`;
- `express.json({ limit: '100kb' })` — antes era ilimitado (DoS via JSON gigante);
- `express-rate-limit`: 120 req/min por IP em `/api/*`, 20 req/min em `/api/proxy`;
- `app.set('trust proxy', 1)` em vez de `true` — evita spoof de `X-Forwarded-For`.

### ALTA — `Math.random()` usado para gerar senhas
**OWASP:** A02:2021 Cryptographic Failures
**Arquivos:**
- `functions/index.js:902-908` (`generateRandomPassword`) — usado em `createTenantUser`, `resetTenantUserPassword`, `createTenant`, `superAdminResetUserPassword`.
- `services/security.ts:54` (`generateStrongPassword`).
**Risco:** `Math.random()` é PRNG não-criptográfica. Com algumas amostras (ex.: senhas geradas em sequência), o estado interno pode ser inferido e senhas futuras previstas.
**Fix:** `crypto.randomInt` no Node, `crypto.getRandomValues` no browser. Tamanho de senha aumentado para 16 chars no Node, 8 + prefixo no browser.

### ALTA — XSS via `window.open()` + `document.write()` em Feedback
**OWASP:** A03:2021 Injection (XSS)
**Arquivo:** `pages/Feedback.tsx:207` (antes): `` w.document.write(`<img src="${att}"...`) ``.
**Risco:** Se `att` carrega aspas duplas ou `"><script>`, o atacante (autor do feedback) executa JS no contexto da SPA na sessão de quem visualizar o feedback — roubo de Firebase Auth token, fetch para `/api/*` em nome da vítima.
**Fix:** abre a URL diretamente em nova aba com `noopener,noreferrer`, valida que começa com `https?:`, `data:image/` ou `blob:`. Sem string interpolation em HTML.

### ALTA — `ktag_trackers` permitia write para qualquer autenticado
**OWASP:** A01:2021 Broken Access Control (cross-tenant)
**Arquivo:** `firestore.rules:191` (antes).
**Fix:** `allow write: if isSuperAdmin()`. Catálogo de rastreadores é cross-tenant; um tenant não pode adulterar o que outro tenant vê.

### MÉDIA — `npm audit` 20 vulnerabilidades em dependências
**Fix:** `overrides` no `package.json`:
```json
{
  "overrides": {
    "undici": "^6.25.0",
    "http-proxy-agent": "^7.0.2",
    "@tootallnate/once": "^3.0.1"
  }
}
```
Resolve: 8 CVEs de `undici` (incluindo `CRLF Injection`, `HTTP Request Smuggling`, `WebSocket overflow`), `@tootallnate/once` (Incorrect Control Flow Scoping), e a chain de `http-proxy-agent` (também via `firebase-admin`/`@google-cloud/storage`). **Não há downgrade de `firebase-admin`** (que o `npm audit fix --force` tentava fazer, indo de 13.x para 10.x).

### MÉDIA — Headers não-allowlist no proxy
**Arquivos:** `server.ts` e `functions/index.js`.
**Risco:** o proxy repassava qualquer header do cliente (após remover host/origin) — incluindo cookies de outros domínios em alguns cenários. Agora só headers da allowlist (`authorization`, `content-type`, `accept`, `apikey`, `api_token`, `timestamp`, `user-agent`, `x-api-key`) são repassados.

### MÉDIA — Body size ilimitado / sem timeout no fetch original
**Fix:** body limit 100 kB no Express, 256 kB no webhook ME (raw). Fetch do proxy com timeout 15s e cap de 5 MB no upstream.

### MÉDIA — `trust proxy: true` vs hop count
**Arquivo:** `server.ts:310` (antes): `app.set('trust proxy', true)`.
**Risco:** com `true`, qualquer `X-Forwarded-For` é confiado — atacante pode falsificar IP para bypass de rate-limit.
**Fix:** `app.set('trust proxy', 1)` (apenas 1 hop, que é o Cloud Run).

---

## 3. Pontos QUE EXIGEM SUA DECISÃO

### 1. `jspdf@3.0.4` → `jspdf@4.2.1` (breaking change)
**Severidade no audit:** CRITICAL (10 CVEs: XSS in PDF, Path Traversal, DoS via BMP/GIF, Race Condition).
**Impacto da migração:** baixo — todos os 10 calls da codebase usam apenas `new jsPDF()`, `doc.text()`, `doc.autoTable()`. API se mantém entre 3.x e 4.x.
**Mitigação atual:** os CVEs exigem que o atacante controle o **conteúdo** do PDF gerado (XMP metadata, BMP/GIF embed, AcroForm). Como hoje só geramos PDFs com dados de domínio próprios (não há upload de imagem para virar PDF), o risco real é baixo. Mas o CVE de Path Traversal afeta inputs em `loadFile`, que pode ser explorado dependendo do uso futuro.
**Recomendação:** atualizar em PR separado, testar a geração de cada relatório (Audit Logs, Clients, Tags, Reports, vehicles/KPI, TrackingModal, TechnicianFinancial, schedules) e fazer release.

### 2. `xlsx@0.18.5` — Prototype Pollution + ReDoS, sem fix oficial no npm
**CVE:** GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9.
**Estado:** SheetJS removeu do npm registry; correções só no registro próprio `https://cdn.sheetjs.com/`.
**Uso atual:** `pages/Clients.tsx:115` e `pages/Tags.tsx:280,329,628` — export simples via `XLSX.utils.json_to_sheet` + `XLSX.writeFile`.
**Você já tem `exceljs@4.4.0`** instalado (estável, sem CVEs).
**Caminho recomendado (1 dia de trabalho):**
```ts
// antes
const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet");
XLSX.writeFile(wb, "file.xlsx");

// depois
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Sheet");
ws.columns = Object.keys(data[0]).map(k => ({ header: k, key: k }));
ws.addRows(data);
const buf = await wb.xlsx.writeBuffer();
saveAs(new Blob([buf]), "file.xlsx");
```

### 3. Senhas temporárias via WhatsApp (`generateShareLink`)
**Arquivo:** `services/security.ts`.
**Tradeoff:** WhatsApp em claro é frágil. Não corrigi porque pode ser fluxo de negócio aceito.
**Alternativa segura:** enviar magic link de "primeiro acesso" (Firebase Auth `sendPasswordResetEmail` ou `generateSignInWithEmailLink`) — o usuário define a própria senha. Discutir com o time se mudar UX é OK.

### 4. `encryption.ts` — salt PBKDF2 fixo global (`'ktag-enterprise-salt-2025'`)
**Arquivo:** `services/encryption.ts:46`.
**Tradeoff:** salt deveria ser per-record + persistido (Initialization Vector já é per-record, mas o salt da derivação não). Hoje, conhecendo o `tenantId` (subdomínio público) + o composedSeed pattern, é factível pré-computar a chave do tenant — só protege contra atacante que NÃO tem acesso ao código.
**Recomendação:** salt por tenant gravado em `/tenants/{id}/settings/encryption_salt` (random 16 bytes), 200k+ iterações PBKDF2. Migração exige re-criptografar dados existentes — projeto separado.

---

## 4. Outros achados (informacionais)

- **`functions/index.js`** ainda usa `Math.random()` para gerar IDs de audit logs (linhas 467, 728, 764, 865). Não é security-critical (não é segredo), mas a má prática. Recomendo `crypto.randomUUID()`.
- **`xssProtection.sanitizeText`** (`services/xssProtection.ts:11`) só remove `<` e `>`. Vulnerável a `javascript:` em hrefs, `onerror` em atributos, etc. Como o app usa React (que escape automaticamente), o risco é baixo, mas a função NÃO é blindada para uso em `dangerouslySetInnerHTML` ou href.
- **Logs com conteúdo sensível**: o proxy loga `[PROXY] Proxying request to: ${url}` — se a URL contém API key na query string, vai pro log. Considerar redação de query string com keys conhecidas.
- **Dockerfile** roda como `node` (não root) ✓, mas não declara `HEALTHCHECK`.
- **CI/CD (`cloudbuild.yaml`)** usa `--allow-unauthenticated` — esperado para SPA pública, mas certifique que **só `/api/*` é exposto sem auth**; nenhuma rota administrativa retorna sem `requireSuperAdmin` no Function.
- **`firestore.rules`**: o helper `hasTenantDoc` faz `exists()` (1 read) como fallback de claim. Custo pequeno mas multiplica em listas. Documentado, ok.
- **`/api/track`** loga `code` + `apiKey: '***'` — bom, mas o request body em `req.body` ainda pode aparecer em outros logs (defesa em profundidade: nunca loge `req.body` cru).

---

## 5. Mapeamento OWASP Top 10 2021

| Categoria | Status |
|---|---|
| A01 Broken Access Control | ✅ catch-all rules removido, ktag_trackers restrito, stolen_records list separado |
| A02 Cryptographic Failures | ✅ VAPID em Secret Manager, JWT_SECRET removido, CSPRNG para senhas; ⚠️ salt PBKDF2 fixo (decisão) |
| A03 Injection | ✅ XSS em Feedback corrigido; SSRF em proxy fechado |
| A04 Insecure Design | ⚠️ senha por WhatsApp (decisão de produto) |
| A05 Security Misconfiguration | ✅ Helmet + CORS estrito + body limit + rate limit |
| A06 Vulnerable Components | ✅ npm audit 20→2; jspdf/xlsx requerem decisão |
| A07 Identity/Auth Failures | ✅ Webhook ME com HMAC; CSPRNG em senhas |
| A08 Software/Data Integrity | ✅ Webhook Asaas valida token; ME idem |
| A09 Logging Failures | ✅ logAudit estruturado; ⚠️ proxy loga URL completa |
| A10 SSRF | ✅ guard completo em proxy (server + function) |

---

## 6. Próximos passos sugeridos

1. **DEPLOY URGENTE** das correções deste PR (todas backwards-compatible).
2. Após deploy, executar:
   ```bash
   firebase functions:secrets:set VAPID_PUBLIC_KEY
   firebase functions:secrets:set VAPID_PRIVATE_KEY
   firebase functions:secrets:set MELHOR_ENVIO_WEBHOOK_SECRET  # se usar webhook ME
   ```
3. **Revogar** chaves VAPID antigas (estão em git history público).
4. Definir env vars no Cloud Run:
   - `PROXY_ALLOWED_HOSTS=api-labs.wonca.com.br,nominatim.openstreetmap.org,photon.komoot.io,maps.googleapis.com,api.geoapify.com,geocode.search.hereapi.com,...`
   - `MELHOR_ENVIO_WEBHOOK_SECRET=...`
5. PR separado: jspdf 3→4 com smoke test em todos os geradores de PDF.
6. PR separado: migração `xlsx → exceljs`.
7. PR de longo prazo: salt PBKDF2 per-tenant.
