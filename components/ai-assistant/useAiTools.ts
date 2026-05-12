import React, { useMemo } from 'react';
import { storage } from '../../services/storage';
import { hinovaService } from '../../services/hinova';
import { MapPin, Sparkles, BarChart3 } from 'lucide-react';

export const useAiTools = () => {
  const rawDefinitions = useMemo(() => {
      return [
            {
                name: 'get_vehicle_location',
                description: 'Localiza um veículo pela placa informada, retornando a localização no mapa de tempo real, além do seu status geral de saúde e hardware.',
                parameters: {
                    type: 'OBJECT',
                    properties: { plate: { type: 'STRING', description: 'Placa do veículo' } },
                    required: ['plate']
                }
            },
            {
                name: 'get_fleet_stats',
                description: 'Lê as tabelas de Hardware (Tags) e Frotas registradas (Veículos), retornando quanto está vinculado na nuvem e o que está livre em prateleira de estoque.',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'search_external_data',
                description: 'Busca os dados crús da integração do integrador parceiro (SGA do cliente) como Chassi pelo Hinova.',
                parameters: {
                    type: 'OBJECT',
                    properties: { query: { type: 'STRING', description: 'Placa ou Chassi' } },
                    required: ['query']
                }
            },
            {
                name: 'analyze_operations',
                description: 'Ação crítica: Faz uma varredura cruzada no volume da frota, disponibilidade de estoque, fila pendente de Ordem de Serviços aguardando resposta humana e a quantidade atual de técnicos disponiveis. Use isso quando o gerente pedir um sumario analitico de status.',
                parameters: { type: 'OBJECT', properties: {} }
            }
      ];
  }, []);

  const toolsInfo = useMemo(() => {
      return [{ functionDeclarations: rawDefinitions }];
  }, [rawDefinitions]);

  const openAiTools = useMemo(() => {
      return rawDefinitions.map(def => {
          const mappedProps: any = {};
          for (const [k, v] of Object.entries((def.parameters.properties || {}) as any)) {
              mappedProps[k] = { type: ((v as any).type === 'STRING' ? 'string' : 'object'), description: (v as any).description };
          }
          return {
              type: "function",
              function: {
                  name: def.name,
                  description: def.description,
                  parameters: {
                      type: "object",
                      properties: mappedProps,
                      required: def.parameters.required || []
                  }
              }
          };
      });
  }, [rawDefinitions]);

  const anthropicTools = useMemo(() => {
      return rawDefinitions.map(def => {
          const mappedProps: any = {};
          for (const [k, v] of Object.entries((def.parameters.properties || {}) as any)) {
              mappedProps[k] = { type: ((v as any).type === 'STRING' ? 'string' : 'object'), description: (v as any).description };
          }
          return {
              name: def.name,
              description: def.description,
              input_schema: {
                  type: "object",
                  properties: mappedProps,
                  required: def.parameters.required || []
              }
          };
      });
  }, [rawDefinitions]);

  const executeTool = async (name: string, args: any): Promise<{ visual: React.ReactNode, textual: string }> => {
    try {
      if (name === 'get_vehicle_location') {
        const vehicles = await storage.getVehicles();
        const cleanPlate = (args.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const v = vehicles.find(veh => veh.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
        
        if (!v) return {
            visual: React.createElement("div", { className: "text-amber-500 font-mono text-[10px] w-full" }, `O veículo ${cleanPlate} não existe no banco local de rastreamento.`),
            textual: `O veículo da placa solicitada (${cleanPlate}) não consta em nossa base unificada local de GPS.`
        };
        
        const resultLink = v.tagId ? `${window.location.origin}/#/map?tagId=${v.tagId}&autoStart=true` : null;
        
        return {
            textual: `Veículo ${v.plate} (${v.model}): Status sistêmico: '${v.status}'. Vinculado a uma Tag GPS: ${v.tagId ? 'SIM' : 'NÃO'}. Como especialista, analise este resultado. Se o status for offline ou sem GPS, sugira agendar uma OS urgente ou procurar na base externa.`,
            visual: React.createElement("div", { className: "bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 w-full mb-1" },
                React.createElement("div", { className: "flex items-center gap-2 mb-2 text-primary-500" },
                    React.createElement(MapPin, { size: 14 }),
                    React.createElement("span", { className: "text-[10px] font-black uppercase tracking-widest" }, "Base de GPS Recuperada")
                ),
                React.createElement("div", { className: "flex justify-between items-start mb-2 mt-2" },
                    React.createElement("div", null,
                        React.createElement("h4", { className: "text-white font-black text-sm tracking-tight" }, v.plate),
                        React.createElement("p", { className: "text-zinc-400 text-[10px] font-bold uppercase" }, v.model)
                    ),
                    React.createElement("span", { className: `px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${v.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}` }, v.status === 'active' ? 'Ativo' : 'Offline')
                ),
                resultLink ? React.createElement("a", { href: resultLink, target: "_blank", rel: "noreferrer", className: "w-full py-2 bg-primary-500 hover:bg-primary-400 text-black text-center rounded-lg font-black text-[9px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2" }, "Abrir Grid Geográfico Ao Vivo") : React.createElement("div", { className: "p-2 bg-zinc-900 rounded-lg text-center text-zinc-500 text-[9px] font-bold uppercase border border-zinc-800" }, "Sem comunicação GPS")
            )
        };
      }

      if (name === 'get_fleet_stats') {
        const [tags, vehs] = await Promise.all([storage.getTags(), storage.getVehicles()]);
        const linkedCount = vehs.filter(v => v.tagId).length;
        const totalTags = tags.length;
        const availableTags = tags.filter(t => t.status === 'disponível').length;
        const maintenanceTags = tags.filter(t => t.status === 'manutencao').length;
        
        return {
            textual: `Resultados do hardware: Frota atual é de ${vehs.length} veículos. Total de Tags compradas pela companhia: ${totalTags}. Destas, ${availableTags} estão ociosas aguardando instalação e ${maintenanceTags} em manutenção/defeito. Como engenheiro chefe, critique o percentual de ociosidade, e sugira o que fazer com os aparelhos quebrados.`,
            visual: React.createElement("div", { className: "grid grid-cols-2 gap-2 w-full mb-1" },
                React.createElement("div", { className: "bg-zinc-800/80 p-2 rounded-xl border border-zinc-700 text-center" },
                    React.createElement("p", { className: "text-[8px] text-zinc-400 font-black uppercase tracking-widest" }, "Frota Ativa"),
                    React.createElement("p", { className: "text-xl font-black text-white" }, vehs.length)
                ),
                React.createElement("div", { className: "bg-zinc-800/80 p-2 rounded-xl border border-primary-500 text-center" },
                    React.createElement("p", { className: "text-[8px] text-primary-500 font-black uppercase tracking-widest" }, "Estoque Ocioso"),
                    React.createElement("p", { className: "text-xl font-black text-primary-500" }, availableTags)
                )
            )
        };
      }

      if (name === 'search_external_data') {
        const query = (args.query || '').toUpperCase();
        const data = await hinovaService.searchVehicle(query).catch(() => null);
        if (!data) return {
            textual: "Fui à API parceira do sistema legado (Hinova/SGA) e recebi falha. Este carro ou chassi realmente não existe por lá.",
            visual: React.createElement("div", { className: "text-red-400 font-mono text-[10px] w-full" }, "Vínculo SGA quebrado ou desativado remotamente.")
        };
        
        return {
            textual: `Busca no SGA (Hinova) trouxe o ativo pertencente ao cliente '${data.client.name}' (Modelo: '${data.vehicle.model}', Placa: '${data.vehicle.plate}'). Analise isso: Se não estava na nossa base local, devemos instalá-lo? Crie um plano de ação para a equipe comercial/técnica sobre esta descoberta na base ERP parceira.`,
            visual: React.createElement("div", { className: "bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 w-full mb-1" },
                React.createElement("div", { className: "flex items-center gap-2 mb-2 text-emerald-500" },
                    React.createElement(Sparkles, { size: 12 }),
                    React.createElement("span", { className: "text-[9px] font-black uppercase tracking-widest" }, "SGA - Sincronizado Sucesso")
                ),
                React.createElement("p", { className: "text-white font-bold text-xs" }, data.vehicle.model),
                React.createElement("p", { className: "text-zinc-400 text-[10px] font-mono mb-2" }, `${data.vehicle.plate} • ${data.vehicle.chassis}`),
                React.createElement("div", { className: "bg-zinc-900 border border-zinc-800 rounded-lg p-2 mt-2" },
                    React.createElement("p", { className: "text-zinc-300 text-[10px] font-bold" }, data.client.name)
                )
            )
        };
      }

      if (name === 'analyze_operations') {
        const [vehs, tags, scheds, techs] = await Promise.all([
             storage.getVehicles(), storage.getTags(), storage.getSchedules('admin', ''), storage.getTechnicians()
        ]);
        
        const pendingSchedules = scheds.filter(s => s.status === 'Solicitada' || s.status === 'Em análise' || s.status === 'Reagendada');
        const activeTechs = techs.filter(t => t.active);
        
        const payload = JSON.stringify({
            data_warehouse: {
                frotas_cadastradas: vehs.length,
                frotas_offline: vehs.filter(v => v.status === 'maintenance' || v.status === 'stolen').length,
                total_hardware_comprado: tags.length,
                hardware_parado_estoque: tags.filter(t => t.status === 'disponível').length,
                hardware_com_defeito: tags.filter(t => t.status === 'manutencao').length,
                tecnicos_atendendo_rua: activeTechs.length,
                tecnicos_indisponiveis: techs.length - activeTechs.length,
                ordens_servico_pendentes: pendingSchedules.length
            }
        });

        return {
            textual: `Dados em tempo real extraídos via Cluster: ${payload}. Analise e explique de forma ESTRATÉGICA estes eixos operacionais. Faça inferências sobre a correlação (ex: temos OS demais para pouca gente? Há dinheiro parado em estoque?). Deixe recomendações executivas.`,
            visual: React.createElement("div", { className: "bg-[#121214] border border-zinc-800 p-3 rounded-xl w-full mb-1" },
                React.createElement("div", { className: "flex items-center gap-2 text-primary-500 mb-2" },
                    React.createElement(BarChart3, { size: 14 }),
                    React.createElement("span", { className: "text-[10px] font-black uppercase tracking-widest" }, "Data Extraída (Backoffice Integrado)")
                ),
                React.createElement("p", { className: "text-zinc-500 text-[10px] font-mono leading-tight" }, "Analítica processada através das chaves de banco cruzadas de forma distribuída.")
            )
        };
      }

      return { textual: "Sem dados para esta operação especial.", visual: React.createElement(React.Fragment, null) };
    } catch (e: any) {
      return { textual: `Um erro fatal derrubou a ferramenta: ${e.message}`, visual: React.createElement("div", { className: "text-red-500 text-xs w-full mt-1 bg-red-900/10 p-2 rounded" }, `API Crashing: ${e.message}`) };
    }
  };

  return { toolsInfo, openAiTools, anthropicTools, executeTool };
};
