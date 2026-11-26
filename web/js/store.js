import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore-lite.js';
import { config } from './common.js';

export const app = initializeApp(config.firebaseConfig);
export const db = getFirestore(app);
export {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
};
