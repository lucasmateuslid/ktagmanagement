
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// IMPORTANTE: Gere suas chaves rodando `npx web-push generate-vapid-keys` no terminal
const PUBLIC_VAPID_KEY = 'BPeLenAfveHRZomoae7lEJgkVXoV40wiqGYiaDg6itNL6t-0HzhyVS_LkP13BDgy-UVUB0ctKde-e3aPdT3xn9o'; 

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  register: async (userId: string, tenantId: string) => {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('⚠️ Web Push ignorado: Ambiente não seguro ou navegador incompatível.');
      return;
    }

    if (!tenantId) {
      console.warn('⚠️ Web Push ignorado: tenantId ausente — Functions não conseguiria escopar destinatários.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('./sw.js');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      const subscriptionId = btoa(subscription.endpoint).slice(-20).replace(/[^\w]/g, '');

      if (db) {
        // Coleção continua flat (push_subscriptions) porque as Cloud Functions
        // varrem cross-tenant para enviar notificações por preferência. Cada
        // doc carrega tenantId para que a query do dispatcher filtre corretamente.
        await setDoc(doc(db, 'push_subscriptions', subscriptionId), {
          userId,
          tenantId,
          subscription: subscription.toJSON(),
          updatedAt: Date.now(),
          userAgent: navigator.userAgent
        });
      } else {
        console.warn('Firestore não inicializado. Push subscription não salvo.');
      }

      console.log('✅ Web Push registrado.');

    } catch (error: any) {
      if (error?.name === 'SecurityError' || error?.message?.includes('insecure')) {
          console.warn('⚠️ Web Push desabilitado por restrições de segurança do navegador.');
      } else {
          console.error('❌ Falha ao registrar Web Push:', error);
      }
    }
  }
};
