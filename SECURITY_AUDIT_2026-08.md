# Auditoria de Segurança — K-Tag Manager Pro

**Data:** 2026-08-09
**Escopo:** frontend React, Firestore Rules, Firebase Auth/Functions, backend Express, WebSocket, integrações, persistência local, build/deploy e dependências npm.
**Método:** revisão estática do código e configuração, modelagem de ameaças e `npm audit --omit=dev`. Não foram realizados ataques contra produção, varredura de infraestrutura externa, teste de credenciais reais ou pentest black-box.

## 1. Resumo executivo

O sistema tem boas bases de segurança entre **tenants**, mas não aplica separação suficiente **dentro de um tenant**. Na prática, qualquer membro aprovado — inclusive cliente final, técnico e operador — recebe permissões muito amplas no Firestore. O frontend esconde telas e filtra registros, porém esse filtro não é uma fronteira de segurança.

Também existem rotas Express públicas que encaminham requisições, tokens e operações do Melhor Envio sem autenticação. O canal de localização em tempo real separa tenants, mas não separa clientes do mesmo tenant e admite superadministradores em qualquer canal. O provisionamento de cliente cria senha previsível derivada do CPF.

**Conclusão:** o painel não deve ser ampliado para um aplicativo cliente antes da correção dos achados críticos e altos. O risco dominante é acesso indevido ou alteração de dados pessoais, frota, localização e operação logística por uma conta válida de baixo privilégio.

### Distribuição dos achados próprios

| Severidade | Quantidade |
|---|---:|
| Crítica | 5 |
| Alta | 8 |
| Média | 8 |
| Baixa | 3 |

O `npm audit` encontrou adicionalmente **35 vulnerabilidades** em dependências de produção: 2 críticas, 8 altas, 23 moderadas e 2 baixas. O número bruto não equivale a 35 explorações confirmadas; a alcançabilidade depende de como cada biblioteca é usada.

## 2. Modelo de ameaça resumido

Atacantes relevantes:

- usuário anônimo acessando o domínio público;
- cliente final autenticado tentando acessar outro cliente da mesma empresa;
- técnico, operador ou usuário comum excedendo suas funções;
- membro de um tenant tentando atravessar para outro;
- atacante com link público de rastreamento;
- atacante explorando dependência, proxy ou integração exposta;
- invasor com XSS ou acesso ao dispositivo, aproveitando dados persistidos offline.

Ativos mais sensíveis:

- posição atual e histórico de veículos;
- CPF, telefone, endereço, placa, chassi e dados de clientes;
- chaves de APIs, tokens OAuth e credenciais de integrações;
- operações de frete, etiquetas e cancelamentos;
- contas Firebase e papéis administrativos;
- dados financeiros e de técnicos.

## 3. Achados críticos

### C-01 — Autorização Firestore excessiva para qualquer membro do tenant

**Evidência:** `firestore.rules:203-266` permite que qualquer `isMemberOf(tenantId)` leia e escreva tags, trackers, SIM cards, fornecedores, compras, veículos, histórico, clientes, empresas, categorias, agendamentos, técnicos, feedbacks, envios e endereços. O papel `client` é um membro aprovado como os demais.

**Impacto:** um cliente final ou usuário operacional pode usar diretamente o Firebase SDK/REST para listar, criar, alterar ou apagar dados de toda a empresa. Isso inclui veículos de terceiros, informações pessoais, agendamentos, logística e histórico de localização.

**Exploração provável:** autenticar com uma conta cliente legítima, obter o ID token pelo navegador e executar reads/writes diretos nas coleções do tenant, ignorando as rotas e filtros visuais.

**Correção:** substituir `isMemberOf` por autorização por papel, permissão e propriedade. Para clientes, preferir acesso apenas por API/BFF; bloquear consultas diretas às coleções operacionais. Para técnicos e operadores, aplicar regras específicas por coleção, ação e vínculo. Escrever testes negativos para cada papel.

