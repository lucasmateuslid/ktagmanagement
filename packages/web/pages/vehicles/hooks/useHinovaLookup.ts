
import React, { useState } from 'react';
import { hinovaService } from '../../../services/hinova';
import { useNotification } from '../../../contexts/NotificationContext';
import { Vehicle, Client } from '../../../types';
import { formatCPF, formatPhone, normalizeCPF } from '@ktag/shared';

export const useHinovaLookup = (
  setFormData: React.Dispatch<React.SetStateAction<Partial<Vehicle>>>,
  setClientData: React.Dispatch<React.SetStateAction<Partial<Client>>>,
  clients: Client[]
) => {
  const { addNotification } = useNotification();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const lookupPlate = async (plate: string) => {
    if (status === 'loading') return;
    
    if (!plate || plate.length < 7) {
        addNotification('info', 'SGA/Hinova', 'Digite uma placa válida.');
        return;
    }
    
    setStatus('loading');
    try {
        const result = await hinovaService.searchVehicle(plate);
        if (result) {
            const vehicleData: Partial<Vehicle> = { ...result.vehicle };
            
            // Se a Hinova retornou um valor FIPE, converte para número e salva
            if (result.price) {
                const cleanPrice = String(result.price).replace(/[^\d,]/g, '').replace(',', '.');
                const priceNum = parseFloat(cleanPrice);
                if (!isNaN(priceNum)) {
                    vehicleData.fipeValue = priceNum;
                }
            }

            setFormData(prev => ({ ...prev, ...vehicleData }));
            setStatus('success');
            
            const hinovaCpf = normalizeCPF(result.client.cpf);
            const existingClient = clients.find(c => normalizeCPF(c.cpf) === hinovaCpf);
            
            if (existingClient) {
                setClientData(existingClient);
                addNotification('success', 'SGA/Hinova', 'Veículo localizado e vinculado ao cliente existente.');
            } else {
                setClientData({
                    ...result.client,
                    cpf: formatCPF(result.client.cpf),
                    phone: formatPhone(result.client.phone),
                });
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
