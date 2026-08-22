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
