/* ============================================================
   TRAVEL-STEPS.JS — Daily steps + Km walked charts (Travel mode)
   Two separate cards with horizontal scroll.
   Data source: Supabase `daily_stats` (date, steps, km).
   Falls back to hardcoded data if Supabase unavailable.
   ============================================================ */

import { supabase } from './supabase.js';

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
    steps: d.steps != null ? (rowMap[d.date]?.steps ?? d.steps) : null,
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

/* ── Draw a single-metric chart ────────────────────────────── */

function drawSingleChart(canvas, data, metric, hexColor, todayStr) {
  const dpr = window.devicePixelRatio || 1;

  const PAD_L = 44;  /* left: Y-axis labels */
  const PAD_T = 20;  /* top: "Today" label */
  const PAD_R = 16;  /* right */
  const PAD_B = 32;  /* bottom: X-axis labels */

  const N         = data.length;       /* 20 days */
  const DAY_PX    = 56;                /* fixed pixels per day → 1120px total */
  const FIXED_W   = N * DAY_PX;
  const cssH      = canvas.parentElement.clientHeight || 200;

  canvas.style.width  = FIXED_W + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width        = FIXED_W * dpr;
  canvas.height       = cssH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const chartW = FIXED_W - PAD_L - PAD_R;
  const chartH = cssH - PAD_T - PAD_B;
  const DAY_W  = chartW / N;

  const isSteps = metric === 'steps';
  const maxVal  = isSteps ? 25000 : 20;
  const yTicks  = isSteps ? [0, 5000, 10000, 15000, 20000] : [0, 5, 10, 15, 20];

  const BORDER   = '#E8E8E8';
  const TEXT_SEC = '#6B6B80'; /* #6B6B80 on white ≈ 4.6:1 — WCAG AA */
  /* 12px axis labels — sufficient at 56px per column */
  const FONT = '12px "Plus Jakarta Sans", system-ui, sans-serif';

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

  /* ── Y-axis labels (left) ── */
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

  /* ── X-axis labels: "Sa 6", "Su 7" etc., all 20 days ── */
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

  /* ── Build point coords ── */
  const pts = data.map((d, i) => ({
    x: PAD_L + i * DAY_W + DAY_W / 2,
    y: d[metric] != null ? PAD_T + chartH - (d[metric] / maxVal) * chartH : null,
  }));

  /* ── Helper: hex → rgba ── */
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

  /* ── Today active dot ── */
  if (todayIdx >= 0 && pts[todayIdx].y != null) {
    ctx.beginPath();
    ctx.arc(pts[todayIdx].x, pts[todayIdx].y, 6, 0, Math.PI * 2);
    ctx.fillStyle = hexColor;
    ctx.fill();
  }

  return pts;
}

/* ── Tooltip ───────────────────────────────────────────────── */

function attachTooltip(canvas, scrollEl, data, pts, metric, unitLabel) {
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

/* ── Scroll indicators ─────────────────────────────────────── */

function attachScrollIndicators(scrollEl, card) {
  const fade  = card.querySelector('.dk-scroll-fade');
  const arrow = card.querySelector('.dk-scroll-arrow');
  if (!fade && !arrow) return;

  function update() {
    const atEnd = scrollEl.scrollLeft + scrollEl.clientWidth >= scrollEl.scrollWidth - 2;
    if (fade)  fade.classList.toggle('is-hidden', atEnd);
    if (arrow) arrow.classList.toggle('is-hidden', atEnd);
  }

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

/* ── Render one chart card ─────────────────────────────────── */

function renderChart(canvasId, scrollClass, metric, hexColor, data, todayStr) {
  const canvas    = document.getElementById(canvasId);
  const scrollEl  = document.querySelector('.' + scrollClass);
  const card      = scrollEl?.closest('.dk-card');
  if (!canvas || !scrollEl || !card) return;

  function render() {
    const pts = drawSingleChart(canvas, data, metric, hexColor, todayStr);
    attachTooltip(canvas, scrollEl, data, pts, metric);
    attachHoverDot(canvas, scrollEl, pts, metric === 'steps' ? 'steps-dot' : 'km-dot');
  }

  setTimeout(render, 0);
  attachScrollIndicators(scrollEl, card);

  return card;
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

  const stepsCard = renderChart('steps-canvas', 'dk-steps-scroll', 'steps', '#ee6146', data, today);
  const kmCard    = renderChart('km-canvas',    'dk-km-scroll',    'km',    '#dfbc5e', data, today);

  function syncAndRedraw() {
    syncHeightWithCalendar([stepsCard, kmCard]);
    /* Redraw after height change so canvas fills correctly */
    if (stepsCanvas) {
      const pts = drawSingleChart(stepsCanvas, data, 'steps', '#ee6146', today);
      const sScroll = document.querySelector('.dk-steps-scroll');
      if (sScroll) {
        attachTooltip(stepsCanvas, sScroll, data, pts, 'steps');
        attachHoverDot(stepsCanvas, sScroll, pts, 'steps-dot');
      }
    }
    if (kmCanvas) {
      const pts = drawSingleChart(kmCanvas, data, 'km', '#dfbc5e', today);
      const kScroll = document.querySelector('.dk-km-scroll');
      if (kScroll) {
        attachTooltip(kmCanvas, kScroll, data, pts, 'km');
        attachHoverDot(kmCanvas, kScroll, pts, 'km-dot');
      }
    }
  }

  setTimeout(syncAndRedraw, 0);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncAndRedraw, 150);
  });
}
