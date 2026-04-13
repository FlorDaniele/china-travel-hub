/* ============================================================
   OVERVIEW.JS — Overview tab
   Loads settings, itinerary, bookings, reminders from Supabase.
   Detects planning vs travel mode.
   Renders context-aware header + city bento grid.
   Falls back to localStorage if Supabase is unavailable.
   ============================================================ */

import { supabase } from './supabase.js';
import { saveToStorage, loadFromStorage } from './storage.js';

const DEPARTURE_DATE = '2026-06-06';

/* ── Static city data (fallback until Supabase itinerary is populated) ─ */

const STATIC_CITIES = [
  {
    city: 'Beijing',    city_zh: '北京',   city_pinyin: 'Běijīng',
    date_start: '2026-06-06', date_end: '2026-06-12',
  },
  {
    city: "Xi'an",      city_zh: '西安',   city_pinyin: "Xī'ān",
    date_start: '2026-06-13', date_end: '2026-06-16',
  },
  {
    city: 'Chengdu',    city_zh: '成都',   city_pinyin: 'Chéngdū',
    date_start: '2026-06-17', date_end: '2026-06-21',
  },
  {
    city: 'Chongqing',  city_zh: '重庆',   city_pinyin: 'Chóngqìng',
    date_start: '2026-06-22', date_end: '2026-06-25',
  },
  {
    city: 'Shanghai',   city_zh: '上海',   city_pinyin: 'Shànghǎi',
    date_start: '2026-06-26', date_end: '2026-07-05',
  },
];

/* ── XSS protection ────────────────────────────────────────── */

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Date helpers ──────────────────────────────────────────── */

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Parse as local date to avoid timezone offset shifting the day
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function daysUntilDeparture() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const departure = new Date(DEPARTURE_DATE + 'T00:00:00');
  return Math.max(0, Math.ceil((departure - today) / 86400000));
}

function dueLabel(dueDateStr) {
  if (!dueDateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  const diff = Math.ceil((due - today) / 86400000);
  if (diff < 0)  return 'Overdue';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `${diff} days`;
}

/* ── Mode detection ────────────────────────────────────────── */

function detectMode(settings) {
  const override = settings.find(s => s.key === 'manual_mode_override');
  if (override && override.value === 'true') {
    const modeSetting = settings.find(s => s.key === 'mode');
    return modeSetting?.value ?? 'planning';
  }
  return todayStr() >= DEPARTURE_DATE ? 'travel' : 'planning';
}

/* ── Supabase data loaders ─────────────────────────────────── */

async function loadSettings() {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) throw error;
  saveToStorage('settings', data);
  return data;
}

async function loadItinerary() {
  const { data, error } = await supabase
    .from('itinerary')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw error;
  saveToStorage('itinerary', data);
  return data;
}

async function loadBookings() {
  const { data, error } = await supabase.from('bookings').select('*');
  if (error) throw error;
  saveToStorage('bookings', data);
  return data;
}

async function loadReminders() {
  const { data, error } = await supabase.from('reminders').select('*');
  if (error) throw error;
  saveToStorage('reminders', data);
  return data;
}

/* ── Render: single booking type card ──────────────────────── */

function renderBookingCard(type, items) {
  const label   = type === 'hotel' ? 'Hotels' : type === 'train' ? 'Trains' : 'Tours';
  const booked  = items.filter(b => b.status === 'booked').length;
  const pending = items.filter(b => b.status !== 'booked');

  const checklistHTML = pending.length > 0
    ? `<div class="booking-card-divider" aria-hidden="true"></div>
       <div class="booking-checklist">
         ${pending.map(b => `
           <div class="booking-check-item" data-booking-id="${esc(b.id)}">
             <input
               type="checkbox"
               id="booking-cb-${esc(b.id)}"
               data-booking-id="${esc(b.id)}"
             >
             <label for="booking-cb-${esc(b.id)}">${esc(b.title)}</label>
           </div>
         `).join('')}
       </div>`
    : `<div class="booking-card-divider" aria-hidden="true"></div>
       <p class="booking-all-done">All booked ✓</p>`;

  return `
    <div class="booking-card" data-type="${esc(type)}">
      <div class="booking-card-type">${esc(label)}</div>
      <div class="booking-card-count">
        <span class="count-booked">${booked}</span><span class="count-total">/${items.length}</span>
      </div>
      ${items.length > 0 ? checklistHTML : ''}
    </div>
  `;
}

/* ── Render: planning mode header ──────────────────────────── */

