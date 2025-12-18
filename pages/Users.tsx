
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
  Shield, User as UserIcon, Lock, Save, MoreVertical, ShieldQuestion, Activity, RefreshCcw
} from 'lucide-react';

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User> | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ role: 'user', status: 'approved' });

  const { addNotification } = useNotification();
  const { t } = useLanguage();
  const { isAdmin, user: currentUser } = useAuth();

  const loadData = async () => {
    setLoading(true);
    if (isAdmin) {
      const allUsers = await storage.getAllUsers();
      setUsers(allUsers);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!selectedUser;
      const userId = isEdit ? selectedUser!.id! : crypto.randomUUID();
      const userToSave: User = { ...formData as User, id: userId, createdAt: formData.createdAt || Date.now(), status: formData.status || 'approved' };
      if (isEdit) {
        await storage.updateUserProfile(userId, userToSave);
        await storage.updateUserStatus(userId, userToSave.status!);
      } else {
        await storage.registerUserRequest(userToSave);
      }
      addNotification('success', 'Sucesso', 'Usuário salvo com sucesso.');
      setIsModalOpen(false);
      loadData();
    } catch (err) { addNotification('error', 'Erro', 'Falha ao salvar o colaborador.'); }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Deseja realmente resetar a senha deste usuário? Um e-mail de recuperação será simulado.')) return;
    
    // Simulação de reset
    storage.logAction(currentUser, 'UPDATE', 'User', `Resetou a senha do usuário ${users.find(u => u.id === userId)?.name}`, userId);
    addNotification('success', 'Reset de Senha', 'Uma nova senha temporária foi enviada para o e-mail do usuário.');
  };

  const getRoleBadge = (role?: string) => {
    const style = role === 'admin' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 
                  role === 'moderator' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' : 
                  'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700';
    return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${style}`}>{role}</span>;
  };

  if (!isAdmin) return <div className="py-20 text-center text-zinc-500 uppercase font-black">Acesso Negado</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-zinc-900 dark:text-white tracking-tight uppercase">{t('userManagement')}</h1>
          <p className="text-zinc-500 mt-2 font-medium">Controle de privilégios e níveis de acesso ao sistema.</p>
        </div>
        <button onClick={() => { setSelectedUser(null); setFormData({ role: 'user', status: 'approved', name: '', email: '' }); setIsModalOpen(true); }} className="bg-primary-500 text-black px-8 py-4 rounded-[20px] flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary-500/20 hover:scale-[1.02] transition-all">
          <Plus size={20} strokeWidth={3} /> ADICIONAR USUÁRIO
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-3 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-zinc-900 dark:text-white" />
        </div>
        <div className="px-5 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <Activity size={14} className="text-primary-500" />
            <span className="text-[10px] font-black uppercase text-zinc-500">{users.length} Colaboradores</span>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
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
                    <button onClick={() => handleResetPassword(user.id)} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-amber-500 rounded-xl transition-all" title="Resetar Senha"><RefreshCcw size={16} /></button>
                    <button onClick={() => { setSelectedUser(user); setFormData(user); setIsModalOpen(true); }} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-primary-500 rounded-xl transition-all"><Edit2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-[40px] w-full max-w-md p-10 border border-zinc-200 dark:border-zinc-800 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-display font-black uppercase tracking-tight">Perfil Usuário</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24}/></button>
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
                        <input type="email" required value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:border-primary-500 transition-all font-bold" placeholder="colaborador@empresa.com" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">Nível</label>
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-bold text-xs uppercase tracking-widest">
                            <option value="user">Usuário</option>
                            <option value="moderator">Moderador</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500">Estado</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-bold text-xs uppercase tracking-widest">
                            <option value="approved">Ativo</option>
                            <option value="pending">Pendente</option>
                            <option value="rejected">Bloqueado</option>
                        </select>
                    </div>
                </div>
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                    <button type="submit" className="w-full py-4 bg-primary-500 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Save size={16} /> Gravar Alterações
                    </button>
                    {selectedUser && (
                        <button type="button" onClick={() => handleResetPassword(selectedUser.id!)} className="w-full py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2">
                            <RefreshCcw size={14} /> Resetar Senha
                        </button>
                    )}
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
