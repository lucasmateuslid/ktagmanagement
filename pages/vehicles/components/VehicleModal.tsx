
import React from 'react';
import { X, Save, Search, Loader2, Building2, Book, User, Phone, ClipboardCheck, CreditCard, Calendar, Tag as TagIcon, ChevronDown, Check, Activity, Link as LinkIcon, Unlink } from 'lucide-react';
import { Vehicle, Client, Company, VehicleCategory, Tag, DeviceType } from '../../../types';
import { getPlateInputStatus, validateBrazilianPlate } from '../utils/plateValidation';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCPF } from '../../../utils/brDocument';

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
  allVehicles: Vehicle[]; // Nova dependência para validar vínculos
  tagSearch: string;
  setTagSearch: (s: string) => void;
  onHinovaLookup: () => void;
  hinovaStatus: 'idle' | 'loading' | 'success' | 'error';
  onCheckClient: (cpf: string) => void;
  onFipeOpen: () => void;
  isTagListOpen: boolean;
  setIsTagListOpen: (open: boolean) => void;
  isPlateValid: boolean;
  isSaving?: boolean;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  onClose, onSubmit, formData, setFormData, clientData, setClientData,
  companies, categories, tags, allVehicles, tagSearch, setTagSearch,
  onHinovaLookup, hinovaStatus, onCheckClient, onFipeOpen,
  isTagListOpen, setIsTagListOpen, isPlateValid, isSaving = false
}) => {
  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false);
  const [isCompanyOpen, setIsCompanyOpen] = React.useState(false);

  // Fechar dropdowns ao clicar fora
  React.useEffect(() => {
      const handleClickOutside = () => {
          setIsCategoryOpen(false);
          setIsCompanyOpen(false);
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const selectedCategory = categories.find(c => c.id === formData.type);
  const selectedCompany = companies.find(c => c.id === formData.companyId);

  const plateStatus = getPlateInputStatus(formData.plate || '');

  // Determina quais Tags estão ocupadas por outros veículos
  const occupiedTagIds = React.useMemo(() => {
    const ids = new Set<string>();
    allVehicles.forEach(v => {
      // Se o veículo tem uma tag vinculada E não é o veículo que estamos editando agora
      if (v.tagId && v.id !== formData.id) {
        ids.add(v.tagId);
      }
    });
    return ids;
  }, [allVehicles, formData.id]);

  const tagLinkageMap = React.useMemo(() => {
    const map: Record<string, Vehicle> = {};
    allVehicles.forEach(v => {
      if (v.tagId) map[v.tagId] = v;
    });
    return map;
  }, [allVehicles]);

  // Filtra as tags para a lista de seleção
  const filteredTags = React.useMemo(() => {
    const term = tagSearch.toLowerCase();
    return tags.filter(t => 
      t.accessoryId.toLowerCase().includes(term) || 
      t.name.toLowerCase().includes(term)
    );
  }, [tags, tagSearch]);

  const selectedTag = tags.find(t => t.id === formData.tagId);

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
      <div className="modal-card sm:max-w-4xl animate-in fade-in zoom-in-95 duration-200">

        {/* HEADER FIXED */}
        <div className="modal-card-header flex justify-between items-center p-5 sm:p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-900">
            <h2 id="vehicle-modal-title" className="text-lg sm:text-xl md:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">
                {formData.id ? 'EDITAR VEÍCULO' : 'NOVO VEÍCULO'}
            </h2>
            <button type="button" aria-label="Fechar" onClick={onClose} className="shrink-0 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"><X size={24}/></button>
        </div>

        {/* CONTENT SCROLLABLE */}
        <div className="modal-card-body custom-scrollbar p-5 sm:p-6 md:p-8">
            <form id="vehicle-form" onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative" onClick={e => e.stopPropagation()}>
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">CATEGORIA</label>
                            <div 
                                className="relative flex items-center justify-between px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                                onClick={() => { setIsCategoryOpen(!isCategoryOpen); setIsCompanyOpen(false); }}
                            >
                                <span className={`text-xs font-bold truncate ${!selectedCategory ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                                    {selectedCategory ? selectedCategory.name : 'Selecione...'}
                                </span>
                                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                            </div>
                            
                            <AnimatePresence>
                                {isCategoryOpen && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[1005] overflow-hidden flex flex-col max-h-[200px]"
                                    >
                                        <div className="overflow-y-auto custom-scrollbar p-1">
                                            <div 
                                                onClick={() => { setFormData({...formData, type: ''}); setIsCategoryOpen(false); }}
                                                className={`px-4 py-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${!formData.type ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                                            >
                                                Selecione...
                                            </div>
                                            {categories.map(c => (
                                                <div 
                                                    key={c.id}
                                                    onClick={() => { setFormData({...formData, type: c.id}); setIsCategoryOpen(false); }}
                                                    className={`px-4 py-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${formData.type === c.id ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                                                >
                                                    {c.name}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="space-y-2 relative" onClick={e => e.stopPropagation()}>
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">EMPRESA</label>
                            <div 
                                className="relative flex items-center justify-between pl-11 pr-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                                onClick={() => { setIsCompanyOpen(!isCompanyOpen); setIsCategoryOpen(false); }}
                            >
                                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <span className={`text-xs font-bold truncate ${!selectedCompany ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                                    {selectedCompany ? selectedCompany.name : 'Selecione...'}
                                </span>
                                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isCompanyOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <AnimatePresence>
                                {isCompanyOpen && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[1005] overflow-hidden flex flex-col max-h-[200px]"
                                    >
                                        <div className="overflow-y-auto custom-scrollbar p-1">
                                            <div 
                                                onClick={() => { setFormData({...formData, companyId: ''}); setIsCompanyOpen(false); }}
                                                className={`px-4 py-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${!formData.companyId ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                                            >
                                                Selecione...
                                            </div>
                                            {companies.map(c => (
                                                <div 
                                                    key={c.id}
                                                    onClick={() => { setFormData({...formData, companyId: c.id}); setIsCompanyOpen(false); }}
                                                    className={`px-4 py-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${formData.companyId === c.id ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                                                >
                                                    {c.name}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Model & Year */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">MODELO</label>
                        <div className="flex gap-2">
                            <input type="text" required value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" />
                            <button type="button" onClick={onFipeOpen} className="px-4 h-12 rounded-xl bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                                <Book size={14}/> BUSCA FIPE
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">ANO</label>
                            <input type="text" value={formData.year || ''} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">VALOR FIPE (R$)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.fipeValue || ''} 
                                onChange={e => setFormData({...formData, fipeValue: parseFloat(e.target.value)})} 
                                className="w-full px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none" 
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Tag Linking com UI Visual e Pesquisa */}
                        <div className="space-y-2 relative">
                            <label className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">TAG VINCULADA</label>
                            <div 
                                className="flex items-center justify-between px-4 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                                onClick={() => setIsTagListOpen(!isTagListOpen)}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <TagIcon size={16} className="text-zinc-400 shrink-0" />
                                    <span className="text-xs font-bold dark:text-white truncate">
                                        {selectedTag ? `${selectedTag.accessoryId} (${selectedTag.name})` : 'Selecione uma Tag...'}
                                    </span>
                                </div>
                                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isTagListOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <AnimatePresence>
                                {isTagListOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[1001]" onClick={() => setIsTagListOpen(false)} />
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-2xl z-[1002] overflow-hidden flex flex-col max-h-[300px]"
                                        >
                                            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Buscar por nome ou ID..." 
                                                        value={tagSearch}
                                                        onChange={e => setTagSearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ring-primary-500/20"
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto custom-scrollbar p-1">
                                                {filteredTags.length === 0 ? (
                                                    <div className="p-8 text-center">
                                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhuma tag encontrada</p>
                                                    </div>
                                                ) : (
                                                    filteredTags.map(t => {
                                                        const linkedVehicle = tagLinkageMap[t.id];
                                                        const isOccupiedByOther = linkedVehicle && linkedVehicle.id !== formData.id;
                                                        const isSelected = formData.tagId === t.id;
                                                        
                                                        return (
                                                            <button 
                                                                key={t.id}
                                                                type="button"
                                                                disabled={isOccupiedByOther}
                                                                onClick={() => {
                                                                    setFormData({...formData, tagId: t.id});
                                                                    setIsTagListOpen(false);
                                                                }}
                                                                className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all group ${isSelected ? 'bg-primary-500/10 text-primary-500' : isOccupiedByOther ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                                            >
                                                                <div className="flex items-center gap-3 text-left">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary-500 text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700'}`}>
                                                                        <Activity size={18} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-black uppercase truncate">{t.accessoryId}</p>
                                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.name}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    {linkedVehicle ? (
                                                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${isOccupiedByOther ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                                                            <LinkIcon size={8} />
                                                                            <span className="text-[8px] font-black uppercase tracking-widest">
                                                                                {isOccupiedByOther ? linkedVehicle.plate : 'ESTE VEÍCULO'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-full border border-zinc-200 dark:border-zinc-700">
                                                                            <Unlink size={8} />
                                                                            <span className="text-[8px] font-black uppercase tracking-widest">Livre</span>
                                                                        </div>
                                                                    )}
                                                                    {isSelected && <Check size={14} className="text-primary-500" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
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
                            <input type="text" required inputMode="numeric" maxLength={14} value={clientData.cpf || ''} onBlur={(e) => onCheckClient(e.target.value)} onChange={e => setClientData({...clientData, cpf: formatCPF(e.target.value)})} className="w-full px-4 h-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-mono font-bold text-xs outline-none" placeholder="000.000.000-00" />
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
                                <button type="button" onClick={() => setClientData({...clientData, hasAccess: false})} className={`flex-1 rounded-lg text-[9px] font-black transition-all ${!clientData.hasAccess ? 'bg-zinc-900 dark:bg-zinc-700 text-white shadow-lg' : 'text-zinc-500'}`}>NÃO</button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        {/* FOOTER FIXED */}
        <div className="modal-card-footer p-4 sm:p-6 md:p-8 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950">
            <button 
              form="vehicle-form"
              type="submit"
              disabled={!isPlateValid || isSaving}
              className="w-full h-16 bg-[#f59e0b] hover:bg-[#fbbf24] text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
                <Save size={20} /> {isSaving ? 'SALVANDO...' : 'SALVAR VEÍCULO'}
            </button>
        </div>

      </div>
    </div>
  );
};
