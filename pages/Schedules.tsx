
import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { Schedule, Technician, Company } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { TrackingModal } from '../components/TrackingModal';
import {
    LayoutGrid, Calendar, CheckCircle2, XCircle, Wrench, Activity, RotateCcw,
    User, MapPin, Clock, Timer, Search, Filter, AlertCircle, Hash, ChevronRight,
    Maximize2, Check, History, Hourglass, Copy, Radio, Car, Phone, ScanBarcode
} from 'lucide-react';

// --- COMPONENTES AUXILIARES ---

const WaitTimer = ({ startTime }: { startTime: number }) => {
    const [elapsed, setElapsed] = useState(Date.now() - startTime);

    useEffect(() => {
        const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let display = '';
    if (days > 0) display = `${days}d ${hours % 24}h`;
    else if (hours > 0) display = `${hours}h ${minutes % 60}m`;
    else display = `${minutes}m ${Math.floor((elapsed % 60000) / 1000)}s`;

    return <span>{display}</span>;
};

// Stepper Visual Aumentado para o Card do Usuário
const UserStepper = ({ status }: { status: string }) => {
    const steps = [
        { id: 1, label: 'SOLICITADO', active: ['Solicitada', 'Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 2, label: 'ANÁLISE', active: ['Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 3, label: 'AGENDADO', active: ['Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 4, label: 'CONCLUÍDO', active: ['Concluída'].includes(status) }
    ];

    return (
        <div className="flex items-center justify-between relative mt-6 px-4 mb-2">
            {/* Linha de fundo */}
            <div className="absolute left-0 top-[14px] w-full h-[3px] bg-zinc-100 dark:bg-zinc-800 -z-0 rounded-full" />
            
            {steps.map((step, idx) => {
                // Se o status for "Cancelada", mostra um estado diferente ou apenas o primeiro passo
                if (status === 'Cancelada') return null;

                return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-3 group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[3px] transition-all duration-500 ${step.active ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900/50 text-white shadow-lg shadow-emerald-500/20 scale-110' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-transparent'}`}>
                            <Check size={14} strokeWidth={4} />
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${step.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-700'}`}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
            
            {status === 'Cancelada' && (
                <div className="w-full text-center">
                    <span className="bg-red-100 text-red-600 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest border border-red-200">
                        Processo Cancelado
                    </span>
                </div>
            )}
        </div>
    );
};

export const Schedules = () => {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    
    // States para Admin
    const [adminTab, setAdminTab] = useState<'pending' | 'scheduled' | 'history'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    
    // States para User
    const [userTab, setUserTab] = useState<'active' | 'history'>('active');

    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

    // Carregamento de Dados
    useEffect(() => {
        const load = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const role = (user.role === 'admin' || user.role === 'moderator') ? 'admin' : 'user';
                const [sch, techs, comps] = await Promise.all([
                    storage.getSchedules(role, user.id),
                    storage.getTechnicians(),
                    storage.getCompanies()
                ]);
                setSchedules(sch.sort((a, b) => b.createdAt - a.createdAt)); // Mais recentes primeiro
                setTechnicians(techs);
                setCompanies(comps);
            } finally {
                setLoading(false);
            }
        };
        load();

        if (user) {
            const role = (user.role === 'admin' || user.role === 'moderator') ? 'admin' : 'user';
            const unsub = storage.subscribeToSchedules(role, user.id, (data) => {
                setSchedules(data.sort((a, b) => b.createdAt - a.createdAt));
            });
            return () => unsub();
        }
    }, [user]);

    const handleUpdateSchedule = async (updated: Schedule) => {
        await storage.saveSchedule(updated);
        setSelectedSchedule(updated);
        addNotification('success', 'Atualizado', 'Status do agendamento atualizado.');
    };

    const handleDeleteSchedule = async (id: string) => {
        if (confirm('Excluir permanentemente este agendamento?')) {
            await storage.deleteSchedule(id);
            setSelectedSchedule(null);
            addNotification('success', 'Excluído', 'Agendamento removido.');
        }
    };

    const handleCopyConfirmation = (e: React.MouseEvent, s: Schedule) => {
        e.stopPropagation();
        
        const dateDisplay = s.confirmedDate ? s.confirmedDate.split('-').reverse().join('/') : (s.preferredDate ? s.preferredDate.split('-').reverse().join('/') : 'A definir');
        const timeDisplay = s.confirmedTime || s.preferredTime || '--:--';
        
        // Encontra o técnico no estado atual
        const tech = technicians.find(t => t.id === s.technicianId);
        const techName = tech ? tech.name : 'A definir';

        // Padrão solicitado:
        const msg = `AGENDAMENTO CONFIRMADO!\n` +
            `SOLICITANTE: ${s.requesterName}\n\n` +
            `DATA: ${dateDisplay}\n` +
            `HORA: ${timeDisplay}\n` +
            `TÉCNICO: ${techName}\n` +
            `VEÍCULO: ${s.vehicleModel} (${s.vehiclePlate})\n` +
            `DISPOSITIVO: ${s.deviceType}\n` +
            `ENDEREÇO: ${s.locationAddress}`;

        navigator.clipboard.writeText(msg);
        addNotification('success', 'Sucesso', 'Mensagem copiada com sucesso');
    };

    // --- LÓGICA E RENDERIZAÇÃO PARA PERFIL 'USER' ---
    if (user?.role === 'user') {
        const userFilteredList = useMemo(() => {
            if (userTab === 'active') {
                return schedules.filter(s => ['Solicitada', 'Em análise', 'Confirmada', 'Reagendada'].includes(s.status));
            }
            return schedules.filter(s => ['Concluída', 'Cancelada'].includes(s.status));
        }, [schedules, userTab]);

        return (
            <div className="space-y-8 pb-24 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Minhas Solicitações</h1>
                        <p className="text-zinc-500 mt-1 font-medium text-xs">Acompanhe o andamento dos serviços em sua frota.</p>
                    </div>
                    <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                        <button 
                            onClick={() => setUserTab('active')}
                            className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${userTab === 'active' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                        >
                            <Hourglass size={14} /> Em Andamento
                        </button>
                        <button 
                            onClick={() => setUserTab('history')}
                            className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${userTab === 'history' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                        >
                            <History size={14} /> Histórico
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    {userFilteredList.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4">
                            <LayoutGrid size={48} className="text-zinc-400 dark:text-zinc-600"/>
                            <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Nenhuma solicitação nesta aba</span>
                        </div>
                    ) : (
                        userFilteredList.map(item => {
                            // Identifica o Técnico atribuído
                            const assignedTech = technicians.find(t => t.id === item.technicianId);
                            const techName = assignedTech ? assignedTech.name : 'Aguardando Técnico';
                            const techColor = assignedTech?.color || '#cbd5e1';

                            return (
                                <div 
                                    key={item.id} 
                                    className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all relative overflow-hidden group"
                                >
                                    {/* Top Bar: Status e Ações */}
                                    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                                                item.status === 'Solicitada' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/30' :
                                                item.status === 'Em análise' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/30' :
                                                item.status === 'Confirmada' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30' :
                                                'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                            }`}>
                                                {item.status}
                                            </span>
                                            {(item.status === 'Solicitada' || item.status === 'Em análise') && (
                                                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50 flex items-center gap-1.5">
                                                    <Timer size={12}/> <WaitTimer startTime={item.createdAt} />
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => handleCopyConfirmation(e, item)}
                                                className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/30"
                                                title="Copiar confirmação para cliente"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button 
                                                onClick={() => setSelectedSchedule(item)}
                                                className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700"
                                            >
                                                <Maximize2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dados do Veículo */}
                                    <div className="mb-8">
                                        <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{item.vehiclePlate}</h2>
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                            {item.vehicleModel}
                                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"/>
                                            <span className="text-primary-500">{item.deviceType}</span>
                                        </p>

                                        {/* IMEI Destacado */}
                                        {item.installedImei && (
                                            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-500/30 rounded-2xl flex items-center gap-3 w-fit animate-in slide-in-from-left-2 duration-300">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                                    <ScanBarcode size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Equipamento Vinculado</p>
                                                    <p className="text-sm font-mono font-bold text-zinc-900 dark:text-white tracking-wider">{item.installedImei}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Grid de Detalhes Completo */}
                                    <div className="bg-zinc-50/80 dark:bg-zinc-950/50 rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800/50 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        
                                        {/* Coluna 1 */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                    <User size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Técnico Responsável</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {assignedTech && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: techColor }} />}
                                                        <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">{techName}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                    <User size={16} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Cliente / Solicitante</p>
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">{item.clientName || item.requesterName}</p>
                                                    {item.clientPhone && <p className="text-[10px] text-zinc-400 font-mono truncate">{item.clientPhone}</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                    <Wrench size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tipo de Serviço</p>
                                                    <p className={`text-xs font-bold uppercase truncate ${item.serviceType === 'Instalação' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{item.serviceType}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Coluna 2 */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800">
                                                    <Calendar size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Data & Hora</p>
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">
                                                        {item.confirmedDate ? `${new Date(item.confirmedDate).toLocaleDateString()} às ${item.confirmedTime}` : `${new Date(item.preferredDate).toLocaleDateString()} (Pref.)`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100 dark:border-zinc-800 shrink-0">
                                                    <MapPin size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Localização</p>
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight mt-0.5 line-clamp-2" title={item.locationAddress}>
                                                        {item.locationAddress}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stepper */}
                                    <div className="pt-2">
                                        <UserStepper status={item.status} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {selectedSchedule && (
                    <TrackingModal 
                        schedule={selectedSchedule} 
                        technicians={technicians} 
                        companies={companies}
                        onClose={() => setSelectedSchedule(null)} 
                        onUpdate={handleUpdateSchedule}
                        currentUser={user}
                    />
                )}
            </div>
        );
    }

    // --- LÓGICA E RENDERIZAÇÃO PARA PERFIL 'ADMIN/MODERATOR' ---
    // (Mantém o código original do dashboard complexo)
    
    // Função para calcular o ID Sequencial do Dia
    const getDailySequence = (currentSchedule: Schedule) => {
        const sameDaySchedules = schedules.filter(s => 
            s.preferredDate === currentSchedule.preferredDate
        ).sort((a, b) => a.createdAt - b.createdAt);
        const index = sameDaySchedules.findIndex(s => s.id === currentSchedule.id);
        return String(index + 1).padStart(2, '0');
    };

    const adminStats = {
        totalMonth: schedules.filter(s => new Date(s.createdAt).getMonth() === new Date().getMonth()).length,
        agendadas: schedules.filter(s => ['Confirmada', 'Reagendada'].includes(s.status)).length,
        concluidas: schedules.filter(s => s.status === 'Concluída').length,
        canceladas: schedules.filter(s => s.status === 'Cancelada').length,
        instalacao: schedules.filter(s => s.serviceType === 'Instalação').length,
        manutencao: schedules.filter(s => s.serviceType === 'Manutenção').length,
        retirada: schedules.filter(s => s.serviceType === 'Retirada').length,
        pendentes: schedules.filter(s => ['Solicitada', 'Em análise'].includes(s.status)).length
    };

    const adminFilteredList = useMemo(() => {
        let list = [];
        switch (adminTab) {
            case 'pending': list = schedules.filter(s => ['Solicitada', 'Em análise'].includes(s.status)); break;
            case 'scheduled': list = schedules.filter(s => ['Confirmada', 'Reagendada'].includes(s.status)); break;
            case 'history': list = schedules.filter(s => ['Concluída', 'Cancelada'].includes(s.status)); break;
        }
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            list = list.filter(s => {
                const techName = technicians.find(t => t.id === s.technicianId)?.name || '';
                return (
                    s.vehiclePlate.toLowerCase().includes(lowerTerm) ||
                    s.vehicleModel.toLowerCase().includes(lowerTerm) ||
                    s.requesterName.toLowerCase().includes(lowerTerm) ||
                    techName.toLowerCase().includes(lowerTerm)
                );
            });
        }
        return list;
    }, [schedules, adminTab, searchTerm, technicians]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'Confirmada': return 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
            case 'Solicitada': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-500 dark:border-yellow-500/20';
            case 'Em análise': return 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
            case 'Reagendada': return 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20';
            case 'Cancelada': return 'bg-red-100 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
            default: return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
        }
    };

    const getBorderColor = (status: string) => {
        switch(status) {
            case 'Confirmada': return 'border-l-emerald-500';
            case 'Solicitada': return 'border-l-yellow-500';
            case 'Em análise': return 'border-l-blue-500';
            case 'Reagendada': return 'border-l-orange-500';
            case 'Cancelada': return 'border-l-red-500';
            default: return 'border-l-zinc-500';
        }
    };

    const formatDateDisplay = (dateString: string) => {
        if (!dateString) return '';
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <div className="space-y-8 pb-24">
            {/* Header Admin */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Central de Agendamentos</h1>
                    <p className="text-zinc-500 mt-1 font-medium text-xs">Gerencie solicitações e a agenda da equipe técnica.</p>
                </div>
            </div>

            {/* Stats Admin */}
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                <div className="min-w-[160px] p-5 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200 dark:border-zinc-800 relative overflow-hidden shrink-0 shadow-sm">
                    <div className="relative z-10">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total no Mês</p>
                        <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white">{adminStats.totalMonth}</h3>
                    </div>
                    <LayoutGrid className="absolute right-[-10px] bottom-[-10px] text-zinc-100 dark:text-zinc-800 opacity-80" size={60} />
                </div>
                <div className="min-w-[160px] p-5 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200 dark:border-zinc-800 relative overflow-hidden shrink-0 shadow-sm">
                    <div className="relative z-10">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Agendadas</p>
                        <h3 className="text-3xl font-display font-black text-blue-500">{adminStats.agendadas}</h3>
                    </div>
                    <Calendar className="absolute right-[-10px] bottom-[-10px] text-blue-50 dark:text-blue-900/20" size={60} />
                </div>
                <div className="min-w-[160px] p-5 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200 dark:border-zinc-800 relative overflow-hidden shrink-0 shadow-sm">
                    <div className="relative z-10">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Concluídas</p>
                        <h3 className="text-3xl font-display font-black text-emerald-500">{adminStats.concluidas}</h3>
                    </div>
                    <CheckCircle2 className="absolute right-[-10px] bottom-[-10px] text-emerald-50 dark:text-emerald-900/20" size={60} />
                </div>
                <div className="min-w-[160px] p-5 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200 dark:border-zinc-800 relative overflow-hidden shrink-0 shadow-sm">
                    <div className="relative z-10">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Canceladas</p>
                        <h3 className="text-3xl font-display font-black text-red-500">{adminStats.canceladas}</h3>
                    </div>
                    <XCircle className="absolute right-[-10px] bottom-[-10px] text-red-50 dark:text-red-900/20" size={60} />
                </div>
                <div className="flex flex-col justify-between gap-2 shrink-0">
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl flex items-center gap-3 min-w-[140px]">
                        <Wrench size={14} className="text-blue-500"/>
                        <div>
                            <span className="text-[8px] font-black text-blue-400 uppercase block">Instalação</span>
                            <span className="text-sm font-black text-blue-900 dark:text-white leading-none">{adminStats.instalacao}</span>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl flex items-center gap-3 min-w-[140px]">
                        <Activity size={14} className="text-orange-500"/>
                        <div>
                            <span className="text-[8px] font-black text-orange-400 uppercase block">Manutenção</span>
                            <span className="text-sm font-black text-orange-900 dark:text-white leading-none">{adminStats.manutencao}</span>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-center gap-3 min-w-[140px]">
                        <RotateCcw size={14} className="text-red-500"/>
                        <div>
                            <span className="text-[8px] font-black text-red-400 uppercase block">Retirada</span>
                            <span className="text-sm font-black text-red-900 dark:text-white leading-none">{adminStats.retirada}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controles Admin */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-full w-full lg:w-auto overflow-x-auto">
                    <button onClick={() => setAdminTab('pending')} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'pending' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>
                        <AlertCircle size={14} /> Pendentes ({adminStats.pendentes})
                    </button>
                    <button onClick={() => setAdminTab('scheduled')} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'scheduled' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>
                        <Calendar size={14} /> Agendados ({adminStats.agendadas})
                    </button>
                    <button onClick={() => setAdminTab('history')} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${adminTab === 'history' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>
                        <RotateCcw size={14} /> Histórico
                    </button>
                </div>

                <div className="relative w-full lg:w-96">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"/>
                    <input 
                        type="text" 
                        placeholder="Pesquisar placa, solicitante ou técnico..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:border-primary-500 transition-all text-zinc-900 dark:text-white"
                    />
                </div>
            </div>

            {/* GRID ADMIN */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {adminFilteredList.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30 gap-4">
                        <LayoutGrid size={48} className="text-zinc-400 dark:text-zinc-600"/>
                        <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Nenhum agendamento nesta categoria</span>
                    </div>
                ) : (
                    adminFilteredList.map(item => {
                        const tech = technicians.find(t => t.id === item.technicianId);
                        const dailyId = getDailySequence(item);
                        const displayDate = formatDateDisplay(item.preferredDate);

                        return (
                            <div 
                                key={item.id}
                                onClick={() => setSelectedSchedule(item)}
                                className={`bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group relative flex flex-col justify-between border-l-4 ${getBorderColor(item.status)}`}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border w-fit ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                        <div className="flex items-center gap-1 text-zinc-400">
                                            <Hash size={12}/>
                                            <span className="text-xs font-mono font-black">{dailyId}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{displayDate}</span>
                                        {adminTab === 'pending' && <WaitTimer startTime={item.createdAt} />}
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{item.vehiclePlate}</h3>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mt-1">{item.vehicleModel}</p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 group/item">
                                        <User size={14} className="text-zinc-400 shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Solicitante:</span>
                                            <span className="text-[10px] font-bold uppercase truncate text-zinc-800 dark:text-zinc-300">{item.requesterName}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 group/item">
                                        <User size={14} className="text-zinc-400 shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Cliente:</span>
                                            <span className="text-[10px] font-bold uppercase truncate text-zinc-800 dark:text-zinc-300">{item.clientName || 'N/A'}</span>
                                            {item.clientPhone && <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1"><Phone size={8}/> {item.clientPhone}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 group/item">
                                        <Wrench size={14} className="text-zinc-400 shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Serviço:</span>
                                            <span className={`text-[10px] font-bold uppercase truncate ${item.serviceType === 'Instalação' ? 'text-blue-500' : item.serviceType === 'Manutenção' ? 'text-orange-500' : 'text-red-500'}`}>
                                                {item.serviceType}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 group/item">
                                        <MapPin size={14} className="text-zinc-400 shrink-0" />
                                        <div className="flex flex-col min-w-0 w-full">
                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Local:</span>
                                            <span className="text-[10px] font-bold uppercase truncate w-full block" title={item.locationAddress}>
                                                {item.locationAddress}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {item.installedImei && (
                                    <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2 rounded-xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20">
                                        <ScanBarcode size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">IMEI: {item.installedImei}</span>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">TÉCNICO</span>
                                        {tech ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tech.color || '#ccc' }} />
                                                <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase">{tech.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-zinc-400 italic">-- A definir --</span>
                                        )}
                                    </div>
                                    
                                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-primary-500 group-hover:text-black transition-all shadow-sm">
                                        <Filter size={12} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedSchedule && (
                <TrackingModal 
                    schedule={selectedSchedule} 
                    technicians={technicians}
                    companies={companies} 
                    onClose={() => setSelectedSchedule(null)} 
                    onUpdate={handleUpdateSchedule}
                    onDelete={handleDeleteSchedule}
                    currentUser={user}
                />
            )}
        </div>
    );
};
