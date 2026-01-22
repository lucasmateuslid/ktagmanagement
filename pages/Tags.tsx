
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { storage } from '../services/storage';
import { Tag, Vehicle, TagType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { xadtagService } from '../services/xadtag';
import { Plus, Trash2, Edit2, Save, X, Upload, CheckSquare, Square, Wifi, Search, Car, AlertTriangle, Activity, BatteryCharging, Calendar, Check, Cpu, Info, ShoppingBag, Lock, ShieldCheck, ShieldAlert, Filter, ListChecks, HandCoins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const { useSearchParams } = ReactRouterDOM as any;
const MotionDiv = motion.div as any;

export const Tags = () => {
  const [searchParams] = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Tag>>({ batteryWarrantyYears: 1, type: 'K_TAG' });
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const { user } = useAuth();

  const loadData = async () => {
    const [loadedTags, loadedVehicles] = await Promise.all([
      storage.getTags(),
      storage.getVehicles()
    ]);
    setTags(loadedTags);
    setVehicles(loadedVehicles);
  };

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'new') {
        setFormData({ batteryWarrantyYears: 1, type: 'K_TAG' });
        setIsModalOpen(true);
    }
  }, [searchParams]);

  const unlinkedCount = tags.length - vehicles.filter(v => v.tagId).length;
  const isStockLow = unlinkedCount <= 80;
  const isStockCritical = unlinkedCount <= 40;

  const filteredTags = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return tags.filter(tag => {
      const linkedVehicle = vehicles.find(v => v.tagId === tag.id);
      return (
        tag.name.toLowerCase().includes(term) ||
        tag.accessoryId.toLowerCase().includes(term) ||
        (tag.imei && tag.imei.toLowerCase().includes(term)) ||
        (linkedVehicle && linkedVehicle.plate.toLowerCase().includes(term))
      );
    });
  }, [tags, searchTerm, vehicles]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTags(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTags.size === filteredTags.length && filteredTags.length > 0) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(filteredTags.map(t => t.id)));
    }
  };

  const handleMassDelete = async () => {
    const count = selectedTags.size;
    if (count === 0) return;
    
    if (!confirm(`ATENÇÃO: Você está prestes a excluir ${count} equipamentos.\n\nEquipamentos vinculados a veículos perderão a associação.\nDeseja continuar?`)) return;

    try {
        const promises = Array.from(selectedTags).map((id: string) => storage.deleteTag(id));
        await Promise.all(promises);
        
        // Remove associações nos veículos se houver
        const vehicleUpdates = vehicles
            .filter(v => v.tagId && selectedTags.has(v.tagId))
            .map(v => storage.saveVehicle({ ...v, tagId: undefined }));
        await Promise.all(vehicleUpdates);

        addNotification('success', 'Exclusão em Massa', `${count} equipamentos foram removidos do estoque.`);
        setSelectedTags(new Set());
        loadData();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Falha ao processar exclusão em massa.';
        addNotification('error', 'Erro', errorMessage);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!formData.id;
    const type = formData.type || 'K_TAG';

    const newTag: Tag = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name!,
      type: type as TagType,
      accessoryId: type === 'XADTAG' ? (formData.imei || formData.name!) : formData.accessoryId!,
      hashedAdvKey: formData.hashedAdvKey,
      privateKey: formData.privateKey,
      imei: formData.imei,
      traqcareId: formData.traqcareId,
      batteryWarrantyYears: formData.batteryWarrantyYears || 1,
      createdAt: formData.createdAt || Date.now(),
    };

    await storage.saveTag(newTag);

    if (type === 'XADTAG' && !isEdit) {
        const success = await xadtagService.activate(newTag);
        if (success) {
            addNotification('success', 'Ativado', `${newTag.name} integrado com sucesso.`);
            await storage.saveTag({ ...newTag, isActivated: true });
        }
    }

    storage.logAction(user, isEdit ? 'UPDATE' : 'CREATE', 'Equipamento', `${isEdit ? 'Atualizou' : 'Registrou'} equip. ${newTag.name}`, newTag.id);
    await loadData();
    setIsModalOpen(false);
    setFormData({ batteryWarrantyYears: 1, type: 'K_TAG' });
    addNotification('success', 'Sucesso', 'Configurações de equipamento salvas.');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir equipamento do estoque?')) return;
    await storage.deleteTag(id);
    loadData();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Estoque de Equipamentos</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium italic opacity-70">Gestão e controle de ativos de segurança.</p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="px-5 py-3 bg-white dark:bg-zinc-800 text-zinc-500 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 transition-all shadow-sm">
              <Upload size={16} /> Importar CSV
            </button>
            <button onClick={() => { setFormData({ batteryWarrantyYears: 1, type: 'K_TAG' }); setIsModalOpen(true); }} className="bg-primary-500 hover:bg-primary-400 text-black px-8 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-widest transition-all shadow-2xl shadow-primary-500/20 active:scale-95">
              <Plus size={18} strokeWidth={3} /> NOVO EQUIPAMENTO
            </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={() => {}} accept=".csv" className="hidden" />

      {/* BARRA DE CONTROLE REFORMULADA */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 pl-4 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col md:flex-row gap-3 items-center transition-all">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Pesquisar por SN, IMEI ou Placa..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-8 pr-4 py-3 bg-transparent border-none text-sm font-bold outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" 
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-hidden px-2">
            <AnimatePresence mode="popLayout">
                {selectedTags.size > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-2"
                    >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-500/10 text-primary-600 rounded-xl border border-primary-500/20">
                            <ListChecks size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{selectedTags.size} SELECIONADOS</span>
                        </div>
                        <button 
                            onClick={handleMassDelete} 
                            className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-95"
                        >
                            <Trash2 size={14} /> Remover em Massa
                        </button>
                        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                    </motion.div>
                )}
            </AnimatePresence>

            <button 
                onClick={handleSelectAll} 
                className={`px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 transition-all border ${
                    selectedTags.size === filteredTags.length && filteredTags.length > 0 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent shadow-md' 
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
            >
                {selectedTags.size === filteredTags.length && filteredTags.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedTags.size === filteredTags.length && filteredTags.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTags.map((tag) => {
          const isSelected = selectedTags.has(tag.id);
          const vehicle = vehicles.find(v => v.tagId === tag.id);

          return (
            <motion.div 
                layout
                key={tag.id} 
                onClick={() => toggleSelect(tag.id)} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                className={`bg-white dark:bg-zinc-900 p-10 rounded-[40px] border transition-all cursor-pointer group flex flex-col justify-between min-h-[360px] relative overflow-hidden ${isSelected ? 'border-primary-500 ring-4 ring-primary-500/10 shadow-2xl' : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700'}`}
            >
              {isSelected && (
                  <div className="absolute top-0 right-0 p-6">
                      <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white shadow-lg animate-in zoom-in duration-200">
                          <Check size={16} strokeWidth={4} />
                      </div>
                  </div>
              )}

              <div className="flex justify-between items-start">
                <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${tag.type === 'XADTAG' ? 'bg-cyan-500 text-white' : 'bg-primary-500 text-black'}`}>
                  {tag.type === 'XADTAG' ? <Cpu size={28} /> : <Wifi size={28} />}
                </div>
                {!isSelected && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setFormData(tag); setIsModalOpen(true); }} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-primary-500 transition-all"><Edit2 size={16}/></button>
                        <button onClick={(e) => handleDelete(tag.id, e)} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                    </div>
                )}
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter truncate">{tag.name}</h3>
                  <span title="Criptografia Ativa">
                    <ShieldCheck size={18} className="text-emerald-500" />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${tag.type === 'XADTAG' ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' : 'bg-primary-500/10 text-primary-600 border-primary-500/20'}`}>{tag.type}</span>
                    <span className="text-[10px] font-mono text-zinc-400 font-bold">{tag.type === 'XADTAG' ? `IMEI: ${tag.imei}` : `SN: ${tag.accessoryId}`}</span>
                    {vehicle && vehicle.ownershipStatus && (
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${vehicle.ownershipStatus === 'purchased' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                            {vehicle.ownershipStatus === 'purchased' ? 'ADQUIRIDO' : 'COMODATO'}
                        </span>
                    )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status</span>
                    {vehicle ? <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1.5 mt-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> VINCULADO</span> : <span className="text-[10px] font-black text-zinc-300 uppercase mt-1">NO ESTOQUE</span>}
                 </div>
                 {vehicle && (
                    <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                        <span className="text-sm font-black text-zinc-900 dark:text-white font-mono">{vehicle.plate}</span>
                    </div>
                 )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-lg p-12 shadow-2xl relative border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10">
               <h2 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">ADICIONAR</h2>
               <button onClick={() => setIsModalOpen(false)} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-zinc-400 hover:text-red-500 transition-all"><X size={24}/></button>
            </div>
            
            <div className="mb-10 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-[22px] flex gap-1 border border-zinc-100 dark:border-zinc-800">
                {(['K_TAG', 'XADTAG'] as TagType[]).map(type => (
                    <button key={type} type="button" onClick={() => setFormData({...formData, type})} className={`flex-1 py-4 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === type ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xl' : 'text-zinc-500'}`}>{type.replace('_', '-')}</button>
                ))}
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.15em] ml-1">IDENTIFICAÇÃO (APELIDO)</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all" placeholder="Ex: EQUIP-01" />
                    </div>

                    {formData.type === 'K_TAG' ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.15em] ml-1">Nº SÉRIE (SERIAL)</label>
                                <input type="text" required value={formData.accessoryId || ''} onChange={e => setFormData({...formData, accessoryId: e.target.value})} className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono font-bold text-sm outline-none focus:border-primary-500" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.15em] ml-1">GARANTIA BATERIA</label>
                                <div className="p-1 bg-zinc-50 dark:bg-zinc-950 rounded-2xl flex gap-1 border border-zinc-100 dark:border-zinc-800">
                                    {[1, 2, 3].map(years => (
                                        <button key={years} type="button" onClick={() => setFormData({...formData, batteryWarrantyYears: years})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.batteryWarrantyYears === years ? 'bg-primary-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-700'}`}>
                                            {years} {years === 1 ? 'ANO' : 'ANOS'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.15em]">HASHED KEY</label>
                                  <ShieldCheck size={12} className="text-emerald-500" />
                                </div>
                                <input type="text" required value={formData.hashedAdvKey || ''} onChange={e => setFormData({...formData, hashedAdvKey: e.target.value})} className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm outline-none focus:border-primary-500" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.15em]">PRIVATE KEY</label>
                                  <ShieldCheck size={12} className="text-emerald-500" />
                                </div>
                                <input type="text" required value={formData.privateKey || ''} onChange={e => setFormData({...formData, privateKey: e.target.value})} className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-sm outline-none focus:border-primary-500" />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.15em]">IMEI</label>
                                  <ShieldCheck size={12} className="text-emerald-500" />
                                </div>
                                <input type="text" required value={formData.imei || ''} onChange={e => setFormData({...formData, imei: e.target.value})} className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono font-bold text-sm outline-none focus:border-cyan-500" placeholder="8624100..." />
                            </div>
                            <div className="bg-cyan-500/5 p-6 rounded-[28px] border border-cyan-500/10 flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center shadow-lg shrink-0"><Info size={20}/></div>
                                <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 uppercase leading-relaxed tracking-tight">Equipamentos XADTAG são adicionados automaticamente na nuvem Traqcare.</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shrink-0"><ShieldCheck size={20}/></div>
                    <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase leading-tight tracking-widest">Proteção E2EE Ativada. Os campos sensíveis serão criptografados no servidor.</p>
                </div>

                <button type="submit" className="w-full py-6 bg-primary-500 hover:bg-primary-400 text-black rounded-[24px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    <ShieldCheck size={20} strokeWidth={2.5}/> FINALIZAR CADASTRO
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
