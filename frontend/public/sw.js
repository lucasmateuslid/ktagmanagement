
// public/sw.js - Service Worker para Push Notifications

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: data.icon || '/vite.svg',
      badge: data.icon || '/vite.svg', // Ícone monocromático para Android/Barra de tarefas
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      },
      // Ações opcionais (botões na notificação)
      actions: [
        { action: 'open', title: 'Abrir Sistema' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // URL para abrir quando clicar
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Se já tiver uma aba aberta, foca nela
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
