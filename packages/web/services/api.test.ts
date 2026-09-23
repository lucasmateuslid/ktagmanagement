// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ktagBatteryStatus, latestTagLocation } from './api';

describe('ktagBatteryStatus', () => {
  it.each([
    [0, 100, 'Alto'],
    [1, 60, 'Médio'],
    [2, 30, 'Baixo'],
    [3, 10, 'Muito baixo'],
  ])('interpreta status %i como %s%% (%s)', (status, level, label) => {
    expect(ktagBatteryStatus(status)).toMatchObject({ level, label });
  });
});

describe('latestTagLocation', () => {
  it('escolhe o ponto mais recente mesmo quando o provedor muda a ordem', () => {
    const location = (timestamp: number) => ({
      lat: -8, lon: -36, conf: 100, status: 0, timestamp,
      isodatetime: new Date(timestamp).toISOString(), battery: ktagBatteryStatus(0),
    });

    expect(latestTagLocation([location(200), location(500), location(300)]))
      .toMatchObject({ timestamp: 500 });
  });

  it('ignora pontos sem timestamp valido', () => {
    const invalid = { lat: -8, lon: -36, conf: 100, status: 0, timestamp: Number.NaN, isodatetime: '', battery: ktagBatteryStatus(0) };
    expect(latestTagLocation([invalid])).toBeNull();
  });
});
