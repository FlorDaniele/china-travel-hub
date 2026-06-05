/* ============================================================
   OVERVIEW.JS — Overview tab
   Loads settings, itinerary, bookings, reminders from Supabase.
   Detects planning vs travel mode.
   Renders context-aware header + city bento grid.
   Falls back to localStorage if Supabase is unavailable.
   ============================================================ */

import { supabase } from './supabase.js';
import { saveToStorage, loadFromStorage } from './storage.js';
import { openSidebar } from './sidebar.js';
import { openModal, closeModal, showToast } from './modal.js';

const DEPARTURE_DATE = '2026-06-06';

/* ── Trip config loader ────────────────────────────────────── */

async function loadTripConfig() {
  const { data, error } = await supabase.from('trip_config').select('*');
  if (error) throw error;
  return data;
}

function computeCountdown(configRows) {
  const get = key => configRows.find(r => r.key === key)?.value ?? null;
  const departureDate  = get('flight_departure_date');
  const demoMode       = get('demo_mode');
  const demoRef        = get('demo_reference_date');
  if (!departureDate) return null;
  const refStr = (demoMode === 'true' && demoRef) ? demoRef : todayStr();
  const [ry, rm, rd] = refStr.split('-').map(Number);
  const [dy, dm, dd] = departureDate.split('-').map(Number);
  const ref = new Date(ry, rm - 1, rd);
  const dep = new Date(dy, dm - 1, dd);
  return Math.ceil((dep - ref) / 86400000);
}

export async function initDesktopCountdown() {
  const numEl   = document.getElementById('dk-countdown-number');
  const labelEl = document.getElementById('dk-countdown-label');
  if (!numEl) return;
  try {
    const configRows = await loadTripConfig();
    const days = computeCountdown(configRows);
    if (days === null) return;
    const demoMode = configRows.find(r => r.key === 'demo_mode')?.value;
    if (days > 0) {
      numEl.textContent = days;
    } else if (days === 0) {
      numEl.textContent = 'Today';
      if (labelEl) labelEl.textContent = 'Departure day';
    } else if (demoMode !== 'true') {
      numEl.textContent = '';
      if (labelEl) labelEl.textContent = 'Trip in progress';
    }
  } catch (err) {
    console.warn('[overview] trip_config load failed:', err);
    if (numEl.textContent === '–') numEl.textContent = '21';
  }
}

/* ── Static city data (fallback until Supabase itinerary is populated) ─ */

