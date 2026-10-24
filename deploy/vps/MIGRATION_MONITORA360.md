# Migração de ktagfinder-prod para monitora360.online

## Estado atual

- A imagem Docker já contém o frontend e o backend. O Nginx de `api-vps.ktagfinder.app` expõe somente API e WebSocket; `nginx-monitora360.conf.template` expõe também a SPA no domínio novo.
- O projeto `ktagfinder-prod` continua sendo a origem de Auth, Firestore e Functions durante a primeira fase. Não alterar o plano Firebase para Spark nesta fase.
- O PostgreSQL `postgres` em `docker-compose.yml` tem volume e rede exclusivos. Seu profile impede início automático. Não utilizar os bancos de `traccar`, `evolution-ktag` ou `ktag-candidate`.
- Em 16/10/2026, os nameservers públicos de `monitora360.online` eram `orbit.dns-parking.com` e `horizon.dns-parking.com`; o apex apontava a `2.57.91.91`. Confirmar novamente antes de qualquer mudança DNS.

## Fase 1: hospedagem sem Cloud Run

1. Publicar o DNS de `monitora360.online` e `*.monitora360.online` para a VPS, preservando os registros de e-mail e outros serviços da zona. Obter TLS válido para ambos os nomes; configurar Cloudflare somente depois de transferir a zona, caso essa seja a escolha de DNS.
2. Renderizar `nginx-monitora360.conf.template` com caminhos de certificado e o mesmo `CF_ORIGIN_SECRET` de `.env.vps`; manter o segredo fora do Git. Validar com `nginx -t` e recarregar Nginx.
3. Adicionar os novos hosts necessários aos domínios autorizados do Firebase Auth. O frontend usa e-mail/senha e mantém o `authDomain` atual do projeto; não trocar o projeto nem os UIDs.
4. Fazer o deploy manual `target=vps`. O build da VPS usa `VITE_TRACKING_API_URL` vazio, portanto `/api` e `/ws/tracking` são servidos no mesmo host da SPA. Manter somente uma instância do consumidor realtime do Traccar.
5. Validar `monitora360.online`, `admin.monitora360.online` e um tenant real (exemplo `{slug}.monitora360.online`) com login, autorização, escrita/leitura, Functions, webhook e WebSocket. Confirmar CORS das Functions no novo domínio antes de desviar tráfego de clientes.
6. Quando a VPS sustentar o tráfego, retirar Cloud Run do caminho público. O workflow só voltará a publicar Cloud Run com o alvo explícito `cloud-run` ou com `KTAG_DEPLOY_CLOUD_RUN=true`. Verificar e desativar também qualquer trigger independente de `cloudbuild.yaml`; manter a versão anterior durante observação, então excluir o serviço para encerrar o custo.

## Fase 2: importação para PostgreSQL

1. Criar `secrets/postgres-password` com permissão `0600`, definir `DATABASE_URL` em `.env.vps` e configurar backup externo criptografado antes de ligar o banco.
2. `docker compose --env-file .env.vps --profile postgres up -d postgres`.
3. `docker compose --env-file .env.vps run --rm backend node_modules/.bin/tsx packages/backend/src/cli/migrate.ts`.
4. Fazer um piloto com `.../cli/importFirestore.ts --tenant=SLUG --apply`; depois executar `.../cli/importFirestore.ts --apply` uma vez para o banco inteiro. Evitar `count-only` integral quando o custo de leitura for prioridade: ele faz uma passagem completa adicional. A importação é idempotente, preserva caminhos, campos, tipos especiais e timestamps de criação/atualização do Firestore em `firestore_import`, percorre subcoleções mesmo sob pais apagados e copia `tag_history` para a tabela tipada. O comando interrompe a cópia se encontrar um tipo ou inteiro que não consegue representar fielmente e retorna erro se a contagem total importada divergir. Uma passagem de leitura completa tem custo no Firestore; planejar a execução e monitorar faturamento.
5. Congelar gravações do frontend, backend, worker e Functions para o tenant (ou para todos, na virada geral). Repetir `--apply` e então executar `--verify` **sem** `--apply`. A verificação consulta novamente cada documento, compara o JSON com PostgreSQL, detecta caminhos extras na contagem total e retorna código 2 se houver diferença. Se falhar, não trocar a fonte: corrigir a causa e repetir. Apenas contagens, sem congelar escritas, não comprovam integridade.
6. Ativar `TAG_HISTORY_STORE=dual` somente após testar o banco: novas posições K-TAG serão gravadas também no PostgreSQL; as leituras ainda virão do Firestore. Comparar contagem e amostras por empresa/tag/período. Repetir o backfill, conferir novamente e só então usar `TAG_HISTORY_STORE=postgres` no backend **e** worker, sem iniciar dois coletores realtime.
7. A importação também preenche `tenants`, `tenant_users`, `custom_roles` e `system_admins`. `AUTHZ_STORE=postgres` remove leituras de membership/licença da API no Firestore, porém só pode ser ativado depois que criação, edição, revogação e suspensão dessas entidades gravarem PostgreSQL como fonte de verdade; uma importação pontual deixaria permissões obsoletas.
8. A tabela `firestore_import` é área de migração e as demais entidades **ainda usam Firestore**. Não desligar Firestore, Functions ou alterar Spark até que APIs, workers e frontend usem as tabelas definitivas e a verificação de ausência de tráfego Firestore passe.

## Corte final

- Migrar autorização/membership, operações de domínio, billing, notificações, gatilhos e jobs para PostgreSQL + API/worker, mantendo somente Firebase Auth. Testar isolamento de tenant, idempotência de webhook, restauração e rollback.
- Congelar gravações por no máximo uma hora, repetir importação/reconciliação, comparar contagens e registros críticos, trocar a fonte de leitura/escrita e reabrir gravações.
- Confirmar por métricas e busca no bundle/backend que nenhuma chamada de produção ainda depende de Firestore ou Functions. Só então excluir Functions, desativar Firestore e mudar `ktagfinder-prod` para Spark.
