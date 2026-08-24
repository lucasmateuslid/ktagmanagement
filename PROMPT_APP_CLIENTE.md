# Prompt de implementação — Aplicativo Cliente K-Tag Finder

Você é um engenheiro de software sênior responsável por evoluir a codebase existente do K-Tag Manager Pro. Trabalhe diretamente neste monorepo, preserve o painel web operacional atual e implemente um aplicativo mobile-first, seguro e whitelabel, destinado aos clientes finais das empresas (tenants) que usam a plataforma.

## Contexto confirmado da codebase

- Frontend atual: React 18, TypeScript, Vite, Tailwind, React Router e Firebase SDK.
- Backend/BFF: Node.js, Express 5 e TypeScript em `packages/backend`.
- Dados e identidade: Firebase Authentication, Firestore multi-tenant e Cloud Functions.
- Rastreamento: Traccar, integração K-Tag/XADTAG, snapshot REST e atualizações por WebSocket.
- Mapas e endereço: Leaflet/React-Leaflet, OpenStreetMap/Google e geocodificação reversa.
- O domínio já possui `Client`, `Vehicle.clientId`, `Tag`, `LocationHistory`, perfil `client`, provisionamento de acesso e whitelabel por tenant.
- O painel atual filtra a frota do cliente no frontend por CPF, mas isso não é uma fronteira de segurança suficiente.

## Objetivo do produto

Criar o aplicativo **K-Tag Cliente**, distribuível inicialmente como PWA instalável e preparado para empacotamento nativo com Capacitor, no qual o cliente final de cada tenant possa:

1. Entrar com a conta já provisionada pela empresa.
2. Visualizar somente os veículos associados ao seu cadastro.
3. Ver a última localização de cada veículo em mapa e em formato de endereço.
4. Consultar horário da última comunicação, estado online/offline, placa, modelo e status do veículo.
5. Abrir a rota até o veículo em Google Maps, Waze ou Apple Maps.
6. Consultar histórico de trajeto em um intervalo permitido pelo tenant.
7. Receber alertas úteis de ignição, movimento, entrada/saída de cerca e perda de comunicação, conforme disponibilidade do provedor.
8. Acessar perfil, dados de contato da empresa, termos e política de privacidade.
9. Usar marca, cores, nome e suporte da empresa contratante por tenant.

O app não deve expor estoque de tags, outros clientes, outros veículos, configurações, credenciais de integração, dados financeiros ou recursos administrativos.

## Decisão de stack

Adote uma estratégia incremental:

- Fase inicial: novo app React + TypeScript + Vite em `packages/client-app`, responsivo e instalável como PWA.
- Compartilhe apenas contratos e utilitários seguros por `packages/shared`; não importe componentes administrativos acoplados ao painel.
- Use Firebase Authentication para sessão e tokens.
- Consuma uma API cliente específica no backend Express; não faça consultas amplas ao Firestore e depois filtre no navegador.
- Use Leaflet/React-Leaflet na primeira versão para aproveitar o conhecimento existente e reduzir custo.
- Configure manifest, service worker, ícones, splash, cache do shell e fallback offline da última posição autorizada.
- Deixe a estrutura compatível com Capacitor para posterior geração Android/iOS, sem adicionar Capacitor antes de a PWA estar funcional e validada.
- Use TanStack Query para cache de API e estado remoto se ele puder ser adicionado sem conflito; mantenha estado local simples para UI.

Não crie um app React Native/Expo nesta etapa. A prioridade é validar produto, segurança e experiência mobile com máximo reaproveitamento da stack atual.

## Segurança obrigatória antes da interface

Implemente autorização por recurso no servidor. Nunca confie apenas em `role === 'client'`, CPF informado pelo navegador, `clientId` da URL ou filtros visuais.

1. Formalize a ligação entre identidade e cliente:
   - O membership do usuário no tenant deve conter `clientId` autoritativo, gravado pelo provisionamento via Admin SDK.
   - Faça backfill/migração idempotente para contas cliente existentes.
   - Não use CPF como chave de autorização em runtime.

2. Estenda o middleware de autenticação:
   - Resolva `uid`, `tenantId`, `role` e `clientId` confiáveis.
   - Para role `client`, falhe fechado se `clientId` estiver ausente, inválido ou não pertencer ao tenant.

3. Crie endpoints cliente, por exemplo:
   - `GET /api/client/me`
   - `GET /api/client/vehicles`
   - `GET /api/client/vehicles/:vehicleId/location`
   - `GET /api/client/vehicles/:vehicleId/history?from=&to=`
   - `GET /api/client/vehicles/:vehicleId/address`
   - `GET /api/client/branding`
   Cada endpoint deve validar no servidor que `vehicle.clientId === authUser.clientId`.

4. Separe o realtime do cliente:
   - Não inscreva clientes no canal WebSocket geral do tenant.
   - Crie canal por usuário/cliente ou filtre cada evento no servidor com base nos veículos autorizados.
   - Revalide membership e vínculo; não aceite `clientId` enviado pelo socket.

5. Endureça as regras Firestore:
   - O perfil cliente não pode listar `clients`, `tags`, `vehicles`, `schedules` ou outras coleções do tenant.
   - Se o client app usar apenas API, bloqueie acesso direto às coleções operacionais para role `client`.
   - Preserve os acessos necessários dos perfis internos.
   - Adicione testes no Emulator Suite provando isolamento entre dois clientes do mesmo tenant e entre tenants diferentes.

