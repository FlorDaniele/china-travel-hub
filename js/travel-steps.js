/* ============================================================
   TRAVEL-STEPS.JS — Daily steps + Km walked charts (Travel mode)
   Two separate cards with horizontal scroll, fixed Y axis,
   click-to-jump arrow, and + modal for UPSERT.
   Data source: Supabase `daily_stats` (date, steps, km).
   ============================================================ */

import { supabase } from './supabase.js';
import { openModal, closeModal, showToast } from './modal.js';

/* ── Fallback data: Jun 6–25 only (20 days) ────────────────── */

function getFallbackData() {
  return [
    { date: '2026-06-06', steps: 12800, km: 10.2 },
    { date: '2026-06-07', steps: 18400, km: 14.7 },
    { date: '2026-06-08', steps: 21200, km: 17.0 },
    { date: '2026-06-09', steps: 15600, km: 12.5 },
    { date: '2026-06-10', steps: 9800,  km: 7.8  },
    { date: '2026-06-11', steps: 14300, km: 11.4 },
    { date: '2026-06-12', steps: 7600,  km: 6.1  },
    { date: '2026-06-13', steps: 16900, km: 13.5 },
    { date: '2026-06-14', steps: 19700, km: 15.8 },
    { date: '2026-06-15', steps: 22000, km: 17.6 },
    { date: '2026-06-16', steps: 17500, km: 14.0 },
    { date: '2026-06-17', steps: 13200, km: 10.6 },
    { date: '2026-06-18', steps: null,  km: null },
    { date: '2026-06-19', steps: null,  km: null },
    { date: '2026-06-20', steps: null,  km: null },
    { date: '2026-06-21', steps: null,  km: null },
    { date: '2026-06-22', steps: null,  km: null },
    { date: '2026-06-23', steps: null,  km: null },
    { date: '2026-06-24', steps: null,  km: null },
    { date: '2026-06-25', steps: null,  km: null },
  ];
}

/* ── Load from Supabase (Jun 6–25 window only) ─────────────── */

async function loadDailyStats() {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('date, steps, km')
    .gte('date', '2026-06-06')
    .lte('date', '2026-06-25')
    .order('date', { ascending: true });
  if (error) throw error;

  const rowMap = {};
  (data ?? []).forEach(r => { rowMap[r.date] = r; });

  return getFallbackData().map(d => ({
    date:  d.date,
    steps: d.steps != null ? (rowMap[d.date]?.steps ?? d.steps) : (rowMap[d.date]?.steps ?? null),
    km:    rowMap[d.date]?.km ?? d.km ?? null,
  }));
}

/* ── Demo reference date ───────────────────────────────────── */

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

