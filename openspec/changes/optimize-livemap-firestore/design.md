# Design

## Fluxo alvo

```text
Traccar
   │
   ▼
TraccarRealtimeService
   ├── índice de vínculos em memória
   ├── broadcast imediato pelo WebSocket
   └── persistência consolidada no Firestore
            │
            ├── intervalo mínimo
            ├── distância mínima
            └── mudança de estado

LiveMap
   ├── bootstrap HTTP na abertura
   ├── WebSocket enquanto conectado
   └── fallback HTTP somente durante indisponibilidade
```

## Política de persistência

O broadcast não deve depender da persistência. Toda posição válida e nova pode
ser transmitida aos clientes, mas o Firestore só deve ser atualizado quando:

- não existe posição persistida;
- a posição mudou além da distância mínima configurada;
- passou o intervalo máximo configurado desde a última persistência;
- houve mudança relevante de status;
- a posição é necessária para recuperar o estado após uma reconexão.

Os limites devem ser configuráveis por ambiente, com defaults conservadores:
intervalo de 300 segundos e distância de 30 metros.

## Índice de vínculos

O refresh do mapping deve carregar também o vínculo de equipamento para
veículo. O processamento de posições consulta esse índice em memória. O índice
é reconstruído junto com o mapping periódico, e posições sem vínculo são
transmitidas apenas quando o modelo atual permitir isso, sem consultas extras
por evento.

## Cliente

O hook de tracking deve iniciar o bootstrap e o WebSocket. O fallback periódico
deve ser criado apenas quando o WebSocket não estiver aberto e cancelado no
evento de abertura. Uma reconexão deve executar um bootstrap único antes de
retomar o canal em tempo real.

## Segurança e compatibilidade

- manter validação atual de tenant, dispositivo, timestamp e coordenadas;
- nunca permitir que uma posição antiga regrida `lastPosition`;
- não alterar permissões Firestore;
- manter o refresh manual explícito;
- não ocultar falhas: registrar métricas/logs e preservar o último estado
  conhecido.
