
import * as React from 'react';
import { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { AppSettings, User, Company, VehicleCategory } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { securityService } from '../services/security';
import { 
  Save, Settings as SettingsIcon, Database, Globe, Key, 
  Languages, Trash2, Plus, ShieldAlert, 
  Lock, Edit2, Building2, Server, Eye, EyeOff, 
  User as UserIcon, LayoutGrid, Cpu, Cloud, Terminal, 
  UserCircle2, ChevronRight, Check, RefreshCw, Link as LinkIcon
} from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  const [newCompany, setNewCompany] = useState({ name: '', prefix: '' });
  const [newCategory, setNewCategory] = useState({ name: '', fipeType: 'carros' as const });
  
  const [profileForm, setProfileForm] = useState({ name: '', avatarInitial: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });
  const [showPwds, setShowPwds] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [showHinovaToken, setShowHinovaToken] = useState(false);
  const [showHinovaPass, setShowHinovaPass] = useState(false);
  const [showKTagPass, setShowKTagPass] = useState(false);
  const [showTraqToken, setShowTraqToken] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { setLanguage, t, language } = useLanguage();
  const { isAdmin, user: currentUser, updateProfile } = useAuth();

  const loadData = async () => {
    setLoading(true);
    const config = await storage.getSettings();
    setSettings(config);
    
    if (currentUser) {
        setProfileForm({ 
          name: currentUser.name, 
          avatarInitial: currentUser.avatarInitial || currentUser.name.charAt(0) 
        });
    }

    const [allCompanies, allCategories] = await Promise.all([
      storage.getCompanies(),
      storage.getCategories()
    ]);
    setCompanies(allCompanies);
    setCategories(allCategories);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setProfileLoading(true);
    try {
        await updateProfile({ name: profileForm.name, avatarInitial: profileForm.avatarInitial.substring(0, 2).toUpperCase() });
        storage.logAction(currentUser, 'UPDATE', 'User', 'Atualizou dados do perfil');
        addNotification('success', 'Perfil Atualizado', 'Seus dados foram salvos.');
    } finally { setProfileLoading(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (pwdForm.new.length < 6) { addNotification('error', 'Erro', 'A senha deve ter no mínimo 6 caracteres.'); return; }
    if (pwdForm.new !== pwdForm.confirm) { addNotification('error', 'Erro', 'As senhas não coincidem.'); return; }
    
    setPwdLoading(true);
    try {
        const dbUser = await storage.findUserByEmail(currentUser.email);
        if (!dbUser) return;

        // Verifica a senha atual (Hash ou Texto Plano)
        const isCurrentValid = await securityService.verifyPassword(pwdForm.current, dbUser.password || '');
        // Fallback para texto plano se não for hash válido (durante migração)
        const isLegacyValid = !isCurrentValid && (dbUser.password === pwdForm.current);

        if (!isCurrentValid && !isLegacyValid) {
             addNotification('error', 'Erro', 'Senha atual incorreta.'); 
             return; 
        }

        // Hash da nova senha
        const newPasswordHash = await securityService.hashPassword(pwdForm.new);
        
        await updateProfile({ password: newPasswordHash }); // AuthContext já lida, mas aqui garantimos que enviamos o que queremos se necessário, mas updateProfile tbm faz hash.
        // O updateProfile do AuthContext também aplica hash se detectar senha. Para evitar double-hash se chamarmos aqui, melhor passar raw para updateProfile OU passar hash e ajustar updateProfile.
        // Verificando AuthContext: ele faz hash. Então vamos passar raw aqui para ele hash.
        // CORREÇÃO: AuthContext faz hash. Então envio raw.
        
        // Porém, updateProfile no AuthContext usa securityService.hashPassword.
        // Então basta chamar:
        await updateProfile({ password: pwdForm.new });

        addNotification('success', 'Sucesso', 'Sua senha foi alterada com segurança.');
        setPwdForm({ current: '', new: '', confirm: '' });
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao atualizar senha.');
    } finally { setPwdLoading(false); }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name || !newCompany.prefix) return;
    const company: Company = { id: crypto.randomUUID(), name: newCompany.name, prefix: newCompany.prefix.toUpperCase() };
    await storage.saveCompany(company);
    setCompanies([...companies, company]);
    setNewCompany({ name: '', prefix: '' });
    addNotification('success', 'Regional Criada', 'Nova regional adicionada com sucesso.');
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Excluir regional?')) return;
    await storage.deleteCompany(id);
    setCompanies(companies.filter(c => c.id !== id));
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    const category: VehicleCategory = { id: crypto.randomUUID(), name: newCategory.name, fipeType: newCategory.fipeType as any };
    await storage.saveCategory(category);
    setCategories([...categories, category]);
    setNewCategory({ name: '', fipeType: 'carros' });
    addNotification('success', 'Categoria Criada', 'Nova categoria adicionada.');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Excluir categoria?')) return;
    await storage.deleteCategory(id);
    setCategories(categories.filter(c => c.id !== id));
  };

  if (loading || !settings) return <div className="flex items-center justify-center h-full"><Cpu className="animate-spin text-primary-500" size={48} /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 font-sans">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-10">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[28px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-2xl shrink-0"><SettingsIcon size={32} /></div>
          <div>
            <h1 className="text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Configurações</h1>
            <p className="text-zinc-500 mt-2 font-medium">Controle total do ecossistema de rastreamento.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={handleSaveSettings} className="bg-primary-500 hover:bg-primary-400 text-black px-10 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all active:scale-95">
            <Save size={18} /> Salvar Tudo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLUNA ESQUERDA (PERFIL E SEGURANÇA) */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* MEU PERFIL */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><UserIcon size={14}/> Meu Perfil</h3>
            <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-[32px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 font-black text-4xl mb-4 border border-zinc-800 shadow-xl">{profileForm.avatarInitial}</div>
                <div className="text-center mb-8">
                    <h4 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase leading-tight">{currentUser?.name}</h4>
                    <span className="inline-flex mt-2 px-3 py-1 bg-primary-500/10 text-primary-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-primary-500/20">{currentUser?.role}</span>
                    <p className="text-[10px] text-zinc-400 font-medium mt-3 italic">{currentUser?.email}</p>
                </div>
                <form onSubmit={handleSaveProfile} className="w-full space-y-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Nome de Exibição</label>
                        <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Inicial do Avatar (1-2 Letras)</label>
                        <input type="text" maxLength={2} value={profileForm.avatarInitial} onChange={e => setProfileForm({...profileForm, avatarInitial: e.target.value.toUpperCase()})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                    </div>
                    <button type="submit" disabled={profileLoading} className="w-full py-4 bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-black rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2">
                        {profileLoading ? <RefreshCw className="animate-spin" size={14}/> : <UserCircle2 size={14}/>} ATUALIZAR DADOS
                    </button>
                </form>
            </div>
          </div>

          {/* SEGURANÇA */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2"><Lock size={14}/> Segurança</h3>
                <button type="button" onClick={() => setShowPwds(!showPwds)} className="text-zinc-400">{showPwds ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
            </div>
            <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Senha Atual</label>
                    <input type={showPwds ? 'text' : 'password'} required value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Nova Senha</label>
                    <input type={showPwds ? 'text' : 'password'} required value={pwdForm.new} onChange={e => setPwdForm({...pwdForm, new: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Confirmar Nova Senha</label>
                    <input type={showPwds ? 'text' : 'password'} required value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                </div>
                <button type="submit" disabled={pwdLoading} className="w-full py-4 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-zinc-800 shadow-xl">
                    <Check size={16}/> SALVAR SENHA
                </button>
            </form>
          </div>

          {/* IDIOMA */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2"><Languages size={14}/> Idioma</h3>
             <select 
               value={settings.language} 
               onChange={e => setSettings({...settings, language: e.target.value as any})}
               className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none appearance-none"
             >
                <option value="pt">Português (Brasil)</option>
                <option value="en">English (US)</option>
             </select>
          </div>
        </div>

        {/* COLUNA DIREITA (APIs E SISTEMA) */}
        <div className="lg:col-span-8 space-y-10">
          
          {isAdmin && (
            <>
              {/* CONFIGURAÇÃO API K-TAG */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Key size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Configuração API K-Tag</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL do Endpoint K-Tag</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                      <input type="text" value={settings.ktagUrl} onChange={e => setSettings({...settings, ktagUrl: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none focus:border-primary-500" placeholder="https://api.ktag.example.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Usuário K-Tag</label>
                        <input type="text" value={settings.ktagUser} onChange={e => setSettings({...settings, ktagUser: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none focus:border-primary-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha K-Tag</label>
                        <div className="relative">
                           <input type={showKTagPass ? 'text' : 'password'} value={settings.ktagPass} onChange={e => setSettings({...settings, ktagPass: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none focus:border-primary-500 pr-12" />
                           <button type="button" onClick={() => setShowKTagPass(!showKTagPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showKTagPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              {/* SGA HINOVA */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-emerald-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Database size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">INTEGRAÇÃO SGA (HINOVA)</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL do Endpoint SGA</label>
                    <input type="text" value={settings.hinovaUrl} onChange={e => setSettings({...settings, hinovaUrl: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs" placeholder="https://api.hinova.com.br/api/sga/v2" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Token SGA (Master / SGA Token)</label>
                    <div className="relative">
                      <input type={showHinovaToken ? 'text' : 'password'} value={settings.hinovaToken} onChange={e => setSettings({...settings, hinovaToken: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-emerald-500 pr-12" />
                      <button type="button" onClick={() => setShowHinovaToken(!showHinovaToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaToken ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Usuário de Autenticação</label>
                        <input type="text" value={settings.hinovaUser} onChange={e => setSettings({...settings, hinovaUser: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha de Autenticação</label>
                        <div className="relative">
                           <input type={showHinovaPass ? 'text' : 'password'} value={settings.hinovaPass} onChange={e => setSettings({...settings, hinovaPass: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs" />
                           <button type="button" onClick={() => setShowHinovaPass(!showHinovaPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              {/* PROXY & RELAY */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-cyan-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Cloud size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">PROXY & RELAY (FIREBASE)</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Proxy Cloud Function URL</label>
                    <div className="relative">
                      <Terminal className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16}/>
                      <input type="text" value={settings.customProxyUrl} onChange={e => setSettings({...settings, customProxyUrl: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none" />
                    </div>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase mt-2">Necessário para contornar bloqueios de CORS em navegadores ao acessar o servidor K-Tag diretamente.</p>
                  </div>
                </div>
              </div>

              {/* REGIONAIS E CATEGORIAS */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-amber-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <LayoutGrid size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">REGIONAIS & CATEGORIAS</h2>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                   {/* Regionais */}
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Building2 size={14}/> Regionais</h4>
                      <div className="flex gap-2">
                         <input type="text" placeholder="Nome" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold" />
                         <input type="text" placeholder="ID" maxLength={4} value={newCompany.prefix} onChange={e => setNewCompany({...newCompany, prefix: e.target.value.toUpperCase()})} className="w-16 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-center" />
                         <button onClick={handleAddCompany} className="p-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all"><Plus size={18} strokeWidth={3}/></button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                         {companies.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl group transition-all">
                               <span className="text-[10px] font-black uppercase tracking-tight">{c.prefix} - {c.name}</span>
                               <button onClick={() => handleDeleteCompany(c.id)} className="p-1.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Categorias */}
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Server size={14}/> Categorias</h4>
                      <div className="flex gap-2">
                         <input type="text" placeholder="Veículo" value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})} className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold" />
                         <button onClick={handleAddCategory} className="p-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all"><Plus size={18} strokeWidth={3}/></button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                         {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl group transition-all">
                               <span className="text-[10px] font-black uppercase tracking-tight">{cat.name}</span>
                               <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>

              {/* TRAQCARE API */}
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Cpu size={24} />
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">API Traqcare (XADTAG)</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Token da API Traqcare</label>
                    <div className="relative">
                      <input 
                        type={showTraqToken ? 'text' : 'password'} 
                        value={settings.traqcareToken} 
                        onChange={e => setSettings({...settings, traqcareToken: e.target.value})} 
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-primary-500 pr-12" 
                      />
                      <button type="button" onClick={() => setShowTraqToken(!showTraqToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showTraqToken ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                    </div>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">Token de ambiente necessário para comunicação com dispositivos XADTAG.</p>
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
