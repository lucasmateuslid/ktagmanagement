
import React, { useState, useEffect } from 'react';
import { Schedule, Technician, ScheduleStatus, User as AppUser, Company } from '../types';
import { 
    Calendar, X, Save, Copy, Wrench, MapPin, User, Check, Send, 
    Eye, Trash2, CheckCircle2, History, ExternalLink, CalendarDays,
    Briefcase, UserCircle2, Clock, AlertTriangle, Edit2, MessageCircle, Phone, Building2, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../contexts/NotificationContext';

const MotionDiv = motion.div as any;

// --- COMPONENTES AUXILIARES ---

const RequestStepper = ({ status, reason }: { status: string, reason?: string }) => {
    const steps = [
        { id: 'Solicitada', label: 'Solicitado', active: ['Solicitada', 'Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 'Em análise', label: 'Análise', active: ['Em análise', 'Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 'Confirmada', label: 'Agendado', active: ['Confirmada', 'Reagendada', 'Concluída'].includes(status) },
        { id: 'Concluída', label: 'Concluído', active: ['Concluída'].includes(status) }
    ];

    if (status === 'Cancelada') {
        return (
            <div className="w-full bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 flex flex-col items-center justify-center gap-2 mt-6">
                <div className="flex items-center gap-2 text-red-500">
                    <XCircle size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Solicitação Cancelada</span>
                </div>
                {reason && (
                    <div className="text-xs font-medium text-red-600 dark:text-red-400 text-center max-w-[80%]">
                        "{reason}"
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full px-4 mt-8 mb-2">
            <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-[14px] w-full h-[2px] bg-zinc-100 dark:bg-zinc-800 rounded-full z-0" />
                {steps.map((step, idx) => {
                    const isCompleted = step.active;
                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-[3px] transition-all duration-500 ${isCompleted ? 'bg-emerald-500 border-emerald-100 dark:border-emerald-900/50 text-white shadow-lg shadow-emerald-500/30 scale-110' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-300'}`}>
                                {isCompleted && <Check size={14} strokeWidth={4} />}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

interface TrackingModalProps {
    schedule: Schedule;
    technicians: Technician[];
    companies?: Company[]; // Added companies prop
    onClose: () => void;
    onUpdate: (updated: Schedule) => void;
    onDelete?: (id: string) => void;
    currentUser?: AppUser | null;
}

export const TrackingModal: React.FC<TrackingModalProps> = ({ schedule, technicians, companies = [], onClose, onUpdate, onDelete, currentUser }) => {
    const { addNotification } = useNotification();
    const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

    // State for Edits (Shared)
    const [formData, setFormData] = useState({
        technicianId: schedule.technicianId || '',
        date: schedule.confirmedDate || schedule.preferredDate,
        time: schedule.confirmedTime || schedule.preferredTime,
        locationAddress: schedule.locationAddress
    });

    const [isUserEditing, setIsUserEditing] = useState(false);
    
    // States para cancelamento
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const formatSafeDate = (dateString: string) => {
        if (!dateString) return '';
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}/${y}`;
    };

    const assignedTech = technicians.find(t => t.id === schedule.technicianId);
    const responsibleCompany = companies.find(c => c.id === schedule.companyId);

    // Funções de Admin
    const handleUpdateStatus = (status: ScheduleStatus) => {
        if (!currentUser) return;
        
        const updatedSchedule: Schedule = {
            ...schedule,
            status,
            ...(status === 'Confirmada' || status === 'Reagendada' ? {
                technicianId: formData.technicianId,
                confirmedDate: formData.date,
                confirmedTime: formData.time
            } : {}),
            history: [
                ...schedule.history,
                {
                    action: status === 'Em análise' ? 'Verificando' : status,
                    actionBy: currentUser.name,
                    timestamp: Date.now(),
                    statusSnapshot: status,
                    details: (status === 'Confirmada' || status === 'Reagendada') ? `Agendado para ${formData.date} às ${formData.time}` : undefined
                }
            ]
        };

        if (status === 'Em análise' && !updatedSchedule.analysisStartedAt) {
            updatedSchedule.analysisStartedAt = Date.now();
        }

        onUpdate(updatedSchedule);
        if (status === 'Confirmada') addNotification('success', 'Confirmado', 'Agendamento e técnico atribuídos!');
        else if (status === 'Reagendada') addNotification('success', 'Reagendado', 'Data e hora atualizadas.');
        else if (status === 'Concluída') addNotification('success', 'Finalizado', 'Ordem de serviço concluída.');
    };

    const handleConfirmCancel = () => {
        if (!currentUser) return;
        if (!cancelReason.trim()) {
            addNotification('error', 'Obrigatório', 'Informe o motivo do cancelamento.');
            return;
        }
        
        const updatedSchedule: Schedule = {
            ...schedule,
            status: 'Cancelada',
            cancellationReason: cancelReason,
            history: [
                ...schedule.history,
                {
                    action: 'Cancelada',
                    actionBy: currentUser.name,
                    timestamp: Date.now(),
                    statusSnapshot: 'Cancelada',
                    details: `Motivo: ${cancelReason}`
                }
            ]
        };
        onUpdate(updatedSchedule);
        addNotification('success', 'Cancelado', 'Solicitação cancelada com sucesso.');
        setIsCancelling(false);
    };

    const handleAdminSave = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            technicianId: formData.technicianId,
            confirmedDate: formData.date,
            confirmedTime: formData.time,
            locationAddress: formData.locationAddress, // Permite admin corrigir endereço
            history: [...schedule.history, { action: 'Editou', actionBy: currentUser?.name || 'Admin', timestamp: Date.now(), details: 'Atualizou dados de agendamento' }]
        };
        onUpdate(updatedSchedule);
        addNotification('success', 'Atualizado', 'Dados da solicitação salvos.');
    };

    const handleSendToTechnician = () => {
        const dateDisplay = formData.date ? formatSafeDate(formData.date) : 'A definir';
        const timeDisplay = formData.time || '--:--';
        const companyName = responsibleCompany ? responsibleCompany.name : 'Não informada';
        const clientPhone = schedule.clientPhone ? schedule.clientPhone : 'Não informado';
        
        const mapLink = schedule.locationLat && schedule.locationLng 
            ? `https://www.google.com/maps?q=${schedule.locationLat},${schedule.locationLng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.locationAddress)}`;

        // Campos adicionais
        const vistoriaTxt = schedule.needsInspection ? 'Sim' : 'Não';
        const pagtoTxt = schedule.paymentOnSite ? 'Sim' : 'Não';

        const msg = `*NOVA SOLICITAÇÃO TÉCNICA*\n\n` +
            `🏢 *Regional:* ${companyName}\n` +
            `🚗 *Veículo:* ${schedule.vehicleModel}\n` +
            `🪪 *Placa:* ${schedule.vehiclePlate}\n` +
            `👤 *Cliente:* ${schedule.clientName || 'Cliente'} (${clientPhone})\n` +
            `📡 *Equipamento:* ${schedule.deviceType}\n` +
            `🔧 *Serviço:* ${schedule.serviceType}\n` +
            `📋 *Necessita de vistoria?* ${vistoriaTxt}\n` +
            `💰 *Pagamento no local?* ${pagtoTxt}\n` +
            `📅 *Data Pref:* ${dateDisplay} às ${timeDisplay}\n` +
            `📍 *Local:* ${formData.locationAddress}\n` +
            `🗺 *Google Maps:* ${mapLink}`;

        const encodedMsg = encodeURIComponent(msg);
        let url = `https://wa.me/?text=${encodedMsg}`;
        if (formData.technicianId) {
            const selectedTech = technicians.find(t => t.id === formData.technicianId);
            if (selectedTech?.phone) {
                const cleanPhone = selectedTech.phone.replace(/\D/g, '');
                url = `https://wa.me/55${cleanPhone}?text=${encodedMsg}`;
            }
        }
        window.open(url, '_blank');
    };

    // Função de Usuário Comum Salvar
    const handleUserSave = () => {
        const updatedSchedule: Schedule = {
            ...schedule,
            // Se ainda não confirmada, atualiza preferência
            ...(schedule.status === 'Solicitada' || schedule.status === 'Em análise' ? {
                preferredDate: formData.date,
                preferredTime: formData.time
            } : {
                // Se já confirmada, atualiza confirmed
                confirmedDate: formData.date,
                confirmedTime: formData.time
            }),
            locationAddress: formData.locationAddress,
            history: [...schedule.history, { action: 'Atualizou', actionBy: currentUser?.name || 'Usuário', timestamp: Date.now(), details: 'Atualizou local/data de preferência' }]
        };
        
        onUpdate(updatedSchedule);
        setIsUserEditing(false);
        addNotification('success', 'Atualizado', 'Suas alterações foram salvas.');
    };

    // --- NOVA FORMATAÇÃO DE CÓPIA ---
    const handleCopyClientMessage = () => {
        const dateDisplay = schedule.confirmedDate ? formatSafeDate(schedule.confirmedDate) : formatSafeDate(schedule.preferredDate);
        const timeDisplay = schedule.confirmedTime || schedule.preferredTime || '--:--';
        const techDisplay = assignedTech ? assignedTech.name : 'A definir';
        
        const msg = `AGENDAMENTO CONFIRMADO!\n` +
            `SOLICITANTE: ${schedule.requesterName}\n\n` +
            `DATA: ${dateDisplay}\n` +
            `HORA: ${timeDisplay}\n` +
            `TÉCNICO: ${techDisplay}\n` +
            `VEÍCULO: ${schedule.vehicleModel} (${schedule.vehiclePlate})\n` +
            `DISPOSITIVO: ${schedule.deviceType}\n` +
            `ENDEREÇO: ${schedule.locationAddress}`;

        navigator.clipboard.writeText(msg);
        addNotification('success', 'Sucesso', 'Mensagem copiada com sucesso');
    };

    // --- LAYOUT ADMIN / MODERADOR (2 COLUNAS + HISTÓRICO) ---
    if (isPrivileged) {
        return (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
                <MotionDiv 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col md:flex-row max-h-[95vh] md:max-h-[85vh] overflow-y-auto md:overflow-hidden"
                >
                    {/* COLUNA ESQUERDA: CONTROLES */}
                    <div className="w-full md:w-[60%] flex flex-col h-auto md:h-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white relative border-r border-zinc-200 dark:border-zinc-800">
                        {/* Header Fixo */}
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 sticky top-0 bg-white dark:bg-zinc-900 z-10 md:relative">
                            <h2 className="text-xl font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white">Gerenciar Solicitação</h2>
                            <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-all"><X size={20}/></button>
                        </div>

                        {/* Conteúdo Scrollável */}
                        <div className="flex-1 overflow-visible md:overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0">
                            
                            {/* Bloco de Informações Principais */}
                            <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1">Solicitante</p>
                                        <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase">{schedule.requesterName}</p>
                                        {schedule.clientName && (
                                            <div className="mt-1">
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">Cliente: {schedule.clientName}</p>
                                                {schedule.clientPhone && (
                                                    <p className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono"><Phone size={10}/> {schedule.clientPhone}</p>
                                                )}
                                            </div>
                                        )}
                                        {responsibleCompany && (
                                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 w-fit">
                                                <Building2 size={10}/> {responsibleCompany.name}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                                        <Clock size={12} className="text-zinc-400"/>
                                        <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-300">{new Date(schedule.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full mb-4" />

                                <div className="mb-2 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest">Veículo</span>
                                    <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[9px] px-2 py-0.5 rounded font-black uppercase">{schedule.serviceType}</span>
                                </div>
                                <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-1">{schedule.vehiclePlate}</h1>
                                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                                    {schedule.vehicleModel} <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"/> {schedule.deviceType}
                                </p>

                                {/* Informações Adicionais (Vistoria/Pagamento) */}
                                <div className="flex gap-2 mt-4 flex-wrap">
                                    {schedule.needsInspection && (
                                        <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                                            ⚠️ Necessita Vistoria
                                        </span>
                                    )}
                                    {schedule.paymentOnSite && (
                                        <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                                            💰 Pagamento no Local
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
                                    <MapPin size={16} className="text-red-500 shrink-0 mt-0.5"/>
                                    <div className="w-full">
                                        {/* Admin pode editar endereço aqui se quiser, basta mudar o input */}
                                        <input 
                                            type="text" 
                                            value={formData.locationAddress} 
                                            onChange={e => setFormData({...formData, locationAddress: e.target.value})}
                                            className="w-full bg-transparent border-none p-0 text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:ring-0 focus:outline-none"
                                        />
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.locationAddress)}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[9px] font-black text-[#f59e0b] uppercase tracking-widest inline-flex items-center gap-1 hover:underline mt-1"
                                        >
                                            Ver no Mapa <ExternalLink size={10}/>
                                        </a>
                                    </div>
                                </div>
                                {schedule.notes && (
                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl">
                                        <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest mb-1">Observações do Solicitante</p>
                                        <p className="text-xs text-blue-900 dark:text-blue-100 font-medium">{schedule.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Inputs de Controle */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1.5 block">Atribuir Técnico</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={formData.technicianId} 
                                            onChange={e => setFormData({...formData, technicianId: e.target.value})} 
                                            className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-primary-500"
                                        >
                                            <option value="">-- Selecione --</option>
                                            {technicians.filter(t => t.active).map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <button 
                                            onClick={handleSendToTechnician}
                                            className="px-4 bg-[#25D366] hover:bg-[#1fb550] text-white rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95"
                                            title="Enviar WhatsApp"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1.5 block">Data</label>
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-widest mb-1.5 block">Hora</label>
                                        <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                                    </div>
                                </div>
                                
                                <button onClick={handleAdminSave} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-transparent border-zinc-200 dark:border-zinc-800">
                                    <Save size={14}/> Salvar Alterações (Sem mudar status)
                                </button>
                            </div>
                        </div>

                        {/* Footer de Ações (Fixo) */}
                        <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                            {isCancelling ? (
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20">
                                    <div className="flex items-center gap-2 text-red-500 mb-2">
                                        <AlertTriangle size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Motivo do Cancelamento</span>
                                    </div>
                                    <textarea 
                                        value={cancelReason} 
                                        onChange={e => setCancelReason(e.target.value)}
                                        className="w-full bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-900/30 rounded-xl p-3 text-xs font-medium outline-none focus:border-red-500 mb-3 text-zinc-700 dark:text-zinc-300"
                                        placeholder="Descreva o motivo..."
                                        rows={2}
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsCancelling(false)} className="flex-1 py-2 bg-white dark:bg-zinc-950 text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase hover:bg-zinc-50 dark:hover:bg-zinc-900">Voltar</button>
                                        <button onClick={handleConfirmCancel} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-700">Confirmar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {schedule.status === 'Solicitada' && (
                                            <button onClick={() => handleUpdateStatus('Em análise')} className="col-span-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                                                <Eye size={18}/> Marcar como Verificando
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleUpdateStatus('Confirmada')} 
                                            className={`py-4 bg-[#10b981] hover:bg-[#059669] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 ${schedule.status === 'Confirmada' ? 'col-span-1' : 'col-span-2'}`}
                                        >
                                            <CheckCircle2 size={18}/> Confirmar Agendamento
                                        </button>
                                        {schedule.status === 'Confirmada' && (
                                            <button onClick={() => handleUpdateStatus('Reagendada')} className="py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                                                <CalendarDays size={18}/> Reagendar
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => handleUpdateStatus('Concluída')} className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg hover:bg-zinc-800 dark:hover:bg-zinc-200">
                                            <Check size={16} /> Finalizar Serviço
                                        </button>
                                        <button onClick={() => setIsCancelling(true)} className="px-6 py-3 bg-zinc-100 dark:bg-zinc-950 text-red-500 border border-zinc-200 dark:border-zinc-800 hover:border-red-500 dark:hover:border-red-900 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10">
                                            Cancelar
                                        </button>
                                        {onDelete && (
                                            <button onClick={() => onDelete(schedule.id)} className="w-12 py-3 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-500 rounded-xl flex items-center justify-center transition-all hover:border-red-300 dark:hover:border-red-900/30">
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* COLUNA DIREITA: HISTÓRICO */}
                    <div className="w-full md:w-[40%] bg-zinc-50 dark:bg-black h-auto md:h-full flex flex-col border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black shrink-0">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Histórico de Eventos</h3>
                        </div>
                        <div className="flex-1 overflow-visible md:overflow-y-auto custom-scrollbar p-6 bg-zinc-50 dark:bg-black relative min-h-0">
                            <div className="absolute left-[29px] top-6 bottom-6 w-0.5 bg-zinc-200 dark:bg-zinc-800 z-0"></div>
                            <div className="space-y-8 relative z-10">
                                {[...schedule.history].reverse().map((event, idx) => (
                                    <div key={idx} className="flex gap-4 group">
                                        <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center shrink-0 z-10 ${idx === 0 ? 'bg-white dark:bg-zinc-900 border-primary-500 text-primary-500' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'}`}>
                                            <History size={12}/>
                                        </div>
                                        <div className="pt-0.5 w-full">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-0.5">{event.actionBy}</span>
                                                <span className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{event.action}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mt-1">{new Date(event.timestamp).toLocaleString()}</span>
                                            {event.details && (
                                                <div className="mt-2 p-3 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                                                    {event.details}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full border-4 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-700 flex items-center justify-center shrink-0 z-10">
                                        <Calendar size={12}/>
                                    </div>
                                    <div className="pt-1">
                                        <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">SOLICITAÇÃO CRIADA VIA PORTAL</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </MotionDiv>
            </div>
        );
    }

    // --- LAYOUT USUÁRIO (CLEAN CARD COM EDIÇÃO) ---
    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <MotionDiv 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-white dark:bg-[#0f0f11] w-full max-w-[500px] rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl relative flex flex-col my-auto"
            >
                {/* Header */}
                <div className="p-8 pb-4 flex justify-between items-start">
                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        schedule.status === 'Confirmada' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        schedule.status === 'Em análise' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        schedule.status === 'Solicitada' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                    }`}>
                        {schedule.status}
                    </span>
                    <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-500 rounded-xl transition-all"><X size={20}/></button>
                </div>

                <div className="px-8 pb-8 flex flex-col gap-1">
                    <h2 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{schedule.vehiclePlate}</h2>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        {schedule.vehicleModel} <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"/> {schedule.serviceType}
                    </p>
                </div>

                {/* Card de Informações */}
                <div className="px-8">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[24px] p-6 border border-zinc-100 dark:border-zinc-800 space-y-5 relative">
                        {/* Botão de Edição para Usuários */}
                        {!isUserEditing && (
                            <button 
                                onClick={() => setIsUserEditing(true)} 
                                className="absolute top-4 right-4 p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-primary-500 rounded-xl transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                title="Editar dados"
                            >
                                <Edit2 size={16}/>
                            </button>
                        )}

                        {/* Cliente */}
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                <User size={16}/>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Cliente (Proprietário)</p>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">
                                    {schedule.clientName || 'Não informado'}
                                </p>
                                {schedule.clientPhone && <p className="text-[9px] font-mono text-zinc-500 mt-0.5">{schedule.clientPhone}</p>}
                            </div>
                        </div>

                        {/* Técnico */}
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                <Wrench size={16}/>
                            </div>
                            <div className="min-w-0 w-full">
                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Técnico Responsável</p>
                                {assignedTech ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: assignedTech.color || '#3b82f6' }} />
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase truncate">{assignedTech.name}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs font-bold text-zinc-400 uppercase italic">-- A definir --</p>
                                )}
                            </div>
                        </div>

                        {/* Localização (Editável) */}
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                <MapPin size={16}/>
                            </div>
                            <div className="min-w-0 w-full">
                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Localização</p>
                                {isUserEditing ? (
                                    <textarea 
                                        rows={2}
                                        value={formData.locationAddress} 
                                        onChange={e => setFormData({...formData, locationAddress: e.target.value})} 
                                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs font-bold outline-none focus:border-primary-500"
                                    />
                                ) : (
                                    <>
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white leading-tight break-words mb-2">
                                            {schedule.locationAddress}
                                        </p>
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.locationAddress)}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[9px] font-black text-[#f59e0b] uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
                                        >
                                            Abrir no Mapa <ExternalLink size={10}/>
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Data e Hora (Editável) */}
                        <div className="flex items-start gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                                <Calendar size={16}/>
                            </div>
                            <div className="w-full">
                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Data e Hora</p>
                                {isUserEditing ? (
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold outline-none" />
                                        <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold outline-none" />
                                    </div>
                                ) : (
                                    <p className="text-sm font-black text-zinc-900 dark:text-white uppercase">
                                        {schedule.confirmedDate ? formatSafeDate(schedule.confirmedDate) : formatSafeDate(schedule.preferredDate)} 
                                        <span className="text-zinc-400 mx-2">às</span> 
                                        {schedule.confirmedTime || schedule.preferredTime}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Botões de Ação para Usuário */}
                <div className="px-8 mt-6">
                    {isUserEditing ? (
                        <div className="flex gap-3">
                            <button 
                                onClick={handleUserSave}
                                className="flex-1 py-4 bg-primary-500 hover:bg-primary-400 text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Save size={16} /> Salvar Alterações
                            </button>
                            <button 
                                onClick={() => setIsUserEditing(false)}
                                className="w-16 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl flex items-center justify-center transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleCopyClientMessage}
                            className="w-full py-4 bg-[#25D366] hover:bg-[#1fb550] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <MessageCircle size={16} /> Copiar Mensagem para Cliente
                        </button>
                    )}
                </div>

                <RequestStepper status={schedule.status} reason={schedule.cancellationReason} />
                
                <div className="px-8 pb-6 flex justify-center">
                    <p className="text-[9px] text-zinc-400 font-mono">Última atualização: {new Date(schedule.history[schedule.history.length-1]?.timestamp || schedule.createdAt).toLocaleString()}</p>
                </div>
            </MotionDiv>
        </div>
    );
};
