
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Schedule, DeviceType, ServiceType, Vehicle } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { LocationPicker } from '../components/LocationPicker';
import { Calendar, Clock, Car, Settings, CheckCircle2, User, CreditCard, MapPin, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ScheduleRequest = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleDb, setVehicleDb] = useState<Vehicle[]>([]);
  const [searchingPlate, setSearchingPlate] = useState(false);

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
    
    // Formatação Padrão Antigo (AAA-0000) - Opcional, aqui mantemos RAW no state e exibimos formatado se quiser
    // Mas para simplificar e seguir padrão Mercosul (sem hifen), mantemos limpo no state.
    // O backend/storage salva sem hifen geralmente.
    
    setFormData({ ...formData, vehiclePlate: value });
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
            requesterName: formData.requesterName || user.name, 
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
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
        <div className="bg-zinc-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden border border-zinc-800">
            <div className="relative z-10">
                <h1 className="text-3xl font-display font-black uppercase tracking-tight">Nova Solicitação</h1>
                <p className="text-zinc-400 mt-2 font-medium text-sm">Preencha os dados abaixo para agendar um serviço técnico.</p>
            </div>
            <div className="absolute top-0 right-0 p-10 opacity-10">
                <Calendar size={120} />
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
            {/* DADOS DO SOLICITANTE */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <User size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Dados do Solicitante</h3>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome do Solicitante</label>
                    <input 
                        type="text" 
                        required
                        value={formData.requesterName || ''} 
                        onChange={e => setFormData({...formData, requesterName: e.target.value})} 
                        className="w-full px-4 py-3 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500 transition-all" 
                    />
                    <p className="text-[9px] text-zinc-400 mt-1 ml-1">Este nome aparecerá para a equipe técnica e pode ser alterado se necessário.</p>
                </div>
            </div>

            {/* DADOS DO VEÍCULO */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <Car size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Dados do Veículo</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Placa</label>
                        <div className="relative mt-1">
                            <input 
                                type="text" 
                                maxLength={7} 
                                required 
                                value={formData.vehiclePlate || ''} 
                                onChange={handlePlateChange} 
                                onBlur={handlePlateBlur}
                                className="w-full pl-4 pr-10 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-black text-sm outline-none uppercase placeholder:text-zinc-300" 
                                placeholder="AAA0000" 
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                                {searchingPlate ? <Loader2 size={16} className="animate-spin text-primary-500"/> : <Search size={16}/>}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Modelo do Veículo</label>
                        <input type="text" required value={formData.vehicleModel || ''} onChange={e => setFormData({...formData, vehicleModel: e.target.value})} className="w-full px-4 py-3 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none placeholder:text-zinc-300" placeholder="Ex: Fiat Uno Way" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor FIPE (R$)</label>
                        <div className="relative mt-1">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input type="text" value={formData.fipeValue || ''} onChange={e => setFormData({...formData, fipeValue: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="R$ 0,00" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Dispositivo</label>
                        <select value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value as DeviceType})} className="w-full px-4 py-3 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                            <option value="Rastreador">Rastreador</option>
                            <option value="Rastreador + Tag">Rastreador + Tag</option>
                            <option value="Tag">Tag</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* PREFERÊNCIA E LOCAL */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-emerald-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <Clock size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Agendamento & Local</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Serviço</label>
                        <select value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value as ServiceType})} className="w-full px-4 py-3 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                            <option value="Instalação">Instalação</option>
                            <option value="Manutenção">Manutenção</option>
                            <option value="Retirada">Retirada</option>
                        </select>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                                <Calendar size={12} className="text-primary-500" /> Data Preferencial
                            </label>
                            <input type="date" required value={formData.preferredDate || ''} onChange={e => setFormData({...formData, preferredDate: e.target.value})} className="w-full px-4 py-3 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white" />
                        </div>
                        <div className="w-32 relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                                <Clock size={12} className="text-primary-500" /> Hora
                            </label>
                            <input type="time" required value={formData.preferredTime || ''} onChange={e => setFormData({...formData, preferredTime: e.target.value})} className="w-full px-4 py-3 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white" />
                        </div>
                    </div>
                </div>
                
                {/* Força o uso do Google Maps na sessão de solicitação */}
                <LocationPicker 
                    tileProvider="google" 
                    onLocationSelect={(addr, lat, lng) => setFormData({...formData, locationAddress: addr, locationLat: lat, locationLng: lng})} 
                />
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-primary-500 hover:bg-primary-400 text-black rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {loading ? 'Enviando...' : <><CheckCircle2 size={20} /> Enviar Solicitação</>}
            </button>
        </form>
    </div>
  );
};
