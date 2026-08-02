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
import './scroll-progress.js';

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
  // ── Menú móvil (panel lateral izquierdo, tipo "ajustes") ──
  const toggle = document.querySelector('.navbar__toggle');
  const links  = document.querySelector('.navbar__links');
  if (toggle && links) {
    // Fondo oscurecido detrás del panel: se crea una sola vez por página.
    let backdrop = document.querySelector('[data-nav-backdrop]');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'nav-backdrop';
      backdrop.setAttribute('data-nav-backdrop', '');
      document.body.appendChild(backdrop);
    }

    const abrirMenu = () => {
      links.classList.add('open');
      backdrop.classList.add('open');
      document.body.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
    };
    const cerrarMenu = () => {
      links.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      links.classList.contains('open') ? cerrarMenu() : abrirMenu();
    });
    // Tocar el fondo oscurecido cierra el panel.
    backdrop.addEventListener('click', cerrarMenu);
    // Tecla Esc cierra el panel (accesibilidad / teclado).
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('open')) cerrarMenu();
    });
    // Si se toca un link del menú (navega a otra página), cerramos
    // para no dejar el scroll bloqueado ni el fondo tapando la página.
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) cerrarMenu();
    });

    // Gesto: deslizar el dedo de derecha a izquierda sobre el panel
    // lo cierra, igual que un panel lateral nativo de una app móvil.
    let touchStartX = 0, touchStartY = 0, touchTracking = false;
    links.addEventListener('touchstart', (e) => {
      if (!links.classList.contains('open')) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });
    links.addEventListener('touchend', (e) => {
      if (!touchTracking) return;
      touchTracking = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Deslizamiento predominantemente horizontal, hacia la izquierda,
      // de al menos 60px: se interpreta como "cerrar panel".
      if (dx < -60 && Math.abs(dx) > Math.abs(dy)) cerrarMenu();
    }, { passive: true });
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
