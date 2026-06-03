# MetaSpike — Backend + Data Layer Spec

A backend + data layer for an MTG deckbuilding companion that analyzes how top finishers build and sideboard within specific archetypes, for any 1v1 (75-card) constructed format.

This document is the source of truth for the backend build. The UI is being built in parallel and consumes the RPC contract defined below verbatim.

---

## 1. Objective

Build a queryable dataset of competitive 1v1 MTG decklists with archetype classification, so a UI can answer:

- "How do top finishers build archetype X in format Y over date range Z?"
- "What's the inclusion rate, copy distribution, and average copy count of each card in that archetype?"
- "What sideboard cards are common and at what counts?"
- "What's the win rate of the archetype among published winners?"
- "How do these two specific deck builds differ?"

**Target user:** the project owner (personal tool, single operator for now). UI is the consumer; this spec covers backend + data only.

**Non-goals (for now):**
- No matchmaking / live-play features.
- No commander / multiplayer formats.
- No deck-recommendation engine.
- No automated scheduling — this is a dataset, not a pipeline.

---

## 2. Stack

- **Language:** TypeScript (`^5`).
- **Runtime for scripts:** `tsx` (matches `madd-collectibles`).
- **Database:** Supabase Postgres, local CLI only for now (`supabase init` + Docker). Hosted project deferred.
- **HTML parsing:** `cheerio` if pages are server-rendered; native `fetch` for JSON endpoints.
- **External data:** Scryfall bulk data (`default-cards` or `oracle-cards`) cached to disk; never per-card calls at view time.
- **Migrations:** numbered SQL files under `supabase/migrations/NNN_description.sql` (madd-collectibles convention).
- **Linting / types:** ESLint + `tsc --noEmit` (mirror madd-collectibles config when scaffolding).

---

## 3. Firm Data Rules

These are non-negotiable. The ingester and classifier must honor them.

1. **Source of truth:** `mtgo.com` published decklists.
2. **Tournament events only — never leagues, never preliminaries, never 5-0 lists.** Specifically: Challenge (all sizes), Showcase Challenge, RC Qualifier, RC Super Qualifier, and any future tournament-tier event MTGO posts with standings. Detection rule:
   - `type === "TOURNAMENT"` AND `standings[]` non-empty
   - AND `description` matches `/(challenge|qualifier)/i`
   - AND `description` does NOT match `/preliminary/i`
3. **Take-as-published.** Ingest exactly the lists MTGO posts per event. MTGO already caps to top 8 / 16 / 32 based on event size — do not apply additional rank thresholds.
4. **Multi-format by design.** `format` is a first-class column on every relevant table. Backfill Modern first; Standard + Pioneer later via config only — no schema changes required.
5. **Archetype classification is signature-based on MTGO card data.** Match rules live in the `archetype_match_rule` table. The classifier reads that table; it does not contain hardcoded archetypes.
6. **Archetypes themselves are not invented by the build.** The `archetype` and `archetype_match_rule` tables are created empty. The user supplies the 4 starting archetypes + match rules later.
7. **Win rate** is computed only over published challenge records and must be labeled `'published winners only'` (survivorship-biased by definition). If a deck has no posted match record, it does not contribute to `match_wins` / `match_losses`, but it still counts in `n_decks`.

---

## 4. Schema

All tables live in the `public` schema. Format is enforced via a CHECK constraint, not a Postgres enum (additive).

```sql
-- format check constraint reused across tables
CHECK (format IN ('modern', 'standard', 'pioneer'))
```

### `events`
| col | type | notes |
|---|---|---|
| `id` | bigserial PK | |
| `mtgo_event_id` | text UNIQUE NOT NULL | MTGO URL slug or event id, used for idempotent ingest |
| `format` | text NOT NULL | CHECK constraint above |
| `event_name` | text NOT NULL | e.g. "Modern Challenge 32" |
| `event_tier` | text NOT NULL | CHECK in (`'challenge'`, `'showcase_challenge'`, `'qualifier'`, `'super_qualifier'`); derived from `description` at ingest |
| `event_date` | date NOT NULL | event date as posted by MTGO |
| `event_size` | int | total posted deck count for this event |
| `source_url` | text NOT NULL | original MTGO page |
| `raw_cache_path` | text | path under `data/mtgo_cache/` for re-parse |
| `ingested_at` | timestamptz default now() | |

