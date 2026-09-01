// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ktagBatteryStatus } from './api';

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
