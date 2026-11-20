// App shell: tabs, offline badge, service worker.
'use strict';

(() => {
  const VIEWS = { tz: 'Time zones', fx: 'Currency' };

  function show(view) {
    if (!VIEWS[view]) view = 'tz';
    for (const id of Object.keys(VIEWS)) $(`#view-${id}`).hidden = id !== view;
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === view) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    $('#page-title').textContent = VIEWS[view];
    document.title = `${VIEWS[view]} · Nuno Utils`;
    store.set('app.view', view);
    if (view === 'tz') TZ.show();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    history.replaceState(null, '', '#' + t.dataset.view);
    show(t.dataset.view);
  }));

  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  function net() { $('#net-badge').hidden = navigator.onLine; }
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  net();

  TZ.init();
  FX.init();
  show(location.hash.slice(1) || store.get('app.view', 'tz'));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
