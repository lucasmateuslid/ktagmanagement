import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionUserPayload {
  sub: string;
  email: string;
  role?: string;
  status?: string;
  name?: string;
  companySlug?: string;
  iat: number;
  exp: number;
}

const base64UrlEncode = (input: string | Buffer) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const base64UrlDecode = (input: string) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return Buffer.from(base64 + padding, 'base64').toString('utf8');
};

const signData = (data: string, secret: string) =>
  createHmac('sha256', secret).update(data).digest();

export const sessionTokenService = {
  sign(payload: Omit<SessionUserPayload, 'iat' | 'exp'>, secret: string, expiresInSeconds = 12 * 60 * 60) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const fullPayload: SessionUserPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = base64UrlEncode(signData(data, secret));

    return `${data}.${signature}`;
  },

  verify(token: string, secret: string): SessionUserPayload | null {
    try {
      const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
      if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

      const data = `${encodedHeader}.${encodedPayload}`;
      const expected = signData(data, secret);
      const incoming = Buffer.from(
        encodedSignature.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedSignature.length / 4) * 4, '='),
        'base64'
      );

      if (expected.length !== incoming.length || !timingSafeEqual(expected, incoming)) {
        return null;
      }

      const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionUserPayload;
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
};
