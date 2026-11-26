import { config, explain, installedApp, iosDevice, iosInstallMessage, registerWorker, showBanner } from './common.js';
import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from './store.js';

const intro = document.querySelector('#intro');
const form = document.querySelector('#who');
const empInput = document.querySelector('#emp');
const dash = document.querySelector('#dash');
const dashTitle = document.querySelector('#dash-title');
const dashLede = document.querySelector('#dash-lede');
const enable = document.querySelector('#enable');
const switchPerson = document.querySelector('#switch');
const list = document.querySelector('#list');
const historyWrap = document.querySelector('#history-wrap');
const historyList = document.querySelector('#history');
const empty = document.querySelector('#empty');
const banner = document.querySelector('#banner');

let listenTimer = null;
let refreshTimer = null;
let knownIds = null;
let activeEmpId = '';

function parcelNode(id, parcel) {
  const card = document.createElement('article');
  card.className = 'card';
  card.id = `parcel-${id}`;
  const company = document.createElement('h2');
  company.textContent = parcel.courierCompany || 'Parcel';
  const meta = document.createElement('p');
  meta.className = 'hint';
  const locker = String(parcel.lockerNo || '').padStart(2, '0');
  const tracking = parcel.reference ? ` · ${parcel.reference}` : '';
  const statusKey = parcel.status === 'collected' || parcel.status === 'stored' ? parcel.status : 'unlocked';
  const state = statusKey === 'collected' ? 'Collected' : statusKey === 'stored' ? 'In the locker' : 'Being placed';
  meta.textContent = `Locker ${locker}${tracking}`;
  const pill = document.createElement('span');
  pill.className = `pill pill-${statusKey}`;
  pill.textContent = state;
  meta.append(document.createTextNode(' · '), pill);
  card.append(company, meta);
  if (parcel.photoUrl && parcel.status !== 'collected') {
    const img = document.createElement('img');
    img.className = 'parcel-photo';
    img.alt = 'Parcel photo';
    img.src = parcel.photoUrl;
    card.append(img);
  }
  if (parcel.status === 'stored') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Mark collected';
    button.addEventListener('click', () => collect(id, parcel.lockerNo, button));
    card.append(button);
  }
  return card;
}

async function collect(id, lockerNo, button) {
  button.disabled = true;
  try {
    await updateDoc(doc(db, 'parcels', id), { status: 'collected', collectedAt: serverTimestamp() });
    await updateDoc(doc(db, 'lockers', String(lockerNo)), { status: 'empty', activeParcelId: null });
    watch(activeEmpId);
  } catch (err) {
    showBanner(banner, explain(err), 'bad');
    button.disabled = false;
  }
}

function alertNewParcels(rows) {
  if (!knownIds) return;
  const fresh = rows.filter((row) => !knownIds.has(row.id) && row.status !== 'collected');
  if (!fresh.length) return;
  const company = fresh[0].courierCompany || 'a courier';
  const body = `A parcel from ${company} is in your locker`;
  showBanner(banner, body, 'good');
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Parcelink', { body }); } catch { /* the page banner already shows it */ }
  }
}

function showParcels(docs) {
  const rows = docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  alertNewParcels(rows);
  knownIds = new Set(rows.map((row) => row.id));
  const current = rows.filter((row) => row.status !== 'collected');
  const past = rows.filter((row) => row.status === 'collected');
  list.replaceChildren();
  historyList.replaceChildren();
  empty.classList.toggle('hidden', current.length > 0);
  historyWrap.classList.toggle('hidden', past.length === 0);
  for (const row of current) list.append(parcelNode(row.id, row));
  for (const row of past) historyList.append(parcelNode(row.id, row));
  const focus = new URLSearchParams(location.search).get('parcel');
  if (focus) document.getElementById(`parcel-${focus}`)?.scrollIntoView({ block: 'center' });
}

function watch(empId) {
  clearTimeout(listenTimer);
  clearInterval(refreshTimer);
  listenTimer = setTimeout(() => {
    showBanner(banner, 'Could not reach Parcelink. Check the connection and try again.', 'bad');
  }, 5000);
  const load = () => getDocs(query(collection(db, 'parcels'), where('empId', '==', empId)));
  load()
    .then((snap) => {
      clearTimeout(listenTimer);
      showParcels(snap.docs);
      refreshTimer = setInterval(() => {
        load().then((next) => showParcels(next.docs)).catch(() => {});
      }, 8000);
    })
    .catch(() => {
      clearTimeout(listenTimer);
      showBanner(banner, 'Could not load parcels.', 'bad');
    });
}

