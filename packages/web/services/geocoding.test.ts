import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./storage', () => ({ storage: { getSettings: vi.fn().mockResolvedValue({}) } }));
vi.mock('./firebase', () => ({ auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('test-token') } } }));
vi.mock('./activeTenant', () => ({ activeTenant: { id: 'tenant-a', isReady: () => true } }));

describe('endereços do LiveMap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('envia autenticação e tenant exigidos pela API de endereço', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { address: 'Rua correta' } })));
    vi.stubGlobal('fetch', fetcher);
    const { geocodingService } = await import('./geocoding');
    expect(await geocodingService.reverseGeocode(-8, -35)).toBe('Rua correta');
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/reverse-geocode');
    expect(init.headers.get('Authorization')).toBe('Bearer test-token');
    expect(init.headers.get('X-Tenant-Id')).toBe('tenant-a');
    expect(JSON.parse(init.body)).toMatchObject({ lat: -8, lng: -35 });
  });

  it('não compartilha o endereço de pontos próximos que colidiam no cache', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { address: 'Rua A' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { address: 'Rua B' } })));
    vi.stubGlobal('fetch', fetcher);
    const { geocodingService } = await import('./geocoding');
    expect(await geocodingService.reverseGeocode(-8.00001, -35)).toBe('Rua A');
    expect(await geocodingService.reverseGeocode(-8.00004, -35)).toBe('Rua B');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
