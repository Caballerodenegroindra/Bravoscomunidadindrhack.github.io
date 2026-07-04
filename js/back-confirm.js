/* ============================================================
   ACADEMIA INDRHACK — Confirmar salida al tocar "Atrás"
   ============================================================
   Problema que resuelve: en el celular, al usar el botón/gesto
   "Atrás" del sistema estando en una pantalla "principal" de la
   app (sin historial propio para volver atrás), el navegador
   termina cerrando la pestaña o saliendo de la app sin avisar.

   Solución: apenas carga la página, se agrega una entrada extra
   al historial (history.pushState). La PRIMERA vez que el usuario
   toca "Atrás", en vez de salir, se dispara ese "pop" que nosotros
   interceptamos y mostramos un cartel de confirmación
   ("¿Querés salir de la app?"). Si dice que no, se vuelve a dejar
   la entrada en el historial para poder repetir el proceso. Si
   dice que sí, se deja que el siguiente "Atrás" (o el mismo botón
   "Salir" del cartel) cierre la app normalmente.

   Nota: esto es un comportamiento típico de apps (Android/PWA) y
   funciona en el navegador y en apps instaladas como PWA/TWA. No
   hace falta tocar nada más para usarlo: basta con incluir este
   script en la página.
   ============================================================ */

(function () {
  // No mostrar esto en páginas de login/registro: ahí "atrás" debe
  // funcionar normal (por ejemplo, para volver del registro al login).
  const paginasExcluidas = ['login.html', 'registro.html', 'index.html'];
  const pagina = window.location.pathname.split('/').pop() || 'index.html';
  if (paginasExcluidas.includes(pagina)) return;

  let mostrandoCartel = false;
  let confirmadoParaSalir = false;

  function pushGuardState() {
    history.pushState({ indrhackGuard: true }, '', window.location.href);
  }

  // Entrada "colchón" en el historial.
  pushGuardState();

  function mostrarCartelSalida() {
    if (mostrandoCartel) return;
    mostrandoCartel = true;

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.72);
      z-index:99999; display:flex; align-items:center; justify-content:center;
      padding:1.25rem; animation:indrhack-fade .15s ease;
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg-elevated, #12121c); border:1px solid var(--border, #262636);
                  border-radius:14px; padding:1.5rem; max-width:320px; width:100%;
                  text-align:center; font-family:inherit; box-shadow:0 10px 40px rgba(0,0,0,0.5)">
        <div style="font-size:2rem; margin-bottom:0.5rem">👋</div>
        <h3 style="margin:0 0 0.4rem; color:var(--text,#eee); font-size:1.05rem">¿Querés salir de la app?</h3>
        <p style="margin:0 0 1.25rem; color:var(--text-muted,#999); font-size:0.85rem">
          Vas a cerrar Academia Indrhack.
        </p>
        <div style="display:flex; gap:0.6rem">
          <button id="indrhack-exit-no" style="flex:1; padding:0.65rem; border-radius:8px; border:1px solid var(--border,#333);
                  background:transparent; color:var(--text,#eee); font-size:0.9rem; cursor:pointer">
            No
          </button>
          <button id="indrhack-exit-yes" style="flex:1; padding:0.65rem; border-radius:8px; border:none;
                  background:var(--color-danger-fg,#ff3b3b); color:#fff; font-weight:600; font-size:0.9rem; cursor:pointer">
            Sí, salir
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cerrarCartel = () => {
      overlay.remove();
      mostrandoCartel = false;
    };

    overlay.querySelector('#indrhack-exit-no').addEventListener('click', () => {
      cerrarCartel();
      pushGuardState(); // reponer el "colchón" para la próxima vez
    });

    overlay.querySelector('#indrhack-exit-yes').addEventListener('click', () => {
      confirmadoParaSalir = true;
      cerrarCartel();
      // Intenta cerrar la pestaña/app; si el navegador no lo permite
      // (por seguridad, en pestañas no abiertas por script), se
      // retrocede dos veces para salir del "colchón" del historial.
      window.close();
      setTimeout(() => {
        history.go(-2);
      }, 50);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cerrarCartel();
        pushGuardState();
      }
    });
  }

  window.addEventListener('popstate', (e) => {
    if (confirmadoParaSalir) return;
    mostrarCartelSalida();
  });
})();
