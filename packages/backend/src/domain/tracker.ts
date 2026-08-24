import { normalizeImei } from '@ktag/shared';
export const normalizeTrackerImei = (value: unknown): string => normalizeImei(value);
export const isValidTrackerImei = (value: unknown): boolean => { try { normalizeTrackerImei(value); return true; } catch { return false; } };
