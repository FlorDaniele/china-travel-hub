/* ============================================================
   SIDEBAR.JS — Reusable slide-in panel / mobile bottom sheet
   Usage: openSidebar(title, contentHTML)
   ============================================================ */

let _triggerEl = null;

function _overlay()  { return document.getElementById('sidebar-overlay'); }
function _panel()    { return document.getElementById('sidebar-panel');   }
function _titleEl()  { return document.getElementById('sidebar-title');   }
function _contentEl(){ return document.getElementById('sidebar-content'); }
function _closeBtn() { return document.getElementById('sidebar-close');   }

/* ── Open ──────────────────────────────────────────────────── */

export function openSidebar(title, contentHTML) {
  const overlay  = _overlay();
  const panel    = _panel();
  const titleEl  = _titleEl();
  const contentEl = _contentEl();

  if (!overlay || !panel) return;

  // Remember what triggered the sidebar so focus returns on close
  _triggerEl = document.activeElement;

  titleEl.textContent  = title;
  contentEl.innerHTML  = contentHTML;
  panel.setAttribute('aria-label', title);

  // Remove hidden so the element is in the layout, then animate on next tick
  overlay.classList.remove('hidden');
  panel.removeAttribute('hidden');

  // Force a paint before adding .is-open so the CSS transition fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      panel.classList.add('is-open');
    });
  });

  // Move focus into the sidebar
  _closeBtn()?.focus();

  // Trap focus inside the panel
  panel.addEventListener('keydown', _trapFocus);
  document.addEventListener('keydown', _handleEscape);
}

/* ── Close ─────────────────────────────────────────────────── */

export function closeSidebar() {
  const overlay = _overlay();
  const panel   = _panel();

  if (!overlay || !panel) return;

  overlay.classList.remove('is-open');
  panel.classList.remove('is-open');

  // Hide overlay after transition ends (avoids click-through during animation)
  overlay.addEventListener('transitionend', () => {
    overlay.classList.add('hidden');
  }, { once: true });

  panel.removeEventListener('keydown', _trapFocus);
  document.removeEventListener('keydown', _handleEscape);

  // Return focus to the element that triggered the sidebar
  _triggerEl?.focus();
  _triggerEl = null;
}

/* ── Keyboard handlers ─────────────────────────────────────── */

function _handleEscape(e) {
  if (e.key === 'Escape') closeSidebar();
}

function _trapFocus(e) {
  if (e.key !== 'Tab') return;

  const panel    = _panel();
  const focusable = Array.from(
    panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.disabled && el.offsetParent !== null);

  if (focusable.length === 0) { e.preventDefault(); return; }

  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ── Init ──────────────────────────────────────────────────── */

export function initSidebar() {
  _overlay()?.addEventListener('click', closeSidebar);
  _closeBtn()?.addEventListener('click', closeSidebar);
}
