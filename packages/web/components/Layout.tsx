
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { AiAssistant } from './AiAssistant';
import { pushService } from '../services/pushService'; 
import { ChangelogModal } from './ChangelogModal'; // Import Changelog
import { hasPermission } from '../utils/permissions';
import { buildTenantHref } from '../utils/tenant';
import {
  LayoutGrid, Map, ShieldAlert, Tags, CarFront, FileText,
  Users, ClipboardList, Settings, Menu, LogOut, Sun, Moon,
  Bell, CheckCircle2, UserCircle, Calendar, Wrench, Plus,
  ChevronLeft, ChevronRight, X, AlertTriangle, ShieldCheck,
  Crown, Briefcase, User as UserIcon, Wallet, MessageSquare, Megaphone, MapPin,
  Home, Package, Receipt, Building2, Boxes, Satellite
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { AvatarSelector } from './AvatarSelector';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { storage } from '../services/storage';

const MotionDiv = motion.div as any;

// === Animações para a Sidebar (Prompt 1) ===
const sidebarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
};

const NavSection = ({ section, isCollapsed, location, setIsSidebarOpen }: any) => {
  const [isOpen, setIsOpen] = useState(true);
  
  const hasActiveItem = section.items.some((item: any) => location.pathname === item.path);

  // Mantém aberto se tiver item ativo (opcional, pode só iniciar aberto)
  useEffect(() => {
    if (hasActiveItem) setIsOpen(true);
  }, [hasActiveItem]);

  return (
    <motion.div variants={itemVariants} className="px-3 mb-2">
      {/* SECTION HEADER (Submenu Toggle) */}
      {!isCollapsed ? (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors group cursor-pointer"
        >
          <span>{section.title}</span>
          <ChevronRight size={14} className={`transition-transform duration-200 opacity-50 group-hover:opacity-100 ${isOpen ? 'rotate-90' : ''}`} />
        </button>
      ) : (
        <div className="flex justify-center py-2">
           <div className="w-4 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
        </div>
      )}

      {/* ITEMS */}
      <AnimatePresence initial={false}>
        {(isOpen || isCollapsed) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-1 overflow-hidden"
          >
            {section.items.map((item: any) => {
              const isActive = location.pathname === item.path;
              if (item.disabled) {
                return (
                  <div 
                    key={item.path} 
                    className={`group flex items-center rounded-xl px-3 py-2.5 transition-all relative text-zinc-400 dark:text-zinc-600 opacity-50 cursor-not-allowed ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.label : 'Acesso bloqueado pendente de resolução K-TAG'}
                  >
                    <span className={`shrink-0 ${isCollapsed ? '' : 'mr-3'} flex items-center justify-center`}>
                       <item.icon size={18} strokeWidth={2} />
                    </span>
                    {!isCollapsed && <span className="text-xs line-through">{item.label}</span>}
                  </div>
                )
              }
              return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group flex items-center rounded-xl px-3 py-2.5 transition-all relative ${
                    isActive 
                      ? 'bg-primary-500/5 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold' 
                      : 'text-zinc-500 hover:bg-primary-500/5 dark:hover:bg-primary-500/5 hover:text-primary-600 dark:hover:text-primary-400 font-medium'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.label : ''}
                >
                  <span className={`shrink-0 ${isCollapsed ? '' : 'mr-3'} flex items-center justify-center`}>
                     <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  
                  {!isCollapsed && (
                    <span className="text-xs">{item.label}</span>
                  )}

                  {!isCollapsed && (
                     <ChevronRight className={`ml-auto h-4 w-4 transition-opacity ${isActive ? 'opacity-100 text-primary-500' : 'opacity-0 group-hover:opacity-100'}`} />
                  )}
                </Link>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, customRoles, logout, isAdmin, updateProfile, memberships, isGlobalAdmin } = useAuth();
  const { tenantId, enabledModules } = useTenant();
  // Identidade unificada: oferece troca de empresa quando o usuário tem mais de
  // um vínculo (ou é super admin). Cada item navega para o subdomínio do tenant.
  const otherMemberships = memberships.filter((m) => m.tenantId !== tenantId);
  const canSwitch = otherMemberships.length > 0 || isGlobalAdmin;
  const { theme, toggleTheme } = useTheme();
  const { notifications, activeToast, criticalAlerts, markAsRead, clearAll, closeToast, addNotification } = useNotification();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false); // Novo estado para menu do cliente
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false); // State for Changelog
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
  const [tagReviewState, setTagReviewState] = useState({ remindCount: 0, hideUntil: 0, urgentPendingUntil: 0 });
  const [now, setNow] = useState(Date.now());
  const [vehiclesReview, setVehiclesReview] = useState<any[]>([]);

  useEffect(() => {
     const saved = localStorage.getItem('ktag_tag_review_state');
     if (saved) {
        try { setTagReviewState(JSON.parse(saved)); } catch(e) {}
     }
     const interval = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(interval);
  }, []);

  const saveTagReviewState = (newState: Partial<typeof tagReviewState>) => {
     const next = { ...tagReviewState, ...newState };
     setTagReviewState(next);
     localStorage.setItem('ktag_tag_review_state', JSON.stringify(next));
  };
  const [appSettings, setAppSettings] = useState<any>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isExempt = isAdmin || user?.role === 'admin_tecnico' || user?.exemptFromKtagAlert;
  const isUrgentPending = vehiclesReview.length > 0 && tagReviewState.urgentPendingUntil > now && !isExempt;
  const isHidden = tagReviewState.hideUntil > now || isExempt;
  // If count >= 3, they don't get the option to "Lembrar Depois" (which means wait, it should just force them to fix it. If they reach 3 delays, the next time the modal shows, there is no hide).
  const showReviewModal = vehiclesReview.length > 0 && !isUrgentPending && !isHidden;
  const isLockedMode = isUrgentPending;

  useEffect(() => {
      if (isLockedMode && location.pathname !== '/vehicles' && location.pathname !== '/tags' && location.pathname !== '/schedules') {
          navigate('/vehicles');
      }
  }, [isLockedMode, location.pathname, navigate]);

  useEffect(() => {
     let isM = true;
     // Assina as settings DO TENANT (logo whitelabel, nome, anúncio). Antes lia o
     // doc global legado ktag_settings_v3/config, que não tem mais o whitelabel
     // após a migração D4 (settings por tenant) — por isso o logo caía no fallback.
     const unsubscribe = storage.subscribeSettings((data: any) => {
         if (!isM) return;
         setAppSettings((prev: any) => {
             // Reseta o "dispensado" quando o anúncio muda
             const annPrev = prev?.announcement || {};
             const annNew = data?.announcement || {};
             if (annPrev.title !== annNew.title || annPrev.message !== annNew.message || annPrev.isActive !== annNew.isActive) {
                 setTimeout(() => setAnnouncementDismissed(false), 0);
             }
             return data;
         });
     });

     return () => {
         isM = false;
         unsubscribe();
     };
  }, [tenantId]);

  useEffect(() => {
     if (user) {
        let isM = true;
        const checkReview = async () => {
           try {
              const { storage } = await import('../services/storage');
              const unsub = storage.subscribeVehicles((vehicles) => {
                 if (!isM) return;
                 const needReview = vehicles.filter((v: any) => 
                     (v.createdBy === user.id || v.createdByName === user.name || v.updatedBy === user.name) 
                     && v.requiresTagReview && !v.tagId
                 );
                 setVehiclesReview(needReview);
              });
              return unsub;
           } catch(e) {}
           return () => {};
        };
        const promiseUnsub = checkReview();
        return () => { isM = false; promiseUnsub.then(u => { if (u) u(); }) };
     }
  }, [user]);

  const handleResolveNow = async () => {
     const urgentUntil = Date.now() + 30 * 60 * 1000;
     saveTagReviewState({ urgentPendingUntil: urgentUntil });
     
     try {
        const { storage } = await import('../services/storage');
        // Update all vehicles currently needing review
        for (const v of vehiclesReview) {
            await storage.saveVehicle({
                ...v,
                tagReviewUrgentUntil: urgentUntil
            });
        }
     } catch (err) {
        console.error('Failed to update vehicles urgent status', err);
     }

     const firstPlate = vehiclesReview[0]?.plate;
     navigate('/vehicles', { state: { searchTarget: firstPlate } });
  };

  const handleRemindLater = () => {
     const { remindCount } = tagReviewState;
     const count = remindCount + 1;
     let delayMinutes = 60;
     if (count === 1) delayMinutes = 60;
     else if (count === 2) delayMinutes = 30;
     else delayMinutes = 15;
     
     saveTagReviewState({ remindCount: count, hideUntil: Date.now() + delayMinutes * 60 * 1000 });
  };

  const handleUpdateAvatar = async (url: string) => {
    try {
      await updateProfile({ avatarUrl: url });
      setIsAvatarSelectorOpen(false);
      addNotification('success', 'Avatar atualizado', 'Seu avatar foi atualizado com sucesso.');
    } catch (e: any) {
      addNotification('error', 'Erro', 'Não foi possível atualizar o avatar.');
    }
  };

  useEffect(() => {
    if (user && tenantId) {
        pushService.register(user.id, tenantId);
    }
  }, [user, tenantId]);

  const isMapPage = location.pathname === '/map';
  const isClient = user?.role === 'client';
  
  // Detecta se é mobile (largura < 768px)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Define se deve mostrar o header do cliente (apenas se NÃO for a página de mapa no mobile)
  const showClientHeader = isClient && isMobile && !isMapPage;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleStyle = (role?: string) => {
    switch (role) {
      case 'admin': return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: null, label: 'Administrador' };
      case 'moderator': return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: null, label: 'Moderador' };
      case 'client': return null;
      default: return { color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-200 dark:bg-zinc-800', border: 'border-zinc-300 dark:border-zinc-700', icon: UserIcon, label: 'Usuário' };
    }
  };

  const roleStyle = getRoleStyle(user?.role);
  const RoleIcon = roleStyle?.icon;

  const getMenuSections = () => {
    const rawSections = [
      {
        title: 'MONITORAMENTO',
        items: [
          { label: 'DASHBOARD', path: '/', icon: LayoutGrid, perm: 'ROUTE_DASHBOARD' },
          { label: 'MAPA AO VIVO', path: '/map', icon: Map, perm: 'ROUTE_MAP' }
        ]
      },
      {
        title: 'OPERAÇÕES',
        items: [
          { label: 'SEGURANÇA', path: '/security', icon: ShieldAlert, perm: 'ROUTE_SECURITY' },
          { label: 'VEÍCULOS', path: '/vehicles', icon: CarFront, perm: 'ROUTE_VEHICLES' },
          { label: 'ENVIOS', path: '/envios', icon: Package, perm: 'ROUTE_SHIPMENTS', module: 'shipments' },
          { label: 'CLIENTES', path: '/clients', icon: Users, perm: 'ROUTE_CLIENTS' },
          { label: 'ESTOQUE TAGS', path: '/tags', icon: Tags, perm: 'ROUTE_TAGS' },
          { label: 'RASTREADORES', path: '/trackers', icon: Satellite, perm: 'ROUTE_ASSETS', module: 'trackers' },
          { label: 'ATIVOS E CHIPS', path: '/assets', icon: Boxes, perm: 'ROUTE_ASSETS', module: 'trackers' }
        ]
      },
      {
        title: 'AGENDAMENTOS',
        items: [
          { label: 'NOVA SOLICITAÇÃO', path: '/schedule/new', icon: Plus, perm: 'ROUTE_SCHEDULE_NEW', module: 'scheduling' },
          { label: (user?.role === 'admin' || user?.role === 'sysadmin' || user?.role === 'moderator' || user?.role === 'admin_tecnico') ? 'CENTRAL DE AGENDA' : 'MINHAS SOLICITAÇÕES', path: '/schedules', icon: Calendar, perm: 'ROUTE_SCHEDULES', module: 'scheduling' },
          { label: 'CALENDÁRIO', path: '/calendar', icon: Calendar, perm: 'ROUTE_CALENDAR', module: 'scheduling' },
          { label: 'TÉCNICOS', path: '/technicians', icon: Wrench, perm: 'ROUTE_TECHNICIANS', module: 'scheduling' }
        ]
      },
      {
        title: 'COMUNIDADE',
        items: [
          { label: 'FEEDBACKS', path: '/feedback', icon: MessageSquare, perm: 'ROUTE_FEEDBACK' }
        ]
      },
      {
        title: 'GESTÃO',
        items: [
          { label: 'RELATÓRIOS', path: '/reports', icon: FileText, perm: 'ROUTE_REPORTS' },
          { label: 'GESTÃO FINANCEIRA', path: '/technicians/financials', icon: Wallet, perm: 'ROUTE_FINANCIAL', module: 'scheduling' },
          { label: 'MENSALIDADE', path: '/billing', icon: Receipt, perm: 'ROUTE_BILLING' },
          { label: 'AUDITORIA', path: '/audit', icon: ClipboardList, perm: 'ROUTE_AUDIT' }
        ]
      }
    ];

    const out: any[] = [];
    rawSections.forEach((section: any) => {
        const allowedItems = section.items.filter((item: any) => (!item.module || enabledModules.includes(item.module)) && hasPermission(user, customRoles || [], item.perm)).map((item: any) => ({
            ...item,
            disabled: isLockedMode && item.path !== '/vehicles' && item.path !== '/tags' && item.path !== '/schedules'
        }));
        if (allowedItems.length > 0) {
            out.push({ ...section, items: allowedItems });
        }
    });

    return out;
  };

  const menuSections = getMenuSections();

  return (
    <div className="flex h-screen print:h-auto bg-zinc-100 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden print:overflow-visible font-sans transition-colors duration-300 flex-col relative">
      
      {/* GLOBAL ALERTS (TOASTS) */}
      <AnimatePresence>
        {criticalAlerts.length > 0 && (
          <MotionDiv 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white z-[9999] flex flex-col items-center justify-center shadow-lg relative shrink-0"
          >
             {criticalAlerts.map((msg, idx) => (
                <div key={idx} className="flex items-center gap-2 py-2 px-4 text-[10px] md:text-xs font-black uppercase tracking-widest animate-pulse">
                   <AlertTriangle size={16} /> {msg}
                </div>
             ))}
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* ANNOUNCEMENT BANNER */}
      <AnimatePresence>
        {appSettings?.announcement?.isActive && 
         !announcementDismissed && 
         ((appSettings.announcement.targetRoles || []).includes('all') || (appSettings.announcement.targetRoles || []).includes(user?.role || '') || (appSettings.announcement.targetRoles || []).includes(user?.customRoleId || '')) && (
          <MotionDiv 
            key="announcement-banner"
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className={`z-[9998] flex items-center justify-between px-4 py-3 shadow-sm relative shrink-0 ${
                appSettings.announcement.color === 'red' ? 'bg-red-500 text-white' :
                appSettings.announcement.color === 'blue' ? 'bg-blue-500 text-white' :
                appSettings.announcement.color === 'emerald' ? 'bg-emerald-500 text-white' :
                appSettings.announcement.color === 'purple' ? 'bg-purple-500 text-white' :
                appSettings.announcement.color === 'zinc' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' :
                'bg-orange-500 text-white'
            }`}
          >
             <div className="flex items-center gap-3 w-full max-w-7xl mx-auto">
                 <div className="w-8 h-8 bg-black/10 dark:bg-black/5 rounded-full flex items-center justify-center shrink-0">
                     <Megaphone size={16} className="text-current" />
                 </div>
                 <div className="flex-1">
                     <h4 className="font-black uppercase text-[10px] tracking-widest mb-0.5 opacity-90">{appSettings.announcement.title}</h4>
                     <p className="text-sm font-medium leading-snug">{appSettings.announcement.message}</p>
                 </div>
                 <button 
                     onClick={() => setAnnouncementDismissed(true)} 
                     className="w-8 h-8 hover:bg-black/10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                 >
                     <X size={18} />
                 </button>
             </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
          {activeToast && (
            <MotionDiv 
              initial={{ opacity: 0, y: -50, x: '-50%' }} 
              animate={{ opacity: 1, y: 0, x: '-50%' }} 
              exit={{ opacity: 0, y: -50, x: '-50%' }}
              className="fixed top-6 left-1/2 z-[9999] w-[90%] max-w-md pointer-events-auto"
            >
              <div className={`
                p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-4
                ${activeToast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
                  activeToast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 
                  'bg-zinc-900/90 border-zinc-700 text-white'}
              `}>
                <div className="flex-1">
                    <h4 className="font-black uppercase text-xs tracking-widest mb-1">{activeToast.title}</h4>
                    <p className="text-sm font-medium leading-tight">{activeToast.message}</p>
                </div>
                <button onClick={closeToast} className="text-white/70 hover:text-white"><X size={18} /></button>
              </div>
            </MotionDiv>
          )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden print:overflow-visible relative z-0">
        
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2999] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR PADRÃO - Escondida para Cliente Mobile */}
        {!(isClient && isMobile) && (
            <aside className={`
              fixed lg:static inset-y-0 left-0 z-[3000] bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-all duration-300 lg:transform-none flex flex-col print:hidden
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              ${isCollapsed ? 'w-24' : 'w-72'}
            `}>
              <div className={`py-6 flex items-center ${isCollapsed ? 'justify-center px-4' : 'px-6 space-x-4'} border-b border-zinc-100 dark:border-zinc-800 transition-all`}>
                  <button 
                    disabled
                    className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center shadow-sm shrink-0 relative overflow-hidden group transition-colors"
                  >
                     {user?.avatarUrl ? (
                         <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                     ) : (
                         <span className="font-black text-lg text-zinc-700 dark:text-zinc-300 group-hover:text-primary-500 transition-colors">{user?.name?.charAt(0) || 'U'}</span>
                     )}
                     {roleStyle && isCollapsed && !user?.avatarUrl && (
                       <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white dark:border-zinc-900 flex items-center justify-center ${roleStyle.bg} ${roleStyle.color}`}>
                         {RoleIcon && <RoleIcon size={8} strokeWidth={3} />}
                       </div>
                     )}
                  </button>
                  {!isCollapsed && (
                    <div className="flex flex-col truncate flex-1 pr-2">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white truncate uppercase tracking-tight leading-none mb-1">{user?.name}</span>
                      <span className="text-[10px] text-zinc-500 truncate mb-1">{user?.email}</span>
                      {roleStyle && (
                        <div className={`self-start inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${roleStyle.bg} ${roleStyle.border}`}>
                            {RoleIcon && <RoleIcon size={8} className={roleStyle.color} strokeWidth={3} />}
                            <span className={`text-[8px] font-black uppercase tracking-widest ${roleStyle.color}`}>{roleStyle.label}</span>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <motion.nav 
                className="flex-1 overflow-y-auto py-6 custom-scrollbar"
                initial="hidden"
                animate="visible"
                variants={sidebarVariants}
              >
                {menuSections.map((section, idx) => (
                  <NavSection
                    key={idx}
                    section={section}
                    isCollapsed={isCollapsed}
                    location={location}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                ))}
              </motion.nav>

              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                {isLockedMode ? (
                  <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-zinc-400 dark:text-zinc-600 opacity-50 cursor-not-allowed transition-all ${isCollapsed ? 'justify-center' : ''}`} title="Acesso bloqueado pendente resolução K-TAG">
                      <Settings size={20} />
                      {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest line-through">Preferências</span>}
                  </div>
                ) : (
                  <Link to="/settings" className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${isCollapsed ? 'justify-center' : ''}`}>
                      <Settings size={20} />
                      {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Preferências</span>}
                  </Link>
                )}
                
                <button onClick={handleLogout} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ${isCollapsed ? 'justify-center' : ''}`}>
                    <LogOut size={20} />
                    {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Desconectar</span>}
                </button>

                <button 
                  onClick={() => setIsCollapsed(!isCollapsed)} 
                  className="w-full mt-2 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-primary-500 transition-colors"
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <div className="flex items-center gap-2"><ChevronLeft size={14} /><span className="text-[9px] font-black uppercase">Recolher</span></div>}
                </button>
                {!isCollapsed && (
                  <div className="pt-2 text-center">
                    <a href="https://www.siterastreio.com.br/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-400 hover:text-primary-500 transition-colors">
                      Rastreamento
                    </a>
                  </div>
                )}
              </div>
            </aside>
        )}

        <main className={`flex-1 flex flex-col h-full overflow-hidden print:overflow-visible relative bg-zinc-100 dark:bg-black transition-all ${isClient && isMobile && isMapPage ? 'z-[100]' : ''}`}>
          {isUrgentPending && (
             <div className="bg-red-500 text-white w-full py-2 px-6 flex items-center justify-between z-[3000] shadow-md shrink-0">
                <div className="flex items-center gap-2">
                   <ShieldAlert size={16} />
                   <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Veículos aguardando revisão</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                   <span className="text-[10px] sm:text-xs font-bold">Tempo restante: {Math.max(0, Math.ceil((tagReviewState.urgentPendingUntil - now) / 60000))} min</span>
                   <button onClick={() => navigate('/vehicles')} className="text-[10px] font-black uppercase bg-white text-red-500 hover:bg-red-50 px-3 py-1 rounded shadow-sm">Resolver</button>
                </div>
             </div>
          )}

          {/* HEADER PADRÃO */}
          {!(isClient && isMobile) ? (
              <header className="h-24 shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 lg:px-8 z-[2000] sticky top-0 print:hidden">
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><Menu size={24} /></button>
                  
                  <div className="hidden md:flex items-center gap-4 h-10">
                    {(() => {
                      const darkLogo = appSettings?.customLogoBase64Dark || appSettings?.customLogoUrlDark;
                      const lightLogo = appSettings?.customLogoBase64Light || appSettings?.customLogoUrlLight;
                      // Cross-fallback: se só um tema tiver logo, usa ele nos dois (evita cair no "K").
                      const logoSrc = theme === 'dark' ? (darkLogo || lightLogo) : (lightLogo || darkLogo);
                      const appName = appSettings?.customAppName || appSettings?.appName || 'Monitora 360';
                      return logoSrc ? (
                        <img src={logoSrc} alt={appName} className="w-10 h-10 object-contain" />
                      ) : (
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-xl border border-zinc-200">
                          <img src="/brand/logo-mark-dark.svg" alt={appName} className="w-7 h-7 object-contain" />
                        </div>
                      );
                    })()}
                    <div className="flex flex-col border-l-2 border-zinc-100 dark:border-zinc-800 pl-4 justify-center">
                        <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em]">{appSettings?.customAppName || appSettings?.appName || 'Monitora 360'}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">Console de Operações</span>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setIsChangelogOpen(true)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-blue-500 transition-all border border-zinc-100 dark:border-zinc-700 hover:border-blue-500/30"><Megaphone size={20}/></button>
                    <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-all relative border border-zinc-100 dark:border-zinc-700 hover:border-primary-500/30">
                      <Bell size={20} />
                      {notifications.filter(n => !n.read).length > 0 && <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-zinc-800" />}
                    </button>
                    <button onClick={toggleTheme} className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 transition-all border border-zinc-100 dark:border-zinc-700 hover:border-primary-500/30">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
                    {isNotifOpen && (
                        <>
                          <div className="fixed inset-0 z-[4000]" onClick={() => setIsNotifOpen(false)} />
                          <div className="absolute right-8 top-20 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-800 z-[5000] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
                                <h4 className="text-xs font-black uppercase tracking-widest">Notificações</h4>
                                <button onClick={clearAll} className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors font-bold uppercase">Limpar tudo</button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? <div className="p-10 text-center text-zinc-400 text-[10px] uppercase font-bold flex flex-col items-center gap-2"><Bell size={24} className="opacity-20"/>Nenhuma notificação</div> : 
                                  notifications.map(n => (
                                    <div key={n.id} className={`p-4 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors flex gap-3 ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                      <div className="flex-1">
                                          <p className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{n.title}</p>
                                          <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed font-medium">{n.message}</p>
                                          <span className="text-[9px] text-zinc-300 mt-2 block font-mono">{new Date(n.timestamp).toLocaleTimeString()}</span>
                                      </div>
                                      {!n.read && <button onClick={() => markAsRead(n.id)} className="text-zinc-300 hover:text-primary-500 self-start"><CheckCircle2 size={14}/></button>}
                                    </div>
                                  ))
                                }
                            </div>
                          </div>
                        </>
                    )}
                </div>
              </header>
          ) : showClientHeader && (
              // HEADER CLIENTE MOBILE
              <div className="bg-zinc-900 px-6 pt-10 pb-16 relative overflow-visible shrink-0 shadow-xl border-b border-zinc-800 z-[1000]">
                  <div className="flex justify-between items-start relative z-10">
                      <div>
                          <h1 className="text-2xl font-display font-black text-white tracking-tight">Olá, {user?.name.split(' ')[0]}...</h1>
                          <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                          <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="bg-zinc-800 backdrop-blur-sm p-3 rounded-2xl text-zinc-300 hover:text-white relative border border-zinc-700/50">
                              <Bell size={20} />
                              {notifications.filter(n => !n.read).length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-zinc-900" />}
                          </button>
                          <button onClick={() => setIsClientMenuOpen(true)} className="bg-white text-black p-3 rounded-2xl shadow-lg active:scale-95 border-2 border-transparent hover:border-primary-500"><Menu size={20} strokeWidth={2.5}/></button>
                      </div>
                  </div>
                  
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-zinc-800/30 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                  <AnimatePresence>
                    {isNotifOpen && (
                        <>
                          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm" onClick={() => setIsNotifOpen(false)} />
                          <MotionDiv initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute right-4 top-24 mt-2 w-[calc(100%-32px)] bg-zinc-900 rounded-[24px] shadow-2xl border border-zinc-800 z-[5000] overflow-hidden">
                            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                                <h4 className="text-xs font-black uppercase tracking-widest text-white">Notificações</h4>
                                <button onClick={clearAll} className="text-[10px] text-zinc-400 hover:text-red-500 font-bold uppercase">Limpar</button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-900">
                                {notifications.length === 0 ? <div className="p-10 text-center text-zinc-500 text-[10px] font-bold flex flex-col items-center gap-2"><Bell size={24} className="opacity-20"/>Sem novidades</div> : 
                                  notifications.map(n => (
                                    <div key={n.id} className={`p-4 border-b border-zinc-800 flex gap-3 ${!n.read ? 'bg-zinc-800/50' : ''}`}>
                                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                      <div className="flex-1">
                                          <p className="text-[11px] font-black text-white uppercase tracking-tight">{n.title}</p>
                                          <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed font-medium">{n.message}</p>
                                      </div>
                                      {!n.read && <button onClick={() => markAsRead(n.id)} className="text-zinc-500 hover:text-primary-500"><CheckCircle2 size={14}/></button>}
                                    </div>
                                  ))
                                }
                            </div>
                          </MotionDiv>
                        </>
                    )}
                  </AnimatePresence>
              </div>
          )}

          <div className={`flex-1 overflow-y-auto print:overflow-visible custom-scrollbar bg-zinc-100 dark:bg-black ${isMapPage ? 'p-0' : (isClient && isMobile ? 'px-4 pb-32 -mt-6' : 'p-6 lg:p-8')}`}>
              {children || <Outlet />}
          </div>
          
          {user?.role === 'admin' && <AiAssistant />}
          {isChangelogOpen && <ChangelogModal onClose={() => setIsChangelogOpen(false)} />}

          <AnimatePresence>
             {showReviewModal && (
                <>
                   <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9000]" />
                   <div className="fixed inset-0 z-[9001] flex items-center justify-center p-4">
                      <motion.div 
                         initial={{ scale: 0.9, opacity: 0 }}
                         animate={{ scale: 1, opacity: 1 }}
                         className="bg-white dark:bg-zinc-900 border border-red-500/50 rounded-[32px] p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
                      >
                         <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
                         <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 text-red-500 flex items-center justify-center rounded-full">
                               <ShieldAlert size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Revisão Necessária</h2>
                            <p className="text-zinc-500">
                               Você tem {vehiclesReview.length} veículo(s) cadastrado(s) que precisam de revisão, pois não possuem K-TAG vinculado.
                            </p>
                            
                            <div className="w-full text-left bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 max-h-[40vh] overflow-y-auto space-y-2">
                               {vehiclesReview.map((v: any) => (
                                  <div key={v.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3 rounded-xl flex items-center justify-between">
                                     <div className="flex flex-col">
                                        <span className="font-bold text-zinc-900 dark:text-white">{v.plate}</span>
                                        <span className="text-[10px] text-zinc-500">{v.model}</span>
                                     </div>
                                     <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded-md">Pendente</span>
                                  </div>
                               ))}
                            </div>

                            <div className="w-full flex flex-col gap-2 mt-4">
                               <button 
                                  onClick={handleResolveNow}
                                  className="w-full bg-red-500 text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-red-600 transition-colors"
                               >
                                  Resolver Agora
                               </button>
                               {tagReviewState.remindCount < 3 && (
                                   <button 
                                      onClick={handleRemindLater} 
                                      className="w-full text-zinc-500 font-bold uppercase tracking-widest py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                   >
                                      Lembrar Depois
                                   </button>
                               )}
                            </div>
                         </div>
                      </motion.div>
                   </div>
                </>
             )}
          </AnimatePresence>
        </main>
      </div>

      {/* ELEMENTOS FIXOS DE NAVEGAÇÃO MOBILE (NA RAIZ PARA Z-INDEX CORRETO) */}
      {isClient && isMobile && (
        <>
          {/* BOTTOM BAR */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800/50 backdrop-blur-xl rounded-full shadow-2xl px-10 py-3.5 flex items-center gap-12 z-[2000] ring-1 ring-white/10">
              <Link to="/vehicles" className={`relative p-2 transition-all group flex flex-col items-center gap-1`}>
                  <CarFront size={22} className={`transition-colors duration-300 ${location.pathname === '/vehicles' ? 'text-primary-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} strokeWidth={location.pathname === '/vehicles' ? 2.5 : 2}/>
                  {location.pathname === '/vehicles' && <motion.div layoutId="nav-dot" className="absolute -bottom-1 w-1 h-1 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"/>}
              </Link>
              <div className="w-px h-6 bg-zinc-800 opacity-50"></div>
              {isLockedMode ? (
                  <div className={`relative p-2 transition-all flex flex-col items-center gap-1 opacity-50 cursor-not-allowed`} title="Bloqueado">
                      <MapPin size={22} className={`text-zinc-600`} strokeWidth={2}/>
                  </div>
              ) : (
                  <Link to="/map" className={`relative p-2 transition-all group flex flex-col items-center gap-1`}>
                      <MapPin size={22} className={`transition-colors duration-300 ${location.pathname === '/map' ? 'text-primary-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} strokeWidth={location.pathname === '/map' ? 2.5 : 2}/>
                      {location.pathname === '/map' && <motion.div layoutId="nav-dot" className="absolute -bottom-1 w-1 h-1 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"/>}
                  </Link>
              )}
          </div>

          {/* MENU LATERAL MOBILE CLIENTE */}
          <AnimatePresence>
            {isClientMenuOpen && (
              <>
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[5000]" onClick={() => setIsClientMenuOpen(false)} />
                <MotionDiv initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 w-[80%] max-w-xs bg-zinc-900 border-l border-zinc-800 shadow-2xl z-[5001] flex flex-col p-6">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Menu</h3>
                      <button onClick={() => setIsClientMenuOpen(false)} className="p-2 bg-zinc-800 rounded-xl text-zinc-400"><X size={20}/></button>
                  </div>
                  <div className="space-y-2 flex-1">
                      <Link to="/vehicles" onClick={() => setIsClientMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 transition-all"><CarFront size={18} className="text-primary-500"/> Minha Frota</Link>
                      
                      {isLockedMode ? (
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/20 border border-zinc-800/50 text-zinc-600 font-bold text-sm opacity-50 cursor-not-allowed">
                              <Map size={18} className="text-zinc-600"/> <span className="line-through">Mapa ao Vivo</span>
                          </div>
                      ) : (
                          <Link to="/map" onClick={() => setIsClientMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 transition-all"><Map size={18} className="text-primary-500"/> Mapa ao Vivo</Link>
                      )}

                      {isLockedMode ? (
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/20 border border-zinc-800/50 text-zinc-600 font-bold text-sm opacity-50 cursor-not-allowed">
                              <Settings size={18} className="text-zinc-600"/> <span className="line-through">Configurações</span>
                          </div>
                      ) : (
                          <Link to="/settings" onClick={() => setIsClientMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 transition-all"><Settings size={18} className="text-zinc-400"/> Configurações</Link>
                      )}

                      <button onClick={() => { toggleTheme(); setIsClientMenuOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 transition-all text-left">
                        {theme === 'dark' ? <Sun size={18} className="text-yellow-500"/> : <Moon size={18} className="text-blue-300"/>} 
                        <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                      </button>
                      <a href="https://www.siterastreio.com.br/" target="_blank" className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 transition-all" rel="noreferrer">
                        <Package size={18} className="text-zinc-400"/> Rastreamento
                      </a>
                  </div>
                  {canSwitch && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 px-1">Trocar ambiente</p>
                      <div className="space-y-1.5">
                        {isGlobalAdmin && (
                          <a href={buildTenantHref('admin')} className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-sm hover:bg-amber-500/15 transition-all">
                            <ShieldCheck size={16} className="text-amber-400" /> Painel da plataforma
                            <ChevronRight size={14} className="ml-auto opacity-60" />
                          </a>
                        )}
                        {otherMemberships.map((m) => (
                          <a key={m.tenantId} href={buildTenantHref(m.tenantId)} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-800/50 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 transition-all">
                            <Building2 size={16} className="text-zinc-400" /> <span className="truncate">{m.tenantId}</span>
                            <ChevronRight size={14} className="ml-auto opacity-60" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={handleLogout} className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 mt-auto hover:bg-red-500 hover:text-white transition-all"><LogOut size={16}/> Sair do App</button>
                </MotionDiv>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
