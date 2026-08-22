/* ============================================================
   ACADEMIA INDRA — Banner "Instalar app"
   ============================================================
   - Android / desktop (Chrome, Edge, Samsung Internet, etc.):
     escucha 'beforeinstallprompt' y muestra un banner. Al
     tocar "Instalar" dispara el cuadro nativo del navegador.
   - iOS / iPadOS: Safari no dispara 'beforeinstallprompt', así
     que se muestran instrucciones manuales (Compartir → Agregar
     a inicio) en su lugar.
   - Si la app ya corre instalada (modo standalone), no muestra
     nada. Si el usuario cierra el banner, no vuelve a insistir
     hasta pasados unos días (guardado en localStorage).
   ============================================================ */

const CLAVE_DESCARTE = 'indrhack_pwa_install_oculto_hasta';
const DIAS_ANTES_DE_REINSISTIR = 7;

function estaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true; // Safari / iOS
}

function fueDescartadoRecientemente() {
  try {
    const hasta = Number(localStorage.getItem(CLAVE_DESCARTE) || 0);
    return Date.now() < hasta;
  } catch (_) {
    return false;
  }
}

function marcarDescartado() {
  try {
    const hasta = Date.now() + DIAS_ANTES_DE_REINSISTIR * 24 * 60 * 60 * 1000;
    localStorage.setItem(CLAVE_DESCARTE, String(hasta));
  } catch (_) { /* si el storage no está disponible, no pasa nada grave */ }
}

function esIOS() {
  const ua = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua)
    // iPadOS 13+ se presenta como "Mac" pero soporta touch:
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function crearBannerInstalacion({ descripcion, textoBoton, onAceptar }) {
  const banner = document.createElement('div');
  banner.className = 'pwa-banner';
  banner.innerHTML = `
    <button class="pwa-banner__close" type="button" aria-label="Cerrar">✕</button>
    <img src="/assets/img/icons/icon-192.png" alt="" class="pwa-banner__icon" />
    <div class="pwa-banner__text">
      <p class="pwa-banner__title">Instalá Academia Indra</p>
      <p class="pwa-banner__desc">${descripcion}</p>
    </div>
    <div class="pwa-banner__actions">
      <button class="btn btn--primary btn--small pwa-banner__accept" type="button">${textoBoton}</button>
    </div>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('is-visible'));

  const cerrar = () => {
    banner.classList.remove('is-visible');
    marcarDescartado();
    setTimeout(() => banner.remove(), 250);
  };

  banner.querySelector('.pwa-banner__close').addEventListener('click', cerrar);
  banner.querySelector('.pwa-banner__accept').addEventListener('click', () => {
    onAceptar();
    cerrar();
  });

  return banner;
}

document.addEventListener('DOMContentLoaded', () => {
  if (estaInstalada() || fueDescartadoRecientemente()) return;

  let promptDiferido = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptDiferido = event;

    crearBannerInstalacion({
      descripcion: 'Accedé más rápido y recibí avisos, como una app.',
      textoBoton: 'Instalar',
      onAceptar: () => {
        if (!promptDiferido) return;
        promptDiferido.prompt();
        promptDiferido.userChoice.finally(() => { promptDiferido = null; });
      },
    });
  });

  if (esIOS()) {
    crearBannerInstalacion({
      descripcion: 'Tocá el ícono Compartir de Safari y elegí "Agregar a inicio".',
      textoBoton: 'Entendido',
      onAceptar: () => {},
    });
  }
});
