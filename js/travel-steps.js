/* ============================================================
   TRAVEL-STEPS.JS — Daily steps chart (Travel mode only)
   Data source: Supabase `daily_stats` table (date, steps, km).
   Falls back to hardcoded steps data if Supabase unavailable.
   ============================================================ */

import { supabase } from './supabase.js';

/* ── Fallback step data (Jun 6 → Jul 5 2026, km null) ──────── */

function getFallbackData() {
  return [
    /* Jun 6–17: realistic placeholder data (4000–22000 steps) */
    { date: '2026-06-06', steps: 12800, km: null },
    { date: '2026-06-07', steps: 18400, km: null },
    { date: '2026-06-08', steps: 21200, km: null },
    { date: '2026-06-09', steps: 15600, km: null },
    { date: '2026-06-10', steps: 9800,  km: null },
    { date: '2026-06-11', steps: 14300, km: null },
    { date: '2026-06-12', steps: 7600,  km: null },
    { date: '2026-06-13', steps: 16900, km: null },
    { date: '2026-06-14', steps: 19700, km: null },
    { date: '2026-06-15', steps: 22000, km: null },
    { date: '2026-06-16', steps: 17500, km: null },
    { date: '2026-06-17', steps: 13200, km: null },
    /* Jun 18–Jul 5: no data yet — line stops at Jun 17 */
    { date: '2026-06-18', steps: null,  km: null },
    { date: '2026-06-19', steps: null,  km: null },
    { date: '2026-06-20', steps: null,  km: null },
    { date: '2026-06-21', steps: null,  km: null },
    { date: '2026-06-22', steps: null,  km: null },
    { date: '2026-06-23', steps: null,  km: null },
    { date: '2026-06-24', steps: null,  km: null },
    { date: '2026-06-25', steps: null,  km: null },
    { date: '2026-06-26', steps: null,  km: null },
    { date: '2026-06-27', steps: null,  km: null },
    { date: '2026-06-28', steps: null,  km: null },
    { date: '2026-06-29', steps: null,  km: null },
    { date: '2026-06-30', steps: null,  km: null },
    { date: '2026-07-01', steps: null,  km: null },
    { date: '2026-07-02', steps: null,  km: null },
    { date: '2026-07-03', steps: null,  km: null },
    { date: '2026-07-04', steps: null,  km: null },
    { date: '2026-07-05', steps: null,  km: null },
  ];
}

/* ── Load from Supabase ────────────────────────────────────── */

async function loadDailyStats() {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('date, steps, km')
    .order('date', { ascending: true });
  if (error) throw error;

  // Merge Supabase rows into the full 30-day fallback skeleton.
  // Dates where the fallback says null (Jun 18+) stay null — Supabase rows
  // for future dates don't override, keeping the "no data yet" visual intent.
  const rowMap = {};
  (data ?? []).forEach(r => { rowMap[r.date] = r; });

  return getFallbackData().map(d => ({
    date:  d.date,
    steps: d.steps != null ? (rowMap[d.date]?.steps ?? d.steps) : null,
    km:    d.steps != null ? (rowMap[d.date]?.km    ?? null)     : null,
  }));
}

/* ── Get demo reference date ──────────────────────────────── */

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