/* ── Date formatter for tooltip: "Sat, Jun 6" ─────────────── */

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const month   = dt.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} ${d}`;
}

/* ── UPSERT daily stat ─────────────────────────────────────── */

async function upsertDailyStat(date, field, value) {
  const payload = { date, [field]: value };
  const { error } = await supabase
    .from('daily_stats')
    .upsert(payload, { onConflict: 'date' });
  if (error) throw error;
}

/* ── Draw single-metric chart (Y-axis excluded when skipYAxis) */

function drawSingleChart(canvas, data, metric, hexColor, todayStr, cssH, skipYAxis) {
  const dpr = window.devicePixelRatio || 1;

  const PAD_L = skipYAxis ? 0 : 44;
  const PAD_T = 20;
  const PAD_R = 16;
  const PAD_B = 32;

  const N      = data.length;
  const DAY_PX = 56;
  const FIXED_W = N * DAY_PX + (skipYAxis ? 0 : 0);

  canvas.style.width  = FIXED_W + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width        = FIXED_W * dpr;
  canvas.height       = cssH  * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const chartW = FIXED_W - PAD_L - PAD_R;
  const chartH = cssH - PAD_T - PAD_B;
  const DAY_W  = chartW / N;

  const isSteps = metric === 'steps';
  const maxVal  = isSteps ? 25000 : 20;
  const yTicks  = isSteps ? [0, 5000, 10000, 15000, 20000] : [0, 5, 10, 15, 20];

  const BORDER   = '#E8E8E8';
  const TEXT_SEC = '#6B6B80';
  const FONT     = '12px "Plus Jakarta Sans", system-ui, sans-serif';

  /* ── Grid lines ── */
  ctx.strokeStyle = BORDER;
  ctx.lineWidth   = 1;
  yTicks.forEach(tick => {
    const y = PAD_T + chartH - (tick / maxVal) * chartH;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + chartW, y);
    ctx.stroke();
  });

  /* ── Y-axis labels on canvas (only when not using external Y-axis) ── */
  if (!skipYAxis) {
    ctx.fillStyle    = TEXT_SEC;
    ctx.font         = FONT;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    yTicks.forEach(tick => {
      const y     = PAD_T + chartH - (tick / maxVal) * chartH;
      const label = isSteps
        ? (tick === 0 ? '0' : (tick / 1000) + 'k')
        : String(tick);
      ctx.fillText(label, PAD_L - 6, y);
    });
  }

  /* ── X-axis labels ── */
  ctx.fillStyle    = TEXT_SEC;
  ctx.font         = FONT;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  data.forEach((d, i) => {
    const x = PAD_L + i * DAY_W + DAY_W / 2;
    const y = PAD_T + chartH + 6;
    const [, m, day] = d.date.split('-').map(Number);
    const dt = new Date(2026, m - 1, day);
    const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
    ctx.fillText(`${weekday} ${day}`, x, y);
  });

  /* ── Today indicator ── */
  const todayIdx = data.findIndex(d => d.date === todayStr);
  if (todayIdx >= 0) {
    const todayX = PAD_L + todayIdx * DAY_W + DAY_W / 2;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(todayX, PAD_T);
    ctx.lineTo(todayX, PAD_T + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle    = TEXT_SEC;
    ctx.font         = '11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Today', todayX, PAD_T - 2);
  }

  /* ── Point coords ── */
  const pts = data.map((d, i) => ({
    x: PAD_L + i * DAY_W + DAY_W / 2,
    y: d[metric] != null ? PAD_T + chartH - (d[metric] / maxVal) * chartH : null,
  }));

  function hexRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ── Filled area + smooth line ── */
  const validPts = pts.filter(p => p.y != null);
  if (validPts.length >= 2) {
    const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
    grad.addColorStop(0, hexRgba(hexColor, 0.15));
    grad.addColorStop(1, hexRgba(hexColor, 0));

    ctx.beginPath();
    ctx.moveTo(validPts[0].x, PAD_T + chartH);
    validPts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(validPts[validPts.length - 1].x, PAD_T + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(validPts[0].x, validPts[0].y);
    for (let i = 1; i < validPts.length - 1; i++) {
      const mx = (validPts[i].x + validPts[i + 1].x) / 2;
      const my = (validPts[i].y + validPts[i + 1].y) / 2;
      ctx.quadraticCurveTo(validPts[i].x, validPts[i].y, mx, my);
    }
    ctx.lineTo(validPts[validPts.length - 1].x, validPts[validPts.length - 1].y);
    ctx.strokeStyle = hexColor;
    ctx.lineWidth   = 2;
    ctx.stroke();
  }

  /* ── Today dot ── */
  if (todayIdx >= 0 && pts[todayIdx].y != null) {
    ctx.beginPath();
    ctx.arc(pts[todayIdx].x, pts[todayIdx].y, 6, 0, Math.PI * 2);
    ctx.fillStyle = hexColor;
    ctx.fill();
  }

  return { pts, chartH, PAD_T, PAD_B };
}

/* ── Populate external Y-axis div ──────────────────────────── */

function populateYAxis(yaxisEl, metric, cssH, chartH, PAD_T) {
  const isSteps = metric === 'steps';
  const maxVal  = isSteps ? 25000 : 20;
  const yTicks  = isSteps ? [0, 5000, 10000, 15000, 20000] : [0, 5, 10, 15, 20];

  yaxisEl.style.height   = cssH + 'px';
  yaxisEl.style.position = 'relative';
  yaxisEl.innerHTML      = '';

  yTicks.forEach(tick => {
    const y     = PAD_T + chartH - (tick / maxVal) * chartH;
    const label = isSteps
      ? (tick === 0 ? '0' : (tick / 1000) + 'k')
      : String(tick);
    const span = document.createElement('span');
    span.className   = 'dk-yaxis-label';
    span.textContent = label;
    span.style.top   = y + 'px';
    yaxisEl.appendChild(span);
  });
}

/* ── Tooltip ───────────────────────────────────────────────── */

function attachTooltip(canvas, scrollEl, data, pts, metric) {
  const tooltip = scrollEl.querySelector(metric === 'steps' ? '.steps-tooltip' : '.km-tooltip');
  if (!tooltip) return;

  function onMove(e) {
    const rect    = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const mx      = clientX - rect.left;

    let nearest = 0;
    let minDist  = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - mx);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });

    if (minDist > 40 || pts[nearest].y == null) { tooltip.style.opacity = '0'; return; }

    const d   = data[nearest];
    const p   = pts[nearest];
    const containerRect = scrollEl.getBoundingClientRect();
    const left = rect.left - containerRect.left + p.x;
    const top  = rect.top  - containerRect.top  + p.y - 44;

    const val = metric === 'steps'
      ? (d.steps ?? 0).toLocaleString('en-US') + ' steps'
      : (d.km ?? 0) + ' km';

    tooltip.style.left    = left + 'px';
    tooltip.style.top     = top  + 'px';
    tooltip.style.opacity = '1';
    tooltip.textContent   = `${fmtDate(d.date)} · ${val}`;
  }

  function onLeave() { tooltip.style.opacity = '0'; }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
}

/* ── Hover dot overlay ─────────────────────────────────────── */

function attachHoverDot(canvas, scrollEl, pts, dotClass) {
  const dot = scrollEl.querySelector('.' + dotClass);
  if (!dot) return;

  function onMove(e) {
    const rect    = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const mx      = clientX - rect.left;

    let nearest = 0;
    let minDist  = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - mx);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });

    if (minDist > 40 || pts[nearest].y == null) { dot.style.opacity = '0'; return; }

    const containerRect = scrollEl.getBoundingClientRect();
    const p = pts[nearest];
    dot.style.left    = (rect.left - containerRect.left + p.x - 6) + 'px';
    dot.style.top     = (rect.top  - containerRect.top  + p.y - 6) + 'px';
    dot.style.opacity = '1';
  }

  function onLeave() { dot.style.opacity = '0'; }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
}

/* ── SVG chevrons ──────────────────────────────────────────── */

const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
const CHEVRON_LEFT  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;

/* ── Scroll indicators + click-to-jump arrow ───────────────── */

function attachScrollIndicators(scrollEl, card) {
  const fade  = card.querySelector('.dk-scroll-fade');
  const arrow = card.querySelector('.dk-scroll-arrow');
  if (!arrow) return;

  /* Arrow starts as right-pointing */
  arrow.innerHTML = CHEVRON_RIGHT;
  arrow.classList.remove('is-left');

  function atStart() { return scrollEl.scrollLeft <= 2; }
  function atEnd()   { return scrollEl.scrollLeft + scrollEl.clientWidth >= scrollEl.scrollWidth - 2; }

  function update() {
    const end   = atEnd();
    const start = atStart();

    /* Swap direction: show left arrow when at end, right arrow otherwise */
    if (end) {
      arrow.innerHTML = CHEVRON_LEFT;
      arrow.classList.add('is-left');
    } else {
      arrow.innerHTML = CHEVRON_RIGHT;
      arrow.classList.remove('is-left');
    }

    /* Hide arrow only when chart fits without scrolling (nothing to jump to) */
    const noScroll = scrollEl.scrollWidth <= scrollEl.clientWidth + 4;
    arrow.classList.toggle('is-hidden', noScroll);

    if (fade) fade.classList.toggle('is-hidden', end || noScroll);
  }

  arrow.addEventListener('click', () => {
    if (arrow.classList.contains('is-left')) {
      scrollEl.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      scrollEl.scrollTo({ left: scrollEl.scrollWidth, behavior: 'smooth' });
    }
  });

  scrollEl.addEventListener('scroll', update, { passive: true });
  setTimeout(update, 0);
}

/* ── Height sync to calendar card ─────────────────────────── */

function syncHeightWithCalendar(cards) {
  const calCard = document.querySelector('.dk-calendar.dk-card');
  if (!calCard) return;
  const calH = calCard.getBoundingClientRect().height;
  if (calH > 0) {
    cards.forEach(c => {
      if (c) {
        c.style.minHeight = calH + 'px';
        c.style.height    = calH + 'px';
      }
    });
  }
}

/* ── DOM setup: inject Y-axis + chart row wrapper ──────────── */

function setupChartDOM(chartWrap, scrollEl) {
  /* Create Y-axis div */
  const yaxisEl = document.createElement('div');
  yaxisEl.className = 'dk-yaxis';

  /* Create inner wrapper to hold scroll + fade + arrow */
  const innerWrap = document.createElement('div');
  innerWrap.style.cssText = 'position:relative;flex:1;min-width:0;overflow:hidden;';

  /* Create row wrapper */
  const rowEl = document.createElement('div');
  rowEl.className = 'dk-chart-row';

  /* Move scroll el and overlay elements into innerWrap */
  const fade  = chartWrap.querySelector('.dk-scroll-fade');
  const arrow = chartWrap.querySelector('.dk-scroll-arrow');

  innerWrap.appendChild(scrollEl);
  if (fade)  innerWrap.appendChild(fade);
  if (arrow) innerWrap.appendChild(arrow);

  rowEl.appendChild(yaxisEl);
  rowEl.appendChild(innerWrap);
  chartWrap.appendChild(rowEl);

  return yaxisEl;
}

/* ── Render one chart card ─────────────────────────────────── */

function renderChart(canvasId, scrollClass, metric, hexColor, data, todayStr) {
  const canvas   = document.getElementById(canvasId);
  const scrollEl = document.querySelector('.' + scrollClass);
  const card     = scrollEl?.closest('.dk-card');
  if (!canvas || !scrollEl || !card) return null;

  const chartWrap = scrollEl.closest('.dk-chart-wrap') ?? scrollEl.parentElement;

  /* Set up DOM structure with external Y-axis */
  const yaxisEl = setupChartDOM(chartWrap, scrollEl);

  function render() {
    const cssH = chartWrap.clientHeight || 200;
    const result = drawSingleChart(canvas, data, metric, hexColor, todayStr, cssH, true);
    populateYAxis(yaxisEl, metric, cssH, result.chartH, result.PAD_T);
    attachTooltip(canvas, scrollEl, data, result.pts, metric);
    attachHoverDot(canvas, scrollEl, result.pts, metric === 'steps' ? 'steps-dot' : 'km-dot');
    return result;
  }

  setTimeout(render, 0);
  attachScrollIndicators(scrollEl, card);

  return { card, render };
}

/* ── Inline calendar for steps/km modals ──────────────────── */

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const TRIP_START = '2026-06-06';
const TRIP_END   = '2026-06-25';

function buildCalendarHTML(prefix) {
  return `
    <div class="modal-calendar" id="${prefix}-cal" role="group" aria-labelledby="${prefix}-cal-lbl">
      <div class="modal-cal-header">
        <button class="modal-cal-nav" type="button" id="${prefix}-cal-prev" aria-label="Previous month">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="modal-cal-title" id="${prefix}-cal-title" aria-live="polite"></span>
        <button class="modal-cal-nav" type="button" id="${prefix}-cal-next" aria-label="Next month">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="modal-cal-weekdays" aria-hidden="true">
        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
      </div>
      <div class="modal-cal-grid" role="grid" id="${prefix}-cal-grid" aria-label="Select a date"></div>
    </div>
    <input type="hidden" id="${prefix}-date-val">
    <div class="modal-error" id="${prefix}-date-err" role="alert"></div>
  `;
}

function initCalendar(prefix, preselect) {
  let displayYear  = 2026;
  let displayMonth = 5; /* June = index 5 */
  let selectedDate = preselect ?? null;

  function isAllowed(dateStr) {
    return dateStr >= TRIP_START && dateStr <= TRIP_END;
  }

  function renderCalendar() {
    const titleEl = document.getElementById(`${prefix}-cal-title`);
    const gridEl  = document.getElementById(`${prefix}-cal-grid`);
    const hiddenEl = document.getElementById(`${prefix}-date-val`);
    if (!titleEl || !gridEl) return;

    titleEl.textContent = `${MONTH_NAMES[displayMonth]} ${displayYear}`;

    const firstDow    = new Date(displayYear, displayMonth, 1).getDay();
    const startOffset = (firstDow + 6) % 7;
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const prevDays    = new Date(displayYear, displayMonth, 0).getDate();

    let html = '';

    for (let i = 0; i < startOffset; i++) {
      html += `<button class="modal-cal-day modal-cal-day--outside" type="button" aria-hidden="true" tabindex="-1">${prevDays - startOffset + i + 1}</button>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr    = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const allowed    = isAllowed(dateStr);
      const isSel      = dateStr === selectedDate;
      let   cls        = 'modal-cal-day';
      if (isSel)    cls += ' modal-cal-day--selected';
      if (!allowed) cls += ' modal-cal-day--outside';
      const ariaLabel  = `${d} ${MONTH_NAMES[displayMonth]} ${displayYear}${isSel ? ', selected' : ''}`;
      const tabIdx     = allowed ? '0' : '-1';
      html += `<button class="${cls}" type="button" data-date="${dateStr}" aria-label="${ariaLabel}" aria-pressed="${isSel}" tabindex="${tabIdx}" ${!allowed ? 'disabled' : ''}>${d}</button>`;
    }

    const filled    = startOffset + daysInMonth;
    const remaining = (7 - (filled % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += `<button class="modal-cal-day modal-cal-day--outside" type="button" aria-hidden="true" tabindex="-1">${d}</button>`;
    }

    gridEl.innerHTML = html;
    if (hiddenEl) hiddenEl.value = selectedDate ?? '';

    gridEl.querySelectorAll('.modal-cal-day:not(.modal-cal-day--outside):not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDate = btn.dataset.date;
        if (hiddenEl) hiddenEl.value = selectedDate;
        document.getElementById(`${prefix}-date-err`).textContent = '';
        document.getElementById(`${prefix}-cal`)?.classList.remove('has-error');
        renderCalendar();
      });
    });
  }

  document.getElementById(`${prefix}-cal-prev`)?.addEventListener('click', () => {
    displayMonth--;
    if (displayMonth < 0) { displayMonth = 11; displayYear--; }
    renderCalendar();
  });
  document.getElementById(`${prefix}-cal-next`)?.addEventListener('click', () => {
    displayMonth++;
    if (displayMonth > 11) { displayMonth = 0; displayYear++; }
    renderCalendar();
  });

  renderCalendar();

  return {
    getDate: () => selectedDate,
  };
}

