import type { Zone } from "./cardStats.js";

export type EventScope =
  | "challenge"
  | "showcase_challenge"
  | "qualifier"
  | "super_qualifier";

export type DeckLine = {
  card: string;
  qty: number;
  zone: Zone;
  type_line: string | null;
  colors: string[];
  mana_value: number | null;
  is_land: boolean;
  image_url: string | null;
  scryfall_id: string | null;
  field_pct: number;
};

export type DeckPayload = {
  deck_id: number;
  player: string;
  rank: number;
  record: string | null;
  event_id: number;
  event_name: string;
  event_date: string;
  event_scope: EventScope;
  entrants: number | null;
  main: DeckLine[];
  side: DeckLine[];
};

export type EventPayload = {
  id: number;
  name: string;
  date: string;
  scope: EventScope;
  entrants: number | null;
  n_decks: number;
  top_finish: number;
  decks: DeckPayload[];
};

export type ListEventsResponse = EventPayload[];

export type PrimaryType =
  | "Creatures"
  | "Planeswalkers"
  | "Instants"
  | "Sorceries"
  | "Enchantments"
  | "Artifacts"
  | "Battles"
  | "Lands"
  | "Other";

export type TypeGroup = {
  type: PrimaryType;
  cards: DeckLine[];
  count: number;
};
