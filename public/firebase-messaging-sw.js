/* global self */
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js');

const setup = (config) => {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Notification';
    const body =
      payload.notification?.body ||
      payload.data?.message ||
      'You have a new message.';
    const icon = payload.notification?.icon || '/icons/icon-192.png';
    self.registration.showNotification(title, {
      body,
      icon,
      data: payload.data,
    });
  });
};

if (self.__FIREBASE_CONFIG) {
  setup(self.__FIREBASE_CONFIG);
} else {
  self.addEventListener('message', (e) => {
    if (e.data?.type === 'FIREBASE_CONFIG') {
      setup(e.data.config);
    }
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if ('focus' in client) {
            client.focus();
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/?src=fcm');
        }
        return undefined;
      }),
  );
});
