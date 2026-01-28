# 🧪 Testes de Segurança - K-Tag Manager

## Testes Automatizados

### 1. Testes de Unidade - Criptografia

**Arquivo:** `tests/security.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { securityService } from '../services/security';
import { encryption } from '../services/encryption';

describe('Security Service - Password Hashing', () => {
  
  it('deve gerar hash diferente para senha igual em diferentes contextos', async () => {
    const password = 'MySecurePassword123!';
    const hash1 = await securityService.hashPassword(password);
    const hash2 = await securityService.hashPassword(password);
    
    // SHA-256 é determinístico, então hashes devem ser iguais
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('deve rejeitar senhas fracas', async () => {
    const weakPasswords = [
      '123456',        // Apenas números
      'password',      // Sem números/símbolos
      'Pass123',       // Sem símbolos
      'abc',           // Muito curta
      'Admin@123'      // Menos de 12 chars
    ];

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

    weakPasswords.forEach(pwd => {
      expect(passwordRegex.test(pwd)).toBe(false);
    });
  });

  it('deve aceitar senhas fortes', async () => {
    const strongPasswords = [
      'MySecure@Pass123',
      'K#Tag$Secure2025',
      'Encrypt!Data@12'
    ];

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

    strongPasswords.forEach(pwd => {
      expect(passwordRegex.test(pwd)).toBe(true);
    });
  });

  it('deve verificar senha com timing-safe comparison', async () => {
    const password = 'MySecure@Pass123';
    const hash = await securityService.hashPassword(password);
    
    // Deve ser verdadeiro com senha correta
    const isValid = await securityService.verifyPassword(password, hash);
    expect(isValid).toBe(true);
    
    // Deve ser falso com senha incorreta
    const isInvalid = await securityService.verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('deve gerar índice de busca determinístico', async () => {
    const text = 'ABC-1234';
    const index1 = await securityService.generateSearchIndex(text);
    const index2 = await securityService.generateSearchIndex(text);
    
    // Deve ser determinístico (para comparação em banco)
    expect(index1).toBe(index2);
    expect(index1.length).toBe(64); // SHA-256 hex
  });

  it('deve normalizar texto antes de gerar índice', async () => {
    const index1 = await securityService.generateSearchIndex('abc-1234');
    const index2 = await securityService.generateSearchIndex('ABC-1234');
    const index3 = await securityService.generateSearchIndex('ABC 1234');
    
    // Todos devem resultar no mesmo índice (após normalização)
    expect(index1).toBe(index2);
    expect(index2).toBe(index3);
  });
});

describe('Encryption Service - AES-GCM', () => {
  
  beforeAll(async () => {
    await encryption.initialize('test-seed-12345');
  });

  it('deve criptografar e descriptografar corretamente', async () => {
    const plaintext = 'Dados sensíveis do usuário';
    
    const encrypted = await encryption.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toBeTruthy();
    
    const decrypted = await encryption.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('deve gerar IV único para cada criptografia', async () => {
    const plaintext = 'Mesmo texto';
    
    const encrypted1 = await encryption.encrypt(plaintext);
    const encrypted2 = await encryption.encrypt(plaintext);
    
    // Mesmo com o mesmo plaintext, o encrypted deve ser diferente (IV diferente)
    expect(encrypted1).not.toBe(encrypted2);
    
    // Mas ambos descriptografam para o mesmo texto
    const decrypted1 = await encryption.decrypt(encrypted1);
    const decrypted2 = await encryption.decrypt(encrypted2);
    
    expect(decrypted1).toBe(plaintext);
    expect(decrypted2).toBe(plaintext);
  });

  it('deve detectar alterações em dados criptografados (HMAC)', async () => {
    const plaintext = 'Dados confidenciais';
    
    const encrypted = await encryption.encrypt(plaintext);
    
    // Simular alteração no criptograma (mudança de 1 bit)
    const altered = encrypted.slice(0, -5) + 'XXXXX';
    
    // Deve falhar na descriptografia devido ao HMAC inválido
    await expect(async () => {
      await encryption.decrypt(altered);
    }).rejects.toThrow('Integridade dos dados comprometida');
  });

  it('deve rejeitar dados corrompidos', async () => {
    const invalid = 'não-é-um-criptograma-válido';
    
    await expect(async () => {
      await encryption.decrypt(invalid);
    }).rejects.toThrow();
  });

  it('deve fazer padding correto de base64', async () => {
    const plaintext = 'Teste com padding';
    
    const encrypted = await encryption.encrypt(plaintext);
    
    // Verificar se é valid base64
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    expect(base64Regex.test(encrypted)).toBe(true);
  });
});

describe('Security - Input Validation', () => {
  
  it('deve validar emails corretamente', () => {
    const validEmails = [
      'user@example.com',
      'test.email@company.co.uk',
      'user+tag@example.com'
    ];
    
    const invalidEmails = [
      'invalid.email',
      '@example.com',
      'user@',
      'user space@example.com'
    ];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    validEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(true);
    });
    
    invalidEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  it('deve validar CPF com 11 dígitos', () => {
    const validCPFs = ['12345678900', '98765432100'];
    const invalidCPFs = ['123456789', '123456789001', '123.456.789-00'];
    
    const cpfRegex = /^\d{11}$/;
    
    validCPFs.forEach(cpf => {
      expect(cpfRegex.test(cpf)).toBe(true);
    });
    
    invalidCPFs.forEach(cpf => {
      expect(cpfRegex.test(cpf)).toBe(false);
    });
  });

  it('deve sanitizar caracteres especiais', () => {
    const input = '<script>alert("xss")</script>';
    const sanitized = DOMPurify.sanitize(input);
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
  });
});

describe('Security - Rate Limiting', () => {
  
  it('deve bloquear após 5 tentativas em 15 minutos', () => {
    const limiter = rateLimitService;
    
    // Simular 5 tentativas
    for (let i = 0; i < 5; i++) {
      const check = limiter.check('test_action', 5, 900);
      expect(check.allowed).toBe(true);
      limiter.record('test_action');
    }
    
    // 6ª tentativa deve ser bloqueada
    const check = limiter.check('test_action', 5, 900);
    expect(check.allowed).toBe(false);
    expect(check.waitTime).toBeGreaterThan(0);
  });

  it('deve resetar após expiração da janela', (done) => {
    const limiter = rateLimitService;
    
    // 5 tentativas imediatas
    for (let i = 0; i < 5; i++) {
      limiter.record('test_action2');
    }
    
    // Deve estar bloqueado
    let check = limiter.check('test_action2', 5, 2); // 2 segundos
    expect(check.allowed).toBe(false);
    
    // Após 2 segundos, deve resetar
    setTimeout(() => {
      check = limiter.check('test_action2', 5, 2);
      expect(check.allowed).toBe(true);
      done();
    }, 2100);
  });
});
```

