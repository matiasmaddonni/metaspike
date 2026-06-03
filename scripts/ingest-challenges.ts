import "dotenv/config";
import { createAdminClient } from "../lib/supabase/admin.js";
import { fetchEvent } from "../lib/mtgo/fetch.js";
import { parseEvent, NotTournamentError } from "../lib/mtgo/parse.js";

function parseArgs(argv: string[]): { url?: string } {
  const out: { url?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") out.url = argv[i + 1];
  }
  return out;
}

const { url } = parseArgs(process.argv.slice(2));
if (!url) {
  console.error("usage: tsx scripts/ingest-challenges.ts --url <event_url>");
  process.exit(1);
}

const supa = createAdminClient();

const fetched = await fetchEvent(url);
console.log(
  `[fetch] ${fetched.fromCache ? "cache" : "live"} ${fetched.slug} (${fetched.html.length} bytes)`,
);

let event;
try {
  event = parseEvent(fetched.html, {
    sourceUrl: url,
    cachePath: fetched.cachePath,
  });
} catch (e) {
  if (e instanceof NotTournamentError) {
    console.error(`[skip] ${e.message}`);
    process.exit(2);
  }
  throw e;
}

console.log(
  `[parse] ${event.event_name} (${event.event_tier}, ${event.format}, ${event.event_date}, ${event.event_size} decks)`,
);

const { data: evRow, error: evErr } = await supa
  .from("events")
  .upsert(
    {
      mtgo_event_id: event.mtgo_event_id,
      format: event.format,
      event_name: event.event_name,
      event_tier: event.event_tier,
      event_date: event.event_date,
      event_size: event.event_size,
      source_url: event.source_url,
      raw_cache_path: event.raw_cache_path,
    },
    { onConflict: "mtgo_event_id" },
  )
  .select("id")
  .single();
if (evErr) throw new Error(`events upsert failed: ${evErr.message}`);
const eventId = evRow!.id as number;

let deckCount = 0;
let cardCount = 0;
for (const d of event.decks) {
  const { data: dkRow, error: dkErr } = await supa
    .from("decks")
    .upsert(
      {
        event_id: eventId,
        format: event.format,
        player: d.player,
        rank: d.rank,
        score: d.score,
      },
      { onConflict: "event_id,player,rank" },
    )
    .select("id")
    .single();
  if (dkErr) throw new Error(`decks upsert failed: ${dkErr.message}`);
  const deckId = dkRow!.id as number;
  deckCount++;

  const rows = [...d.main, ...d.side].map((c) => ({
    deck_id: deckId,
    card_name: c.card_name,
    zone: c.zone,
    qty: c.qty,
  }));
  if (rows.length === 0) continue;
  const { error: cErr } = await supa
    .from("deck_cards")
    .upsert(rows, { onConflict: "deck_id,card_name,zone" });
  if (cErr) throw new Error(`deck_cards upsert failed: ${cErr.message}`);
  cardCount += rows.length;
}

console.log(
  `[ok] event_id=${eventId} decks=${deckCount} card_rows=${cardCount}`,
);
