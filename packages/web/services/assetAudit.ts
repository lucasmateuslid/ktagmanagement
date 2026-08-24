import { SimCard, Tag, Tracker } from '../types';

export const DEFAULT_IDLE_DAYS = 30;
const DAY_MS = 86_400_000;

export interface AssetAuditLine {
  id: string;
  label: string;
  reason: 'not_linked' | 'stock_overdue' | 'returned_overdue' | 'offline';
  daysIdle: number;
  monthlyCost: number;
}

export interface AssetAuditSummary {
  total: number;
  inUse: number;
  inStock: number;
  idle: number;
  offline: number;
  totalMonthlyCost: number;
  wastedMonthlyCost: number;
  lines: AssetAuditLine[];
}

const daysSince = (timestamp: number | undefined, now: number) =>
  timestamp ? Math.max(0, Math.floor((now - timestamp) / DAY_MS)) : 0;

export function auditSimCards(
  sims: SimCard[],
  now = Date.now(),
  idleDays = DEFAULT_IDLE_DAYS,
): AssetAuditSummary {
  const lines = sims.flatMap<AssetAuditLine>((sim) => {
    if (sim.status === 'retired' || sim.cancelledAt) return [];
    const reference = sim.returnedToStockAt || sim.stockEnteredAt || sim.createdAt;
    const idleFor = daysSince(reference, now);
    const offlineFor = daysSince(sim.lastCommunicationAt || sim.activatedAt, now);
    const notLinked = !sim.trackerId;
    const inStock = sim.status === 'in_stock' || sim.status === 'returned';

    let reason: AssetAuditLine['reason'] | undefined;
    if (sim.status === 'returned' && idleFor >= idleDays) reason = 'returned_overdue';
    else if (inStock && idleFor >= idleDays) reason = 'stock_overdue';
    else if (notLinked) reason = 'not_linked';
    else if (offlineFor >= idleDays) reason = 'offline';
    if (!reason) return [];

    return [{
      id: sim.id,
      label: sim.phoneNumber || sim.iccid,
      reason,
      daysIdle: reason === 'offline' ? offlineFor : idleFor,
      monthlyCost: sim.monthlyCost || 0,
    }];
  });

  return {
    total: sims.length,
    inUse: sims.filter((item) => item.status === 'installed' && item.trackerId).length,
    inStock: sims.filter((item) => item.status === 'in_stock' || item.status === 'returned').length,
    idle: lines.length,
    offline: lines.filter((item) => item.reason === 'offline').length,
    totalMonthlyCost: sims.filter((item) => !item.cancelledAt).reduce((sum, item) => sum + (item.monthlyCost || 0), 0),
    wastedMonthlyCost: lines.reduce((sum, item) => sum + item.monthlyCost, 0),
    lines,
  };
}

export function auditTrackers(trackers: Tracker[], now = Date.now(), idleDays = DEFAULT_IDLE_DAYS): AssetAuditSummary {
  const lines = trackers.flatMap<AssetAuditLine>((tracker) => {
    const reference = tracker.returnedToStockAt || tracker.stockEnteredAt || tracker.createdAt;
    const idleFor = daysSince(reference, now);
    const offlineFor = daysSince(tracker.lastCommunicationAt || tracker.installedAt, now);
    const inStock = tracker.status === 'disponível';
    let reason: AssetAuditLine['reason'] | undefined;
    if (tracker.returnedToStockAt && idleFor >= idleDays) reason = 'returned_overdue';
    else if (inStock && idleFor >= idleDays) reason = 'stock_overdue';
    else if (tracker.status === 'em_uso' && !tracker.vehicleId) reason = 'not_linked';
    else if (tracker.status === 'em_uso' && offlineFor >= idleDays) reason = 'offline';
    return reason ? [{ id: tracker.id, label: tracker.imei, reason, daysIdle: reason === 'offline' ? offlineFor : idleFor, monthlyCost: 0 }] : [];
  });

  return {
    total: trackers.length,
    inUse: trackers.filter((item) => item.status === 'em_uso' && item.vehicleId).length,
    inStock: trackers.filter((item) => item.status === 'disponível').length,
    idle: lines.length,
    offline: lines.filter((item) => item.reason === 'offline').length,
    totalMonthlyCost: 0,
    wastedMonthlyCost: 0,
    lines,
  };
}

export function auditTags(tags: Tag[]): AssetAuditSummary {
  const inStock = tags.filter((item) => !item.status || item.status === 'disponível').length;
  const inUse = tags.filter((item) => item.status === 'em_uso').length;
  return { total: tags.length, inUse, inStock, idle: inStock, offline: tags.filter((item) => item.traccarStatus === 'offline').length, totalMonthlyCost: 0, wastedMonthlyCost: 0, lines: [] };
}
