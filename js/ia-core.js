/* ============================================================
   ACADEMIA INDRHACK — Núcleo del asistente de IA (Gemini)
   ============================================================
   Módulo compartido usado por:
   - ia-asistente.html   (chat de página completa)
   - js/ia-widget.js     (burbuja flotante presente en todo el sitio)
   - panel-admin.html    (recomendación automática al aprobar un quiz)

   Acá vive TODO lo relacionado a la IA: la clave, el modelo, cómo se
   arma el contexto (cursos + progreso del usuario + estructura del
   sitio) y cómo se llama a la API. Si el día de mañana hay que
   cambiar de modelo, de proveedor o el texto del prompt, se toca
   este único archivo.
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Clave gratuita de Google AI Studio: https://aistudio.google.com/apikey
export const GEMINI_API_KEY = 'AQ.Ab8RN6JkQouwMECSs0Rh_9CA55xv8Lyg89kISivqO5vHaPZhwQ';
export const GEMINI_MODEL   = 'gemini-2.5-flash';

/* ── Mapa estático del sitio: qué hay y dónde ─────────────── */
export const MAPA_SITIO = `- Registro: el usuario se registra en registro.html con username y contraseña. Su cuenta queda pendiente hasta que un administrador la aprueba.
- Login: en login.html usando username. Tras aprobación, accede al panel-usuario.html.
- Cursos y clases: visibles en cursos.html. Cada clase tiene nivel (Básico/Intermedio/Avanzado), descripción, y un quiz de evaluación.
- Quiz: al ver una clase en clase.html, el usuario responde 4 preguntas. El admin las revisa y aprueba/rechaza. Si aprueba, gana puntos: Básico=100pts, Intermedio=200pts, Avanzado=400pts.
- Puntos y ranking: los puntos acumulados definen el rango del usuario y su posición en el ranking visible en panel-usuario.html.
- Perfil: en perfil.html el usuario puede cambiar nombre visible, bio y foto.
- Mi ficha: en ficha.html se ven los datos del usuario.
- Títulos: en titulos.html aparecen los certificados y badges obtenidos.
- Chat: en chat.html hay un chat comunitario entre miembros.
- Noticias: en noticias.html se publican anuncios y novedades.
- Redes: en redes.html están los links a las redes sociales de la academia.
- Configuración: en configuracion.html el usuario puede cambiar contraseña y ajustes.
- Panel admin: solo accesible para administradores, en panel-admin.html gestionan usuarios, clases, quiz y noticias.
- Notificaciones: en notificaciones.html (y la campanita del navbar) se ven avisos de quiz aprobados/rechazados, cuenta aprobada, clases en vivo, etc.`;

/* ── Nombres "lindos" de página para dar contexto de dónde está el usuario ── */
const NOMBRES_PAGINA = {
  'index.html': 'la portada / inicio',
  'cursos.html': 'el catálogo de cursos y clases',
  'clase.html': 'el detalle de una clase (viendo contenido o el quiz)',
  'panel-usuario.html': 'su panel de usuario (progreso, ranking, puntos)',
  'perfil.html': 'la edición de su perfil',
  'ficha.html': 'su ficha personal',
  'titulos.html': 'sus títulos y certificados',
  'chat.html': 'el chat comunitario',
  'noticias.html': 'las noticias/anuncios de la academia',
  'redes.html': 'las redes sociales de la academia',
  'configuracion.html': 'la configuración de su cuenta',
  'notificaciones.html': 'su bandeja de notificaciones',
  'panel-admin.html': 'el panel de administración',
  'login.html': 'la pantalla de inicio de sesión',
  'registro.html': 'la pantalla de registro',
  'ayuda.html': 'la sección de ayuda',
};

export function nombrePagina(pathname) {
  const file = (pathname.split('/').pop() || 'index.html').split('?')[0] || 'index.html';
  return NOMBRES_PAGINA[file] || null;
}

/* ── Cursos: se cachean en memoria durante la sesión de la pestaña ── */
let _cursosCache = null;
export async function cargarCursos(force = false) {
  if (_cursosCache && !force) return _cursosCache;
  try {
    const snap = await getDocs(collection(db, 'courses'));
    _cursosCache = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.publicado !== false);
  } catch (e) {
    _cursosCache = [];
  }
  return _cursosCache;
}

export function buildCursosContext(cursos) {
  if (!cursos || !cursos.length) return 'No hay clases cargadas aún.';
  const cats = {};
  cursos.forEach((c) => {
    const cat = c.categoria || 'General';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(c);
  });
  return Object.entries(cats).map(([cat, arr]) =>
    `### Categoría: ${cat}\n` +
    arr.map((c) =>
      `- ID: ${c.id} | Título: "${c.titulo}" | Nivel: ${c.nivel || 'Básico'} | Descripción: ${(c.descripcion || '').slice(0, 220)}`
    ).join('\n')
  ).join('\n\n');
}

/* ── Progreso real del usuario (quiz_logros aprobados) ────── */
export async function cargarProgresoUsuario(uid) {
  if (!uid) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'quiz_logros'),
      where('uid', '==', uid),
      where('aprobado', '==', true)
    ));
    return snap.docs.map((d) => d.data());
  } catch (e) {
    return [];
  }
}

