/* ============================================================
   TRAVEL-TRANSPORT.JS — Transport carousel (Travel mode only)
   Queries Supabase `transports` table; falls back to localStorage.
   ============================================================ */

import { supabase } from './supabase.js';
import { saveToStorage, loadFromStorage } from './storage.js';
import { openModal, closeModal, showToast } from './modal.js';

/* ── XSS escape ────────────────────────────────────────────── */

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Date / time helpers ───────────────────────────────────── */

async function getReferenceDate() {
  try {
    const { data } = await supabase
      .from('trip_config')
      .select('key, value')
      .in('key', ['demo_mode', 'demo_reference_date']);
    const get = k => data?.find(r => r.key === k)?.value ?? null;
    if (get('demo_mode') === 'true' && get('demo_reference_date')) {
      return get('demo_reference_date');
    }
  } catch (_) { /* ignore */ }
  return new Date().toISOString().split('T')[0];
}

function formatDepartureDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month   = date.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} ${date.getDate()} · ${date.getFullYear()}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

/* ── Load all transports ───────────────────────────────────── */

async function loadAllTransports() {
  const { data, error } = await supabase
    .from('transports')
    .select('*')
    .order('departure_date', { ascending: true })
    .order('origin_time',    { ascending: true });
  if (error) throw error;
  saveToStorage('transports_list', data);
  return data ?? [];
}

/* ── SVG atoms ─────────────────────────────────────────────── */

const calIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
</svg>`;

const pencilSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  <path d="m15 5 4 4"/>
</svg>`;

const chevronLeft  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8.75 10.5 5.25 7 8.75 3.5"/></svg>`;
const chevronRight = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5.25 10.5 8.75 7 5.25 3.5"/></svg>`;

function transportIcon(type) {
  const name = type === 'flight' ? 'plane' : 'train-front';
  return `<i data-lucide="${name}" style="width:20px;height:20px;stroke:var(--terracotta);stroke-width:2;" aria-hidden="true"></i>`;
}

/* ── Render single transport card ──────────────────────────── */

function renderTransport(t, index, total) {
  const logoHTML = t.logo_path
    ? `<div class="dk-transport-logo">
        <img src="${esc(t.logo_path)}" alt="${esc(t.provider ?? '')} logo"
          onerror="this.parentElement.style.display='none'">
       </div>`
    : '';

  const originCity = t.origin_code
    ? `${esc(t.origin_city)} (${esc(t.origin_code)})`
    : esc(t.origin_city ?? '');

  const destCity = t.destination_code
    ? `${esc(t.destination_city)} (${esc(t.destination_code)})`
    : esc(t.destination_city ?? '');

  const originTerminal = t.terminal_origin
    ? `<span class="dk-transport-terminal">${esc(t.terminal_origin)}</span>` : '';
  const destTerminal   = t.terminal_destination
    ? `<span class="dk-transport-terminal">${esc(t.terminal_destination)}</span>` : '';

  const seatVal     = t.seat ?? null;
  const seatDisplay = seatVal !== null ? `Seat: ${esc(seatVal)}` : 'Seat: TBD';
  const originSeat  = t.type === 'flight'
    ? `<span class="dk-transport-seat" data-id="${esc(String(t.id))}" data-field="seat" data-value="${seatVal !== null ? esc(seatVal) : ''}" title="Click to edit seat">${seatDisplay}</span>`
    : '';

  const navHTML = total > 1 ? `
    <div class="dk-transport-nav-bottom">
      <button class="dk-icon-btn dk-icon-btn--action dk-transport-prev" aria-label="Previous transport" ${index === 0 ? 'disabled' : ''}>${chevronLeft}</button>
      <button class="dk-icon-btn dk-icon-btn--action dk-transport-next" aria-label="Next transport" ${index === total - 1 ? 'disabled' : ''}>${chevronRight}</button>
    </div>` : '';

  return `
    <div class="dk-transport-meta">
      <div class="dk-transport-meta-line1">
        <span class="dk-transport-provider-name">${esc(t.provider ?? '')}</span>
        <span class="dk-transport-meta-sep" aria-hidden="true">·</span>
        <span class="dk-transport-number">${esc(t.transport_number ?? '')}</span>
        <button class="dk-transport-edit-btn" aria-label="Edit ${esc(t.transport_number ?? '')}" data-transport-id="${esc(String(t.id))}">${pencilSVG}</button>
        ${logoHTML}
      </div>
      <div class="dk-transport-meta-line2">
        ${calIcon}
        <span class="dk-transport-meta-date">${esc(formatDepartureDate(t.departure_date))}</span>
      </div>
      <hr class="dk-transport-divider" aria-hidden="true">
    </div>

    <div class="dk-transport-route-wrap">
      <div class="dk-transport-route-v">
        <div class="dk-transport-endpoint">
          <span class="dk-transport-city-v">${originCity}</span>
          <span class="dk-transport-time-v">${esc(formatTime(t.origin_time))}</span>
          ${originTerminal}
          ${originSeat}
        </div>

        <div class="dk-transport-connection" aria-hidden="true">
          <div class="dk-transport-v-seg"></div>
          <div class="dk-transport-icon-center">
            <span class="dk-transport-icon-wrap">${transportIcon(t.type)}</span>
            <span class="dk-transport-duration-v">${esc(t.duration ?? '')}</span>
          </div>
          <div class="dk-transport-v-seg"></div>
        </div>

        <div class="dk-transport-endpoint">
          <span class="dk-transport-city-v">${destCity}</span>
          <span class="dk-transport-time-v">${esc(formatTime(t.destination_time))}</span>
          ${destTerminal}
        </div>
      </div>
    </div>

    ${navHTML}
  `;
}

