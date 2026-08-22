
import * as React from 'react';
import { useEffect, useState } from 'react';
import { storage } from '../../services/storage';
import { AppSettings, Company, VehicleCategory } from '../../types';
import { ConfirmModal } from '../ConfirmModal';
import { useNotification } from '../../contexts/NotificationContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Checkbox } from '../ui/checkbox';
import {
  Save, Settings as SettingsIcon, Database, Key,
  Trash2, Plus, ShieldAlert,
  Edit2, Building2, Server, Eye, EyeOff,
  LayoutGrid, Cpu, Cloud,
  Check,
  MapPin, ShoppingBag, AlertTriangle, Percent, X,
  Box, Palette,
  Bot, ChevronDown
} from 'lucide-react';

import { GeocodingConfigModule } from './GeocodingConfigModule';
import { WhitelabelModule } from './WhitelabelModule';
import { AiConfigModule } from './AiConfigModule';

// ------------------------------------------------------------------
// Catálogo de seções — fonte única para a sidebar interna e o painel.
// Cada item descreve o que aquela parte do sistema faz, pra reduzir o
// "muro de cards" e ajudar o usuário a achar a configuração que precisa.
// ------------------------------------------------------------------
type SectionId =
  | 'stock' | 'whitelabel' | 'ai' | 'geocoding'
  | 'ktag' | 'hinova' | 'proxy'
  | 'siterastreio' | 'melhorenvio' | 'regionais' | 'traqcare';

type SectionMeta = {
  id: SectionId;
  label: string;
  description: string;
  icon: any;
  color: string; // tailwind text color class
  group: 'Plataforma' | 'Integrações';
};

// Agrupado em escopo de módulo — não usa hook, evita Rules of Hooks com
// early-returns no componente.
function buildGroupedSections(sections: SectionMeta[]): Record<string, SectionMeta[]> {
  const g: Record<string, SectionMeta[]> = {};
  for (const s of sections) { (g[s.group] = g[s.group] || []).push(s); }
  return g;
}

const SECTIONS: SectionMeta[] = [
  { id: 'stock',        label: 'Estoque & Financeiro', description: 'Limites de alerta de estoque e margem mínima de aprovação de orçamentos.', icon: ShoppingBag,    color: 'text-amber-500',   group: 'Plataforma' },
  { id: 'whitelabel',   label: 'Whitelabel & Marca',   description: 'Nome do sistema, logos (claro/escuro) e paleta de cores aplicada em toda a interface.', icon: Palette,        color: 'text-indigo-500',  group: 'Plataforma' },
  { id: 'ai',           label: 'Inteligência Artificial', description: 'Provedor de IA do assistente K-Tag (Gemini, OpenAI, Claude, Groq, DeepSeek) e respectivas chaves.', icon: Bot,            color: 'text-purple-500',  group: 'Plataforma' },
  { id: 'geocoding',    label: 'Geocoding & Mapas',    description: 'Cadeia de fallback para resolver endereços (Photon / Nominatim / Google) e provedor de mapas.', icon: MapPin,         color: 'text-teal-500',    group: 'Plataforma' },
  { id: 'regionais',    label: 'Regionais & Categorias', description: 'Cadastro das regionais (empresas) atendidas e das categorias de veículos suportadas.', icon: LayoutGrid,     color: 'text-amber-500',   group: 'Plataforma' },

  { id: 'ktag',         label: 'API K-Tag',            description: 'Credenciais centralizadas e gerenciadas pela plataforma.', icon: Key,            color: 'text-primary-500', group: 'Integrações' },
  { id: 'hinova',       label: 'SGA Hinova',           description: 'Integração com o sistema de gestão associativista Hinova/SGA.', icon: Database,       color: 'text-emerald-500', group: 'Integrações' },
  { id: 'proxy',        label: 'Proxy & Relay',        description: 'Cloud Function que roteia as chamadas externas. Gerenciada pela plataforma.', icon: Cloud,          color: 'text-cyan-500',    group: 'Integrações' },
  { id: 'siterastreio', label: 'Site Rastreio',        description: 'API key da plataforma siterastreio.com.br usada para link de rastreamento público.', icon: Box,            color: 'text-orange-500',  group: 'Integrações' },
  { id: 'melhorenvio',  label: 'Melhor Envio',         description: 'OAuth, endereço remetente e catálogo de pacotes para emissão de etiquetas de envio.', icon: Box,            color: 'text-emerald-500', group: 'Integrações' },
  { id: 'traqcare',     label: 'API Traqcare (XADTAG)', description: 'Token de comunicação com dispositivos XADTAG via Traqcare.', icon: Cpu,            color: 'text-primary-500', group: 'Integrações' },
];

