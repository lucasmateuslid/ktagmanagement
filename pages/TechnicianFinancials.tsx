import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Technician, Schedule } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Search, Filter, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { TechnicianFinancialDetailsModal } from '../components/TechnicianFinancialDetailsModal';

export const TechnicianFinancials = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);

  const { user } = useAuth();

  const fetchData = async (background = false) => {
    if (!background) setLoading(true);
    const [techs, scheds] = await Promise.all([
      storage.getTechnicians(),
      storage.getSchedules(user?.role || 'admin', user?.id || '')
    ]);
    setTechnicians(techs);
    setSchedules(scheds);
    if (!background) setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const financialData = useMemo(() => {
    let filteredTechs = technicians;
    if (user?.role === 'technician') {
      const techId = user?.technicianId || technicians.find(t => t.email?.toLowerCase() === user?.email.toLowerCase())?.id || user?.id;
      filteredTechs = technicians.filter(t => t.id === techId);
    }

    return filteredTechs.map(tech => {
      const techSchedules = schedules.filter(s => s.technicianId === tech.id);
      const openServices = techSchedules.filter(s => s.status !== 'Concluída' && s.status !== 'Cancelada' && s.status !== 'Frustrada');
      
      const getCalculatedPaymentAmount = (s: Schedule) => {
        if (s.technicianPaymentAmount !== undefined && s.technicianPaymentAmount !== null && s.technicianPaymentAmount > 0) {
          return s.technicianPaymentAmount;
        }
        
        const rates = tech.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 };
        let amount = 0;
        
        if (s.serviceType === 'Instalação') {
          if (s.deviceType === 'Tag') amount = rates.tagInstallation || 0;
          else if (s.deviceType === 'Rastreador') amount = rates.installation || 0;
          else if (s.deviceType === 'Rastreador + Tag') amount = (rates.installation || 0) + (rates.tagInstallation || 0);
          else amount = rates.installation || 0;
        } else if (s.serviceType === 'Manutenção') {
          amount = rates.maintenance || 0;
        } else if (s.serviceType === 'Retirada') {
          if (s.deviceType === 'Tag') amount = rates.tagRemoval || 0;
          else if (s.deviceType === 'Rastreador') amount = rates.removal || 0;
          else if (s.deviceType === 'Rastreador + Tag') amount = (rates.removal || 0) + (rates.tagRemoval || 0);
          else amount = rates.removal || 0;
        } else if (s.serviceType === 'Vistoria') {
          amount = rates.inspection || 0;
        }

        if (s.status === 'Frustrada') {
          amount = amount * 0.5;
        }
        
        return amount;
      };

      const totalToReceive = techSchedules
        .filter(s => (s.status === 'Concluída' || s.status === 'Frustrada') && !s.technicianPaid)
        .reduce((sum, s) => sum + getCalculatedPaymentAmount(s) + (s.displacementValue || 0), 0);

      const totalInHand = techSchedules
        .reduce((sum, s) => sum + (s.amountReceivedByTechnician || 0), 0);
      
      return {
        ...tech,
        openServicesCount: openServices.length,
        totalToReceive,
        totalInHand
      };
    });
  }, [technicians, schedules]);

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-6 pb-24 font-sans max-w-[1600px] mx-auto">
      <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-8">
        {user?.role === 'technician' ? 'Meu Financeiro' : 'Gestão Financeira de Técnicos'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {financialData.map(tech => (
          <div key={tech.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg" style={{ backgroundColor: tech.color }}>
                {tech.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 dark:text-white">{tech.name}</h2>
                <p className="text-xs text-zinc-500">{tech.openServicesCount} serviços em aberto</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">A Receber</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">R$ {tech.totalToReceive.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Em Mãos</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {tech.totalInHand.toFixed(2)}</p>
              </div>
            </div>

            <button 
              onClick={() => setSelectedTechnician(tech)}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Ver Detalhes Financeiros
            </button>
          </div>
        ))}
      </div>

      {selectedTechnician && (
        <TechnicianFinancialDetailsModal 
          technician={selectedTechnician} 
          schedules={schedules} 
          onClose={() => setSelectedTechnician(null)} 
          onUpdate={() => fetchData(true)}
        />
      )}
    </div>
  );
};
