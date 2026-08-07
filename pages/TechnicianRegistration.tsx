import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../services/storage';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User as UserIcon, CreditCard } from 'lucide-react';
import { formatCPF, isValidCPF } from '../utils/brDocument';

export const TechnicianRegistration = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState(user?.cpf || '');
  const [pixKey, setPixKey] = useState(user?.pixKey || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !pixKey) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (!isValidCPF(cpf)) { setError('Informe um CPF válido. Sequências repetidas não são aceitas.'); return; }

    setLoading(true);
    setError('');

    try {
      if (user) {
        await storage.updateUserProfile(user.id, { cpf, pixKey });
        // Firebase Auth + AuthContext recarregam o user no próximo
        // onAuthStateChanged. Aqui apenas forçamos navegação.
        window.location.href = '/';
      }
    } catch (err) {
      setError('Erro ao salvar os dados. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
            Completar Cadastro
          </h1>
          <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-2">
            Para receber pagamentos pelos serviços, precisamos de algumas informações adicionais.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider mb-2 block">
              CPF
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                <UserIcon size={18} />
              </div>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider mb-2 block">
              Chave PIX
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                <CreditCard size={18} />
              </div>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, E-mail, Telefone ou Aleatória"
                className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar e Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
};
