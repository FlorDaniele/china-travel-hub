/* ============================================================
   TRAVEL-STEPS.JS — Daily steps chart (Travel mode only)
   Data source: getStepsData() — swap this function in V2
   to connect Google Fit / Apple Health. The rest stays.
   ============================================================ */

/* ── Hardcoded step data (Jun 5 → Jul 5 2026) ─────────────── */

export function getStepsData() {
  return [
    { date: '2026-06-05', steps: 6200 },
    { date: '2026-06-06', steps: 12800 },
    { date: '2026-06-07', steps: 18400 },
    { date: '2026-06-08', steps: 21200 },
    { date: '2026-06-09', steps: 15600 },
    { date: '2026-06-10', steps: 9800 },
    { date: '2026-06-11', steps: 14300 },
    { date: '2026-06-12', steps: 7600 },
    { date: '2026-06-13', steps: 16900 },
    { date: '2026-06-14', steps: 19700 },
    { date: '2026-06-15', steps: 22000 },
    { date: '2026-06-16', steps: 17500 },
    { date: '2026-06-17', steps: 13200 },
    { date: '2026-06-18', steps: 11400 },
    { date: '2026-06-19', steps: 8900 },
    { date: '2026-06-20', steps: 15800 },
    { date: '2026-06-21', steps: 20100 },
    { date: '2026-06-22', steps: 18600 },
    { date: '2026-06-23', steps: 14700 },
    { date: '2026-06-24', steps: 11900 },
    { date: '2026-06-25', steps: 9300 },
    { date: '2026-06-26', steps: 13500 },
    { date: '2026-06-27', steps: 17800 },
    { date: '2026-06-28', steps: 16400 },
    { date: '2026-06-29', steps: 12100 },
    { date: '2026-06-30', steps: 10600 },
    { date: '2026-07-01', steps: 15200 },
    { date: '2026-07-02', steps: 19000 },
    { date: '2026-07-03', steps: 21800 },
    { date: '2026-07-04', steps: 16300 },
    { date: '2026-07-05', steps: 8400 },
  ];
}

/* ── Date formatter: "Jun 6" ───────────────────────────────── */

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Draw chart ────────────────────────────────────────────── */

function drawChart(canvas, data) {
  const dpr    = window.devicePixelRatio || 1;
  const DAY_W  = 48;
  const PAD_L  = 40;
  const PAD_R  = 16;
  const PAD_T  = 16;
  const PAD_B  = 32;

  const cssW   = PAD_L + data.length * DAY_W + PAD_R;
  const cssH   = canvas.parentElement.clientHeight || 160;

  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width        = cssW * dpr;
  canvas.height       = cssH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const chartW = cssW - PAD_L - PAD_R;
  const chartH = cssH - PAD_T - PAD_B;

  const maxSteps  = 25000;
  const yTicks    = [0, 5000, 10000, 15000, 20000];
  const terracotta = '#ee6146';

  /* Grid lines */
  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth   = 1;
  yTicks.forEach(tick => {
    const y = PAD_T + chartH - (tick / maxSteps) * chartH;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + chartW, y);
    ctx.stroke();
  });

  /* Y-axis labels */
  ctx.fillStyle  = '#6B6B80';
  ctx.font       = '11px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign  = 'right';
  ctx.textBaseline = 'middle';
  yTicks.forEach(tick => {
    const y     = PAD_T + chartH - (tick / maxSteps) * chartH;
    const label = tick === 0 ? '0' : (tick / 1000) + 'k';
    ctx.fillText(label, PAD_L - 6, y);
  });

  /* X-axis labels (every 5 days) */
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  data.forEach((d, i) => {
    if (i % 5 !== 0) return;
    const x = PAD_L + i * DAY_W + DAY_W / 2;
    const y = PAD_T + chartH + 6;
    ctx.fillText(fmtDate(d.date), x, y);
  });

  /* Build point coords */
  const pts = data.map((d, i) => ({
    x: PAD_L + i * DAY_W + DAY_W / 2,
    y: PAD_T + chartH - (d.steps / maxSteps) * chartH,
  }));

  /* Gradient fill */
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
  grad.addColorStop(0,   'rgba(238,97,70,0.20)');
  grad.addColorStop(1,   'rgba(238,97,70,0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, PAD_T + chartH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, PAD_T + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  /* Smooth line using quadratic curves */
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.strokeStyle = terracotta;
  ctx.lineWidth   = 2;
  ctx.stroke();

  return pts;
}

/* ── Tooltip ───────────────────────────────────────────────── */

function attachTooltip(canvas, data, pts) {
  const tooltip = canvas.parentElement.querySelector('.steps-tooltip');
  if (!tooltip) return;

  function onMove(e) {
    const rect   = canvas.getBoundingClientRect();
    const scrollX = canvas.parentElement.scrollLeft;
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const mx = clientX - rect.left + scrollX;

    /* Find the nearest data point */
    let nearest = 0;
    let minDist  = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - mx);
      if (d < minDist) { minDist = d; nearest = i; }
    });

    if (minDist > 32) {
      tooltip.style.opacity = '0';
      return;
    }

    const d   = data[nearest];
    const p   = pts[nearest];
    const dpr = window.devicePixelRatio || 1;

    /* Position relative to scroll container */
    const containerRect = canvas.parentElement.getBoundingClientRect();
    const left = rect.left - containerRect.left + p.x;
    const top  = rect.top  - containerRect.top  + p.y - 40;

    tooltip.style.left    = left + 'px';
    tooltip.style.top     = top  + 'px';
    tooltip.style.opacity = '1';
    tooltip.textContent   = `${fmtDate(d.date)} · ${d.steps.toLocaleString()} steps`;
  }

  function onLeave() { tooltip.style.opacity = '0'; }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
}

/* ── Active dot overlay ────────────────────────────────────── */

function attachDot(canvas, pts, data) {
  const dotEl = canvas.parentElement.querySelector('.steps-dot');
  if (!dotEl) return;

  function onMove(e) {
    const rect   = canvas.getBoundingClientRect();
    const scrollX = canvas.parentElement.scrollLeft;
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const mx = clientX - rect.left + scrollX;

    let nearest = 0;
    let minDist  = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - mx);
      if (d < minDist) { minDist = d; nearest = i; }
    });

    if (minDist > 32) {
      dotEl.style.opacity = '0';
      return;
    }

    const containerRect = canvas.parentElement.getBoundingClientRect();
    const p = pts[nearest];
    const left = rect.left - containerRect.left + p.x - 6;
    const top  = rect.top  - containerRect.top  + p.y - 6;

    dotEl.style.left    = left + 'px';
    dotEl.style.top     = top  + 'px';
    dotEl.style.opacity = '1';
  }

  function onLeave() { dotEl.style.opacity = '0'; }

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
}

/* ── Public init ───────────────────────────────────────────── */

export function initTravelSteps() {
  const canvas = document.getElementById('steps-canvas');
  if (!canvas) return;

  const data = getStepsData();
  const pts  = drawChart(canvas, data);
  attachTooltip(canvas, data, pts);
  attachDot(canvas, pts, data);

  /* Redraw on resize */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const newPts = drawChart(canvas, data);
      attachTooltip(canvas, data, newPts);
      attachDot(canvas, newPts, data);
    }, 150);
  });
}
