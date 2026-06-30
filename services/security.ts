
/**
 * Serviço de Segurança K-Tag
 * Responsável por Hashing (SHA-256), Verificação e Geração de Senhas.
 */

const SALT = 'KTAG_SECURE_SALT_V3_2025'; // Pepper global para senhas
const INDEX_SALT = 'KTAG_BLIND_INDEX_KEY_X9'; // Pepper específico para índices de busca (Placa, CPF)

export const securityService = {
  /**
   * Gera um hash SHA-256 da senha.
   * @param password Senha em texto plano
   */
  hashPassword: async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  /**
   * Verifica se a senha corresponde ao hash armazenado.
   */
  verifyPassword: async (inputPassword: string, storedHash: string): Promise<boolean> => {
    const inputHash = await securityService.hashPassword(inputPassword);
    return inputHash === storedHash;
  },

  /**
   * Gera um hash determinístico para campos pesquisáveis (Blind Index).
   * Usado para verificar unicidade de Placa e CPF sem revelar o dado real no banco.
   */
  generateSearchIndex: async (text: string): Promise<string> => {
    if (!text) return '';
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Normaliza antes do hash
    const encoder = new TextEncoder();
    const data = encoder.encode(cleanText + INDEX_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Gera uma senha aleatória forte e legível.
   * Ex: KTag-8392, Secure-9123
   */
  generateStrongPassword: (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Remove caracteres confusos como I, 1, 0, O
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Ktag-${result}`;
  },

  /**
   * Gera link de compartilhamento seguro (WhatsApp).
   */
  generateShareLink: (name: string, email: string, password: string) => {
    const message = `Olá ${name}, suas credenciais de acesso ao Portal K-Tag foram geradas/resetadas.\n\nLink: https://ktag-manager.web.app\nLogin: ${email}\nSenha Temporária: *${password}*\n\nPor favor, altere sua senha após o primeiro acesso.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
};
