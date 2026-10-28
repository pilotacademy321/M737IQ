/**
 * M737IQ Firebase Cloud Messaging & Web Push Service Worker
 * Handles real mobile push notifications when website or PWA is backgrounded or closed.
 */

// 1. Load Firebase scripts for Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// 2. Initialize Firebase in Service Worker context
firebase.initializeApp({
  apiKey: "AIzaSyBrV9WlakPf9XKdaq4afgoMPzzrx8VghTw",
  projectId: "operating-league-dv9wh",
  messagingSenderId: "153128091325",
  appId: "1:153128091325:web:eb3b2b5735707e866a41d4"
});

const messaging = firebase.messaging();

// 3. Handle Background FCM Messages
messaging.onBackgroundMessage((payload) => {
  console.log('[M737IQ SW] Received FCM background message:', payload);

  const data = payload.data || {};
  const notification = payload.notification || {};

  // Generic lockscreen privacy enforcement where requested
  const isGeneric = data.useGenericLockscreen === 'true';
  const defaultTitle = isGeneric
    ? 'منصة M737IQ الطبية'
    : (notification.title || data.title || 'M737IQ — إشعار طبي جديد');

  const defaultBody = isGeneric
    ? 'لديك تحديث طبي جديد في حسابك المعتمد'
    : (notification.body || data.body || 'لديك إشعار جديد في منصة M737IQ الطبية');

  const targetUrl = data.url || data.link || '/';
  const portal = data.portal || 'home';
  const eventId = data.eventId || `evt_${Date.now()}`;

  const notificationOptions = {
    body: defaultBody,
    icon: notification.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || `m737-${portal}-${eventId}`,
    renotify: true,
    requireInteraction: data.priority === 'urgent',
    data: {
      url: targetUrl,
      portal: portal,
      eventId: eventId,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open_portal', title: 'عرض التفاصيل (Open)' },
      { action: 'dismiss', title: 'إغلاق (Dismiss)' }
    ]
  };

  return self.registration.showNotification(defaultTitle, notificationOptions);
});

// 4. Handle Standard Web Push Event (fallback for raw WebPush payloads)
self.addEventListener('push', (event) => {
  console.log('[M737IQ SW] Raw push event received');
  if (!event.data) return;

  try {
    const rawPayload = event.data.json();
    const data = rawPayload.data || rawPayload;
    const notification = rawPayload.notification || {};

    const isGeneric = data.useGenericLockscreen === 'true';
    const title = isGeneric
      ? 'منصة M737IQ الطبية'
      : (notification.title || data.title || 'M737IQ — إشعار طبي');

    const body = isGeneric
      ? 'لديك تحديث طبي جديد في حسابك المعتمد'
      : (notification.body || data.body || 'لديك إشعار جديد في منصة M737IQ');

    const targetUrl = data.url || data.link || '/';

    const options = {
      body: body,
      icon: notification.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || `m737-push-${Date.now()}`,
      renotify: true,
      data: {
        url: targetUrl,
        timestamp: Date.now()
      },
      actions: [
        { action: 'open_portal', title: 'عرض التفاصيل' }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const plainText = event.data.text() || 'لديك إشعار طبي جديد في منصة M737IQ';
    event.waitUntil(
      self.registration.showNotification('M737IQ — تحديث طبي', {
        body: plainText,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: '/' }
      })
    );
  }
});

// 5. Handle Notification Click (Deep Linking to Portal)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 6. Handle Service Worker Lifecycle
self.addEventListener('install', (event) => {
  console.log('[M737IQ SW] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[M737IQ SW] Service Worker activated');
  event.waitUntil(clients.claim());
});
