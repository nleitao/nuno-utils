// Currency converter. Rates are cached on the device so it works offline.
'use strict';

const FX = (() => {
  const API = 'https://open.er-api.com/v6/latest/USD';
  const REFRESH_AFTER = 6 * 3600000; // try for fresh rates when older than 6h
  const STALE_AFTER = 3 * 86400000; // warn when older than 3 days

  let rates = store.get('fx.rates', null); // { base, time, rates }
  let from = store.get('fx.from', 'INR');
  let to = store.get('fx.to', 'GBP');
  let recent = store.get('fx.recent', ['GBP', 'EUR', 'USD', 'INR']);
  let fetching = false;

  const names = (() => {
    try { return new Intl.DisplayNames(['en'], { type: 'currency' }); } catch { return null; }
  })();
  const nameOf = (c) => (names && names.of(c)) || c;

  function flagOf(code) {
    if (code === 'EUR') return '🇪🇺';
    if (code.startsWith('X')) return '🌐';
    const cc = code.slice(0, 2).toUpperCase();
    return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  }

  function fmt(value, code, opts = {}) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', ...opts }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  }

  function fmtPlain(n) {
    const digits = n >= 100 ? 2 : n >= 1 ? 4 : 6;
    return new Intl.NumberFormat(undefined, { maximumSignificantDigits: Math.max(4, digits) }).format(n);
  }

  // Accepts "1,250.50", "1.250,50", "1250,5", "12 500".
  function parseAmount(raw) {
    let s = String(raw).replace(/[\s'_]/g, '');
    if (!s) return 0;
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (hasComma) {
      const parts = s.split(',');
      s = parts.length === 2 && parts[1].length !== 3 ? parts.join('.') : parts.join('');
    }
    if (!/^\d*\.?\d*$/.test(s) || s === '.') return NaN;
    return parseFloat(s);
  }

  function convert(amount, a, b) {
    if (!rates || !rates.rates[a] || !rates.rates[b]) return NaN;
    return (amount / rates.rates[a]) * rates.rates[b];
  }

  const els = {};

  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} h ago`;
    return `${Math.round(h / 24)} days ago`;
  }

  function renderStatus() {
    if (!rates) { els.updated.textContent = 'No rates yet. Connect once to download them.'; return; }
    const when = new Date(rates.time).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const stale = Date.now() - rates.time > STALE_AFTER;
    els.updated.textContent = `Rates from ${when} (${ago(rates.time)})${stale ? '. May be out of date.' : ''}`;
    els.status.classList.toggle('stale', stale);
    els.refresh.disabled = fetching;
    els.refresh.textContent = fetching ? 'Updating…' : 'Update rates';
  }

  function curBtn(el, code) {
    el.innerHTML = `<span class="flag" aria-hidden="true">${flagOf(code)}</span><span><span class="code">${code}</span><span class="name">${nameOf(code)}</span></span>`;
  }

  function quickUnit() {
    const r = rates && rates.rates[from];
    if (!r) return 1;
    // Scale quick amounts to the currency, e.g. INR gives 100, 500, 1000...
    return Math.pow(10, Math.max(0, Math.round(Math.log10(r))));
  }

  function render() {
    curBtn(els.from, from);
    curBtn(els.to, to);
    els.from.setAttribute('aria-label', `From ${nameOf(from)}. Change`);
    els.to.setAttribute('aria-label', `To ${nameOf(to)}. Change`);

    const amount = parseAmount(els.amount.value);
    const bad = Number.isNaN(amount);
    els.amount.setAttribute('aria-invalid', bad);
    els.err.hidden = !bad;

    const out = convert(bad ? 0 : amount, from, to);
    els.result.textContent = Number.isNaN(out) ? '—' : fmt(out, to);
    const one = convert(1, from, to);
    const back = convert(1, to, from);
    els.rate.textContent = Number.isNaN(one) ? '' : `1 ${from} = ${fmtPlain(one)} ${to}  ·  1 ${to} = ${fmtPlain(back)} ${from}`;

    const unit = quickUnit();
    els.quick.innerHTML = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000].map((n) => {
      const v = n * unit;
      const c = convert(v, from, to);
      return `<button type="button" class="quick-item" data-v="${v}"><span>${fmt(v, from, { maximumFractionDigits: 0 })}</span><span class="to">${Number.isNaN(c) ? '' : fmt(c, to)}</span></button>`;
    }).join('');

    renderStatus();
  }

  function remember(code) {
    recent = [code, ...recent.filter((c) => c !== code)].slice(0, 6);
    store.set('fx.recent', recent);
  }

  function save() {
    store.set('fx.from', from);
    store.set('fx.to', to);
    store.set('fx.amount', els.amount.value);
  }

  function openPicker(which) {
    const codes = Object.keys(rates ? rates.rates : {}).sort();
    const item = (c) => ({ id: c, flag: flagOf(c), title: c, subtitle: nameOf(c), keywords: `${c} ${nameOf(c)}`.toLowerCase() });
    const selected = which === 'from' ? from : to;
    picker.open({
      title: which === 'from' ? 'Convert from' : 'Convert to',
      placeholder: 'Code or name, e.g. rupee',
      selected,
      groups: [
        { label: 'Recent', items: recent.filter((c) => codes.includes(c)).map(item) },
        { label: 'All currencies', items: codes.map(item) },
      ],
      onPick: (code) => {
        if (which === 'from') { if (code === to) to = from; from = code; } else { if (code === from) from = to; to = code; }
        remember(code);
        save();
        render();
      },
    });
  }

  async function loadBundled() {
    try {
      const res = await fetch('data/rates.json');
      const data = await res.json();
      if (!rates || data.time > rates.time) { rates = data; store.set('fx.rates', rates); }
    } catch { /* no bundled copy available */ }
  }

  async function refresh(manual = false) {
    if (fetching) return;
    if (!navigator.onLine) { if (manual) toast('You are offline. Using saved rates.'); return; }
    fetching = true;
    renderStatus();
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const data = await res.json();
      if (data.result !== 'success') throw new Error('bad response');
      rates = { base: data.base_code, time: data.time_last_update_unix * 1000, rates: data.rates };
      store.set('fx.rates', rates);
      if (manual) toast('Rates updated');
    } catch {
      if (manual) toast('Could not update. Using saved rates.');
    } finally {
      fetching = false;
      render();
    }
  }

  async function init() {
    els.amount = $('#fx-amount');
    els.err = $('#fx-amount-err');
    els.from = $('#fx-from');
    els.to = $('#fx-to');
    els.result = $('#fx-result');
    els.rate = $('#fx-rate');
    els.quick = $('#fx-quick');
    els.updated = $('#fx-updated');
    els.status = $('.fx-status');
    els.refresh = $('#fx-refresh');

    els.amount.value = store.get('fx.amount', '1000');
    els.amount.addEventListener('input', () => { render(); save(); });
    els.amount.addEventListener('focus', () => els.amount.select());
    els.amount.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.amount.blur(); });
    els.from.addEventListener('click', () => openPicker('from'));
    els.to.addEventListener('click', () => openPicker('to'));
    $('#fx-swap').addEventListener('click', () => { [from, to] = [to, from]; save(); render(); });
    els.refresh.addEventListener('click', () => refresh(true));
    els.quick.addEventListener('click', (e) => {
      const b = e.target.closest('.quick-item');
      if (!b) return;
      els.amount.value = b.dataset.v;
      save();
      render();
    });
    window.addEventListener('online', () => refresh());

    if (!rates) await loadBundled();
    render();
    if (!rates || Date.now() - rates.time > REFRESH_AFTER) refresh();
  }

  return { init, render };
})();
