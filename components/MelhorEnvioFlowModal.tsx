import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Package, MapPin, Calculator, Truck, ShoppingCart, CheckCircle2, FileText, Loader2, AlertTriangle, ExternalLink, QrCode } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { storage } from '../services/storage';
import { Shipment } from '../types';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const MelhorEnvioFlowModal = ({ 
  isOpen, 
  onClose, 
  shipment,
  onComplete
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  shipment: Shipment | null;
  onComplete: () => void;
}) => {
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'QUOTE' | 'SELECT' | 'CART' | 'CHECKOUT' | 'GENERATE' | 'PRINT' | 'DONE'>('QUOTE');
  
  const [settings, setSettings] = useState<any>(null);

  // Form
  const [fromPostalCode, setFromPostalCode] = useState('');
  const [toPostalCode, setToPostalCode] = useState('');
  const [packageParams, setPackageParams] = useState({
    weight: '1', width: '12', height: '4', length: '17', insuranceValue: '100', quantity: '1'
  });
  const [fromAddress, setFromAddress] = useState({
    name: 'Logistica KTag', phone: '11999999999', email: 'logistica@ktag.com.br', document: '12345678909',
    address: 'Rua Origem', number: '100', district: 'Centro', city: 'São Paulo', state_abbr: 'SP', country_id: 'BR'
  });

  // Flow State
  const [results, setResults] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [melhorEnvioOrderId, setMelhorEnvioOrderId] = useState<string | null>(null);
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && shipment) {
      storage.getSettings().then(s => {
        setSettings(s);
        const st = s as any;
        if (st?.melhorEnvioSenderAddress) {
           const addr = st.melhorEnvioSenderAddress;
           setFromAddress({
             name: addr.name || 'Logistica',
             phone: addr.phone || '11999999999',
             email: addr.email || 'logistica@ktag.com.br',
             document: addr.document || '12345678909',
             address: addr.street || 'Rua',
             number: addr.number || '0',
             district: addr.neighborhood || 'Bairro',
             city: addr.city || 'Cidade',
             state_abbr: addr.state || 'SP',
             country_id: 'BR'
           });
           setFromPostalCode(addr.postalCode || '');
        }
      });
      
      if (shipment.melhorEnvio) {
         if (shipment.melhorEnvio.urlPrint) {
           setStep('PRINT');
           setPrintUrl(shipment.melhorEnvio.urlPrint);
           setTrackingCode(shipment.melhorEnvio.tracking || null);
           return;
         }
         if (shipment.melhorEnvio.status === 'generated') {
           setStep('GENERATE');
           setMelhorEnvioOrderId(shipment.melhorEnvio.orderId || null);
           return;
         }
      }

      setStep('QUOTE');
      setResults([]);
      setSelectedOption(null);
      // Try to extract destination CEP from shipment address if possible
      // (This usually requires Geocoding, but let's assume the user can type it or it's formatted as standard)
      const cepMatch = shipment.destinatario?.enderecoCompleto?.match(/\d{5}-\d{3}/);
      if (cepMatch) {
         setToPostalCode(cepMatch[0].replace(/\D/g, ''));
      }
    }
  }, [isOpen, shipment]);

  const getToken = async () => {
    const env = settings?.melhorEnvioEnvironment || 'sandbox';
    return env === 'production' ? settings?.melhorEnvioProdToken : settings?.melhorEnvioSandboxToken || null;
  };

  const handleQuote = async () => {
    if (!fromPostalCode || !toPostalCode) {
      addNotification('info', 'Atenção', 'Preencha os CEPs de origem e destino');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("API não autorizada nas Configurações");

      const payload = {
        token,
        environment: settings?.melhorEnvioEnvironment || 'sandbox',
        from: { postal_code: fromPostalCode },
        to: { postal_code: toPostalCode },
        products: [{
          id: 'x',
          width: Number(packageParams.width), height: Number(packageParams.height), length: Number(packageParams.length),
          weight: Number(packageParams.weight), insurance_value: Number(packageParams.insuranceValue), quantity: Number(packageParams.quantity)
        }]
      };

      const res = await fetch('/api/melhorenvio/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao calcular frete');

      setResults(Array.isArray(data) ? data : []);
      setStep('SELECT');
    } catch (err: any) {
      addNotification('error', 'Erro', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedOption) return;
    setLoading(true);
    try {
      const token = await getToken();
      
      const payload = {
        token,
        environment: settings?.melhorEnvioEnvironment || 'sandbox',
        service: selectedOption.id,
        agency: selectedOption.company?.name?.toLowerCase().includes('jadlog') ? 1 : null, // Simplificado, ideal é buscar agencia
        from: {
          ...fromAddress, postal_code: fromPostalCode
        },
        to: {
          name: shipment?.destinatario?.nome || 'Destinatário',
          phone: '11999999999', // Fictitious if missing
          email: 'cliente@exemplo.com',
          document: '12345678909', // CPF fictício
          address: shipment?.destinatario?.enderecoCompleto?.split(',')[0] || 'Rua',
          number: 'S/N', district: 'Centro', city: 'São Paulo', state_abbr: 'SP', country_id: 'BR',
          postal_code: toPostalCode
        },
        products: [{ name: 'Equipamentos (Rastreador/Tag)', quantity: 1, unitary_value: Number(packageParams.insuranceValue) }],
        volumes: [{
          height: Number(packageParams.height), width: Number(packageParams.width), length: Number(packageParams.length), weight: Number(packageParams.weight)
        }],
        options: {
          insurance_value: Number(packageParams.insuranceValue),
          non_commercial: true, // Sem NF para este painel inicial
        }
      };

      const res = await fetch('/api/melhorenvio/cart', {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Melhor Envio full error details:", data);
        let errorMsg = data.error;
        if (data.details && Object.keys(data.details).length > 0) {
          const detailStr = JSON.stringify(data.details);
          errorMsg = `${data.error} - Detalhes: ${detailStr}`;
        }
        throw new Error(errorMsg || 'Erro ao adicionar ao carrinho');
      }

      setMelhorEnvioOrderId(data.id);
      
      // Update local shipment status
      if (shipment) {
        shipment.melhorEnvio = {
          orderId: data.id,
          status: 'pending',
          serviceId: selectedOption.id,
          price: selectedOption.custom_price || selectedOption.price
        };
        await storage.saveShipment(shipment);
      }
      
      setStep('CHECKOUT');
      addNotification('success', 'Sucesso', 'Adicionado ao carrinho do Melhor Envio');
    } catch (err: any) {
      addNotification('error', 'Erro', err.message);
    } finally {
       setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!melhorEnvioOrderId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/melhorenvio/checkout', {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, environment: settings?.melhorEnvioEnvironment || 'sandbox', orders: [melhorEnvioOrderId] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no checkout. Verifique saldo na sua carteira Melhor Envio.');

      if (shipment) {
         shipment.melhorEnvio = { ...(shipment.melhorEnvio || {}), status: 'released' };
         await storage.saveShipment(shipment);
      }
      addNotification('success', 'Pago', 'Checkout realizado com sucesso!');
      setStep('GENERATE');
    } catch (err: any) {
      addNotification('error', 'Erro Checkout', err.message);
    } finally {
       setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!melhorEnvioOrderId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/melhorenvio/generate', {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, environment: settings?.melhorEnvioEnvironment || 'sandbox', orders: [melhorEnvioOrderId] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar etiqueta');

      const tracking = data[0]?.tracking;
      setTrackingCode(tracking);

      if (shipment) {
         shipment.melhorEnvio = { ...(shipment.melhorEnvio || {}), status: 'generated', tracking };
         shipment.codigoRastreio = tracking;
         await storage.saveShipment(shipment);
      }

      // Now request print URL
      const printRes = await fetch('/api/melhorenvio/print', {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, environment: settings?.melhorEnvioEnvironment || 'sandbox', orders: [melhorEnvioOrderId], mode: 'public' })
      });
      const printData = await printRes.json();
      
      if (printData.url) {
        setPrintUrl(printData.url);
        if (shipment) {
           shipment.melhorEnvio = { ...(shipment.melhorEnvio || {}), urlPrint: printData.url };
           await storage.saveShipment(shipment);
        }
      }

      addNotification('success', 'Gerada', 'Etiqueta gerada com rastreio: ' + tracking);
      setStep('PRINT');
    } catch (err: any) {
      addNotification('error', 'Erro', err.message);
    } finally {
       setLoading(false);
    }
  };

  if (!isOpen || !shipment) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 text-emerald-500">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Truck size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Envio: {shipment.titulo}</h2>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 md:p-8 overflow-y-auto">
            {step === 'QUOTE' && (
              <div className="space-y-6">
                <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/10">
                   <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Informe os CEPs e medidas do pacote para cotar os valores com o Melhor Envio.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">CEP Origem (Remetente)</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                      <input type="text" value={fromPostalCode} onChange={(e) => setFromPostalCode(e.target.value.replace(/\D/g, ''))} maxLength={8} placeholder="00000000" className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">CEP Destino (Destinatário)</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                      <input type="text" value={toPostalCode} onChange={(e) => setToPostalCode(e.target.value.replace(/\D/g, ''))} maxLength={8} placeholder="00000000" className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Package size={14} /> Detalhes do Pacote</h3>
                    {settings?.melhorEnvioPackages && settings.melhorEnvioPackages.length > 0 && (
                      <select 
                        className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[10px] font-bold uppercase outline-none text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        onChange={(e) => {
                          const pkg = settings.melhorEnvioPackages.find((p: any) => p.id === e.target.value);
                          if (pkg) {
                            setPackageParams({
                              ...packageParams,
                              weight: String(pkg.weight), width: String(pkg.width), height: String(pkg.height), length: String(pkg.length), insuranceValue: String(pkg.insuranceValue)
                            });
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>SELECIONAR PREDEFINIDO</option>
                        {settings.melhorEnvioPackages.map((pkg: any) => (
                          <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Peso (kg)</label>
                      <input type="number" step="0.1" value={packageParams.weight} onChange={(e) => setPackageParams({...packageParams, weight: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Larg. (cm)</label>
                      <input type="number" value={packageParams.width} onChange={(e) => setPackageParams({...packageParams, width: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alt. (cm)</label>
                      <input type="number" value={packageParams.height} onChange={(e) => setPackageParams({...packageParams, height: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Comp. (cm)</label>
                      <input type="number" value={packageParams.length} onChange={(e) => setPackageParams({...packageParams, length: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Seguro (R$)</label>
                      <input type="number" value={packageParams.insuranceValue} onChange={(e) => setPackageParams({...packageParams, insuranceValue: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-emerald-500 font-medium" />
                    </div>
                  </div>
                </div>

                <button onClick={handleQuote} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-colors">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Calculator size={18} />} Obter Preços
                </button>
              </div>
            )}

            {step === 'SELECT' && (
              <div className="space-y-4">
                 <button onClick={() => setStep('QUOTE')} className="text-zinc-500 text-sm hover:underline flex items-center gap-1 mb-4"><X size={14}/> Refazer Cotação</button>
                 
                 <div className="space-y-3">
                   {results.filter(r => !r.error).sort((a,b) => Number(a.custom_price) - Number(b.custom_price)).map((option, i) => (
                     <div key={i} onClick={() => setSelectedOption(option)} className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors ${selectedOption?.id === option.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-zinc-300'}`}>
                        <div className="flex gap-4 items-center">
                          <div className="w-12 h-12 bg-white rounded-xl border border-zinc-100 flex items-center justify-center overflow-hidden p-1">
                             {option.company?.picture ? <img src={option.company.picture} className="w-full h-full object-contain" alt="" /> : <Truck size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900 dark:text-white leading-tight">{option.company?.name || 'Transp'} - {option.name}</h4>
                            <p className="text-xs text-zinc-500 mt-1">Entrega em até {option.custom_delivery_time} dias úteis</p>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-lg font-black text-emerald-500">R$ {option.custom_price}</p>
                           {Number(option.price) > Number(option.custom_price) && <p className="text-[10px] text-zinc-400 line-through">R$ {option.price}</p>}
                        </div>
                     </div>
                   ))}
                   {results.filter(r => !r.error).length === 0 && (
                     <p className="text-zinc-500 text-center py-6">Nenhuma opção disponível para este trecho.</p>
                   )}
                 </div>

                 {selectedOption && (
                   <button onClick={handleAddToCart} disabled={loading} className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-colors">
                     {loading ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />} Adicionar ao Carrinho
                   </button>
                 )}
              </div>
            )}

            {step === 'CHECKOUT' && (
              <div className="py-8 space-y-6 text-center flex flex-col items-center">
                 <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center">
                   <ShoppingCart size={40} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Etiqueta no Carrinho</h3>
                   <p className="text-zinc-500 text-sm max-w-sm mx-auto">Para gerar o rastreio, o valor de <b>R$ {selectedOption?.custom_price || shipment?.melhorEnvio?.price}</b> será debitado da sua carteira do Melhor Envio.</p>
                 </div>

                 <button onClick={handleCheckout} disabled={loading} className="w-full max-w-sm bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-colors">
                     {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Pagar Etiqueta Agora
                 </button>
              </div>
            )}

            {step === 'GENERATE' && (
              <div className="py-8 space-y-6 text-center flex flex-col items-center">
                 <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center">
                   <CheckCircle2 size={40} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Pagamento Aprovado</h3>
                   <p className="text-zinc-500 text-sm max-w-sm mx-auto">Sua etiqueta está paga. Agora podemos gerar o PDF de impressão e rastreio Oficial.</p>
                 </div>

                 <button onClick={handleGenerate} disabled={loading} className="w-full max-w-sm bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-colors">
                     {loading ? <Loader2 className="animate-spin" size={18} /> : <QrCode size={18} />} Gerar Etiqueta
                 </button>
              </div>
            )}

            {step === 'PRINT' && (
              <div className="py-8 space-y-6 text-center flex flex-col items-center">
                 <div className="w-20 h-20 bg-primary-100 dark:bg-primary-500/20 text-primary-500 rounded-full flex items-center justify-center">
                   <FileText size={40} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Etiqueta Pronta!</h3>
                   <p className="text-zinc-500 text-sm max-w-sm mx-auto">Código de Rastreio: <b>{trackingCode}</b></p>
                 </div>

                 <div className="flex gap-4 w-full max-w-sm">
                   {printUrl && (
                     <a href={printUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-primary-500 hover:bg-primary-400 text-black py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-colors">
                       <ExternalLink size={18} /> Imprimir PDF
                     </a>
                   )}
                   <button onClick={() => { onComplete(); onClose(); }} className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-colors">
                      Concluir
                   </button>
                 </div>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
