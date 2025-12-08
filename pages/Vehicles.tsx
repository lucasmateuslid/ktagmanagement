
import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { fipeService, FipeReference } from '../services/fipe';
import { plateLookupService } from '../services/plateLookup';
import { Tag, Vehicle, Company, VehicleCategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { Plus, Trash2, Edit2, Car as CarIcon, Truck, Bike, Save, X, Link as LinkIcon, Search, Loader2, Building2, ChevronDown, Check, ShieldAlert, AlertTriangle, Wrench } from 'lucide-react';

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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});
  const { t } = useLanguage();
  const { addNotification } = useNotification();

  const [useFipe, setUseFipe] = useState(false);
  const [fipeBrands, setFipeBrands] = useState<FipeReference[]>([]);
  const [fipeModels, setFipeModels] = useState<FipeReference[]>([]);
  const [fipeYears, setFipeYears] = useState<FipeReference[]>([]);
  const [loadingFipe, setLoadingFipe] = useState(false);
  const [loadingPlate, setLoadingPlate] = useState(false);
  
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
    const [v, t, c, cat] = await Promise.all([
        storage.getVehicles(),
        storage.getTags(),
        storage.getCompanies(),
        storage.getCategories()
    ]);
    setVehicles(v);
    setTags(t);
    setCompanies(c);
    setCategories(cat);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.model || !formData.type) return;

    const newVehicle: Vehicle = {
      id: formData.id || crypto.randomUUID(),
      type: formData.type || (categories[0]?.id || 'Car'),
      plate: formData.plate,
      model: formData.model,
      year: formData.year,
      fipeCode: formData.fipeCode,
      tagId: formData.tagId === 'none' ? undefined : formData.tagId,
      companyId: formData.companyId,
      status: formData.status || 'active',
      createdAt: formData.createdAt || Date.now() // Save creation date
    };

    await storage.saveVehicle(newVehicle);
    loadData();
    setIsModalOpen(false);
    setFormData({});
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
              setFormData({ type: categories[0]?.id, status: 'active' }); 
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
              <th className="p-4 font-semibold">{t('year')}</th>
              <th className="p-4 font-semibold">{t('plate')}</th>
              <th className="p-4 font-semibold">{t('linkedTag')}</th>
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
                      {vehicle.fipeCode && <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1 rounded">FIPE: {vehicle.fipeCode}</span>}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-zinc-600 dark:text-zinc-300">{vehicle.year || '-'}</td>
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
                <td className="p-4 text-right">
                  <button onClick={() => { 
                      setFormData(vehicle); 
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
          <div className={`bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto border-2 ${formData.status === 'stolen' ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                {formData.id ? t('editVehicle') : t('newVehicle')}
                {formData.status === 'stolen' && <span className="text-red-500 text-sm font-bold animate-pulse">[ROUBADO]</span>}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-zinc-400 hover:text-zinc-600" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              
              {/* STATUS SELECTION */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                 <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-zinc-500">Status Operacional</label>
                 <div className="grid grid-cols-3 gap-2">
                    <button
                       type="button"
                       onClick={() => setFormData({...formData, status: 'active'})}
                       className={`py-2 px-1 rounded text-xs font-bold transition-all ${(!formData.status || formData.status === 'active') ? 'bg-green-500 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                    >
                       ATIVO
                    </button>
                    <button
                       type="button"
                       onClick={() => setFormData({...formData, status: 'maintenance'})}
                       className={`py-2 px-1 rounded text-xs font-bold transition-all ${formData.status === 'maintenance' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                    >
                       MANUTENÇÃO
                    </button>
                    <button
                       type="button"
                       onClick={() => setFormData({...formData, status: 'stolen'})}
                       className={`py-2 px-1 rounded text-xs font-bold transition-all ${formData.status === 'stolen' ? 'bg-red-600 text-white shadow-md animate-pulse' : 'bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                    >
                       ROUBADO
                    </button>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
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
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('plate')}</label>
                  <div className="relative">
                    <input
                        type="text"
                        required
                        value={formData.plate || ''}
                        onChange={e => setFormData({ ...formData, plate: e.target.value })}
                        className="w-full pl-3 pr-10 py-2.5 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors font-mono uppercase"
                        placeholder="ABC1234"
                    />
                    <button 
                        type="button"
                        onClick={handlePlateLookup}
                        disabled={loadingPlate || !formData.plate}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-primary-500 disabled:opacity-50"
                        title={t('searchPlate')}
                    >
                        {loadingPlate ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Company Selector */}
              <div>
                  <SearchableSelect 
                    label={t('company')}
                    placeholder={t('selectCompany')}
                    icon={<Building2 size={14} />}
                    options={companies.map(c => ({ value: c.id, label: `${c.name} (${c.prefix})` }))}
                    value={formData.companyId || ''}
                    onChange={(val) => setFormData({ ...formData, companyId: val })}
                  />
              </div>

              {!formData.id && isFipeEnabled() && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="checkbox" 
                      id="useFipe" 
                      checked={useFipe} 
                      onChange={(e) => setUseFipe(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="useFipe" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer select-none">
                      <Search size={14} /> {t('searchFipe')}
                    </label>
                  </div>

                  {useFipe && (
                    <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                       {loadingFipe && (
                         <div className="text-xs text-primary-600 flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 p-2 rounded">
                           <Loader2 size={12} className="animate-spin"/> {t('loadingFipe')}
                         </div>
                       )}
                       
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

              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('model')}</label>
                <input
                  type="text"
                  required
                  value={formData.model || ''}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                />
              </div>

               <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('year')}</label>
                <input
                  type="text"
                  value={formData.year || ''}
                  onChange={e => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                />
              </div>

              {/* Enhanced Tag Selector */}
              <div className="relative" ref={tagDropdownRef}>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">{t('linkedTag')}</label>
                <div className="relative">
                    <input 
                        type="text"
                        placeholder={t('searchTags')}
                        className="w-full px-3 py-2.5 pl-9 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
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
                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        <div 
                            className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer text-sm text-zinc-500 italic border-b border-zinc-100 dark:border-zinc-700"
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
                                className={`p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer text-sm flex flex-col border-b border-zinc-50 dark:border-zinc-700/50 last:border-0
                                    ${formData.tagId === tag.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
                                `}
                                onClick={() => {
                                    setFormData({...formData, tagId: tag.id});
                                    setTagSearchTerm(tag.name);
                                    setShowTagDropdown(false);
                                }}
                            >
                                <div className="flex justify-between items-center">
                                    <span className={`font-medium ${formData.tagId === tag.id ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                        {tag.name}
                                    </span>
                                    {formData.tagId === tag.id && <Check size={14} className="text-primary-600"/>}
                                </div>
                                <span className="text-xs text-zinc-400 font-mono mt-0.5">SN: {tag.accessoryId}</span>
                            </div>
                        ))}
                        {filteredTags.length === 0 && <div className="p-4 text-xs text-zinc-400 text-center">No tags found</div>}
                    </div>
                )}
              </div>

              <button
                type="submit"
                className={`w-full text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4 shadow-lg transition-all ${
                    formData.status === 'stolen' 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                    : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20'
                }`}
              >
                <Save size={20} /> {t('saveVehicle')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};