### C-02 — Cliente recebe frota e localização de outros clientes

**Evidência:** `pages/livemap/hooks/useFleetData.ts:22-37` baixa tags, categorias, clientes e todos os veículos, filtrando apenas os veículos na UI por CPF. `pages/livemap/hooks/useFleetTracking.ts:20-42` chama `/api/livemap` e conecta ao WebSocket geral. `packages/backend/src/routes/xadtags.ts` protege o mapa somente com `requireAuth` e retorna todas as XADTAGs do tenant. `packages/backend/src/services/positionBroadcast.ts:6-34` transmite por tenant, não por cliente/veículo.

**Impacto:** exposição em tempo real da localização de toda a frota da empresa para qualquer cliente final do tenant, com grave risco físico, patrimonial e de LGPD.

**Correção:** vincular `uid -> membership.clientId` de forma autoritativa; implementar endpoints e canal realtime específicos do cliente; validar no servidor `vehicle.clientId === authUser.clientId`; nunca aceitar `clientId` fornecido pelo navegador.

### C-03 — Rotas de integração e logística sem autenticação/autorização

**Evidência:** após `resolveTenant`, as rotas de geocodificação, proxy, rastreio e Melhor Envio em `packages/backend/src/server.ts:519-542`, `555-649`, `651-698` e `732-916` não usam `requireAuth` nem validam papel. Elas recebem API key, OAuth client secret, refresh/access token e comandos logísticos no body.

**Impacto:** usuário anônimo pode usar a infraestrutura como proxy, consumir cotas de geocodificação, testar/exfiltrar tokens fornecidos, efetuar chamadas de carrinho, checkout, geração, impressão ou cancelamento caso obtenha um token, e provocar custos/indisponibilidade.

**Observação:** CORS e `X-Origin-Secret` não substituem autenticação. CORS restringe navegadores, não `curl`/bots; o segredo de origem protege a origem Cloud Run, não diferencia usuários autorizados no domínio público.

**Correção:** autenticação global nas rotas privadas, RBAC por operação, resolução autoritativa de tenant, tokens somente server-side/Secret Manager, validação de payload por schema, rate limit por UID+tenant e trilha de auditoria para mutações.

### C-04 — Credenciais e configurações secretas legíveis por qualquer membro

**Evidência:** `firestore.rules:161-165` libera leitura de `/settings/*` a qualquer membro. `types.ts:510-565` mostra que `AppSettings` inclui Traqcare, Hinova, APIs de placa/IA, Melhor Envio, Evolution e outros tokens/secrets. `services/storage.ts` carrega essas settings no navegador.

**Impacto:** conta cliente, técnico ou operador pode extrair credenciais de terceiros, dados OAuth e chaves de IA. A criptografia client-side não resolve o problema se a aplicação entrega ao mesmo cliente a chave/forma de decifrar para uso normal.

**Correção:** mover segredos para Secret Manager ou armazenamento server-side inacessível ao SDK web; expor ao frontend apenas flags/metadata não secretas; restringir settings administrativas a admin; rotacionar credenciais que já estiveram expostas.

### C-05 — Senha inicial e reset de cliente previsíveis

**Evidência:** `functions/index.js:1626-1640` usa e-mail derivado do CPF e senha `cpf.slice(0, 6)`. `functions/index.js:1684-1713` redefine a senha para `123456` ou os seis primeiros dígitos do CPF. A tela de login aceita CPF e o converte no e-mail interno.

**Impacto:** CPF é dado frequentemente conhecido ou vazado. Um atacante pode prever usuário e senha, especialmente após um reset administrativo, tomando a conta e acessando localização/dados.

**Correção imediata:** usar senha temporária CSPRNG de alta entropia ou, preferencialmente, convite/link de definição de senha com expiração e uso único. Forçar troca no primeiro acesso, revogar sessões no reset, ativar proteção contra enumeração e MFA para perfis privilegiados. Nunca oferecer `123456`.

## 4. Achados altos

