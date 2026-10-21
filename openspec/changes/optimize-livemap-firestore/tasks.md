# Tarefas

- [x] Mapear e instrumentar contadores de posições recebidas, descartadas,
  transmitidas e persistidas no `TraccarRealtimeService`.
- [x] Adicionar configuração de intervalo e distância mínima para persistência
  de posições, preservando defaults compatíveis.
- [x] Construir índice em memória de vínculos equipamento/veículo durante o
  refresh do mapping e remover a consulta por posição.
- [x] Aplicar a política de persistência por tempo, distância e mudança de
  estado, mantendo o broadcast WebSocket independente.
- [x] Alterar o `useFleetTracking` para usar polling HTTP somente como
  bootstrap/fallback durante indisponibilidade do WebSocket.
- [x] Adicionar ou ajustar testes para posições repetidas, próximas, antigas,
  mudança de status, reconexão e fallback.
- [x] Executar typecheck, lint dos arquivos alterados e testes direcionados;
  registrar limitações de validação.
