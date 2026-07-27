/* ============================================================
   ACADEMIA INDRHACK — Dock del asistente IA (global, siempre visible)
   ============================================================
   Se incluye en TODAS las páginas del sitio (salvo el chat de
   página completa, ia-asistente.html, para no duplicar). A
   diferencia de una burbuja escondida en la esquina, esto es una
   barra fija tipo "compositor de mensaje" (como un chat real):
   siempre a la vista, lista para escribir al instante. Al tocarla
   o escribir, se despliega el panel de conversación arriba.

   Además:
   - Sabe en qué página está el usuario y le ofrece un consejo
     contextual apenas abre el panel por primera vez ahí.
   - Conoce su progreso real (clases aprobadas, puntos, rango) y
     sus quizzes pendientes de revisión.
   - Conoce el catálogo completo de cursos y los enlaces oficiales.
   - Mantiene el historial de la charla mientras navega el sitio
     (usa sessionStorage, se resetea si cierra la pestaña).
   ============================================================ */

import { onSessionChange } from './auth.js';
import {
  cargarCursos, buildCursosContext,
  cargarProgresoUsuario, buildProgresoContext,
  cargarQuizzesPendientes, buildQuizzesPendientesContext,
  cargarConfigSitio, buildConfigContext,
  buildSystemPrompt, askIA, nombrePagina, consejoPagina,
} from './ia-core.js';

// URL base del sitio (sirve para armar enlaces compartibles absolutos,
// funciona tanto si está en la raíz como en una subcarpeta).
const BASE_URL = location.origin + location.pathname.replace(/[^/]*$/, '');

// En el chat de página completa ya está la IA a pantalla completa,
// así que ahí no mostramos el dock para no duplicar.
const ARCHIVO_ACTUAL = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
if (ARCHIVO_ACTUAL !== 'ia-asistente.html') {
  document.addEventListener('DOMContentLoaded', initWidget);
}

const HIST_KEY = 'ia-widget-history';
// Recordamos, por pestaña, en qué páginas ya se mostró el saludo
// proactivo para no repetirlo cada vez que el usuario navega.
const SALUDADO_KEY = 'ia-widget-saludado';

