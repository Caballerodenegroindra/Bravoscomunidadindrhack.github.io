/* ============================================================
   ACADEMIA INDRHACK — Tendencias de preguntas (público, anónimo)
   ============================================================
   Objetivo: mostrar en la portada, ANTES de iniciar sesión, qué
   está preguntando la comunidad a la IA — y que eso cambie según
   el país desde el que se conecta cada visitante.

   Cómo funciona (sin backend propio, todo desde el navegador):
   1. Cada vez que alguien le pregunta algo al asistente (en
      cualquier página, logueado o no), clasificamos el tema
      localmente por palabras clave — NUNCA guardamos el texto
      literal de la pregunta, solo a qué tema pertenece — y
      sumamos +1 en dos contadores públicos en Firestore:
      tema_stats/global y tema_stats/pais_<CODIGO>.
   2. En la portada, detectamos el país del visitante (geo-IP con
      fallback a la zona horaria del navegador) y leemos esos dos
      documentos para armar el top de temas de "su" país (con
      respaldo del global si todavía hay poca data).
   3. Con ese top de temas le pedimos a la propia IA una frase
      corta y natural para mostrar en la portada. Se cachea por
      país y por día en localStorage para no golpear la API en
      cada visita.

   Privacidad: solo se guardan CONTEOS por tema y país, nunca el
   texto de la pregunta ni datos personales del visitante.
   ============================================================ */

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, increment, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { askIA } from './ia-core.js';

/* ── Taxonomía de temas: clave → { etiqueta, palabras clave } ──
   Se arma en base a lo que realmente ofrece la academia (ver
   MAPA_SITIO en ia-core.js) para que el top de temas siempre
   apunte a algo real y accionable dentro del sitio. */
const TEMAS = {
  hacking_etico:  { label: 'Hacking ético',        kw: ['hacking', 'hacker', 'pentest', 'exploit', 'vulnerab', 'ataque'] },
  ciberseguridad: { label: 'Ciberseguridad',       kw: ['ciberseguridad', 'seguridad', 'proteger', 'malware', 'virus', 'firewall', 'phishing'] },
  termux:         { label: 'Termux',               kw: ['termux', 'comando', 'terminal', 'bash', 'linux'] },
  cursos:         { label: 'Cursos y clases',      kw: ['curso', 'clase', 'temario', 'contenido', 'material'] },
  quiz:           { label: 'Quizzes',              kw: ['quiz', 'examen', 'evaluaci', 'aprobar', 'pregunta del quiz'] },
  ranking:        { label: 'Puntos y ranking',     kw: ['punto', 'rango', 'ranking', 'nivel', 'posici'] },
  clases_vivo:    { label: 'Clases en vivo',       kw: ['en vivo', 'directo', 'streaming', 'live'] },
  chat:           { label: 'Chat y comunidad',     kw: ['chat', 'comunidad', 'grupo', 'mensaje'] },
  cuenta:         { label: 'Cuenta y acceso',      kw: ['cuenta', 'registr', 'login', 'iniciar sesi', 'contraseñ', 'usuario'] },
  certificados:   { label: 'Certificados y títulos', kw: ['certificad', 'título', 'titulo', 'diploma', 'insignia', 'badge'] },
  redes:          { label: 'Redes sociales',       kw: ['whatsapp', 'facebook', 'youtube', 'instagram', 'red social'] },
  general:        { label: 'Dudas generales',      kw: [] },
};

