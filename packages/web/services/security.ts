
/**
 * Serviço de Segurança K-Tag — hashing determinístico para blind index + geração
 * de senhas temporárias usando CSPRNG.
 *
 * IMPORTANTE: `hashPassword` / `verifyPassword` são considerados LEGACY.
 * Autenticação de usuários é responsabilidade do Firebase Auth (services/firebase.ts).
 * SHA-256 puro não é apropriado para senhas — funciona como blind index, não
 * como mecanismo de armazenamento. Mantemos a função apenas para callers
 * existentes (Technicians) que comparam um valor fixo já legado.
 */

// INDEX_SALT é um pepper compartilhado para gerar blind indexes de campos
// pesquisáveis (placa, CPF). Não substitui criptografia do campo; serve só
// para checar unicidade sem expor o dado em claro.
const INDEX_SALT = 'KTAG_BLIND_INDEX_KEY_X9';

// Pepper de hashPassword (legacy). NÃO usar para novos fluxos.
const LEGACY_PASSWORD_SALT = 'KTAG_SECURE_SALT_V3_2025';

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

export const securityService = {
  /** @deprecated Use Firebase Auth para autenticação. Mantido só para legacy compare. */
  hashPassword: async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + LEGACY_PASSWORD_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return toHex(hashBuffer);
  },

  /** @deprecated Use Firebase Auth para autenticação. */
  verifyPassword: async (inputPassword: string, storedHash: string): Promise<boolean> => {
    const inputHash = await securityService.hashPassword(inputPassword);
    // Comparação simples: ambos hex de mesmo tamanho. Risco de timing attack
    // existe mas é mitigado pelo Firebase Auth no caminho real de login.
    return inputHash === storedHash;
  },

  /**
   * Gera um hash determinístico para campos pesquisáveis (Blind Index).
   * Usado para verificar unicidade de Placa e CPF sem revelar o dado real no banco.
   */
  generateSearchIndex: async (text: string): Promise<string> => {
    if (!text) return '';
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const encoder = new TextEncoder();
    const data = encoder.encode(cleanText + INDEX_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return toHex(hashBuffer);
  },

  /**
   * Gera uma senha temporária forte usando CSPRNG (crypto.getRandomValues).
   * Math.random() é previsível e foi removido deste path.
   */
  generateStrongPassword: (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(8);
    crypto.getRandomValues(buf);
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(buf[i] % chars.length);
    }
    return `Ktag-${result}`;
  },

  /**
   * Gera link de compartilhamento (WhatsApp) com a senha temporária.
   *
   * Tradeoff: senhas temporárias em mensagem clara são um risco se o canal
   * estiver comprometido. Mitigação: senha é one-shot e o admin deve orientar
   * troca imediata após primeiro login.
   */
  generateShareLink: (name: string, email: string, password: string) => {
    const message = `Olá ${name}, suas credenciais de acesso ao Portal K-Tag foram geradas/resetadas.\n\nLink: https://ktag-manager.web.app\nLogin: ${email}\nSenha Temporária: *${password}*\n\nPor favor, altere sua senha após o primeiro acesso.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
};
