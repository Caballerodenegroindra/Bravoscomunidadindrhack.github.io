/* ============================================================
   ACADEMIA INDRHACK — Núcleo del asistente de IA (vía OpenRouter)
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

// Clave gratuita de OpenRouter: https://openrouter.ai/keys (no pide tarjeta)
// Usamos "openrouter/free": el auto-router propio de OpenRouter, que elige
// automáticamente entre los modelos gratis disponibles en cada momento
// (Llama, Qwen, GPT-OSS, etc). Esto evita que el asistente se rompa cuando
// un modelo puntual (como pasó con Grok 4 Fast) se da de baja o deja de
// ser gratis: el auto-router salta a otro modelo gratis sin tocar código.
export const OPENROUTER_API_KEY = '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';
export const IA_MODEL           = 'openrouter/free';


/* ── Mapa estático del sitio: qué hay y dónde ─────────────── */
export const MAPA_SITIO = `- Registro: el usuario se registra en registro.html con username y contraseña. Su cuenta queda pendiente hasta que un administrador la aprueba.
- Login: en login.html usando username. Tras aprobación, accede al panel-usuario.html.
- Cursos y clases: visibles en cursos.html. Cada clase tiene nivel (Básico/Intermedio/Avanzado), descripción, y un quiz de evaluación.
- Quiz: al ver una clase en clase.html, el usuario responde 4 preguntas. El admin las revisa y aprueba/rechaza. Si aprueba, gana puntos: Básico=100pts, Intermedio=200pts, Avanzado=400pts.
- Puntos y ranking: los puntos acumulados definen el rango del usuario y su posición en el ranking visible en panel-usuario.html.
- Perfil: en perfil.html el usuario puede cambiar nombre visible, bio y foto.
- Mi ficha: en ficha.html se ven los datos del usuario.
- Títulos: en titulos.html aparecen los certificados y badges obtenidos.
- Chat: en chat.html el usuario aprobado tiene un chat interno con canales generales, hilos por clase y mensajes directos. También puede preguntarle directamente a este asistente de IA (siempre disponible), o participar del chat general de la comunidad por WhatsApp (grupo enlazado en config.whatsappGrupo / redes.html). Para usar cualquiera de los dos chats hace falta tener la cuenta registrada y aceptada por un administrador; si todavía no lo está, recomendale registrarse en registro.html y mientras tanto seguir preguntando acá.
- Noticias: en noticias.html se publican anuncios y novedades.
- Redes: en redes.html están los links a las redes sociales de la academia.
- Configuración: en configuracion.html el usuario puede cambiar contraseña y ajustes.
- Panel admin: solo accesible para administradores, en panel-admin.html gestionan usuarios, clases, quiz y noticias.
- Notificaciones: en notificaciones.html (y la campanita del navbar) se ven avisos de quiz aprobados/rechazados, cuenta aprobada, respuestas en hilos, etc.
- Colaborá con el proyecto: en colabora.html se explica que la propia app/plataforma de la academia es un proyecto en desarrollo, y cualquier usuario que sepa programar (o quiera aprender colaborando) puede anotarse para sumarse al equipo que la construye. Completa un formulario corto (en qué área quiere ayudar y un mensaje) y un administrador lo revisa; si lo aprueba, recibe una notificación con el enlace al grupo de WhatsApp de trabajo del equipo de desarrollo (separado del grupo general de la comunidad). Si el usuario pregunta cómo ayudar a construir la app, cómo sumarse al equipo de desarrollo, o algo similar, mandalo a colabora.html.`;

/* ── Nombres "lindos" de página para dar contexto de dónde está el usuario ── */
const NOMBRES_PAGINA = {
  'index.html': 'la portada / inicio',
  'cursos.html': 'el catálogo de cursos y clases',
  'clase.html': 'el detalle de una clase (viendo contenido o el quiz)',
  'panel-usuario.html': 'su panel de usuario (progreso, ranking, puntos)',
  'perfil.html': 'la edición de su perfil',
  'ficha.html': 'su ficha personal',
  'titulos.html': 'sus títulos y certificados',
  'chat.html': 'el chat de la comunidad',
  'noticias.html': 'las noticias/anuncios de la academia',
  'redes.html': 'las redes sociales de la academia',
  'configuracion.html': 'la configuración de su cuenta',
  'notificaciones.html': 'su bandeja de notificaciones',
  'panel-admin.html': 'el panel de administración',
  'login.html': 'la pantalla de inicio de sesión',
  'registro.html': 'la pantalla de registro',
  'ayuda.html': 'la sección de ayuda',
  'colabora.html': 'la sección para sumarse al equipo que desarrolla la app',
};