function normalizar(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function clasificarTema(texto) {
  const t = normalizar(texto);
  for (const [key, def] of Object.entries(TEMAS)) {
    if (key === 'general') continue;
    if (def.kw.some((k) => t.includes(k))) return key;
  }
  return 'general';
}

/* ── País del visitante ──────────────────────────────────── */
const PAIS_CACHE_KEY = 'indrhack-pais-visitante';
const PAIS_CACHE_HORAS = 12;

// Respaldo sin red: mapea zonas horarias comunes de habla hispana
// a un país, para cuando el servicio de geo-IP falla o está bloqueado
// (adblock, VPN, sin conexión al momento de la consulta, etc.)
const TZ_A_PAIS = {
  'America/Argentina': ['AR', 'Argentina'],
  'America/Buenos_Aires': ['AR', 'Argentina'],
  'America/Cordoba': ['AR', 'Argentina'],
  'America/Mendoza': ['AR', 'Argentina'],
  'America/Mexico_City': ['MX', 'México'],
  'America/Tijuana': ['MX', 'México'],
  'America/Bogota': ['CO', 'Colombia'],
  'America/Santiago': ['CL', 'Chile'],
  'America/Lima': ['PE', 'Perú'],
  'America/Caracas': ['VE', 'Venezuela'],
  'America/Montevideo': ['UY', 'Uruguay'],
  'America/La_Paz': ['BO', 'Bolivia'],
  'America/Guayaquil': ['EC', 'Ecuador'],
  'America/Asuncion': ['PY', 'Paraguay'],
  'Europe/Madrid': ['ES', 'España'],
  'America/Santo_Domingo': ['DO', 'República Dominicana'],
  'America/Guatemala': ['GT', 'Guatemala'],
  'America/Panama': ['PA', 'Panamá'],
  'America/Costa_Rica': ['CR', 'Costa Rica'],
  'America/Tegucigalpa': ['HN', 'Honduras'],
  'America/El_Salvador': ['SV', 'El Salvador'],
  'America/Managua': ['NI', 'Nicaragua'],
  'America/Havana': ['CU', 'Cuba'],
  'America/Puerto_Rico': ['PR', 'Puerto Rico'],
};

function paisPorZonaHoraria() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    for (const [prefix, val] of Object.entries(TZ_A_PAIS)) {
      if (tz === prefix || tz.startsWith(prefix + '/')) return { code: val[0], nombre: val[1] };
    }
  } catch (e) {}
  return { code: 'GLOBAL', nombre: 'la comunidad' };
}

export async function detectarPais() {
  try {
    const cached = JSON.parse(localStorage.getItem(PAIS_CACHE_KEY) || 'null');
    if (cached && (Date.now() - cached.ts) < PAIS_CACHE_HORAS * 3600 * 1000) {
      return { code: cached.code, nombre: cached.nombre };
    }
  } catch (e) {}

  let pais = null;
  try {
    // Servicio gratuito, sin API key, pensado para uso liviano desde
    // el navegador. Si algún día se supera el límite gratuito o el
    // servicio no responde, cae directo al respaldo por zona horaria.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(to);
    if (res.ok) {
      const data = await res.json();
      if (data && data.country_code && data.country_name) {
        pais = { code: data.country_code, nombre: data.country_name };
      }
    }
  } catch (e) { /* sin red, bloqueado por adblock/VPN, CORS, etc. */ }

  if (!pais) pais = paisPorZonaHoraria();

  try { localStorage.setItem(PAIS_CACHE_KEY, JSON.stringify({ ...pais, ts: Date.now() })); } catch (e) {}
  return pais;
}

/* ── Registrar una pregunta (fire-and-forget) ────────────── */
export async function registrarPreguntaIA(texto) {
  try {
    const tema = clasificarTema(texto);
    const pais = await detectarPais();

    const refGlobal = doc(db, 'tema_stats', 'global');
    await setDoc(refGlobal, {
      conteos: { [tema]: increment(1) },
      total: increment(1),
      actualizado: serverTimestamp(),
    }, { merge: true });

    if (pais.code && pais.code !== 'GLOBAL') {
      const refPais = doc(db, 'tema_stats', `pais_${pais.code}`);
      await setDoc(refPais, {
        nombre: pais.nombre,
        conteos: { [tema]: increment(1) },
        total: increment(1),
        actualizado: serverTimestamp(),
      }, { merge: true });
    }
  } catch (e) {
    // Nunca debe romper la experiencia de chat por esto.
    console.warn('No se pudo registrar la estadística de tema:', e);
  }
}

