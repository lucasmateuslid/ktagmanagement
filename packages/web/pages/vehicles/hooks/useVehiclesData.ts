
import { useState, useCallback, useEffect } from 'react';
import { storage } from '../../../services/storage';
import { Vehicle, Tag, Company, VehicleCategory, Client, User } from '../../../types';

export const useVehiclesData = (currentUser: User | null) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [v, t, c, cat, cl] = await Promise.all([
        storage.getVehicles(), 
        storage.getTags(), 
        storage.getCompanies(), 
        storage.getCategories(), 
        storage.getClients()
    ]);
    
    // FILTRAGEM POR PERFIL DE USUÁRIO (Lógica original preservada)
    if (currentUser?.role === 'client' && currentUser.cpf) {
        const myCpf = currentUser.cpf.replace(/\D/g, '');
        const myClientData = cl.find(client => client.cpf.replace(/\D/g, '') === myCpf);
        
        if (myClientData) {
            const myVehicles = v.filter(veh => veh.clientId === myClientData.id);
            setVehicles(myVehicles);
        } else {
            setVehicles([]);
        }
    } else {
        setVehicles(v);
    }

    setTags(t); 
    setCompanies(c); 
    setCategories(cat); 
    setClients(cl);
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  return { vehicles, tags, companies, categories, clients, loading, reload: loadData };
};
