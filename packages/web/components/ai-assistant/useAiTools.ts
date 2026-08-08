import React, { useMemo } from 'react';
import { storage } from '../../services/storage';
import { hinovaService } from '../../services/hinova';
import { MapPin, Sparkles, BarChart3 } from 'lucide-react';

export const useAiTools = () => {
  const rawDefinitions = useMemo(() => {
      return [
            {
                name: 'get_vehicle_location',
                description: 'Localiza um veículo pela placa e retorna status, GPS, última posição e link do mapa. Use quando o usuário citar uma placa.',
                parameters: {
                    type: 'OBJECT',
                    properties: { plate: { type: 'STRING', description: 'Placa do veículo' } },
                    required: ['plate']
                }
            },
            {
                name: 'get_fleet_stats',
                description: 'Resume frota, cobertura GPS e estoque de Tags. Use para perguntas sobre hardware, cobertura ou estoque ocioso.',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'search_external_data',
                description: 'Consulta o cadastro externo por placa ou chassi. Use quando o ativo não estiver na base local ou o usuário citar o cadastro externo.',
                parameters: {
                    type: 'OBJECT',
                    properties: { query: { type: 'STRING', description: 'Placa ou Chassi' } },
                    required: ['query']
                }
            },
            {
                name: 'analyze_operations',
                description: 'Cruza OS pendentes, técnicos, frota e estoque com indicadores de SLA e capacidade. Use para diagnósticos, riscos e panoramas operacionais.',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'audit_fleet_identifiers',
                description: 'Audita IMEIs e identificadores duplicados, Tags ligadas a vários veículos e vínculos para Tags inexistentes. Use para duplicidade, estoque negativo, divergência cadastral ou integridade da frota.',
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
            // textual: dados brutos — o comportamento analítico vive no system prompt.
            textual: JSON.stringify({ encontrado: false, placaConsultada: cleanPlate }),
            visual: React.createElement("div", { className: "text-amber-500 font-mono text-[10px] w-full" }, `O veículo ${cleanPlate} não existe no banco local de rastreamento.`)
        };

        const resultLink = v.tagId ? `${window.location.origin}/#/map?tagId=${v.tagId}&autoStart=true` : null;
        const lastPositionAt = v.lastPosition?.timestamp || null;
        const minutesSinceLastPosition = lastPositionAt
            ? Math.max(0, Math.round((Date.now() - lastPositionAt) / 60_000))
            : null;

        return {
            textual: JSON.stringify({
                encontrado: true,
                placa: v.plate,
                modelo: v.model,
                status: v.status,
                temTagGps: !!v.tagId,
                tagId: v.tagId || null,
                linkMapa: resultLink,
                ultimaPosicaoEm: lastPositionAt ? new Date(lastPositionAt).toISOString() : null,
                minutosSemAtualizacao: minutesSinceLastPosition,
                coordenadas: v.lastPosition ? { lat: v.lastPosition.lat, lon: v.lastPosition.lon } : null,
            }),
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
        const registeredIds = new Set(tags.map(t => t.id));
        const assignments = vehs.filter(v => v.tagId);
        const assignedIds = new Set(assignments.map(v => v.tagId as string));
        const validAssignedIds = new Set([...assignedIds].filter(id => registeredIds.has(id)));
        const orphanCount = assignments.filter(v => !registeredIds.has(v.tagId as string)).length;
        const duplicateCount = assignments.length - assignedIds.size;
        const totalTags = tags.length;
        const availableTags = tags.filter(t => !assignedIds.has(t.id)).length;
        const maintenanceTags = tags.filter(t => t.status === 'manutencao').length;

        return {
            textual: JSON.stringify({
                frotaTotal: vehs.length,
                veiculosComTagInformada: assignments.length,
                veiculosComTagValida: assignments.filter(v => registeredIds.has(v.tagId as string)).length,
                tagsUnicasEmUso: validAssignedIds.size,
                totalTags,
                tagsOciosas: availableTags,
                tagsManutencao: maintenanceTags,
                vinculosOrfaos: orphanCount,
                vinculosDuplicados: duplicateCount,
                estoqueNegativo: false,
                percentualOcioso: totalTags ? Math.round((availableTags / totalTags) * 100) : 0,
            }),
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

      if (name === 'audit_fleet_identifiers') {
        const [tags, vehicles] = await Promise.all([storage.getTags(), storage.getVehicles()]);
        const normalize = (value?: string) => (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const groupDuplicates = (entries: Array<{ value: string; label: string }>) => {
          const groups = new Map<string, string[]>();
          entries.forEach(({ value, label }) => {
            if (!value) return;
            groups.set(value, [...(groups.get(value) || []), label]);
          });
          return [...groups.entries()]
            .filter(([, labels]) => labels.length > 1)
            .map(([value, labels]) => ({ value, registros: labels }));
        };

        const registeredIds = new Set(tags.map(t => normalize(t.id)));
        const vehicleAssignments = new Map<string, string[]>();
        vehicles.forEach(vehicle => {
          const tagId = normalize(vehicle.tagId);
          if (!tagId) return;
          vehicleAssignments.set(tagId, [...(vehicleAssignments.get(tagId) || []), vehicle.plate]);
        });

        const tagsEmMaisDeUmVeiculo = [...vehicleAssignments.entries()]
          .filter(([, plates]) => plates.length > 1)
          .map(([tagId, placas]) => ({ tagId, placas }));
        const vinculosOrfaos = vehicles
          .filter(vehicle => vehicle.tagId && !registeredIds.has(normalize(vehicle.tagId)))
          .map(vehicle => ({ placa: vehicle.plate, tagId: vehicle.tagId }));
        const imeisDuplicados = groupDuplicates(tags.map(tag => ({ value: normalize(tag.imei), label: tag.id })))
          .map(item => ({ imei: item.value, tags: item.registros }));
        const acessoriosDuplicados = groupDuplicates(tags.map(tag => ({ value: normalize(tag.accessoryId), label: tag.id })))
          .map(item => ({ accessoryId: item.value, tags: item.registros }));
        const identificadoresDuplicados = groupDuplicates(tags.map(tag => ({ value: normalize(tag.identifierNormalized), label: tag.id })))
          .map(item => ({ identificador: item.value, tags: item.registros }));
        const totalInconsistencias = tagsEmMaisDeUmVeiculo.length + vinculosOrfaos.length + imeisDuplicados.length + acessoriosDuplicados.length + identificadoresDuplicados.length;

        return {
          textual: JSON.stringify({
            resumo: { veiculos: vehicles.length, tags: tags.length, totalInconsistencias },
            tagsEmMaisDeUmVeiculo,
            vinculosOrfaos,
            imeisDuplicados,
            acessoriosDuplicados,
            identificadoresDuplicados,
          }),
          visual: React.createElement(React.Fragment, null),
        };
      }

      if (name === 'search_external_data') {
        const query = (args.query || '').toUpperCase();
        const data = await hinovaService.searchVehicle(query).catch(() => null);
        if (!data) return {
            textual: JSON.stringify({ encontrado: false, consulta: query, fonte: 'Hinova/SGA' }),
            visual: React.createElement("div", { className: "text-red-400 font-mono text-[10px] w-full" }, "Vínculo SGA quebrado ou desativado remotamente.")
        };

        return {
            textual: JSON.stringify({
                encontrado: true,
                fonte: 'Hinova/SGA',
                cliente: data.client.name,
                veiculo: { modelo: data.vehicle.model, placa: data.vehicle.plate, chassi: data.vehicle.chassis },
            }),
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
        const offlineVehicles = vehs.filter(v => v.status === 'maintenance' || v.status === 'stolen');
        const registeredTagIds = new Set(tags.map(t => t.id));
        const tagAssignments = vehs.filter(v => v.tagId).map(v => v.tagId as string);
        const uniqueAssignedTagIds = new Set(tagAssignments);
        const availableTags = tags.filter(t => !uniqueAssignedTagIds.has(t.id)).length;
        const orphanAssignments = tagAssignments.filter(id => !registeredTagIds.has(id)).length;
        const duplicateAssignments = tagAssignments.length - uniqueAssignedTagIds.size;
        const maintenanceTags = tags.filter(t => t.status === 'manutencao').length;
        const inUseTags = [...uniqueAssignedTagIds].filter(id => registeredTagIds.has(id)).length;
        const CAP = 12; // detalhes prioritários; totais completos permanecem nas métricas.
        const now = Date.now();
        const technicianById = new Map(techs.map(t => [t.id, t.name]));
        const pendingWithoutTechnician = pendingSchedules.filter(s => !s.technicianId).length;
        const criticalSchedules = pendingSchedules.filter(s => {
            const reference = s.status === 'Em análise' && s.analysisStartedAt ? s.analysisStartedAt : s.createdAt;
            return now - reference >= 60 * 60 * 1000;
        });
        const oldestPendingHours = pendingSchedules.reduce((max, s) => {
            const reference = s.status === 'Em análise' && s.analysisStartedAt ? s.analysisStartedAt : s.createdAt;
            return Math.max(max, Math.round((now - reference) / 3_600_000));
        }, 0);

        // textual: SOMENTE dados estruturados (arrays de objetos + fatos derivados).
        // Nada de instruções — a análise/thresholds vivem no SYSTEM_INSTRUCTION.
        const payload = JSON.stringify({
            metricas: {
                tecnicosAtivos: activeTechs.length,
                tecnicosInativos: techs.length - activeTechs.length,
                totalOsPendentes: pendingSchedules.length,
                osSemTecnico: pendingWithoutTechnician,
                osEmSlaCritico: criticalSchedules.length,
                maiorEsperaHoras: oldestPendingHours,
                ratioOsPorTecnico: activeTechs.length ? Number((pendingSchedules.length / activeTechs.length).toFixed(2)) : pendingSchedules.length,
                percentualEstoqueOcioso: tags.length ? Math.round((availableTags / tags.length) * 100) : 0,
                coberturaGpsPercentual: vehs.length ? Math.round((vehs.filter(v => v.tagId).length / vehs.length) * 100) : 0,
                vinculosOrfaos: orphanAssignments,
                vinculosDuplicados: duplicateAssignments,
            },
            tecnicos: techs.map(t => ({
                nome: t.name,
                ativo: t.active,
                especialidades: t.services || [],
                tipoAtendimento: t.serviceLocationType || null,
            })),
            ordensServicoPendentes: [...pendingSchedules]
              .sort((a, b) => (a.analysisStartedAt || a.createdAt) - (b.analysisStartedAt || b.createdAt))
              .slice(0, CAP).map(s => ({
                placa: s.vehiclePlate,
                modelo: s.vehicleModel,
                tipoServico: s.serviceType,
                dispositivo: s.deviceType,
                status: s.status,
                dataPreferida: s.preferredDate,
                horaPreferida: s.preferredTime,
                solicitante: s.requesterName,
                tecnicoId: s.technicianId || null,
                tecnicoNome: s.technicianId ? technicianById.get(s.technicianId) || null : null,
                criadoEm: s.createdAt,
                esperaHoras: Math.max(0, Math.round((now - (s.analysisStartedAt || s.createdAt)) / 3_600_000)),
                slaCritico: now - (s.analysisStartedAt || s.createdAt) >= 60 * 60 * 1000,
            })),
            frotaOffline: offlineVehicles.slice(0, CAP).map(v => ({
                placa: v.plate,
                modelo: v.model,
                status: v.status,
            })),
            frota: {
                total: vehs.length,
                comTag: vehs.filter(v => v.tagId).length,
                offline: offlineVehicles.length,
            },
            estoque: {
                totalTags: tags.length,
                ociosas: availableTags,
                manutencao: maintenanceTags,
                emUso: inUseTags,
            },
        });

        return {
            textual: payload,
            visual: React.createElement("div", { className: "bg-[#121214] border border-zinc-800 p-3 rounded-xl w-full mb-1" },
                React.createElement("div", { className: "flex items-center gap-2 text-primary-500 mb-2" },
                    React.createElement(BarChart3, { size: 14 }),
                    React.createElement("span", { className: "text-[10px] font-black uppercase tracking-widest" }, "Data Extraída (Backoffice Integrado)")
                ),
                React.createElement("p", { className: "text-zinc-500 text-[10px] font-mono leading-tight" }, "Analítica processada através das chaves de banco cruzadas de forma distribuída.")
            )
        };
      }

      return { textual: JSON.stringify({ erro: 'tool_desconhecida', tool: name }), visual: React.createElement(React.Fragment, null) };
    } catch (e: any) {
      return { textual: JSON.stringify({ erro: true, mensagem: e?.message || String(e) }), visual: React.createElement("div", { className: "text-red-500 text-xs w-full mt-1 bg-red-900/10 p-2 rounded" }, `API Crashing: ${e.message}`) };
    }
  };

  return { toolsInfo, openAiTools, anthropicTools, executeTool };
};
