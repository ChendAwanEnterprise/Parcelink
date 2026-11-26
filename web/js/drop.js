import { explain, pageUrl, registerWorker, showBanner, siteRoot, withTimeout } from './common.js';
import { uploadPhoto } from './photo.js';
import { db, doc, getDoc } from './store.js';

const lockerNo = Number(new URLSearchParams(location.search).get('locker'));
const form = document.querySelector('#form');
const unlocked = document.querySelector('#unlocked');
const error = document.querySelector('#error');
const ownerLine = document.querySelector('#owner-line');
const title = document.querySelector('#title');
const photo = document.querySelector('#photo');
const preview = document.querySelector('#preview');
const submit = document.querySelector('#submit');
const closeDoor = document.querySelector('#close-door');

let parcelId = '';

registerWorker().catch(() => {});

photo.addEventListener('change', () => {
  const file = photo.files && photo.files[0];
  if (!file) {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
});

function showUnlocked(id) {
  parcelId = id;
  form.classList.add('hidden');
  unlocked.classList.remove('hidden');
}

async function loadLocker() {
  if (!Number.isInteger(lockerNo) || lockerNo < 1 || lockerNo > 99) {
    title.textContent = 'Locker not found';
    ownerLine.textContent = 'This QR code is not a locker.';
    showBanner(error, 'This QR code is not a locker.', 'bad');
    submit.disabled = true;
    return;
  }
  title.textContent = `Locker ${String(lockerNo).padStart(2, '0')}`;
  const snap = await withTimeout(getDoc(doc(db, 'lockers', String(lockerNo))));
  if (!snap.exists()) {
    showBanner(error, 'This locker is not set up yet. An admin needs to open Parcelink once.', 'bad');
    submit.disabled = true;
    return;
  }
  const locker = snap.data();
  if (!locker.ownerEmpId) {
    ownerLine.textContent = 'This locker has no owner yet.';
    showBanner(error, 'Ask an admin to assign this locker before a delivery.', 'bad');
    submit.disabled = true;
    return;
  }
  const person = await withTimeout(getDoc(doc(db, 'employees', locker.ownerEmpId)));
  const data = person.data() || {};
  ownerLine.textContent = `${data.name || locker.ownerEmpId} · ${data.department || ''}`.replace(/ · $/, '');
  if (locker.status === 'unlocked' && locker.activeParcelId) {
    showUnlocked(locker.activeParcelId);
    return;
  }
  if (locker.status !== 'empty') {
    showBanner(error, 'This locker already has a parcel.', 'bad');
    submit.disabled = true;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showBanner(error, '');
  const company = form.courierCompany.value.trim();
  const reference = form.reference.value.trim();
  const file = photo.files && photo.files[0];
  if (!company) {
    showBanner(error, 'Enter the courier company.', 'bad');
    return;
  }
  if (!file) {
    showBanner(error, 'Add a photo of the parcel.', 'bad');
    return;
  }
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    showBanner(error, 'Use a photo under 5 MB.', 'bad');
    return;
  }
  submit.disabled = true;
  try {
    const photoUrl = await uploadPhoto(file);
    const live = await import('./firebase.js');
    const lockerRef = live.doc(live.db, 'lockers', String(lockerNo));
    const createdId = await withTimeout(live.runTransaction(live.db, async (tx) => {
      const lockerSnap = await tx.get(lockerRef);
      const locker = lockerSnap.data();
      if (!locker || locker.status !== 'empty' || !locker.ownerEmpId) {
        throw new Error('This locker is not ready for a delivery.');
      }
      const person = await tx.get(live.doc(live.db, 'employees', locker.ownerEmpId));
      const employee = person.data() || {};
      const parcelRef = live.doc(live.db, 'parcels', `P-${Date.now()}`);
      tx.set(parcelRef, {
        lockerNo,
        empId: locker.ownerEmpId,
        ownerName: employee.name || locker.ownerEmpId,
        department: employee.department || '',
        courierCompany: company.slice(0, 80),
        reference: reference.slice(0, 80),
        photoUrl,
        status: 'unlocked',
        createdAt: live.serverTimestamp(),
        siteOrigin: siteRoot().href,
      });
      tx.update(lockerRef, { status: 'unlocked', activeParcelId: parcelRef.id });
      return parcelRef.id;
    }), 12000);
    showUnlocked(createdId);
  } catch (err) {
    showBanner(error, explain(err), 'bad');
    submit.disabled = false;
  }
});

closeDoor.addEventListener('click', async () => {
  if (!parcelId) return;
  closeDoor.disabled = true;
  try {
    const live = await import('./firebase.js');
    await withTimeout(live.runTransaction(live.db, async (tx) => {
      const lockerRef = live.doc(live.db, 'lockers', String(lockerNo));
      const parcelRef = live.doc(live.db, 'parcels', parcelId);
      const lockerSnap = await tx.get(lockerRef);
      const parcelSnap = await tx.get(parcelRef);
      if (!lockerSnap.exists() || lockerSnap.data().activeParcelId !== parcelId || parcelSnap.data()?.status !== 'unlocked') {
        throw new Error('This delivery is no longer waiting to be closed.');
      }
      tx.update(parcelRef, { status: 'stored', storedAt: live.serverTimestamp() });
      tx.update(lockerRef, { status: 'occupied' });
    }));
    unlocked.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = 'Door closed';
    const copy = document.createElement('p');
    copy.textContent = 'The parcel is in the locker. The owner has been told.';
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = pageUrl('index.html');
    link.textContent = 'Done';
    unlocked.append(heading, copy, link);
  } catch (err) {
    showBanner(error, explain(err), 'bad');
    closeDoor.disabled = false;
  }
});

loadLocker().catch((err) => {
  ownerLine.textContent = 'This locker could not be loaded.';
  showBanner(error, explain(err), 'bad');
  submit.disabled = true;
});
