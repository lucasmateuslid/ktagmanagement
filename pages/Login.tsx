
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Loader2, Check, AtSignIcon, ChevronLeftIcon, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import { xssProtection } from '../services/xssProtection';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { storage } from '../services/storage';

const REMEMBER_KEY = 'ktag_remember_login';

function FloatingPaths({ position }: { position: number }) {
	const paths = Array.from({ length: 36 }, (_, i) => ({
		id: i,
		d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
			380 - i * 5 * position
		} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
			152 - i * 5 * position
		} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
			684 - i * 5 * position
		} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
		color: `rgba(245,158,11,${0.1 + i * 0.03})`, // Amberish
		width: 0.5 + i * 0.03,
	}));

	return (
		<div className="pointer-events-none absolute inset-0">
			<svg
				className="h-full w-full text-amber-500/50"
				viewBox="0 0 696 316"
				fill="none"
			>
				<title>Background Paths</title>
				{paths.map((path) => (
					<motion.path
						key={path.id}
						d={path.d}
						stroke="currentColor"
						strokeWidth={path.width}
						strokeOpacity={0.1 + path.id * 0.03}
						initial={{ pathLength: 0.3, opacity: 0.6 }}
						animate={{
							pathLength: 1,
							opacity: [0.3, 0.6, 0.3],
							pathOffset: [0, 1, 0],
						}}
						transition={{
							duration: 20 + Math.random() * 10,
							repeat: Number.POSITIVE_INFINITY,
							ease: 'linear',
						}}
					/>
				))}
			</svg>
		</div>
	);
}

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
  const [appSettings, setAppSettings] = useState<{appName?: string, appLogo?: string} | null>(null);

  useEffect(() => {
    try {
        const savedLogin = localStorage.getItem(REMEMBER_KEY);
        if (savedLogin) {
          const cleanLogin = xssProtection.sanitizeText(savedLogin);
          setEmailOrCpf(cleanLogin);
          setRememberMe(true);
        }
    } catch (e) {
        console.warn("Erro ao acessar LocalStorage", e);
    }
  }, []);

  useEffect(() => {
     const loadSettings = async () => {
         try {
             const settings = await storage.getSettings();
             setAppSettings({
                 appName: settings.customAppName,
                 appLogo: settings.customLogoUrlDark || settings.customLogoUrlLight
             });
         } catch(e) {
             console.log(e);
         }
     };
     loadSettings();
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let loginIdentifier = xssProtection.sanitizeText(emailOrCpf.trim());
      const rawIdentifier = loginIdentifier;
      
      if (/^\d+$/.test(loginIdentifier)) {
        loginIdentifier = `${loginIdentifier}@client.ktag`;
      }

      const err = await login(loginIdentifier, password);
      
      if (err) {
        const safeError = xssProtection.sanitizeText(err);
        setError(safeError);
        addNotification('error', 'Falha no Login', safeError);
      } else {
        try {
            if (rememberMe) {
              localStorage.setItem(REMEMBER_KEY, rawIdentifier);
            } else {
              localStorage.removeItem(REMEMBER_KEY);
            }
        } catch (storageErr) {
            console.warn("Falha ao salvar", storageErr);
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
		<main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2 bg-black text-white">
			<div className="bg-zinc-950/60 relative hidden h-full flex-col border-r border-zinc-800 p-10 lg:flex">
				<div className="from-black absolute inset-0 z-10 bg-gradient-to-t to-transparent" />
				<div className="z-10 flex items-center gap-4">
                  {appSettings?.appLogo ? (
                     <img src={appSettings.appLogo} alt="Logo" className="w-12 h-12 object-contain" />
                  ) : (
					<div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-500/10">
                        <span className="text-2xl font-black text-amber-500 tracking-tighter drop-shadow-lg">K</span>
                    </div>
                  )}
					<p className="text-xl font-black uppercase tracking-widest text-zinc-300">{appSettings?.appName || 'Manager Pro'}</p>
				</div>
				<div className="z-10 mt-auto mb-10">
					<blockquote className="space-y-4">
						<p className="text-xl text-zinc-300 font-medium leading-relaxed">
							&ldquo;Controle total sobre sua frota e estoque de dispositivos com precisão e velocidade excepcionais.&rdquo;
						</p>
						<footer className="font-mono text-sm font-semibold text-amber-500 uppercase tracking-widest">
							~ Portal de Acesso
						</footer>
					</blockquote>
				</div>
				<div className="absolute inset-0 opacity-40">
					<FloatingPaths position={1} />
					<FloatingPaths position={-1} />
				</div>
			</div>

			<div className="relative flex min-h-screen flex-col justify-center p-6">
				<div
					aria-hidden
					className="absolute inset-0 isolate contain-strict -z-10 opacity-60"
				>
					<div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,rgba(245,158,11,0.06)_0,rgba(255,255,255,0.02)_50%,transparent_80%)] absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full" />
					<div className="bg-[radial-gradient(50%_50%_at_50%_50%,rgba(245,158,11,0.04)_0,transparent_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full" />
				</div>

				<div className="mx-auto space-y-6 sm:w-full max-w-sm">
					<div className="flex items-center gap-3 lg:hidden mb-8">
                        {appSettings?.appLogo ? (
                           <img src={appSettings.appLogo} alt="Logo" className="w-12 h-12 object-contain" />
                        ) : (
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-xl border border-amber-500/30">
                              <span className="text-2xl font-black text-amber-500 tracking-tighter">K</span>
                            </div>
                        )}
						<p className="text-xl font-black uppercase tracking-widest">{appSettings?.appName || 'Manager Pro'}</p>
					</div>

					<div className="flex flex-col space-y-2 mb-8">
						<h1 className="font-heading text-3xl font-black tracking-wide text-white">
							Entrar agora
						</h1>
						<p className="text-zinc-400 text-base font-medium">
							Acesse sua conta para continuar.
						</p>
					</div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 bg-red-950/40 border border-red-900/50 text-red-200 px-5 py-4 rounded-xl text-center text-sm"
            >
              {getErrorImage(error) && (
                  <img 
                      src={`/${getErrorImage(error)}`} 
                      alt="Error Status" 
                      className="w-16 h-16 object-contain mb-1 opacity-90"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                  />
              )}
              <span className="font-bold">{error}</span>
            </motion.div>
          )}

					<form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <p className="text-zinc-400 text-start text-xs font-bold uppercase tracking-widest mb-2">
                Credenciais
              </p>
              <div className="relative h-max mb-3">
                <Input
                  className="peer ps-10"
                  type="text"
                  required
                  value={emailOrCpf}
                  onChange={(e) => setEmailOrCpf(e.target.value)}
                  placeholder="E-mail ou CPF"
                  autoComplete="username"
                />
                <div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                  <AtSignIcon className="size-4" aria-hidden="true" />
                </div>
              </div>

              <div className="relative h-max">
                <Input
                  className="peer ps-10"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <div className="text-zinc-500 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                  <Fingerprint className="size-4" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pb-2">
              <Checkbox checked={rememberMe} onChange={setRememberMe}>
                <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-300 transition-colors uppercase tracking-widest mt-0.5">Lembrar</span>
              </Checkbox>
              
              <button type="button" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-500 transition-colors">Esqueci a senha</button>
            </div>

						<Button type="submit" disabled={loading} size="lg" className="w-full font-black uppercase tracking-widest shadow-xl shadow-amber-500/10">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>Entrar <ArrowRight className="h-4 w-4 ml-2" strokeWidth={3} /></>
              )}
						</Button>
					</form>

					<p className="text-zinc-500 mt-8 text-xs font-medium leading-relaxed">
						Primeiro acesso? Use CPF + 6 primeiros dígitos. By clicking continue, you agree to our{' '}
						<a
							href="#"
							className="hover:text-amber-500 underline underline-offset-4"
						>
							Terms of Service
						</a>{' '}
						and{' '}
						<a
							href="#"
							className="hover:text-amber-500 underline underline-offset-4"
						>
							Privacy Policy
						</a>
						.
					</p>
				</div>
			</div>
		</main>
	);
}
