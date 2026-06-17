# 🔥 Streaks — Habit Tracker

A simple, local-first habit tracker. Log habits each day, build streaks, and watch your stats grow.

## Features
- ➕ Add habits with a custom emoji and color
- ✅ One tap to mark a habit done today
- 🔥 Current streak + 🏆 longest streak per habit
- 📅 Clickable 7-day grid to fix any missed days
- 📊 Overall stats: done today, best streak, total check-ins
- 💾 Saves automatically in your browser — no account, no server

## How to run it
Just open `index.html` in any web browser (double-click the file). That's it.

Your data is stored locally in the browser (via `localStorage`), so it stays
on your device and persists between visits. Using a different browser or
clearing site data will start you fresh.

## Hosting it online (optional)
Because it's plain HTML/CSS/JS with no build step, you can host it free on
GitHub Pages, Netlify, or Vercel by pointing them at the `app/` folder.

## Files
- `index.html` — markup and layout
- `styles.css` — styling (dark theme)
- `app.js` — all the logic (state, streaks, rendering)