### A-01 — Backend autoriza apenas membership, não papel, em operações XADTAG

`packages/backend/src/routes/xadtags.ts` aplica somente `requireAuth`; qualquer membro pode listar, cadastrar, checar, importar, vincular e desvincular equipamentos. `requireAuth` em `packages/backend/src/middleware/auth.ts` resolve um papel, mas as rotas não o usam.

**Correção:** middleware `requirePermission` por endpoint. Escritas/importações/vínculos somente a papéis administrativos/operacionais explicitamente autorizados; clientes apenas leitura de ativos próprios por API separada.

### A-02 — WebSocket aceita superadmin global e não confirma membership atual no Firestore

`positionBroadcast.ts` considera válido `decoded.superadmin === true`, qualquer entrada em `decoded.tn` ou claim legada. Isso contradiz o isolamento estrito documentado nas Firestore Rules. Claims antigas podem permanecer válidas até refresh/expiração após revogação.

**Impacto:** superadmin pode assinar localização operacional de qualquer tenant; usuário revogado pode manter o canal até o token expirar; cliente recebe todos os eventos do tenant.

**Correção:** remover bypass de superadmin, consultar membership aprovada/ativa na conexão, escopar subscriptions por recurso, impor expiração/reautorização periódica, heartbeat, limites de conexões e tamanho de mensagens.

### A-03 — Endpoint interno Traccar falha aberto sem segredo

`packages/backend/src/routes/tracking.ts:112-121` apenas registra aviso quando `INTERNAL_SECRET` não está configurado e continua aceitando posição/evento.

**Impacto:** erro de configuração permite injeção de eventos e posições falsas no realtime, afetando integridade operacional e segurança física.

**Correção:** falhar no startup ou responder 503/403 quando o segredo estiver ausente; usar comparação timing-safe, rotação e, quando possível, autenticação de serviço/mTLS ou rede privada.

### A-04 — Endpoint de tracking legado aceita API key do cliente

`server.ts:651-698` aceita `apiKey` no body e envia a um terceiro sem autenticação. Embora o log masque a chave recebida, o endpoint vira um relay público e incentiva armazenamento/transporte do segredo no navegador.

**Correção:** guardar a chave server-side por tenant, autenticar e autorizar o solicitante, validar o código, limitar por tenant/UID e retornar resposta normalizada sem dados excessivos.

### A-05 — OAuth e tokens Melhor Envio transitam pelo browser e por rotas públicas

`server.ts:732-916` recebe client secret, refresh token e access token diretamente. Além da ausência de auth, qualquer XSS/extensão maliciosa pode capturá-los.

**Correção:** concluir OAuth no backend com state+PKCE quando aplicável; guardar refresh/access token criptografado server-side; frontend usa apenas comandos de alto nível autorizados. Não devolver refresh tokens ao browser.

### A-06 — Autorização administrativa confia em papel gravado no documento

`requireTenantAdmin` lê o documento do caller e aceita `admin`, `admin_tecnico` ou `superadmin`. As Rules permitem que admin do tenant altere livremente users, e o próprio usuário pode alterar qualquer campo que não seja `role`, `status` ou `tenantId` (`firestore.rules:150-156`). A modelagem mistura papel base e `customRoleId`, elevando risco de divergência entre UI, Rules e Functions.

**Correção:** estabelecer fonte autoritativa única; impedir alteração direta de campos de autorização pelo SDK; mutações de papel somente por callable transacional/auditada; definir separação de deveres para `admin_tecnico`.

### A-07 — Dependências de produção com advisories críticos/altos

O audit de 2026-08-09 reportou 35 vulnerabilidades. Destaques:

- `jspdf`: críticas/altas, incluindo HTML/PDF injection e path traversal; correção indicada em 4.2.1.
- `xlsx`: prototype pollution e ReDoS; sem correção disponível pelo registro para o pacote instalado.
- `websocket-driver`: corrupção/limite de recursos.
- `@grpc/grpc-js`, `protobufjs`, `undici`, `form-data`, `brace-expansion`, `tmp` e `ip-address`: DoS, injection, traversal ou bypass de trust boundary.

