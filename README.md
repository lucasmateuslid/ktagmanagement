
# K-Tag Manager Pro (v3.0.2)

**K-Tag Manager Pro** é uma plataforma Enterprise de gestão de rastreamento, controle de frota e orquestração de serviços técnicos. Desenvolvida como uma SPA (Single Page Application) moderna, ela foca em performance, funcionamento offline-first e integração com múltiplas APIs de telemetria.

---

## 🚀 Tecnologias Implementadas

O projeto utiliza uma stack moderna baseada no ecossistema React:

### Core & Arquitetura
- **React 18+**: Biblioteca principal de UI.
- **TypeScript**: Tipagem estática para robustez e manutenção.
- **Vite**: Build tool e servidor de desenvolvimento de alta performance.
- **Firebase (v10+)**:
  - **Firestore**: Banco de dados NoSQL em tempo real (com persistência offline habilitada).
  - **Cloud Functions**: Proxy para contornar CORS e executar lógicas de backend (notificações).
- **React Router DOM**: Roteamento client-side (HashRouter).

### Interface & UX
- **Tailwind CSS**: Framework de estilização utilitária.
- **Framer Motion**: Biblioteca de animações fluidas (transições de página, modais).
- **Lucide React**: Ícones vetoriais leves e consistentes.
- **Recharts**: Biblioteca de gráficos para o Dashboard analítico.

### Mapas & Geolocalização
- **Leaflet & React-Leaflet**: Renderização de mapas interativos.
- **React Leaflet Cluster**: Agrupamento de marcadores para performance em grandes frotas.
- **Google Maps API**: Usado para Autocomplete de endereços e Geocodificação reversa (opcional, configurável).

### Inteligência Artificial & Automação
- **Google Gemini API (via @google/genai)**: Motor do "AI Assistant" e gerador de Changelogs. O assistente possui acesso a ferramentas (function calling) para consultar banco de dados e gerar relatórios.

### Utilitários
- **XLSX**: Importação e exportação de planilhas Excel.
- **jsPDF & AutoTable**: Geração de relatórios PDF profissionais no client-side.
- **AES-GCM (Web Crypto API)**: Criptografia de ponta a ponta para dados sensíveis locais.

---

## ⚙️ Arquitetura e Funcionamento

### 1. Camada de Dados (Storage Service)
Toda a interação com o banco de dados é abstraída no arquivo `services/storage.ts`.
- **Estratégia Híbrida**: O sistema tenta ler do Firestore. Se falhar (offline), lê do cache local (IndexedDB do Firebase ou LocalStorage).
- **Criptografia**: Dados sensíveis (CPFs, Nomes) são criptografados antes de serem salvos no banco usando uma chave derivada do `companySlug` ou semente do usuário.

### 2. Central de Agendamentos (Schedules)
O módulo mais complexo do sistema.
- **Fluxo de Status**: `Solicitada` -> `Em análise` -> `Confirmada` -> `Técnico no local` -> `Concluída`.
- **Lógica Financeira**: O sistema calcula automaticamente a margem de lucro baseada no custo do técnico, deslocamento e valor de adesão. Se a margem for baixa, o card fica vermelho/amarelo.
- **SLA**: O hook `useScheduleNotifications` monitora agendamentos parados há mais de 30 minutos e emite alertas sonoros e visuais para administradores.

### 3. Integrações Externas (Proxy)
Devido a restrições de CORS em navegadores, o sistema não chama APIs de rastreadores (K-Tag/TraqCare) ou ERPs (Hinova/SGA) diretamente.
- As requisições passam por uma **Cloud Function** (configurada no `functions/index.js`) que atua como Proxy, repassando a requisição com os headers de segurança apropriados.

### 4. Modo Offline
O arquivo `firebase.ts` habilita `enableMultiTabIndexedDbPersistence`. Isso permite que o app carregue e funcione (leitura/escrita) mesmo sem internet. As escritas são sincronizadas quando a conexão retorna.

---

## 🛠️ Configuração e Instalação

### Pré-requisitos
- Node.js 18+
- Chave de API do Google Gemini (para recursos de IA).
- Projeto Firebase configurado.

### Instalação
```bash
# 1. Instalar frontend
npm --prefix frontend install

# 1.1 Instalar backend dedicado (BFF/API)
npm --prefix backend install

# 1.2 Instalar gateway Traccar
npm --prefix backend/traccar-gateway install

# 2. Rodar em desenvolvimento
npm --prefix frontend run dev

# 2.1 Rodar backend em paralelo (novo fluxo seguro)
npm run dev:backend

# 2.2 Rodar gateway TCP/UDP do Traccar
npm run dev:traccar

# 3. Build para produção
npm --prefix frontend run build

# 3.1 Build do backend
npm run build:backend
```

### Variáveis de Ambiente (.env)
Crie um arquivo `.env` em `frontend/.env`:
```env
# Chave para o Gemini AI (Obrigatório para o Chatbot funcionar)
API_KEY=sua_chave_gemini_aqui

# URL da nova API backend (BFF)
VITE_BACKEND_API_URL=http://localhost:8080
```

### Backend (.env)
Crie `backend/.env` a partir de `backend/.env.example` e configure os segredos no backend (não no frontend):

