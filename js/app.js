/**
 * app.js — Single self-contained script. No ES modules.
 * Works when index.html is opened directly via file:// in any browser.
 *
 * Contains:
 *   - Storage helpers
 *   - City data (CITIES)
 *   - Overview tab: planning header + city grid
 *   - City page overlay: open/close + inner tabs + placeholder content
 *   - Reminders tab: reminder cards + packing list + steps tracker
 *   - App init: tab switching + city card click wiring
 */

(function () {
  'use strict';

  /* ============================================================
     STORAGE HELPERS
     ============================================================ */

  var KEYS = {
    PACKING:   'cth_packing',
    STEPS:     'cth_steps',
  };

  function storageGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* quota exceeded — continue */ }
  }


  /* ============================================================
     ICON HELPER
     Uses window.lucide set by the CDN script in <head>.
     ============================================================ */

  function icon(name, size) {
    size = size || 16;
    if (window.lucide && window.lucide.icons[name]) {
      return window.lucide.icons[name].toSvg({
        width: size,
        height: size,
        'stroke-width': 1.75,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
    }
    return '';
  }


  /* ============================================================
     CITY DATA
     ============================================================ */

  var CITIES = [
    { id: 'beijing',   en: 'Beijing',   zh: '北京', py: 'Běijīng',   dates: 'Jun 6–11',    emoji: '🏯' },
    { id: 'xian',      en: "Xi'an",     zh: '西安', py: "Xī'ān",     dates: 'Jun 11–14',   emoji: '🗿' },
    { id: 'chengdu',   en: 'Chengdu',   zh: '成都', py: 'Chéngdū',   dates: 'Jun 14–19',   emoji: '🐼' },
    { id: 'chongqing', en: 'Chongqing', zh: '重庆', py: 'Chóngqìng', dates: 'Jun 19–22',   emoji: '🌶️' },
    { id: 'shanghai',  en: 'Shanghai',  zh: '上海', py: 'Shànghǎi',  dates: 'Jun 22–Jul 5', emoji: '🌆' },
  ];


  /* ============================================================
     OVERVIEW TAB
     ============================================================ */

  var BOOKINGS = [
    { type: 'Hotels', icon: 'building-2', booked: 2, total: 5 },
    { type: 'Trains', icon: 'train',      booked: 1, total: 4 },
    { type: 'Tours',  icon: 'map-pin',    booked: 0, total: 3 },
  ];

  var URGENT = [
    { title: "Book Xi'an hotel",       due: 'Due Apr 25' },
    { title: 'Book Great Wall tour',   due: 'Due Apr 30' },
    { title: 'Apply for China e-Visa', due: 'Due May 1'  },
  ];

  function getDaysUntil(dateStr) {
    var today  = new Date(); today.setHours(0,0,0,0);
    var target = new Date(dateStr); target.setHours(0,0,0,0);
    return Math.max(0, Math.round((target - today) / 86400000));
  }

  function renderPlanningHeader() {
    var daysLeft = getDaysUntil('2026-06-06');

    var bookingCards = BOOKINGS.map(function (b) {
      var pct = Math.round((b.booked / b.total) * 100);
      return '<div class="booking-card">' +
        '<div class="booking-card__header">' + icon(b.icon, 14) +
          '<span class="booking-card__type">' + b.type + '</span>' +
        '</div>' +
        '<div class="booking-card__fraction">' + b.booked +
          '<span>/' + b.total + '</span>' +
        '</div>' +
        '<div class="progress-bar-track">' +
          '<div class="progress-bar-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var urgentItems = URGENT.map(function (u) {
      return '<div class="urgent-item">' +
        '<span class="urgent-item__title">' + u.title + '</span>' +
        '<span class="urgent-item__due">' + u.due + '</span>' +
      '</div>';
    }).join('');

    return '<div class="planning-header">' +

      '<div class="countdown-card">' +
        '<div class="countdown-card__left">' +
          '<span class="countdown-card__label">Departure in</span>' +
          '<span class="countdown-card__days">' + daysLeft + '</span>' +
          '<span class="countdown-card__sublabel">days to go</span>' +
        '</div>' +
        '<div class="countdown-card__right">' +
          '<span class="countdown-card__date-label">Departs</span>' +
          '<span class="countdown-card__date">Jun 6, 2026</span>' +
          '<div class="countdown-card__icon">' + icon('plane', 32) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="booking-progress-grid">' + bookingCards + '</div>' +

      '<div class="urgent-section">' +
        '<div class="urgent-section__header">' + icon('alert-circle', 16) +
          '<span class="urgent-section__title">Upcoming deadlines</span>' +
        '</div>' +
        urgentItems +
      '</div>' +

    '</div>';
  }

  function renderCityGrid() {
    return CITIES.map(function (city) {
      return '<article class="city-card" role="listitem"' +
        ' data-city-id="' + city.id + '"' +
        ' tabindex="0"' +
        ' aria-label="Open ' + city.en + ' city page">' +
        '<div class="city-card__top">' +
          '<div class="name-block">' +
            '<span class="name-block__en">' + city.emoji + ' ' + city.en + '</span>' +
            '<span class="name-block__zh">' + city.zh + '</span>' +
            '<span class="name-block__py">' + city.py + '</span>' +
          '</div>' +
          '<div class="city-card__arrow">' + icon('chevron-right', 16) + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div class="city-card__dates">' + icon('calendar', 12) + city.dates + '</div>' +
          '<span class="badge badge--upcoming">Upcoming</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function initOverview() {
    var headerEl = document.getElementById('planning-header');
    var gridEl   = document.getElementById('city-grid');
    if (headerEl) headerEl.innerHTML = renderPlanningHeader();
    if (gridEl)   gridEl.innerHTML   = renderCityGrid();
  }


  /* ============================================================
     CITY PAGE OVERLAY
     ============================================================ */

  var _lastFocusedCard = null;
  var _savedScrollY    = 0;

  function buildItinerary() {
    return '<div class="timeline-day">' +
      '<div class="timeline-day__header">Day 1</div>' +
      '<div class="timeline-items">' +
        '<div class="timeline-item">' +
          '<div class="timeline-item__time">09:00</div>' +
          '<div class="timeline-item__title">Arrive &amp; check in</div>' +
          '<div class="timeline-item__note">Drop bags, grab a coffee.</div>' +
        '</div>' +
        '<div class="timeline-item">' +
          '<div class="timeline-item__time">11:00</div>' +
          '<div class="timeline-item__title">Explore city centre</div>' +
          '<div class="timeline-item__note">Walk around the main area.</div>' +
        '</div>' +
        '<div class="timeline-item">' +
          '<div class="timeline-item__time">19:00</div>' +
          '<div class="timeline-item__title">Dinner — local restaurant</div>' +
          '<div class="timeline-item__note">Try the regional speciality.</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="timeline-day">' +
      '<div class="timeline-day__header">Day 2</div>' +
      '<div class="timeline-items">' +
        '<div class="timeline-item">' +
          '<div class="timeline-item__time">08:30</div>' +
          '<div class="timeline-item__title">Main attraction visit</div>' +
          '<div class="timeline-item__note">Book tickets in advance — gets busy.</div>' +
        '</div>' +
        '<div class="timeline-item">' +
          '<div class="timeline-item__time">14:00</div>' +
          '<div class="timeline-item__title">Afternoon wander</div>' +
          '<div class="timeline-item__note">Markets, tea houses, local vibe.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function buildPlaces() {
    var places = [
      { nameEn: 'Main Landmark',   nameZh: '主要景点', namePy: 'Zhǔyào Jǐngdiǎn', category: 'Landmark' },
      { nameEn: 'Local Market',    nameZh: '当地市场', namePy: 'Dāngdì Shìchǎng',  category: 'Market'   },
      { nameEn: 'Historic Temple', nameZh: '历史寺庙', namePy: 'Lìshǐ Sìmiào',     category: 'Temple'   },
    ];
    var items = places.map(function (p, i) {
      return '<div class="place-item">' +
        '<div class="place-item__content">' +
          '<div class="place-item__category">' + p.category + '</div>' +
          '<div class="name-block">' +
            '<span class="name-block__en">' + p.nameEn + '</span>' +
            '<span class="name-block__zh">' + p.nameZh + '</span>' +
            '<span class="name-block__py">' + p.namePy + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="toggle-pill" aria-pressed="false" data-place-index="' + i + '">' +
          icon('check', 12) + ' Not visited' +
        '</button>' +
      '</div>';
    }).join('');
    return '<div class="places-list">' + items + '</div>';
  }

  function buildFood() {
    var dishes = [
      { nameEn: 'Signature Dish 1',  nameZh: '特色菜一', namePy: 'Tèsè cài yī',        emoji: '🥘' },
      { nameEn: 'Street Snack',      nameZh: '街头小吃', namePy: 'Jiētóu Xiǎochī',      emoji: '🍢' },
      { nameEn: 'Local Noodles',     nameZh: '当地面条', namePy: 'Dāngdì Miàntiáo',     emoji: '🍜' },
      { nameEn: 'Traditional Sweet', nameZh: '传统甜点', namePy: 'Chuántǒng Tiándiǎn',  emoji: '🍡' },
    ];
    var items = dishes.map(function (d, i) {
      return '<div class="food-item">' +
        '<div class="food-item__emoji">' + d.emoji + '</div>' +
        '<div class="name-block">' +
          '<span class="name-block__en">' + d.nameEn + '</span>' +
          '<span class="name-block__zh">' + d.nameZh + '</span>' +
          '<span class="name-block__py">' + d.namePy + '</span>' +
        '</div>' +
        '<div class="food-item__footer">' +
          '<button class="toggle-pill" aria-pressed="false" data-food-index="' + i + '">' +
            icon('check', 12) + ' Not tried' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="food-grid">' + items + '</div>';
  }

  function buildTips() {
    return '<div class="tips-section">' +
      '<div class="tips-section__category">Transport</div>' +
      '<div class="tip-item">Use the metro — it\'s cheap, fast, and signs are in English.</div>' +
      '<div class="tip-item">Get a transport card at any station. Much easier than buying tickets each time.</div>' +
    '</div>' +
    '<div class="tips-section">' +
      '<div class="tips-section__category">Culture</div>' +
      '<div class="tip-item">Remove shoes before entering temple interiors.</div>' +
    '</div>' +
    '<div class="tips-section">' +
      '<div class="tips-section__category">Money</div>' +
      '<div class="tip-item">WeChat Pay is everywhere. Cash is a backup, not the norm.</div>' +
    '</div>';
  }

  function switchCityTab(tabId) {
    document.querySelectorAll('.city-tab-btn').forEach(function (btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.city-panel').forEach(function (panel) {
      panel.classList.remove('active');
    });
    var activeBtn   = document.querySelector('[data-city-tab="' + tabId + '"]');
    var activePanel = document.getElementById('city-panel-' + tabId);
    if (activeBtn)   { activeBtn.classList.add('active');   activeBtn.setAttribute('aria-selected', 'true'); }
    if (activePanel) { activePanel.classList.add('active'); }
  }

  function openCityPage(cityId, triggerEl) {
    var city = CITIES.find(function (c) { return c.id === cityId; });
    if (!city) return;

    var page      = document.getElementById('city-page');
    var headerEl  = document.getElementById('city-header-content');
    var backBtn   = document.getElementById('city-back-btn');
    var mainEl    = document.getElementById('app');
    var navEl     = document.getElementById('bottom-nav');

    _lastFocusedCard = triggerEl || null;
    _savedScrollY    = window.scrollY;

    // Lock body scroll (iOS-safe)
    document.body.style.position = 'fixed';
    document.body.style.top      = '-' + _savedScrollY + 'px';
    document.body.style.width    = '100%';

    // Populate header
    headerEl.innerHTML =
      '<div class="city-header__top">' +
        '<div class="name-block">' +
          '<span class="name-block__en">' + city.emoji + ' ' + city.en + '</span>' +
          '<span class="name-block__zh">' + city.zh + '</span>' +
          '<span class="name-block__py">' + city.py + '</span>' +
        '</div>' +
        '<span class="badge badge--upcoming">Upcoming</span>' +
      '</div>' +
      '<div class="city-header__dates">' + icon('calendar', 12) + city.dates + '</div>';

    backBtn.innerHTML = icon('chevron-left', 22);

    // Reset to itinerary tab and populate all panels
    switchCityTab('itinerary');
    document.getElementById('city-panel-itinerary').innerHTML = buildItinerary();
    document.getElementById('city-panel-places').innerHTML    = buildPlaces();
    document.getElementById('city-panel-food').innerHTML      = buildFood();
    document.getElementById('city-panel-tips').innerHTML      = buildTips();

    // Trap focus in overlay (background inert)
    mainEl.inert = true;
    navEl.inert  = true;

    page.removeAttribute('aria-hidden');
    page.classList.add('is-open');
    page.scrollTop = 0;

    backBtn.focus();
  }

  function closeCityPage() {
    var page   = document.getElementById('city-page');
    var mainEl = document.getElementById('app');
    var navEl  = document.getElementById('bottom-nav');

    page.classList.remove('is-open');
    page.setAttribute('aria-hidden', 'true');

    mainEl.inert = false;
    navEl.inert  = false;

    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    window.scrollTo(0, _savedScrollY);

    if (_lastFocusedCard) {
      _lastFocusedCard.focus();
      _lastFocusedCard = null;
    }
  }

  function initCityPage() {
    document.getElementById('city-back-btn').addEventListener('click', closeCityPage);

    document.querySelector('.city-tab-bar').addEventListener('click', function (e) {
      var btn = e.target.closest('.city-tab-btn');
      if (btn) switchCityTab(btn.dataset.cityTab);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('city-page').classList.contains('is-open')) {
        closeCityPage();
      }
    });
  }


  /* ============================================================
     REMINDERS TAB
     ============================================================ */

  var PLACEHOLDER_REMINDERS = [
    { id: 'r1', title: "Book Xi'an hotel",       due: 'Due Apr 25', type: 'task'    },
    { id: 'r2', title: 'Book Great Wall tour',   due: 'Due Apr 30', type: 'booking' },
    { id: 'r3', title: 'Apply for China e-Visa', due: 'Due May 1',  type: 'task'    },
  ];

  var PACKING_CATEGORIES = [
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

  function renderReminders() {
    var el = document.getElementById('pending-reminders');
    if (!el) return;

    var cards = PLACEHOLDER_REMINDERS.map(function (r) {
      return '<div class="reminder-card" role="listitem">' +
        '<div class="reminder-card__left">' +
          '<div class="reminder-card__title">' + r.title + '</div>' +
          '<div class="reminder-card__meta">' +
            '<span class="reminder-card__due">' + r.due + '</span>' +
            '<span class="badge badge--' + r.type + '">' + r.type + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    el.innerHTML =
      '<p class="section-title" style="margin-bottom:12px;">Pending reminders</p>' +
      '<div class="reminder-cards" role="list">' + cards + '</div>';
  }

  function renderPackingList() {
    var el = document.getElementById('packing-list');
    if (!el) return;

    var saved = storageGet(KEYS.PACKING) || {};

    var categories = PACKING_CATEGORIES.map(function (cat) {
      var items = cat.items.map(function (item) {
        var checked = saved[item.id] === true;
        return '<div class="packing-item">' +
          '<input type="checkbox" class="packing-item__checkbox"' +
            ' id="' + item.id + '"' +
            ' data-packing-id="' + item.id + '"' +
            (checked ? ' checked' : '') +
            ' aria-label="' + item.label + '" />' +
          '<label class="packing-item__label" for="' + item.id + '">' + item.label + '</label>' +
        '</div>';
      }).join('');
      return '<div class="packing-category">' +
        '<div class="packing-category__title">' + cat.name + '</div>' +
        '<div class="packing-items">' + items + '</div>' +
      '</div>';
    }).join('');

    el.innerHTML =
      '<div class="divider"></div>' +
      '<p class="section-title" style="margin-bottom:12px;">Packing list</p>' +
      '<div class="packing-section">' + categories + '</div>';

    // Persist checkbox state
    el.addEventListener('change', function (e) {
      var cb = e.target.closest('[data-packing-id]');
      if (!cb) return;
      var current = storageGet(KEYS.PACKING) || {};
      current[cb.dataset.packingId] = cb.checked;
      storageSet(KEYS.PACKING, current);
    });
  }

  function renderStepsTracker() {
    var el = document.getElementById('steps-tracker');
    if (!el) return;

    var today = new Date().toISOString().split('T')[0];

    el.innerHTML =
      '<div class="divider"></div>' +
      '<p class="section-title" style="margin-bottom:12px;">Steps tracker</p>' +
      '<div class="steps-section">' +
        '<div class="steps-card">' +
          '<div class="steps-input-row">' +
            '<div class="steps-field">' +
              '<label class="steps-label" for="steps-date">Date</label>' +
              '<input type="date" id="steps-date" class="steps-input" value="' + today + '" />' +
            '</div>' +
            '<div class="steps-field">' +
              '<label class="steps-label" for="steps-count">Steps</label>' +
              '<input type="number" id="steps-count" class="steps-input" placeholder="0" min="0" />' +
            '</div>' +
            '<div class="steps-field">' +
              '<label class="steps-label" for="steps-km">km</label>' +
              '<input type="number" id="steps-km" class="steps-input" placeholder="0" min="0" step="0.1" />' +
            '</div>' +
          '</div>' +
          '<button type="button" class="steps-log-btn" id="steps-log-btn">Log day</button>' +
          '<div class="steps-totals">' +
            '<div class="steps-total-item">' +
              '<span class="steps-total-value">0</span>' +
              '<span class="steps-total-label">Total steps</span>' +
            '</div>' +
            '<div class="steps-total-item">' +
              '<span class="steps-total-value">0 km</span>' +
              '<span class="steps-total-label">Total distance</span>' +
            '</div>' +
          '</div>' +
          '<p class="steps-total-since">Since Jun 6, 2026</p>' +
        '</div>' +
      '</div>';

    document.getElementById('steps-log-btn').addEventListener('click', function () {
      // Placeholder — Supabase integration in a future session
      console.log('[Skeleton] Steps log placeholder — Supabase pending.');
    });
  }

  function initReminders() {
    renderReminders();
    renderPackingList();
    renderStepsTracker();
  }


  /* ============================================================
     TAB SWITCHING
     ============================================================ */

  function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.remove('active');
    });
    document.querySelectorAll('.nav-tab').forEach(function (btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    var panel = document.getElementById('tab-' + tabId);
    var btn   = document.querySelector('[data-tab="' + tabId + '"]');
    if (panel) panel.classList.add('active');
    if (btn)   { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  }


  /* ============================================================
     BOOT
     ============================================================ */

  document.addEventListener('DOMContentLoaded', function () {

    // Init Lucide icons on static HTML (nav bar <i> elements)
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Render tab content
    initOverview();
    initReminders();
    initCityPage();

    // City card clicks (event delegation on grid)
    document.getElementById('city-grid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-city-id]');
      if (card) openCityPage(card.dataset.cityId, card);
    });

    // Keyboard: Enter/Space on city cards
    document.getElementById('city-grid').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('[data-city-id]');
      if (card) { e.preventDefault(); openCityPage(card.dataset.cityId, card); }
    });

    // Bottom nav tab switching
    document.getElementById('bottom-nav').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (btn) switchTab(btn.dataset.tab);
    });

  });

})();
