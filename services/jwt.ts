
import { User } from '../types';

// JWT Secret from environment variables (secure)
const JWT_SECRET = (import.meta as any).env?.VITE_JWT_SECRET || (() => {
  console.error('⚠️ SECURITY WARNING: VITE_JWT_SECRET not found in environment!');
  throw new Error('JWT_SECRET must be configured in .env.local');
})();

function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export const jwtService = {
  /**
   * Gera um token JWT assinado (HS256)
   * Expira em 12 horas por padrão
   */
  sign: async (user: User): Promise<string> => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    // Remove dados sensíveis do payload se houver, mantém apenas o necessário para sessão
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      companySlug: user.companySlug,
      avatarInitial: user.avatarInitial,
      iat: now,
      exp: now + (12 * 60 * 60) // 12 horas
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await importKey(JWT_SECRET);
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(data)
    );

    const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
    return `${data}.${encodedSignature}`;
  },

  /**
   * Verifica a validade e assinatura do token
   */
  verify: async (token: string): Promise<User | null> => {
    try {
      const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
      if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

      const data = `${encodedHeader}.${encodedPayload}`;
      const signature = new Uint8Array(
        atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map(c => c.charCodeAt(0))
      );

      const key = await importKey(JWT_SECRET);
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        new TextEncoder().encode(data)
      );

      if (!isValid) return null;

      const payload = JSON.parse(base64UrlDecode(encodedPayload));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        console.warn('JWT Expired');
        return null;
      }

      // Reconstrói o objeto User parcial a partir do token
      return {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        companySlug: payload.companySlug,
        avatarInitial: payload.avatarInitial
      } as User;

    } catch (e) {
      console.error('JWT Verification Error:', e);
      return null;
    }
  },

  /**
   * Apenas decodifica o payload sem verificar assinatura (uso rápido na UI se necessário)
   */
  decode: (token: string): any => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(base64UrlDecode(parts[1]));
    } catch (e) {
      return null;
    }
  }
};
