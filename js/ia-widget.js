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
        <span id="ia-widget-header-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C8.4 3 5.8 5.8 5.8 9.4c0 1.9.6 3.3 1.15 4.5L4 20.5h16L17.05 13.9c.55-1.2 1.15-2.6 1.15-4.5C18.2 5.8 15.6 3 12 3z"/><path d="M9.3 13.6c-.35-1.7-.2-3.1.35-4.2M14.7 13.6c.35-1.7.2-3.1-.35-4.2"/><circle cx="9.7" cy="12.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="14.3" cy="12.2" r="0.9" fill="currentColor" stroke="none"/></svg>
          Asistente Indrhack
        </span>
        <div id="ia-widget-header-actions">
          <a href="ia-asistente.html" id="ia-widget-expand" title="Abrir chat completo">⤢</a>
          <button type="button" id="ia-widget-minimize" aria-label="Minimizar">⌄</button>
        </div>
      </div>
      <div id="ia-widget-msgs"></div>
    </div>
    <div id="ia-widget-dock">
      <button type="button" id="ia-widget-avatar" aria-label="Abrir asistente IA" title="Preguntale a la IA">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3C8.4 3 5.8 5.8 5.8 9.4c0 1.9.6 3.3 1.15 4.5L4 20.5h16L17.05 13.9c.55-1.2 1.15-2.6 1.15-4.5C18.2 5.8 15.6 3 12 3z"/><path d="M9.3 13.6c-.35-1.7-.2-3.1.35-4.2M14.7 13.6c.35-1.7.2-3.1-.35-4.2"/><circle cx="9.7" cy="12.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="14.3" cy="12.2" r="0.9" fill="currentColor" stroke="none"/></svg>
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

  const dockEl   = wrap.querySelector('#ia-widget-dock');
  const tabbarEl = document.querySelector('.tabbar');

  function ajustarAlturaPanel() {
    const vv  = window.visualViewport;
    const vpH = (vv && vv.height) || window.innerHeight;
    // Nunca debe pedir más alto de lo que realmente cabe arriba del dock
    // (con o sin teclado abierto): si no, el panel se corre hacia arriba
    // y tapa su propio encabezado (el botón de minimizar, el "⌄").
    const disponible = Math.max(120, vpH - dockEl.offsetHeight - 12);
    const maxDeseado = Math.min(vpH * 0.65, 520);
    panel.style.height = `${Math.min(disponible, maxDeseado)}px`;
  }

  // En Android/iOS, cuando aparece el teclado, el navegador achica el
  // "visual viewport" pero los elementos position:fixed suelen seguir
  // anclados al viewport de layout (que no cambia), así que quedan
  // flotando a mitad de pantalla o tapados por el teclado. Para que el
  // dock del chat Y la tabbar de navegación queden siempre pegados justo
  // arriba del teclado (sin hueco y sin que salten), los desplazamos a
  // mano según lo que el teclado esté tapando.
  function syncConTeclado() {
    const vv = window.visualViewport;
    if (!vv) return;
    const tapado = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    const t = tapado > 1 ? `translateY(-${tapado}px)` : '';
    wrap.style.transform = t;
    if (tabbarEl) tabbarEl.style.transform = t;
    ajustarAlturaPanel();
  }

  ajustarAlturaPanel();
  window.addEventListener('resize', syncConTeclado);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncConTeclado);
    window.visualViewport.addEventListener('scroll', syncConTeclado);
  }

  let scrollY = 0;
  function lockBackgroundScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  function unlockBackgroundScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  function openPanel() {
    if (opened) return;
    opened = true;
    wrap.classList.add('ia-widget--open');
    ping.classList.remove('show');
    syncConTeclado();
    lockBackgroundScroll();
    // El teclado tarda un poco en aparecer/desaparecer en móvil; volvemos
    // a sincronizar unos instantes después para no quedar desalineados.
    setTimeout(syncConTeclado, 300);
    if (!history.length) greet();
  }
  function closePanel() {
    if (!opened) return;
    opened = false;
    wrap.classList.remove('ia-widget--open');
    unlockBackgroundScroll();
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
    // Se guarda en el historial para que, mientras siga en la misma
    // pestaña (abra y cierre el panel las veces que quiera, navegue
    // entre páginas, etc.), no se vuelva a repetir el saludo.
    history.push({ role: 'assistant', content: saludo });
    saveHistory();
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
