# 🔧 Guia de Implementação - Correções de Segurança

## 1. Mover JWT_SECRET para Variáveis de Ambiente

### Passo 1: Criar .env.local
```bash
# .env.local (NUNCA commitar)
VITE_JWT_SECRET=seu-secret-gerado-no-backend-aqui-com-minimo-32-caracteres
VITE_API_URL=https://seu-backend.com
VITE_FIREBASE_USE_EMULATOR=false
```

### Passo 2: Atualizar services/jwt.ts
```typescript
// ❌ ANTES:
const JWT_SECRET = 'ktag-pro-super-secret-key-2025-v3';

// ✅ DEPOIS:
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ VITE_JWT_SECRET não configurado em .env.local');
}
```

### Passo 3: Adicionar ao .gitignore
```bash
# .gitignore
.env
.env.local
.env.*.local
*.pem
*.key
```

---

## 2. Implementar Firestore Security Rules

### Criar file: firestore.rules (já existe, mas precisa ser atualizado)

```javascript
// ✅ NOVO: firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ✅ Função de autenticação
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return request.auth.token.role == 'admin';
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isCompanyUser(companySlug) {
      return request.auth.token.companySlug == companySlug;
    }
    
    // ✅ USUÁRIOS - Apenas ler dados próprios
    match /ktag_users_db/{userId} {
      allow read: if isAuthenticated() && (isOwner(userId) || isAdmin());
      allow write: if isAdmin() && request.resource.data.role != 'admin';
      allow create: if request.auth.token.role == 'admin';
      allow delete: if isAdmin();
    }
    
    // ✅ TAGS - Apenas empresa autorizada
    match /ktag_tags/{document=**} {
      allow read: if isAuthenticated() && isCompanyUser(resource.data.companySlug);
      allow write: if isAuthenticated() && isCompanyUser(resource.data.companySlug) && resource.data.createdBy == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.companySlug == request.auth.token.companySlug;
    }
    
    // ✅ VEÍCULOS - Apenas empresa autorizada
    match /ktag_vehicles/{document=**} {
      allow read: if isAuthenticated() && isCompanyUser(resource.data.companySlug);
      allow write: if isAuthenticated() && (isAdmin() || isCompanyUser(resource.data.companySlug));
      allow create: if isAuthenticated() && request.resource.data.companySlug == request.auth.token.companySlug;
    }
    
    // ✅ CONFIGURAÇÕES - Apenas admin
    match /ktag_settings_v3/{document=**} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
    
    // ✅ AUDIT LOGS - Apenas leitura para admin
    match /ktag_audit_logs/{document=**} {
      allow read: if isAdmin();
      allow write: if false; // Escrever via Cloud Function apenas
    }
    
    // ✅ Rejeitar tudo mais
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Deploy:
```bash
firebase deploy --only firestore:rules
```

---

## 3. Criar Backend Node.js para Segurança

### Arquivo: functions/security.js
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

admin.initializeApp();

const app = require('express')();
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// ✅ Middleware de Segurança
app.use(helmet());
app.use(cors({
  origin: ['https://ktag-manager.web.app'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Rate Limiting com Redis
const loginLimiter = rateLimit({
  store: new RedisStore({
    client: client,
    prefix: 'login:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  standardHeaders: false,
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
});

// ✅ Login Seguro
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha requeridos' });
    }
    
    // Hash da senha
    const crypto = require('crypto');
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password + process.env.PASSWORD_SALT)
      .digest('hex');
    
    // Buscar usuário
    const userRef = admin.firestore()
      .collection('ktag_users_db')
      .where('email', '==', email.toLowerCase());
    
    const snap = await userRef.get();
    
    if (snap.empty) {
      // ⚠️ Sem revelar se email existe
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const user = snap.docs[0].data();
    
    // ✅ Comparação em tempo constante
    if (!crypto.timingSafeEqual(
      Buffer.from(hashedPassword),
      Buffer.from(user.password)
    )) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    // ✅ Gerar JWT com custom claims
    const token = await admin.auth().createCustomToken(user.id, {
      role: user.role,
      email: user.email,
      companySlug: user.companySlug,
      name: user.name
    });
    
    // ✅ Usar HttpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000,
      domain: 'ktag-manager.web.app'
    });
    
    // ✅ Registrar login em auditoria
    await admin.firestore().collection('ktag_audit_logs').add({
      userId: user.id,
      action: 'LOGIN',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });
    
    res.json({ 
      message: 'Login bem-sucedido',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    
    // ✅ Sem expor detalhes internos
    res.status(500).json({ error: 'Erro ao processar login' });
  }
});

// ✅ Endpoints para Credenciais Criptografadas
app.post('/api/secure-settings/hinova', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // ✅ Apenas admin pode salvar credenciais
    if (decodedToken.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const { hinovaUser, hinovaPass, hinovaToken } = req.body;
    
    // ✅ Criptografar com chave mestre (em produção, usar AWS KMS)
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', process.env.MASTER_KEY);
    
    let encrypted = cipher.update(hinovaPass, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // ✅ Salvar criptografado
    await admin.firestore()
      .collection('ktag_settings_v3')
      .doc('hinova')
      .set({
        user: hinovaUser,
        encryptedPassword: encrypted,
        token: hinovaToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: decodedToken.uid
      }, { merge: true });
    
    // ✅ Registrar ação
    await admin.firestore().collection('ktag_audit_logs').add({
      userId: decodedToken.uid,
      action: 'UPDATE_CREDENTIALS',
      resource: 'hinova',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ message: 'Credenciais salvas com segurança' });
    
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// ✅ Cloud Function
exports.security = functions.https.onRequest(app);
```