### `decks`
| col | type | notes |
|---|---|---|
| `id` | bigserial PK | |
| `event_id` | bigint FK events(id) NOT NULL | |
| `format` | text NOT NULL | denormalized from event for fast filtering |
| `player` | text NOT NULL | MTGO posts this string; may be anonymized |
| `rank` | int NOT NULL | final standing as posted |
| `score` | int NOT NULL | match points as MTGO posts (`3 * wins + 1 * draws`); **only stored W/L signal**. No derived `record` / `match_wins` / `match_losses` columns — RPCs derive at query time using `score + events.event_size + swiss-round heuristic`. |
| `archetype_id` | int FK archetype(id) NULL | filled by classifier at ingest; null = unclassified |
| `UNIQUE` | `(event_id, player, rank)` | |

### `deck_cards`
| col | type | notes |
|---|---|---|
| `deck_id` | bigint FK decks(id) NOT NULL | |
| `card_name` | text NOT NULL | exactly as MTGO posted (front face for DFC) |
| `zone` | text NOT NULL | CHECK in (`'main'`, `'side'`) |
| `qty` | int NOT NULL CHECK (qty > 0) | |
| `scryfall_id` | uuid FK cards(scryfall_id) NULL | populated by enrichment |
| `PRIMARY KEY` | `(deck_id, card_name, zone)` | same card in both zones is two rows |

### `cards`
| col | type | notes |
|---|---|---|
| `scryfall_id` | uuid PK | |
| `oracle_id` | uuid NOT NULL | |
| `name` | text NOT NULL | full Scryfall name |
| `name_front` | text NOT NULL | front face only, used to match MTGO card_name |
| `mana_value` | int | Scryfall `cmc` |
| `type_line` | text | |
| `colors` | text[] | Scryfall `colors` |
| `image_url` | text | Scryfall `image_uris.normal` or front face image |
| `enriched_at` | timestamptz default now() | |
| INDEX | `(name_front)` for ingest-time matching | |

### `archetype`
| col | type | notes |
|---|---|---|
| `id` | serial PK | |
| `format` | text NOT NULL | CHECK constraint above |
| `name` | text NOT NULL | e.g. "Boros Energy" |
| `description` | text | |
| `UNIQUE` | `(format, name)` | same name allowed across formats |

Table starts empty. The user populates it.

### `archetype_match_rule`
Flat table; rules within the same `group_id` combine with AND, across groups combine with OR.

| col | type | notes |
|---|---|---|
| `id` | serial PK | |
| `archetype_id` | int FK archetype(id) NOT NULL | |
| `zone` | text NOT NULL | CHECK in (`'main'`, `'side'`, `'any'`) |
| `card_name` | text NOT NULL | matched against `deck_cards.card_name` |
| `min_qty` | int NOT NULL DEFAULT 1 | |
| `group_id` | int NOT NULL | rules in same group = AND |
| `group_op` | text NOT NULL DEFAULT 'all' | always 'all' for now; reserved for future expansion |

Table starts empty.

---

## 5. RPC Contract (verbatim — UI depends on this)

All RPCs are `SECURITY DEFINER`, granted `EXECUTE` to `anon` and `authenticated`. No write paths exposed to anon.

### `archetype_card_stats(p_format text, p_archetype_id int, p_date_from date, p_date_to date, p_zone text)`
- `p_zone` ∈ `'main'` | `'side'`.
- Denominator (`total_decks`) = decks matching `(format, archetype_id, event_date in [from,to])`.
- `inclusion_pct` = decks containing the card in `p_zone` / `total_decks` (range `0..1`).
- `avg_copies` = average `qty` **over decks that play the card** (decision: 2026-06-03).
- `copy_breakdown` keys: `"1"`, `"2"`, `"3"`, `"4"`, `"5+"` (decision: 2026-06-03). Counts decks at each copy count for the card in `p_zone`.
- Basic lands (`Plains`, `Island`, `Swamp`, `Mountain`, `Forest`, `Wastes`, `Snow-Covered *`) excluded by default from output. (TODO: add `p_include_basics boolean default false` if UI needs it.)
- Returns `rows[]` of `{card_name, scryfall_id, image_url, mana_value, type_line, colors, zone, inclusion_pct, avg_copies, copy_breakdown, n_decks}` plus `meta {total_decks}`.

