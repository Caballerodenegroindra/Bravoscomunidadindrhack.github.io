/* ============================================================
   ACADEMIA INDRHACK — Sistema de notificaciones
   ============================================================
   Colección Firestore: "notificaciones"
   Documento: {
     uid: string,        // dueño de la notificación
     tipo: string,       // ver TIPOS_NOTIF
     titulo: string,
     mensaje: string,
     link: string,       // página a la que lleva al tocarla (opcional)
     leida: boolean,
     fecha: Timestamp,
   }

   "Afuera de la app": este módulo usa la Notification API del
   navegador (new Notification(...)). Eso muestra un aviso nativo
   del sistema operativo (Android/desktop) mientras el sitio o la
   app instalada (PWA) está abierta, aunque esté en segundo plano
   o en otra pestaña. Para recibir avisos con la app TOTALMENTE
   cerrada hace falta Firebase Cloud Messaging + una Cloud Function
   (requiere plan Blaze de Firebase), que no está incluido acá.
   Si más adelante lo necesitás, este archivo es el lugar para
   agregarlo sin tocar el resto de la app.
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const TIPOS_NOTIF = {
  QUIZ_APROBADO: 'quiz_aprobado',
  QUIZ_RECHAZADO: 'quiz_rechazado',
  CUENTA_APROBADA: 'cuenta_aprobada',
  CUENTA_RECHAZADA: 'cuenta_rechazada',
  PROYECTO_APROBADO: 'proyecto_aprobado',
  CURSO_APROBADO: 'curso_aprobado',
  RANGO: 'rango',
  SISTEMA: 'sistema',
};

const ICONOS = {
  quiz_aprobado: '✅',
  quiz_rechazado: '❌',
  cuenta_aprobada: '🎉',
  cuenta_rechazada: '⚠️',
  proyecto_aprobado: '🏆',
  curso_aprobado: '📘',
  rango: '⭐',
  sistema: '🔔',
};

export function iconoNotificacion(tipo) {
  return ICONOS[tipo] || '🔔';
}

/**
 * Crea una notificación para un usuario. Se puede llamar desde
 * cualquier parte de la app (panel-admin, auth, etc).
 * Ejemplo:
 *   await crearNotificacion({
 *     uid, tipo: TIPOS_NOTIF.QUIZ_APROBADO,
 *     titulo: '¡Quiz aprobado!',
 *     mensaje: 'Aprobaste el quiz de "Redes I" y ganaste 10 puntos.',
 *     link: 'ficha.html',
 *   });
 */
export async function crearNotificacion({ uid, tipo = TIPOS_NOTIF.SISTEMA, titulo, mensaje, link = '' }) {
  if (!uid || !titulo) return null;
  return addDoc(collection(db, 'notificaciones'), {
    uid,
    tipo,
    titulo,
    mensaje: mensaje || '',
    link,
    leida: false,
    fecha: Timestamp.now(),
  });
}

/**
 * Se suscribe en tiempo real a las notificaciones de un usuario.
 * Devuelve la función para cancelar la suscripción (unsubscribe).
 */
export function escucharNotificaciones(uid, callback, max = 40) {
  if (!uid) return () => {};
  const q = query(
    collection(db, 'notificaciones'),
    where('uid', '==', uid),
    orderBy('fecha', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.slice(0, max).map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (err) => {
    console.error('Error escuchando notificaciones:', err);
    callback([]);
  });
}

export async function marcarLeida(id) {
  return updateDoc(doc(db, 'notificaciones', id), { leida: true });
}

export async function marcarTodasLeidas(uid) {
  if (!uid) return;
  const snap = await getDocs(query(
    collection(db, 'notificaciones'),
    where('uid', '==', uid),
    where('leida', '==', false)
  ));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { leida: true }));
  await batch.commit();
}

export async function eliminarNotificacion(id) {
  return deleteDoc(doc(db, 'notificaciones', id));
}

export async function eliminarTodasLasNotificaciones(uid) {
  if (!uid) return;
  const snap = await getDocs(query(collection(db, 'notificaciones'), where('uid', '==', uid)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/**
 * Pide permiso al navegador para mostrar notificaciones del sistema.
 * Hay que llamarla dentro de una interacción del usuario en algunos
 * navegadores (por eso también se intenta apenas hay sesión activa).
 */
export async function pedirPermisoNotificaciones() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return 'denied';
  }
}

/**
 * Muestra una notificación nativa del sistema operativo (fuera de la
 * página/app). Requiere permiso concedido previamente.
 */
export function mostrarNotificacionNavegador(titulo, opciones = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(titulo, {
      icon: 'assets/img/logo-indrhack.png',
      badge: 'assets/img/logo-indrhack.png',
      ...opciones,
    });
    notif.onclick = () => {
      window.focus();
      if (opciones.link) window.location.href = opciones.link;
      notif.close();
    };
  } catch (e) {
    // Algunos navegadores móviles exigen un Service Worker para esto;
    // si falla, simplemente no se muestra el aviso nativo (la campanita
    // dentro de la app sigue funcionando igual).
  }
}
