
/**
 * Serviço de Rate Limiting Client-Side
 * Utiliza LocalStorage para persistir tentativas e bloquear ações repetitivas.
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

const STORAGE_KEY = 'ktag_rate_limits';

export const rateLimitService = {
  /**
   * Verifica se uma ação pode ser executada.
   * @param key Identificador único da ação (ex: 'login_attempt', 'api_search')
   * @param limit Máximo de tentativas permitidas
   * @param windowSeconds Janela de tempo em segundos
   * @returns { allowed: boolean, waitTime?: number }
   */
  check: (key: string, limit: number, windowSeconds: number): { allowed: boolean; waitTime?: number } => {
    try {
      const storage = localStorage.getItem(STORAGE_KEY);
      const data: Record<string, RateLimitEntry> = storage ? JSON.parse(storage) : {};
      const now = Date.now();
      const entry = data[key];

      if (!entry) {
        return { allowed: true };
      }

      const windowMs = windowSeconds * 1000;
      const timePassed = now - entry.firstAttempt;

      // Se a janela de tempo passou, reseta
      if (timePassed > windowMs) {
        delete data[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { allowed: true };
      }

      // Se excedeu o limite
      if (entry.count >= limit) {
        const waitTime = Math.ceil((windowMs - timePassed) / 1000);
        return { allowed: false, waitTime };
      }

      return { allowed: true };
    } catch (e) {
      // Em caso de erro no storage (ex: quota exceeded), permite a ação para não travar o app
      return { allowed: true };
    }
  },

  /**
   * Registra uma tentativa falha ou execução de ação.
   */
  record: (key: string) => {
    try {
      const storage = localStorage.getItem(STORAGE_KEY);
      const data: Record<string, RateLimitEntry> = storage ? JSON.parse(storage) : {};
      const now = Date.now();

      if (!data[key]) {
        data[key] = { count: 1, firstAttempt: now };
      } else {
        data[key].count += 1;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("RateLimit storage error");
    }
  },

  /**
   * Limpa o contador (ex: após login com sucesso)
   */
  clear: (key: string) => {
    try {
      const storage = localStorage.getItem(STORAGE_KEY);
      if (storage) {
        const data = JSON.parse(storage);
        delete data[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {}
  }
};
