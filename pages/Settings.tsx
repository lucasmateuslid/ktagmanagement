
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
  User as UserIcon, LayoutGrid, ChevronRight, Activity, Cpu, MapPin, ShieldCheck
} from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  const [newCompany, setNewCompany] = useState({ name: '', prefix: '' });
  const [newCategory, setNewCategory] = useState({ name: '', fipeType: 'carros' as const });
  
  // Password State
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });
  const [showPwds, setShowPwds] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [showHinovaPass, setShowHinovaPass] = useState(false);
  const [showKTagPass, setShowKTagPass] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { setLanguage, t } = useLanguage();
  const { isAdmin, user: currentUser, updateProfile } = useAuth();

  const loadData = async () => {
    setLoading(true);
    const config = await storage.getSettings();
    setSettings(config);
    
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
      addNotification('success', 'Sucesso', 'Configurações salvas.');
    } catch (err) {
      addNotification('error', 'Erro', 'Falha ao salvar configurações.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (pwdForm.new !== pwdForm.confirm) {
        addNotification('error', 'Erro', 'As novas senhas não coincidem.');
        return;
    }

    if (pwdForm.new.length < 4) {
        addNotification('error', 'Erro', 'A nova senha deve ter pelo menos 4 caracteres.');
        return;
    }

    setPwdLoading(true);
    try {
        // Verifica senha atual (no banco de dados real ou sessão)
        const dbUser = await storage.findUserByEmail(currentUser.email);
        const actualCurrentPassword = dbUser?.password || currentUser.password;

        if (pwdForm.current !== actualCurrentPassword) {
            addNotification('error', 'Erro', 'A senha atual está incorreta.');
            setPwdLoading(false);
            return;
        }

        await updateProfile({ password: pwdForm.new });
        storage.logAction(currentUser, 'UPDATE', 'User', 'Alterou a própria senha de acesso');
        addNotification('success', 'Sucesso', 'Sua senha foi alterada com sucesso.');
        setPwdForm({ current: '', new: '', confirm: '' });
    } catch (err) {
        addNotification('error', 'Erro', 'Não foi possível alterar a senha.');
    } finally {
        setPwdLoading(false);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name || !newCompany.prefix) return;
    const company: Company = { id: crypto.randomUUID(), name: newCompany.name, prefix: newCompany.prefix.toUpperCase() };
    await storage.saveCompany(company);
    setCompanies([...companies, company]);
    setNewCompany({ name: '', prefix: '' });
    addNotification('success', 'Empresa', 'Regional adicionada.');
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
        <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Iniciando Ambiente...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-10">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-2xl shrink-0">
            <SettingsIcon size={32} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Configurações</h1>
            <p className="text-zinc-500 mt-2 font-medium">Gestão de perfil, APIs e infraestrutura.</p>
          </div>
        </div>
        {isAdmin && (
            <button 
                onClick={handleSaveSettings}
                className="bg-primary-500 hover:bg-primary-400 text-black px-10 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary-500/20 transition-all w-full md:w-auto justify-center"
            >
                <Save size={18} /> Aplicar Alterações
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT COLUMN: PROFILE & SECURITY */}
        <div className="lg:col-span-5 space-y-10">
          
          {/* User Profile Card */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><UserIcon size={14}/> Meu Perfil</h3>
            <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-[32px] bg-zinc-900 flex items-center justify-center text-primary-500 font-black text-4xl mb-4 border-2 border-zinc-800 shadow-inner">
                  {currentUser?.name.charAt(0)}
                </div>
                <h4 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{currentUser?.name}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${currentUser?.role === 'admin' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                    {currentUser?.role}
                  </span>
                </div>
                <p className="text-zinc-400 text-[10px] mt-4 font-mono bg-zinc-50 dark:bg-zinc-950 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-800">
                  {currentUser?.email}
                </p>
            </div>
          </div>

          {/* SECURITY: CHANGE PASSWORD */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2"><Lock size={14}/> Segurança da Conta</h3>
                <button onClick={() => setShowPwds(!showPwds)} className="text-zinc-500">{showPwds ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
             </div>
             
             <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha Atual</label>
                    <input 
                        type={showPwds ? 'text' : 'password'} 
                        required
                        value={pwdForm.current}
                        onChange={e => setPwdForm({...pwdForm, current: e.target.value})}
                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 transition-all"
                        placeholder="••••••••"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nova Senha</label>
                    <input 
                        type={showPwds ? 'text' : 'password'} 
                        required
                        value={pwdForm.new}
                        onChange={e => setPwdForm({...pwdForm, new: e.target.value})}
                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 transition-all"
                        placeholder="Nova senha forte"
                    />
                </div>
                <div className="space-y-1 pb-4">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Confirmar Nova Senha</label>
                    <input 
                        type={showPwds ? 'text' : 'password'} 
                        required
                        value={pwdForm.confirm}
                        onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})}
                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 transition-all"
                        placeholder="Repita a nova senha"
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={pwdLoading}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all"
                >
                    {pwdLoading ? <Activity className="animate-spin" size={16}/> : <ShieldCheck size={16}/>}
                    Atualizar Senha
                </button>
             </form>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><Languages size={16}/> Preferências</h3>
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Idioma da Interface</label>
                <select 
                  value={settings.language} 
                  onChange={e => setSettings({...settings, language: e.target.value as any})}
                  className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-primary-500 transition-all"
                >
                  <option value="pt">Português (Brasil)</option>
                  <option value="en">English (US)</option>
                </select>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BUSINESS & API (ONLY ADMIN) */}
        <div className="lg:col-span-7 space-y-10">
          {!isAdmin ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 p-10 rounded-[40px] border border-amber-200 dark:border-amber-900/30 flex items-center gap-6">
              <Lock size={32} className="text-amber-500" />
              <div>
                <h4 className="font-black uppercase tracking-widest text-xs text-amber-800 dark:text-amber-400">Ambiente Restrito</h4>
                <p className="text-sm text-amber-700 dark:text-zinc-400 mt-1">As configurações de infraestrutura e APIs são visíveis apenas para Administradores Master.</p>
              </div>
            </div>
          ) : (
            <>
              {/* GESTÃO DE NEGÓCIO */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-10">
                <div className="flex items-center gap-3 text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <LayoutGrid size={24} className="text-primary-500" />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Gestão de Negócio</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Building2 size={14}/> Regionais</h3>
                    <div className="grid grid-cols-[1fr_48px] gap-2 items-end">
                      <div className="flex gap-2">
                        <input placeholder="Nome" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-bold" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} />
                        <input placeholder="ID" maxLength={3} className="w-20 px-2 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black text-center uppercase" value={newCompany.prefix} onChange={e => setNewCompany({...newCompany, prefix: e.target.value})} />
                      </div>
                      <button onClick={handleAddCompany} className="w-12 h-11 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl flex items-center justify-center"><Plus size={20}/></button>
                    </div>
                    <div className="space-y-2">
                      {companies.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <span className="text-xs font-black uppercase">{c.prefix} - {c.name}</span>
                          <button onClick={() => handleDeleteCompany(c.id)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Truck size={14}/> Categorias</h3>
                    <div className="grid grid-cols-[1fr_48px] gap-2 items-end">
                      <div className="flex gap-2">
                        <input placeholder="Veículo" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-bold" value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})} />
                        <select className="w-24 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-[10px] font-black uppercase" value={newCategory.fipeType} onChange={e => setNewCategory({...newCategory, fipeType: e.target.value as any})}>
                            <option value="carros">Carro</option>
                            <option value="motos">Moto</option>
                            <option value="caminhoes">Caminhão</option>
                        </select>
                      </div>
                      <button onClick={handleAddCategory} className="w-12 h-11 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl flex items-center justify-center"><Plus size={20}/></button>
                    </div>
                    <div className="space-y-2">
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

              {/* INTEGRATIONS */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-10">
                <div className="flex items-center gap-3 text-cyan-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Server size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Infraestrutura Externa</h2>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cloud Proxy URL (Firebase)</label>
                        <input type="text" value={settings.customProxyUrl} onChange={e => setSettings({...settings, customProxyUrl: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-cyan-500" placeholder="https://us-central1-..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Hinova User</label>
                            <input type="text" value={settings.hinovaUser} onChange={e => setSettings({...settings, hinovaUser: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">K-Tag URL</label>
                            <input type="text" value={settings.ktagUrl} onChange={e => setSettings({...settings, ktagUrl: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs" />
                        </div>
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
