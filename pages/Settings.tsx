
import React, { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { AppSettings } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Save, Settings as SettingsIcon, Map, Database, Globe, Key, Languages, CloudLightning } from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const load = async () => {
      const data = await storage.getSettings();
      setSettings(data);
      if (data.language) setLanguage(data.language);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      await storage.saveSettings(settings);
      setLanguage(settings.language); // Update context immediately
      addNotification('success', t('savedSuccess'), 'Configuration updated successfully.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      addNotification('error', t('savedError'), 'Failed to save settings.');
    }
  };

  if (loading || !settings) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <SettingsIcon size={32} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('systemSettings')}</h1>
          <p className="text-slate-500">{t('manageConfig')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* General Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
           <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Languages size={18} className="text-purple-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('generalSettings')}</h2>
          </div>
          <div className="p-6">
             <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('language')}</label>
             <select 
               value={settings.language}
               onChange={(e) => setSettings({...settings, language: e.target.value as 'pt' | 'en'})}
               className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
             >
                <option value="pt">Português (Brasil)</option>
                <option value="en">English</option>
             </select>
          </div>
        </div>

        {/* Cloud Function / Proxy Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <CloudLightning size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('proxyConfig')}</h2>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('cloudFunctionUrl')}</label>
            <input
              type="text"
              value={settings.customProxyUrl || ''}
              onChange={(e) => setSettings({ ...settings, customProxyUrl: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="https://us-central1-YOUR-PROJECT.cloudfunctions.net/proxyApi"
            />
            <p className="text-xs text-slate-400 mt-1">{t('cloudFunctionDesc')}</p>
          </div>
        </div>
        
        {/* K-Tag API Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Database size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('ktagConfig')}</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('apiEndpoint')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={settings.ktagUrl}
                  onChange={(e) => setSettings({ ...settings, ktagUrl: e.target.value })}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="http://47.113.127.14:6176"
                />
                <Globe size={18} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-400 mt-1">{t('directIpDesc')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('username')}</label>
              <input
                type="text"
                required
                value={settings.ktagUser}
                onChange={(e) => setSettings({ ...settings, ktagUser: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('password')}</label>
              <input
                type="password"
                required
                value={settings.ktagPass}
                onChange={(e) => setSettings({ ...settings, ktagPass: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Maps Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
            <Map size={18} className="text-green-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('mapProviders')}</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Key size={14} className="text-slate-400"/> {t('googleKey')}
              </label>
              <input
                type="text"
                value={settings.googleMapsKey}
                onChange={(e) => setSettings({ ...settings, googleMapsKey: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">{t('googleDesc')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Key size={14} className="text-slate-400"/> {t('mapboxKey')}
              </label>
              <input
                type="text"
                value={settings.mapboxKey}
                onChange={(e) => setSettings({ ...settings, mapboxKey: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none"
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
