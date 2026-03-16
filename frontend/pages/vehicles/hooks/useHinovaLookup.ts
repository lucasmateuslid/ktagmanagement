
import React, { useState } from 'react';
import { hinovaService } from '../../../services/hinova';
import { useNotification } from '../../../contexts/NotificationContext';
import { Vehicle, Client } from '../../../types';

export const useHinovaLookup = (
  setFormData: React.Dispatch<React.SetStateAction<Partial<Vehicle>>>,
  setClientData: React.Dispatch<React.SetStateAction<Partial<Client>>>,
  clients: Client[]
) => {
  const { addNotification } = useNotification();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const lookupPlate = async (plate: string) => {
    if (!plate || plate.length < 7) {
        addNotification('info', 'SGA/Hinova', 'Digite uma placa válida.');
        return;
    }
    
    setStatus('loading');
    try {
        const result = await hinovaService.searchVehicle(plate);
        if (result) {
            setFormData(prev => ({ ...prev, ...result.vehicle }));
            setStatus('success');
            
            const hinovaCpf = result.client.cpf?.replace(/\D/g, '') || '';
            const existingClient = clients.find(c => c.cpf.replace(/\D/g, '') === hinovaCpf);
            
            if (existingClient) {
                setClientData(existingClient);
                addNotification('success', 'SGA/Hinova', 'Veículo localizado e vinculado ao cliente existente.');
            } else {
                setClientData(result.client);
                addNotification('success', 'SGA/Hinova', 'Veículo e novo cliente importados.');
            }
        } else {
            setStatus('error');
            addNotification('error', 'SGA/Hinova', 'Não encontrado.');
        }
    } catch (e: any) {
        setStatus('error');
        addNotification('error', 'API SGA', e.message);
    } finally {
        setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return { status, lookupPlate };
};