const STATIC_CITIES = [
  {
    city: 'Beijing',    city_zh: '北京',   city_pinyin: 'Běijīng',
    date_start: '2026-06-06', date_end: '2026-06-11',
  },
  {
    city: "Xi'an",      city_zh: '西安',   city_pinyin: "Xī'ān",
    date_start: '2026-06-12', date_end: '2026-06-14',
  },
  {
    city: 'Chengdu',    city_zh: '成都',   city_pinyin: 'Chéngdū',
    date_start: '2026-06-15', date_end: '2026-06-17',
  },
  {
    city: 'Chongqing',  city_zh: '重庆',   city_pinyin: 'Chóngqìng',
    date_start: '2026-06-18', date_end: '2026-06-19',
  },
  {
    city: 'Shanghai',   city_zh: '上海',   city_pinyin: 'Shànghǎi',
    date_start: '2026-06-20', date_end: '2026-06-25',
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

function formatTourDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function loadNextTour() {
  const today = todayStr();

  // Prefer upcoming tours; fall back to most recent past tour
  const { data: upcoming, error: upErr } = await supabase
    .from('activities')
    .select('*')
    .eq('type', 'tour')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(1);
  if (upErr) throw upErr;
  if (upcoming && upcoming.length > 0) return upcoming[0];

  const { data: past, error: pastErr } = await supabase
    .from('activities')
    .select('*')
    .eq('type', 'tour')
    .lt('date', today)
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(1);
  if (pastErr) throw pastErr;
  return (past && past.length > 0) ? past[0] : null;
}

function renderNextTourItem(activity) {
  if (!activity) {
    return `<li class="dk-next-item"><span class="dk-next-meta" style="color:var(--text-secondary)">No upcoming tours</span></li>`;
  }

  const meta = [
    formatTourDate(activity.date),
    activity.time ?? null,
    activity.source ?? null,
  ].filter(Boolean).join(' · ');

  return `
    <li class="dk-next-item">
      <div class="dk-next-body">
        <span class="dk-next-title">${esc(activity.title)}</span>
        <span class="dk-next-meta">${esc(meta)}</span>
        <a href="#" class="dk-next-booking-link">View booking ↗</a>
      </div>
      <div class="dk-next-photo">
        <img src="assets/mutianyu-wall.jpg" alt="${esc(activity.title)}">
      </div>
    </li>
  `;
}

export async function initDesktopNextUp() {
  const listEl = document.querySelector('.dk-next-up .dk-next-list');
  if (!listEl) return;

  listEl.innerHTML = `<li class="dk-next-item"><span class="dk-next-meta" style="color:var(--text-secondary)">Loading…</span></li>`;

  try {
    const activity = await loadNextTour();
    listEl.innerHTML = renderNextTourItem(activity);
  } catch (err) {
    console.warn('[overview] next-tour load failed:', err);
    listEl.innerHTML = `<li class="dk-next-item"><span class="dk-next-meta" style="color:var(--text-secondary)">No upcoming tours</span></li>`;
  }
}

/* ── Render: single booking type card ──────────────────────── */

function renderBookingCard(type, items) {
  const label     = type === 'hotel' ? 'Hotels' : type === 'train' ? 'Trains' : 'Tours';
  const confirmed = items.filter(b => b.status === 'booked' || b.status === 'done').length;
  const pending   = items.filter(b => b.status !== 'booked' && b.status !== 'done');
  const allDone   = items.length > 0 && confirmed === items.length;

  // CASE A: ≤ 5 total → show all pending, no "View all"
  // CASE B: ≥ 6 total → show first 5 unchecked, show "View all →"
  const showViewAll    = items.length >= 6;
  const visiblePending = showViewAll ? pending.slice(0, 5) : pending;

  const viewAllBtn = showViewAll
    ? `<button class="booking-view-all-btn" data-booking-type="${esc(type)}" type="button">View all →</button>`
    : '';

  const checklistHTML = visiblePending.length > 0
    ? `<div class="booking-card-divider" aria-hidden="true"></div>
       <div class="booking-checklist">
         ${visiblePending.map(b => `
           <div class="booking-check-item" data-booking-id="${esc(b.id)}">
             <input
               type="checkbox"
               id="booking-cb-${esc(b.id)}"
               data-booking-id="${esc(b.id)}"
             >
             <label for="booking-cb-${esc(b.id)}">${esc(b.title)}</label>
           </div>
         `).join('')}
         ${viewAllBtn}
       </div>`
    : `<div class="booking-card-divider" aria-hidden="true"></div>
       <p class="booking-all-done">All booked ✓</p>${viewAllBtn}`;

  return `
    <div class="booking-card" data-type="${esc(type)}">
      <div class="booking-card-type">${esc(label)}</div>
      <div class="booking-card-count-wrap${allDone ? ' all-done' : ''}">
        <div class="booking-card-count">
          <span class="count-confirmed">${confirmed}</span><span class="count-total">/${items.length}</span>
        </div>
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
          src="assets/beijing-hero.jpg"
          alt="Aerial view of Beijing city centre during daytime"
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
  const item = checkboxEl.closest('.booking-check-item, .dk-booking-check-item');
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

/* ── Render: bookings sidebar content ──────────────────────── */

function renderBookingsSidebarContent(bookings) {
  const types = [
    { key: 'hotel', label: 'Hotels' },
    { key: 'train', label: 'Trains' },
    { key: 'tour',  label: 'Tours'  },
  ];

  const sectionsHTML = types.map((t, idx) => {
    const items     = bookings.filter(b => b.type === t.key);
    const confirmed = items.filter(b => b.status === 'booked' || b.status === 'done').length;
    const allDone   = items.length > 0 && confirmed === items.length;

    const countClass = allDone ? ' sb-section-count--all-done' : '';

    const itemsHTML = items.length > 0
      ? items.map(b => {
          const isConfirmed = b.status === 'booked' || b.status === 'done';
          return `
            <div class="sb-booking-item">
              <input
                type="checkbox"
                class="sb-booking-cb"
                ${isConfirmed ? 'checked' : ''}
                aria-label="${esc(b.title)}"
                data-booking-id="${esc(String(b.id))}"
              >
              <span class="sb-booking-label">${esc(b.title)}</span>
            </div>
          `;
        }).join('')
      : `<p class="sb-booking-empty">No ${esc(t.label.toLowerCase())} yet</p>`;

    const divider = idx > 0
      ? '<div class="sb-section-divider" aria-hidden="true"></div>'
      : '';

    return `
      ${divider}
      <div class="sb-section-header">
        <div class="sb-section-label-with-icon">
          ${_BOOKING_ICONS[t.key] ?? ''}
          <span class="sb-section-label">${esc(t.label)}</span>
        </div>
        <span class="sb-section-count${countClass}">${confirmed}/${items.length}</span>
      </div>
      ${itemsHTML}
      <button class="sb-add-link" type="button" data-booking-type="${esc(t.key)}">
        Add booking
        <span class="sb-add-icon-circle">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/></svg>
        </span>
      </button>
    `;
  }).join('');

  return `
    <div class="sb-hide-toggle" data-sidebar="bookings">
      <input type="checkbox" id="sb-hide-booked" class="sb-booking-cb" aria-label="Hide booked items">
      <label for="sb-hide-booked" class="sb-hide-label">Hide booked</label>
    </div>
    ${sectionsHTML}
  `;
}

/* ── Static packing list fallback ─────────────────────────────── */

const STATIC_PACKING_LIST = [
  { category: 'Documents', items: [
    { id: 'pk-s1', label: 'Passport',               packed: false },
    { id: 'pk-s2', label: 'Visa printout',           packed: false },
    { id: 'pk-s3', label: 'Travel insurance docs',   packed: false },
    { id: 'pk-s4', label: 'Flight confirmations',    packed: false },
  ]},
  { category: 'Tech', items: [
    { id: 'pk-s5', label: 'Camera & GoPro',          packed: false },
    { id: 'pk-s6', label: 'Laptop & Charger',        packed: false },
    { id: 'pk-s7', label: 'Power bank',              packed: false },
    { id: 'pk-s8', label: 'Universal adapter',       packed: false },
  ]},
  { category: 'Clothes', items: [
    { id: 'pk-s9',  label: 'T-shirts (5)',            packed: false },
    { id: 'pk-s10', label: 'Lightweight jacket',      packed: false },
    { id: 'pk-s11', label: 'Walking shoes',           packed: false },
    { id: 'pk-s12', label: 'Rain poncho',             packed: false },
  ]},
  { category: 'Health', items: [
    { id: 'pk-s13', label: 'Medical aid',             packed: false },
    { id: 'pk-s14', label: 'Sunscreen',               packed: false },
    { id: 'pk-s15', label: 'Insect repellent',        packed: false },
  ]},
  { category: 'Money', items: [
    { id: 'pk-s16', label: 'Cash (RMB)',              packed: false },
    { id: 'pk-s17', label: 'Travel card',             packed: false },
    { id: 'pk-s18', label: 'Backup card',             packed: false },
  ]},
  { category: 'Other', items: [
    { id: 'pk-s19', label: 'Reusable bag',            packed: false },
    { id: 'pk-s20', label: 'Padlock for lockers',     packed: false },
    { id: 'pk-s21', label: 'Notebook & pen',          packed: false },
    { id: 'pk-s22', label: 'Snacks for trains',       packed: false },
  ]},
];

/* ── Render: packing list sidebar content ──────────────────────── */

function renderPackingSidebarContent(categories) {
  const sectionsHTML = categories.map((cat, idx) => {
    const packed  = cat.items.filter(i => i.packed).length;
    const total   = cat.items.length;
    const allDone = total > 0 && packed === total;
    const countClass = allDone ? ' sb-section-count--all-done' : '';

    const divider = idx > 0
      ? '<div class="sb-section-divider" aria-hidden="true"></div>'
      : '';

    const itemsHTML = cat.items.map(item => `
      <div class="sb-booking-item">
        <input
          type="checkbox"
          class="sb-booking-cb"
          ${item.packed ? 'checked' : ''}
          aria-label="${esc(item.label)}"
          data-packing-id="${esc(item.id)}"
        >
        <span class="sb-booking-label">${esc(item.label)}</span>
      </div>
    `).join('');

    return `
      ${divider}
      <div class="sb-section-header">
        <span class="sb-section-label">${esc(cat.category)}</span>
        <span class="sb-section-count${countClass}">${packed}/${total}</span>
      </div>
      ${itemsHTML}
      <button class="sb-add-link" type="button" data-packing-add="true">
        Add item
        <span class="sb-add-icon-circle">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/></svg>
        </span>
      </button>
    `;
  }).join('');

  return `
    <div class="sb-hide-toggle">
      <input type="checkbox" id="sb-hide-packed" class="sb-booking-cb" aria-label="Hide packed items">
      <label for="sb-hide-packed" class="sb-hide-label">Hide packed</label>
    </div>
    ${sectionsHTML}
  `;
}

/* ── Static fallback for sidebar when Supabase not yet wired ── */

const STATIC_BOOKINGS_FALLBACK = [
  { id: 'f1', type: 'hotel', title: 'Beijing — 6 nights',         status: 'booked', date_start: '2026-06-06' },
  { id: 'f2', type: 'hotel', title: "Xi'an — 3 nights",           status: 'booked', date_start: '2026-06-13' },
  { id: 'f3', type: 'hotel', title: 'Chengdu — 4 nights',         status: 'booked', date_start: '2026-06-17' },
  { id: 'f4', type: 'hotel', title: 'Chongqing — 2 nights',       status: 'pending', date_start: '2026-06-22' },
  { id: 'f5', type: 'hotel', title: 'Shanghai — 5 nights',        status: 'pending', date_start: '2026-06-26' },
  { id: 'f6', type: 'train', title: "Beijing → Xi'an",            status: 'booked', date_start: '2026-06-13' },
  { id: 'f7', type: 'train', title: "Xi'an → Chengdu",            status: 'pending', date_start: '2026-06-17' },
  { id: 'f8', type: 'train', title: 'Chengdu → Chongqing',        status: 'pending', date_start: '2026-06-22' },
  { id: 'f9', type: 'train', title: 'Chongqing → Shanghai',       status: 'pending', date_start: '2026-06-26' },
  { id: 'fa', type: 'tour',  title: 'Great Wall — Mutianyu',      status: 'booked', date_start: '2026-06-08' },
  { id: 'fb', type: 'tour',  title: 'Terracotta Warriors',        status: 'booked', date_start: '2026-06-14' },
  { id: 'fc', type: 'tour',  title: 'Giant Panda Base',           status: 'booked', date_start: '2026-06-18' },
  { id: 'fd', type: 'tour',  title: 'Yangtze River Cruise',       status: 'pending', date_start: '2026-06-23' },
  { id: 'fe', type: 'tour',  title: 'Shanghai Old Town walk',     status: 'pending', date_start: '2026-06-27' },
  { id: 'ff', type: 'tour',  title: 'Yu Garden + Bund evening',   status: 'pending', date_start: '2026-06-28' },
];

/* ── Refresh: desktop booking summary counts ───────────────── */

function refreshDesktopBookings(bookings) {
  const cols  = document.querySelectorAll('.dk-bookings .dk-booking-summary-col');
  const types = ['hotel', 'train', 'tour'];
  cols.forEach((col, i) => {
    const items     = bookings.filter(b => b.type === types[i]);
    const confirmed = items.filter(b => b.status === 'booked' || b.status === 'done').length;
    const allDone   = items.length > 0 && confirmed === items.length;
    const countEl   = col.querySelector('.dk-booking-summary-count');
    if (countEl) {
      countEl.innerHTML = `<span class="dk-booking-count-num">${confirmed}</span>/${items.length}`;
    }
    col.classList.toggle('dk-booking-summary-col--all-done', allDone);
  });
}

/* ── Render: desktop bookings checklist (dynamic) ──────────── */

const _BOOKING_ICONS = {
  hotel: '<i data-lucide="bed-double" width="16" height="16" aria-hidden="true"></i>',
  train: '<i data-lucide="train-front" width="16" height="16" aria-hidden="true"></i>',
  tour: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
         <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
         <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
};

function renderDesktopBookingChecklist(bookings) {
  const listEl     = document.querySelector('.dk-booking-checklist');
  const viewAllBtn = document.getElementById('dk-bookings-view-all');
  if (!listEl) return;

  const pending = bookings.filter(b => b.status !== 'booked' && b.status !== 'done');
  const total   = bookings.length;

  if (viewAllBtn) viewAllBtn.style.display = total >= 6 ? '' : 'none';

  if (pending.length === 0) {
    listEl.innerHTML = `<li class="dk-booking-check-item">
      <span class="dk-booking-item-label" style="color:var(--text-secondary)">All bookings confirmed ✓</span>
    </li>`;
    return;
  }

  // CASE A (total < 6): show all pending
  // CASE B (total ≥ 6): cap at 5 pending items, "View all →" shown above
  const visible = total >= 6 ? pending.slice(0, 5) : pending;

  listEl.innerHTML = visible.map(b => {
    const id        = `bk-dyn-${esc(String(b.id))}`;
    const icon      = _BOOKING_ICONS[b.type] ?? '';
    const typeLabel = b.type ? (b.type.charAt(0).toUpperCase() + b.type.slice(1)) : '';
    return `
      <li class="dk-booking-check-item">
        <label class="dk-booking-cb-wrap" for="${id}" aria-label="Mark ${esc(b.title)} as booked">
          <input type="checkbox" id="${id}" class="dk-booking-cb" data-booking-id="${esc(String(b.id))}">
        </label>
        <span class="dk-booking-item-label">
          ${icon ? `<span class="dk-booking-item-type" aria-label="${esc(typeLabel)}">${icon}</span>` : ''}
          ${esc(b.title)}
        </span>
      </li>
    `;
  }).join('');

  window.lucide?.createIcons();
}

/* ── Append: new item to desktop packing list ──────────────── */

function appendPackingItem(label) {
  const listEl = document.querySelector('.dk-packing-list');
  if (!listEl) return;
  const id = `pk-new-${Date.now()}`;
  const li = document.createElement('li');
  li.className = 'dk-booking-check-item';
  li.innerHTML = `
    <label class="dk-booking-cb-wrap" for="${id}" aria-label="Mark ${esc(label)} as packed">
      <input type="checkbox" id="${id}" class="dk-booking-cb">
    </label>
    <span class="dk-booking-item-label">${esc(label)}</span>
  `;
  listEl.appendChild(li);
}

/* ── Append: Supabase packing items on load ────────────────── */

function appendSupabasePackingItems(items) {
  const listEl = document.querySelector('.dk-packing-list');
  if (!listEl || !items || items.length === 0) return;
  items.forEach(item => {
    const id  = `pk-sb-${esc(String(item.id))}`;
    const lbl = item.item ?? item.label ?? '';
    const li  = document.createElement('li');
    li.className = 'dk-booking-check-item';
    li.innerHTML = `
      <label class="dk-booking-cb-wrap" for="${id}" aria-label="Mark ${esc(lbl)} as packed">
        <input type="checkbox" id="${id}" class="dk-booking-cb"
               data-packing-id="${esc(String(item.id))}" ${item.packed ? 'checked' : ''}>
      </label>
      <span class="dk-booking-item-label">${esc(lbl)}</span>
    `;
    listEl.appendChild(li);
  });
}

/* ── Modal: new booking ────────────────────────────────────── */

function openBookingModal(preSelectType = null) {
  const bodyHTML = `
    <div class="modal-field">
      <label class="modal-label" for="bk-modal-name">Booking</label>
      <input type="text" id="bk-modal-name" class="modal-input"
        placeholder="e.g. Hotel in Xi'an" maxlength="45" autocomplete="off">
      <div class="modal-counter" id="bk-modal-counter" aria-live="polite">0/45</div>
      <div class="modal-error" id="bk-modal-name-err" role="alert"></div>
    </div>
    <div class="modal-field">
      <span class="modal-label" id="bk-modal-tipo-lbl">Type</span>
      <div class="modal-pill-group" role="radiogroup" aria-labelledby="bk-modal-tipo-lbl">
        <button class="modal-pill" type="button" role="radio" aria-checked="false"
          data-value="hotel" tabindex="0">Hotel</button>
        <button class="modal-pill" type="button" role="radio" aria-checked="false"
          data-value="train" tabindex="-1">Train</button>
        <button class="modal-pill" type="button" role="radio" aria-checked="false"
          data-value="tour" tabindex="-1">Tour</button>
      </div>
      <div class="modal-error" id="bk-modal-type-err" role="alert"></div>
    </div>
  `;

  openModal({ id: 'bk-modal', title: 'Add booking', bodyHTML, onSave: handleBookingModalSave });

  /* Pill selection + arrow-key navigation */
  const pills = [...document.querySelectorAll('.modal-pill')];

  function selectPill(pill) {
    pills.forEach(p => {
      p.setAttribute('aria-checked', 'false');
      p.setAttribute('tabindex', '-1');
    });
    pill.setAttribute('aria-checked', 'true');
    pill.setAttribute('tabindex', '0');
    document.getElementById('bk-modal-type-err').textContent = '';
  }

  pills.forEach((pill, idx) => {
    pill.addEventListener('click', () => selectPill(pill));
    pill.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPill(pill); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = pills[(idx + 1) % pills.length];
        selectPill(next); next.focus();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = pills[(idx - 1 + pills.length) % pills.length];
        selectPill(prev); prev.focus();
      }
    });
  });

  if (preSelectType) {
    const targetPill = pills.find(p => p.dataset.value === preSelectType);
    if (targetPill) selectPill(targetPill);
  }

  /* Character counter */
  const input   = document.getElementById('bk-modal-name');
  const counter = document.getElementById('bk-modal-counter');
  input?.addEventListener('input', () => {
    counter.textContent = `${input.value.length}/45`;
    if (input.value.length > 0) {
      input.classList.remove('has-error');
      document.getElementById('bk-modal-name-err').textContent = '';
    }
  });
}

async function handleBookingModalSave() {
  const nameInput = document.getElementById('bk-modal-name');
  const pill      = document.querySelector('.modal-pill[aria-checked="true"]');
  const nameErr   = document.getElementById('bk-modal-name-err');
  const typeErr   = document.getElementById('bk-modal-type-err');
  let valid = true;

  if (!nameInput?.value.trim()) {
    nameInput?.classList.add('has-error');
    if (nameErr) nameErr.textContent = 'This field is required';
    valid = false;
  } else {
    nameInput.classList.remove('has-error');
    if (nameErr) nameErr.textContent = '';
  }

  if (!pill) {
    if (typeErr) typeErr.textContent = 'This field is required';
    valid = false;
  } else {
    if (typeErr) typeErr.textContent = '';
  }

  if (!valid) return;

  const title     = nameInput.value.trim();
  const type      = pill.dataset.value;
  const btn       = document.getElementById('bk-modal-guardar');
  if (btn) btn.disabled = true;

  const newEntry = { title, type, status: 'pending' };

  try {
    const { data, error } = await supabase.from('bookings').insert([newEntry]).select();
    if (error) throw error;
    const cached = loadFromStorage('bookings') ?? [];
    const saved  = data?.length ? data : [{ ...newEntry, id: `temp-${Date.now()}` }];
    saveToStorage('bookings', [...cached, ...saved]);
    showToast('Booking added');
  } catch (err) {
    console.warn('[modal] booking insert failed:', err);
    const cached = loadFromStorage('bookings') ?? [];
    saveToStorage('bookings', [...cached, { ...newEntry, id: `temp-${Date.now()}` }]);
  }

  closeModal();
  initOverview();
}

/* ── Modal: new reminder ───────────────────────────────────── */

function openReminderModal() {
  const CHEVRON_LEFT  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`;
  const CHEVRON_RIGHT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

  const bodyHTML = `
    <div class="modal-field">
      <label class="modal-label" for="rm-modal-name">Reminder</label>
      <input type="text" id="rm-modal-name" class="modal-input"
        placeholder="e.g. Book train tickets" maxlength="50" autocomplete="off">
      <div class="modal-counter" id="rm-modal-counter" aria-live="polite">0/50</div>
      <div class="modal-error" id="rm-modal-name-err" role="alert"></div>
    </div>
    <div class="modal-field">
      <label class="modal-label" id="rm-modal-date-lbl">Deadline</label>
      <div class="modal-calendar" id="rm-modal-calendar" role="group" aria-labelledby="rm-modal-date-lbl">
        <div class="modal-cal-header">
          <button class="modal-cal-nav" type="button" id="rm-cal-prev" aria-label="Previous month">${CHEVRON_LEFT}</button>
          <span class="modal-cal-title" id="rm-cal-title" aria-live="polite"></span>
          <button class="modal-cal-nav" type="button" id="rm-cal-next" aria-label="Next month">${CHEVRON_RIGHT}</button>
        </div>
        <div class="modal-cal-weekdays" aria-hidden="true">
          <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
        </div>
        <div class="modal-cal-grid" role="grid" id="rm-cal-grid" aria-label="Select a deadline date"></div>
      </div>
      <input type="hidden" id="rm-modal-date">
      <div class="modal-error" id="rm-modal-date-err" role="alert"></div>
    </div>
  `;

  openModal({ id: 'rm-modal', title: 'Add reminder', bodyHTML, onSave: handleReminderModalSave });

  /* Character counter */
  const input   = document.getElementById('rm-modal-name');
  const counter = document.getElementById('rm-modal-counter');
  input?.addEventListener('input', () => {
    counter.textContent = `${input.value.length}/50`;
    if (input.value.length > 0) {
      input.classList.remove('has-error');
      document.getElementById('rm-modal-name-err').textContent = '';
    }
  });

  /* Calendar */
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const now   = new Date();
  let   displayYear  = now.getFullYear();
  let   displayMonth = now.getMonth();
  let   selectedDate = null;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  function renderCalendar() {
    const titleEl = document.getElementById('rm-cal-title');
    const gridEl  = document.getElementById('rm-cal-grid');
    if (!titleEl || !gridEl) return;

    titleEl.textContent = `${MONTH_NAMES[displayMonth]} ${displayYear}`;

    const firstDow    = new Date(displayYear, displayMonth, 1).getDay();
    const startOffset = (firstDow + 6) % 7; // Mon-first offset
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const prevDays    = new Date(displayYear, displayMonth, 0).getDate();

    let html = '';

    for (let i = 0; i < startOffset; i++) {
      html += `<button class="modal-cal-day modal-cal-day--outside" type="button" aria-hidden="true" tabindex="-1">${prevDays - startOffset + i + 1}</button>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr  = `${displayYear}-${String(displayMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday  = dateStr === todayStr;
      const isSel    = dateStr === selectedDate;
      let   cls      = 'modal-cal-day';
      if (isToday) cls += ' modal-cal-day--today';
      if (isSel)   cls += ' modal-cal-day--selected';
      const ariaLabel = `${d} ${MONTH_NAMES[displayMonth]} ${displayYear}${isSel ? ', selected' : ''}${isToday ? ', today' : ''}`;
      html += `<button class="${cls}" type="button" data-date="${dateStr}" aria-label="${ariaLabel}" aria-pressed="${isSel}">${d}</button>`;
    }

    const filled  = startOffset + daysInMonth;
    const remaining = (7 - (filled % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += `<button class="modal-cal-day modal-cal-day--outside" type="button" aria-hidden="true" tabindex="-1">${d}</button>`;
    }

    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.modal-cal-day:not(.modal-cal-day--outside)').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDate = btn.dataset.date;
        document.getElementById('rm-modal-date').value = selectedDate;
        document.getElementById('rm-modal-date-err').textContent = '';
        document.getElementById('rm-modal-calendar')?.classList.remove('has-error');
        renderCalendar();
      });
    });
  }

  document.getElementById('rm-cal-prev')?.addEventListener('click', () => {
    displayMonth--;
    if (displayMonth < 0) { displayMonth = 11; displayYear--; }
    renderCalendar();
  });

  document.getElementById('rm-cal-next')?.addEventListener('click', () => {
    displayMonth++;
    if (displayMonth > 11) { displayMonth = 0; displayYear++; }
    renderCalendar();
  });

  renderCalendar();
}

async function handleReminderModalSave() {
  const nameInput = document.getElementById('rm-modal-name');
  const dateInput = document.getElementById('rm-modal-date');
  const nameErr   = document.getElementById('rm-modal-name-err');
  const dateErr   = document.getElementById('rm-modal-date-err');
  let valid = true;

  if (!nameInput?.value.trim()) {
    nameInput?.classList.add('has-error');
    if (nameErr) nameErr.textContent = 'This field is required';
    valid = false;
  } else {
    nameInput.classList.remove('has-error');
    if (nameErr) nameErr.textContent = '';
  }

  if (!dateInput?.value) {
    document.getElementById('rm-modal-calendar')?.classList.add('has-error');
    if (dateErr) dateErr.textContent = 'This field is required';
    valid = false;
  } else {
    document.getElementById('rm-modal-calendar')?.classList.remove('has-error');
    if (dateErr) dateErr.textContent = '';
  }

  if (!valid) return;

  const title    = nameInput.value.trim();
  const due_date = dateInput.value;
  const btn      = document.getElementById('rm-modal-guardar');
  if (btn) btn.disabled = true;

  const newEntry = { title, due_date, status: 'pending' };

  try {
    const { data, error } = await supabase.from('reminders').insert([newEntry]).select();
    if (error) throw error;
    const cached = loadFromStorage('reminders') ?? [];
    saveToStorage('reminders', [...cached, ...(data ?? [newEntry])]);
    showToast('Reminder added');
  } catch (err) {
    console.warn('[modal] reminder insert failed:', err);
    const cached = loadFromStorage('reminders') ?? [];
    saveToStorage('reminders', [...cached, { ...newEntry, id: `temp-${Date.now()}` }]);
  }

  closeModal();

  const updated = loadFromStorage('reminders') ?? [];
  renderDesktopReminders(updated.length > 0 ? updated : STATIC_REMINDERS);
}

/* ── Modal: new packing item ───────────────────────────────── */

function openPackingModal() {
  const CAT_OPTIONS = STATIC_PACKING_LIST.map(c => c.category);

  const optionsHTML = CAT_OPTIONS.map(cat => `
    <li class="modal-custom-select-option" role="option" aria-selected="false"
        data-value="${esc(cat.toLowerCase())}" tabindex="-1">${esc(cat)}</li>
  `).join('');

  const bodyHTML = `
    <div class="modal-field">
      <label class="modal-label" for="pk-modal-name">Item</label>
      <input type="text" id="pk-modal-name" class="modal-input"
        placeholder="e.g. Rain jacket" maxlength="40" autocomplete="off">
      <div class="modal-counter" id="pk-modal-counter" aria-live="polite">0/40</div>
      <div class="modal-error" id="pk-modal-name-err" role="alert"></div>
    </div>
    <div class="modal-field">
      <label class="modal-label" id="pk-modal-cat-lbl">Category</label>
      <div class="modal-custom-select" aria-expanded="false">
        <button class="modal-custom-select-trigger is-placeholder" type="button"
                id="pk-modal-cat-btn"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-controls="pk-modal-cat-list"
                aria-labelledby="pk-modal-cat-lbl">
          <span class="modal-custom-select-value">Select a category</span>
          <svg class="modal-custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
            <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <ul class="modal-custom-select-list" role="listbox" id="pk-modal-cat-list" aria-labelledby="pk-modal-cat-lbl">
          ${optionsHTML}
        </ul>
        <input type="hidden" id="pk-modal-cat" value="">
      </div>
      <div class="modal-error" id="pk-modal-cat-err" role="alert"></div>
    </div>
  `;

  openModal({ id: 'pk-modal', title: 'Add item', bodyHTML, onSave: handlePackingModalSave });

  /* Character counter */
  const input   = document.getElementById('pk-modal-name');
  const counter = document.getElementById('pk-modal-counter');
  input?.addEventListener('input', () => {
    counter.textContent = `${input.value.length}/40`;
    if (input.value.length > 0) {
      input.classList.remove('has-error');
      document.getElementById('pk-modal-name-err').textContent = '';
    }
  });

  /* Custom select — category */
  const csWrap    = document.querySelector('#pk-modal-cat-list')?.closest('.modal-custom-select');
  const csTrigger = document.getElementById('pk-modal-cat-btn');
  const csList    = document.getElementById('pk-modal-cat-list');
  const csValue   = csTrigger?.querySelector('.modal-custom-select-value');
  const csHidden  = document.getElementById('pk-modal-cat');
  const csOptions = [...(csList?.querySelectorAll('.modal-custom-select-option') ?? [])];

  function pkCsOutside(e) {
    if (!csWrap?.contains(e.target)) pkCsClose();
  }

  function pkCsOpen() {
    csWrap?.setAttribute('aria-expanded', 'true');
    csTrigger?.setAttribute('aria-expanded', 'true');
    csList?.classList.add('is-open');
    const sel = csOptions.find(o => o.getAttribute('aria-selected') === 'true') ?? csOptions[0];
    sel?.focus();
    setTimeout(() => document.addEventListener('click', pkCsOutside, { capture: true }), 0);
  }

  function pkCsClose() {
    csWrap?.setAttribute('aria-expanded', 'false');
    csTrigger?.setAttribute('aria-expanded', 'false');
    csList?.classList.remove('is-open');
    document.removeEventListener('click', pkCsOutside, { capture: true });
  }

  function pkCsSelect(opt) {
    csOptions.forEach(o => o.setAttribute('aria-selected', 'false'));
    opt.setAttribute('aria-selected', 'true');
    if (csHidden)  csHidden.value      = opt.dataset.value ?? '';
    if (csValue)   csValue.textContent = opt.textContent;
    csTrigger?.classList.remove('is-placeholder');
    csTrigger?.classList.remove('has-error');
    document.getElementById('pk-modal-cat-err').textContent = '';
    pkCsClose();
    csTrigger?.focus();
  }

  csTrigger?.addEventListener('click', () => {
    csList?.classList.contains('is-open') ? pkCsClose() : pkCsOpen();
  });

  csTrigger?.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pkCsOpen(); }
    if (e.key === 'Escape') pkCsClose();
  });

  csOptions.forEach((opt, idx) => {
    opt.addEventListener('click', () => pkCsSelect(opt));
    opt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ')  { e.preventDefault(); pkCsSelect(opt); }
      if (e.key === 'Escape')                  { pkCsClose(); csTrigger?.focus(); }
      if (e.key === 'ArrowDown')               { e.preventDefault(); csOptions[Math.min(idx + 1, csOptions.length - 1)]?.focus(); }
      if (e.key === 'ArrowUp')                 { e.preventDefault(); csOptions[Math.max(idx - 1, 0)]?.focus(); }
    });
  });
}

