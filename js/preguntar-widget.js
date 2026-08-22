/* ============================================================
   ACADEMIA INDRA — "Preguntar": IA o WhatsApp de la comunidad
   ============================================================
   Reemplaza a la vieja sección de chat interno de la página
   (chat.html / burbuja flotante de chat). Ahora, para resolver
   dudas de los cursos, hay dos caminos:

   1) Preguntarle a la IA (ia-asistente.html) — siempre disponible,
      esté o no la cuenta registrada/aceptada.
   2) Preguntar esa misma duda en el chat general de la comunidad,
      que vive en WhatsApp — solo para cuentas registradas y
      aceptadas por un administrador. Si todavía no lo está, se
      muestra un aviso invitando a registrarse (y mientras tanto,
      puede seguir usando la IA).
   ============================================================ */

import { onSessionChange, ESTADOS } from './auth.js';
import { cargarConfigSitio } from './ia-core.js';

// Se suscribe una sola vez por carga de página y guarda el último
// perfil conocido, para no tener que esperar a Firebase cada vez
// que se pide renderizar las opciones en distintos lugares.
let _perfil = undefined; // undefined: todavía no se sabe: null: sin sesión
let _resolverPrimeraSesion;
const _primeraSesion = new Promise((res) => { _resolverPrimeraSesion = res; });

onSessionChange((profile) => {
  _perfil = profile || null;
  if (_resolverPrimeraSesion) { _resolverPrimeraSesion(); _resolverPrimeraSesion = null; }
});

/** true solo si hay una cuenta registrada y aceptada (aprobada) por un admin. */
export async function estaAprobado() {
  if (_perfil === undefined) await _primeraSesion;
  return !!(_perfil && _perfil.estado === ESTADOS.APROBADO);
}

/**
 * Arma el HTML de las dos opciones ("Preguntarle a la IA" /
 * "Preguntar en el chat de WhatsApp"), listo para insertar en
 * cualquier página. `contexto` permite pasarle a la IA (y a la
 * pregunta que se copia para WhatsApp) sobre qué curso se está
 * preguntando.
 */
async function renderBotonWhatsApp(pregunta) {
  const [config, aprobado] = await Promise.all([cargarConfigSitio(), estaAprobado()]);
  const linkGrupo = config.whatsappGrupo || '';
  const preguntaAttr = pregunta ? ` data-pregunta-copiar="${encodeURIComponent(pregunta)}"` : '';

  if (aprobado && linkGrupo) {
    return `<a href="${linkGrupo}" data-wa-picker${preguntaAttr} class="btn btn--outline" style="display:flex;align-items:center;justify-content:center;gap:0.5rem">
        💬 Preguntar en el chat de WhatsApp
      </a>${pregunta ? '<p style="font-size:0.78rem;color:var(--text-soft);margin:0">Copiamos tu pregunta: pegala apenas se abra el chat.</p>' : ''}`;
  }
  if (aprobado) {
    return `<p style="font-size:0.85rem;color:var(--text-soft);margin:0">El chat de WhatsApp todavía no tiene un enlace cargado. Probá de nuevo más tarde.</p>`;
  }
  return `<div style="border:1px dashed var(--border);border-radius:var(--radius);padding:0.75rem;font-size:0.82rem;color:var(--text-soft);line-height:1.5">
      🔒 Para preguntar en el chat general de la comunidad (WhatsApp) necesitás estar
      <strong>registrado y aceptado</strong> por un administrador.
      <div style="display:flex;gap:0.5rem;margin-top:0.6rem;flex-wrap:wrap">
        <a href="registro.html" class="btn btn--outline btn--small">Registrarte</a>
        <a href="login.html" class="btn btn--outline btn--small">Ya tengo cuenta</a>
      </div>
    </div>`;
}

/**
 * Igual que renderOpcionesPreguntar, pero solo la parte de WhatsApp
 * (sin el botón de la IA) — para usarlo cuando ya se está dentro del
 * asistente de IA y lo que hace falta es solo la salida hacia la
 * comunidad.
 */
export async function renderSoloWhatsApp(pregunta = '') {
  return renderBotonWhatsApp(pregunta);
}

export async function renderOpcionesPreguntar(contexto = {}) {
  const { pregunta = '', curso = '', titulo = '', cat = '' } = contexto;

  const params = new URLSearchParams();
  if (curso) params.set('curso', curso);
  if (titulo) params.set('titulo', titulo);
  if (cat) params.set('cat', cat);
  if (pregunta) params.set('pregunta', pregunta);
  const hrefIA = `ia-asistente.html${params.toString() ? '?' + params.toString() : ''}`;

  const botonWhatsApp = await renderBotonWhatsApp(pregunta);

  return `
    <div class="preguntar-opciones" style="display:flex;flex-direction:column;gap:0.7rem">
      <a href="${hrefIA}" class="btn btn--primary" style="display:flex;align-items:center;justify-content:center;gap:0.5rem">
        🤖 Preguntarle a la IA
      </a>
      ${botonWhatsApp}
    </div>`;
}

/**
 * Copia al portapapeles la pregunta asociada a un enlace de
 * WhatsApp antes de abrirlo, para que el usuario solo tenga que
 * pegarla en el chat. Hay que llamarla después de insertar HTML
 * generado por renderOpcionesPreguntar (y junto a
 * activarSelectorWhatsApp, del módulo whatsapp-picker.js).
 */
export function activarCopiaPregunta(root = document) {
  root.querySelectorAll('[data-pregunta-copiar]').forEach((a) => {
    if (a.dataset.copiaBound) return;
    a.dataset.copiaBound = '1';
    a.addEventListener('click', () => {
      const texto = decodeURIComponent(a.dataset.preguntaCopiar || '');
      if (texto && navigator.clipboard) {
        navigator.clipboard.writeText(texto).catch(() => {});
      }
    });
  });
}
