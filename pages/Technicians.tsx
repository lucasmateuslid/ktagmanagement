
import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Technician, Schedule, DeviceType, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { securityService } from '../services/security';
import { Checkbox } from '../components/ui/checkbox';
import { ResponsiveModal, ModalSection } from '../components/ui/responsive-modal';
import { Users, Plus, Trash2, CheckCircle, XCircle, Save, Phone, Palette, Calendar, Edit2, BarChart3, X, Filter, Wrench, Activity, RotateCcw, DollarSign, ClipboardCheck, CalendarOff, Layers, Radio, Tag } from 'lucide-react';

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
            active: filteredSchedules.filter(s => !['Concluída', 'Cancelada', 'Frustrada'].includes(s.status)).length,
            completed: filteredSchedules.filter(s => s.status === 'Concluída').length,
            canceled: filteredSchedules.filter(s => s.status === 'Cancelada').length,
            // Breakdown
            instalacao: filteredSchedules.filter(s => s.serviceType === 'Instalação').length,
            manutencao: filteredSchedules.filter(s => s.serviceType === 'Manutenção').length,
            retirada: filteredSchedules.filter(s => s.serviceType === 'Retirada').length,
            vistoria: filteredSchedules.filter(s => s.serviceType === 'Vistoria').length
        };
    }, [filteredSchedules]);

    // Cálculo Estimado de Valor (Apenas concluídos)
    const estimatedValue = useMemo(() => {
        const rates = technician.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 };
        const completedOnly = filteredSchedules.filter(s => s.status === 'Concluída');
        
        let total = 0;
        completedOnly.forEach(s => {
            if (s.serviceType === 'Instalação') total += rates.installation || 0;
            if (s.serviceType === 'Manutenção') total += rates.maintenance || 0;
            if (s.serviceType === 'Retirada') total += rates.removal || 0;
            if (s.serviceType === 'Vistoria') total += rates.inspection || 0;
        });
        return total;
    }, [filteredSchedules, technician.serviceRates]);

    return (
        <div className="modal-shell">
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
                        <div className="bg-zinc-900 text-white p-4 rounded-2xl flex flex-col items-center text-center border border-zinc-800 shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"/>
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 relative z-10">Valor Est.</span>
                            <span className="text-2xl font-black text-white relative z-10">R$ {estimatedValue.toFixed(2)}</span>
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
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center"><ClipboardCheck size={16}/></div>
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Vistoria</span>
                            </div>
                            <span className="text-lg font-black text-zinc-900 dark:text-white">{stats.vistoria}</span>
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
  const [formData, setFormData] = useState<Partial<Technician>>({ 
      active: true, 
      color: '#3b82f6',
      serviceRates: { installation: 0, maintenance: 0, removal: 0, inspection: 0 },
      unavailableDates: [],
      services: ['Tag', 'Rastreador', 'Rastreador + Tag'] // Default: Faz tudo
  });
  
  const [newUnavailabilityDate, setNewUnavailabilityDate] = useState('');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [techToDelete, setTechToDelete] = useState<string | null>(null);
  
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
    if (!formData.name || !formData.phone || !formData.email) return;

    const techId = formData.id || crypto.randomUUID();

    const tech: Technician = {
        id: techId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        active: formData.active ?? true,
        color: formData.color,
        serviceLocationType: formData.serviceLocationType,
        serviceRates: formData.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 },
        unavailableDates: formData.unavailableDates || [],
        services: formData.services || []
    };

    await storage.saveTechnician(tech);

    // Create user if new technician
    if (!formData.id) {
        const users = await storage.getAllUsers();
        const existingUser = users.find(u => u.email.toLowerCase() === (tech.email || '').toLowerCase().trim());
        
        if (!existingUser) {
            const hashedPassword = await securityService.hashPassword('123456'); // Default password
            const newUser: User = {
                id: techId,
                name: tech.name,
                email: (tech.email || '').toLowerCase().trim(),
                password: hashedPassword,
                role: 'technician',
                status: 'approved',
                createdAt: Date.now()
            };
            await storage.registerUserRequest(newUser);
        }
    }

    addNotification('success', 'Sucesso', 'Técnico salvo com sucesso.');
    setIsModalOpen(false);
    loadData();
  };

  const handleEdit = (tech: Technician) => {
      setFormData({
          ...tech,
          serviceRates: tech.serviceRates || { installation: 0, maintenance: 0, removal: 0, inspection: 0 },
          unavailableDates: tech.unavailableDates || [],
          services: tech.services || ['Tag', 'Rastreador', 'Rastreador + Tag']
      });
      setNewUnavailabilityDate('');
      setIsModalOpen(true);
  };

  const handleDelete = async (techId: string) => {
      await storage.deleteTechnician(techId);
      addNotification('success', 'Excluído', 'Técnico removido da equipe.');
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

  const updateRate = (type: keyof NonNullable<Technician['serviceRates']>, value: string) => {
      const numValue = parseFloat(value) || 0;
      setFormData(prev => ({
          ...prev,
          serviceRates: {
              ...prev.serviceRates,
              [type]: numValue
          } as any
      }));
  };

  const addUnavailabilityDate = () => {
      if (!newUnavailabilityDate) return;
      
      const currentDates = formData.unavailableDates || [];
      if (!currentDates.includes(newUnavailabilityDate)) {
          const newDates = [...currentDates, newUnavailabilityDate].sort();
          setFormData(prev => ({ ...prev, unavailableDates: newDates }));
      }
      setNewUnavailabilityDate('');
  };

  const removeUnavailabilityDate = (dateToRemove: string) => {
      setFormData(prev => ({
          ...prev,
          unavailableDates: (prev.unavailableDates || []).filter(d => d !== dateToRemove)
      }));
  };

  const toggleService = (service: string) => {
      const current = formData.services || [];
      if (current.includes(service)) {
          setFormData(prev => ({ ...prev, services: current.filter(s => s !== service) }));
      } else {
          setFormData(prev => ({ ...prev, services: [...current, service] }));
      }
  };

  if (user?.role !== 'admin' && user?.role !== 'admin_tecnico') return <div className="p-10 text-center text-zinc-500 uppercase font-black">Acesso Restrito</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Equipe Técnica</h1>
            <p className="text-zinc-500 mt-1 font-medium text-xs">Gestão de instaladores, técnicos de campo e valores.</p>
        </div>
        <button onClick={() => { setFormData({ active: true, color: '#3b82f6', serviceRates: { installation: 0, maintenance: 0, removal: 0, inspection: 0 }, unavailableDates: [], services: ['Tag', 'Rastreador', 'Rastreador + Tag'] }); setIsModalOpen(true); }} className="bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl">
            <Plus size={16} /> Novo Técnico
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map(tech => {
            const count = getActiveCount(tech.id);
            const services = tech.services || ['Tag', 'Rastreador', 'Rastreador + Tag'];
            
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
                                onClick={() => handleEdit(tech)} 
                                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-primary-500 transition-colors"
                                title="Editar Dados"
                            >
                                <Edit2 size={16}/>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setTechToDelete(tech.id); setIsConfirmDeleteOpen(true); }} 
                                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                                title="Excluir Técnico"
                            >
                                <Trash2 size={16}/>
                            </button>
                            <button onClick={() => toggleStatus(tech)} className={`p-2 rounded-xl transition-all ${tech.active ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200'}`}>
                                {tech.active ? <CheckCircle size={20} /> : <XCircle size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Exibição de Skills/Serviços */}
                    <div className="flex flex-wrap gap-1.5 relative z-10">
                        {services.includes('Rastreador') && (
                            <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase flex items-center gap-1"><Radio size={10}/> Rastreador</span>
                        )}
                        {services.includes('Tag') && (
                            <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase flex items-center gap-1"><Tag size={10}/> Tag</span>
                        )}
                        {services.includes('Rastreador + Tag') && (
                            <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 text-[9px] font-black uppercase flex items-center gap-1"><Layers size={10}/> Combo</span>
                        )}
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between relative z-10 mt-auto">
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

      <ResponsiveModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="lg"
        title={formData.id ? 'Editar Técnico' : 'Cadastro de Técnico'}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">Cancelar</button>
            <button type="submit" form="tech-form" className="flex-1 py-3 bg-primary-500 text-black rounded-xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Salvar</button>
          </div>
        }
      >
        <ModalSection>
                <form id="tech-form" onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome Completo</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">E-mail</label>
                        <input type="email" required value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="tecnico@exemplo.com" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Telefone</label>
                        <input type="text" required value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tipo de Atendimento</label>
                        <select 
                            value={formData.serviceLocationType || ''} 
                            onChange={e => setFormData({...formData, serviceLocationType: e.target.value as 'Ponto Fixo' | 'Domicílio'})} 
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none"
                        >
                            <option value="">Selecione o tipo</option>
                            <option value="Ponto Fixo">Ponto Fixo</option>
                            <option value="Domicílio">Domicílio</option>
                        </select>
                    </div>

                    {/* SELEÇÃO DE SERVIÇOS */}
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Habilidades / Serviços</label>
                        <div className="grid grid-cols-1 gap-2">
                            {['Rastreador', 'Tag', 'Rastreador + Tag'].map((svc) => (
                                <Checkbox 
                                  key={svc} 
                                  checked={formData.services?.includes(svc) || false}
                                  onChange={() => toggleService(svc)}
                                >
                                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase">{svc}</span>
                                </Checkbox>
                            ))}
                        </div>
                    </div>
                    
                    {/* SEÇÃO DE TAXAS */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <label className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-3 flex items-center gap-2"><DollarSign size={14}/> Tabela de Preços (R$)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Instalação</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.installation || 0} onChange={e => updateRate('installation', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Manutenção</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.maintenance || 0} onChange={e => updateRate('maintenance', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Retirada</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.removal || 0} onChange={e => updateRate('removal', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Vistoria</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.inspection || 0} onChange={e => updateRate('inspection', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Inst. Tag</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.tagInstallation || 0} onChange={e => updateRate('tagInstallation', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Retirada Tag</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.tagRemoval || 0} onChange={e => updateRate('tagRemoval', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-zinc-400 mb-1 block">Troca Tag</label>
                                <input type="number" step="0.01" value={formData.serviceRates?.tagExchange || 0} onChange={e => updateRate('tagExchange', e.target.value)} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none text-zinc-900 dark:text-white" />
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO DE INDISPONIBILIDADE */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2"><CalendarOff size={14}/> Gestão de Indisponibilidade</label>
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="date" 
                                value={newUnavailabilityDate} 
                                onChange={e => setNewUnavailabilityDate(e.target.value)} 
                                className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none"
                            />
                            <button 
                                type="button" 
                                onClick={addUnavailabilityDate}
                                className="px-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all"
                            >
                                Adicionar
                            </button>
                        </div>
                        
                        {formData.unavailableDates && formData.unavailableDates.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                {formData.unavailableDates.map(date => (
                                    <span key={date} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-800">
                                        {new Date(date + 'T12:00:00').toLocaleDateString()}
                                        <button type="button" onClick={() => removeUnavailabilityDate(date)} className="hover:text-red-500"><X size={12}/></button>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] text-zinc-400 italic">Nenhuma data de folga registrada.</p>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cor na Agenda</label>
                        <div className="flex gap-2 mt-2">
                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                                <button key={c} type="button" onClick={() => setFormData({...formData, color: c})} className={`w-8 h-8 rounded-full border-2 ${formData.color === c ? 'border-white ring-2 ring-zinc-900 dark:ring-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                    {formData.id && (
                        <button 
                            type="button" 
                            onClick={async () => {
                                const users = await storage.getAllUsers();
                                const existingUser = users.find(u => u.email.toLowerCase() === (formData.email || '').toLowerCase().trim());
                                if (!existingUser) {
                                    const hashedPassword = await securityService.hashPassword('123456');
                                    const newUser: User = {
                                        id: formData.id!,
                                        name: formData.name!,
                                        email: (formData.email || '').toLowerCase().trim(),
                                        password: hashedPassword,
                                        role: 'technician',
                                        status: 'approved',
                                        createdAt: Date.now()
                                    };
                                    await storage.registerUserRequest(newUser);
                                    addNotification('success', 'Sucesso', 'Usuário criado para o técnico.');
                                    setIsModalOpen(false);
                                    loadData();
                                } else {
                                    addNotification('error', 'Erro', 'Técnico já possui usuário.');
                                }
                            }}
                            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all"
                        >
                            Registrar Usuário
                        </button>
                    )}
                </form>
        </ModalSection>
      </ResponsiveModal>

      {selectedTechForDetail && (
          <TechnicianStatsModal 
            technician={selectedTechForDetail} 
            schedules={schedules} 
            onClose={() => setSelectedTechForDetail(null)} 
          />
      )}

      <ConfirmModal 
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={() => techToDelete && handleDelete(techToDelete)}
          title="Excluir Técnico"
          message={`Tem certeza que deseja excluir o técnico ${technicians.find(t => t.id === techToDelete)?.name}? Esta ação não pode ser desfeita.`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          type="danger"
      />
    </div>
  );
};
