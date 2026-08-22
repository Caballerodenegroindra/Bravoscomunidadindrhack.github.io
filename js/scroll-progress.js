/* ============================================================
   ACADEMIA INDRA — Indicador de scroll
   ============================================================
   Una barra fina y fija en el borde derecho de la pantalla que
   muestra cuánto se puede seguir bajando (o subiendo): el "riel"
   completo es el largo total de la página, y el segmento dorado
   que se mueve dentro es la porción que se está viendo ahora.
   Sirve para no perderse en páginas largas (cursos, chat, ayuda).
   ============================================================ */

function initScrollProgress() {
  // Ya inicializado (por si el script se carga dos veces en una página).
  if (document.getElementById('scroll-progress')) return;

  const track = document.createElement('div');
  track.id = 'scroll-progress';
  track.setAttribute('aria-hidden', 'true');
  track.innerHTML = '<div id="scroll-progress__thumb"></div>';
  document.body.appendChild(track);

  const thumb = track.querySelector('#scroll-progress__thumb');
  let ticking = false;

  function actualizar() {
    ticking = false;
    const doc = document.documentElement;
    const alturaTotal = doc.scrollHeight - doc.clientHeight;

    // Página sin scroll real: no mostramos el riel para no ensuciar
    // pantallas cortas (formularios, pantallas de login, etc.).
    if (alturaTotal <= 40) {
      track.style.display = 'none';
      return;
    }
    track.style.display = '';

    const trackH = track.clientHeight;
    const visibleRatio = Math.min(1, doc.clientHeight / doc.scrollHeight);
    const thumbH = Math.max(24, trackH * visibleRatio);
    const scrollRatio = Math.min(1, Math.max(0, doc.scrollTop / alturaTotal));
    const maxTop = trackH - thumbH;

    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${maxTop * scrollRatio}px)`;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(actualizar);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // El contenido dinámico (cursos, chat, listas) cambia el alto de la
  // página después de cargar datos de Firestore; nos fijamos y
  // recalculamos para que el riel no quede desactualizado.
  new MutationObserver(onScroll).observe(document.body, { childList: true, subtree: true });

  actualizar();
}

document.addEventListener('DOMContentLoaded', initScrollProgress);
