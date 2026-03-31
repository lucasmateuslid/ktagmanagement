
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
        const loadedTechs = await storage.getTechnicians();
        
        let queryId = user.id;
        if (user.role === 'technician' || user.role === 'admin_tecnico') {
            const tech = loadedTechs.find(t => t.email?.toLowerCase() === user.email.toLowerCase());
            if (tech) queryId = tech.id;
        }

        const [
          loadedTags, 
          loadedVehicles, 
          loadedCompanies, 
          loadedCategories, 
          loadedSettings, 
          loadedSchedules
        ] = await Promise.all([
          storage.getTags(),
          storage.getVehicles(),
          storage.getCompanies(),
          storage.getCategories(),
          storage.getSettings(),
          storage.getSchedules((user.role === 'admin' || user.role === 'moderator' || user.role === 'admin_tecnico' ? 'admin' : user.role) || 'user', queryId)
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
