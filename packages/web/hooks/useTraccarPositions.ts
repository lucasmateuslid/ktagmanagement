import { useState, useEffect, useRef, useCallback } from 'react';
import type { TraccarPosition } from '@ktag/shared';
import { auth } from '../services/firebase';
import { trackingWebSocketUrl } from '../services/trackingEndpoint';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

export function useTraccarPositions(tenantId: string) {
  const [positions, setPositions] = useState<Map<number, TraccarPosition>>(new Map());
  const [status, setStatus] = useState<WsStatus>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(async () => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const token = await auth?.currentUser?.getIdToken();
    if (!token || unmountedRef.current) {
      setStatus('disconnected');
      return;
    }
    const ws = new WebSocket(trackingWebSocketUrl(tenantId), [`firebase.${token}`]);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      retryRef.current = 0;
      setStatus('connected');
    };

    ws.onmessage = (ev) => {
      try {
        const msg: { type: string; data: TraccarPosition } = JSON.parse(ev.data);
        if (msg.type === 'position' && msg.data?.deviceId != null) {
          setPositions(prev => {
            const next = new Map(prev);
            next.set(msg.data.deviceId, msg.data);
            return next;
          });
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setStatus('disconnected');
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** retryRef.current, RECONNECT_MAX_MS);
      retryRef.current += 1;
      timerRef.current = setTimeout(() => { void connect(); }, delay);
    };

    ws.onerror = () => ws.close();
  }, [tenantId]);

  useEffect(() => {
    unmountedRef.current = false;
    void connect();
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      setStatus('disconnected');
    };
  }, [connect]);

  return { positions, status };
}