function renderEmpty() {
  return `
    <div class="dk-transport-empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="var(--border)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
      </svg>
      <span class="dk-transport-empty-text">No upcoming transport</span>
    </div>
  `;
}

/* ── Carousel ──────────────────────────────────────────────── */

function initCarousel(card, body, transports) {
  let current = 0;
  const total = transports.length;

  function goTo(index) {
    current = Math.max(0, Math.min(index, total - 1));
    body.innerHTML = renderTransport(transports[current], current, total);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    attachListeners();
  }

  function attachListeners() {
    const prev = card.querySelector('.dk-transport-prev');
    const next = card.querySelector('.dk-transport-next');
    if (prev) prev.addEventListener('click', () => goTo(current - 1));
    if (next) next.addEventListener('click', () => goTo(current + 1));
    wireEditButtons(card, body, transports, goTo);
  }

  attachListeners();
}

/* ── Inline seat editing ───────────────────────────────────── */

function wireSeatEditing(card) {
  card.addEventListener('click', e => {
    const span = e.target.closest('.dk-transport-seat');
    if (!span || span.querySelector('input')) return;

    const id    = span.dataset.id;
    const field = span.dataset.field;
    const prev  = span.dataset.value;
    const displayVal = (prev === '' || prev === 'TBD') ? '' : prev;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dk-transport-seat-input';
    input.value = displayVal;
    input.placeholder = 'e.g. 24A';
    span.innerHTML = 'Seat: ';
    span.appendChild(input);
    input.focus();
    input.select();

    async function save() {
      const val = input.value.trim() || null;
      span.dataset.value = val ?? '';
      span.textContent = val ? `Seat: ${val}` : 'Seat: TBD';
      try {
        await supabase.from('transports').update({ [field]: val }).eq('id', id);
      } catch (err) {
        console.warn('[travel-transport] seat save failed:', err);
      }
    }

    function cancel() {
      span.textContent = prev !== '' ? `Seat: ${prev}` : 'Seat: TBD';
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { input.removeEventListener('blur', save); cancel(); }
    });
  });
}

/* ── Edit buttons ──────────────────────────────────────────── */

function wireEditButtons(card, body, transports, goTo) {
  card.querySelectorAll('.dk-transport-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id = btn.dataset.transportId;
      const t  = transports.find(x => String(x.id) === id);
      if (!t) return;
      openTransportModal(t, () => refreshTransports(card, body));
    });
  });
}

/* ── Refresh helper ────────────────────────────────────────── */

async function refreshTransports(card, body) {
  body.innerHTML = `<span class="dk-transport-loading">Loading…</span>`;
  let transports;
  try {
    transports = await loadAllTransports();
  } catch (err) {
    console.warn('[travel-transport] refresh failed:', err);
    transports = loadFromStorage('transports_list') ?? [];
  }
  if (transports.length === 0) {
    body.innerHTML = renderEmpty();
    return;
  }
  body.innerHTML = renderTransport(transports[0], 0, transports.length);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  initCarousel(card, body, transports);
}

