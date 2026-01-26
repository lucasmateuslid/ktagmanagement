import { User } from '../types';

// REMOVIDO: JWT_SECRET e lógica de assinatura.
// O Cliente agora só DECODIFICA tokens recebidos do servidor para exibir na UI.

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

export const jwtService = {
  /**
   * Verifica apenas a expiração e estrutura básica.
   * A validação real da assinatura é feita pelo Backend nas chamadas de API.
   */
  verify: async (token: string): Promise<User | null> => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(base64UrlDecode(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        console.warn('JWT Expired (Client Check)');
        return null;
      }

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
      return null;
    }
  },

  /**
   * A assinatura agora é responsabilidade exclusiva do Cloud Functions.
   * Esta função lança erro se chamada no cliente para garantir que desenvolvedores não a usem.
   */
  sign: async (user: User): Promise<string> => {
    throw new Error("SECURITY_EXCEPTION: Client-side signing is deprecated. Use authLogin cloud function.");
  },

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