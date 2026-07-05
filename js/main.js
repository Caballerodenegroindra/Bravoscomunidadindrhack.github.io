/* ============================================================
   ACADEMIA INDRHACK — Script compartido de navegación
   Controla el menú móvil, muestra estado de sesión,
   y registra presencia (online / lastSeen) en Firestore.
   ============================================================ */

import { onSessionChange, logoutUser, ROLES } from './auth.js';
import { db } from './firebase-config.js';
import {
  doc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ── PRESENCIA ──────────────────────────────────────────────
   Cuando el usuario está autenticado:
   - Marca isOnline: true + lastSeen: now al entrar
   - Marca isOnline: false + lastSeen: now al cerrar/salir
   ──────────────────────────────────────────────────────────*/
let _presenceUid = null;

async function setPresence(uid, online) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      isOnline: online,
      lastSeen: serverTimestamp(),
    });
  } catch (_) { /* silencioso — no bloquear la página */ }
}

function initPresence(uid) {
  if (_presenceUid === uid) return; // ya inicializado para este uid
  _presenceUid = uid;

  setPresence(uid, true);

  // Antes de cerrar la pestaña / navegar fuera
  window.addEventListener('beforeunload', () => setPresence(uid, false));

  // Visibilidad de la pestaña (minimizar, cambiar de app)
  document.addEventListener('visibilitychange', () => {
    setPresence(uid, document.visibilityState === 'visible');
  });

  // "Latido": en móviles, cerrar la app o que el sistema la mate en
  // segundo plano no siempre dispara beforeunload/visibilitychange,
  // así que el flag isOnline puede quedar "pegado" en true para siempre.
  // Este intervalo refresca lastSeen cada 60s SOLO si la app sigue
  // realmente visible, para que el panel de admin pueda detectar
  // cuándo un isOnline:true está desactualizado y ya no es real.
  setInterval(() => {
    if (document.visibilityState === 'visible' && _presenceUid === uid) {
      setPresence(uid, true);
    }
  }, 60000);
}

document.addEventListener('DOMContentLoaded', () => {
  // ── Menú móvil ──
  const toggle = document.querySelector('.navbar__toggle');
  const links  = document.querySelector('.navbar__links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // ── Estado de sesión en barra superior ──
  const sessionSlot = document.querySelector('[data-session-slot]');

  onSessionChange((profile) => {
    if (!profile) {
      if (_presenceUid) {
        setPresence(_presenceUid, false);
        _presenceUid = null;
      }
      if (sessionSlot) {
        sessionSlot.innerHTML = `
          <a href="login.html" class="btn btn--ghost">Iniciar sesión</a>
          <a href="registro.html" class="btn btn--small btn--outline">Registrarte</a>
        `;
      }
      return;
    }

    // Registrar presencia
    initPresence(profile.uid);

    if (!sessionSlot) return;

    const panelUrl = profile.rol === ROLES.ADMINISTRADOR ? 'panel-admin.html' : 'panel-usuario.html';

    sessionSlot.innerHTML = `
      <a href="${panelUrl}" class="btn btn--ghost">Mi panel</a>
      <a href="perfil.html" class="btn btn--ghost">${profile.displayName || profile.username}</a>
      <button class="btn btn--small btn--outline" data-logout>Cerrar sesión</button>
    `;

    const logoutBtn = sessionSlot.querySelector('[data-logout]');
    logoutBtn.addEventListener('click', async () => {
      await setPresence(profile.uid, false);
      await logoutUser();
      window.location.href = 'index.html';
    });
  });
});