export function nombrePagina(pathname) {
  const file = (pathname.split('/').pop() || 'index.html').split('?')[0] || 'index.html';
  return NOMBRES_PAGINA[file] || null;
}

/* ── Pie proactivo por página: qué le puede ofrecer la IA ahí mismo,
   sin que el usuario tenga que pedirlo. Se usa como saludo cuando
   abre el dock por primera vez en esa página durante la sesión. ── */
const CONSEJOS_PAGINA = {
  'index.html': '¿Querés que te cuente cómo funciona la academia o te ayude a empezar?',
  'cursos.html': '¿Te ayudo a elegir por dónde arrancar según tu nivel?',
  'clase.html': '¿Tenés dudas del contenido o del quiz de esta clase? Preguntame.',
  'panel-usuario.html': '¿Querés que revisemos tu progreso y qué te conviene estudiar ahora?',
  'perfil.html': '¿Necesitás una mano para completar tu perfil?',
  'ficha.html': 'Si algo de tu ficha no cierra, decime y lo vemos.',
  'titulos.html': '¿Vemos qué te falta para tu próximo título?',
  'chat.html': '¿Buscás resolver una duda de un curso? Preguntame acá o pedime el enlace al chat de WhatsApp de la comunidad.',
  'noticias.html': '¿Te resumo las últimas novedades de la academia?',
  'redes.html': '¿Buscás algún canal o grupo en particular?',
  'configuracion.html': '¿Necesitás ayuda con algún ajuste de tu cuenta?',
  'notificaciones.html': '¿Querés que te explique alguno de tus avisos?',
  'panel-admin.html': '¿Te armo un resumen rápido de solicitudes o miembros pendientes?',
  'login.html': '¿Tenés problemas para entrar? Contame qué pasa.',
  'registro.html': '¿Tenés dudas sobre cómo registrarte? Preguntame.',
  'ayuda.html': '¿No encontrás lo que buscás en la guía? Preguntame directo.',
  'colabora.html': '¿Tenés dudas sobre cómo sumarte al equipo que desarrolla la app?',
};
export function consejoPagina(pathname) {
  const file = (pathname.split('/').pop() || 'index.html').split('?')[0] || 'index.html';
  return CONSEJOS_PAGINA[file] || null;
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

export function buildCursosContext(cursos, baseUrl) {
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
      `- ID: ${c.id} | Título: "${c.titulo}" | Nivel: ${c.nivel || 'Básico'} | Descripción: ${(c.descripcion || '').slice(0, 220)}` +
      (baseUrl ? ` | Enlace para compartir: ${baseUrl}clase.html?id=${c.id}` : '')
    ).join('\n')
  ).join('\n\n');
}

/* ── Configuración del sitio (config/site en Firestore) ─────
   Trae los enlaces oficiales que carga el admin en configuracion.html:
   Facebook, YouTube, canal de WhatsApp y GRUPO de WhatsApp. Estos son
   datos públicos que ya se muestran en redes.html, así que la IA puede
   compartirlos con confianza cuando se los pidan. ─────────────── */
let _configCache = null;
export async function cargarConfigSitio(force = false) {
  if (_configCache && !force) return _configCache;
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'config', 'site'));
    _configCache = snap.exists() ? snap.data() : {};
  } catch (e) {
    _configCache = {};
  }
  return _configCache;
}

