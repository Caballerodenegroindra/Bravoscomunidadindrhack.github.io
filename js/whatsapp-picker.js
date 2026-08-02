/* ============================================================
   ACADEMIA INDRHACK — Selector de app de WhatsApp
   Antes de abrir un enlace de "unirme al grupo", pregunta con qué
   WhatsApp abrirlo (normal o Business), para gente que tiene las
   dos apps instaladas en el mismo teléfono.

   En Android podemos apuntar directo a cada app instalada con un
   enlace "intent://". En iPhone / escritorio, la web no tiene forma
   de elegir la app: en esos casos avisamos y dejamos que el propio
   teléfono pregunte (si tiene las dos instaladas).
   ============================================================ */

function extraerNumero(waLink) {
  const m = (waLink || '').match(/(?:wa\.me\/|phone=)(\d+)/);
  return m ? m[1] : null;
}

function construirIntent(numero, paquete) {
  return `intent://send?phone=${numero}#Intent;scheme=whatsapp;package=${paquete};S.browser_fallback_url=${encodeURIComponent('https://wa.me/' + numero)};end`;
}

let modalEl = null;
function getModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.id = 'wa-picker-modal';
  modalEl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;align-items:center;justify-content:center;padding:1.5rem;';
  modalEl.innerHTML = `
    <div style="background:#1c1c1a;border:1px solid rgba(255,255,255,0.14);border-radius:18px;padding:1.75rem 1.5rem;max-width:340px;width:100%;text-align:center;">
      <div style="font-size:2rem;margin-bottom:0.5rem;">💬</div>
      <h2 style="color:#fff;margin:0 0 0.4rem;font-size:1.05rem;">¿Con qué WhatsApp querés unirte?</h2>
      <p id="wa-picker-note" style="color:#ccc;font-size:0.82rem;margin-bottom:1.25rem;line-height:1.5;"></p>
      <button type="button" id="wa-picker-normal" style="display:block;width:100%;background:#25D366;color:#fff;font-weight:700;font-size:0.95rem;padding:0.8rem 1rem;border:none;border-radius:12px;cursor:pointer;margin-bottom:0.6rem;">📱 WhatsApp</button>
      <button type="button" id="wa-picker-business" style="display:block;width:100%;background:#1F7A5C;color:#fff;font-weight:700;font-size:0.95rem;padding:0.8rem 1rem;border:none;border-radius:12px;cursor:pointer;margin-bottom:0.6rem;">💼 WhatsApp Business</button>
      <button type="button" id="wa-picker-cancel" style="background:none;border:1px solid #444;color:#888;padding:0.55rem 1.4rem;border-radius:10px;cursor:pointer;font-size:0.85rem;">Cancelar</button>
    </div>`;
  document.body.appendChild(modalEl);
  return modalEl;
}

/**
 * Muestra el selector y, según lo que elija la persona, abre el enlace
 * de WhatsApp con la app correspondiente (o el enlace normal si no se
 * puede diferenciar en este dispositivo).
 */
export function preguntarWhatsApp(link) {
  if (!link || link === '#') return;
  const modal = getModal();
  const numero = extraerNumero(link);
  const esAndroid = /Android/i.test(navigator.userAgent);
  const note = modal.querySelector('#wa-picker-note');
  const btnNormal = modal.querySelector('#wa-picker-normal');
  const btnBusiness = modal.querySelector('#wa-picker-business');
  const btnCancel = modal.querySelector('#wa-picker-cancel');

  note.textContent = (esAndroid && numero)
    ? 'Elegí la app y se abre directo, si la tenés instalada en este teléfono.'
    : 'En este dispositivo no podemos elegir la app automáticamente: se va a abrir el enlace y, si tenés las dos apps instaladas, tu teléfono te va a preguntar cuál usar.';

  const abrir = (paquete) => {
    modal.style.display = 'none';
    if (esAndroid && numero) {
      window.location.href = construirIntent(numero, paquete);
    } else {
      window.open(link, '_blank', 'noopener');
    }
  };

  btnNormal.onclick = () => abrir('com.whatsapp');
  btnBusiness.onclick = () => abrir('com.whatsapp.w4b');
  btnCancel.onclick = () => { modal.style.display = 'none'; };

  modal.style.display = 'flex';
}

/**
 * Engancha automáticamente el selector a cualquier enlace de WhatsApp
 * dentro de un contenedor (por defecto, todo el documento).
 */
export function activarSelectorWhatsApp(root = document) {
  root.querySelectorAll('a[data-wa-picker]').forEach((a) => {
    if (a.dataset.waPickerBound) return;
    a.dataset.waPickerBound = '1';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      preguntarWhatsApp(a.getAttribute('href'));
    });
  });
}
