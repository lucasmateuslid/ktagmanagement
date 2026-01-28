
import React from 'react';
import { X, Save, Search, Loader2, Building2, Book, User, Phone, ClipboardCheck, CreditCard, Calendar } from 'lucide-react';
import { Vehicle, Client, Company, VehicleCategory, Tag, DeviceType } from '../../../types';
import { getPlateInputStatus } from '../utils/plateValidation';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface VehicleModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: Partial<Vehicle>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Vehicle>>>;
  clientData: Partial<Client>;
  setClientData: React.Dispatch<React.SetStateAction<Partial<Client>>>;
  companies: Company[];
  categories: VehicleCategory[];
  tags: Tag[];
  tagSearch: string;
  setTagSearch: (s: string) => void;
  onHinovaLookup: () => void;
  hinovaStatus: 'idle' | 'loading' | 'success' | 'error';
  onCheckClient: (cpf: string) => void;
  onFipeOpen: () => void;
  isTagListOpen: boolean;
  setIsTagListOpen: (open: boolean) => void;
  isPlateValid: boolean;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  onClose, onSubmit, formData, setFormData, clientData, setClientData,
  companies, categories, tags, tagSearch, setTagSearch,
  onHinovaLookup, hinovaStatus, onCheckClient, onFipeOpen,
  isTagListOpen, setIsTagListOpen, isPlateValid
}) => {
  const plateStatus = getPlateInputStatus(formData.plate || '');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 rounded-[32px] w-full max-w-4xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
        
        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                    {formData.id ? 'EDITAR VEÍCULO' : 'NOVO VEÍCULO'}
                </h2>
                <button onClick={onClose} className="p-1.5 text-zinc-300 hover:text-zinc-600 transition-colors"><X size={24}/></button>
            </div>

            <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                {/* COLUNA 1: DADOS DO VEÍCULO */}
                <div className="space-y-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">DADOS DO VEÍCULO</h3>
                    
                    {/* Status Toggles */}
                    <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                        {[
                            { id: 'active', label: 'ATIVO', activeColor: 'bg-[#10b981]' },
                            { id: 'maintenance', label: 'MANUTENÇÃO', activeColor: 'bg-zinc-600' },
                            { id: 'stolen', label: 'ROUBADO', activeColor: 'bg-red-600' },
                        ].map(s => (
                            <button key={s.id} type="button" onClick={() => setFormData({...formData, status: s.id as any})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.status === s.id ? `${s.activeColor} text-white shadow-sm` : 'text-zinc-500'}`}>{s.label}</button>
                        ))}
                    </div>

                    {/* Installation Type */}
                    <div className="space-y-2">
                         <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">INSTALAÇÃO DO EQUIPAMENTO</label>
                         <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                            <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_only'})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.installationType === 'tag_only' ? 'bg-[#f59e0b] text-black' : 'text-zinc-500'}`}>SÓ TAG</button>
                            <button type="button" onClick={() => setFormData({...formData, installationType: 'tag_tracker'})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.installationType === 'tag_tracker' ? 'bg-[#f59e0b] text-black' : 'text-zinc-500'}`}>TAG C/ RASTREADOR</button>
                         </div>
                    </div>

                    {/* Ownership Status */}
                    <div className="space-y-2">
                         <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">MODELO DE CONTRATO (TAG)</label>
                         <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                            <button type="button" onClick={() => setFormData({...formData, ownershipStatus: 'leased'})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.ownershipStatus === 'leased' ? 'bg-blue-500 text-white' : 'text-zinc-500'}`}>COMODATO</button>
                            <button type="button" onClick={() => setFormData({...formData, ownershipStatus: 'purchased'})} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.ownershipStatus === 'purchased' ? 'bg-emerald-500 text-white' : 'text-zinc-500'}`}>ADQUIRIDO</button>
                         </div>
                    </div>

                    {/* Placa Input */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">PLACA</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  required 
                                  maxLength={7} 
                                  value={formData.plate || ''} 
                                  onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} 
                                  className={`w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border rounded-xl text-base font-mono font-black shadow-inner outline-none transition-all ${
                                    plateStatus === 'invalid' 
                                      ? 'border-red-500 dark:border-red-500 ring-4 ring-red-500/5' 
                                      : plateStatus === 'valid' 
                                      ? 'border-emerald-500 dark:border-emerald-500' 
                                      : 'border-zinc-200 dark:border-zinc-800 focus:border-zinc-400'
                                  }`} 
                                  placeholder="ABC1234" 
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                  {plateStatus === 'valid' && <CheckCircle2 size={16} className="text-emerald-500 animate-in zoom-in duration-300" />}
                                  {plateStatus === 'invalid' && <AlertCircle size={16} className="text-red-500 animate-shake" />}
                                  <Search size={16} className="text-zinc-200" />
                                </div>
                                {plateStatus === 'invalid' && (
                                  <p className="text-[8px] font-black text-red-500 uppercase mt-1 ml-1 animate-in slide-in-from-top-1">Formato inválido (ex: AAA0000 ou AAA0A00)</p>
                                )}
                            </div>
                            <button type="button" onClick={onHinovaLookup} disabled={hinovaStatus === 'loading'} className="px-6 h-12 rounded-xl bg-[#006e82] hover:bg-[#008ba3] text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center min-w-[100px]">
                                {hinovaStatus === 'loading' ? <Loader2 className="animate-spin" size={16}/> : 'SGA'}
                            </button>
                        </div>
                    </div>

                    {/* Category & Company */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">CATEGORIA</label>
                        <select value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none">
                            <option value="">Selecione...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">EMPRESA</label>
                        <div className="relative">
                            <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                            <select value={formData.companyId || ''} onChange={e => setFormData({...formData, companyId: e.target.value})} className="w-full pl-11 pr-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none">
                                <option value="">Selecione...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Model & Year */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">MODELO</label>
                            <button type="button" onClick={onFipeOpen} className="flex items-center gap-1 text-[8px] font-black text-[#f59e0b] border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-2 py-0.5 rounded uppercase tracking-widest hover:bg-[#f59e0b]/20 transition-colors"><Book size={10}/> BUSCA FIPE</button>
                        </div>
                        <input type="text" required value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">ANO</label>
                            <input type="text" value={formData.year || ''} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" />
                        </div>
                        
                        {/* Tag Linking */}
                        <div className="space-y-2 relative">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">TAG VINCULADA</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Busca Nome/SN..." 
                                    value={tagSearch} 
                                    onFocus={() => setIsTagListOpen(true)} 
                                    onChange={e => { setTagSearch(e.target.value); setIsTagListOpen(true); }} 
                                    className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:border-primary-500" 
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

                {/* COLUNA 2: DADOS DO CLIENTE */}
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
                            <input type="text" required value={clientData.cpf || ''} onBlur={(e) => onCheckClient(e.target.value)} onChange={e => setClientData({...clientData, cpf: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono font-bold text-xs outline-none" placeholder="000.000.000-00" />
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
                            <input type="email" value={clientData.email || ''} onChange={e => setClientData({...clientData, email: e.target.value})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" placeholder="cliente@provedor.com" />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">TERÁ ACESSO AO PORTAL?</label>
                            <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-100 dark:border-zinc-800 h-12">
                                <button type="button" onClick={() => setClientData({...clientData, hasAccess: true})} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${clientData.hasAccess ? 'bg-zinc-800 dark:bg-white text-white dark:text-black shadow-lg' : 'text-zinc-500'}`}>SIM</button>
                                <button type="button" onClick={() => setClientData({...clientData, hasAccess: false})} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${!clientData.hasAccess ? 'bg-[#18181b] text-white' : 'text-zinc-500'}`}>NÃO</button>
                            </div>
                        </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={!isPlateValid}
                      className="mt-8 w-full h-16 bg-[#f59e0b] hover:bg-[#fbbf24] text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                    >
                        <Save size={20} /> SALVAR VEÍCULO
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};
