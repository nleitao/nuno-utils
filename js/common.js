// Shared helpers: storage, toast, picker sheet.
'use strict';

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  },
};

const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// Bottom-sheet picker with search.
// groups: [{ label, items: [{ id, flag, title, subtitle, side, keywords }] }]
const picker = (() => {
  const dlg = $('#picker');
  const list = $('#picker-list');
  const search = $('#picker-search');
  const empty = $('#picker-empty');
  let current = null;

  function render() {
    const q = search.value.trim().toLowerCase();
    const parts = [];
    let count = 0;
    for (const g of current.groups) {
      const items = q ? g.items.filter((it) => it.keywords.includes(q)) : g.items;
      if (!items.length) continue;
      if (g.label) parts.push(`<li class="picker-group" role="presentation">${esc(g.label)}</li>`);
      for (const it of items.slice(0, 200)) {
        count++;
        parts.push(`<li role="presentation"><button type="button" class="picker-item" role="option" data-id="${esc(it.id)}" aria-selected="${it.id === current.selected}">
          ${it.flag ? `<span class="flag" aria-hidden="true">${it.flag}</span>` : ''}
          <span class="main"><b>${esc(it.title)}</b>${it.subtitle ? `<span>${esc(it.subtitle)}</span>` : ''}</span>
          ${it.side ? `<span class="side">${esc(it.side)}</span>` : ''}
        </button></li>`);
      }
    }
    list.innerHTML = parts.join('');
    empty.hidden = count > 0;
  }

  function open(opts) {
    current = opts;
    $('#picker-title').textContent = opts.title;
    search.value = '';
    search.placeholder = opts.placeholder || 'Search';
    render();
    list.scrollTop = 0;
    dlg.showModal();
    // Only auto-focus search on devices with a real keyboard, so the phone keyboard doesn't cover the list.
    if (matchMedia('(pointer: fine)').matches) search.focus();
  }

  function close() { dlg.close(); }

  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = list.querySelector('.picker-item');
      if (first) first.click();
    }
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.picker-item');
    if (!btn || !current) return;
    const cb = current.onPick;
    close();
    cb(btn.dataset.id);
  });
  $('#picker-close').addEventListener('click', close);
  // Tap on backdrop closes.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  return { open, close };
})();