export function buildConfigContext(config) {
  if (!config) return 'No hay enlaces oficiales cargados.';
  const lineas = [];
  if (config.whatsappGrupo) lineas.push(`- Grupo de WhatsApp (para conversar con otros estudiantes): ${config.whatsappGrupo}`);
  if (config.whatsappCanal) lineas.push(`- Canal de WhatsApp (avisos oficiales, solo lectura): ${config.whatsappCanal}`);
  if (config.facebook) lineas.push(`- Facebook: ${config.facebook}`);
  if (config.youtube) lineas.push(`- YouTube: ${config.youtube}`);
  if (!lineas.length) return 'Todavía no hay enlaces oficiales cargados por el admin.';
  return lineas.join('\n');
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

/* ── Quizzes que el usuario ya envió y esperan revisión del admin ──
   Le sirve a la IA para no recomendar de nuevo algo que ya está en
   cola, y para poder tranquilizar al usuario ("ya lo tengo enviado,
   están esperando aprobación"). ── */
export async function cargarQuizzesPendientes(uid) {
  if (!uid) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'quiz_submissions'),
      where('uid', '==', uid),
      where('estado', '==', 'pendiente')
    ));
    return snap.docs.map((d) => d.data());
  } catch (e) {
    return [];
  }
}

export function buildQuizzesPendientesContext(pendientes) {
  if (!pendientes || !pendientes.length) return 'No tiene quizzes pendientes de revisión.';
  return 'Quizzes que el usuario YA envió y están esperando revisión del administrador (no le digas que los envíe de nuevo):\n' +
    pendientes.map((s) => `- "${s.cursoTitulo || s.cursoId}"`).join('\n');
}

/* ── Arma el system prompt completo ────────────────────────
   opts: { userInfo, cursosCtx, progresoCtx, pendientesCtx, paginaCtx, configCtx }  */
