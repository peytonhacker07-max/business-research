# Daily — Habit Tracker

A quiet, "paper and ink" daily habit tracker. Build streaks one day at a time.
Single-page app, no backend, no account — all your data lives in your browser.
Designed mobile-first and installable to your home screen.

![icon](public/icon-192.png)

## Features

- **Today view** with a large progress ring showing how many of today's habits are done.
- **Daily-only habits** — add, edit, delete, and reorder them.
- **Automatic day rollover** — at midnight the checklist resets; yesterday's
  results are locked into history (each day is stored as its own record).
- **Streaks** — current streak (with a one-day grace period for today) and
  longest streak ever, per habit.
- **History** — a GitHub-style heatmap for the last ~3 months, both overall and per habit.
- **Analytics** — completion rate over the last 7 / 30 / 90 days, per-habit
  completion percentage, and current streaks at a glance (hand-rolled SVG charts).
- **Offline-first PWA** — no network calls at all; works fully offline once loaded.

## Tech

Vite + React + TypeScript, plain hand-written CSS, `localStorage` for persistence.
No backend, no database, no state-management library, no UI kit.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm run gen-icons  # regenerate public/icon-192.png and icon-512.png
```

## Use it on your phone ("Add to Home Screen")

1. Deploy it (see below) so you have an `https://` URL.
2. Open that URL in Safari (iOS) or Chrome (Android).
3. **iOS:** Share → *Add to Home Screen*. **Android:** menu (⋮) → *Install app* / *Add to Home Screen*.
4. Launch it from the home screen — it opens full-screen like a native app, and
   your data persists on that device.

> Data is stored per-browser/per-device via `localStorage`. There is no sync;
> clearing site data or switching browsers starts fresh.

## Deploy to Vercel (free, zero config)

Vite is auto-detected by Vercel, so no config changes are needed.

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel            # from the habit-tracker/ directory; accept the defaults
vercel --prod     # promote to a production URL
```

### Option B — GitHub import

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Set **Root Directory** to `habit-tracker` (since the app lives in a subfolder).
   Vercel will detect Vite automatically:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy. You'll get a free `*.vercel.app` URL you can open on your phone.

(The same settings work on Netlify: build `npm run build`, publish `dist`,
base directory `habit-tracker`.)

## Daily reminder notifications (optional)

The app can send push reminders at **8:00 AM, 1:00 PM, and 9:00 PM Central**
(handles daylight saving automatically). It's free — a scheduled GitHub Actions
workflow (`.github/workflows/notify.yml`) sends them via Web Push using the
sender in [`../notify`](../notify).

One-time setup:

1. On your phone, open the app (added to your Home Screen) → **Daily reminders**
   → **Enable reminders on this device**, allow notifications, then **Copy code**.
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**:
   - `PUSH_SUBSCRIPTION` — paste the copied code.
   - `VAPID_PRIVATE_KEY` — the private key that matches the public key in
     `src/lib/push.ts` / `notify/send.mjs` (generate a pair with
     `cd notify && npx web-push generate-vapid-keys` if you ever need new keys).
3. Test it: **Actions → "Send daily habit reminders" → Run workflow → test = true**.

> iOS requires the app to be installed to the Home Screen (iOS 16.4+). The free
> scheduler may deliver a few minutes after the listed time.

## Project layout

```
habit-tracker/
├─ index.html              # entry + PWA / iOS meta tags
├─ public/
│  ├─ manifest.json        # PWA manifest
│  └─ icon-192.png, icon-512.png
├─ scripts/gen-icons.mjs   # regenerates the PNG icons (no deps)
└─ src/
   ├─ App.tsx
   ├─ index.css            # all styling
   ├─ components/          # Today / History / Analytics views, ring, modal, nav
   └─ lib/                 # types, dates, storage, streak math, state hook
```
