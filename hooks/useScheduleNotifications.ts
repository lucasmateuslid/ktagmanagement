
import { useEffect, useRef, useState } from 'react';
import { storage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Schedule } from '../types';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const useScheduleNotifications = () => {
  const { user } = useAuth();
  const { addNotification, setCriticalAlerts } = useNotification();
  const previousStatusRef = useRef<Record<string, string>>({});
  const isFirstLoadRef = useRef(true);
  
  // Refs para controlar notificações baseadas em tempo e evitar spam
  const pendingSchedulesRef = useRef<Schedule[]>([]);
  const notified5MinRef = useRef<Set<string>>(new Set());
  const notified30MinSoundRef = useRef<Set<string>>(new Set());

  // Som de notificação (Base64 beep simples)
  const playSound = (type: 'user' | 'admin' | 'critical' = 'user') => {
      try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          if (type === 'critical') {
              // Som muito agudo e repetitivo para crítico (30 min)
              oscillator.type = 'sawtooth';
              oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
              oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.1);
              oscillator.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.2);
              gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime); 
              gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.5);
          } else if (type === 'admin') {
              // Som de "Sino" para Admin
              oscillator.type = 'triangle';
              oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
              oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
              gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.3);
          } else {
              // Som suave para User (Confirmação/Atenção)
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
              oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1); // Efeito "Subida" feliz
              gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.4);
          }
      } catch (e) {
          console.error("Audio play failed", e);
      }
  };

  // Lógica para USUÁRIO COMUM (Mudança de Status)
  useEffect(() => {
    if (!user || user.role !== 'user') return;

    const unsubscribe = storage.subscribeToSchedules(user.id, (schedules) => {
      schedules.forEach(schedule => {
        const prevStatus = previousStatusRef.current[schedule.id];
        
        if (prevStatus && prevStatus !== schedule.status) {
          // Status mudou!
          let title = '';
          let msg = '';
          let type: 'success' | 'error' | 'info' = 'info';

          // Tenta encontrar QUEM fez a ação no histórico
          // O último evento no histórico deve corresponder à mudança de status atual
          const lastEvent = schedule.history[schedule.history.length - 1];
          const actionUser = lastEvent ? lastEvent.actionBy : 'Equipe Técnica';

          switch (schedule.status) {
            case 'Em análise':
              title = 'Em Análise';
              msg = `${actionUser} está analisando sua solicitação de agendamento.`;
              type = 'info';
              break;
            case 'Confirmada':
              title = 'Agendamento Confirmado!';
              msg = `Confirmado por ${actionUser}. Técnico designado para o serviço.`;
              type = 'success';
              break;
            case 'Reagendada':
              title = 'Agendamento Alterado';
              msg = `O horário do serviço para ${schedule.vehiclePlate} foi atualizado por ${actionUser}.`;
              type = 'info'; 
              break;
            case 'Cancelada':
              title = 'Agendamento Cancelado';
              msg = `A solicitação para ${schedule.vehiclePlate} foi cancelada por ${actionUser}.`;
              type = 'error';
              break;
            case 'Concluída':
              title = 'Serviço Concluído';
              msg = `O serviço no veículo ${schedule.vehiclePlate} foi finalizado.`;
              type = 'success';
              break;
          }

          if (title) {
            addNotification(type, title, msg, true); // true = showToast on screen
            playSound('user');
          }
        }
        
        // Atualiza ref
        previousStatusRef.current[schedule.id] = schedule.status;
      });
    });

    return () => unsubscribe();
  }, [user, addNotification]);

  // Lógica para ADMIN / MODERADOR (Novas Solicitações & Timer Check)
  useEffect(() => {
    if (!user || !db || (user.role !== 'admin' && user.role !== 'moderator')) return;

    // 1. Escuta novas solicitações em tempo real (Últimas 50 para monitoramento de status)
    const q = query(collection(db, 'ktag_schedules'), orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const currentSchedules: Schedule[] = [];
        
        snapshot.docChanges().forEach((change) => {
            const schedule = change.doc.data() as Schedule;
            
            // Lógica de "Nova Solicitação" (Ignora carga inicial)
            if (change.type === 'added') {
                if (!isFirstLoadRef.current) {
                    // Verifica se é recente (menos de 30 segundos) para evitar notificações de cache
                    const isRecent = (Date.now() - schedule.createdAt) < 30000;
                    if (isRecent) {
                        playSound('admin');
                        addNotification(
                            'info', 
                            'Nova Solicitação', 
                            `Veículo ${schedule.vehiclePlate} (${schedule.serviceType}) solicitada por ${schedule.requesterName}`,
                            true 
                        );
                    }
                }
            }
        });

        // Atualiza a lista completa de agendamentos para o Timer Check
        snapshot.forEach(doc => {
            currentSchedules.push(doc.data() as Schedule);
        });
        
        // Filtra apenas as que precisam de atenção (Solicitada ou Em análise)
        pendingSchedulesRef.current = currentSchedules.filter(s => ['Solicitada', 'Em análise'].includes(s.status));
        
        // Desativa flag de carga inicial
        if (isFirstLoadRef.current) isFirstLoadRef.current = false;
    });

    // 2. Intervalo para verificar tempo (5min e 30min)
    const timerInterval = setInterval(() => {
        const now = Date.now();
        const criticalMsgs: string[] = [];

        pendingSchedulesRef.current.forEach(s => {
            // Se estiver em análise, usa o tempo de início da análise, senão usa criação
            const startTime = s.status === 'Em análise' && s.analysisStartedAt ? s.analysisStartedAt : s.createdAt;
            const diff = now - startTime;
            const minutes = diff / 60000;

            // Regra dos 5 Minutos (Alertar Novamente) - Apenas se ainda não estiver em análise ou se demorar muito na análise
            if (minutes >= 5 && minutes < 6 && !notified5MinRef.current.has(s.id)) {
                playSound('admin');
                const statusText = s.status === 'Em análise' ? 'em análise' : 'pendente';
                addNotification(
                    'info', 
                    'Aguardando Atenção', 
                    `Agendamento de placa '${s.vehiclePlate}' está ${statusText} há 5 min.`,
                    true
                );
                notified5MinRef.current.add(s.id);
            }

            // Regra dos 30 Minutos (Crítico Persistente)
            if (minutes >= 30) {
                criticalMsgs.push(`Agendamento ${s.vehiclePlate} (${s.status}) requer ação imediata`);
                
                // Toca som crítico apenas uma vez por item ao entrar no estado crítico
                if (!notified30MinSoundRef.current.has(s.id)) {
                    playSound('critical');
                    notified30MinSoundRef.current.add(s.id);
                }
            }
        });

        // Atualiza a barra vermelha no layout
        setCriticalAlerts(criticalMsgs);

    }, 30000); // Verifica a cada 30 segundos

    return () => {
        unsubscribe();
        clearInterval(timerInterval);
    };
  }, [user, addNotification, setCriticalAlerts]);
};
