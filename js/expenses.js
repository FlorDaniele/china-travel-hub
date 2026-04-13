/**
 * expenses.js — Renders the Expenses tab: summary card + form interactions.
 * No Supabase in this skeleton — form submit is a no-op placeholder.
 */

// ── Icon helper ───────────────────────────────────────────────

function icon(name, opts = {}) {
  if (window.lucide && window.lucide.icons[name]) {
    return window.lucide.icons[name].toSvg({
      'stroke-width': 1.75,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      ...opts,
    });
  }
  return '';
}

// ── Summary card ──────────────────────────────────────────────

function renderSummary() {
  const el = document.getElementById('expenses-summary');
  if (!el) return;

  // Static donut SVG — two circles: grey track + accent arc.
  // Circumference of r=28 circle ≈ 175.9. At 0% fill we show full grey.
  const donutSvg = `
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="28" stroke="#D1D1F9" stroke-width="8" fill="none"/>
      <circle
        cx="36" cy="36" r="28"
        stroke="#4F3FA6" stroke-width="8" fill="none"
        stroke-linecap="round"
        stroke-dasharray="175.9"
        stroke-dashoffset="175.9"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" text-anchor="middle"
            font-family="Plus Jakarta Sans, sans-serif"
            font-size="11" font-weight="700" fill="#6B6B80">
        ¥0
      </text>
    </svg>
  `;

  el.innerHTML = `
    <div class="expenses-summary-card">
      <div class="expenses-summary__totals">
        <div class="expenses-summary__main">¥0 CNY</div>
        <div class="expenses-summary__sub">$0 USD</div>
        <div class="expenses-summary__stats">
          <div class="stat-pill">
            <span class="stat-pill__value">0</span>
            <span class="stat-pill__label">Days</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill__value">—</span>
            <span class="stat-pill__label">Avg/day</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill__value">0</span>
            <span class="stat-pill__label">Items</span>
          </div>
        </div>
      </div>
      <div class="donut-placeholder">${donutSvg}</div>
    </div>
  `;
}

// ── Currency toggle ───────────────────────────────────────────

function initCurrencyToggle() {
  const container = document.querySelector('.currency-toggle');
  if (!container) return;

  container.addEventListener('click', e => {
    const btn = e.target.closest('.currency-btn');
    if (!btn) return;

    container.querySelectorAll('.currency-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });

    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  });
}

// ── Category pill toggle ──────────────────────────────────────

function initCategoryPills() {
  const container = document.querySelector('.category-pills');
  if (!container) return;

  container.addEventListener('click', e => {
    const pill = e.target.closest('.category-pill');
    if (!pill) return;

    container.querySelectorAll('.category-pill').forEach(p => {
      p.classList.remove('active');
    });

    pill.classList.add('active');
  });
}

// ── Form submit (skeleton no-op) ──────────────────────────────

function initForm() {
  const form = document.getElementById('add-expense-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    // Placeholder: no data saving in skeleton phase
    console.log('[Skeleton] Expense form submitted — Supabase integration pending.');
  });

  // Set today's date as the default date value
  const dateInput = document.getElementById('expense-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

// ── Public init ───────────────────────────────────────────────

export function initExpenses() {
  renderSummary();
  initCurrencyToggle();
  initCategoryPills();
  initForm();
}