async function handlePackingModalSave() {
  const nameInput  = document.getElementById('pk-modal-name');
  const catHidden  = document.getElementById('pk-modal-cat');
  const catTrigger = document.getElementById('pk-modal-cat-btn');
  const nameErr    = document.getElementById('pk-modal-name-err');
  const catErr     = document.getElementById('pk-modal-cat-err');
  let valid = true;

  if (!nameInput?.value.trim()) {
    nameInput?.classList.add('has-error');
    if (nameErr) nameErr.textContent = 'This field is required';
    valid = false;
  } else {
    nameInput.classList.remove('has-error');
    if (nameErr) nameErr.textContent = '';
  }

  if (!catHidden?.value) {
    catTrigger?.classList.add('has-error');
    if (catErr) catErr.textContent = 'This field is required';
    valid = false;
  } else {
    catTrigger?.classList.remove('has-error');
    if (catErr) catErr.textContent = '';
  }

  if (!valid) return;

  const label    = nameInput.value.trim();
  const category = catHidden.value;
  const btn      = document.getElementById('pk-modal-guardar');
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await supabase
      .from('packing_list')
      .insert([{ item: label, category, packed: false }])
      .select();
    if (error) throw error;
    const cached  = loadFromStorage('packing_list') ?? [];
    const saved   = data?.length ? data : [{ item: label, category, packed: false, id: `temp-${Date.now()}` }];
    saveToStorage('packing_list', [...cached, ...saved]);
    showToast('Item added');
  } catch (err) {
    console.warn('[modal] packing_list insert failed:', err);
    const cached = loadFromStorage('packing_list') ?? [];
    saveToStorage('packing_list', [...cached, { item: label, category, packed: false, id: `temp-${Date.now()}` }]);
  }

  closeModal();
  appendPackingItem(label);
}

/* ── Desktop bookings handlers ─────────────────────────────── */

export function initDesktopBookings() {
  const section = document.querySelector('.dk-bookings');
  if (!section) return;

  // "+" button — opens the add booking modal
  document.getElementById('dk-bookings-add')
    ?.addEventListener('click', openBookingModal);

  // Checkbox delegation — mark booking as booked in Supabase on check
  section.addEventListener('change', e => {
    if (e.target.matches('.dk-booking-cb') && e.target.dataset.bookingId) {
      handleBookingCheck(e.target.dataset.bookingId, e.target);
    }
  });

  // "View all →" — opens the sidebar with grouped bookings
  document.getElementById('dk-bookings-view-all')
    ?.addEventListener('click', () => {
      const bookings = loadFromStorage('bookings') ?? STATIC_BOOKINGS_FALLBACK;
      openSidebar('Bookings', renderBookingsSidebarContent(bookings));
      window.lucide?.createIcons();
    });

  // Sidebar "Add item +" buttons — delegated from sidebar content
  document.getElementById('sidebar-content')?.addEventListener('click', e => {
    const btn = e.target.closest('.sb-add-link[data-booking-type]');
    if (!btn) return;
    openBookingModal(btn.dataset.bookingType);
  });

  // Sidebar booking checkboxes — toggle status in Supabase and refresh cards
  document.getElementById('sidebar-content')?.addEventListener('change', async e => {
    const cb = e.target;
    if (!cb.matches('.sb-booking-cb[data-booking-id]')) return;
    const bookingId = cb.dataset.bookingId;
    const newStatus = cb.checked ? 'booked' : 'pending';
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);
      if (error) throw error;

      const cached = loadFromStorage('bookings') ?? [];
      saveToStorage('bookings', cached.map(b =>
        String(b.id) === String(bookingId) ? { ...b, status: newStatus } : b
      ));
      // Refresh the booking cards without closing the sidebar
      const updated = loadFromStorage('bookings') ?? STATIC_BOOKINGS_FALLBACK;
      refreshDesktopBookings(updated);
      renderDesktopBookingChecklist(updated);
      initOverview();
    } catch (err) {
      console.warn('[overview] sidebar booking toggle failed:', err);
      cb.checked = !cb.checked;
    }
  });
}

/* ── Build merged packing categories (static + Supabase) ──── */

async function buildPackingCategories() {
  let supabaseItems = [];
  try {
    const { data, error } = await supabase.from('packing_list').select('*');
    if (!error && data) {
      supabaseItems = data;
      saveToStorage('packing_list', data);
    }
  } catch (_) {
    supabaseItems = loadFromStorage('packing_list') ?? [];
  }

  // Clone static list as base (static items don't have a DB row)
  const merged = STATIC_PACKING_LIST.map(cat => ({
    category: cat.category,
    items: cat.items.map(i => ({ id: i.id, label: i.label, packed: i.packed })),
  }));

  // Append Supabase items to their category slot (create slot if unknown)
  supabaseItems.forEach(row => {
    const catKey   = (row.category ?? '').toLowerCase();
    const catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
    let slot = merged.find(c => c.category.toLowerCase() === catKey);
    if (!slot) {
      slot = { category: catLabel, items: [] };
      merged.push(slot);
    }
    slot.items.push({ id: row.id, label: row.item ?? '', packed: row.packed ?? false });
  });

  return merged;
}

/* ── Desktop packing list handler ─────────────────────────── */

export function initDesktopPacking() {
  // "+" button — opens the add packing item modal
  document.getElementById('dk-packing-add')
    ?.addEventListener('click', openPackingModal);

  // "See all" — merges static defaults with Supabase rows before opening sidebar
  document.getElementById('dk-packing-see-all')
    ?.addEventListener('click', async () => {
      const categories = await buildPackingCategories();
      openSidebar('Packing list', renderPackingSidebarContent(categories));
    });

  // Sidebar "Add item +" — delegated from sidebar content
  document.getElementById('sidebar-content')?.addEventListener('click', e => {
    if (!e.target.closest('[data-packing-add]')) return;
    openPackingModal();
  });

  // Checkbox delegation — update packed state in Supabase
  const packingSection = document.querySelector('.dk-packing');
  packingSection?.addEventListener('change', async e => {
    const cb = e.target;
    if (!cb.matches('.dk-booking-cb') || !cb.dataset.packingId) return;
    const packed = cb.checked;
    try {
      const { error } = await supabase
        .from('packing_list')
        .update({ packed })
        .eq('id', cb.dataset.packingId);
      if (error) throw error;
      const cached = loadFromStorage('packing_list') ?? [];
      saveToStorage('packing_list', cached.map(i =>
        String(i.id) === String(cb.dataset.packingId) ? { ...i, packed } : i
      ));
    } catch (err) {
      console.warn('[packing] packed update failed:', err);
      cb.checked = !packed;
    }
  });

  // Load user-added packing items from Supabase and append to static list
  (async () => {
    try {
      const { data, error } = await supabase.from('packing_list').select('*');
      if (error) throw error;
      saveToStorage('packing_list', data ?? []);
      appendSupabasePackingItems(data ?? []);
    } catch (err) {
      console.warn('[packing] load failed, trying localStorage:', err);
      appendSupabasePackingItems(loadFromStorage('packing_list') ?? []);
    }
  })();
}

