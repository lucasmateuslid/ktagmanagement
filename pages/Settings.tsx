import React, { useState } from 'react';
import {
  ShieldCheck, Users, ChevronLeft, ChevronRight,
  UserCircle, Sliders, Bell, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SystemApisModule } from '../components/settings/SystemApisModule';
import { ProfileModule } from '../components/settings/ProfileModule';
import { PermissionsModule } from '../components/settings/PermissionsModule';
import { AnnouncementModule } from '../components/settings/AnnouncementModule';
import { Users as UsersModule } from './Users';
import { motion } from 'framer-motion';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

type ModuleId = 'profile' | 'system' | 'roles' | 'users' | 'announcement';

// Catálogo de cards — pinta os submódulos da home de Preferências. Cada item
// declara a permissão necessária e a microcopy explicando o que ali se faz.
type CardSpec = {
  id: ModuleId;
  title: string;
  description: string;
  icon: any; // LucideIcon — usar any evita briga com WeakValidationMap legacy
  perm?: string; // sem perm = sempre visível (ex.: perfil pessoal)
  accent: 'blue' | 'zinc' | 'orange' | 'emerald' | 'primary';
  size?: 'sm' | 'md' | 'lg';
};

const CARDS: CardSpec[] = [
  {
    id: 'profile',
    title: 'Meu Perfil',
    description: 'Dados pessoais, senha, avatar e preferências de notificação.',
    icon: UserCircle,
    accent: 'blue',
    size: 'lg',
  },
  {
    id: 'system',
    title: 'Sistema & APIs',
    description: 'Integrações (K-Tag, Hinova, WhatsApp, Melhor Envio), whitelabel, IA, geocoding, regionais e estoque.',
    icon: Sliders,
    perm: PERMISSIONS.SETTINGS_MODULE_SYSTEM,
    accent: 'zinc',
    size: 'lg',
  },
  {
    id: 'announcement',
    title: 'Alertas do Sistema',
    description: 'Dispara anúncios globais que aparecem para os usuários da plataforma.',
    icon: Bell,
    perm: PERMISSIONS.SETTINGS_MODULE_ANNOUNCEMENT,
    accent: 'orange',
    size: 'md',
  },
  {
    id: 'roles',
    title: 'Acessos & Permissões',
    description: 'Crie cargos customizados e defina exatamente o que cada um pode acessar (matriz RBAC).',
    icon: ShieldCheck,
    perm: PERMISSIONS.SETTINGS_MODULE_ROLES,
    accent: 'emerald',
    size: 'lg',
  },
  {
    id: 'users',
    title: 'Usuários',
    description: 'Aprove novos cadastros, atribua cargos e gerencie os usuários da plataforma.',
    icon: Users,
    perm: PERMISSIONS.SETTINGS_MODULE_USERS,
    accent: 'primary',
    size: 'md',
  },
];

