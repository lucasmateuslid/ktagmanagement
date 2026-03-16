
/**
 * Serviço de Proteção e Sanitização K-Tag
 * Garante que inputs de usuários não contenham scripts maliciosos.
 */

export const xssProtection = {
  /**
   * Remove tags HTML básicas para prevenir injeção.
   */
  sanitizeText: (text: string): string => {
    if (!text) return '';
    // Remove tags < e > para neutralizar scripts
    return text.replace(/[<>]/g, '').trim();
  },

  /**
   * Retorna uma mensagem de erro amigável e segura.
   */
  getSafeErrorMessage: (code: string): string => {
    const messages: Record<string, string> = {
      'SERVER_ERROR': 'Falha na comunicação com o servidor central.',
      'AUTH_FAILED': 'E-mail ou senha incorretos.',
      'RATE_LIMIT': 'Muitas tentativas. Aguarde alguns minutos.',
      'PENDING_APPROVAL': 'Seu acesso ainda não foi aprovado pela administração.'
    };
    return messages[code] || 'Ocorreu um erro inesperado de segurança.';
  }
};