6. Proteja dados locais:
   - Cacheie somente dados já autorizados e mínimos.
   - Limpe cache e subscriptions no logout ou troca de tenant.
   - Não persista tokens manualmente nem inclua segredos no bundle.
   - Masque dados pessoais desnecessários e siga princípios da LGPD.

## Experiência e telas do MVP

Implemente uma navegação inferior mobile com:

- **Início:** saudação, veículo selecionado, status, última comunicação, endereço resumido e ação “Ver no mapa”.
- **Veículos:** lista apenas dos veículos do cliente, com placa, modelo, status e seletor de veículo ativo.
- **Mapa:** marcador do veículo, centralização, atualização em tempo real, endereço, coordenadas, precisão quando disponível e botões “Atualizar” e “Como chegar”.
- **Histórico:** períodos rápidos (hoje, 24 h e 7 dias), linha do trajeto, início/fim e lista cronológica. Limite de período configurável.
- **Alertas:** preferências e histórico, mesmo que inicialmente alguns eventos sejam marcados como indisponíveis pelo provedor.
- **Conta:** dados básicos, tenant/marca, suporte, sair, termos e privacidade.

Estados obrigatórios: carregamento, sem veículo vinculado, sem posição, dispositivo offline, posição antiga, sem internet, sessão expirada e erro recuperável. Mostre claramente “Última atualização em ...”; nunca represente posição antiga como tempo real.

## Regras de localização e endereço

- Latitude/longitude vêm exclusivamente dos provedores já integrados no backend.
- Resolva endereço no backend com cache por coordenada arredondada e TTL, aproveitando `addressResolver`/geocodificação existente.
- Evite geocodificar repetidamente o mesmo ponto.
- Não dependa do GPS do celular para localizar o veículo. Solicite localização do aparelho somente se a função “minha posição/rota até o veículo” for usada e após consentimento explícito.
- Ofereça deep links seguros para mapas externos e trate plataforma/indisponibilidade.
- Exiba fonte e data da posição; trate precisão e endereço como aproximações quando aplicável.

## Whitelabel e resolução de tenant

- Resolva o tenant pelo hostname/subdomínio no PWA web e valide-o no backend.
- Carregue somente `public_settings` seguros antes do login.
- Aplique nome, logotipo, cores, telefone/WhatsApp e política do tenant.
- Nunca permita que um header ou parâmetro de tenant sem validação dê acesso a outro tenant.
- Para builds nativos futuros, preveja tenant escolhido por código/domínio verificado ou universal link, sem fixar credenciais no app.

## Entregáveis técnicos

1. Documento curto de arquitetura e decisões (ADR).
2. Contratos TypeScript da API em `packages/shared` sem campos administrativos.
3. Migração/backfill idempotente de `clientId` na identidade/membership.
4. API cliente e realtime com autorização por recurso.
5. Regras Firestore endurecidas e testes de segurança.
6. PWA em `packages/client-app`, integrada ao workspace e ao pipeline de build.
7. Testes unitários do middleware/serviços e testes de integração de isolamento.
8. Testes E2E dos fluxos: login, lista, mapa, troca de veículo, histórico, offline e logout.
9. Documentação de variáveis, execução local, deploy, observabilidade e rollback.

## Critérios de aceite

- Cliente A não consegue obter nenhum dado, posição ou evento do Cliente B, mesmo manipulando URL, requests, IDs, headers, Firestore SDK ou WebSocket.
- Um usuário de outro tenant não consegue atravessar o isolamento.
- Nenhuma credencial Traccar/K-Tag/Google/terceiros aparece no navegador.
- O app funciona bem a partir de 360 px, pode ser instalado como PWA e mantém um shell offline.
- A última posição autorizada pode ser vista offline com indicação explícita de desatualização.
- Nova posição aparece sem recarregar a tela quando realtime estiver disponível; há fallback de polling com backoff.
- Endereço e horário sempre correspondem à posição exibida.
- Logout remove dados sensíveis locais e encerra canais realtime.
- O painel administrativo existente continua compilando e funcionando.
- Testes e lint/build do monorepo passam.

## Ordem de execução

1. Audite e documente os fluxos existentes de identidade, cliente, veículo, localização e realtime.
2. Escreva primeiro os testes de isolamento que atualmente falham.
3. Implemente vínculo autoritativo `uid/membership -> clientId` e a migração.
4. Implemente API e realtime cliente com autorização por recurso.
5. Endureça Firestore Rules e faça os testes passarem.
6. Crie o app PWA e suas telas do MVP.
7. Integre localização, endereço, histórico, deep links e estados offline.
8. Execute validações, documente riscos restantes e apresente um resumo dos arquivos alterados.

Antes de editar, leia `KTAG.md`, `README.md`, `firestore.rules`, `types.ts`, `App.tsx`, `pages/livemap`, `services/trackingApi.ts`, `packages/backend/src/middleware/auth.ts`, `packages/backend/src/routes/xadtags.ts`, `packages/backend/src/services/positionBroadcast.ts` e as funções de provisionamento de cliente em `functions/index.js`.

Não faça uma reescrita geral. Entregue em incrementos pequenos, revisáveis e compatíveis com o sistema existente. Se encontrar divergência entre documentação e código, trate o código e os testes como fonte operacional e registre a divergência.
