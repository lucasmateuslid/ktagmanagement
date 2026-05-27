# Identidade Unificada — Multi-Tenant

Mesmo e-mail autentica no **painel super admin** E em **qualquer tenant ao qual
esteja explicitamente vinculado**, sem sessão global de permissões e com
isolamento de tenant intacto.

---

## Modelo

```
Firebase Auth (1 UID por e-mail no projeto)
│
├─ /system_admins/{uid}                  ← flag de super admin (control plane)
├─ /tenants/{tid}/users/{uid}            ← registro operacional por-tenant (fonte da verdade)
│
└─ derivados (mantidos por Cloud Functions; rules = read-only):
   ├─ /identities/{uid}                  ← { email, isGlobalAdmin, ... }
   └─ /identities/{uid}/memberships/{tid}← junção uid↔tenant { role, status }
```

**Custom claims (= "JWT payload"), REPLACE a cada `rebuildIdentityAndClaims`:**

```jsonc
{ "superadmin": true,                 // opcional — poder de PAINEL apenas
  "tn": { "empresa1": "admin",        // só memberships APROVADAS (tid → role)
          "empresa2": "user" },
  "tnBig": true }                     // só se `tn` estourar ~900 bytes → rules caem no fallback por doc
```

### Princípios (regras não-negociáveis atendidas)
- **Isolamento mantido:** cada coleção operacional exige membership APROVADA naquele `tid`.
- **Acesso só a tenants explicitamente vinculados:** `tn[tid]` ou doc aprovado.
- **Sem vazamento de permissão global:** `superadmin` é poder de painel; as rules **não** o usam para liberar dados operacionais de nenhum tenant. Super admin opera sobre dados de tenant **somente via Cloud Functions** (Admin SDK, auditadas).
- **Sem roles hardcoded no cliente:** rules leem `role` da claim/doc; permissões `ROUTE_*` continuam no `CustomRole`.
- **Sem bypass de middleware:** `server.ts` não autoriza; a fronteira é Firestore Rules + guards de callables (`requireTenantAdmin` / `requireSuperAdmin`).
- **Valida `tenantId` em toda operação protegida:** todo `match /tenants/{tid}/...` resolve membership para aquele `tid`.

---

## Ordem de deploy (importante)

As rules novas leem a claim nova (`tn`) **com fallback** para claim legada
(`tenantId`) e para doc aprovado — então tokens vivos não quebram durante a transição.

1. **Deploy das Cloud Functions** (`firebase deploy --only functions`)
   — passam a manter `/identities` + memberships + claims nova em cada write de user.
2. **Deploy das rules** (`firebase deploy --only firestore:rules`).
3. **Backfill:** `tsx scripts/migrate-identities.ts` (ou callable `migrateIdentities`
   pelo painel). Idempotente. Cria identities/memberships e re-minta claims de todos.
4. **Refresh de token:** usuários recarregam a app (o `login()` já força
   `getIdToken(true)`; sessões abertas pegam claim nova em até ~1h ou no próximo refresh).
5. Depois de um ciclo completo, o ramo **legado** (`hasLegacyClaim`) pode ser
   removido das rules.

### Rollback
- **Rules:** `firebase deploy --only firestore:rules` com o arquivo anterior (versionado no git). Reverte instantâneo.
- **Functions:** `git revert` + redeploy. As claims nova/legada coexistem, então reverter functions não tranca ninguém.
- **Dados:** `/identities/*` é aditivo — reverter código deixa-os órfãos e inofensivos. Nenhum dado operacional é migrado/movido.

---

## ✅ Checklist de Segurança

> Rode no **emulador** (`scripts/identity-rules.test.mjs`) antes de produção.
> `[A]` = deve ser PERMITIDO, `[N]` = deve ser NEGADO.

- [ ] `[N]` Usuário **pending** (status≠approved) lê/escreve coleções de domínio do tenant (regressão do bug antigo `hasTenantDoc`).
- [ ] `[A]` Usuário pending lê **o próprio** doc `/tenants/{tid}/users/{uid}` (para ver o status).
- [ ] `[N]` Usuário pending lê doc de **outro** usuário do tenant.
- [ ] `[N]` Auto-registro com `role != 'user'` ou `status != 'pending'` (anti self-promotion).
- [ ] `[N]` Dono altera o próprio `role`/`status`/`tenantId` via update.
- [ ] `[A]` Dono atualiza campos não-sensíveis do próprio doc.
- [ ] `[N]` Membro comum (role `user`) escreve em `technician_payments` / `invoices` / `audit_logs (update/delete)`.
- [ ] `[A]` Admin do tenant escreve `settings`, `custom_roles`, `technician_payments`.
- [ ] `[N]` Qualquer cliente escreve `invoices` (write `if false` — só Admin SDK).
- [ ] `[N]` Não-autenticado lê coleção de domínio; `[A]` lê `public_settings`.
- [ ] `[A]` `stolen_records` GET por doc que carrega `trackingToken`; `[N]` LIST por não-membro.
- [ ] `[A]` Usuário lê **a própria** `/identities/{uid}` + memberships; `[N]` lê de outro uid.
- [ ] `[N]` Qualquer cliente escreve `/identities/**` (write `if false`).
- [ ] `[N]` Não-superadmin escreve `system_admins` / `ktag_settings_v3` / `ktag_trackers`.
- [ ] `[A]` Login força `getIdToken(true)` e as rules enxergam a claim nova.
- [ ] Claims acima de ~900 bytes → `tnBig:true` setado e acesso continua via fallback por doc.

## ✅ Checklist de Isolamento Multi-Tenant

- [ ] `[N]` Membro do tenant A lê/escreve **qualquer** coleção do tenant B (tags, vehicles, clients, users, schedules, …).
- [ ] `[A]` Mesmo e-mail vinculado a A **e** B acessa **ambos** (claim `tn` tem os dois) — sem um vínculo apagar o outro (bug do claim singular legado).
- [ ] `[N]` **Super admin** lê/escreve coleção **operacional** de um tenant via SDK do cliente em **qualquer** subdomínio (isolamento estrito — só callables).
- [ ] `[A]` Super admin lê `/tenants/{tid}` **root doc** (metadata/billing) — control plane do painel.
- [ ] `[A]` Painel super admin lista usuários/faturas via callables (`listAllUsers`, `listTenantInvoices`) — não por rules de subcoleção.
- [ ] `[A]` `createTenant` com `ownerEmail` de um e-mail **já membro de outro tenant** preserva os acessos antigos (rebuild não sobrescreve).
- [ ] `[A]` `deleteTenantUser` remove o vínculo do tenant atual mas **mantém** a conta Auth se houver outros vínculos / for super admin.
- [ ] `[A]` Job agendado / triggers leem credenciais **apenas** do próprio tenant (sem vazamento cross-tenant).
- [ ] `[A]` Visitar subdomínio de um tenant sem vínculo mostra o **seletor de empresa** (não desloga a sessão global).
- [ ] `[N]` `superadmin:true` no token NÃO concede permissões `ROUTE_*` dentro do escopo de um tenant (a UI usa `user.role` do doc do tenant, não `isGlobalAdmin`).
