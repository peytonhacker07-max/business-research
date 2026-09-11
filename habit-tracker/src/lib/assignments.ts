import { useEffect, useState } from "react";

export interface Assignment {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  time: string | null;
  course: string | null;
}

/** How the published file looks when encrypted. See scripts/lib/assignments-crypto.mjs. */
interface Envelope {
  v: number;
  iterations?: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const PASSPHRASE_KEY = "daily.assignments-passphrase";
const DEFAULT_ITERATIONS = 210000;

/** Whether this device has been unlocked. Synchronous — no fetch needed. */
export function hasPassphrase(): boolean {
  return storedPassphrase().length > 0;
}

/**
 * Checks a passphrase against the published file. Used by the unlock prompt,
 * which has to reject a wrong guess rather than accept any text typed in.
 */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assignments.json`, { cache: "no-store" });
    if (!res.ok) return false;
    const parsed = await res.json();
    // Nothing published yet, or published unencrypted — no passphrase to check.
    if (!isEnvelope(parsed)) return true;
    await decrypt(parsed, passphrase);
    return true;
  } catch {
    return false;
  }
}

/** The passphrase for this device, if one has been entered. */
export function storedPassphrase(): string {
  try {
    return localStorage.getItem(PASSPHRASE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePassphrase(value: string): void {
  try {
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(PASSPHRASE_KEY, trimmed);
    else localStorage.removeItem(PASSPHRASE_KEY);
  } catch {
    /* private browsing — the passphrase just won't persist */
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function isEnvelope(parsed: unknown): parsed is Envelope {
  return Boolean(
    parsed && !Array.isArray(parsed) && (parsed as Envelope).ciphertext && (parsed as Envelope).salt,
  );
}

/**
 * Undoes the encryption the sync applies. Every parameter here has to match
 * scripts/lib/assignments-crypto.mjs; AES-GCM in Web Crypto expects the auth
 * tag appended to the ciphertext, which is how that module writes it.
 */
async function decrypt(envelope: Envelope, passphrase: string): Promise<Assignment[]> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(envelope.salt) as BufferSource,
      iterations: envelope.iterations ?? DEFAULT_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) as BufferSource },
    key,
    base64ToBytes(envelope.ciphertext) as BufferSource,
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  return Array.isArray(parsed) ? parsed : [];
}

export type AssignmentsStatus = "loading" | "ready" | "locked" | "empty";

export interface AssignmentsState {
  assignments: Assignment[];
  status: AssignmentsStatus;
  /** Try a passphrase; returns false (and changes nothing) if it's wrong. */
  unlock: (passphrase: string) => Promise<boolean>;
}

/**
 * Loads assignments synced from Brightspace. The published file is encrypted
 * because the repository is public, so this needs the passphrase held on this
 * device — without it the tab shows locked rather than showing someone else's
 * coursework or an unexplained blank.
 */
export function useAssignments(): AssignmentsState {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [status, setStatus] = useState<AssignmentsStatus>("loading");
  const [envelope, setEnvelope] = useState<Envelope | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let parsed: unknown;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}assignments.json`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        parsed = await res.json();
      } catch {
        if (!cancelled) setStatus("empty");
        return;
      }

      if (!isEnvelope(parsed)) {
        const list = Array.isArray(parsed) ? (parsed as Assignment[]) : [];
        if (cancelled) return;
        setAssignments(list);
        setStatus(list.length > 0 ? "ready" : "empty");
        return;
      }

      if (cancelled) return;
      setEnvelope(parsed);

      const saved = storedPassphrase();
      if (!saved) {
        setStatus("locked");
        return;
      }
      try {
        const list = await decrypt(parsed, saved);
        if (cancelled) return;
        setAssignments(list);
        setStatus(list.length > 0 ? "ready" : "empty");
      } catch {
        // A stored passphrase that no longer works is worse than none —
        // clear it so the prompt comes back.
        savePassphrase("");
        if (!cancelled) setStatus("locked");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = async (passphrase: string): Promise<boolean> => {
    if (!envelope) return false;
    try {
      const list = await decrypt(envelope, passphrase);
      savePassphrase(passphrase);
      setAssignments(list);
      setStatus(list.length > 0 ? "ready" : "empty");
      return true;
    } catch {
      return false;
    }
  };

  return { assignments, status, unlock };
}

/**
 * Brightspace names courses like "BIB224-A - FA-26 - New Testament Literature
 * & Interpretation". The section and term are noise in a heading, so show
 * "BIB224 · New Testament Literature & Interpretation" instead.
 */
export function formatCourseName(course: string): string {
  const parts = course.split(" - ");
  if (parts.length < 3) return course;
  const code = parts[0].split("-")[0];
  const name = parts.slice(2).join(" - ");
  return `${code} · ${name}`;
}

/** "13:00" -> "1:00 PM". Returns null if there's no time (all-day event). */
export function formatAssignmentTime(time: string | null): string | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h24 = Number(hStr);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${mStr} ${period}`;
}
