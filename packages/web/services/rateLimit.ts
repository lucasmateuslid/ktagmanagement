/**
 * Serviço de Rate Limiting Client-Side
 *
 * Dois modos:
 *  - check/record/clear (flat): janela fixa, N tentativas — usado para
 *    endpoints comuns (busca, API rate, etc).
 *  - checkProgressive/recordFailProgressive (escalado): 4 falhas → bloqueio,
 *    com escala progressiva 30→60→120→240→480→960s. Cada bloqueio expira;
 *    se o usuário falhar de novo, o próximo bloqueio é o stage seguinte
 *    (até o último, onde fica preso em 960s até sucesso). Sucesso → clear().
 *    Usado em login para frustrar brute-force sem castigar usuário legítimo.
 *
 * Persistência em LocalStorage (por navegador). Não substitui rate limit
 * server-side — é defesa em profundidade só pro lado do cliente.
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

interface ProgressiveEntry {
  stage: number;          // 0-based; aponta para o próximo bloqueio a aplicar
  failsInStage: number;   // falhas acumuladas no stage corrente
  blockedUntil?: number;  // epoch ms; se >now, está em bloqueio
}

const STORAGE_KEY = 'ktag_rate_limits';
const PROGRESSIVE_STORAGE_KEY = 'ktag_rate_limits_progressive';

// Escala canônica de bloqueio para login. Em segundos.
export const LOGIN_BACKOFF_STAGES_SEC = [30, 60, 120, 240, 480, 960];
export const LOGIN_ATTEMPTS_PER_STAGE = 4;

function readProgressive(): Record<string, ProgressiveEntry> {
  try {
    const raw = localStorage.getItem(PROGRESSIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeProgressive(data: Record<string, ProgressiveEntry>) {
  try { localStorage.setItem(PROGRESSIVE_STORAGE_KEY, JSON.stringify(data)); }
  catch { /* quota / disabled */ }
}

export const rateLimitService = {
  /**
   * Verifica se uma ação pode ser executada (janela fixa).
   */
  check: (key: string, limit: number, windowSeconds: number): { allowed: boolean; waitTime?: number } => {
    try {
      const storage = localStorage.getItem(STORAGE_KEY);
      const data: Record<string, RateLimitEntry> = storage ? JSON.parse(storage) : {};
      const now = Date.now();
      const entry = data[key];

      if (!entry) return { allowed: true };

      const windowMs = windowSeconds * 1000;
      const timePassed = now - entry.firstAttempt;

      if (timePassed > windowMs) {
        delete data[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { allowed: true };
      }

      if (entry.count >= limit) {
        const waitTime = Math.ceil((windowMs - timePassed) / 1000);
        return { allowed: false, waitTime };
      }

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  },

  record: (key: string) => {
    try {
      const storage = localStorage.getItem(STORAGE_KEY);
      const data: Record<string, RateLimitEntry> = storage ? JSON.parse(storage) : {};
      const now = Date.now();

      if (!data[key]) data[key] = { count: 1, firstAttempt: now };
      else data[key].count += 1;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      console.warn('RateLimit storage error');
    }
  },

  clear: (key: string) => {
    try {
      const storage = localStorage.getItem(STORAGE_KEY);
      if (storage) {
        const data = JSON.parse(storage);
        delete data[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      // Também limpa o estado progressivo (usado após sucesso).
      const prog = readProgressive();
      if (prog[key]) {
        delete prog[key];
        writeProgressive(prog);
      }
    } catch { /* noop */ }
  },

  /**
   * Verifica se a ação pode ser executada (modo progressivo).
   * Retorna metadados úteis pra UI mostrar contagem regressiva e tentativas
   * restantes antes do próximo bloqueio.
   */
  checkProgressive: (
    key: string,
    stagesSec: number[] = LOGIN_BACKOFF_STAGES_SEC,
    attemptsPerStage: number = LOGIN_ATTEMPTS_PER_STAGE
  ): {
    allowed: boolean;
    waitTime?: number;
    remainingAttempts?: number;
    stage?: number;
  } => {
    try {
      const data = readProgressive();
      const now = Date.now();
      const entry = data[key];

      if (!entry) return { allowed: true, remainingAttempts: attemptsPerStage, stage: 0 };

      if (entry.blockedUntil && entry.blockedUntil > now) {
        return {
          allowed: false,
          waitTime: Math.ceil((entry.blockedUntil - now) / 1000),
          stage: entry.stage,
        };
      }

      // Se o bloqueio expirou, mantemos o stage avançado mas zeramos o
      // contador — o usuário agora tem mais um lote de tentativas antes
      // do próximo bloqueio (mais longo).
      if (entry.blockedUntil && entry.blockedUntil <= now) {
        entry.blockedUntil = undefined;
        entry.failsInStage = 0;
        data[key] = entry;
        writeProgressive(data);
      }

      return {
        allowed: true,
        remainingAttempts: Math.max(0, attemptsPerStage - entry.failsInStage),
        stage: entry.stage,
      };
    } catch {
      return { allowed: true };
    }
  },

  /**
   * Registra uma tentativa falha no modo progressivo. Se atingir o limite
   * do stage atual, dispara o bloqueio e avança o stage (capado no último).
   */
  recordFailProgressive: (
    key: string,
    stagesSec: number[] = LOGIN_BACKOFF_STAGES_SEC,
    attemptsPerStage: number = LOGIN_ATTEMPTS_PER_STAGE
  ): { blocked: boolean; waitTime?: number; stage: number } => {
    try {
      const data = readProgressive();
      const now = Date.now();
      const entry: ProgressiveEntry = data[key] || { stage: 0, failsInStage: 0 };

      entry.failsInStage += 1;

      if (entry.failsInStage >= attemptsPerStage) {
        const stageIdx = Math.min(entry.stage, stagesSec.length - 1);
        const blockSec = stagesSec[stageIdx];
        entry.blockedUntil = now + blockSec * 1000;
        entry.failsInStage = 0;
        entry.stage = Math.min(entry.stage + 1, stagesSec.length - 1);

        data[key] = entry;
        writeProgressive(data);
        return { blocked: true, waitTime: blockSec, stage: stageIdx };
      }

      data[key] = entry;
      writeProgressive(data);
      return { blocked: false, stage: entry.stage };
    } catch {
      return { blocked: false, stage: 0 };
    }
  },
};