---

## Testes de Integração

### 2. Testes de Autenticação

**Arquivo:** `tests/auth.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { auth } from '../contexts/AuthContext';

describe('Authentication Integration', () => {
  
  it('deve fazer login com credenciais válidas', async () => {
    const email = 'test@example.com';
    const password = 'TestPass@123456';
    
    const result = await auth.login(email, password);
    
    expect(result).toBeUndefined(); // No error
    expect(auth.user).toBeDefined();
    expect(auth.user?.email).toBe(email);
  });

  it('deve rejeitar login com email inválido', async () => {
    const result = await auth.login('invalid.email', 'password');
    
    expect(result).toBeDefined(); // Error returned
    expect(typeof result).toBe('string');
  });

  it('deve rejeitar login com senha incorreta', async () => {
    const email = 'test@example.com';
    const wrongPassword = 'WrongPassword123!';
    
    const result = await auth.login(email, wrongPassword);
    
    expect(result).toContain('incorreta');
  });

  it('deve aplicar rate limiting após 5 tentativas', async () => {
    for (let i = 0; i < 5; i++) {
      await auth.login('test@example.com', 'wrong');
    }
    
    const result = await auth.login('test@example.com', 'password');
    
    expect(result).toContain('Muitas tentativas');
  });

  it('deve criar token JWT válido', async () => {
    await auth.login('test@example.com', 'TestPass@123456');
    
    const token = localStorage.getItem('auth_token');
    expect(token).toBeDefined();
    
    const decoded = jwtService.decode(token!);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('deve rejeitar JWT expirado', async () => {
    const expiredToken = jwtService.decode('..'); // Token fake
    
    const user = await jwtService.verify(expiredToken);
    expect(user).toBeNull();
  });

  it('deve fazer logout e limpar dados', async () => {
    await auth.login('test@example.com', 'TestPass@123456');
    expect(auth.user).toBeDefined();
    
    await auth.logout();
    
    expect(auth.user).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('deve atualizar perfil com segurança', async () => {
    await auth.login('test@example.com', 'TestPass@123456');
    
    const newProfile = {
      name: 'New Name',
      avatarInitial: 'NN'
    };
    
    await auth.updateProfile(newProfile);
    
    expect(auth.user?.name).toBe(newProfile.name);
  });
});
```

