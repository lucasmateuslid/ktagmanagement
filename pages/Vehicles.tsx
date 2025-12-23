
import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova';
import { Vehicle, Tag, Company, VehicleCategory, Client } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Search, Activity, CheckCircle, Wrench, ShieldAlert, 
  Car, Truck, Bike, Edit2, Trash2, Link as LinkIcon, 
  Loader2, X, CheckCircle2, XCircle, Save, Hash, 
  Tag as TagIcon, Building2, User, Palette, Calendar, 
  Settings2, Smartphone, Cpu, ShieldCheck, Mail, Phone, Book, Check, MoreVertical
} from 'lucide-react';

// ITEM DA LISTA COM DUPLO LAYOUT (TABELA DESKTOP / CARD MOBILE CONFORME FOTO)
const VehicleRow = React.memo(({ vehicle, tags, categories, clients, onEdit, onDelete }: any) => {
  const tag = tags.find((t: any) => t.id === vehicle.tagId);
  const client = clients.find((c: any) => c.id === vehicle.clientId);
  const cat = categories.find((c: any) => c.id === vehicle.type);
  
  const getIcon = (size = 16) => {
    if (cat?.fipeType === 'caminhoes') return <Truck size={size} />;
    if (cat?.fipeType === 'motos') return <Bike size={size} />;
    return <Car size={size} />;
  };

  return (
    <>
      {/* LAYOUT DESKTOP (TABELA) */}
      <div className="hidden md:flex items-center px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
        <div className="w-[15%] flex items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-black text-sm tracking-tighter">
              {vehicle.plate}
            </div>
            {vehicle.status === 'active' ? (
              <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded text-center tracking-widest">ATIVO</span>
            ) : vehicle.status === 'stolen' ? (
              <span className="bg-red-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded text-center tracking-widest">ROUBADO</span>
            ) : (
              <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded text-center tracking-widest">MANUTENÇÃO</span>
            )}
          </div>
          <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 group-hover:text-primary-500 transition-colors shadow-inner">
            {getIcon()}
          </div>
        </div>

        <div className="w-[35%] pr-10">
          <h3 className="font-black text-zinc-900 dark:text-white uppercase text-xs leading-tight mb-1 truncate">{vehicle.model}</h3>
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{cat?.name || 'CARRO'}</p>
          
          {tag && (
            <div className="inline-flex flex-col bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-1.5">
               <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <LinkIcon size={12} />
                  <span className="text-[10px] font-black uppercase">{tag.accessoryId}</span>
               </div>
               <span className="text-[7px] font-mono text-zinc-400 uppercase tracking-widest ml-4.5">NOME: {tag.name}</span>
            </div>
          )}
        </div>

        <div className="w-[25%] pr-10">
          <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">{client?.name || 'NÃO VINCULADO'}</p>
        </div>

        <div className="w-[15%]">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-black text-zinc-400">-</div>
             <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">SISTEMA</span>
          </div>
        </div>

        <div className="w-[10%] flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(vehicle)} className="p-2 text-zinc-300 hover:text-primary-500 transition-colors"><Edit2 size={16}/></button>
          <button onClick={() => onDelete(vehicle.id)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
        </div>
      </div>

      {/* LAYOUT MOBILE (CARD COMPACTO - CONFORME FOTO) */}
      <div className="md:hidden p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between group active:bg-zinc-50 dark:active:bg-zinc-900 transition-colors">
        <div className="flex flex-col gap-2.5">
           {/* Nome do Veículo (Topo) */}
           <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest truncate max-w-[180px]">
             {vehicle.model.length > 20 ? vehicle.model.substring(0, 18) + '...' : vehicle.model}
           </h4>

           {/* Placa e Ícone */}
           <div className="flex items-center gap-3">
              <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-black text-xs shadow-sm">
                {vehicle.plate}
              </div>
              <div className="text-zinc-300 dark:text-zinc-600">
                {getIcon(14)}
              </div>
           </div>

           {/* Status e Conectividade */}
           <div className="flex items-center gap-1.5">
              <span className={`text-white text-[8px] font-black px-2 py-0.5 rounded tracking-widest uppercase ${
                vehicle.status === 'active' ? 'bg-emerald-500' : vehicle.status === 'stolen' ? 'bg-red-500' : 'bg-amber-500'
              }`}>
                {vehicle.status === 'active' ? 'ATIVO' : vehicle.status === 'stolen' ? 'ROUBADO' : 'MANUT.'}
              </span>
              {tag && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                   <LinkIcon size={10} />
                   <span className="text-[9px] font-black">{tag.accessoryId}</span>
                </div>
              )}
           </div>
        </div>

        {/* Lado Direito: Cliente e Responsável */}
        <div className="flex items-center gap-4">
           <div className="h-10 w-[1px] bg-zinc-100 dark:bg-zinc-800" />
           <div className="flex flex-col gap-1 items-start min-w-[60px]">
              <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate max-w-[80px]">
                {client?.name?.split(' ')[0] || '---'}
              </span>
              <div className="flex items-center gap-1">
                 <span className="text-zinc-200 dark:text-zinc-800">|</span>
                 <span className="text-[8px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.15em]">SISTEMA</span>
              </div>
           </div>
           
           {/* Menu de Ações Mobile */}
           <div className="flex flex-col gap-2 ml-2">
              <button onClick={() => onEdit(vehicle)} className="p-2 text-zinc-300 active:text-primary-500"><Edit2 size={14}/></button>
              <button onClick={() => onDelete(vehicle.id)} className="p-2 text-zinc-300 active:text-red-500"><Trash2 size={14}/></button>
           </div>
        </div>
      </div>
    </>
  );
});

