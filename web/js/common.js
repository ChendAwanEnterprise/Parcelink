export const config = self.ParcelinkConfig;

export function siteRoot() {
  return new URL(config.base || './', location.href);
}

export function pageUrl(file, params) {
  const url = new URL(file, siteRoot());
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url.href;
}

export function withTimeout(promise, ms = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Could not reach Parcelink. Check the connection and try again.'));
    }, ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function explain(err) {
  const code = err && err.code;
  const message = (err && err.message) || '';
  if (code === 'unavailable' || /client is offline/i.test(message)) {
    return 'Firestore is not turned on. In the Firebase console, open Firestore Database, create the database, then reload this page.';
  }
  if (code === 'permission-denied') {
    return 'Firestore blocked this. Create the database if it is missing, then deploy the Parcelink rules.';
  }
  if (/can't find variable:\s*notification/i.test(message) || /notification is not defined/i.test(message)) {
    return iosInstallMessage();
  }
  return message || 'Something went wrong.';
}

export function iosDevice() {
  const agent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function installedApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function iosInstallMessage() {
  const chrome = /CriOS/i.test(navigator.userAgent || '');
  if (!installedApp()) {
    const opener = chrome ? 'Chrome on iPhone cannot turn on alerts. Open this page in Safari, tap Share, then Add to Home Screen.' : 'Alerts on iPhone only work from the Home Screen. In Safari, tap Share, then Add to Home Screen.';
    return `${opener} Open the Parcelink icon and tap Enable notifications.`;
  }
  return 'This iPhone still cannot show alerts. Update iOS, then open Parcelink from the Home Screen icon you added in Safari.';
}

export function showBanner(node, message, kind) {
  node.textContent = message || '';
  node.classList.toggle('hidden', !message);
  node.classList.remove('bad', 'good');
  if (kind) node.classList.add(kind);
}

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const root = siteRoot();
  return navigator.serviceWorker.register(new URL('firebase-messaging-sw.js', root), { scope: root.pathname });
}