/* ── Static reminders data ─────────────────────────────────── */

const STATIC_REMINDERS = [
  { id: 'rm-1',  title: 'Book Mutianyu Great Wall tickets',                    due_date: '2026-05-25', status: 'pending', notes: 'GetYourGuide booking required before departure' },
  { id: 'rm-2',  title: 'Set up VPN before arriving in China',                 due_date: '2026-05-27', status: 'pending', notes: null },
  { id: 'rm-3',  title: 'Exchange euros to yuan or set up Wise',               due_date: '2026-05-28', status: 'pending', notes: 'Have cash ready for arrival' },
  { id: 'rm-4',  title: 'Buy travel adapter (Type A/I for China)',             due_date: '2026-05-28', status: 'pending', notes: null },
  { id: 'rm-5',  title: 'Notify bank of travel dates',                         due_date: '2026-05-30', status: 'pending', notes: null },
  { id: 'rm-6',  title: 'Confirm hotel check-in times for all cities',         due_date: '2026-06-01', status: 'pending', notes: null },
  { id: 'rm-7',  title: 'Pack and weigh luggage',                              due_date: '2026-06-03', status: 'pending', notes: 'Must be under 23kg for Air France' },
  { id: 'rm-8',  title: "Download offline maps for Beijing, Xi'an, Chengdu",  due_date: '2026-06-04', status: 'pending', notes: 'Maps.me or Google Maps offline' },
  { id: 'rm-9',  title: 'Print visa confirmation and flight itinerary',        due_date: '2026-06-04', status: 'pending', notes: null },
  { id: 'rm-10', title: 'Check in online for AF0202',                          due_date: '2026-06-05', status: 'pending', notes: 'Opens 30 hours before departure at 22:45' },
];

/* ── Reminder due label for sidebar ────────────────────────── */

function remSidebarDueLabel(dueDateStr) {
  if (!dueDateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const diff = Math.ceil((due - today) / 86400000);
  const dateLabel = due.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  if (diff < 0)  return `${dateLabel}`;
  if (diff === 0) return `${dateLabel} · Today`;
  return `${dateLabel} · In ${diff} days`;
}

/* ── Render: reminders sidebar content ─────────────────────── */

function renderRemindersSidebarContent(reminders) {
  const pending = reminders.filter(r => r.status !== 'done');
  const done    = reminders.filter(r => r.status === 'done');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function reminderItemHTML(r) {
    const isDone   = r.status === 'done';
    const [y, m, d] = (r.due_date ?? '').split('-').map(Number);
    const due      = r.due_date ? new Date(y, m - 1, d) : null;
    const overdue  = due && due < today && !isDone;
    const dueLabel = remSidebarDueLabel(r.due_date);
    const dueClass = overdue ? 'style="color:var(--terracotta)"' : '';

    return `
      <div class="sb-reminder-item sb-booking-item${isDone ? ' sb-reminder-done' : ''}">
        <input
          type="checkbox"
          class="sb-booking-cb"
          ${isDone ? 'checked' : ''}
          aria-label="${esc(r.title)}"
          data-reminder-id="${esc(r.id)}"
        >
        <div class="sb-booking-label-wrap">
          <span class="sb-booking-label">${esc(r.title)}</span>
          ${r.due_date ? `<span class="sb-booking-meta" ${dueClass}>${overdue ? 'Overdue' : esc(dueLabel)}</span>` : ''}
        </div>
      </div>
    `;
  }

  const pendingHTML = pending.length > 0
    ? pending.map(reminderItemHTML).join('')
    : `<p class="sb-booking-empty">No pending reminders</p>`;

  const doneHTML = done.length > 0
    ? done.map(reminderItemHTML).join('')
    : '';

  return `
    <div class="sb-hide-toggle">
      <input type="checkbox" id="sb-hide-done" class="sb-booking-cb" aria-label="Hide done reminders">
      <label for="sb-hide-done" class="sb-hide-label">Hide done</label>
    </div>
    <div role="group" aria-label="Pending reminders">
      <div class="sb-section-header">
        <span class="sb-section-label">Pending</span>
      </div>
      ${pendingHTML}
    </div>
    ${done.length > 0 ? `
    <div class="sb-section-divider" aria-hidden="true"></div>
    <div role="group" aria-label="Done reminders">
      <div class="sb-section-header">
        <span class="sb-section-label">Done</span>
      </div>
      ${doneHTML}
    </div>` : ''}
    <button class="sb-add-link" type="button" data-reminder-add="true">
      Add reminder
      <span class="sb-add-icon-circle">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/></svg>
      </span>
    </button>
  `;
}

/* ── Render: desktop reminders card ────────────────────────── */

function renderDesktopReminders(reminders) {
  const list       = document.querySelector('.dk-reminders .dk-reminder-list');
  const viewAllBtn = document.getElementById('dk-reminders-view-all');
  if (!list) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total   = reminders.length;
  const pending = reminders
    .filter(r => r.status !== 'done')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));

  // CASE A: ≤ 6 total — show all regardless of checked state, no "View all"
  // CASE B: ≥ 7 total — show first 6 unchecked (by due_date asc) only
  const visible = total <= 6
    ? reminders.slice().sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    : pending.slice(0, 6);

  function reminderItemHTML(r) {
    const isDone = r.status === 'done';

    const dueClass = (() => {
      if (!r.due_date || isDone) return 'dk-due-future';
      const [y, m, d] = r.due_date.split('-').map(Number);
      const diff = Math.ceil((new Date(y, m - 1, d) - today) / 86400000);
      if (diff < 0)   return 'dk-due-overdue';
      if (diff === 0) return 'dk-due-today';
      return 'dk-due-future';
    })();

    const dueText = (() => {
      if (!r.due_date) return '';
      const [y, m, d] = r.due_date.split('-').map(Number);
      const due  = new Date(y, m - 1, d);
      const diff = Math.ceil((due - today) / 86400000);
      const date = due.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
      if (diff < 0)   return `${date} · Overdue`;
      if (diff === 0) return `${date} · Today`;
      return `${date} · In ${diff} days`;
    })();

    return `
      <li class="dk-reminder-item${isDone ? ' dk-reminder-item--done' : ''}">
        <label class="dk-booking-cb-wrap" for="dk-rm-${esc(r.id)}" aria-label="Mark ${esc(r.title)} as done">
          <input type="checkbox" id="dk-rm-${esc(r.id)}" class="dk-checkbox" ${isDone ? 'checked' : ''} data-reminder-id="${esc(r.id)}">
        </label>
        <div class="dk-reminder-body">
          <span class="dk-reminder-title">${esc(r.title)}</span>
          ${dueText ? `<span class="dk-reminder-due ${dueClass}">${esc(dueText)}</span>` : ''}
        </div>
      </li>
    `;
  }

  list.innerHTML = visible.map(reminderItemHTML).join('')
    || `<li class="dk-reminder-item"><span class="dk-reminder-title" style="color:var(--text-secondary)">No reminders yet</span></li>`;

  if (viewAllBtn) {
    viewAllBtn.style.display = total >= 7 ? '' : 'none';
  }
}

/* ── Inline edit for reminder labels ──────────────────────── */

async function startReminderInlineEdit(el, reminderId, titleClass) {
  const original = el.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = original;
  input.className = 'reminder-inline-input';
  el.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;

  async function commit() {
    if (committed) return;
    committed = true;
    const val = input.value.trim();

    if (val === '') {
      try {
        await supabase.from('reminders').delete().eq('id', reminderId);
        const cached = loadFromStorage('reminders') ?? [];
        saveToStorage('reminders', cached.filter(r => String(r.id) !== String(reminderId)));
      } catch (err) { console.warn('[reminders] delete failed:', err); }
      input.closest('.dk-reminder-item, .sb-reminder-item')?.remove();
      return;
    }

    const span = document.createElement('span');
    span.className = titleClass;
    span.textContent = val;
    input.replaceWith(span);

    if (val !== original) {
      try {
        await supabase.from('reminders').update({ title: val }).eq('id', reminderId);
        const cached = loadFromStorage('reminders') ?? [];
        saveToStorage('reminders', cached.map(r =>
          String(r.id) === String(reminderId) ? { ...r, title: val } : r
        ));
      } catch (err) { console.warn('[reminders] update failed:', err); }
    }
  }

  function cancel() {
    if (committed) return;
    committed = true;
    const span = document.createElement('span');
    span.className = titleClass;
    span.textContent = original;
    input.replaceWith(span);
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });

  input.addEventListener('blur', commit);
}

/* ── Desktop reminders handler ─────────────────────────────── */

export function initDesktopReminders() {
  // "+" button — opens the add reminder modal
  document.getElementById('dk-reminders-add')
    ?.addEventListener('click', openReminderModal);

  const viewAllBtn = document.getElementById('dk-reminders-view-all');
  if (!viewAllBtn) return;

  // Skeleton while Supabase loads
  const list = document.querySelector('.dk-reminders .dk-reminder-list');
  if (list) {
    list.innerHTML = [1,2,3].map(() =>
      `<li class="dk-reminder-item" aria-hidden="true">
        <div class="skeleton" style="width:16px;height:16px;border-radius:4px;flex-shrink:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px">
          <div class="skeleton skeleton-text medium" style="height:12px"></div>
          <div class="skeleton skeleton-text short" style="height:10px"></div>
        </div>
      </li>`
    ).join('');
  }

  // Hidden until data loads — renderDesktopReminders sets final visibility
  viewAllBtn.style.display = 'none';

  viewAllBtn.addEventListener('click', () => {
    const reminders = loadFromStorage('reminders') ?? STATIC_REMINDERS;
    const source = Array.isArray(reminders) && reminders.length > 0 ? reminders : STATIC_REMINDERS;
    openSidebar('Reminders', renderRemindersSidebarContent(source));
  });

  // Desktop reminders card — checkbox toggle
  document.querySelector('.dk-reminders')?.addEventListener('change', async e => {
    const cb = e.target;
    if (!cb.matches('.dk-checkbox[data-reminder-id]')) return;
    const reminderId = cb.dataset.reminderId;
    const newStatus  = cb.checked ? 'done' : 'pending';
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: newStatus })
        .eq('id', reminderId);
      if (error) throw error;

      // Fetch fresh from Supabase then re-render
      const { data, error: fetchErr } = await supabase.from('reminders').select('*');
      if (!fetchErr && data) {
        saveToStorage('reminders', data);
        renderDesktopReminders(data);
        renderPlanningHeader(
          loadFromStorage('bookings') ?? [],
          data
        );
      } else {
        const cached = loadFromStorage('reminders') ?? [];
        const updated = cached.map(r =>
          String(r.id) === String(reminderId) ? { ...r, status: newStatus } : r
        );
        saveToStorage('reminders', updated);
        renderDesktopReminders(updated);
      }
    } catch (err) {
      console.warn('[reminders] checkbox toggle failed:', err);
      cb.checked = !cb.checked;
    }
  });

  // Inline edit — desktop reminders card
  document.querySelector('.dk-reminders')?.addEventListener('click', e => {
    const titleEl = e.target.closest('.dk-reminder-title');
    if (!titleEl) return;
    const item = titleEl.closest('.dk-reminder-item');
    const reminderId = item?.querySelector('[data-reminder-id]')?.dataset?.reminderId;
    if (!reminderId) return;
    startReminderInlineEdit(titleEl, reminderId, 'dk-reminder-title');
  });

  // Sidebar "+ Add reminder" — delegated from sidebar content
  document.getElementById('sidebar-content')?.addEventListener('click', e => {
    if (!e.target.closest('[data-reminder-add]')) return;
    openReminderModal();
  });

  // Inline edit — reminders sidebar
  document.getElementById('sidebar-content')?.addEventListener('click', e => {
    const labelEl = e.target.closest('.sb-reminder-item .sb-booking-label');
    if (!labelEl || labelEl.tagName === 'INPUT') return;
    const row = labelEl.closest('.sb-reminder-item');
    const reminderId = row?.querySelector('[data-reminder-id]')?.dataset?.reminderId;
    if (!reminderId) return;
    startReminderInlineEdit(labelEl, reminderId, 'sb-booking-label');
  });

  // Sidebar reminders — checkbox toggle with CASE B swap logic
  document.getElementById('sidebar-content')?.addEventListener('change', async e => {
    const cb = e.target;
    if (!cb.matches('.sb-booking-cb[data-reminder-id]')) return;
    const reminderId = cb.dataset.reminderId;
    const newStatus  = cb.checked ? 'done' : 'pending';
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: newStatus })
        .eq('id', reminderId);
      if (error) throw error;

      // Fetch fresh, update storage and card
      const { data, error: fetchErr } = await supabase.from('reminders').select('*');
      const fresh = (!fetchErr && data) ? data : (() => {
        const cached = loadFromStorage('reminders') ?? [];
        return cached.map(r =>
          String(r.id) === String(reminderId) ? { ...r, status: newStatus } : r
        );
      })();
      if (!fetchErr && data) saveToStorage('reminders', fresh);

      // Re-render card (CASE B swap logic applied inside renderDesktopReminders)
      renderDesktopReminders(fresh);

      // Re-render sidebar content so panel stays in sync (all items, current state)
      const sidebarContent = document.getElementById('sidebar-content');
      if (sidebarContent) {
        sidebarContent.innerHTML = renderRemindersSidebarContent(fresh);
        window.lucide?.createIcons();
      }
    } catch (err) {
      console.warn('[reminders] sidebar checkbox toggle failed:', err);
      cb.checked = !cb.checked;
    }
  });
}

/* ── Weather widget ───────────────────────────────────────── */

const WEATHER_COORDS = {
  beijing:   [39.9042, 116.4074],
  xian:      [34.3416, 108.9398],
  chengdu:   [30.5728, 104.0668],
  chongqing: [29.5630, 106.5516],
  shanghai:  [31.2304, 121.4737],
};

