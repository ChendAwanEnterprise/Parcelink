import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getMessaging, getToken, isSupported, onMessage } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging.js';
import { config } from './common.js';

const app = initializeApp(config.firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
};

export async function messagingApp() {
  if (!await isSupported()) return null;
  return getMessaging(app);
}

export { getToken, onMessage };

export const EMPLOYEES = [
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

export async function uploadPhoto(file) {
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', config.uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || 'The photo could not be uploaded.');
  }
  return payload.secure_url;
}
