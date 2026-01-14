
import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { storage } from '../services/storage';
import { hinovaService } from '../services/hinova';
import { fipeService, FipeReference } from '../services/fipe';
import { Vehicle, Tag, Company, VehicleCategory, Client } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Search, Activity, CheckCircle, Wrench, ShieldAlert, 
  Car, Truck, Bike, Edit2, Trash2, Link as LinkIcon, 
  Loader2, X, CheckCircle2, XCircle, Save, Hash, 
  Tag as TagIcon, Building2, User, Phone, Book, ChevronRight, Mail, Calendar,
  Download, FileText, FileSpreadsheet, FileCode
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
    <div className="flex items-center px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
      {/* PLACA */}
      <div className="w-24 md:w-[15%] shrink-0 flex items-center gap-2 md:gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-black text-[10px] md:text-xs">
            {vehicle.plate}
          </div>
          <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded text-center tracking-widest text-white shrink-0 ${
            vehicle.status === 'active' ? 'bg-emerald-500' : vehicle.status === 'stolen' ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {vehicle.status === 'active' ? 'ATIVO' : vehicle.status === 'stolen' ? 'ROUBADO' : 'MANUT.'}
          </span>
        </div>
        <div className="hidden sm:block p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400 group-hover:text-primary-500 transition-colors">
          {getIcon(14)}
        </div>
      </div>

      {/* VEÍCULO */}
      <div className="flex-1 md:w-[35%] px-3 overflow-hidden">
        <h3 className="font-black text-zinc-900 dark:text-white uppercase text-[11px] md:text-xs truncate leading-tight">{vehicle.model}</h3>
        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate">{cat?.name || 'VEÍCULO'}</p>
      </div>

      {/* CLIENTE */}
      <div className="w-24 md:w-[25%] px-2 overflow-hidden">
        <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">{client?.name || 'SEM VÍNCULO'}</p>
        {client && <p className="text-[8px] text-zinc-400 font-mono tracking-tighter truncate hidden sm:block">{client.cpf}</p>}
      </div>

      {/* RESPONSÁVEL E DATA */}
      <div className="hidden md:flex w-[15%] flex-col justify-center">
         <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">
           {vehicle.updatedBy || 'SISTEMA'}
         </span>
         <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
           <Calendar size={8} /> {new Date(vehicle.createdAt).toLocaleDateString()}
         </span>
      </div>

      {/* AÇÕES */}
      <div className="w-8 md:w-[10%] flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(vehicle)} className="p-1.5 md:p-2 text-zinc-300 hover:text-primary-500 transition-colors"><Edit2 size={14}/></button>
        <button onClick={() => onDelete(vehicle.id)} className="hidden sm:block p-2 text-zinc-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
      </div>
    </div>
  );
});