/* ── Timezone-aware duration calculation ───────────────────── */

const AIRPORT_TZ = {
  CDG: 'Europe/Paris', ORY: 'Europe/Paris',
  PEK: 'Asia/Shanghai', PKX: 'Asia/Shanghai',
  PVG: 'Asia/Shanghai', SHA: 'Asia/Shanghai',
  NRT: 'Asia/Tokyo',   HND: 'Asia/Tokyo',
  CAN: 'Asia/Shanghai', CTU: 'Asia/Shanghai',
  XIY: 'Asia/Shanghai', KMG: 'Asia/Shanghai',
};

function airportToTZ(code) {
  return AIRPORT_TZ[(code ?? '').trim().toUpperCase()] ?? null;
}

function localToUTCMs(dateStr, timeStr, tz) {
  const isoStr  = `${dateStr}T${timeStr}:00`;
  const tempDate = new Date(isoStr + 'Z');
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(tempDate);
  const tzDate = new Date(formatted.replace(', ', 'T') + 'Z');
  return tempDate.getTime() + (tempDate.getTime() - tzDate.getTime());
}

function calcFlightDuration(depDate, depTime, depCode, arrDate, arrTime, arrCode) {
  if (!depDate || !depTime || !arrDate || !arrTime) return null;
  const depTZ = airportToTZ(depCode);
  const arrTZ = airportToTZ(arrCode);
  const warn  = (!depTZ || !arrTZ) ? ' ⚠ timezone unknown' : '';
  try {
    const depUTC = localToUTCMs(depDate, depTime, depTZ ?? 'UTC');
    const arrUTC = localToUTCMs(arrDate, arrTime, arrTZ ?? 'UTC');
    const diffMs = arrUTC - depUTC;
    if (diffMs <= 0) return null;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.round((diffMs % 3600000) / 60000);
    return `${h}h ${m}m${warn}`;
  } catch (_) { return null; }
}

/* ── Transport modal ───────────────────────────────────────── */

