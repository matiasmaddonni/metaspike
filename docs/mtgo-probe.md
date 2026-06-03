# MTGO Probe — Findings

Probed: 2026-06-03.

## Summary

**Recommendation: `fetch-and-parse` with native `fetch` + JSON.parse on an embedded payload.** No headless browser required. No `cheerio` required (a single-line regex extracts the JSON blob; `cheerio` is fine if preferred for selector consistency, but not necessary).

## Pages probed

| URL | HTTP | Size | Type |
|---|---|---|---|
| `https://www.mtgo.com/decklist/modern-challenge-64-2026-06-0212843449` | 200 | 338 KB | Challenge (top 32 of 64) |
| `https://www.mtgo.com/decklist/modern-challenge-32-2026-06-0112843430` | 200 | 339 KB | Challenge (top 32 of 32) |
| `https://www.mtgo.com/decklist/modern-league-2026-06-0210628` | 200 | 804 KB | League (5-0 lists) — for filter validation only |
| `https://www.mtgo.com/decklists` | 200 | 52 KB | Index |

Raw HTML cached under `data/mtgo_cache/` for the two Challenge events.

## How data is delivered

Every decklist page embeds the full event payload in a `<script>` tag at line ~273 of the HTML, assigned to `window.MTGO.decklists.data`:

```js
window.MTGO = window.MTGO || {};
window.MTGO.decklists = window.MTGO.decklists || {};
window.MTGO.decklists.data = { ... full event JSON ... };
```

The blob is on a **single source line**, terminated by `};`. Extraction regex:

```ts
const m = html.match(/window\.MTGO\.decklists\.data\s*=\s*(\{.*?\});/);
const data = JSON.parse(m![1]);
```

The page's visible HTML uses Backbone/Underscore-style `<script type="text/html">` templates that hydrate this JSON at render time. The hydrated DOM contains no information not already in the JSON, so there is zero benefit to running a headless browser.

## Challenge payload shape

Top-level keys (Challenge events):

```ts
{
  event_id: string,                // e.g. "12843449"
  description: string,             // e.g. "Modern Challenge 64"
  starttime: string,               // e.g. "2026-06-02 20:00:00.0"
  format: string,                  // MTGO code, e.g. "CMODERN" — see Format codes below
  type: string,                    // "TOURNAMENT" for Challenge, "LEAGUE" for League
  inplayoffs: string,              // "1" | "0"
  url: string,                     // pretty URL (not the decklist URL)
  site_name: string,               // e.g. "modern-challenge-64-2026-06-0212843449" (URL slug)
  decklists: Decklist[],
  standings: Standing[],
  brackets: Bracket[],             // present when inplayoffs === "1"
}
```

`Decklist` shape:

```ts
{
  loginid: string,                 // join key to standings
  tournamentid: string,
  decktournamentid: string,        // unique per posted deck
  player: string,                  // display name (== standings.login_name)
  main_deck: CardEntry[],          // main 60 only
  sideboard_deck: CardEntry[],     // sideboard only (separate array)
}

CardEntry = {
  qty: string,                     // "1" | "2" | "3" | "4" | "60" (basics) — parse as int
  sideboard: "true" | "false",     // redundant with which array it lives in
  card_attributes: {
    digitalobjectcatalogid: string,
    card_name: string,             // MTGO display name (front face for DFC)
    cost: string,                  // converted mana cost as string
    rarity: string,                // "COMMON" | "UNCOMMON" | "RARE" | "MYTHIC" | "PROMO" | ...
    color: string,                 // "COLORLESS" | "WHITE" | ... | "MULTICOLORED"
    cardset: string,               // set code, e.g. "MH3"
    card_type: string,             // "ISCREA", "INSTNT", "LAND  " (trailing whitespace), "ARTFCT", "ENCHMT"
    colors: string[],              // ["COLOR_BLUE", "COLOR_RED"]
  }
}
```

`Standing` shape:

```ts
{
  tournamentid: string,
  loginid: string,
  login_name: string,
  rank: string,                    // "1".."32"
  score: string,                   // match points: 3 * wins + 1 * draws
  opponentmatchwinpercentage: string,
  gamewinpercentage: string,
  opponentgamewinpercentage: string,
  eliminated: "true" | "false",    // knocked out of playoff bracket
}
```

`Bracket` (when `inplayoffs === "1"`): single-elim seeds 1–8 with bracket pairings. Redundant rank info; not strictly needed for ingest.

## Linkage decks ↔ standings

Join on `loginid`. `player` / `login_name` is the display string and may not be globally unique. `loginid` is stable per event.

## Records (W-L) — IMPORTANT

**MTGO does NOT publish a W-L record.** Only `score` (match points). The W-L must be derived. This affects SPEC §4 `decks.record` / `match_wins` / `match_losses`.

Derivation approach (proposed; finalize in Task 7):

- `match_wins = floor(score / 3)`
- `match_draws = score % 3` (0, 1, or 2)
- `match_losses = rounds_played - match_wins - match_draws`

