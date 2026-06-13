/* ============================================================
   ACADEMIA INDRHACK — Configuración de Firebase
   ============================================================
   1. Crea un proyecto en https://console.firebase.google.com
   2. Activa Authentication (correo/contraseña), Firestore y Storage.
   3. Copia tu configuración (Project settings > General > SDK setup)
      y reemplaza los valores de ejemplo en FIREBASE_CONFIG.
   4. No subas claves privadas del servidor a este archivo: las
      claves de un proyecto web de Firebase son públicas por diseño,
      pero la seguridad real se controla con las Reglas de
      Seguridad de Firestore/Storage (ver README.md).
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAY38VZi8Yi0KDLMwV1Xi92hE9tt0rrMV0',
  authDomain: 'academia-indrhack.firebaseapp.com',
  projectId: 'academia-indrhack',
  storageBucket: 'academia-indrhack.firebasestorage.app',
  messagingSenderId: '253533392968',
  appId: '1:253533392968:web:ee6a4057d19e492bdd887d',
  measurementId: 'G-2VEBXR6Z29',
};

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* Dominio interno usado para convertir el "usuario" elegido por la
   persona en un correo válido para Firebase Authentication, ya que
   el sistema de inicio de sesión solo pide usuario y contraseña. */
export const AUTH_DOMAIN_SUFFIX = '@indrhack.local';

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}${AUTH_DOMAIN_SUFFIX}`;
}