**Correção:** atualizar lockfile em branch dedicada, substituir `xlsx` por biblioteca mantida/versão segura de fonte oficial, testar geração de PDF/Excel e Firebase após upgrades. Reexecutar audit e avaliar alcançabilidade; não aplicar `npm audit fix --force` sem testes.

### A-08 — Dados pessoais e operacionais persistidos em cache local sem limpeza completa

`services/storage.ts:79-99` persiste listas no `localStorage`; Firestore usa cache persistente multiaba em `services/firebase.ts:23-32`. `AuthContext.logout` encerra a sessão, mas não limpa explicitamente caches por tenant nem termina todas as subscriptions da aplicação.

**Impacto:** dados podem permanecer no dispositivo após logout, troca de usuário ou uso em máquina compartilhada. XSS na mesma origem ganha acesso ao `localStorage`.

**Correção:** minimizar cache, limpar cache próprio no logout, revisar `clearIndexedDbPersistence`/estratégia de instâncias, não cachear secrets, documentar “dispositivo confiável” e garantir teardown de listeners/sockets.

## 5. Achados médios

### M-01 — CSP desabilitada

`packages/backend/src/server.ts:428-438` usa Helmet, mas define `contentSecurityPolicy: false`. Uma falha XSS teria amplo acesso a Firebase Auth, Firestore, localStorage e integrações.

**Correção:** adotar CSP gradualmente com `default-src 'self'`, allowlists mínimas para Firebase/mapas, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; evitar scripts inline ou usar nonce/hash.

### M-02 — Autoedição do documento de usuário permite campos arbitrários

As Rules preservam somente `role`, `status` e `tenantId`; o dono pode alterar/adicionar `clientId`, `customRoleId`, CPF, IDs técnicos e outros campos.

**Impacto:** mesmo onde isso não eleva privilégios nas Rules, pode manipular filtros de UI, associação de cliente/técnico e lógica de negócio.

**Correção:** allowlist de campos editáveis usando `diff().affectedKeys().hasOnly([...])`; campos de vínculo somente via backend.

### M-03 — Audit logs podem ser forjados por qualquer membro

`firestore.rules:181-185` permite `create` para qualquer membro sem fixar `actorUid`, tenant, timestamp ou formato.

**Impacto:** poluição ou falsificação da trilha, dificultando investigação e conformidade.

**Correção:** logs de segurança somente pelo backend/Admin SDK; se o cliente precisar registrar eventos, validar campos imutáveis e usar timestamp do servidor.

### M-04 — Link público de rastreamento tem desenho inconsistente e token curto

`pages/Security.tsx:133` reduz UUID a 8 caracteres hexadecimais (~32 bits). A regra `firestore.rules:194-200` não compara o token informado: permite `get` anônimo de qualquer registro conhecido que apenas possua algum `trackingToken`. Ao mesmo tempo, a UI usa query por token, mas anonymous `list` é negado, e a leitura pública do veículo também é negada; o fluxo tende a não funcionar corretamente ou depender de permissões inesperadas.

**Correção:** endpoint público server-side com token aleatório de pelo menos 128 bits, hash no banco, expiração, revogação, rate limit e resposta mínima; não expor coleções Firestore diretamente.

### M-05 — Geocodificação pública aceita preferências fornecidas pelo solicitante

As rotas públicas repassam `geocoderPreferences` do body. Dependendo do objeto aceito pelos helpers, isso pode incluir chaves/hosts ou forçar provedores custosos.

**Correção:** configuração exclusivamente server-side, schema estrito de coordenadas/endereço, quotas por tenant e cache.

### M-06 — Rate limiting somente por IP e topologia de proxy rígida

O backend usa `trust proxy = 2` e limites globais por IP. Mudança de topologia pode fazer todos compartilharem o mesmo IP ou permitir spoof; NAT pode bloquear clientes legítimos; IPs distribuídos contornam a proteção.

