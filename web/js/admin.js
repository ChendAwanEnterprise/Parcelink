import { config, explain, pageUrl, registerWorker, showBanner } from './common.js';
import {
  EMPLOYEES,
  auth,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from './firebase.js';
import { onAuthStateChanged as watchAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const signIn = document.querySelector('#signin');
const desk = document.querySelector('#desk');
const banner = document.querySelector('#banner');
const grid = document.querySelector('#grid');
const email = document.querySelector('#email');
const password = document.querySelector('#password');

registerWorker().catch(() => {});

let staff = [];

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

async function seed() {
  for (const [empId, name, department] of EMPLOYEES) {
    const ref = doc(db, 'employees', empId);
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { empId, name, department });
  }
  for (let lockerNo = 1; lockerNo <= 4; lockerNo += 1) {
    const ref = doc(db, 'lockers', String(lockerNo));
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { lockerNo, ownerEmpId: null, status: 'empty', activeParcelId: null });
    }
  }
}

async function latestParcel(lockerNo) {
  const snap = await getDocs(query(collection(db, 'parcels'), where('lockerNo', '==', lockerNo)));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0] || null;
}

function lockerCard(lockerNo, locker, parcel) {
  const card = document.createElement('article');
  card.className = 'card';
  const heading = document.createElement('h2');
  heading.textContent = `Locker ${String(lockerNo).padStart(2, '0')}`;
  const state = document.createElement('p');
  state.className = 'who';
  const owner = staff.find((person) => person.empId === locker.ownerEmpId);
  const ownerLabel = owner ? `${owner.name} · ${owner.empId}` : 'No owner';
  const statusLabel = locker.status === 'empty' ? 'Empty' : locker.status === 'unlocked' ? 'Unlocked' : 'Occupied';
  state.textContent = `${ownerLabel} · ${statusLabel}`;

  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.textContent = 'Assigned to';
  const select = document.createElement('select');
  select.append(option('', 'No owner'));
  for (const person of staff) {
    select.append(option(person.empId, `${person.name} · ${person.department}`));
  }
  select.value = locker.ownerEmpId || '';
  select.disabled = locker.status !== 'empty';
  label.append(select);
  field.append(label);

  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Save';
  save.disabled = locker.status !== 'empty';
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await updateDoc(doc(db, 'lockers', String(lockerNo)), { ownerEmpId: select.value || null });
      showBanner(banner, `Locker ${String(lockerNo).padStart(2, '0')} saved.`, 'good');
      await render();
    } catch (err) {
      showBanner(banner, explain(err), 'bad');
      save.disabled = false;
    }
  });

  const qrWrap = document.createElement('div');
  qrWrap.className = 'qr-wrap';
  const url = pageUrl('drop.html', { locker: String(lockerNo) });
  const image = document.createElement('img');
  image.alt = `QR code for locker ${String(lockerNo).padStart(2, '0')}`;
  image.width = 180;
  image.height = 180;
  if (typeof qrcode === 'function') {
    const code = qrcode(0, 'M');
    code.addData(url);
    code.make();
    image.src = code.createDataURL(6, 2);
  }
  const link = document.createElement('a');
  link.href = url;
  link.textContent = url;
  qrWrap.append(image, link);

  card.append(heading, state, field, save, qrWrap);
  if (parcel?.photoUrl) {
    const img = document.createElement('img');
    img.className = 'parcel-photo';
    img.alt = 'Latest parcel photo';
    img.src = parcel.photoUrl;
    const caption = document.createElement('p');
    caption.className = 'hint';
    caption.textContent = `${parcel.courierCompany || 'Parcel'} · ${parcel.status || ''}`;
    card.append(img, caption);
  }
  return card;
}

async function loadStaff() {
  const snap = await getDocs(collection(db, 'employees'));
  staff = snap.docs
    .map((item) => item.data())
    .sort((a, b) => String(a.empId).localeCompare(String(b.empId)));
}

async function render() {
  await loadStaff();
  const cards = [];
  for (let lockerNo = 1; lockerNo <= 4; lockerNo += 1) {
    const snap = await getDoc(doc(db, 'lockers', String(lockerNo)));
    cards.push(lockerCard(lockerNo, snap.data() || {}, await latestParcel(lockerNo)));
  }
  grid.replaceChildren(...cards);
}

signIn.addEventListener('submit', async (event) => {
  event.preventDefault();
  showBanner(banner, '');
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (err) {
    showBanner(banner, 'That email or password was not accepted.', 'bad');
  }
});

document.querySelector('#signout').addEventListener('click', () => signOut(auth));
document.querySelector('#print').addEventListener('click', () => window.print());

watchAuth(auth, async (user) => {
  if (!user) {
    desk.classList.add('hidden');
    signIn.classList.remove('hidden');
    return;
  }
  if (user.uid !== config.adminUid) {
    await signOut(auth);
    showBanner(banner, 'This account is not the Parcelink admin.', 'bad');
    return;
  }
  signIn.classList.add('hidden');
  desk.classList.remove('hidden');
  try {
    await seed();
    await render();
  } catch (err) {
    showBanner(banner, explain(err), 'bad');
  }
});