function buildTransportModalBody(t) {
  const v        = field => esc(t?.[field] ?? '');
  const isFlight = !t || t.type === 'flight';
  const fHide    = isFlight ? '' : 'style="display:none"';
  const tHide    = isFlight ? 'style="display:none"' : '';

  return `
    <div class="modal-field">
      <span class="modal-label" id="tr-type-lbl">Type</span>
      <div class="modal-pill-group" role="radiogroup" aria-labelledby="tr-type-lbl">
        <button class="modal-pill" type="button" role="radio" aria-checked="${isFlight ? 'true' : 'false'}" data-value="flight">Flight</button>
        <button class="modal-pill" type="button" role="radio" aria-checked="${isFlight ? 'false' : 'true'}" data-value="train">Train</button>
      </div>
    </div>

    <!-- Flight: Airline + Flight number on same row -->
    <div class="modal-row tr-flight-only" ${fHide}>
      <div class="modal-field">
        <label class="modal-label" for="tr-airline">Airline</label>
        <input type="text" id="tr-airline" class="modal-input" placeholder="Air France" value="${isFlight ? v('provider') : ''}">
      </div>
      <div class="modal-field modal-field--transport-number">
        <label class="modal-label" for="tr-flight-number">Flight number</label>
        <input type="text" id="tr-flight-number" class="modal-input" placeholder="AF0202" value="${isFlight ? v('transport_number') : ''}">
      </div>
    </div>
    <!-- Train: number + operator standalone -->
    <div class="modal-field tr-train-only" ${tHide}>
      <label class="modal-label" for="tr-train-number">Train number</label>
      <input type="text" id="tr-train-number" class="modal-input" placeholder="G87" value="${!isFlight ? v('transport_number') : ''}">
    </div>

    <!-- Departure date + time on same row -->
    <div class="modal-row">
      <div class="modal-field modal-field--date">
        <label class="modal-label" for="tr-date">Departure date <span style="color:var(--terracotta)">*</span></label>
        <input type="date" id="tr-date" class="modal-date" value="${v('departure_date')}">
        <div class="modal-error" id="tr-date-err" role="alert"></div>
      </div>
      <div class="modal-field">
        <label class="modal-label" for="tr-origin-time">Time <span style="color:var(--terracotta)">*</span></label>
        <input type="time" id="tr-origin-time" class="modal-input" value="${formatTime(v('origin_time'))}">
        <div class="modal-error" id="tr-time-err" role="alert"></div>
      </div>
    </div>

    <!-- Origin city + Airport code: row (code hidden for trains) -->
    <div class="modal-row">
      <div class="modal-field">
        <label class="modal-label" for="tr-origin-city">Origin city <span style="color:var(--terracotta)">*</span></label>
        <input type="text" id="tr-origin-city" class="modal-input" placeholder="Paris / Beijing" value="${v('origin_city')}">
        <div class="modal-error" id="tr-origin-err" role="alert"></div>
      </div>
      <div class="modal-field modal-field--airport-code tr-flight-only" ${fHide}>
        <label class="modal-label" for="tr-origin-code">Code</label>
        <input type="text" id="tr-origin-code" class="modal-input modal-input--airport-code" placeholder="CDG" maxlength="3" value="${v('origin_code')}">
      </div>
    </div>

    <!-- Terminal origin + Seat on same row (flight only) -->
    <div class="modal-row tr-flight-only" ${fHide}>
      <div class="modal-field">
        <label class="modal-label" for="tr-terminal-origin">Terminal <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
        <input type="text" id="tr-terminal-origin" class="modal-input" placeholder="Terminal 2E" value="${v('terminal_origin')}">
      </div>
      <div class="modal-field modal-field--seat">
        <label class="modal-label" for="tr-seat">Seat <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
        <input type="text" id="tr-seat" class="modal-input modal-input--seat" placeholder="24A" maxlength="4" value="${v('seat')}">
      </div>
    </div>

    <!-- Auto-calculated duration (flight only, read-only) -->
    <div class="modal-field tr-flight-only" id="tr-duration-wrap" ${fHide}>
      <span class="modal-label" style="color:var(--text-secondary);font-weight:400">Duration</span>
      <span id="tr-duration-display" style="font-size:14px;color:var(--text-secondary)">—</span>
    </div>

    <!-- Arrival date + time on same row (flight only) -->
    <div class="modal-row tr-flight-only" ${fHide}>
      <div class="modal-field modal-field--date">
        <label class="modal-label" for="tr-arr-date">Arrival date</label>
        <input type="date" id="tr-arr-date" class="modal-date" value="${v('arrival_date')}">
      </div>
      <div class="modal-field">
        <label class="modal-label" for="tr-dest-time-f">Arrival time</label>
        <input type="time" id="tr-dest-time-f" class="modal-input" value="${formatTime(v('destination_time'))}">
      </div>
    </div>

    <!-- Train: arrival time only -->
    <div class="modal-field tr-train-only" ${tHide}>
      <label class="modal-label" for="tr-dest-time-t">Arrival time <span style="color:var(--terracotta)">*</span></label>
      <input type="time" id="tr-dest-time-t" class="modal-input" value="${formatTime(v('destination_time'))}">
    </div>

    <!-- Destination city + Airport code: row (code hidden for trains) -->
    <div class="modal-row">
      <div class="modal-field">
        <label class="modal-label" for="tr-dest-city">Destination city <span style="color:var(--terracotta)">*</span></label>
        <input type="text" id="tr-dest-city" class="modal-input" placeholder="Beijing / Xi'an" value="${v('destination_city')}">
        <div class="modal-error" id="tr-dest-err" role="alert"></div>
      </div>
      <div class="modal-field modal-field--airport-code tr-flight-only" ${fHide}>
        <label class="modal-label" for="tr-dest-code">Code</label>
        <input type="text" id="tr-dest-code" class="modal-input modal-input--airport-code" placeholder="PEK" maxlength="3" value="${v('destination_code')}">
      </div>
    </div>

    <!-- Terminal destination (flight only, full width) -->
    <div class="modal-field tr-flight-only" ${fHide}>
      <label class="modal-label" for="tr-terminal-dest">Terminal destination <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
      <input type="text" id="tr-terminal-dest" class="modal-input" placeholder="Terminal 2" value="${v('terminal_destination')}">
    </div>

    <!-- Train: operator + manual duration -->
    <div class="modal-field tr-train-only" ${tHide}>
      <label class="modal-label" for="tr-operator">Operator</label>
      <input type="text" id="tr-operator" class="modal-input" placeholder="China Railway" value="${!isFlight ? v('provider') : 'China Railway'}">
    </div>
    <div class="modal-field tr-train-only" ${tHide}>
      <label class="modal-label" for="tr-duration">Duration <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
      <input type="text" id="tr-duration" class="modal-input" placeholder="10h 40m" value="${v('duration')}">
    </div>
  `;
}

