import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, ShieldAlert, Lock } from 'lucide-react';
import { storage } from '../../services/storage';
import { CustomRole } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { Checkbox } from '../ui/checkbox';
import {
  PERMISSIONS,
  ALL_PERMISSION_IDS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../utils/permissions';

// Permissões de governança que NÃO podem ser removidas do cargo 'admin' do sistema —
// impede que um tenant se tranque para fora da gestão de Cargos/Usuários.
const ADMIN_GOVERNANCE_PERMS: string[] = [
  PERMISSIONS.SETTINGS_MODULE_ROLES,
  PERMISSIONS.SETTINGS_MODULE_USERS,
];

// Agrupa as permissões em categorias visuais — facilita ao admin enxergar
// quais áreas ele está liberando para cada cargo. Source of truth: PERMISSIONS.
const PERMISSION_GROUPS: Array<{
  title: string;
  items: Array<{ id: string; label: string; hint?: string }>;
}> = [
  {
    title: 'Monitoramento',
    items: [
      { id: PERMISSIONS.DASHBOARD,  label: 'Dashboard',          hint: 'Visão geral de operações' },
      { id: PERMISSIONS.MAP,        label: 'Mapa ao Vivo',       hint: 'Posição em tempo real da frota' },
      { id: PERMISSIONS.SECURITY,   label: 'Segurança',          hint: 'Monitoramento de eventos de segurança' },
    ],
  },
  {
    title: 'Operações',
    items: [
      { id: PERMISSIONS.VEHICLES,   label: 'Veículos' },
      { id: PERMISSIONS.SHIPMENTS,  label: 'Envios e Remessas' },
      { id: PERMISSIONS.CLIENTS,    label: 'Clientes' },
      { id: PERMISSIONS.TAGS,       label: 'Estoque de Tags' },
    ],
  },
  {
    title: 'Agendamentos',
    items: [
      { id: PERMISSIONS.SCHEDULE_NEW, label: 'Nova Solicitação' },
      { id: PERMISSIONS.SCHEDULES,    label: 'Central de Agenda' },
      { id: PERMISSIONS.CALENDAR,     label: 'Calendário' },
      { id: PERMISSIONS.TECHNICIANS,  label: 'Técnicos' },
    ],
  },
  {
    title: 'Comunidade & Relatórios',
    items: [
      { id: PERMISSIONS.FEEDBACK,   label: 'Comunidade / Feedbacks' },
      { id: PERMISSIONS.REPORTS,    label: 'Relatórios' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { id: PERMISSIONS.FINANCIAL,  label: 'Gestão Financeira' },
      { id: PERMISSIONS.BILLING,    label: 'Mensalidade' },
      { id: PERMISSIONS.AUDIT,      label: 'Auditoria' },
    ],
  },
  {
    title: 'Preferências do Sistema',
    items: [
      { id: PERMISSIONS.SETTINGS_MODULE_SYSTEM,       label: 'Sistema & APIs',       hint: 'Configurar integrações e credenciais' },
      { id: PERMISSIONS.SETTINGS_MODULE_ROLES,        label: 'Cargos e Acessos',     hint: 'Editar permissões — cuidado!' },
      { id: PERMISSIONS.SETTINGS_MODULE_USERS,        label: 'Usuários',             hint: 'Aprovar e gerenciar usuários' },
      { id: PERMISSIONS.SETTINGS_MODULE_ANNOUNCEMENT, label: 'Alertas do Sistema',   hint: 'Disparar anúncios globais' },
    ],
  },
];

// Seed inicial de cargos do sistema — sincronizado com DEFAULT_ROLE_PERMISSIONS.
const SYSTEM_ROLES_SEED: CustomRole[] = [
  { id: 'sysadmin',      name: 'Super Admin',   isSystem: true, permissions: [...ALL_PERMISSION_IDS] },
  { id: 'admin',         name: 'Admin',         isSystem: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.admin] },
  { id: 'admin_tecnico', name: 'Admin Técnico', isSystem: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.admin_tecnico] },
  { id: 'moderator',     name: 'Moderador',     isSystem: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.moderator] },
  { id: 'user',          name: 'Usuário',       isSystem: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.user] },
  { id: 'technician',    name: 'Técnico',       isSystem: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.technician] },
  { id: 'client',        name: 'Cliente',       isSystem: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.client] },
];

