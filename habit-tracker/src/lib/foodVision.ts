/**
 * Estimating macros from a photo.
 *
 * This is the one part of the app that sends anything off the device. The
 * photo goes to Google's Gemini API and the numbers come back; nothing is
 * stored there by the app, but the request itself leaves the phone. Every
 * other feature — health, food, workouts — stays local, so the camera
 * button says so plainly before the first shot.
 *
 * The key belongs to whoever is using the app. It is typed in once and kept
 * in localStorage on that device, never in the repo and never in the build:
 * this is a public repository on a public site, and a committed key would be
 * a key given away. A friend running the same app uses their own key and
 * their own free quota.
 */

const KEY_STORAGE = "daily.vision.key";
const MODEL_STORAGE = "daily.vision.model";
const API = "https://generativelanguage.googleapis.com/v1beta";

/** A model to fall back on if listing them fails but the key works. */
const FALLBACK_MODEL = "models/gemini-flash-latest";

export interface FoodEstimate {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "high" | "medium" | "low";
  /** What it had to assume — portion size, cooking fat, what's underneath. */
  note: string;
}

export function hasVisionKey(): boolean {
  try {
    return Boolean(localStorage.getItem(KEY_STORAGE));
  } catch {
    return false;
  }
}

function storedKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

function storedModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE) || FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}

export function clearVisionKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
    localStorage.removeItem(MODEL_STORAGE);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/** Version number out of a name like "models/gemini-3.8-flash" → 3.8. */
function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Picks a model to use. Model names change often enough — and have changed
 * twice while this app has existed — that hardcoding one means the feature
 * quietly breaks later. Asking the API what exists today costs one request
 * at setup and survives the renaming.
 */
function chooseModel(models: { name: string; supportedGenerationMethods?: string[] }[]): string {
  const usable = models.filter((m) =>
    (m.supportedGenerationMethods ?? []).includes("generateContent"),
  );
  if (usable.length === 0) return FALLBACK_MODEL;

  // A maintained alias is the most durable choice when one is offered.
  const alias = usable.find((m) => m.name === "models/gemini-flash-latest");
  if (alias) return alias.name;

  // Otherwise the newest plain Flash: fast, and the tier of model the free
  // quota actually covers. Preview and thinking variants are skipped — they
  // come and go, and thinking models burn the daily quota far quicker.
  const flash = usable
    .filter((m) => /flash/.test(m.name) && !/lite|thinking|preview|exp|vision/.test(m.name))
    .sort((a, b) => versionOf(b.name) - versionOf(a.name));
  if (flash.length > 0) return flash[0].name;

  const anyFlash = usable.filter((m) => /flash/.test(m.name));
  return anyFlash[0]?.name ?? usable[0].name;
}

/**
 * Checks a key works and records which model to use with it. Returns a
 * human-readable problem rather than throwing, because every failure here is
 * something the person can act on: a wrong key, no quota, no connection.
 */
export async function saveVisionKey(
  key: string,
): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "Paste a key first." };

  let res: Response;
  try {
    res = await fetch(`${API}/models`, { headers: { "x-goog-api-key": trimmed } });
  } catch {
    return { ok: false, error: "Couldn't reach Google. Check your connection and try again." };
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "Google rejected that key. Check you copied all of it from AI Studio.",
    };
  }
  if (!res.ok) {
    return { ok: false, error: `Google returned ${res.status}. Try again in a minute.` };
  }

  let model = FALLBACK_MODEL;
  try {
    const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    model = chooseModel(body.models ?? []);
  } catch {
    /* key is valid; stay on the fallback model */
  }

  try {
    localStorage.setItem(KEY_STORAGE, trimmed);
    localStorage.setItem(MODEL_STORAGE, model);
  } catch {
    return { ok: false, error: "This browser won't let the app save the key." };
  }
  return { ok: true, model };
}

/** Strips the "data:image/jpeg;base64," prefix the API doesn't want. */
function splitDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

const PROMPT = `You are estimating the nutrition of a meal from a photo, for someone logging their macros.

Estimate the food actually visible, as served. Judge portion size against anything in frame that gives scale — a fork, a standard plate, a can.

Be specific in the name: "grilled chicken thigh with rice and broccoli", not "chicken dish".

Account for how it was likely cooked. Food fried or sauteed carries oil you cannot see; a restaurant portion is usually larger and fattier than a home one. Say what you assumed in the note, especially portion weight and any cooking fat, so the person can correct it.

Set confidence honestly:
- high: a clearly visible, simple, easily-judged portion
- medium: a normal meal where portion size is a reasonable guess
- low: hidden ingredients, mixed dishes, sauces, or no scale reference

If the photo is not food at all, return a name of "Not food" with all values 0 and low confidence.`;

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    calories: { type: "number" },
    protein: { type: "number" },
    carbs: { type: "number" },
    fat: { type: "number" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    note: { type: "string" },
  },
  required: ["name", "calories", "protein", "carbs", "fat", "confidence", "note"],
};

function clean(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, max));
}

/**
 * Sends one photo and returns the estimate. Throws an Error whose message is
 * safe to show — the caller puts it straight on screen.
 */
export async function analyseFoodPhoto(dataUrl: string): Promise<FoodEstimate> {
  const key = storedKey();
  if (!key) throw new Error("No key saved yet.");

  const image = splitDataUrl(dataUrl);
  if (!image) throw new Error("That image couldn't be read.");

  const model = storedModel();
  let res: Response;
  try {
    res = await fetch(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: image.mimeType, data: image.data } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.2,
        },
      }),
    });
  } catch {
    throw new Error("Couldn't reach Google. Check your connection.");
  }

  if (res.status === 429) {
    throw new Error(
      "You've used up today's free quota from Google. It resets at midnight Pacific time.",
    );
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error("Google rejected the key. Re-add it below.");
  }
  if (!res.ok) {
    throw new Error(`Google returned ${res.status}. Try again in a minute.`);
  }

  let text: string | undefined;
  try {
    const body = await res.json();
    text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    throw new Error("Google's reply couldn't be read.");
  }
  if (!text) throw new Error("Google sent an empty reply. Try another photo.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Google's reply wasn't in the expected format.");
  }

  const confidence = parsed.confidence;
  return {
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Meal",
    calories: clean(parsed.calories, 10000),
    protein: clean(parsed.protein, 1000),
    carbs: clean(parsed.carbs, 1000),
    fat: clean(parsed.fat, 1000),
    confidence:
      confidence === "high" || confidence === "low" || confidence === "medium"
        ? confidence
        : "low",
    note: typeof parsed.note === "string" ? parsed.note : "",
  };
}
