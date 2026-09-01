import { describe, expect, it } from 'vitest';
import { locationHistoryKey, mergeHistoryLocations, trackingPointToLocation } from './historyPoints';

const location = (id: string, timestamp: number) => ({ id, tagId: 'tag-1', lat: -8, lon: -35, conf: 10, status: 1, timestamp, isodatetime: new Date(timestamp).toISOString() });

describe('historyPoints', () => {
  it('deduplica pela identidade lógica e ordena do mais recente', () => {
    const values = mergeHistoryLocations([location('b', 10), location('a', 10), location('c', 20)]);
    expect(values.map(point => point.id)).toEqual(['c', 'a']);
    expect(locationHistoryKey(values[0])).toBe('tag-1|20|-8|-35');
  });

  it('converte o contrato compartilhado e completa metadados de bateria', () => {
    const value = trackingPointToLocation({ id: 'x', tagId: 'tag-1', vehicleId: 'v', provider: 'traccar', timestamp: 20, latitude: -8, longitude: -35, speed: 12, course: 90, battery: { level: 70 } });
    expect(value.battery).toEqual({ level: 70, label: 'Não informado', color: '#71717a' });
    expect(value).toMatchObject({ provider: 'traccar', vehicleId: 'v', speed: 12, course: 90 });
  });
});
