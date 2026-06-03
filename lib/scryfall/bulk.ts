import { mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = "data/scryfall_cache";
const BULK_TYPE = "oracle_cards";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_UA = "metaspike/0.1 (research; matiasmaddonni@gmail.com)";

export type ScryfallCard = {
  id: string;
  oracle_id: string;
  name: string;
  cmc?: number;
  type_line?: string;
  colors?: string[];
  layout?: string;
  image_uris?: { normal?: string };
  card_faces?: Array<{
    name: string;
    image_uris?: { normal?: string };
  }>;
};

type BulkIndex = {
  data: Array<{
    type: string;
    download_uri: string;
    updated_at: string;
    size: number;
  }>;
};

async function ensureBulkFile(): Promise<string> {
  const cachePath = join(CACHE_DIR, `${BULK_TYPE}.json`);
  await mkdir(CACHE_DIR, { recursive: true });

  if (existsSync(cachePath)) {
    const age = Date.now() - (await stat(cachePath)).mtimeMs;
    if (age < MAX_AGE_MS) {
      return cachePath;
    }
  }

  const ua = process.env.MTGO_PROBE_UA ?? DEFAULT_UA;

  const idxRes = await fetch("https://api.scryfall.com/bulk-data", {
    headers: { "User-Agent": ua, Accept: "application/json" },
  });
  if (!idxRes.ok) {
    throw new Error(`Scryfall bulk-data index failed: HTTP ${idxRes.status}`);
  }
  const idx = (await idxRes.json()) as BulkIndex;
  const entry = idx.data.find((d) => d.type === BULK_TYPE);
  if (!entry) {
    throw new Error(`Scryfall bulk entry "${BULK_TYPE}" not present`);
  }

  const cardsRes = await fetch(entry.download_uri, {
    headers: { "User-Agent": ua },
  });
  if (!cardsRes.ok) {
    throw new Error(`Scryfall bulk download failed: HTTP ${cardsRes.status}`);
  }
  const buf = Buffer.from(await cardsRes.arrayBuffer());
  await writeFile(cachePath, buf);
  return cachePath;
}

export async function loadAllCards(): Promise<ScryfallCard[]> {
  const cachePath = await ensureBulkFile();
  const raw = await readFile(cachePath, "utf-8");
  return JSON.parse(raw) as ScryfallCard[];
}

export async function* iterCards(): AsyncGenerator<ScryfallCard> {
  const cards = await loadAllCards();
  for (const c of cards) yield c;
}
