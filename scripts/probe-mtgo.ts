// Probe-only script. Fetches one MTGO decklist URL, extracts the embedded
// window.MTGO.decklists.data payload, prints top-level shape + counts.
// Run: npx tsx scripts/probe-mtgo.ts <decklist-url>
// Re-probes from data/mtgo_cache/<slug>.html if present.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const UA = "metaspike-probe/0.1 (research; matiasmaddonni@gmail.com)";
const CACHE_DIR = "data/mtgo_cache";

const url = process.argv[2];
if (!url) {
  console.error("usage: tsx scripts/probe-mtgo.ts <decklist-url>");
  process.exit(1);
}

const slug = url.replace(/^.*\/decklist\//, "").replace(/\/+$/, "");
const cachePath = join(CACHE_DIR, `${slug}.html`);

await mkdir(CACHE_DIR, { recursive: true });

let html: string;
if (existsSync(cachePath)) {
  html = await readFile(cachePath, "utf-8");
  console.log(`[cache] ${cachePath}`);
} else {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  html = await res.text();
  await writeFile(cachePath, html, "utf-8");
  console.log(`[fetched] ${url} -> ${cachePath} (${html.length} bytes)`);
}

const m = html.match(/window\.MTGO\.decklists\.data\s*=\s*(\{.*?\});/);
if (!m) {
  throw new Error("payload not found: window.MTGO.decklists.data");
}
const data = JSON.parse(m[1]);

console.log("\n=== top-level keys ===");
console.log(Object.keys(data).join(", "));

console.log("\n=== event metadata ===");
const meta = {
  event_id: data.event_id,
  description: data.description,
  starttime: data.starttime,
  format: data.format,
  type: data.type,
  inplayoffs: data.inplayoffs,
  site_name: data.site_name,
};
console.log(meta);

const decklists = Array.isArray(data.decklists) ? data.decklists : [];
const standings = Array.isArray(data.standings) ? data.standings : [];

console.log("\n=== counts ===");
console.log({
  decklists: decklists.length,
  standings: standings.length,
  brackets: Array.isArray(data.brackets) ? data.brackets.length : 0,
});

if (decklists.length > 0) {
  const d0 = decklists[0];
  console.log("\n=== first decklist ===");
  console.log({
    player: d0.player,
    loginid: d0.loginid,
    main_count: d0.main_deck?.length,
    side_count: d0.sideboard_deck?.length,
    main_total_qty: (d0.main_deck ?? []).reduce(
      (sum: number, c: { qty: string }) => sum + parseInt(c.qty, 10),
      0,
    ),
    side_total_qty: (d0.sideboard_deck ?? []).reduce(
      (sum: number, c: { qty: string }) => sum + parseInt(c.qty, 10),
      0,
    ),
    sample_card: d0.main_deck?.[0]?.card_attributes?.card_name,
  });
}

if (standings.length > 0) {
  console.log("\n=== first standing ===");
  console.log(standings[0]);
}

const isChallenge =
  data.type === "TOURNAMENT" && /\bchallenge\b/i.test(data.description ?? "");
console.log(`\n=== filter check: Challenge? ${isChallenge} ===`);
