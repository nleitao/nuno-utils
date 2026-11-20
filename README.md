# Nuno Utils

Personal, offline-first toolbox for my phone. Plain HTML/CSS/JS, no build step, no login.

## Tools

- **Time zones**: one 24h strip per zone, all lined up on the same moment. Slide or tap an hour, pick a date (handles daylight saving), ★ sets the home zone.
- **Currency**: convert between ~160 currencies. Rates are saved on the phone, so it works with no signal. A snapshot ships in `data/rates.json` so it works even on the very first offline launch.

## How offline works

`sw.js` caches every file on first visit. After that the app opens with no connection. Rates come from open.er-api.com (free, no key) whenever you're online and the saved ones are older than 6 hours.

**When you change any file, bump `VERSION` in `sw.js`** (and add new files to `SHELL`), otherwise phones keep the old copy longer.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy

Any static host works (Netlify drop, Cloudflare Pages, GitHub Pages). It must be served over HTTPS for offline mode to work. Open it once on the phone, then "Add to Home Screen" so it opens like an app.

## Adding a tool later

1. Add a `<section id="view-xyz" class="view" hidden>` in `index.html` and a tab button with `data-view="xyz"`.
2. Add the name to `VIEWS` in `js/app.js` and the grid columns in `.tabbar` in `styles.css`.
3. Put the logic in `js/xyz.js`, include it in `index.html` and in `SHELL` in `sw.js`.
