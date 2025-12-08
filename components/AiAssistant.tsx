
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { X, Send, Sparkles, Bot, BarChart3, MapPin, AlertTriangle, Tag as TagIcon, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from '../services/storage';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou seu Operador de Frota Inteligente. Posso ajudar a localizar veículos, verificar estatísticas de tags, relatórios de roubo e muito mais. Como posso ajudar?' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // --- TOOL DEFINITIONS ---

  const getVehicleLocationTool: FunctionDeclaration = {
    name: 'get_vehicle_location',
    description: 'Obter a localização, status (ativo/roubado) e link de rastreamento de um veículo pela placa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        plate: { type: Type.STRING, description: 'A placa do veículo (ex: ABC-1234)' }
      },
      required: ['plate']
    }
  };

  const getFleetStatsTool: FunctionDeclaration = {
    name: 'get_fleet_stats',
    description: 'Obter estatísticas gerais da frota: contagem de tags (livres/vinculadas), veículos por categoria, índice de roubo e total de veículos.',
    parameters: {
      type: Type.OBJECT,
      properties: {}, 
    }
  };

  const getSecurityLogsTool: FunctionDeclaration = {
    name: 'get_security_logs',
    description: 'Buscar histórico de roubos e furtos. Retorna lista de veículos roubados, data do roubo, e B.O se disponível.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  };

  // --- TOOL EXECUTION LOGIC ---

  const executeVehicleSearch = async (plate: string) => {
    try {
      const vehicles = await storage.getVehicles();
      const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      const vehicle = vehicles.find(v => v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);

      if (!vehicle) {
        return { found: false, message: `Veículo com placa ${plate} não encontrado no banco de dados.` };
      }
      
      const isStolen = vehicle.status === 'stolen';

      if (!vehicle.tagId) {
        return { 
            found: true, 
            message: `Veículo ${vehicle.model} (${vehicle.plate}) está registrado mas não vinculado a um rastreador.`,
            status: vehicle.status,
            isStolen: isStolen
        };
      }

      const locations = await storage.getLocations(vehicle.tagId);
      
      if (locations.length === 0) {
        return { 
            found: true, 
            message: `Veículo ${vehicle.model} (${vehicle.plate}) está vinculado mas não possui histórico recente.`,
            status: vehicle.status,
            isStolen: isStolen
        };
      }

      const lastLoc = locations[0];
      
      // Auto-start tracking logic
      const internalLink = `${window.location.origin}/#/map?tagId=${vehicle.tagId}&autoStart=true`;
      const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lastLoc.lat},${lastLoc.lon}`;

      return {
        found: true,
        vehicle: { model: vehicle.model, plate: vehicle.plate },
        status: vehicle.status || 'active',
        isStolen: isStolen,
        location: { lat: lastLoc.lat, lon: lastLoc.lon, timestamp: lastLoc.isodatetime },
        links: {
          googleMaps: googleMapsLink,
          internalTracking: internalLink
        }
      };
    } catch (e) {
      return { found: false, error: 'Erro no banco de dados' };
    }
  };

  const executeFleetStats = async () => {
    try {
        const [tags, vehicles, categories] = await Promise.all([
            storage.getTags(),
            storage.getVehicles(),
            storage.getCategories()
        ]);

        const totalTags = tags.length;
        const linkedTags = vehicles.filter(v => v.tagId).length;
        const freeTags = totalTags - linkedTags;

        const totalVehicles = vehicles.length;
        const stolenVehicles = vehicles.filter(v => v.status === 'stolen').length;
        const activeVehicles = vehicles.filter(v => v.status === 'active').length;
        const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;

        // Group by Category Name
        const byCategory: Record<string, number> = {};
        vehicles.forEach(v => {
            const catName = categories.find(c => c.id === v.type)?.name || 'Desconhecido';
            byCategory[catName] = (byCategory[catName] || 0) + 1;
        });

        return {
            tags: { total: totalTags, linked: linkedTags, free: freeTags },
            vehicles: { 
                total: totalVehicles, 
                stolen: stolenVehicles, 
                active: activeVehicles, 
                maintenance: maintenanceVehicles,
                byCategory: byCategory 
            }
        };
    } catch (e) {
        return { error: 'Falha ao calcular estatísticas' };
    }
  };

  const executeSecurityLogs = async () => {
    try {
      const records = await storage.getStolenRecords();
      return records.map(r => ({
        plate: r.vehiclePlate,
        model: r.vehicleModel,
        type: r.type,
        date: new Date(r.timestamp).toLocaleString(),
        policeReport: r.policeReport || 'N/A',
        status: r.status,
        recoveredAt: r.recoveredAt ? new Date(r.recoveredAt).toLocaleString() : null
      })).slice(0, 10); // Return last 10
    } catch (e) {
      return { error: 'Erro ao buscar logs de segurança' };
    }
  };

  // --- MESSAGE FORMATTING ---
  const formatMessage = (text: string) => {
    if (!text) return '';
    
    // 1. Remove Code Block wrappers (```) to prevent raw code display
    // We strip the backticks completely to treat everything as natural language
    let clean = text.replace(/```(?:json|xml|html|javascript|typescript)?/gi, '').replace(/```/g, '');

    // 2. Bold (**text**)
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // 3. Markdown Links [Text](URL) -> Styled Buttons
    // Explicitly target the structure to avoid capturing extra text
    clean = clean.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g, 
      `<a href="$2" class="flex items-center justify-center gap-2 mt-2 w-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 py-2 px-3 rounded-lg font-bold border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors text-center text-sm decoration-0"><span class="shrink-0">📍</span> $1</a>`
    );

    // 4. Line breaks
    clean = clean.replace(/\n/g, '<br />');

    return clean;
  };

  const handleSend = async (textOverride?: string) => {
    const userMsg = textOverride || input;
    if (!userMsg.trim() || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: userMsg }] }
        ],
        config: {
          tools: [{ functionDeclarations: [getVehicleLocationTool, getFleetStatsTool, getSecurityLogsTool] }],
          systemInstruction: `Você é um Assistente Operacional de Frota altamente inteligente (K-TAG AI). Fale estritamente em Português.

Objetivos:
1. Ajudar a localizar veículos.
2. Fornecer estatísticas de frota.
3. Orientar sobre o uso do sistema.

Regras CRÍTICAS de Resposta:
- RESPOSTA APENAS EM TEXTO NATURAL.
- NUNCA USE BLOCOS DE CÓDIGO ( \`\`\` ).
- NUNCA EXIBA JSON ou XML BRUTO.
- Se a ferramenta retornar dados técnicos, interprete-os e faça um resumo amigável.
- Use listas com marcadores (-) para enumerar itens.

Regras de Ferramentas:
- Use 'get_vehicle_location' para localizar veículos pela placa.
- Use 'get_fleet_stats' para contagens e estatísticas gerais.
- Use 'get_security_logs' para histórico de roubos.

Comportamento Específico:
- **Cadastro de Veículos**: Responda EXATAMENTE com estes passos:
  1. Vá até a página de **Veículos** (5ª opção na barra lateral).
  2. Clique no botão **"Adicionar Veículo"**.
  3. Preencha o formulário e clique em **Salvar**.
  Você pode usar este link direto: [Ir para Veículos](${window.location.origin}/#/vehicles).

- **Roubo**: Se 'isStolen: true', use **NEGRITO** e emojis de alerta 🚨.
- **Links**: Sempre forneça o link interno como: [📍 Rastrear no Mapa Ao Vivo](link).`
        }
      });

      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        let toolResult;

        if (call.name === 'get_vehicle_location') {
          const args = call.args as { plate: string };
          toolResult = await executeVehicleSearch(args.plate);
        } else if (call.name === 'get_fleet_stats') {
          toolResult = await executeFleetStats();
        } else if (call.name === 'get_security_logs') {
          toolResult = await executeSecurityLogs();
        }

        const finalResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: userMsg }] },
                { role: 'model', parts: [{ functionCall: call }] },
                { role: 'function', parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }] }
            ],
            config: {
                tools: [{ functionDeclarations: [getVehicleLocationTool, getFleetStatsTool, getSecurityLogsTool] }],
            }
        });
          
        setMessages(prev => [...prev, { role: 'model', text: finalResponse.text || "Tarefa concluída." }]);
      
      } else {
        setMessages(prev => [...prev, { role: 'model', text: response.text || "Não entendi." }]);
      }

    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Erro de conexão com a IA." }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: '📊 Estatísticas Gerais', prompt: 'Me dê um resumo das estatísticas da frota: tags livres, veículos por categoria e total.', icon: BarChart3 },
    { label: '🚗 Como cadastrar veículo?', prompt: 'Como faço para cadastrar um novo veículo no sistema?', icon: HelpCircle },
    { label: '🚨 Veículos Roubados', prompt: 'Liste os veículos roubados e seus status.', icon: AlertTriangle },
    { label: '🏷️ Status Tags', prompt: 'Quantas tags temos no total e quantas estão livres?', icon: TagIcon },
    { label: '📍 Rastrear Placa', prompt: 'Quero rastrear um veículo pela placa. (Digite a placa)', icon: MapPin },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 sm:w-[450px] h-[600px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-500 rounded-lg text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Operador IA</h3>
                  <p className="text-[10px] text-zinc-500">K-Tag Intelligence</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-black/20">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[90%] p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-primary-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-none shadow-sm'
                    }`}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                  />
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-200 dark:border-zinc-700 shadow-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions & Input Area */}
            <div className="bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0 flex flex-col">
              
              {/* Quick Action Chips */}
              <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide border-b border-zinc-50 dark:border-zinc-800/50">
                {quickActions.map((action, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            if (action.label.includes('Placa')) {
                                setInput("Localize o veículo com a placa ");
                            } else {
                                handleSend(action.prompt);
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full text-xs font-medium whitespace-nowrap transition-colors border border-zinc-200 dark:border-zinc-700"
                    >
                        <action.icon size={12} />
                        {action.label}
                    </button>
                ))}
              </div>

              <div className="p-3">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/20 transition-all"
                >
                    <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite sua solicitação..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-zinc-900 dark:text-white placeholder-zinc-400"
                    />
                    <button 
                    type="submit" 
                    disabled={loading || !input.trim()}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                    <Send size={16} />
                    </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-xl shadow-primary-500/20 transition-all duration-300 flex items-center justify-center border ${
            isOpen ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700' : 'bg-primary-600 text-white hover:bg-primary-500 border-transparent hover:scale-105'
        }`}
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>
    </div>
  );
};
