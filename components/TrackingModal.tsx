
import React, { useState, useMemo } from 'react';
import { Schedule, Technician, ScheduleStatus, User as AppUser } from '../types';
import { Calendar, X, Edit3, Save, Copy, Wrench, MapPin, User, Check, Send, AlertTriangle, ShieldCheck, Zap, CreditCard, Car } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotification } from '../contexts/NotificationContext';

export const RequestStepper = ({ status }: { status: string }) => {
    const steps = [
        { id: 'Solicitada', label: 'Solicitado', active: ['Solicitada', 'Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 'Em análise', label: 'Análise', active: ['Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 'Confirmada', label: 'Agendado', active: ['Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 'Concluída', label: 'Concluído', active: ['Concluída'].includes(status) }
    ];

    if (status === 'Cancelada') {
        return (
            <div className="w-full bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest mt-4">
                <AlertTriangle size={14} /> Solicitação Cancelada
            </div>
        );
    }

    return (
        <div className="w-full px-2 sm:px-4 mt-6 mb-2">
            <div className="flex items-center justify-between relative">
                {/* Linha de Fundo */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0" />
                
                {steps.map((step, idx) => {
                    const isCompleted = step.active;
                    // Se estiver Reagendada, considera visualmente como etapa de Agendado
                    let isCurrent = false;
                    if (status === 'Reagendada' && step.id === 'Confirmada') isCurrent = true;
                    else isCurrent = step.id === status;

                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group flex-1">
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-300'}`}>
                                {isCompleted ? <Check size={10} className="sm:w-3 sm:h-3" strokeWidth={4} /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />}
                            </div>
                            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest absolute -bottom-6 text-center w-20 transition-opacity ${isCompleted || isCurrent ? 'opacity-100 text-emerald-600 dark:text-emerald-400' : 'opacity-60 text-zinc-400 dark:text-zinc-600'}`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="h-4"></div> {/* Espaçador para o texto absolute */}
        </div>
    );
};

interface TrackingModalProps {
    schedule: Schedule;
    technicians: Technician[];
    onClose: () => void;
    onUpdate: (updated: Schedule) => void;
    currentUser?: AppUser | null;
}

export const TrackingModal: React.FC<TrackingModalProps> = ({ schedule, technicians, onClose, onUpdate, currentUser }) => {
    const { addNotification } = useNotification();
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        vehiclePlate: schedule.vehiclePlate,
        vehicleModel: schedule.vehicleModel,
        preferredDate: schedule.preferredDate,
        preferredTime: schedule.preferredTime,
        locationAddress: schedule.locationAddress
    });
    
    const tech = technicians.find(t => t.id === schedule.technicianId);
    
    const analyst = useMemo(() => {
        const historyItem = [...schedule.history].reverse().find(h => h.action === 'Verificando' || h.action === 'Em análise' || h.action === 'Assumiu' || h.statusSnapshot === 'Em análise');
        return historyItem ? historyItem.actionBy : null;
    }, [schedule.history]);

    const dateDisplay = schedule.confirmedDate 
        ? new Date(schedule.confirmedDate + 'T00:00:00').toLocaleDateString() 
        : new Date(schedule.preferredDate + 'T00:00:00').toLocaleDateString();

    const timeDisplay = schedule.confirmedTime || schedule.preferredTime;

    const handleCopyMessage = () => {
        const msg = `AGENDAMENTO CONFIRMADO!
SOLICITANTE: ${schedule.requesterName}
CLIENTE: ${schedule.clientName || 'Não Informado'} ${schedule.clientPhone ? `(${schedule.clientPhone})` : ''}

DATA: ${dateDisplay}
HORA: ${timeDisplay}
TÉCNICO: ${tech?.name || 'A definir'}
VEÍCULO: ${schedule.vehicleModel} (${schedule.vehiclePlate})
DISPOSITIVO: ${schedule.deviceType}
ENDEREÇO: ${schedule.locationAddress}`;

        navigator.clipboard.writeText(msg);
        addNotification('success', 'Copiado', 'Mensagem de confirmação copiada!');
    };

    const handleSaveEdit = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            ...editData,
            vehiclePlate: editData.vehiclePlate.toUpperCase(),
            history: [
                ...schedule.history,
                {
                    action: 'Editou',
                    actionBy: currentUser?.name || 'Usuário',
                    timestamp: Date.now(),
                    details: 'Atualizou informações da solicitação'
                }
            ]
        };
        onUpdate(updatedSchedule);
        setIsEditing(false);
    };

    const handleAssume = () => {
        if (!currentUser) return;
        const updatedSchedule: Schedule = {
            ...schedule,
            status: 'Em análise',
            history: [
                ...schedule.history,
                {
                    action: 'Assumiu',
                    actionBy: currentUser.name,
                    timestamp: Date.now(),
                    details: 'Operador assumiu a responsabilidade'
                }
            ]
        };
        onUpdate(updatedSchedule);
        addNotification('success', 'Assumido', 'Você assumiu este agendamento.');
    };

    const handleWhatsAppClient = () => {
        if (!schedule.clientPhone) return;
        const msg = `Olá, falo sobre o agendamento do veículo ${schedule.vehicleModel} (${schedule.vehiclePlate}).`;
        const url = `https://wa.me/55${schedule.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-white dark:bg-[#0f0f11] w-full max-w-2xl rounded-[24px] md:rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col max-h-[90vh]"
            >
                {/* Header Card */}
                <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                    schedule.status === 'Confirmada' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    schedule.status === 'Em análise' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                    schedule.status === 'Solicitada' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20' :
                                    schedule.status === 'Cancelada' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                }`}>
                                    {schedule.status}
                                </span>
                                {!isEditing && (
                                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[11px] font-bold">
                                        <Calendar size={14}/> {dateDisplay}
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-1 mt-1">
                                <p className="text-[10px] text-zinc-500 font-medium flex items-center gap-1">
                                    Solicitado por: <span className="text-zinc-900 dark:text-zinc-300 font-bold uppercase">{schedule.requesterName}</span>
                                </p>
                                {analyst && (
                                    <p className="text-[10px] text-zinc-500 font-medium flex items-center gap-1">
                                        <ShieldCheck size={12} className="text-primary-500"/> Analisado por: <span className="text-zinc-900 dark:text-zinc-300 font-bold uppercase">{analyst}</span>
                                        {currentUser && currentUser.name !== analyst && (currentUser.role === 'admin' || currentUser.role === 'moderator') && (
                                            <button onClick={handleAssume} className="ml-2 text-[9px] text-primary-500 hover:underline uppercase font-black cursor-pointer">
                                                (Assumir)
                                            </button>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-xl transition-all" title="Editar Informações">
                                    <Edit3 size={18} />
                                </button>
                            )}
                            {isEditing && (
                                <button onClick={handleSaveEdit} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-xl transition-all" title="Salvar">
                                    <Save size={18} />
                                </button>
                            )}
                            {schedule.status === 'Confirmada' && !isEditing && (
                                <button onClick={handleCopyMessage} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-xl transition-all" title="Copiar Mensagem">
                                    <Copy size={18} />
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-xl transition-all">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Placa</label>
                                    <input type="text" value={editData.vehiclePlate} onChange={e => setEditData({...editData, vehiclePlate: e.target.value})} className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-black uppercase text-sm" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Modelo</label>
                                    <input type="text" value={editData.vehicleModel} onChange={e => setEditData({...editData, vehicleModel: e.target.value})} className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-bold text-sm" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-1">{schedule.vehiclePlate}</h2>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl font-bold text-primary-500 uppercase tracking-wide flex items-center gap-2">
                                    <Car size={18}/> {schedule.vehicleModel}
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-white text-[10px] font-black uppercase border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                                    {schedule.deviceType}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-zinc-400">
                                <CreditCard size={14} className="text-emerald-500"/> 
                                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{schedule.fipeValue}</span>
                            </div>
                        </>
                    )}

                    {/* DADOS DO CLIENTE (SGA/HINOVA) */}
                    {(schedule.clientName || schedule.clientPhone) && (
                        <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary-500 text-black flex items-center justify-center font-bold shrink-0">
                                    <User size={20}/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase text-primary-600 dark:text-primary-500 tracking-widest">Cliente</p>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{schedule.clientName || 'Não Informado'}</p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{schedule.clientPhone}</p>
                                </div>
                            </div>
                            {schedule.clientPhone && (
                                <button onClick={handleWhatsAppClient} className="p-3 bg-[#25D366] text-black rounded-xl hover:scale-105 transition-all shadow-lg shrink-0">
                                    <Send size={18}/>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Details Box */}
                    <div className="mt-6 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 md:p-6 space-y-4">
                        <div className="flex items-start gap-4">
                            <Wrench className="text-zinc-400 mt-0.5" size={16} />
                            <div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Serviço</p>
                                <p className="text-sm font-bold text-blue-500 dark:text-blue-400">{schedule.serviceType}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <MapPin className="text-zinc-400 mt-0.5" size={16} />
                            <div className="w-full min-w-0">
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Local</p>
                                {isEditing ? (
                                    <input type="text" value={editData.locationAddress} onChange={e => setEditData({...editData, locationAddress: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white text-xs mt-1" />
                                ) : (
                                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-snug break-words">{schedule.locationAddress}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-4 bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                            <Calendar className="text-emerald-500 mt-0.5" size={16} />
                            <div className="w-full">
                                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Agendado / Preferência</p>
                                {isEditing ? (
                                    <div className="flex gap-2 mt-1">
                                        <input type="date" value={editData.preferredDate} onChange={e => setEditData({...editData, preferredDate: e.target.value})} className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white text-xs" />
                                        <input type="time" value={editData.preferredTime} onChange={e => setEditData({...editData, preferredTime: e.target.value})} className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white text-xs" />
                                    </div>
                                ) : (
                                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{dateDisplay} às {timeDisplay}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stepper Visual no Modal */}
                    <div className="mt-8 mb-4">
                        <RequestStepper status={schedule.status} />
                    </div>

                    {/* Footer Técnico */}
                    {(tech || schedule.status === 'Confirmada') && (
                        <div className="mt-6 bg-zinc-100 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-black shrink-0">
                                {tech?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Técnico Responsável</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">{tech?.name || 'A definir'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