function renderPlanningHeader(bookings, reminders) {
  const days = daysUntilDeparture();

  const hotels = bookings.filter(b => b.type === 'hotel');
  const trains = bookings.filter(b => b.type === 'train');
  const tours  = bookings.filter(b => b.type === 'tour');

  // Urgent reminders due within 7 days, not yet done
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);

  const urgent = reminders.filter(r => {
    if (r.status === 'done' || !r.due_date) return false;
    const due = new Date(r.due_date + 'T00:00:00');
    return due <= in7;
  });

  const urgentHTML = urgent.length > 0
    ? `<p class="section-title">Urgent</p>
       <div class="urgent-reminders-compact">
         ${urgent.map(r => `
           <div class="urgent-reminder-item">
             <span class="urgency-dot" aria-hidden="true"></span>
             <span class="reminder-title">${esc(r.title)}</span>
             <span class="reminder-due">${esc(dueLabel(r.due_date))}</span>
           </div>
         `).join('')}
       </div>`
    : '';

  return `
    <div class="overview-bento">

      <div class="hero-card">
        <img
          src="assets/shanghai-hero.jpg"
          alt="The Oriental Pearl Tower and Pudong skyline, Shanghai"
          loading="eager"
        >
        <div class="hero-gradient" aria-hidden="true"></div>
        <div class="hero-content">
          <div class="hero-countdown-number">${days}</div>
          <div class="hero-countdown-label">${days === 1 ? 'day' : 'days'} to Beijing</div>
        </div>
      </div>

      <p class="section-title">Bookings</p>
      <div class="booking-bento-row" id="booking-bento">
        ${renderBookingCard('hotel', hotels)}
        ${renderBookingCard('train', trains)}
        ${renderBookingCard('tour',  tours)}
      </div>

      ${urgentHTML}

    </div>
  `;
}

/* ── Render: travel mode header ────────────────────────────── */

function renderTravelHeader(itinerary, bookings) {
  const today = todayStr();

  const currentCity = itinerary.find(
    c => today >= c.date_start && today <= c.date_end
  );

  const todayLabel = (() => {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  })();

  const cityHTML = currentCity
    ? `<div class="bilingual">
         <span class="name-en">${esc(currentCity.city)}</span>
         <span class="name-zh">${esc(currentCity.city_zh ?? '')}</span>
         <span class="name-pinyin">${esc(currentCity.city_pinyin ?? '')}</span>
       </div>`
    : `<p style="font-weight:var(--font-weight-semibold)">In transit</p>`;

  const todayBookings = bookings.filter(b => b.date_start === today);
  const activitiesHTML = todayBookings.length > 0
    ? `<p class="section-title">Today</p>
       <div class="today-activities">
         ${todayBookings.map(b => `
           <div class="activity-item">
             <span class="activity-time">${esc(b.type ?? '')}</span>
             <span class="activity-title">${esc(b.title)}</span>
           </div>
         `).join('')}
       </div>`
    : '';

  const nextBooking = bookings
    .filter(b => b.date_start > today)
    .sort((a, b) => a.date_start.localeCompare(b.date_start))[0] ?? null;

  const nextBookingHTML = nextBooking
    ? `<div class="next-booking-block">
         <div class="next-booking-label">Up next</div>
         <div class="next-booking-title">${esc(nextBooking.title)}</div>
         <div class="next-booking-date">${formatDate(nextBooking.date_start)}</div>
       </div>`
    : '';

  return `
    <div class="travel-today-block">
      <div class="travel-today-date">${esc(todayLabel)}</div>
      ${cityHTML}
    </div>
    ${activitiesHTML}
    ${nextBookingHTML}
  `;
}

/* ── Render: city bento grid ───────────────────────────────── */

