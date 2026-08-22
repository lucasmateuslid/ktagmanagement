# Changelog

## 5.1.0 — 2026-08-21

- Cadastro autenticado e idempotente de XADTags no Traccar, com reuso por `uniqueId`, estado pendente e tentativa posterior.
- Modelo explícito para IMEI, MAC, serial patrimonial, `traccarUniqueId` e `traccarDeviceId`.
- Vínculo e desvínculo transacional entre tag e veículo, com conflito concorrente e auditoria.
- Paginação por cursor no backend, busca por blind index e isolamento de veículos por cliente.
- Posição atual com fallback persistido e histórico unificado para XADTag/Traccar e K-Tag.
- Job K-Tag com lease, IDs determinísticos, deduplicação, retenção de 30 dias e modo shadow.
- Migração dry-run para identificadores, vínculos, datas e índices de busca.

Riscos: a migração requer índices publicados e `SEARCH_INDEX_KEY` estável; confirmar o `uniqueId` de cada modelo em teste físico. O sucesso do cadastro no Traccar não comprova comunicação. Rollback: interromper o job, restaurar frontend/backend 5.0.0 e reverter apenas os campos aditivos usando o relatório da migração; os históricos podem permanecer sem afetar 5.0.0.