async function showProfile(empId) {
  dashTitle.textContent = empId;
  dashLede.textContent = 'Loading your locker.';
  try {
    const [person, lockers] = await Promise.all([
      getDoc(doc(db, 'employees', empId)),
      getDocs(query(collection(db, 'lockers'), where('ownerEmpId', '==', empId))),
    ]);
    const name = person.exists() ? person.data().name : empId;
    const department = person.exists() ? person.data().department : '';
    const numbers = lockers.docs
      .map((item) => Number(item.data().lockerNo || item.id))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 99)
      .sort((a, b) => a - b)
      .map((value) => `Locker ${String(value).padStart(2, '0')}`);
    dashTitle.textContent = name || empId;
    const place = numbers.length ? numbers.join(', ') : 'No locker assigned yet';
    dashLede.textContent = department ? `${place} · ${department}` : place;
  } catch {
    dashLede.textContent = 'Your parcels are below.';
  }
}

function openDashboard(empId) {
  activeEmpId = empId;
  knownIds = null;
  localStorage.setItem('parcelink.empId', empId);
  const url = new URL(location.href);
  if (url.searchParams.get('id') !== empId) {
    url.searchParams.set('id', empId);
    history.replaceState(null, '', url);
  }
  intro.classList.add('hidden');
  form.classList.add('hidden');
  dash.classList.remove('hidden');
  empty.classList.remove('hidden');
  showProfile(empId);
  watch(empId);
  if (iosDevice() && !installedApp()) showBanner(banner, iosInstallMessage());
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const empId = empInput.value.trim().toUpperCase();
  if (!/^EMP\d{3}$/.test(empId)) {
    showBanner(banner, 'Enter an employee ID such as EMP003.', 'bad');
    return;
  }
  showBanner(banner, '');
  openDashboard(empId);
});

switchPerson.addEventListener('click', () => {
  clearInterval(refreshTimer);
  clearTimeout(listenTimer);
  activeEmpId = '';
  knownIds = null;
  localStorage.removeItem('parcelink.empId');
  const url = new URL(location.href);
  url.searchParams.delete('id');
  history.replaceState(null, '', url);
  list.replaceChildren();
  historyList.replaceChildren();
  historyWrap.classList.add('hidden');
  empty.classList.add('hidden');
  dash.classList.add('hidden');
  intro.classList.remove('hidden');
  form.classList.remove('hidden');
  empInput.value = '';
  showBanner(banner, '');
});

enable.addEventListener('click', async () => {
  const empId = activeEmpId || (localStorage.getItem('parcelink.empId') || '').trim().toUpperCase();
  if (!/^EMP\d{3}$/.test(empId)) {
    showBanner(banner, 'Open your dashboard first.', 'bad');
    return;
  }
  if (iosDevice() && !installedApp()) {
    showBanner(banner, iosInstallMessage(), 'bad');
    return;
  }
  if (!('Notification' in window)) {
    showBanner(banner, iosDevice() ? iosInstallMessage() : 'This browser cannot show notifications.', 'bad');
    return;
  }
  enable.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notifications are blocked on this phone.');
    const registration = await registerWorker();
    if (!registration) throw new Error('This browser cannot receive push notifications.');
    await navigator.serviceWorker.ready;
    const messagingSdk = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging.js');
    const { app } = await import('./store.js');
    if (!await messagingSdk.isSupported()) throw new Error('This browser cannot receive push notifications.');
    const messaging = messagingSdk.getMessaging(app);
    const token = await messagingSdk.getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hex = [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('').slice(0, 24);
    await setDoc(doc(db, 'devices', `${empId}_${hex}`), { empId, token, updatedAt: serverTimestamp() });
    messagingSdk.onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'Parcelink';
      const body = payload.notification?.body || 'A parcel is in your locker';
      showBanner(banner, body, 'good');
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body }); } catch { /* banner already shows the alert */ }
      }
    });
    enable.textContent = 'Notifications on';
    showBanner(banner, 'Notifications are on for this phone.', 'good');
  } catch (err) {
    showBanner(banner, explain(err), 'bad');
    enable.disabled = false;
  }
});

const fromUrl = new URLSearchParams(location.search).get('id') || '';
const savedEmp = localStorage.getItem('parcelink.empId') || '';
const startId = /^EMP\d{3}$/i.test(fromUrl) ? fromUrl.toUpperCase() : savedEmp;
if (startId && /^EMP\d{3}$/.test(startId)) openDashboard(startId);
registerWorker().catch(() => {});
