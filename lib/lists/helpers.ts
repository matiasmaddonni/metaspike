import type {
  DeckLine,
  DeckPayload,
  EventScope,
  PrimaryType,
  TypeGroup,
} from "@/lib/types/listEvents";

export const SPICE_THRESHOLD_MAIN = 0.35;
export const SPICE_THRESHOLD_SIDE = 0.22;

export function ordinal(rank: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  return rank + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function isSpice(line: DeckLine): boolean {
  if (line.zone === "main") {
    return !line.is_land && line.field_pct < SPICE_THRESHOLD_MAIN;
  }
  return line.field_pct < SPICE_THRESHOLD_SIDE;
}

export function primaryType(line: DeckLine): PrimaryType {
  const tl = (line.type_line ?? "").toLowerCase();
  if (line.is_land) return "Lands";
  if (tl.includes("creature")) return "Creatures";
  if (tl.includes("planeswalker")) return "Planeswalkers";
  if (tl.includes("instant")) return "Instants";
  if (tl.includes("sorcery")) return "Sorceries";
  if (tl.includes("enchantment")) return "Enchantments";
  if (tl.includes("artifact")) return "Artifacts";
  if (tl.includes("battle")) return "Battles";
  return "Other";
}

const TYPE_ORDER: PrimaryType[] = [
  "Creatures",
  "Planeswalkers",
  "Instants",
  "Sorceries",
  "Enchantments",
  "Artifacts",
  "Battles",
  "Other",
  "Lands",
];

export function groupByType(lines: DeckLine[]): TypeGroup[] {
  const buckets = new Map<PrimaryType, DeckLine[]>();
  for (const l of lines) {
    const t = primaryType(l);
    let arr = buckets.get(t);
    if (!arr) {
      arr = [];
      buckets.set(t, arr);
    }
    arr.push(l);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => {
      const av = a.mana_value ?? 0;
      const bv = b.mana_value ?? 0;
      if (av !== bv) return av - bv;
      return a.card.localeCompare(b.card);
    });
  }
  const groups: TypeGroup[] = [];
  for (const t of TYPE_ORDER) {
    const cards = buckets.get(t);
    if (!cards || cards.length === 0) continue;
    const count = cards.reduce((s, c) => s + c.qty, 0);
    groups.push({ type: t, cards, count });
  }
  return groups;
}

export function totalQty(lines: DeckLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}

export function spiceCards(deck: DeckPayload): DeckLine[] {
  return [...deck.main, ...deck.side]
    .filter((l) => isSpice(l))
    .sort((a, b) => a.field_pct - b.field_pct);
}

export function rankTier(rank: number): "t1" | "t3" | "t8" | "t16" {
  if (rank === 1) return "t1";
  if (rank <= 3) return "t3";
  if (rank <= 8) return "t8";
  return "t16";
}

export function scopeLabel(scope: EventScope): string {
  switch (scope) {
    case "challenge":
      return "CHALLENGE";
    case "showcase_challenge":
      return "SHOWCASE";
    case "qualifier":
      return "QUALIFIER";
    case "super_qualifier":
      return "RC SUPER";
  }
}

export function exportDeckMTGO(deck: DeckPayload): string {
  const fmtLine = (l: DeckLine) =>
    `${l.qty} ${l.card.replace(" // ", "/")}`;
  const mainLines = [...deck.main]
    .sort((a, b) => {
      if (a.is_land !== b.is_land) return a.is_land ? 1 : -1;
      const av = a.mana_value ?? 0;
      const bv = b.mana_value ?? 0;
      if (av !== bv) return av - bv;
      return a.card.localeCompare(b.card);
    })
    .map(fmtLine);
  const sideLines = [...deck.side]
    .sort((a, b) => a.card.localeCompare(b.card))
    .map(fmtLine);
  const parts = ["Deck", ...mainLines];
  if (sideLines.length > 0) parts.push("", "Sideboard", ...sideLines);
  return parts.join("\n");
}
