// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { vehicleHistory, addNotification } = vi.hoisted(() => ({ vehicleHistory: vi.fn(), addNotification: vi.fn() }));
vi.mock('../../../services/trackingApi', () => ({ trackingApi: { vehicleHistory } }));
vi.mock('../../../contexts/NotificationContext', () => ({ useNotification: () => ({ addNotification }) }));

import { useVehicleHistory } from './useVehicleHistory';

const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const page = (id: string, tagId: string) => ({ requestId: id, subjectType: 'vehicle' as const, subjectId: id, from: new Date(1).toISOString(), to: new Date(2).toISOString(), points: [{ id, tagId, vehicleId: id, provider: 'ktag' as const, timestamp: id === 'old' ? 10 : 20, latitude: -8, longitude: -35 }], nextCursor: null, truncated: false, partial: false, warnings: [] });

describe('useVehicleHistory', () => {
  beforeEach(() => { vehicleHistory.mockReset(); addNotification.mockReset(); });

  it('ignora resposta e finally de uma geração anterior', async () => {
    const first = deferred<any>(); const second = deferred<any>(); vehicleHistory.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ vehicleId, tagId }) => useVehicleHistory(vehicleId, tagId, [], vi.fn()), { initialProps: { vehicleId: 'v1', tagId: 'tag-1' } });
    act(() => { void result.current.fetchHistory(); });
    rerender({ vehicleId: 'v2', tagId: 'tag-2' }); act(() => { void result.current.fetchHistory(); });
    await act(async () => { first.resolve(page('old', 'tag-1')); await Promise.resolve(); });
    expect(result.current.historyLoading).toBe(true); expect(result.current.historyItems).toEqual([]);
    await act(async () => { second.resolve(page('new', 'tag-2')); await Promise.resolve(); });
    expect(result.current.historyLoading).toBe(false); expect(result.current.historyItems.map(point => point.id)).toEqual(['new']);
  });

  it('não duplica a posição atual já representada', async () => {
    vehicleHistory.mockResolvedValue(page('new', 'tag-2'));
    const current = [{ id: 'current', tagId: 'tag-2', lat: -8, lon: -35, conf: 1, status: 1, timestamp: 20, isodatetime: new Date(20).toISOString() }];
    const { result } = renderHook(() => useVehicleHistory('v2', 'tag-2', current, vi.fn()));
    await act(async () => { await result.current.fetchHistory(); });
    expect(result.current.historyItems).toHaveLength(1);
  });
});
