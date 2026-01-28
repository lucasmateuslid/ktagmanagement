import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova'; // Importação do serviço
import { Schedule, DeviceType, ServiceType, Vehicle, User, Company } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { LocationPicker } from '../components/LocationPicker';
import { Calendar, Clock, Car, Settings, CheckCircle2, User as UserIcon, CreditCard, MapPin, Search, Loader2, Database, Phone, Lock, ChevronDown, Check, X, Building2, FileText, ClipboardCheck, Wallet } from 'lucide-react';
import * as ReactRouterDOM from 'react-router-dom';

const { useNavigate } = ReactRouterDOM as any;

export const ScheduleRequest = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleDb, setVehicleDb] = useState<Vehicle[]>([]);
  const [usersDb, setUsersDb] = useState<User[]>([]); // Lista de usuários para Admin
  const [companies, setCompanies] = useState<Company[]>([]); // Lista de empresas
  const [searchingPlate, setSearchingPlate] = useState(false);
  const [hinovaStatus, setHinovaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Estados para o Dropdown Customizado de Operador
  const [isUserSelectOpen, setIsUserSelectOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [formData, setFormData] = useState<Partial<Schedule>>({
    deviceType: 'Rastreador',
    serviceType: 'Instalação',
    fipeValue: '',
    notes: '',
    needsInspection: false,
    paymentOnSite: false
  });

  useEffect(() => {
    const initData = async () => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                requesterId: user.id,
                requesterName: user.name 
            }));
            setUserSearch(user.name); // Inicializa a busca com o nome atual

            // Se for admin, carrega lista de usuários para poder atribuir
            if (user.role === 'admin') {
                const users = await storage.getAllUsers();
                // Filtra apenas usuários internos (não clientes) e ordena
                const staff = users.filter(u => u.role !== 'client').sort((a, b) => a.name.localeCompare(b.name));
                setUsersDb(staff);
            }
        }
        // Carrega veículos para busca local e empresas
        const [vecs, comps] = await Promise.all([
            storage.getVehicles(),
            storage.getCompanies()
        ]);
        setVehicleDb(vecs);
        setCompanies(comps);
    };
    initData();
  }, [user]);

  // Sincroniza o input de busca com o nome selecionado quando o formulário muda externamente
  useEffect(() => {
      if (formData.requesterName && !isUserSelectOpen) {
          setUserSearch(formData.requesterName);
      }
  }, [formData.requesterName, isUserSelectOpen]);

  // Filtra usuários para o dropdown customizado
  const filteredUsers = useMemo(() => {
      if (!userSearch) return usersDb;
      // Se o texto for igual ao selecionado, mostra tudo (assumindo que acabou de abrir)
      if (userSearch === formData.requesterName) return usersDb;
      
      const term = userSearch.toLowerCase();
      return usersDb.filter(u => u.name.toLowerCase().includes(term));
  }, [usersDb, userSearch, formData.requesterName]);

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
                fipeValue: found.fipeCode ? `FIPE: ${found.fipeCode} (Consulte valor)` : prev.fipeValue,
                companyId: found.companyId || prev.companyId
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

  const selectUser = (selectedUser: User) => {
      setFormData(prev => ({
          ...prev,
          requesterId: selectedUser.id,
          requesterName: selectedUser.name
      }));
      setUserSearch(selectedUser.name);
      setIsUserSelectOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Validação de Campos Obrigatórios (FIPE não é mais obrigatório)
    if (!formData.vehiclePlate || !formData.vehicleModel || !formData.preferredDate || !formData.preferredTime || !formData.locationAddress) {
        addNotification('error', 'Campos Obrigatórios', 'Preencha todos os dados obrigatórios (*), incluindo localização, para prosseguir.');
        return;
    }

    setLoading(true);
    try {
        // Usa o requester selecionado (se admin mudou) ou o usuário logado
        const finalRequesterId = formData.requesterId || user.id;
        const finalRequesterName = formData.requesterName || user.name;

        const schedule: Schedule = {
            id: crypto.randomUUID(),
            requesterId: finalRequesterId,
            requesterName: finalRequesterName,
            clientName: formData.clientName, // Nome do Cliente (Dono)
            clientPhone: formData.clientPhone, // Telefone do Cliente
            vehiclePlate: formData.vehiclePlate.toUpperCase(),
            vehicleModel: formData.vehicleModel,
            fipeValue: formData.fipeValue || 'Não informado',
            deviceType: formData.deviceType as DeviceType,
            serviceType: formData.serviceType as ServiceType,
            companyId: formData.companyId, // Regional/Empresa
            preferredDate: formData.preferredDate,
            preferredTime: formData.preferredTime,
            notes: formData.notes,
            needsInspection: formData.needsInspection,
            paymentOnSite: formData.paymentOnSite,
            locationAddress: formData.locationAddress,
            locationLat: formData.locationLat || 0,
            locationLng: formData.locationLng || 0,
            status: 'Solicitada',
            createdAt: Date.now(),
            history: [{
                action: 'Solicitou',
                actionBy: user.name, // Quem realizou a ação (pode ser o admin em nome de outro)
                timestamp: Date.now(),
                details: user.id !== finalRequesterId ? `Solicitado por Admin em nome de ${finalRequesterName}` : 'Solicitação criada via portal'
            }]
        };

        await storage.saveSchedule(schedule);
        addNotification('success', 'Solicitação Enviada', `Agendamento criado para ${finalRequesterName}.`);
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
                    <UserIcon size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs">Dados do Solicitante (Operador)</h3>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome do Operador <span className="text-red-500">*</span></label>
                    <div className="relative mt-1">
                        {user?.role === 'admin' ? (
                            <div className="relative">
                                {/* Trigger / Search Input */}
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={userSearch} 
                                        onChange={(e) => {
                                            setUserSearch(e.target.value);
                                            setIsUserSelectOpen(true);
                                        }}
                                        onFocus={() => {
                                            setIsUserSelectOpen(true);
                                            if (userSearch === formData.requesterName) setUserSearch(''); // Limpa para mostrar todos ao focar
                                        }}
                                        className="w-full pl-4 pr-10 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none text-zinc-900 dark:text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-zinc-400"
                                        placeholder="Buscar operador..."
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                        {isUserSelectOpen ? <Search size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Dropdown List */}
                                {isUserSelectOpen && (
                                    <>
                                        {/* Overlay invisível para fechar ao clicar fora */}
                                        <div className="fixed inset-0 z-40" onClick={() => {
                                            setIsUserSelectOpen(false);
                                            if (!usersDb.some(u => u.name === userSearch)) {
                                                setUserSearch(formData.requesterName || ''); // Reverte se não selecionou nada válido
                                            }
                                        }}></div>
                                        
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-2">
                                            {filteredUsers.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-zinc-400 font-medium">Nenhum operador encontrado</div>
                                            ) : (
                                                filteredUsers.map(u => {
                                                    const isSelected = u.id === formData.requesterId;
                                                    return (
                                                        <div 
                                                            key={u.id} 
                                                            onClick={() => selectUser(u)}
                                                            className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                                                        >
                                                            <span className="text-sm font-bold truncate">{u.name}</span>
                                                            {isSelected && <Check size={14} className="shrink-0" />}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="relative">
                                <input 
                                    type="text" 
                                    readOnly
                                    disabled
                                    value={formData.requesterName || ''} 
                                    className="w-full px-4 py-3.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none text-zinc-500 cursor-not-allowed" 
                                />
                                <Lock size={14} className="absolute right-4 top-1/2 mt-0.5 -translate-y-1/2 text-zinc-400"/>
                            </div>
                        )}
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-2 ml-1 flex items-center gap-1">
                        <CheckCircle2 size={10} className="text-primary-500"/>
                        {user?.role === 'admin' ? 'Administrador pode atribuir a solicitação a outro usuário.' : 'Usuário responsável pelo cadastro.'}
                    </p>
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
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Placa <span className="text-red-500">*</span></label>
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
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Modelo do Veículo <span className="text-red-500">*</span></label>
                        <input type="text" required value={formData.vehicleModel || ''} onChange={e => setFormData(prev => ({...prev, vehicleModel: e.target.value}))} className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none placeholder:text-zinc-300" placeholder="Ex: Fiat Uno Way" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor FIPE (R$)</label>
                        <div className="relative mt-1">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input type="text" value={formData.fipeValue || ''} onChange={e => setFormData(prev => ({...prev, fipeValue: e.target.value}))} className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none" placeholder="R$ 0,00 (Opcional)" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Dispositivo <span className="text-red-500">*</span></label>
                        <select value={formData.deviceType} onChange={e => setFormData(prev => ({...prev, deviceType: e.target.value as DeviceType}))} className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                            <option value="Rastreador">Rastreador</option>
                            <option value="Tag">Tag</option>
                            <option value="Rastreador + Tag">Rastreador + Tag</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Empresa Responsável (Regional)</label>
                        <div className="relative mt-1">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <select value={formData.companyId || ''} onChange={e => setFormData(prev => ({...prev, companyId: e.target.value}))} className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                                <option value="">-- Selecione a Regional --</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Card de Dados do Cliente (Importado do SGA/Hinova) - AGORA DENTRO DA ABA DE VEÍCULO */}
                {(formData.clientName || formData.clientPhone) && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 mt-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                            <UserIcon size={20}/>
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
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Tipo de Serviço <span className="text-red-500">*</span></label>
                        <select value={formData.serviceType} onChange={e => setFormData(prev => ({...prev, serviceType: e.target.value as ServiceType}))} className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none">
                            <option value="Instalação">Instalação</option>
                            <option value="Manutenção">Manutenção</option>
                            <option value="Retirada">Retirada</option>
                            <option value="Vistoria">Vistoria</option>
                        </select>
                    </div>
                    {/* Grid de Data e Hora */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1 block">Data <span className="text-red-500">*</span></label>
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
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1 block">Hora <span className="text-red-500">*</span></label>
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

                {/* VISTORIA E PAGAMENTO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2"><ClipboardCheck size={14}/> Vistoria Necessária?</label>
                        <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                            <button type="button" onClick={() => setFormData({...formData, needsInspection: true