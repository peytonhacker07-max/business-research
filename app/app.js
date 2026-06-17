/* Streaks — a tiny, local-first habit tracker.
   All data lives in the browser via localStorage; no server, no login. */

const STORAGE_KEY = "streaks.habits.v1";
const COLORS = ["#ff7a3d", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fbbf24"];

// ---- Date helpers ---------------------------------------------------------

/** Local YYYY-MM-DD key for a Date (avoids UTC off-by-one from toISOString). */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const TODAY_KEY = dateKey(new Date());

// ---- State ----------------------------------------------------------------

let habits = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- Streak math ----------------------------------------------------------

/** Current streak: consecutive completed days ending today (or yesterday if
    today isn't done yet, so a streak isn't "lost" until a full day is missed). */
function currentStreak(habit) {
  const done = habit.completions || {};
  let start = new Date();
  if (!done[dateKey(start)]) start = addDays(start, -1); // grace for today
  let streak = 0;
  let cursor = start;
  while (done[dateKey(cursor)]) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive completed days, ever. */
function longestStreak(habit) {
  const keys = Object.keys(habit.completions || {}).filter((k) => habit.completions[k]);
  if (keys.length === 0) return 0;
  keys.sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const cur = new Date(keys[i]);
    const diffDays = Math.round((cur - prev) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function totalCheckIns() {
  return habits.reduce(
    (sum, h) => sum + Object.values(h.completions || {}).filter(Boolean).length,
    0
  );
}

// ---- Mutations ------------------------------------------------------------

function toggleDay(habitId, key) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  habit.completions = habit.completions || {};
  if (habit.completions[key]) delete habit.completions[key];
  else habit.completions[key] = true;
  save();
  render();
}

function addHabit(name, emoji, color) {
  habits.push({
    id: uid(),
    name,
    emoji: emoji || "✅",
    color,
    createdAt: TODAY_KEY,
    completions: {},
  });
  save();
  render();
}

function deleteHabit(habitId) {
  const habit = habits.find((h) => h.id === habitId);
  if (habit && !confirm(`Delete "${habit.name}"? This can't be undone.`)) return;
  habits = habits.filter((h) => h.id !== habitId);
  save();
  render();
}

// ---- Rendering ------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function render() {
  // Header date
  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: "long", month: "long", day: "numeric" }
  );

  // Stats
  const doneToday = habits.filter((h) => h.completions && h.completions[TODAY_KEY]).length;
  document.getElementById("statDoneToday").textContent = `${doneToday}/${habits.length}`;
  document.getElementById("statBestStreak").textContent = habits.reduce(
    (m, h) => Math.max(m, longestStreak(h)),
    0
  );
  document.getElementById("statTotal").textContent = totalCheckIns();

  // List vs empty
  const list = document.getElementById("habitList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";
  empty.hidden = habits.length > 0;

  // Last 7 days, oldest -> today
  const week = [];
  for (let i = 6; i >= 0; i--) week.push(addDays(new Date(), -i));

  for (const habit of habits) {
    list.appendChild(renderHabit(habit, week));
  }
}

function renderHabit(habit, week) {
  const done = habit.completions || {};
  const cur = currentStreak(habit);
  const best = longestStreak(habit);
  const isDoneToday = !!done[TODAY_KEY];

  const card = document.createElement("article");
  card.className = "habit";
  card.style.setProperty("--habit-color", habit.color);

  const meta =
    cur > 0
      ? `<span class="flame">🔥 ${cur} day${cur === 1 ? "" : "s"}</span> · best ${best}`
      : `Start your streak today · best ${best}`;

  card.innerHTML = `
    <div class="habit-head">
      <div class="habit-emoji">${escapeHtml(habit.emoji)}</div>
      <div class="habit-info">
        <div class="habit-name">${escapeHtml(habit.name)}</div>
        <div class="habit-meta">${meta}</div>
      </div>
      <button class="toggle-today ${isDoneToday ? "done" : ""}" title="Toggle today">
        ${isDoneToday ? "✓" : ""}
      </button>
    </div>
    <div class="week"></div>
    <div class="habit-footer">
      <button class="delete-btn">Delete</button>
    </div>
  `;

  card.querySelector(".toggle-today").addEventListener("click", () =>
    toggleDay(habit.id, TODAY_KEY)
  );
  card.querySelector(".delete-btn").addEventListener("click", () => deleteHabit(habit.id));

  const weekEl = card.querySelector(".week");
  for (const d of week) {
    const key = dateKey(d);
    const dayEl = document.createElement("div");
    dayEl.className = "day";
    dayEl.innerHTML = `
      <span class="day-label">${WEEKDAYS[d.getDay()]}</span>
      <button class="day-box ${done[key] ? "done" : ""} ${key === TODAY_KEY ? "today" : ""}"
              aria-label="${key}"></button>
      <span class="day-num">${d.getDate()}</span>
    `;
    dayEl.querySelector(".day-box").addEventListener("click", () => toggleDay(habit.id, key));
    weekEl.appendChild(dayEl);
  }

  return card;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// ---- Add-habit modal ------------------------------------------------------

let pickedColor = COLORS[0];

function buildSwatches() {
  const wrap = document.getElementById("swatches");
  wrap.innerHTML = "";
  COLORS.forEach((color, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (i === 0 ? " selected" : "");
    b.style.background = color;
    b.addEventListener("click", () => {
      pickedColor = color;
      wrap.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
      b.classList.add("selected");
    });
    wrap.appendChild(b);
  });
}

function openModal() {
  document.getElementById("modal").hidden = false;
  document.getElementById("habitName").focus();
}

function closeModal() {
  document.getElementById("modal").hidden = true;
  document.getElementById("addForm").reset();
  pickedColor = COLORS[0];
  document.querySelectorAll(".swatch").forEach((s, i) =>
    s.classList.toggle("selected", i === 0)
  );
}

document.getElementById("openAdd").addEventListener("click", openModal);
document.getElementById("cancelAdd").addEventListener("click", closeModal);
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("modal").hidden) closeModal();
});

document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("habitName").value.trim();
  const emoji = document.getElementById("habitEmoji").value.trim();
  if (!name) return;
  addHabit(name, emoji, pickedColor);
  closeModal();
});

// ---- Boot -----------------------------------------------------------------

buildSwatches();
render();
