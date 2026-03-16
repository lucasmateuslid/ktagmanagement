
import React, { useEffect, useState } from 'react';
import { UserX } from 'lucide-react';
import { storage } from '../services/storage';
import { Technician } from '../types';

export const TechnicianAvailabilityAlert = () => {
  const [unavailableTechs, setUnavailableTechs] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const technicians = await storage.getTechnicians();
        const localDate = new Date();
        const localDateStr = localDate.getFullYear() + '-' + 
                             String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                             String(localDate.getDate()).padStart(2, '0');

        const unavailable = technicians.filter(t => 
          t.active && 
          t.unavailableDates && 
          t.unavailableDates.includes(localDateStr)
        );
        
        setUnavailableTechs(unavailable);
      } catch (e) {
        console.error("Erro ao verificar disponibilidade", e);
      } finally {
        setLoading(false);
      }
    };

    checkAvailability();
  }, []);

  if (loading || unavailableTechs.length === 0) return null;

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 mb-6 flex items-center gap-4 animate-in slide-in-from-top-2">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-500 shrink-0">
            <UserX size={24} />
        </div>
        <div className="flex-1">
            <h4 className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Aviso de Equipe</h4>
            <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                <span className="font-bold">Técnicos indisponíveis hoje:</span>{' '}
                <span className="font-black uppercase">
                    {unavailableTechs.map(t => t.name).join(', ')}
                </span>
            </div>
        </div>
    </div>
  );
};
