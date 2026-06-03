export type FetchResult = {
  html: string;
  status: number;
  finalUrl: string;
  fromCache: boolean;
  cachePath: string;
  slug: string;
};

export type ParsedCard = {
  card_name: string;
  qty: number;
  zone: "main" | "side";
};

export type ParsedDeck = {
  player: string;
  loginid: string;
  rank: number;
  score: number;
  main: ParsedCard[];
  side: ParsedCard[];
};

export type EventTier =
  | "challenge"
  | "showcase_challenge"
  | "qualifier"
  | "super_qualifier";

export type Format = "modern" | "standard" | "pioneer";

export type ParsedEvent = {
  mtgo_event_id: string;
  source_url: string;
  raw_cache_path: string;
  event_name: string;
  event_tier: EventTier;
  format: Format;
  event_date: string;
  event_size: number;
  decks: ParsedDeck[];
};
