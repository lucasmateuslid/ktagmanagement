# Arquitetura de tracking 5.1

O frontend React/Vite usa a API Express autenticada; o backend usa Firebase Admin para o Firestore multi-tenant e mantém todas as credenciais dos provedores fora do navegador. O worker da VPS coleta K-Tag periodicamente. Veículos ficam em `tenants/{tenantId}/vehicles`, tags em `tenants/{tenantId}/tags` e os snapshots K-Tag em `tenants/{tenantId}/tag_history`.

## Identificadores

- `id`: documento interno da tag; nunca é enviado ao Traccar.
- `accessoryId`: serial/patrimônio apresentado ao usuário.
- `identifierOriginal`: entrada preservada sem perda.
- `identifierNormalized`: resultado da regra específica do tipo.
- `traccarUniqueId`: valor exato que o equipamento deve transmitir.
- `traccarDeviceId`: inteiro gerado pelo Traccar, usado nas APIs de posição e rota.

IMEI aceita exatamente 15 dígitos e Luhn. MAC remove apenas `:`, `-` e espaços, converte para maiúsculas e exige 12 hexadecimais. Serial numérico não recebe padding implicitamente. O perfil documentado `xadtag_legacy_numeric_10_to_15` é a única exceção atual: exige 10 dígitos e adiciona cinco zeros à esquerda, produzindo 15 dígitos; por decisão de integração esse também é o `traccarUniqueId` sugerido, mas o campo enviado continua explícito e exato.

## Cadastro, vínculo e localização

`POST /api/integrations/traccar/xadtags` reserva localmente identificador e `uniqueId`, procura o dispositivo pelo `uniqueId` exato e só cria quando ausente. Indisponibilidade deixa a tag `pending`; `POST /:id/retry` repete a operação idempotente. Resposta de criação não valida comunicação: somente uma posição real associada ao mesmo `deviceId` registra `communicationValidatedAt`.

`PUT /api/vehicles/:vehicleId/tag` e `DELETE /api/vehicles/:vehicleId/tag` são as únicas operações de vínculo. A transação valida os dois documentos, consulta uso concorrente, libera a tag anterior, sincroniza ambos os lados e grava auditoria. As regras bloqueiam alteração direta de `vehicle.tagId` e dos campos `linkedEntity*`.

`GET /api/vehicles` ordena por `createdAt` e ID, usa cursor opaco e busca prefixada por HMAC. Clientes recebem apenas `clientId` derivado da sessão. `GET /api/livemap/vehicles/:vehicleId/history` exige `from`/`to`, aceita até 30 dias por padrão e pagina com cursor opaco. XADTag consulta rotas Traccar em janelas; K-Tag lê `tag_history`. O contrato mantém provedor e tag em cada ponto porque um veículo pode trocar de equipamento no período. Toda resposta contém `requestId`, é `no-store` e passa por rate limit por usuário e veículo.

## Fluxo do histórico

```text
Mapa / Relatórios / Exportação
             |
             v
GET /api/livemap/vehicles/:vehicleId/history
             |
     sessão + autorização do veículo
             |
       assignments do período
        /                 \
 K-TAG / Firestore     XADTAG / Traccar
        \                 /
       validação + deduplicação
             |
       página cronológica
```

O worker consulta lotes de até 50 K-Tags. Cada snapshot válido recebe ID determinístico por tag, timestamp e coordenadas. Repetições são idempotentes; pontos atrasados são preservados sem regredir `lastPosition`. Respostas 429/5xx usam backoff exponencial com jitter. A API do fornecedor entrega somente o snapshot mais recente, portanto não há recuperação retroativa de pontos perdidos entre ciclos.

O refresh da frota processa gravações Traccar com concorrência limitada e divide o relatório em partes de até 100 veículos/posições por documento Firestore. Uma posição nova sem endereço mantém `address: null`; o endereço antigo só é reutilizado quando as coordenadas coincidem. O endpoint de geocodificação reversa usa o resolvedor do backend: Traccar primeiro e Photon apenas com `SERVER_ADDRESS_PUBLIC_PHOTON=true`, raio e distância máxima de 100 m. O Nominatim público não participa da atualização automática. Em produção com milhares de equipamentos, dimensione o provedor de geocodificação reversa do Traccar; caso ele não responda, mostre endereço pendente em vez de associar um endereço distante. Execute `npm run audit:tracking -- --tenant=TENANT` antes da publicação para revisar `DUPLICATE_TRACCAR_DEVICE` e `LEGACY_ADDRESS_REVIEW`; o relatório de auditoria não comprova que um endereço textual antigo está correto.

K-TAGs podem ter IMEI GT06 separado do serial Feibao. O backend reserva o IMEI em `traccar_ktag_identifiers`, registra o dispositivo Traccar e só valida comunicação após receber uma posição do `traccarDeviceId` correspondente. O Traccar é a fonte principal para K-TAGs integradas; a Feibao permanece como fallback identificado e para tags legadas sem IMEI. Antes da migração, confira no log de protocolo do Traccar se o login real do equipamento envia esse IMEI. Rode `npm run audit:tracking -- --tenant=TENANT` para um relatório JSON somente de leitura de vínculos e posições divergentes. A opção `--apply` remove apenas `lastPosition` de veículo comprovadamente pertencente a outra tag ou veículo, revalidando o vínculo em transação; os demais conflitos exigem revisão.

## Migração, implantação e rollback

Antes de publicar, rode `npm run typecheck`, `npm run test --workspace=@ktag/backend`, `npm run test --workspace=@ktag/web` e `npm run build`. Para carga local, execute `scripts/local-fleet-equipment-load.mjs` em emuladores isolados (1.000 tags e 1.000 rastreadores) e `scripts/local-fleet-scale.mjs` (2.001 veículos, mudança de coordenadas e dispositivo duplicado). No ambiente de produção, confirme que `GET /api/server/geocode?latitude=...&longitude=...` do Traccar responde aos pontos reais e que o provedor contratado suporta a taxa de posições novas da frota. Verifique amostras de endereço com coordenadas e placa e rode a auditoria somente de leitura por tenant antes de ativar o worker. Se o geocodificador não estiver configurado ou exceder sua capacidade, a aplicação deve deixar o endereço pendente.

Execute primeiro `npx tsx scripts/migrate-tracking.ts --tenant=TENANT --report=/caminho/seguro/report.json`. Conflitos de uma tag em vários veículos ou referências ausentes nunca são corrigidos silenciosamente. Revise o relatório e só então repita com `--apply`. Use a mesma `SEARCH_INDEX_KEY` do backend. Publique `firestore.indexes.json` antes de ativar a UI paginada e `firestore.rules` junto da API.

A retenção usa `expiresAt` e a política TTL versionada em `firestore.indexes.json`. O executor K-Tag de produção é somente o worker da VPS; os antigos jobs agendados das Functions devem permanecer removidos. Em rollback, pare o serviço `worker` antes de voltar a imagem e não apague históricos automaticamente. Reservas em `xadtag_identifiers` e `tag_identifier_keys` devem ser preservadas enquanto existirem tags correspondentes.

## Índices exigidos

Os índices versionados cobrem veículos por `clientId + createdAt + __name__`, pesquisa por `searchPrefixes + createdAt + __name__`, histórico por `timestamp + __name__` e o mapeamento de tags Traccar. Filtros adicionais podem gerar sugestões de índices compostos do Firestore; registre-os no arquivo antes de produção.