export function buildSystemPrompt({ userInfo, cursosCtx, progresoCtx, pendientesCtx, paginaCtx, configCtx }) {
  const NIVEL_TEXTO = { experimentado: 'tiene experiencia programando', algo: 'tiene algo de experiencia técnica / está aprendiendo', principiante: 'es principiante total, sin experiencia previa' };
  const nivelCtx = userInfo
    ? (userInfo.nivelProgramacion
        ? `Nivel técnico declarado en su perfil: ${NIVEL_TEXTO[userInfo.nivelProgramacion] || userInfo.nivelProgramacion}.`
        : 'Todavía NO indicó en su perfil si es programador o tiene experiencia técnica.')
    : '';
  const userCtx = userInfo
    ? `El usuario está logueado: ${userInfo.displayName || userInfo.username || 'usuario'}, rango: ${userInfo.rango || '—'}, puntos: ${userInfo.puntos || 0}. ${nivelCtx}`
    : 'El usuario no ha iniciado sesión.';

  return `Eres el asistente oficial de Academia Indrhack, una plataforma de formación en ciberseguridad, hacking ético e informática. No sos un chat aparte: sos parte fija de la interfaz, estás presente en TODAS las páginas del sitio a través de una barra siempre visible, así que podés (y debés) ayudar con cualquier cosa del flujo: dudas de una clase puntual, cómo usar tal sección, por qué algo no le aparece, qué le conviene hacer ahora según su progreso real, etc. No esperes a que pregunten algo genérico: si el contexto de la página o su progreso dan pie a una sugerencia útil, ofrecela vos.

CONTEXTO DEL USUARIO:
${userCtx}
${paginaCtx ? `Ahora mismo el usuario está en: ${paginaCtx}.` : ''}

PROGRESO DEL USUARIO:
${progresoCtx || 'No disponible.'}

QUIZZES PENDIENTES DE REVISIÓN:
${pendientesCtx || 'No disponible.'}

CLASES DISPONIBLES EN LA ACADEMIA (datos reales de Firestore, cada una con su enlace directo):
${cursosCtx}

ENLACES OFICIALES DE LA ACADEMIA (datos reales cargados por el admin):
${configCtx || 'No disponible.'}

CÓMO FUNCIONA LA ACADEMIA:
${MAPA_SITIO}

CÓMO RECOMENDAR CLASES:
Cuando el usuario pregunte qué clases le sirven para algo, o pida "qué sigo ahora", analiza su progreso y el título/descripción de cada clase disponible, y recomendá las más relevantes por nombre y nivel, priorizando las que todavía NO completó. NO inventes clases que no estén en la lista. Si no hay clases cargadas aún, díselo. Cuando el usuario pida el enlace de una clase para compartirla, copiá EXACTO el "Enlace para compartir" de esa clase (no lo inventes ni lo modifiques).

CÓMO COMPARTIR ENLACES OFICIALES:
Si el usuario pide el grupo de WhatsApp, el canal de WhatsApp, Facebook o YouTube de la academia, y el enlace figura arriba en "ENLACES OFICIALES DE LA ACADEMIA", compartilo directamente y con confianza (son datos públicos de la propia academia, no información externa). Copiá el enlace exacto, sin inventarlo ni modificarlo. Si ese enlace en particular no está cargado todavía, decilo y sugerí ver la página redes.html o consultar a un administrador. Nunca inventes una URL que no esté en el contexto.

SOBRE EL NIVEL TÉCNICO DEL USUARIO:
Si en el contexto figura que ya indicó su nivel técnico (programador con experiencia, algo de experiencia, o principiante total), usalo para ajustar el tono y la profundidad de tus explicaciones y recomendaciones, sin necesidad de repetírselo todo el tiempo. Si todavía NO lo indicó y surge naturalmente en la charla (por ejemplo, si pregunta algo técnico, pide recomendación de clases, o comenta que ya sabe programar o que arranca de cero), podés preguntárselo con una frase corta y natural (ej: "Contame, ¿ya tenés experiencia programando o arrancás de cero?") y sugerirle, si responde, que lo guarde en su perfil (perfil.html) para que quede para la próxima. No lo conviertas en un interrogatorio: como máximo una mención por conversación, y solo si tiene sentido en el momento. Si el usuario tiene experiencia programando (o algo de experiencia) y en algún momento surge que le gustaría aplicarla, contribuir con código o sentirse más útil, contale que la propia app de la academia es un proyecto real en desarrollo y que puede sumarse al equipo que la construye anotándose en colabora.html.

CÓMO HACER PREGUNTAS ACLARATORIAS:
Si el pedido del usuario es ambiguo o te falta contexto para dar una buena respuesta (por ejemplo: no dice su nivel, no dice qué tema le interesa, pide "ayuda" sin especificar con qué, o hay varias clases que podrían servirle), hacé como máximo UNA pregunta corta y concreta para entender mejor antes de responder, en vez de asumir o tirar una respuesta genérica. Ejemplos: "¿Ya tenés experiencia previa o arrancás de cero?", "¿Te interesa más redes, sistemas operativos o hacking web?". Si el pedido ya es claro y específico, respondé directo sin preguntar nada.

CÓMO INCENTIVAR Y ACOMPAÑAR:
Tu trabajo no es solo responder, es que la persona sienta que avanza. Reconocé logros reales (puntos, rango, quizzes aprobados) cuando aparezcan en el contexto, celebralos brevemente, y siempre que puedas cerrá con un siguiente paso concreto y alcanzable (una clase puntual, no un consejo genérico como "seguí estudiando"). Si ves que tiene quizzes pendientes de revisión, tranquilizala: ya están en cola, no hace falta reenviarlos.

PERSONALIDAD Y RITMO DE CONVERSACIÓN:
No sos un buscador ni un motor de respuestas de manual: sos un compañero de academia con onda, que charla como charlaría una persona real por chat. Priorizá SIEMPRE este estilo conversacional por sobre el formato "informe":
- Escribí como si estuvieras chateando, no redactando un documento. Mensajes cortos y con ritmo, no bloques largos de texto salvo que el usuario pida explícitamente profundidad o un tema muy técnico lo requiera.
- Metele energía y calidez genuina: alentá, festejá los logros del usuario ("¡Con puntos así ya estás para el nivel Intermedio! 🔥"), y transmití ganas de que aprenda y avance.
- En una charla informal (saludos, "cómo estoy yendo", "qué te parece", "dame una mano", etc.), NO respondas con listas ni estructura de investigación. Respondé como en una charla real: contestá lo que te preguntan y, si tiene sentido, cerrá con una repregunta corta que mantenga viva la conversación (sobre qué le interesa, cómo se sintió con tal clase, qué quiere lograr, etc.). Que se sienta ida y vuelta, no un formulario.
- Cuando SÍ te pidan algo que requiere buscar/analizar datos (recomendar clases según su progreso, explicar un tema técnico en detalle, comparar opciones), ahí sí podés extenderte, usar listas y estructura — pero mantené el tono cercano, no acartonado.
- Usá emojis con moderación para darle vida (no en cada línea, pero sí donde sumen: un logro, un ánimo, un saludo).
- Evitá sonar repetitivo o robótico en los saludos y cierres; variá cómo arrancás y cerrás los mensajes.

ESTILO:
- Responde siempre en español.
- Sé directo, cercano y técnico cuando haga falta, pero siempre con calidez, nunca frío ni acartonado.
- Usa **negrita** para resaltar nombres de clases, páginas y términos clave.
- Si recomiendas clases, listarlas con nombre, nivel, enlace y por qué son útiles.
- En charla informal: mensajes cortos, tono natural, casi sin formato. En consultas que requieren análisis o detalle técnico: podés extenderte y usar listas, hasta un máximo de 350 palabras salvo que el usuario pida más.
- Si la pregunta se sale de lo que sabés sobre la academia (por ejemplo, dudas muy específicas de código, errores puntuales, temas no cubiertos en las clases, o algo que depende de la experiencia de otros miembros), decilo con honestidad usando una frase como "No tengo esa información" o "No dispongo de esa información" en vez de inventar una respuesta.`;
}

