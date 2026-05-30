/* ============================================================
   TRAVEL-HOTELS.JS — Hotels carousel (Travel mode only)
   Queries Supabase `hotels` table; falls back to localStorage.
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

/* ── Rating icons (diamonds) ──────────────────────────────── */

const diamondSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#dfbc5e"
  stroke="#dfbc5e" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.57a2.41 2.41 0 0 0 3.41 0l7.57-7.57a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"/>
</svg>`;

function ratingHTML(hotel) {
  const count = hotel.diamonds ?? hotel.stars ?? 0;
  if (count === 0) return '';
  const icon = hotel.diamonds != null ? diamondSVG
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#dfbc5e"
        stroke="#dfbc5e" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>`;
  return `<div class="dk-hotel-rating" aria-label="${count} ${hotel.diamonds != null ? 'diamonds' : 'stars'}">
    ${Array.from({ length: count }, () => icon).join('')}
  </div>`;
}

/* ── Pencil icon ───────────────────────────────────────────── */

const pencilSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  <path d="m15 5 4 4"/>
</svg>`;

/* ── Render single slide ───────────────────────────────────── */

function renderSlide(hotel, index, total, badge) {
  const nights = nightCount(hotel.check_in, hotel.check_out);
  const dateRange = `${formatCheckDate(hotel.check_in)} – ${formatCheckDate(hotel.check_out)} · ${nights} night${nights !== 1 ? 's' : ''}`;

  const photoHTML = hotel.photo_url
    ? `<img src="${esc(hotel.photo_url)}" alt="${esc(hotel.name)}" class="dk-hotel-photo-img" loading="lazy">`
    : `<div class="dk-hotel-photo-placeholder" aria-hidden="true"></div>`;

  const badgeHTML = badge ? `<span class="dk-hotel-badge">${esc(badge)}</span>` : '';

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
          <button class="dk-hotel-edit-btn" aria-label="Edit ${esc(hotel.name)}" data-hotel-id="${esc(String(hotel.id))}">${pencilSVG}</button>
        </div>
        <span class="dk-hotel-dates">${esc(dateRange)}</span>
        <span class="dk-hotel-address">${esc(hotel.address ?? '')}</span>
        ${(hotelLinkHTML || bookingLinkHTML) ? `<div class="dk-hotel-links">${hotelLinkHTML}${bookingLinkHTML}</div>` : ''}
      </div>
    </div>
  `;
}

/* ── Render carousel shell + slides ───────────────────────── */

const chevronLeft  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8.75 10.5 5.25 7 8.75 3.5"/></svg>`;
const chevronRight = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5.25 10.5 8.75 7 5.25 3.5"/></svg>`;