export const PermissionsModule = () => {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');

  useEffect(() => { loadRoles(); }, []);

  const loadRoles = async () => {
    setLoading(true);
    const fetchedRoles = await storage.getCustomRoles();
    const finalRoles = [...fetchedRoles];

    // Garante que cada cargo do sistema existe; cria os ausentes.
    for (const seed of SYSTEM_ROLES_SEED) {
      if (!finalRoles.find(r => r.id === seed.id)) {
        finalRoles.push(seed);
        await storage.saveCustomRole(seed);
      }
    }

    setRoles(finalRoles);
    if (!activeRoleId && finalRoles.length > 0) setActiveRoleId(finalRoles[0].id);
    setLoading(false);
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    const newRole: CustomRole = {
      id: crypto.randomUUID(),
      name: newRoleName,
      permissions: []
    };
    await storage.saveCustomRole(newRole);
    await storage.logAction(null, 'CREATE', 'Role', `Cargo criado: ${newRole.name}`, newRole.id);
    setRoles([...roles, newRole]);
    setNewRoleName('');
    setActiveRoleId(newRole.id);
    addNotification('success', 'Cargo Criado', `O cargo ${newRole.name} foi criado.`);
  };

  const handleDeleteRole = async (roleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const role = roles.find(r => r.id === roleId);
    if (role?.isSystem) {
      addNotification('error', 'Ação Negada', 'Cargos do sistema não podem ser deletados.');
      return;
    }
    await storage.deleteCustomRole(roleId);
    await storage.logAction(null, 'DELETE', 'Role', `Cargo apagado: ${role?.name || roleId}`, roleId);
    setRoles(roles.filter(r => r.id !== roleId));
    if (activeRoleId === roleId) setActiveRoleId(roles[0]?.id || null);
    addNotification('success', 'Cargo Apagado', 'O cargo foi excluído.');
  };

  const handleTogglePermission = async (permId: string) => {
    if (!activeRoleId) return;
    const roleIndex = roles.findIndex(r => r.id === activeRoleId);
    if (roleIndex === -1) return;

    const roleInfo = roles[roleIndex];

    if (roleInfo.id === 'sysadmin') {
      addNotification('error', 'Bloqueado', 'Permissões do Super Admin não podem ser alteradas.');
      return;
    }

    // Guardrail: não deixar remover a governança (Cargos/Usuários) do cargo Admin —
    // isso trancaria a empresa para fora da administração.
    if (roleInfo.id === 'admin' && ADMIN_GOVERNANCE_PERMS.includes(permId) && roleInfo.permissions.includes(permId)) {
      addNotification('error', 'Bloqueado', 'O cargo Admin precisa manter a gestão de Cargos e Usuários — remover isso trancaria a empresa para fora da administração.');
      return;
    }

    const currentPerms = new Set(roleInfo.permissions);
    if (currentPerms.has(permId)) currentPerms.delete(permId);
    else currentPerms.add(permId);

    const updatedRole = { ...roleInfo, permissions: Array.from(currentPerms) };
    await storage.saveCustomRole(updatedRole);
    await storage.logAction(null, 'UPDATE', 'Role', `Permissão ${currentPerms.has(permId) ? 'concedida' : 'revogada'} (${permId}) no cargo "${roleInfo.name}"`, roleInfo.id);

    const newRoles = [...roles];
    newRoles[roleIndex] = updatedRole;
    setRoles(newRoles);
  };

  const handleSelectAll = async (enable: boolean) => {
    if (!activeRoleId) return;
    const roleIndex = roles.findIndex(r => r.id === activeRoleId);
    if (roleIndex === -1) return;
    const roleInfo = roles[roleIndex];
    if (roleInfo.id === 'sysadmin') return;

    // Guardrail: o cargo Admin não pode ter tudo revogado (lock-out).
    if (roleInfo.id === 'admin' && !enable) {
      addNotification('error', 'Bloqueado', 'O cargo Admin não pode ter todas as permissões revogadas.');
      return;
    }

    const updatedRole = {
      ...roleInfo,
      permissions: enable ? [...ALL_PERMISSION_IDS] : []
    };
    await storage.saveCustomRole(updatedRole);
    await storage.logAction(null, 'UPDATE', 'Role', `${enable ? 'Todas as permissões concedidas' : 'Permissões revogadas'} no cargo "${roleInfo.name}"`, roleInfo.id);
    const newRoles = [...roles];
    newRoles[roleIndex] = updatedRole;
    setRoles(newRoles);
    addNotification('info', 'Permissões atualizadas', enable ? 'Todas as permissões habilitadas.' : 'Todas as permissões revogadas.');
  };

  if (loading) return <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const activeRole = roles.find(r => r.id === activeRoleId);
  const isReadOnlyRole = activeRole?.id === 'sysadmin';

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* SIDEBAR DE CARGOS */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-4">Cargos</h3>
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Criar novo cargo..."
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateRole(); }}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
            />
            <button onClick={handleCreateRole} className="w-12 shrink-0 bg-primary-500 text-white flex items-center justify-center rounded-xl hover:bg-primary-600 transition-colors">
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => setActiveRoleId(role.id)}
                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${activeRoleId === role.id ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-transparent border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'}`}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-xs uppercase tracking-wider">{role.name}</span>
                  <span className="text-[9px] font-bold text-zinc-400">
                    {role.permissions.length} de {ALL_PERMISSION_IDS.length} permissões
                  </span>
                </div>
                {role.isSystem ? (
                  <ShieldAlert size={14} className="text-amber-500" />
                ) : (
                  <button onClick={e => handleDeleteRole(role.id, e)} className="text-zinc-300 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAINEL DE PERMISSÕES */}
      <div className="w-full md:w-2/3">
        {activeRole ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-6 lg:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                {isReadOnlyRole ? (
                  <Lock size={28} className="text-amber-500" />
                ) : (
                  <ShieldCheck size={28} className="text-primary-500" />
                )}
                <div>
                  <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white tracking-widest">{activeRole.name}</h3>
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    {isReadOnlyRole ? 'Cargo de sistema — bloqueado' : 'Matriz de Acessos'}
                  </p>
                </div>
              </div>
              {!isReadOnlyRole && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSelectAll(true)} className="text-[10px] font-black uppercase tracking-wider px-3 py-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors">Liberar tudo</button>
                  <button onClick={() => handleSelectAll(false)} className="text-[10px] font-black uppercase tracking-wider px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Limpar</button>
                </div>
              )}
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.title}>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">{group.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.items.map(perm => {
                      const isChecked = activeRole.permissions.includes(perm.id);
                      // Governança do Admin é obrigatória (anti-lockout) — trava o toggle.
                      const isGovLocked = activeRole.id === 'admin' && ADMIN_GOVERNANCE_PERMS.includes(perm.id);
                      const isLocked = isReadOnlyRole || isGovLocked;
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isChecked ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/50' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'} ${isLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-primary-500/50'}`}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={isLocked}
                            onChange={() => handleTogglePermission(perm.id)}
                          />
                          <div className="flex-1">
                            <span className={`text-[11px] font-black uppercase tracking-tight flex items-center gap-1.5 ${isChecked ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                              {perm.label}
                              {isGovLocked && <Lock size={11} className="text-amber-500 shrink-0" />}
                            </span>
                            {isGovLocked
                              ? <span className="text-[10px] text-amber-600/80 dark:text-amber-500/70 mt-0.5 block">Obrigatória no Admin (evita lock-out)</span>
                              : perm.hint && <span className="text-[10px] text-zinc-400 mt-0.5 block">{perm.hint}</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px]">
            <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Nenhum Cargo Selecionado</p>
          </div>
        )}
      </div>
    </div>
  );
};
