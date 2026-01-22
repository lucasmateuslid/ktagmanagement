
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova'; // Importação do serviço
import { Schedule, DeviceType, ServiceType, Vehicle } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { LocationPicker } from '../components/LocationPicker';
import { Calendar, Clock, Car, Settings, CheckCircle2, User, CreditCard, MapPin, Search, Loader2, Database, Phone, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ScheduleRequest = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleDb, setVehicleDb] = useState<Vehicle[]>([]);
  const [searchingPlate, setSearchingPlate] = useState(false);
  const [hinovaStatus, setHinovaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [formData, setFormData] = useState<Partial<Schedule>>({
    deviceType: 'Rastreador',
    serviceType: 'Instalação',
    fipeValue: '', 
  });

  useEffect(() => {
    if (user) {
        setFormData(prev => ({
            ...prev,
            requesterName: user.name 
        }));
    }
    // Carrega veículos para busca local
    storage.getVehicles().then(setVehicleDb);
  }, [user]);

  // Formata Placa (AAA-0000 ou AAA0A00) e busca no DB
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Formata visualmente se tiver 7 caracteres
    if (value.length > 7) value = value.substring(0, 7);
    
    setFormData(prev => ({ ...prev, vehiclePlate: value }));
  };

  const handlePlateBlur = async () => {
    const plate = formData.vehiclePlate;
    if (!plate || plate.length < 7) return;

    setSearchingPlate(true);
    // Simula delay de busca se fosse API externa, mas aqui é local
    setTimeout(() => {
        const found = vehicleDb.find(v => v.plate.replace(/[^A-Z0-9]/g, '') === plate);
        if (found) {
            setFormData(prev => ({
                ...prev,
                vehicleModel: found.model,
                fipeValue: found.fipeCode ? `FIPE: ${found.fipeCode} (Consulte valor)` : prev.fipeValue
            }));
            addNotification('success', 'Veículo Encontrado', 'Dados do veículo carregados do sistema.');
        }
        setSearchingPlate(false);
    }, 500);
  };

  const handleHinovaLookup = async () => {
    if (!formData.vehiclePlate || formData.vehiclePlate.length < 7) {
        addNotification('info', 'Hinova', 'Digite uma placa válida.');
        return;
    }
    
    setHinovaStatus('loading');
    try {
        const result = await hinovaService.searchVehicle(formData.vehiclePlate);
        if (result && result.vehicle) {
            setFormData(prev => ({
                ...prev,
                vehicleModel: result.vehicle.model || prev.vehicleModel,
                fipeValue: result.price || (result.vehicle.fipeCode ? `Código FIPE: ${result.vehicle.fipeCode}` : prev.fipeValue),
                // Preenche dados do cliente se disponíveis, mas NÃO sobrescreve o requesterName (usuário logado)
                clientName: result.client.name, 
                clientPhone: result.client.phone || undefined
            }));
            setHinovaStatus('success');
            addNotification('success', 'Hinova', 'Dados do veículo e cliente importados do SGA.');
        } else {
            setHinovaStatus('error');
            addNotification('error', 'Hinova', 'Veículo não encontrado na base externa.');
        }
    } catch (e: any) {
        setHinovaStatus('error');
        addNotification('error', 'API SGA', e.message);
    } finally {
        setTimeout(() => setHinovaStatus('idle'), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.vehiclePlate || !formData.vehicleModel || !formData.preferredDate || !formData.preferredTime || !formData.locationAddress) {
        addNotification('error', 'Campos Obrigatórios', 'Preencha todos os dados, incluindo localização, para prosseguir.');
        return;
    }

    setLoading(true);
    try {
        const schedule: Schedule = {
            id: crypto.randomUUID(),
            requesterId: user.id,
            requesterName: user.name, // Garante que é o nome do usuário logado
            clientName: formData.clientName, // Nome do Cliente (Dono)
            clientPhone: formData.clientPhone, // Telefone do Cliente
            vehiclePlate: formData.vehiclePlate.toUpperCase(),
            vehicleModel: formData.vehicleModel,
            fipeValue: formData.fipeValue || 'Não informado',
            deviceType: formData.deviceType as DeviceType,
            serviceType: formData.serviceType as ServiceType,
            preferredDate: formData.preferredDate,
            preferredTime: formData.preferredTime,
            locationAddress: formData.locationAddress,
            locationLat: formData.locationLat || 0,
            locationLng: formData.locationLng || 0,
            status: 'Solicitada',
            createdAt: Date.now(),
            history: [{
                action: 'Solicitou',
                actionBy: user.name,
                timestamp: Date.now(),
                details: 'Solicitação criada via portal'
            }]
        };

        await storage.saveSchedule(schedule);
        addNotification('success', 'Solicitação Enviada', 'Aguarde a confirmação da nossa equipe.');
        navigate('/schedules'); 
    } catch (err) {
        console.error(err);
        addNotification('error', 'Erro', 'Falha ao enviar solicitação.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24">
        {/* Header Compacto Mobile */}
        <div className="bg-zinc-900 text-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden border border-zinc-800">
            <div className="relative z-10">
                <h1 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tight">Nova Solicitação</h1>
                <p className="text-zinc-400 mt-2 font-medium text-xs md:text-sm pr-10">Preencha os dados abaixo para agendar um serviço técnico.</p>
            </div>
            <div className="absolute top-0 right-0 p-6 md:p-10 opacity-10 pointer-events-none">
                <Calendar size={100} />
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            {/* DADOS DO SOLICITANTE (OPERADOR) */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <User size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Dados do Solicitante (Operador)</h3>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome do Operador</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            readOnly
                            disabled
                            value={formData.requesterName || ''} 
                            className="w-full px-4 py-3.5 mt-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none text-zinc-500 cursor-not-allowed" 
                        />
                        <Lock size={14} className="absolute right-4 top-1/2 mt-0.5 -translate-y-1/2 text-zinc-400"/>
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-1 ml-1">Usuário responsável pelo cadastro.</p>
                </div>
            </div>

            {/* DADOS DO VEÍCULO E CLIENTE */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <Car size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Dados do Veículo & Cliente</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Placa</label>
                        <div className="flex gap-2 mt-1">
                            <div className="relative flex-1">
                                <input 
                                    type="text" 
                                    maxLength={7} 
                                    required 
                                    value={formData.vehiclePlate || ''} 
                                    onChange={handlePlateChange} 
                                    onBlur={handlePlateBlur}
                                    className="w-full pl-4 pr-10 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-black text-sm outline-none uppercase placeholder:text-zinc-300" 
                                    placeholder="AAA0000" 
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                                    {searchingPlate ? <Loader2 size={16} className="animate-spin text-primary-500"/> : <Search size={16}/>}
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={handleHinovaLookup} 
                                disabled={hinovaStatus === 'loading'} 
                                className="px-4 rounded-xl bg-[#006e82] hover:bg-[#008ba3] text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center min-w-[70px]"
                            >
                                {hinovaStatus === 'loading' ? <Loader2 className="animate-spin" size={16}/> : 'SGA'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Modelo do Veículo</label>
                        <input type="text" required value={formData.vehicleModel || ''} onChange={e => setFormData(prev => ({...prev, vehicleModel: e.target.value}))} className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none placeholder:text-zinc-300" placeholder="Ex: Fiat Uno Way" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor FIPE (R$)</label>
                        <div className="relative mt-1">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input type="text" value={formData.fipeValue || ''} onChange={e => setFormData(prev => ({...prev, fipeValue: e.target.value}))} className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="R$ 0,00" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Dispositivo</label>
                        <select value={formData.deviceType} onChange={e => setFormData(prev => ({...prev, deviceType: e.target.value as DeviceType}))} className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                            <option value="Rastreador">Rastreador</option>
                            <option value="Tag">Tag</option>
                            <option value="Rastreador + Tag">Rastreador + Tag</option>
                        </select>
                    </div>
                </div>

                {/* Card de Dados do Cliente (Importado do SGA/Hinova) - AGORA DENTRO DA ABA DE VEÍCULO */}
                {(formData.clientName || formData.clientPhone) && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 mt-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                            <User size={20}/>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Cliente Identificado (SGA)</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5">
                                <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{formData.clientName || 'Nome não informado'}</span>
                                {formData.clientPhone && (
                                    <span className="text-xs text-zinc-500 font-mono flex items-center gap-1"><Phone size={10}/> {formData.clientPhone}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PREFERÊNCIA E LOCAL */}
            <div className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-emerald-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <Clock size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Agendamento & Local</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Serviço</label>
                        <select value={formData.serviceType} onChange={e => setFormData(prev => ({...prev, serviceType: e.target.value as ServiceType}))} className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                            <option value="Instalação">Instalação</option>
                            <option value="Manutenção">Manutenção</option>
                            <option value="Retirada">Retirada</option>
                        </select>
                    </div>
                    {/* Grid de Data e Hora */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1 block">Data</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 pointer-events-none" />
                                <input 
                                    type="date" 
                                    required 
                                    value={formData.preferredDate || ''} 
                                    onChange={e => setFormData(prev => ({...prev, preferredDate: e.target.value}))} 
                                    className="w-full pl-9 pr-2 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white" 
                                />
                            </div>
                        </div>
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1 block">Hora</label>
                            <div className="relative">
                                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 pointer-events-none" />
                                <input 
                                    type="time" 
                                    required 
                                    value={formData.preferredTime || ''} 
                                    onChange={e => setFormData(prev => ({...prev, preferredTime: e.target.value}))} 
                                    className="w-full pl-9 pr-2 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <LocationPicker 
                    tileProvider="google" 
                    onLocationSelect={(addr, lat, lng) => setFormData(prev => ({...prev, locationAddress: addr, locationLat: lat, locationLng: lng}))} 
                />
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-primary-500 hover:bg-primary-400 text-black rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {loading ? 'Enviando...' : <><CheckCircle2 size={20} /> Enviar Solicitação</>}
            </button>
        </form>
    </div>
  );
};
