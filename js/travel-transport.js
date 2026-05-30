/* ============================================================
   TRAVEL-TRANSPORT.JS — Next transport card (Travel mode only)
   Queries Supabase `transports` table; falls back to localStorage.
   ============================================================ */

import { supabase } from './supabase.js';
import { saveToStorage, loadFromStorage } from './storage.js';

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

/* ── Date helpers ──────────────────────────────────────────── */

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
  const day     = date.getDate();
  const year    = date.getFullYear();
  return `${weekday}, ${month} ${day} · ${year}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

/* ── Query ─────────────────────────────────────────────────── */

async function loadNextTransport(today) {
  const { data, error } = await supabase
    .from('transports')
    .select('*')
    .gte('departure_date', today)
    .order('departure_date', { ascending: true })
    .order('origin_time',    { ascending: true })
    .limit(1);
  if (error) throw error;
  saveToStorage('next_transport', data);
  return data?.[0] ?? null;
}

/* ── Render helpers ────────────────────────────────────────── */

function transportIcon(type) {
  const lucideIcon = type === 'flight' ? 'plane' : 'train-front';
  return `<i data-lucide="${lucideIcon}" style="width:20px;height:20px;stroke:var(--terracotta);stroke-width:2;" aria-hidden="true"></i>`;
}

/* ── Contextual secondary note ─────────────────────────────── */

function secondaryNote(t) {
  if (t.type === 'flight') return 'International flight';
  if (t.origin_time && t.destination_time && t.destination_time < t.origin_time) {
    return 'Arrives next day';
  }
  return 'High-speed rail';
}

function renderTransport(t) {
  const calIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>`;

  const logoHTML = t.logo_path
    ? `<div class="dk-transport-logo">
        <img src="${esc(t.logo_path)}" alt="${esc(t.provider ?? '')} logo"
          onerror="this.parentElement.style.display='none'">
       </div>`
    : '';

  const originTerminal  = t.terminal_origin      ? `<span class="dk-transport-terminal">${esc(t.terminal_origin)}</span>` : '';
  const destTerminal    = t.terminal_destination  ? `<span class="dk-transport-terminal">${esc(t.terminal_destination)}</span>` : '';

  const seatVal = t.seat ?? null;
  const seatDisplay = seatVal !== null ? `Seat: ${esc(seatVal)}` : 'Seat: TBD';
  const originSeat = `<span class="dk-transport-seat" data-id="${esc(String(t.id))}" data-field="seat" data-value="${seatVal !== null ? esc(seatVal) : ''}" title="Click to edit seat">${seatDisplay}</span>`;

  const seatConnVal = t.seat_connection ?? null;
  const connSeatHTML = seatConnVal !== null
    ? `<span class="dk-transport-seat" data-id="${esc(String(t.id))}" data-field="seat_connection" data-value="${esc(seatConnVal)}" title="Click to edit seat">Seat: ${esc(seatConnVal)}</span>`
    : '';

  return `
    <div class="dk-transport-meta">
      <div class="dk-transport-meta-line1">
        <span class="dk-transport-provider-name">${esc(t.provider ?? '')}</span>
        <span class="dk-transport-meta-sep" aria-hidden="true">·</span>
        <span class="dk-transport-number">${esc(t.transport_number ?? '')}</span>
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
        <span class="dk-transport-city-v">${esc(t.origin_city)}</span>
        <span class="dk-transport-code-v">${esc(t.origin_code ?? '')}</span>
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
        <span class="dk-transport-city-v">${esc(t.destination_city)}</span>
        <span class="dk-transport-code-v">${esc(t.destination_code ?? '')}</span>
        <span class="dk-transport-time-v">${esc(formatTime(t.destination_time))}</span>
        ${destTerminal}
        ${connSeatHTML}
      </div>
    </div>
    </div>
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

/* ── Public init ───────────────────────────────────────────── */

export async function initTravelTransport() {
  const card = document.querySelector('.dk-transport');
  if (!card) return;

  const body = card.querySelector('.dk-transport-body');
  if (!body) return;

  body.innerHTML = `<span class="dk-transport-loading">Loading…</span>`;

  try {
    const today    = await getReferenceDate();
    const transport = await loadNextTransport(today);
    body.innerHTML  = transport ? renderTransport(transport) : renderEmpty();
  } catch (err) {
    console.warn('[travel-transport] load failed:', err);
    const cached = loadFromStorage('next_transport')?.[0] ?? null;
    body.innerHTML = cached ? renderTransport(cached) : renderEmpty();
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  /* ── Inline seat editing ─────────────────────────────────── */
  card.addEventListener('click', e => {
    const span = e.target.closest('.dk-transport-seat');
    if (!span || span.querySelector('input')) return;

    const id    = span.dataset.id;
    const field = span.dataset.field;
    const prev  = span.dataset.value; // raw DB value (empty string = null/TBD in DB)
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
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', save); cancel(); }
    });
  });
}