/* ── + modal: Steps ────────────────────────────────────────── */

function openStepsModal(today, onSaved) {
  const bodyHTML = `
    <div class="modal-field">
      <label class="modal-label" id="st-cal-lbl">Date</label>
      ${buildCalendarHTML('st')}
    </div>
    <div class="modal-field">
      <label class="modal-label" for="st-steps-val">Steps</label>
      <input type="number" id="st-steps-val" class="modal-input" placeholder="e.g. 12450"
        min="0" max="99999" step="1" inputmode="numeric">
      <div class="modal-counter" id="st-steps-counter" aria-live="polite">0 / 99999</div>
      <div class="modal-error" id="st-steps-err" role="alert"></div>
    </div>
  `;

  openModal({ id: 'st-modal', title: 'Add steps', bodyHTML, onSave: handleStepsSave });

  const cal = initCalendar('st', today);

  const stepsInput   = document.getElementById('st-steps-val');
  const stepsCounter = document.getElementById('st-steps-counter');

  stepsInput?.addEventListener('input', () => {
    const v = stepsInput.value;
    stepsCounter.textContent = `${v || 0} / 99999`;
    document.getElementById('st-steps-err').textContent = '';
  });

  stepsInput?.focus();

  async function handleStepsSave() {
    const dateVal  = cal.getDate();
    const stepsVal = stepsInput?.value;
    let valid = true;

    if (!dateVal) {
      document.getElementById('st-date-err').textContent = 'Please select a date.';
      document.getElementById('st-cal')?.classList.add('has-error');
      valid = false;
    }

    const stepsNum = parseInt(stepsVal, 10);
    if (!stepsVal || isNaN(stepsNum) || stepsNum < 0 || stepsNum > 99999) {
      document.getElementById('st-steps-err').textContent = 'Enter a valid number of steps (0–99999).';
      valid = false;
    }

    if (!valid) return;

    const saveBtn = document.getElementById('st-modal-guardar');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
      await upsertDailyStat(dateVal, 'steps', stepsNum);
      closeModal();
      if (typeof showToast === 'function') showToast('Steps saved');
      await onSaved();
    } catch (err) {
      console.warn('[travel-steps] upsert failed:', err);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      document.getElementById('st-steps-err').textContent = 'Could not save. Please try again.';
    }
  }
}

