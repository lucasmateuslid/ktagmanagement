
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { storage } from '../services/storage';
import { plateLookupService } from '../services/plateLookup';
import { hinovaService } from '../services/hinova';
import { fipeService, FipeReference } from '../services/fipe';
import { Tag, Vehicle, Company, VehicleCategory, Client, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Trash2, Edit2, Car as CarIcon, Truck, Bike, Save, X, 
  Link as LinkIcon, Search, Loader2, Building2, ChevronDown, 
  Check, ShieldAlert, AlertTriangle, Wrench, User as UserIcon, Phone, 
  MapPin, CheckCircle, XCircle, Database, Settings, BookOpen,
  Filter, LayoutGrid, ListFilter, Activity, Mail, FileText, Lock
} from 'lucide-react';

const { useSearchParams } = ReactRouterDOM as any;

// --- Internal Component: Searchable Select ---
interface SearchableSelectProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, options, value, onChange, placeholder, disabled, loading, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider mb-2">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2.5 text-left border rounded-xl flex items-center justify-between transition-all
          ${disabled 
            ? 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed' 
            : 'bg-white dark:bg-zinc-850 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white hover:border-primary-500 focus:ring-2 focus:ring-primary-500/10'
          }
        `}
      >
        <div className="flex items-center gap-2 truncate">
          {loading && <Loader2 size={14} className="animate-spin text-primary-500" />}
          {icon && !loading && <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>}
          <span className={`text-sm font-bold ${!selectedOption ? 'text-zinc-500 dark:text-zinc-600' : ''}`}>
            {selectedOption ? selectedOption.label : (placeholder || 'Selecione...')}
          </span>
        </div>
        {!disabled && <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
        {disabled && <Lock size={12} className="text-zinc-400" />}
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-850">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                placeholder="Filtrar lista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
               <div className="p-3 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Sem resultados</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between group transition-colors font-bold uppercase tracking-tight
                    ${value === opt.value 
                      ? 'bg-primary-500/10 text-primary-500' 
                      : 'text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }
                  `}
                >
                  {opt.label}
                  {value === opt.value && <Check size={14} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const Vehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});
  const [clientFormData, setClientFormData] = useState<Partial<Client>>({ hasAccess: false });
  const [globalSearch, setGlobalSearch] = useState('');
  const [isHinovaImport, setIsHinovaImport] = useState(false);

  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const [loadingPlate, setLoadingPlate] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [hinovaStatus, setHinovaStatus] = useState<{
    open: boolean;
    step: 'idle' | 'loading' | 'success' | 'error';
    message: string;
    details?: string;
  }>({ open: false, step: 'idle', message: '' });
  
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const [isFipeModalOpen, setIsFipeModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async () => {
    const [v, t, c, cat, cl] = await Promise.all([
        storage.getVehicles(),
        storage.getTags(),
        storage.getCompanies(),
        storage.getCategories(),
        storage.getClients()
    ]);
    setVehicles(v);
    setTags(t);
    setCompanies(c);
    setCategories(cat);
    setClients(cl);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setFormData({ status: 'active', installationType: 'tag_only' });
      setClientFormData({ hasAccess: false });
      setIsHinovaImport(false);
      setTagSearchTerm('');
      setIsModalOpen(true);
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filteredVehicles = useMemo(() => {
    const term = globalSearch.toLowerCase().trim();
    if (!term) return vehicles;
    return vehicles.filter(v => {
      const client = clients.find(c => c.id === v.clientId);
      return v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term) || (client && client.name.toLowerCase().includes(term));
    });
  }, [vehicles, globalSearch, clients]);

  const stats = useMemo(() => ({
      total: vehicles.length,
      active: vehicles.filter(v => v.status === 'active' || !v.status).length,
      stolen: vehicles.filter(v => v.status === 'stolen').length,
      maintenance: vehicles.filter(v => v.status === 'maintenance').length
  }), [vehicles]);

  const getCategoryIcon = (id: string) => {
      const cat = categories.find(c => c.id === id);
      if(!cat) return <CarIcon size={18} />;
      switch(cat.fipeType) {
          case 'caminhoes': return <Truck size={18} />;
          case 'motos': return <Bike size={18} />;
          default: return <CarIcon size={18} />;
      }
  };

  const handleHinovaLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) {
        addNotification('error', 'Erro', 'Insira uma placa válida.');
        return;
    }
    setHinovaStatus({ open: true, step: 'loading', message: 'Conectando Hinova...' });
    try {
        const result = await hinovaService.searchVehicle(formData.plate);
        if (result) {
            const lockCompany = companies.find(c => c.name.toUpperCase().includes('LOCK') || c.prefix.toUpperCase().includes('LOCK'));
            
            setFormData(prev => ({ 
                ...prev, 
                ...result.vehicle,
                companyId: lockCompany ? lockCompany.id : prev.companyId
            }));
            setClientFormData({ ...result.client, hasAccess: false });
            setIsHinovaImport(true);
            
            setHinovaStatus({ 
                open: true, step: 'success', message: 'Localizado!', 
                details: `${result.vehicle.model} - ${result.client.name}`
            });
            setTimeout(() => setHinovaStatus(prev => ({ ...prev, open: false })), 1500);
        } else {
            setHinovaStatus({ open: true, step: 'error', message: 'Não Encontrado', details: 'A placa não consta na base Hinova.' });
        }
    } catch (e: any) {
        setHinovaStatus({ open: true, step: 'error', message: 'Erro na Consulta', details: e.message });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.model || !formData.type) {
        addNotification('error', 'Erro', 'Preencha Placa, Modelo e Categoria.');
        return;
    }

    let linkedClientId = formData.clientId;
    let finalClient: Client | null = null;

    if (clientFormData.name) {
        let client = clientFormData.cpf ? clients.find(c => c.cpf === clientFormData.cpf) : null;
        if (client) {
            linkedClientId = client.id;
            finalClient = { ...client, ...clientFormData as Client, id: client.id };
            await storage.saveClient(finalClient);
        } else {
            const newClient: Client = {
                id: crypto.randomUUID(),
                name: clientFormData.name,
                cpf: clientFormData.cpf || '',
                phone: clientFormData.phone || '',
                email: clientFormData.email,
                hasAccess: clientFormData.hasAccess || false,
                createdAt: Date.now()
            };
            await storage.saveClient(newClient);
            linkedClientId = newClient.id;
            finalClient = newClient;
            setClients(prev => [...prev, newClient]);
        }
    }

    // Lógica de Automação de Usuário para Clientes
    if (finalClient && finalClient.hasAccess) {
      const cleanCpf = finalClient.cpf.replace(/\D/g, '');
      const loginEmail = `${cleanCpf}@client.ktag`;
      const existingUser = await storage.findUserByEmail(loginEmail);
      
      if (!existingUser) {
        const tempPassword = cleanCpf.substring(0, 6); // Primeiros 6 dígitos
        const newUser: User = {
          id: crypto.randomUUID(),
          name: finalClient.name,
          email: loginEmail,
          password: tempPassword,
          role: 'client',
          status: 'approved',
          cpf: cleanCpf,
          createdAt: Date.now()
        };
        await storage.registerUserRequest(newUser);
        addNotification('info', 'Acesso Criado', `Portal do Cliente ativado. Login: ${cleanCpf} / Senha: ${tempPassword}`);
      }
    }

    const newVehicle: Vehicle = {
      id: formData.id || crypto.randomUUID(),
      type: formData.type || 'cat-car',
      plate: formData.plate.toUpperCase(),
      model: formData.model,
      year: formData.year || '',
      fipeCode: formData.fipeCode || '',
      tagId: formData.tagId,
      companyId: formData.companyId,
      clientId: linkedClientId,
      status: formData.status || 'active',
      installationType: formData.installationType || 'tag_only',
      createdAt: formData.createdAt || Date.now(),
      updatedBy: user?.name
    };

    await storage.saveVehicle(newVehicle);
    addNotification('success', 'Sucesso', 'Veículo salvo.');
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir veículo?')) {
      await storage.deleteVehicle(id);
      loadData();
      addNotification('success', 'Removido', 'Veículo excluído.');
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'stolen') return <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">ROUBADO</span>;
    if (status === 'maintenance') return <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">MANUTENÇÃO</span>;
    return <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">ATIVO</span>;
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tight">{t('vehicleFleet')}</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Gestão centralizada de veículos ativos.</p>
        </div>
        <button
          onClick={() => { setFormData({ status: 'active', installationType: 'tag_only' }); setClientFormData({ hasAccess: false }); setIsHinovaImport(false); setTagSearchTerm(''); setIsModalOpen(true); }}
          className="w-full md:w-auto bg-primary-500 hover:bg-primary-400 text-black px-6 py-4 md:py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-primary-500/20"
        >
          <Plus size={20} strokeWidth={3} /> {t('addVehicle')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Veículos', value: stats.total, color: 'zinc', icon: Activity },
            { label: 'Ativos', value: stats.active, color: 'emerald', icon: CheckCircle },
            { label: 'Manutenção', value: stats.maintenance, color: 'amber', icon: Wrench },
            { label: 'Alertas Roubo', value: stats.stolen, color: 'red', icon: ShieldAlert },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
               <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-500`}><stat.icon size={18} /></div>
               <div className="min-w-0">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate">{stat.label}</p>
                  <p className="text-xl font-display font-black text-zinc-900 dark:text-white leading-none mt-1">{stat.value}</p>
               </div>
            </div>
          ))}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" placeholder="Buscar por placa, modelo ou cliente..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-zinc-900 dark:text-white" />
        </div>
      </div>

      {/* MOBILE VIEW: Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredVehicles.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800">
             <CarIcon size={48} className="mx-auto text-zinc-200 dark:text-zinc-800 mb-4" />
             <p className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Nenhum veículo localizado</p>
          </div>
        ) : (
          filteredVehicles.map((v) => {
            const tag = tags.find(t => t.id === v.tagId);
            const client = clients.find(c => c.id === v.clientId);
            return (
              <div key={v.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="font-mono text-lg font-black text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 inline-block">{v.plate}</span>
                    <div className="block">{getStatusBadge(v.status)}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-zinc-400">
                    {getCategoryIcon(v.type)}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-black text-zinc-900 dark:text-white uppercase leading-tight">{v.model}</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{categories.find(c => c.id === v.type)?.name} • {v.year || 'ANO N/I'}</p>
                </div>

                {tag ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                    <LinkIcon size={16} className="text-emerald-600" strokeWidth={3} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase truncate">{tag.name}</p>
                      <p className="text-[9px] font-mono text-emerald-600/70 truncate uppercase">SN: {tag.accessoryId}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 text-center">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Sem Tag Vinculada</p>
                  </div>
                )}

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black uppercase text-zinc-500">{client?.name?.charAt(0) || '?'}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black uppercase text-zinc-500 truncate max-w-[120px]">{client?.name || 'Sem Cliente'}</span>
                        {client?.hasAccess && <span className="text-[8px] font-black text-emerald-500 uppercase">Portal Ativo</span>}
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => { setFormData(v); setClientFormData(client || { hasAccess: false }); setIsHinovaImport(!!v.hinovaId); setTagSearchTerm(tag?.name || ''); setIsModalOpen(true); }} className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 rounded-xl"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-3 bg-zinc-50 dark:bg-zinc-800 text-red-500 rounded-xl"><Trash2 size={16} /></button>
                   </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* DESKTOP VIEW: Table */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-[32px] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
              <th className="p-5">Placa & Tipo</th>
              <th className="p-5">Veículo & Conectividade</th>
              <th className="p-5">Cliente</th>
              <th className="p-5">Responsável</th>
              <th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {filteredVehicles.map((v) => {
              const tag = tags.find(t => t.id === v.tagId);
              const client = clients.find(c => c.id === v.clientId);
              return (
                <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-base font-black text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 inline-block">{v.plate}</span>
                        {getStatusBadge(v.status)}
                      </div>
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 group-hover:text-primary-500 transition-colors">
                        {getCategoryIcon(v.type)}
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 dark:text-white uppercase leading-tight">{v.model}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">{categories.find(c => c.id === v.type)?.name}</span>
                      {tag ? (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 w-fit">
                          <LinkIcon size={12} strokeWidth={3} />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase leading-none">{tag.name}</span>
                            <span className="text-[9px] font-mono opacity-70">SN: {tag.accessoryId}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="mt-2 text-[10px] font-bold text-zinc-400 italic">Nenhuma Tag Vinculada</span>
                      )}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="text-zinc-700 dark:text-zinc-300 font-bold uppercase text-xs">{client?.name || '-'}</span>
                      {client?.hasAccess && <span className="text-[9px] font-black text-emerald-500 uppercase mt-0.5">Portal Ativo</span>}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black border border-zinc-200 dark:border-zinc-700 uppercase">
                        {v.updatedBy?.charAt(0) || '-'}
                      </div>
                      <span className="text-xs font-bold text-zinc-500 truncate max-w-[120px] uppercase">{v.updatedBy || 'SISTEMA'}</span>
                    </div>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setFormData(v); setClientFormData(client || { hasAccess: false }); setIsHinovaImport(!!v.hinovaId); setTagSearchTerm(tags.find(t => t.id === v.tagId)?.name || ''); setIsModalOpen(true); }} className="p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-primary-600 rounded-xl transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- REFACTORED CONCISE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-zinc-50 dark:bg-[#121214] rounded-[32px] w-full max-w-4xl p-8 shadow-3xl relative border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{formData.id ? 'Editar Veículo' : 'Novo Veículo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-zinc-500 transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              
              {/* COLUNA ESQUERDA: DADOS DO VEÍCULO */}
              <div className="space-y-6">
                  <div className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800/50 pb-3">DADOS DO VEÍCULO</div>

                  {/* Status Toggle */}
                  <div className="space-y-2">
                    <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800/50 rounded-2xl border border-zinc-300 dark:border-zinc-800">
                        <button type="button" onClick={() => setFormData({...formData, status: 'active'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${(!formData.status || formData.status === 'active') ? 'bg-[#10b981] text-white shadow-lg' : 'text-zinc-500 dark:text-zinc-500'}`}>ATIVO</button>
                        <button type="button" onClick={() => setFormData({...formData, status: 'maintenance'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${formData.status === 'maintenance' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>MANUTENÇÃO</button>
                        <button type="button" onClick={() => setFormData({...formData, status: 'stolen'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${formData.status === 'stolen' ? 'bg-red-600 text-white' : 'text-zinc-500'}`}>ROUBADO</button>
                    </div>
                  </div>

                  {/* Instalação Toggle */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.1em]">INSTALAÇÃO DO EQUIPAMENTO</label>
                    <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800/50 rounded-2xl border border-zinc-300 dark:border-zinc-800">
                        <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_only'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${(!formData.installationType || formData.installationType === 'tag_only') ? 'bg-[#f59e0b] text-black shadow-lg' : 'text-zinc-500'}`}>SÓ TAG</button>
                        <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_tracker'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${formData.installationType === 'tag_tracker' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>TAG C/ RASTREADOR</button>
                    </div>
                  </div>

                  {/* Placa Input */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Placa</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                           <input type="text" required placeholder="ABC1234" value={formData.plate || ''} onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })} className="w-full px-5 py-3 bg-white dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 rounded-xl text-lg font-mono font-black text-zinc-900 dark:text-white focus:border-primary-500 outline-none transition-all uppercase placeholder:text-zinc-300 dark:placeholder:text-zinc-700" />
                           <button type="button" onClick={() => plateLookupService.lookup(formData.plate || '').then(r => r && setFormData({...formData, ...r}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-primary-500"><Search size={20}/></button>
                        </div>
                        <button type="button" onClick={handleHinovaLookup} className="px-5 bg-[#006e82] hover:bg-[#008ba3] text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">HINOVA</button>
                    </div>
                  </div>

                  <SearchableSelect label="Categoria" options={categories.map(c => ({ value: c.id, label: c.name }))} value={formData.type || ''} onChange={val => setFormData({...formData, type: val})} />
                  
                  <SearchableSelect 
                    label="Empresa" 
                    options={companies.map(c => ({ value: c.id, label: c.name }))} 
                    value={formData.companyId || ''} 
                    onChange={val => setFormData({ ...formData, companyId: val })} 
                    disabled={isHinovaImport}
                    icon={<Building2 size={14} />} 
                  />

                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Modelo</label>
                        <button type="button" onClick={() => setIsFipeModalOpen(true)} className="text-[9px] font-black text-primary-500 flex items-center gap-1 hover:underline border border-primary-500/20 px-2 py-0.5 rounded-md"><BookOpen size={10} /> Consultar FIPE</button>
                    </div>
                    <input type="text" required value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} className="w-full px-5 py-3 bg-white dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 transition-all" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ano</label>
                        <input type="text" value={formData.year || ''} onChange={e => setFormData({ ...formData, year: e.target.value })} className="w-full px-5 py-3 bg-white dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                     </div>
                     <div className="space-y-2 relative" ref={tagDropdownRef}>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tag Vinculada</label>
                        <input type="text" placeholder="Busca por Nome ou SN..." value={tagSearchTerm} onFocus={() => setShowTagDropdown(true)} onChange={e => { setTagSearchTerm(e.target.value); setShowTagDropdown(true); }} className="w-full px-5 py-3 bg-white dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" />
                        {showTagDropdown && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                              <div className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-black uppercase text-zinc-500 cursor-pointer" onClick={() => { setFormData({...formData, tagId: undefined}); setTagSearchTerm(''); setShowTagDropdown(false); }}>-- Sem Tag --</div>
                              {tags.filter(t => 
                                t.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) || 
                                t.accessoryId.toLowerCase().includes(tagSearchTerm.toLowerCase())
                              ).map(t => (
                                <div 
                                  key={t.id} 
                                  onClick={() => { setFormData({...formData, tagId: t.id}); setTagSearchTerm(t.name); setShowTagDropdown(false); }} 
                                  className={`p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold cursor-pointer rounded-lg flex flex-col gap-0.5 ${formData.tagId === t.id ? 'bg-primary-500/10 text-primary-600' : 'text-zinc-700 dark:text-zinc-200'}`}
                                >
                                  <span>{t.name}</span>
                                  <span className="text-[9px] text-zinc-400 font-mono">SN: {t.accessoryId}</span>
                                </div>
                              ))}
                          </div>
                        )}
                     </div>
                  </div>
              </div>

              {/* COLUNA DIREITA: DADOS DO CLIENTE */}
              <div className="space-y-6 flex flex-col h-full">
                 <div className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800/50 pb-3">DADOS DO CLIENTE</div>
                 
                 <div className="p-8 bg-zinc-100/50 dark:bg-zinc-850/50 rounded-[32px] border border-zinc-200 dark:border-zinc-800 space-y-5 flex-1 shadow-inner">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome do Associado</label>
                        <div className="relative">
                            <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input type="text" value={clientFormData.name || ''} onChange={e => setClientFormData({ ...clientFormData, name: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" placeholder="Nome Completo" />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">CPF</label>
                        <input type="text" value={clientFormData.cpf || ''} onChange={e => setClientFormData({ ...clientFormData, cpf: e.target.value })} className="w-full px-5 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" placeholder="000.000.000-00" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telefone</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input type="text" value={clientFormData.phone || ''} onChange={e => setClientFormData({ ...clientFormData, phone: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" placeholder="(00) 00000-0000" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Email</label>
                        <input type="email" value={clientFormData.email || ''} onChange={e => setClientFormData({ ...clientFormData, email: e.target.value })} className="w-full px-5 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500" placeholder="cliente@email.com" />
                    </div>

                    {/* Portal Access Toggle - Mantendo design solicitado */}
                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                        <label className="text-[10px] font-black uppercase text-zinc-500 block mb-3">Terá acesso ao Portal?</label>
                        <div className="flex p-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-300 dark:border-zinc-800">
                            <button type="button" onClick={() => setClientFormData({...clientFormData, hasAccess: true})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${clientFormData.hasAccess ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500'}`}>SIM</button>
                            <button type="button" onClick={() => setClientFormData({...clientFormData, hasAccess: false})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${!clientFormData.hasAccess ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500'}`}>NÃO</button>
                        </div>
                        {clientFormData.hasAccess && (
                          <p className="text-[9px] text-zinc-500 font-bold uppercase mt-3 animate-pulse">Senha inicial: 6 primeiros dígitos do CPF</p>
                        )}
                    </div>
                 </div>

                 <button type="submit" className="w-full py-5 bg-[#e67e00] hover:bg-[#ff8c00] text-white rounded-2xl font-black uppercase tracking-[0.1em] text-sm flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] transition-all">
                    <Save size={20} /> Salvar Veículo
                 </button>
              </div>

              {/* Status Hinova Popup */}
              {hinovaStatus.open && (
                <div className="absolute inset-0 z-[1100] bg-white/95 dark:bg-zinc-950/98 backdrop-blur-xl rounded-[32px] flex flex-col items-center justify-center p-10 text-center animate-in fade-in">
                    <div className={`p-8 rounded-[40px] mb-8 ${hinovaStatus.step === 'loading' ? 'bg-primary-500/10 text-primary-500' : hinovaStatus.step === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {hinovaStatus.step === 'loading' && <Loader2 size={64} className="animate-spin" />}
                        {hinovaStatus.step === 'success' && <CheckCircle size={64} />}
                        {hinovaStatus.step === 'error' && <XCircle size={64} />}
                    </div>
                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white mb-2 uppercase">{hinovaStatus.message}</h3>
                    {hinovaStatus.details && <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{hinovaStatus.details}</p>}
                    {hinovaStatus.step === 'error' && <button onClick={() => setHinovaStatus(prev => ({ ...prev, open: false }))} className="mt-8 px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-[10px] uppercase">Tentar Novamente</button>}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
