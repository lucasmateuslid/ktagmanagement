
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../services/storage';
import { Plus } from 'lucide-react';

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

const { useSearchParams } = ReactRouterDOM as any;

export const VehiclesPage = () => {
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  
  // 1. Data Fetching
  const { vehicles, tags, companies, categories, clients, loading, reload } = useVehiclesData(currentUser);
  
  // 2. Filters
  const { searchTerm, setSearchTerm, filteredVehicles } = useVehicleFilters(vehicles, clients);
  
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
  } = useVehicleForm(clients, currentUser, reload);

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
  const [isTagListOpen, setIsTagListOpen] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get('action') === 'new' && !isClientView) {
        openNew();
    }
  }, [searchParams]);

  // Derived state for plate validation visualization passed to modal
  const isPlateValid = React.useMemo(() => {
      // Reuse logic or pass down validation function
      // Simple check here as real validation is inside hook
      return !!formData.plate && formData.plate.length >= 7; 
  }, [formData.plate]);

  const handleDelete = async (id: string) => {
      if(confirm('Excluir?')) { 
          await storage.deleteVehicle(id); 
          reload(); 
      }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{isClientView ? 'Minha Frota' : 'Veículos'}</h1>
          <p className="text-zinc-500 text-xs mt-1 font-medium">{isClientView ? 'Gestão dos seus veículos e equipamentos.' : 'Gestão operacional da frota.'}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isClientView && (
              <button
                onClick={openNew}
                className="flex-1 md:flex-none bg-primary-500 hover:bg-primary-400 text-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[9px] tracking-widest shadow-xl transition-all"
              >
                <Plus size={16} strokeWidth={3} /> ADICIONAR VEÍCULO
              </button>
          )}
        </div>
      </div>

      <VehicleFiltersBar 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
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
        onDelete={handleDelete}
      />

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
            handleSelection={(item) => handleFipeSelection(item, (model, year) => setFormData(prev => ({...prev, model, year})))}
            handleBack={handleFipeBack}
        />
      )}
    </div>
  );
};