/* WMO weather code → SVG icon (Lucide-style, 20×20) */
function weatherIcon(code) {
  const c = Number(code);
  // Clear sky
  if (c === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  // Partly cloudy
  if (c >= 1 && c <= 3) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
  // Fog
  if (c >= 45 && c <= 48) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M9 21h6"/><path d="M11 23h2"/></svg>`;
  // Rain
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="23" x2="8" y2="23"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="16" y1="19" x2="16" y2="21"/></svg>`;
  // Snow
  if (c >= 71 && c <= 77) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16h.01"/><path d="M8 20h.01"/><path d="M12 18h.01"/><path d="M12 22h.01"/><path d="M16 16h.01"/><path d="M16 20h.01"/></svg>`;
  // Thunderstorm
  if (c >= 95 && c <= 99) return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M13 10 9 18h5l-1 4 5-8h-5l1-4Z"/></svg>`;
  // Default: cloud
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
}

/* Module-level weather widget element (shared between carousel + mode toggle) */
let weatherWidgetEl = null;

async function fetchAndUpdateWeather(cityKey) {
  if (!weatherWidgetEl) return;
  const coords = WEATHER_COORDS[cityKey];
  if (!coords) return;
  const [lat, lon] = coords;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    const json = await res.json();
    const temp = Math.round(json?.current?.temperature_2m ?? 0);
    const code = json?.current?.weathercode ?? 0;

    weatherWidgetEl.querySelector('.dk-weather-icon').innerHTML = weatherIcon(code);
    weatherWidgetEl.querySelector('.dk-weather-temp').textContent = `${temp}°C`;
    weatherWidgetEl.classList.add('is-visible');
  } catch (_) {
    /* Silent fail — hide widget */
    weatherWidgetEl.classList.remove('is-visible');
  }
}

/* ── Hero carousel ─────────────────────────────────────────── */

const CAROUSEL_CITIES = [
  {
    key: 'beijing',   name: 'Beijing',   date: '2026-06-05',
    img: { src: 'assets/beijing-hero.jpg',   alt: 'Aerial view of Beijing city centre' },
  },
  {
    key: 'xian',      name: "Xi'an",     date: '2026-06-13',
    img: { src: 'assets/xian.jpg', alt: "Xi'an ancient city wall at dusk" },
  },
  {
    key: 'chengdu',   name: 'Chengdu',   date: '2026-06-17',
    img: { src: 'assets/chengdu.jpg',        alt: 'Giant pandas at Chengdu Research Base' },
  },
  {
    key: 'chongqing', name: 'Chongqing', date: '2026-06-22',
    img: { src: 'assets/chongqing.jpg',      alt: 'Chongqing skyline at night' },
  },
  {
    key: 'shanghai',  name: 'Shanghai',  date: '2026-06-26',
    img: { src: 'assets/shanghai-hero.jpg',  alt: 'Shanghai skyline and Huangpu River' },
  },
];

export async function initCarousel() {
  const hero = document.querySelector('.dk-hero');
  if (!hero) return;

  // Load trip_config for demo mode and departure date override
  let refStr = todayStr();
  let beDate = '2026-06-05';
  try {
    const configRows = await loadTripConfig();
    const get = key => configRows.find(r => r.key === key)?.value ?? null;
    const demoMode = get('demo_mode');
    const demoRef  = get('demo_reference_date');
    const depDate  = get('flight_departure_date');
    if (demoMode === 'true' && demoRef) refStr = demoRef;
    if (depDate) beDate = depDate;
  } catch (e) {
    console.warn('[carousel] trip_config load failed:', e);
  }

  // Beijing date comes from trip_config
  const cities = CAROUSEL_CITIES.map((c, i) => ({
    ...c,
    date: i === 0 ? beDate : c.date,
  }));

  // Compute days remaining per city
  const [ry, rm, rd] = refStr.split('-').map(Number);
  const refDate = new Date(ry, rm - 1, rd);

  const cityData = cities.map(city => {
    const [cy, cm, cd] = city.date.split('-').map(Number);
    const daysLeft = Math.ceil((new Date(cy, cm - 1, cd) - refDate) / 86400000);
    return { ...city, daysLeft };
  });

  // Initial slide: first city still in the future; fallback to Beijing
  const upcoming = cityData.filter(c => c.daysLeft > 0);
  let currentIndex = upcoming.length > 0 ? cityData.indexOf(upcoming[0]) : 0;

  // Build carousel container
  const carouselEl = document.createElement('div');
  carouselEl.className = 'dk-carousel';

  const dotsEl = document.createElement('div');
  dotsEl.className = 'dk-carousel-dots';
  dotsEl.setAttribute('role', 'toolbar');
  dotsEl.setAttribute('aria-label', 'Carousel navigation');

  cityData.forEach((city, i) => {
    // Slide
    const slide = document.createElement('div');
    slide.className = 'dk-carousel-slide' + (i === currentIndex ? ' is-active' : '');
    slide.dataset.city = city.key;
    slide.setAttribute('aria-hidden', i !== currentIndex ? 'true' : 'false');

    const img = document.createElement('img');
    img.src = city.img.src;
    img.alt = city.img.alt;
    img.className = 'dk-hero-img';
    img.loading = i === currentIndex ? 'eager' : 'lazy';

    const gradient = document.createElement('div');
    gradient.className = 'dk-slide-gradient';
    gradient.setAttribute('aria-hidden', 'true');

    const content = document.createElement('div');
    content.className = 'dk-slide-content';

    if (city.daysLeft > 0) {
      const numEl = document.createElement('span');
      numEl.className = 'dk-countdown-number';
      numEl.textContent = city.daysLeft;

      const labelEl = document.createElement('span');
      labelEl.className = 'dk-countdown-label';
      labelEl.textContent = `days to ${city.name}`;

      content.appendChild(numEl);
      content.appendChild(labelEl);
    } else {
      const nameEl = document.createElement('span');
      nameEl.className = 'dk-countdown-number';
      nameEl.style.fontWeight = '500';
      nameEl.textContent = city.name;
      content.appendChild(nameEl);
    }

    slide.appendChild(img);
    slide.appendChild(gradient);
    slide.appendChild(content);
    carouselEl.appendChild(slide);

    // Dot
    const dot = document.createElement('button');
    dot.className = 'dk-carousel-dot' + (i === currentIndex ? ' is-active' : '');
    dot.setAttribute('type', 'button');
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `Go to ${city.name} slide`);
    dotsEl.appendChild(dot);
  });

  // Insert carousel and dots before the mode toggle
  const modeToggle = hero.querySelector('.dk-mode-toggle');
  hero.insertBefore(carouselEl, modeToggle);
  hero.insertBefore(dotsEl, modeToggle);

  const slides = carouselEl.querySelectorAll('.dk-carousel-slide');
  const dots   = dotsEl.querySelectorAll('.dk-carousel-dot');

  /* ── Weather widget (Travel mode only, bottom-right of hero) ── */
  weatherWidgetEl = document.createElement('div');
  weatherWidgetEl.className = 'dk-weather-widget';
  weatherWidgetEl.setAttribute('aria-hidden', 'true');
  weatherWidgetEl.innerHTML = `
    <span class="dk-weather-icon"></span>
    <span class="dk-weather-temp"></span>
  `;
  hero.appendChild(weatherWidgetEl);

  function goTo(index) {
    slides[currentIndex].classList.remove('is-active');
    slides[currentIndex].setAttribute('aria-hidden', 'true');
    dots[currentIndex].classList.remove('is-active');

    currentIndex = index;

    slides[currentIndex].classList.add('is-active');
    slides[currentIndex].setAttribute('aria-hidden', 'false');
    dots[currentIndex].classList.add('is-active');

    /* Fetch weather for the new city if we're in travel mode */
    const layout = document.querySelector('.desktop-layout');
    if (layout && layout.classList.contains('mode-travel')) {
      fetchAndUpdateWeather(cities[currentIndex].key);
    }
  }

  let timer = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resetTimer() {
    clearInterval(timer);
    if (!prefersReducedMotion) {
      timer = setInterval(() => goTo((currentIndex + 1) % slides.length), 10000);
    }
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goTo(i); resetTimer(); });
  });

  /* If already in travel mode on init, fetch weather for current slide */
  const layout = document.querySelector('.desktop-layout');
  if (layout && layout.classList.contains('mode-travel')) {
    fetchAndUpdateWeather(cities[currentIndex].key);
  }

  resetTimer();
}

/* ── Desktop mode toggle ───────────────────────────────────── */

export function initDesktopToggle() {
  const layout = document.querySelector('.desktop-layout');
  if (!layout) return;

  // Restore saved mode; default to planning
  const savedMode = localStorage.getItem('dashboardMode') ?? 'planning';
  const savedIsTravel = savedMode === 'travel';
  layout.classList.toggle('mode-travel', savedIsTravel);
  layout.querySelectorAll('.dk-mode-btn').forEach(btn => {
    const btnIsTravel = btn.textContent.trim() === 'Travel';
    btn.classList.toggle('active', btnIsTravel === savedIsTravel);
    btn.setAttribute('aria-pressed', String(btnIsTravel === savedIsTravel));
  });

  layout.querySelectorAll('.dk-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      layout.querySelectorAll('.dk-mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      const isTravel = btn.textContent.trim() === 'Travel';
      layout.classList.toggle('mode-travel', isTravel);
      localStorage.setItem('dashboardMode', isTravel ? 'travel' : 'planning');

      /* Show weather when switching to Travel; hide for Planning */
      if (weatherWidgetEl) {
        if (!isTravel) {
          weatherWidgetEl.classList.remove('is-visible');
        } else {
          /* Fetch for whichever carousel slide is currently active */
          const activeSlide = document.querySelector('.dk-carousel-slide.is-active');
          const cityKey     = activeSlide?.dataset?.city;
          if (cityKey) fetchAndUpdateWeather(cityKey);
        }
      }
    });
  });
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

  // Render desktop reminders card with real data (max 5, dynamic count)
  const remindersSource = Array.isArray(reminders) && reminders.length > 0
    ? reminders
    : STATIC_REMINDERS;
  renderDesktopReminders(remindersSource);

  // Render desktop bookings checklist + summary counts with real data
  const bookingsSource = Array.isArray(bookings) && bookings.length > 0
    ? bookings
    : STATIC_BOOKINGS_FALLBACK;
  renderDesktopBookingChecklist(bookingsSource);
  refreshDesktopBookings(bookingsSource);

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

  // "View all →" buttons in booking cards — open sidebar
  document.getElementById('booking-bento')
    ?.addEventListener('click', e => {
      const btn = e.target.closest('.booking-view-all-btn[data-booking-type]');
      if (!btn) return;
      const bookingsSource = loadFromStorage('bookings') ?? STATIC_BOOKINGS_FALLBACK;
      openSidebar('Bookings', renderBookingsSidebarContent(bookingsSource));
      window.lucide?.createIcons();
    });
}

/* ============================================================
   UNIFIED ITINERARY COMPONENT
   ============================================================ */

/* ── Static activity data ──────────────────────────────────── */

