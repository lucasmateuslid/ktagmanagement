# Otimizar consumo do Firestore no LiveMap

## Problema

O LiveMap combina WebSocket, polling HTTP, listeners da coleção de veículos e
persistência de posições recebidas do Traccar. Isso pode gerar leituras
redundantes, consultas repetidas para descobrir vínculos e escritas frequentes
em documentos de tags e veículos.

## Objetivo

Reduzir leituras e escritas no Firestore sem perder a atualização em tempo real
do mapa:

- usar WebSocket como canal primário enquanto estiver saudável;
- resolver vínculos tag/veículo em memória no backend;
- persistir posições com uma política consolidada de tempo, distância e mudança
  de estado;
- preservar bootstrap, reconexão, fallback e histórico existentes.

## Escopo

- `packages/web/pages/livemap/hooks/useFleetTracking.ts`
- `packages/backend/src/services/traccarRealtimeService.ts`
- estruturas de configuração e testes diretamente relacionados;
- instrumentação mínima para medir posições recebidas, descartadas,
  transmitidas e persistidas.

## Fora do escopo

- substituir o WebSocket por outro mecanismo;
- migrar toda a telemetria para uma nova coleção;
- alterar a retenção ou o formato público do histórico;
- mudanças visuais no LiveMap.

## Critérios de sucesso

1. O navegador não faz polling periódico enquanto o WebSocket está conectado.
2. O processamento de uma posição não consulta o vínculo tag/veículo em cada
   evento.
3. Posições válidas continuam chegando ao mapa em tempo real.
4. Posições repetidas, muito próximas ou dentro da janela mínima não geram
   escritas redundantes.
5. Reconexão e fallback continuam recuperando o estado mais recente.
6. Typecheck e testes direcionados passam.
