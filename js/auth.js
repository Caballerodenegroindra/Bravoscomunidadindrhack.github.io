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
  sendPasswordResetEmail,
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
 * Verifica si un nombre de usuario ya existe, consultando la colección
 * pública "usernames" (solo contiene el nombre reservado, sin datos
 * personales) en vez de la colección "users" (que sí tiene email/teléfono
 * y ahora requiere estar aprobado para leerse).
 */
export async function isUsernameTaken(username) {
  const normalizedUsername = username.trim().toLowerCase();
  const snap = await getDoc(doc(db, 'usernames', normalizedUsername));
  return snap.exists();
}

/**
 * Crea una solicitud de cuenta nueva con estado "pendiente".
 * No inicia sesión: la cuenta debe ser aprobada por un administrador.
 * Usa el correo real del usuario como email de autenticación, para
 * que la recuperación de contraseña funcione de verdad.
 */
export async function registerUser({ phone, username, password, email, tiposParticipante, habilidades, motivoParticipacion }) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  if (await isUsernameTaken(normalizedUsername)) {
    throw new Error('El nombre de usuario ya está en uso.');
  }

  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

  // Normaliza a un array válido: ['aprendiz'], ['colaborador'], o ambos.
  const tipos = Array.isArray(tiposParticipante) && tiposParticipante.length
    ? tiposParticipante.filter((t) => t === 'aprendiz' || t === 'colaborador')
    : ['aprendiz'];

  try {
    await setDoc(doc(db, 'users', credential.user.uid), {
      username: normalizedUsername,
      displayName: username.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      rol: ROLES.USUARIO,
      estado: ESTADOS.PENDIENTE,
      fechaIngreso: serverTimestamp(),
      photoURL: '',
      enGrupo: false,
      // Cómo eligió participar al registrarse: chat general ('aprendiz'),
      // equipo de desarrollo ('colaborador'), o ambos a la vez.
      tiposParticipante: tipos,
      // Solo tiene sentido si eligió 'colaborador': en qué se identifica
      // (programador, técnico, diseño, etc.) — visible en su perfil.
      habilidades: Array.isArray(habilidades) ? habilidades : [],
      // Por qué quiere participar (lo cuenta al registrarse).
      motivoParticipacion: (motivoParticipacion || '').trim(),
      nivelProgramacion: '',
      onboardingExtra: false,
      ayudaFuturosProyectos: '',
      sobreMi: '',
      loQueSe: '',
      experiencia: '',
      intereses: '',
      aprendizaje: '',
      objetivo: '',
      compartir: '',
      estilo: '',
      extra: '',
    });
    // Reserva el nombre de usuario en la colección pública (sin datos
    // personales sensibles como teléfono) para poder validar unicidad
    // y resolver el login sin exponer perfiles completos.
    await setDoc(doc(db, 'usernames', normalizedUsername), {
      uid: credential.user.uid,
      email: normalizedEmail,
    });
  } catch (firestoreError) {
    await credential.user.delete();
    throw new Error('Error al guardar el perfil: ' + firestoreError.message);
  }

  await signOut(auth);
  return normalizedUsername;
}

/**
 * Busca el email real de Authentication a partir del username,
 * usando la colección pública "usernames" (no requiere estar
 * autenticado, a diferencia de consultar "users" directamente).
 */
async function getEmailByUsername(username) {
  const normalizedUsername = username.trim().toLowerCase();
  const snap = await getDoc(doc(db, 'usernames', normalizedUsername));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.email || usernameToEmail(username);
}

/**
 * Inicia sesión validando que la cuenta esté aprobada.
 * Lanza un error con mensaje legible si la cuenta no existe,
 * está pendiente, suspendida o rechazada.
 */
export async function loginUser({ username, password }) {
  const email = await getEmailByUsername(username);

  if (!email) {
    throw new Error('No se encontró ninguna cuenta con ese nombre de usuario.');
  }

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
 * Envía un correo de restablecimiento de contraseña a partir del
 * nombre de usuario. Busca el email real asociado y usa el flujo
 * estándar de Firebase.
 */
export async function requestPasswordReset(username) {
  const email = await getEmailByUsername(username);
  if (!email) {
    throw new Error('No se encontró ninguna cuenta con ese nombre de usuario.');
  }
  await sendPasswordResetEmail(auth, email);
  return email;
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
        // --- DIAGNÓSTICO TEMPORAL ---
        // Muestra por qué te está echando del panel admin. Borrar
        // este alert() una vez resuelto el problema.
        alert(
          'DIAGNÓSTICO PANEL ADMIN\n' +
          'perfil encontrado: ' + (profile ? 'sí' : 'NO (no hay sesión o no existe el documento en Firestore)') + '\n' +
          (profile ? 'estado: ' + profile.estado + ' (debe ser "aprobado")\n' : '') +
          (profile ? 'rol: ' + profile.rol + ' (debe ser "administrador")\n' : '') +
          'origen actual: ' + window.location.origin + window.location.pathname
        );
        // --- FIN DIAGNÓSTICO ---
        window.location.href = redirectTo;
        resolve(null);
        return;
      }
      resolve(profile);
    });
  });
}