const SECTIONS_GROUPED = buildGroupedSections(SECTIONS);

// Calcula "configurado / incompleto / vazio" pra cada seção — pinta o ícone
// de status na sidebar sem o usuário precisar abrir cada uma.
function getSectionStatus(id: SectionId, s: AppSettings | null): 'ok' | 'partial' | 'empty' {
  if (!s) return 'empty';
  const has = (v: any) => v != null && String(v).trim() !== '';
  switch (id) {
    case 'stock':       return has(s.minStockLevel) && has(s.criticalStockLevel) ? 'ok' : 'partial';
    case 'whitelabel':  return has(s.customAppName) || has(s.customLogoUrlLight) || has((s as any).customLogoBase64Light) ? 'ok' : 'empty';
    case 'ai':          return has(s.aiProvider) ? 'ok' : 'empty';
    case 'geocoding':   return has(s.geocodingProvider) ? 'ok' : 'partial';
    case 'regionais':   return 'ok';
    case 'ktag':        return 'ok'; // gerenciada pela plataforma (server-side)
    case 'hinova':      return has(s.hinovaUrl) && has(s.hinovaToken) ? 'ok' : (has(s.hinovaUrl) ? 'partial' : 'empty');
    case 'proxy':       return has(s.customProxyUrl) ? 'ok' : 'empty';
    case 'siterastreio':return has(s.siteRastreioApiKey) ? 'ok' : 'empty';
    case 'melhorenvio': {
      const env = s.melhorEnvioEnvironment || 'sandbox';
      const tok = env === 'production' ? (s as any).melhorEnvioProdToken : (s as any).melhorEnvioSandboxToken;
      return has(tok) ? 'ok' : (has((s as any).melhorEnvioProdClientId) || has((s as any).melhorEnvioSandboxClientId) ? 'partial' : 'empty');
    }
    case 'traqcare':    return has(s.traqcareToken) ? 'ok' : 'empty';
    default:            return 'empty';
  }
}

const StatusDot: React.FC<{ status: 'ok' | 'partial' | 'empty' }> = ({ status }) => {
  const cls =
    status === 'ok' ? 'bg-emerald-500' :
    status === 'partial' ? 'bg-amber-500' :
    'bg-zinc-300 dark:bg-zinc-700';
  return <span className={`w-2 h-2 rounded-full ${cls} shrink-0`} aria-label={status} />;
};

// Banner usado em seções cujos valores vêm do super admin. Mantém o tom
// neutro do design (sem alarmes) — só sinaliza que o usuário não precisa
// preencher nada ali.
const PlatformManagedNote: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-amber-700 dark:text-amber-300">
    <ShieldAlert size={14} className="shrink-0 mt-0.5" />
    <div className="text-[11px] font-medium leading-relaxed">
      <span className="font-black uppercase tracking-widest text-[9px] block mb-1 text-amber-600 dark:text-amber-400">Gerenciado pela plataforma</span>
      {children || 'Esta configuração é definida pelo super administrador e usada por todos os tenants. Para alterar, fale com a equipe K-TAG.'}
    </div>
  </div>
);

