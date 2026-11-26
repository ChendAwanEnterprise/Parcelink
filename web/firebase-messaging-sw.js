importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');
importScripts('config.js');
importScripts('sw.js');

firebase.initializeApp(self.ParcelinkConfig.firebaseConfig);
firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || new URL('owner.html', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const scope = new URL('./', self.registration.scope).href;
    const open = windows.find((windowClient) => windowClient.url.startsWith(scope));
    if (open) {
      if (typeof open.navigate === 'function') {
        return open.navigate(target).then((client) => (client || open).focus());
      }
      return open.focus();
    }
    return self.clients.openWindow(target);
  }));
});
