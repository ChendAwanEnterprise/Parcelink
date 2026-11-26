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
  return message || 'Something went wrong.';
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
