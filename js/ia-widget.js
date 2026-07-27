/* ============================================================
   ACADEMIA INDRHACK — Burbuja flotante del asistente IA (global)
   ============================================================
   Se incluye en TODAS las páginas del sitio. A diferencia de
   ia-asistente.html (chat de página completa), esto es una
   burbuja chica que:
   - Sabe en qué página está el usuario.
   - Conoce su progreso real (clases aprobadas, puntos, rango).
   - Conoce el catálogo completo de cursos.
   - Mantiene el historial de la charla mientras navega el sitio
     (usa sessionStorage, se resetea si cierra la pestaña).
   ============================================================ */

import { onSessionChange } from './auth.js';
import {
  cargarCursos, buildCursosContext,
  cargarProgresoUsuario, buildProgresoContext,
  buildSystemPrompt, askGemini, nombrePagina,
} from './ia-core.js';

// En el chat de página completa ya está la IA a pantalla completa,
// así que ahí no mostramos la burbuja para no duplicar.
const ARCHIVO_ACTUAL = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
if (ARCHIVO_ACTUAL !== 'ia-asistente.html') {
  document.addEventListener('DOMContentLoaded', initWidget);
}

const HIST_KEY = 'ia-widget-history';

function initWidget() {
  let userInfo  = null;
  let cursos    = [];
  let progreso  = [];
  let history   = safeLoadHistory();
  let busy      = false;

  onSessionChange((profile) => {
    userInfo = profile;
    if (profile) cargarProgresoUsuario(profile.uid).then((p) => { progreso = p; });
  });
  cargarCursos().then((c) => { cursos = c; });

  /* ── DOM ── */
  const wrap = document.createElement('div');
  wrap.id = 'ia-widget';
  wrap.innerHTML = `
    <div id="ia-widget-panel" role="dialog" aria-label="Asistente de IA">
      <div id="ia-widget-header">
        <span>🤖 Asistente Indrhack</span>
        <div id="ia-widget-header-actions">
          <a href="ia-asistente.html" id="ia-widget-expand" title="Abrir chat completo">⤢</a>
          <button type="button" id="ia-widget-close" aria-label="Cerrar">✕</button>
        </div>
      </div>
      <div id="ia-widget-msgs"></div>
      <div id="ia-widget-inputbar">
        <textarea id="ia-widget-input" placeholder="Preguntame algo…" rows="1"></textarea>
        <button type="button" id="ia-widget-send" aria-label="Enviar">➤</button>
      </div>
    </div>
    <button type="button" id="ia-widget-btn" aria-label="Abrir asistente IA" title="Preguntale a la IA">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 012 2v1h1a3 3 0 013 3v1h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a3 3 0 01-3 3H8a3 3 0 01-3-3v-1H4a1 1 0 01-1-1v-3a1 1 0 011-1h1V8a3 3 0 013-3h1V4a2 2 0 012-2z"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
    </button>`;
  document.body.appendChild(wrap);

  const panel   = wrap.querySelector('#ia-widget-panel');
  const btn     = wrap.querySelector('#ia-widget-btn');
  const closeBt = wrap.querySelector('#ia-widget-close');
  const msgsEl  = wrap.querySelector('#ia-widget-msgs');
  const inpEl   = wrap.querySelector('#ia-widget-input');
  const sendBtn = wrap.querySelector('#ia-widget-send');

  renderHistory();

  btn.addEventListener('click', () => {
    wrap.classList.toggle('ia-widget--open');
    if (wrap.classList.contains('ia-widget--open')) {
      inpEl.focus();
      if (!history.length) greet();
    }
  });
  closeBt.addEventListener('click', () => wrap.classList.remove('ia-widget--open'));

  inpEl.addEventListener('input', () => {
    inpEl.style.height = 'auto';
    inpEl.style.height = Math.min(inpEl.scrollHeight, 90) + 'px';
    sendBtn.disabled = !inpEl.value.trim() || busy;
  });
  inpEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) send(); }
  });
  sendBtn.addEventListener('click', send);

  function greet() {
    const donde = nombrePagina(location.pathname);
    const saludo = donde
      ? `¡Hola! Veo que estás en **${donde}**. ¿En qué te ayudo?`
      : '¡Hola! Preguntame lo que necesites sobre la academia.';
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
      cursosCtx: buildCursosContext(cursos),
      progresoCtx: buildProgresoContext(progreso),
      paginaCtx: nombrePagina(location.pathname),
    });

    try {
      const reply = await askGemini(systemPrompt, history);
      history.push({ role: 'assistant', content: reply });
      saveHistory();
      rmTyping();
      appendMsg('assistant', fmt(reply));
    } catch (e) {
      rmTyping();
      appendMsg('assistant', '<strong style="color:#b3382c">⚠ Error de conexión.</strong> Probá de nuevo en un momento.');
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
