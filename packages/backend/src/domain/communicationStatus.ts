import type { TraccarDevice, TraccarPosition, XadTagCommunicationStatus } from '@ktag/shared';

const activityTime = (device: TraccarDevice, position?: TraccarPosition | null): number => Math.max(
  Date.parse(device.lastUpdate || '') || 0,
  Date.parse(position?.serverTime || '') || 0,
  Date.parse(position?.fixTime || '') || 0,
);

export function communicationStatus(device: TraccarDevice, position?: TraccarPosition | null, now = Date.now()): XadTagCommunicationStatus {
  if (device.status === 'online') return 'online';
  const lastActivity = activityTime(device, position);
  if (!lastActivity) return device.status || 'unknown';
  const age = Math.max(0, now - lastActivity);
  if (age <= 15 * 60_000) return 'online';
  if (age <= 24 * 60 * 60_000) return 'delayed';
  return 'offline';
}
