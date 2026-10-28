
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../services/storage';
import { Plus, Search, MapPin, CarFront, Bike, Clock, LayoutGrid, X, List, Circle, Activity, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { geocodingService } from '../../services/geocoding';

// Hooks
import { useVehiclesData } from './hooks/useVehiclesData';
import { useVehicleFilters } from './hooks/useVehicleFilters';
import { useVehicleSelection } from './hooks/useVehicleSelection';
import { useVehicleExport } from './hooks/useVehicleExport';

// Components
import { VehicleTable } from './components/VehicleTable';
import { VehicleFiltersBar } from './components/VehicleFiltersBar';
import { VehicleKPIModal } from './components/VehicleKPIModal';
import { Vehicle, LocationHistory } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { trackingApi } from '../../services/trackingApi';

import { ConfirmModal } from '../../components/ConfirmModal';
import { Button, ModuleHeader, Pagination } from '../../components/ui';
import { FleetTagSummary } from './components/FleetTagSummary';
import { useVehicleSummary } from './hooks/useVehicleSummary';
import { authenticatedFetch } from '../../services/authenticatedFetch';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

const MotionDiv = motion.div as any;

const subscribeToMobileViewport = (onChange: () => void) => {
  const mediaQuery = window.matchMedia('(max-width: 767px)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
};

const getMobileViewportSnapshot = () => window.matchMedia('(max-width: 767px)').matches;
const getMobileViewportServerSnapshot = () => false;

export const VehiclesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, customRoles } = useAuth();
  const canManageVehicles = hasPermission(currentUser, customRoles, PERMISSIONS.VEHICLES_MANAGE);
  
  // 1. Filters are sent to the backend; only one database page is kept in memory.
  const { 
    searchTerm, setSearchTerm, 
    statusFilter, setStatusFilter,
    companyFilter, setCompanyFilter,
    ownershipFilter, setOwnershipFilter,
    installationFilter, setInstallationFilter,
    tagFilter, setTagFilter
  } = useVehicleFilters([], []);
  const { vehicles, tags, companies, categories, clients, loading, searching, error: loadError, reload, removeVehicle, page, pageSize, hasMore, nextPage, previousPage, firstPage } = useVehiclesData(currentUser, {
    search: searchTerm, status: statusFilter, companyId: companyFilter, ownershipStatus: ownershipFilter,
    installationType: installationFilter, tag: tagFilter === 'c_tag' ? 'linked' : tagFilter === 's_tag' ? 'unlinked' : 'all',
  });
  // Filtra imediatamente a página que já está em memória. A consulta remota
  // continua sendo a fonte de verdade e encontra resultados fora da página,
  // mas placas visíveis não precisam aguardar o debounce + rede.
  const filteredVehicles = React.useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return vehicles.filter(vehicle => {
      const clientName = clients.find(client => client.id === vehicle.clientId)?.name || '';
      const tag = tags.find(item => item.id === vehicle.tagId);
      const searchable = [vehicle.plate, vehicle.model, clientName, tag?.accessoryId, tag?.imei]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      return (!term || searchable.includes(term))
        && (statusFilter === 'all' || vehicle.status === statusFilter)
        && (companyFilter === 'all' || vehicle.companyId === companyFilter)
        && (ownershipFilter === 'all' || vehicle.ownershipStatus === ownershipFilter)
        && (installationFilter === 'all' || vehicle.installationType === installationFilter)
        && (tagFilter === 'all' || (tagFilter === 'c_tag' ? Boolean(vehicle.tagId) : !vehicle.tagId));
    });
  }, [vehicles, clients, tags, searchTerm, statusFilter, companyFilter, ownershipFilter, installationFilter, tagFilter]);

  const isFiltered = Boolean(searchTerm.trim()) || statusFilter !== 'all' || companyFilter !== 'all'
    || ownershipFilter !== 'all' || installationFilter !== 'all' || tagFilter !== 'all';
  const { summary: fleetSummary, untagged: untaggedVehicles, reload: reloadSummary } = useVehicleSummary(Boolean(currentUser) && currentUser?.role !== 'client');

  React.useEffect(() => {
     if (location.state?.searchTarget) {
        setSearchTerm(location.state.searchTarget);
        window.history.replaceState({}, document.title);
     }
  }, [location.state, setSearchTerm]);
  
  // 3. Selection
  const { selectedVehicles, toggleSelect, handleSelectAll, clearSelection } = useVehicleSelection(filteredVehicles);
  
  // 4. Export
  const { isExporting, handleExportPDF, handleExportExcel, handleExportCSV } = useVehicleExport({
    vehicles, filteredVehicles, selectedVehicles, tags, companies, categories, clients, clearSelection
  });

  const isClientView = currentUser?.role === 'client';
  const isMobile = React.useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getMobileViewportServerSnapshot,
  );
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);

  // UI State for Client Mobile
  const [showSearch, setShowSearch] = React.useState(false);
  const [isGridView, setIsGridView] = React.useState(true); // Toggle Grid/List

  const handleDelete = async (id: string) => {
      const v = vehicles.find(v => v.id === id);
      const response = await authenticatedFetch(`/api/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir o veículo.');
      removeVehicle(id);
      console.info('Veículo excluído', { id, plate: v?.plate });
      // A confirmação já pode fechar; a reconciliação da frota e das coleções
      // auxiliares não deve manter o usuário preso no estado "Excluindo...".
      void reload();
      void reloadSummary();
  };

  // --- CLIENT MOBILE VIEW COMPONENTS ---

  const ClientMobileHeader = () => (
      <div className="bg-zinc-900 rounded-card-lg p-8 shadow-2xl border border-zinc-800 relative overflow-hidden mb-6">
          <div className="relative z-10">
              <h2 className="text-6xl font-display font-black text-primary-500 tracking-tighter leading-none">{vehicles.length}</h2>
              <p className="text-2xs font-black text-fg-3 uppercase tracking-[0.2em] mt-2">Frota Monitorada</p>
              
              <div className="flex items-center gap-2 mt-6 text-2xs font-mono text-fg-2 bg-black/20 w-fit px-3 py-1 rounded-full border border-white/5">
                  <Activity size={10} className="text-emerald-500" />
                  <span>Sincronizado: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
          </div>
          <div className="absolute -right-6 -bottom-6 text-zinc-800/50 pointer-events-none transform rotate-[-10deg]">
              <CarFront size={160} strokeWidth={1} />
          </div>
      </div>
  );

  const ClientVehicleCard: React.FC<{ vehicle: Vehicle }> = ({ vehicle }) => {
      const { addNotification } = useNotification();
      const category = categories.find(c => c.id === vehicle.type);
      const isMoto = category?.fipeType === 'motos' || vehicle.model.toLowerCase().includes('moto');
      const tag = tags.find((t: any) => t.id === vehicle.tagId);
      
      const lastPos = vehicle.lastPosition as LocationHistory | undefined;
      const [address, setAddress] = useState<string>('Buscando localização...');
      const [isUpdating, setIsUpdating] = useState(false);
      const [updateSuccess, setUpdateSuccess] = useState(false);
      const [timeAgo, setTimeAgo] = useState<string>('');

      const updateTimeAgo = () => {
        if (vehicle.lastPosition?.timestamp) {
          const diff = Date.now() - vehicle.lastPosition.timestamp;
          const minutes = Math.floor(diff / 60000);
          if (minutes < 1) setTimeAgo('agora mesmo');
          else if (minutes < 60) setTimeAgo(`há ${minutes} min`);
          else {
            const hours = Math.floor(minutes / 60);
            if (hours < 24) setTimeAgo(`há ${hours} h`);
            else {
              const days = Math.floor(hours / 24);
              setTimeAgo(`há ${days} d`);
            }
          }
        } else {
          setTimeAgo('Sem localização');
        }
      };

      useEffect(() => {
        updateTimeAgo();
        const interval = setInterval(updateTimeAgo, 60000);
        return () => clearInterval(interval);
      }, [vehicle.lastPosition?.timestamp]);

      const handleUpdateLocation = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if ((!tag && !vehicle.trackerId) || isUpdating) return;
        
        setIsUpdating(true);
        setUpdateSuccess(false);
        try {
          const result = tag ? await trackingApi.refreshTag(tag.id) : await trackingApi.vehiclePosition(vehicle.id);
          const status = 'status' in result ? result.status : result.degraded ? 'error' : 'unchanged';
          const point = 'position' in result ? result.position : result;
          const age = point?.timestamp ? ` Última posição há ${Math.max(0, Math.floor((Date.now() - point.timestamp) / 60_000))} min.` : '';
          addNotification(status === 'error' ? 'error' : status === 'updated' ? 'success' : 'info',
            status === 'updated' ? 'Posição atualizada' : status === 'error' ? 'Sem resposta' : 'Sem nova posição',
            `${result.error || (status === 'updated' ? 'Nova posição recebida.' : 'A posição não mudou.')}${age}`);
          setUpdateSuccess(status === 'updated');
          setTimeout(() => setUpdateSuccess(false), 3000);
          reload();
        } catch (error) {
          console.error("Failed to update location", error);
          addNotification('error', 'Falha na atualização', error instanceof Error ? error.message : 'Não foi possível consultar o equipamento.');
        } finally {
          setIsUpdating(false);
        }
      };

      // Efeito para resolver endereço real
      useEffect(() => {
          let isMounted = true;
          const resolve = async () => {
              if (lastPos) {
                  try {
                      // Usa cache ou busca nova (geocodingService já trata cache interno se implementado)
                      const addr = await geocodingService.reverseGeocode(lastPos.lat, lastPos.lon);
                      if (isMounted) setAddress(addr);
                  } catch (e) {
                      if (isMounted) setAddress('Endereço indisponível');
                  }
              } else {
                  if (isMounted) setAddress('Sem dados de localização');
              }
          };
          resolve();
          return () => { isMounted = false; };
      }, [lastPos]);

      if (isGridView) {
          // LAYOUT EM GRADE (CARD PREMIUM)
          return (
              <div className="bg-surface rounded-card-lg overflow-hidden shadow-sm border border-line mb-4 relative">
                  <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                          <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center shrink-0 text-fg-3">
                              {isMoto ? <Bike size={24} /> : <CarFront size={24} />}
                          </div>
                          {lastPos ? (
                              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-2xs font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1.5">
                                  <Circle size={6} fill="currentColor" /> Online
                              </div>
                          ) : (
                              <div className="px-3 py-1 bg-surface-2 text-fg-3 rounded-full text-2xs font-black uppercase tracking-widest border border-line">
                                  Offline
                              </div>
                          )}
                      </div>

                      <div className="mb-6">
                          <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-2xl font-display font-black text-fg-1 uppercase tracking-tight leading-none">{vehicle.plate}</h3>
                              {tag && (
                                  <span className="text-2xs bg-surface-2 text-fg-2 px-2 py-1 rounded font-mono font-bold border border-line">
                                       TAG: {tag.accessoryId || tag.imei || tag.name}
                                  </span>
                              )}
                          </div>
                          <p className="text-xs font-bold text-fg-2 uppercase tracking-wide leading-tight line-clamp-1">{vehicle.model}</p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-line">
                          <div className="flex items-start gap-3">
                              <MapPin size={16} className="text-primary-500 shrink-0 mt-0.5" />
                              <p className="text-xs font-medium text-fg-1 leading-tight line-clamp-2">
                                  {address}
                              </p>
                          </div>
                          
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-fg-3 pl-0.5">
                                  <Clock size={12} />
                                  <span className="text-2xs font-mono font-bold">
                                      {timeAgo}
                                  </span>
                              </div>
                              
                              {tag && (
                                  <button
                                      onClick={handleUpdateLocation}
                                      disabled={isUpdating}
                                      className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
                                          updateSuccess 
                                              ? 'bg-emerald-500/10 text-emerald-500' 
                                              : 'bg-surface-2 text-fg-2 hover:text-primary-500 hover:bg-primary-500/10'
                                      }`}
                                      title="Atualizar Localização"
                                  >
                                      {updateSuccess ? (
                                          <CheckCircle2 size={14} />
                                      ) : (
                                          <RefreshCwIcon size={14} className={isUpdating ? 'animate-spin' : ''} />
                                      )}
                                      <span className="text-2xs font-bold uppercase tracking-wider hidden sm:inline-block">
                                          {updateSuccess ? 'Atualizado' : 'Atualizar'}
                                      </span>
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          );
      } else {
          // LAYOUT EM LISTA (COMPACTO)
          return (
              <div className="bg-surface rounded-2xl p-4 shadow-sm border border-line mb-3 flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center shrink-0 text-fg-3">
                      {isMoto ? <Bike size={20} /> : <CarFront size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-fg-1 uppercase tracking-tight">{vehicle.plate}</h3>
                              {tag && (
                                  <span className="text-2xs bg-surface-2 text-fg-2 px-1.5 py-0.5 rounded font-mono font-bold">
                                       TAG: {tag.accessoryId || tag.imei || tag.name}
                                  </span>
                              )}
                          </div>
                          <div className={`w-2 h-2 rounded-full ${lastPos ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                      </div>
                      <p className="text-2xs text-fg-2 font-medium truncate mb-1">{vehicle.model}</p>
                      <div className="flex items-center justify-between">
                          <p className="text-2xs text-fg-3 truncate flex items-center gap-1"><MapPin size={10}/> {address}</p>
                          <div className="flex items-center gap-2">
                              <span className="text-2xs text-fg-3 font-mono">{timeAgo}</span>
                              {tag && (
                                  <button
                                      onClick={handleUpdateLocation}
                                      disabled={isUpdating}
                                      className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                                          updateSuccess 
                                              ? 'bg-emerald-500/10 text-emerald-500' 
                                              : 'bg-surface-2 text-fg-2 hover:text-primary-500 hover:bg-primary-500/10'
                                      }`}
                                      title="Atualizar Localização"
                                  >
                                      {updateSuccess ? (
                                          <CheckCircle2 size={12} />
                                      ) : (
                                          <RefreshCwIcon size={12} className={isUpdating ? 'animate-spin' : ''} />
                                      )}
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          );
      }
  };

  // Ícone de Refresh simples para o componente
  const RefreshCwIcon = ({size, className}: {size:number, className?: string}) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
          <path d="M21 3v5h-5"></path>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
          <path d="M8 16H3v5"></path>
      </svg>
  );

  // --- RENDER ---

  if (isClientView && isMobile) {
      return (
          <div className="space-y-6 pt-2">
              <ClientMobileHeader />
              
              {/* Toolbar */}
              <div className="flex justify-between items-center px-1 mb-2 sticky top-0 bg-app backdrop-blur-md py-2 z-20 transition-all">
                  <div onClick={() => setShowSearch(!showSearch)} className="flex items-center gap-3 cursor-pointer">
                      <h2 className="text-lg font-display font-black text-fg-1 uppercase tracking-tight">Meus veículos</h2>
                      <div className="h-10 w-10 rounded-full bg-surface flex items-center justify-center shadow-sm border border-line text-fg-3">
                          {showSearch ? <X size={14}/> : <Search size={14}/>}
                      </div>
                  </div>
                  <div className="flex bg-line p-1 rounded-xl">
                      <button 
                          onClick={() => setIsGridView(true)}
                          className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all ${isGridView ? 'bg-surface text-fg-1 shadow-sm' : 'text-fg-3'}`}
                      >
                          <LayoutGrid size={16}/>
                      </button>
                      <button 
                          onClick={() => setIsGridView(false)}
                          className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all ${!isGridView ? 'bg-surface text-fg-1 shadow-sm' : 'text-fg-3'}`}
                      >
                          <List size={16}/> 
                      </button>
                  </div>
              </div>

              {/* Search Bar */}
              <AnimatePresence>
                  {showSearch && (
                      <MotionDiv initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6 px-1">
                          <input 
                              type="text" 
                              placeholder="Buscar placa ou modelo..." 
                              value={searchTerm} 
                              onChange={e => setSearchTerm(e.target.value)} 
                              className="w-full h-14 rounded-2xl bg-surface px-6 font-bold text-sm outline-none border border-line shadow-sm text-fg-1 focus-visible:border-primary-500 transition-colors"
                              autoFocus
                          />
                      </MotionDiv>
                  )}
              </AnimatePresence>

              {/* Cards List */}
              <div className="space-y-1 pb-48">
                  {filteredVehicles.map(v => (
                      <ClientVehicleCard key={v.id} vehicle={v} />
                  ))}
                  {filteredVehicles.length === 0 && (
                      <div className="py-20 text-center opacity-40 flex flex-col items-center justify-center gap-4">
                          <div className="w-16 h-16 bg-line rounded-full flex items-center justify-center">
                             <CarFront size={32} className="text-fg-3"/>
                          </div>
                          <p className="text-xs font-black uppercase text-fg-2 tracking-widest">Nenhum veículo encontrado</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- STANDARD VIEW (DESKTOP & NON-CLIENTS) ---
  return (
    <div className="space-y-6 pb-24">
      <ModuleHeader
        eyebrow="Módulo de operações"
        title={isClientView ? 'Minha frota' : 'Veículos'}
        subtitle={isClientView ? 'Seus veículos e equipamentos.' : 'Gestão operacional da frota.'}
        actions={canManageVehicles ? (
          <>
            <Button type="button" variant="inverse" onClick={() => setIsKPIModalOpen(true)}>
              <Activity size={14} aria-hidden /> Relatório KPI
            </Button>
            <Button type="button" size="pill" onClick={() => navigate('/vehicles/new')}>
              <Plus size={16} strokeWidth={3} aria-hidden /> Adicionar veículo
            </Button>
          </>
        ) : undefined}
      />

      {!isClientView && <FleetTagSummary summary={fleetSummary} untagged={untaggedVehicles} />}

      <VehicleFiltersBar 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        companyFilter={companyFilter}
        setCompanyFilter={setCompanyFilter}
        ownershipFilter={ownershipFilter}
        setOwnershipFilter={setOwnershipFilter}
        installationFilter={installationFilter}
        setInstallationFilter={setInstallationFilter}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        companies={companies}
        isClientView={isClientView}
        selectedCount={selectedVehicles.size}
        totalCount={filteredVehicles.length}
        handleSelectAll={handleSelectAll}
        handleExportPDF={handleExportPDF}
        handleExportExcel={handleExportExcel}
        handleExportCSV={handleExportCSV}
        searchPlaceholder={isClientView ? "Buscar placa, modelo ou IMEI..." : "Buscar placa, modelo, cliente ou IMEI..."}
      />

      <VehicleTable 
        vehicles={filteredVehicles}
        searching={searching}
        tags={tags}
        categories={categories}
        clients={clients}
        isReadOnly={!canManageVehicles}
        filtered={isFiltered}
        onCreate={() => navigate('/vehicles/new')}
        selectedVehicles={selectedVehicles}
        toggleSelect={toggleSelect}
        onEdit={(v) => navigate(`/vehicles/${encodeURIComponent(v.id)}/edit`)}
        onDelete={(id) => { setVehicleToDelete(id); setIsConfirmDeleteOpen(true); }}
        footer={(page > 1 || hasMore) || filteredVehicles.length > 0 ? (
          <Pagination
            summary={(() => {
              const start = (page - 1) * pageSize + 1;
              const end = start + vehicles.length - 1;
              const showTotal = !isFiltered && fleetSummary;
              return vehicles.length === 0 ? 'Nenhum resultado' : `${start}–${end}${showTotal ? ` de ${fleetSummary.total}` : ''}`;
            })()}
            page={page}
            pageCount={!isFiltered && fleetSummary ? Math.max(1, Math.ceil(fleetSummary.total / pageSize)) : undefined}
            hasNext={hasMore}
            loading={loading}
            onFirst={firstPage}
            onPrevious={previousPage}
            onNext={nextPage}
          />
        ) : undefined}
      />
      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>Tentar novamente</Button>
        </div>
      )}

      {isKPIModalOpen && (
        <VehicleKPIModal 
          onClose={() => setIsKPIModalOpen(false)}
          vehicles={filteredVehicles}
          companies={companies}
          tags={tags}
          categories={categories}
          clients={clients}
        />
      )}

      <ConfirmModal 
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={() => vehicleToDelete && handleDelete(vehicleToDelete)}
          title="Excluir Veículo"
          message={`Tem certeza que deseja excluir o veículo ${vehicles.find(v => v.id === vehicleToDelete)?.plate}? Esta ação não pode ser desfeita.`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          type="danger"
      />
    </div>
  );
};