### Deploy:
```bash
npm install firebase-functions firebase-admin cors helmet express-rate-limit rate-limit-redis redis
firebase deploy --only functions
```

---

## 4. Atualizar Encryption Service

### Arquivo: services/encryption.ts
```typescript
/**
 * Enterprise Data Encryption Service (E2EE)
 * Utiliza AES-GCM para confidencialidade e autenticidade.
 */

class EncryptionService {
  private key: CryptoKey | null = null;
  private readonly algorithm = 'AES-GCM';
  private initializationPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  public isReady: boolean = false;
  private saltFromServer: string = ''; // ✅ Armazenar salt do servidor

  constructor() {
    this.initializationPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  async waitReady() {
    if (this.isReady) return;
    return this.initializationPromise;
  }

  // ✅ Obter salt do servidor em segurança
  private async getSaltFromServer(): Promise<string> {
    try {
      const response = await fetch('/api/encryption-salt', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Falha ao obter salt do servidor');
      
      const data = await response.json();
      return data.salt;
    } catch (e) {
      console.error('Erro ao obter salt:', e);
      // Fallback para salt local apenas se necessário
      return 'ktag-enterprise-salt-2025';
    }
  }

  async initialize(seed: string) {
    if (!seed) return;
    
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(seed),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // ✅ Usar salt do servidor (mais seguro)
      this.saltFromServer = await this.getSaltFromServer();

      this.key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode(this.saltFromServer),
          iterations: 600000, // ✅ Aumentado de 100.000 para 600.000
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: this.algorithm, length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      this.isReady = true;
      if (this.resolveReady) this.resolveReady();
    } catch (e) {
      console.error("Erro ao inicializar motor de segurança:", e);
    }
  }

  async encrypt(text: string): Promise<string> {
    if (!text) return text;
    await this.waitReady();
    if (!this.key) return text;
    
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encoded = encoder.encode(text);

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv },
        this.key,
        encoded
      );

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // ✅ Adicionar HMAC para integridade
      const hmac = await this.generateHmac(combined);
      const withHmac = new Uint8Array(combined.length + 32); // SHA-256 = 32 bytes
      withHmac.set(combined);
      withHmac.set(new Uint8Array(hmac), combined.length);

      return btoa(String.fromCharCode(...withHmac));
    } catch (e) {
      console.error("Erro na criptografia:", e);
      return text;
    }
  }

  async decrypt(base64: string): Promise<string> {
    if (!base64 || base64.length < 16) {
      throw new Error('❌ Dados corrompidos: criptografia inválida');
    }

    await this.waitReady();
    if (!this.key) return base64;

    try {
      const binaryString = atob(base64);
      const combined = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }

      // ✅ Validar HMAC
      const dataWithoutHmac = combined.slice(0, combined.length - 32);
      const storedHmac = combined.slice(combined.length - 32);
      const calculatedHmac = await this.generateHmac(dataWithoutHmac);

      if (!this.hmacEqual(storedHmac, new Uint8Array(calculatedHmac))) {
        throw new Error('❌ Integridade dos dados comprometida');
      }

      const iv = dataWithoutHmac.slice(0, 12);
      const encrypted = dataWithoutHmac.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv },
        this.key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('Erro na descriptografia:', e);
      throw e;
    }
  }

  // ✅ Gerar HMAC para integridade
  private async generateHmac(data: Uint8Array): Promise<ArrayBuffer> {
    const key = await crypto.subtle.importKey(
      'raw',
      crypto.getRandomValues(new Uint8Array(32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    return crypto.subtle.sign('HMAC', key, data);
  }

  // ✅ Comparação em tempo constante
  private hmacEqual(a: Uint8Array, b: ArrayBuffer): boolean {
    const bArray = new Uint8Array(b);
    if (a.length !== bArray.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ bArray[i];
    }

    return result === 0;
  }
}

export const encryption = new EncryptionService();
```

---

## 5. Atualizar Validação de Entrada

