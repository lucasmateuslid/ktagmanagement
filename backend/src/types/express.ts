import type { SessionUserPayload } from '../services/sessionToken.js';

declare module 'express-serve-static-core' {
  interface Request {
    authSession?: SessionUserPayload;
  }
}

export {};