/* ── Leer tendencias para mostrar en la portada ──────────── */
const UMBRAL_MUESTRA_PAIS = 3; // por debajo de esto, se completa con el global

export async function obtenerTendencias(pais) {
  let conteosPais = {};
  let totalPais = 0;
  let conteosGlobal = {};

  try {
    if (pais?.code && pais.code !== 'GLOBAL') {
      const snapPais = await getDoc(doc(db, 'tema_stats', `pais_${pais.code}`));
      if (snapPais.exists()) {
        conteosPais = snapPais.data().conteos || {};
        totalPais = snapPais.data().total || 0;
      }
    }
    const snapGlobal = await getDoc(doc(db, 'tema_stats', 'global'));
    if (snapGlobal.exists()) conteosGlobal = snapGlobal.data().conteos || {};
  } catch (e) {
    console.warn('No se pudieron leer las tendencias:', e);
    return { items: [], fuente: 'sin-datos' };
  }

  const fuente = totalPais >= UMBRAL_MUESTRA_PAIS ? 'pais' : (Object.keys(conteosGlobal).length ? 'global' : 'sin-datos');
  const base = fuente === 'pais'
    ? conteosPais
    : Object.fromEntries(
        Object.keys({ ...conteosGlobal, ...conteosPais }).map((k) => [k, (conteosGlobal[k] || 0) + (conteosPais[k] || 0)])
      );

  const items = Object.entries(base)
    .filter(([key, count]) => count > 0 && key !== 'general')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => ({ key, count, label: TEMAS[key]?.label || key }));

  return { items, fuente };
}

/* ── Frase generada por la IA a partir del top de temas ──── */
function blurbCacheKey(paisCode) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `indrhack-tendencia-blurb-${paisCode}-${hoy}`;
}

function blurbTemplate(items, pais) {
  const nombres = items.map((i) => i.label);
  const donde = pais?.nombre && pais.code !== 'GLOBAL' ? `en ${pais.nombre}` : 'en la comunidad';
  if (nombres.length === 0) return null;
  if (nombres.length === 1) return `Esta semana, ${donde} la gente le está preguntando mucho a la IA sobre ${nombres[0]}. ¿Te sumás?`;
  const ultimo = nombres.pop();
  return `Esta semana, ${donde} lo más consultado a la IA es ${nombres.join(', ')} y ${ultimo}. ¿Querés meterte de lleno?`;
}

export async function obtenerFraseTendencias(items, pais) {
  if (!items.length) return null;
  const cacheKey = blurbCacheKey(pais?.code || 'GLOBAL');
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  const plantilla = blurbTemplate([...items], pais);
  try {
    const prompt = `Sos el asistente de Academia Indrhack. Estos son los temas que más está preguntando la comunidad ${pais?.nombre && pais.code !== 'GLOBAL' ? `en ${pais.nombre}` : 'en general'} en los últimos días: ${items.map((i) => i.label).join(', ')}.
Escribí UNA sola frase corta (máximo 26 palabras), en español, tono cercano y con energía, invitando a un visitante nuevo (que todavía no se registró) a sumarse a la academia a partir de esos temas. No uses comillas ni markdown ni emojis.`;
    const frase = await askIA(prompt, [{ role: 'user', content: 'Dame la frase.' }]);
    const limpia = frase.trim().replace(/^"|"$/g, '');
    if (limpia && limpia.length < 260) {
      try { localStorage.setItem(cacheKey, limpia); } catch (e) {}
      return limpia;
    }
  } catch (e) { /* seguimos con la plantilla local */ }

  if (plantilla) { try { localStorage.setItem(cacheKey, plantilla); } catch (e) {} }
  return plantilla;
}
