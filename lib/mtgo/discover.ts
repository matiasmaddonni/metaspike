import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = "data/mtgo_cache";
const DEFAULT_UA = "metaspike/0.1 (research; matiasmaddonni@gmail.com)";
const MIN_DELAY_MS = 2000;
const INDEX_TTL_MS = 60 * 60 * 1000;

let lastIndexFetchAt = 0;

function monthCacheKey(year: number, month: number): string {
  return `_index-${year}-${String(month).padStart(2, "0")}.html`;
}

async function fetchMonthIndex(year: number, month: number): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, monthCacheKey(year, month));
  if (existsSync(cachePath)) {
    const stats = await stat(cachePath);
    const age = Date.now() - stats.mtimeMs;
    if (age < INDEX_TTL_MS) {
      return readFile(cachePath, "utf-8");
    }
  }

  const since = Date.now() - lastIndexFetchAt;
  if (lastIndexFetchAt > 0 && since < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - since));
  }

  const mm = String(month).padStart(2, "0");
  const url = `https://www.mtgo.com/decklists?year=${year}&month=${mm}`;
  const ua = process.env.MTGO_PROBE_UA ?? DEFAULT_UA;
  const res = await fetch(url, { headers: { "User-Agent": ua } });
  lastIndexFetchAt = Date.now();
  if (!res.ok) {
    throw new Error(`MTGO month index fetch failed: HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  await writeFile(cachePath, html, "utf-8");
  return html;
}

function monthsBetween(from: string, to: string): Array<{ year: number; month: number }> {
  const [fY, fM] = from.split("-").map(Number);
  const [tY, tM] = to.split("-").map(Number);
  const out: Array<{ year: number; month: number }> = [];
  let y = fY;
  let m = fM;
  while (y < tY || (y === tY && m <= tM)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export type TournamentEvent = {
  slug: string;
  url: string;
  format: string;
  event_date: string;
};

export async function findTournamentEvents(
  format: string,
  from: string,
  to: string,
): Promise<TournamentEvent[]> {
  const formatPrefix = format.toLowerCase() + "-";
  const months = monthsBetween(from, to);
  const seen = new Map<string, TournamentEvent>();

  for (const { year, month } of months) {
    const html = await fetchMonthIndex(year, month);
    const matches = html.matchAll(/\/decklist\/([a-z0-9-]+)/g);
    for (const m of matches) {
      const slug = m[1];
      if (!slug.startsWith(formatPrefix)) continue;
      if (!/(challenge|qualifier)/i.test(slug)) continue;
      if (/(league|preliminary)/i.test(slug)) continue;
      const dateMatch = slug.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;
      const eventDate = dateMatch[1];
      if (eventDate < from || eventDate > to) continue;
      if (seen.has(slug)) continue;
      seen.set(slug, {
        slug,
        url: `https://www.mtgo.com/decklist/${slug}`,
        format,
        event_date: eventDate,
      });
    }
  }

  return [...seen.values()].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
    return a.slug.localeCompare(b.slug);
  });
}