const STATIC_ACTIVITIES = {
  beijing: {
    '2026-06-06': [
      { period: 'Day', items: [
        { title: 'Arrive Beijing Capital Airport', time: '15:55', end_time: null, duration: null, type: 'transport', source: 'Self-organised' },
        { title: 'Check-in Yitel Hotel', time: '18:00', end_time: null, duration: null, type: 'accommodation', source: 'Self-organised' },
      ]},
    ],
    '2026-06-07': [
      { period: 'Day', items: [
        { title: 'Mutianyu Great Wall Tour', time: '07:40', end_time: '12:00', duration: null, type: 'tour', source: 'GetYourGuide' },
        { title: 'Forbidden City Tour', time: null, end_time: null, duration: '3h30m', period: 'Afternoon', type: 'sightseeing', source: 'Self-organised' },
      ]},
    ],
    '2026-06-08': [
      { period: 'Day', items: [
        { title: 'Walking Tour', time: '10:00', end_time: '13:30', duration: null, type: 'tour', source: 'GetYourGuide' },
        { title: 'Qianmen Street', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: 'Self-organised' },
        { title: 'Wangfujing', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: 'Self-organised' },
        { title: 'Nanluogu Xiang', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: 'Self-organised' },
        { title: 'Shichahai Scenic Area', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'park', source: 'Self-organised' },
      ]},
    ],
    '2026-06-09': [
      { period: 'Day', items: [
        { title: 'Drum Tower', time: '09:30', end_time: null, duration: null, type: 'cultural', source: 'Self-organised' },
        { title: 'Jingshan Park', time: null, end_time: null, duration: null, period: 'Morning', type: 'park', source: 'Self-organised' },
        { title: 'National Museum of China', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'cultural', source: 'Self-organised' },
        { title: 'Beihai Park', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'park', source: 'Self-organised' },
      ]},
    ],
    '2026-06-10': [
      { period: 'Day', items: [
        { title: 'Temple of Heaven', time: '08:30', end_time: null, duration: null, type: 'temple', source: 'Self-organised' },
        { title: 'Hongqiao Pearl Market', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'market', source: 'Self-organised' },
        { title: 'Eight Great Hutongs', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: 'Self-organised' },
        { title: 'Jiuwan Hutong', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: 'Self-organised' },
        { title: "Prince Kung's Palace Museum", time: null, end_time: null, duration: null, period: 'Afternoon', type: 'cultural', source: 'Self-organised' },
        { title: 'Sanlitun', time: null, end_time: null, duration: null, period: 'Evening', type: 'street', source: 'Self-organised' },
      ]},
    ],
    '2026-06-11': [
      { period: 'Day', items: [
        { title: 'Summer Palace', time: '08:30', end_time: null, duration: null, type: 'sightseeing', source: 'Self-organised' },
        { title: 'Yuanmingyuan Park', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'park', source: 'Self-organised' },
        { title: 'Xiushui Street', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'market', source: 'Self-organised' },
        { title: 'Lama Temple', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'temple', source: 'Self-organised' },
        { title: 'Wudaoying Alley', time: null, end_time: null, duration: null, period: 'Evening', type: 'street', source: null },
      ]},
    ],
    '2026-06-12': [
      { period: 'Day', items: [
        { title: 'Check-out Yitel Hotel', time: '06:30', end_time: null, duration: null, type: 'accommodation', source: 'Self-organised' },
        { title: "Train Beijingxi → Xi'anbei", time: '08:10', end_time: '12:31', duration: null, type: 'transport', source: 'Self-organised' },
      ]},
    ],
  },
  xian: {
    '2026-06-12': [
      { period: 'Day', items: [
        { title: "Check-in Xi'an LanOuShangPin Hotel", time: '13:30', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: 'Walking Tour', time: '14:00', end_time: '16:30', duration: null, type: 'tour', source: null },
        { title: 'Muslim Quarter', time: null, end_time: null, duration: null, period: 'Evening', type: 'street', source: null },
      ]},
    ],
    '2026-06-13': [
      { period: 'Day', items: [
        { title: 'Terracotta Warriors and Huaqing Palace + Lunch Tour', time: '07:30', end_time: '16:00', duration: null, type: 'tour', source: null },
      ]},
    ],
    '2026-06-14': [
      { period: 'Day', items: [
        { title: 'Grand Tang Mall', time: null, end_time: null, duration: null, period: 'Morning', type: 'street', source: null },
        { title: 'Big Wild Goose Pagoda', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'temple', source: null },
        { title: 'Shaanxi History Museum', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'cultural', source: null },
      ]},
    ],
    '2026-06-15': [
      { period: 'Day', items: [
        { title: "Check-out Xi'an LanOuShangPin Hotel", time: '06:30', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: "Train Xi'anbei → Chengdudong", time: '08:39', end_time: '12:40', duration: null, type: 'transport', source: null },
      ]},
    ],
  },
  chengdu: {
    '2026-06-15': [
      { period: 'Day', items: [
        { title: 'Check-in Chupin Hotel', time: '13:30', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: 'Walking Tour', time: '18:00', end_time: '20:30', duration: null, type: 'tour', source: null },
      ]},
    ],
    '2026-06-16': [
      { period: 'Day', items: [
        { title: 'Panda Base & Leshan Buddha Tour', time: '07:35', end_time: '19:35', duration: null, type: 'tour', source: null },
      ]},
    ],
    '2026-06-17': [
      { period: 'Day', items: [
        { title: "People's Park", time: null, end_time: null, duration: null, period: 'Morning', type: 'park', source: null },
        { title: 'Wuhou Shrine Museum', time: null, end_time: null, duration: null, period: 'Morning', type: 'cultural', source: null },
        { title: 'Yeyou Jinjiang', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
        { title: 'Kuanzhai Alleys', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
      ]},
    ],
    '2026-06-18': [
      { period: 'Day', items: [
        { title: 'Check-out Chupin Hotel', time: '06:30', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: 'Train Chengdudong → Chongqingbei', time: '08:02', end_time: '09:56', duration: null, type: 'transport', source: null },
      ]},
    ],
  },
  chongqing: {
    '2026-06-18': [
      { period: 'Day', items: [
        { title: 'Check-in Yubo River View Hotel', time: '11:00', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: "The People's Great Hall", time: null, end_time: null, duration: null, period: 'Afternoon', type: 'cultural', source: null },
        { title: 'Luohan Temple', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'temple', source: null },
        { title: 'Huguang Huiguan Guild Complex', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'cultural', source: null },
        { title: 'Walking Tour', time: '17:00', end_time: '19:15', duration: null, type: 'tour', source: null },
        { title: "Chongqing's People's Square", time: null, end_time: null, duration: null, period: 'Evening', type: 'sightseeing', source: null },
      ]},
    ],
    '2026-06-19': [
      { period: 'Day', items: [
        { title: 'Check-out Yubo River View Hotel', time: '08:30', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: 'Raffles City', time: null, end_time: null, duration: null, period: 'Morning', type: 'street', source: null },
        { title: 'Liziba Monorail', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'sightseeing', source: null },
        { title: 'Eling Park', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'park', source: null },
        { title: 'Train Chongqingbei → Shanghai Hongqiao', time: '20:13', end_time: '08:04+1', duration: null, type: 'transport', source: null },
      ]},
    ],
  },
  shanghai: {
    '2026-06-20': [
      { period: 'Day', items: [
        { title: 'Check-in MoYu Movie Hotel', time: '09:15', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: 'Walking Tour', time: '14:00', end_time: '18:00', duration: null, type: 'tour', source: null },
        { title: 'The Bund', time: null, end_time: null, duration: null, period: 'Evening', type: 'sightseeing', source: null },
      ]},
    ],
    '2026-06-21': [
      { period: 'Day', items: [
        { title: 'Coffee at 13 de Marzo', time: null, end_time: null, duration: null, period: 'Morning', type: 'cultural', source: null },
        { title: 'Nanjing Road Street', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
        { title: 'Oriental Pearl Tower', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'sightseeing', source: null },
        { title: 'Shanghai Tower', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'sightseeing', source: null },
        { title: 'Huangpu River Cruise', time: null, end_time: null, duration: null, period: 'Evening', type: 'sightseeing', source: null },
      ]},
    ],
    '2026-06-22': [
      { period: 'Day', items: [
        { title: 'Yu Garden', time: null, end_time: null, duration: null, period: 'Morning', type: 'sightseeing', source: null },
        { title: 'Xintiandi', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
        { title: 'Jingan Temple', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'temple', source: null },
      ]},
    ],
    '2026-06-23': [
      { period: 'Day', items: [
        { title: 'Suzhou Day Trip', time: null, end_time: null, duration: null, type: 'sightseeing', source: null },
      ]},
    ],
    '2026-06-24': [
      { period: 'Day', items: [
        { title: 'Shanghai Museum', time: null, end_time: null, duration: null, period: 'Morning', type: 'cultural', source: null },
        { title: 'Tianzifang', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
        { title: 'Sinan Mansions', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
        { title: 'Wukan Road', time: null, end_time: null, duration: null, period: 'Afternoon', type: 'street', source: null },
      ]},
    ],
    '2026-06-25': [
      { period: 'Day', items: [
        { title: 'Check-out MoYu Movie Hotel', time: '06:30', end_time: null, duration: null, type: 'accommodation', source: null },
        { title: 'Flight Shanghai → Tokyo', time: '11:30', end_time: '20:00', duration: null, type: 'transport', source: null },
      ]},
    ],
  },
};

/* ── City images ───────────────────────────────────────────── */

const CITY_IMAGES = {
  beijing:   { src: 'assets/beijing-hero.jpg',  alt: 'Aerial view of Beijing city centre' },
  xian:      { src: 'assets/xian.jpg', alt: "Xi'an ancient city wall at dusk" },
  chengdu:   { src: 'assets/chengdu.jpg',        alt: 'Two giant pandas at Chengdu Research Base' },
  chongqing: { src: 'assets/chongqing.jpg',      alt: 'Chongqing skyline at night' },
  shanghai:  { src: 'assets/shanghai-hero.jpg',  alt: 'Shanghai skyline and Huangpu River' },
};

/* ── Itinerary: date helpers ───────────────────────────────── */

function itinFormatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function itinFormatDateLabel(dateStr, cityName) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStr = new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${dayStr} · ${cityName}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dt.toISOString().split('T')[0];
}

function weekdayAbbr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2);
}

function dayNum(dateStr) {
  return parseInt(dateStr.split('-')[2], 10);
}

/* ── City key from name ────────────────────────────────────── */

function cityKey(cityName) {
  return cityName.toLowerCase().replace(/[^a-z]/g, '');
}

/* ── Render: calendar strip cells ─────────────────────────── */

function renderCalendarStrip(city, activeDate) {
  const key    = cityKey(city.city);
  const acts   = STATIC_ACTIVITIES[key] ?? {};
  const cells  = [];

  for (let i = 0; i < 7; i++) {
    const date      = addDays(city.date_start, i);
    const isInRange = date >= city.date_start && date <= city.date_end;
    const isActive  = date === activeDate;
    const hasActs   = Boolean(acts[date]?.length);

    const classes = [
      'dk-itin-cal-cell',
      !isInRange ? 'is-out-range' : '',
      hasActs    ? 'has-activities' : '',
    ].filter(Boolean).join(' ');

    cells.push(`
      <div
        class="${classes}"
        role="gridcell"
        tabindex="${isInRange ? (isActive ? '0' : '-1') : '-1'}"
        ${isActive ? 'aria-current="date"' : ''}
        data-date="${esc(date)}"
        aria-label="${weekdayAbbr(date)} ${dayNum(date)}${!isInRange ? ' (outside stay)' : ''}"
        aria-disabled="${!isInRange}"
      >
        <span class="dk-itin-cal-weekday">${esc(weekdayAbbr(date))}</span>
        <span class="dk-itin-cal-day-num">${dayNum(date)}</span>
        <span class="dk-itin-cal-dot" aria-hidden="true"></span>
      </div>
    `);
  }

  return `
    <div class="dk-itin-cal-strip" role="grid" aria-label="Days in ${esc(city.city)}">
      <div class="dk-itin-cal-grid">${cells.join('')}</div>
    </div>
  `;
}

/* ── Render: city list ─────────────────────────────────────── */

function renderCityList(cities, selectedCityId, activeDates) {
  return cities.map((city, index) => {
    const key      = cityKey(city.city);
    const img      = CITY_IMAGES[key] ?? { src: '', alt: city.city };
    const selected = key === selectedCityId;
    const dateRange = [city.date_start, city.date_end]
      .filter(Boolean)
      .map(itinFormatDate)
      .join('–');
    const activeDate = activeDates[key] ?? city.date_start;

    return `
      <li
        class="dk-itin-city-item"
        role="option"
        aria-selected="${selected}"
        tabindex="${selected ? '0' : '-1'}"
        data-city-key="${esc(key)}"
        data-city-index="${index}"
      >
        <div class="dk-itin-city-dot-col" aria-hidden="true">
          <span class="dk-itin-city-dot"></span>
        </div>
        <div class="dk-itin-city-card">
          <div class="dk-itin-city-photo">
            <img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="${index === 0 ? 'eager' : 'lazy'}">
            <span class="dk-itin-date-pill" aria-hidden="true">${esc(dateRange)}</span>
          </div>
          ${selected ? renderCalendarStrip(city, activeDate) : ''}
          <div class="dk-itin-city-names">
            <span class="dk-itin-name-en">${esc(city.city_pinyin ?? city.city)}</span>
            <span class="dk-itin-name-pinyin">${esc(city.city_zh ?? '')}</span>
          </div>
        </div>
      </li>
    `;
  }).join('');
}

/* ── Time-slot grouping helpers ────────────────────────────── */

const PERIOD_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night'];

function getPeriod(timeStr) {
  if (!timeStr) return null;
  const h = parseInt(timeStr.split(':')[0], 10);
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 18) return 'Afternoon';
  if (h >= 18 && h < 21) return 'Evening';
  return 'Night';
}

function regroupByTime(groups) {
  const flat = groups.flatMap(g => g.items);
  flat.sort((a, b) => {
    const ta = a.time ?? 'zzz';
    const tb = b.time ?? 'zzz';
    return ta.localeCompare(tb);
  });
  const buckets = {};
  for (const item of flat) {
    const p = getPeriod(item.time) ?? item.period ?? 'Other';
    if (!buckets[p]) buckets[p] = [];
    buckets[p].push(item);
  }
  const result = PERIOD_ORDER.filter(p => buckets[p]).map(p => ({ period: p, items: buckets[p] }));
  if (buckets['Other']) result.push({ period: 'All day', items: buckets['Other'] });
  return result;
}

/* ── Time display helper ──────────────────────────────────── */

function formatActivityTime(item) {
  if (item.time && item.end_time) return `${item.time} – ${item.end_time}`;
  if (item.time) return item.time;
  if (item.duration) return `~${item.duration}`;
  return '';
}

/* ── Helper: time row for activity cards ───────────────────── */

function buildTimeRow(item) {
  const ts = formatActivityTime(item);
  if (item.time) {
    const endBtn = !item.end_time
      ? `<button class="dk-add-end-time-btn" type="button" aria-label="Add end time">+ end time</button>`
      : '';
    return `<span class="dk-activity-meta dk-time-trigger" role="button" tabindex="0" aria-label="Edit time">${esc(ts)}</span>${endBtn}`;
  }
  if (item.duration) {
    return `<span class="dk-activity-meta dk-time-trigger" role="button" tabindex="0" aria-label="Edit duration">${esc(ts)}</span>`;
  }
  return `<button class="dk-add-time-btn" type="button" aria-label="Add time">+ Add time</button>`;
}

/* ── Render: activity timeline ─────────────────────────────── */

function renderActivityTimeline(cityKey, dateStr) {
  const acts = (STATIC_ACTIVITIES[cityKey] ?? {})[dateStr] ?? [];

  const addBtn = `
    <li class="dk-add-activity-row">
      <button class="dk-add-activity-btn" type="button" aria-label="Add activity">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
          <line x1="7" y1="1" x2="7" y2="13"/>
          <line x1="1" y1="7" x2="13" y2="7"/>
        </svg>
      </button>
    </li>
  `;

  if (acts.length === 0) {
    return `
      <li class="dk-itin-empty">
        <div class="dk-itin-empty-state">
          <svg class="dk-itin-empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M8 2v4"/><path d="M16 2v4"/>
            <rect width="18" height="18" x="3" y="4" rx="2"/>
            <path d="M3 10h18"/>
            <path d="m14 14 4 4"/><path d="m18 14-4 4"/>
          </svg>
          <p class="dk-itin-empty-primary">No activities for this day</p>
          <p class="dk-itin-empty-secondary">Use the + button to add one</p>
        </div>
      </li>
      ${addBtn}
    `;
  }

  const groups = regroupByTime(acts);

  const groupsHtml = groups.map(group => `
    <li class="dk-timeline-group">
      <div class="dk-timeline-marker" aria-hidden="true"></div>
      <div class="dk-timeline-content">
        <span class="dk-timeline-period">${esc(group.period)}</span>
        <ul class="dk-activity-list" role="list" data-period="${esc(group.period)}">
          ${group.items.map(item => `
            <li class="dk-activity-card"
                data-title="${esc(item.title)}"
                data-original-title="${esc(item.title)}"
                data-city="${esc(cityKey)}"
                data-date="${esc(dateStr)}"
                data-time="${esc(item.time ?? '')}"
                data-end-time="${esc(item.end_time ?? '')}"
                data-duration="${esc(item.duration ?? '')}">
              <div class="dk-activity-body">
                <span class="dk-activity-title" role="button" tabindex="0" aria-label="Edit: ${esc(item.title)}">${esc(item.title)}</span>
                <div class="dk-activity-time-row">${buildTimeRow(item)}</div>
              </div>
              <svg class="dk-drag-handle" width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-label="Drag to reorder" focusable="false">
                <circle cx="3" cy="3" r="1.4"/><circle cx="7" cy="3" r="1.4"/>
                <circle cx="3" cy="7" r="1.4"/><circle cx="7" cy="7" r="1.4"/>
                <circle cx="3" cy="11" r="1.4"/><circle cx="7" cy="11" r="1.4"/>
              </svg>
            </li>
          `).join('')}
        </ul>
      </div>
    </li>
  `).join('');

  return groupsHtml + addBtn;
}

/* ── Drag and drop: persist sort order ────────────────────── */

async function persistSortOrder(listEl, cityKeyStr, dateStr) {
  const period = listEl.dataset.period ?? '';
  const items  = [...listEl.querySelectorAll('.dk-activity-card')];
  try {
    for (let idx = 0; idx < items.length; idx++) {
      const title = items[idx].dataset.title ?? '';
      if (!title) continue;
      await supabase
        .from('activities')
        .update({ sort_order: idx })
        .eq('city', cityKeyStr)
        .eq('date', dateStr)
        .eq('title', title);
    }
  } catch (err) {
    console.warn('[itinerary] sort_order update failed:', err);
  }
}

/* ── Inline edit: patch to Supabase + in-memory ────────────── */

async function patchActivity(cityKeyStr, dateStr, originalTitle, patch) {
  /* Update in-memory STATIC_ACTIVITIES */
  const dayGroups = (STATIC_ACTIVITIES[cityKeyStr] ?? {})[dateStr] ?? [];
  for (const group of dayGroups) {
    const item = group.items?.find(i => i.title === originalTitle);
    if (item) { Object.assign(item, patch); break; }
  }
  /* PATCH Supabase */
  try {
    await supabase.from('activities').update(patch)
      .eq('city', cityKeyStr).eq('date', dateStr).eq('title', originalTitle);
  } catch (err) {
    console.warn('[inline-edit] PATCH failed:', err);
  }
}

/* ── Inline edit: title ─────────────────────────────────────── */

function activateTitleEdit(cardEl) {
  if (cardEl.querySelector('.dk-activity-title-input')) return; /* already editing */
  const titleEl = cardEl.querySelector('.dk-activity-title');
  if (!titleEl) return;

  const currentTitle = titleEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'dk-activity-title-input';
  input.value = currentTitle;
  input.setAttribute('aria-label', 'Edit activity title');
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  function commitTitle() {
    const newTitle = input.value.trim();
    if (!newTitle || newTitle === currentTitle) {
      _restoreTitleSpan(cardEl, currentTitle);
      return;
    }
    _restoreTitleSpan(cardEl, newTitle);
    const originalTitle = cardEl.dataset.originalTitle;
    patchActivity(cardEl.dataset.city, cardEl.dataset.date, originalTitle, { title: newTitle });
    cardEl.dataset.title = newTitle;
    cardEl.dataset.originalTitle = newTitle;
  }

  input.addEventListener('blur', commitTitle);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') {
      input.removeEventListener('blur', commitTitle);
      _restoreTitleSpan(cardEl, currentTitle);
    }
  });
}