function initWidget() {
  document.body.classList.add('ia-dock-active');

  let userInfo    = null;
  let cursos      = [];
  let progreso    = [];
  let pendientes  = [];
  let config      = {};
  let history     = safeLoadHistory();
  let busy        = false;
  let opened      = false;

  onSessionChange((profile) => {
    userInfo = profile;
    if (profile) {
      cargarProgresoUsuario(profile.uid).then((p) => { progreso = p; });
      cargarQuizzesPendientes(profile.uid).then((p) => { pendientes = p; });
    }
  });
  cargarCursos().then((c) => { cursos = c; });
  cargarConfigSitio().then((c) => { config = c; });

  /* ── DOM ── */
  const wrap = document.createElement('div');
  wrap.id = 'ia-widget';
  wrap.innerHTML = `
    <div id="ia-widget-panel" role="dialog" aria-label="Asistente de IA">
      <div id="ia-widget-header">
        <span>🤖 Asistente Indrhack</span>
        <div id="ia-widget-header-actions">
          <a href="ia-asistente.html" id="ia-widget-expand" title="Abrir chat completo">⤢</a>
          <button type="button" id="ia-widget-minimize" aria-label="Minimizar">⌄</button>
        </div>
      </div>
      <div id="ia-widget-msgs"></div>
    </div>
    <div id="ia-widget-dock">
      <button type="button" id="ia-widget-avatar" aria-label="Abrir asistente IA" title="Preguntale a la IA">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 012 2v1h1a3 3 0 013 3v1h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a3 3 0 01-3 3H8a3 3 0 01-3-3v-1H4a1 1 0 01-1-1v-3a1 1 0 011-1h1V8a3 3 0 013-3h1V4a2 2 0 012-2z"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
        <span id="ia-widget-ping"></span>
      </button>
      <textarea id="ia-widget-input" placeholder="Preguntale algo a la IA sobre esta página…" rows="1"></textarea>
      <button type="button" id="ia-widget-send" aria-label="Enviar">➤</button>
    </div>`;
  document.body.appendChild(wrap);

  const panel   = wrap.querySelector('#ia-widget-panel');
  const avatar  = wrap.querySelector('#ia-widget-avatar');
  const minBt   = wrap.querySelector('#ia-widget-minimize');
  const ping    = wrap.querySelector('#ia-widget-ping');
  const msgsEl  = wrap.querySelector('#ia-widget-msgs');
  const inpEl   = wrap.querySelector('#ia-widget-input');
  const sendBtn = wrap.querySelector('#ia-widget-send');

  renderHistory();

  // Si ya hay charla previa en esta pestaña, no hace falta el "ping"
  // invitando a abrir: mostramos el punto solo cuando es la primera
  // vez que el dock aparece en esta página durante la sesión.
  if (!history.length && !yaSaludadoEnEstaPagina()) {
    ping.classList.add('show');
  }

  function openPanel() {
    if (opened) return;
    opened = true;
    wrap.classList.add('ia-widget--open');
    ping.classList.remove('show');
    if (!history.length) greet();
  }
  function closePanel() {
    opened = false;
    wrap.classList.remove('ia-widget--open');
  }

  avatar.addEventListener('click', () => {
    if (opened) closePanel(); else openPanel();
  });
  inpEl.addEventListener('focus', openPanel);
  minBt.addEventListener('click', closePanel);

  inpEl.addEventListener('input', () => {
    inpEl.style.height = 'auto';
    inpEl.style.height = Math.min(inpEl.scrollHeight, 90) + 'px';
    sendBtn.disabled = !inpEl.value.trim() || busy;
  });
  inpEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) send(); }
  });
  sendBtn.addEventListener('click', () => { openPanel(); send(); });

  function greet() {
    marcarSaludadoEnEstaPagina();
    const donde  = nombrePagina(location.pathname);
    const tip    = consejoPagina(location.pathname);
    const nombre = userInfo ? (userInfo.displayName || userInfo.username) : null;

    let saludo;
    if (nombre && donde) {
      saludo = `¡Hola, **${nombre}**! Te veo en **${donde}**. ${tip || '¿En qué te ayudo?'}`;
    } else if (donde) {
      saludo = `¡Hola! Estás en **${donde}**. ${tip || '¿En qué te ayudo?'}`;
    } else {
      saludo = '¡Hola! Preguntame lo que necesites sobre la academia.';
    }
    appendMsg('assistant', fmt(saludo));
  }

  function esc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmt(text) {
    return esc(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function appendMsg(role, html) {
    const isUser = role === 'user';
    const div = document.createElement('div');
    div.className = `ia-w-msg ${isUser ? 'ia-w-msg--u' : 'ia-w-msg--ia'}`;
    div.innerHTML = html;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const d = document.createElement('div');
    d.className = 'ia-w-msg ia-w-msg--ia';
    d.id = 'ia-w-typing';
    d.innerHTML = `<span class="ia-w-dots"><span></span><span></span><span></span></span>`;
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function rmTyping() { document.getElementById('ia-w-typing')?.remove(); }

  function renderHistory() {
    history.forEach((m) => appendMsg(m.role === 'user' ? 'user' : 'assistant', fmt(m.content)));
  }

  async function send() {
    const text = inpEl.value.trim();
    if (!text || busy) return;
    busy = true;
    inpEl.value = ''; inpEl.style.height = 'auto'; sendBtn.disabled = true;

    appendMsg('user', esc(text));
    history.push({ role: 'user', content: text });
    saveHistory();
    showTyping();

    const systemPrompt = buildSystemPrompt({
      userInfo,
      cursosCtx: buildCursosContext(cursos, BASE_URL),
      progresoCtx: buildProgresoContext(progreso),
      pendientesCtx: buildQuizzesPendientesContext(pendientes),
      paginaCtx: nombrePagina(location.pathname),
      configCtx: buildConfigContext(config),
    });

    try {
      const reply = await askIA(systemPrompt, history);
      history.push({ role: 'assistant', content: reply });
      saveHistory();
      rmTyping();
      appendMsg('assistant', fmt(reply));
    } catch (e) {
      rmTyping();
      console.error('Error del asistente IA:', e);
      appendMsg('assistant', `<strong style="color:#b3382c">⚠ Error de conexión.</strong><br><span style="font-size:0.75rem;opacity:0.75">${esc(e.message || String(e))}</span>`);
    } finally {
      busy = false;
      sendBtn.disabled = !inpEl.value.trim();
    }
  }

  function saveHistory() {
    try { sessionStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-30))); } catch (e) {}
  }
}

function safeLoadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; }
}

function yaSaludadoEnEstaPagina() {
  try {
    const lista = JSON.parse(sessionStorage.getItem(SALUDADO_KEY) || '[]');
    return lista.includes(ARCHIVO_ACTUAL);
  } catch (e) { return false; }
}
function marcarSaludadoEnEstaPagina() {
  try {
    const lista = JSON.parse(sessionStorage.getItem(SALUDADO_KEY) || '[]');
    if (!lista.includes(ARCHIVO_ACTUAL)) lista.push(ARCHIVO_ACTUAL);
    sessionStorage.setItem(SALUDADO_KEY, JSON.stringify(lista));
  } catch (e) {}
}