function renderCarousel(hotels, today) {
  const nextHotel   = hotels.find(h => h.check_in > today) ?? null;
  const nextHotelId = nextHotel?.id ?? null;

  const slidesHTML = hotels.map((h, i) => {
    const badge = hotelBadge(h, today, nextHotelId);
    return renderSlide(h, i, hotels.length, badge);
  }).join('');

  const navHTML = hotels.length > 1 ? `
    <div class="dk-hotel-nav-bottom">
      <button class="dk-icon-btn dk-icon-btn--action dk-hotel-prev" aria-label="Previous hotel" disabled>${chevronLeft}</button>
      <button class="dk-icon-btn dk-icon-btn--action dk-hotel-next" aria-label="Next hotel">${chevronRight}</button>
    </div>` : '';

  return `
    <div class="dk-hotel-viewport">
      <div class="dk-hotel-track">${slidesHTML}</div>
    </div>
    ${navHTML}
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
  const prevBtn = card.querySelector('.dk-hotel-prev');
  const nextBtn = card.querySelector('.dk-hotel-next');
  let   current = 0;

  function goTo(index) {
    current = Math.max(0, Math.min(index, total - 1));
    track.style.transform = `translateX(-${current * 100}%)`;

    card.querySelectorAll('.dk-hotel-slide').forEach((slide, i) => {
      slide.setAttribute('aria-hidden', String(i !== current));
    });

    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn) nextBtn.disabled = current === total - 1;
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

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

/* ── nights auto-calc helper for modal ────────────────────── */

function updateNightsDisplay() {
  const ci = document.getElementById('ht-modal-checkin')?.value;
  const co = document.getElementById('ht-modal-checkout')?.value;
  const el = document.getElementById('ht-modal-nights');
  if (!el) return;
  if (ci && co && co > ci) {
    const n = nightCount(ci, co);
    el.textContent = `${n} night${n !== 1 ? 's' : ''}`;
  } else {
    el.textContent = '—';
  }
}

/* ── Hotel modal (add + edit) ──────────────────────────────── */

function buildModalBody(hotel) {
  const v   = (field) => esc(hotel?.[field] ?? '');
  const d   = hotel?.diamonds ?? 0;

  const diamondPills = [2, 3, 4, 5].map(n =>
    `<button class="modal-pill" type="button" role="radio" aria-checked="${n === d ? 'true' : 'false'}" data-value="${n}">${n} ✦</button>`
  ).join('');

  return `
    <div class="modal-field">
      <label class="modal-label" for="ht-modal-name">Hotel name <span style="color:var(--terracotta)">*</span></label>
      <input type="text" id="ht-modal-name" class="modal-input" placeholder="Yitel Collection Beijing" value="${v('name')}">
      <div class="modal-error" id="ht-modal-name-err" role="alert"></div>
    </div>
    <div class="modal-field">
      <label class="modal-label" for="ht-modal-address">Address</label>
      <input type="text" id="ht-modal-address" class="modal-input" placeholder="No. 12 Jianhua South Road, Beijing" value="${v('address')}">
    </div>
    <div class="modal-field">
      <span class="modal-label" id="ht-modal-diamonds-lbl">Diamonds</span>
      <div class="modal-pill-group" role="radiogroup" aria-labelledby="ht-modal-diamonds-lbl">${diamondPills}</div>
    </div>
    <!-- Check-in + check-out on same row -->
    <div class="modal-row">
      <div class="modal-field">
        <label class="modal-label" for="ht-modal-checkin">Check-in <span style="color:var(--terracotta)">*</span></label>
        <input type="date" id="ht-modal-checkin" class="modal-date" value="${v('check_in')}">
        <div class="modal-error" id="ht-modal-dates-err" role="alert"></div>
      </div>
      <div class="modal-field">
        <label class="modal-label" for="ht-modal-checkout">Check-out <span style="color:var(--terracotta)">*</span></label>
        <input type="date" id="ht-modal-checkout" class="modal-date" value="${v('check_out')}">
      </div>
    </div>
    <div class="modal-field">
      <label class="modal-label" for="ht-modal-photo">Photo URL <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
      <input type="text" id="ht-modal-photo" class="modal-input" placeholder="https://..." value="${v('photo_url')}">
    </div>
    <div class="modal-field">
      <label class="modal-label" for="ht-modal-url">Hotel URL <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
      <input type="text" id="ht-modal-url" class="modal-input" placeholder="https://trip.com/..." value="${v('hotel_url')}">
    </div>
    <div class="modal-field">
      <label class="modal-label" for="ht-modal-booking">Booking confirmation URL <span style="color:var(--text-secondary);font-weight:400">(optional)</span></label>
      <input type="text" id="ht-modal-booking" class="modal-input" placeholder="https://..." value="${v('booking_confirmation_url')}">
    </div>
  `;
}

function wireModalPills() {
  const pills = [...document.querySelectorAll('#ht-modal-diamonds-lbl ~ .modal-pill-group .modal-pill')];
  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.setAttribute('aria-checked', 'false'));
      p.setAttribute('aria-checked', 'true');
    });
  });
}

function wireNightsCalc() {
  document.getElementById('ht-modal-checkin')?.addEventListener('change', updateNightsDisplay);
  document.getElementById('ht-modal-checkout')?.addEventListener('change', updateNightsDisplay);
}

function collectModalValues() {
  const name    = document.getElementById('ht-modal-name')?.value.trim() ?? '';
  const checkin = document.getElementById('ht-modal-checkin')?.value ?? '';
  const checkout= document.getElementById('ht-modal-checkout')?.value ?? '';
  const address = document.getElementById('ht-modal-address')?.value.trim() ?? '';
  const photo   = document.getElementById('ht-modal-photo')?.value.trim() || null;
  const hotelUrl= document.getElementById('ht-modal-url')?.value.trim() || null;
  const bookUrl = document.getElementById('ht-modal-booking')?.value.trim() || null;
  const diamondPill = document.querySelector('.modal-pill-group .modal-pill[aria-checked="true"]');
  const diamonds = diamondPill ? Number(diamondPill.dataset.value) : 0;

  return { name, checkin, checkout, address, photo, hotelUrl, bookUrl, diamonds };
}

function validateModal() {
  const { name, checkin, checkout } = collectModalValues();
  let valid = true;

  const nameErr  = document.getElementById('ht-modal-name-err');
  const datesErr = document.getElementById('ht-modal-dates-err');

  if (nameErr)  nameErr.textContent  = '';
  if (datesErr) datesErr.textContent = '';

  if (!name) {
    if (nameErr) nameErr.textContent = 'Hotel name is required.';
    valid = false;
  }
  if (!checkin) {
    if (datesErr) datesErr.textContent = 'Check-in date is required.';
    valid = false;
  }
  if (!checkout) {
    if (datesErr) datesErr.textContent = datesErr.textContent || 'Check-out date is required.';
    valid = false;
  }
  if (checkin && checkout && checkout <= checkin) {
    if (datesErr) datesErr.textContent = 'Check-out must be after check-in.';
    valid = false;
  }
  return valid;
}

function injectDeleteButton(hotelId, onDeleted) {
  const card = document.querySelector('.modal-card');
  if (!card) return;

  const deleteBtn = document.createElement('div');
  deleteBtn.className = 'ht-modal-delete-wrap';
  deleteBtn.innerHTML = `
    <button type="button" class="ht-modal-delete-btn" id="ht-modal-delete">Delete hotel</button>
    <div class="ht-modal-confirm-row hidden" id="ht-modal-confirm-row">
      <span class="ht-modal-confirm-text">This action cannot be undone. Confirm delete?</span>
      <button type="button" class="ht-modal-confirm-yes" id="ht-modal-confirm-yes">Delete</button>
    </div>
  `;
  card.appendChild(deleteBtn);

  card.querySelector('#ht-modal-delete').addEventListener('click', () => {
    card.querySelector('#ht-modal-confirm-row').classList.remove('hidden');
    card.querySelector('#ht-modal-delete').style.display = 'none';
  });

  card.querySelector('#ht-modal-confirm-yes').addEventListener('click', async () => {
    try {
      const { error } = await supabase.from('hotels').delete().eq('id', hotelId);
      if (error) throw error;
      closeModal();
      showToast('Hotel deleted');
      onDeleted();
    } catch (err) {
      console.warn('[travel-hotels] delete failed:', err);
      showToast('Delete failed — please try again');
    }
  });
}

function openHotelModal(existingHotel, onSaved) {
  const isEdit = !!existingHotel;
  const title  = isEdit ? 'Edit hotel' : 'Add hotel';

  openModal({
    id:        'ht-modal',
    title,
    maxHeight: 'min(90vh, 600px)',
    bodyHTML:  buildModalBody(existingHotel),
    onSave:   async () => {
      if (!validateModal()) return;
      const { name, checkin, checkout, address, photo, hotelUrl, bookUrl, diamonds } = collectModalValues();

      const payload = {
        name,
        check_in:                 checkin,
        check_out:                checkout,
        address:                  address || null,
        photo_url:                photo,
        hotel_url:                hotelUrl,
        booking_confirmation_url: bookUrl,
        diamonds:                 diamonds || null,
      };

      try {
        if (isEdit) {
          const { error } = await supabase.from('hotels').update(payload).eq('id', existingHotel.id);
          if (error) throw error;
          showToast('Hotel updated');
        } else {
          const { error } = await supabase.from('hotels').insert(payload);
          if (error) throw error;
          showToast('Hotel added');
        }
        closeModal();
        onSaved();
      } catch (err) {
        console.warn('[travel-hotels] save failed:', err);
        showToast('Save failed — please try again');
      }
    },
  });

  wireModalPills();
  wireNightsCalc();

  if (isEdit) {
    injectDeleteButton(existingHotel.id, onSaved);
  }
}

/* ── Refresh helper ────────────────────────────────────────── */

async function refreshHotels(card, body) {
  body.innerHTML = `<span class="dk-transport-loading">Loading…</span>`;
  let hotels;
  let today;
  try {
    [hotels, today] = await Promise.all([loadHotels(), getReferenceDate()]);
  } catch (err) {
    console.warn('[travel-hotels] refresh failed:', err);
    hotels = loadFromStorage('hotels_list') ?? [];
    today  = new Date().toISOString().split('T')[0];
  }

  if (hotels.length === 0) {
    body.innerHTML = renderEmpty();
    return;
  }

  body.innerHTML = renderCarousel(hotels, today);
  initCarouselControls(card, hotels.length);
  wireEditButtons(card, body, hotels);
}

/* ── Wire edit buttons ─────────────────────────────────────── */

function wireEditButtons(card, body, hotels) {
  card.querySelectorAll('.dk-hotel-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id    = btn.dataset.hotelId;
      const hotel = hotels.find(h => String(h.id) === id);
      if (!hotel) return;
      openHotelModal(hotel, () => refreshHotels(card, body));
    });
  });
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
  } else {
    body.innerHTML = renderCarousel(hotels, today);
    initCarouselControls(card, hotels.length);
    wireEditButtons(card, body, hotels);
  }

  /* Wire "+" add button */
  document.getElementById('dk-hotels-add')?.addEventListener('click', () => {
    openHotelModal(null, () => refreshHotels(card, body));
  });
}
