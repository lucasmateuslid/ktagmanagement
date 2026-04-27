
import * as React from 'react';
import { useEffect, useState } from 'react';
import { storage } from '../../services/storage';
import { AppSettings, User, Company, VehicleCategory } from '../../types';
import { ConfirmModal } from '../ConfirmModal';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { securityService } from '../../services/security';
import { 
  Save, Settings as SettingsIcon, Database, Globe, Key, 
  Languages, Trash2, Plus, ShieldAlert, 
  Lock, Edit2, Building2, Server, Eye, EyeOff, 
  User as UserIcon, LayoutGrid, Cpu, Cloud, Terminal, 
  UserCircle2, ChevronRight, Check, RefreshCw, Link as LinkIcon,
  MapPin, ShoppingBag, AlertTriangle, Crown, ShieldCheck, Wallet, Briefcase, Percent, X, Bell,
  Wrench, CheckCircle2, MessageSquare, CalendarClock, CalendarCheck, Box
} from 'lucide-react';

export const SystemApisModule = () => {
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

    // Check for Melhor Envio OAuth callback
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state && state.startsWith('melhorenvio_')) {
      const returnedEnv = state.split('_')[1] as 'sandbox' | 'production';
      const exchangeToken = async () => {
        try {
          const currentSettings = await storage.getSettings();
          const redirectUri = window.location.origin + window.location.pathname;
          
          const clientId = returnedEnv === 'production' ? currentSettings.melhorEnvioProdClientId : currentSettings.melhorEnvioSandboxClientId;
          const clientSecret = returnedEnv === 'production' ? currentSettings.melhorEnvioProdClientSecret : currentSettings.melhorEnvioSandboxClientSecret;

          const response = await fetch('/api/melhorenvio/oauth/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              clientId,
              clientSecret,
              redirectUri,
              environment: returnedEnv
            })
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Erro ao trocar token');

          // Salvar os tokens correspondentes ao ambiente retornado
          const newSettings = {
            ...currentSettings,
            melhorEnvioEnvironment: returnedEnv // force interface to show what was just authorized
          };

          if (returnedEnv === 'production') {
            newSettings.melhorEnvioProdToken = data.access_token;
            newSettings.melhorEnvioProdRefreshToken = data.refresh_token;
            newSettings.melhorEnvioProdExpiresAt = Date.now() + (data.expires_in * 1000);
          } else {
            newSettings.melhorEnvioSandboxToken = data.access_token;
            newSettings.melhorEnvioSandboxRefreshToken = data.refresh_token;
            newSettings.melhorEnvioSandboxExpiresAt = Date.now() + (data.expires_in * 1000);
          }

          await storage.saveSettings(newSettings);
          setSettings(newSettings);
          addNotification('success', 'Sucesso', `Melhor Envio (${returnedEnv === 'production' ? 'Produção' : 'Sandbox'}) autorizado com sucesso!`);
          
          // Limpar URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error: any) {
          console.error('Exchange error:', error);
          addNotification('error', 'Falha na Autorização', error.message);
        }
      };

      exchangeToken();
    }
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

      <div className="space-y-6 md:space-y-10">
          
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
                  <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Geocodificação e Mapas</h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Provedor Principal de Geocodificação</label>
                    <select
                      disabled={!isAdmin}
                      value={settings.geocodingProvider || 'osm'}
                      onChange={e => setSettings({...settings, geocodingProvider: e.target.value as 'osm' | 'google'})}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-red-500 disabled:opacity-50"
                    >
                      <option value="osm">OpenStreetMap (Gratuito - Recomendado)</option>
                      <option value="google">Google Maps (Pago)</option>
                    </select>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">Define qual serviço será tentado primeiro. O outro será usado como plano B (fallback).</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Chave da API Google Maps (Places & Geocoding)</label>
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

              {/* WHATSAPP EVOLUTION API */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <div className="flex items-center gap-3 text-emerald-500">
                    <MessageSquare size={24} />
                    <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">WhatsApp / Evolution API</h2>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableWhatsAppNotifications ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${settings.enableWhatsAppNotifications ? 'translate-x-5 bg-white' : 'translate-x-1 bg-white dark:bg-zinc-400'}`} />
                    </div>
                    <input type="checkbox" disabled={!isAdmin} checked={settings.enableWhatsAppNotifications || false} onChange={e => setSettings({...settings, enableWhatsAppNotifications: e.target.checked})} className="sr-only" />
                  </label>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL Base da Evolution API</label>
                    <input type="text" disabled={!isAdmin} value={isAdmin ? (settings.evolutionApiUrl || '') : '••••••••••••••••'} onChange={e => setSettings({...settings, evolutionApiUrl: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" placeholder="Ex: https://vps.minhaevo.com" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Global API Key</label>
                        <input type="password" disabled={!isAdmin} value={isAdmin ? (settings.evolutionApiKey || '') : '••••••••••••••••'} onChange={e => setSettings({...settings, evolutionApiKey: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] disabled:opacity-50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome da Instância</label>
                        <input type="text" disabled={!isAdmin} value={isAdmin ? (settings.evolutionInstanceName || '') : '••••••••••••••••'} onChange={e => setSettings({...settings, evolutionInstanceName: e.target.value})} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" placeholder="Ex: Principal_KTAG" />
                      </div>
                  </div>
                  <p className="text-[9px] text-zinc-500 italic mt-2">Dispara alertas automáticos para clientes quando a Ordem de Serviço muda de status.</p>
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

              {/* MELHOR ENVIO API */}
              <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-6">
                  <div className="flex items-center gap-3 text-emerald-500">
                    <Box size={24} />
                    <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">MELHOR ENVIO API</h2>
                  </div>
                  {settings.melhorEnvioToken && (
                    <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                       <CheckCircle2 size={14} /> AUTORIZADO
                    </div>
                  )}
                </div>
                
                <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 mb-6 flex flex-col space-y-2">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">URL de Callback (Redirecionamento)</p>
                  <code className="text-xs font-mono bg-white dark:bg-black p-2 rounded-lg text-zinc-600 dark:text-zinc-400 select-all border border-zinc-200 dark:border-zinc-800">
                    {typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''}
                  </code>
                  <p className="text-[10px] text-zinc-500">Cadastre exatamente esta URL no seu Painel do Melhor Envio.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Client ID ({settings.melhorEnvioEnvironment === 'production' ? 'Produção' : 'Sandbox'})</label>
                    <div className="relative">
                      <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16}/>
                      <input 
                        type="text" 
                        disabled={!isAdmin} 
                        value={isAdmin ? (settings.melhorEnvioEnvironment === 'production' ? (settings.melhorEnvioProdClientId || '') : (settings.melhorEnvioSandboxClientId || '')) : '•••'} 
                        onChange={e => {
                          if (settings.melhorEnvioEnvironment === 'production') {
                            setSettings({...settings, melhorEnvioProdClientId: e.target.value});
                          } else {
                            setSettings({...settings, melhorEnvioSandboxClientId: e.target.value});
                          }
                        }} 
                        className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs outline-none disabled:opacity-50 focus:border-emerald-500" placeholder="ID do Aplicativo" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Client Secret ({settings.melhorEnvioEnvironment === 'production' ? 'Produção' : 'Sandbox'})</label>
                    <div className="relative">
                      <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16}/>
                      <input 
                        type="password" 
                        disabled={!isAdmin} 
                        value={isAdmin ? (settings.melhorEnvioEnvironment === 'production' ? (settings.melhorEnvioProdClientSecret || '') : (settings.melhorEnvioSandboxClientSecret || '')) : '•••'} 
                        onChange={e => {
                          if (settings.melhorEnvioEnvironment === 'production') {
                            setSettings({...settings, melhorEnvioProdClientSecret: e.target.value});
                          } else {
                            setSettings({...settings, melhorEnvioSandboxClientSecret: e.target.value});
                          }
                        }} 
                        className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs outline-none disabled:opacity-50 focus:border-emerald-500" placeholder="Secret do Aplicativo" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  <div className="w-full md:w-1/3 mb-2 space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Ambiente Ativo</label>
                    <div className="relative">
                      <select 
                        disabled={!isAdmin} 
                        value={settings.melhorEnvioEnvironment || 'sandbox'} 
                        onChange={e => setSettings({...settings, melhorEnvioEnvironment: e.target.value as 'sandbox'|'production'})}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none disabled:opacity-50 appearance-none focus:border-emerald-500"
                      >
                        <option value="sandbox">Sandbox (Testes)</option>
                        <option value="production">Produção (Real)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        ▼
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="w-full flex flex-col md:flex-row gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                      {((settings.melhorEnvioEnvironment === 'production' && settings.melhorEnvioProdToken) || (settings.melhorEnvioEnvironment === 'sandbox' && settings.melhorEnvioSandboxToken)) && (
                        <button 
                          onClick={async () => {
                            try {
                              const env = settings.melhorEnvioEnvironment || 'sandbox';
                              const token = env === 'production' ? settings.melhorEnvioProdToken : settings.melhorEnvioSandboxToken;
                              const res = await fetch('/api/melhorenvio/companies', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  token: token,
                                  environment: env
                                })
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
                              console.log('Transportadoras:', data);
                              addNotification('success', 'Conectado', `Encontrou ${data.length} transportadoras. Verifique o console.`);
                            } catch (e: any) {
                              addNotification('error', 'Erro', e.message);
                            }
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all transform active:scale-95"
                        >
                          Testar Conexão
                        </button>
                      )}
                      <button 
                        onClick={async () => {
                          const env = settings.melhorEnvioEnvironment || 'sandbox';
                          const clientId = env === 'production' ? settings.melhorEnvioProdClientId : settings.melhorEnvioSandboxClientId;
                          const clientSecret = env === 'production' ? settings.melhorEnvioProdClientSecret : settings.melhorEnvioSandboxClientSecret;
                          
                          if (!clientId || !clientSecret) {
                            addNotification('info', 'Atenção', 'Preencha o Client ID e Secret do ambiente antes de autorizar.');
                            return;
                          }
                          await storage.saveSettings(settings); // Salva as configurações antes
                          const baseUrl = env === 'production' ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
                          const redirectUri = window.location.origin + window.location.pathname;
                          const authorizeUrl = `${baseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=melhorenvio_${env}&scope=shipping-calculate shipping-companies shipping-generate shipping-checkout shipping-print shipping-cancel shipping-tracking cart-read cart-write`;
                          
                          // Abrir em nova aba para não ser bloqueado pelo iframe do AI Studio
                          window.open(authorizeUrl, '_blank');
                        }}
                        className="w-full flex-1 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all transform active:scale-95 shadow-xl shadow-emerald-500/20 whitespace-nowrap"
                      >
                        Autorizar ({settings.melhorEnvioEnvironment === 'production' ? 'Produção' : 'Sandbox'})
                      </button>
                    </div>
                  )}
                  
                  {/* SENDER ADDRESS */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 mt-6">
                    <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Endereço Remetente (Padrão)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">CEP</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.postalCode || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), postalCode: e.target.value.replace(/\D/g, '')}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="00000000" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Logradouro</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.street || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), street: e.target.value}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="Rua..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Número</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.number || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), number: e.target.value}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="123" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Complemento</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.complement || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), complement: e.target.value}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="Sala 1" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Bairro</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.neighborhood || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), neighborhood: e.target.value}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="Centro" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Cidade</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.city || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), city: e.target.value}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="São Paulo" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Estado (UF)</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.state || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), state: e.target.value.toUpperCase()}})} maxLength={2} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="SP" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Documento (CPF/CNPJ)</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.document || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), document: e.target.value.replace(/\D/g, '')}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="Apenas números" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome Remetente</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.name || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), name: e.target.value}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="Empresa XPTO" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Telefone</label>
                        <input type="text" disabled={!isAdmin} value={settings.melhorEnvioSenderAddress?.phone || ''} onChange={e => setSettings({...settings, melhorEnvioSenderAddress: {...(settings.melhorEnvioSenderAddress as any), phone: e.target.value.replace(/\D/g, '')}})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500" placeholder="Apenas números" />
                      </div>
                    </div>
                  </div>

                  {/* PREDEFINED PACKAGES */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Pacotes Predefinidos</h3>
                      {isAdmin && (
                        <button 
                          onClick={() => {
                            const newPackage = { id: Math.random().toString(36).substr(2, 9), name: 'Novo Pacote', weight: 0.3, width: 11, height: 2, length: 16, insuranceValue: 100 };
                            setSettings({...settings, melhorEnvioPackages: [...(settings.melhorEnvioPackages || []), newPackage]});
                          }}
                          className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                        >
                          <Plus size={14} /> ADICIONAR
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {(settings.melhorEnvioPackages || []).map((pkg, idx) => (
                        <div key={pkg.id} className="grid grid-cols-2 md:grid-cols-7 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 items-end">
                          <div className="col-span-2 md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome</label>
                            <input type="text" disabled={!isAdmin} value={pkg.name} onChange={e => {
                                const newPackages = [...(settings.melhorEnvioPackages || [])];
                                newPackages[idx].name = e.target.value;
                                setSettings({...settings, melhorEnvioPackages: newPackages});
                            }} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-emerald-500" placeholder="Ex: Caixa P" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Peso (kg)</label>
                            <input type="number" step="0.1" disabled={!isAdmin} value={pkg.weight} onChange={e => {
                                const newPackages = [...(settings.melhorEnvioPackages || [])];
                                newPackages[idx].weight = parseFloat(e.target.value) || 0;
                                setSettings({...settings, melhorEnvioPackages: newPackages});
                            }} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-emerald-500" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">A x L x C (cm)</label>
                            <div className="flex gap-1">
                              <input type="number" disabled={!isAdmin} value={pkg.height} onChange={e => { const newP = [...(settings.melhorEnvioPackages || [])]; newP[idx].height = Number(e.target.value); setSettings({...settings, melhorEnvioPackages: newP}); }} className="w-full px-1 flex-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-center outline-none focus:border-emerald-500" title="Altura" />
                              <input type="number" disabled={!isAdmin} value={pkg.width} onChange={e => { const newP = [...(settings.melhorEnvioPackages || [])]; newP[idx].width = Number(e.target.value); setSettings({...settings, melhorEnvioPackages: newP}); }} className="w-full px-1 flex-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-center outline-none focus:border-emerald-500" title="Largura" />
                              <input type="number" disabled={!isAdmin} value={pkg.length} onChange={e => { const newP = [...(settings.melhorEnvioPackages || [])]; newP[idx].length = Number(e.target.value); setSettings({...settings, melhorEnvioPackages: newP}); }} className="w-full px-1 flex-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-center outline-none focus:border-emerald-500" title="Comprimento" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Seguro (R$)</label>
                            <input type="number" disabled={!isAdmin} value={pkg.insuranceValue} onChange={e => {
                                const newPackages = [...(settings.melhorEnvioPackages || [])];
                                newPackages[idx].insuranceValue = parseFloat(e.target.value) || 0;
                                setSettings({...settings, melhorEnvioPackages: newPackages});
                            }} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-emerald-500" />
                          </div>
                          <div className="col-span-2 md:col-span-1 flex justify-end">
                            {isAdmin && (
                              <button 
                                onClick={() => {
                                  setSettings({...settings, melhorEnvioPackages: settings.melhorEnvioPackages?.filter(p => p.id !== pkg.id)});
                                }}
                                className="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors flex items-center justify-center"
                                title="Remover"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!settings.melhorEnvioPackages || settings.melhorEnvioPackages.length === 0) && (
                        <p className="text-xs text-zinc-500 text-center py-4">Nenhum pacote cadastrado.</p>
                      )}
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