export const Vehicles = () => {
  const { addNotification } = useNotification();
  const { user: currentUser } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Vehicle>>({ status: 'active', installationType: 'tag_only' });
  const [clientData, setClientData] = useState<Partial<Client>>({ hasAccess: false });
  const [tagSearch, setTagSearch] = useState('');
  const [isTagListOpen, setIsTagListOpen] = useState(false);
  const [hinovaStatus, setHinovaStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [isFipeModalOpen, setIsFipeModalOpen] = useState(false);
  const [fipeStep, setFipeStep] = useState(1);
  const [fipeList, setFipeList] = useState<FipeReference[]>([]);
  const [fipeLoading, setFipeLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [v, t, c, cat, cl] = await Promise.all([
        storage.getVehicles(), storage.getTags(), storage.getCompanies(), 
        storage.getCategories(), storage.getClients()
    ]);
    setVehicles(v); setTags(t); setCompanies(c); setCategories(cat); setClients(cl);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredVehicles = useMemo(() => {
    const term = globalSearch.toLowerCase().trim();
    return vehicles.filter(v => {
      const client = clients.find(c => c.id === v.clientId);
      return v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term) || client?.name.toLowerCase().includes(term);
    });
  }, [vehicles, globalSearch, clients]);

  const getExportData = () => {
    return filteredVehicles.map(v => {
      const client = clients.find(c => c.id === v.clientId);
      const category = categories.find(c => c.id === v.type);
      const company = companies.find(c => c.id === v.companyId);
      const tag = tags.find(t => t.id === v.tagId);
      
      return {
        'Placa': v.plate,
        'Status': v.status === 'active' ? 'Ativo' : v.status === 'stolen' ? 'Roubado' : 'Manutenção',
        'Modelo': v.model,
        'Ano': v.year || '-',
        'Categoria': category?.name || '-',
        'Regional': company?.name || '-',
        'Cliente': client?.name || 'Sem Vínculo',
        'CPF Cliente': client?.cpf || '-',
        'Equipamento': v.installationType === 'tag_tracker' ? 'Tag + Rastreador' : 'Só Tag',
        'ID Tag': tag?.accessoryId || '-',
        'Cadastrado por': v.updatedBy || 'SISTEMA',
        'Data Cadastro': new Date(v.createdAt).toLocaleDateString()
      };
    });
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const data = getExportData();
      
      doc.setFontSize(20);
      doc.setTextColor(24, 24, 27);
      doc.text("RELATÓRIO GERAL DE FROTA", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(113, 113, 122);
      doc.text(`Total de Veículos: ${data.length} | Gerado em: ${new Date().toLocaleString()}`, 14, 28);

      autoTable(doc, {
        startY: 35,
        head: [['Placa', 'Status', 'Modelo', 'Ano', 'Categoria', 'Cliente', 'Equipamento', 'Cadastro']],
        body: data.map(v => [
          v.Placa, v.Status, v.Modelo, v.Ano, v.Categoria, v.Cliente, v.Equipamento, v['Data Cadastro']
        ]),
        theme: 'striped',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
        styles: { fontSize: 8 }
      });

      doc.save(`frota_ktag_${Date.now()}.pdf`);
      addNotification('success', 'Exportação PDF', 'O relatório foi gerado com sucesso.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Veículos");
    XLSX.writeFile(wb, `frota_ktag_${Date.now()}.xlsx`);
    addNotification('success', 'Exportação Excel', 'Planilha gerada com sucesso.');
  };

  const handleExportCSV = () => {
    const data = getExportData();
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `frota_ktag_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('success', 'Exportação CSV', 'Arquivo CSV gerado com sucesso.');
  };

  const checkExistingClient = useCallback((cpf: string) => {
    if (!cpf) return;
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) return;
    const existing = clients.find(c => c.cpf.replace(/\D/g, '') === cleanCpf);
    if (existing) {
        setClientData(existing);
        addNotification('info', 'Banco de Dados', `Cliente ${existing.name} já cadastrado. Dados carregados.`);
    }
  }, [clients, addNotification]);

  const handleHinovaLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) {
        addNotification('info', 'Hinova', 'Digite uma placa válida.');
        return;
    }
    
    setHinovaStatus('loading');
    try {
        const result = await hinovaService.searchVehicle(formData.plate);
        if (result) {
            setFormData(prev => ({ ...prev, ...result.vehicle }));
            setHinovaStatus('success');
            
            const hinovaCpf = result.client.cpf?.replace(/\D/g, '') || '';
            const existingClient = clients.find(c => c.cpf.replace(/\D/g, '') === hinovaCpf);
            
            if (existingClient) {
                setClientData(existingClient);
                addNotification('success', 'Hinova', 'Veículo localizado e vinculado ao cliente existente.');
            } else {
                setClientData(result.client);
                addNotification('success', 'Hinova', 'Veículo e novo cliente importados.');
            }
        } else {
            setHinovaStatus('error');
            addNotification('error', 'Hinova', 'Não encontrado.');
        }
    } catch (e: any) {
        setHinovaStatus('error');
        addNotification('error', 'API SGA', e.message);
    } finally {
        setTimeout(() => setHinovaStatus('idle'), 3000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.model || !clientData.cpf) return;

    const cleanCpf = clientData.cpf.replace(/\D/g, '');
    const existingClient = clients.find(c => c.cpf.replace(/\D/g, '') === cleanCpf);

    let finalClientId = existingClient ? existingClient.id : (clientData.id || crypto.randomUUID());
    const clientToSave: Client = {
        ...clientData as Client, 
        id: finalClientId, 
        createdAt: clientData.createdAt || Date.now()
    };
    await storage.saveClient(clientToSave);

    const vehicleId = formData.id || crypto.randomUUID();
    const vehicleToSave: Vehicle = {
        ...formData as Vehicle, 
        id: vehicleId, 
        clientId: finalClientId,
        plate: formData.plate.toUpperCase(), 
        createdAt: formData.createdAt || Date.now(),
        updatedBy: currentUser?.name || 'SISTEMA'
    };
    await storage.saveVehicle(vehicleToSave);
    addNotification('success', 'Sucesso', 'Veículo gravado no sistema.');
    setIsModalOpen(false); 
    loadData();
  };

  const startFipeSearch = async () => {
    setFipeStep(1); setFipeLoading(true); setIsFipeModalOpen(true);
    const brands = await fipeService.getBrands('carros');
    setFipeList(brands); setFipeLoading(false);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Veículos</h1>
          <p className="text-zinc-500 text-xs mt-1 font-medium">Gestão operacional da frota.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Export Group */}
          <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm mr-2">
             <button onClick={handleExportPDF} title="Exportar PDF" className="p-2.5 text-zinc-400 hover:text-red-500 transition-colors"><FileText size={18}/></button>
             <button onClick={handleExportExcel} title="Exportar Excel" className="p-2.5 text-zinc-400 hover:text-emerald-500 transition-colors"><FileSpreadsheet size={18}/></button>
             <button onClick={handleExportCSV} title="Exportar CSV" className="p-2.5 text-zinc-400 hover:text-blue-500 transition-colors"><FileCode size={18}/></button>
          </div>
          <button
            onClick={() => { 
              setFormData({ status: 'active', installationType: 'tag_only', type: 'cat-car' }); 
              setClientData({ hasAccess: false }); setTagSearch(''); setIsModalOpen(true);
            }}
            className="flex-1 md:flex-none bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[9px] tracking-widest shadow-xl transition-all"
          >
            <Plus size={16} strokeWidth={3} /> ADICIONAR VEÍCULO
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input type="text" placeholder="Buscar placa, modelo ou cliente..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm text-sm font-bold outline-none focus:border-primary-500" />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
         <div className="flex px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 text-[8px] font-black uppercase tracking-widest text-zinc-400">
            <div className="w-24 md:w-[15%] shrink-0">Placa & Status</div>
            <div className="flex-1 md:w-[35%] px-3">Veículo</div>
            <div className="w-24 md:w-[25%] px-2">Cliente</div>
            <div className="hidden md:block w-[15%]">Responsável & Data</div>
            <div className="w-8 md:w-[10%] text-right">Ações</div>
         </div>
         <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {filteredVehicles.length === 0 ? (
               <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                  <Car size={48} />
                  <span className="text-[10px] font-black uppercase">Nenhum veículo localizado</span>
               </div>
            ) : (
              filteredVehicles.map(v => (
                <VehicleRow key={v.id} vehicle={v} tags={tags} categories={categories} clients={clients} onEdit={(v: any) => { setFormData(v); setClientData(clients.find(c => c.id === v.clientId) || {}); setTagSearch(tags.find(t => t.id === v.tagId)?.accessoryId || ''); setIsModalOpen(true); }} onDelete={async (id: string) => { if(confirm('Excluir?')) { await storage.deleteVehicle(id); loadData(); } }} />
              ))
            )}
         </div>
      </div>

      {/* MODAL PRINCIPAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-950 rounded-[32px] w-full max-w-4xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            
            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl md:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">NOVO VEÍCULO</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-zinc-300 hover:text-zinc-600 transition-colors"><X size={24}/></button>
                </div>

                <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                    <div className="space-y-5">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">DADOS DO VEÍCULO</h3>
                        
                        <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-100 dark:border-zinc-800">
                            {[
                                { id: 'active', label: 'ATIVO', activeColor: 'bg-[#10b981]' },
                                { id: 'maintenance', label: 'MANUTENÇÃO', activeColor: 'bg-zinc-600' },
                                { id: 'stolen', label: 'ROUBADO', activeColor: 'bg-red-600' },
                            ].map(s => (
                                <button key={s.id} type="button" onClick={() => setFormData({...formData, status: s.id as any})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.status === s.id ? `${s.activeColor} text-white shadow-sm` : 'text-zinc-500'}`}>{s.label}</button>
                            ))}
                        </div>

                        <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">INSTALAÇÃO DO EQUIPAMENTO</label>
                             <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-100 dark:border-zinc-800">
                                <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_only'})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.installationType === 'tag_only' ? 'bg-[#f59e0b] text-black' : 'text-zinc-500'}`}>SÓ TAG</button>
                                <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_tracker'})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.installationType === 'tag_tracker' ? 'bg-[#f59e0b] text-black' : 'text-zinc-500'}`}>TAG C/ RASTREADOR</button>
                             </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">PLACA</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" required maxLength={7} value={formData.plate || ''} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-base font-mono font-black shadow-inner outline-none focus:border-zinc-400" placeholder="ABC1234" />
                                    <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-200" />
                                </div>
                                <button type="button" onClick={handleHinovaLookup} disabled={hinovaStatus === 'loading'} className="px-6 h-12 rounded-xl bg-[#006e82] hover:bg-[#008ba3] text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                    {hinovaStatus === 'loading' ? <Loader2 className="animate-spin" size={16}/> : 'HINOVA'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">CATEGORIA</label>
                            <select value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none">
                                <option value="">Selecione...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">EMPRESA</label>
                            <div className="relative">
                                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                                <select value={formData.companyId || ''} onChange={e => setFormData({...formData, companyId: e.target.value})} className="w-full pl-11 pr-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none">
                                    <option value="">Selecione...</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">MODELO</label>
                                <button type="button" onClick={startFipeSearch} className="flex items-center gap-1 text-[8px] font-black text-[#f59e0b] border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-2 py-0.5 rounded uppercase tracking-widest"><Book size={10}/> FIPE</button>
                            </div>
                            <input type="text" required value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">ANO</label>
                                <input type="text" value={formData.year || ''} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" />
                            </div>
                            
                            <div className="space-y-2 relative">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">TAG VINCULADA</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Busca Nome/SN..." 
                                        value={tagSearch} 
                                        onFocus={() => setIsTagListOpen(true)} 
                                        onChange={e => { setTagSearch(e.target.value); setIsTagListOpen(true); }} 
                                        className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:border-primary-500" 
                                    />
                                    {isTagListOpen && (
                                        <div className="absolute top-full mt-1 left-0 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[1100] max-h-40 overflow-y-auto p-1 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {tags.filter(t => t.accessoryId.toLowerCase().includes(tagSearch.toLowerCase()) || t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 ? (
                                                <div className="p-3 text-[9px] font-black text-zinc-400 uppercase text-center italic">Nenhuma tag disponível</div>
                                            ) : (
                                                tags.filter(t => t.accessoryId.toLowerCase().includes(tagSearch.toLowerCase()) || t.name.toLowerCase().includes(tagSearch.toLowerCase())).map(t => (
                                                    <button key={t.id} type="button" onClick={() => { setFormData({...formData, tagId: t.id}); setTagSearch(t.accessoryId); setIsTagListOpen(false); }} className="w-full p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left border-b last:border-0 border-zinc-100 dark:border-zinc-800 group transition-colors">
                                                        <span className="text-[10px] font-black uppercase text-zinc-900 dark:text-white block group-hover:text-primary-500">{t.accessoryId}</span>
                                                        <span className="text-[8px] font-bold text-zinc-400 uppercase">{t.name}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col h-full">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 mb-5">DADOS DO CLIENTE</h3>
                        
                        <div className="bg-zinc-50/50 dark:bg-zinc-900/30 p-6 md:p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-900 space-y-6 shadow-inner flex-1">
                            
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">NOME DO ASSOCIADO</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-200" />
                                    <input type="text" required value={clientData.name || ''} onChange={e => setClientData({...clientData, name: e.target.value})} className="w-full pl-11 pr-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" placeholder="Nome Completo" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">CPF</label>
                                <input type="text" required value={clientData.cpf || ''} onBlur={(e) => checkExistingClient(e.target.value)} onChange={e => setClientData({...clientData, cpf: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono font-bold text-xs outline-none" placeholder="000.000.000-00" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">TELEFONE</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-200" />
                                    <input type="text" value={clientData.phone || ''} onChange={e => setClientData({...clientData, phone: e.target.value})} className="w-full pl-11 pr-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" placeholder="(84) 99999-9999" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">EMAIL</label>
                                <input type="email" value={clientData.email || ''} onChange={e => setClientData({...clientData, email: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" placeholder="cliente@email.com" />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">TERÁ ACESSO AO PORTAL?</label>
                                <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-100 dark:border-zinc-800 h-12">
                                    <button type="button" onClick={() => setClientData({...clientData, hasAccess: true})} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${clientData.hasAccess ? 'bg-zinc-800 dark:bg-white text-white dark:text-black shadow-lg' : 'text-zinc-500'}`}>SIM</button>
                                    <button type="button" onClick={() => setClientData({...clientData, hasAccess: false})} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${!clientData.hasAccess ? 'bg-[#18181b] text-white' : 'text-zinc-500'}`}>NÃO</button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="mt-8 w-full h-16 bg-[#f59e0b] hover:bg-[#fbbf24] text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                            <Save size={20} /> SALVAR VEÍCULO
                        </button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      )}

      {isFipeModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[28px] w-full max-w-sm p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Tabela FIPE</h3>
                <button onClick={() => setIsFipeModalOpen(false)} className="text-zinc-400"><X size={20}/></button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto p-1 custom-scrollbar">
              {fipeLoading ? <div className="py-10 flex flex-col items-center gap-3 text-zinc-400"><Loader2 className="animate-spin" size={24} /><span className="text-[9px] font-black uppercase">API FIPE...</span></div> : fipeList.slice(0, 50).map((item) => (
                  <button key={item.codigo} onClick={async () => { 
                      const models = await fipeService.getModels('carros', item.codigo); 
                      if (models[0]) {
                        setFormData(prev => ({...prev, model: `${item.nome} ${models[0].nome}`}));
                        setIsFipeModalOpen(false);
                      }
                  }} className="w-full flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-primary-500 hover:text-black rounded-xl text-left transition-all group font-bold uppercase text-[10px]">{item.nome} <ChevronRight size={14}/></button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
