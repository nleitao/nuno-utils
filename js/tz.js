// Time zone planner: side-by-side 24h strips, aligned on the same instant.
'use strict';

const TZ = (() => {
  const HOUR = 3600000;
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Friendly city names that don't match the IANA id, so search finds them.
  const ALIASES = {
    'Asia/Kolkata': 'India, Mumbai, Delhi, Bangalore, Bengaluru, Chennai, Hyderabad, IST',
    'Europe/London': 'UK, United Kingdom, England, Britain, GMT, BST',
    'Europe/Lisbon': 'Portugal, Porto, WET',
    'America/New_York': 'USA, US East, Eastern, Boston, Washington, Miami, EST, EDT',
    'America/Chicago': 'US Central, Dallas, Houston, CST',
    'America/Denver': 'US Mountain, MST',
    'America/Los_Angeles': 'US West, Pacific, San Francisco, Seattle, PST, PDT',
    'Europe/Paris': 'France, CET',
    'Europe/Berlin': 'Germany, Munich, Frankfurt',
    'Europe/Madrid': 'Spain, Barcelona',
    'Europe/Amsterdam': 'Netherlands, Holland',
    'Europe/Zurich': 'Switzerland, Geneva',
    'Asia/Dubai': 'UAE, Emirates, Abu Dhabi',
    'Asia/Singapore': 'SG, SGT',
    'Asia/Tokyo': 'Japan, JST',
    'Asia/Shanghai': 'China, Beijing, Shenzhen, CST',
    'Asia/Hong_Kong': 'HK',
    'Australia/Sydney': 'Australia, AEST',
    'America/Sao_Paulo': 'Brazil, Rio, BRT',
    'Asia/Karachi': 'Pakistan',
    'Asia/Dhaka': 'Bangladesh',
    'Asia/Kathmandu': 'Nepal',
    'Africa/Johannesburg': 'South Africa, Cape Town',
    'Africa/Lagos': 'Nigeria',
    'Asia/Riyadh': 'Saudi Arabia',
    'America/Toronto': 'Canada',
    'America/Mexico_City': 'Mexico',
    'UTC': 'Coordinated Universal Time, GMT, Zulu',
  };

  let zones = store.get('tz.zones', null);
  if (!Array.isArray(zones) || !zones.length) {
    zones = [...new Set([localZone, 'Europe/London', 'Asia/Kolkata', 'America/New_York'])];
  }
  let home = store.get('tz.home', zones[0]);
  if (!zones.includes(home)) home = zones[0];

  let dateStr = null; // YYYY-MM-DD in home zone; null = today
  let minutes = 0; // minutes since home-zone midnight

  const fmtCache = new Map();
  function partsFmt(tz) {
    if (!fmtCache.has(tz)) {
      fmtCache.set(tz, new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }));
    }
    return fmtCache.get(tz);
  }

  function wall(tz, ms) {
    const p = {};
    for (const { type, value } of partsFmt(tz).formatToParts(ms)) p[type] = value;
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute };
  }

  // Offset in minutes from UTC for tz at instant ms.
  function offset(tz, ms) {
    const w = wall(tz, ms);
    return Math.round((Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Math.floor(ms / 60000) * 60000) / 60000);
  }

  // UTC ms of midnight for a calendar date in tz.
  function midnight(tz, y, mo, d) {
    const guess = Date.UTC(y, mo - 1, d);
    let t = guess - offset(tz, guess) * 60000;
    t = guess - offset(tz, t) * 60000; // second pass handles DST edge
    return t;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const fmtOffset = (m) => {
    const s = m < 0 ? '-' : '+';
    const a = Math.abs(m);
    return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`;
  };
  const city = (tz) => (tz === 'UTC' ? 'UTC' : tz.split('/').pop().replace(/_/g, ' '));
  const region = (tz) => (tz.includes('/') ? tz.split('/')[0].replace(/_/g, ' ') : '');

  const dayFmt = new Map();
  function dayLabel(tz, ms) {
    if (!dayFmt.has(tz)) dayFmt.set(tz, new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }));
    return dayFmt.get(tz).format(ms);
  }
  const shortDay = new Map();
  function shortDayLabel(tz, ms) {
    if (!shortDay.has(tz)) shortDay.set(tz, new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }));
    return shortDay.get(tz).format(ms);
  }

  function todayInHome() {
    const w = wall(home, Date.now());
    return `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
  }

  function baseMs() {
    const [y, mo, d] = (dateStr || todayInHome()).split('-').map(Number);
    return midnight(home, y, mo, d);
  }

  const els = {};

  function save() { store.set('tz.zones', zones); store.set('tz.home', home); }

  function setNow() {
    dateStr = null;
    const w = wall(home, Date.now());
    minutes = w.h * 60 + Math.floor(w.mi / 15) * 15;
    els.date.value = todayInHome();
    render();
    scrollToCursor('smooth');
  }

  function cellClass(h) {
    if (h >= 9 && h < 18) return 'work';
    if (h < 7 || h >= 22) return 'night';
    return '';
  }

  function render() {
    const base = baseMs();
    const sel = base + minutes * 60000;
    const selHour = Math.floor(minutes / 60);
    const boardW = els.board.clientWidth || 320;
    els.board.style.setProperty('--head-w', boardW + 'px');

    const rows = zones.map((tz) => {
      const off = offset(tz, sel);
      const w = wall(tz, sel);
      let cells = '';
      for (let i = 0; i < 24; i++) {
        const t = base + i * HOUR;
        const cw = wall(tz, t);
        const isMidnight = cw.h === 0;
        const cls = ['tz-cell', cellClass(cw.h), isMidnight ? 'midnight' : '', i === selHour ? 'sel' : ''].join(' ');
        const sub = isMidnight ? `<span class="d">${shortDayLabel(tz, t)}</span>` : (cw.mi ? `<span class="m">:${pad(cw.mi)}</span>` : '');
        cells += `<button type="button" class="${cls}" data-i="${i}" aria-label="${pad(cw.h)}:${pad(cw.mi)} in ${esc(city(tz))}"><span class="h">${pad(cw.h)}</span>${sub}</button>`;
      }
      const isHome = tz === home;
      return `<div class="tz-row" role="listitem" data-tz="${esc(tz)}">
        <div class="tz-head">
          <button type="button" class="icon-btn ${isHome ? 'is-home' : ''}" data-act="home" aria-label="${isHome ? 'Home zone' : 'Make ' + esc(city(tz)) + ' home'}" aria-pressed="${isHome}">
            <svg viewBox="0 0 24 24" aria-hidden="true"${isHome ? ' style="fill:currentColor"' : ''}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>
          </button>
          <div class="tz-name">
            <div class="tz-city">${esc(city(tz))}${tz === localZone ? ' <span class="muted">· you</span>' : ''}</div>
            <div class="tz-meta">${esc(fmtOffset(off))} · ${esc(region(tz) || 'Universal')}</div>
          </div>
          <div class="tz-time"><b>${pad(w.h)}:${pad(w.mi)}</b><span>${esc(dayLabel(tz, sel))}</span></div>
          ${zones.length > 1 ? `<button type="button" class="icon-btn" data-act="remove" aria-label="Remove ${esc(city(tz))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}
        </div>
        <div class="tz-strip">${cells}</div>
      </div>`;
    });

    els.board.innerHTML = rows.join('') + '<div class="tz-cursor" id="tz-cursor"></div>';
    positionCursor();
    els.slider.value = minutes;
    els.sliderHome.textContent = city(home);
    els.slider.setAttribute('aria-valuetext', `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)} ${city(home)}`);
  }

  function cellW() {
    const c = els.board.querySelector('.tz-cell');
    return c ? c.getBoundingClientRect().width : 44;
  }

  function positionCursor() {
    const cur = $('#tz-cursor');
    if (cur) cur.style.left = (minutes / 60) * cellW() + 'px';
  }

  function scrollToCursor(behavior = 'auto') {
    const x = (minutes / 60) * cellW();
    const vw = els.board.clientWidth;
    const target = Math.max(0, x - vw / 2);
    els.board.scrollTo({ left: target, behavior });
  }

  function keepCursorVisible() {
    const x = (minutes / 60) * cellW();
    const { scrollLeft, clientWidth } = els.board;
    if (x < scrollLeft + 24 || x > scrollLeft + clientWidth - 24) scrollToCursor('smooth');
  }

  function openAdd() {
    const all = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : Object.keys(ALIASES));
    const list = [...new Set(['UTC', ...all])];
    const now = Date.now();
    const items = list.filter((tz) => !zones.includes(tz)).map((tz) => {
      const off = offset(tz, now);
      return {
        id: tz,
        title: city(tz),
        subtitle: `${region(tz) || 'Universal'}${ALIASES[tz] ? ' · ' + ALIASES[tz].split(',')[0] : ''}`,
        side: fmtOffset(off),
        keywords: `${tz} ${city(tz)} ${ALIASES[tz] || ''} ${fmtOffset(off)}`.toLowerCase().replace(/_/g, ' '),
        off,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
    picker.open({
      title: 'Add a time zone',
      placeholder: 'City, country or UTC+5:30',
      groups: [{ label: '', items }],
      onPick: (tz) => {
        zones.push(tz);
        save();
        render();
        toast(`Added ${city(tz)}`);
      },
    });
  }

  function init() {
    els.board = $('#tz-board');
    els.slider = $('#tz-slider');
    els.sliderHome = $('#tz-slider-home');
    els.date = $('#tz-date');

    els.board.addEventListener('click', (e) => {
      const cell = e.target.closest('.tz-cell');
      if (cell) {
        minutes = +cell.dataset.i * 60;
        render();
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const tz = act.closest('.tz-row').dataset.tz;
      if (act.dataset.act === 'home') {
        if (tz === home) return;
        // Keep the same instant selected when switching home.
        const sel = baseMs() + minutes * 60000;
        home = tz;
        const w = wall(home, sel);
        dateStr = `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
        minutes = w.h * 60 + w.mi;
        minutes -= minutes % 15;
        els.date.value = dateStr;
        save();
        render();
        scrollToCursor('smooth');
        toast(`${city(tz)} is now home`);
      } else if (act.dataset.act === 'remove') {
        zones = zones.filter((z) => z !== tz);
        if (home === tz) home = zones[0];
        save();
        render();
        toast(`Removed ${city(tz)}`);
      }
    });

    els.slider.addEventListener('input', () => {
      minutes = +els.slider.value;
      render();
      keepCursorVisible();
    });

    els.date.addEventListener('change', () => {
      dateStr = els.date.value || null;
      render();
    });

    $('#tz-now').addEventListener('click', setNow);
    $('#tz-add').addEventListener('click', openAdd);

    window.addEventListener('resize', () => render());
  }

  function show() {
    if (!els.board.childElementCount) setNow();
    else { render(); }
  }

  return { init, show, setNow };
})();
