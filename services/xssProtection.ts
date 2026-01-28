/**
 * XSS Protection Service
 * Sanitizes user inputs to prevent Cross-Site Scripting attacks
 */

import DOMPurify from 'dompurify';

interface XSSProtection {
  sanitizeHtml: (dirty: string) => string;
  sanitizeText: (text: string) => string;
  sanitizeEmail: (email: string) => string;
  sanitizeUrl: (url: string) => string;
  errorMessages: {
    readonly LOGIN_FAILED: string;
    readonly RATE_LIMIT: string;
    readonly UNAUTHORIZED: string;
    readonly SERVER_ERROR: string;
    readonly VALIDATION_ERROR: string;
    readonly SESSION_EXPIRED: string;
    readonly USER_NOT_FOUND: string;
    readonly PENDING_APPROVAL: string;
    readonly INVALID_PASSWORD: string;
    readonly GENERIC_ERROR: string;
  };
  getSafeErrorMessage: (key: keyof XSSProtection['errorMessages'], fallback?: string) => string;
}

export const xssProtection: XSSProtection = {
  /**
   * Sanitize HTML content to prevent XSS attacks
   * @param dirty - Potentially unsafe HTML string
   * @returns Sanitized HTML string
   */
  sanitizeHtml: (dirty: string): string => {
    if (!dirty) return '';
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false
    });
  },

  /**
   * Sanitize plain text (removes all HTML)
   * @param text - Potentially unsafe text
   * @returns Plain text without HTML
   */
  sanitizeText: (text: string): string => {
    if (!text) return '';
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  },

  /**
   * Validate and sanitize email addresses
   * @param email - Email to validate
   * @returns Sanitized email or empty string if invalid
   */
  sanitizeEmail: (email: string): string => {
    if (!email) return '';
    const sanitized = email.trim().toLowerCase();
    // Basic email regex validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(sanitized) ? sanitized : '';
  },

  /**
   * Sanitize URL to ensure it's safe
   * @param url - URL to sanitize
   * @returns Safe URL or empty string if invalid
   */
  sanitizeUrl: (url: string): string => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.warn('⚠️ Blocked potentially unsafe URL protocol:', parsed.protocol);
        return '';
      }
      return url;
    } catch {
      return '';
    }
  },

  /**
   * Predefined safe error messages (prevents error message injection)
   */
  errorMessages: {
    LOGIN_FAILED: 'E-mail ou senha incorretos. Tente novamente.',
    RATE_LIMIT: 'Muitas tentativas. Por favor, aguarde alguns minutos.',
    UNAUTHORIZED: 'Você não tem permissão para acessar este recurso.',
    SERVER_ERROR: 'Erro ao comunicar com o servidor. Tente novamente.',
    VALIDATION_ERROR: 'Dados inválidos. Verifique os campos e tente novamente.',
    SESSION_EXPIRED: 'Sua sessão expirou. Faça login novamente.',
    USER_NOT_FOUND: 'Usuário não encontrado.',
    PENDING_APPROVAL: 'Seu acesso está pendente de aprovação.',
    INVALID_PASSWORD: 'A senha deve ter no mínimo 12 caracteres.',
    GENERIC_ERROR: 'Ocorreu um erro. Tente novamente.'
  } as const,

  /**
   * Get safe error message by key
   * @param key - Error message key
   * @param fallback - Fallback message if key not found
   * @returns Safe error message
   */
  getSafeErrorMessage: (key: keyof typeof xssProtection.errorMessages, fallback?: string): string => {
    return xssProtection.errorMessages[key] || fallback || xssProtection.errorMessages.GENERIC_ERROR;
  }
};