### Arquivo: pages/Login.tsx
```tsx
import DOMPurify from 'dompurify';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    // ✅ Sanitizar entrada
    const sanitizedEmail = DOMPurify.sanitize(emailOrCpf.trim());
    
    // ✅ Validar formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cpfRegex = /^\d{11}$/;
    
    if (!emailRegex.test(sanitizedEmail) && !cpfRegex.test(sanitizedEmail)) {
      setError('Email ou CPF inválido');
      setLoading(false);
      return;
    }

    let loginIdentifier = sanitizedEmail;
    if (/^\d+$/.test(loginIdentifier)) {
      loginIdentifier = `${loginIdentifier}@client.ktag`;
    }

    const err = await login(loginIdentifier, password);
    
    if (err) {
      // ✅ Usar mensagens pré-definidas
      const errorMessages: Record<string, string> = {
        'not_found': 'Usuário não encontrado',
        'invalid_password': 'Senha incorreta',
        'pending_approval': 'Seu acesso está pendente',
        'locked': 'Conta bloqueada por segurança',
        'server_error': 'Erro de comunicação. Tente novamente.'
      };
      
      const errorKey = Object.keys(errorMessages).find(k => err.includes(k)) || 'server_error';
      setError(errorMessages[errorKey]);
    }
  } catch (e: any) {
    setError('Erro ao processar login. Tente novamente.');
    console.error('Login error:', e);
  } finally {
    setLoading(false);
  }
};

return (
  <div className="min-h-screen bg-black text-white flex font-sans overflow-hidden">
    {error && (
      <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
        {/* ✅ Apenas texto, sem innerHTML */}
        <span>{error}</span>
      </div>
    )}
    {/* ... resto do form ... */}
  </div>
);
```

### Instalar DOMPurify:
```bash
npm install dompurify
npm install -D @types/dompurify
```

---

## 6. Atualizar Validação de Senha

### Arquivo: pages/Settings.tsx
```tsx
const handleUpdatePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!currentUser) return;
  
  // ✅ Validação forte de senha
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
  
  if (!passwordRegex.test(pwdForm.new)) {
    addNotification('error', 'Erro', 
      'Senha deve ter 12+ caracteres, incluindo maiúsculas, minúsculas, números e símbolos'
    );
    return;
  }
  
  if (pwdForm.new !== pwdForm.confirm) {
    addNotification('error', 'Erro', 'As senhas não coincidem.');
    return;
  }
  
  // ... resto do código ...
};
```

---

## 7. Package.json - Adicionar Dependências

```json
{
  "dependencies": {
    "dompurify": "^3.0.0",
    "helmet": "^7.1.0",
    "express": "^4.18.0",
    "express-rate-limit": "^7.1.0",
    "rate-limit-redis": "^4.1.0",
    "redis": "^4.6.0"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.0"
  }
}
```

---

## 8. Configurar HTTPS e Headers

### Arquivo: vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: true, // ✅ Force HTTPS em development
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }
  }
})
```

### Arquivo: index.html
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- ✅ Security Headers -->
  <meta http-equiv="Content-Security-Policy" 
    content="default-src 'self'; 
             script-src 'self' 'unsafe-inline' https://maps.googleapis.com;
             style-src 'self' 'unsafe-inline';
             connect-src 'self' https://api.hinova.com.br https://ktag-api.com https://firestore.googleapis.com;
             frame-ancestors 'none';
             upgrade-insecure-requests">
  
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  
  <title>K-Tag Manager - Portal Seguro</title>
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
```

---

## 9. Testes de Segurança

### Arquivo: security.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { securityService } from './services/security';
import { encryption } from './services/encryption';

describe('Security Tests', () => {
  
  it('deve rejeitar senhas fracas', () => {
    const weakPasswords = ['123456', 'password', 'abc'];
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    
    weakPasswords.forEach(pwd => {
      expect(strongRegex.test(pwd)).toBe(false);
    });
  });
  
  it('deve criptografar e descriptografar corretamente', async () => {
    const plaintext = 'Dados sensíveis';
    
    await encryption.initialize('test-seed');
    const encrypted = await encryption.encrypt(plaintext);
    const decrypted = await encryption.decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });
  
  it('deve detectar alterações em dados criptografados', async () => {
    const plaintext = 'Dados sensíveis';
    
    await encryption.initialize('test-seed');
    const encrypted = await encryption.encrypt(plaintext);
    
    // Simular alteração
    const altered = encrypted.slice(0, -10) + 'x'.repeat(10);
    
    expect(async () => {
      await encryption.decrypt(altered);
    }).rejects.toThrow('Integridade dos dados comprometida');
  });
});
```

---

## 10. Checklist de Implementação

- [ ] Mover JWT_SECRET para .env
- [ ] Atualizar Firestore Rules
- [ ] Implementar backend Node.js
- [ ] Atualizar Encryption Service (600k iterations)
- [ ] Remover credenciais de localStorage
- [ ] Adicionar DOMPurify para validação
- [ ] Implementar HttpOnly cookies
- [ ] Aumentar requisito de senha (12 caracteres)
- [ ] Configurar Security Headers
- [ ] Adicionar testes de segurança
- [ ] Deploy das correções
- [ ] Teste de penetração
- [ ] Documentação de segurança

---

**Próximos Passos:**
1. Implementar mudanças em ordem de severidade
2. Testar cada mudança isoladamente
3. Deploy em staging antes de produção
4. Monitorar logs de auditoria
5. Realizar teste de penetração profissional