const ACCENT_STYLES: Record<CardSpec['accent'], {
  bg: string; iconBg: string; iconText: string; title: string; desc: string; chevron: string; hoverBorder: string;
}> = {
  blue:    { bg: 'bg-white dark:bg-zinc-900',  iconBg: 'bg-blue-50 dark:bg-blue-500/10',     iconText: 'text-blue-500',    title: 'text-zinc-900 dark:text-white', desc: 'text-zinc-500',     chevron: 'text-zinc-400', hoverBorder: 'hover:border-blue-500/50 hover:shadow-blue-500/10' },
  zinc:    { bg: 'bg-white dark:bg-zinc-900',  iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconText: 'text-zinc-600 dark:text-zinc-300', title: 'text-zinc-900 dark:text-white', desc: 'text-zinc-500', chevron: 'text-zinc-400', hoverBorder: 'hover:border-primary-500/50 hover:shadow-primary-500/10' },
  orange:  { bg: 'bg-orange-500',              iconBg: 'bg-white/20',                        iconText: 'text-white',       title: 'text-white',                    desc: 'text-white/80',     chevron: 'text-white/70', hoverBorder: 'hover:bg-orange-600' },
  emerald: { bg: 'bg-white dark:bg-zinc-900',  iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconText: 'text-emerald-500', title: 'text-zinc-900 dark:text-white', desc: 'text-zinc-500',   chevron: 'text-zinc-400', hoverBorder: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10' },
  primary: { bg: 'bg-primary-500 dark:bg-primary-600', iconBg: 'bg-white/20',                 iconText: 'text-white',       title: 'text-white',                    desc: 'text-white/80',     chevron: 'text-white/70', hoverBorder: 'hover:bg-primary-600 dark:hover:bg-primary-700' },
};

const SIZE_CLASSES: Record<NonNullable<CardSpec['size']>, string> = {
  sm: 'md:col-span-1 lg:col-span-2',
  md: 'md:col-span-1 lg:col-span-2',
  lg: 'md:col-span-2 lg:col-span-2',
};

export const Settings = () => {
  const { user, customRoles } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);

  const visibleCards = CARDS.filter(card => !card.perm || hasPermission(user, customRoles || [], card.perm));

  // Tela interna do submódulo — substitui a home enquanto um módulo está aberto.
  if (activeModule) {
    const active = CARDS.find(c => c.id === activeModule)!;
    const allowed = !active.perm || hasPermission(user, customRoles || [], active.perm);

    return (
      <div className="h-full flex flex-col pt-10 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <button
          onClick={() => setActiveModule(null)}
          className="flex items-center gap-2 text-zinc-500 hover:text-primary-500 font-black uppercase text-[10px] tracking-widest mb-6 transition-colors w-fit"
        >
          <ChevronLeft size={16} /> Voltar para Preferências
        </button>

        <div className="flex-1 overflow-y-auto pb-8">
          {!allowed ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Lock size={48} className="text-amber-500 mb-4" />
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Acesso Restrito</h2>
              <p className="text-zinc-500 mt-2 text-sm max-w-md">Você não tem permissão para acessar este módulo. Solicite ao administrador.</p>
            </div>
          ) : (
            <>
              {activeModule === 'profile' && <ProfileModule />}
              {activeModule === 'system' && <SystemApisModule />}
              {activeModule === 'roles' && <PermissionsModule />}
              {activeModule === 'announcement' && <AnnouncementModule />}
              {activeModule === 'users' && (
                <div className="h-full overflow-y-auto">
                  <UsersModule />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-10 px-4 md:px-8 max-w-7xl mx-auto w-full pb-20">
      <div className="mb-12">
        <h1 className="text-3xl md:text-5xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Preferências</h1>
        <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 max-w-2xl text-sm md:text-base">
          Gerencie sua conta, configurações da plataforma e quem pode acessar o quê. Você vê abaixo apenas os submódulos liberados para o seu cargo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {visibleCards.map(card => {
          const accent = ACCENT_STYLES[card.accent];
          const Icon = card.icon;
          return (
            <motion.button
              key={card.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveModule(card.id)}
              className={`text-left ${accent.bg} ${accent.hoverBorder} border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm cursor-pointer transition-all flex flex-col justify-between group ${SIZE_CLASSES[card.size || 'md']} min-h-[180px]`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 ${accent.iconBg} ${accent.iconText} rounded-2xl flex items-center justify-center`}>
                  <Icon size={28} />
                </div>
                <div className={`w-8 h-8 rounded-full ${card.accent === 'orange' || card.accent === 'primary' ? 'bg-white/10' : 'bg-zinc-100 dark:bg-zinc-800'} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <ChevronRight size={16} className={accent.chevron} />
                </div>
              </div>
              <div>
                <h2 className={`text-xl font-black uppercase ${accent.title} tracking-tight mb-2`}>{card.title}</h2>
                <p className={`text-xs ${accent.desc} font-medium leading-relaxed`}>{card.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
