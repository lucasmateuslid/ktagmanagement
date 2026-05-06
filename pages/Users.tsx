
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { storage } from '../services/storage';
import { User } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { securityService } from '../services/security';
import { ConfirmModal } from '../components/ConfirmModal';
import { DataTable, DataTableColumn } from '../components/ui/basic-data-table';
import { 
  Users as UsersIcon, Check, X, Trash2, Loader2, ShieldAlert, 
  Mail, Calendar, Edit2, Plus, Search, ShieldCheck, UserCog, 
  Shield, User as UserIcon, Lock, Save, MoreVertical, ShieldQuestion, 
  Activity, RefreshCcw, Database, Eye, EyeOff, Smartphone, Key, Copy, Share2,
  UserPlus, CheckCircle2, XCircle, AlertCircle, Briefcase, UserCheck
} from 'lucide-react';

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [userToManage, setUserToManage] = useState<User | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<Partial<User> | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ role: 'user', status: 'approved' });
  
  // New Credentials State (Only shown once)
  const [newCredentials, setNewCredentials] = useState({ email: '', password: '' });

  const { addNotification } = useNotification();
  const { t } = useLanguage();
  const { isAdmin, user: currentUser, customRoles } = useAuth();

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (isAdmin) {
      const allUsers = await storage.getAllUsers();
      setUsers(allUsers);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  const handleSyncDatabase = async () => {
    setSyncing(true);
    try {
        const freshUsers = await storage.getAllUsers();
        setUsers(freshUsers);
        storage.logAction(currentUser, 'CONFIG', 'Database', 'Sincronizou manualmente o banco de usuários para acesso local');
        addNotification('success', 'Banco Sincronizado', 'As credenciais mais recentes foram carregadas.');
    } catch (err) {
        addNotification('error', 'Erro na Sincronização', 'Não foi possível conectar ao servidor.');
    } finally {
        setSyncing(false);
    }
  };

  // Separa usuários pendentes dos ativos/inativos
  const pendingUsers = useMemo(() => users.filter(u => u.status === 'pending'), [users]);
  
  // Filtra todos os ativos/aprovados/bloqueados baseados na busca
  const filteredAllActiveUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return users
      .filter(u => u.status !== 'pending')
      .filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, searchTerm]);

  // SEPARAÇÃO: EQUIPE vs CLIENTES
  const staffUsers = useMemo(() => {
      return filteredAllActiveUsers.filter(u => u.role !== 'client');
  }, [filteredAllActiveUsers]);

  const clientUsers = useMemo(() => {
      return filteredAllActiveUsers.filter(u => u.role === 'client');
  }, [filteredAllActiveUsers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
        addNotification('error', 'Erro', 'Nome e E-mail são obrigatórios.');
        return;
    }

    try {
      const isEdit = !!selectedUser;
      const userId = isEdit ? selectedUser!.id! : crypto.randomUUID();
      
      let generatedPassword = '';
      let hashedPassword = '';

      // Se for novo usuário, gera senha e hash
      if (!isEdit) {
          generatedPassword = securityService.generateStrongPassword();
          hashedPassword = await securityService.hashPassword(generatedPassword);
      }

      const userToSave: User = { 
        ...formData as User, 
        id: userId, 
        createdAt: formData.createdAt || Date.now(), 
        status: formData.status || 'approved',
        email: formData.email!.toLowerCase().trim()
      };

      if (isEdit) {
        await storage.updateUserProfile(userId, userToSave);
        await storage.updateUserStatus(userId, userToSave.status!);
      } else {
        userToSave.password = hashedPassword; // Salva o Hash
        await storage.registerUserRequest(userToSave);
        
        // Abre modal de credenciais
        setNewCredentials({ email: userToSave.email, password: generatedPassword });
        setIsCredentialsModalOpen(true);
      }
      
      storage.logAction(currentUser, isEdit ? 'UPDATE' : 'CREATE', 'User', `${isEdit ? 'Editou' : 'Criou'} o colaborador ${userToSave.name}`, userId);
      
      addNotification('success', 'Dados Gravados', 'Usuário salvo com sucesso.');
      setIsModalOpen(false);
      loadData(true);
    } catch (err) { 
        addNotification('error', 'Erro', 'Falha ao salvar o colaborador.'); 
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
      if (userToDelete.id === currentUser?.id) {
          addNotification('error', 'Ação Bloqueada', 'Você não pode excluir sua própria conta administrativa.');
          return;
      }

      try {
          await storage.deleteUser(userToDelete.id);
          storage.logAction(currentUser, 'DELETE', 'User', `Excluiu o usuário ${userToDelete.name}`, userToDelete.id);
          addNotification('success', 'Usuário Excluído', 'O registro foi removido com sucesso.');
          loadData(true);
      } catch (err) {
          addNotification('error', 'Erro', 'Falha ao excluir usuário.');
      }
  };

  const handleApproveUser = async (userToApprove: User) => {
      try {
          await storage.updateUserStatus(userToApprove.id, 'approved');
          storage.logAction(currentUser, 'UPDATE', 'User', `Aprovou o cadastro de ${userToApprove.name}`, userToApprove.id);
          addNotification('success', 'Acesso Liberado', `${userToApprove.name} agora pode acessar o sistema.`);
          loadData(true);
      } catch (err) {
          addNotification('error', 'Erro', 'Falha ao aprovar usuário.');
      }
  };

  const handleResetPassword = async (userId: string, userName: string, userEmail: string) => {
    try {
        const newPassword = securityService.generateStrongPassword();
        const newHash = await securityService.hashPassword(newPassword);

        await storage.updateUserProfile(userId, { password: newHash });
        storage.logAction(currentUser, 'UPDATE', 'User', `Resetou a senha do usuário ${userName}`, userId);
        
        // Mostra credenciais
        setNewCredentials({ email: userEmail, password: newPassword });
        setIsCredentialsModalOpen(true);

        loadData(true);
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao resetar senha.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addNotification('success', 'Copiado', 'Transferido para a área de transferência.');
  };

  const getRoleBadge = (role?: string, customRoleId?: string) => {
    if (customRoleId) {
        const customRole = customRoles.find(r => r.id === customRoleId);
        if (customRole) {
            return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-purple-500/10 text-purple-500 border-purple-500/20 max-w-full`} title={customRole.name}><span className="truncate">{customRole.name}</span></span>;
        }
    }
    let style = '';
    let label = '';

    switch(role) {
        case 'admin':
            style = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            label = 'Administrador';
            break;
        case 'admin_tecnico':
            style = 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            label = 'Admin Técnico';
            break;
        case 'moderator':
            style = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            label = 'Moderador';
            break;
        case 'client':
            style = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            label = 'Cliente';
            break;
        default: // 'user'
            style = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700';
            label = 'Usuário';
    }

    return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${style} max-w-full`} title={label}><span className="truncate">{label}</span></span>;
  };

  const userTableColumns: DataTableColumn<User>[] = [
    {
      key: 'name',
      header: 'Perfil',
      sortable: true,
      width: '40%',
      render: (_, user) => (
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-black overflow-hidden shrink-0">
                {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                    user.name?.charAt(0) || '?'
                )}
            </div>
            <div className="min-w-0">
                <div className="font-black text-zinc-900 dark:text-white uppercase text-sm tracking-tight truncate">{user.name}</div>
                <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 truncate"><Mail size={10} className="shrink-0"/> <span className="truncate">{user.email}</span></div>
            </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Cargo / Role',
      sortable: true,
      width: '25%',
      render: (_, user) => getRoleBadge(user.role, user.customRoleId)
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '20%',
      render: (_, user) => (
        <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>
            {user.status}
        </span>
      )
    },
    {
      key: 'id',
      header: 'Gestão',
      width: '15%',
      render: (_, user) => (
        <div className="flex justify-end gap-2">
            <button onClick={() => { setUserToManage(user); setIsConfirmResetOpen(true); }} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-amber-500 rounded-xl transition-all" title="Gerar Nova Senha Aleatória"><Key size={16} /></button>
            <button onClick={() => { setSelectedUser(user); setFormData(user); setIsModalOpen(true); }} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-primary-500 rounded-xl transition-all"><Edit2 size={16} /></button>
            {user.id !== currentUser?.id && (
                <button onClick={() => { setUserToManage(user); setIsConfirmDeleteOpen(true); }} className="p-2.5 bg-red-50 dark:bg-red-900/10 text-red-400 hover:text-red-600 rounded-xl transition-all" title="Excluir Usuário"><Trash2 size={16}/></button>
            )}
        </div>
      )
    }
  ];

  const renderUserTable = (usersList: User[], title: string, icon: React.ReactNode) => (
    <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
            {icon}
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{title}</h3>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{usersList.length}</span>
        </div>

        {/* VIEW MOBILE: Cards */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
            {usersList.map(user => (
            <div key={user.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center font-black text-lg border border-primary-500/20 overflow-hidden shrink-0">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                user.name?.charAt(0)
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-black text-zinc-900 dark:text-white uppercase text-sm tracking-tight truncate">{user.name}</h3>
                            <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 truncate mt-0.5">
                                <Mail size={10} className="shrink-0"/> 
                                <span className="truncate">{user.email}</span>
                            </div>
                            <div className="mt-2 sm:hidden inline-flex">
                                {getRoleBadge(user.role, user.customRoleId)}
                            </div>
                        </div>
                    </div>
                    <div className="shrink-0 hidden sm:block">
                        {getRoleBadge(user.role, user.customRoleId)}
                    </div>
                </div>

                <div className="flex items-center justify-between py-3 border-y border-zinc-50 dark:border-zinc-800/50">
                    <span className="text-[10px] font-black uppercase text-zinc-400">Status do Acesso</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>{user.status}</span>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => { setSelectedUser(user); setFormData(user); setIsModalOpen(true); }} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest"><Edit2 size={14}/> Editar</button>
                    <button onClick={() => handleResetPassword(user.id, user.name, user.email)} className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-2xl flex items-center justify-center"><Key size={18}/></button>
                    {user.id !== currentUser?.id && (
                        <button onClick={() => handleDeleteUser(user)} className="w-14 h-14 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center"><Trash2 size={18}/></button>
                    )}
                </div>
            </div>
            ))}
        </div>

        {/* VIEW DESKTOP: Table */}
        <div className="hidden md:block">
            <DataTable 
              data={usersList} 
              columns={userTableColumns} 
              searchable={false}
              itemsPerPage={10}
              className="border-none shadow-sm dark:bg-zinc-900/50"
            />
        </div>
    </div>
  );

  if (!isAdmin) return <div className="py-20 text-center text-zinc-500 uppercase font-black">Acesso Negado</div>;

  return (
    <div className="space-y-8 pb-24">
      {/* Header Responsivo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tight uppercase">{t('userManagement')}</h1>
          <p className="text-zinc-500 mt-2 font-medium">Controle total de permissões e credenciais.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
                onClick={handleSyncDatabase}
                disabled={syncing}
                className="flex-1 sm:flex-none px-6 py-4 bg-zinc-900 dark:bg-zinc-800 text-white rounded-[24px] flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-xl disabled:opacity-50 border border-zinc-700"
            >
                {syncing ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} className="text-primary-500" />}
                {syncing ? 'Sincronizando...' : 'Database Sync'}
            </button>
            <button 
                onClick={() => { setSelectedUser(null); setFormData({ role: 'user', status: 'approved', name: '', email: '' }); setIsModalOpen(true); }} 
                className="flex-1 sm:flex-none bg-primary-500 text-black px-8 py-4 rounded-[24px] flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary-500/20 hover:scale-[1.02] transition-all"
            >
                <Plus size={20} strokeWidth={3} /> NOVO USUÁRIO
            </button>
        </div>
      </div>

      {/* ÁREA DE SOLICITAÇÕES PENDENTES */}
      {pendingUsers.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[32px] p-6 md:p-8 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-500 rounded-xl text-black shadow-lg shadow-amber-500/20">
                      <UserPlus size={20} strokeWidth={2.5}/>
                  </div>
                  <div>
                      <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">Solicitações Pendentes</h3>
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">{pendingUsers.length} novo(s) cadastro(s) aguardando</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pendingUsers.map(user => (
                      <div key={user.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                          <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-400 overflow-hidden shrink-0">
                                      {user.avatarUrl ? (
                                          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                      ) : (
                                          user.name.charAt(0)
                                      )}
                                  </div>
                                  <div>
                                      <p className="text-xs font-black text-zinc-900 dark:text-white uppercase">{user.name}</p>
                                      <p className="text-[10px] text-zinc-500">{user.email}</p>
                                  </div>
                              </div>
                              <span className="text-[9px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-500 uppercase">Novo</span>
                          </div>
                          
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => handleApproveUser(user)}
                                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                              >
                                  <CheckCircle2 size={14} /> Aprovar
                              </button>
                              <button 
                                  onClick={() => handleDeleteUser(user)}
                                  className="flex-1 py-3 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                              >
                                  <XCircle size={14} /> Recusar
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Barra de Busca */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" placeholder="Filtrar por nome ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-zinc-900 dark:text-white" />
        </div>
      </div>

      {/* TABELA EQUIPE INTERNA */}
      {renderUserTable(staffUsers, "Equipe Administrativa", <UserCheck size={16} className="text-zinc-400"/>)}

      {/* SEPARADOR */}
      {clientUsers.length > 0 && <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />}

      {/* TABELA CLIENTES */}
      {clientUsers.length > 0 && renderUserTable(clientUsers, "Acesso de Clientes", <Briefcase size={16} className="text-zinc-400"/>)}

      {/* Modal de Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-md p-8 md:p-10 border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-display font-black uppercase tracking-tight">{selectedUser ? 'Editar Acesso' : 'Novo Colaborador'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Nome Completo</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary-500 transition-all font-bold" />
                </div>
                
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Endereço de E-mail</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input type="email" required value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary-500 transition-all font-bold" />
                    </div>
                </div>

                {!selectedUser && (
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-start gap-3">
                        <ShieldCheck size={20} className="shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold leading-relaxed uppercase tracking-wide">Uma senha segura será gerada automaticamente e exibida na próxima tela para compartilhamento.</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">Cargo</label>
                        <select 
                            value={formData.customRoleId ? `custom:${formData.customRoleId}` : `base:${formData.role}`} 
                            onChange={e => {
                                const val = e.target.value;
                                if (val.startsWith('custom:')) {
                                    setFormData({...formData, role: 'user', customRoleId: val.replace('custom:', '')});
                                } else {
                                    setFormData({...formData, role: val.replace('base:', '') as any, customRoleId: undefined});
                                }
                            }}
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-bold text-[10px] uppercase tracking-widest"
                        >
                            <optgroup label="Cargos do Sistema">
                                <option value="base:user">Usuário</option>
                                <option value="base:moderator">Moderador</option>
                                <option value="base:admin">Admin</option>
                                <option value="base:admin_tecnico">Admin Técnico</option>
                                <option value="base:client">Cliente</option>
                            </optgroup>
                            {customRoles && customRoles.length > 0 && (
                                <optgroup label="Cargos Customizados">
                                    {customRoles.map(r => (
                                        <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">Situação</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-bold text-[10px] uppercase tracking-widest">
                            <option value="approved">Ativo</option>
                            <option value="pending">Pendente</option>
                            <option value="rejected">Bloqueado</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 py-2">
                    <input 
                        type="checkbox" 
                        id="exemptKtag" 
                        checked={formData.exemptFromKtagAlert || false} 
                        onChange={e => setFormData({...formData, exemptFromKtagAlert: e.target.checked})} 
                        className="w-5 h-5 rounded text-primary-500 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 accent-primary-500 focus:ring-primary-500" 
                    />
                    <label htmlFor="exemptKtag" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
                        Isentar deste usuário a obrigatoriedade de revisão e de alertas K-TAG
                    </label>
                </div>

                <div className="pt-2">
                    <button type="submit" className="w-full py-5 bg-primary-500 text-black rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Save size={18} /> {selectedUser ? 'Atualizar Colaborador' : 'Gerar Acesso Seguro'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Credenciais (Sucesso) */}
      {isCredentialsModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
            <div className="bg-zinc-900 rounded-[40px] w-full max-w-md p-10 border border-zinc-800 shadow-2xl relative animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-black mb-6 shadow-2xl shadow-emerald-500/30">
                        <ShieldCheck size={40} />
                    </div>
                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">Credenciais Geradas</h2>
                    <p className="text-zinc-400 text-xs mt-2 font-medium">Copie ou envie os dados abaixo. Por segurança, esta senha não será exibida novamente.</p>
                </div>

                <div className="space-y-4 bg-black/30 p-6 rounded-3xl border border-zinc-800">
                    <div>
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Login / E-mail</label>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-white font-bold">{newCredentials.email}</span>
                            <button onClick={() => copyToClipboard(newCredentials.email)} className="text-zinc-500 hover:text-white"><Copy size={14}/></button>
                        </div>
                    </div>
                    <div className="h-px bg-zinc-800 w-full" />
                    <div>
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Senha Temporária</label>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-emerald-400 font-mono text-xl font-bold tracking-wider">{newCredentials.password}</span>
                            <button onClick={() => copyToClipboard(newCredentials.password)} className="text-zinc-500 hover:text-emerald-400"><Copy size={16}/></button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button 
                        onClick={() => window.open(securityService.generateShareLink('Colaborador', newCredentials.email, newCredentials.password), '_blank')}
                        className="py-4 bg-[#25D366] hover:bg-[#20bd5a] text-black rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                        <Share2 size={16} /> Enviar WhatsApp
                    </button>
                    <button onClick={() => setIsCredentialsModalOpen(false)} className="py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">
                        Fechar Janela
                    </button>
                </div>
            </div>
        </div>
      )}

      <ConfirmModal 
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={() => userToManage && handleDeleteUser(userToManage)}
          title="Excluir Usuário"
          message={`ATENÇÃO: Você está prestes a remover o acesso de ${userToManage?.name}. Esta ação excluirá o usuário permanentemente do banco de dados. Deseja continuar?`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          type="danger"
      />

      <ConfirmModal 
          isOpen={isConfirmResetOpen}
          onClose={() => setIsConfirmResetOpen(false)}
          onConfirm={() => userToManage && handleResetPassword(userToManage.id, userToManage.name, userToManage.email)}
          title="Resetar Senha"
          message={`Deseja gerar uma nova senha aleatória para ${userToManage?.name}? A senha atual será invalidada.`}
          confirmText="Sim, Resetar"
          cancelText="Cancelar"
          type="warning"
      />
    </div>
  );
};
