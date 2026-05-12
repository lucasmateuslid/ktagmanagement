# Documentação Analítica da Codebase - K-TAG Manager Pro

Bem-vindo(a) à análise aprofundada da arquitetura do projeto **K-TAG Manager Pro**. Este documento foi redigido para fornecer aos Analistas, Arquitetos e Desenvolvedores uma visão compreensiva de cada parte do sistema.

***

## 1. Visão Geral do Sistema

O **K-TAG Manager Pro** é uma plataforma corporativa Full-Stack de **Gestão de Controle de Frotas de Veículos e Rastreamento**, bem como uma ferramenta orquestradora para envio, instalação e pagamento de técnicos despachantes.

Resumidamente, o sistema engloba as seguintes funções operacionais de uma empresa de rastreio/telemetria:
- Cadastro e vínculo de Equipamentos Tracker (Tags), Veículos e Clientes.
- Gestão e Criação de Ordens de Serviço (Agendamentos para instalação/manutenção), com cálculo de margens financeiras para o técnico e acompanhamento de SLAs de atendimento.
- Localização em Tempo real de Múltiplos Veículos Integrados (usando Leaflet e Integrações Externas).
- Emissão e Controle do ciclo de logística de pacotes de aparelhos enviados aos técnicos via Correios/Transportadoras Parceiras (API Melhor Envio).
- Geração de relatórios, monitoramento analítico (Dashboard) e interação de I.A (Inteligência Artificial) para extrações complexas.

## 2. Arquitetura Base

A aplicação é uma **SPA (Single Page Application)** escrita em **React 18** e **TypeScript**, servida através do framework **Vite**, e suportada por um Backend simples e eficiente em **Node.js + Express**.

### O Backend (`server.ts`)
O Backend é um arquivo isolado que executa o sistema e atende 3 propósitos fundamentais:
- **Hospedagem Estática**: Em produção, ele serve os pacotes do `Vite` gerados dentro de `dist/`. No desenvolvimento, aciona o `Vite.createViteServer` como middleware, facilitando a troca entre modos.
- **Microservices de Proxy CROS ("Cross-Origin Resource Sharing")**: O navegador não permite que o Frontend faça certas solicitações HTTP diretamente para APIs de Terceiros que bloqueiam o front (ex: API da Integração legado *K-TAG*, Motor Genérico AI que force CORS ou *Hinova/SGA*). Para isso, as rotas `/api/proxy` (e o fallback das I.As) processam o *bypass* destas checagens de origem, injetando cabeçalhos de segurança nativos originários do Server para as APIs finais.
- **Endpoints Nativos (APIs Rest Integradas)**: Ele lida com tarefas complexas sem precisar expor as credenciais na mão do usuário frontend (em tese), como Geocodificações reversas, rastreamentos de pacotes e lida ativamente com a API de transporte `Melhor Envio` (`/api/melhorenvio/...`).

### O Frontend (`src/`)
Usa bibliotecas modernas guiadas pela experiência do usuário:
- Construção Ul baseada em `Tailwind CSS`, usando de animações suaves orientadas via `Framer Motion`.
- Roteamento puramente do cliente contido com `React Router DOM`.
- Ícones via `Lucide React` e gráficos com `Recharts`.
- Componentes e mapas guiados via `React Leaflet`.

## 3. Autenticação e Perfis de Acesso

### Gerenciador de Identidade
Toda a Autenticação é delegada ao serviço do **Firebase Authentication**. Senhas não ficam armazenadas em texto, nem transitam pelo Express do backend local.

O fluxo de segurança ocorre puramente por tokens em cache/estado global usando `onAuthStateChanged()`. A sessão não expira a menos que o estado de login se quebre, dando ao usuário um contexto rico para atuar.

### Modelo de Funções (RBAC Roles)
Dentro do banco de Dados do Firestore, o cadastro de um usuário é emparelhado ao `Auth`. Os seguintes níveis de controle (Roles) são checados ativamente sob as renderizações do código e requisições no `services/storage.ts`:

- **Admin**: Acesso Global. Pode modificar configurações de sistema, dados financeiras limiares da companhia e expurgar dados lógicos da lixeira.
- **Manager (Gerente Técnico)**: Acesso e gerenciamento das lógicas de Frota e Estoque, com a possibilidade de escalonar técnicos.
- **User (Operador / Atendimento)**: Um despachante que só manipula Agendamentos, não tendo acesso profundo às integrações.
- **Tech (Técnico)**: Recebe demandas e vê sua carteira de pagamento e Ordens de Serviço alocadas.
- **Client**: Pode logar na interface logada puramente como rastreador final do seu próprio veículo e emitir notificações de roubo.

