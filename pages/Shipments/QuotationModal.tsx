import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Package, MapPin, Calculator, Truck } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { storage } from '../../services/storage';
import { AppSettings, ShippingPackage } from '../../types';

export const QuotationModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [formData, setFormData] = useState({
    fromPostalCode: '',
    toPostalCode: '',
    weight: '1',
    width: '11',
    height: '2',
    length: '16',
    insuranceValue: '100',
    quantity: '1'
  });
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      storage.getSettings().then(s => {
        if (s) {
          setSettings(s as AppSettings);
          setFormData(prev => ({
            ...prev,
            fromPostalCode: s.melhorEnvioSenderAddress?.postalCode || prev.fromPostalCode
          }));
        }
      });
      setStep(1);
      setResults([]);
    }
  }, [isOpen]);

  const handleSelectPackage = (pkgId: string) => {
    if (!settings?.melhorEnvioPackages) return;
    const pkg = settings.melhorEnvioPackages.find((p: ShippingPackage) => p.id === pkgId);
    if (!pkg) return;
    setFormData(prev => ({
      ...prev,
      weight: String(pkg.weight),
      width: String(pkg.width),
      height: String(pkg.height),
      length: String(pkg.length),
      insuranceValue: String(pkg.insuranceValue)
    }));
  };

  const handleCalculate = async () => {
    if (!formData.fromPostalCode || !formData.toPostalCode) {
      addNotification('info', 'Atenção', 'Preencha os CEPs de origem e destino');
      return;
    }

    setLoading(true);
    try {
      const env = settings?.melhorEnvioEnvironment || 'sandbox';
      const token = env === 'production' ? settings?.melhorEnvioProdToken : settings?.melhorEnvioSandboxToken;
      const refreshToken = env === 'production' ? settings?.melhorEnvioProdRefreshToken : settings?.melhorEnvioSandboxRefreshToken;
      
      if (!token) {
        addNotification('error', 'Token não configurado', 'O token da API do Melhor Envio não está configurado para o ambiente ativo.');
        setLoading(false);
        return;
      }

      const payload = {
        token,
        environment: env,
        from: { postal_code: formData.fromPostalCode.replace(/\D/g, '') },
        to: { postal_code: formData.toPostalCode.replace(/\D/g, '') },
        products: [
          {
            id: 'x',
            width: Number(formData.width),
            height: Number(formData.height),
            length: Number(formData.length),
            weight: Number(formData.weight),
            insurance_value: Number(formData.insuranceValue),
            quantity: Number(formData.quantity)
          }
        ]
      };

      let res = await fetch('/api/melhorenvio/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 && refreshToken) {
        console.log("Token expired, attempting to refresh...");
        const clientId = env === 'production' ? settings?.melhorEnvioProdClientId : settings?.melhorEnvioSandboxClientId;
        const clientSecret = env === 'production' ? settings?.melhorEnvioProdClientSecret : settings?.melhorEnvioSandboxClientSecret;

        const refreshRes = await fetch('/api/melhorenvio/oauth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refreshToken,
            clientId,
            clientSecret,
            environment: env
          })
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          // Save new settings
          const newSettings: any = { ...settings };
          if (env === 'production') {
            newSettings.melhorEnvioProdToken = refreshData.access_token;
            newSettings.melhorEnvioProdRefreshToken = refreshData.refresh_token;
            newSettings.melhorEnvioProdExpiresAt = Date.now() + (refreshData.expires_in * 1000);
          } else {
            newSettings.melhorEnvioSandboxToken = refreshData.access_token;
            newSettings.melhorEnvioSandboxRefreshToken = refreshData.refresh_token;
            newSettings.melhorEnvioSandboxExpiresAt = Date.now() + (refreshData.expires_in * 1000);
          }
          await storage.saveSettings(newSettings);
          
          // Retry calculate with new token
          payload.token = refreshData.access_token;
          res = await fetch('/api/melhorenvio/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao calcular frete');

      setResults(data);
      setStep(2);
    } catch (error: any) {
      addNotification('error', 'Erro na cotação', error.message || 'Falha ao conectar com Melhor Envio');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 text-emerald-500">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Calculator size={20} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Cotação Melhor Envio</h2>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto">
              {step === 1 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">CEP Origem</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input type="text" value={formData.fromPostalCode} onChange={(e) => setFormData({...formData, fromPostalCode: e.target.value})} placeholder="00000-000" className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">CEP Destino</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input type="text" value={formData.toPostalCode} onChange={(e) => setFormData({...formData, toPostalCode: e.target.value})} placeholder="00000-000" className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><Package size={14} /> Pacote</div>
                      {settings?.melhorEnvioPackages && settings.melhorEnvioPackages.length > 0 && (
                        <select 
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[10px] font-bold uppercase outline-none text-emerald-600 dark:text-emerald-400 cursor-pointer"
                          onChange={(e) => handleSelectPackage(e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>SELECIONAR PREDEFINIDO</option>
                          {settings.melhorEnvioPackages.map((pkg: ShippingPackage) => (
                            <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                          ))}
                        </select>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Peso (kg)</label>
                        <input type="number" step="0.1" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Valor Segurado</label>
                        <input type="number" value={formData.insuranceValue} onChange={(e) => setFormData({...formData, insuranceValue: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Larg. (cm)</label>
                        <input type="number" value={formData.width} onChange={(e) => setFormData({...formData, width: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alt. (cm)</label>
                        <input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Comp. (cm)</label>
                        <input type="number" value={formData.length} onChange={(e) => setFormData({...formData, length: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-sm font-medium">Voltar</button>
                    <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Resultados</span>
                  </div>
                  
                  {results.length > 0 ? (
                    <div className="space-y-3">
                      {results
                        .filter(opt => !opt.error) // Remove opções com erro na API
                        .sort((a, b) => Number(a.custom_price) - Number(b.custom_price))
                        .map((option, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden p-2">
                              {option.company?.picture ? (
                                <img src={option.company.picture} alt={option.company.name} className="w-full h-full object-contain" />
                              ) : (
                                <Truck size={20} className="text-zinc-400" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-zinc-900 dark:text-white leading-none">{option.company?.name || 'Transportadora'} - {option.name}</h4>
                              <p className="text-[11px] text-zinc-500 mt-1 font-medium">Entrega em até {option.custom_delivery_time} dias úteis</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-emerald-500">R$ {option.custom_price}</div>
                            {option.price && option.price !== option.custom_price && (
                              <div className="line-through text-[10px] text-zinc-400">R$ {option.price} no balcão</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-zinc-500 text-sm">
                      Nenhuma transportadora atende esse trecho.
                    </div>
                  )}
                </div>
              )}
            </div>

            {step === 1 && (
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <button 
                  onClick={handleCalculate}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-colors"
                >
                  {loading ? (
                    <div className="flex gap-1 items-center"><Calculator className="animate-pulse" size={18} />Calculando...</div>
                  ) : (
                    <><Calculator size={18} /> Obter Cotação</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
