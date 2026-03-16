
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import * as ReactRouterDOM from 'react-router-dom';
import { ShieldCheck, ArrowRight, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { xssProtection } from '../services/xssProtection';

const { useNavigate } = ReactRouterDOM as any;

const REMEMBER_KEY = 'ktag_remember_login';

export const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { addNotification } = useNotification();
  const navigate = useNavigate();

  const [emailOrCpf, setEmailOrCpf] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Carrega login salvo ao montar o componente
  useEffect(() => {
    try {
        const savedLogin = localStorage.getItem(REMEMBER_KEY);
        if (savedLogin) {
          // Sanitiza ao carregar para evitar injeção vinda do storage
          const cleanLogin = xssProtection.sanitizeText(savedLogin);
          setEmailOrCpf(cleanLogin);
          setRememberMe(true);
        }
    } catch (e) {
        console.warn("Erro ao acessar LocalStorage (Lembrar Login)", e);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sanitiza o input do usuário
      let loginIdentifier = xssProtection.sanitizeText(emailOrCpf.trim());
      const rawIdentifier = loginIdentifier; // Guarda a versão original sanitizada para salvar
      
      // Lógica de CPF (se for apenas números, transforma em e-mail virtual de cliente)
      if (/^\d+$/.test(loginIdentifier)) {
        loginIdentifier = `${loginIdentifier}@client.ktag`;
      }

      const err = await login(loginIdentifier, password);
      
      if (err) {
        const safeError = xssProtection.sanitizeText(err);
        setError(safeError);
        addNotification('error', 'Falha no Login', safeError);
      } else {
        // Sucesso no login: Trata persistência do "Lembrar-me"
        try {
            if (rememberMe) {
              localStorage.setItem(REMEMBER_KEY, rawIdentifier);
            } else {
              localStorage.removeItem(REMEMBER_KEY);
            }
        } catch (storageErr) {
            console.warn("Falha ao salvar preferência de login", storageErr);
        }
      }
    } catch (e) {
      const safeError = xssProtection.getSafeErrorMessage('SERVER_ERROR');
      setError(safeError);
    } finally {
      setLoading(false);
    }
  };

  const getErrorImage = (errorMsg: string) => {
      const lowerMsg = errorMsg.toLowerCase();
      if (lowerMsg.includes('muitas tentativas')) return 'limit_exceeded.png';
      if (lowerMsg.includes('senha')) return 'wrong_password.png';
      if (lowerMsg.includes('usuário') || lowerMsg.includes('encontrado')) return 'invalid_user.png';
      return null;
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-10"
      >
        {/* Header / Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-2xl mb-6 border border-amber-500/30 shadow-2xl shadow-amber-500/10">
            <span className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">K</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Portal de Acesso
          </h1>
          <p className="mt-3 text-zinc-400 text-lg font-medium">
            Empresas e Clientes, faça seu login abaixo
          </p>
        </div>

        {/* Mensagem de erro com Imagem */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 bg-red-950/60 border border-red-800/60 text-red-200 px-5 py-6 rounded-2xl text-center text-sm"
          >
            {getErrorImage(error) && (
                <img 
                    src={`/${getErrorImage(error)}`} 
                    alt="Error Status" 
                    className="w-24 h-24 object-contain mb-2 opacity-90"
                    onError={(e) => e.currentTarget.style.display = 'none'} // Esconde se imagem não existir
                />
            )}
            <span className="font-bold">{error}</span>
          </motion.div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-zinc-300 uppercase tracking-wider">
              E-mail ou CPF
            </label>
            <input
              type="text"
              required
              value={emailOrCpf}
              onChange={(e) => setEmailOrCpf(e.target.value)}
              className="w-full bg-zinc-900/70 border border-zinc-700 rounded-xl px-5 py-4 text-white placeholder-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 outline-none transition-all text-base font-medium"
              placeholder="exemplo@dominio.com ou 12345678901"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-zinc-300 uppercase tracking-wider">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/70 border border-zinc-700 rounded-xl px-5 py-4 text-white placeholder-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 outline-none transition-all text-base font-medium"
              placeholder="••••••••••••"
            />
          </div>

          {/* Salvar Login Checkbox */}
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <div className="w-5 h-5 bg-zinc-900 border border-zinc-700 rounded-md transition-all peer-checked:bg-amber-500 peer-checked:border-amber-500 group-hover:border-zinc-500 flex items-center justify-center">
                  <Check size={14} className={`text-black transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} />
                </div>
              </div>
              <span className="text-sm font-bold text-zinc-400 group-hover:text-zinc-300 transition-colors uppercase tracking-widest text-[10px]">Salvar meu acesso</span>
            </label>
            
            <button type="button" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-500 transition-colors">Esqueci a senha</button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full h-14 bg-gradient-to-r from-amber-500 to-amber-600 
              hover:from-amber-400 hover:to-amber-500 
              active:from-amber-600 active:to-amber-700
              text-black font-black uppercase tracking-widest text-sm
              rounded-xl shadow-xl shadow-amber-500/20 
              flex items-center justify-center gap-3
              transition-all duration-300
              disabled:opacity-60 disabled:cursor-not-allowed
              hover:scale-[1.02] active:scale-[0.98]
            `}
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                Entrar <ArrowRight className="h-5 w-5" strokeWidth={3} />
              </>
            )}
          </button>
        </form>

        {/* Rodapé */}
        <div className="text-center text-sm text-zinc-400 pt-6 space-y-2">
          <p className="font-medium">
            Primeiro acesso? Use CPF + 6 primeiros dígitos
          </p>
          <p>
            Problemas? Contate sua central de rastreamento
          </p>
          <p className="text-zinc-500 text-xs font-mono tracking-wide pt-4">
            K-Tag Manager • v3.2.2
          </p>
           <p className="text-zinc-500 text-xs font-mono tracking-wide pt-4">
            Developed by <a href="https://lucasmateus.tech" target="_blank" rel="noopener noreferrer">Lucasmateus.tech</a>
          </p>
        </div>
      </motion.div>

      {/* Escudo decorativo */}
      <div className="hidden lg:block fixed bottom-12 right-12 opacity-30 pointer-events-none">
        <ShieldCheck size={120} className="text-amber-500/40" />
      </div>
    </div>
  );
};
