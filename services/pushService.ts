
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// IMPORTANTE: Gere suas chaves rodando `npx web-push generate-vapid-keys` no terminal
const PUBLIC_VAPID_KEY = 'SUA_PUBLIC_KEY_AQUI'; 

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
  register: async (userId: string) => {
    // Verificação de Segurança: Service Workers exigem contexto seguro (HTTPS)
    // E não podem ser registrados em alguns ambientes de preview/iframe
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('⚠️ Web Push ignorado: Ambiente não seguro ou navegador incompatível.');
      return;
    }

    try {
      // 1. Registrar o Service Worker
      const registration = await navigator.serviceWorker.register('./sw.js');

      // 2. Pedir permissão ao usuário
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }

      // 3. Criar a assinatura (Subscription)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      // 4. Salvar no Firestore
      const subscriptionId = btoa(subscription.endpoint).slice(-20).replace(/[^\w]/g, ''); 
      
      await setDoc(doc(db, 'ktag_push_subscriptions', subscriptionId), {
        userId: userId,
        subscription: JSON.parse(JSON.stringify(subscription)),
        updatedAt: Date.now(),
        userAgent: navigator.userAgent
      });

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
