/* ============================================================
   ACADEMIA INDRHACK — Campanita de notificaciones (global)
   ============================================================
   Se incluye en todas las páginas internas de la app. Se encarga de:
   1. Escuchar la sesión activa.
   2. Pedir permiso de notificaciones del navegador (una sola vez).
   3. Actualizar el puntito rojo / contador en cualquier elemento
      con [data-notif-dot] o [data-notif-count] (tabbar y navbar).
   4. Disparar una notificación nativa del sistema cuando llega un
      aviso nuevo (por ejemplo: "Quiz aprobado").
   ============================================================ */

import { onSessionChange } from './auth.js';
import {
  escucharNotificaciones,
  pedirPermisoNotificaciones,
  mostrarNotificacionNavegador,
} from './notificaciones.js';

let vistos = new Set();
let primeraCarga = true;

onSessionChange((profile) => {
  if (!profile) return;

  // Pedir permiso de notificaciones del navegador/SO (no bloquea si ya se decidió antes)
  pedirPermisoNotificaciones();

  escucharNotificaciones(profile.uid, (items) => {
    const noLeidas = items.filter((n) => !n.leida);

    document.querySelectorAll('[data-notif-dot]').forEach((dot) => {
      dot.style.display = noLeidas.length ? 'block' : 'none';
    });
    document.querySelectorAll('[data-notif-count]').forEach((el) => {
      el.textContent = noLeidas.length > 9 ? '9+' : String(noLeidas.length);
      el.style.display = noLeidas.length ? 'inline-flex' : 'none';
    });

    if (primeraCarga) {
      // En la primera carga no queremos "spamear" con todo el historial,
      // solo dejamos registrado lo que ya existía.
      primeraCarga = false;
      items.forEach((n) => vistos.add(n.id));
      return;
    }

    items.forEach((n) => {
      if (!vistos.has(n.id)) {
        vistos.add(n.id);
        if (!n.leida) {
          mostrarNotificacionNavegador(n.titulo, { body: n.mensaje, tag: n.id, link: n.link });
        }
      }
    });
  });
});
