
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
import { useHinovaLookup } from './hooks/useHinovaLookup';
import { useFipeSearch } from './hooks/useFipeSearch';
import { useVehicleForm } from './hooks/useVehicleForm';

// Components
import { VehicleTable } from './components/VehicleTable';
import { VehicleFiltersBar } from './components/VehicleFiltersBar';
import { VehicleModal } from './components/VehicleModal';
import { FipeModal } from './components/FipeModal';
import { VehicleKPIModal } from './components/VehicleKPIModal';
import { Vehicle, LocationHistory } from '../../types';

import { ConfirmModal } from '../../components/ConfirmModal';

const MotionDiv = motion.div as any;

export const VehiclesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  
  // 1. Data Fetching
  const { vehicles, tags, companies, categories, clients, loading, reload } = useVehiclesData(currentUser);
  
  // 2. Filters
  const { 
    searchTerm, setSearchTerm, 
    statusFilter, setStatusFilter,
    companyFilter, setCompanyFilter,
    ownershipFilter, setOwnershipFilter,
    installationFilter, setInstallationFilter,
    tagFilter, setTagFilter,
    filteredVehicles 
  } = useVehicleFilters(vehicles, clients);

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

  // 5. Form Logic
  const { 
    isModalOpen, setIsModalOpen, 
    formData, setFormData, 
    clientData, setClientData, 
    tagSearch, setTagSearch, 
    handleSave, checkExistingClient, openNew, openEdit 
  } = useVehicleForm(vehicles, clients, currentUser, reload);

  // 6. External Services
  const { status: hinovaStatus, lookupPlate } = useHinovaLookup(setFormData, setClientData, clients);
  const { 
    isOpen: isFipeOpen, setIsOpen: setIsFipeOpen, 
    step, loading: fipeLoading, searchTerm: fipeSearchTerm, setSearchTerm: setFipeSearchTerm, 
    currentType, selectedBrand, selectedModel, filteredList: fipeList, 
    startSearch, handleSelection: handleFipeSelection, handleBack: handleFipeBack 
  } = useFipeSearch(categories);

  // 7. Auto Open Modal from URL
  const isClientView = currentUser?.role === 'client';
  const isMobile = window.innerWidth < 768; 
  const [isTagListOpen, setIsTagListOpen] = React.useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);

  // UI State for Client Mobile
  const [showSearch, setShowSearch] = React.useState(false);
  const [isGridView, setIsGridView] = React.useState(true); // Toggle Grid/List

  React.useEffect(() => {
    if (searchParams.get('action') === 'new' && !isClientView) {
        openNew();
    }
  }, [searchParams]);

  // Derived state for plate validation visualization passed to modal
  const isPlateValid = React.useMemo(() => {
      return !!formData.plate && formData.plate.length >= 7; 
  }, [formData.plate]);

  const handleDelete = async (id: string) => {
      const v = vehicles.find(v => v.id === id);
      await storage.deleteVehicle(id); 
      if (currentUser && v) {
          storage.logAction(currentUser, 'DELETE', 'Vehicle', `Removeu veículo: ${v.plate}`, id);
      }
      reload(); 
  };

  // --- CLIENT MOBILE VIEW COMPONENTS ---

  const ClientMobileHeader = () => (
      <div className="bg-zinc-900 rounded-[32px] p-8 shadow-2xl border border-zinc-800 relative overflow-hidden mb-6">
          <div className="relative z-10">
              <h2 className="text-6xl font-display font-black text-primary-500 tracking-tighter leading-none">{vehicles.length}</h2>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-2">Frota Monitorada</p>
              
              <div className="flex items-center gap-2 mt-6 text-[10px] font-mono text-zinc-500 bg-black/20 w-fit px-3 py-1 rounded-full border border-white/5">
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
        if (!tag || isUpdating) return;
        
        setIsUpdating(true);
        setUpdateSuccess(false);
        try {
          const { fetchTagLocation } = await import('../../services/api');
          const results = await fetchTagLocation(tag);
          if (results && results.length > 0) {
            const location = { ...results[0], tagId: tag.id, id: tag.id };
            await storage.updateVehiclePosition(vehicle.id, location as any);
            setUpdateSuccess(true);
            setTimeout(() => setUpdateSuccess(false), 3000);
            reload(); // Reload vehicles to get updated position
          }
        } catch (error) {
          console.error("Failed to update location", error);
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
              <div className="bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4 relative">
                  <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                          <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shrink-0 text-zinc-400">
                              {isMoto ? <Bike size={24} /> : <CarFront size={24} />}
                          </div>
                          {lastPos ? (
                              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1.5">
                                  <Circle size={6} fill="currentColor" /> Online
                              </div>
                          ) : (
                              <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-700">
                                  Offline
                              </div>
                          )}
                      </div>

                      <div className="mb-6">
                          <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">{vehicle.plate}</h3>
                              {tag && (
                                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded font-mono font-bold border border-zinc-200 dark:border-zinc-700">
                                       TAG: {tag.accessoryId || tag.imei || tag.name}
                                  </span>
                              )}
                          </div>
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide leading-tight line-clamp-1">{vehicle.model}</p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-start gap-3">
                              <MapPin size={16} className="text-primary-500 shrink-0 mt-0.5" />
                              <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 leading-tight line-clamp-2">
                                  {address}
                              </p>
                          </div>
                          
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-zinc-400 pl-0.5">
                                  <Clock size={12} />
                                  <span className="text-[10px] font-mono font-bold">
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
                                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 hover:bg-primary-500/10'
                                      }`}
                                      title="Atualizar Localização"
                                  >
                                      {updateSuccess ? (
                                          <CheckCircle2 size={14} />
                                      ) : (
                                          <RefreshCwIcon size={14} className={isUpdating ? 'animate-spin' : ''} />
                                      )}
                                      <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block">
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
              <div className="bg-white dark:bg-zinc-900 rounded-[20px] p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-3 flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400">
                      {isMoto ? <Bike size={20} /> : <CarFront size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">{vehicle.plate}</h3>
                              {tag && (
                                  <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono font-bold">
                                       TAG: {tag.accessoryId || tag.imei || tag.name}
                                  </span>
                              )}
                          </div>
                          <div className={`w-2 h-2 rounded-full ${lastPos ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium truncate mb-1">{vehicle.model}</p>
                      <div className="flex items-center justify-between">
                          <p className="text-[9px] text-zinc-400 truncate flex items-center gap-1"><MapPin size={10}/> {address}</p>
                          <div className="flex items-center gap-2">
                              <span className="text-[9px] text-zinc-400 font-mono">{timeAgo}</span>
                              {tag && (
                                  <button
                                      onClick={handleUpdateLocation}
                                      disabled={isUpdating}
                                      className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                                          updateSuccess 
                                              ? 'bg-emerald-500/10 text-emerald-500' 
                                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary-500 hover:bg-primary-500/10'
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
              <div className="flex justify-between items-center px-1 mb-2 sticky top-0 bg-zinc-100/90 dark:bg-black/90 backdrop-blur-md py-2 z-20 transition-all">
                  <div onClick={() => setShowSearch(!showSearch)} className="flex items-center gap-3 cursor-pointer">
                      <h2 className="text-lg font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">Meus veículos</h2>
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-800 text-zinc-400">
                          {showSearch ? <X size={14}/> : <Search size={14}/>}
                      </div>
                  </div>
                  <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-xl">
                      <button 
                          onClick={() => setIsGridView(true)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isGridView ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm' : 'text-zinc-400'}`}
                      >
                          <LayoutGrid size={16}/>
                      </button>
                      <button 
                          onClick={() => setIsGridView(false)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${!isGridView ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm' : 'text-zinc-400'}`}
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
                              className="w-full h-14 rounded-2xl bg-white dark:bg-zinc-900 px-6 font-bold text-sm outline-none border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-white focus:border-primary-500 transition-colors"
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
                          <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                             <CarFront size={32} className="text-zinc-400"/>
                          </div>
                          <p className="text-xs font-black uppercase text-zinc-500 tracking-widest">Nenhum veículo encontrado</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- STANDARD VIEW (DESKTOP & NON-CLIENTS) ---
  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{isClientView ? 'Minha Frota' : 'Veículos'}</h1>
          <p className="text-zinc-500 text-xs mt-1 font-medium">{isClientView ? 'Gestão dos seus veículos e equipamentos.' : 'Gestão operacional da frota.'}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isClientView && (
            <>
              <button
                onClick={() => setIsKPIModalOpen(true)}
                className="flex-1 md:flex-none bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[9px] tracking-widest shadow-xl transition-all"
              >
                <Activity size={16} strokeWidth={3} /> RELATÓRIO KPI
              </button>
              <button
                onClick={openNew}
                className="flex-1 md:flex-none bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[9px] tracking-widest shadow-xl transition-all"
              >
                <Plus size={16} strokeWidth={3} /> ADICIONAR VEÍCULO
              </button>
            </>
          )}
        </div>
      </div>

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
        searchPlaceholder={isClientView ? "Buscar na minha frota..." : "Buscar placa, modelo ou cliente..."}
      />

      <VehicleTable 
        vehicles={filteredVehicles}
        tags={tags}
        categories={categories}
        clients={clients}
        isReadOnly={isClientView}
        selectedVehicles={selectedVehicles}
        toggleSelect={toggleSelect}
        onEdit={(v) => openEdit(v, tags)}
        onDelete={(id) => { setVehicleToDelete(id); setIsConfirmDeleteOpen(true); }}
      />

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

      {isModalOpen && (
        <VehicleModal 
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSave}
            formData={formData}
            setFormData={setFormData}
            clientData={clientData}
            setClientData={setClientData}
            companies={companies}
            categories={categories}
            tags={tags}
            allVehicles={vehicles} // Passa todos os veículos para verificar vínculos de tags
            tagSearch={tagSearch}
            setTagSearch={setTagSearch}
            onHinovaLookup={() => lookupPlate(formData.plate || '')}
            hinovaStatus={hinovaStatus}
            onCheckClient={checkExistingClient}
            onFipeOpen={() => startSearch(formData.type)}
            isTagListOpen={isTagListOpen}
            setIsTagListOpen={setIsTagListOpen}
            isPlateValid={isPlateValid}
        />
      )}

      {isFipeOpen && (
        <div className="fixed inset-0 z-[10000]">
          <FipeModal 
              onClose={() => setIsFipeOpen(false)}
              step={step}
              loading={fipeLoading}
              searchTerm={fipeSearchTerm}
              setSearchTerm={setFipeSearchTerm}
              currentType={currentType}
              selectedBrand={selectedBrand}
              selectedModel={selectedModel}
              filteredList={fipeList}
              handleSelection={(item) => handleFipeSelection(item, (model, year, price) => setFormData(prev => ({...prev, model, year, fipeValue: price})))}
              handleBack={handleFipeBack}
          />
        </div>
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
