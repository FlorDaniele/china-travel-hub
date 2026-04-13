/**
 * city.js — City page overlay: open/close animation, inner tabs,
 *            and placeholder content for each city panel.
 *
 * Exports:
 *   initCityPage()        — wires back button + inner tabs
 *   openCityPage(cityId)  — slides the overlay up
 *   closeCityPage()       — slides the overlay back down
 */

import { CITIES } from './overview.js';

// ── State ─────────────────────────────────────────────────────

let _lastFocusedCard = null; // element to return focus to on close
let _savedScrollY    = 0;    // restore body scroll position on close

// ── Icon helper ───────────────────────────────────────────────

function icon(name, opts = {}) {
  if (window.lucide && window.lucide.icons[name]) {
    return window.lucide.icons[name].toSvg({
      'stroke-width': 1.75,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      ...opts,
    });
  }
  return '';
}

// ── Placeholder content builders ─────────────────────────────

function buildItinerary(city) {
  return `
    <div class="timeline-day">
      <div class="timeline-day__header">Day 1</div>
      <div class="timeline-items">
        <div class="timeline-item">
          <div class="timeline-item__time">09:00</div>
          <div class="timeline-item__title">Arrive &amp; check in</div>
          <div class="timeline-item__note">Drop bags, grab a coffee.</div>
        </div>
        <div class="timeline-item">
          <div class="timeline-item__time">11:00</div>
          <div class="timeline-item__title">Explore city centre</div>
          <div class="timeline-item__note">Walk around the main area.</div>
        </div>
        <div class="timeline-item">
          <div class="timeline-item__time">19:00</div>
          <div class="timeline-item__title">Dinner — local restaurant</div>
          <div class="timeline-item__note">Try the regional speciality.</div>
        </div>
      </div>
    </div>
    <div class="timeline-day">
      <div class="timeline-day__header">Day 2</div>
      <div class="timeline-items">
        <div class="timeline-item">
          <div class="timeline-item__time">08:30</div>
          <div class="timeline-item__title">Main attraction visit</div>
          <div class="timeline-item__note">Book tickets in advance — it gets busy.</div>
        </div>
        <div class="timeline-item">
          <div class="timeline-item__time">14:00</div>
          <div class="timeline-item__title">Afternoon wander</div>
          <div class="timeline-item__note">Markets, tea houses, local vibe.</div>
        </div>
      </div>
    </div>
  `;
}

function buildPlaces(city) {
  const places = [
    { nameEn: 'Main Landmark',    nameZh: '主要景点', namePy: 'Zhǔyào Jǐngdiǎn', category: 'Landmark',  visited: false },
    { nameEn: 'Local Market',     nameZh: '当地市场', namePy: 'Dāngdì Shìchǎng',  category: 'Market',    visited: false },
    { nameEn: 'Historic Temple',  nameZh: '历史寺庙', namePy: 'Lìshǐ Sìmiào',     category: 'Temple',    visited: false },
  ];

  return `<div class="places-list">
    ${places.map((p, i) => `
      <div class="place-item">
        <div class="place-item__content">
          <div class="place-item__category">${p.category}</div>
          <div class="name-block">
            <span class="name-block__en">${p.nameEn}</span>
            <span class="name-block__zh">${p.nameZh}</span>
            <span class="name-block__py">${p.namePy}</span>
          </div>
        </div>
        <button
          class="toggle-pill${p.visited ? ' is-done' : ''}"
          aria-pressed="${p.visited}"
          data-place-index="${i}"
        >
          ${icon('check', { width: 12, height: 12 })}
          ${p.visited ? 'Visited' : 'Not visited'}
        </button>
      </div>
    `).join('')}
  </div>`;
}

