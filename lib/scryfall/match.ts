import type { ScryfallCard } from "./bulk.js";
import { aliasMtgoName } from "./aliases.js";

export type CardIndex = {
  byName: Map<string, ScryfallCard>;
};

// Layouts that aren't real playable cards (collectibles, tokens, format-specific).
// Skipping these prevents the matcher from picking showcase art entries that
// share names with real cards but are marked not_legal in every constructed format.
const NON_PLAYABLE_LAYOUTS = new Set([
  "art_series",
  "token",
  "double_faced_token",
  "emblem",
  "planar",
  "scheme",
  "vanguard",
  "host",
]);

function frontFaceName(card: ScryfallCard): string {
  return card.card_faces?.[0]?.name ?? card.name;
}

export function buildIndex(cards: ScryfallCard[]): CardIndex {
  const byName = new Map<string, ScryfallCard>();
  for (const c of cards) {
    if (c.layout && NON_PLAYABLE_LAYOUTS.has(c.layout)) continue;
    addKey(byName, c.name, c);
    if (c.card_faces) {
      for (const f of c.card_faces) addKey(byName, f.name, c);
    }
    if (c.name.includes(" // ")) {
      const [left] = c.name.split(" // ");
      addKey(byName, left, c);
      addKey(byName, c.name.replace(" // ", "/"), c);
    }
  }
  return { byName };
}

function addKey(map: Map<string, ScryfallCard>, name: string, card: ScryfallCard): void {
  const key = name.toLowerCase().trim();
  if (!key) return;
  if (!map.has(key)) map.set(key, card);
}

export function matchByMtgoName(
  name: string,
  index: CardIndex,
): ScryfallCard | undefined {
  const aliased = aliasMtgoName(name);
  return index.byName.get(aliased.toLowerCase().trim());
}

export function frontFaceFor(card: ScryfallCard): string {
  return frontFaceName(card);
}

export function imageUrlFor(card: ScryfallCard): string | null {
  return (
    card.card_faces?.[0]?.image_uris?.normal ??
    card.image_uris?.normal ??
    null
  );
}