### `archetype_winrate(p_format, p_archetype_id, p_date_from, p_date_to)`
- `n_decks` = decks matching filters.
- `n_events` = distinct events with ≥1 deck of this archetype in range.
- `match_wins` / `match_losses` = sums of parsed records; decks with `null record` excluded from these sums but counted in `n_decks`.
- `n_decks_with_record` added to response so the UI can show the basis. (Spec extension on top of contract — non-breaking, UI can ignore.)
- `win_pct` = `match_wins / (match_wins + match_losses)`; null if denominator = 0.
- `basis` literal string `'published winners only'`.

### `list_decks(p_format, p_archetype_id, p_date_from, p_date_to)`
- Returns `rows[]` of `{deck_id, player, event_name, event_date, rank, record, archetype_id}` ordered by `event_date DESC, rank ASC`.
- `record` derived from `score` + `event_size` + Swiss-round heuristic at query time (e.g. `"5-2"`). Null for playoff finishers where Swiss/bracket can't be separated.
- Excludes unclassified decks (archetype_id IS NULL).

### `compare_decks(p_deck_id_a int, p_deck_id_b int)`
- Operates over `main + side`. Each row is tagged with its `zone` so the UI can group.
- `only_in_a`: `[{card, qty, zone}]` cards present in A but not in B for that zone.
- `only_in_b`: same, reversed.
- `shared`: `[{card, qty_a, qty_b, zone}]` cards present in both with both quantities.

---

## 6. Project Structure

```
metaspike/
├── SPEC.md                          ← this doc
├── README.md                         ← brief, generated last
├── package.json                      ← tsx, supabase-js, cheerio, dotenv
├── tsconfig.json
├── .env.example                      ← SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
├── supabase/
│   ├── config.toml                   ← from `supabase init`
│   └── migrations/
│       ├── 001_schema.sql            ← all tables + constraints + indexes
│       ├── 002_archetype.sql         ← archetype + archetype_match_rule (empty)
│       └── 003_rpcs.sql              ← all four RPCs + grants
├── scripts/
│   ├── probe-mtgo.ts                 ← step 1: inspect one Challenge page, report format
│   ├── ingest-challenges.ts          ← step 3: Challenge-only ingester
│   ├── enrich-scryfall.ts            ← step 4: bulk download + match deck_cards → cards
│   ├── classify-archetypes.ts        ← runs archetype_match_rule logic, updates deck.archetype_id
│   └── backfill.ts                   ← step 6: orchestrator, calls ingest + enrich + classify
├── lib/
│   ├── supabase.ts                   ← service-role client for scripts
│   ├── mtgo/
│   │   ├── fetch.ts                  ← polite fetch w/ cache to data/mtgo_cache/
│   │   ├── parse.ts                  ← page → {event, decks, deck_cards}
│   │   └── types.ts
│   └── scryfall/
│       ├── bulk.ts                   ← download + cache bulk data
│       └── match.ts                  ← MTGO name → scryfall row (handles DFC front-face)
├── data/                             ← gitignored, local cache only
│   ├── mtgo_cache/
│   └── scryfall_cache/
└── .gitignore
```

---

## 7. Commands

```
npm run typecheck          # tsc --noEmit
npm run lint               # eslint
npm run db:start           # supabase start
npm run db:reset           # supabase db reset (applies migrations from scratch)
npm run db:migrate         # supabase migration up

npm run probe              # scripts/probe-mtgo.ts — fetches one Modern Challenge,
                           # reports whether data is embedded JSON or DOM-rendered
npm run scryfall:sync      # scripts/enrich-scryfall.ts — refreshes bulk + cards table
npm run ingest             # scripts/ingest-challenges.ts -- --format modern --from 2026-05-19
npm run classify           # scripts/classify-archetypes.ts — recomputes deck.archetype_id
npm run backfill           # scripts/backfill.ts -- --format modern --from 2026-05-19
```

---

## 8. Code Style

- **Match `madd-collectibles` conventions** where applicable (Supabase client layout under `lib/supabase/`, numbered migrations, tsx scripts under `scripts/`).
- TypeScript strict mode; no `any` in domain code.
- Scripts are linear top-to-bottom with named functions, not classes.
- SQL: lowercase keywords or uppercase — match what madd-collectibles' migrations already use.
- No comments unless behavior is non-obvious. Names carry meaning.
- One concern per migration file. New tables = new file, never edit a shipped migration.

---

## 9. Testing Strategy

Minimal for now — this is a dataset build, not a long-lived service.

