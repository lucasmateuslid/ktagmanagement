
import * as React from 'react';
import { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { AppSettings, User, Company, VehicleCategory } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { securityService } from '../services/security';
import { 
  Save, Settings as SettingsIcon, Database, Globe, Key, 
  Languages, Trash2, Plus, ShieldAlert, 
  Lock, Edit2, Building2, Server, Eye, EyeOff, 
  User as UserIcon, LayoutGrid, Cpu, Cloud, Terminal, 
  UserCircle2, ChevronRight, Check, RefreshCw, Link as LinkIcon,
  MapPin, ShoppingBag, AlertTriangle, Crown, ShieldCheck, Wallet, Briefcase, Percent, X, Bell,
  Wrench, CheckCircle2, MessageSquare, CalendarClock, CalendarCheck, Box
} from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  // States para Regionais
  const [newCompany, setNewCompany] = useState({ name: '', prefix: '', hasSgaIntegration: true });
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

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
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  
  const [notificationPrefs, setNotificationPrefs] = useState({
    newTechnicalRequest: true,
    serviceCompleted: true,
    theftRegistered: true,
    newComment: true,
    schedulingNeedsConfirmation: true,
    schedulingNeedsCompletion: true,
    schedulingUpdates: true
  });
  const [notifLoading, setNotifLoading] = useState(false);

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
        if (currentUser.notificationPreferences) {
          setNotificationPrefs({
            newTechnicalRequest: currentUser.notificationPreferences.newTechnicalRequest ?? true,
            serviceCompleted: currentUser.notificationPreferences.serviceCompleted ?? true,
            theftRegistered: currentUser.notificationPreferences.theftRegistered ?? true,
            newComment: currentUser.notificationPreferences.newComment ?? true,
            schedulingNeedsConfirmation: currentUser.notificationPreferences.schedulingNeedsConfirmation ?? true,
            schedulingNeedsCompletion: currentUser.notificationPreferences.schedulingNeedsCompletion ?? true,
            schedulingUpdates: currentUser.notificationPreferences.schedulingUpdates ?? true,
          });
        }
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

  // Helper de Cargo atualizado
  const getRoleStyle = (role?: string) => {
    switch (role) {
      case 'admin': return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: null, label: 'Administrador' };
      case 'admin_tecnico': return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: null, label: 'Admin Técnico' };
      case 'moderator': return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: null, label: 'Moderador' };
      case 'client': return null;
      default: return { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200 dark:border-zinc-700', icon: UserIcon, label: 'Usuário' };
    }
  };

  const roleStyle = getRoleStyle(currentUser?.role);
  const RoleIcon = roleStyle?.icon;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await storage.saveSettings(settings);
      setLanguage(settings.language);
      storage.logAction(currentUser, 'CONFIG', 'Settings', 'Atualizou configurações globais do sistema');
      addNotification('success', 'Sucesso', 'Configurações salvas.');
      // Reload para aplicar a nova chave do Google Maps se alterada
      if ((window as any).google && (window as any).google.maps) {
         setTimeout(() => window.location.reload(), 1000);
      }
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

  const handleSaveNotificationPrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setNotifLoading(true);
    try {
        await updateProfile({ notificationPreferences: notificationPrefs });
        storage.logAction(currentUser, 'UPDATE', 'User', 'Atualizou preferências de notificação');
        addNotification('success', 'Preferências Atualizadas', 'Suas preferências de notificação foram salvas.');
    } catch (err) {
        addNotification('error', 'Erro', 'Falha ao salvar preferências de notificação.');
    } finally { setNotifLoading(false); }
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

        const isCurrentValid = await securityService.verifyPassword(pwdForm.current, dbUser.password || '');
        const isLegacyValid = !isCurrentValid && (dbUser.password === pwdForm.current);

        if (!isCurrentValid && !isLegacyValid) {
             addNotification('error', 'Erro', 'Senha atual incorreta.'); 
             return; 
        }

        await updateProfile({ password: pwdForm.new });

        addNotification('success', 'Sucesso', 'Sua senha foi alterada com segurança.');
        setPwdForm({ current: '', new: '', confirm: '' });
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao atualizar senha.');
    } finally { setPwdLoading(false); }
  };

  const handleSaveCompany = async () => {
    if (!newCompany.name || !newCompany.prefix) return;
    
    const id = editingCompanyId || crypto.randomUUID();
    const company: Company = { 
        id: id, 
        name: newCompany.name, 
        prefix: newCompany.prefix.toUpperCase(),
        hasSgaIntegration: newCompany.hasSgaIntegration
    };
    
    await storage.saveCompany(company);
    
    if (editingCompanyId) {
        setCompanies(companies.map(c => c.id === id ? company : c));
        addNotification('success', 'Regional Atualizada', 'Dados atualizados com sucesso.');
    } else {
        setCompanies([...companies, company]);
        addNotification('success', 'Regional Criada', 'Nova regional adicionada com sucesso.');
    }
    
    handleCancelEdit();
  };

  const handleStartEditCompany = (c: Company) => {
      setNewCompany({
          name: c.name,
          prefix: c.prefix,
          hasSgaIntegration: c.hasSgaIntegration ?? true
      });
      setEditingCompanyId(c.id);
  };

  const handleCancelEdit = () => {
      setNewCompany({ name: '', prefix: '', hasSgaIntegration: true });
      setEditingCompanyId(null);
  };

  const [isConfirmDeleteCompanyOpen, setIsConfirmDeleteCompanyOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [isConfirmDeleteCategoryOpen, setIsConfirmDeleteCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const handleDeleteCompany = (id: string) => {
    setCompanyToDelete(id);
    setIsConfirmDeleteCompanyOpen(true);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    await storage.deleteCompany(companyToDelete);
    setCompanies(companies.filter(c => c.id !== companyToDelete));
    if (editingCompanyId === companyToDelete) handleCancelEdit();
    setIsConfirmDeleteCompanyOpen(false);
    setCompanyToDelete(null);
    addNotification('success', 'Sucesso', 'Regional excluída.');
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    const category: VehicleCategory = { id: crypto.randomUUID(), name: newCategory.name, fipeType: newCategory.fipeType as any };
    await storage.saveCategory(category);
    setCategories([...categories, category]);
    setNewCategory({ name: '', fipeType: 'carros' });
    addNotification('success', 'Categoria Criada', 'Nova categoria adicionada.');
  };

  const handleDeleteCategory = (id: string) => {
    setCategoryToDelete(id);
    setIsConfirmDeleteCategoryOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    await storage.deleteCategory(categoryToDelete);
    setCategories(categories.filter(c => c.id !== categoryToDelete));
    setIsConfirmDeleteCategoryOpen(false);
    setCategoryToDelete(null);
    addNotification('success', 'Sucesso', 'Categoria excluída.');
  };

  if (loading || !settings) return <div className="flex items-center justify-center h-full"><Cpu className="animate-spin text-primary-500" size={48} /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 pb-32 font-sans">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-10">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[28px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-2xl shrink-0">
            <SettingsIcon size={24} className="md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Configurações</h1>
            <p className="text-zinc-500 mt-1 md:mt-2 font-medium text-xs md:text-base">Controle total do ecossistema de rastreamento.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={handleSaveSettings} className="w-full md:w-auto bg-primary-500 hover:bg-primary-400 text-black px-10 py-4 rounded-[20px] flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all active:scale-95">
            <Save size={18} /> Salvar Tudo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        
        {/* COLUNA ESQUERDA (PERFIL E SEGURANÇA) */}
        <div className={`space-y-6 md:space-y-10 ${currentUser?.role === 'client' ? 'lg:col-span-12 max-w-2xl mx-auto w-full' : 'lg:col-span-4'}`}>
          
          {/* MEU PERFIL - Redesenhado */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
                {roleStyle && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${roleStyle.bg} ${roleStyle.border}`}>
                        {RoleIcon && <RoleIcon size={10} className={roleStyle.color} strokeWidth={3}/>}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${roleStyle.color}`}>{roleStyle.label}</span>
                    </div>
                )}
            </div>

            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"><UserIcon size={14}/> Meu Perfil</h3>
            
            <div className="flex flex-col items-center">
                <div className="w-28 h-28 rounded-[28px] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-black text-5xl mb-4 border-4 border-white dark:border-zinc-700 shadow-xl">
                    {profileForm.avatarInitial}
                </div>
                <div className="text-center mb-8">
                    <h4 className="text-xl font-display font-black text-zinc-900 dark:text-white uppercase leading-tight">{currentUser?.name}</h4>
                    <p className="text-[10px] text-zinc-400 font-medium mt-1 italic max-w-[200px] truncate">{currentUser?.email}</p>
                </div>
                
                <form onSubmit={handleSaveProfile} className="w-full space-y-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Nome de Exibição</label>
                        <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Inicial do Avatar</label>
                        <input type="text" maxLength={2} value={profileForm.avatarInitial} onChange={e => setProfileForm({...profileForm, avatarInitial: e.target.value.toUpperCase()})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:border-primary-500 text-center" />
                    </div>
                    <button type="submit" disabled={profileLoading} className="w-full py-4 bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-black rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 mt-2">
                        {profileLoading ? <RefreshCw className="animate-spin" size={14}/> : <UserCircle2 size={14}/>} ATUALIZAR DADOS
                    </button>
                </form>
            </div>
          </div>

          {/* SEGURANÇA */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2"><Lock size={14}/> Segurança</h3>
                <button type="button" onClick={() => setShowPwds(!showPwds)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors">{showPwds ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
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
                <button type="submit" disabled={pwdLoading} className="w-full py-4 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border border-zinc-800 shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-700">
                    <Check size={16}/> SALVAR SENHA
                </button>
            </form>
          </div>

          {/* IDIOMA */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm">
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

          {/* PREFERÊNCIAS DE NOTIFICAÇÃO */}
          <div className="bg-white dark:bg-[#141414] p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
             <div className="mb-8">
                 <h3 className="text-xl font-display font-medium tracking-tight text-zinc-900 dark:text-white">Notificações</h3>
                 <p className="text-sm text-zinc-500 mt-1">Escolha quais alertas você deseja receber no seu dispositivo.</p>
             </div>
             
             <form onSubmit={handleSaveNotificationPrefs}>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 border-t border-b border-zinc-100 dark:border-zinc-800/60">
                    {/* Item 1 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <Wrench size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Nova Solicitação</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Avisar quando um novo serviço for solicitado</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.newTechnicalRequest ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.newTechnicalRequest ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.newTechnicalRequest} onChange={e => setNotificationPrefs({...notificationPrefs, newTechnicalRequest: e.target.checked})} className="sr-only" />
                    </label>

                    {/* Item 2 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <CheckCircle2 size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Serviço Concluído</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Avisar quando um técnico finalizar um serviço</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.serviceCompleted ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.serviceCompleted ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.serviceCompleted} onChange={e => setNotificationPrefs({...notificationPrefs, serviceCompleted: e.target.checked})} className="sr-only" />
                    </label>

                    {/* Item 3 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <AlertTriangle size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Roubo Cadastrado</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Alerta imediato de veículo roubado</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.theftRegistered ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.theftRegistered ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.theftRegistered} onChange={e => setNotificationPrefs({...notificationPrefs, theftRegistered: e.target.checked})} className="sr-only" />
                    </label>

                    {/* Item 4 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <MessageSquare size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Novo Comentário</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Avisar sobre mensagens em serviços</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.newComment ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.newComment ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.newComment} onChange={e => setNotificationPrefs({...notificationPrefs, newComment: e.target.checked})} className="sr-only" />
                    </label>

                    {/* Item 5 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <CalendarClock size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Agendamento Pendente</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Serviços aguardando confirmação</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.schedulingNeedsConfirmation ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.schedulingNeedsConfirmation ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.schedulingNeedsConfirmation} onChange={e => setNotificationPrefs({...notificationPrefs, schedulingNeedsConfirmation: e.target.checked})} className="sr-only" />
                    </label>

                    {/* Item 6 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <CalendarCheck size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Agendamento a Concluir</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Lembrete de serviços agendados para hoje</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.schedulingNeedsCompletion ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.schedulingNeedsCompletion ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.schedulingNeedsCompletion} onChange={e => setNotificationPrefs({...notificationPrefs, schedulingNeedsCompletion: e.target.checked})} className="sr-only" />
                    </label>

                    {/* Item 7 */}
                    <label className="flex items-center justify-between py-5 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
                                <RefreshCw size={18} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Atualizações de Status</span>
                                <span className="text-xs text-zinc-500 mt-0.5">Avisar sobre mudanças de status em agendamentos</span>
                            </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPrefs.schedulingUpdates ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${notificationPrefs.schedulingUpdates ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                        </div>
                        <input type="checkbox" checked={notificationPrefs.schedulingUpdates} onChange={e => setNotificationPrefs({...notificationPrefs, schedulingUpdates: e.target.checked})} className="sr-only" />
                    </label>
                </div>

                <div className="mt-8">
                    <button type="submit" disabled={notifLoading} className="w-full py-4 bg-primary-500 text-black hover:bg-primary-400 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                        {notifLoading ? <RefreshCw className="animate-spin" size={18}/> : 'Salvar preferências'}
                    </button>
                </div>
             </form>
          </div>
        </div>

        {/* COLUNA DIREITA (APIs E SISTEMA) */}
        {currentUser?.role !== 'client' && (
          <div className="lg:col-span-8 space-y-6 md:space-y-10">
          
              {/* CONFIGURAÇÃO DE ESTOQUE E FINANCEIRO */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-amber-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <ShoppingBag size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Estoque & Financeiro</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Estoque Mínimo</label>
                        <div className="relative">
                            <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                            <input 
                                type="number" 
                                disabled={!isAdmin}
                                value={settings.minStockLevel || 80} 
                                onChange={e => setSettings({...settings, minStockLevel: parseInt(e.target.value)})} 
                                className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                        </div>
                        <p className="text-[9px] text-zinc-400 mt-1 ml-1">Nível alerta compra.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Estoque Crítico</label>
                        <div className="relative">
                            <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={16} />
                            <input 
                                type="number" 
                                disabled={!isAdmin}
                                value={settings.criticalStockLevel || 40} 
                                onChange={e => setSettings({...settings, criticalStockLevel: parseInt(e.target.value)})} 
                                className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-red-500 disabled:opacity-50"
                            />
                        </div>
                        <p className="text-[9px] text-zinc-400 mt-1 ml-1">Nível de risco de ruptura.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Margem de Lucro (%)</label>
                        <div className="relative">
                            <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                            <input 
                                type="number" 
                                disabled={!isAdmin}
                                value={settings.budgetMarginThreshold || 25} 
                                onChange={e => setSettings({...settings, budgetMarginThreshold: parseFloat(e.target.value)})} 
                                className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
                            />
                        </div>
                        <p className="text-[9px] text-zinc-400 mt-1 ml-1">Limite mín. para aprovação (Default: 25%).</p>
                    </div>
                </div>
              </div>

              {/* GOOGLE MAPS API */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-red-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <MapPin size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Integração Google Maps</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Chave da API (Places & Geocoding)</label>
                    <div className="relative">
                      <input 
                        type={showGoogleKey ? 'text' : 'password'} 
                        disabled={!isAdmin}
                        value={isAdmin ? settings.googleMapsKey : '••••••••••••••••'} 
                        onChange={e => setSettings({...settings, googleMapsKey: e.target.value})} 
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-red-500 pr-12 disabled:opacity-50" 
                        placeholder="AIza..."
                      />
                      {isAdmin && <button type="button" onClick={() => setShowGoogleKey(!showGoogleKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showGoogleKey ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
                    </div>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">Necessário habilitar: Maps JavaScript API, Places API, Geocoding API.</p>
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO API K-TAG */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Key size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Configuração API K-Tag</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL do Endpoint K-Tag</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                      <input type="text" disabled={!isAdmin} value={isAdmin ? settings.ktagUrl : '••••••••••••••••'} onChange={e => setSettings({...settings, ktagUrl: e.target.value})} className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none focus:border-primary-500 disabled:opacity-50" placeholder="https://api.ktag.example.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Usuário K-Tag</label>
                        <input type="text" disabled={!isAdmin} value={isAdmin ? settings.ktagUser : '••••••••••••••••'} onChange={e => setSettings({...settings, ktagUser: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none focus:border-primary-500 disabled:opacity-50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha K-Tag</label>
                        <div className="relative">
                           <input type={showKTagPass ? 'text' : 'password'} disabled={!isAdmin} value={isAdmin ? settings.ktagPass : '••••••••••••••••'} onChange={e => setSettings({...settings, ktagPass: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none focus:border-primary-500 pr-12 disabled:opacity-50" />
                           {isAdmin && <button type="button" onClick={() => setShowKTagPass(!showKTagPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showKTagPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              {/* SGA HINOVA */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-emerald-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Database size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">INTEGRAÇÃO SGA (HINOVA)</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL do Endpoint SGA</label>
                    <input type="text" disabled={!isAdmin} value={isAdmin ? settings.hinovaUrl : '••••••••••••••••'} onChange={e => setSettings({...settings, hinovaUrl: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" placeholder="https://api.hinova.com.br/api/sga/v2" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Token SGA (Master / SGA Token)</label>
                    <div className="relative">
                      <input type={showHinovaToken ? 'text' : 'password'} disabled={!isAdmin} value={isAdmin ? settings.hinovaToken : '••••••••••••••••'} onChange={e => setSettings({...settings, hinovaToken: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-emerald-500 pr-12 disabled:opacity-50" />
                      {isAdmin && <button type="button" onClick={() => setShowHinovaToken(!showHinovaToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaToken ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Usuário de Autenticação</label>
                        <input type="text" disabled={!isAdmin} value={isAdmin ? settings.hinovaUser : '••••••••••••••••'} onChange={e => setSettings({...settings, hinovaUser: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha de Autenticação</label>
                        <div className="relative">
                           <input type={showHinovaPass ? 'text' : 'password'} disabled={!isAdmin} value={isAdmin ? settings.hinovaPass : '••••••••••••••••'} onChange={e => setSettings({...settings, hinovaPass: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" />
                           {isAdmin && <button type="button" onClick={() => setShowHinovaPass(!showHinovaPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              {/* PROXY & RELAY */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-cyan-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Cloud size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">PROXY & RELAY (FIREBASE)</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Proxy Cloud Function URL</label>
                    <div className="relative">
                      <Terminal className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16}/>
                      <input type="text" disabled={!isAdmin} value={isAdmin ? settings.customProxyUrl : '••••••••••••••••'} onChange={e => setSettings({...settings, customProxyUrl: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none disabled:opacity-50" />
                    </div>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase mt-2">Necessário para contornar bloqueios de CORS em navegadores ao acessar o servidor K-Tag diretamente.</p>
                  </div>
                </div>
              </div>

              {/* SITE RASTREIO API */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-orange-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Box size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">SITE RASTREIO API</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">API Key (siterastreio.com.br)</label>
                    <div className="relative">
                      <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16}/>
                      <input type="text" disabled={!isAdmin} value={isAdmin ? (settings.siteRastreioApiKey || '') : '••••••••••••••••'} onChange={e => setSettings({...settings, siteRastreioApiKey: e.target.value})} className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none disabled:opacity-50" placeholder="Sua API Key" />
                    </div>
                  </div>
                </div>
              </div>

              {/* REGIONAIS E CATEGORIAS */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-amber-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <LayoutGrid size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">REGIONAIS & CATEGORIAS</h2>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
                   {/* Regionais */}
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Building2 size={14}/> Regionais</h4>
                      {isAdmin && (
                        <div className="flex gap-2">
                           <div className="flex-1 flex gap-2">
                               <input type="text" placeholder="Nome" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} className="flex-1 min-w-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold" />
                               <input type="text" placeholder="ID" maxLength={4} value={newCompany.prefix} onChange={e => setNewCompany({...newCompany, prefix: e.target.value.toUpperCase()})} className="w-16 shrink-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-center" />
                           </div>
                           <div className="flex gap-1">
                               {editingCompanyId && (
                                  <button onClick={handleCancelEdit} className="p-3.5 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0"><X size={18} strokeWidth={3}/></button>
                               )}
                               <button onClick={handleSaveCompany} className={`p-3.5 ${editingCompanyId ? 'bg-emerald-500 text-white' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black'} rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0`}>
                                  {editingCompanyId ? <Check size={18} strokeWidth={3}/> : <Plus size={18} strokeWidth={3}/>}
                               </button>
                           </div>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-2 mb-2">
                            <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 cursor-pointer">
                                <input type="checkbox" checked={newCompany.hasSgaIntegration} onChange={e => setNewCompany({...newCompany, hasSgaIntegration: e.target.checked})} className="accent-emerald-500 w-4 h-4 rounded" />
                                Integração com SGA Ativa
                            </label>
                        </div>
                      )}
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                         {companies.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl group transition-all">
                               <div className="flex flex-col">
                                   <span className="text-[10px] font-black uppercase tracking-tight truncate">{c.prefix} - {c.name}</span>
                                   <span className={`text-[9px] font-bold ${c.hasSgaIntegration === false ? 'text-amber-500' : 'text-emerald-500'}`}>{c.hasSgaIntegration === false ? 'Sem Integração SGA' : 'Integrado ao SGA'}</span>
                               </div>
                               {isAdmin && (
                                 <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                                     <button onClick={() => handleStartEditCompany(c)} className="p-1.5 text-zinc-300 hover:text-primary-500"><Edit2 size={14}/></button>
                                     <button onClick={() => handleDeleteCompany(c.id)} className="p-1.5 text-zinc-300 hover:text-red-500"><Trash2 size={14}/></button>
                                 </div>
                               )}
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Categorias */}
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Server size={14}/> Categorias</h4>
                      {isAdmin && (
                        <div className="flex gap-2">
                           <input type="text" placeholder="Veículo" value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})} className="flex-1 min-w-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold" />
                           <button onClick={handleAddCategory} className="p-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0"><Plus size={18} strokeWidth={3}/></button>
                        </div>
                      )}
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                         {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl group transition-all">
                               <span className="text-[10px] font-black uppercase tracking-tight truncate">{cat.name}</span>
                               {isAdmin && <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-zinc-300 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"><Trash2 size={14}/></button>}
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>

              {/* TRAQCARE API */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <Cpu size={24} />
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">API Traqcare (XADTAG)</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Token da API Traqcare</label>
                    <div className="relative">
                      <input 
                        type={showTraqToken ? 'text' : 'password'} 
                        disabled={!isAdmin}
                        value={isAdmin ? settings.traqcareToken : '••••••••••••••••'} 
                        onChange={e => setSettings({...settings, traqcareToken: e.target.value})} 
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-primary-500 pr-12 disabled:opacity-50" 
                      />
                      {isAdmin && <button type="button" onClick={() => setShowTraqToken(!showTraqToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showTraqToken ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
                    </div>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">Token de ambiente necessário para comunicação com dispositivos XADTAG.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
      {/* Modais de Confirmação */}
      <ConfirmModal
        isOpen={isConfirmDeleteCompanyOpen}
        onClose={() => setIsConfirmDeleteCompanyOpen(false)}
        onConfirm={confirmDeleteCompany}
        title="Excluir Regional"
        message="Tem certeza que deseja excluir esta regional? Esta ação não pode ser desfeita."
        type="danger"
      />

      <ConfirmModal
        isOpen={isConfirmDeleteCategoryOpen}
        onClose={() => setIsConfirmDeleteCategoryOpen(false)}
        onConfirm={confirmDeleteCategory}
        title="Excluir Categoria"
        message="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        type="danger"
      />
    </div>
  );
};
