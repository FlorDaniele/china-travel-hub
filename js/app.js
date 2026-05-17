/* ============================================================
   APP.JS — Entry point
   Tab switching, app initialisation.
   ============================================================ */

import { initOverview, initDesktopToggle, initDesktopNextUp, initDesktopBookings, initDesktopPacking, initItinerary, initDesktopCountdown, initDesktopReminders, initCarousel } from './overview.js';
import { initSidebar } from './sidebar.js';

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

/* ── Calendar: bold today's date ───────────────────────────── */

function initCalendar() {
  const today = new Date().toISOString().split('T')[0];
  const timeEl = document.querySelector(`.dk-cal-grid time[datetime="${today}"]`);
  if (timeEl) timeEl.style.fontWeight = '700';
}

/* ── Init ──────────────────────────────────────────────────── */

async function init() {
  activateTab('overview');
  initSidebar();
  initDesktopToggle();
  initDesktopBookings();
  initDesktopPacking();
  initItinerary();
  initCalendar();
  initDesktopReminders();
  await Promise.all([initOverview(), initDesktopNextUp(), initDesktopCountdown(), initCarousel()]);
}

init();
