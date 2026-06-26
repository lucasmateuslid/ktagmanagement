
import { Schedule, Technician } from '../../../types';

export const calculateServiceValue = (schedule: Schedule, tech?: Technician) => {
  if (!tech || !tech.serviceRates) return 0;
  
  if (schedule.serviceType === 'Instalação') return tech.serviceRates.installation || 0;
  if (schedule.serviceType === 'Manutenção') return tech.serviceRates.maintenance || 0;
  if (schedule.serviceType === 'Retirada') return tech.serviceRates.removal || 0;
  if (schedule.serviceType === 'Vistoria') return tech.serviceRates.inspection || 0;
  
  // Valor padrão fallback se não houver taxa definida
  return 50; 
};

export const calculateScheduleTotal = (schedule: Schedule, tech?: Technician) => {
  const serviceVal = calculateServiceValue(schedule, tech);
  const displacement = schedule.displacementValue || 0;
  return serviceVal + displacement;
};