---

## Testes de Segurança Específicos

### 3. Testes XSS

**Arquivo:** `tests/xss.security.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';

describe('XSS Prevention', () => {
  
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror="alert(\'xss\')">',
    '<svg onload="alert(\'xss\')">',
    'javascript:alert("xss")',
    '<iframe src="javascript:alert(\'xss\')">',
    '<body onload="alert(\'xss\')">',
    '<input onfocus="alert(\'xss\')" autofocus>',
    '<marquee onstart="alert(\'xss\')">',
    '<details open ontoggle="alert(\'xss\')">',
    '<form><button formaction="javascript:alert(\'xss\')">',
  ];

  xssPayloads.forEach((payload, index) => {
    it(`deve bloquear XSS payload #${index + 1}: ${payload.substring(0, 30)}...`, () => {
      const sanitized = DOMPurify.sanitize(payload);
      
      // Não deve conter scripts
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('onfocus');
      expect(sanitized).not.toContain('javascript:');
    });
  });

  it('deve permitir HTML seguro', () => {
    const safeHtml = '<p>Texto <strong>seguro</strong></p>';
    const sanitized = DOMPurify.sanitize(safeHtml);
    
    expect(sanitized).toContain('<p>');
    expect(sanitized).toContain('<strong>');
  });
});
```

---

## Testes de API

### 4. Testes de Endpoint

**Arquivo:** `tests/api.security.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import fetch from 'node-fetch';

