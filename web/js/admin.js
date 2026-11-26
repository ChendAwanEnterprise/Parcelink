import { config, explain, pageUrl, registerWorker, showBanner } from './common.js';
import { app, collection, db, deleteDoc, doc, getDocs, setDoc, updateDoc } from './store.js';
import { getAuth, onAuthStateChanged as watchAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const EMPLOYEES = [
  ['EMP001', 'Farah', 'Reception'],
  ['EMP002', 'Daniel', 'Operations'],
  ['EMP003', 'Aina', 'Finance'],
  ['EMP004', 'Hafiz', 'IT'],
  ['EMP005', 'Mei Ling', 'HR'],
  ['EMP006', 'Arif', 'Sales'],
  ['EMP007', 'Sofia', 'Marketing'],
  ['EMP008', 'Johan', 'Warehouse'],
  ['EMP009', 'Nurul', 'Admin'],
  ['EMP010', 'Chris', 'Engineering'],
];
const auth = getAuth(app);

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
  const [people, lockerSnap] = await Promise.all([
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'lockers')),
  ]);
  const ids = new Set(people.docs.map((item) => item.id));
  const writes = EMPLOYEES
    .filter(([empId]) => !ids.has(empId))
    .map(([empId, name, department]) => setDoc(doc(db, 'employees', empId), { empId, name, department }));
  if (lockerSnap.empty) {
    for (let lockerNo = 1; lockerNo <= 4; lockerNo += 1) {
      writes.push(setDoc(doc(db, 'lockers', String(lockerNo)), {
        lockerNo,
        ownerEmpId: null,
        status: 'empty',
        activeParcelId: null,
      }));
    }
  }
  await Promise.all(writes);
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
  const statusKey = locker.status === 'unlocked' || locker.status === 'occupied' ? locker.status : 'empty';
  const statusLabel = statusKey === 'empty' ? 'Empty' : statusKey === 'unlocked' ? 'Unlocked' : 'Occupied';
  state.textContent = ownerLabel;
  const pill = document.createElement('span');
  pill.className = `pill pill-${statusKey}`;
  pill.textContent = statusLabel;
  state.append(document.createTextNode(' · '), pill);

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
      const ownerEmpId = select.value || null;
      await updateDoc(doc(db, 'lockers', String(lockerNo)), { ownerEmpId });
      const person = staff.find((item) => item.empId === ownerEmpId);
      const who = person ? person.name : 'No owner';
      showBanner(banner, ownerEmpId ? `Locker ${String(lockerNo).padStart(2, '0')} is ${who}'s. Their phone can open the owner dashboard once.` : `Locker ${String(lockerNo).padStart(2, '0')} has no owner.`, 'good');
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

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'secondary';
  remove.textContent = 'Delete locker';
  const canDelete = (locker.status || 'empty') === 'empty' && !locker.activeParcelId;
  remove.disabled = !canDelete;
  remove.addEventListener('click', async () => {
    const label = `Locker ${String(lockerNo).padStart(2, '0')}`;
    if (!window.confirm(`Delete ${label}? The QR on that box will stop working.`)) return;
    remove.disabled = true;
    try {
      await deleteDoc(doc(db, 'lockers', String(lockerNo)));
      showBanner(banner, `${label} deleted.`, 'good');
      await render();
    } catch (err) {
      showBanner(banner, explain(err), 'bad');
      remove.disabled = false;
    }
  });

  card.append(heading, state, field, save, qrWrap, remove);
  if (!canDelete) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Empty this locker before deleting it.';
    card.append(note);
  }
  if (locker.ownerEmpId) {
    const dash = document.createElement('a');
    dash.className = 'btn secondary';
    dash.href = pageUrl('owner.html', { id: locker.ownerEmpId });
    dash.textContent = 'Owner dashboard';
    card.append(dash);
  }
  if (parcel?.photoUrl) {
    const caption = document.createElement('p');
    caption.className = 'hint';
    caption.textContent = `${parcel.courierCompany || 'Parcel'} · ${parcel.status || ''}`;
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'secondary';
    view.textContent = 'View photo';
    const img = document.createElement('img');
    img.className = 'parcel-photo hidden';
    img.alt = 'Latest parcel photo';
    view.addEventListener('click', () => {
      const showing = !img.classList.contains('hidden');
      if (showing) {
        img.classList.add('hidden');
        view.textContent = 'View photo';
        return;
      }
      if (!img.getAttribute('src')) img.src = parcel.photoUrl;
      img.classList.remove('hidden');
      view.textContent = 'Hide photo';
    });
    card.append(caption, view, img);
  }
  return card;
}

async function render() {
  const [people, lockerSnap, parcelSnap] = await Promise.all([
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'lockers')),
    getDocs(collection(db, 'parcels')),
  ]);
  staff = people.docs
    .map((item) => item.data())
    .sort((a, b) => String(a.empId).localeCompare(String(b.empId)));
  const lockers = new Map(lockerSnap.docs.map((item) => [item.id, item.data()]));
  const latest = new Map();
  for (const item of parcelSnap.docs) {
    const parcel = { id: item.id, ...item.data() };
    const key = String(parcel.lockerNo);
    const previous = latest.get(key);
    if (!previous || (parcel.createdAt?.seconds || 0) > (previous.createdAt?.seconds || 0)) latest.set(key, parcel);
  }
  const numbers = lockerSnap.docs
    .map((item) => Number(item.data().lockerNo || item.id))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 99)
    .sort((a, b) => a - b);
  const cards = numbers.map((lockerNo) => lockerCard(
    lockerNo,
    lockers.get(String(lockerNo)) || {},
    latest.get(String(lockerNo)) || null,
  ));
  grid.replaceChildren(...cards);
}

async function addLocker() {
  const snap = await getDocs(collection(db, 'lockers'));
  const used = new Set(snap.docs.map((item) => Number(item.id)));
  let lockerNo = 1;
  while (used.has(lockerNo) && lockerNo <= 99) lockerNo += 1;
  if (lockerNo > 99) {
    showBanner(banner, 'Parcelink can hold 99 lockers.', 'bad');
    return;
  }
  await setDoc(doc(db, 'lockers', String(lockerNo)), {
    lockerNo,
    ownerEmpId: null,
    status: 'empty',
    activeParcelId: null,
  });
  showBanner(banner, `Locker ${String(lockerNo).padStart(2, '0')} added. Print its QR and stick it on the box.`, 'good');
  await render();
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
document.querySelector('#add-locker').addEventListener('click', async () => {
  const button = document.querySelector('#add-locker');
  button.disabled = true;
  try {
    await addLocker();
  } catch (err) {
    showBanner(banner, explain(err), 'bad');
  } finally {
    button.disabled = false;
  }
});

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
