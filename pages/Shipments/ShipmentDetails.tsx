import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShipments, useInventory } from '../../hooks/useShipments';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Printer, Package, Truck, Calendar, MapPin, CheckCircle, XCircle, Clock, AlertTriangle, Search, ExternalLink } from 'lucide-react';
import { ShipmentStatus } from '../../types';
import { storage } from '../../services/storage';
import { ShipmentTrackingModal } from '../../components/ShipmentTrackingModal';
import { MelhorEnvioFlowModal } from '../../components/MelhorEnvioFlowModal';

export const ShipmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'admin_tecnico';
  const canQuote = user?.role !== 'client';
  const { shipments, loading, updateShipmentStatus } = useShipments();
  const { tags, loading: tagsLoading } = useInventory();
  const [shipment, setShipment] = useState<any>(null);
  const canEdit = isAdmin || (shipment && user?.id === shipment.consultorId && (shipment.status === 'rascunho' || shipment.status === 'em_analise'));
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [newTrackingCode, setNewTrackingCode] = useState('');
  
  // Rastreio API
  const [showTrackingInfoModal, setShowTrackingInfoModal] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  // Melhor Envio Flow
  const [showMelhorEnvioFlow, setShowMelhorEnvioFlow] = useState(false);

  useEffect(() => {
    if (!loading && !tagsLoading && id) {
      const found = shipments.find(s => s.id === id);
      if (found) setShipment(found);
    }
  }, [id, shipments, loading, tagsLoading]);

  if (loading || tagsLoading || !shipment) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div></div>;
  }

  const getTagDisplay = (tagId: string) => {
    const tag = tags.find((t: any) => t.id === tagId);
    return tag ? (tag.accessoryId || tag.imei || tagId) : tagId;
  };

  const getStatusDisplay = (status: ShipmentStatus) => {
    switch (status) {
      case 'em_analise': return 'Em Análise';
      default: return status;
    }
  };

  const getStatusColor = (status: ShipmentStatus) => {
    switch (status) {
      case 'rascunho': return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
      case 'em_analise': return 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400';
      case 'ativo': return 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400';
      case 'enviado': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400';
      case 'entregue': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'cancelado': return 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400';
      default: return 'bg-zinc-100 text-zinc-600';
    }
  };

  const handleUpdateTracking = async () => {
    if (!newTrackingCode) return;
    await updateShipmentStatus(shipment.id, shipment.status, newTrackingCode);
    setShowTrackingModal(false);
  };

  const handlePrint = () => {
    navigate(`/envios/${shipment.id}/imprimir`);
  };

  const handleTrackPackage = async () => {
    if (!shipment.codigoRastreio) return;
    
    setIsTrackingLoading(true);
    setTrackingError('');
    setShowTrackingInfoModal(true);
    setTrackingData(null);

    try {
      const settings = await storage.getSettings();
      if (!settings.siteRastreioApiKey) {
        throw new Error('API Key do Site Rastreio não configurada nas configurações.');
      }

      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: shipment.codigoRastreio, apiKey: settings.siteRastreioApiKey })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na API: ${response.status}`);
      }

      const data = await response.json();
      setTrackingData(data);
    } catch (error: any) {
      console.error('Tracking error:', error);
      setTrackingError(error.message || 'Erro ao buscar informações de rastreio.');
    } finally {
      setIsTrackingLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/envios')} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{shipment.titulo}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${getStatusColor(shipment.status)}`}>
                {getStatusDisplay(shipment.status)}
              </span>
              {shipment.codigoRemessa && (
                <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-md">
                  {shipment.codigoRemessa}
                </span>
              )}
              <span className="text-xs text-zinc-500">ID: {shipment.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canQuote && (
            <button onClick={() => setShowMelhorEnvioFlow(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 transition-colors">
              <Truck size={18} /> Melhor Envio
            </button>
          )}
          {canEdit && (shipment.status === 'rascunho' || shipment.status === 'em_analise') && (
            <button onClick={() => navigate(`/envios/${shipment.id}/editar`)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Editar
            </button>
          )}
          <button onClick={handlePrint} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold flex items-center gap-2 transition-colors">
            <Printer size={18} /> Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Package size={20} className="text-primary-500" />
              Itens da Remessa ({shipment.itens.length})
            </h2>
            <div className="space-y-3">
              {shipment.itens.map((item: any) => (
                <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="uppercase text-[10px] font-black tracking-widest bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-1 rounded-md">{item.tipo}</span>
                      <span className="font-bold text-zinc-900 dark:text-white">{item.placa || `${item.quantidade}x Itens`}</span>
                    </div>
                    {item.veiculoInfo && (
                      <p className="text-xs text-zinc-500 mt-1">{item.veiculoInfo.modelo} - {item.veiculoInfo.proprietario}</p>
                    )}
                    {item.observacoes && (
                      <p className="text-xs text-zinc-400 mt-1 italic">Obs: {item.observacoes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {item.tagId && <p className="text-xs font-mono text-zinc-500">Tag: {getTagDisplay(item.tagId)}</p>}
                    {item.rastreadorId && <p className="text-xs font-mono text-zinc-500">Rastreador: {item.rastreadorId}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-primary-500" />
              Destino
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Destinatário</p>
                <p className="font-bold text-zinc-900 dark:text-white">{shipment.destinatario.nome}</p>
                {shipment.destinatario.cpf && <p className="text-sm text-zinc-500 mt-1">CPF/CNPJ: {shipment.destinatario.cpf}</p>}
                {shipment.destinatario.telefone && <p className="text-sm text-zinc-500">Tel: {shipment.destinatario.telefone}</p>}
                {shipment.destinatario.email && <p className="text-sm text-zinc-500">Email: {shipment.destinatario.email}</p>}
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Endereço</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{shipment.destinatario.enderecoCompleto}</p>
                {shipment.destinatario.isRural && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-500 mb-1">Zona Rural (Instruções Adicionais)</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">{shipment.destinatario.ruralDetails}</p>
                  </div>
                )}
              </div>
              {shipment.envelopeType && (
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Tipo de Envelope</p>
                  <p className="font-bold text-zinc-900 dark:text-white">{shipment.envelopeType}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Consultor Responsável</p>
                <p className="font-bold text-zinc-900 dark:text-white">{shipment.consultorNome}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Truck size={20} className="text-primary-500" />
              Logística
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Transportadora</p>
                <p className="font-bold text-zinc-900 dark:text-white">{shipment.transportadora || 'Não informada'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Código de Rastreio</p>
                {shipment.codigoRastreio ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <span className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-300">{shipment.codigoRastreio}</span>
                      <button onClick={handleTrackPackage} className="text-primary-500 hover:text-primary-600 p-1 bg-primary-50 dark:bg-primary-500/10 rounded-md transition-colors" title="Rastrear Encomenda">
                        <Search size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pendente</span>
                    </div>
                    {isAdmin && shipment.status !== 'entregue' && shipment.status !== 'cancelado' && (
                      <button onClick={() => setShowTrackingModal(true)} className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        Adicionar Rastreio
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-primary-500" />
              Datas
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Criação</span>
                <span className="font-medium text-zinc-900 dark:text-white">{new Date(shipment.dataCriacao).toLocaleDateString('pt-BR')}</span>
              </div>
              {shipment.dataEnvio && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Envio</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{new Date(shipment.dataEnvio).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {shipment.dataEntrega && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Entrega</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{new Date(shipment.dataEntrega).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showTrackingModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Adicionar Código de Rastreio</h3>
            <input 
              type="text" 
              value={newTrackingCode} 
              onChange={e => setNewTrackingCode(e.target.value)} 
              placeholder="Digite o código..." 
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500 mb-4" 
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTrackingModal(false)} className="px-4 py-2 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleUpdateTracking} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold transition-colors">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ShipmentTrackingModal
        isOpen={showTrackingInfoModal}
        onClose={() => setShowTrackingInfoModal(false)}
        trackingCode={shipment.codigoRastreio || ''}
        isLoading={isTrackingLoading}
        error={trackingError}
        trackingData={trackingData}
      />

      <MelhorEnvioFlowModal 
        isOpen={showMelhorEnvioFlow}
        onClose={() => setShowMelhorEnvioFlow(false)}
        shipment={shipment}
        onComplete={() => {
           // Reload logic if needed, useShipments already triggers re-render via context
        }}
      />
    </div>
  );
};