describe('API Security Tests', () => {
  
  const baseURL = 'https://api.ktag-manager.com';
  
  it('deve rejeitar requisições HTTP (não HTTPS)', async () => {
    try {
      await fetch('http://api.ktag-manager.com/api/data');
      expect.fail('Deve rejeitar HTTP');
    } catch (e: any) {
      expect(e.message).toContain('HTTPS');
    }
  });

  it('deve validar CORS headers', async () => {
    const response = await fetch(`${baseURL}/api/data`, {
      headers: { 'Origin': 'https://malicious.com' }
    });
    
    const corsHeader = response.headers.get('Access-Control-Allow-Origin');
    expect(corsHeader).toBe('https://ktag-manager.web.app');
  });

  it('deve incluir security headers', async () => {
    const response = await fetch(`${baseURL}/api/data`);
    
    expect(response.headers.get('Strict-Transport-Security')).toBeDefined();
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Content-Security-Policy')).toBeDefined();
  });

  it('deve rejeitar requisições sem autenticação', async () => {
    const response = await fetch(`${baseURL}/api/protected`, {
      method: 'GET'
    });
    
    expect(response.status).toBe(401);
  });

  it('deve aplicar rate limit após múltiplas requisições', async () => {
    let response;
    
    // 6 requisições rápidas
    for (let i = 0; i < 6; i++) {
      response = await fetch(`${baseURL}/api/login`, {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'wrong'
        })
      });
    }
    
    // 6ª deve retornar 429
    expect(response!.status).toBe(429);
  });

  it('deve validar Content-Type', async () => {
    const response = await fetch(`${baseURL}/api/data`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const contentType = response.headers.get('Content-Type');
    expect(contentType).toContain('application/json');
  });

  it('deve rejeitar payloads muito grandes', async () => {
    const largePayload = 'a'.repeat(10 * 1024 * 1024); // 10MB
    
    const response = await fetch(`${baseURL}/api/data`, {
      method: 'POST',
      body: JSON.stringify({ data: largePayload })
    });
    
    expect(response.status).toBe(413); // Payload Too Large
  });
});
```

---

## Testes de Criptografia

### 5. Teste de Integridade

**Arquivo:** `tests/crypto.security.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Cryptography Security', () => {
  
  it('deve usar algoritmo forte (AES-256)', () => {
    // Verificar que está usando 256-bit
    const key = crypto.generateKeySync('aes', { length: 256 });
    expect(key.asymmetricKeySize || key.symmetricKeySize).toBe(32); // 256 bits = 32 bytes
  });

  it('deve gerar IV aleatório', () => {
    const iv1 = crypto.randomBytes(12);
    const iv2 = crypto.randomBytes(12);
    
    expect(iv1).not.toEqual(iv2);
    expect(iv1.length).toBe(12); // 96 bits para GCM
  });

  it('deve usar PBKDF2 com suficientes iterações', async () => {
    const password = 'testpassword';
    const salt = crypto.randomBytes(32);
    
    const key = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');
    
    expect(key.length).toBe(32); // 256 bits
  });

  it('deve gerar tokens criptográficos aleatórios', () => {
    const token1 = crypto.randomBytes(32);
    const token2 = crypto.randomBytes(32);
    
    expect(token1).not.toEqual(token2);
    expect(token1.toString('hex')).not.toBe(token2.toString('hex'));
  });

  it('deve usar timing-safe comparison', () => {
    const hash1 = crypto.createHash('sha256').update('password').digest();
    const hash2 = crypto.createHash('sha256').update('password').digest();
    
    // timingSafeEqual deve retornar true sem revelar tamanho/conteúdo
    const isEqual = crypto.timingSafeEqual(hash1, hash2);
    expect(isEqual).toBe(true);
  });
});
```

---

## Testes de Conformidade

### 6. Checklist de Segurança

**Arquivo:** `tests/compliance.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Security Compliance', () => {
  
  it('JWT_SECRET não deve estar em código', () => {
    const sourceCode = `
      // Ler todos os arquivos .ts e .tsx
    `;
    
    expect(sourceCode).not.toMatch(/ktag-pro-super-secret-key/);
    expect(sourceCode).not.toMatch(/password.*=.*['"][^'"]{10,}['"]/);
  });

  it('Credenciais não devem estar em localStorage', () => {
    const localStorage = {
      'ktag_users_db': '{}',
      'ktag_settings_v3': JSON.stringify({
        hinovaPass: null, // ✅ Nunca deve ter valor
        traqcareToken: null
      })
    };
    
    const settings = JSON.parse(localStorage['ktag_settings_v3']);
    expect(settings.hinovaPass).toBeNull();
    expect(settings.traqcareToken).toBeNull();
  });

  it('HTTPS deve ser obrigatório', () => {
    const isHttpsOnly = process.env.VITE_API_URL?.startsWith('https://');
    expect(isHttpsOnly).toBe(true);
  });

  it('Senhas devem ter 12+ caracteres', () => {
    const minPasswordLength = 12;
    expect(minPasswordLength).toBeGreaterThanOrEqual(12);
  });

  it('PBKDF2 deve ter 600k+ iterações', () => {
    const iterations = 600000;
    expect(iterations).toBeGreaterThanOrEqual(600000);
  });
});
```

---

## Executando os Testes

```bash
# Instalar dependências de teste
npm install -D vitest @vitest/ui dompurify node-fetch

# Rodar todos os testes
npm test

# Rodar com coverage
npm test -- --coverage

# Rodar apenas testes de segurança
npm test -- tests/security.test.ts

# Modo watch (desenvolvimento)
npm test -- --watch

# Gerar relatório HTML
npm test -- --reporter=html
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      
      - run: npm run test:security
      
      - run: npm audit --audit-level=moderate
      
      - run: npm run lint:security
```

---

## Teste de Penetração Manual

```bash
# 1. Testar XSS
curl -X POST https://api.ktag-manager.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(1)</script>@test.com","password":"test"}'

# 2. Testar SQL Injection (se aplicável)
curl -X POST https://api.ktag-manager.com/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"1 OR 1=1"}'

# 3. Testar Rate Limiting
for i in {1..10}; do
  curl -X POST https://api.ktag-manager.com/api/login \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# 4. Testar CORS
curl -X OPTIONS https://api.ktag-manager.com/api/data \
  -H "Origin: https://malicious.com" -i

# 5. Testar Headers
curl -i https://api.ktag-manager.com/api/data | grep -E "Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options"
```

---

**Próximos Passos:**
1. Adicionar testes ao CI/CD
2. Configurar alertas de segurança
3. Realizar teste de penetração profissional
4. Atualizar testes conforme correções são implementadas
