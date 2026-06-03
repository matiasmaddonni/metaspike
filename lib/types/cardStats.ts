export type Zone = "main" | "side";

export type CopyBreakdown = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5+": number;
};

export type CardStatsRow = {
  card_name: string;
  scryfall_id: string | null;
  image_url: string | null;
  mana_value: number | null;
  type_line: string | null;
  colors: string[];
  zone: Zone;
  inclusion_pct: number;
  avg_copies: number;
  copy_breakdown: CopyBreakdown;
  n_decks: number;
};

export type CardStatsResponse = {
  rows: CardStatsRow[];
  meta: { total_decks: number };
};

export type WinrateResponse = {
  n_decks: number;
  n_events: number;
  match_wins: number;
  match_losses: number;
  win_pct: number | null;
  n_decks_with_record: number;
  basis: "published winners only";
};

export type ArchetypeMeta = {
  name: string;
  format: string;
  colors: string[];
  slug: string | null;
};

export type Bucket = "core" | "flex" | "tech";

export type BucketedRow = CardStatsRow & { bucket: Bucket };
