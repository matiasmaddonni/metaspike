// Mock data ported from design_handoff_metaspike/data/mockData.js.
// Replaced with live Supabase RPC calls in Task 17.
import type {
  ArchetypeMeta,
  CardStatsResponse,
  CardStatsRow,
  CopyBreakdown,
  WinrateResponse,
  Zone,
} from "./types/cardStats.js";

const TOTAL = 64;

function scryfallArtUrl(name: string): string {
  const front = name.split(" // ")[0];
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(front)}&format=image&version=art_crop&face=front`;
}

type RawCard = [string, number, string, string[], Partial<CopyBreakdown>];

const MAIN_RAW: RawCard[] = [
  ["Ragavan, Nimble Pilferer", 1, "Legendary Creature — Monkey Pirate", ["R"], { "4": 60, "3": 2, "2": 1 }],
  ["Ocelot Pride", 1, "Legendary Creature — Cat", ["W"], { "4": 58, "3": 3 }],
  ["Guide of Souls", 1, "Creature — Angel", ["W"], { "4": 55, "3": 4, "2": 2 }],
  ["Galvanic Discharge", 1, "Instant", ["R"], { "4": 50, "3": 6, "2": 3 }],
  ["Phlage, Titan of Fire's Fury", 5, "Legendary Creature — Elder Giant", ["R", "W"], { "2": 34, "3": 14, "1": 6 }],
  ["Goblin Bombardment", 2, "Enchantment", ["R"], { "2": 30, "3": 18, "1": 9 }],
  ["Amped Raptor", 2, "Creature — Dinosaur", ["R"], { "4": 30, "3": 12, "2": 8 }],
  ["Static Prison", 2, "Enchantment", ["W"], { "2": 24, "1": 14, "3": 8 }],
  ["Emberheart Challenger", 1, "Creature — Goblin Warrior", ["R"], { "4": 18, "3": 8, "2": 6 }],
  ["Ajani, Nacatl Pariah", 2, "Legendary Creature — Cat Warrior", ["W"], { "1": 12, "2": 13, "3": 4 }],
  ["Seasoned Pyromancer", 3, "Creature — Human Shaman", ["R"], { "2": 10, "1": 6, "3": 3 }],
  ["Recruitment Officer", 1, "Creature — Human Soldier", ["W"], { "4": 8, "2": 4, "1": 2 }],
  ["Sunspine Lynx", 4, "Creature — Elemental Cat", ["R"], { "2": 5, "3": 4 }],
  ["Witch Enchanter // Witch-Blessed Meadow", 4, "Creature — Elemental // Land", ["W"], { "1": 6, "2": 4 }],
  ["Blood Moon", 3, "Enchantment", ["R"], { "2": 5, "1": 3 }],
  ["Inspiring Vantage", 0, "Land", [], { "4": 55, "3": 5 }],
  ["Sacred Foundry", 0, "Land — Mountain Plains", [], { "2": 30, "3": 20, "1": 9 }],
  ["Arid Mesa", 0, "Land", [], { "4": 40, "3": 14, "2": 4 }],
  ["Sunbaked Canyon", 0, "Land", [], { "3": 30, "2": 18, "4": 7 }],
  ["Den of the Bugbear", 0, "Land", [], { "2": 30, "3": 15, "1": 6 }],
  ["Plains", 0, "Basic Land — Plains", [], { "2": 24, "1": 20, "3": 18 }],
  ["Mountain", 0, "Basic Land — Mountain", [], { "2": 30, "1": 18, "3": 13 }],
];

const SIDE_RAW: RawCard[] = [
  ["Wear // Tear", 1, "Instant // Instant", ["R", "W"], { "2": 28, "1": 8, "3": 4 }],
  ["Disruptor Flute", 1, "Artifact", [], { "2": 20, "1": 10, "3": 5 }],
  ["Blood Moon", 3, "Enchantment", ["R"], { "1": 20, "2": 12 }],
  ["Prismatic Ending", 1, "Sorcery", ["W"], { "2": 18, "1": 9, "3": 4 }],
  ["Wrath of the Skies", 4, "Sorcery", ["W"], { "2": 18, "1": 9 }],
  ["Soulless Jailer", 3, "Artifact", [], { "1": 16, "2": 9 }],
  ["Ghost Vacuum", 1, "Artifact", [], { "1": 12, "2": 7 }],
  ["Smash to Smithereens", 2, "Instant", ["R"], { "2": 10, "1": 7 }],
  ["Path to Exile", 1, "Instant", ["W"], { "1": 10, "2": 6 }],
  ["Sunspine Lynx", 4, "Creature — Elemental Cat", ["R"], { "2": 8, "1": 5 }],
  ["Kor Firewalker", 2, "Creature — Kor Soldier", ["W"], { "2": 5, "1": 4 }],
  ["Pyroclasm", 2, "Sorcery", ["R"], { "2": 4, "1": 3 }],
];

function expand(raw: RawCard[], zone: Zone): CardStatsRow[] {
  return raw.map(([card_name, mana_value, type_line, colors, partial]) => {
    const breakdown: CopyBreakdown = {
      "1": partial["1"] ?? 0,
      "2": partial["2"] ?? 0,
      "3": partial["3"] ?? 0,
      "4": partial["4"] ?? 0,
      "5+": partial["5+"] ?? 0,
    };
    const n_decks =
      breakdown["1"] + breakdown["2"] + breakdown["3"] + breakdown["4"] + breakdown["5+"];
    const weighted =
      1 * breakdown["1"] +
      2 * breakdown["2"] +
      3 * breakdown["3"] +
      4 * breakdown["4"] +
      5 * breakdown["5+"];
    return {
      card_name,
      scryfall_id: null,
      image_url: scryfallArtUrl(card_name),
      mana_value,
      type_line,
      colors,
      zone,
      inclusion_pct: TOTAL > 0 ? n_decks / TOTAL : 0,
      avg_copies: n_decks > 0 ? weighted / n_decks : 0,
      copy_breakdown: breakdown,
      n_decks,
    };
  });
}

export function mockCardStats(zone: Zone): CardStatsResponse {
  return {
    rows: expand(zone === "side" ? SIDE_RAW : MAIN_RAW, zone),
    meta: { total_decks: TOTAL },
  };
}

export function mockWinrate(): WinrateResponse {
  const wins = 412;
  const losses = 233;
  return {
    n_decks: TOTAL,
    n_events: 8,
    match_wins: wins,
    match_losses: losses,
    win_pct: wins / (wins + losses),
    n_decks_with_record: TOTAL,
    basis: "published winners only",
  };
}

export const MOCK_ARCHETYPE: ArchetypeMeta = {
  name: "Boros Energy",
  format: "modern",
  colors: ["W", "R"],
  slug: "boros-energy",
};

export const MOCK_DATE_LABEL = "last 90 days";
