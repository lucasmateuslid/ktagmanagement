# Deploy KTag na VPS do Traccar

Este stack hospeda o frontend e o backend em `ktagfinder.app` e seus
subdomínios, além de atender `monitora360.online` e seus subdomínios pelo
mesmo repositório. Os hosts `lock.ktagfinder.app` e
`lock.monitora360.online` permanecem reservados para o sistema externo de lock
e devem continuar apontando para o proxy/serviço reservado. O novo banco
PostgreSQL começa desativado; a aplicação continua usando Firestore até uma
migração explícita de dados.

O roteiro da janela de 16/10/2026 está em
[`EXECUCAO_NOTURNA_2026-10-16.md`](./EXECUCAO_NOTURNA_2026-10-16.md).

Este stack adiciona somente o backend KTag à rede Docker já usada pelo Traccar. Ele não recria, remove ou altera os containers do Traccar e PostgreSQL.

O workflow `Validate` executa tipos, testes e build em cada push para `master`.
O workflow `Deploy` continua exclusivamente manual: um `git push` nunca
implanta automaticamente na VPS, Cloud Run, Functions ou Firestore. No alvo
`all`, as regras e índices do Firestore são publicados antes dos serviços.

## Pré-requisitos

- Docker Engine com Compose v2;
- Traccar acessível como `traccar:8082` em uma rede Docker externa;
- Nginx e TLS no host;
- service account Firebase dedicada, com o menor conjunto de permissões necessário;
- DNS do domínio da aplicação apontando para a VPS.

Em produção, frontend, API e WebSocket usam o mesmo domínio/subdomínio
(`https://ktagfinder.app` ou `https://<tenant>.ktagfinder.app`). Portanto,
`VITE_TRACKING_API_URL` deve ficar vazio no build da VPS para usar same-origin.
Em desenvolvimento e sandbox, a variável também pode ficar vazia.

Recomenda-se manter o proxy laranja do Cloudflare e ativar Authenticated Origin Pulls ou restringir no firewall/Nginx as conexões HTTPS às faixas do Cloudflare. O backend fica publicado apenas em `127.0.0.1`.

## Primeira instalação

Execute na VPS com um usuário que possua acesso ao Docker:

```bash
docker --version
docker compose version
docker network ls
docker ps --format 'table {{.Names}}\t{{.Networks}}\t{{.Ports}}'
sudo install -d -m 750 /opt/ktagmanagement
sudo chown "$USER":"$USER" /opt/ktagmanagement
git clone git@github.com:lucasmateuslid/ktagmanagement.git /opt/ktagmanagement
cd /opt/ktagmanagement/deploy/vps
cp .env.vps.example .env.vps
mkdir -p secrets
chmod 700 secrets
chmod 600 .env.vps
```

1. Use em `TRACCAR_DOCKER_NETWORK` a rede mostrada na coluna `NETWORKS` do
   container Traccar. O padrão esperado é `traccar_default`.
2. Se o serviço/container se chamar `traccar` e escutar em `8082`, mantenha:
   `TRACCAR_API_URL=http://traccar:8082/api` e
   `TRACCAR_WS_URL=ws://traccar:8082/api/socket`.
3. Use `TRACCAR_WEB_URL=https://traccar.ktagfinder.app`. Essa é a única URL
   Traccar enviada ao frontend e serve somente para o botão administrativo.
4. Preencha `TRACCAR_API_TOKEN`. Para o WebSocket oficial, preencha também
   `TRACCAR_EMAIL` e `TRACCAR_PASSWORD` com uma conta técnica dedicada.
5. Gere dois valores aleatórios diferentes para `CF_ORIGIN_SECRET` e
   `INTERNAL_SECRET`, por exemplo com `openssl rand -hex 32`.
6. Salve a service account Firebase dedicada diretamente em
   `deploy/vps/secrets/firebase-service-account.json`, aplique `chmod 600` e
   `chown 1000:1000` para o processo `node` do container conseguir lê-la.
7. Faça `docker login ghcr.io` usando um token GitHub com somente
   `read:packages`. Não grave esse token no `.env.vps`.
8. Gere o arquivo Nginx a partir de `nginx-ktag.conf.template`, usando
   certificado TLS wildcard para `ktagfinder.app`, `*.ktagfinder.app`,
   `monitora360.online` e `*.monitora360.online`, além do mesmo
   `CF_ORIGIN_SECRET` do `.env.vps`.
9. Teste com `nginx -t` e recarregue o Nginx.

Antes do primeiro deploy, valide a comunicação entre containers:

```bash
docker run --rm --network traccar_default curlimages/curl:8.12.1 \
  -fsS http://traccar:8082/api/health
```

Troque os nomes da rede/serviço caso o resultado de `docker ps` seja diferente.

