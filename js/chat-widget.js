/* ============================================================
   ACADEMIA INDRHACK — Dock del chat comunitario (global, flotante)
   ============================================================
   Igual que el asistente de IA, pero para la sala "General" del
   chat de la comunidad: un botón flotante presente en (casi) todas
   las páginas del sitio, para que se pueda escribir con el resto
   de los miembros sin salir de donde uno está — viendo una clase de
   Termux, leyendo un curso, etc. — sin tener que ir hasta chat.html.

   No reemplaza al chat completo: sigue existiendo chat.html con
   salas, hilos, respuestas y clases en vivo. Este widget es la
   versión rápida de la sala General, con un enlace directo para
   abrir el chat completo cuando se necesite algo más avanzado.

   Usa la MISMA colección/estructura de datos que chat.html
   (chat_rooms / chat_messages), así que los mensajes son un único
   hilo compartido: escribir acá o en chat.html es lo mismo chat.
   ============================================================ */

import { db } from './firebase-config.js';
import { onSessionChange, ESTADOS } from './auth.js';
import {
  collection, doc, addDoc, getDocs, onSnapshot,
  query, where, limit, serverTimestamp, updateDoc, increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// En el chat de página completa ya está todo esto disponible (y más),
// así que ahí no mostramos el flotante para no duplicar.
const ARCHIVO_ACTUAL = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
if (ARCHIVO_ACTUAL !== 'chat.html') {
  document.addEventListener('DOMContentLoaded', initChatWidget);
}

// Guardamos, por pestaña, el timestamp (ms) del último mensaje que
// el usuario ya vio, para saber cuántos mensajes nuevos avisar con
// el globito rojo sobre el botón cuando el panel está cerrado.
const VISTO_KEY = 'chat-widget-visto';

function initChatWidget() {
  let ME       = null; // perfil del usuario logueado y aprobado (o null)
  let roomId   = null;
  let msgs     = [];
  let opened   = false;
  let busy     = false;
  let unsubMsgs = null;

  /* ── DOM ── */
  const wrap = document.createElement('div');
  wrap.id = 'chat-widget';
  wrap.style.display = 'none'; // se muestra solo si hay sesión aprobada
  wrap.innerHTML = `
    <button type="button" id="chat-widget-fab" aria-label="Abrir chat de la comunidad" title="Chat de la comunidad">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
      <span id="chat-widget-badge"></span>
    </button>
    <div id="chat-widget-panel" role="dialog" aria-label="Chat de la comunidad">
      <div id="chat-widget-header">
        <span id="chat-widget-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          <span id="chat-widget-header-text">
            <span id="chat-widget-header-title-main">General</span>
            <span id="chat-widget-header-subtitle">Chat grupal de la comunidad</span>
          </span>
        </span>
        <div id="chat-widget-header-actions">
          <a href="chat.html" id="chat-widget-expand" title="Abrir chat completo" aria-label="Abrir chat completo">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3H4v5"/><path d="M4 3l6 6"/><path d="M15 21h5v-5"/><path d="M20 21l-6-6"/></svg>
          </a>
          <button type="button" id="chat-widget-minimize" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l14 14"/><path d="M19 5L5 19"/></svg>
          </button>
        </div>
      </div>
      <div id="chat-widget-msgs"></div>
      <div id="chat-widget-composer">
        <textarea id="chat-widget-input" placeholder="Escribile a la comunidad…" rows="1" maxlength="2000"></textarea>
        <button type="button" id="chat-widget-send" disabled aria-label="Enviar">➤</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const fab     = wrap.querySelector('#chat-widget-fab');
  const badge   = wrap.querySelector('#chat-widget-badge');
  const panel   = wrap.querySelector('#chat-widget-panel');
  const minBt   = wrap.querySelector('#chat-widget-minimize');
  const msgsEl  = wrap.querySelector('#chat-widget-msgs');
  const inpEl   = wrap.querySelector('#chat-widget-input');
  const sendBtn = wrap.querySelector('#chat-widget-send');

  // El panel se posiciona con "bottom" (pegado arriba del botón), pero
  // su alto se calculaba solo en vh/px fijos sin saber cuánto mide
  // realmente el navbar de arriba. En pantallas más bajas eso hacía
  // que el panel "creciera" por encima del techo visible y su propio
  // encabezado (título "General" + botones de expandir/cerrar) quedara
  // tapado detrás del navbar. Acá lo calculamos en base al alto real
  // disponible, igual que hace el dock de la IA.
  function ajustarAlturaPanel() {
    const vv  = window.visualViewport;
    const vpH = (vv && vv.height) || window.innerHeight;
    const navbarEl = document.querySelector('.navbar');
    const navH = (navbarEl ? navbarEl.getBoundingClientRect().height : 72) + 12;
    const bottomPx = parseFloat(getComputedStyle(panel).bottom) || 0;
    const disponible = Math.max(220, vpH - bottomPx - navH);
    const maxDeseado  = Math.min(vpH * 0.65, 520);
    panel.style.height = `${Math.min(disponible, maxDeseado)}px`;
  }
  window.addEventListener('resize', ajustarAlturaPanel);
  window.visualViewport?.addEventListener('resize', ajustarAlturaPanel);
  ajustarAlturaPanel();

  function openPanel() {
    if (!ME || opened) return;
    opened = true;
    wrap.classList.add('chat-widget--open');
    ajustarAlturaPanel();
    marcarComoLeido();
    setTimeout(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }, 30);
  }
  function closePanel() {
    if (!opened) return;
    opened = false;
    wrap.classList.remove('chat-widget--open');
  }
  fab.addEventListener('click', () => (opened ? closePanel() : openPanel()));
  minBt.addEventListener('click', closePanel);

  // Solo mostramos el botón (y solo dejamos escribir) a usuarios con
  // sesión iniciada y cuenta aprobada — misma regla que usa el resto
  // del chat comunitario.
  onSessionChange((profile) => {
    ME = (profile && profile.estado === ESTADOS.APROBADO) ? profile : null;
    wrap.style.display = ME ? '' : 'none';
    if (ME && !roomId) iniciarSalaGeneral();
    if (!ME && unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
  });

  /* ── Sala "General" (misma que crea/usa chat.html) ── */
  async function iniciarSalaGeneral() {
    try {
      const snap = await getDocs(query(collection(db, 'chat_rooms'), where('type', '==', 'global')));
      if (!snap.empty) {
        roomId = snap.docs[0].id;
      } else {
        const ref = await addDoc(collection(db, 'chat_rooms'), {
          type: 'global', name: 'General', icon: '🌐',
          lastMsg: '', lastAt: serverTimestamp(), msgCount: 0,
        });
        roomId = ref.id;
      }
      escucharMensajes();
    } catch (e) {
      console.error('No se pudo iniciar el chat flotante:', e);
    }
  }

  function escucharMensajes() {
    const q = query(collection(db, 'chat_messages'), where('roomId', '==', roomId), limit(200));
    unsubMsgs = onSnapshot(q, (snap) => {
      msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      renderMensajes();
      actualizarBadge();
    }, (err) => {
      console.error('Error escuchando el chat flotante:', err);
    });
  }

  /* ── Contador de no leídos (por pestaña) ── */
  function ultimoVisto() {
    try { return Number(sessionStorage.getItem(VISTO_KEY) || 0); } catch (e) { return 0; }
  }
  function marcarComoLeido() {
    const ultimo = msgs[msgs.length - 1];
    const t = ultimo?.createdAt?.seconds ? ultimo.createdAt.seconds * 1000 : Date.now();
    try { sessionStorage.setItem(VISTO_KEY, String(t)); } catch (e) {}
    badge.classList.remove('show');
  }
  function actualizarBadge() {
    if (opened) { marcarComoLeido(); return; }
    const visto = ultimoVisto();
    const nuevos = msgs.filter((m) => {
      const t = m.createdAt?.seconds ? m.createdAt.seconds * 1000 : 0;
      return t > visto && m.uid !== ME?.uid;
    }).length;
    if (nuevos > 0) {
      badge.textContent = nuevos > 9 ? '9+' : String(nuevos);
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }

  /* ── Render de mensajes ── */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderMensajes() {
    const wasAtBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 90;
    msgsEl.innerHTML = '';

    if (!msgs.length) {
      msgsEl.innerHTML = `<p class="chat-w-empty">⌨️ Sé el primero en escribir algo por acá.</p>`;
      return;
    }

    msgs.forEach((m) => {
      const isOwn = m.uid === ME?.uid;
      const time = m.createdAt?.toDate
        ? m.createdAt.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        : '';
      const initials = (m.username || '?').slice(0, 2).toUpperCase();

      const div = document.createElement('div');
      div.className = `chat-w-msg${isOwn ? ' chat-w-msg--own' : ''}`;
      div.innerHTML = `
        <div class="chat-w-avatar">${m.photoURL ? `<img src="${esc(m.photoURL)}" alt="" />` : initials}</div>
        <div class="chat-w-body">
          <div class="chat-w-meta">
            <span class="chat-w-username">@${esc(m.username || 'anon')}</span>
            <span class="chat-w-time">${time}</span>
          </div>
          <div class="chat-w-bubble">${esc(m.text || '')}</div>
        </div>`;
      msgsEl.appendChild(div);
    });

    if (wasAtBottom || opened) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ── Envío ── */
  inpEl.addEventListener('input', () => {
    inpEl.style.height = 'auto';
    inpEl.style.height = Math.min(inpEl.scrollHeight, 90) + 'px';
    sendBtn.disabled = !inpEl.value.trim() || busy;
  });
  inpEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) enviar(); }
  });
  sendBtn.addEventListener('click', enviar);

  async function enviar() {
    const text = inpEl.value.trim();
    if (!text || busy || !ME || !roomId) return;
    busy = true;
    sendBtn.disabled = true;
    inpEl.value = ''; inpEl.style.height = 'auto';

    try {
      await addDoc(collection(db, 'chat_messages'), {
        roomId,
        uid: ME.uid, username: ME.username, photoURL: ME.photoURL || '',
        userRank: ME.rango || null,
        text,
        createdAt: serverTimestamp(),
        threadCount: 0,
      });
      await updateDoc(doc(db, 'chat_rooms', roomId), {
        lastMsg: text, lastAt: serverTimestamp(), msgCount: increment(1),
      });
    } catch (e) {
      console.error('Error enviando mensaje del chat flotante:', e);
      const div = document.createElement('div');
      div.className = 'chat-w-error';
      div.textContent = '⚠ No se pudo enviar. Revisá tu conexión.';
      msgsEl.appendChild(div);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      setTimeout(() => div.remove(), 3500);
    } finally {
      busy = false;
      sendBtn.disabled = !inpEl.value.trim();
    }
  }
}
