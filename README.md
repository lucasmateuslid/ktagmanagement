
# K-Tag Manager Pro (v3.0.2)

**K-Tag Manager Pro** é uma plataforma Enterprise de gestão de rastreamento, controle de frota e orquestração de serviços técnicos. Desenvolvida como uma SPA (Single Page Application) moderna, ela foca em performance, funcionamento offline-first e integração com múltiplas APIs de telemetria.

> **Multi-tenant + billing + CI/CD**: leia [`MULTITENANT_CHANGES.md`](./MULTITENANT_CHANGES.md) (especialmente a **Fase 6**) antes de mexer em deploy, Asaas, painel super-admin ou pipeline. A última fase tem: setup do CI/CD via GitHub Actions com WIF, integração Asaas completa (assinaturas/faturas/PIX/boleto), página `/billing` do tenant, fixes do Cloud Run (cold start de 40s→2s) e o roadmap dos próximos passos.

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
- **Fluxo de Status**: `Solicitada` -> `Em análise` -> `Confirmada` -> `Técnico no local` / `Cliente no local` -> `Concluída`.
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
# 1. Instalar dependências
npm install

# 2. Rodar em desenvolvimento
npm run dev

# 3. Build para produção
npm run build
```

### Variáveis de Ambiente (.env)
Crie um arquivo `.env` na raiz:
```env
# Chave para o Gemini AI (Obrigatório para o Chatbot funcionar)
API_KEY=sua_chave_gemini_aqui
```

### Configuração do Sistema (Runtime)
A maioria das configurações (URLs de API, Tokens de terceiros) **NÃO** fica no `.env`, mas sim no banco de dados, configurável via UI:
1. Acesse **Configurações** no menu lateral.
2. Configure as URLs da API K-Tag, Tokens Hinova/SGA e URL do Proxy.
3. Essas configurações são salvas na coleção `ktag_settings_v3`.

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
src/
├── components/      # Componentes UI reutilizáveis (Modais, Cards, Mapas)
├── contexts/        # Estado Global (Auth, Theme, Notification)
├── pages/           # Telas da aplicação (Dashboard, Vehicles, etc.)
├── services/        # Lógica de negócios e APIs
│   ├── api.ts       # K-Tag Legacy API
│   ├── storage.ts   # Camada de abstração do Firestore
│   ├── encryption.ts# Motor de segurança
│   ├── hinova.ts    # Integração SGA
│   └── ...
├── types.ts         # Definições de Tipos TypeScript (Interfaces)
└── App.tsx          # Rotas e Lazy Loading
```

---

**Desenvolvido por Lucas Mateus** | K-Tag Manager Pro © 2025
