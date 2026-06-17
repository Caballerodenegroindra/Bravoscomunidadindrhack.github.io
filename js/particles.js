/* ============================================================
   ACADEMIA INDRHACK — Matrix Rain Effect (Light Theme)
   Números binarios cayendo, fondo blanco, color gris suave
   ============================================================ */

(function () {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Config
  const FONT_SIZE = 13;
  const CHARS = '01010110001010011010010100110100101001';
  const COLOR = 'rgba(0, 0, 0, 0.18)'; // gris muy suave sobre blanco
  const COLOR_BRIGHT = 'rgba(139, 0, 0, 0.22)'; // rojo muy suave para algunas columnas
  const SPEED = 0.5; // lento y sutil
  const FADE_ALPHA = 0.04; // cuánto se borra cada frame (más bajo = más estela)

  let columns = [];
  let animId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const numCols = Math.floor(canvas.width / FONT_SIZE);
    columns = [];
    for (let i = 0; i < numCols; i++) {
      columns.push({
        y: Math.random() * -canvas.height, // empezar en posiciones random arriba
        speed: SPEED + Math.random() * 0.3,
        bright: Math.random() < 0.08, // 8% columnas con tinte rojo
      });
    }
  }

  function draw() {
    // Fade suave - no borrar completamente para dejar estela
    ctx.fillStyle = 'rgba(248, 247, 244, ' + FADE_ALPHA + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = FONT_SIZE + 'px monospace';

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;
      const char = CHARS[Math.floor(Math.random() * CHARS.length)];

      ctx.fillStyle = col.bright ? COLOR_BRIGHT : COLOR;
      ctx.fillText(char, x, col.y);

      // Avanzar la columna
      col.y += FONT_SIZE * col.speed;

      // Reiniciar cuando llega al fondo
      if (col.y > canvas.height + FONT_SIZE) {
        col.y = Math.random() * -200;
        col.speed = SPEED + Math.random() * 0.3;
        col.bright = Math.random() < 0.08;
      }
    }

    animId = requestAnimationFrame(draw);
  }

  function init() {
    resize();
    if (animId) cancelAnimationFrame(animId);
    draw();
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    init();
  });

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
