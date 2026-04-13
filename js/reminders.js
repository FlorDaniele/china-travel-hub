/**
 * reminders.js — Renders the Reminders tab:
 *   - Pending reminder cards
 *   - Packing list with checkbox persistence via storage.js
 *   - Steps tracker (inputs only, no calculations yet)
 */

import { getItem, setItem, KEYS } from './storage.js';

// ── Placeholder data ──────────────────────────────────────────

const PLACEHOLDER_REMINDERS = [
  { id: 'r1', title: 'Book Xi\'an hotel',       due: 'Due Apr 25', type: 'task'    },
  { id: 'r2', title: 'Book Great Wall tour',    due: 'Due Apr 30', type: 'booking' },
  { id: 'r3', title: 'Apply for China e-Visa',  due: 'Due May 1',  type: 'task'    },
];

const PACKING_CATEGORIES = [
  {
    name: 'Documents',
    items: [
      { id: 'p-doc-1', label: 'Passport' },
      { id: 'p-doc-2', label: 'Visa printout' },
      { id: 'p-doc-3', label: 'Travel insurance certificate' },
    ],
  },
  {
    name: 'Clothing',
    items: [
      { id: 'p-clo-1', label: 'Light layers (linen/cotton)' },
      { id: 'p-clo-2', label: 'Rain jacket' },
      { id: 'p-clo-3', label: 'Comfortable walking shoes' },
    ],
  },
  {
    name: 'Tech',
    items: [
      { id: 'p-tec-1', label: 'Power bank (10,000+ mAh)' },
      { id: 'p-tec-2', label: 'Universal adapter (Type A/C)' },
      { id: 'p-tec-3', label: 'VPN installed on phone' },
    ],
  },
  {
    name: 'Health',
    items: [
      { id: 'p-hea-1', label: 'Prescription medications' },
      { id: 'p-hea-2', label: 'Sunscreen SPF 50' },
      { id: 'p-hea-3', label: 'Electrolyte packets' },
    ],
  },
];

// ── Render: reminder cards ────────────────────────────────────

function renderReminders() {
  const el = document.getElementById('pending-reminders');
  if (!el) return;

  const cards = PLACEHOLDER_REMINDERS.map(r => `
    <div class="reminder-card" role="listitem">
      <div class="reminder-card__left">
        <div class="reminder-card__title">${r.title}</div>
        <div class="reminder-card__meta">
          <span class="reminder-card__due">${r.due}</span>
          <span class="badge badge--${r.type}">${r.type}</span>
        </div>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <p class="section-title" style="margin-bottom:12px;">Pending reminders</p>
    <div class="reminder-cards" role="list">
      ${cards}
    </div>
  `;
}

// ── Render: packing list ──────────────────────────────────────

function renderPackingList() {
  const el = document.getElementById('packing-list');
  if (!el) return;

  // Load persisted checkbox state from localStorage
  const saved = getItem(KEYS.PACKING) || {};

  const categories = PACKING_CATEGORIES.map(cat => {
    const items = cat.items.map(item => {
      const checked = saved[item.id] === true;
      return `
        <div class="packing-item">
          <input
            type="checkbox"
            class="packing-item__checkbox"
            id="${item.id}"
            data-packing-id="${item.id}"
            ${checked ? 'checked' : ''}
            aria-label="${item.label}"
          />
          <label class="packing-item__label" for="${item.id}">${item.label}</label>
        </div>
      `;
    }).join('');

    return `
      <div class="packing-category">
        <div class="packing-category__title">${cat.name}</div>
        <div class="packing-items">${items}</div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="divider"></div>
    <p class="section-title" style="margin-bottom:12px;">Packing list</p>
    <div class="packing-section">${categories}</div>
  `;

  // Wire checkbox persistence
  el.addEventListener('change', e => {
    const cb = e.target.closest('[data-packing-id]');
    if (!cb) return;
    const current = getItem(KEYS.PACKING) || {};
    current[cb.dataset.packingId] = cb.checked;
    setItem(KEYS.PACKING, current);
  });
}

// ── Render: steps tracker ─────────────────────────────────────

function renderStepsTracker() {
  const el = document.getElementById('steps-tracker');
  if (!el) return;

  el.innerHTML = `
    <div class="divider"></div>
    <p class="section-title" style="margin-bottom:12px;">Steps tracker</p>
    <div class="steps-section">
      <div class="steps-card">
        <div class="steps-input-row">
          <div class="steps-field">
            <label class="steps-label" for="steps-date">Date</label>
            <input
              type="date"
              id="steps-date"
              class="steps-input"
              value="${new Date().toISOString().split('T')[0]}"
            />
          </div>
          <div class="steps-field">
            <label class="steps-label" for="steps-count">Steps</label>
            <input
              type="number"
              id="steps-count"
              class="steps-input"
              placeholder="0"
              min="0"
            />
          </div>
          <div class="steps-field">
            <label class="steps-label" for="steps-km">km</label>
            <input
              type="number"
              id="steps-km"
              class="steps-input"
              placeholder="0"
              min="0"
              step="0.1"
            />
          </div>
        </div>

        <button type="button" class="steps-log-btn" id="steps-log-btn">
          Log day
        </button>

        <div class="steps-totals">
          <div class="steps-total-item">
            <span class="steps-total-value">0</span>
            <span class="steps-total-label">Total steps</span>
          </div>
          <div class="steps-total-item">
            <span class="steps-total-value">0 km</span>
            <span class="steps-total-label">Total distance</span>
          </div>
        </div>
        <p class="steps-total-since">Since Jun 6, 2026</p>
      </div>
    </div>
  `;

  // Log button — placeholder in skeleton
  document.getElementById('steps-log-btn').addEventListener('click', () => {
    console.log('[Skeleton] Steps logged — Supabase integration pending.');
  });
}

// ── Public init ───────────────────────────────────────────────

export function initReminders() {
  renderReminders();
  renderPackingList();
  renderStepsTracker();
}