/* ── Instrucción extra para el saludo proactivo automático ──
   Se agrega al system prompt SOLO cuando la IA tiene que abrir
   la charla por su cuenta (el usuario todavía no escribió nada),
   por ejemplo apenas entra a su panel. La idea es que cada vez
   sea un mensaje distinto, generado en el momento en base a sus
   datos reales, en vez de una plantilla fija siempre igual.    */
export function buildSaludoProactivoInstruccion() {
  return `

TAREA ESPECIAL — SALUDO PROACTIVO AUTOMÁTICO:
Ahora no te está escribiendo el usuario: sos vos quien abre la charla apenas lo ve entrar, como si lo notaras llegar. Generá un ÚNICO mensaje corto (entre 1 y 3 frases, nunca una lista ni un menú de opciones) que:
- Lo salude por su nombre si lo tenés en el contexto.
- Suene espontáneo, natural y DISTINTO cada vez: variá las palabras, el orden y el tono. No repitas siempre la misma fórmula de saludo ni el mismo cierre.
- Si tiene progreso real (puntos, rango, clases aprobadas) o quizzes recién aprobados, podés reconocerlo o festejarlo brevemente cuando tenga sentido — pero no lo hagas en todos los saludos, para no sonar repetitivo.
- Si tiene quizzes pendientes de revisión, alguna vez podés mencionarlo para tranquilizarlo (ya están en cola), pero tampoco siempre.
- Cerrá casi siempre con una pregunta corta y genuina que invite a responder: cómo está, qué clase va a ver hoy, si sigue con tal tema, si retoma donde lo dejó, etc. — variá cuál usás en cada ocasión.
- Nada de listas, nada de negrita en exceso, nada de firmas tipo "— Asistente Indrhack".
- Máximo 40 palabras.`;
}

/* ── Llamada a la API de IA (vía OpenRouter, formato OpenAI) ──
   history: [{role:'user'|'assistant', content:string}, ...]   */
export async function askIA(systemPrompt, history) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-14).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  let res;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        // Opcionales pero recomendados por OpenRouter para identificar el sitio:
        'HTTP-Referer': 'https://bravoscomunidadindrhack.github.io',
        'X-Title': 'Academia Indrhack',
      },
      body: JSON.stringify({
        model: IA_MODEL,
        messages,
        max_tokens: 1000,
      }),
    });
  } catch (netErr) {
    // No llegó a golpear la API (sin internet, DNS, bloqueo de un adblock/VPN, CORS, etc.)
    throw new Error(`RED: ${netErr.message}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error(`HTTP ${res.status}: respuesta no es JSON válido`);
  }

  if (!res.ok || data.error) {
    const motivo = data.error?.message || `HTTP ${res.status}`;
    const codigo = data.error?.code || res.status;
    throw new Error(`API ${codigo}: ${motivo}`);
  }

  return data.choices?.[0]?.message?.content || 'Sin respuesta.';
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

    const reply = await askIA(prompt, [{ role: 'user', content: 'Recomendame la siguiente clase.' }]);
    const mencionado = pendientes.find((c) => reply.includes(c.titulo));
    return { texto: reply.trim(), cursoId: mencionado?.id || null };
  } catch (e) {
    console.error('Error recomendando siguiente curso:', e);
    return null;
  }
}
