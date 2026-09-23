import { describe, expect, it } from 'vitest';
import type { LiveMapTrackedAsset } from '@ktag/shared';
import type { Tag } from '../../../types';
import { traccarAssetLocation } from './traccarAsset';

const tags = [
  { id: 'ktag-1', type: 'K_TAG', accessoryId: 'serial-1' },
  { id: 'xad-1', type: 'XADTAG', identifierNormalized: '7260500000', traccarUniqueId: '000007260500000' },
] as Tag[];
const asset = (overrides: Partial<LiveMapTrackedAsset> = {}) => ({
  id: 'xadtag_7260500000', source: 'traccar', equipmentType: 'XADTAG', tenantId: 'tenant-a',
  latitude: -8.7, longitude: -36, fixTime: '2026-09-23T11:41:00Z', status: 'online', valid: true,
  ...overrides,
}) as LiveMapTrackedAsset;

describe('identidade dos pontos Traccar no LiveMap', () => {
  it('não associa uniqueId ausente à primeira K-TAG sem identifierNormalized', () => {
    // Antes: undefined === undefined selecionava ktag-1 e substituía Cupira por outro ponto.
    expect(traccarAssetLocation(asset(), tags, 'tenant-a')).toMatchObject({ tagId: 'xad-1', provider: 'traccar' });
  });
  it('descarta posição sem identificação conhecida em vez de inventar tagId', () => {
    expect(traccarAssetLocation(asset({ id: 'xadtag_unknown' }), tags, 'tenant-a')).toBeNull();
  });
  it('não aceita nem mesmo equipamento explícito de K-TAG como XADTAG', () => {
    expect(traccarAssetLocation(asset({ equipmentId: 'ktag-1' }), tags, 'tenant-a')).toBeNull();
  });
  it('usa o ID persistente do equipamento, inclusive para DTO do cliente', () => {
    expect(traccarAssetLocation(asset({ equipmentId: 'xad-1' }), [{ id: 'xad-1', type: 'XADTAG' }] as Tag[], 'tenant-a')).toMatchObject({ tagId: 'xad-1' });
  });
  it('rejeita outro tenant e identificação ambígua', () => {
    expect(traccarAssetLocation(asset({ tenantId: 'other' }), tags, 'tenant-a')).toBeNull();
    expect(traccarAssetLocation(asset(), [...tags, { ...tags[1], id: 'xad-2' }], 'tenant-a')).toBeNull();
  });
  it('não inventa horário atual nem bateria zero para dados ausentes', () => {
    expect(traccarAssetLocation(asset({ fixTime: '' }), tags, 'tenant-a')).toBeNull();
    expect(traccarAssetLocation(asset(), tags, 'tenant-a')).not.toHaveProperty('battery');
  });
});
