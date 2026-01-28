
import { useState, useEffect } from 'react';
import { Tag, Vehicle, Company, VehicleCategory, AppSettings, Schedule, Technician } from '../../../types';
import { storage } from '../../../services/storage';
import { useAuth } from '../../../contexts/AuthContext';

export const useDashboardData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [
          loadedTags, 
          loadedVehicles, 
          loadedCompanies, 
          loadedCategories, 
          loadedSettings, 
          loadedSchedules, 
          loadedTechs
        ] = await Promise.all([
          storage.getTags(),
          storage.getVehicles(),
          storage.getCompanies(),
          storage.getCategories(),
          storage.getSettings(),
          storage.getSchedules('admin', user.id),
          storage.getTechnicians()
        ]);

        setTags(loadedTags);
        setVehicles(loadedVehicles);
        setCompanies(loadedCompanies);
        setCategories(loadedCategories);
        setSettings(loadedSettings);
        setSchedules(loadedSchedules);
        setTechnicians(loadedTechs);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  return {
    tags,
    vehicles,
    companies,
    categories,
    settings,
    schedules,
    technicians,
    loading
  };
};