/* ── Date formatter: "Sat, Jun 6" ─────────────────────────── */

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const month   = dt.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} ${d}`;
}

/* ── Legend ────────────────────────────────────────────────── */

function renderLegend(legendEl, showKm) {
  legendEl.innerHTML = `
    <span class="dk-steps-legend-item">
      <span class="dk-steps-legend-dot" style="background:#ee6146"></span>
      Steps
    </span>
    ${showKm ? `
    <span class="dk-steps-legend-item">
      <span class="dk-steps-legend-dot" style="background:#dfbc5e"></span>
      Km walked
    </span>` : ''}
  `;
}

/* ── Draw chart ────────────────────────────────────────────── */

function drawChart(canvas, data, todayStr) {
  const dpr  = window.devicePixelRatio || 1;

  const PAD_L  = 40;   // left: steps Y-axis labels
  const PAD_T  = 20;
  const PAD_B  = 32;

  const hasKm   = data.some(d => d.km != null);
  const PAD_R   = hasKm ? 40 : 16;  // right: km Y-axis labels if shown

  // Measure container width
  const container = canvas.parentElement;
  const cssW = container.clientWidth || 800;
  const cssH = container.clientHeight || 180;

  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width        = cssW * dpr;
  canvas.height       = cssH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const chartW  = cssW - PAD_L - PAD_R;
  const chartH  = cssH - PAD_T - PAD_B;
  const DAY_W   = chartW / data.length;

  const maxSteps  = 25000;
  const yTicksSteps = [0, 5000, 10000, 15000, 20000];
  const maxKm       = 20;
  const yTicksKm    = [0, 5, 10, 15, 20];
  const TERRACOTTA  = '#ee6146';
  const WARM_GOLD   = '#dfbc5e';
  const BORDER      = '#E8E8E8';
  const TEXT_SEC    = '#6B6B80'; /* #6B6B80 on white = ~4.6:1 — passes WCAG AA */
  /* 11px: minimum allowed exception for chart axis labels under space constraint (30 labels across full width) */
  const FONT        = '11px "Plus Jakarta Sans", system-ui, sans-serif';

  /* ── Grid lines (from steps ticks) ── */
  ctx.strokeStyle = BORDER;
  ctx.lineWidth   = 1;
  yTicksSteps.forEach(tick => {
    const y = PAD_T + chartH - (tick / maxSteps) * chartH;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + chartW, y);
    ctx.stroke();
  });

  /* ── Left Y-axis labels (steps) ── */
  ctx.fillStyle    = TEXT_SEC;
  ctx.font         = FONT;
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  yTicksSteps.forEach(tick => {
    const y     = PAD_T + chartH - (tick / maxSteps) * chartH;
    const label = tick === 0 ? '0' : (tick / 1000) + 'k';
    ctx.fillText(label, PAD_L - 6, y);
  });

  /* ── Right Y-axis labels (km) ── */
  if (hasKm) {
    ctx.textAlign = 'left';
    yTicksKm.forEach(tick => {
      const y     = PAD_T + chartH - (tick / maxKm) * chartH;
      const label = String(tick);
      ctx.fillText(label, PAD_L + chartW + 6, y);
    });
  }

  /* ── X-axis labels (all 30 days — "Sa 6", "Su 7" format) ── */
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

    // Dashed vertical line
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

    // "Today" label above line
    ctx.fillStyle    = TEXT_SEC;
    ctx.font         = '11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Today', todayX, PAD_T - 2);
  }

  /* ── Build point coords — null steps produce null y (no point plotted) ── */
  const ptsSteps = data.map((d, i) => ({
    x: PAD_L + i * DAY_W + DAY_W / 2,
    y: d.steps != null ? PAD_T + chartH - (d.steps / maxSteps) * chartH : null,
  }));

  const ptsKm = hasKm ? data.map((d, i) => ({
    x: PAD_L + i * DAY_W + DAY_W / 2,
    y: d.km != null
      ? PAD_T + chartH - (d.km / maxKm) * chartH
      : null,
  })) : null;

  /* ── Helper: hex color → rgba string ── */
  function hexRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ── Helper: draw smooth filled area + line ── */
  function drawLine(pts, hexColor) {
    // Filter to only non-null points (km may have gaps)
    const validPts = pts.filter(p => p.y != null);
    if (validPts.length < 2) return;

    // Gradient fill (0.20 opacity at top → 0 at bottom)
    const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
    grad.addColorStop(0, hexRgba(hexColor, 0.20));
    grad.addColorStop(1, hexRgba(hexColor, 0));

    // Fill path
    ctx.beginPath();
    ctx.moveTo(validPts[0].x, PAD_T + chartH);
    validPts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(validPts[validPts.length - 1].x, PAD_T + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Smooth line
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

  // Draw km line first (behind steps)
  if (hasKm && ptsKm) {
    drawLine(ptsKm, WARM_GOLD);
  }
  // Draw steps line on top
  drawLine(ptsSteps, TERRACOTTA);

  /* ── Today active dots ── */
  if (todayIdx >= 0) {
    const sp = ptsSteps[todayIdx];
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = TERRACOTTA;
    ctx.fill();

    if (hasKm && ptsKm && ptsKm[todayIdx].y != null) {
      const kp = ptsKm[todayIdx];
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = WARM_GOLD;
      ctx.fill();
    }
  }

  return { ptsSteps, ptsKm, DAY_W };
}

/* ── Tooltip ───────────────────────────────────────────────── */

function attachTooltip(canvas, data, ptsSteps, ptsKm) {
  const tooltip = canvas.parentElement.querySelector('.steps-tooltip');
  if (!tooltip) return;

  function onMove(e) {
    const rect    = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const mx      = clientX - rect.left;

    let nearest = 0;
    let minDist  = Infinity;
    ptsSteps.forEach((p, i) => {
      const dist = Math.abs(p.x - mx);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });

    if (minDist > 40) { tooltip.style.opacity = '0'; return; }

    const d   = data[nearest];
    const p   = ptsSteps[nearest];
    const containerRect = canvas.parentElement.getBoundingClientRect();
    const left = rect.left - containerRect.left + p.x;
    const top  = rect.top  - containerRect.top  + p.y - 44;

    const stepsLabel = (d.steps ?? 0).toLocaleString('en-US') + ' steps';
    const kmLabel    = d.km != null ? ` · ${d.km} km` : '';

    tooltip.style.left    = left + 'px';
    tooltip.style.top     = top  + 'px';
    tooltip.style.opacity = '1';
    tooltip.textContent   = `${fmtDate(d.date)} · ${stepsLabel}${kmLabel}`;
  }

  function onLeave() { tooltip.style.opacity = '0'; }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
}

/* ── Hover dots overlay ────────────────────────────────────── */

function attachHoverDots(canvas, ptsSteps, ptsKm) {
  const dotSteps = canvas.parentElement.querySelector('.steps-dot');
  const dotKm    = canvas.parentElement.querySelector('.steps-dot-km');

  function onMove(e) {
    const rect    = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const mx      = clientX - rect.left;

    let nearest = 0;
    let minDist  = Infinity;
    ptsSteps.forEach((p, i) => {
      const dist = Math.abs(p.x - mx);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });

    if (minDist > 40) {
      if (dotSteps) dotSteps.style.opacity = '0';
      if (dotKm)    dotKm.style.opacity    = '0';
      return;
    }

    const containerRect = canvas.parentElement.getBoundingClientRect();
    const sp = ptsSteps[nearest];
    if (dotSteps) {
      dotSteps.style.left    = (rect.left - containerRect.left + sp.x - 6) + 'px';
      dotSteps.style.top     = (rect.top  - containerRect.top  + sp.y - 6) + 'px';
      dotSteps.style.opacity = '1';
    }

    if (dotKm && ptsKm && ptsKm[nearest]?.y != null) {
      const kp = ptsKm[nearest];
      dotKm.style.left    = (rect.left - containerRect.left + kp.x - 6) + 'px';
      dotKm.style.top     = (rect.top  - containerRect.top  + kp.y - 6) + 'px';
      dotKm.style.opacity = '1';
    } else if (dotKm) {
      dotKm.style.opacity = '0';
    }
  }

  function onLeave() {
    if (dotSteps) dotSteps.style.opacity = '0';
    if (dotKm)    dotKm.style.opacity    = '0';
  }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
}

/* ── Public init ───────────────────────────────────────────── */

export async function initTravelSteps() {
  const canvas = document.getElementById('steps-canvas');
  if (!canvas) return;

  const legendEl = document.getElementById('dk-steps-legend');

  // Load data + today reference in parallel
  let data;
  let today;
  try {
    [data, today] = await Promise.all([
      loadDailyStats(),
      getReferenceDate(),
    ]);
  } catch (_) {
    data  = getFallbackData();
    today = new Date().toISOString().split('T')[0];
  }

  const hasKm = data.some(d => d.km != null);

  // Render legend
  if (legendEl) renderLegend(legendEl, hasKm);

  function render() {
    const { ptsSteps, ptsKm } = drawChart(canvas, data, today);
    attachTooltip(canvas, data, ptsSteps, ptsKm);
    attachHoverDots(canvas, ptsSteps, ptsKm);
  }

  // Defer first draw until element has layout
  requestAnimationFrame(() => {
    render();
  });

  // Sync steps card height to match calendar card
  function syncHeightWithCalendar() {
    const stepsCard = document.querySelector('.dk-steps.dk-card');
    const calCard   = document.querySelector('.dk-calendar.dk-card');
    if (!stepsCard || !calCard) return;
    const calH = calCard.getBoundingClientRect().height;
    if (calH > 0) {
      stepsCard.style.minHeight = calH + 'px';
      stepsCard.style.height    = calH + 'px';
    }
  }

  // First sync after initial render, then on every resize
  requestAnimationFrame(syncHeightWithCalendar);

  // Redraw on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { render(); syncHeightWithCalendar(); }, 150);
  });
}