function updateDurationDisplay() {
  const el = document.getElementById('tr-duration-display');
  if (!el) return;
  const depDate = document.getElementById('tr-date')?.value;
  const depTime = document.getElementById('tr-origin-time')?.value;
  const depCode = document.getElementById('tr-origin-code')?.value?.trim();
  const arrDate = document.getElementById('tr-arr-date')?.value;
  const arrTime = document.getElementById('tr-dest-time-f')?.value;
  const arrCode = document.getElementById('tr-dest-code')?.value?.trim();
  const result  = calcFlightDuration(depDate, depTime, depCode, arrDate, arrTime, arrCode);
  el.textContent = result ?? '—';
}

function wireTransportTypePills() {
  const pills = [...document.querySelectorAll('#tr-type-lbl ~ .modal-pill-group .modal-pill')];
  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.setAttribute('aria-checked', 'false'));
      p.setAttribute('aria-checked', 'true');
      const isFlight = p.dataset.value === 'flight';
      document.querySelectorAll('.tr-flight-only').forEach(el => el.style.display = isFlight ? '' : 'none');
      document.querySelectorAll('.tr-train-only').forEach(el  => el.style.display = isFlight ? 'none' : '');
      /* Sync arrival time between the two type-specific inputs */
      if (isFlight) {
        const v = document.getElementById('tr-dest-time-t')?.value;
        if (v) document.getElementById('tr-dest-time-f').value = v;
      } else {
        const v = document.getElementById('tr-dest-time-f')?.value;
        if (v) document.getElementById('tr-dest-time-t').value = v;
      }
      updateDurationDisplay();
    });
  });
}

function wireTransportDurationCalc() {
  ['tr-date', 'tr-origin-time', 'tr-origin-code', 'tr-arr-date', 'tr-dest-time-f', 'tr-dest-code'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateDurationDisplay);
    document.getElementById(id)?.addEventListener('change', updateDurationDisplay);
  });
  updateDurationDisplay();
}

function collectTransportValues() {
  const typePill = document.querySelector('#tr-type-lbl ~ .modal-pill-group .modal-pill[aria-checked="true"]');
  const type     = typePill?.dataset.value ?? 'flight';
  const isFlight = type === 'flight';

  /* For flights, duration is auto-calculated; for trains it's manual */
  const autoDuration = isFlight
    ? calcFlightDuration(
        document.getElementById('tr-date')?.value,
        document.getElementById('tr-origin-time')?.value,
        document.getElementById('tr-origin-code')?.value?.trim(),
        document.getElementById('tr-arr-date')?.value,
        document.getElementById('tr-dest-time-f')?.value,
        document.getElementById('tr-dest-code')?.value?.trim(),
      )
    : null;

  return {
    type,
    transport_number:     isFlight
      ? (document.getElementById('tr-flight-number')?.value.trim() || null)
      : (document.getElementById('tr-train-number')?.value.trim() || null),
    departure_date:       document.getElementById('tr-date')?.value || null,
    origin_city:          document.getElementById('tr-origin-city')?.value.trim() || null,
    origin_code:          document.getElementById('tr-origin-code')?.value.trim() || null,
    origin_time:          document.getElementById('tr-origin-time')?.value || null,
    destination_city:     document.getElementById('tr-dest-city')?.value.trim() || null,
    destination_code:     document.getElementById('tr-dest-code')?.value.trim() || null,
    destination_time:     isFlight
      ? (document.getElementById('tr-dest-time-f')?.value || null)
      : (document.getElementById('tr-dest-time-t')?.value || null),
    arrival_date:         isFlight ? (document.getElementById('tr-arr-date')?.value || null) : null,
    duration:             isFlight ? autoDuration : (document.getElementById('tr-duration')?.value.trim() || null),
    provider:             isFlight
      ? (document.getElementById('tr-airline')?.value.trim() || null)
      : (document.getElementById('tr-operator')?.value.trim() || null),
    terminal_origin:      document.getElementById('tr-terminal-origin')?.value.trim() || null,
    terminal_destination: document.getElementById('tr-terminal-dest')?.value.trim() || null,
    seat:                 document.getElementById('tr-seat')?.value.trim() || null,
  };
}

