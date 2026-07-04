// ============================================================
// ACADEMIA INDRHACK — Cambio de tema (claro / oscuro)
// Se guarda la preferencia en localStorage y se aplica en toda la web.
// ============================================================
(function () {
  const STORAGE_KEY = 'indrhack-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#0d1117');
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggleTheme);
    });
  });

  window.IndrhackTheme = { toggle: toggleTheme, apply: applyTheme, current: currentTheme };
})();
