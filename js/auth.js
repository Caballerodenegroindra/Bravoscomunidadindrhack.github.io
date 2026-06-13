/* ============================================================
   ACADEMIA INDRHACK — Autenticación y sistema de aprobación
   ============================================================
   Reglas del proyecto:
   - El registro NO activa la cuenta automáticamente.
   - Toda cuenta nueva queda con estado "pendiente".
   - Solo cuentas con estado "aprobado" pueden iniciar sesión.
   - El primer usuario administrador debe crearse manualmente
     en la consola de Firebase (Authentication + Firestore),
     asignando rol: "administrador" y estado: "aprobado".
   ============================================================ */

import { auth, db, usernameToEmail } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  query,
  where,
  collection,
  getDocs,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const ESTADOS = {
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  SUSPENDIDO: 'suspendido',
  RECHAZADO: 'rechazado',
};

export const ROLES = {
  USUARIO: 'usuario',
  ADMINISTRADOR: 'administrador',
};

/**
 * Verifica si un nombre de usuario ya existe en la colección "users".
 */
export async function isUsernameTaken(username) {
  const q = query(
    collection(db, 'users'),
    where('username', '==', username.trim().toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Crea una solicitud de cuenta nueva con estado "pendiente".
 * No inicia sesión: la cuenta debe ser aprobada por un administrador.
 */
export async function registerUser({ phone, username, password }) {
  const normalizedUsername = username.trim().toLowerCase();

  if (await isUsernameTaken(normalizedUsername)) {
    throw new Error('El nombre de usuario ya está en uso.');
  }

  const email = usernameToEmail(normalizedUsername);
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, 'users', credential.user.uid), {
    username: normalizedUsername,
    displayName: username.trim(),
    phone: phone.trim(),
    rol: ROLES.USUARIO,
    estado: ESTADOS.PENDIENTE,
    fechaIngreso: serverTimestamp(),
    photoURL: '',
    motivaciones: '',
    gustos: '',
  });

  // La cuenta queda pendiente: se cierra sesión hasta la aprobación.
  await signOut(auth);

  return normalizedUsername;
}

/**
 * Inicia sesión validando que la cuenta esté aprobada.
 * Lanza un error con mensaje legible si la cuenta no existe,
 * está pendiente, suspendida o rechazada.
 */
export async function loginUser({ username, password }) {
  const email = usernameToEmail(username);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user.uid);

  if (!profile) {
    await signOut(auth);
    throw new Error('No se encontró el perfil de la cuenta.');
  }

  if (profile.estado === ESTADOS.PENDIENTE) {
    await signOut(auth);
    throw new Error('Tu cuenta aún no fue aprobada.');
  }

  if (profile.estado === ESTADOS.SUSPENDIDO) {
    await signOut(auth);
    throw new Error('Tu cuenta está suspendida.');
  }

  if (profile.estado === ESTADOS.RECHAZADO) {
    await signOut(auth);
    throw new Error('Tu solicitud fue rechazada.');
  }

  return profile;
}

export function logoutUser() {
  return signOut(auth);
}

/**
 * Obtiene el documento de perfil de un usuario por su UID.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * Suscribe un callback al estado de sesión, entregando también
 * el perfil de Firestore (o null si no hay sesión).
 */
export function onSessionChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    const profile = await getUserProfile(user.uid);
    callback(profile);
  });
}

/**
 * Protege una página que requiere un usuario aprobado.
 * Redirige a "login.html" si no hay sesión, la cuenta no está
 * aprobada o no existe el perfil.
 */
export function requireApprovedUser(redirectTo = 'login.html') {
  return new Promise((resolve) => {
    onSessionChange((profile) => {
      if (!profile || profile.estado !== ESTADOS.APROBADO) {
        window.location.href = redirectTo;
        resolve(null);
        return;
      }
      resolve(profile);
    });
  });
}

/**
 * Protege una página exclusiva del administrador.
 * Redirige a "index.html" si el rol no es "administrador".
 */
export function requireAdmin(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    onSessionChange((profile) => {
      if (!profile || profile.estado !== ESTADOS.APROBADO || profile.rol !== ROLES.ADMINISTRADOR) {
        window.location.href = redirectTo;
        resolve(null);
        return;
      }
      resolve(profile);
    });
  });
}
