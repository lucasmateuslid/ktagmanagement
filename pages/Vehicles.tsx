
import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { fipeService, FipeReference } from '../services/fipe';
import { Tag, Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Trash2, Edit2, Car as CarIcon, Truck, Save, X, Link as LinkIcon, Search, Loader2 } from 'lucide-react';

export const Vehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});
  const { t } = useLanguage();

  const [useFipe, setUseFipe] = useState(false);
  const [fipeBrands, setFipeBrands] = useState<FipeReference[]>([]);
  const [fipeModels, setFipeModels] = useState<FipeReference[]>([]);
  const [fipeYears, setFipeYears] = useState<FipeReference[]>([]);
  const [loadingFipe, setLoadingFipe] = useState(false);
  
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  const loadData = async () => {
    setVehicles(await storage.getVehicles());
    setTags(await storage.getTags());
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (useFipe && isModalOpen) {
      loadBrands();
    }
  }, [useFipe, isModalOpen, formData.type]);

  const mapTypeToFipe = (type: string): 'carros' | 'motos' | 'caminhoes' => {
    if (type === 'Motorcycle') return 'motos';
    if (type === 'Truck') return 'caminhoes';
    return 'carros';
  };

  const loadBrands = async () => {
    setLoadingFipe(true);
    const type = mapTypeToFipe(formData.type || 'Car');
    const brands = await fipeService.getBrands(type);
    setFipeBrands(brands);
    setLoadingFipe(false);
    setFipeModels([]);
    setFipeYears([]);
  };

  const handleBrandChange = async (brandId: string) => {
    setSelectedBrand(brandId);
    setLoadingFipe(true);
    const type = mapTypeToFipe(formData.type || 'Car');
    const models = await fipeService.getModels(type, brandId);
    setFipeModels(models);
    setLoadingFipe(false);
    setSelectedModel('');
    setSelectedYear('');
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    setLoadingFipe(true);
    const type = mapTypeToFipe(formData.type || 'Car');
    const years = await fipeService.getYears(type, selectedBrand, modelId);
    setFipeYears(years);
    setLoadingFipe(false);
    setSelectedYear('');
  };

  const handleYearChange = async (yearId: string) => {
    setSelectedYear(yearId);
    setLoadingFipe(true);
    const type = mapTypeToFipe(formData.type || 'Car');
    const details = await fipeService.getDetails(type, selectedBrand, selectedModel, yearId);
    
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.model || !formData.type) return;

    const newVehicle: Vehicle = {
      id: formData.id || crypto.randomUUID(),
      type: formData.type || 'Car',
      plate: formData.plate,
      model: formData.model,
      year: formData.year,
      fipeCode: formData.fipeCode,
      tagId: formData.tagId === 'none' ? undefined : formData.tagId,
    };

    await storage.saveVehicle(newVehicle);
    loadData();
    setIsModalOpen(false);
    setFormData({});
    setUseFipe(false);
    resetFipeSelection();
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

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'Truck': return <Truck className="text-orange-500" size={24} />;
      default: return <CarIcon className="text-blue-500" size={24} />;
    }
  };

  const getTagName = (tagId?: string) => {
    if (!tagId) return t('noLink');
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.name : 'Unknown Tag';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('vehicleFleet')}</h1>
        <button
          onClick={() => { setFormData({ type: 'Car' }); setIsModalOpen(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> {t('addVehicle')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
              <th className="p-4 font-semibold">{t('type')}</th>
              <th className="p-4 font-semibold">{t('model')}</th>
              <th className="p-4 font-semibold">{t('year')}</th>
              <th className="p-4 font-semibold">{t('plate')}</th>
              <th className="p-4 font-semibold">{t('linkedTag')}</th>
              <th className="p-4 font-semibold text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                       {getVehicleIcon(vehicle.type)}
                     </div>
                     <span className="font-medium text-slate-900 dark:text-white">{vehicle.type}</span>
                   </div>
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-300">
                  {vehicle.model}
                  {vehicle.fipeCode && <span className="ml-2 text-xs text-slate-400 border border-slate-200 dark:border-slate-700 px-1 rounded">FIPE: {vehicle.fipeCode}</span>}
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-300">{vehicle.year || '-'}</td>
                <td className="p-4 font-mono text-slate-600 dark:text-slate-300">{vehicle.plate}</td>
                <td className="p-4">
                   <div className={`flex items-center gap-2 text-sm ${vehicle.tagId ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                      <LinkIcon size={14} />
                      {getTagName(vehicle.tagId)}
                   </div>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => { setFormData(vehicle); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-primary-600">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(vehicle.id)} className="p-2 text-slate-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">{t('noVehicles')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {formData.id ? t('editVehicle') : t('newVehicle')}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-slate-300">{t('type')}</label>
                  <select 
                    value={formData.type} 
                    onChange={e => {
                      setFormData({...formData, type: e.target.value as any});
                      if (useFipe) resetFipeSelection();
                    }}
                    className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  >
                    <option value="Car">Car</option>
                    <option value="Truck">Truck</option>
                    <option value="Motorcycle">Motorcycle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-slate-300">{t('plate')}</label>
                  <input
                    type="text"
                    required
                    value={formData.plate || ''}
                    onChange={e => setFormData({ ...formData, plate: e.target.value })}
                    className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>

              {!formData.id && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      type="checkbox" 
                      id="useFipe" 
                      checked={useFipe} 
                      onChange={(e) => setUseFipe(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="useFipe" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Search size={14} /> {t('searchFipe')}
                    </label>
                  </div>

                  {useFipe && (
                    <div className="space-y-2 mt-2">
                       {loadingFipe && <div className="text-xs text-primary-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> {t('loadingFipe')}</div>}
                       
                       <select 
                         className="w-full text-sm p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                         value={selectedBrand}
                         onChange={(e) => handleBrandChange(e.target.value)}
                       >
                         <option value="">{t('selectBrand')}</option>
                         {fipeBrands.map(b => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
                       </select>

                       <select 
                         className="w-full text-sm p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                         value={selectedModel}
                         onChange={(e) => handleModelChange(e.target.value)}
                         disabled={!selectedBrand}
                       >
                         <option value="">{t('selectModel')}</option>
                         {fipeModels.map(b => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
                       </select>

                       <select 
                         className="w-full text-sm p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                         value={selectedYear}
                         onChange={(e) => handleYearChange(e.target.value)}
                         disabled={!selectedModel}
                       >
                         <option value="">{t('selectYear')}</option>
                         {fipeYears.map(b => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
                       </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-slate-300">{t('model')}</label>
                <input
                  type="text"
                  required
                  value={formData.model || ''}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

               <div>
                <label className="block text-sm font-medium mb-1 dark:text-slate-300">{t('year')}</label>
                <input
                  type="text"
                  value={formData.year || ''}
                  onChange={e => setFormData({ ...formData, year: e.target.value })}
                  className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-slate-300">{t('linkedTag')}</label>
                <select 
                    value={formData.tagId || 'none'} 
                    onChange={e => setFormData({...formData, tagId: e.target.value})}
                    className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  >
                    <option value="none">{t('noLink')}</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.accessoryId})</option>
                    ))}
                  </select>
              </div>

              <button
                type="submit"
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4"
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