export const Vehicles = () => {
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user } = useAuth();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Vehicle>>({ status: 'active', installationType: 'tag_only' });
  const [clientData, setClientData] = useState<Partial<Client>>({ hasAccess: false });
  const [tagSearch, setTagSearch] = useState('');
  const [isTagListOpen, setIsTagListOpen] = useState(false);
  const [hinovaStatus, setHinovaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const loadData = useCallback(async () => {
    const [v, t, c, cat, cl] = await Promise.all([
        storage.getVehicles(), storage.getTags(), storage.getCompanies(), 
        storage.getCategories(), storage.getClients()
    ]);
    setVehicles(v); setTags(t); setCompanies(c); setCategories(cat); setClients(cl);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const availableTags = useMemo(() => {
    return tags.filter(t => !vehicles.some(v => v.tagId === t.id && v.id !== formData.id));
  }, [tags, vehicles, formData.id]);

  const filteredTags = useMemo(() => {
    if (!tagSearch) return [];
    const term = tagSearch.toLowerCase();
    return availableTags.filter(t => 
      t.accessoryId.toLowerCase().includes(term) || 
      t.name.toLowerCase().includes(term)
    );
  }, [availableTags, tagSearch]);

  const handleEdit = (vehicle: Vehicle) => {
    setFormData(vehicle);
    const client = clients.find(c => c.id === vehicle.clientId);
    setClientData(client || { hasAccess: false });
    const tag = tags.find(t => t.id === vehicle.tagId);
    setTagSearch(tag ? `${tag.accessoryId} - ${tag.name}` : '');
    setIsModalOpen(true);
    setHinovaStatus('idle');
  };

  const handleHinovaLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) return;
    setHinovaStatus('loading');
    try {
        const result = await hinovaService.searchVehicle(formData.plate);
        if (result) {
            setFormData(prev => ({ ...prev, ...result.vehicle }));
            setClientData(result.client);
            setHinovaStatus('success');
            setTimeout(() => setHinovaStatus('idle'), 3000);
        } else {
            setHinovaStatus('error');
            setTimeout(() => setHinovaStatus('idle'), 3000);
        }
    } catch (e: any) {
        setHinovaStatus('error');
        setTimeout(() => setHinovaStatus('idle'), 3000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.model) return;

    const clientId = clientData.id || crypto.randomUUID();
    const finalClient: Client = {
        ...clientData as Client,
        id: clientId,
        name: clientData.name || 'CLIENTE S/ NOME',
        cpf: clientData.cpf || '000.000.000-00',
        phone: clientData.phone || '',
        createdAt: clientData.createdAt || Date.now()
    };
    await storage.saveClient(finalClient);

    const vehicleId = formData.id || crypto.randomUUID();
    const vehicleToSave: Vehicle = {
        ...formData as Vehicle,
        id: vehicleId,
        clientId: clientId,
        plate: formData.plate.toUpperCase(),
        createdAt: formData.createdAt || Date.now()
    };
    await storage.saveVehicle(vehicleToSave);
    
    addNotification('success', 'Sucesso', 'Ficha do veículo gravada.');
    setIsModalOpen(false);
    loadData();
  };

  const filteredVehicles = useMemo(() => {
    const term = globalSearch.toLowerCase().trim();
    if (!term) return vehicles;
    return vehicles.filter(v => {
      const client = clients.find(c => c.id === v.clientId);
      return v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term) || client?.name.toLowerCase().includes(term);
    });
  }, [vehicles, globalSearch, clients]);

  return (
    <div className="space-y-8 pb-32">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Veículos</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestão centralizada de veículos ativos.</p>
        </div>
        <button
          onClick={() => { 
            setFormData({ status: 'active', installationType: 'tag_only', type: 'cat-car' }); 
            setClientData({ hasAccess: false }); 
            setTagSearch(''); 
            setIsModalOpen(true); 
            setHinovaStatus('idle');
          }}
          className="bg-primary-500 hover:bg-primary-400 text-black px-6 md:px-8 py-3 md:py-4 rounded-[16px] md:rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-primary-500/20 transition-all active:scale-95 shrink-0"
        >
          <Plus size={18} strokeWidth={4} /> <span className="hidden sm:inline">ADICIONAR VEÍCULO</span><span className="sm:hidden">NOVO</span>
        </button>
      </div>

      {/* STATS RESPONSIVOS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'Total Veículos', value: vehicles.length, icon: Activity, color: 'zinc' },
            { label: 'Ativos', value: vehicles.filter(v => v.status === 'active').length, icon: CheckCircle, color: 'emerald' },
            { label: 'Manutenção', value: vehicles.filter(v => v.status === 'maintenance').length, icon: Wrench, color: 'amber' },
            { label: 'Alertas Roubo', value: vehicles.filter(v => v.status === 'stolen').length, icon: ShieldAlert, color: 'red' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-[24px] md:rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-4 md:gap-6">
                <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl bg-${s.color}-500/10 text-${s.color}-500`}><s.icon size={16} /></div>
                <div>
                   <p className="text-[8px] md:text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 md:mb-1">{s.label}</p>
                   <p className="text-xl md:text-3xl font-display font-black text-zinc-900 dark:text-white">{s.value}</p>
                </div>
            </div>
          ))}
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Buscar por placa, modelo ou cliente..." 
          value={globalSearch} 
          onChange={e => setGlobalSearch(e.target.value)} 
          className="w-full pl-16 pr-8 py-4 md:py-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-full shadow-sm text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all" 
        />
      </div>

      {/* TABELA / LISTA DE VEÍCULOS */}
      <div className="bg-white dark:bg-zinc-900 rounded-[28px] md:rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
         {/* CABEÇALHO DA TABELA - OCULTO NO MOBILE */}
         <div className="hidden md:flex px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 text-[9px] font-black uppercase tracking-widest text-zinc-400">
            <div className="w-[15%]">Placa & Tipo</div>
            <div className="w-[35%]">Veículo & Conectividade</div>
            <div className="w-[25%]">Cliente</div>
            <div className="w-[15%]">Responsável</div>
            <div className="w-[10%] text-right">Ações</div>
         </div>
         
         <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {filteredVehicles.map(v => (
              <VehicleRow key={v.id} vehicle={v} tags={tags} categories={categories} clients={clients} onEdit={handleEdit} onDelete={async (id: string) => { if(confirm('Excluir veículo?')) { await storage.deleteVehicle(id); loadData(); } }} />
            ))}
            {filteredVehicles.length === 0 && <div className="py-20 text-center text-zinc-400 font-bold uppercase text-xs">Nenhum veículo encontrado</div>}
         </div>
      </div>

      {/* MODAL DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 overflow-y-auto">
          <div className="bg-zinc-50 dark:bg-zinc-950 rounded-[30px] md:rounded-[40px] w-full max-w-5xl shadow-2xl relative border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-6 md:p-10">
                <div className="flex justify-between items-center mb-6 md:mb-10">
                    <h2 className="text-2xl md:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Novo Veículo</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={24}/></button>
                </div>

                <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                    
                    <div className="space-y-6 md:space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Dados do Veículo</h3>
                        
                        <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-1.5 rounded-2xl flex gap-1 border border-zinc-200 dark:border-zinc-700">
                            {[
                                { id: 'active', label: 'ATIVO', color: 'emerald' },
                                { id: 'maintenance', label: 'MANUTENÇÃO', color: 'amber' },
                                { id: 'stolen', label: 'ROUBADO', color: 'red' },
                            ].map(s => (
                                <button key={s.id} type="button" onClick={() => setFormData({...formData, status: s.id as any})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.status === s.id ? `bg-${s.color}-500 text-white shadow-lg` : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>{s.label}</button>
                            ))}
                        </div>

                        <div className="space-y-3">
                             <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Instalação do Equipamento</label>
                             <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-1.5 rounded-2xl flex gap-1 border border-zinc-200 dark:border-zinc-700">
                                <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_only'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.installationType === 'tag_only' ? 'bg-primary-500 text-black shadow-lg' : 'text-zinc-500'}`}>SÓ TAG</button>
                                <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_tracker'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.installationType === 'tag_tracker' ? 'bg-primary-500 text-black shadow-lg' : 'text-zinc-500'}`}>TAG C/ RASTREADOR</button>
                             </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Placa</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" required maxLength={7} value={formData.plate || ''} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} className="w-full pl-5 pr-12 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-lg font-mono font-black shadow-inner outline-none focus:border-primary-500 transition-all" placeholder="ABC1234" />
                                    <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-300" />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleHinovaLookup} 
                                    disabled={hinovaStatus === 'loading'} 
                                    className={`px-4 md:px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shrink-0 flex items-center gap-2 ${
                                        hinovaStatus === 'loading' ? 'bg-[#004e5d] text-zinc-300' : 
                                        hinovaStatus === 'success' ? 'bg-emerald-600 text-white' : 
                                        hinovaStatus === 'error' ? 'bg-red-600 text-white' : 
                                        'bg-[#006e82] hover:bg-[#008ba3] text-white'
                                    }`}
                                >
                                    {hinovaStatus === 'loading' ? <Loader2 size={14} className="animate-spin"/> : hinovaStatus === 'success' ? <CheckCircle2 size={14}/> : hinovaStatus === 'error' ? <XCircle size={14}/> : 'HINOVA'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Categoria</label>
                            <select value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 appearance-none">
                                <option value="">Selecione...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Empresa</label>
                            <div className="relative">
                                <Building2 size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <select value={formData.companyId || ''} onChange={e => setFormData({...formData, companyId: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 appearance-none">
                                    <option value="">Selecione...</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Modelo</label>
                                <button type="button" className="flex items-center gap-1.5 text-[8px] font-black text-primary-500 border border-primary-500/20 bg-primary-500/5 px-2 py-0.5 rounded uppercase tracking-widest"><Book size={10}/> FIPE</button>
                            </div>
                            <input type="text" required value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:gap-6">
                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Ano</label>
                                <input type="text" value={formData.year || ''} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500" />
                            </div>
                            <div className="space-y-3 relative">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Tag Vinculada</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Busca Nome/SN..." 
                                        value={tagSearch} 
                                        onFocus={() => setIsTagListOpen(true)}
                                        onChange={e => {
                                            setTagSearch(e.target.value);
                                            setIsTagListOpen(true);
                                        }} 
                                        className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500" 
                                    />
                                    {isTagListOpen && filteredTags.length > 0 && (
                                        <div className="absolute bottom-full mb-2 left-0 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[1001] max-h-48 overflow-y-auto">
                                            {filteredTags.map(t => (
                                                <button 
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({...formData, tagId: t.id});
                                                        setTagSearch(`${t.accessoryId} - ${t.name}`);
                                                        setIsTagListOpen(false);
                                                    }}
                                                    className="w-full p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left flex flex-col gap-1 border-b last:border-0 border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <span className="text-xs font-black uppercase text-zinc-900 dark:text-white">{t.accessoryId}</span>
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Dados do Cliente</h3>
                        
                        <div className="bg-white/50 dark:bg-zinc-900/50 p-6 md:p-10 rounded-[32px] md:rounded-[48px] border border-zinc-200 dark:border-zinc-800 space-y-6 md:space-y-8 shadow-inner">
                            
                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Nome do Associado</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300" />
                                    <input type="text" value={clientData.name || ''} onChange={e => setClientData({...clientData, name: e.target.value})} className="w-full pl-14 pr-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500" placeholder="Nome Completo" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">CPF</label>
                                <input type="text" value={clientData.cpf || ''} onChange={e => setClientData({...clientData, cpf: e.target.value})} className="w-full px-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-mono font-bold text-sm outline-none focus:border-primary-500" placeholder="000.000.000-00" />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Telefone</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300" />
                                    <input type="text" value={clientData.phone || ''} onChange={e => setClientData({...clientData, phone: e.target.value})} className="w-full pl-14 pr-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500" placeholder="(00) 00000-0000" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Email</label>
                                <input type="email" value={clientData.email || ''} onChange={e => setClientData({...clientData, email: e.target.value})} className="w-full px-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:border-primary-500" placeholder="cliente@email.com" />
                            </div>

                            <div className="space-y-3 pt-4">
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Terá acesso ao portal?</label>
                                <div className="bg-zinc-200/50 dark:bg-zinc-950 p-1.5 rounded-2xl flex gap-1 border border-zinc-200 dark:border-zinc-700">
                                    <button type="button" onClick={() => setClientData({...clientData, hasAccess: true})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${clientData.hasAccess ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg' : 'text-zinc-500'}`}>SIM</button>
                                    <button type="button" onClick={() => setClientData({...clientData, hasAccess: false})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!clientData.hasAccess ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg' : 'text-zinc-500'}`}>NÃO</button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="w-full py-5 md:py-6 bg-primary-500 hover:bg-primary-400 text-black rounded-[20px] md:rounded-[28px] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-4">
                            <Save size={24} /> SALVAR VEÍCULO
                        </button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
