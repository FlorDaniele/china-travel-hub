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
  if (type === 'flight') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="var(--terracotta)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-1-5.5.5L10 6 1.8 4.2l-2 2 5.8 3.5L3.8 12 2 11l-2 2 4 4 4-4-1-1.8 1.5-1.5 3.5 5.8z"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="var(--terracotta)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="16" rx="2"/>
    <path d="M4 11h16"/><path d="M12 3v8"/>
    <path d="m8 19-2 3"/><path d="m16 19 2 3"/>
    <path d="M8 15h0"/><path d="M16 15h0"/>
  </svg>`;
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
  const typeBadge = t.type === 'flight' ? 'FLIGHT' : 'TRAIN';
  const gateHTML  = t.gate
    ? `<span class="dk-transport-gate">Gate ${esc(t.gate)}</span>`
    : '';

  // CalendarDays icon (Lucide)
  const calIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 2v4"/><path d="M16 2v4"/>
    <rect width="18" height="18" x="3" y="4" rx="2"/>
    <path d="M3 10h18"/>
    <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>
    <path d="M8 18h.01"/><path d="M12 18h.01"/>
  </svg>`;

  // Info icon (Lucide) for secondary row
  const infoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
  </svg>`;

  return `
    <div class="dk-transport-header-section">
      <div class="dk-transport-header-row">
        <div class="dk-transport-header-left">
          <span class="dk-transport-badge">${esc(typeBadge)}</span>
          <span class="dk-transport-provider">${esc(t.transport_number)} · ${esc(t.provider)}</span>
        </div>
        <div class="dk-transport-header-right">
          ${calIcon}
          ${esc(formatDepartureDate(t.departure_date))}
        </div>
      </div>
      <hr class="dk-transport-divider" aria-hidden="true">
    </div>

    <div class="dk-transport-route">
      <div class="dk-transport-origin">
        <span class="dk-transport-city">${esc(t.origin_city)}</span>
        <span class="dk-transport-code">${esc(t.origin_code ?? '')}</span>
        <span class="dk-transport-time">${esc(formatTime(t.origin_time))}</span>
        ${gateHTML}
      </div>

      <div class="dk-transport-line">
        <span class="dk-transport-icon-wrap">${transportIcon(t.type)}</span>
        <span class="dk-transport-duration">${esc(t.duration ?? '')}</span>
        <div class="dk-transport-dashes" aria-hidden="true">
          <span class="dk-transport-dash-line"></span>
          <span class="dk-transport-dash-line"></span>
        </div>
      </div>

      <div class="dk-transport-destination">
        <span class="dk-transport-city">${esc(t.destination_city)}</span>
        <span class="dk-transport-code">${esc(t.destination_code ?? '')}</span>
        <span class="dk-transport-time">${esc(formatTime(t.destination_time))}</span>
      </div>
    </div>

    <div class="dk-transport-secondary-row">
      ${infoIcon}
      <span>${esc(secondaryNote(t))}</span>
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
}
