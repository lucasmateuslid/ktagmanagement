import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipments } from '../../hooks/useShipments';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, Filter, Package, Truck, CheckCircle, XCircle, Clock, Copy, ChevronRight, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { Shipment, ShipmentStatus } from '../../types';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ShipmentTrackingModal } from '../../components/ShipmentTrackingModal';
import { storage } from '../../services/storage';
import { QuotationModal } from './QuotationModal';
import { Calculator } from 'lucide-react';

export const ShipmentsList = () => {
  const { shipments, loading, deleteShipment, updateShipmentStatus } = useShipments();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'admin_tecnico';
  const canQuote = user?.role !== 'client';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => {},
  });

  // Efeito para sincronizar status diariamente
  React.useEffect(() => {
    const syncTracking = async () => {
      if (loading || shipments.length === 0 || syncingTracking) return;
      
      const lastSync = localStorage.getItem('last_tracking_sync');
      const now = Date.now();
      // Sync at most once every 12 hours (43200000 ms)
      if (lastSync && now - parseInt(lastSync) < 43200000) return;

      try {
        setSyncingTracking(true);
        const settings = await storage.getSettings();
        const env = settings?.melhorEnvioEnvironment || 'sandbox';
        const token = env === 'production' ? settings?.melhorEnvioProdToken : settings?.melhorEnvioSandboxToken;

        if (token) {
          const res = await fetch('/api/melhorenvio/sync-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shipments,
              token,
              environment: env
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.updates && data.updates.length > 0) {
              // Aplica os updates no banco de dados local
              for (const update of data.updates) {
                const shipment = shipments.find(s => s.melhorEnvio?.orderId === update.orderId);
                if (shipment) {
                  await storage.updateShipment(shipment.id, {
                    ...shipment,
                    status: update.status,
                    dataEntrega: update.status === 'entregue' ? Date.now() : shipment.dataEntrega,
                    melhorEnvio: {
                      ...shipment.melhorEnvio,
                      status: update.melhorEnvioStatus
                    }
                  });
                }
              }
              // Opção: Mostrar notificação ou dar trigger num reload
              console.log(`[Sync] ${data.updates.length} remessas atualizadas.`);
            }
          }
        }
        localStorage.setItem('last_tracking_sync', now.toString());
      } catch (err) {
        console.error('Failed to sync tracking:', err);
      } finally {
        setSyncingTracking(false);
      }
    };

    syncTracking();
  }, [shipments, loading]);

  // Rastreio API
  const [showTrackingInfoModal, setShowTrackingInfoModal] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [currentTrackingCode, setCurrentTrackingCode] = useState('');

  const handleTrackPackage = async (e: React.MouseEvent, codigoRastreio: string) => {
    e.stopPropagation();
    if (!codigoRastreio) return;

    setCurrentTrackingCode(codigoRastreio);
    setShowTrackingInfoModal(true);
    setIsTrackingLoading(true);
    setTrackingError('');
    setTrackingData(null);

    try {
      const settings = await storage.getSettings();
      const apiKey = settings.siteRastreioApiKey;

      if (!apiKey) {
        throw new Error('Chave da API do Site Rastreio não configurada. Configure-a nas configurações do sistema.');
      }

      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: codigoRastreio, apiKey })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na requisição: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setTrackingData(data);
    } catch (err: any) {
      console.error('Erro ao rastrear encomenda:', err);
      setTrackingError(err.message || 'Ocorreu um erro desconhecido ao tentar rastrear a encomenda.');
    } finally {
      setIsTrackingLoading(false);
    }
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigate(`/envios/${id}`);
  };

  const handleCancel = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Remessa',
      message: 'Tem certeza que deseja cancelar esta remessa? Esta ação pode ser irreversível.',
      type: 'warning',
      onConfirm: () => updateShipmentStatus(id, 'cancelado'),
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Registro',
      message: 'ATENÇÃO: Isso excluirá o registro permanentemente. Continuar?',
      type: 'danger',
      onConfirm: () => deleteShipment(id),
    });
  };

  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const matchesSearch = s.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.destinatario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.codigoRastreio?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchTerm, statusFilter]);

  const getStatusColor = (status: ShipmentStatus) => {
    switch (status) {
      case 'rascunho': return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
      case 'ativo': return 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400';
      case 'enviado': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400';
      case 'entregue': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'cancelado': return 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400';
      default: return 'bg-zinc-100 text-zinc-600';
    }
  };

  const getStatusIcon = (status: ShipmentStatus) => {
    switch (status) {
      case 'rascunho': return <Clock size={14} />;
      case 'ativo': return <Package size={14} />;
      case 'enviado': return <Truck size={14} />;
      case 'entregue': return <CheckCircle size={14} />;
      case 'cancelado': return <XCircle size={14} />;
      default: return <Package size={14} />;
    }
  };

  const copyTracking = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    // You can add a toast notification here
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Gerenciamento de Envios</h1>
          <p className="text-sm text-zinc-500">Controle de remessas e lotes de equipamentos</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {canQuote && (
            <button 
              onClick={() => setIsQuotationModalOpen(true)}
              className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-[20px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xl shadow-emerald-500/20"
            >
              <Calculator size={16} />
              Cotar Frete
            </button>
          )}
          {canEdit && (
            <button 
              onClick={() => navigate('/envios/nova')}
              className="flex-1 md:flex-none bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-[20px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-xl shadow-primary-500/20"
            >
              <Plus size={16} />
              Nova Remessa
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por título, destinatário ou rastreio..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 transition-all font-medium"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 transition-all font-medium appearance-none"
          >
            <option value="all">Todos os Status</option>
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="enviado">Enviado</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Confirmar"
        cancelText="Cancelar"
      />

      <div className="grid grid-cols-1 gap-4">
        {filteredShipments.map(shipment => (
          <div 
            key={shipment.id}
            onClick={() => navigate(`/envios/${shipment.id}`)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-primary-500/50 transition-all cursor-pointer group flex flex-col md:flex-row gap-6 items-start md:items-center"
          >
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  {shipment.titulo}
                  {shipment.codigoRemessa && (
                    <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-md">
                      {shipment.codigoRemessa}
                    </span>
                  )}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusColor(shipment.status)}`}>
                  {getStatusIcon(shipment.status)}
                  {shipment.status}
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                Destinatário: <span className="font-medium text-zinc-700 dark:text-zinc-300">{shipment.destinatario.nome}</span>
              </p>
              <p className="text-xs text-zinc-400">
                Criado em: {new Date(shipment.dataCriacao).toLocaleDateString('pt-BR')} por {shipment.consultorNome}
              </p>
            </div>

            <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-500">Itens:</span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg text-sm font-bold text-zinc-900 dark:text-white">
                  {shipment.itens.length}
                </span>
              </div>
              
              {shipment.codigoRastreio ? (
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <Truck size={16} className="text-zinc-400" />
                  <span className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-300">{shipment.codigoRastreio}</span>
                  <button 
                    onClick={(e) => copyTracking(e, shipment.codigoRastreio!)}
                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    title="Copiar Rastreio"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => handleTrackPackage(e, shipment.codigoRastreio!)}
                    className="ml-2 px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold rounded-md transition-colors shadow-sm"
                  >
                    Rastrear
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Rastreio Pendente</span>
                </div>
              )}

              {canEdit && (
                <div className="flex gap-2 mt-2">
                  <button onClick={(e) => handleEdit(e, shipment.id)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700" title="Editar"><Edit2 size={16} /></button>
                  {shipment.status !== 'cancelado' && (
                    <button onClick={(e) => handleCancel(e, shipment.id)} className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/40" title="Cancelar"><XCircle size={16} /></button>
                  )}
                  <button onClick={(e) => handleDelete(e, shipment.id)} className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40" title="Excluir"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
            
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-500 transition-colors">
              <ChevronRight size={20} />
            </div>
          </div>
        ))}

        {filteredShipments.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <Package size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Nenhuma remessa encontrada</h3>
            <p className="text-zinc-500">Tente ajustar os filtros ou crie uma nova remessa.</p>
          </div>
        )}
      </div>

      <ShipmentTrackingModal
        isOpen={showTrackingInfoModal}
        onClose={() => setShowTrackingInfoModal(false)}
        trackingCode={currentTrackingCode}
        isLoading={isTrackingLoading}
        error={trackingError}
        trackingData={trackingData}
      />

      <QuotationModal 
        isOpen={isQuotationModalOpen} 
        onClose={() => setIsQuotationModalOpen(false)} 
      />
    </div>
  );
};