/* ── + modal: Km ───────────────────────────────────────────── */

function openKmModal(today, onSaved) {
  const bodyHTML = `
    <div class="modal-field">
      <label class="modal-label" id="km2-cal-lbl">Date</label>
      ${buildCalendarHTML('km2')}
    </div>
    <div class="modal-field">
      <label class="modal-label" for="km2-km-val">Km walked</label>
      <input type="number" id="km2-km-val" class="modal-input" placeholder="e.g. 8.5"
        min="0" max="99.9" step="0.1" inputmode="decimal">
      <div class="modal-counter" id="km2-km-counter" aria-live="polite">0 / 99.9</div>
      <div class="modal-error" id="km2-km-err" role="alert"></div>
    </div>
  `;

  openModal({ id: 'km2-modal', title: 'Add km', bodyHTML, onSave: handleKmSave });

  const cal = initCalendar('km2', today);

  const kmInput   = document.getElementById('km2-km-val');
  const kmCounter = document.getElementById('km2-km-counter');

  kmInput?.addEventListener('input', () => {
    const v = kmInput.value;
    kmCounter.textContent = `${v || 0} / 99.9`;
    document.getElementById('km2-km-err').textContent = '';
  });

  kmInput?.focus();

  async function handleKmSave() {
    const dateVal = cal.getDate();
    const kmVal   = kmInput?.value;
    let valid = true;

    if (!dateVal) {
      document.getElementById('km2-date-err').textContent = 'Please select a date.';
      document.getElementById('km2-cal')?.classList.add('has-error');
      valid = false;
    }

    const kmNum = parseFloat(kmVal);
    if (!kmVal || isNaN(kmNum) || kmNum < 0 || kmNum > 99.9) {
      document.getElementById('km2-km-err').textContent = 'Enter a valid distance (0–99.9 km).';
      valid = false;
    }

    if (!valid) return;

    const saveBtn = document.getElementById('km2-modal-guardar');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
      await upsertDailyStat(dateVal, 'km', kmNum);
      closeModal();
      if (typeof showToast === 'function') showToast('Km saved');
      await onSaved();
    } catch (err) {
      console.warn('[travel-steps] km upsert failed:', err);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      document.getElementById('km2-km-err').textContent = 'Could not save. Please try again.';
    }
  }
}

