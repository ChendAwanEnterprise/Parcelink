import { config, explain, registerWorker, showBanner } from './common.js';
import {
  collection,
  db,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from './store.js';

const form = document.querySelector('#who');
const empInput = document.querySelector('#emp');
const enable = document.querySelector('#enable');
const list = document.querySelector('#list');
const empty = document.querySelector('#empty');
const banner = document.querySelector('#banner');
const savedEmp = localStorage.getItem('parcelink.empId') || '';
let listenTimer = null;
let refreshTimer = null;

if (savedEmp) empInput.value = savedEmp;

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
  if (parcel.photoUrl) {
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
    const parcelRef = doc(db, 'parcels', id);
    const lockerRef = doc(db, 'lockers', String(lockerNo));
    await updateDoc(parcelRef, { status: 'collected', collectedAt: serverTimestamp() });
    await updateDoc(lockerRef, { status: 'empty', activeParcelId: null });
    watch(localStorage.getItem('parcelink.empId'));
  } catch (err) {
    showBanner(banner, explain(err), 'bad');
    button.disabled = false;
  }
}

function showParcels(docs) {
  const rows = docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  list.replaceChildren();
  empty.classList.toggle('hidden', rows.length > 0);
  for (const row of rows) list.append(parcelNode(row.id, row));
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
      }, 20000);
    })
    .catch(() => {
      clearTimeout(listenTimer);
      showBanner(banner, 'Could not load parcels.', 'bad');
    });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const empId = empInput.value.trim().toUpperCase();
  if (!/^EMP\d{3}$/.test(empId)) {
    showBanner(banner, 'Enter an employee ID such as EMP003.', 'bad');
    return;
  }
  localStorage.setItem('parcelink.empId', empId);
  showBanner(banner, '');
  watch(empId);
});

enable.addEventListener('click', async () => {
  const empId = (localStorage.getItem('parcelink.empId') || empInput.value).trim().toUpperCase();
  if (!/^EMP\d{3}$/.test(empId)) {
    showBanner(banner, 'Save your employee ID first.', 'bad');
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
      if (Notification.permission === 'granted') new Notification(title, { body });
    });
    showBanner(banner, 'Notifications are on for this phone.', 'good');
  } catch (err) {
    showBanner(banner, explain(err), 'bad');
  } finally {
    enable.disabled = false;
  }
});

if (savedEmp) watch(savedEmp);
registerWorker().catch(() => {});