function _restoreTitleSpan(cardEl, text) {
  const input = cardEl.querySelector('.dk-activity-title-input');
  if (!input) return;
  const span = document.createElement('span');
  span.className = 'dk-activity-title';
  span.setAttribute('role', 'button');
  span.setAttribute('tabindex', '0');
  span.textContent = text;
  input.replaceWith(span);
}

/* ── Inline edit: time ──────────────────────────────────────── */

function activateTimeEdit(cardEl) {
  if (cardEl.querySelector('.dk-time-panel')) return; /* already open */
  const currentTime     = cardEl.dataset.time     || '';
  const currentEndTime  = cardEl.dataset.endTime  || '';
  const currentDuration = cardEl.dataset.duration || '';
  const isDuration = !currentTime && !!currentDuration;

  const panel = document.createElement('div');
  panel.className = 'dk-time-panel';
  panel.innerHTML = `
    <div class="dk-time-panel-tabs" role="tablist">
      <button class="dk-time-tab${!isDuration ? ' is-active' : ''}" data-mode="exact" role="tab" aria-selected="${!isDuration}" type="button">Exact</button>
      <button class="dk-time-tab${isDuration ? ' is-active' : ''}" data-mode="duration" role="tab" aria-selected="${isDuration}" type="button">Duration</button>
    </div>
    <div class="dk-time-fields dk-time-exact"${isDuration ? ' hidden' : ''}>
      <input type="time" class="dk-time-start-input" value="${esc(currentTime)}" aria-label="Start time">
      <span class="dk-time-sep" aria-hidden="true">–</span>
      <input type="time" class="dk-time-end-input" value="${esc(currentEndTime)}" aria-label="End time (optional)">
    </div>
    <div class="dk-time-fields dk-time-duration"${!isDuration ? ' hidden' : ''}>
      <input type="text" class="dk-time-dur-input" value="${esc(currentDuration)}" placeholder="e.g. 3h30m" aria-label="Duration">
    </div>
    <div class="dk-time-panel-actions">
      <button class="dk-time-save-btn" type="button">Save</button>
      <button class="dk-time-cancel-btn" type="button">Cancel</button>
    </div>
  `;
  cardEl.appendChild(panel);
  panel.querySelector('.dk-time-exact:not([hidden]) input, .dk-time-duration:not([hidden]) input')?.focus();
}

function _switchTimeMode(cardEl, mode) {
  const panel = cardEl.querySelector('.dk-time-panel');
  if (!panel) return;
  panel.querySelectorAll('.dk-time-tab').forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  const exactFields = panel.querySelector('.dk-time-exact');
  const durFields   = panel.querySelector('.dk-time-duration');
  if (mode === 'exact') {
    exactFields?.removeAttribute('hidden');
    durFields?.setAttribute('hidden', '');
    exactFields?.querySelector('input')?.focus();
  } else {
    exactFields?.setAttribute('hidden', '');
    durFields?.removeAttribute('hidden');
    durFields?.querySelector('input')?.focus();
  }
}

function saveTimeEdit(cardEl) {
  const panel = cardEl.querySelector('.dk-time-panel');
  if (!panel) return;
  const mode = panel.querySelector('.dk-time-tab.is-active')?.dataset.mode ?? 'exact';
  let patch;
  if (mode === 'exact') {
    const t = panel.querySelector('.dk-time-start-input')?.value || null;
    const e = panel.querySelector('.dk-time-end-input')?.value   || null;
    patch = { time: t, end_time: e, duration: null };
  } else {
    const d = panel.querySelector('.dk-time-dur-input')?.value || null;
    patch = { time: null, end_time: null, duration: d };
  }

  /* Update data attributes on the card */
  cardEl.dataset.time     = patch.time     ?? '';
  cardEl.dataset.endTime  = patch.end_time ?? '';
  cardEl.dataset.duration = patch.duration ?? '';

  /* Rebuild the time row display */
  const fakeItem = { time: patch.time, end_time: patch.end_time, duration: patch.duration };
  const timeRow  = cardEl.querySelector('.dk-activity-time-row');
  if (timeRow) timeRow.innerHTML = buildTimeRow(fakeItem);

  panel.remove();
  patchActivity(cardEl.dataset.city, cardEl.dataset.date, cardEl.dataset.originalTitle, patch);
}

function cancelTimeEdit(cardEl) {
  cardEl.querySelector('.dk-time-panel')?.remove();
}

function initTimelineSortable(containerEl, cityKeyStr, dateStr) {
  if (typeof Sortable === 'undefined') return;
  containerEl.querySelectorAll('.dk-activity-list').forEach(listEl => {
    Sortable.create(listEl, {
      handle:    '.dk-drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass:  'sortable-drag',
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex === newIndex) return;
        persistSortOrder(listEl, cityKeyStr, dateStr);
      },
    });
  });
}

/* ── Fade transition helper ────────────────────────────────── */

function fadePanel(panelEl, renderFn) {
  panelEl.classList.add('is-fading');
  requestAnimationFrame(() => {
    setTimeout(() => {
      renderFn();
      panelEl.classList.remove('is-fading');
    }, 150);
  });
}

/* ── Modal: nueva actividad ────────────────────────────────── */

function openActivityModal(cityKeyStr, dateStr, refreshFn) {
  const bodyHTML = `
    <div class="modal-field">
      <label class="modal-label" for="act-modal-name">Activity name</label>
      <input type="text" id="act-modal-name" class="modal-input"
        placeholder="e.g. Mutianyu Great Wall" maxlength="60" autocomplete="off">
      <div class="modal-counter" id="act-modal-counter" aria-live="polite">0 / 60</div>
      <div class="modal-error" id="act-modal-name-err" role="alert"></div>
    </div>
    <div class="modal-field">
      <span class="modal-label" id="act-modal-time-lbl">Time</span>
      <div class="dk-time-panel-tabs modal-time-tabs" role="tablist" aria-labelledby="act-modal-time-lbl">
        <button class="dk-time-tab is-active" data-mode="exact" role="tab" aria-selected="true" type="button">Exact</button>
        <button class="dk-time-tab" data-mode="duration" role="tab" aria-selected="false" type="button">Duration</button>
      </div>
      <div class="dk-time-fields" id="act-modal-exact-fields">
        <input type="time" id="act-modal-time" class="dk-time-start-input" aria-label="Start time">
        <span class="dk-time-sep" aria-hidden="true">–</span>
        <input type="time" id="act-modal-end" class="dk-time-end-input" aria-label="End time (optional)">
      </div>
      <div class="dk-time-fields" id="act-modal-dur-fields" hidden>
        <input type="text" id="act-modal-dur" class="dk-time-dur-input" placeholder="e.g. 3h30m" aria-label="Duration">
      </div>
      <div class="modal-error" id="act-modal-time-err" role="alert"></div>
    </div>
    <div class="modal-field">
      <label class="modal-label" id="act-modal-type-lbl">Type</label>
      <div class="modal-custom-select" aria-expanded="false">
        <button class="modal-custom-select-trigger is-placeholder" type="button"
                id="act-modal-type-btn"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-controls="act-modal-type-list"
                aria-labelledby="act-modal-type-lbl">
          <span class="modal-custom-select-value">— No type —</span>
          <svg class="modal-custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
            <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <ul class="modal-custom-select-list" role="listbox" id="act-modal-type-list" aria-labelledby="act-modal-type-lbl">
          <li class="modal-custom-select-option" role="option" aria-selected="true"  data-value="" data-placeholder tabindex="-1">— No type —</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="tour"          tabindex="-1">Tour</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="transport"     tabindex="-1">Transport</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="accommodation" tabindex="-1">Accommodation</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="sightseeing"   tabindex="-1">Sightseeing</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="cultural"      tabindex="-1">Cultural</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="temple"        tabindex="-1">Temple</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="park"          tabindex="-1">Park</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="street"        tabindex="-1">Street</li>
          <li class="modal-custom-select-option" role="option" aria-selected="false" data-value="market"        tabindex="-1">Market</li>
        </ul>
        <input type="hidden" id="act-modal-type" value="">
      </div>
    </div>
  `;

  openModal({
    id: 'act-modal',
    title: 'Add activity',
    bodyHTML,
    onSave: () => handleActivityModalSave(cityKeyStr, dateStr, refreshFn),
  });

  const input   = document.getElementById('act-modal-name');
  const counter = document.getElementById('act-modal-counter');
  input?.addEventListener('input', () => {
    counter.textContent = `${input.value.length} / 60`;
    if (input.value.length > 0) {
      input.classList.remove('has-error');
      document.getElementById('act-modal-name-err').textContent = '';
    }
  });

  /* ── Time mode toggle (Exact / Duration) ─────────────────── */
  const modalTimeTabs  = [...document.querySelectorAll('.modal-time-tabs .dk-time-tab')];
  const exactFields    = document.getElementById('act-modal-exact-fields');
  const durFields      = document.getElementById('act-modal-dur-fields');
  modalTimeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modalTimeTabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      if (tab.dataset.mode === 'exact') {
        exactFields?.removeAttribute('hidden');
        durFields?.setAttribute('hidden', '');
        document.getElementById('act-modal-time')?.focus();
      } else {
        exactFields?.setAttribute('hidden', '');
        durFields?.removeAttribute('hidden');
        document.getElementById('act-modal-dur')?.focus();
      }
      /* Clear any time error when switching modes */
      const timeErrEl = document.getElementById('act-modal-time-err');
      if (timeErrEl) timeErrEl.textContent = '';
      document.getElementById('act-modal-time')?.classList.remove('has-error');
      document.getElementById('act-modal-dur')?.classList.remove('has-error');
    });
  });

  /* ── Custom select: Tipo ─────────────────────────────────── */
  const csWrap    = document.querySelector('.modal-custom-select');
  const csTrigger = document.getElementById('act-modal-type-btn');
  const csList    = document.getElementById('act-modal-type-list');
  const csValue   = csTrigger?.querySelector('.modal-custom-select-value');
  const csHidden  = document.getElementById('act-modal-type');
  const csOptions = [...(csList?.querySelectorAll('.modal-custom-select-option') ?? [])];

  function csOutside(e) {
    if (!csWrap.contains(e.target)) csClose();
  }

  function csOpen() {
    csWrap.setAttribute('aria-expanded', 'true');
    csTrigger.setAttribute('aria-expanded', 'true');
    csList.classList.add('is-open');
    const sel = csOptions.find(o => o.getAttribute('aria-selected') === 'true') ?? csOptions[0];
    sel?.focus();
    setTimeout(() => document.addEventListener('click', csOutside, { capture: true }), 0);
  }

  function csClose() {
    csWrap.setAttribute('aria-expanded', 'false');
    csTrigger.setAttribute('aria-expanded', 'false');
    csList.classList.remove('is-open');
    document.removeEventListener('click', csOutside, { capture: true });
  }

  function csSelect(opt) {
    csOptions.forEach(o => o.setAttribute('aria-selected', 'false'));
    opt.setAttribute('aria-selected', 'true');
    csHidden.value      = opt.dataset.value ?? '';
    csValue.textContent = opt.textContent;
    if (opt.dataset.value) {
      csTrigger.classList.remove('is-placeholder');
    } else {
      csTrigger.classList.add('is-placeholder');
      csValue.textContent = '— No type —';
    }
    csClose();
    csTrigger.focus();
  }

  csTrigger?.addEventListener('click', () => {
    csList.classList.contains('is-open') ? csClose() : csOpen();
  });

  csTrigger?.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); csOpen(); }
    if (e.key === 'Escape') csClose();
  });

  csOptions.forEach((opt, idx) => {
    opt.addEventListener('click', () => csSelect(opt));
    opt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ')  { e.preventDefault(); csSelect(opt); }
      if (e.key === 'Escape')                  { csClose(); csTrigger.focus(); }
      if (e.key === 'ArrowDown')               { e.preventDefault(); csOptions[Math.min(idx + 1, csOptions.length - 1)]?.focus(); }
      if (e.key === 'ArrowUp')                 { e.preventDefault(); csOptions[Math.max(idx - 1, 0)]?.focus(); }
    });
  });
}

