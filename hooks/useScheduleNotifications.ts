
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
  
  // Refs para rastrear estado anterior (para comparar mudanças)
  const previousStatusRef = useRef<Record<string, string>>({});
  
  // Ref para Admin rastrear status e evitar notificações repetidas
  const adminScheduleCacheRef = useRef<Record<string, Schedule>>({});
  
  const isFirstLoadRef = useRef(true);
  
  // Refs para controlar notificações baseadas em tempo
  const pendingSchedulesRef = useRef<Schedule[]>([]);
  const notified5MinRef = useRef<Set<string>>(new Set()); // Para 'Solicitada' (apenas uma vez)
  const notified30MinSoundRef = useRef<Set<string>>(new Set());
  
  // Novo Ref: Mapa para controlar o último lembrete recorrente de cada agendamento em análise
  // Key: ScheduleID, Value: Timestamp do último aviso
  const analysisReminderRef = useRef<Map<string, number>>(new Map());

  // Som de notificação (Base64 beep simples)
  const playSound = (type: 'user' | 'admin' | 'critical' | 'arrival' = 'user') => {
      try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;

          const audioCtx = new AudioContextClass();
          
          // Se o contexto estiver suspenso (política de autoplay), tenta retomar
          if (audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
          }

          const playBeep = (startTime: number, freq: number, typeWave: OscillatorType = 'sine', duration: number = 0.2) => {
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              
              oscillator.type = typeWave;
              oscillator.frequency.setValueAtTime(freq, startTime);
              
              gainNode.gain.setValueAtTime(0.2, startTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
              
              oscillator.start(startTime);
              oscillator.stop(startTime + duration);
          };

          if (type === 'arrival') {
              // Som duplo de chegada (Técnico no local)
              playBeep(audioCtx.currentTime, 600, 'square', 0.15);
              playBeep(audioCtx.currentTime + 0.2, 800, 'square', 0.4);
          } else if (type === 'critical') {
              // Som muito agudo e repetitivo para crítico (30 min)
              playBeep(audioCtx.currentTime, 800, 'sawtooth', 0.5);
          } else if (type === 'admin') {
              // Som de "Sino" duplo para Admin
              playBeep(audioCtx.currentTime, 880, 'triangle', 0.1);
              playBeep(audioCtx.currentTime + 0.15, 660, 'triangle', 0.3);
          } else {
              // Som suave para User
              playBeep(audioCtx.currentTime, 600, 'sine', 0.3);
          }
      } catch (e) {
          console.error("Audio play failed", e);
      }
  };

  // Lógica para USUÁRIO COMUM
  useEffect(() => {
    if (!user || user.role !== 'user') return;

    const unsubscribe = storage.subscribeToSchedules('user', user.id, (schedules) => {
      schedules.forEach(schedule => {
        const prevStatus = previousStatusRef.current[schedule.id];
        
        if (prevStatus && prevStatus !== schedule.status) {
          let title = '';
          let msg = '';
          let type: 'success' | 'error' | 'info' = 'info';
          let soundType: 'user' | 'arrival' = 'user';

          const lastEvent = schedule.history[schedule.history.length - 1];
          const actionUser = lastEvent ? lastEvent.actionBy : 'Equipe Técnica';

          switch (schedule.status) {
            case 'Em análise':
              title = 'Em Análise';
              msg = `${actionUser} está analisando sua solicitação.`;
              type = 'info';
              break;
            case 'Confirmada':
              title = 'Agendamento Confirmado!';
              msg = `Confirmado por ${actionUser}. Técnico designado.`;
              type = 'success';
              break;
            case 'Reagendada':
              title = 'Agendamento Alterado';
              msg = `Horário atualizado por ${actionUser}.`;
              type = 'info'; 
              break;
            case 'Técnico no local':
              title = 'Técnico Chegou!';
              msg = 'O técnico informou que está no local de atendimento.';
              type = 'success';
              soundType = 'arrival';
              break;
            case 'Cancelada':
              title = 'Cancelado';
              msg = `Solicitação cancelada por ${actionUser}.`;
              type = 'error';
              break;
            case 'Concluída':
              title = 'Concluído';
              msg = `Serviço finalizado.`;
              type = 'success';
              break;
          }

          if (title) {
            addNotification(type, title, msg, true);
            playSound(soundType);
          }
        }
        previousStatusRef.current[schedule.id] = schedule.status;
      });
    });

    return () => unsubscribe();
  }, [user, addNotification]);

  // Lógica para ADMIN / MODERADOR (Monitoramento Geral & Lembretes Pessoais)
  useEffect(() => {
    if (!user || !db || (user.role !== 'admin' && user.role !== 'moderator')) return;

    // Escuta agendamentos recentes
    const q = query(collection(db, 'ktag_schedules'), orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const currentSchedules: Schedule[] = [];
        
        snapshot.docChanges().forEach((change) => {
            const schedule = change.doc.data() as Schedule;
            const docId = change.doc.id;
            const prevSchedule = adminScheduleCacheRef.current[docId];

            // 1. NOVA SOLICITAÇÃO
            if (change.type === 'added') {
                if (!isFirstLoadRef.current) {
                    const isRecent = (Date.now() - schedule.createdAt) < 60000; 
                    if (isRecent) {
                        playSound('admin');
                        addNotification('info', 'Nova Solicitação', `Placa ${schedule.vehiclePlate} (${schedule.serviceType}) por ${schedule.requesterName}`, true);
                    }
                }
            }

            // 2. MODIFICAÇÃO (Alguém assumiu)
            if (change.type === 'modified' && prevSchedule) {
                if (prevSchedule.status === 'Solicitada' && schedule.status === 'Em análise') {
                    const lastHistory = schedule.history[schedule.history.length - 1];
                    const whoAssumed = lastHistory?.actionBy || 'Alguém';
                    playSound('admin');
                    addNotification('info', 'Solicitação Assumida', `${whoAssumed} assumiu o agendamento de ${schedule.vehiclePlate}.`, true);
                }
            }

            adminScheduleCacheRef.current[docId] = schedule;
        });

        snapshot.forEach(doc => {
            currentSchedules.push(doc.data() as Schedule);
        });
        
        pendingSchedulesRef.current = currentSchedules.filter(s => ['Solicitada', 'Em análise'].includes(s.status));
        
        if (isFirstLoadRef.current) isFirstLoadRef.current = false;
    });

    // 3. TIMER DE SLA E LEMBRETES RECORRENTES
    const timerInterval = setInterval(() => {
        const now = Date.now();
        const criticalMsgs: string[] = [];

        pendingSchedulesRef.current.forEach(s => {
            const startTime = s.status === 'Em análise' && s.analysisStartedAt ? s.analysisStartedAt : s.createdAt;
            const diff = now - startTime;
            const minutes = diff / 60000;

            // --- LÓGICA 1: Lembrete Recorrente para quem Assumiu (5 em 5 minutos) ---
            if (s.status === 'Em análise') {
                // Tenta descobrir quem assumiu olhando o histórico reverso
                const ownerName = [...s.history].reverse().find(h => h.action === 'Assumiu' || h.action === 'Verificando')?.actionBy;

                // Se o usuário logado for o dono da tarefa
                if (ownerName && user.name === ownerName) {
                    const lastRemindTime = analysisReminderRef.current.get(s.id) || 0;
                    
                    // Se passaram mais de 5 minutos desde o início E mais de 5 minutos desde o último lembrete
                    if (minutes >= 5 && (now - lastRemindTime) >= (5 * 60 * 1000)) {
                        playSound('admin');
                        addNotification(
                            'info', 
                            'Lembrete de Análise', 
                            `Você está analisando a placa ${s.vehiclePlate} há ${Math.floor(minutes)} minutos.`,
                            true
                        );
                        // Atualiza timestamp do último aviso
                        analysisReminderRef.current.set(s.id, now);
                    }
                }
            }

            // --- LÓGICA 2: Alerta Geral de "Esquecido na Fila" (Apenas para status Solicitada) ---
            if (s.status === 'Solicitada' && minutes >= 5 && minutes < 6 && !notified5MinRef.current.has(s.id)) {
                playSound('admin');
                addNotification('info', 'Aguardando Atenção', `Solicitação '${s.vehiclePlate}' está pendente há 5 min.`, true);
                notified5MinRef.current.add(s.id);
            }

            // --- LÓGICA 3: Crítico 30 Minutos (Para Todos) ---
            if (minutes >= 30) {
                criticalMsgs.push(`Agendamento ${s.vehiclePlate} (${s.status}) requer ação imediata`);
                
                if (!notified30MinSoundRef.current.has(s.id)) {
                    playSound('critical');
                    notified30MinSoundRef.current.add(s.id);
                }
            }
        });

        setCriticalAlerts(criticalMsgs);

    }, 30000); // Verifica a cada 30 segundos

    return () => {
        unsubscribe();
        clearInterval(timerInterval);
    };
  }, [user, addNotification, setCriticalAlerts]);
};
