
import * as React from 'react';
import { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { AppSettings, User, Company, VehicleCategory } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Save, Settings as SettingsIcon, Map, Database, Globe, Key, 
  Languages, CloudLightning, Trash2, Plus, Search, ShieldAlert, 
  Lock, Edit2, Building2, Truck, Server, Eye, EyeOff, 
  User as UserIcon, LayoutGrid, ChevronRight, Activity, Cpu, MapPin
} from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  const [newCompany, setNewCompany] = useState({ name: '', prefix: '' });
  const [newCategory, setNewCategory] = useState({ name: '', fipeType: 'carros' as const });
  
  const [showHinovaPass, setShowHinovaPass] = useState(false);
  const [showHinovaToken, setShowHinovaToken] = useState(false);
  const [showKTagPass, setShowKTagPass] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { setLanguage, t } = useLanguage();
  const { isAdmin, user: currentUser } = useAuth();

  const loadData = async () => {
    setLoading(true);
    const config = await storage.getSettings();
    setSettings(config);
    
    // Apenas Admins carregam dados de gestão de negócio
    if (isAdmin) {
      const [allCompanies, allCategories] = await Promise.all([
        storage.getCompanies(),
        storage.getCategories()
      ]);
      setCompanies(allCompanies);
      setCategories(allCategories);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await storage.saveSettings(settings);
      setLanguage(settings.language);
      storage.logAction(currentUser, 'CONFIG', 'Settings', 'Atualizou configurações globais do sistema');
      addNotification('success', 'Sucesso', 'Configurações sincronizadas com o banco de dados.');
    } catch (err) {
      addNotification('error', 'Erro', 'Falha ao salvar configurações.');
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name || !newCompany.prefix) return;
    const company: Company = { id: crypto.randomUUID(), name: newCompany.name, prefix: newCompany.prefix.toUpperCase() };
    await storage.saveCompany(company);
    setCompanies([...companies, company]);
    setNewCompany({ name: '', prefix: '' });
    addNotification('success', 'Empresa', 'Regional adicionada com sucesso.');
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Excluir esta regional?')) return;
    await storage.deleteCompany(id);
    setCompanies(companies.filter(c => c.id !== id));
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    const category: VehicleCategory = { id: crypto.randomUUID(), name: newCategory.name, fipeType: newCategory.fipeType as any };
    await storage.saveCategory(category);
    setCategories([...categories, category]);
    setNewCategory({ name: '', fipeType: 'carros' });
    addNotification('success', 'Categoria', 'Categoria de veículo criada.');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    await storage.deleteCategory(id);
    setCategories(categories.filter(c => c.id !== id));
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Cpu className="animate-spin text-primary-500" size={48} />
        <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Initializing Environment...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 px-4">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-10">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-2xl shrink-0">
            <SettingsIcon size={32} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Console de Sistema</h1>
            <p className="text-zinc-500 mt-2 font-medium text-sm md:text-base">Gestão de infraestrutura, APIs e chaves de acesso.</p>
          </div>
        </div>
        {isAdmin && (
            <button 
                onClick={handleSaveSettings}
                className="bg-primary-500 hover:bg-primary-400 text-black px-10 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary-500/20 transition-all hover:scale-[1.02] active:scale-95 w-full md:w-auto justify-center"
            >
                <Save size={18} /> Salvar Tudo
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT COLUMN: PROFILE & PREFERENCES (4/12) */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* User Profile Card */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 bg-primary-500/5 rounded-full blur-3xl -mr-8 -mt-8" />
            <div className="relative z-10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><UserIcon size={14}/> Credenciais Ativas</h3>
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-[32px] bg-zinc-900 flex items-center justify-center text-primary-500 font-black text-4xl mb-4 border-2 border-zinc-800 shadow-inner">
                  {currentUser?.name.charAt(0)}
                </div>
                <h4 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{currentUser?.name}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${currentUser?.role === 'admin' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : currentUser?.role === 'moderator' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                    {currentUser?.role}
                  </span>
                </div>
                <p className="text-zinc-400 text-[10px] mt-4 font-mono bg-zinc-50 dark:bg-zinc-950 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-800">
                  {currentUser?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><Languages size={16}/> Regionalização</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Idioma da Interface</label>
                <select 
                  value={settings.language} 
                  onChange={e => setSettings({...settings, language: e.target.value as any})}
                  className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 transition-all cursor-pointer"
                >
                  <option value="pt">Português (Brasil)</option>
                  <option value="en">English (United States)</option>
                </select>
              </div>
              <div className="p-4 bg-primary-500/5 rounded-2xl border border-primary-500/10 text-[10px] text-zinc-500 leading-relaxed italic">
                A troca de idioma afeta apenas a sua sessão local.
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TECHNICAL CONFIGURATIONS (8/12) */}
        <div className="lg:col-span-8 space-y-10">
          
          {!isAdmin ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 p-10 rounded-[40px] border border-amber-200 dark:border-amber-900/30 flex items-center gap-6">
              <div className="p-4 bg-amber-500 rounded-3xl text-white shadow-lg shadow-amber-500/20"><Lock size={32} /></div>
              <div>
                <h4 className="font-black uppercase tracking-widest text-xs text-amber-800 dark:text-amber-400">Acesso Restrito</h4>
                <p className="text-sm text-amber-700 dark:text-zinc-400 mt-1 font-medium">As configurações técnicas e chaves de API estão disponíveis apenas para Administradores Master.</p>
              </div>
            </div>
          ) : (
            <>
              {/* GESTÃO DE NEGÓCIO */}
              <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-10">
                <div className="flex items-center gap-3 text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <LayoutGrid size={24} className="text-primary-500" />
                  <h2 className="text-xl md:text-2xl font-display font-black uppercase tracking-tight">Gestão de Negócio</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Building2 size={14}/> Regionais / Empresas</h3>
                    <div className="grid grid-cols-[1fr_80px_48px] gap-2 items-end">
                      <input 
                        placeholder="Nome" 
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-bold"
                        value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                      />
                      <input 
                        placeholder="Sigla" 
                        maxLength={4}
                        className="w-full px-2 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black text-center uppercase"
                        value={newCompany.prefix} onChange={e => setNewCompany({...newCompany, prefix: e.target.value})}
                      />
                      <button onClick={handleAddCompany} className="w-12 h-11 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl flex items-center justify-center hover:scale-105 transition-transform"><Plus size={20}/></button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {companies.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <span className="text-xs font-black uppercase">{c.prefix} - {c.name}</span>
                          <button onClick={() => handleDeleteCompany(c.id)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Truck size={14}/> Tipos de Veículo</h3>
                    <div className="grid grid-cols-[1fr_100px_48px] gap-2 items-end">
                      <input 
                        placeholder="Nome" 
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-bold"
                        value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                      />
                      <select 
                        className="w-full h-11 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-[10px] font-black uppercase px-1"
                        value={newCategory.fipeType} onChange={e => setNewCategory({...newCategory, fipeType: e.target.value as any})}
                      >
                        <option value="carros">Carro</option>
                        <option value="motos">Moto</option>
                        <option value="caminhoes">Truck</option>
                        <option value="none">Nenhum</option>
                      </select>
                      <button onClick={handleAddCategory} className="w-12 h-11 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl flex items-center justify-center hover:scale-105 transition-transform"><Plus size={20}/></button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {categories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <span className="text-xs font-black uppercase">{cat.name}</span>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* HINOVA INTEGRATION */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-10">
                <div className="flex items-center gap-3 text-cyan-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Server size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Hinova SGA v2</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2 col-span-full">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">API Endpoint Base</label>
                    <input 
                      type="text" value={settings.hinovaUrl} onChange={e => setSettings({...settings, hinovaUrl: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs text-zinc-500 outline-none focus:border-cyan-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Usuário SGA</label>
                    <input 
                      type="text" value={settings.hinovaUser} onChange={e => setSettings({...settings, hinovaUser: e.target.value})}
                      className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-cyan-500" 
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha SGA</label>
                    <div className="relative">
                      <input 
                        type={showHinovaPass ? 'text' : 'password'} 
                        value={settings.hinovaPass} onChange={e => setSettings({...settings, hinovaPass: e.target.value})}
                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-cyan-500" 
                      />
                      <button onClick={() => setShowHinovaPass(!showHinovaPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* MAP PROVIDERS */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-10">
                <div className="flex items-center gap-3 text-emerald-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Map size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Provedores de Mapa</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Google Cloud Platform</h4>
                    <input 
                        type="text" value={settings.googleMapsKey} onChange={e => setSettings({...settings, googleMapsKey: e.target.value})}
                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-emerald-500" 
                        placeholder="Chave API..."
                    />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Mapbox Service</h4>
                    <input 
                        type="text" value={settings.mapboxKey} onChange={e => setSettings({...settings, mapboxKey: e.target.value})}
                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-primary-500" 
                        placeholder="pk.ey..."
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
