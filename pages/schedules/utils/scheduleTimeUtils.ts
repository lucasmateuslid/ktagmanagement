
import { Schedule } from '../../../types';

export const getTimeElapsedStr = (createdAt: number) => {
  const now = new Date();
  const diffMs = now.getTime() - createdAt;
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffMins = Math.floor((diffMs % 3600000) / 60000);
  return `${diffHrs}h ${diffMins}m`;
};

export const getDisplayDate = (schedule: Schedule) => {
  return schedule.confirmedDate 
    ? new Date(schedule.confirmedDate).toLocaleDateString() 
    : new Date(schedule.preferredDate).toLocaleDateString();
};

export const getDisplayTime = (schedule: Schedule) => {
  return schedule.confirmedTime ? schedule.confirmedTime : schedule.preferredTime;
};
