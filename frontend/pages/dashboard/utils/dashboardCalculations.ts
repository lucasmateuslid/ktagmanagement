
import { Tag, Vehicle, Company, VehicleCategory, AppSettings, Schedule, Technician } from '../../../types';
import { Truck, Bike, Activity, Car } from 'lucide-react';

// --- SERVICE DATA CALCULATIONS ---

export const calculateServiceHistory = (scheduleList: Schedule[]) => {
  const historyMap: Record<string, number> = {};
  const last10Days: string[] = [];
  for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      last10Days.push(key);
      historyMap[key] = 0;
  }
  scheduleList.forEach(s => {
      const d = new Date(s.createdAt);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (historyMap[key] !== undefined) historyMap[key]++;
  });
  return last10Days.map(day => ({ name: day, total: historyMap[day] }));
};

export const calculateTopTechnicians = (scheduleList: Schedule[], techList: Technician[]) => {
  const installSchedules = scheduleList.filter(s => ['Concluída', 'Confirmada', 'Técnico no local'].includes(s.status));
  const techCount: Record<string, number> = {};
  installSchedules.forEach(s => {
      if (s.technicianId) techCount[s.technicianId] = (techCount[s.technicianId] || 0) + 1;
  });
  return Object.keys(techCount).map(id => {
      const tech = techList.find(t => t.id === id);
      return { name: tech ? tech.name.split(' ')[0] : 'Desc.', total: techCount[id] };
  }).sort((a, b) => b.total - a.total).slice(0, 3);
};

export const calculateTopRequesters = (scheduleList: Schedule[]) => {
  const reqCount: Record<string, number> = {};
  scheduleList.forEach(s => {
      const name = s.requesterName || 'Sistema';
      reqCount[name] = (reqCount[name] || 0) + 1;
  });
  return Object.keys(reqCount).map(name => ({ 
      name: name.length > 12 ? name.substring(0, 12) + '.' : name, 
      total: reqCount[name] 
  })).sort((a, b) => b.total - a.total).slice(0, 5);
};

export const calculateServiceTypes = (scheduleList: Schedule[]) => {
  const typeCount: Record<string, number> = {};
  scheduleList.forEach(s => {
      typeCount[s.serviceType] = (typeCount[s.serviceType] || 0) + 1;
  });
  return Object.keys(typeCount).map(key => ({ name: key, value: typeCount[key] }));
};

// --- TAG & VEHICLE CALCULATIONS ---

export const calculateTagHistory = (tagsList: Tag[]) => {
  const days = 7;
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString(undefined, { weekday: 'short' });
    const timestamp = date.setHours(23, 59, 59, 999);
    const existingTags = tagsList.filter(t => t.createdAt <= timestamp);
    data.push({ name: dateStr, total: existingTags.length });
  }
  return data;
};

export const calculateCompanyDistribution = (vehiclesList: Vehicle[], companiesList: Company[]) => {
  const counts: Record<string, number> = {};
  const activeVehicles = vehiclesList.filter(v => v.status === 'active');
  activeVehicles.forEach(v => {
    const id = v.companyId || 'unknown';
    counts[id] = (counts[id] || 0) + 1;
  });
  let data = companiesList.map(c => ({
    name: c.prefix || c.name.substring(0, 8),
    fullName: c.name,
    contador: counts[c.id] || 0
  }));
  return data.sort((a, b) => b.contador - a.contador).slice(0, 5);
};

export const calculateGrowthTrend = (vehiclesList: Vehicle[]) => {
  const monthsArray: any[] = [];
  const now = new Date();
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  // Analisa os últimos 6 meses (0 = atual)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = monthNames[d.getMonth()];
    const count = vehiclesList.filter(v => {
      if (!v.createdAt) return false;
      const vDate = new Date(v.createdAt);
      return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
    }).length;
    monthsArray.push({ name: monthLabel, ' entradas': count });
  }
  return monthsArray;
};

// --- STOCK & INVENTORY ---

export const calculateStockStatus = (unlinkedCount: number, settings: AppSettings | null) => {
  const minStock = settings?.minStockLevel || 80;
  const criticalStock = settings?.criticalStockLevel || 40;
  let status: 'high' | 'low' | 'critical' = 'high';
  if (unlinkedCount <= criticalStock) status = 'critical';
  else if (unlinkedCount <= minStock) status = 'low';
  
  return { status, minStock, criticalStock };
};

/**
 * Predição de Estoque baseada em SAÍDAS (Instalações Concluídas)
 * Ignora cadastros e foca no consumo real do estoque.
 */
export const calculateStockPrediction = (schedules: Schedule[], unlinkedCount: number) => {
  const now = new Date();
  
  // Filtra instalações concluídas nos últimos 90 dias para média
  const ninetyDaysAgo = now.getTime() - (90 * 24 * 60 * 60 * 1000);
  const installations = schedules.filter(s => 
    s.status === 'Concluída' && 
    s.serviceType === 'Instalação' && 
    s.createdAt >= ninetyDaysAgo
  );

  // Calcula média mensal (Saídas por mês)
  const monthlyAvg = installations.length / 3;

  // Se a média for muito baixa, assume uma saída residual para não dar infinito
  const safeMonthlyAvg = monthlyAvg > 0 ? monthlyAvg : 1; 
  const dailyAvg = safeMonthlyAvg / 30;

  const daysLeft = Math.floor(unlinkedCount / dailyAvg);

  if (installations.length === 0 && unlinkedCount > 0) {
      return { days: 365, label: '> 1 ANO (BAIXO USO)' };
  }

  if (unlinkedCount === 0) return { days: 0, label: 'ESGOTADO' };

  return {
      days: daysLeft,
      label: daysLeft > 365 ? '> 1 ANO' : `${daysLeft} DIAS`
  };
};

export const calculateOwnershipStats = (vehiclesList: Vehicle[]) => {
  const leasedCount = vehiclesList.filter(v => v.ownershipStatus !== 'purchased').length; 
  const purchasedCount = vehiclesList.filter(v => v.ownershipStatus === 'purchased').length;
  
  return [
      { name: 'Comodato', value: leasedCount },
      { name: 'Adquirido', value: purchasedCount }
  ];
};

export const calculateCategoryStats = (vehiclesList: Vehicle[], categoriesList: VehicleCategory[]) => {
  const counts: Record<string, number> = {};
  vehiclesList.forEach(v => {
    const typeKey = v.type || 'outros';
    counts[typeKey] = (counts[typeKey] || 0) + 1;
  });
  return categoriesList.map(cat => ({
    name: cat.name,
    count: counts[cat.id] || 0,
    icon: cat.fipeType === 'motos' ? Bike : cat.fipeType === 'caminhoes' ? Truck : cat.name.toLowerCase().includes('pickup') ? Activity : Car
  })).sort((a,b) => b.count - a.count).slice(0, 4);
};
