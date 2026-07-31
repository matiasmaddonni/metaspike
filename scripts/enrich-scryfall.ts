import "dotenv/config";
import { createAdminClient } from "../lib/supabase/admin.js";
import { loadAllCards } from "../lib/scryfall/bulk.js";
import {
  buildIndex,
  matchByMtgoName,
  frontFaceFor,
  imageUrlFor,
} from "../lib/scryfall/match.js";

const supa = createAdminClient();

console.log("[bulk] loading Scryfall cards...");
const t0 = Date.now();
const all = await loadAllCards();
const idx = buildIndex(all);
console.log(
  `[bulk] ${all.length} cards, index ${idx.byName.size} keys, ${Date.now() - t0}ms`,
);

async function paginateNames(): Promise<string[]> {
  const PAGE = 1000;
  const all: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supa
      .from("deck_cards")
      .select("card_name")
      .is("scryfall_id", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`deck_cards select failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) all.push(r.card_name as string);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const allUnresolved = await paginateNames();
const uniqueNames = Array.from(new Set(allUnresolved)).sort();
console.log(
  `[resolve] ${uniqueNames.length} unique card_names across ${allUnresolved.length} unresolved rows`,
);

const matched: Array<{
  card_name: string;
  scryfall_id: string;
  card_row: {
    scryfall_id: string;
    oracle_id: string;
    name: string;
    name_front: string;
    mana_value: number | null;
    type_line: string | null;
    colors: string[] | null;
    image_url: string | null;
  };
}> = [];
const unmatched: string[] = [];

for (const name of uniqueNames) {
  const m = matchByMtgoName(name, idx);
  if (!m) {
    unmatched.push(name);
    continue;
  }
  matched.push({
    card_name: name,
    scryfall_id: m.id,
    card_row: {
      scryfall_id: m.id,
      oracle_id: m.oracle_id,
      name: m.name,
      name_front: frontFaceFor(m),
      mana_value: typeof m.cmc === "number" ? Math.round(m.cmc) : null,
      type_line: m.type_line?.trim() ?? null,
      colors: m.colors ?? null,
      image_url: imageUrlFor(m),
    },
  });
}

console.log(
  `[resolve] matched=${matched.length} unmatched=${unmatched.length}`,
);

// Several distinct MTGO card_names can resolve to the same printing — a DFC's
// front-face name alongside its full "A // B" name, or an entry in
// lib/scryfall/aliases.ts. That is correct for the deck_cards mapping below,
// which is many-to-one, but a single upsert batch cannot carry the same
// primary key twice: Postgres rejects it with "ON CONFLICT DO UPDATE command
// cannot affect row a second time". Dedupe on the way in.
const cardRows = [
  ...new Map(matched.map((m) => [m.card_row.scryfall_id, m.card_row])).values(),
];

const BATCH = 500;
for (let i = 0; i < cardRows.length; i += BATCH) {
  const slice = cardRows.slice(i, i + BATCH);
  const { error } = await supa
    .from("cards")
    .upsert(slice, { onConflict: "scryfall_id" });
  if (error) throw new Error(`cards upsert failed: ${error.message}`);
}
console.log(
  `[cards] upserted ${cardRows.length} rows (${matched.length} names → ${cardRows.length} printings)`,
);

let updated = 0;
for (let i = 0; i < matched.length; i += BATCH) {
  const slice = matched.slice(i, i + BATCH);
  for (const m of slice) {
    const { error, count } = await supa
      .from("deck_cards")
      .update({ scryfall_id: m.scryfall_id }, { count: "exact" })
      .eq("card_name", m.card_name)
      .is("scryfall_id", null);
    if (error) throw new Error(`deck_cards update failed: ${error.message}`);
    updated += count ?? 0;
  }
}
console.log(`[deck_cards] resolved ${updated} rows`);

if (unmatched.length > 0) {
  console.log(`[unmatched] ${unmatched.length}:`);
  for (const n of unmatched) console.log(`  - ${n}`);
}