**Correção:** validar a cadeia real em cada ambiente; combinar IP, UID, tenant e operação; datastore compartilhado para múltiplas instâncias; limites menores para operações caras/mutáveis.

### M-07 — Respostas e logs expõem detalhes de upstream/erro

Diversas rotas devolvem `error.message`, `details` completos ou status upstream; `/api/health` expõe tenant e estado do realtime. Isso auxilia reconhecimento e pode refletir payload de terceiros.

**Correção:** erros públicos genéricos com correlation ID; detalhes somente em logs estruturados com redaction; health público mínimo e readiness interna separada.

### M-08 — Ausência de validação sistemática de schemas

Grande parte das rotas usa destructuring direto de `req.body`/`request.data`, com validações pontuais. Não há camada uniforme de Zod/Valibot/Joi para limites, tipos, enums e campos desconhecidos.

**Correção:** schemas por endpoint, rejeição de campos extras sensíveis, limites de arrays/strings/números e normalização centralizada.

## 6. Achados baixos

### B-01 — `CORS_ALLOW_ALL` pode desativar proteção por configuração

Uma variável de produção aceita qualquer origem. Remover ou impedir startup em produção quando ativa.

### B-02 — Credenciais e dados identificáveis em comentários/configuração

O User-Agent do Melhor Envio inclui e-mail pessoal em código. Substituir por contato operacional não pessoal e revisar logs/documentação.

### B-03 — Teste de segurança legado dá falsa sensação de cobertura

`test-security.sh` verifica padrões de texto e arquivos antigos (como `VITE_JWT_SECRET`) em vez dos controles atuais. Ele não testa IDOR, RBAC, rotas Express, WebSocket ou clientes do mesmo tenant.

**Correção:** substituir por testes automatizados comportamentais no Emulator Suite e Supertest/WebSocket.

## 7. Controles positivos observados

- Firebase Authentication é usado em vez de senha própria no banco para fluxos atuais.
- Claims e memberships exigem status aprovado; usuário pendente é negado.
- Firestore bloqueia superadmin nas subcoleções operacionais, embora o backend/WebSocket ainda divirja.
- Backend usa Helmet, HSTS em produção, body limit e rate limit.
- Proxy contém defesas úteis contra SSRF: bloqueio de redes privadas/metadata, resolução DNS, redirect manual, allowlist de headers, timeout e limite de resposta.
- Segredos K-TAG e Asaas usam variáveis/Secret Manager em partes novas.
- Senhas aleatórias de usuários internos usam CSPRNG e 16 caracteres.
- Containers rodam como usuário não-root.
- Existe allowlist de origem e segredo entre proxy/CDN e origem.
- Escritas de billing e finanças estão bloqueadas no cliente.

Esses controles reduzem risco, mas não compensam autorização excessiva por papel/objeto.

## 8. Plano de remediação priorizado

### Emergencial — 0 a 72 horas

1. Desabilitar/resetar a opção de senha `123456` e CPF; forçar reset seguro das contas cliente existentes e revogar sessões.
2. Colocar autenticação e RBAC em todas as rotas Express privadas, especialmente Melhor Envio e proxy.
3. Bloquear temporariamente role `client` no mapa geral e nas coleções sensíveis até existir API própria.
4. Tornar `INTERNAL_SECRET` obrigatório/fail-closed.
5. Restringir `/settings` a admin e iniciar rotação dos tokens que eram legíveis por membros.
6. Atualizar `jspdf` e dependências com correção simples; suspender importação de XLSX não confiável até substituição/mitigação.

### Curto prazo — 1 a 2 semanas

1. Criar matriz RBAC por papel, coleção e ação.
2. Implementar `uid -> clientId` e autorização por veículo no backend.
3. Separar WebSocket por cliente/recursos autorizados.
4. Reescrever Firestore Rules com field allowlists e testes de dois clientes no mesmo tenant.
5. Migrar tokens OAuth/APIs do Firestore/browser para backend/Secret Manager.
6. Criar schemas e erros/redaction centralizados.
7. Corrigir o fluxo público de rastreamento com token forte e endpoint dedicado.

