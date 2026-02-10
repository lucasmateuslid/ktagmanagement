
import { useMemo } from 'react';
import { Schedule, Technician } from '../../../types';

export const useScheduleStats = (
  schedules: Schedule[], 
  technicians: Technician[], 
  viewDate: Date, 
  isPrivileged: boolean
) => {
  return useMemo(() => {
    if (!isPrivileged) return null;

    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();

    // Filtra agendamentos do mês SELECIONADO no topo
    const monthSchedules = schedules.filter(s => {
        const dateStr = s.confirmedDate || s.preferredDate;
        let d;
        if (dateStr) {
           d = new Date(dateStr + 'T12:00:00');
        } else {
           d = new Date(s.createdAt);
        }
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const total = monthSchedules.length;
    const scheduled = monthSchedules.filter(s => ['Confirmada', 'Reagendada', 'Técnico no local', 'Autorizada'].includes(s.status)).length;
    const completed = monthSchedules.filter(s => s.status === 'Concluída').length;
    const canceled = monthSchedules.filter(s => s.status === 'Cancelada').length;

    const installation = monthSchedules.filter(s => s.serviceType === 'Instalação').length;
    const maintenance = monthSchedules.filter(s => s.serviceType === 'Manutenção').length;
    const removal = monthSchedules.filter(s => s.serviceType === 'Retirada').length;
    const inspection = monthSchedules.filter(s => s.serviceType === 'Vistoria').length;

    // Device Type Stats
    const deviceTagOnly = monthSchedules.filter(s => s.deviceType === 'Tag').length;
    const deviceTrackerOnly = monthSchedules.filter(s => s.deviceType === 'Rastreador').length;
    const deviceCombo = monthSchedules.filter(s => s.deviceType === 'Rastreador + Tag').length;

    let totalRevenue = 0;
    let totalDisplacement = 0;
    const byTech: Record<string, number> = {};
    const byService: Record<string, number> = {};

    monthSchedules.forEach(s => {
        if (['Concluída', 'Confirmada', 'Reagendada', 'Técnico no local'].includes(s.status)) {
            const tech = technicians.find(t => t.id === s.technicianId);
            let serviceCost = 0;
            
            if (tech && tech.serviceRates) {
                if (s.serviceType === 'Instalação') serviceCost = tech.serviceRates.installation || 0;
                else if (s.serviceType === 'Manutenção') serviceCost = tech.serviceRates.maintenance || 0;
                else if (s.serviceType === 'Retirada') serviceCost = tech.serviceRates.removal || 0;
                else if (s.serviceType === 'Vistoria') serviceCost = tech.serviceRates.inspection || 0;
            }

            const dispCost = s.displacementValue || 0;
            const finalCost = serviceCost + dispCost;

            totalRevenue += finalCost;
            totalDisplacement += dispCost;

            const techName = tech ? tech.name : 'Não Atribuído';
            byTech[techName] = (byTech[techName] || 0) + finalCost;

            byService[s.serviceType] = (byService[s.serviceType] || 0) + finalCost;
        }
    });

    return {
        total, scheduled, completed, canceled,
        installation, maintenance, removal, inspection,
        deviceTagOnly, deviceTrackerOnly, deviceCombo,
        totalRevenue, totalDisplacement,
        byTech: Object.entries(byTech).sort((a, b) => b[1] - a[1]),
        byService: Object.entries(byService).sort((a, b) => b[1] - a[1]),
        avgTicket: (completed + scheduled) > 0 ? totalRevenue / (completed + scheduled) : 0,
        monthSchedules
    };
  }, [schedules, technicians, isPrivileged, viewDate]);
};