async function handleActivityModalSave(cityKeyStr, dateStr, refreshFn) {
  const nameInput  = document.getElementById('act-modal-name');
  const timeInput  = document.getElementById('act-modal-time');
  const endInput   = document.getElementById('act-modal-end');
  const durInput   = document.getElementById('act-modal-dur');
  const typeSelect = document.getElementById('act-modal-type');
  const nameErr    = document.getElementById('act-modal-name-err');
  const timeErr    = document.getElementById('act-modal-time-err');
  const activeMode = document.querySelector('.modal-time-tabs .dk-time-tab.is-active')?.dataset.mode ?? 'exact';
  let valid = true;

  if (!nameInput?.value.trim()) {
    nameInput?.classList.add('has-error');
    if (nameErr) nameErr.textContent = 'This field is required';
    valid = false;
  } else {
    nameInput.classList.remove('has-error');
    if (nameErr) nameErr.textContent = '';
  }

  if (activeMode === 'exact') {
    if (!timeInput?.value) {
      timeInput?.classList.add('has-error');
      if (timeErr) timeErr.textContent = 'Start time is required';
      valid = false;
    } else {
      timeInput.classList.remove('has-error');
      if (timeErr) timeErr.textContent = '';
    }
  } else {
    if (!durInput?.value.trim()) {
      durInput?.classList.add('has-error');
      if (timeErr) timeErr.textContent = 'Duration is required (e.g. 3h30m)';
      valid = false;
    } else {
      durInput?.classList.remove('has-error');
      if (timeErr) timeErr.textContent = '';
    }
  }

  if (!valid) return;

  const title    = nameInput.value.trim();
  const type     = typeSelect?.value || null;
  const btn      = document.getElementById('act-modal-guardar');
  if (btn) btn.disabled = true;

  let time, end_time, duration;
  if (activeMode === 'exact') {
    time     = timeInput?.value || null;
    end_time = endInput?.value  || null;
    duration = null;
  } else {
    time     = null;
    end_time = null;
    duration = durInput?.value.trim() || null;
  }

  const existingCount = (STATIC_ACTIVITIES[cityKeyStr]?.[dateStr] ?? [])
    .flatMap(g => g.items).length;
  const sort_order = existingCount;

  const newEntry = { city: cityKeyStr, date: dateStr, title, time, end_time, duration, type, sort_order };

  try {
    const { error } = await supabase.from('activities').insert([newEntry]);
    if (error) throw error;
    showToast('Activity added');
  } catch (err) {
    console.warn('[modal] activity insert failed:', err);
  }

  /* Update in-memory data so the timeline re-render shows the new item */
  const newItem  = { title, time, end_time, duration, type, source: 'User added' };
  const period   = getPeriod(time) ?? 'Other';
  if (!STATIC_ACTIVITIES[cityKeyStr])        STATIC_ACTIVITIES[cityKeyStr] = {};
  if (!STATIC_ACTIVITIES[cityKeyStr][dateStr]) STATIC_ACTIVITIES[cityKeyStr][dateStr] = [];
  const dayGroups = STATIC_ACTIVITIES[cityKeyStr][dateStr];
  const existing  = dayGroups.find(g => g.period === period);
  if (existing) {
    existing.items.push(newItem);
  } else {
    const insertIdx = dayGroups.findIndex(g => PERIOD_ORDER.indexOf(g.period) > PERIOD_ORDER.indexOf(period));
    if (insertIdx === -1) {
      dayGroups.push({ period, items: [newItem] });
    } else {
      dayGroups.splice(insertIdx, 0, { period, items: [newItem] });
    }
  }

  closeModal();
  refreshFn(cityKeyStr, dateStr);
}

/* ── Daily stats cache (for day summary km lookup) ─────────── */

let dailyStatsCache = null; /* { [dateStr]: { steps, km } } */

async function loadDailyStatsCache() {
  try {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('date, steps, km');
    if (error) throw error;
    const map = {};
    (data ?? []).forEach(r => { map[r.date] = r; });
    dailyStatsCache = map;
  } catch (_) {
    dailyStatsCache = {};
  }
}

/* ── Main itinerary init ───────────────────────────────────── */

export function initItinerary() {
  const listEl     = document.getElementById('dk-itin-city-list');
  const panelEl    = document.getElementById('dk-itin-panel');
  const labelEl    = document.getElementById('dk-itin-panel-label');
  const summaryEl  = document.getElementById('dk-itin-panel-summary');
  const timelineEl = document.getElementById('dk-itin-timeline');

  if (!listEl || !panelEl) return;

  const cities = STATIC_CITIES;

  /* Kick off daily_stats load in the background */
  loadDailyStatsCache().then(() => {
    /* If a panel is already showing, refresh its summary */
    if (summaryEl && summaryEl.dataset.date) {
      const key     = summaryEl.dataset.cityKey;
      const dateStr = summaryEl.dataset.date;
      renderPanelSummary(summaryEl, key, dateStr);
    }
  });

  /* Track selected city and the active day per city */
  let selectedCityKey  = cityKey(cities[0].city);  /* Beijing on load */
  const activeDates    = {};
  cities.forEach(c => { activeDates[cityKey(c.city)] = c.date_start; });

  function renderPanelSummary(el, key, dateStr) {
    if (!el) return;
    /* Count all activities for this day */
    const groups = (STATIC_ACTIVITIES[key] ?? {})[dateStr] ?? [];
    const total  = groups.reduce((acc, g) => acc + (g.items?.length ?? 0), 0);

    /* Look up km from cache */
    const kmVal = dailyStatsCache?.[dateStr]?.km ?? null;

    /* Store for potential cache-ready refresh */
    el.dataset.date    = dateStr;
    el.dataset.cityKey = key;

    if (total === 0 && kmVal == null) {
      el.textContent = '';
      return;
    }

    const actLabel = `${total} activit${total === 1 ? 'y' : 'ies'}`;
    const kmLabel  = kmVal != null ? `<span class="summary-sep">·</span>${kmVal} km` : '';
    el.innerHTML   = actLabel + kmLabel;
  }

  function updatePanel(key, dateStr) {
    const city = cities.find(c => cityKey(c.city) === key);
    if (!city) return;
    fadePanel(panelEl, () => {
      labelEl.textContent  = itinFormatDateLabel(dateStr, city.city);
      renderPanelSummary(summaryEl, key, dateStr);
      timelineEl.innerHTML = renderActivityTimeline(key, dateStr);
      initTimelineSortable(timelineEl, key, dateStr);
    });
  }

  function selectCity(key) {
    if (selectedCityKey === key) return;
    selectedCityKey = key;
    listEl.innerHTML = renderCityList(cities, selectedCityKey, activeDates);
    bindCityListEvents();
    updatePanel(key, activeDates[key]);
  }

  function selectDay(key, dateStr) {
    activeDates[key] = dateStr;
    /* Re-render just the strip of the selected card */
    const city    = cities.find(c => cityKey(c.city) === key);
    const stripEl = listEl.querySelector(`[data-city-key="${CSS.escape(key)}"] .dk-itin-cal-strip`);
    if (stripEl && city) {
      const newStrip = document.createElement('div');
      newStrip.innerHTML = renderCalendarStrip(city, dateStr);
      stripEl.replaceWith(newStrip.firstElementChild);
      bindStripEvents(listEl.querySelector(`[data-city-key="${CSS.escape(key)}"]`));
    }
    updatePanel(key, dateStr);
  }

  function bindStripEvents(itemEl) {
    if (!itemEl) return;
    const key = itemEl.dataset.cityKey;
    itemEl.querySelectorAll('.dk-itin-cal-cell:not(.is-out-range)').forEach(cell => {
      cell.addEventListener('click', e => {
        e.stopPropagation();
        selectDay(key, cell.dataset.date);
      });
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          selectDay(key, cell.dataset.date);
        }
        /* Arrow key navigation within strip */
        const cells = [...itemEl.querySelectorAll('.dk-itin-cal-cell:not(.is-out-range)')];
        const idx   = cells.indexOf(cell);
        if (e.key === 'ArrowRight' && idx < cells.length - 1) cells[idx + 1].focus();
        if (e.key === 'ArrowLeft'  && idx > 0)                 cells[idx - 1].focus();
      });
    });
  }

  function bindCityListEvents() {
    listEl.querySelectorAll('.dk-itin-city-item').forEach(itemEl => {
      const key = itemEl.dataset.cityKey;

      itemEl.addEventListener('click', () => selectCity(key));

      itemEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCity(key);
        }
        /* Arrow key navigation between city cards */
        const items = [...listEl.querySelectorAll('.dk-itin-city-item')];
        const idx   = items.indexOf(itemEl);
        if (e.key === 'ArrowDown' && idx < items.length - 1) {
          e.preventDefault();
          items[idx + 1].focus();
          items[idx + 1].setAttribute('tabindex', '0');
          itemEl.setAttribute('tabindex', '-1');
        }
        if (e.key === 'ArrowUp' && idx > 0) {
          e.preventDefault();
          items[idx - 1].focus();
          items[idx - 1].setAttribute('tabindex', '0');
          itemEl.setAttribute('tabindex', '-1');
        }
        /* Tab moves focus into the strip */
        if (e.key === 'Tab' && !e.shiftKey) {
          const firstCell = itemEl.querySelector('.dk-itin-cal-cell[aria-current="date"]');
          if (firstCell) { e.preventDefault(); firstCell.focus(); }
        }
      });

      bindStripEvents(itemEl);
    });
  }

  /* Initial render — Beijing selected, day 1 activities shown */
  listEl.innerHTML = renderCityList(cities, selectedCityKey, activeDates);
  bindCityListEvents();

  const firstCity = cities[0];
  const firstDate = activeDates[selectedCityKey];
  labelEl.textContent  = itinFormatDateLabel(firstDate, firstCity.city);
  renderPanelSummary(summaryEl, selectedCityKey, firstDate);
  timelineEl.innerHTML = renderActivityTimeline(selectedCityKey, firstDate);
  initTimelineSortable(timelineEl, selectedCityKey, firstDate);

  /* Event delegation: all timeline interactions — attached once, works after every re-render */
  timelineEl.addEventListener('click', e => {
    /* Add activity */
    if (e.target.closest('.dk-add-activity-btn')) {
      openActivityModal(selectedCityKey, activeDates[selectedCityKey], updatePanel);
      return;
    }
    const card = e.target.closest('.dk-activity-card');
    if (!card) return;

    /* Title edit — but not when input is already active */
    if (e.target.closest('.dk-activity-title') && !e.target.closest('.dk-activity-title-input')) {
      activateTitleEdit(card); return;
    }
    /* Time edit — meta click, + Add time, or + end time */
    if (e.target.closest('.dk-time-trigger') || e.target.closest('.dk-add-time-btn') || e.target.closest('.dk-add-end-time-btn')) {
      activateTimeEdit(card); return;
    }
    /* Time panel: tab switch */
    const tab = e.target.closest('.dk-time-tab');
    if (tab) { _switchTimeMode(card, tab.dataset.mode); return; }
    /* Time panel: save / cancel */
    if (e.target.closest('.dk-time-save-btn'))   { saveTimeEdit(card);   return; }
    if (e.target.closest('.dk-time-cancel-btn')) { cancelTimeEdit(card); return; }
  });

  /* Keyboard: activate title/time edits via Enter/Space; close time panel via Escape */
  timelineEl.addEventListener('keydown', e => {
    const card = e.target.closest('.dk-activity-card');
    if (!card) return;
    if (e.key === 'Escape') {
      cancelTimeEdit(card); return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.classList.contains('dk-activity-title')) {
      e.preventDefault(); activateTitleEdit(card);
    } else if (
      e.target.classList.contains('dk-time-trigger') ||
      e.target.classList.contains('dk-add-time-btn') ||
      e.target.classList.contains('dk-add-end-time-btn')
    ) {
      e.preventDefault(); activateTimeEdit(card);
    }
  });
}