### Médio prazo — 30 dias

1. CSP efetiva e inventário de origens externas.
2. MFA obrigatório para superadmin/admin; políticas de sessão e reautenticação para ações críticas.
3. Rate limiting distribuído por identidade/tenant e proteção antiabuso.
4. Limpeza segura de caches no logout/troca de conta.
5. SAST, secret scanning, dependency review e testes de Rules/API no CI.
6. Pentest externo após as correções e antes do lançamento do aplicativo cliente.

## 9. Matriz mínima de autorização recomendada

| Recurso | Cliente | Técnico | Operador | Moderador | Admin |
|---|---|---|---|---|---|
| Veículos | somente próprios, leitura | somente OS vinculadas | conforme permissão | CRUD | CRUD |
| Localização/histórico | somente próprios | somente serviço ativo, se necessário | leitura autorizada | leitura | leitura |
| Clientes | próprio perfil mínimo | mínimo da OS | conforme permissão | CRUD | CRUD |
| Tags/trackers/SIM | nenhum direto | mínimo da OS | operacional | CRUD | CRUD |
| Schedules | próprias solicitações | atribuídas | atribuídas/criadas | CRUD | CRUD |
| Settings/secrets | nenhum | nenhum | nenhum | flags não secretas | config via backend |
| Billing/financeiro | nenhum | próprio pagamento | nenhum | conforme regra | autorizado |
| Envios | próprios se produto exigir | atribuídos | operacional | CRUD | CRUD |

Permissão de UI nunca deve ser a única verificação. A mesma matriz precisa existir no backend e nas Rules.

## 10. Testes obrigatórios de regressão

- Cliente A não lê/escreve cliente, veículo, tag, posição ou histórico de B no mesmo tenant.
- Cliente A não recebe eventos realtime de B.
- Usuário de tenant A não acessa tenant B alterando hostname, header, query, path ou WebSocket.
- Técnico não vê financeiro/admin nem OS não atribuídas.
- Usuário comum não cadastra/vincula XADTAG sem permissão.
- Conta revogada perde REST, Firestore e socket.
- Superadmin não recebe dados operacionais de tenant por canais comuns.
- Rota Melhor Envio sem token Firebase retorna 401; papel insuficiente retorna 403.
- Endpoint interno sem segredo correto retorna 403 e sem configuração não inicia/falha fechado.
- Alteração de `clientId`, `customRoleId`, role/status/tenant pelo próprio usuário é negada.
- Audit log forjado pelo SDK é negado.
- Token público inválido/expirado/revogado é negado e tentativas são limitadas.
- Logout remove caches e fecha sockets/listeners.

## 11. Limitações desta auditoria

- Não foi confirmado se as Rules e o código auditados são exatamente os atualmente implantados.
- Não foram inspecionadas configurações reais de Firebase Auth, App Check, IAM, Cloudflare, Secret Manager, DNS, TLS, Cloud Run/VPS, backups ou logs.
- Não houve validação de segurança das APIs terceiras nem análise de firmware/hardware dos rastreadores.
- Não houve DAST, teste mobile, análise de bundle publicado ou busca de segredos no histórico Git remoto.
- O audit de dependências reflete o registro npm em 2026-08-09 e deve ser repetido após qualquer mudança de lockfile.

## 12. Veredito

**Risco atual: crítico para abertura a clientes finais.**
**Go/No-Go do aplicativo cliente: NO-GO até fechar C-01 a C-05 e A-01 a A-05.**

O isolamento entre tenants está mais maduro que o isolamento entre usuários do mesmo tenant. A prioridade correta é introduzir autorização server-side por papel e por objeto, remover segredos do navegador e corrigir credenciais de cliente. Depois disso, a base técnica é adequada para sustentar o aplicativo proposto.