## 4. Estratégia de Firebase (Database e Arquitetura Serverless)

A plataforma **K-TAG Manager** foi forjada baseada no poder do **Firebase Cloud Firestore**. Sendo um modelo `No-SQL`, é utilizado como a verdadeira Fonte da Verdade do negócio.

- **Offline-First e Sombra de Criptografia**: Além de habilitar `enableMultiTabIndexedDbPersistence` para permitir leitura e escrita na falta de rede, usa o utilitário `services/encryption.ts` que se apoia nativamente em `Web Crypto API` (AES-GCM) para armazenar dados Sigilosos (CPF, CNPJs, etc.) de modo criptografado usando uma chave derivada em `PBKDF2`. Sem a key em runtime, extrações vazadas da Firebase trazem dados truncados.
- **Modelagem Firestore Coleções**: O módulo interage com 15+ coleções principais centralizadas nas chaves `KEYS`, tais como:
  - `ktag_settings_v3`: Snapshot dinâmico que sustenta variáveis de ambiente nativas customizadas pelo Admin em tempo real.
  - `ktag_vehicles`, `ktag_tags` e `ktag_technicians` para modelar ativos fixos.
  - `ktag_schedules` para os fluxos de agendamentos despacháveis.
  - `ktag_audit_logs` para conformidade onde toda deleção é mapeada no sistema.

## 5. Comunicações com Integrações Externas / Proxy Back-end

Sempre que a aplicação vai "para fora" buscar os GPSs do parceiro, a lógica de rede é isolada:

1. **APIs de Telemetria Legada (K-TAG URL baseada em IP local) / SGA (Hinova)**: Por muitas vezes hospedados em ambientes defasados, o CORS seria recusado. Logo, `services/api.ts` invoca `fetch('/api/proxy')` onde o `server.ts` pega este fardo e assina a requisição por debaixo dos panos para o exterior de maneira limpa.
2. **Motor de Geocoding Multi-camadas**: O Backend tem um sofisticado proxy fallback para georeferenciamento. Ele pode consultar o `Photon` -> `Nominatim OSM` -> `Google Maps` -> Até dar a coordenada, reduzindo falhas e gastos com API do Google em casos não sensíveis.
3. **Plataforma Frete Comercial (Melhor Envio)**: Devido à rotatividade das `Tokens OAuth / Exchanges` feitas com o Mercado, o Backend mantém a camada de proxy (`/api/melhorenvio/`) que lida com montagem de Carrinho, Geração das Etiquetas do rastreador enviado e rastreio, protegendo as `Client Secret`.

## 6. Módulo da Inteligência Artificial (K-Tag Assistant)

O Frontend embute a diretoria executiva do sistema usando o **Generative AI**.
O hook base `useAiLogic.ts` foi montruosamente construído com um escopo agnóstico podendo interagir com LLMs complexas:
- Implementa um fallback que permite escolher via Configurações: `Gemini (Google)`, `Claude (Anthropic)`, `Llama v3 (Groq)` ou `Deepseek`.

**Function Calling (The Core Magic)**: O grande diferencial não é um chatbot cego. O Hook `useAiTools.ts` mapeia, para a IA as funções analíticas:
1. `analyze_operations`: A IA baixa os dados de Veículos Ativos, Tags, e Agendamentos simultaneamente e devolve se a frota está ociosa financeiramente frente aos SLAs ou técnicos parados, sendo o Consultor Executivo do negócio.
2. `search_external_data`: A IA faz *querys* diretas usando os Tokens Integrados para trazer resultados de integrações (como o SGA), sem o usuário precisar ter acessado as abas em si.

A IA recebe uma diretiva de não ser um robô, mas um **Engenheiro Chefe de Operações** agindo sob a "persona K-TAG".

## 7. Sumário

O **K-TAG Manager Pro** representa uma base incrivelmente madura e sólida de uma *Start Up* de Rastreio. A complexidade do modo *Offline-First* somada ao cache do Firebase, lidam de frente com as necessidades reais de técnicos onde nem sempre há sinal 4G. 

A arquitetura orientada em Serviços (onde cada `Feature` usa um Controller customizável no Proxy do `server.ts` evitando dor de cabeças de Cross-Server) aliada a um controle modularizado (Autenticação separada de Criptografia, Inteligência Artificial desacoplada com Function Calling e Geocoding hibrido) permite escalar essa Codebase para uma base massiva de IOT sem perda de performance percebida na Renderização em tela.
