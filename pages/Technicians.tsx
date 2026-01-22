
import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Technician, Schedule } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Users, Plus, Trash2, CheckCircle, XCircle, Save, Phone, Palette, Calendar, Edit2, BarChart3, X, Filter, Wrench, Activity, RotateCcw } from 'lucide-react';

// --- COMPONENTE MODAL DE DETALHES DO TÉCNICO ---
const TechnicianStatsModal = ({ technician, schedules, onClose }: { technician: Technician, schedules: Schedule[], onClose: () => void }) => {
    // Datas padrão: Início e fim do mês atual
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });

    // Filtra agendamentos baseado no técnico e nas datas
    const filteredSchedules = useMemo(() => {
        const startTs = new Date(`${startDate}T00:00:00`).getTime();
        const endTs = new Date(`${endDate}T23:59:59`).getTime();

        return schedules.filter(s => {
            if (s.technicianId !== technician.id) return false;
            
            // Usa data confirmada ou preferência como base
            const scheduleDateStr = s.confirmedDate || s.preferredDate;
            const scheduleTs = new Date(`${scheduleDateStr}T12:00:00`).getTime();
            
            return scheduleTs >= startTs && scheduleTs <= endTs;
        });
    }, [schedules, technician.id, startDate, endDate]);

    const stats = useMemo(() => {
        return {
            total: filteredSchedules.length,
            active: filteredSchedules.filter(s => ['Confirmada', 'Reagendada', 'Em análise'].includes(s.status)).length,
            completed: filteredSchedules.filter(s => s.status === 'Concluída').length,
            canceled: filteredSchedules.filter(s => s.status === 'Cancelada').length,
            // Breakdown
            instalacao: filteredSchedules.filter(s => s.serviceType === 'Instalação').length,
            manutencao: filteredSchedules.filter(s => s.serviceType === 'Manutenção').length,
            retirada: filteredSchedules.filter(s => s.serviceType === 'Retirada').length
        };
    }, [filteredSchedules]);

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white shadow-lg text-2xl" style={{ backgroundColor: technician.color }}>
                            {technician.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{technician.name}</h2>
                            <p className="text-sm font-bold text-zinc-500 flex items-center gap-1"><Phone size={14}/> {technician.phone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors bg-zinc-100 dark:bg-zinc-800 rounded-xl"><X size={20}/></button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {/* Filtros de Data */}
                    <div className="flex flex-wrap gap-4 mb-8 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="flex-1 min-w-[140px]">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block">Data Inicial</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary-500" />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 block">Data Final</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary-500" />
                        </div>
                    </div>

                    {/* Stats Grid Principal */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl flex flex-col items-center text-center">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total</span>
                            <span className="text-2xl font-black text-zinc-900 dark:text-white">{stats.total}</span>
                        </div>
                        <div className="bg-blue-500/10 p-4 rounded-2xl flex flex-col items-center text-center border border-blue-500/20">
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">A Fazer</span>
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.active}</span>
                        </div>
                        <div className="bg-emerald-500/10 p-4 rounded-2xl flex flex-col items-center text-center border border-emerald-500/20">
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Concluídos</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
                        </div>
                        <div className="bg-red-500/10 p-4 rounded-2xl flex flex-col items-center text-center border border-red-500/20">
                            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Cancelados</span>
                            <span className="text-2xl font-black text-red-600 dark:text-red-400">{stats.canceled}</span>
                        </div>
                    </div>

                    {/* Breakdown por Tipo */}
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Serviços no Período</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center"><Wrench size={16}/></div>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Instalação</span>
                            </div>
                            <span className="text-lg font-black text-zinc-900 dark:text-white">{stats.instalacao}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center"><Activity size={16}/></div>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Manutenção</span>
                            </div>
                            <span className="text-lg font-black text-zinc-900 dark:text-white">{stats.manutencao}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center"><RotateCcw size={16}/></div>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Retirada</span>
                            </div>
                            <span className="text-lg font-black text-zinc-900 dark:text-white">{stats.retirada}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Technicians = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Technician>>({ active: true, color: '#3b82f6' });
  
  // State para o Modal de Detalhes
  const [selectedTechForDetail, setSelectedTechForDetail] = useState<Technician | null>(null);

  const loadData = async () => {
    // Busca técnicos e agendamentos para contagem
    const [techs, schs] = await Promise.all([
        storage.getTechnicians(),
        storage.getSchedules('admin', user?.id || '')
    ]);
    setTechnicians(techs);
    setSchedules(schs);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    const tech: Technician = {
        id: formData.id || crypto.randomUUID(),
        name: formData.name,
        phone: formData.phone,
        active: formData.active ?? true,
        color: formData.color
    };

    await storage.saveTechnician(tech);
    addNotification('success', 'Sucesso', 'Técnico salvo com sucesso.');
    setIsModalOpen(false);
    loadData();
  };

  const toggleStatus = async (tech: Technician) => {
      await storage.saveTechnician({ ...tech, active: !tech.active });
      loadData();
  };

  const getActiveCount = (techId: string) => {
      return schedules.filter(s => 
          s.technicianId === techId && 
          ['Confirmada', 'Reagendada', 'Em análise'].includes(s.status)
      ).length;
  };

  if (user?.role !== 'admin') return <div className="p-10 text-center text-zinc-500 uppercase font-black">Acesso Restrito</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Equipe Técnica</h1>
            <p className="text-zinc-500 mt-1 font-medium text-xs">Gestão de instaladores e técnicos de campo.</p>
        </div>
        <button onClick={() => { setFormData({ active: true, color: '#3b82f6' }); setIsModalOpen(true); }} className="bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl">
            <Plus size={16} /> Novo Técnico
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map(tech => {
            const count = getActiveCount(tech.id);
            
            return (
                <div 
                    key={tech.id} 
                    className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6 relative overflow-hidden cursor-pointer group hover:border-primary-500/50 transition-all"
                    onClick={() => setSelectedTechForDetail(tech)} // Clicar no card abre detalhes
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-lg text-lg" style={{ backgroundColor: tech.color }}>
                                {tech.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-black text-zinc-900 dark:text-white uppercase text-sm">{tech.name}</h3>
                                <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold mt-1">
                                    <Phone size={10} /> {tech.phone}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button 
                                onClick={() => { setFormData(tech); setIsModalOpen(true); }} 
                                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-primary-500 transition-colors"
                                title="Editar Dados"
                            >
                                <Edit2 size={16}/>
                            </button>
                            <button onClick={() => toggleStatus(tech)} className={`p-2 rounded-xl transition-all ${tech.active ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200'}`}>
                                {tech.active ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2 text-zinc-500">
                            <Calendar size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Agendamentos Ativos</span>
                        </div>
                        <span className="text-xl font-black text-zinc-900 dark:text-white">{count}</span>
                    </div>
                    
                    {/* Decorative Blob */}
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ backgroundColor: tech.color }} />
                </div>
            );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                <h2 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase mb-6">{formData.id ? 'Editar Técnico' : 'Cadastro de Técnico'}</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome Completo</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Telefone</label>
                        <input type="text" required value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cor na Agenda</label>
                        <div className="flex gap-2 mt-2">
                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                                <button key={c} type="button" onClick={() => setFormData({...formData, color: c})} className={`w-8 h-8 rounded-full border-2 ${formData.color === c ? 'border-white ring-2 ring-zinc-900 dark:ring-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] text-zinc-500 hover:text-zinc-900">Cancelar</button>
                        <button type="submit" className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-black uppercase text-[10px] shadow-lg hover:scale-105 transition-all">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {selectedTechForDetail && (
          <TechnicianStatsModal 
            technician={selectedTechForDetail} 
            schedules={schedules} 
            onClose={() => setSelectedTechForDetail(null)} 
          />
      )}
    </div>
  );
};