```env
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ktagmanagement
API_BEARER_TOKEN=defina-um-token-forte
SESSION_TOKEN_SECRET=defina-um-secret-forte
AUTH_PASSWORD_PEPPER=KTAG_SECURE_SALT_V3_2025
ADMIN_EMAIL=lucasmateus.lima@outlook.com
K_TAG_API_URL=...
K_TAG_API_USER=...
K_TAG_API_PASS=...
XADTAG_API_TOKEN=...
GOOGLE_MAPS_SERVER_KEY=...
HINOVA_TOKEN=...
HINOVA_USER=...
HINOVA_PASS=...
```

### Base relacional (PostgreSQL + Prisma)
- Schema inicial criado em `backend/prisma/schema.prisma`.
- Scripts disponíveis no backend:
  - `npm --prefix backend run prisma:generate`
  - `npm --prefix backend run prisma:migrate`
  - `npm --prefix backend run prisma:deploy`
- Objetivo: mover dados sensíveis/transacionais gradualmente para PostgreSQL mantendo Firestore apenas no que for tempo real.

### Cache distribuído (Redis)
- Cliente base criado em `backend/src/services/cache.ts`.
- Variável esperada: `REDIS_URL`.
- Próximo uso natural: rate limit distribuído, cache de token Hinova, cache de plate lookup e deduplicação de requests.

### Listener dedicado Traccar
- Serviço separado criado em `backend/traccar-gateway/`.
- Expõe listener TCP, listener UDP e endpoint HTTP de health.
- Esse serviço é a base correta para futura abertura de porta em LB de rede, sem depender de Firebase Functions/HTTP.

### CI/CD inicial
O repositório agora inclui pipeline em `.github/workflows/ci-cd.yml` com:
- Typecheck + build do frontend
- Typecheck + build do backend
- Sanidade do entrypoint de Firebase Functions (`backend/functions`)

### Deploy backend (Cloud Run)
Foi adicionado `backend/cloudrun.yaml` como base para deploy com:
- `minScale: 2` (MVP robusto com duas instâncias)
- Segredos via Secret Manager (`valueFrom.secretKeyRef`)

### Autenticação backend (Fase 2)
- Novo endpoint `POST /api/auth/login` no backend valida usuário/senha em `ktag_users_db`.
- Senha em formato legado (texto plano) é migrada automaticamente para hash SHA-256+pepper no login.
- Backend emite token de sessão assinado (`SESSION_TOKEN_SECRET`) e o frontend usa esse token nas rotas `/api/*`.

### Integrações backend (Fase 3 em andamento)
- `POST /api/integrations/hinova/search`: consulta SGA/Hinova no backend, sem expor token/usuário/senha no navegador.
- `GET /api/integrations/plate/:plate`: consulta API de placas no backend, sem expor token no frontend.
- O frontend já usa essas rotas com fallback legado temporário em caso de ambiente sem backend.

### Configuração do Sistema (Runtime)
Com a nova arquitetura híbrida, segredos e credenciais sensíveis passam para o backend (env/Secret Manager).
A UI de configurações permanece para parâmetros não sensíveis e controle operacional:
1. Acesse **Configurações** no menu lateral.
2. Em ambientes com `VITE_BACKEND_API_URL`, campos sensíveis ficam bloqueados para evitar vazamento em Firestore/UI.
3. Essas configurações operacionais continuam em `ktag_settings_v3`; segredos ficam no backend.

---

## 🔐 Níveis de Acesso (Roles)

1. **Admin**: Acesso total. Pode ver logs de auditoria, gerenciar usuários, configurar APIs e ver financeiro.
2. **Moderator**: Pode gerenciar veículos, clientes e tags, mas não vê logs de auditoria ou configurações de sistema.
3. **User (Operador)**: Acesso operacional. Pode ver mapas, criar agendamentos e gerenciar status, mas não pode excluir registros permanentemente.
4. **Client**: Acesso restrito apenas aos seus próprios veículos e mapa em tempo real.

---

## 📝 Notas para Desenvolvedores

### 1. Serviço de Criptografia (`services/encryption.ts`)
O sistema usa `Web Crypto API` nativa. **Cuidado ao alterar a lógica de derivação de chave (`PBKDF2`)**. Se a semente (seed) mudar, dados antigos encriptados não poderão ser lidos, resultando em strings corrompidas na UI.

### 2. Tratamento de Datas
O sistema usa Timestamp (milissegundos) para persistência (Firestore/JSON) e objetos `Date` nativos para manipulação na UI. Evite usar bibliotecas como Moment.js para manter o bundle leve; use `Intl.DateTimeFormat` para formatação.

### 3. Mapa ao Vivo
O `LiveMap.tsx` usa um timer (`setInterval`) para polling a cada 30 segundos. Ele cruza dados de Tags (Hardware) com Veículos (Negócio).
- **Atenção**: O componente de mapa (`MapComponent`) usa chaves estáveis para evitar re-renderizações completas do Leaflet, o que causaria "piscas" na tela. Mantenha o `key={tag.id}` nos marcadores.

### 4. Inteligência Artificial
O componente `AiAssistant.tsx` usa "Function Calling". Se adicionar novas funcionalidades ao sistema, lembre-se de registrar novas ferramentas (tools) no prompt do Gemini para que a IA possa interagir com elas.

---

## 📜 Estrutura de Pastas

```
frontend/
├── components/
├── contexts/
├── pages/
├── services/
├── types.ts
└── App.tsx

backend/
├── src/                 # API/BFF e serviços
├── prisma/              # Modelo relacional PostgreSQL
├── functions/           # Firebase Functions
├── traccar-gateway/     # Listener TCP/UDP dedicado
├── cloudrun.yaml
└── .env.example
```

---

**Desenvolvido por Lucas Mateus** | K-Tag Manager Pro © 2025
