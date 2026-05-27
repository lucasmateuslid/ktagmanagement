/**
 * @deprecated Substituído por Firebase Auth (services/firebase.ts +
 * contexts/AuthContext.tsx). Este módulo é mantido como stub vazio para
 * preservar compatibilidade de import; qualquer chamada falha alto.
 *
 * Why: a implementação anterior continha um JWT_SECRET hardcoded no bundle
 * front-end — bypass trivial de autenticação. Removida da árvore de runtime.
 */

import type { User } from '../types';

const FAIL = (op: string): never => {
  throw new Error(`services/jwt.ts está descontinuado (op="${op}"). Use Firebase Auth.`);
};

export const jwtService = {
  sign: async (_user: User): Promise<string> => FAIL('sign'),
  verify: async (_token: string): Promise<User | null> => FAIL('verify'),
  decode: (_token: string): any => FAIL('decode'),
};
