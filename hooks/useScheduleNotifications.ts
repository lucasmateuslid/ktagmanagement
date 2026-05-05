
import { useEffect, useRef, useState } from 'react';
import { storage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Schedule } from '../types';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../services/firebase';

// SINGLETON AUDIO CONTEXT
// Mantém uma única instância de áudio para toda a aplicação para evitar bloqueios de hardware e política de autoplay
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = () => {
    if (!sharedAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            sharedAudioCtx = new AudioContextClass();
        }
    }
    return sharedAudioCtx;
};

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
  const activeSchedulesRef = useRef<Schedule[]>([]);
  const notified5MinRef = useRef<Set<string>>(new Set()); // Para 'Solicitada' (apenas uma vez)
  const notified24hRef = useRef<Set<string>>(new Set()); // Para alerta de 24h
  const notified30MinSoundRef = useRef<Set<string>>(new Set());
  
  // Novo Ref: Mapa para controlar o último lembrete recorrente de cada agendamento em análise
  const analysisReminderRef = useRef<Map<string, number>>(new Map());

  // --- DESBLOQUEIO DE ÁUDIO ---
  // O navegador bloqueia sons iniciados via timer/socket se o usuário não tiver interagido com a página.
  // Este efeito "destrava" o áudio no primeiro clique ou tecla do usuário.
  useEffect(() => {
      const unlockAudio = () => {
          const ctx = getAudioContext();
          if (ctx && ctx.state === 'suspended') {
              ctx.resume().catch((e) => console.error("Audio resume failed", e));
          }
      };

      window.addEventListener('click', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);

      return () => {
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
      };
  }, []);

  // Som de notificação (Oscillator)
  const playSound = (type: 'user' | 'admin' | 'critical' | 'arrival' | 'change' = 'user') => {
      try {
          const audioCtx = getAudioContext();
          if (!audioCtx) return;

          // Tenta retomar se estiver suspenso (fallback)
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
              
              // Volume diferenciado para críticos
              const volume = type === 'critical' ? 0.3 : 0.1;

              gainNode.gain.setValueAtTime(volume, startTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
              
              oscillator.start(startTime);
              oscillator.stop(startTime + duration);
          };

          const now = audioCtx.currentTime;

          if (type === 'arrival') {
              // Som "Ding-Dong" (Chegada do técnico)
              playBeep(now, 600, 'sine', 0.2);
              playBeep(now + 0.25, 450, 'sine', 0.4);
          } else if (type === 'change') {
              // Som rápido de alteração (Reagendamento)
              playBeep(now, 500, 'triangle', 0.1);
              playBeep(now + 0.1, 700, 'triangle', 0.1);
          } else if (type === 'critical') {
              // Som muito agudo e repetitivo para crítico (30 min) - "Alarme"
              playBeep(now, 800, 'sawtooth', 0.15);
              playBeep(now + 0.2, 800, 'sawtooth', 0.15);
              playBeep(now + 0.4, 800, 'sawtooth', 0.4);
          } else if (type === 'admin') {
              // Som de "Sino" duplo para Admin
              playBeep(now, 880, 'triangle', 0.1);
              playBeep(now + 0.15, 660, 'triangle', 0.3);
          } else {
              // Som suave para User (Genérico)
              playBeep(now, 600, 'sine', 0.3);
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
          let soundType: 'user' | 'arrival' | 'change' = 'user';

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
              msg = `Data/Hora atualizada por ${actionUser}.`;
              type = 'info'; 
              soundType = 'change'; // Som específico de mudança
              break;
            case 'Técnico no local':
            case 'Cliente no local':
              title = schedule.status === 'Cliente no local' ? 'Cliente Chegou!' : 'Técnico Chegou!';
              msg = schedule.status === 'Cliente no local' ? 'O técnico informou que o cliente está no local.' : 'O técnico informou que está no local de atendimento.';
              type = 'success';
              soundType = 'arrival'; // Som de campainha
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
    
    // Escuta agendamentos ativos para checagem de 24h
    const qActive = query(collection(db, 'ktag_schedules'), where('status', 'in', ['Confirmada', 'Reagendada', 'Técnico no local', 'Cliente no local']));

    const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
        const active: Schedule[] = [];
        snapshot.forEach(doc => active.push(doc.data() as Schedule));
        activeSchedulesRef.current = active;
    });

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

            // 2. MODIFICAÇÃO (Alguém assumiu ou mudou status)
            if (change.type === 'modified' && prevSchedule) {
                // Se alguém assumiu
                if (prevSchedule.status === 'Solicitada' && schedule.status === 'Em análise') {
                    const lastHistory = schedule.history[schedule.history.length - 1];
                    const whoAssumed = lastHistory?.actionBy || 'Alguém';
                    playSound('admin');
                    addNotification('info', 'Solicitação Assumida', `${whoAssumed} assumiu o agendamento de ${schedule.vehiclePlate}.`, true);
                }
                
                // Tratar Aguardando Vínculo com Voz
                if (prevSchedule.status !== 'Aguardando Vínculo' && schedule.status === 'Aguardando Vínculo') {
                    const lastHistory = schedule.history[schedule.history.length - 1];
                    const whoChanged = lastHistory?.actionBy || 'O Técnico';
                    playSound('admin');
                    
                    if ('speechSynthesis' in window && user?.id === schedule.requesterId) {
                        const utterance = new SpeechSynthesisUtterance(`Agendamento de ${schedule.vehiclePlate}, foi finalizado pelo técnico, aguardando a confirmação de vínculo!`);
                        utterance.lang = 'pt-BR';
                        utterance.rate = 1.0;
                        window.speechSynthesis.speak(utterance);
                    }
                    
                    addNotification('info', 'Serviço finalizado aguardando vínculo', `Placa ${schedule.vehiclePlate}: Técnico finalizou o serviço, confirme o vínculo.`, true);
                }
                // Se mudou para qualquer outro status importante (Confirmada, Concluída, etc)
                else if (prevSchedule.status !== schedule.status && !['Solicitada', 'Em análise'].includes(schedule.status)) {
                    const lastHistory = schedule.history[schedule.history.length - 1];
                    const whoChanged = lastHistory?.actionBy || 'Alguém';
                    playSound('admin');
                    addNotification('info', 'Status Atualizado', `Placa ${schedule.vehiclePlate}: ${prevSchedule.status} ➔ ${schedule.status} por ${whoChanged}`, true);
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
                
                // Toca som a cada verificação (30s) se estiver crítico, para forçar atenção
                playSound('critical');
            }
        });

        // --- LÓGICA 4: Alerta de 24h para serviços agendados ---
        activeSchedulesRef.current.forEach(s => {
            const dateStr = s.confirmedDate;
            const timeStr = s.confirmedTime || '00:00';
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [year, month, day] = dateStr.split('-').map(Number);
                const [hours, mins] = timeStr.split(':').map(Number);
                const scheduledTimeMs = new Date(year, month - 1, day, hours || 0, mins || 0).getTime();
                const hoursPassed = (now - scheduledTimeMs) / 3600000;

                if (hoursPassed >= 24 && !notified24hRef.current.has(s.id)) {
                    playSound('admin');
                    addNotification('error', 'Atenção Necessária', `O serviço ${s.vehiclePlate} passou de 24h do agendamento. Verifique se foi concluído ou cancelado.`, true);
                    notified24hRef.current.add(s.id);
                }
            }
        });

        setCriticalAlerts(criticalMsgs);

    }, 30000); // Verifica a cada 30 segundos

    return () => {
        unsubscribe();
        unsubscribeActive();
        clearInterval(timerInterval);
    };
  }, [user, addNotification, setCriticalAlerts]);
};
