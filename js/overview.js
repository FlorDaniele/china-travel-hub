/**
 * overview.js — Renders the Overview tab content.
 * Planning mode only for now (trip starts June 6, 2026).
 *
 * Exports:
 *   initOverview()  — called once from app.js
 *   CITIES          — shared city data used by city.js
 */

// ── City data ────────────────────────────────────────────────

export const CITIES = [
  {
    id:      'beijing',
    en:      'Beijing',
    zh:      '北京',
    py:      'Běijīng',
    dates:   'Jun 6–11',
    start:   '2026-06-06',
    end:     '2026-06-11',
    status:  'upcoming',
    emoji:   '🏯',
  },
  {
    id:      'xian',
    en:      "Xi'an",
    zh:      '西安',
    py:      "Xī'ān",
    dates:   'Jun 11–14',
    start:   '2026-06-11',
    end:     '2026-06-14',
    status:  'upcoming',
    emoji:   '🗿',
  },
  {
    id:      'chengdu',
    en:      'Chengdu',
    zh:      '成都',
    py:      'Chéngdū',
    dates:   'Jun 14–19',
    start:   '2026-06-14',
    end:     '2026-06-19',
    status:  'upcoming',
    emoji:   '🐼',
  },
  {
    id:      'chongqing',
    en:      'Chongqing',
    zh:      '重庆',
    py:      'Chóngqìng',
    dates:   'Jun 19–22',
    start:   '2026-06-19',
    end:     '2026-06-22',
    status:  'upcoming',
    emoji:   '🌶️',
  },
  {
    id:      'shanghai',
    en:      'Shanghai',
    zh:      '上海',
    py:      'Shànghǎi',
    dates:   'Jun 22–Jul 5',
    start:   '2026-06-22',
    end:     '2026-07-05',
    status:  'upcoming',
    emoji:   '🌆',
  },
];

// ── Booking progress data (placeholder) ──────────────────────

const BOOKINGS = [
  { type: 'Hotels',    icon: 'building-2', booked: 2, total: 5 },
  { type: 'Trains',    icon: 'train',      booked: 1, total: 4 },
  { type: 'Tours',     icon: 'map-pin',    booked: 0, total: 3 },
];

// ── Urgent reminders (placeholder) ───────────────────────────

const URGENT = [
  { title: 'Book Xi\'an hotel',     due: 'Due Apr 25' },
  { title: 'Book Great Wall tour',  due: 'Due Apr 30' },
  { title: 'Apply for China e-Visa', due: 'Due May 1'  },
];

// ── Countdown calculation ─────────────────────────────────────

function getDaysUntil(dateStr) {
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ── Icon helper (uses window.lucide set by CDN) ───────────────

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

// ── Render: planning mode header ──────────────────────────────

function renderPlanningHeader() {
  const daysLeft = getDaysUntil('2026-06-06');

  const bookingCards = BOOKINGS.map(b => {
    const pct = Math.round((b.booked / b.total) * 100);
    return `
      <div class="booking-card">
        <div class="booking-card__header">
          ${icon(b.icon)}
          <span class="booking-card__type">${b.type}</span>
        </div>
        <div class="booking-card__fraction">
          ${b.booked}<span>/${b.total}</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const urgentItems = URGENT.map(u => `
    <div class="urgent-item">
      <span class="urgent-item__title">${u.title}</span>
      <span class="urgent-item__due">${u.due}</span>
    </div>
  `).join('');

  return `
    <div class="planning-header">

      <!-- Countdown -->
      <div class="countdown-card">
        <div class="countdown-card__left">
          <span class="countdown-card__label">Departure in</span>
          <span class="countdown-card__days">${daysLeft}</span>
          <span class="countdown-card__sublabel">days to go</span>
        </div>
        <div class="countdown-card__right">
          <span class="countdown-card__date-label">Departs</span>
          <span class="countdown-card__date">Jun 6, 2026</span>
          <div class="countdown-card__icon">${icon('plane', { width: 32, height: 32 })}</div>
        </div>
      </div>

      <!-- Booking progress -->
      <div class="booking-progress-grid">
        ${bookingCards}
      </div>

      <!-- Urgent reminders -->
      <div class="urgent-section">
        <div class="urgent-section__header">
          ${icon('alert-circle')}
          <span class="urgent-section__title">Upcoming deadlines</span>
        </div>
        ${urgentItems}
      </div>

    </div>
  `;
}

// ── Render: city grid ─────────────────────────────────────────

function renderCityGrid() {
  return CITIES.map(city => `
    <article
      class="city-card"
      role="listitem"
      data-city-id="${city.id}"
      tabindex="0"
      aria-label="Open ${city.en} city page"
    >
      <div class="city-card__top">
        <div class="name-block">
          <span class="name-block__en">${city.emoji} ${city.en}</span>
          <span class="name-block__zh">${city.zh}</span>
          <span class="name-block__py">${city.py}</span>
        </div>
        <div class="city-card__arrow">${icon('chevron-right')}</div>
      </div>
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="city-card__dates">
          ${icon('calendar')}
          ${city.dates}
        </div>
        <span class="badge badge--upcoming">Upcoming</span>
      </div>
    </article>
  `).join('');
}

// ── Public init ───────────────────────────────────────────────

export function initOverview() {
  const headerEl = document.getElementById('planning-header');
  const gridEl   = document.getElementById('city-grid');

  if (headerEl) headerEl.innerHTML = renderPlanningHeader();
  if (gridEl)   gridEl.innerHTML   = renderCityGrid();
}
