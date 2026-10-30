/* eslint-disable no-restricted-globals */
// ============================================================================
// SERVICE WORKER OFICIAL PWA · IIRESODH COMUNICACIONES (WHATSAPP & WORKSPACE)
// Compatible con Android (Chrome/Edge PWA) e iOS 16.4+ (Web Push Home Screen)
// ============================================================================

const SW_VERSION = 'iiresodh-pwa-v1.0.0';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Recibir eventos Push desde Firebase Cloud Messaging (FCM / APNs Web Push)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      notification: {
        title: 'IIRESODH Comunicaciones',
        body: event.data.text()
      }
    };
  }

  const notif = payload.notification || {};
  const data = payload.data || {};

  const title = notif.title || data.title || 'IIRESODH Comunicaciones';
  const body = notif.body || data.body || 'Tienes un nuevo mensaje';
  const icon = notif.icon || data.icon || '/pwa-icon-192.png';
  const badge = notif.badge || '/pwa-icon-192.png';
  const tag = data.tag || notif.tag || `iiresodh-${data.tab || 'msg'}-${data.chatId || data.channelId || Date.now()}`;
  const targetUrl =
    data.url ||
    data.click_action ||
    (payload.fcmOptions && payload.fcmOptions.link) ||
    '/?app=comms';

  // Actualizar globo numérico en el ícono de la pantalla de inicio (Android / iOS 16.4+)
  if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
    const badgeCount = Number(data.badgeCount) || 1;
    self.navigator.setAppBadge(badgeCount).catch(() => {});
  }

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    vibrate: [180, 90, 180],
    requireInteraction: data.tipo === 'call',
    data: {
      ...data,
      url: targetUrl
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Permitir mostrar notificaciones o actualizar el badge desde el cliente activo
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SET_APP_BADGE') {
    const count = Number(msg.count) || 0;
    if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else if (typeof self.navigator.clearAppBadge === 'function') {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  } else if (msg.type === 'SHOW_LOCAL_NOTIFICATION') {
    const { title, body, data } = msg;
    self.registration.showNotification(title || 'IIRESODH', {
      body: body || '',
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      tag: (data && data.tag) || `local-${Date.now()}`,
      renotify: true,
      vibrate: [150, 70, 150],
      data: data || { url: '/?app=comms' }
    });
  }
});

// Al tocar la notificación en Android o iPhone: abrir/enfocar la PWA en el chat exacto
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/?app=comms';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({
              type: 'PWA_DEEP_LINK',
              url: targetUrl,
              data: notifData
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});
