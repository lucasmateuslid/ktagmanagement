
import { Schedule } from '../../../types';

export const getTimeElapsedStr = (createdAt: number) => {
  const now = new Date();
  const diffMs = now.getTime() - createdAt;
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor((diffMs % 3600000) / 60000);
  return `${diffHrs}h ${diffMins}m`;
};

export const getDisplayDate = (schedule: Schedule) => {
  let dateStr = schedule.confirmedDate || schedule.preferredDate;
  
  if (!dateStr) return 'Data indefinida';

  // Se for timestamp (number), converte para string ISO
  if (typeof dateStr === 'number') {
      dateStr = new Date(dateStr).toISOString().split('T')[0];
  }

  // Garante que é string
  if (typeof dateStr !== 'string') {
      return '--/--/----';
  }

  // Remove parte de hora se houver (ISO string)
  if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
  }

  // Remove espaços
  dateStr = dateStr.trim();

  // Se a string for YYYY-MM-DD, fazemos o parse manual para evitar o shift de timezone (UTC -> Local)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Fallback para outros formatos
  return new Date(dateStr).toLocaleDateString();
};

export const isScheduleOverdue = (schedule: Schedule): boolean => {
  if (['Concluída', 'Cancelada', 'Frustrada'].includes(schedule.status)) return false;

  const dateStr = schedule.confirmedDate;
  const timeStr = schedule.confirmedTime || '00:00';

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, mins] = timeStr.split(':').map(Number);
  
  const scheduledTimeMs = new Date(year, month - 1, day, hours || 0, mins || 0).getTime();
  const now = new Date().getTime();
  
  const hoursPassed = (now - scheduledTimeMs) / 3600000;
  
  return hoursPassed >= 24;
};

export const getDisplayTime = (schedule: Schedule) => {
  return schedule.confirmedTime ? schedule.confirmedTime : schedule.preferredTime;
};