function buildFood(city) {
  const dishes = [
    { nameEn: 'Signature Dish 1',  nameZh: '特色菜一', namePy: 'Tèsè cài yī',   emoji: '🥘', tried: false },
    { nameEn: 'Street Snack',      nameZh: '街头小吃', namePy: 'Jiētóu Xiǎochī', emoji: '🍢', tried: false },
    { nameEn: 'Local Noodles',     nameZh: '当地面条', namePy: 'Dāngdì Miàntiáo', emoji: '🍜', tried: false },
    { nameEn: 'Traditional Sweet', nameZh: '传统甜点', namePy: 'Chuántǒng Tiándiǎn', emoji: '🍡', tried: false },
  ];

  return `<div class="food-grid">
    ${dishes.map((d, i) => `
      <div class="food-item">
        <div class="food-item__emoji">${d.emoji}</div>
        <div class="name-block">
          <span class="name-block__en">${d.nameEn}</span>
          <span class="name-block__zh">${d.nameZh}</span>
          <span class="name-block__py">${d.namePy}</span>
        </div>
        <div class="food-item__footer">
          <button
            class="toggle-pill${d.tried ? ' is-done' : ''}"
            aria-pressed="${d.tried}"
            data-food-index="${i}"
          >
            ${icon('check', { width: 12, height: 12 })}
            ${d.tried ? 'Tried it!' : 'Not tried'}
          </button>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function buildTips() {
  return `
    <div class="tips-section">
      <div class="tips-section__category">Transport</div>
      <div class="tip-item">Use the metro — it's cheap, fast, and signs are in English.</div>
      <div class="tip-item">Get a transport card at any station. Much easier than buying tickets.</div>
    </div>
    <div class="tips-section">
      <div class="tips-section__category">Culture</div>
      <div class="tip-item">Remove shoes before entering temple interiors.</div>
    </div>
    <div class="tips-section">
      <div class="tips-section__category">Money</div>
      <div class="tip-item">WeChat Pay is everywhere. Cash is a backup, not the norm.</div>
    </div>
  `;
}

// ── Open / close ──────────────────────────────────────────────

export function openCityPage(cityId, triggerEl) {
  const city    = CITIES.find(c => c.id === cityId);
  if (!city) return;

  const page        = document.getElementById('city-page');
  const headerEl    = document.getElementById('city-header-content');
  const mainEl      = document.getElementById('app');
  const navEl       = document.getElementById('bottom-nav');
  const backBtn     = document.getElementById('city-back-btn');

  // Store where focus should return on close
  _lastFocusedCard = triggerEl || null;

  // Save scroll position, then lock body
  _savedScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top      = `-${_savedScrollY}px`;
  document.body.style.width    = '100%';

  // Populate header
  headerEl.innerHTML = `
    <div class="city-header__top">
      <div class="name-block">
        <span class="name-block__en">${city.emoji} ${city.en}</span>
        <span class="name-block__zh">${city.zh}</span>
        <span class="name-block__py">${city.py}</span>
      </div>
      <span class="badge badge--upcoming">Upcoming</span>
    </div>
    <div class="city-header__dates">
      ${icon('calendar')}
      ${city.dates}
    </div>
  `;

  // Inject back button icon
  backBtn.innerHTML = icon('chevron-left', { width: 22, height: 22 });

  // Reset inner tabs to Itinerary
  switchCityTab('itinerary');

  // Populate all panels with placeholder content for this city
  document.getElementById('city-panel-itinerary').innerHTML = buildItinerary(city);
  document.getElementById('city-panel-places').innerHTML    = buildPlaces(city);
  document.getElementById('city-panel-food').innerHTML      = buildFood(city);
  document.getElementById('city-panel-tips').innerHTML      = buildTips();

  // Make background inert (screen readers + keyboard focus trapped in overlay)
  mainEl.inert = true;
  navEl.inert  = true;

  // Show overlay
  page.removeAttribute('aria-hidden');
  page.classList.add('is-open');

  // Scroll city page to top
  page.scrollTop = 0;

  // Move keyboard focus to back button
  backBtn.focus();
}

export function closeCityPage() {
  const page   = document.getElementById('city-page');
  const mainEl = document.getElementById('app');
  const navEl  = document.getElementById('bottom-nav');

  // Hide overlay
  page.classList.remove('is-open');
  page.setAttribute('aria-hidden', 'true');

  // Restore background interactivity
  mainEl.inert = false;
  navEl.inert  = false;

  // Restore body scroll
  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.width    = '';
  window.scrollTo(0, _savedScrollY);

  // Return focus to the card that was tapped
  if (_lastFocusedCard) {
    _lastFocusedCard.focus();
    _lastFocusedCard = null;
  }
}

// ── Inner tab switching ───────────────────────────────────────

function switchCityTab(tabId) {
  // Deactivate all inner tabs + panels
  document.querySelectorAll('.city-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.city-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Activate target
  const activeBtn   = document.querySelector(`[data-city-tab="${tabId}"]`);
  const activePanel = document.getElementById(`city-panel-${tabId}`);

  if (activeBtn)   { activeBtn.classList.add('active');   activeBtn.setAttribute('aria-selected', 'true'); }
  if (activePanel) { activePanel.classList.add('active'); }
}

// ── Init ──────────────────────────────────────────────────────

export function initCityPage() {
  // Back button
  document.getElementById('city-back-btn').addEventListener('click', closeCityPage);

  // Inner tab bar (event delegation)
  document.querySelector('.city-tab-bar').addEventListener('click', e => {
    const btn = e.target.closest('.city-tab-btn');
    if (!btn) return;
    switchCityTab(btn.dataset.cityTab);
  });

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const page = document.getElementById('city-page');
      if (page.classList.contains('is-open')) closeCityPage();
    }
  });
}
