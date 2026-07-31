import { mkdir, stat } from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
// fetch's body is the DOM ReadableStream; Readable.fromWeb wants Node's.
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { join } from "node:path";

const CACHE_DIR = "data/scryfall_cache";
const BULK_TYPE = "oracle_cards";
const CACHE_FILE = `${BULK_TYPE}.jsonl`;
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

// Scryfall retired `download_uri` (a single JSON array) in favour of
// `jsonl_download_uri` (JSON Lines, one card per line). The old field is gone
// from the index entirely, so reading it yielded undefined and fetch() failed
// with ERR_INVALID_URL rather than anything that named the real problem.
type BulkIndex = {
  data: Array<{
    type: string;
    jsonl_download_uri: string;
    updated_at: string;
    size: number;
  }>;
};

async function ensureBulkFile(): Promise<string> {
  const cachePath = join(CACHE_DIR, CACHE_FILE);
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

  const cardsRes = await fetch(entry.jsonl_download_uri, {
    headers: { "User-Agent": ua },
  });
  if (!cardsRes.ok) {
    throw new Error(`Scryfall bulk download failed: HTTP ${cardsRes.status}`);
  }
  if (!cardsRes.body) {
    throw new Error("Scryfall bulk download returned no body");
  }

  // The dump is served as .jsonl.gz with content-type application/gzip and no
  // Content-Encoding header, so fetch does not decompress it — we get raw gzip
  // bytes. Decompress on the way to disk: ~24MB compressed becomes ~170MB, and
  // buffering that in memory is pointless when the reader streams it anyway.
  const compressed =
    entry.jsonl_download_uri.endsWith(".gz") ||
    (cardsRes.headers.get("content-type") ?? "").includes("gzip");

  const body = Readable.fromWeb(
    cardsRes.body as unknown as NodeReadableStream<Uint8Array>,
  );
  const sink = createWriteStream(cachePath);

  if (compressed) {
    await pipeline(body, createGunzip(), sink);
  } else {
    await pipeline(body, sink);
  }

  return cachePath;
}

/**
 * Stream the bulk file a line at a time.
 *
 * Preferred over loadAllCards for anything that only needs one pass: the
 * oracle_cards dump is ~170MB, and holding the parsed array costs well over a
 * gigabyte of heap.
 */
export async function* iterCards(): AsyncGenerator<ScryfallCard> {
  const cachePath = await ensureBulkFile();
  const lines = createInterface({
    input: createReadStream(cachePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    yield JSON.parse(trimmed) as ScryfallCard;
  }
}

export async function loadAllCards(): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  for await (const card of iterCards()) cards.push(card);
  return cards;
}

