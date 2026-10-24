# Janela de migração — 16/10/2026

Projeto: `ktagfinder-prod` · VPS: `179.198.111.58` · fuso: America/Fortaleza  
Início e duração: definir antes da janela. Responsável pela decisão de corte: proprietário do produto.

## Objetivo desta noite

1. Publicar e validar o frontend e backend na VPS, sem depender do Cloud Run para servir o site.
2. Provisionar um PostgreSQL **exclusivo** para a aplicação e importar os documentos do Firestore com verificação de integridade.
3. Reduzir primeiro as leituras/escritas de histórico K-TAG no Firestore, se o backfill, a conferência e o teste funcional passarem.
4. Manter Firebase Auth no mesmo projeto, preservando os UIDs e o login atual.

**Limite do corte:** a importação não substitui as rotas, listeners, Functions e regras que ainda usam Firestore. Não mudar o Firebase para Spark, não apagar Firestore, Functions ou Cloud Run, nem configurar `AUTHZ_STORE=postgres` nesta janela enquanto essas dependências não forem migradas e testadas. A meta de “quase nada no Firestore” exige as etapas de aplicação restantes, listadas em [MIGRATION_MONITORA360.md](./MIGRATION_MONITORA360.md).

## Situação verificada antes da janela

- VPS com Docker/Compose e espaço para um banco separado; Traccar, Evolution e `ktag-candidate` têm bancos próprios e **não** serão reutilizados.
- `monitora360.online` ainda apontava para `2.57.91.91`; os nameservers vistos em 16/10 eram da Hostinger (`orbit.dns-parking.com` e `horizon.dns-parking.com`). Conferir novamente. A escolha entre manter a zona na Hostinger e delegar ao Cloudflare está pendente.
- O template Nginx para apex + wildcard está em `nginx-monitora360.conf.template`; a sintaxe foi validada, mas ele não foi ativado.
- O importador, schema e modos de histórico estão no código local; **não foram executados no Firestore/PostgreSQL de produção**. `TAG_HISTORY_STORE` e `AUTHZ_STORE` continuam em `firestore` por padrão.
- Existem edições locais de landing page de outro trabalho. Excluí-las do commit/imagem desta migração até revisão, para não publicar mudanças não relacionadas.

## Preparação obrigatória antes do corte

- [ ] Escolher a zona DNS e garantir acesso para editar A, wildcard, CAA e registros de e-mail sem perda. Preparar certificado válido para `monitora360.online` e `*.monitora360.online`.
- [ ] Conferir lista dos domínios autorizados no Firebase Auth e acrescentar os novos hosts usados no login.
- [ ] Obter destino e credenciais para backup **externo criptografado** do PostgreSQL, com teste de restauração. Manter a origem Firestore intacta durante a migração.
- [ ] Revisar e publicar só os arquivos desta migração; executar `npm run typecheck`, testes do backend e web, build, `git diff --check` e smoke test da imagem resultante.
- [ ] Verificar a configuração real da VPS, DNS, Nginx, certificados, saúde da API, memória/disco, containers e versão da imagem. Registrar estado e horário para rollback.
- [ ] Definir como interromper **todas** as gravações durante a conferência final: frontend, backend, worker, Cloud Functions, webhooks e jobs. Apenas bloquear a interface não congela escritas do Admin SDK.
- [ ] Comunicar a janela de manutenção aos usuários, caso o congelamento de gravações afete operações.

## Sequência de execução

### 1. Backup e banco

1. Fazer backup da configuração VPS/Nginx e registrar a imagem/commit atual. Manter o Firestore como origem recuperável; qualquer exportação gerenciada do Firestore tem custo de leitura e não é um snapshot consistente com escritas concorrentes.
2. Criar `deploy/vps/secrets/postgres-password` com permissão `0600` e definir `DATABASE_URL` somente no ambiente privado da VPS. Não registrar senha, URL completa ou chave Firebase no Git/logs.
3. Iniciar `postgres` com `docker compose --env-file .env.vps --profile postgres up -d postgres`; confirmar `healthy`, rede privada e ausência de porta publicada.
4. Aplicar o schema: `docker compose --env-file .env.vps run --rm backend node_modules/.bin/tsx packages/backend/src/cli/migrate.ts` (com a nova imagem já disponível).
5. Fazer `pg_dump` criptografado para o destino externo e executar restauração de teste em banco isolado antes de depender do novo banco.

