
import React, { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { AppSettings, User, Company, VehicleCategory } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Save, Settings as SettingsIcon, Map, Database, Globe, Key, Languages, CloudLightning, Trash2, Plus, Search, ShieldAlert, Lock, Edit2, Building2, Truck } from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  // Profile Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', password: '' });

  // Form states for new items
  const [newCompany, setNewCompany] = useState({ name: '', prefix: '' });
  const [newCategory, setNewCategory] = useState({ name: '', fipeType: 'none' });

  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { language, setLanguage, t } = useLanguage();
  const { isAdmin, user: currentUser, updateProfile } = useAuth();

  useEffect(() => {
    const load = async () => {
      const data = await storage.getSettings();
      setSettings(data);
      if (data.language) setLanguage(data.language);
      
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
    load();
  }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      // Se for admin, salva tudo. Se não, salva apenas preferências locais (idioma)
      if (isAdmin) {
          await storage.saveSettings(settings);
      } else {
          // Busca configurações atuais do banco para não sobrescrever chaves com vazio
          const currentRemoteConfig = await storage.getSettings();
          const safeSettings: AppSettings = {
              ...currentRemoteConfig,
              language: settings.language // Atualiza apenas o que o user pode mexer
          };
          await storage.saveSettings(safeSettings);
      }

      setLanguage(settings.language); 
      addNotification('success', t('savedSuccess'), 'Configuration updated successfully.');
    } catch (err) {
      addNotification('error', t('savedError'), 'Failed to save settings.');
    }
  };
  
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!currentUser) return;
    
    try {
        const updates: Partial<User> = { name: profileForm.name };
        if(profileForm.password) {
            updates.password = profileForm.password;
        }
        await updateProfile(updates);
        setIsEditingProfile(false);
        addNotification('success', t('profileSaved'), 'Your profile has been updated.');
    } catch (e) {
        addNotification('error', 'Error', 'Failed to update profile.');
    }
  };

  const startEditProfile = () => {
      if(!currentUser) return;
      setProfileForm({ name: currentUser.name, password: '' });
      setIsEditingProfile(true);
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name || !newCompany.prefix) return;
    const company: Company = {
        id: crypto.randomUUID(),
        name: newCompany.name,
        prefix: newCompany.prefix.toUpperCase()
    };
    await storage.saveCompany(company);
    setCompanies([...companies, company]);
    setNewCompany({ name: '', prefix: '' });
    addNotification('success', 'Success', 'Company added.');
  };

  const handleDeleteCompany = async (id: string) => {
    if(!confirm('Delete this company?')) return;
    await storage.deleteCompany(id);
    setCompanies(prev => prev.filter(c => c.id !== id));
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name) return;
    const category: VehicleCategory = {
        id: crypto.randomUUID(),
        name: newCategory.name,
        fipeType: newCategory.fipeType as any
    };
    await storage.saveCategory(category);
    setCategories([...categories, category]);
    setNewCategory({ name: '', fipeType: 'none' });
    addNotification('success', 'Success', 'Category added.');
  };

  const handleDeleteCategory = async (id: string) => {
    if(!confirm('Delete this category?')) return;
    await storage.deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  if (loading || !settings) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <SettingsIcon size={32} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('systemSettings')}</h1>
          <p className="text-zinc-500">{isAdmin ? 'Full Administrator Access' : 'User Preferences'}</p>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* --- PUBLIC SECTION (Everyone) --- */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
           <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
            <Languages size={18} className="text-purple-500" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('generalSettings')}</h2>
          </div>
          <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('language')}</label>
                    <select 
                    value={settings.language}
                    onChange={(e) => setSettings({...settings, language: e.target.value as 'pt' | 'en'})}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                        <option value="pt">Português (Brasil)</option>
                        <option value="en">English</option>
                    </select>
                </div>
                <div>
                     <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('myProfile')}</label>
                     <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        {!isEditingProfile ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-black font-bold">
                                        {currentUser?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-900 dark:text-white">{currentUser?.name}</p>
                                        <p className="text-xs text-zinc-500">{currentUser?.email}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={startEditProfile}
                                    className="p-2 text-zinc-400 hover:text-primary-600 transition-colors"
                                    title={t('editProfile')}
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveProfile} className="space-y-3">
                                <div>
                                    <label className="text-xs text-zinc-500">{t('fullName')}</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.name}
                                        onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                        className="w-full px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500">{t('newPassword')} ({t('optional')})</label>
                                    <input 
                                        type="password" 
                                        value={profileForm.password}
                                        onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                                        className="w-full px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none"
                                        placeholder="••••••"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditingProfile(false)}
                                        className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
                                    >
                                        {t('cancelEdit')}
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 rounded flex items-center gap-1"
                                    >
                                        <Save size={12} /> {t('saveProfile')}
                                    </button>
                                </div>
                            </form>
                        )}
                     </div>
                </div>
             </div>
          </div>
          {/* Main Save Button for Language Settings */}
          <div className="px-6 pb-6 pt-2 flex justify-end border-t border-zinc-100 dark:border-zinc-800">
               <button
                onClick={handleSave}
                className="bg-zinc-800 dark:bg-zinc-100 text-white dark:text-black font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
               >
                {t('saveConfig')}
               </button>
          </div>
        </div>

        {/* --- ADMIN ONLY SECTION --- */}
        {isAdmin ? (
            <>
                {/* Companies & Categories Management */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Companies */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                            <Building2 size={18} className="text-indigo-600" />
                            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('manageCompanies')}</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text" placeholder={t('companyName')} required value={newCompany.name}
                                    onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                                    className="flex-1 p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                                />
                                <input 
                                    type="text" placeholder={t('prefix')} required value={newCompany.prefix} maxLength={5}
                                    onChange={e => setNewCompany({...newCompany, prefix: e.target.value})}
                                    className="w-20 p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 uppercase"
                                />
                                <button type="button" onClick={handleAddCompany} className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700"><Plus size={18}/></button>
                            </div>
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {companies.map(c => (
                                    <li key={c.id} className="flex justify-between items-center text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded group">
                                        <span>{c.name} <span className="text-xs font-mono text-zinc-400">({c.prefix})</span></span>
                                        <button type="button" onClick={() => handleDeleteCompany(c.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                            <Truck size={18} className="text-orange-600" />
                            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('manageCategories')}</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text" placeholder={t('categoryName')} required value={newCategory.name}
                                    onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                                    className="flex-1 p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                                />
                                <select 
                                    value={newCategory.fipeType}
                                    onChange={e => setNewCategory({...newCategory, fipeType: e.target.value})}
                                    className="w-24 p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                                >
                                    <option value="none">No FIPE</option>
                                    <option value="carros">Car</option>
                                    <option value="motos">Moto</option>
                                    <option value="caminhoes">Truck</option>
                                </select>
                                <button type="button" onClick={handleAddCategory} className="bg-orange-600 text-white p-2 rounded hover:bg-orange-700"><Plus size={18}/></button>
                            </div>
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {categories.map(c => (
                                    <li key={c.id} className="flex justify-between items-center text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded group">
                                        <span>{c.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1 rounded">{c.fipeType}</span>
                                            <button type="button" onClick={() => handleDeleteCategory(c.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            
                {/* --- SENSITIVE CONFIGURATIONS (API KEYS) --- */}
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-900/30">
                        <ShieldAlert size={20} />
                        <span className="text-sm font-semibold">Restricted Area: System Configuration</span>
                    </div>

                    {/* Plate API Section */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                        <Search size={18} className="text-pink-500" />
                        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('plateApiConfig')}</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('plateApiUrl')}</label>
                        <input
                            type="text"
                            value={settings.plateApiUrl || ''}
                            onChange={(e) => setSettings({ ...settings, plateApiUrl: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="https://api.brasilapi.com.br/v1/placas/{plate}"
                        />
                        <p className="text-xs text-zinc-400 mt-1">{t('plateApiUrlDesc')}</p>
                        </div>
                        <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('plateApiToken')}</label>
                        <input
                            type="password"
                            value={settings.plateApiToken || ''}
                            onChange={(e) => setSettings({ ...settings, plateApiToken: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        </div>
                    </div>
                    </div>

                    {/* Cloud Function / Proxy Settings */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                        <CloudLightning size={18} className="text-amber-500" />
                        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('proxyConfig')}</h2>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('cloudFunctionUrl')}</label>
                        <input
                        type="text"
                        value={settings.customProxyUrl || ''}
                        onChange={(e) => setSettings({ ...settings, customProxyUrl: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="https://us-central1-YOUR-PROJECT.cloudfunctions.net/proxyApi"
                        />
                        <p className="text-xs text-zinc-400 mt-1">{t('cloudFunctionDesc')}</p>
                    </div>
                    </div>
                    
                    {/* K-Tag API Section */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                        <Database size={18} className="text-blue-500" />
                        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('ktagConfig')}</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-full">
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('apiEndpoint')}</label>
                        <div className="flex items-center gap-2">
                            <input
                            type="text"
                            required
                            value={settings.ktagUrl}
                            onChange={(e) => setSettings({ ...settings, ktagUrl: e.target.value })}
                            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            placeholder="http://47.113.127.14:6176"
                            />
                            <Globe size={18} className="text-zinc-400" />
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{t('directIpDesc')}</p>
                        </div>

                        <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('username')}</label>
                        <input
                            type="text"
                            required
                            value={settings.ktagUser}
                            onChange={(e) => setSettings({ ...settings, ktagUser: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        </div>

                        <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('password')}</label>
                        <input
                            type="password"
                            required
                            value={settings.ktagPass}
                            onChange={(e) => setSettings({ ...settings, ktagPass: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        </div>
                    </div>
                    </div>

                    {/* Maps Section */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                        <Map size={18} className="text-green-500" />
                        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('mapProviders')}</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <Key size={14} className="text-zinc-400"/> {t('googleKey')}
                        </label>
                        <input
                            type="text"
                            value={settings.googleMapsKey}
                            onChange={(e) => setSettings({ ...settings, googleMapsKey: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        <p className="text-xs text-zinc-400 mt-1">{t('googleDesc')}</p>
                        </div>

                        <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <Key size={14} className="text-zinc-400"/> {t('mapboxKey')}
                        </label>
                        <input
                            type="text"
                            value={settings.mapboxKey}
                            onChange={(e) => setSettings({ ...settings, mapboxKey: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        </div>
                    </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                <Lock className="mx-auto text-zinc-400 mb-2" size={32} />
                <h3 className="text-zinc-900 dark:text-white font-semibold">System Configuration Locked</h3>
                <p className="text-zinc-500 text-sm mt-1">API settings and user management are restricted to administrators.</p>
            </div>
        )}
      </div>
    </div>
  );
};
