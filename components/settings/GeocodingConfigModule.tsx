import React, { useState, useEffect } from 'react';
import { MapPin, GripVertical, Eye, EyeOff, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { AppSettings, GeocoderPreferences } from '../../types';

interface Props {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  isAdmin: boolean;
}

const PROVIDER_NAMES: Record<string, string> = {
  geoapify: 'Geoapify',
  here: 'HERE Maps',
  photon: 'Photon (Gratuito)',
  google_maps: 'Google Maps',
  radar: 'Radar.io',
  openstreetmap: 'OpenStreetMap (Gratuito)'
};

const PROVIDER_NEEDS_KEY: Record<string, boolean> = {
  geoapify: true,
  here: true,
  photon: false,
  google_maps: true,
  radar: true,
  openstreetmap: false
};

const DEFAULT_PREFS: GeocoderPreferences = {
  priority_order: ['geoapify', 'here', 'photon', 'google_maps', 'radar', 'openstreetmap'],
  providers: {
    geoapify: { enabled: false, api_key: null },
    here: { enabled: false, api_key: null },
    photon: { enabled: true, api_key: null },
    google_maps: { enabled: false, api_key: null },
    radar: { enabled: false, api_key: null },
    openstreetmap: { enabled: true, api_key: null }
  },
  confidence_threshold: 0.7,
  fallback_on_empty: true,
  fallback_on_low_confidence: true,
  country_filter: 'br',
  default_language: 'pt'
};

export const GeocodingConfigModule: React.FC<Props> = ({ settings, setSettings, isAdmin }) => {
  const [prefs, setPrefs] = useState<GeocoderPreferences>(DEFAULT_PREFS);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, 'null' | 'testing' | 'success' | 'failed'>>({});

  useEffect(() => {
    if (settings.geocoderPreferences) {
      setPrefs(settings.geocoderPreferences);
    } else {
      // Migrate old defaults
      const migrated = JSON.parse(JSON.stringify(DEFAULT_PREFS));
      if (settings.googleMapsKey) {
        migrated.providers.google_maps.api_key = settings.googleMapsKey;
      }
      setPrefs(migrated);
    }
  }, [settings.geocoderPreferences, settings.googleMapsKey]);

  const savePrefs = (newPrefs: GeocoderPreferences) => {
    setPrefs(newPrefs);
    setSettings({ ...settings, geocoderPreferences: newPrefs });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isAdmin) return;
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!isAdmin || draggedIdx === null || draggedIdx === index) return;
    
    const newOrder = [...prefs.priority_order];
    const draggedItem = newOrder[draggedIdx];
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(index, 0, draggedItem);
    
    setDraggedIdx(index);
    setPrefs({ ...prefs, priority_order: newOrder });
  };

  const handleDragEnd = () => {
    if (!isAdmin) return;
    setDraggedIdx(null);
    savePrefs(prefs);
  };

  const toggleProvider = (key: string) => {
    if (!isAdmin) return;
    const newPrefs = { ...prefs };
    newPrefs.providers[key].enabled = !newPrefs.providers[key].enabled;
    savePrefs(newPrefs);
  };

  const updateApiKey = (key: string, val: string) => {
    if (!isAdmin) return;
    const newPrefs = { ...prefs };
    newPrefs.providers[key].api_key = val;
    savePrefs(newPrefs);
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    if (!isAdmin) return;
    if (confirm("Deseja restaurar as configurações padrão?")) {
      savePrefs(DEFAULT_PREFS);
    }
  };

  const testConnection = async (provider: string) => {
    if (!isAdmin) return;
    
    setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));
    try {
      const p = { ...DEFAULT_PREFS, priority_order: [provider], providers: { [provider]: prefs.providers[provider] } };
      p.providers[provider].enabled = true;
      
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: 'Av Paulista', geocoderPreferences: p })
      });
      const data = await res.json();
      
      if (res.ok && data.result) {
        setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
      } else {
        setTestStatus(prev => ({ ...prev, [provider]: 'failed' }));
      }
    } catch (e) {
      setTestStatus(prev => ({ ...prev, [provider]: 'failed' }));
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3 text-indigo-500">
          <MapPin size={24} />
          <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Geocodificação e Mapas (Multi-Provider)</h2>
        </div>
        {isAdmin && (
           <button onClick={handleReset} className="text-[10px] uppercase font-black tracking-wider px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Resetar Padrão
           </button>
        )}
      </div>
      
      <p className="text-xs text-zinc-500 leading-relaxed font-medium">
        Configure a ordem de prioridade dos serviços de busca de endereços arrastando os itens.
        O sistema tentará automaticamente o próximo na lista caso o anterior falhe.
      </p>

      <div className="space-y-4 pt-2">
        {prefs.priority_order.map((providerKey, index) => {
          const config = prefs.providers[providerKey] || { enabled: false, api_key: '' };
          const needsKey = PROVIDER_NEEDS_KEY[providerKey];
          const isEnabled = config.enabled;
          const status = testStatus[providerKey];

          return (
            <div 
              key={providerKey}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-all duration-200 ${draggedIdx === index ? 'opacity-50 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'} ${!isEnabled && 'opacity-60 grayscale-[0.5]'}`}
            >
              <div className="flex items-center gap-4 min-w-[200px]">
                <div className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing text-zinc-400">
                   <GripVertical size={20} />
                   <span className="text-[9px] font-black">{index + 1}º</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleProvider(providerKey)}
                    disabled={!isAdmin}
                    className={`w-10 h-6 rounded-full transition-colors relative ${isEnabled ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isEnabled ? 'left-5' : 'left-1'}`}/>
                  </button>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-tight">
                    {PROVIDER_NAMES[providerKey]}
                  </label>
                </div>
              </div>

              {needsKey ? (
                <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full">
                    <input 
                      type={showKeys[providerKey] ? 'text' : 'password'} 
                      disabled={!isAdmin}
                      value={isAdmin ? (config.api_key || '') : '••••••••••••••••'} 
                      onChange={e => updateApiKey(providerKey, e.target.value)} 
                      className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-[10px] outline-none focus:border-indigo-500 pr-10 disabled:opacity-50" 
                      placeholder="API Key..."
                    />
                    {isAdmin && (
                      <button type="button" onClick={() => toggleShowKey(providerKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                        {showKeys[providerKey] ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    )}
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={() => testConnection(providerKey)}
                      className="shrink-0 w-full sm:w-auto h-10 px-4 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Testar
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-2">Autenticação não requerida.</p>
                </div>
              )}

              <div className="w-full md:w-24 shrink-0 flex items-center justify-end">
                {status === 'testing' && <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Testando...</span>}
                {status === 'success' && <div className="flex items-center gap-1 text-emerald-500"><CheckCircle2 size={16} /><span className="text-[10px] font-black uppercase">OK</span></div>}
                {status === 'failed' && <div className="flex items-center gap-1 text-red-500"><AlertCircle size={16} /><span className="text-[10px] font-black uppercase">Falhou</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
