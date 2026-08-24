# Deploy KTag na VPS do Traccar

Este stack adiciona somente o backend KTag à rede Docker já usada pelo Traccar. Ele não recria, remove ou altera os containers do Traccar e PostgreSQL.

Os workflows do GitHub Actions são exclusivamente manuais. Um `git push` nunca
implanta automaticamente na VPS, Cloud Run, Functions ou Firestore.

## Pré-requisitos

- Docker Engine com Compose v2;
- Traccar acessível como `traccar:8082` em uma rede Docker externa;
- Nginx e TLS no host;
- service account Firebase dedicada, com o menor conjunto de permissões necessário;
- DNS do domínio da aplicação apontando para a VPS.

O frontend permanece no Cloud Run. Somente o domínio público de tracking
`api-vps.ktagfinder.app` aponta para esta VPS. O build de produção recebe
`VITE_TRACKING_API_URL=https://api-vps.ktagfinder.app`, portanto REST de
tracking e WebSocket saem do frontend Cloud Run e chegam ao Nginx da VPS.

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
8. Gere o arquivo Nginx a partir de `nginx-ktag.conf.template`, usando o domínio
   `api-vps.ktagfinder.app`, certificado TLS e o mesmo `CF_ORIGIN_SECRET` do
   `.env.vps`.
9. Teste com `nginx -t` e recarregue o Nginx.

Antes do primeiro deploy, valide a comunicação entre containers:

```bash
docker run --rm --network traccar_default curlimages/curl:8.12.1 \
  -fsS http://traccar:8082/api/health
```

Troque os nomes da rede/serviço caso o resultado de `docker ps` seja diferente.

Preencha também `KTAG_API_URL`, `KTAG_API_USER` e `KTAG_API_PASS` no
`.env.vps`; o serviço `worker` usa essas credenciais para coletar posições sem
expor segredos ao frontend. Defina `KTAG_HISTORY_EXECUTOR=vps` nas Cloud
Functions antes de iniciar o worker, para impedir a coleta duplicada.

O fluxo recomendado é executar manualmente `Deploy` no GitHub Actions com
`target=all` e `environment=production`. O mesmo CI valida o projeto, implanta
Cloud Run, Functions e Firestore, publica `ghcr.io/<owner>/ktag-platform:<commit>`
e faz a VPS baixar a imagem imutável.

Antes de usar `all` em produção, crie a variável de repositório
`KTAG_TRACCAR_REALTIME_ENABLED=false`. Assim o Cloud Run continua servindo a
aplicação sem competir com o worker realtime ativo na VPS.

Secrets necessários no GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PORT`,
`VPS_SSH_PRIVATE_KEY`, `VPS_SSH_KNOWN_HOSTS`, `VPS_APP_PATH` e os
`KTAGFINDER_PROD_FIREBASE_*` já usados no build atual. Use
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

1. Implante primeiro a nova Function K-TAG (sem XADTAG e sem histórico).
2. Suba a VPS em `api-vps.ktagfinder.app` com `TRACCAR_REALTIME_ENABLED=false` e valide REST/autorização.
3. Reduza o TTL DNS para 300 segundos.
4. Na janela de corte, crie a variável de repositório `KTAG_TRACCAR_REALTIME_ENABLED=false` e atualize o Cloud Run com `TRACCAR_REALTIME_ENABLED=false`.
5. Defina `TRACCAR_REALTIME_ENABLED=true` na VPS e recrie somente o backend.
6. Valide snapshot, WebSocket, uma posição real e isolamento usando tenant de teste.
7. Troque o DNS/API para a VPS.
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
- O mapa recebe todas as mensagens; o Firestore recebe checkpoints conforme `TRACCAR_POSITION_PERSIST_INTERVAL_MS`.
- O worker da VPS é responsável por K-TAG e retenção de histórico; a Function `scheduledTagUpdate` deve permanecer desativada com `KTAG_HISTORY_EXECUTOR=vps`.

## Permissões da service account

Use uma conta exclusiva para a VPS. Ela precisa de acesso de leitura/escrita ao Firestore (`roles/datastore.user`). Não reutilize credenciais pessoais nem a service account padrão do projeto. Rotacione a chave após qualquer suspeita de exposição.
