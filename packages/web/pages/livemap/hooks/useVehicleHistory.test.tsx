// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { vehicleHistory, addNotification } = vi.hoisted(() => ({ vehicleHistory: vi.fn(), addNotification: vi.fn() }));
vi.mock('../../../services/trackingApi', () => ({ trackingApi: { vehicleHistory } }));
vi.mock('../../../contexts/NotificationContext', () => ({ useNotification: () => ({ addNotification }) }));

import { HISTORY_WINDOW_MS, useVehicleHistory } from './useVehicleHistory';

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

  it('consulta as últimas 24 horas por padrão', async () => {
    vehicleHistory.mockResolvedValue(page('new', 'tag-2'));
    const now = new Date('2026-09-02T12:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { result } = renderHook(() => useVehicleHistory('v2', 'tag-2', [], vi.fn()));

    await act(async () => { await result.current.fetchHistory(); });

    expect(Date.parse(vehicleHistory.mock.calls[0][2]) - Date.parse(vehicleHistory.mock.calls[0][1])).toBe(HISTORY_WINDOW_MS);
    vi.restoreAllMocks();
  });

  it('ignora um evento de clique recebido no lugar do período', async () => {
    vehicleHistory.mockResolvedValue(page('new', 'tag-2'));
    const { result } = renderHook(() => useVehicleHistory('v2', 'tag-2', [], vi.fn()));

    await act(async () => { await result.current.fetchHistory({ type: 'click' } as any); });

    const [, from, to] = vehicleHistory.mock.calls[0];
    expect(Number.isFinite(Date.parse(from))).toBe(true);
    expect(Date.parse(to) - Date.parse(from)).toBe(HISTORY_WINDOW_MS);
    expect(result.current.historyError).toBeNull();
  });

  it('mantém o período escolhido ao carregar a próxima página', async () => {
    vehicleHistory.mockResolvedValueOnce({ ...page('new', 'tag-2'), nextCursor: 'cursor-1' }).mockResolvedValueOnce(page('old', 'tag-2'));
    const { result } = renderHook(() => useVehicleHistory('v2', 'tag-2', [], vi.fn()));
    const period = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-04T00:00:00.000Z' };
    await act(async () => { await result.current.fetchHistory(period); });
    await act(async () => { result.current.loadMoreHistory(); await Promise.resolve(); });
    expect(vehicleHistory.mock.calls[0].slice(1, 3)).toEqual([period.from, period.to]);
    expect(vehicleHistory.mock.calls[1].slice(1, 4)).toEqual([period.from, period.to, 'cursor-1']);
  });
});
