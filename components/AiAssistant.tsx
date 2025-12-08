
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { X, Send, Sparkles, Bot } from 'lucide-react';
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
    { role: 'model', text: 'Olá! Sou seu Operador de Frota com IA. Pergunte-me onde está um veículo pela placa.' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // --- TOOL DEFINITION ---
  const getVehicleLocationTool: FunctionDeclaration = {
    name: 'get_vehicle_location',
    description: 'Obter a localização, link do google maps e link de rastreamento interno de um veículo pela placa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        plate: { type: Type.STRING, description: 'A placa do veículo (ex: ABC-1234)' }
      },
      required: ['plate']
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

      if (!vehicle.tagId) {
        return { found: true, message: `Veículo ${vehicle.model} (${vehicle.plate}) está registrado mas não vinculado a um rastreador.` };
      }

      const locations = await storage.getLocations(vehicle.tagId);
      
      if (locations.length === 0) {
        return { found: true, message: `Veículo ${vehicle.model} (${vehicle.plate}) está vinculado mas não possui histórico recente.` };
      }

      const lastLoc = locations[0]; // Assuming getLocations sorts desc
      
      // CRITICAL: Add autoStart=true to trigger automatic tracking in LiveMap
      const internalLink = `${window.location.origin}/#/map?tagId=${vehicle.tagId}&autoStart=true`;
      const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lastLoc.lat},${lastLoc.lon}`;

      return {
        found: true,
        vehicle: { model: vehicle.model, plate: vehicle.plate },
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initial Request
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: userMsg }] }
        ],
        config: {
          tools: [{ functionDeclarations: [getVehicleLocationTool] }],
          systemInstruction: "Você é um assistente operacional de frota eficiente. Fale estritamente em Português. Quando um usuário perguntar sobre um veículo, use a ferramenta disponível. Se encontrado, forneça os dados resumidos e OBRIGATORIAMENTE forneça o link 'internalTracking' formatado como um link clicável com o texto '📍 Rastrear Agora no Mapa Ao Vivo' e o link do Google Maps. Seja direto."
        }
      });

      // Handle Function Calls
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        
        if (call.name === 'get_vehicle_location') {
          const args = call.args as { plate: string };
          const toolResult = await executeVehicleSearch(args.plate);

          // Send result back to model
          const finalResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: userMsg }] },
                { role: 'model', parts: [{ functionCall: call }] }, // History
                { role: 'function', parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }] }
            ],
            config: {
                tools: [{ functionDeclarations: [getVehicleLocationTool] }],
            }
          });
          
          setMessages(prev => [...prev, { role: 'model', text: finalResponse.text || "Encontrei o veículo mas não consegui gerar a descrição." }]);
        }
      } else {
        // Normal text response
        setMessages(prev => [...prev, { role: 'model', text: response.text || "Não entendi a solicitação." }]);
      }

    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Desculpe, ocorreu um erro ao conectar com o serviço de IA." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 sm:w-96 h-[500px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-500 rounded-lg text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Operador IA</h3>
                  <p className="text-[10px] text-zinc-500">Gemini 2.5 Flash</p>
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
                    className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user' 
                        ? 'bg-primary-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-none shadow-sm'
                    }`}
                    dangerouslySetInnerHTML={{ 
                        // Linkify logic for Markdown links [Text](url) and raw URLs
                        __html: msg.text
                            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="block mt-2 text-center bg-primary-500/10 text-primary-600 dark:text-primary-400 py-2 px-3 rounded-lg font-bold border border-primary-500/20 hover:bg-primary-500/20 transition-colors">$1</a>')
                            .replace(/(https?:\/\/[^\s<]+)/g, (url) => {
                                // Avoid double replacing if inside the anchor tag from previous replace
                                if (url.includes('">')) return url; 
                                return `<a href="${url}" target="_blank" class="underline text-blue-500 hover:text-blue-600 dark:text-blue-400 break-all">Link</a>`;
                            })
                    }}
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

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 focus-within:border-primary-500 transition-colors"
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite uma placa..." 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-zinc-900 dark:text-white placeholder-zinc-400"
                />
                <button 
                  type="submit" 
                  disabled={loading || !input.trim()}
                  className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
            isOpen ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300' : 'bg-primary-500 text-white hover:bg-primary-400 hover:scale-110'
        }`}
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>
    </div>
  );
};
