import { auth } from './firebase';
import { activeTenant } from './activeTenant';

/** Fetch para APIs privadas: o backend sempre valida token e tenant. */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Autenticação necessária.');
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Tenant-Id', activeTenant.id);
  return fetch(input, { ...init, headers });
}

/** Lê respostas de API sem falhar em operações bem-sucedidas com corpo vazio. */
export async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(response.ok
      ? 'O servidor retornou uma resposta inválida.'
      : `Falha na requisição (HTTP ${response.status}).`);
  }
}