export function buildProgresoContext(progreso) {
  if (!progreso || !progreso.length) {
    return 'El usuario todavía no aprobó ninguna clase/quiz.';
  }
  return 'Clases YA completadas y aprobadas por el usuario (no se las vuelvas a recomendar como "nuevas"):\n' +
    progreso.map((p) => `- "${p.cursoTitulo}" (Nivel: ${p.nivel || '—'}, ${p.puntos || 0} pts)`).join('\n');
}

/* ── Arma el system prompt completo ────────────────────────
   opts: { userInfo, cursosCtx, progresoCtx, paginaCtx }        */
export function buildSystemPrompt({ userInfo, cursosCtx, progresoCtx, paginaCtx }) {
  const userCtx = userInfo
    ? `El usuario está logueado: ${userInfo.displayName || userInfo.username || 'usuario'}, rango: ${userInfo.rango || '—'}, puntos: ${userInfo.puntos || 0}.`
    : 'El usuario no ha iniciado sesión.';

  return `Eres el asistente oficial de Academia Indrhack, una plataforma de formación en ciberseguridad, hacking ético e informática. Estás disponible en TODAS las páginas del sitio (no solo en el chat de IA), así que ayudás con cualquier duda sobre la plataforma, no solo sobre cursos.

CONTEXTO DEL USUARIO:
${userCtx}
${paginaCtx ? `Ahora mismo el usuario está en: ${paginaCtx}.` : ''}

PROGRESO DEL USUARIO:
${progresoCtx || 'No disponible.'}

CLASES DISPONIBLES EN LA ACADEMIA (datos reales de Firestore):
${cursosCtx}

CÓMO FUNCIONA LA ACADEMIA:
${MAPA_SITIO}

CÓMO RECOMENDAR CLASES:
Cuando el usuario pregunte qué clases le sirven para algo, o pida "qué sigo ahora", analiza su progreso y el título/descripción de cada clase disponible, y recomendá las más relevantes por nombre y nivel, priorizando las que todavía NO completó. NO inventes clases que no estén en la lista. Si no hay clases cargadas aún, díselo.

ESTILO:
- Responde siempre en español.
- Sé directo, amigable y técnico cuando sea necesario.
- Usa **negrita** para resaltar nombres de clases, páginas y términos clave.
- Si recomiendas clases, listarlas con nombre, nivel y por qué son útiles.
- Máximo 350 palabras por respuesta salvo que el usuario pida más detalle.
- Si la pregunta se sale de lo que sabés sobre la academia (por ejemplo, dudas muy específicas de código, errores puntuales, temas no cubiertos en las clases, o algo que depende de la experiencia de otros miembros), decilo con honestidad usando una frase como "No tengo esa información" o "No dispongo de esa información" en vez de inventar una respuesta.`;
}

/* ── Llamada a la API de Gemini ─────────────────────────────
   history: [{role:'user'|'assistant', content:string}, ...]   */
export async function askGemini(systemPrompt, history) {
  const contents = history.slice(-14).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1000 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Error de la API de Gemini');
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || 'Sin respuesta.';
}

/* ── Recomendación automática al aprobar un quiz ────────────
   Se usa desde panel-admin.html justo después de aprobar un quiz,
   para mandarle al usuario una notificación con el "siguiente paso"
   sugerido por la IA, en vez de un mensaje genérico fijo.        */
export async function recomendarSiguienteCurso({ uid, cursoAprobadoTitulo }) {
  try {
    const [cursos, progreso] = await Promise.all([
      cargarCursos(),
      cargarProgresoUsuario(uid),
    ]);
    const completados = new Set(progreso.map((p) => p.cursoTitulo));
    completados.add(cursoAprobadoTitulo);
    const pendientes = cursos.filter((c) => !completados.has(c.titulo));
    if (!pendientes.length) return null;

    const prompt = `Sos el asistente de Academia Indrhack. Un usuario acaba de aprobar la clase "${cursoAprobadoTitulo}".

Clases que ya completó en total: ${[...completados].join(', ')}.

Clases disponibles que todavía NO completó:
${pendientes.map((c) => `- ID:${c.id} | "${c.titulo}" | Nivel: ${c.nivel || 'Básico'} | ${(c.descripcion || '').slice(0, 150)}`).join('\n')}

Recomendá UNA sola clase como siguiente paso lógico, priorizando progresión de nivel (Básico → Intermedio → Avanzado) y temática relacionada con "${cursoAprobadoTitulo}". Respondé en español, en un máximo de 2 frases cortas y amigables, mencionando el título exacto de la clase recomendada entre comillas. No uses markdown ni listas.`;

    const reply = await askGemini(prompt, [{ role: 'user', content: 'Recomendame la siguiente clase.' }]);
    const mencionado = pendientes.find((c) => reply.includes(c.titulo));
    return { texto: reply.trim(), cursoId: mencionado?.id || null };
  } catch (e) {
    console.error('Error recomendando siguiente curso:', e);
    return null;
  }
}