// Campo somente-leitura com a aparência dos demais inputs.
const ReadOnlyField: React.FC<{ label: string; value: string; mono?: boolean; mask?: boolean }> = ({ label, value, mono, mask }) => {
  const shown = mask && value ? '•'.repeat(Math.min(24, Math.max(8, value.length))) : (value || '—');
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">{label}</label>
      <div className={`w-full px-5 py-4 bg-zinc-100/70 dark:bg-zinc-800/40 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl ${mono ? 'font-mono text-[11px]' : 'font-bold text-xs'} text-zinc-600 dark:text-zinc-300 select-all`}>
        {shown}
      </div>
    </div>
  );
};

// Cabeçalho consistente para cada seção (título + descrição + status).
const SectionHeader: React.FC<{ meta: SectionMeta; status: 'ok' | 'partial' | 'empty'; right?: React.ReactNode }> = ({ meta, status, right }) => {
  const Icon = meta.icon;
  const statusLabel = status === 'ok' ? 'Configurado' : status === 'partial' ? 'Incompleto' : 'Não configurado';
  const statusCls = status === 'ok'
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    : status === 'partial'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      : 'bg-zinc-500/5 text-zinc-500 border-zinc-300 dark:border-zinc-700';
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 mb-8 border-b border-zinc-100 dark:border-zinc-800">
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center shrink-0 ${meta.color}`}>
          <Icon size={22} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500">{meta.group}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusCls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'partial' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
              {statusLabel}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-display font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">{meta.label}</h2>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-1.5 max-w-2xl leading-relaxed">{meta.description}</p>
        </div>
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
};

export const SystemApisModule = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);

  const [newCompany, setNewCompany] = useState({ name: '', prefix: '', hasSgaIntegration: true });
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', fipeType: 'carros' as const });

  const [showHinovaToken, setShowHinovaToken] = useState(false);
  const [showHinovaPass, setShowHinovaPass] = useState(false);
  const [showKTagPass, setShowKTagPass] = useState(false);
  const [showTraqToken, setShowTraqToken] = useState(false);

  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { setLanguage } = useLanguage();
  const { isAdmin, user: currentUser } = useAuth();

  const [activeSection, setActiveSection] = useState<SectionId>('whitelabel');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const config = await storage.getSettings();
    setSettings(config);

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

    // Melhor Envio OAuth callback (preservado integralmente).
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
            body: JSON.stringify({ code, redirectUri })
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Erro ao trocar token');

          const newSettings = { ...currentSettings, melhorEnvioEnvironment: returnedEnv };
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
          setActiveSection('melhorenvio');
          addNotification('success', 'Sucesso', `Melhor Envio (${returnedEnv === 'production' ? 'Produção' : 'Sandbox'}) autorizado com sucesso!`);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error: any) {
          console.error('Exchange error:', error);
          addNotification('error', 'Falha na Autorização', error.message);
        }
      };
      exchangeToken();
    }
  }, [currentUser]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settings) return;
    try {
      await storage.saveSettings(settings);
      setLanguage(settings.language);
      storage.logAction(currentUser, 'CONFIG', 'Settings', 'Atualizou configurações globais do sistema');
      addNotification('success', 'Sucesso', 'Configurações salvas.');
      if ((window as any).google && (window as any).google.maps) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      addNotification('error', 'Erro', 'Falha ao salvar configurações.');
    }
  };

  const handleSaveCompany = async () => {
    if (!newCompany.name || !newCompany.prefix) return;
    const id = editingCompanyId || crypto.randomUUID();
    const company: Company = {
      id,
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
    setNewCompany({ name: c.name, prefix: c.prefix, hasSgaIntegration: c.hasSgaIntegration ?? true });
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

  const handleDeleteCompany = (id: string) => { setCompanyToDelete(id); setIsConfirmDeleteCompanyOpen(true); };
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
  const handleDeleteCategory = (id: string) => { setCategoryToDelete(id); setIsConfirmDeleteCategoryOpen(true); };
  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    await storage.deleteCategory(categoryToDelete);
    setCategories(categories.filter(c => c.id !== categoryToDelete));
    setIsConfirmDeleteCategoryOpen(false);
    setCategoryToDelete(null);
    addNotification('success', 'Sucesso', 'Categoria excluída.');
  };

  if (loading || !settings) return <div className="flex items-center justify-center h-full"><Cpu className="animate-spin text-primary-500" size={48} /></div>;

  const meta = SECTIONS.find(s => s.id === activeSection)!;
  const status = getSectionStatus(activeSection, settings);
  const grouped = SECTIONS_GROUPED;

  const renderSection = () => {
    switch (activeSection) {

      case 'stock':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Estoque Mínimo</label>
              <div className="relative">
                <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                <input type="number" disabled={!isAdmin} value={settings.minStockLevel || 80} onChange={e => setSettings({ ...settings, minStockLevel: parseInt(e.target.value) })} className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-amber-500 disabled:opacity-50" />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 ml-1">Nível de alerta para reposição preventiva.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Estoque Crítico</label>
              <div className="relative">
                <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={16} />
                <input type="number" disabled={!isAdmin} value={settings.criticalStockLevel || 40} onChange={e => setSettings({ ...settings, criticalStockLevel: parseInt(e.target.value) })} className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-red-500 disabled:opacity-50" />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 ml-1">Risco de ruptura — bloqueia novas reservas.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Margem de Lucro (%)</label>
              <div className="relative">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                <input type="number" disabled={!isAdmin} value={settings.budgetMarginThreshold || 25} onChange={e => setSettings({ ...settings, budgetMarginThreshold: parseFloat(e.target.value) })} className="w-full pl-11 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500 disabled:opacity-50" />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 ml-1">Limite mínimo para aprovação automática (padrão: 25%).</p>
            </div>
          </div>
        );

      case 'whitelabel':
        return <WhitelabelModule settings={settings} setSettings={setSettings} isAdmin={isAdmin} embedded />;

      case 'ai':
        return <AiConfigModule embedded />;

      case 'geocoding':
        return <GeocodingConfigModule settings={settings} setSettings={setSettings} isAdmin={isAdmin} embedded />;

      case 'ktag':
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-6 flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-primary-500/10 text-primary-500 shrink-0"><Key size={18} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Gerenciada pela plataforma</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                  As credenciais da API K-Tag (endpoint, usuário e senha) agora são
                  centralizadas e injetadas com segurança pelo servidor — não são mais
                  configuradas por empresa, e o navegador nunca recebe a senha. Para
                  dispositivos <strong>XADTAG</strong>, configure o token na seção Traqcare.
                </p>
              </div>
            </div>
          </div>
        );

      case 'hinova':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">URL do Endpoint SGA</label>
              <input type="text" disabled={!isAdmin} value={isAdmin ? settings.hinovaUrl : '••••••••••••••••'} onChange={e => setSettings({ ...settings, hinovaUrl: e.target.value })} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" placeholder="https://api.hinova.com.br/api/sga/v2" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Token SGA (Master)</label>
              <div className="relative">
                <input type={showHinovaToken ? 'text' : 'password'} disabled={!isAdmin} value={isAdmin ? settings.hinovaToken : '••••••••••••••••'} onChange={e => setSettings({ ...settings, hinovaToken: e.target.value })} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-emerald-500 pr-12 disabled:opacity-50" />
                {isAdmin && <button type="button" onClick={() => setShowHinovaToken(!showHinovaToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaToken ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Usuário de Autenticação</label>
                <input type="text" disabled={!isAdmin} value={isAdmin ? settings.hinovaUser : '••••••••••••••••'} onChange={e => setSettings({ ...settings, hinovaUser: e.target.value })} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Senha de Autenticação</label>
                <div className="relative">
                  <input type={showHinovaPass ? 'text' : 'password'} disabled={!isAdmin} value={isAdmin ? settings.hinovaPass : '••••••••••••••••'} onChange={e => setSettings({ ...settings, hinovaPass: e.target.value })} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs disabled:opacity-50" />
                  {isAdmin && <button type="button" onClick={() => setShowHinovaPass(!showHinovaPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showHinovaPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                </div>
              </div>
            </div>
          </div>
        );

      case 'proxy':
        return (
          <div className="space-y-6">
            <PlatformManagedNote>
              O proxy roteia todas as chamadas K-TAG e XADTAG entre os tenants e os servidores externos.
              Mantido centralizado para garantir consistência e evitar bloqueios de CORS.
            </PlatformManagedNote>
            <ReadOnlyField label="Proxy Cloud Function URL" value={settings.customProxyUrl || ''} mono />
          </div>
        );

      case 'siterastreio':
        return (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">API Key (siterastreio.com.br)</label>
            <div className="relative">
              <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input type="text" disabled={!isAdmin} value={isAdmin ? (settings.siteRastreioApiKey || '') : '••••••••••••••••'} onChange={e => setSettings({ ...settings, siteRastreioApiKey: e.target.value })} className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none disabled:opacity-50" placeholder="Sua API Key" />
            </div>
          </div>
        );

      case 'melhorenvio':
        return (
          <div className="space-y-6">
            <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 flex flex-col space-y-2">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">URL de Callback (Redirecionamento)</p>
              <code className="text-xs font-mono bg-white dark:bg-black p-2 rounded-lg text-zinc-600 dark:text-zinc-400 select-all border border-zinc-200 dark:border-zinc-800">
                {typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''}
              </code>
              <p className="text-[10px] text-zinc-500">Cadastre exatamente esta URL no seu painel do Melhor Envio.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Client ID ({settings.melhorEnvioEnvironment === 'production' ? 'Produção' : 'Sandbox'})</label>
                <div className="relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input type="text" disabled={!isAdmin}
                    value={isAdmin ? (settings.melhorEnvioEnvironment === 'production' ? (settings.melhorEnvioProdClientId || '') : (settings.melhorEnvioSandboxClientId || '')) : '•••'}
                    onChange={e => settings.melhorEnvioEnvironment === 'production' ? setSettings({ ...settings, melhorEnvioProdClientId: e.target.value }) : setSettings({ ...settings, melhorEnvioSandboxClientId: e.target.value })}
                    className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs outline-none disabled:opacity-50 focus:border-emerald-500" placeholder="ID do Aplicativo" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Client Secret ({settings.melhorEnvioEnvironment === 'production' ? 'Produção' : 'Sandbox'})</label>
                <div className="relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input type="password" disabled={!isAdmin}
                    value={isAdmin ? (settings.melhorEnvioEnvironment === 'production' ? (settings.melhorEnvioProdClientSecret || '') : (settings.melhorEnvioSandboxClientSecret || '')) : '•••'}
                    onChange={e => settings.melhorEnvioEnvironment === 'production' ? setSettings({ ...settings, melhorEnvioProdClientSecret: e.target.value }) : setSettings({ ...settings, melhorEnvioSandboxClientSecret: e.target.value })}
                    className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-xs outline-none disabled:opacity-50 focus:border-emerald-500" placeholder="Secret do Aplicativo" />
                </div>
              </div>
            </div>

            <div className="w-full md:w-1/3 space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Ambiente Ativo</label>
              <select disabled={!isAdmin} value={settings.melhorEnvioEnvironment || 'sandbox'} onChange={e => setSettings({ ...settings, melhorEnvioEnvironment: e.target.value as 'sandbox' | 'production' })} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold text-xs outline-none disabled:opacity-50 focus:border-emerald-500">
                <option value="sandbox">Sandbox (Testes)</option>
                <option value="production">Produção (Real)</option>
              </select>
            </div>

            {isAdmin && (
              <div className="w-full flex flex-col md:flex-row gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                {((settings.melhorEnvioEnvironment === 'production' && settings.melhorEnvioProdToken) || (settings.melhorEnvioEnvironment === 'sandbox' && settings.melhorEnvioSandboxToken)) && (
                  <button onClick={async () => {
                    try {
                      const env = settings.melhorEnvioEnvironment || 'sandbox';
                      const token = env === 'production' ? settings.melhorEnvioProdToken : settings.melhorEnvioSandboxToken;
                      const res = await fetch('/api/melhorenvio/companies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
                      addNotification('success', 'Conectado', `Encontrou ${data.length} transportadoras.`);
                    } catch (e: any) {
                      addNotification('error', 'Erro', e.message);
                    }
                  }} className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
                    Testar Conexão
                  </button>
                )}
                <button onClick={async () => {
                  const env = settings.melhorEnvioEnvironment || 'sandbox';
                  const clientId = env === 'production' ? settings.melhorEnvioProdClientId : settings.melhorEnvioSandboxClientId;
                  const clientSecret = env === 'production' ? settings.melhorEnvioProdClientSecret : settings.melhorEnvioSandboxClientSecret;
                  if (!clientId || !clientSecret) { addNotification('info', 'Atenção', 'Preencha Client ID e Secret antes de autorizar.'); return; }
                  await storage.saveSettings(settings);
                  const baseUrl = env === 'production' ? 'https://melhorenvio.com.br' : 'https://sandbox.melhorenvio.com.br';
                  const redirectUri = window.location.origin + window.location.pathname;
                  const authorizeUrl = `${baseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=melhorenvio_${env}&scope=shipping-calculate shipping-companies shipping-generate shipping-checkout shipping-print shipping-cancel shipping-tracking cart-read cart-write`;
                  window.open(authorizeUrl, '_blank');
                }} className="w-full flex-1 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-xl shadow-emerald-500/20 whitespace-nowrap">
                  Autorizar ({settings.melhorEnvioEnvironment === 'production' ? 'Produção' : 'Sandbox'})
                </button>
              </div>
            )}

            {/* SENDER ADDRESS */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
              <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Endereço Remetente Padrão</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { k: 'postalCode', label: 'CEP', col: 1, placeholder: '00000000', cleanNumber: true },
                  { k: 'street', label: 'Logradouro', col: 2, placeholder: 'Rua...' },
                  { k: 'number', label: 'Número', col: 1, placeholder: '123' },
                  { k: 'complement', label: 'Complemento', col: 1, placeholder: 'Sala 1' },
                  { k: 'neighborhood', label: 'Bairro', col: 1, placeholder: 'Centro' },
                  { k: 'city', label: 'Cidade', col: 1, placeholder: 'São Paulo' },
                  { k: 'state', label: 'UF', col: 1, placeholder: 'SP', upper: true, maxLength: 2 },
                  { k: 'document', label: 'Documento (CPF/CNPJ)', col: 2, placeholder: 'Apenas números', cleanNumber: true },
                  { k: 'name', label: 'Nome Remetente', col: 1, placeholder: 'Empresa XPTO' },
                  { k: 'phone', label: 'Telefone', col: 1, placeholder: 'Apenas números', cleanNumber: true },
                ].map(field => (
                  <div key={field.k} className={`space-y-2 ${field.col === 2 ? 'md:col-span-2' : ''}`}>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">{field.label}</label>
                    <input type="text" disabled={!isAdmin}
                      value={(settings.melhorEnvioSenderAddress as any)?.[field.k] || ''}
                      onChange={e => {
                        let v = e.target.value;
                        if ((field as any).cleanNumber) v = v.replace(/\D/g, '');
                        if ((field as any).upper) v = v.toUpperCase();
                        setSettings({ ...settings, melhorEnvioSenderAddress: { ...(settings.melhorEnvioSenderAddress as any), [field.k]: v } });
                      }}
                      maxLength={(field as any).maxLength}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs outline-none focus:border-emerald-500"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* PACOTES */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Pacotes Predefinidos</h3>
                {isAdmin && (
                  <button onClick={() => {
                    const newPackage = { id: Math.random().toString(36).substr(2, 9), name: 'Novo Pacote', weight: 0.3, width: 11, height: 2, length: 16, insuranceValue: 100 };
                    setSettings({ ...settings, melhorEnvioPackages: [...(settings.melhorEnvioPackages || []), newPackage] });
                  }} className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl text-xs font-bold transition-colors">
                    <Plus size={14} /> ADICIONAR
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {(settings.melhorEnvioPackages || []).map((pkg, idx) => (
                  <div key={pkg.id} className="grid grid-cols-2 md:grid-cols-7 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50 items-end">
                    <div className="col-span-2 md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Nome</label>
                      <input type="text" disabled={!isAdmin} value={pkg.name} onChange={e => { const np = [...(settings.melhorEnvioPackages || [])]; np[idx].name = e.target.value; setSettings({ ...settings, melhorEnvioPackages: np }); }} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Peso (kg)</label>
                      <input type="number" step="0.1" disabled={!isAdmin} value={pkg.weight} onChange={e => { const np = [...(settings.melhorEnvioPackages || [])]; np[idx].weight = parseFloat(e.target.value) || 0; setSettings({ ...settings, melhorEnvioPackages: np }); }} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">A x L x C (cm)</label>
                      <div className="flex gap-1">
                        <input type="number" disabled={!isAdmin} value={pkg.height} onChange={e => { const np = [...(settings.melhorEnvioPackages || [])]; np[idx].height = Number(e.target.value); setSettings({ ...settings, melhorEnvioPackages: np }); }} className="w-full flex-1 px-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-center outline-none focus:border-emerald-500" title="Altura" />
                        <input type="number" disabled={!isAdmin} value={pkg.width} onChange={e => { const np = [...(settings.melhorEnvioPackages || [])]; np[idx].width = Number(e.target.value); setSettings({ ...settings, melhorEnvioPackages: np }); }} className="w-full flex-1 px-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-center outline-none focus:border-emerald-500" title="Largura" />
                        <input type="number" disabled={!isAdmin} value={pkg.length} onChange={e => { const np = [...(settings.melhorEnvioPackages || [])]; np[idx].length = Number(e.target.value); setSettings({ ...settings, melhorEnvioPackages: np }); }} className="w-full flex-1 px-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-center outline-none focus:border-emerald-500" title="Comprimento" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Seguro (R$)</label>
                      <input type="number" disabled={!isAdmin} value={pkg.insuranceValue} onChange={e => { const np = [...(settings.melhorEnvioPackages || [])]; np[idx].insuranceValue = parseFloat(e.target.value) || 0; setSettings({ ...settings, melhorEnvioPackages: np }); }} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-emerald-500" />
                    </div>
                    <div className="col-span-2 md:col-span-1 flex justify-end">
                      {isAdmin && (
                        <button onClick={() => setSettings({ ...settings, melhorEnvioPackages: settings.melhorEnvioPackages?.filter(p => p.id !== pkg.id) })} className="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors flex items-center justify-center" title="Remover">
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
        );

      case 'regionais':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Building2 size={14} /> Regionais</h4>
              {isAdmin && (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-2">
                      <input type="text" placeholder="Nome" value={newCompany.name} onChange={e => setNewCompany({ ...newCompany, name: e.target.value })} className="flex-1 min-w-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold" />
                      <input type="text" placeholder="ID" maxLength={4} value={newCompany.prefix} onChange={e => setNewCompany({ ...newCompany, prefix: e.target.value.toUpperCase() })} className="w-16 shrink-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-center" />
                    </div>
                    <div className="flex gap-1">
                      {editingCompanyId && (
                        <button onClick={handleCancelEdit} className="p-3.5 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0"><X size={18} strokeWidth={3} /></button>
                      )}
                      <button onClick={handleSaveCompany} className={`p-3.5 ${editingCompanyId ? 'bg-emerald-500 text-white' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black'} rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0`}>
                        {editingCompanyId ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2 pt-2">
                    <Checkbox checked={newCompany.hasSgaIntegration} onChange={checked => setNewCompany({ ...newCompany, hasSgaIntegration: checked })}>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Integração com SGA Ativa</span>
                    </Checkbox>
                  </div>
                </>
              )}
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                {companies.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl group">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-tight truncate">{c.prefix} - {c.name}</span>
                      <span className={`text-[9px] font-bold ${c.hasSgaIntegration === false ? 'text-amber-500' : 'text-emerald-500'}`}>{c.hasSgaIntegration === false ? 'Sem Integração SGA' : 'Integrado ao SGA'}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0">
                        <button onClick={() => handleStartEditCompany(c)} className="p-1.5 text-zinc-300 hover:text-primary-500"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteCompany(c.id)} className="p-1.5 text-zinc-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest"><Server size={14} /> Categorias de Veículo</h4>
              {isAdmin && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Ex: Caminhão" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} className="flex-1 min-w-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold" />
                  <button onClick={handleAddCategory} className="p-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl hover:scale-105 active:scale-95 transition-all shrink-0"><Plus size={18} strokeWidth={3} /></button>
                </div>
              )}
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl group">
                    <span className="text-[10px] font-black uppercase tracking-tight truncate">{cat.name}</span>
                    {isAdmin && <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-zinc-300 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'traqcare':
        return (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Token da API Traqcare</label>
            <div className="relative">
              <input type={showTraqToken ? 'text' : 'password'} disabled={!isAdmin} value={isAdmin ? settings.traqcareToken : '••••••••••••••••'} onChange={e => setSettings({ ...settings, traqcareToken: e.target.value })} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-mono text-[10px] outline-none focus:border-primary-500 pr-12 disabled:opacity-50" />
              {isAdmin && <button type="button" onClick={() => setShowTraqToken(!showTraqToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">{showTraqToken ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight mt-2">Token de ambiente necessário para comunicação com dispositivos XADTAG.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-32 font-sans">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-8 mb-8">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[28px] bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-primary-500 border border-zinc-800 shadow-2xl shrink-0">
            <SettingsIcon size={24} className="md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Sistema & APIs</h1>
            <p className="text-zinc-500 mt-1 md:mt-2 font-medium text-xs md:text-base">Plataforma, integrações e credenciais de terceiros.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={handleSaveSettings} className="w-full md:w-auto bg-primary-500 hover:bg-primary-400 text-black px-10 py-4 rounded-[20px] flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all active:scale-95">
            <Save size={18} /> Salvar Tudo
          </button>
        )}
      </div>

      {/* MOBILE: dropdown trigger */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setMobileNavOpen(o => !o)}
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between"
        >
          <span className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center ${meta.color}`}>
              <meta.icon size={16} />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">{meta.label}</span>
          </span>
          <ChevronDown size={16} className={`text-zinc-400 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileNavOpen && (
          <div className="mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {SECTIONS.filter(s => s.id !== 'ktag' || isAdmin).map(s => {
              const Icon = s.icon;
              const st = getSectionStatus(s.id, settings);
              const isActive = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveSection(s.id); setMobileNavOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${isActive ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                >
                  <Icon size={16} className={s.color} />
                  <span className="flex-1 text-xs font-bold uppercase tracking-tight">{s.label}</span>
                  <StatusDot status={st} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 lg:gap-8">

        {/* SIDEBAR INTERNA */}
        <aside className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-5 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar shadow-sm">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-6 last:mb-0">
              <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500 px-3 mb-3">{group}</h4>
              <div className="space-y-1">
                {items.filter(s => !['ktag', 'ai'].includes(s.id) || isAdmin).map(s => {
                  const Icon = s.icon;
                  const st = getSectionStatus(s.id, settings);
                  const isActive = s.id === activeSection;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={`w-full relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group border ${
                        isActive
                          ? 'bg-primary-500/10 dark:bg-primary-500/[0.08] text-primary-600 dark:text-primary-400 border-primary-500/20'
                          : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                      title={s.description}
                    >
                      {isActive && (
                        <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary-500" />
                      )}
                      <Icon size={15} className={isActive ? 'text-primary-500' : s.color} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="flex-1 text-[10px] font-black uppercase tracking-widest truncate">{s.label}</span>
                      <StatusDot status={st} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* PAINEL ATIVO */}
        <section className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm min-h-[60vh]">
          <SectionHeader meta={meta} status={status} />
          {renderSection()}
        </section>
      </div>

      {/* MODAIS */}
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
