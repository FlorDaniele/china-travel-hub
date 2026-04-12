/* ============================================================
   OVERVIEW.JS — Overview tab
   Loads settings, itinerary, bookings, reminders from Supabase.
   Detects planning vs travel mode.
   Renders context-aware header + city cards grid.
   Falls back to localStorage if Supabase is unavailable.
   ============================================================ */

import { supabase } from './supabase.js';
import { saveToStorage, loadFromStorage } from './storage.js';

const DEPARTURE_DATE = '2026-06-06';

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

/* ── Render: planning mode header ──────────────────────────── */

function renderPlanningHeader(bookings, reminders) {
  const days = daysUntilDeparture();

  const hotels  = bookings.filter(b => b.type === 'hotel');
  const trains  = bookings.filter(b => b.type === 'train');
  const tours   = bookings.filter(b => b.type === 'tour');

  const countBooked = arr => arr.filter(b => b.status === 'booked').length;

  // Reminders due within 7 days, not yet done
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
       <div class="urgent-reminders">
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
    <div class="countdown-block">
      <div class="countdown-number">${days}</div>
      <div class="countdown-label">${days === 1 ? 'day' : 'days'} until Beijing</div>
    </div>

    <p class="section-title">Bookings</p>
    <div class="booking-progress-row">
      <div class="booking-progress-card">
        <div class="booking-progress-count">
          <span class="booked">${countBooked(hotels)}</span>/${hotels.length}
        </div>
        <div class="booking-progress-label">Hotels</div>
      </div>
      <div class="booking-progress-card">
        <div class="booking-progress-count">
          <span class="booked">${countBooked(trains)}</span>/${trains.length}
        </div>
        <div class="booking-progress-label">Trains</div>
      </div>
      <div class="booking-progress-card">
        <div class="booking-progress-count">
          <span class="booked">${countBooked(tours)}</span>/${tours.length}
        </div>
        <div class="booking-progress-label">Tours</div>
      </div>
    </div>

    ${urgentHTML}
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

/* ── Render: city cards ────────────────────────────────────── */

function renderCityCards(itinerary) {
  if (itinerary.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">🗺️</div>
        <p class="empty-state-message">No cities added yet.</p>
        <p class="empty-state-sub">Add rows to the itinerary table in Supabase to get started.</p>
      </div>
    `;
  }

  const today = todayStr();

  return `
    <p class="section-title">Your trip</p>
    <div class="city-cards-grid">
      ${itinerary.map(city => {
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

        return `
          <button
            class="city-card ${statusClass}"
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
    <div class="skeleton skeleton-card" aria-hidden="true" style="height:120px"></div>
    <div class="skeleton skeleton-card" aria-hidden="true" style="height:80px"></div>
    <div class="skeleton skeleton-card" aria-hidden="true" style="height:60px"></div>
  `;
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
}
