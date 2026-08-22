# Arquitetura de tracking 5.1

O frontend React/Vite usa a API Express autenticada; o backend usa Firebase Admin para o Firestore multi-tenant e mantém todas as credenciais Traccar fora do navegador. As Cloud Functions coletam o provedor K-Tag. Veículos ficam em `tenants/{tenantId}/vehicles`, tags em `tenants/{tenantId}/tags` e o histórico persistido em `vehicles/{vehicleId}/history`.

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

`GET /api/vehicles` ordena por `createdAt` e ID, usa cursor opaco e busca prefixada por HMAC. Clientes recebem apenas `clientId` derivado da sessão. `GET /api/livemap/vehicles/:vehicleId/history` limita o período a sete dias: XADTag consulta rotas Traccar em janelas; K-Tag lê a subcoleção persistida. Ambos normalizam, ordenam, deduplicam e paginam.

## Migração, implantação e rollback

Execute primeiro `npx tsx scripts/migrate-tracking.ts --tenant=TENANT --report=/caminho/seguro/report.json`. Conflitos de uma tag em vários veículos ou referências ausentes nunca são corrigidos silenciosamente. Revise o relatório e só então repita com `--apply`. Use a mesma `SEARCH_INDEX_KEY` do backend. Publique `firestore.indexes.json` antes de ativar a UI paginada e `firestore.rules` junto da API.

Para ativar persistência K-Tag use `KTAG_HISTORY_MODE=write`; mantenha `shadow` na observação inicial. A retenção usa `expiresAt` e requer política TTL do Firestore nessa collection group. Em rollback, volte aplicações para 5.0.0, retorne o worker a `shadow` e use o relatório para identificar os campos aditivos. Não apague históricos automaticamente. Reservas em `xadtag_identifiers` e `tag_identifier_keys` devem ser preservadas enquanto existirem tags correspondentes.

## Índices exigidos

Os índices versionados cobrem veículos por `clientId + createdAt + __name__`, pesquisa por `searchPrefixes + createdAt + __name__`, histórico por `timestamp + __name__` e o mapeamento de tags Traccar. Filtros adicionais podem gerar sugestões de índices compostos do Firestore; registre-os no arquivo antes de produção.
