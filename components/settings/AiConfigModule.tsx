import React, { useState, useEffect } from 'react';
import { Bot, Save, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { storage } from '../../services/storage';
import { AppSettings } from '../../types';

export const AiConfigModule = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    storage.getSettings().then(s => setSettings(s));
  }, []);

  if (!settings) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await storage.saveSettings(settings);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const providers = [
    { id: 'gemini', name: 'Google Gemini', keyConfig: 'geminiApiKey', recommended: true },
    { id: 'openai', name: 'OpenAI (ChatGPT)', keyConfig: 'openAiApiKey' },
    { id: 'anthropic', name: 'Anthropic (Claude)', keyConfig: 'anthropicApiKey' },
    { id: 'groq', name: 'Groq (LLaMA/Mixtral)', keyConfig: 'groqApiKey' },
    { id: 'deepseek', name: 'DeepSeek', keyConfig: 'deepseekApiKey' },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3 text-emerald-500">
          <Bot size={24} />
          <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">Provedores de Inteligência Artificial</h2>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-emerald-600 transition-colors"
        >
          {isSaving ? 'Salvando...' : saved ? <><CheckCircle2 size={14}/> Salvo</> : <><Save size={14}/> Salvar</>}
        </button>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
          A assistente K-Tag AI Admin precisa de uma chave de API para funcionar. Se a chave padrão do sistema estiver falhando por excesso de uso, você pode configurar provedores alternativos abaixo e selecionar qual deseja usar.
        </p>
        
        <div className="space-y-2 mt-4">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Provedor Ativo</label>
            <select
              value={settings.aiProvider || 'gemini'}
              onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as any })}
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none font-bold text-xs"
            >
              {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.recommended ? '(Recomendado)' : ''}</option>
              ))}
            </select>
        </div>

        <div className="space-y-3 mt-6">
            <h3 className="text-xs font-black uppercase text-zinc-400 mt-6 mb-2">Chaves de API</h3>
            {providers.map((p) => (
                <div key={p.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                            {p.name} API Key {p.id === settings.aiProvider ? <span className="text-emerald-500 ml-2">(ATIVO)</span> : ''}
                        </label>
                    </div>
                    <div className="relative">
                        <input 
                            type={showKeys[p.id] ? 'text' : 'password'} 
                            value={(settings as any)[p.keyConfig] || ''} 
                            onChange={e => setSettings({ ...settings, [p.keyConfig]: e.target.value })} 
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-[10px] outline-none focus:border-emerald-500 pr-10" 
                            placeholder={`Insira sua chave da API do ${p.name}...`}
                        />
                        <button type="button" onClick={() => toggleShowKey(p.id)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-500 transition-colors">
                            {showKeys[p.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
