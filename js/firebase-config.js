import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAY38VZi8Yi0KDLMwV1Xi92hE9tt0rrMV0',
  authDomain: 'academia-indrhack.firebaseapp.com',
  projectId: 'academia-indrhack',
  messagingSenderId: '253533392968',
  appId: '1:253533392968:web:ee6a4057d19e492bdd887d',
};

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const AUTH_DOMAIN_SUFFIX = '@indrhack.local';

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}${AUTH_DOMAIN_SUFFIX}`;
}
