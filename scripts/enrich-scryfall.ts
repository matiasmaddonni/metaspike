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

const { data: nameRows, error: nameErr } = await supa
  .from("deck_cards")
  .select("card_name")
  .is("scryfall_id", null);
if (nameErr) throw new Error(`deck_cards select failed: ${nameErr.message}`);

const uniqueNames = Array.from(
  new Set((nameRows ?? []).map((r) => r.card_name as string)),
).sort();
console.log(`[resolve] ${uniqueNames.length} unique unresolved card_names`);

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

const BATCH = 500;
for (let i = 0; i < matched.length; i += BATCH) {
  const slice = matched.slice(i, i + BATCH).map((m) => m.card_row);
  const { error } = await supa
    .from("cards")
    .upsert(slice, { onConflict: "scryfall_id" });
  if (error) throw new Error(`cards upsert failed: ${error.message}`);
}
console.log(`[cards] upserted ${matched.length} rows`);

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
