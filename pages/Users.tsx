
import * as React from 'react';
import { useEffect, useState } from 'react';
import { storage } from '../services/storage';
import { User } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Users as UsersIcon, Check, X, Trash2, Loader2, ShieldAlert, Mail, Calendar } from 'lucide-react';

export const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  useEffect(() => {
    const load = async () => {
      if (isAdmin) {
        const allUsers = await storage.getAllUsers();
        setUsers(allUsers);
      }
      setLoading(false);
    };
    load();
  }, [isAdmin]);

  const handleUserAction = async (userId: string, action: 'approved' | 'rejected') => {
    await storage.updateUserStatus(userId, action);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: action } : u));
    addNotification('success', 'User Updated', `User has been ${action}.`);
  };

  const handleDeleteUser = async (userId: string) => {
      if(!confirm("Are you sure you want to permanently delete this user?")) return;
      // Optimistic update
      setUsers(prev => prev.filter(u => u.id !== userId));
      // Perform delete (soft delete/reject in storage for now based on previous logic, or implement real delete if storage supports it)
      await storage.updateUserStatus(userId, 'rejected'); 
      addNotification('success', 'User Deleted', 'User removed from list.');
  };

  if (!isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ShieldAlert size={48} className="mb-4 text-red-500" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Acesso Negado</h2>
            <p>Apenas administradores podem gerenciar usuários.</p>
        </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-3 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
          <UsersIcon size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('userManagement')}</h1>
          <p className="text-zinc-500">{t('manageAccess')}</p>
        </div>
      </div>

      {/* --- DESKTOP TABLE --- */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 uppercase border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                    <th className="px-6 py-3">{t('fullName')}</th>
                    <th className="px-6 py-3">{t('email')}</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3">{t('repDate')}</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">{t('actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {users.filter(u => u.email !== 'lucasmateus.lima@outlook.com').map(user => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">
                            {user.name}
                            {user.status === 'pending' && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-blue-500 animate-pulse" />}
                        </td>
                        <td className="px-6 py-4 text-zinc-500">{user.email}</td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-500">{user.ip || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            user.status === 'approved' ? 'bg-green-100 text-green-700' :
                            user.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                        }`}>
                            {user.status || 'Unknown'}
                        </span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                            {user.status === 'pending' && (
                                <>
                                <button 
                                    onClick={() => handleUserAction(user.id, 'approved')}
                                    className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                    title="Approve"
                                >
                                    <Check size={16} />
                                </button>
                                <button 
                                    onClick={() => handleUserAction(user.id, 'rejected')}
                                    className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                                    title="Reject"
                                >
                                    <X size={16} />
                                </button>
                                </>
                            )}
                            {user.status !== 'pending' && (
                                <button 
                                onClick={() => handleUserAction(user.id, user.status === 'approved' ? 'rejected' : 'approved')}
                                className="text-xs text-blue-500 hover:text-blue-700 underline px-2 font-medium"
                                >
                                {user.status === 'approved' ? 'Revoke' : 'Approve'}
                                </button>
                            )}
                            <button 
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                                title="Delete User"
                            >
                                <Trash2 size={16} />
                            </button>
                        </td>
                    </tr>
                    ))}
                    {users.filter(u => u.email !== 'lucasmateus.lima@outlook.com').length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('noNotifications')}</td>
                    </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- MOBILE CARD VIEW --- */}
      <div className="md:hidden space-y-4">
        {users.filter(u => u.email !== 'lucasmateus.lima@outlook.com').map(user => (
            <div key={user.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                {user.name}
                                {user.status === 'pending' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                                <Mail size={12} />
                                {user.email}
                            </div>
                        </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        user.status === 'approved' ? 'bg-green-100 text-green-700' :
                        user.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                    }`}>
                        {user.status || 'Unk'}
                    </span>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-400 mb-4 px-1">
                    <span className="font-mono">IP: {user.ip || 'N/A'}</span>
                    <span className="flex items-center gap-1"><Calendar size={12}/> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
                </div>

                <div className="flex gap-2">
                    {user.status === 'pending' ? (
                        <>
                            <button 
                                onClick={() => handleUserAction(user.id, 'approved')}
                                className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200 flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> Aprovar
                            </button>
                            <button 
                                onClick={() => handleUserAction(user.id, 'rejected')}
                                className="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold border border-red-200 flex items-center justify-center gap-2"
                            >
                                <X size={16} /> Rejeitar
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => handleUserAction(user.id, user.status === 'approved' ? 'rejected' : 'approved')}
                            className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-sm font-medium"
                        >
                            {user.status === 'approved' ? 'Revogar Acesso' : 'Re-aprovar'}
                        </button>
                    )}
                    <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="w-10 py-2 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-lg flex items-center justify-center"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
