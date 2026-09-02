/* ============================================================
   ACADEMIA INDRA — Configuracion de front (no secreta)
   ============================================================
   Un solo lugar para las URLs de servicios propios. Nada de
   claves ni tokens: eso vive en el proxy (repo academiaindra-proxy),
   nunca en este JS publico.
   ============================================================ */

/* Proxy de administracion y de IA (Cloudflare Worker).
   - Ahora: la URL workers.dev del Worker desplegado.
   - Si mas adelante activas el dominio propio (admin.academiaindra.com),
     cambia solo esta linea.
   El asistente de IA (js/ia-core.js) y el Centro de Control del
   panel admin llaman a esta base. */
export const PROXY_BASE_URL = 'https://academiaindra-proxy.indrhack010101moderador.workers.dev';

/* Deriva las rutas concretas. */
export const IA_CHAT_URL = `${PROXY_BASE_URL}/ia/chat`;
export const CONTROL_URL = `${PROXY_BASE_URL}/control`;
