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
        <span class="sb-section-label">${esc(t.label)}</span>
        <span class="sb-section-count${countClass}">${confirmed}/${items.length}</span>
      </div>
      ${itemsHTML}
      <button class="sb-add-link" type="button">Add item +</button>
    `;
  }).join('');

  return `
    <div class="sb-hide-toggle">
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
      <button class="sb-add-link" type="button">Add item +</button>
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

/* ── Desktop bookings handlers ─────────────────────────────── */

export function initDesktopBookings() {
  const section = document.querySelector('.dk-bookings');
  if (!section) return;

  // Checkbox delegation — real Supabase update wired in Session 3
  section.addEventListener('change', e => {
    if (e.target.matches('.dk-booking-cb')) {
      // TODO Session 3: update status to 'booked' in Supabase on check
    }
  });

  // "View all →" — opens the sidebar with grouped bookings
  document.getElementById('dk-bookings-view-all')
    ?.addEventListener('click', () => {
      const bookings = loadFromStorage('bookings') ?? STATIC_BOOKINGS_FALLBACK;
      openSidebar('Bookings', renderBookingsSidebarContent(bookings));
    });
}

/* ── Desktop packing list handler ─────────────────────────── */

export function initDesktopPacking() {
  document.getElementById('dk-packing-see-all')
    ?.addEventListener('click', () => {
      openSidebar('Packing list', renderPackingSidebarContent(STATIC_PACKING_LIST));
    });
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
    <button class="sb-add-link" type="button">+ Add reminder</button>
  `;
}

/* ── Render: desktop reminders card (max 5, dynamic) ──────── */

function renderDesktopReminders(reminders) {
  const list       = document.querySelector('.dk-reminders .dk-reminder-list');
  const viewAllBtn = document.getElementById('dk-reminders-view-all');
  if (!list) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pending items first (soonest due), then done
  const pending = reminders.filter(r => r.status !== 'done')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  const done    = reminders.filter(r => r.status === 'done');
  const sorted  = [...pending, ...done];

  const visible = sorted.slice(0, 5);
  const total   = reminders.length;

  list.innerHTML = visible.map(r => {
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
  }).join('') || `<li class="dk-reminder-item"><span class="dk-reminder-title" style="color:var(--text-secondary)">No reminders yet</span></li>`;

  // Show "View all →" only when there are more than 5 reminders
  if (viewAllBtn) {
    viewAllBtn.style.display = total > 5 ? '' : 'none';
  }
}

/* ── Desktop reminders handler ─────────────────────────────── */

export function initDesktopReminders() {
  const viewAllBtn = document.getElementById('dk-reminders-view-all');
  if (!viewAllBtn) return;

  // Hidden until data loads — renderDesktopReminders sets final visibility
  viewAllBtn.style.display = 'none';

  viewAllBtn.addEventListener('click', () => {
    const reminders = loadFromStorage('reminders') ?? STATIC_REMINDERS;
    const source = Array.isArray(reminders) && reminders.length > 0 ? reminders : STATIC_REMINDERS;
    openSidebar('Reminders', renderRemindersSidebarContent(source));
  });
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

  function goTo(index) {
    slides[currentIndex].classList.remove('is-active');
    slides[currentIndex].setAttribute('aria-hidden', 'true');
    dots[currentIndex].classList.remove('is-active');

    currentIndex = index;

    slides[currentIndex].classList.add('is-active');
    slides[currentIndex].setAttribute('aria-hidden', 'false');
    dots[currentIndex].classList.add('is-active');
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

/* ============================================================
   UNIFIED ITINERARY COMPONENT
   ============================================================ */

/* ── Static activity data ──────────────────────────────────── */

const STATIC_ACTIVITIES = {
  beijing: {
    '2026-06-06': [
      { period: 'Morning', items: [
        { title: 'Arrive Beijing Capital Airport', time: '10:00', source: 'Self-organised', type: 'transport' },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Check-in Yitel Hotel', time: '14:00', source: 'Self-organised', type: 'accommodation' },
      ]},
    ],
    '2026-06-07': [
      { period: 'Morning', items: [
        { title: 'Mutianyu Great Wall', time: '07:50', source: 'GetYourGuide', type: 'tour' },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Forbidden City', time: '13:00', source: 'Self-organised', type: 'sightseeing' },
      ]},
    ],
    '2026-06-08': [
      { period: 'Morning', items: [
        { title: 'Walking Tour', time: '10:00', source: 'GetYourGuide', type: 'tour' },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Qianmen Street', time: '14:00', source: 'Self-organised', type: 'street' },
        { title: 'Wangfujing', time: '15:30', source: 'Self-organised', type: 'street' },
        { title: 'Nanluogu Xiang', time: '17:00', source: 'Self-organised', type: 'street' },
        { title: 'Shichahai Scenic Area', time: '18:30', source: 'Self-organised', type: 'sightseeing' },
      ]},
    ],
    '2026-06-09': [
      { period: 'Morning', items: [
        { title: 'Drum Tower', time: '09:00', source: 'Self-organised', type: 'cultural' },
        { title: 'Jingshan Park', time: '10:30', source: 'Self-organised', type: 'park' },
      ]},
      { period: 'Afternoon', items: [
        { title: 'National Museum of China', time: '13:00', source: 'Self-organised', type: 'cultural' },
        { title: 'Beihai Park', time: '15:30', source: 'Self-organised', type: 'park' },
      ]},
    ],
    '2026-06-10': [
      { period: 'Morning', items: [
        { title: 'Temple of Heaven', time: '09:00', source: 'Self-organised', type: 'temple' },
        { title: 'Hongqiao Pearl Market', time: '11:30', source: 'Self-organised', type: 'market' },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Eight Great Hutongs', time: '14:00', source: 'Self-organised', type: 'street' },
        { title: 'Jiuwan Hutong', time: '15:30', source: 'Self-organised', type: 'street' },
        { title: "Prince Kung's Palace Museum", time: '16:30', source: 'Self-organised', type: 'cultural' },
        { title: 'Sanlitun', time: '19:00', source: 'Self-organised', type: 'street' },
      ]},
    ],
    '2026-06-11': [
      { period: 'Morning', items: [
        { title: 'Summer Palace', time: '09:00', source: 'Self-organised', type: 'sightseeing' },
        { title: 'Yuanmingyuan Park', time: '12:00', source: 'Self-organised', type: 'park' },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Xiushui Street', time: '14:30', source: 'Self-organised', type: 'street' },
        { title: 'Lama Temple', time: '16:30', source: 'Self-organised', type: 'temple' },
      ]},
    ],
    '2026-06-12': [
      { period: 'Morning', items: [
        { title: 'Check-out Yitel Hotel', time: '10:00', source: 'Self-organised', type: 'accommodation' },
        { title: "Train Beijing to Xi'an", time: '13:00', source: 'Self-organised', type: 'transport' },
      ]},
    ],
  },
  xian: {
    '2026-06-13': [
      { period: 'Morning', items: [
        { title: 'Train Beijing → Xi\'an (G87)', time: '09:00', source: 'Self-organised', type: null },
        { title: 'Arrive Xi\'an North', time: '13:30', source: 'Self-organised', type: null },
      ]},
      { period: 'Afternoon', items: [
        { title: 'City Wall cycling', time: '15:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-14': [
      { period: 'Morning', items: [
        { title: 'Terracotta Warriors', time: '08:00', source: 'GetYourGuide', type: null },
        { title: 'Huaqing Hot Springs', time: '13:00', source: 'Self-organised', type: null },
      ]},
      { period: 'Evening', items: [
        { title: 'Muslim Quarter Night Market', time: '18:30', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-15': [
      { period: 'Morning', items: [
        { title: 'Big Wild Goose Pagoda', time: '09:00', source: 'Self-organised', type: null },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Shaanxi History Museum', time: '13:00', source: 'Self-organised', type: null },
      ]},
    ],
  },
  chengdu: {
    '2026-06-17': [
      { period: 'Morning', items: [
        { title: 'Train Xi\'an → Chengdu (G309)', time: '08:30', source: 'Self-organised', type: null },
        { title: 'Arrive Chengdu East', time: '12:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-18': [
      { period: 'Morning', items: [
        { title: 'Giant Panda Breeding Base', time: '08:00', source: 'GetYourGuide', type: null },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Jinli Ancient Street', time: '14:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-19': [
      { period: 'All day', items: [
        { title: 'Day trip to Leshan Giant Buddha', time: '07:30', source: 'GetYourGuide', type: null },
      ]},
    ],
    '2026-06-20': [
      { period: 'Morning', items: [
        { title: 'Wenshu Monastery', time: '09:00', source: 'Self-organised', type: null },
        { title: 'Kuanzhai Xiangzi lanes', time: '11:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-21': [
      { period: 'Morning', items: [
        { title: 'People\'s Park tea ceremony', time: '09:30', source: 'Self-organised', type: null },
      ]},
    ],
  },
  chongqing: {
    '2026-06-22': [
      { period: 'Morning', items: [
        { title: 'Train Chengdu → Chongqing (G8632)', time: '10:00', source: 'Self-organised', type: null },
        { title: 'Arrive Chongqing North', time: '11:15', source: 'Self-organised', type: null },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Hongya Cave & Jialing River view', time: '14:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-23': [
      { period: 'Morning', items: [
        { title: 'Yangtze River cruise', time: '09:00', source: 'GetYourGuide', type: null },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Ciqikou Ancient Town', time: '15:00', source: 'Self-organised', type: null },
      ]},
    ],
  },
  shanghai: {
    '2026-06-26': [
      { period: 'Morning', items: [
        { title: 'Train Chongqing → Shanghai (G570)', time: '08:00', source: 'Self-organised', type: null },
        { title: 'Arrive Shanghai Hongqiao', time: '14:30', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-27': [
      { period: 'Morning', items: [
        { title: 'The Bund morning walk', time: '08:00', source: 'Self-organised', type: null },
        { title: 'Yu Garden + Old Town', time: '10:30', source: 'Self-organised', type: null },
      ]},
      { period: 'Evening', items: [
        { title: 'Bund evening walk', time: '19:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-28': [
      { period: 'Morning', items: [
        { title: 'Shanghai Museum', time: '09:00', source: 'Self-organised', type: null },
      ]},
      { period: 'Afternoon', items: [
        { title: 'Xintiandi', time: '13:30', source: 'Self-organised', type: null },
        { title: 'Former French Concession walk', time: '15:00', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-06-29': [
      { period: 'Morning', items: [
        { title: 'Zhujiajiao Water Town day trip', time: '08:30', source: 'GetYourGuide', type: null },
      ]},
    ],
    '2026-07-04': [
      { period: 'Evening', items: [
        { title: 'Last night dinner · Lost Heaven', time: '19:30', source: 'Self-organised', type: null },
      ]},
    ],
    '2026-07-05': [
      { period: 'Morning', items: [
        { title: 'Transfer to Pudong Airport', time: '06:00', source: 'Self-organised', type: null },
        { title: 'Flight to Tokyo', time: '09:30', source: 'Self-organised', type: null },
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
  flat.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const buckets = {};
  for (const item of flat) {
    const p = getPeriod(item.time) ?? 'Other';
    if (!buckets[p]) buckets[p] = [];
    buckets[p].push(item);
  }
  const result = PERIOD_ORDER.filter(p => buckets[p]).map(p => ({ period: p, items: buckets[p] }));
  if (buckets['Other']) result.push({ period: '', items: buckets['Other'] });
  return result;
}

/* ── Render: activity timeline ─────────────────────────────── */

function renderActivityTimeline(cityKey, dateStr) {
  const acts = (STATIC_ACTIVITIES[cityKey] ?? {})[dateStr] ?? [];

  if (acts.length === 0) {
    return `<li class="dk-itin-empty"><span class="dk-itin-empty-text">No activities planned for this day yet.</span></li>`;
  }

  const groups = regroupByTime(acts);

  const groupsHtml = groups.map(group => `
    <li class="dk-timeline-group">
      <div class="dk-timeline-marker" aria-hidden="true"></div>
      <div class="dk-timeline-content">
        <span class="dk-timeline-period">${esc(group.period)}</span>
        <ul class="dk-activity-list" role="list" data-period="${esc(group.period)}">
          ${group.items.map(item => `
            <li class="dk-activity-card" data-title="${esc(item.title)}">
              <div class="dk-activity-body">
                <span class="dk-activity-title">${esc(item.title)}</span>
                <span class="dk-activity-meta">${esc(item.time)}</span>
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

/* ── Main itinerary init ───────────────────────────────────── */

export function initItinerary() {
  const listEl    = document.getElementById('dk-itin-city-list');
  const panelEl   = document.getElementById('dk-itin-panel');
  const labelEl   = document.getElementById('dk-itin-panel-label');
  const timelineEl = document.getElementById('dk-itin-timeline');

  if (!listEl || !panelEl) return;

  const cities = STATIC_CITIES;

  /* Track selected city and the active day per city */
  let selectedCityKey  = cityKey(cities[0].city);  /* Beijing on load */
  const activeDates    = {};
  cities.forEach(c => { activeDates[cityKey(c.city)] = c.date_start; });

  function updatePanel(key, dateStr) {
    const city = cities.find(c => cityKey(c.city) === key);
    if (!city) return;
    fadePanel(panelEl, () => {
      labelEl.textContent  = itinFormatDateLabel(dateStr, city.city);
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
  timelineEl.innerHTML = renderActivityTimeline(selectedCityKey, firstDate);
  initTimelineSortable(timelineEl, selectedCityKey, firstDate);
}
