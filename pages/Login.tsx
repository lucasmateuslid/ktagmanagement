import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      login(name || email.split('@')[0], email);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      {/* Background sutil */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-transparent to-blue-50/30 dark:from-primary-900/10 dark:to-transparent -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header com logo e título */}
          <div className="px-10 pt-10 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-6 ring-8 ring-primary-100/50 dark:ring-primary-900/20">
              <ShieldCheck size={40} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              K-TAG Manager
            </h1>
            <p className="mt-3 text-slate-500 dark:text-slate-400 text-lg">
              {t('portalSubtitle') || 'Gerenciamento inteligente de tags veiculares'}
            </p>
          </div>

          {/* Formulário */}
          <div className="px-10 pb-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome (apenas no cadastro) */}
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('fullName') || 'Nome completo'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="João Silva"
                  />
                </motion.div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('email') || 'E-mail'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="admin@ktag.com"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('password') || 'Senha'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>

              {/* Botão principal - Azul clássico */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full mt-8 py-4 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-lg shadow-lg shadow-primary-600/30 transition-all duration-200 flex items-center justify-center gap-3"
              >
                {isLogin ? (
                  <>
                    <LogIn size={20} />
                    {t('signIn') || 'Entrar'}
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    {t('createAccount') || 'Criar conta'}
                  </>
                )}
              </motion.button>
            </form>

            {/* Alternar entre login/cadastro */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
              >
                {isLogin
                  ? t('noAccount') || 'Não tem uma conta? Cadastre-se'
                  : t('haveAccount') || 'Já tem conta? Faça login'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer discreto */}
        <div className="text-center mt-10 text-slate-500 dark:text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Mais Soluções em Monitoramento. Todos os direitos reservados.</p>
        </div>
      </motion.div>
    </div>
  );
};