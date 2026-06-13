/* ============================================================
   ACADEMIA INDRHACK — Script compartido de navegación
   Controla el menú móvil y muestra el estado de sesión
   (entrar / mi panel / cerrar sesión) en la barra superior.
   ============================================================ */

import { onSessionChange, logoutUser, ROLES } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  // Menú móvil
  const toggle = document.querySelector('.navbar__toggle');
  const links = document.querySelector('.navbar__links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }

  // Estado de sesión en la barra superior
  const sessionSlot = document.querySelector('[data-session-slot]');
  if (!sessionSlot) return;

  onSessionChange((profile) => {
    if (!profile) {
      sessionSlot.innerHTML = `
        <a href="login.html" class="btn btn--ghost">Iniciar sesión</a>
        <a href="registro.html" class="btn btn--small btn--outline">Registrarte</a>
      `;
      return;
    }

    const panelUrl = profile.rol === ROLES.ADMINISTRADOR ? 'panel-admin.html' : 'panel-usuario.html';

    sessionSlot.innerHTML = `
      <a href="${panelUrl}" class="btn btn--ghost">Mi panel</a>
      <a href="perfil.html" class="btn btn--ghost">${profile.displayName || profile.username}</a>
      <button class="btn btn--small btn--outline" data-logout>Cerrar sesión</button>
    `;

    const logoutBtn = sessionSlot.querySelector('[data-logout]');
    logoutBtn.addEventListener('click', async () => {
      await logoutUser();
      window.location.href = 'index.html';
    });
  });
});
