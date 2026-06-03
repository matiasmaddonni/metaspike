import type { ScryfallCard } from "./bulk.js";

export type CardIndex = {
  byName: Map<string, ScryfallCard>;
};

function frontFaceName(card: ScryfallCard): string {
  return card.card_faces?.[0]?.name ?? card.name;
}

export function buildIndex(cards: ScryfallCard[]): CardIndex {
  const byName = new Map<string, ScryfallCard>();
  for (const c of cards) {
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
  return index.byName.get(name.toLowerCase().trim());
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
