// ============================================================
//  Academia Indrhack — Service Worker
//  Versión: 1.0.0
// ============================================================

const CACHE_NAME = 'indrhack-v1';

// Archivos que se guardan en caché para funcionar offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/registro.html',
  '/cursos.html',
  '/noticias.html',
  '/redes.html',
  '/panel-usuario.html',
  '/panel-admin.html',
  '/perfil.html',
  '/configuracion.html',
  '/ficha.html',
  '/titulos.html',
  '/css/style.css',
  '/js/main.js',
  '/js/particles.js',
  '/assets/img/logo-indrhack.png',
  '/manifest.json'
];

// ── INSTALL: guarda los archivos en caché ──────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: elimina cachés viejas ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ── FETCH: sirve desde caché, si no hay red usa caché ─────
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET
  if (event.request.method !== 'GET') return;

  // Las peticiones a Firebase siempre van a la red (no cachear auth/db)
  const url = event.request.url;
  if (
    url.includes('firebaseapp.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('firestore.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la red responde, actualiza la caché
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Sin red → sirve desde caché
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Si no hay caché y no hay red → index como fallback
          return caches.match('/index.html');
        });
      })
  );
});
