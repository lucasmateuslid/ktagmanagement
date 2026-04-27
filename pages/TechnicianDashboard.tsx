import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { Schedule } from '../types';
import { 
  Calendar, CheckCircle2, Clock, MapPin, Wrench, 
  Wallet, TrendingUp, Activity, Check, FileText, Building, Search
} from 'lucide-react';
import { TrackingModal } from '../components/TrackingModal';

export const TechnicianDashboard = () => {
  const { user } = useAuth();
  const { schedules, technicians, companies, loading } = useDashboardData();
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [activeTab, setActiveTab] = useState<'agendados' | 'andamento' | 'concluidos'>('agendados');
  const [searchTerm, setSearchTerm] = useState('');

  const mySchedules = useMemo(() => {
    const techId = technicians.find(t => t.email?.toLowerCase() === user?.email.toLowerCase())?.id || user?.id;
    let filtered = schedules.filter(s => s.technicianId === techId);
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.vehiclePlate.toLowerCase().includes(lower) ||
        s.osNumber?.toLowerCase().includes(lower)
      );
    }
    
    return filtered;
  }, [schedules, user?.id, technicians, user?.email, searchTerm]);

  const agendados = mySchedules.filter(s => ['Confirmada', 'Reagendada', 'Autorizada'].includes(s.status));
  const emAndamento = mySchedules.filter(s => s.status === 'Técnico no local' || s.status === 'Cliente no local');
  const concluidos = mySchedules.filter(s => s.status === 'Concluída');

  const totalServices = mySchedules.length;
  const totalRecebido = mySchedules.reduce((acc, s) => acc + (s.technicianPaid ? (s.technicianPaymentAmount || 0) : 0), 0);
  const aReceber = mySchedules.reduce((acc, s) => acc + (!s.technicianPaid && s.status === 'Concluída' ? (s.technicianPaymentAmount || 0) : 0), 0);

  const getActiveList = () => {
    if (activeTab === 'agendados') return agendados;
    if (activeTab === 'andamento') return emAndamento;
    return concluidos;
  };

  const activeList = getActiveList();

  if (loading && mySchedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-20">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
          Olá, {user?.name?.split(' ')[0] || 'Técnico'}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
          Seu painel de serviços
        </p>
      </div>

      {/* Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-5 rounded-3xl">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
            <Wrench size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Serviços Totais</span>
          </div>
          <p className="text-3xl font-black text-blue-900 dark:text-blue-300">{totalServices}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-5 rounded-3xl">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
            <Clock size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">A Receber</span>
          </div>
          <p className="text-3xl font-black text-amber-900 dark:text-amber-300">
            R$ {aReceber.toFixed(2)}
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-5 rounded-3xl">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
            <Wallet size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Recebido</span>
          </div>
          <p className="text-3xl font-black text-emerald-900 dark:text-emerald-300">
            R$ {totalRecebido.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input
            type="text"
            placeholder="Pesquisar por placa ou número da OS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 transition-colors shadow-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveTab('agendados')}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
            activeTab === 'agendados'
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <Calendar size={14} />
          Agendados
          <span className="ml-1 px-2 py-0.5 bg-white/20 dark:bg-black/20 rounded-full text-[9px]">
            {agendados.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('andamento')}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
            activeTab === 'andamento'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <Activity size={14} />
          Em Andamento
          <span className="ml-1 px-2 py-0.5 bg-white/20 dark:bg-black/20 rounded-full text-[9px]">
            {emAndamento.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('concluidos')}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
            activeTab === 'concluidos'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <CheckCircle2 size={14} />
          Concluídos
          <span className="ml-1 px-2 py-0.5 bg-white/20 dark:bg-black/20 rounded-full text-[9px]">
            {concluidos.length}
          </span>
        </button>
      </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {activeList.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <FileText size={48} className="text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Nenhum serviço encontrado
            </p>
          </div>
        ) : (
          activeList.map(schedule => (
            <div
              key={schedule.id}
              onClick={() => setSelectedSchedule(schedule)}
              className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight group-hover:text-primary-500 transition-colors">
                    {schedule.clientName || 'Cliente não informado'}
                  </h3>
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-500 mt-1">
                    <MapPin size={12} />
                    <span className="truncate max-w-[200px]">{schedule.locationAddress || 'Endereço não informado'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">
                    {schedule.confirmedDate ? new Date(schedule.confirmedDate).toLocaleDateString() : 'Sem data'}
                  </p>
                  <p className="text-sm font-black text-zinc-900 dark:text-white">
                    {schedule.confirmedTime || '--:--'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {companies.find(c => c.id === schedule.companyId) && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Building size={10} />
                    {companies.find(c => c.id === schedule.companyId)?.name}
                  </span>
                )}
                {(() => {
                  const tech = technicians.find(t => t.id === schedule.technicianId);
                  const serviceValue = tech?.serviceRates?.[
                    schedule.serviceType === 'Instalação' ? 'installation' :
                    schedule.serviceType === 'Manutenção' ? 'maintenance' :
                    schedule.serviceType === 'Retirada' ? 'removal' : 'inspection'
                  ] || 0;
                  return serviceValue > 0 ? (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Wallet size={10} />
                      Serviço: R$ {serviceValue.toFixed(2)}
                    </span>
                  ) : null;
                })()}
                {(schedule.displacementValue || 0) > 0 && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                    <MapPin size={10} />
                    Deslocamento: R$ {(schedule.displacementValue || 0).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    {schedule.serviceType}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    schedule.status === 'Técnico no local' || schedule.status === 'Cliente no local' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    schedule.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {schedule.status}
                  </span>
                </div>
                
                {schedule.status === 'Concluída' && (
                  <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${schedule.technicianPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {schedule.technicianPaid ? <Check size={12}/> : <Clock size={12}/>}
                    {schedule.technicianPaid ? 'Pago' : 'Pendente'}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedSchedule && (
        <TrackingModal
          schedule={selectedSchedule}
          technicians={technicians}
          companies={companies}
          currentUser={user}
          onClose={() => setSelectedSchedule(null)}
          onUpdate={(updated) => {
            // A atualização real é feita no TrackingModal, mas podemos atualizar o estado local se necessário
            setSelectedSchedule(updated);
          }}
        />
      )}
    </div>
  );
};
