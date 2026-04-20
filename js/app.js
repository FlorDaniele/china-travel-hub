/* ============================================================
   APP.JS — Entry point
   Tab switching, app initialisation.
   ============================================================ */

import { initOverview, initDesktopToggle, initDesktopNextUp } from './overview.js';

/* ── Tab switching ─────────────────────────────────────────── */

const navTabs  = document.querySelectorAll('.nav-tab');
const panels   = document.querySelectorAll('.tab-panel');

function activateTab(tabId) {
  navTabs.forEach(tab => {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  panels.forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `tab-${tabId}`);
  });
}

navTabs.forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});

/* ── Init ──────────────────────────────────────────────────── */

async function init() {
  activateTab('overview');
  initDesktopToggle();
  await Promise.all([initOverview(), initDesktopNextUp()]);
}

init();
