import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FetchResult } from "./types.js";

const CACHE_DIR = "data/mtgo_cache";
const DEFAULT_UA = "metaspike/0.1 (research; matiasmaddonni@gmail.com)";
const MIN_DELAY_MS = 2000;

let lastFetchAt = 0;

export function slugFromUrl(url: string): string {
  const m = url.match(/\/decklist\/([^/?#]+)/);
  if (!m) throw new Error(`Cannot derive slug from URL: ${url}`);
  return m[1];
}

export async function fetchEvent(url: string): Promise<FetchResult> {
  const slug = slugFromUrl(url);
  const cachePath = join(CACHE_DIR, `${slug}.html`);

  if (existsSync(cachePath)) {
    const html = await readFile(cachePath, "utf-8");
    return {
      html,
      status: 200,
      finalUrl: url,
      fromCache: true,
      cachePath,
      slug,
    };
  }

  await mkdir(CACHE_DIR, { recursive: true });

  const since = Date.now() - lastFetchAt;
  if (lastFetchAt > 0 && since < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - since));
  }

  const ua = process.env.MTGO_PROBE_UA ?? DEFAULT_UA;
  const res = await fetch(url, { headers: { "User-Agent": ua } });
  lastFetchAt = Date.now();

  if (!res.ok) {
    throw new Error(
      `MTGO fetch failed: HTTP ${res.status} ${res.statusText} for ${url}`,
    );
  }

  const html = await res.text();
  await writeFile(cachePath, html, "utf-8");

  return {
    html,
    status: res.status,
    finalUrl: res.url,
    fromCache: false,
    cachePath,
    slug,
  };
}
