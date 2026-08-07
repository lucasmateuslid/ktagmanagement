import type { AddressResolution, TraccarPosition } from '@ktag/shared';
import { getTraccarConfig } from '../config/traccar.js';
import { traccarClient } from './traccarClient.js';

type CacheValue = { expiresAt: number; result: AddressResolution };
export class AddressResolver {
  private cache = new Map<string, CacheValue>();
  constructor(private fallback?: (lat: number, lng: number) => Promise<string | null>) {}
  setFallback(provider: (lat: number, lng: number) => Promise<string | null>) { this.fallback = provider; }
  private key(deviceId: number, lat: number, lng: number) { return `${deviceId}:${lat.toFixed(4)}:${lng.toFixed(4)}`; }
  async resolve(position: TraccarPosition, force = false): Promise<AddressResolution> {
    if (position.address?.trim()) return { address: position.address.trim(), status: 'resolved', provider: 'existing', attempts: 0 };
    const key = this.key(position.deviceId, position.latitude, position.longitude);
    const cached = this.cache.get(key);
    if (!force && cached && cached.expiresAt > Date.now()) return cached.result;
    let attempts = 1;
    try {
      const address = await traccarClient.reverseGeocode(position.latitude, position.longitude);
      if (address) return this.remember(key, { address, status: 'resolved', provider: 'traccar', attempts });
    } catch { /* fallback continua */ }
    if (this.fallback) {
      attempts++;
      try { const address = await this.fallback(position.latitude, position.longitude); if (address) return this.remember(key, { address, status: 'resolved', provider: 'fallback', attempts }); } catch { /* posição permanece válida */ }
    }
    const result: AddressResolution = { address: null, status: 'failed', provider: null, attempts };
    console.warn(JSON.stringify({ event: 'traccar.address.unavailable', traccarDeviceId: position.deviceId, attempts }));
    return this.remember(key, result);
  }
  private remember(key: string, result: AddressResolution) {
    this.cache.set(key, { expiresAt: Date.now() + getTraccarConfig().addressCacheTtlMs, result });
    if (result.status === 'resolved') console.info(JSON.stringify({ event: 'traccar.address.resolved', provider: result.provider }));
    return result;
  }
}
export const addressResolver = new AddressResolver();
export function setAddressFallback(provider: (lat: number, lng: number) => Promise<string | null>) {
  addressResolver.setFallback(provider);
}
