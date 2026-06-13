/* ============================================================
   ACADEMIA INDRHACK — Fondo de partículas
   Efecto de laboratorio digital: puntos conectados en rojo
   oscuro y destellos en azul neón sobre fondo negro.
   ============================================================ */

(function () {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReducedMotion) return;

  let particles = [];
  let width, height;

  const CONFIG = {
    density: 0.00009, // partículas por px²
    maxLinkDistance: 140,
    speed: 0.25,
    colors: ['rgba(139, 0, 0, 0.8)', 'rgba(0, 191, 255, 0.6)', 'rgba(232, 232, 232, 0.35)'],
    lineColor: 'rgba(139, 0, 0, 0.12)',
  };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initParticles();
  }

  function initParticles() {
    const count = Math.floor(width * height * CONFIG.density);
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * CONFIG.speed,
      vy: (Math.random() - 0.5) * CONFIG.speed,
      r: Math.random() * 1.6 + 0.6,
      color: CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)],
    }));
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    // Conexiones
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.maxLinkDistance) {
          ctx.strokeStyle = CONFIG.lineColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Partículas
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
    }

    requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize);
  resize();
  step();
})();
