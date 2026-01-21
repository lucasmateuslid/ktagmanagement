
import { useEffect, useRef } from 'react';
import { storage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Schedule } from '../types';

export const useScheduleNotifications = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const previousStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user || user.role !== 'user') return;

    // Som de notificação (Base64 beep simples)
    const playSound = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const unsubscribe = storage.subscribeToSchedules(user.id, (schedules) => {
      schedules.forEach(schedule => {
        const prevStatus = previousStatusRef.current[schedule.id];
        
        if (prevStatus && prevStatus !== schedule.status) {
          // Status mudou!
          let title = '';
          let msg = '';
          let type: 'success' | 'error' | 'info' = 'info';

          switch (schedule.status) {
            case 'Confirmada':
              title = 'Agendamento Confirmado!';
              msg = `Seu serviço para o veículo ${schedule.vehiclePlate} foi confirmado.`;
              type = 'success';
              break;
            case 'Reagendada':
              title = 'Agendamento Alterado';
              msg = `O horário do serviço para ${schedule.vehiclePlate} foi atualizado.`;
              type = 'info'; 
              break;
            case 'Cancelada':
              title = 'Agendamento Cancelado';
              msg = `A solicitação para ${schedule.vehiclePlate} foi cancelada.`;
              type = 'error';
              break;
            case 'Concluída':
              title = 'Serviço Concluído';
              msg = `O serviço no veículo ${schedule.vehiclePlate} foi finalizado com sucesso.`;
              type = 'success';
              break;
          }

          if (title) {
            addNotification(type, title, msg);
            playSound();
          }
        }
        
        // Atualiza ref
        previousStatusRef.current[schedule.id] = schedule.status;
      });
    });

    return () => unsubscribe();
  }, [user, addNotification]);
};
