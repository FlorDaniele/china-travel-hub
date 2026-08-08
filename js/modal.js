/* ============================================================
   MODAL.JS — Reusable modal shell
   Manages overlay, card, open/close animations, focus trap,
   and Escape-key dismissal. Modal content and save logic live
   in the calling module (overview.js).
   ============================================================ */

let _overlay    = null;
let _card       = null;
let _trigger    = null;
let _keyHandler = null;
let _openRafId  = null;

/* ── Create DOM elements once, reuse on every open ─────────── */

function ensureDOM() {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.className = 'modal-overlay';
  _overlay.addEventListener('click', e => {
    if (e.target === _overlay) closeModal();
  });

  _card = document.createElement('div');
  _card.className = 'modal-card';
  _card.setAttribute('role',       'dialog');
  _card.setAttribute('aria-modal', 'true');

  document.body.appendChild(_overlay);
  document.body.appendChild(_card);
}

/* ── Focus trap ─────────────────────────────────────────────── */

function focusableEls() {
  return [...(_card?.querySelectorAll(
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) ?? [])];
}

function trapFocus(e) {
  const els   = focusableEls();
  const first = els[0];
  const last  = els[els.length - 1];
  if (!first) return;

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ── Open ───────────────────────────────────────────────────── */

/**
 * @param {object}   opts
 * @param {string}   opts.id        — prefix for child IDs (e.g. 'bk-modal')
 * @param {string}   opts.title     — heading shown in modal header
 * @param {string}   opts.bodyHTML  — inner HTML for the content area
 * @param {Function} opts.onSave    — called when Guardar is clicked
 * @param {string}   [opts.maxHeight] — override CSS max-height (e.g. 'min(90vh,600px)')
 * @param {string}   [opts.leftActionHTML] — optional markup rendered left of Save/Cancel (e.g. a Delete link)
 */
export function openModal({ id, title, bodyHTML, onSave, maxHeight, leftActionHTML }) {
  ensureDOM();
  _trigger = document.activeElement;

  if (maxHeight) {
    _card.style.maxHeight = maxHeight;
  } else {
    _card.style.maxHeight = '';
  }

  const titleId = `${id}-title`;
  _card.setAttribute('aria-labelledby', titleId);

  /* Tab order: inputs → Save (primary) → Cancel (secondary) → × close btn.
     CSS flex order swaps Save/Cancel visually: Cancel left, Save right. */
  _card.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title" id="${titleId}">${title}</h2>
    </div>
    <hr class="modal-divider" aria-hidden="true">
    <div class="modal-content">
      ${bodyHTML}
    </div>
    <div class="modal-actions${leftActionHTML ? ' modal-actions--with-left' : ''}">
      ${leftActionHTML ?? ''}
      <div class="modal-actions-right">
        <button class="modal-btn-primary"   type="button" id="${id}-guardar">Save</button>
        <button class="modal-btn-secondary" type="button" id="${id}-cerrar">Cancel</button>
      </div>
    </div>
    <button class="modal-close-btn" type="button" aria-label="Close modal">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6"  x2="6"  y2="18"/>
        <line x1="6"  y1="6"  x2="18" y2="18"/>
      </svg>
    </button>
  `;

  _card.querySelector(`#${id}-cerrar`).addEventListener('click', closeModal);
  _card.querySelector('.modal-close-btn').addEventListener('click', closeModal);
  _card.querySelector(`#${id}-guardar`).addEventListener('click', onSave);

  if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
  _keyHandler = e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab')    trapFocus(e);
  };
  document.addEventListener('keydown', _keyHandler);

  if (_openRafId !== null) {
    cancelAnimationFrame(_openRafId);
    _openRafId = null;
  }
  _overlay.classList.add('is-open');
  _openRafId = requestAnimationFrame(() => {
    _openRafId = null;
    _card.classList.add('is-open');
  });

  setTimeout(() => {
    (_card.querySelector('input') ?? _card.querySelector('select'))?.focus();
  }, 60);
}

/* ── Close ──────────────────────────────────────────────────── */

export function closeModal() {
  if (!_overlay) return;
  if (_openRafId !== null) {
    cancelAnimationFrame(_openRafId);
    _openRafId = null;
  }
  _overlay.classList.remove('is-open');
  _card.classList.remove('is-open');

  if (_keyHandler) {
    document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }

  const el = _trigger;
  _trigger = null;
  setTimeout(() => el?.focus(), 210);
}

/* ── Toast / Snackbar ───────────────────────────────────────── */

let _toastEl    = null;
let _toastTimer = null;

export function showToast(message) {
  if (_toastEl) {
    clearTimeout(_toastTimer);
    _toastEl.remove();
    _toastEl = null;
  }

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  _toastEl = el;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('toast--visible'));
  });

  _toastTimer = setTimeout(() => {
    el.classList.remove('toast--visible');
    el.addEventListener('transitionend', () => {
      el.remove();
      if (_toastEl === el) _toastEl = null;
    }, { once: true });
  }, 2500);
}