Preencha também `KTAG_API_URL`, `KTAG_API_USER`, `KTAG_API_PASS`,
`VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no `.env.vps`; o serviço `worker` usa
essas credenciais para coletar posições e notificar suspensões sem expor
segredos ao frontend.

Para o rastreamento em escala, mantenha `SERVER_ADDRESS_PUBLIC_PHOTON=false` e
configure a geocodificação reversa do Traccar para a taxa real de pontos novos.
Antes de executar `Deploy`, rode a auditoria somente de leitura por tenant
(`npm run audit:tracking -- --tenant=TENANT`) e confira as ocorrências de
`DUPLICATE_TRACCAR_DEVICE` e `LEGACY_ADDRESS_REVIEW`. Se o provedor de
endereços não responder, o mapa exibirá endereço pendente.

O fluxo recomendado é executar manualmente `Deploy` no GitHub Actions com
`target=all` e `environment=production`. O CI valida o projeto, publica
`ghcr.io/<owner>/ktag-platform:<commit>` e faz a VPS baixar a imagem imutável.
As Functions e as regras/índices do Firestore continuam sendo publicadas no
Firebase; o frontend e o backend HTTP não dependem mais do Cloud Run.

Na primeira implantação desta migração, o Firebase precisa remover os três jobs
agendados antigos. Conceda temporariamente `roles/cloudscheduler.admin` à conta
de deploy ou remova os jobs `scheduledTagUpdate`, `cleanupOldHistory` e
`dailyBillingEnforcement` pelo console depois de confirmar o worker saudável.

Antes de usar `all` em produção, crie a variável de repositório
`KTAG_TRACCAR_REALTIME_ENABLED=false`. Assim o Cloud Run continua servindo a
aplicação sem competir com o worker realtime ativo na VPS.

Secrets necessários no GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PORT`,
`VPS_SSH_PRIVATE_KEY`, `VPS_SSH_KNOWN_HOSTS`, `VPS_APP_PATH` e os
`KTAGFINDER_PROD_FIREBASE_*` já usados no build atual. Cadastre também
`KTAG_API_USER` e `KTAG_API_PASS`: o workflow grava esses dois valores e a URL
da API em `deploy/vps/.env.ktag` com permissão `0600`, sem alterar o `.env.vps`.
Use
`VPS_APP_PATH=/opt/ktagmanagement`.

Cadastre `VPS_SSH_KNOWN_HOSTS` a partir de uma estação confiável, conferindo a
fingerprint da VPS antes:

```bash
ssh-keyscan -p 22 SEU_HOST_VPS
```

No GitHub, abra **Actions → Deploy → Run workflow**, selecione `target=all` e
`environment=production` somente após a instalação inicial. Também é possível
selecionar `target=vps` para implantar apenas a VPS. O workflow nunca roda por
push.

## Migração sem indisponibilidade

1. Suba o worker da VPS e valide os jobs K-TAG, limpeza e billing.
2. Suba a VPS com `TRACCAR_REALTIME_ENABLED=false` e valide o backend internamente.
3. Reduza o TTL DNS para 300 segundos.
4. Na janela de corte, crie a variável de repositório `KTAG_TRACCAR_REALTIME_ENABLED=false` e atualize o Cloud Run com `TRACCAR_REALTIME_ENABLED=false`.
5. Defina `TRACCAR_REALTIME_ENABLED=true` na VPS e recrie somente o backend.
6. Valide snapshot, WebSocket, uma posição real e isolamento usando tenant de teste.
7. Direcione o domínio público da aplicação para a infraestrutura escolhida.
8. Observe por 24 horas CPU, RAM, Firestore writes, reconnects e erros HTTP.
9. Mantenha Cloud Run com escala zero por sete dias. Depois defina a variável de repositório `KTAG_DEPLOY_CLOUD_RUN=false` e remova o serviço de produção.

## Rollback

1. Para rollback somente da versão VPS, execute `./rollback.sh`.
2. Para voltar ao GCP, reative `TRACCAR_REALTIME_ENABLED=true` no Cloud Run.
3. Restaure o DNS anterior.
4. Pare apenas o backend VPS com `docker compose --env-file .env.vps stop backend`.

Nunca deixe os dois workers realtime ativos ao mesmo tempo: isso duplica processamento e checkpoints.

## Operação

- Logs: `docker compose --env-file .env.vps logs -f backend worker`.
- Estado: `docker compose --env-file .env.vps ps`.
- Health: `curl -H "X-Origin-Secret: $CF_ORIGIN_SECRET" http://127.0.0.1:4000/api/health`.
- O mapa recebe todas as mensagens; o Firestore recebe checkpoints conforme
  `TRACCAR_POSITION_PERSIST_INTERVAL_MS` ou quando a posição supera
  `TRACCAR_POSITION_PERSIST_DISTANCE_METERS` (padrão: 100 m). O WebSocket
  continua transmitindo cada posição válida; esses limites controlam apenas a
  persistência no Firestore.
- O worker da VPS é responsável por K-TAG, retenção de histórico e fiscalização diária de inadimplência.

## Habilitar H-TAG (E3+ / easytrack, porta 5056)

A H-TAG usa o rastreador E3+ / E3+4G, que fala o protocolo `easytrack` do
Traccar na porta **5056/TCP**. Como este stack não altera o container do
Traccar, faça uma única vez na VPS:

1. No `traccar.xml` do container Traccar, adicione
   `<entry key='easytrack.port'>5056</entry>`.
2. Publique a porta no container Traccar (`5056:5056/tcp` no compose dele).
3. Libere `5056/tcp` no firewall da VPS (ex.: `ufw allow 5056/tcp`).
4. Reinicie o Traccar e confirme a escuta: `ss -ltn | grep 5056`.
5. No `.env.vps`, mantenha `TRACCAR_EASYTRACK_PORT=5056` (metadado gravado na tag).
6. Configure cada E3+ (SMS/app do fabricante) para `IP_DA_VPS:5056`.

O cadastro (manual ou importação `nome`/`imei`) cria o device no Traccar com
`uniqueId` = IMEI; a partir daí as posições seguem o mesmo fluxo realtime da XADTAG.

## Permissões da service account

Use uma conta exclusiva para a VPS. Ela precisa de acesso de leitura/escrita ao Firestore (`roles/datastore.user`). Não reutilize credenciais pessoais nem a service account padrão do projeto. Rotacione a chave após qualquer suspeita de exposição.
