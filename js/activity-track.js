/* ============================================================
   ACADEMIA INDRHACK — Registro liviano de actividad del usuario
   ============================================================
   Guarda en localStorage (por dispositivo) qué secciones ya visitó
   el usuario mientras navega la academia. No es un dato crítico ni
   sensible: solo sirve para que "Mi Panel" sepa qué función todavía
   NO probó y se la sugiera ahí, en vez de repetir siempre lo mismo.
   Es una pista de personalización liviana, nunca se usa para nada
   importante (permisos, puntos, etc.).
   ============================================================ */

const KEY = 'indrhack-visitas';

/** Marca que el usuario estuvo en una sección (ej: 'chat', 'ia-asistente'). */
export function marcarVisita(seccion) {
  try {
    const visitas = JSON.parse(localStorage.getItem(KEY) || '{}');
    visitas[seccion] = (visitas[seccion] || 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(visitas));
  } catch (e) { /* localStorage no disponible: no pasa nada, se ignora */ }
}

/** Devuelve el mapa completo de visitas por sección. */
export function obtenerVisitas() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
}