function validateTransportModal() {
  let valid = true;
  const setErr = (id, msg) => {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
    if (msg) valid = false;
  };
  ['tr-date-err','tr-origin-err','tr-dest-err','tr-time-err'].forEach(id => setErr(id, ''));
  const v = collectTransportValues();
  if (!v.departure_date)   setErr('tr-date-err',   'Departure date is required.');
  if (!v.origin_city)      setErr('tr-origin-err',  'Origin city is required.');
  if (!v.destination_city) setErr('tr-dest-err',    'Destination city is required.');
  if (!v.origin_time)      setErr('tr-time-err',    'Departure time is required.');
  return valid;
}

function injectTransportDeleteButton(transportId, onDeleted) {
  const card = document.querySelector('.modal-card');
  if (!card) return;

  const wrap = document.createElement('div');
  wrap.className = 'ht-modal-delete-wrap';
  wrap.innerHTML = `
    <button type="button" class="ht-modal-delete-btn" id="tr-del-btn">Delete transport</button>
    <div class="ht-modal-confirm-row hidden" id="tr-del-confirm">
      <span class="ht-modal-confirm-text">This action cannot be undone. Confirm delete?</span>
      <button type="button" class="ht-modal-confirm-yes" id="tr-del-yes">Delete</button>
    </div>
  `;
  card.appendChild(wrap);

  card.querySelector('#tr-del-btn').addEventListener('click', () => {
    card.querySelector('#tr-del-confirm').classList.remove('hidden');
    card.querySelector('#tr-del-btn').style.display = 'none';
  });

  card.querySelector('#tr-del-yes').addEventListener('click', async () => {
    try {
      const { error } = await supabase.from('transports').delete().eq('id', transportId);
      if (error) throw error;
      closeModal();
      showToast('Transport deleted');
      onDeleted();
    } catch (err) {
      console.warn('[travel-transport] delete failed:', err);
      showToast('Delete failed — please try again');
    }
  });
}

function openTransportModal(existing, onSaved) {
  const isEdit = !!existing;

  openModal({
    id:        'tr-modal',
    title:     isEdit ? 'Edit transport' : 'Add transport',
    maxHeight: 'min(90vh, 680px)',
    bodyHTML:  buildTransportModalBody(existing),
    onSave:   async () => {
      if (!validateTransportModal()) return;
      const payload = collectTransportValues();

      if (payload.type === 'train') {
        payload.origin_code = null; payload.destination_code = null;
        payload.terminal_origin = null; payload.terminal_destination = null;
        payload.seat = null;
      }

      const p = (payload.provider ?? '').toLowerCase();
      if (p.includes('air france'))        payload.logo_path = 'assets/logos/air-france.svg';
      else if (p.includes('air china'))    payload.logo_path = 'assets/logos/air-china.svg';
      else if (p.includes('china railway')) payload.logo_path = 'assets/logos/china-railway.svg';
      else                                  payload.logo_path = null;

      try {
        if (isEdit) {
          const { error } = await supabase.from('transports').update(payload).eq('id', existing.id);
          if (error) throw error;
          showToast('Transport updated');
        } else {
          const { error } = await supabase.from('transports').insert(payload);
          if (error) throw error;
          showToast('Transport added');
        }
        closeModal();
        onSaved();
      } catch (err) {
        console.warn('[travel-transport] save failed:', err);
        showToast('Save failed — please try again');
      }
    },
  });

  wireTransportTypePills();
  wireTransportDurationCalc();
  if (isEdit) injectTransportDeleteButton(existing.id, onSaved);
}

/* ── Public init ───────────────────────────────────────────── */

export async function initTravelTransport() {
  const card = document.querySelector('.dk-transport');
  if (!card) return;

  const body = card.querySelector('.dk-transport-body');
  if (!body) return;

  body.innerHTML = `<span class="dk-transport-loading">Loading…</span>`;

  let transports;
  try {
    transports = await loadAllTransports();
  } catch (err) {
    console.warn('[travel-transport] load failed:', err);
    transports = loadFromStorage('transports_list') ?? [];
  }

  if (transports.length === 0) {
    body.innerHTML = renderEmpty();
  } else {
    body.innerHTML = renderTransport(transports[0], 0, transports.length);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    wireSeatEditing(card);
    initCarousel(card, body, transports);
  }

  document.getElementById('dk-transport-add')?.addEventListener('click', () => {
    openTransportModal(null, () => refreshTransports(card, body));
  });
}