/* ── Public init ───────────────────────────────────────────── */

export async function initTravelSteps() {
  const stepsCanvas = document.getElementById('steps-canvas');
  const kmCanvas    = document.getElementById('km-canvas');
  if (!stepsCanvas && !kmCanvas) return;

  let data;
  let today;
  try {
    [data, today] = await Promise.all([loadDailyStats(), getReferenceDate()]);
  } catch (_) {
    data  = getFallbackData();
    today = new Date().toISOString().split('T')[0];
  }

  /* Reload + redraw both charts after a save */
  async function onSaved() {
    try {
      data = await loadDailyStats();
    } catch (_) {
      data = getFallbackData();
    }
    syncAndRedraw();
  }

  const stepsResult = renderChart('steps-canvas', 'dk-steps-scroll', 'steps', '#ee6146', data, today);
  const kmResult    = renderChart('km-canvas',    'dk-km-scroll',    'km',    '#dfbc5e', data, today);

  function syncAndRedraw() {
    syncHeightWithCalendar([stepsResult?.card, kmResult?.card]);

    if (stepsCanvas) {
      const chartWrap = stepsCanvas.closest('.dk-chart-wrap') ?? stepsCanvas.closest('[style*="relative"]')?.parentElement ?? stepsCanvas.parentElement;
      const cssH = (stepsResult?.card?.querySelector('.dk-chart-wrap') ?? chartWrap)?.clientHeight || 200;
      const sScroll = document.querySelector('.dk-steps-scroll');
      const yaxis   = stepsResult?.card?.querySelector('.dk-yaxis');
      const result  = drawSingleChart(stepsCanvas, data, 'steps', '#ee6146', today, cssH, !!yaxis);
      if (yaxis) populateYAxis(yaxis, 'steps', cssH, result.chartH, result.PAD_T);
      if (sScroll) {
        attachTooltip(stepsCanvas, sScroll, data, result.pts, 'steps');
        attachHoverDot(stepsCanvas, sScroll, result.pts, 'steps-dot');
        /* Trigger scroll listener so arrow updates after canvas has final width */
        sScroll.dispatchEvent(new Event('scroll'));
      }
    }

    if (kmCanvas) {
      const chartWrap = kmCanvas.closest('.dk-chart-wrap') ?? kmCanvas.parentElement;
      const cssH = (kmResult?.card?.querySelector('.dk-chart-wrap') ?? chartWrap)?.clientHeight || 200;
      const kScroll = document.querySelector('.dk-km-scroll');
      const yaxis   = kmResult?.card?.querySelector('.dk-yaxis');
      const result  = drawSingleChart(kmCanvas, data, 'km', '#dfbc5e', today, cssH, !!yaxis);
      if (yaxis) populateYAxis(yaxis, 'km', cssH, result.chartH, result.PAD_T);
      if (kScroll) {
        attachTooltip(kmCanvas, kScroll, data, result.pts, 'km');
        attachHoverDot(kmCanvas, kScroll, result.pts, 'km-dot');
        /* Trigger scroll listener so arrow updates after canvas has final width */
        kScroll.dispatchEvent(new Event('scroll'));
      }
    }
  }

  setTimeout(syncAndRedraw, 0);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncAndRedraw, 150);
  });

  /* Wire up + buttons */
  document.getElementById('dk-steps-add')?.addEventListener('click', () => {
    openStepsModal(today, onSaved);
  });

  document.getElementById('dk-km-add')?.addEventListener('click', () => {
    openKmModal(today, onSaved);
  });
}
