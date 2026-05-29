/* ============================================================
   TRAVEL-HOTELS.JS — Hotels carousel (Travel mode only)
   Queries Supabase `hotels` table; falls back to localStorage.
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

function formatCheckDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function nightCount(checkIn, checkOut) {
  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

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

/* ── Determine badge for a hotel ──────────────────────────── */

function hotelBadge(hotel, today, nextHotelId) {
  if (today >= hotel.check_in && today <= hotel.check_out) return 'Current stay';
  if (hotel.id === nextHotelId) return 'Next stay';
  return null;
}

/* ── Rating icons (diamonds / stars) ──────────────────────── */

function ratingHTML(hotel) {
  const count = hotel.diamonds ?? hotel.stars ?? 0;
  if (count === 0) return '';
  const icon = hotel.diamonds != null
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#dfbc5e"
        stroke="#dfbc5e" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.57a2.41 2.41 0 0 0 3.41 0l7.57-7.57a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"/>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#dfbc5e"
        stroke="#dfbc5e" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>`;

  return `<div class="dk-hotel-rating" aria-label="${count} ${hotel.diamonds != null ? 'diamonds' : 'stars'}">
    ${Array.from({ length: count }, () => icon).join('')}
  </div>`;
}

/* ── Render single slide ───────────────────────────────────── */

function renderSlide(hotel, index, total, badge) {
  const nights = nightCount(hotel.check_in, hotel.check_out);
  const dateRange = `${formatCheckDate(hotel.check_in)} – ${formatCheckDate(hotel.check_out)} · ${nights} night${nights !== 1 ? 's' : ''}`;

  const photoHTML = hotel.photo_url
    ? `<img src="${esc(hotel.photo_url)}" alt="${esc(hotel.name)}" class="dk-hotel-photo-img" loading="lazy">`
    : `<div class="dk-hotel-photo-placeholder" aria-hidden="true"></div>`;

  const badgeHTML = badge
    ? `<span class="dk-hotel-badge">${esc(badge)}</span>`
    : '';

  const hotelLinkHTML = hotel.hotel_url
    ? `<a href="${esc(hotel.hotel_url)}" target="_blank" rel="noopener noreferrer" class="dk-hotel-link">View hotel →</a>`
    : '';

  const bookingLinkHTML = hotel.booking_confirmation_url
    ? `<a href="${esc(hotel.booking_confirmation_url)}" target="_blank" rel="noopener noreferrer" class="dk-hotel-link">Booking confirmation →</a>`
    : '';

  return `
    <div class="dk-hotel-slide" role="group" aria-label="${esc(hotel.name)}, ${index + 1} of ${total}" aria-hidden="${index !== 0}">
      <div class="dk-hotel-photo">${photoHTML}${badgeHTML}</div>
      <div class="dk-hotel-info">
        <div class="dk-hotel-name-row">
          <span class="dk-hotel-name">${esc(hotel.name)}</span>
          ${ratingHTML(hotel)}
        </div>
        <span class="dk-hotel-dates">${esc(dateRange)}</span>
        <span class="dk-hotel-address">${esc(hotel.address)}</span>
        ${(hotelLinkHTML || bookingLinkHTML) ? `<div class="dk-hotel-links">${hotelLinkHTML}${bookingLinkHTML}</div>` : ''}
      </div>
    </div>
  `;
}

/* ── Render carousel shell + slides ───────────────────────── */

function renderCarousel(hotels, today) {
  // Determine which hotel is "next upcoming" (first with check_in > today)
  const nextHotel = hotels.find(h => h.check_in > today) ?? null;
  const nextHotelId = nextHotel?.id ?? null;

  const slidesHTML = hotels.map((h, i) => {
    const badge = hotelBadge(h, today, nextHotelId);
    return renderSlide(h, i, hotels.length, badge);
  }).join('');
  const dotsHTML = ''; /* Navigation handled by prev/next arrows only — dots removed per design spec */

  return `
    <div class="dk-hotel-viewport">
      <div class="dk-hotel-track">${slidesHTML}</div>
    </div>
    ${dotsHTML}
  `;
}

function renderEmpty() {
  return `
    <div class="dk-transport-empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="var(--border)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/>
        <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>
        <rect width="7" height="5" x="8.5" y="14" rx="1"/>
        <path d="M3 7h18"/>
      </svg>
      <span class="dk-transport-empty-text">No hotels found</span>
    </div>
  `;
}

/* ── Carousel interaction ──────────────────────────────────── */

function initCarouselControls(card, total) {
  if (total <= 1) return;

  const track   = card.querySelector('.dk-hotel-track');
  const dots    = card.querySelectorAll('.dk-hotel-dot');
  const prevBtn = card.querySelector('.dk-hotel-prev');
  const nextBtn = card.querySelector('.dk-hotel-next');
  let   current = 0;

  function goTo(index) {
    current = Math.max(0, Math.min(index, total - 1));
    track.style.transform = `translateX(-${current * 100}%)`;

    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === current);
      dot.setAttribute('aria-selected', String(i === current));
    });

    card.querySelectorAll('.dk-hotel-slide').forEach((slide, i) => {
      slide.setAttribute('aria-hidden', String(i !== current));
    });

    if (prevBtn) {
      prevBtn.disabled = current === 0;
      prevBtn.style.opacity = current === 0 ? '0.35' : '1';
    }
    if (nextBtn) {
      nextBtn.disabled = current === total - 1;
      nextBtn.style.opacity = current === total - 1 ? '0.35' : '1';
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  goTo(0);
}

/* ── Load from Supabase ────────────────────────────────────── */

async function loadHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .order('check_in', { ascending: true });
  if (error) throw error;
  saveToStorage('hotels_list', data);
  return data ?? [];
}

/* ── Public init ───────────────────────────────────────────── */

export async function initTravelHotels() {
  const card = document.querySelector('.dk-hotels');
  if (!card) return;

  const body = card.querySelector('.dk-hotels-body');
  if (!body) return;

  body.innerHTML = `<span class="dk-transport-loading">Loading…</span>`;

  let hotels;
  let today;
  try {
    [hotels, today] = await Promise.all([loadHotels(), getReferenceDate()]);
  } catch (err) {
    console.warn('[travel-hotels] load failed:', err);
    hotels = loadFromStorage('hotels_list') ?? [];
    today  = new Date().toISOString().split('T')[0];
  }

  if (hotels.length === 0) {
    body.innerHTML = renderEmpty();
    return;
  }

  body.innerHTML = renderCarousel(hotels, today);
  initCarouselControls(card, hotels.length);
}
