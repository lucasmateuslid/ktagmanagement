
import * as React from 'react';
import { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { MapComponent } from '../components/MapComponent';
import { storage } from '../services/storage';
import { StolenRecord, LocationHistory } from '../types';
import { ShieldAlert, MapPin, Clock, Car, AlertTriangle } from 'lucide-react';

const { useParams } = ReactRouterDOM as any;

export const PublicTracking = () => {
  const { token } = useParams();
  const [record, setRecord] = useState<StolenRecord | null>(null);
  const [location, setLocation] = useState<LocationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!token) return;
      try {
        const data = await storage.getStolenRecordByToken(token);
        if (data) {
          setRecord(data);
          // Initial location
          const loc = await storage.getPublicVehicleLocation(data.vehicleId);
          if (loc) {
            setLocation(loc);
          } else {
            // Fallback para a localização do momento do roubo
            setLocation({
              lat: data.location.lat,
              lon: data.location.lon,
              timestamp: data.timestamp,
              tagId: 'public',
              id: 'public'
            } as any);
          }
        } else {
          setError('Link de rastreamento inválido ou expirado.');
        }
      } catch (err) {
        setError('Erro ao carregar informações de rastreamento.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [token]);

  // Polling for location updates
  useEffect(() => {
    if (!record || record.status === 'recovered') return;

    const interval = setInterval(async () => {
      const loc = await storage.getPublicVehicleLocation(record.vehicleId);
      if (loc) setLocation(loc);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [record]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 font-black uppercase tracking-widest text-[10px]">Acessando Canal Seguro...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center p-10 text-center">
        <div className="w-20 h-20 rounded-[32px] bg-red-500/10 text-red-500 flex items-center justify-center mb-6 border border-red-500/20">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-2xl font-display font-black text-white uppercase tracking-tight mb-2">Acesso Negado</h1>
        <p className="text-zinc-500 max-w-md">{error || 'O link fornecido não é válido.'}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 md:p-6 flex items-center justify-between z-10 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-lg font-display font-black text-white uppercase tracking-tight leading-none">Rastreamento Policial</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Canal de Emergência • {record.vehiclePlate}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 bg-zinc-800/50 px-4 py-2 rounded-xl border border-zinc-700/50">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Monitoramento em Tempo Real</span>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        <MapComponent 
          locations={location ? [{ ...location, tagId: 'public', id: 'public' }] : []}
          isFleetMode={false}
          highlightedTagId="public"
        />
        
        {/* Info Overlay */}
        <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-80 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-[32px] p-6 shadow-2xl z-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Car size={20} />
            </div>
            <div>
              <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter leading-none">{record.vehiclePlate}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{record.vehicleModel}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Última Localização</p>
                <p className="text-xs text-zinc-300 font-medium">{location ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` : 'Buscando sinal...'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Última Atualização</p>
                <p className="text-xs text-zinc-300 font-medium">{location ? new Date(location.timestamp).toLocaleTimeString() : '--:--:--'}</p>
              </div>
            </div>
          </div>

          {record.status === 'recovered' && (
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500">
              <ShieldAlert size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Veículo Recuperado</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Disclaimer */}
      <div className="bg-zinc-950 p-3 text-center border-t border-zinc-900">
        <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Este link é de uso exclusivo das autoridades policiais. O compartilhamento indevido é crime.</p>
      </div>
    </div>
  );
};