- **Probe script** is the only test for MTGO parsing reliability: re-run on N recent events and confirm shape.
- **SQL-level smoke**: after backfill, run a hand-checked query per RPC against known input/output to validate.
- **No unit tests** for ingester unless a parse bug surfaces, then add a fixture test from cached HTML.
- **No integration tests** against MTGO live (rate-limit risk).

Acceptance for "backfill done":
- `select count(*) from events where format='modern' and event_date >= '2026-05-19'` ≥ 1 row per known Modern Challenge in the window.
- `select count(*) from decks where archetype_id is null` reported (expected nonzero until archetypes are populated).
- All 4 RPCs return non-error responses for a sample `(format='modern', archetype_id=?, from='2026-05-19', to=today)` once at least one archetype + rules are populated by the user.

---

## 10. Boundaries

### Always do
- Use Challenge events only from `mtgo.com`.
- Take-as-published — ingest the full list MTGO posts per event, no extra rank filtering.
- Stamp every row with `format`.
- Cache raw MTGO responses to disk under `data/mtgo_cache/` before parsing.
- Run Scryfall enrichment from bulk data, cached locally.
- Label win rate as `'published winners only'`.
- Match `madd-collectibles` conventions for Supabase client layout, migration numbering, and tsx scripts.

### Ask first
- Adding a new RPC or changing an existing RPC's signature (UI depends on the contract).
- Changing the `format` CHECK constraint to add a new format.
- Touching the `archetype` or `archetype_match_rule` schema once the user has populated rows.
- Hosting a Supabase cloud project (deferred until UI side requests it).

### Never do
- Never ingest leagues, prelims, or 5-0 lists.
- Never invent archetypes or seed `archetype` / `archetype_match_rule` with placeholder rows.
- Never apply rank thresholds on top of what MTGO posts.
- Never make per-card Scryfall API calls at view time.
- Never modify global git config; the per-repo SSH + identity setup is already in place.
- Never embed a PAT in a remote URL.
- Never bypass git hooks (`--no-verify`) or signing.
- Never expose write paths through RPCs.
- Never schedule (cron, GitHub Actions, etc.) — this is a one-shot dataset build.

---

## 11. Open items deferred to next session

- Probe a real recent Modern Challenge page (step 1 of execution) — fetch-and-parse vs headless decision lives in the probe output, not in this spec.
- DFC / MDFC edge cases beyond front-face mapping (split cards, adventures): defer until a failed enrichment surfaces one.
- Whether to expose `p_include_basics` on `archetype_card_stats`: defer until UI asks.
- Hosted Supabase project setup: defer until UI side is ready.

---

## 12. Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-06-03 | `avg_copies` averages **only over decks that play the card** | inclusion_pct already carries prevalence; matches mtgtop8/mtggoldfish convention |
| 2026-06-03 | `copy_breakdown` adds `"5+"` bucket | Persistent Petitioners / Dragon's Approach / basics break a 1-4 cap |
| 2026-06-03 | `compare_decks` rows tagged with `zone` | preserves main/side distinction without nesting |
| 2026-06-03 | Supabase local CLI only for now | cheap, fast; hosted deferred |
| 2026-06-03 | `archetype_match_rule` is a flat table with AND/OR groups | readable, queryable, no jsonb |
| 2026-06-03 | Unclassified decks excluded from archetype RPCs | RPCs require archetype_id; sentinel adds noise |
| 2026-06-03 | Backfill window: `2026-05-19 → today (2026-06-03)` | post-Phlage ban in Modern; clean meta baseline |
| 2026-06-03 | Format CHECK = (`modern`, `standard`, `pioneer`) | starting scope; expandable via migration |
| 2026-06-03 | `archetype_winrate` adds `n_decks_with_record` | UI can show winrate basis without breaking original contract |
| 2026-06-03 | Ingest scope widened from "Challenge only" → all tournament events (Challenge, Showcase Challenge, RC Qualifier, RC Super Qualifier) | User clarification after probe; prelims still excluded; leagues still excluded |
| 2026-06-03 | `decks.score int NOT NULL` is the **only** stored W/L signal; no derived columns on decks | User preference: store source-of-truth match points; RPCs derive W-L on the fly using `score + event_size + swiss-round heuristic` |
| 2026-06-03 | Add `events.event_tier text` (CHECK in `challenge`/`showcase_challenge`/`qualifier`/`super_qualifier`) | Classify at ingest from description so RPCs can filter by tier later if needed |
