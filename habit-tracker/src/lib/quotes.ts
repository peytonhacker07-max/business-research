import { useEffect, useState } from "react";

export interface Quote {
  text: string;
  author: string;
}

/**
 * Index of the quote for a given YYYY-MM-DD. Derived from the date alone so
 * the app and the notification sender pick the same one, and so it stays put
 * all day rather than changing on every render.
 */
export function quoteIndexFor(dateKey: string, count: number): number {
  if (count <= 0) return 0;
  const [y, m, d] = dateKey.split("-").map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return ((days % count) + count) % count;
}

/** The quote of the day, once quotes.json has loaded. */
export function useDailyQuote(dateKey: string): Quote | null {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}quotes.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setQuotes(data);
      })
      .catch(() => {
        /* no quotes file — the card just doesn't render */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (quotes.length === 0) return null;
  return quotes[quoteIndexFor(dateKey, quotes.length)];
}