### 2. Cópia inicial e conferência

1. Fazer um piloto pequeno com `importFirestore.ts --tenant=SLUG --apply`; depois executar **uma** passagem global com `importFirestore.ts --apply`, que também cobre `identities`, `system_admins` e todos os tenants. Não executar contagem integral separada: ela relê todos os documentos e aumenta a fatura. O piloto será regravado de forma idempotente na passagem global.
2. Registrar contagens por coleção, total, falhas e duração. O importador preserva caminho, ID, dados, tipos especiais e timestamps; percorre também subcoleções sob pais inexistentes. Interromper e corrigir qualquer tipo não representável, falha SQL ou contagem divergente.
3. Conferir amostras críticas: usuários e permissões, tenants, clientes, veículos, tags, vínculos, histórico, cobrança, configurações e documentos de sistema. Conferir dados criptografados sem expô-los no relatório.
4. Com todas as gravações congeladas, repetir `--apply` e executar `--verify` no mesmo escopo. Exigir `countMatches: true`, `different: 0` e código de saída zero. Se falhar, **não cortar**; manter a fonte Firestore e investigar.

### 3. Aplicação na VPS

1. Publicar a imagem validada com alvo `vps`; conferir `/api/health`, login Firebase, tenant, permissões, frontend estático, WebSocket, Traccar e worker. Garantir apenas um consumidor realtime.
2. Ativar `TAG_HISTORY_STORE=dual` no backend/worker e conferir escrita PostgreSQL versus Firestore por tenant, tag e período. Repetir o backfill e a verificação sob congelamento de escritas.
3. Se histórico e consultas passarem, ativar `TAG_HISTORY_STORE=postgres` no backend **e** worker; observar erros, latência, contagens e novas posições. Se não passarem, voltar a `firestore` e manter o banco como cópia.
4. Publicar DNS e TLS do domínio novo apenas quando os registros e certificados estiverem prontos. Validar apex, `admin` e ao menos um subdomínio de tenant, API e WebSocket por HTTPS.
5. Desviar o tráfego do frontend/backend para a VPS. Observar 5xx, logins, posições, jobs, memória, disco e leituras/escritas Firestore. Manter a imagem e o DNS anteriores disponíveis para retorno.

### 4. Encerramento da janela

- [ ] Registrar versões, horários, contagens, resultado de `--verify`, restauração de teste, status DNS/TLS e métricas antes/depois.
- [ ] Reabrir gravações somente após validação funcional e integridade.
- [ ] Manter Cloud Run como reserva durante observação. Só removê-lo depois de comprovar que o tráfego público não depende dele; desativar triggers de deploy independentes.
- [ ] Agendar a migração das coleções operacionais, autorização, Functions e listeners que ainda acessam Firestore. Só depois validar elegibilidade do projeto para Spark.

## Critérios para voltar atrás

Parar o corte se houver diferença no `--verify`, perda de permissão/isolamento de tenant, falha de login, histórico incompleto, backup sem restauração testada, certificado/DNS incompleto ou instabilidade da VPS. Restaurar a imagem e o DNS anteriores, voltar `TAG_HISTORY_STORE=firestore` e manter o Firestore intacto. Não fazer importação reversa automática do PostgreSQL para Firestore: avaliar primeiro escritas ocorridas após o corte para evitar sobrescrever dados recentes.

## Pendências externas

- Acesso e decisão sobre DNS de `monitora360.online` (Hostinger atual ou Cloudflare).
- Certificado para apex e wildcard.
- Destino/credenciais de backup externo criptografado.
- Horário exato da janela e canal de aviso aos usuários.
