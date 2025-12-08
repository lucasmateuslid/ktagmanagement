
import React, { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { AppSettings, User, Company, VehicleCategory } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Save, Settings as SettingsIcon, Map, Database, Globe, Key, Languages, CloudLightning, Users, Check, X, Building2, Truck, Trash2, Plus } from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  
  // Form states for new items
  const [newCompany, setNewCompany] = useState({ name: '', prefix: '' });
  const [newCategory, setNewCategory] = useState({ name: '', fipeType: 'none' });

  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { language, setLanguage, t } = useLanguage();
  const { isAdmin } = useAuth();

  useEffect(() => {
    const load = async () => {
      const data = await storage.getSettings();
      setSettings(data);
      if (data.language) setLanguage(data.language);
      
      if (isAdmin) {
        const [allUsers, allCompanies, allCategories] = await Promise.all([
            storage.getAllUsers(),
            storage.getCompanies(),
            storage.getCategories()
        ]);
        setUsers(allUsers);
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
      await storage.saveSettings(settings);
      setLanguage(settings.language); 
      addNotification('success', t('savedSuccess'), 'Configuration updated successfully.');
    } catch (err) {
      addNotification('error', t('savedError'), 'Failed to save settings.');
    }
  };

  const handleUserAction = async (userId: string, action: 'approved' | 'rejected') => {
    await storage.updateUserStatus(userId, action);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: action } : u));
    addNotification('success', 'User Updated', `User has been ${action}.`);
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <SettingsIcon size={32} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('systemSettings')}</h1>
          <p className="text-zinc-500">{t('manageConfig')}</p>
        </div>
      </div>

      {/* Admin User Approval Section */}
      {isAdmin && (
        <>
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6 border-l-4 border-l-blue-500">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">User Access Management (Admin)</h2>
            </div>
            <div className="p-0">
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 uppercase">
                        <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">IP Address</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {users.filter(u => u.email !== 'lucasmateus.lima@outlook.com').map(user => (
                        <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="px-6 py-4 font-medium">{user.name}</td>
                            <td className="px-6 py-4">{user.email}</td>
                            <td className="px-6 py-4 font-mono text-xs">{user.ip || 'N/A'}</td>
                            <td className="px-6 py-4 text-xs text-zinc-500">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                user.status === 'approved' ? 'bg-green-100 text-green-700' :
                                user.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                                {user.status || 'Unknown'}
                            </span>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                            {user.status === 'pending' && (
                                <>
                                <button 
                                    onClick={() => handleUserAction(user.id, 'approved')}
                                    className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                                    title="Approve"
                                >
                                    <Check size={16} />
                                </button>
                                <button 
                                    onClick={() => handleUserAction(user.id, 'rejected')}
                                    className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                    title="Reject"
                                >
                                    <X size={16} />
                                </button>
                                </>
                            )}
                            {user.status !== 'pending' && (
                                <button 
                                onClick={() => handleUserAction(user.id, user.status === 'approved' ? 'rejected' : 'approved')}
                                className="text-xs text-blue-500 hover:underline"
                                >
                                Change
                                </button>
                            )}
                            </td>
                        </tr>
                        ))}
                        {users.length <= 1 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-zinc-500">No other users registered.</td>
                        </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
            </div>

            {/* Manage Companies & Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Companies */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
                        <Building2 size={18} className="text-indigo-600" />
                        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('manageCompanies')}</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <form onSubmit={handleAddCompany} className="flex gap-2">
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
                            <button type="submit" className="bg-indigo-600 text-white p-2 rounded"><Plus size={18}/></button>
                        </form>
                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {companies.map(c => (
                                <li key={c.id} className="flex justify-between items-center text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded">
                                    <span>{c.name} <span className="text-xs font-mono text-zinc-400">({c.prefix})</span></span>
                                    <button onClick={() => handleDeleteCompany(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
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
                        <form onSubmit={handleAddCategory} className="flex gap-2">
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
                            <button type="submit" className="bg-orange-600 text-white p-2 rounded"><Plus size={18}/></button>
                        </form>
                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {categories.map(c => (
                                <li key={c.id} className="flex justify-between items-center text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded">
                                    <span>{c.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1 rounded">{c.fipeType}</span>
                                        <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* General Settings */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
           <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
            <Languages size={18} className="text-purple-500" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">{t('generalSettings')}</h2>
          </div>
          <div className="p-6">
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

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-primary-500/30"
          >
            <Save size={20} /> {t('saveConfig')}
          </button>
        </div>
      </form>
    </div>
  );
};
