import type {
  EventTier,
  Format,
  ParsedCard,
  ParsedDeck,
  ParsedEvent,
} from "./types.js";

const MTGO_FORMAT_MAP: Record<string, Format> = {
  CMODERN: "modern",
  CSTANDARD: "standard",
  CPIONEER: "pioneer",
};

export class NotTournamentError extends Error {
  constructor(reason: string) {
    super(`Not a tournament event: ${reason}`);
    this.name = "NotTournamentError";
  }
}

export class ParseError extends Error {
  constructor(reason: string) {
    super(`MTGO parse failed: ${reason}`);
    this.name = "ParseError";
  }
}

type RawCard = {
  qty: string;
  sideboard: "true" | "false";
  card_attributes: {
    card_name: string;
  };
};

type RawDecklist = {
  loginid: string;
  player: string;
  main_deck?: RawCard[];
  sideboard_deck?: RawCard[];
};

type RawStanding = {
  loginid: string;
  rank: string;
  score: string;
};

type RawPayload = {
  event_id?: string;
  description?: string;
  starttime?: string;
  format?: string;
  type?: string;
  site_name?: string;
  decklists?: RawDecklist[];
  standings?: RawStanding[];
};

function extractPayload(html: string): RawPayload {
  const m = html.match(/window\.MTGO\.decklists\.data\s*=\s*(\{.*?\});/);
  if (!m) throw new ParseError("payload not found (window.MTGO.decklists.data)");
  try {
    return JSON.parse(m[1]) as RawPayload;
  } catch (e) {
    throw new ParseError(`payload JSON.parse failed: ${(e as Error).message}`);
  }
}

function tournamentTier(description: string): EventTier {
  if (/showcase.*challenge/i.test(description)) return "showcase_challenge";
  if (/super.*qualifier/i.test(description)) return "super_qualifier";
  if (/qualifier/i.test(description)) return "qualifier";
  if (/challenge/i.test(description)) return "challenge";
  throw new NotTournamentError(`description does not map to a tier: "${description}"`);
}

function assertTournament(data: RawPayload): void {
  if (data.type !== "TOURNAMENT") {
    throw new NotTournamentError(`type is "${data.type ?? "<missing>"}"`);
  }
  if (!Array.isArray(data.standings) || data.standings.length === 0) {
    throw new NotTournamentError("standings[] missing or empty");
  }
  const desc = data.description ?? "";
  if (!/(challenge|qualifier)/i.test(desc)) {
    throw new NotTournamentError(`description "${desc}" lacks challenge/qualifier`);
  }
  if (/preliminary/i.test(desc)) {
    throw new NotTournamentError(`description "${desc}" matches preliminary`);
  }
}

function mapCards(raw: RawCard[] | undefined, zone: "main" | "side"): ParsedCard[] {
  if (!raw) return [];
  const merged = new Map<string, number>();
  for (const c of raw) {
    const name = c.card_attributes?.card_name;
    const qty = parseInt(c.qty, 10);
    if (!name || !Number.isFinite(qty) || qty <= 0) continue;
    merged.set(name, (merged.get(name) ?? 0) + qty);
  }
  return [...merged.entries()].map(([card_name, qty]) => ({ card_name, qty, zone }));
}

export function parseEvent(
  html: string,
  ctx: { sourceUrl: string; cachePath: string },
): ParsedEvent {
  const data = extractPayload(html);
  assertTournament(data);

  const mtgoFormat = data.format ?? "";
  const format = MTGO_FORMAT_MAP[mtgoFormat];
  if (!format) {
    throw new ParseError(`unsupported format code "${mtgoFormat}"`);
  }

  const description = data.description!;
  const event_tier = tournamentTier(description);
  const mtgo_event_id = data.event_id ?? data.site_name;
  if (!mtgo_event_id) {
    throw new ParseError("event_id and site_name both missing");
  }
  const starttime = data.starttime ?? "";
  const event_date = starttime.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    throw new ParseError(`bad event_date derived from starttime "${starttime}"`);
  }

  const standingsByLogin = new Map<string, RawStanding>();
  for (const s of data.standings ?? []) {
    standingsByLogin.set(s.loginid, s);
  }

  const decklists = data.decklists ?? [];
  const decks: ParsedDeck[] = [];
  for (const d of decklists) {
    const s = standingsByLogin.get(d.loginid);
    if (!s) {
      throw new ParseError(
        `no standings entry for loginid ${d.loginid} (player ${d.player})`,
      );
    }
    const rank = parseInt(s.rank, 10);
    const score = parseInt(s.score, 10);
    if (!Number.isFinite(rank) || !Number.isFinite(score)) {
      throw new ParseError(
        `bad rank/score for ${d.player}: rank=${s.rank} score=${s.score}`,
      );
    }
    decks.push({
      player: d.player,
      loginid: d.loginid,
      rank,
      score,
      main: mapCards(d.main_deck, "main"),
      side: mapCards(d.sideboard_deck, "side"),
    });
  }

  return {
    mtgo_event_id,
    source_url: ctx.sourceUrl,
    raw_cache_path: ctx.cachePath,
    event_name: description,
    event_tier,
    format,
    event_date,
    event_size: decks.length,
    decks,
  };
}
