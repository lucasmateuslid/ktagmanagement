
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// IMPORTANTE: Gere suas chaves rodando `npx web-push generate-vapid-keys` no terminal
// Cole a CHAVE PÚBLICA abaixo. A Privada vai apenas no Backend (functions).
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications não suportadas neste navegador.');
      return;
    }

    try {
      // 1. Registrar o Service Worker (arquivo deve estar em public/sw.js)
      // Usamos path relativo que funciona melhor em ambientes de subdiretório
      const registration = await navigator.serviceWorker.register('./sw.js');

      // 2. Pedir permissão ao usuário (O navegador vai mostrar o popup nativo)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permissão de notificação negada pelo usuário.');
        return;
      }

      // 3. Criar a assinatura (Subscription)
      // Isso conecta o navegador ao serviço de push do vendor (Google/Mozilla/Apple)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      // 4. Salvar no Firestore para que o backend possa enviar mensagens
      // Usamos um ID baseado no endpoint para evitar duplicatas do mesmo dispositivo
      // O endpoint é único por navegador/perfil
      if (!db) {
        console.warn('Firestore not initialized, skipping subscription save');
        return { success: true, message: 'Push notification configured but subscription not saved' };
      }
      
      const subscriptionId = btoa(subscription.endpoint).slice(-20).replace(/[^\w]/g, '');
      
      await setDoc(doc(db, 'ktag_push_subscriptions', subscriptionId), {
        userId: userId,
        subscription: JSON.parse(JSON.stringify(subscription)), // Serializa o objeto
        updatedAt: Date.now(),
        userAgent: navigator.userAgent
      });

      console.log('✅ Web Push registrado com sucesso para:', userId);

    } catch (error: any) {
      // Filtra erro de origem comum em previews/iframes
      if (error?.message?.includes('origin') || error?.name === 'SecurityError') {
          console.warn('⚠️ Web Push desabilitado: Ambiente de preview com restrição de origem (Service Worker).');
      } else {
          console.error('❌ Falha ao registrar Web Push:', error);
      }
    }
  }
};
