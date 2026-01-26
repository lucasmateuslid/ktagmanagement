/**
 * Serviço de Segurança K-Tag (Client-Side Interface)
 * 
 * ATENÇÃO: Segredos (Salts, Peppers, Keys) foram movidos para o Backend (Cloud Functions).
 * Este arquivo agora serve apenas para utilitários de interface não-críticos.
 */

export const securityService = {
  /**
   * DEPRECATED no Cliente.
   * O hash agora é feito no Cloud Function 'authLogin' ou 'authRegister'.
   * Mantemos apenas para compatibilidade de tipos se necessário, mas retornando erro.
   */
  hashPassword: async (password: string): Promise<string> => {
    console.warn("Client-side hashing is deprecated. Sending plain password via HTTPS to backend.");
    return password; // Retorna a senha plano para ser enviada via túnel seguro
  },

  verifyPassword: async (inputPassword: string, storedHash: string): Promise<boolean> => {
    throw new Error("SECURITY_EXCEPTION: Password verification must happen on Backend.");
  },

  /**
   * Gera um ID de busca cego. 
   * Idealmente, isso também deveria ser um Cloud Function se o INDEX_SALT for crítico.
   * Para esta versão, assumimos um hash simples sem sal secreto ou migramos para backend depois.
   */
  generateSearchIndex: async (text: string): Promise<string> => {
    if (!text) return '';
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const encoder = new TextEncoder();
    // Usamos um sal público aqui apenas para consistência de formato, não segurança criptográfica
    const data = encoder.encode(cleanText + "PUBLIC_CLIENT_INDEX"); 
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  generateStrongPassword: (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) { // Aumentado para 8
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Ktag-${result}`;
  },

  generateShareLink: (name: string, email: string, password: string) => {
    const message = `Olá ${name}, suas credenciais de acesso ao Portal K-Tag:\n\nLogin: ${email}\nSenha: *${password}*\n\nAcesse: https://ktag-manager.web.app`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
};