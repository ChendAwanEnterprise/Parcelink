import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { config } from './common.js';

const app = initializeApp(config.firebaseConfig, 'parcelink-live');
export const db = getFirestore(app);
export { doc, runTransaction, serverTimestamp };
