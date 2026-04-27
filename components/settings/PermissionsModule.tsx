import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, ShieldAlert, Check } from 'lucide-react';
import { storage } from '../../services/storage';
import { CustomRole } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

const AVAILABLE_PERMISSIONS = [
  { id: 'ROUTE_DASHBOARD', label: 'Dashboard' },
  { id: 'ROUTE_MAP', label: 'Mapa ao Vivo' },
  { id: 'ROUTE_SECURITY', label: 'Monitoramento (Segurança)' },
  { id: 'ROUTE_VEHICLES', label: 'Veículos' },
  { id: 'ROUTE_SHIPMENTS', label: 'Envios e Remessas' },
  { id: 'ROUTE_CLIENTS', label: 'Clientes' },
  { id: 'ROUTE_TAGS', label: 'Estoque de Tags' },
  { id: 'ROUTE_SCHEDULE_NEW', label: 'Nova Solicitação (Agendamento)' },
  { id: 'ROUTE_SCHEDULES', label: 'Central de Agenda' },
  { id: 'ROUTE_CALENDAR', label: 'Calendário (Agenda Visão Geral)' },
  { id: 'ROUTE_TECHNICIANS', label: 'Técnicos' },
  { id: 'ROUTE_FEEDBACK', label: 'Comunidade / Feedbacks' },
  { id: 'ROUTE_REPORTS', label: 'Relatórios' },
  { id: 'ROUTE_FINANCIAL', label: 'Gestão Financeira' },
  { id: 'ROUTE_AUDIT', label: 'Auditoria' },
  { id: 'ROUTE_SETTINGS_MODULE_SYSTEM', label: 'Preferências: Sistema & APIs' },
  { id: 'ROUTE_SETTINGS_MODULE_ROLES', label: 'Preferências: Cargos e Acessos' },
  { id: 'ROUTE_SETTINGS_MODULE_USERS', label: 'Preferências: Usuários' }
];

export const PermissionsModule = () => {
    const [roles, setRoles] = useState<CustomRole[]>([]);
    const [loading, setLoading] = useState(true);
    const { addNotification } = useNotification();
    const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setLoading(true);
        const fetchedRoles = await storage.getCustomRoles();
        let finalRoles = [...fetchedRoles];

        const DEFAULT_ROLES: CustomRole[] = [
            { id: 'sysadmin', name: 'Super Admin', isSystem: true, permissions: AVAILABLE_PERMISSIONS.map(p => p.id) },
            { id: 'admin', name: 'Admin', isSystem: true, permissions: AVAILABLE_PERMISSIONS.map(p => p.id).filter(id => id !== 'ROUTE_SETTINGS_MODULE_ROLES') },
            { id: 'moderator', name: 'Moderador', isSystem: true, permissions: ['ROUTE_DASHBOARD', 'ROUTE_MAP', 'ROUTE_VEHICLES', 'ROUTE_CLIENTS', 'ROUTE_SCHEDULE_NEW', 'ROUTE_SCHEDULES', 'ROUTE_CALENDAR', 'ROUTE_TECHNICIANS'] },
            { id: 'user', name: 'Usuário', isSystem: true, permissions: ['ROUTE_DASHBOARD', 'ROUTE_MAP', 'ROUTE_VEHICLES'] },
            { id: 'client', name: 'Cliente', isSystem: true, permissions: ['ROUTE_DASHBOARD', 'ROUTE_MAP', 'ROUTE_VEHICLES', 'ROUTE_SCHEDULE_NEW'] },
            { id: 'technician', name: 'Técnico', isSystem: true, permissions: ['ROUTE_DASHBOARD', 'ROUTE_SCHEDULES', 'ROUTE_CALENDAR', 'ROUTE_FINANCIAL'] },
            { id: 'admin_tecnico', name: 'Admin Técnico', isSystem: true, permissions: ['ROUTE_DASHBOARD', 'ROUTE_SCHEDULES', 'ROUTE_CALENDAR', 'ROUTE_TECHNICIANS', 'ROUTE_FINANCIAL'] }
        ];

        for (const defaultRole of DEFAULT_ROLES) {
            if (!finalRoles.find(r => r.id === defaultRole.id)) {
                finalRoles.push(defaultRole);
                await storage.saveCustomRole(defaultRole);
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
        setRoles([...roles, newRole]);
        setNewRoleName('');
        addNotification('success', 'Cargo Criado', `O cargo ${newRole.name} foi criado com sucesso.`);
    };

    const handleDeleteRole = async (roleId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const role = roles.find(r => r.id === roleId);
        if (role?.isSystem) {
            addNotification('error', 'Ação Negada', 'Este cargo é do sistema e não pode ser deletado.');
            return;
        }
        await storage.deleteCustomRole(roleId);
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

        const currentPerms = new Set(roleInfo.permissions);
        if (currentPerms.has(permId)) {
            currentPerms.delete(permId);
        } else {
            currentPerms.add(permId);
        }

        const updatedRole = { ...roleInfo, permissions: Array.from(currentPerms) };
        await storage.saveCustomRole(updatedRole);
        
        const newRoles = [...roles];
        newRoles[roleIndex] = updatedRole;
        setRoles(newRoles);
        
        addNotification('info', 'Permissão Atualizada', 'Acesso alterado automaticamente.');
    };

    if (loading) return <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;

    const activeRole = roles.find(r => r.id === activeRoleId);

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-4">Cargos</h3>
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            placeholder="Criar novo cargo..." 
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
                        />
                        <button onClick={handleCreateRole} className="w-12 shrink-0 bg-primary-500 text-white flex items-center justify-center rounded-xl hover:bg-primary-600 transition-colors">
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {roles.map(role => (
                            <div 
                                key={role.id}
                                onClick={() => setActiveRoleId(role.id)}
                                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${activeRoleId === role.id ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-500' : 'bg-transparent border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'}`}
                            >
                                <span className="font-bold text-xs uppercase tracking-wider">{role.name}</span>
                                {role.isSystem ? (
                                    <ShieldAlert size={14} className="text-amber-500" />
                                ) : (
                                    <button onClick={(e) => handleDeleteRole(role.id, e)} className="text-zinc-300 hover:text-red-500 transition-colors p-1"><Trash2 size={14}/></button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="w-full md:w-2/3">
                {activeRole ? (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-6 lg:p-8">
                        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                            <ShieldCheck size={28} className="text-primary-500" />
                            <div>
                                <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white tracking-widest">{activeRole.name}</h3>
                                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Matriz de Acessos Dinâmica</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {AVAILABLE_PERMISSIONS.map(perm => {
                                const isChecked = activeRole.permissions.includes(perm.id);
                                return (
                                    <label key={perm.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/50' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'} ${activeRole.id === 'sysadmin' ? 'opacity-70 cursor-not-allowed' : 'hover:border-primary-500/50'}`}>
                                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'}`}>
                                            {isChecked && <Check size={14} strokeWidth={3} />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="sr-only" 
                                            disabled={activeRole.id === 'sysadmin'}
                                            checked={isChecked}
                                            onChange={() => handleTogglePermission(perm.id)}
                                        />
                                        <span className={`text-[11px] font-black uppercase tracking-tight ${isChecked ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{perm.label}</span>
                                    </label>
                                );
                            })}
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
