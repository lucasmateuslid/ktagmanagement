
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { storage } from '../services/storage';
import { User } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users as UsersIcon, Check, X, Trash2, Loader2, ShieldAlert, 
  Mail, Calendar, Edit2, Plus, Search, ShieldCheck, UserCog, 
  Shield, User as UserIcon, Lock, Save, MoreVertical, ShieldQuestion, 
  Activity, RefreshCcw, Database, Eye, EyeOff, Smartphone
} from 'lucide-react';

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User> | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ role: 'user', status: 'approved', password: '' });

  const { addNotification } = useNotification();
  const { t } = useLanguage();
  const { isAdmin, user: currentUser } = useAuth();

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (isAdmin) {
      // getAllUsers no storage.ts já foi atualizado para sincronizar o cache local
      const allUsers = await storage.getAllUsers();
      setUsers(allUsers);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  const handleSyncDatabase = async () => {
    setSyncing(true);
    try {
        // Força a atualização do localStorage com os dados do servidor
        const freshUsers = await storage.getAllUsers();
        setUsers(freshUsers);
        storage.logAction(currentUser, 'CONFIG', 'Database', 'Sincronizou manualmente o banco de usuários para acesso local');
        addNotification('success', 'Banco Sincronizado', 'As credenciais mais recentes foram carregadas para este dispositivo.');
    } catch (err) {
        addNotification('error', 'Erro na Sincronização', 'Não foi possível conectar ao servidor de dados.');
    } finally {
        setSyncing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
        addNotification('error', 'Erro', 'Nome e E-mail são obrigatórios.');
        return;
    }

    try {
      const isEdit = !!selectedUser;
      const userId = isEdit ? selectedUser!.id! : crypto.randomUUID();
      
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
        if (!userToSave.password) userToSave.password = '123456';
        await storage.registerUserRequest(userToSave);
      }
      
      storage.logAction(currentUser, isEdit ? 'UPDATE' : 'CREATE', 'User', `${isEdit ? 'Editou' : 'Criou'} o colaborador ${userToSave.name} com senha personalizada`, userId);
      
      addNotification('success', 'Dados Gravados', 'Usuário salvo com sucesso no servidor e sincronizado localmente.');
      setIsModalOpen(false);
      loadData(true);
    } catch (err) { 
        addNotification('error', 'Erro', 'Falha ao salvar o colaborador.'); 
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Deseja realmente resetar a senha deste usuário para o padrão "123456"?')) return;
    
    try {
        await storage.updateUserProfile(userId, { password: '123456' });
        storage.logAction(currentUser, 'UPDATE', 'User', `Resetou a senha do usuário ${users.find(u => u.id === userId)?.name} para o padrão`, userId);
        addNotification('success', 'Senha Resetada', 'A senha padrão agora é: 123456');
        loadData(true);
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao resetar senha.');
    }
  };

  const getRoleBadge = (role?: string) => {
    const style = role === 'admin' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 
                  role === 'moderator' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' : 
                  'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700';
    return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${style}`}>{role}</span>;
  };

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
                onClick={() => { setSelectedUser(null); setFormData({ role: 'user', status: 'approved', name: '', email: '', password: '' }); setIsModalOpen(true); }} 
                className="flex-1 sm:flex-none bg-primary-500 text-black px-8 py-4 rounded-[24px] flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary-500/20 hover:scale-[1.02] transition-all"
            >
                <Plus size={20} strokeWidth={3} /> NOVO USUÁRIO
            </button>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white dark:bg-zinc-900 p-3 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" placeholder="Filtrar por nome ou e-mail..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-zinc-900 dark:text-white" />
        </div>
        <div className="hidden md:flex px-5 items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <Activity size={14} className="text-primary-500" />
            <span className="text-[10px] font-black uppercase text-zinc-500">{users.length} Colaboradores</span>
        </div>
      </div>

      {/* VIEW MOBILE: Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center font-black text-lg border border-primary-500/20">
                     {user.name?.charAt(0)}
                   </div>
                   <div>
                      <h3 className="font-black text-zinc-900 dark:text-white uppercase text-sm tracking-tight">{user.name}</h3>
                      <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1"><Mail size={10}/> {user.email}</div>
                   </div>
                </div>
                {getRoleBadge(user.role)}
             </div>

             <div className="flex items-center justify-between py-3 border-y border-zinc-50 dark:border-zinc-800/50">
                <span className="text-[10px] font-black uppercase text-zinc-400">Status do Acesso</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>{user.status}</span>
             </div>

             <div className="flex gap-2">
                <button onClick={() => { setSelectedUser(user); setFormData(user); setIsModalOpen(true); }} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest"><Edit2 size={14}/> Editar</button>
                <button onClick={() => handleResetPassword(user.id)} className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-2xl flex items-center justify-center"><RefreshCcw size={18}/></button>
             </div>
          </div>
        ))}
      </div>

      {/* VIEW DESKTOP: Table */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-[32px] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800">
            <tr>
              <th className="px-8 py-5">Perfil</th>
              <th className="px-8 py-5">Cargo / Role</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-black">{user.name?.charAt(0) || '?'}</div>
                    <div>
                      <div className="font-black text-zinc-900 dark:text-white uppercase text-sm tracking-tight">{user.name}</div>
                      <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1"><Mail size={10}/> {user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">{getRoleBadge(user.role)}</td>
                <td className="px-8 py-5">
                   <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>{user.status}</span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleResetPassword(user.id)} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-amber-500 rounded-xl transition-all" title="Resetar Senha Padrão"><RefreshCcw size={16} /></button>
                    <button onClick={() => { setSelectedUser(user); setFormData(user); setIsModalOpen(true); }} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-primary-500 rounded-xl transition-all"><Edit2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Usuário Reestilizado */}
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

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Definir Senha de Acesso</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input 
                            type={showPassword ? 'text' : 'password'} 
                            required={!selectedUser}
                            value={formData.password || ''} 
                            onChange={e => setFormData({...formData, password: e.target.value})} 
                            className="w-full pl-11 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary-500 transition-all font-bold text-sm" 
                            placeholder={selectedUser ? "Mantenha vazio para não alterar" : "Mínimo 6 caracteres"}
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">Cargo / Permissão</label>
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-bold text-[10px] uppercase tracking-widest">
                            <option value="user">Usuário</option>
                            <option value="moderator">Moderador</option>
                            <option value="admin">Admin</option>
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

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                    <button type="submit" className="w-full py-5 bg-primary-500 text-black rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Save size={18} /> {selectedUser ? 'Atualizar Colaborador' : 'Criar Novo Acesso'}
                    </button>
                    <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                       <Smartphone size={14} className="text-zinc-400" />
                       <span className="text-[9px] font-bold text-zinc-400 uppercase leading-tight">O usuário poderá logar imediatamente após salvar e sincronizar o banco.</span>
                    </div>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
