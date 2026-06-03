import "dotenv/config";
import { createAdminClient } from "../lib/supabase.js";

type Zone = "main" | "side" | "any";

type Archetype = { id: number; format: string; name: string };
type Rule = {
  archetype_id: number;
  zone: Zone;
  card_name: string;
  min_qty: number;
  group_id: number;
};
type Deck = { id: number; format: string; archetype_id: number | null };
type DeckCard = {
  deck_id: number;
  card_name: string;
  zone: "main" | "side";
  qty: number;
};

const supa = createAdminClient();

const { data: rules, error: rulesErr } = await supa
  .from("archetype_match_rule")
  .select("archetype_id, zone, card_name, min_qty, group_id");
if (rulesErr) throw new Error(`rules select failed: ${rulesErr.message}`);

if (!rules || rules.length === 0) {
  console.log("[classifier] no archetype_match_rule rows — exit clean");
  process.exit(0);
}

const { data: archetypes, error: archErr } = await supa
  .from("archetype")
  .select("id, format, name");
if (archErr) throw new Error(`archetype select failed: ${archErr.message}`);
const archetypesById = new Map<number, Archetype>(
  (archetypes ?? []).map((a) => [a.id, a as Archetype]),
);

const { data: decks, error: decksErr } = await supa
  .from("decks")
  .select("id, format, archetype_id");
if (decksErr) throw new Error(`decks select failed: ${decksErr.message}`);

const { data: cards, error: cardsErr } = await supa
  .from("deck_cards")
  .select("deck_id, card_name, zone, qty");
if (cardsErr) throw new Error(`deck_cards select failed: ${cardsErr.message}`);

const deckCards = new Map<number, DeckCard[]>();
for (const c of (cards ?? []) as DeckCard[]) {
  let list = deckCards.get(c.deck_id);
  if (!list) {
    list = [];
    deckCards.set(c.deck_id, list);
  }
  list.push(c);
}

const rulesByArchGroup = new Map<number, Map<number, Rule[]>>();
for (const r of rules as Rule[]) {
  let groups = rulesByArchGroup.get(r.archetype_id);
  if (!groups) {
    groups = new Map();
    rulesByArchGroup.set(r.archetype_id, groups);
  }
  let list = groups.get(r.group_id);
  if (!list) {
    list = [];
    groups.set(r.group_id, list);
  }
  list.push(r);
}

function deckHasCard(
  deckId: number,
  name: string,
  zone: Zone,
  minQty: number,
): boolean {
  const list = deckCards.get(deckId) ?? [];
  let qty = 0;
  for (const c of list) {
    if (c.card_name !== name) continue;
    if (zone === "any" || c.zone === zone) qty += c.qty;
  }
  return qty >= minQty;
}

function archetypeMatchesDeck(deckId: number, archetypeId: number): boolean {
  const groups = rulesByArchGroup.get(archetypeId);
  if (!groups) return false;
  for (const ruleList of groups.values()) {
    const allHold = ruleList.every((r) =>
      deckHasCard(deckId, r.card_name, r.zone, r.min_qty),
    );
    if (allHold) return true;
  }
  return false;
}

let toUpdate = 0;
let ambiguousCount = 0;
const writes: Array<{ id: number; archetype_id: number | null }> = [];

for (const d of (decks ?? []) as Deck[]) {
  const candidates: Archetype[] = [];
  for (const archetypeId of rulesByArchGroup.keys()) {
    const arch = archetypesById.get(archetypeId);
    if (!arch || arch.format !== d.format) continue;
    if (archetypeMatchesDeck(d.id, archetypeId)) candidates.push(arch);
  }

  let chosen: number | null = null;
  if (candidates.length === 1) {
    chosen = candidates[0].id;
  } else if (candidates.length > 1) {
    candidates.sort((a, b) => a.name.localeCompare(b.name));
    console.log(
      `[ambiguous] deck ${d.id} matches: ${candidates
        .map((c) => c.name)
        .join(", ")} → picking "${candidates[0].name}"`,
    );
    chosen = candidates[0].id;
    ambiguousCount++;
  }

  if (chosen !== d.archetype_id) {
    writes.push({ id: d.id, archetype_id: chosen });
    toUpdate++;
  }
}

console.log(
  `[classifier] decks=${decks?.length ?? 0} rules=${rules.length} archetypes=${rulesByArchGroup.size} ambiguous=${ambiguousCount} to_update=${toUpdate}`,
);

for (const w of writes) {
  const { error } = await supa
    .from("decks")
    .update({ archetype_id: w.archetype_id })
    .eq("id", w.id);
  if (error) throw new Error(`update deck ${w.id} failed: ${error.message}`);
}

console.log(`[ok] applied ${writes.length} updates`);