`rounds_played` is event-dependent:
- Swiss rounds for a Challenge-32 event ≈ 5; Challenge-64 ≈ 6 (ceil(log2(event_size)) is the usual heuristic).
- **Top-8 playoff finalists play extra single-elim rounds** that also contribute to `score`. So `score=18` could mean "6-0 Swiss with no playoff" OR "5-1 Swiss + 1 playoff win" — indistinguishable from `score` alone for non-finalists.
- For deck rows where `rank` is in the playoff bracket (1–8), `eliminated === "false"` (won at least one playoff round) implies extra wins.

Pragmatic plan for Task 7:
1. Derive `swiss_rounds` from `ceil(log2(event_size))` or hardcode {32→5, 64→6} (verify against data).
2. For non-playoff ranks (rank > 8): `wins = floor(score/3)`, `losses = swiss_rounds - wins - draws`.
3. For playoff ranks (rank ≤ 8): leave `record`, `match_wins`, `match_losses` null. They participate in the dataset but don't contribute to `archetype_winrate` sums — only Swiss results are clean. Spec already allows null records.
4. Store `score` as a raw column (extension of SPEC §4 — propose adding `decks.score int` for transparency). Surface to UI as needed.

This is a deviation from SPEC §4 worth flagging. See "Spec amendments" below.

## Filtering — what counts as a tournament event

Scope widened 2026-06-03 to include all tournament-tier events MTGO posts with standings, not just events named "Challenge". Specifically: **Challenge (all sizes), Showcase Challenge, RC Qualifier, RC Super Qualifier.** Leagues and Preliminaries remain banned.

Two independent filters, both must pass:

1. **URL slug check** at discovery time:
   - Positive: slug matches `/(challenge|qualifier)/`.
   - Negative: slug does NOT match `/(league|preliminary)/`.
2. **Payload check** at parse time:
   - `type === "TOURNAMENT"`.
   - `Array.isArray(data.standings) && data.standings.length > 0`.
   - `data.description` matches `/(challenge|qualifier)/i`.
   - `data.description` does NOT match `/preliminary/i`.

Map `description` → `events.event_tier`:

| description regex | event_tier |
|---|---|
| `/showcase.*challenge/i` | `showcase_challenge` |
| `/super.*qualifier/i` | `super_qualifier` |
| `/qualifier/i` (after super stripped) | `qualifier` |
| `/challenge/i` | `challenge` |

Order matters — match more-specific first.

League payload shape is entirely different (`playeventid`, `name`, `publish_date`, no `standings`, no `brackets`, no `type`). If a parser is pointed at a League URL by mistake, the absence of `standings` / `type` surfaces immediately rather than silently producing bad data.

## Format codes

MTGO uses internal codes in `data.format`. Mapping table the ingester needs:

| MTGO code | Our `format` |
|---|---|
| `CMODERN` | `modern` |
| `CSTANDARD` | `standard` |
| `CPIONEER` | `pioneer` |
| `CLEGACY` | `legacy` |
| `CVINTAGE` | `vintage` |
| `CPAUPER` | `pauper` |

(Confirm Pioneer / Standard codes from their Challenge pages when extending beyond Modern.)

## Polite-citizen findings

- No `robots.txt` block observed on `/decklist/` paths (verify before backfill).
- No rate-limiting headers surfaced in normal requests.
- All three test fetches returned 200 inside 2s.
- Recommended: 2000ms minimum delay between live requests in the ingester; 0ms on cache-hit replay.

## Spec amendments needed (raise with user)

1. **`decks.score int NOT NULL`** — add this column. It's the only clean number MTGO publishes; deriving `match_wins` / `match_losses` from it requires `event_size` + Swiss-round assumption. Storing the source-of-truth match points means re-deriving records later is trivial.
2. **Playoff finishers (`rank ≤ 8`, `eliminated === "false"`)** — confirm: leave `record` / `match_wins` / `match_losses` null and exclude from `archetype_winrate` sums (still counted in `n_decks`). Add `n_decks_with_record` to winrate response (already in SPEC §5).
3. **Card-name edge cases observed:** `card_type` field has trailing spaces (`"LAND  "`). Trim during ingest. `rarity` includes `"PROMO"` which appears for any printing reissued in Secret Lair-style products — don't filter on rarity.

## Verification

- [x] Two Challenge events of different size tiers (32 + 64) parsed identically.
- [x] Sideboard cards isolated in a dedicated `sideboard_deck` array.
- [x] Standings link to decks via `loginid`.
- [x] League page distinguishable from Challenge by both URL slug and payload shape.
- [x] No headless browser required.

## Next steps

- Task 2 — scaffold repo (npm + supabase init).
- Task 5 — implement `lib/mtgo/fetch.ts` with the polite-fetch + cache pattern from this probe.
- Task 6 — implement `lib/mtgo/parse.ts` against the shape documented above.
- Before Task 7 — confirm the three spec amendments listed above with the user.