function renderCityCards(itinerary) {
  const cities = itinerary.length > 0 ? itinerary : STATIC_CITIES;
  const today  = todayStr();

  return `
    <p class="section-title">Your trip</p>
    <div class="city-bento-grid">
      ${cities.map((city, index) => {
        let statusClass = '';
        let badge = '';

        if (today >= city.date_start && today <= city.date_end) {
          statusClass = 'is-current';
          badge = '<span class="badge badge-current">Current</span>';
        } else if (today > city.date_end) {
          statusClass = 'is-visited';
          badge = '<span class="badge badge-visited">Visited</span>';
        } else {
          badge = '<span class="badge badge-upcoming">Upcoming</span>';
        }

        const dateRange = [city.date_start, city.date_end]
          .filter(Boolean)
          .map(formatDate)
          .join(' – ');

        // First city = featured full-width bento card
        const featuredClass = index === 0 ? 'city-card--featured' : '';

        return `
          <button
            class="city-card ${statusClass} ${featuredClass}"
            data-city="${esc(city.city)}"
            aria-label="Open ${esc(city.city)} details"
          >
            <div class="city-card-header">
              <div class="bilingual">
                <span class="name-en">${esc(city.city)}</span>
                <span class="name-zh">${esc(city.city_zh ?? '')}</span>
                <span class="name-pinyin">${esc(city.city_pinyin ?? '')}</span>
              </div>
              ${badge}
            </div>
            ${dateRange ? `<div class="city-card-dates">${esc(dateRange)}</div>` : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

/* ── Render: mode toggle ───────────────────────────────────── */

function renderModeToggle(mode) {
  const label = mode === 'planning' ? 'Planning mode' : 'Travel mode';
  const switchTo = mode === 'planning' ? 'travel' : 'planning';
  return `
    <div class="mode-toggle-wrapper">
      <button
        class="mode-toggle-btn"
        id="mode-toggle-btn"
        aria-label="Switch to ${switchTo} mode"
      >
        <span class="mode-toggle-dot" aria-hidden="true"></span>
        ${esc(label)}
      </button>
    </div>
  `;
}

/* ── Render: skeleton loaders ──────────────────────────────── */

function renderSkeletons() {
  return `
    <div class="skeleton skeleton-card" aria-hidden="true" style="height:200px;border-radius:24px"></div>
    <div class="skeleton skeleton-card" aria-hidden="true" style="height:80px"></div>
    <div class="skeleton skeleton-card" aria-hidden="true" style="height:60px"></div>
  `;
}

/* ── Booking check handler ─────────────────────────────────── */

async function handleBookingCheck(bookingId, checkboxEl) {
  const item = checkboxEl.closest('.booking-check-item');
  if (!item) return;

  // Optimistic UI: dim the row while the async save is in flight
  item.classList.add('is-saving');

  try {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'booked' })
      .eq('id', bookingId);
    if (error) throw error;

    // Keep localStorage cache in sync
    const cached  = loadFromStorage('bookings') ?? [];
    const updated = cached.map(b =>
      String(b.id) === String(bookingId) ? { ...b, status: 'booked' } : b
    );
    saveToStorage('bookings', updated);

    // Re-render so the count updates
    initOverview();
  } catch (err) {
    console.warn('[overview] booking check failed:', err);
    checkboxEl.checked = false;
    item.classList.remove('is-saving');
  }
}

/* ── Mode toggle handler ───────────────────────────────────── */

async function handleModeToggle(currentMode) {
  const newMode = currentMode === 'planning' ? 'travel' : 'planning';
  try {
    await supabase.from('settings').upsert([
      { key: 'mode', value: newMode },
      { key: 'manual_mode_override', value: 'true' },
    ]);
  } catch (e) {
    console.warn('[overview] mode toggle save failed:', e);
  }
  initOverview();
}

/* ── Main init ─────────────────────────────────────────────── */

export async function initOverview() {
  const headerEl = document.getElementById('overview-header');
  const gridEl   = document.getElementById('city-cards-grid');

  // Show skeletons while loading
  headerEl.innerHTML = renderSkeletons();
  gridEl.innerHTML   = '';

  let settings, itinerary, bookings, reminders;
  let isOffline = false;

  try {
    [settings, itinerary, bookings, reminders] = await Promise.all([
      loadSettings(),
      loadItinerary(),
      loadBookings(),
      loadReminders(),
    ]);
  } catch (err) {
    console.warn('[overview] Supabase unavailable, trying localStorage:', err);
    isOffline  = true;
    settings   = loadFromStorage('settings')   ?? [];
    itinerary  = loadFromStorage('itinerary')  ?? [];
    bookings   = loadFromStorage('bookings')   ?? [];
    reminders  = loadFromStorage('reminders')  ?? [];
  }

  // Show offline banner if on cached data
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.toggle('hidden', !isOffline);

  // If still no data after fallback, show error
  if (!Array.isArray(settings)) {
    headerEl.innerHTML = `
      <div class="error-state">
        <p class="error-state-message">Couldn't load your trip data.</p>
        <button class="btn-primary" id="overview-retry">Try again</button>
      </div>
    `;
    gridEl.innerHTML = '';
    document.getElementById('overview-retry')
      ?.addEventListener('click', initOverview);
    return;
  }

  const mode = detectMode(settings);

  const headerContent = mode === 'planning'
    ? renderPlanningHeader(bookings, reminders)
    : renderTravelHeader(itinerary, bookings);

  headerEl.innerHTML = renderModeToggle(mode) + headerContent;
  gridEl.innerHTML   = renderCityCards(itinerary);

  // Wire up mode toggle
  document.getElementById('mode-toggle-btn')
    ?.addEventListener('click', () => handleModeToggle(mode));

  // Event delegation for booking checkboxes
  document.getElementById('booking-bento')
    ?.addEventListener('change', e => {
      const cb = e.target;
      if (cb.matches('input[type="checkbox"]') && cb.dataset.bookingId) {
        handleBookingCheck(cb.dataset.bookingId, cb);
      }
    });
}
