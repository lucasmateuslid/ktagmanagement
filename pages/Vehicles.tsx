
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { fipeService, FipeReference } from '../services/fipe';
import { plateLookupService } from '../services/plateLookup';
import { hinovaService } from '../services/hinova';
import { Tag, Vehicle, Company, VehicleCategory, Client } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { Plus, Trash2, Edit2, Car as CarIcon, Truck, Bike, Save, X, Link as LinkIcon, Search, Loader2, Building2, ChevronDown, Check, ShieldAlert, AlertTriangle, Wrench, User, Phone, MapPin, CheckCircle, XCircle, Database, Settings } from 'lucide-react';

// --- Internal Component: Searchable Select ---
interface SearchableSelectProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, options, value, onChange, placeholder, disabled, loading, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm(''); // Reset search when closed
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 text-left border rounded-lg flex items-center justify-between transition-colors
          ${disabled 
            ? 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 border-zinc-200 dark:border-zinc-800 cursor-not-allowed' 
            : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white hover:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
          }
        `}
      >
        <div className="flex items-center gap-2 truncate">
          {loading && <Loader2 size={14} className="animate-spin text-primary-500" />}
          {icon && !loading && <span className="text-zinc-400">{icon}</span>}
          <span className={!selectedOption ? 'text-zinc-400' : ''}>
            {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
          </span>
        </div>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:border-primary-500 text-zinc-900 dark:text-white placeholder-zinc-400"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 ? (
               <div className="p-3 text-center text-xs text-zinc-400 italic">No results found</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 rounded-md text-sm cursor-pointer flex items-center justify-between group transition-colors
                    ${value === opt.value 
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium' 
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    }
                  `}
                >
                  {opt.label}
                  {value === opt.value && <Check size={14} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const Vehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});
  const [clientFormData, setClientFormData] = useState<Partial<Client>>({}); // Client Data

  const { t } = useLanguage();
  const { addNotification } = useNotification();

  const [useFipe, setUseFipe] = useState(false);
  const [fipeBrands, setFipeBrands] = useState<FipeReference[]>([]);
  const [fipeModels, setFipeModels] = useState<FipeReference[]>([]);
  const [fipeYears, setFipeYears] = useState<FipeReference[]>([]);
  const [loadingFipe, setLoadingFipe] = useState(false);
  const [loadingPlate, setLoadingPlate] = useState(false);
  
  // Hinova Status Modal State
  const [hinovaStatus, setHinovaStatus] = useState<{
    open: boolean;
    step: 'idle' | 'loading' | 'success' | 'error';
    message: string;
    details?: string;
  }>({ open: false, step: 'idle', message: '' });
  
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Enhanced Tag Search
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()) || 
    tag.accessoryId.toLowerCase().includes(tagSearchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const loadData = async () => {
    const [v, t, c, cat, cl] = await Promise.all([
        storage.getVehicles(),
        storage.getTags(),
        storage.getCompanies(),
        storage.getCategories(),
        storage.getClients()
    ]);
    setVehicles(v);
    setTags(t);
    setCompanies(c);
    setCategories(cat);
    setClients(cl);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (useFipe && isModalOpen) {
      loadBrands();
    }
  }, [useFipe, isModalOpen, formData.type]);

  const getCurrentCategory = () => categories.find(c => c.id === formData.type);
  const isFipeEnabled = () => {
      const cat = getCurrentCategory();
      return cat && cat.fipeType && cat.fipeType !== 'none';
  };

  const loadBrands = async () => {
    const cat = getCurrentCategory();
    if (!cat || cat.fipeType === 'none') return;
    
    setLoadingFipe(true);
    const brands = await fipeService.getBrands(cat.fipeType as any);
    setFipeBrands(brands);
    setLoadingFipe(false);
    setFipeModels([]);
    setFipeYears([]);
  };

  const handleBrandChange = async (brandId: string) => {
    setSelectedBrand(brandId);
    setLoadingFipe(true);
    const cat = getCurrentCategory();
    if (!cat) return;

    const models = await fipeService.getModels(cat.fipeType as any, brandId);
    setFipeModels(models);
    setLoadingFipe(false);
    setSelectedModel('');
    setSelectedYear('');
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    setLoadingFipe(true);
    const cat = getCurrentCategory();
    if (!cat) return;

    const years = await fipeService.getYears(cat.fipeType as any, selectedBrand, modelId);
    setFipeYears(years);
    setLoadingFipe(false);
    setSelectedYear('');
  };

  const handleYearChange = async (yearId: string) => {
    setSelectedYear(yearId);
    setLoadingFipe(true);
    const cat = getCurrentCategory();
    if (!cat) return;

    const details = await fipeService.getDetails(cat.fipeType as any, selectedBrand, selectedModel, yearId);
    
    if (details) {
      setFormData(prev => ({
        ...prev,
        model: `${details.Marca} ${details.Modelo}`,
        year: details.AnoModelo.toString(),
        fipeCode: details.CodigoFipe
      }));
    }
    setLoadingFipe(false);
  };

  const handlePlateLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) {
        addNotification('error', t('searchPlate'), 'Invalid plate format.');
        return;
    }
    
    setLoadingPlate(true);
    addNotification('info', t('searchPlate'), t('searchingPlate'));
    
    try {
        const result = await plateLookupService.lookup(formData.plate);
        if (result && result.found) {
            setFormData(prev => ({
                ...prev,
                model: result.model,
                year: result.year,
                fipeCode: result.fipeCode,
                // Apply suggested category if found
                type: result.suggestedCategoryId || prev.type 
            }));
            addNotification('success', t('searchPlate'), t('plateFound'));
        } else {
            addNotification('info', t('searchPlate'), t('plateNotFound'));
        }
    } catch (e: any) {
        addNotification('error', t('searchPlate'), e.message);
    } finally {
        setLoadingPlate(false);
    }
  };

  const handleHinovaLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) {
        addNotification('error', 'Hinova Search', 'Insira uma placa válida.');
        return;
    }

    setHinovaStatus({ open: true, step: 'loading', message: 'Conectando ao sistema Hinova...' });

    try {
        const result = await hinovaService.searchVehicle(formData.plate);
        if (result) {
            // Success Feedback
            setHinovaStatus({ 
                open: true, 
                step: 'success', 
                message: 'Veículo Localizado!', 
                details: `${result.vehicle.model} - ${result.client.name}`
            });

            // Update Data
            setFormData(prev => ({ ...prev, ...result.vehicle }));
            setClientFormData(result.client);

            // Auto close after 2 seconds
            setTimeout(() => {
                setHinovaStatus(prev => ({ ...prev, open: false }));
            }, 2000);

        } else {
            setHinovaStatus({ 
                open: true, 
                step: 'error', 
                message: 'Não Encontrado', 
                details: 'A placa não consta na base Hinova.' 
            });
        }
    } catch (e: any) {
        setHinovaStatus({ 
            open: true, 
            step: 'error', 
            message: 'Erro na Consulta', 
            details: e.message 
        });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.model || !formData.type) return;

    let linkedClientId = formData.clientId;

    // Handle Client Saving Logic
    if (clientFormData.name) {
        // Check if client exists by CPF
        let client = clients.find(c => c.cpf === clientFormData.cpf);
        
        if (client) {
            // Update Existing (Optional: could verify if data changed)
             // For now we assume we link to existing
             linkedClientId = client.id;
        } else {
            // Create New Client
            const newClient: Client = {
                id: crypto.randomUUID(),
                name: clientFormData.name,
                cpf: clientFormData.cpf || '',
                phone: clientFormData.phone || '',
                email: clientFormData.email,
                address: clientFormData.address,
                city: clientFormData.city,
                state: clientFormData.state,
                createdAt: Date.now()
            };
            await storage.saveClient(newClient);
            linkedClientId = newClient.id;
        }
    }

    const newVehicle: Vehicle = {
      id: formData.id || crypto.randomUUID(),
      type: formData.type || (categories[0]?.id || 'Car'),
      plate: formData.plate,
      model: formData.model,
      year: formData.year,
      fipeCode: formData.fipeCode,
      tagId: formData.tagId === 'none' ? undefined : formData.tagId,
      companyId: formData.companyId,
      clientId: linkedClientId,
      hinovaId: formData.hinovaId,
      status: formData.status || 'active',
      installationType: formData.installationType || 'tag_only', // Default to tag_only if undefined
      createdAt: formData.createdAt || Date.now() 
    };

    await storage.saveVehicle(newVehicle);
    loadData();
    setIsModalOpen(false);
    setFormData({});
    setClientFormData({});
    setUseFipe(false);
    resetFipeSelection();
    setTagSearchTerm('');
  };

  const resetFipeSelection = () => {
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedYear('');
    setFipeModels([]);
    setFipeYears([]);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this vehicle?')) {
      await storage.deleteVehicle(id);
      loadData();
    }
  };

  const getCategoryName = (id: string) => {
      const cat = categories.find(c => c.id === id);
      return cat ? cat.name : id;
  };

  const getCategoryIcon = (id: string) => {
      const cat = categories.find(c => c.id === id);
      if(!cat) return <CarIcon className="text-zinc-500" size={24} />;
      
      switch(cat.fipeType) {
          case 'caminhoes': return <Truck className="text-zinc-500" size={24} />;
          case 'motos': return <Bike className="text-zinc-500" size={24} />;
          default: return <CarIcon className="text-zinc-500" size={24} />;
      }
  };
  
  const getCompanyPrefix = (id?: string) => {
      if(!id) return null;
      const comp = companies.find(c => c.id === id);
      return comp ? comp.prefix : null;
  };

  const getTagName = (tagId?: string) => {
    if (!tagId) return t('noLink');
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.name : 'Unknown Tag';
  };

  const getClientName = (clientId?: string) => {
      if (!clientId) return null;
      const c = clients.find(cl => cl.id === clientId);
      return c ? c.name : null;
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'stolen') {
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-xs font-bold uppercase border border-red-200 dark:border-red-900/50">
          <ShieldAlert size={12} /> ROUBADO
        </span>
      );
    }
    if (status === 'maintenance') {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-bold uppercase border border-amber-200 dark:border-amber-900/50">
          <Wrench size={12} /> MANUTENÇÃO
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('vehicleFleet')}</h1>
        <button
          onClick={() => { 
              setFormData({ type: categories[0]?.id, status: 'active', installationType: 'tag_only' }); 
              setClientFormData({});
              setTagSearchTerm(''); 
              setIsModalOpen(true); 
          }}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> {t('addVehicle')}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm">
              <th className="p-4 font-semibold">{t('company')}</th>
              <th className="p-4 font-semibold">{t('type')}</th>
              <th className="p-4 font-semibold">{t('model')}</th>
              <th className="p-4 font-semibold">{t('plate')}</th>
              <th className="p-4 font-semibold">{t('linkedTag')}</th>
              <th className="p-4 font-semibold">Cliente</th>
              <th className="p-4 font-semibold text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${vehicle.status === 'stolen' ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                <td className="p-4">
                    {getCompanyPrefix(vehicle.companyId) ? (
                        <span className="font-mono font-bold bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded text-xs text-zinc-700 dark:text-zinc-200">{getCompanyPrefix(vehicle.companyId)}</span>
                    ) : '-'}
                </td>
                <td className="p-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                       {getCategoryIcon(vehicle.type)}
                     </div>
                     <span className="font-medium text-zinc-900 dark:text-white">{getCategoryName(vehicle.type)}</span>
                   </div>
                </td>
                <td className="p-4 text-zinc-600 dark:text-zinc-300">
                  <div className="flex flex-col">
                    <span>{vehicle.model}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {vehicle.year && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-700 px-1 rounded">{vehicle.year}</span>}
                      {vehicle.fipeCode && <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1 rounded">FIPE: {vehicle.fipeCode}</span>}
                      {vehicle.installationType === 'tag_tracker' && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1 rounded border border-indigo-200 dark:border-indigo-700 flex items-center gap-1"><Settings size={8} /> +Rastreador</span>}
                    </div>
                  </div>
                </td>
                <td className="p-4 font-mono text-zinc-600 dark:text-zinc-300 font-bold">
                  <div className="flex flex-col gap-1">
                    <span>{vehicle.plate}</span>
                    {getStatusBadge(vehicle.status)}
                  </div>
                </td>
                <td className="p-4">
                   <div className={`flex items-center gap-2 text-sm ${vehicle.tagId ? 'text-green-600 dark:text-green-400 font-medium' : 'text-zinc-400'}`}>
                      <LinkIcon size={14} />
                      {getTagName(vehicle.tagId)}
                   </div>
                </td>
                <td className="p-4">
                    {vehicle.clientId ? (
                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                            <User size={12} className="text-zinc-400" />
                            {getClientName(vehicle.clientId)}
                        </div>
                    ) : <span className="text-zinc-300">-</span>}
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => { 
                      setFormData(vehicle);
                      // Load Client Data
                      if(vehicle.clientId) {
                          const client = clients.find(c => c.id === vehicle.clientId);
                          if(client) setClientFormData(client);
                      } else {
                          setClientFormData({});
                      }
                      
                      // Pre-fill search term if tag linked
                      const linked = tags.find(t => t.id === vehicle.tagId);
                      setTagSearchTerm(linked ? linked.name : '');
                      setIsModalOpen(true); 
                  }} className="p-2 text-zinc-400 hover:text-primary-600 transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(vehicle.id)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500">{t('noVehicles')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto border-2 ${formData.status === 'stolen' ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                {formData.id ? t('editVehicle') : t('newVehicle')}
                {formData.status === 'stolen' && <span className="text-red-500 text-sm font-bold animate-pulse">[ROUBADO]</span>}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-zinc-400 hover:text-zinc-600" /></button>
            </div>
            
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              
              {/* LEFT COLUMN: VEHICLE DETAILS */}
              <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2">Dados do Veículo</h3>
                  
                  {/* Status Selection */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                        type="button"
                        onClick={() => setFormData({...formData, status: 'active'})}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold transition-all ${(!formData.status || formData.status === 'active') ? 'bg-green-500 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                        >
                        ATIVO
                        </button>
                        <button
                        type="button"
                        onClick={() => setFormData({...formData, status: 'maintenance'})}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold transition-all ${formData.status === 'maintenance' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                        >
                        MANUTENÇÃO
                        </button>
                        <button
                        type="button"
                        onClick={() => setFormData({...formData, status: 'stolen'})}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold transition-all ${formData.status === 'stolen' ? 'bg-red-600 text-white shadow-md animate-pulse' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                        >
                        ROUBADO
                        </button>
                    </div>
                  </div>

                  {/* Installation Type Section (NEW) */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                          Instalação do equipamento
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                          <button
                              type="button"
                              onClick={() => setFormData({ ...formData, installationType: 'tag_only' })}
                              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                                  (!formData.installationType || formData.installationType === 'tag_only')
                                      ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                                      : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                              }`}
                          >
                              SÓ TAG
                          </button>
                          <button
                              type="button"
                              onClick={() => setFormData({ ...formData, installationType: 'tag_tracker' })}
                              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                                  formData.installationType === 'tag_tracker'
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                      : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                              }`}
                          >
                              TAG C/ RASTREADOR
                          </button>
                      </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('plate')}</label>
                    <div className="relative flex gap-2">
                        <input
                            type="text"
                            required
                            value={formData.plate || ''}
                            onChange={e => setFormData({ ...formData, plate: e.target.value })}
                            className="w-full pl-3 pr-8 py-2 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors font-mono uppercase"
                            placeholder="ABC1234"
                        />
                        <button 
                            type="button"
                            onClick={handlePlateLookup}
                            disabled={loadingPlate || !formData.plate}
                            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 p-2 rounded-lg hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
                            title="Buscar na API de Placas (BrasilAPI)"
                        >
                            {loadingPlate ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        </button>
                        <button 
                            type="button"
                            onClick={handleHinovaLookup}
                            disabled={hinovaStatus.step === 'loading' || !formData.plate}
                            className="bg-cyan-600 text-white p-2 rounded-lg hover:bg-cyan-700 disabled:opacity-50 shadow-sm"
                            title="Buscar na HINOVA"
                        >
                            {hinovaStatus.step === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <span className="font-bold text-xs">HINOVA</span>}
                        </button>
                    </div>
                  </div>

                  <SearchableSelect 
                    label={t('type')}
                    placeholder="Select Category"
                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                    value={formData.type || ''}
                    onChange={(val) => {
                      setFormData({...formData, type: val as any});
                      setUseFipe(false);
                      resetFipeSelection();
                    }}
                  />

                  {/* Company Selector */}
                  <SearchableSelect 
                    label={t('company')}
                    placeholder={t('selectCompany')}
                    icon={<Building2 size={14} />}
                    options={companies.map(c => ({ value: c.id, label: `${c.name} (${c.prefix})` }))}
                    value={formData.companyId || ''}
                    onChange={(val) => setFormData({ ...formData, companyId: val })}
                  />

                  <div>
                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('model')}</label>
                    <input
                    type="text"
                    required
                    value={formData.model || ''}
                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('year')}</label>
                        <input
                        type="text"
                        value={formData.year || ''}
                        onChange={e => setFormData({ ...formData, year: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">FIPE</label>
                        <input
                        type="text"
                        value={formData.fipeCode || ''}
                        onChange={e => setFormData({ ...formData, fipeCode: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                        />
                     </div>
                  </div>

                  {/* FIPE SEARCH TOGGLE (Only if not ID) */}
                  {!formData.id && isFipeEnabled() && (
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                         <div className="flex items-center gap-2 mb-2">
                            <input 
                            type="checkbox" 
                            id="useFipe" 
                            checked={useFipe} 
                            onChange={(e) => setUseFipe(e.target.checked)}
                            className="rounded text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="useFipe" className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            Busca Manual FIPE
                            </label>
                        </div>
                         {useFipe && (
                             <div className="space-y-2">
                                {loadingFipe && <div className="text-xs text-primary-500">Loading...</div>}
                                <SearchableSelect
                                    placeholder={t('selectBrand')}
                                    options={fipeBrands.map(b => ({ value: b.codigo, label: b.nome }))}
                                    value={selectedBrand}
                                    onChange={handleBrandChange}
                                    disabled={loadingFipe}
                                />
                                <SearchableSelect
                                    placeholder={t('selectModel')}
                                    options={fipeModels.map(b => ({ value: b.codigo, label: b.nome }))}
                                    value={selectedModel}
                                    onChange={handleModelChange}
                                    disabled={!selectedBrand || loadingFipe}
                                />
                                <SearchableSelect
                                    placeholder={t('selectYear')}
                                    options={fipeYears.map(b => ({ value: b.codigo, label: b.nome }))}
                                    value={selectedYear}
                                    onChange={handleYearChange}
                                    disabled={!selectedModel || loadingFipe}
                                />
                             </div>
                         )}
                    </div>
                  )}

                  {/* Tag Selector */}
                  <div className="relative" ref={tagDropdownRef}>
                    <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('linkedTag')}</label>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder={t('searchTags')}
                            className="w-full px-3 py-2 pl-9 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                            value={tagSearchTerm}
                            onChange={(e) => {
                                setTagSearchTerm(e.target.value);
                                setShowTagDropdown(true);
                                if(e.target.value === '') setFormData({...formData, tagId: undefined});
                            }}
                            onFocus={() => setShowTagDropdown(true)}
                        />
                        <Search size={16} className="absolute left-3 top-3 text-zinc-400" />
                        {formData.tagId && (
                            <button 
                                type="button"
                                onClick={() => {
                                    setFormData({...formData, tagId: undefined});
                                    setTagSearchTerm('');
                                }}
                                className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    
                    {showTagDropdown && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                            <div 
                                className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer text-xs text-zinc-500 italic border-b border-zinc-100 dark:border-zinc-700"
                                onClick={() => {
                                    setFormData({...formData, tagId: undefined});
                                    setTagSearchTerm('');
                                    setShowTagDropdown(false);
                                }}
                            >
                                {t('noLink')}
                            </div>
                            {filteredTags.map(tag => (
                                <div 
                                    key={tag.id}
                                    className={`p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer text-sm flex flex-col border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 ${formData.tagId === tag.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                                    onClick={() => {
                                        setFormData({...formData, tagId: tag.id});
                                        setTagSearchTerm(tag.name);
                                        setShowTagDropdown(false);
                                    }}
                                >
                                    <span className="font-medium">{tag.name}</span>
                                    <span className="text-[10px] text-zinc-400 font-mono">SN: {tag.accessoryId}</span>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
              </div>

              {/* RIGHT COLUMN: CLIENT & EXTRA DETAILS */}
              <div className="space-y-4">
                 <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 pb-2">Dados do Cliente (Hinova)</h3>
                 
                 <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Nome do Associado</label>
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                            <input
                                type="text"
                                value={clientFormData.name || ''}
                                onChange={e => setClientFormData({ ...clientFormData, name: e.target.value })}
                                className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                                placeholder="Nome Completo"
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">CPF</label>
                            <input
                                type="text"
                                value={clientFormData.cpf || ''}
                                onChange={e => setClientFormData({ ...clientFormData, cpf: e.target.value })}
                                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                                placeholder="000.000.000-00"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Telefone</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                                <input
                                    type="text"
                                    value={clientFormData.phone || ''}
                                    onChange={e => setClientFormData({ ...clientFormData, phone: e.target.value })}
                                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                         </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Endereço</label>
                        <div className="relative">
                             <MapPin size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                             <input
                                type="text"
                                value={clientFormData.address || ''}
                                onChange={e => setClientFormData({ ...clientFormData, address: e.target.value })}
                                className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                                placeholder="Rua, Número, Bairro"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Cidade</label>
                            <input
                                type="text"
                                value={clientFormData.city || ''}
                                onChange={e => setClientFormData({ ...clientFormData, city: e.target.value })}
                                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">UF</label>
                            <input
                                type="text"
                                value={clientFormData.state || ''}
                                onChange={e => setClientFormData({ ...clientFormData, state: e.target.value })}
                                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
                                maxLength={2}
                            />
                         </div>
                    </div>
                 </div>

                 <div className="pt-4 mt-auto">
                    <button
                        type="submit"
                        className={`w-full text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all ${
                            formData.status === 'stolen' 
                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                            : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20'
                        }`}
                    >
                        <Save size={20} /> {t('saveVehicle')}
                    </button>
                 </div>
              </div>

              {/* --- HINOVA STATUS MODAL --- */}
              {hinovaStatus.open && (
                <div className="absolute inset-0 z-[60] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                    <div className={`p-4 rounded-full mb-4 shadow-lg ${
                        hinovaStatus.step === 'loading' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                        hinovaStatus.step === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                        'bg-red-100 text-red-600 dark:bg-red-900/30'
                    }`}>
                        {hinovaStatus.step === 'loading' && <Loader2 size={32} className="animate-spin" />}
                        {hinovaStatus.step === 'success' && <CheckCircle size={32} />}
                        {hinovaStatus.step === 'error' && <XCircle size={32} />}
                    </div>
                    
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">{hinovaStatus.message}</h3>
                    {hinovaStatus.details && <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">{hinovaStatus.details}</p>}

                    {hinovaStatus.step === 'success' && (
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                            <Database size={12} /> Dados Preenchidos Automaticamente
                        </div>
                    )}

                    {hinovaStatus.step === 'error' && (
                        <button 
                            onClick={() => setHinovaStatus(prev => ({ ...prev, open: false }))}
                            className="mt-6 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Fechar e tentar novamente
                        </button>
                    )}
                </div>
              )}

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
