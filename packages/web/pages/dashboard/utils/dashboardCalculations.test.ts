import { describe, expect, it } from 'vitest';
import type { Schedule, Tag, Vehicle } from '../../../types';
import { calculateMonthlyServiceSummary, calculateRecentActivations, oldestUncommunicativeVehicles } from './dashboardCalculations';

describe('dashboard operational summary', () => {
  it('counts current-month services by agenda date and excludes closed services from open total', () => {
    const make = (status: Schedule['status'], preferredDate: string) => ({ status, preferredDate, createdAt: 1 }) as Schedule;
    expect(calculateMonthlyServiceSummary([
      make('Solicitada', '2026-10-01'), make('Concluída', '2026-10-02'),
      make('Cancelada', '2026-10-03'), make('Solicitada', '2026-09-30'),
    ], new Date(2026, 9, 5))).toEqual({ open: 1, completed: 1 });
  });

  it('counts first communications and orders vehicles without communication', () => {
    const now = new Date(2026, 9, 5, 12);
    const activated = [{ firstCommunicationAt: new Date(2026, 9, 5, 8).getTime() }, { firstCommunicationAt: new Date(2026, 9, 4, 8).getTime() }] as Tag[];
    expect(calculateRecentActivations(activated, now).slice(-2).map(item => item.total)).toEqual([1, 1]);
    const vehicles = [
      { id: 'recent', tagId: 'a', lastPosition: { timestamp: now.getTime() - 60_000 } },
      { id: 'old', tagId: 'b', lastPosition: { timestamp: now.getTime() - 14 * 3_600_000 } },
      { id: 'missing', tagId: 'c' },
    ] as Vehicle[];
    expect(oldestUncommunicativeVehicles(vehicles, now.getTime()).map(item => item.vehicle.id)).toEqual(['missing', 'old']);
  });
});
