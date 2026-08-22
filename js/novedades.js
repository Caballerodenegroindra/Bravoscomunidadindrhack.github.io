/* ============================================================
   ACADEMIA INDRA — "Novedades" del panel principal
   ============================================================
   Distinto de "Noticias" (que es un anuncio que escribe un admin
   a mano): esto detecta automáticamente lo que se publicó hace
   poco -clases nuevas y proyectos nuevos para colaborar- y lo
   muestra en la pantalla principal con una etiqueta "🆕 Nueva
   clase" / "🆕 Nuevo proyecto", para que se note sin tener que
   escribir nada extra.

   Ventana: se considera "nuevo" lo publicado en los últimos
   DIAS_VENTANA días. Pasado ese tiempo deja de aparecer acá solo
   (sigue estando en Cursos / Colaborá como siempre).
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const DIAS_VENTANA = 21;

function tsToMs(v) {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return 0;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hace(ms) {
  const dias = Math.floor((Date.now() - ms) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  const semanas = Math.floor(dias / 7);
  return semanas === 1 ? 'hace 1 semana' : `hace ${semanas} semanas`;
}

/**
 * Carga y pinta las novedades dentro de #<contenedorId>.
 * Esconde el bloque envolvente [data-novedades-wrap] si no hay nada nuevo.
 */
export async function cargarNovedades(contenedorId) {
  const cont = document.getElementById(contenedorId);
  if (!cont) return;
  const wrap = cont.closest('[data-novedades-wrap]') || cont;

  const ahora = Date.now();
  const limite = ahora - DIAS_VENTANA * 86400000;

  let clases = [];
  let proyectos = [];

  try {
    const snap = await getDocs(query(collection(db, 'courses'), where('publicado', '==', true)));
    clases = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((c) => ({ ...c, _t: tsToMs(c.creadoEn) }))
      .filter((c) => c._t >= limite);
  } catch (e) {
    console.error('No se pudieron cargar novedades de clases:', e);
  }

  try {
    const snap = await getDocs(query(collection(db, 'convocatorias'), where('activo', '==', true)));
    proyectos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((p) => ({ ...p, _t: tsToMs(p.fecha) }))
      .filter((p) => p._t >= limite);
  } catch (e) {
    console.error('No se pudieron cargar novedades de proyectos:', e);
  }

  const items = [
    ...clases.map((c) => ({
      tipo: 'clase',
      label: '🆕 Nueva clase',
      titulo: c.titulo || 'Clase sin título',
      sub: c.categoria || '',
      t: c._t,
      href: `cursos.html?curso=${encodeURIComponent(c.id)}`,
    })),
    ...proyectos.map((p) => ({
      tipo: 'proyecto',
      label: '🆕 Nuevo proyecto',
      titulo: p.titulo || 'Proyecto para colaborar',
      sub: '',
      t: p._t,
      href: 'colabora.html',
    })),
  ]
    .sort((a, b) => b.t - a.t)
    .slice(0, 6);

  if (!items.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  cont.innerHTML = items.map((it) => `
    <a href="${it.href}" class="novedad-card novedad-card--${it.tipo}">
      <span class="novedad-card__tag">${it.label}</span>
      <span class="novedad-card__titulo">${escHtml(it.titulo)}</span>
      <span class="novedad-card__meta">${it.sub ? escHtml(it.sub) + ' · ' : ''}${hace(it.t)}</span>
    </a>
  `).join('');
}
