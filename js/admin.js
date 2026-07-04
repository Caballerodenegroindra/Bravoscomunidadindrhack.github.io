/* ============================================================
   ACADEMIA INDRHACK — Lógica del panel administrador
   ============================================================
   Nota importante:
   Eliminar una cuenta de Firebase Authentication desde el
   navegador solo es posible para el propio usuario autenticado.
   Para que el botón "ELIMINAR" borre también la cuenta de
   Authentication (no solo el documento de Firestore), se
   recomienda una Cloud Function con privilegios de administrador.
   Aquí se elimina el documento de Firestore y se marca la cuenta
   como "rechazado" para bloquear el acceso mientras se completa
   la limpieza.
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ESTADOS } from './auth.js';
import { crearNotificacion, TIPOS_NOTIF } from './notificaciones.js';

/**
 * Obtiene todos los usuarios ordenados por fecha de ingreso.
 */
export async function fetchAllUsers() {
  const q = query(collection(db, 'users'), orderBy('fechaIngreso', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function fetchPendingRequests() {
  const users = await fetchAllUsers();
  return users.filter((u) => u.estado === ESTADOS.PENDIENTE);
}

export function setUserState(uid, estado) {
  return updateDoc(doc(db, 'users', uid), { estado });
}

export async function approveUser(uid) {
  await setUserState(uid, ESTADOS.APROBADO);
  await crearNotificacion({
    uid,
    tipo: TIPOS_NOTIF.CUENTA_APROBADA,
    titulo: '¡Tu cuenta fue aprobada! 🎉',
    mensaje: 'Ya podés entrar a la Academia y empezar con los cursos.',
    link: 'panel-usuario.html',
  });
}

export async function rejectUser(uid) {
  await setUserState(uid, ESTADOS.RECHAZADO);
  await crearNotificacion({
    uid,
    tipo: TIPOS_NOTIF.CUENTA_RECHAZADA,
    titulo: 'Tu solicitud de cuenta fue rechazada',
    mensaje: 'Contactá a un administrador si creés que es un error.',
  });
}

export function suspendUser(uid) {
  return setUserState(uid, ESTADOS.SUSPENDIDO);
}

export function setUserRole(uid, rol) {
  return updateDoc(doc(db, 'users', uid), { rol });
}

export function setUserRango(uid, rango) {
  return updateDoc(doc(db, 'users', uid), { rango });
}

/**
 * Elimina el documento de perfil del usuario en Firestore.
 * La cuenta de Authentication debe eliminarse desde una
 * Cloud Function o la consola de Firebase.
 */
export function deleteUserProfile(uid) {
  return deleteDoc(doc(db, 'users', uid));
}

/* ------------------------------------------------------------
   Cursos (colección "courses")
   ------------------------------------------------------------ */
export async function fetchAllCourses() {
  const snap = await getDocs(collection(db, 'courses'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function formatFecha(timestamp) {
  if (!timestamp?.toDate) return '—';
  return timestamp.toDate().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
