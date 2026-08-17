/* ============================================================
   ACADEMIA INDRHACK — Service Worker
   ============================================================
   Qué hace:
   1. Permite instalar el sitio como app (junto con manifest.json).
   2. Cachea lo esencial para que la app abra rápido y funcione
      con conexión inestable o sin conexión (fallback a offline.html).
   3. Maneja el toque sobre una notificación (abre/enfoca la app
      en la página que corresponda).

   Qué NO hace (a propósito, por ahora):
   - No usa Firebase Cloud Messaging ni push real con la app
     cerrada. Las notificaciones siguen mostrándose mientras la
     app/pestaña está abierta (foreground), ahora vía
     registration.showNotification() para que sean más confiables
     en Android. Si más adelante se agrega FCM, este archivo es
     el lugar para sumar el evento 'push'.

   Para forzar que los usuarios bajen una versión nueva de este
   archivo (por ejemplo, tras cambiar el cacheo), subí el número
   de CACHE_VERSION.
   ============================================================ */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `indrhack-${CACHE_VERSION}`;

// Lo mínimo para que la app "prenda" offline. A propósito es una
// lista corta: el resto de las páginas/recursos se van cacheando
// solos la primera vez que se visitan (ver stale-while-revalidate).
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/style.css',
  '/assets/img/logo-indrhack.png',
  '/assets/img/icons/icon-192.png',
  '/assets/img/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('[SW] No se pudo precachear todo el app shell:', err))
  );
  // No hacemos skipWaiting() acá a propósito: así una pestaña vieja
  // no se queda a mitad de camino con JS nuevo y HTML viejo. main.js
  // avisa al usuario y recién ahí se activa la versión nueva.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => Promise.all(
      nombres
        .filter((nombre) => nombre.startsWith('indrhack-') && nombre !== CACHE_NAME)
        .map((nombre) => caches.delete(nombre))
    )).then(() => self.clients.claim())
  );
});

// Permite que la página pida "activate ya" cuando el usuario confirma
// que quiere actualizar (ver botón de actualización en main.js).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

function esMismoOrigen(url) {
  return new URL(url).origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET, y solo mismo origen. Todo lo demás (Firebase, fuentes de
  // Google, CDNs) pasa directo a la red sin que el SW se meta: no
  // queremos cachear ni interceptar autenticación/datos en tiempo real.
  if (request.method !== 'GET' || !esMismoOrigen(request.url)) return;

  // Navegación (el usuario abre/cambia de página): red primero, y si
  // no hay conexión, cache de esa página o, en último caso, offline.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // Estáticos del propio sitio (css, js, imágenes, fuentes locales):
  // stale-while-revalidate → responde rápido con lo cacheado y en
  // paralelo pide la versión nueva para la próxima vez.
  event.respondWith(
    caches.match(request).then((cacheada) => {
      const enRed = fetch(request).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return res;
      }).catch(() => cacheada);
      return cacheada || enRed;
    })
  );
});

/* ── Notificaciones ────────────────────────────────────────
   Si notificaciones.js muestra el aviso vía
   registration.showNotification(), acá manejamos el toque:
   enfoca una pestaña abierta de la app o abre una nueva en el
   link que corresponda. ──────────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const targetUrl = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const client of lista) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (lista.length > 0 && 'focus' in lista[0]) {
        return lista[0].focus().then((c) => (c && c.navigate ? c.navigate(targetUrl) : c));
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
