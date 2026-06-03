# Implementation Plan: MetaSpike Backend + Data Layer

## Overview

Decompose [SPEC.md](SPEC.md) into ordered, verifiable tasks. Build vertically: each phase ends with a working slice. Foundation first (probe + schema), then a single-event end-to-end pipeline, then archetype classification + remaining RPCs, then the windowed backfill.

## Architecture Decisions (carried from SPEC.md)

- Local Supabase only for now (`supabase init` + Docker).
- Numbered SQL migrations: `001_schema`, `002_archetype`, `003_rpcs`. One concern per file.
- `lib/` for reusable modules, `scripts/` for tsx entry points (matches `madd-collectibles`).
- All raw MTGO responses cached under `data/mtgo_cache/` before parse.
- Scryfall enrichment is offline from bulk data, never per-card at view time.
- Classifier runs at ingest (and on demand); stores `decks.archetype_id`.

---

## Task List

### Phase 1 — Foundation

#### Task 1: Probe MTGO Challenge page

**Description:** Fetch one recent Modern Challenge decklist page from `mtgo.com`. Determine how data is delivered: embedded JSON payload (e.g. `<script>` blob, `__NEXT_DATA__`-style, or inline JS object) vs. client-rendered DOM requiring a headless browser. Inspect ≥2 events to confirm pattern consistency. Output a short report + recommendation (fetch-and-parse vs headless) and the exact selector / payload key the ingester should target.

**Acceptance criteria:**
- [ ] Report committed as `docs/mtgo-probe.md` covering: URL probed, HTTP status, response shape, where decklist data lives in the response, whether `cheerio` alone is sufficient.
- [ ] Recommendation explicit: `fetch-and-parse` OR `headless`.
- [ ] A second event of a different size (e.g. 32 vs 64) confirms the same shape.

**Verification:**
- [ ] `curl -sI <event_url>` returns 200.
- [ ] Manual inspection of saved HTML confirms decklist data location.
- [ ] Human reviews `docs/mtgo-probe.md` before Task 6 begins.

**Dependencies:** None.

**Files likely touched:**
- `scripts/probe-mtgo.ts` (new)
- `docs/mtgo-probe.md` (new)
- `data/mtgo_cache/<event_id>.html` (gitignored)

**Scope:** S.

---

#### Task 2: Repo scaffold

**Description:** Bootstrap the project to mirror `madd-collectibles` conventions. Initialize npm with TS + tsx + Supabase JS + cheerio + dotenv. Add `tsconfig.json` (strict), `.gitignore`, `.env.example`, `eslint.config.mjs`. Run `supabase init`.

**Acceptance criteria:**
- [ ] `package.json` has the scripts listed in SPEC §7.
- [ ] `tsc --noEmit` passes on an empty project.
- [ ] `.gitignore` excludes `node_modules`, `data/`, `.env*` (except `.env.example`), `.next`-style artifacts, `supabase/.temp/`.
- [ ] `.env.example` lists `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `supabase/` directory exists with `config.toml`.

**Verification:**
- [ ] `npm install` succeeds.
- [ ] `npm run typecheck` passes.
- [ ] `supabase start` succeeds locally (Docker required).

**Dependencies:** None.

**Files likely touched:** `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `eslint.config.mjs`, `supabase/config.toml`.

**Scope:** S.

---

#### Task 3: Migration 001 — core schema

**Description:** Author `supabase/migrations/001_schema.sql` covering `events`, `decks`, `deck_cards`, `cards` exactly as SPEC §4 prescribes. Include CHECK constraints, indexes, foreign keys, and the `(event_id, player, rank)` unique on decks plus the `(deck_id, card_name, zone)` PK on deck_cards.

**Acceptance criteria:**
- [ ] All four tables present with exact column types from SPEC §4.
- [ ] `format` CHECK constraint = `('modern', 'standard', 'pioneer')`.
- [ ] `events.event_tier` CHECK in (`'challenge'`, `'showcase_challenge'`, `'qualifier'`, `'super_qualifier'`), NOT NULL.
- [ ] `decks.score int NOT NULL` (MTGO source-of-truth match points; no derived W-L columns on the table).
- [ ] Index on `cards(name_front)`.
- [ ] Index on `decks(format, archetype_id, event_id)` for RPC hot path.
- [ ] Index on `deck_cards(card_name, zone)` for stats RPC.

**Verification:**
- [ ] `supabase db reset` applies cleanly.
- [ ] `\d events` / `\d decks` / `\d deck_cards` / `\d cards` in psql show expected schema.

**Dependencies:** Task 2.

**Files likely touched:** `supabase/migrations/001_schema.sql`.

**Scope:** S.

---

#### Task 4: Migration 002 — archetype tables (empty)

**Description:** Author `supabase/migrations/002_archetype.sql` creating `archetype` and `archetype_match_rule` per SPEC §4. **Tables ship empty.** No seed rows. No invented archetypes.

**Acceptance criteria:**
- [ ] Both tables created with exact columns from SPEC §4.
- [ ] `archetype` has `UNIQUE (format, name)`.
- [ ] `archetype_match_rule.zone` CHECK in (`'main'`, `'side'`, `'any'`).
- [ ] FK `decks.archetype_id → archetype(id) ON DELETE SET NULL`.
- [ ] Zero rows in either table after migration.

**Verification:**
- [ ] `supabase db reset` applies cleanly.
- [ ] `select count(*) from archetype;` returns 0.
- [ ] `select count(*) from archetype_match_rule;` returns 0.

**Dependencies:** Task 3.

**Files likely touched:** `supabase/migrations/002_archetype.sql`.

**Scope:** XS.

---

### Checkpoint: Phase 1

- [ ] `npm run typecheck` passes.
- [ ] `supabase db reset` applies migrations 001 + 002 with no errors.
- [ ] `docs/mtgo-probe.md` exists and is reviewed.
- [ ] Human approves before Phase 2 starts.

---

### Phase 2 — First Vertical Slice (one event, end-to-end, queryable)

Goal at end of phase: a single Modern Challenge ingested, Scryfall-enriched, queryable via `list_decks` + `compare_decks`.

#### Task 5: MTGO fetch + disk cache

**Description:** `lib/mtgo/fetch.ts` exposes `fetchEvent(url)` that:
- checks `data/mtgo_cache/<event_id>.{html|json}` first
- sets a polite `User-Agent` header
- enforces a minimum delay between live requests (config constant, e.g. 2000ms)
- writes the raw response to cache on first fetch
- returns the cached bytes on subsequent calls

**Acceptance criteria:**
- [ ] Cache hit short-circuits the network call.
- [ ] First fetch writes to `data/mtgo_cache/`.
- [ ] Polite delay enforced between live fetches in the same process.
- [ ] Exposes the request HTTP status and final URL for the parser to record.

**Verification:**
- [ ] Calling `fetchEvent` twice in succession results in only one network round-trip (assert via timing or a request counter).
- [ ] Cache file lands at expected path.

**Dependencies:** Task 1 (informs response shape), Task 2.

**Files likely touched:** `lib/mtgo/fetch.ts`, `lib/mtgo/types.ts`.

**Scope:** S.

---

#### Task 6: MTGO parse

**Description:** `lib/mtgo/parse.ts` exposes `parseEvent(raw)` returning `{ event, decks, deck_cards }` shaped to insert directly. Implementation depends on Task 1's recommendation (`cheerio` selectors vs JSON payload key). Parses player, rank, record (when present), main + side card names + qty. Records `event_size` as the count of posted decks.

**Acceptance criteria:**
- [ ] Returns one `event`, N `decks` (matches posted count), and `deck_cards` rows summing to expected card totals (60+ main, 0–15 side per deck).
- [ ] `record` parsed when present, null when absent; `match_wins` / `match_losses` derived from `record`.
- [ ] DFC cards captured with front face only in `card_name`.
- [ ] No silent skips — unknown structure raises with the offending fragment.

**Verification:**
- [ ] Hand-verify one parsed deck against the source page (player + main count + side count + record).
- [ ] Run on the second probed event; structure holds.

**Dependencies:** Task 1, Task 5.

**Files likely touched:** `lib/mtgo/parse.ts`, `lib/mtgo/types.ts`.

**Scope:** M.

---

#### Task 7: Ingest script (one event)

**Description:** `scripts/ingest-challenges.ts` accepts a single event URL on CLI, calls `fetchEvent` + `parseEvent`, writes rows idempotently to `events`, `decks`, `deck_cards`. Idempotency via `events.mtgo_event_id` and `decks (event_id, player, rank)` unique. Filters non-tournament events with a hard fail. Filter rule (per SPEC §3.2): `type === "TOURNAMENT"` AND `standings[]` non-empty AND `description` matches `/(challenge|qualifier)/i` AND does NOT match `/preliminary/i`. Derives `events.event_tier` from `description`.

**Acceptance criteria:**
- [ ] Single-event mode: `npm run ingest -- --url <mtgo_url>` writes rows.
- [ ] Re-running the script on the same URL is a no-op (no duplicate rows, no errors).
- [ ] `format` column populated on every inserted row.
- [ ] Refuses to ingest events failing the SPEC §3.2 filter (leagues, prelims, 5-0 lists, untagged events).

**Verification:**
- [ ] `select count(*) from events` increments by 1 after a fresh ingest.
- [ ] Second run leaves counts unchanged.
- [ ] All `decks.format` and `events.format` values match the CLI flag.

**Dependencies:** Tasks 3, 5, 6.

**Files likely touched:** `scripts/ingest-challenges.ts`, `lib/supabase.ts`.

**Scope:** M.

---

#### Task 8: Scryfall bulk download + cache

**Description:** `lib/scryfall/bulk.ts` downloads the `default-cards` (or `oracle-cards`) bulk file once per local session, caches it under `data/scryfall_cache/`, exposes a streaming iterator. Honors Scryfall's bulk-download URL indirection (the bulk endpoint returns a metadata JSON with the actual `download_uri`).

**Acceptance criteria:**
- [ ] First run downloads + caches the bulk file.
- [ ] Subsequent runs read from cache if fresh (e.g. < 24h).
- [ ] Iterator yields card objects without loading the whole file into memory.

**Verification:**
- [ ] First run produces a file in `data/scryfall_cache/`.
- [ ] Second run does not re-download.
- [ ] Iterator handles ≥30k cards without OOM (default-cards is large).

**Dependencies:** Task 2.

**Files likely touched:** `lib/scryfall/bulk.ts`.

**Scope:** S.

---

#### Task 9: MTGO → Scryfall matcher + enrichment script

**Description:** `lib/scryfall/match.ts` exposes `matchByMtgoName(name)` resolving an MTGO card name to a Scryfall row (handles DFC front-face mapping by indexing both `name_front` and full `name`). `scripts/enrich-scryfall.ts` iterates the bulk file, upserts `cards`, then resolves every `deck_cards.scryfall_id IS NULL` row.

**Acceptance criteria:**
- [ ] `cards` table populated from bulk file (≥10k rows for a typical sync).
- [ ] After enrichment, `deck_cards.scryfall_id` is non-null for all standard cards in ingested decks.
- [ ] Cards that fail to match are reported (logged with deck context), not silently ignored.

**Verification:**
- [ ] `select count(*) from deck_cards where scryfall_id is null` after enrichment is 0 or a known-small set of edge cases.
- [ ] Spot-check one DFC card (e.g. `Fable of the Mirror-Breaker`) — `card_name` is the MTGO front-face string, `scryfall_id` resolves to the full DFC row.

**Dependencies:** Tasks 3, 7, 8.

**Files likely touched:** `lib/scryfall/match.ts`, `scripts/enrich-scryfall.ts`.

**Scope:** M.

---

#### Task 10: Migration 003a — `list_decks` + `compare_decks` RPCs

**Description:** Author `supabase/migrations/003_rpcs.sql` covering the two RPCs that don't depend on archetype stats. Both `SECURITY DEFINER`, granted `EXECUTE` to `anon` and `authenticated`. `list_decks` excludes `archetype_id IS NULL` per SPEC §5.

**Acceptance criteria:**
- [ ] `list_decks(format, archetype_id, from, to)` returns ordered rows matching SPEC §5.
- [ ] `compare_decks(a, b)` returns `only_in_a` / `only_in_b` / `shared` with `zone` tagged on every row.
- [ ] Both granted to `anon` and `authenticated`.

**Verification:**
- [ ] `select * from list_decks('modern', 1, '2026-05-19', '2026-06-03');` runs without error (may return empty until archetypes populated).
- [ ] `select * from compare_decks(<id_a>, <id_b>);` returns expected diff against hand-computed result for two test decks.

**Dependencies:** Tasks 3, 7.

**Files likely touched:** `supabase/migrations/003_rpcs.sql`.

**Scope:** S.

---

### Checkpoint: Phase 2

- [ ] One real Modern Challenge ingested end-to-end.
- [ ] `cards` table populated; `deck_cards.scryfall_id` resolved for ingested decks.
- [ ] `compare_decks` smoke test passes against two hand-picked decks.
- [ ] Human reviews before Phase 3.

---

### Phase 3 — Archetype Classification + Remaining RPCs

#### Task 11: Classifier script

**Description:** `scripts/classify-archetypes.ts` reads all rows from `archetype_match_rule`, evaluates each deck against the rule groups (rules in same `group_id` = AND; multiple groups = OR), and updates `decks.archetype_id`. Idempotent. When `archetype_match_rule` is empty, the script logs "no rules" and exits cleanly without touching `archetype_id`.

**Acceptance criteria:**
- [ ] Empty `archetype_match_rule` table → no DB writes, exit 0.
- [ ] Populated rules → updates `archetype_id` only for decks that match.
- [ ] Ambiguous matches (multiple archetypes match a deck) → log + leave `archetype_id` null (or apply a deterministic tiebreaker; default: alphabetical archetype.name).
- [ ] Re-running with no rule changes is a no-op (no row updates).

**Verification:**
- [ ] Insert one test archetype + one rule manually, run classifier, observe expected `decks.archetype_id` update.
- [ ] Delete the rule, re-run classifier — `archetype_id` set to null for previously matched decks.

**Dependencies:** Tasks 4, 7.

**Files likely touched:** `scripts/classify-archetypes.ts`.

**Scope:** M.

---

#### Task 12: Migration 003b — `archetype_card_stats` + `archetype_winrate`

**Description:** Extend `003_rpcs.sql` (or add `004_rpcs_archetype.sql`) with the two stats RPCs per SPEC §5. `archetype_card_stats` filters basics by default and groups by `card_name` + `zone`. `archetype_winrate` returns `n_decks`, `n_events`, `match_wins`, `match_losses`, `win_pct`, `n_decks_with_record`, `basis='published winners only'`.

**Acceptance criteria:**
- [ ] `archetype_card_stats` includes `copy_breakdown` with keys `"1"`, `"2"`, `"3"`, `"4"`, `"5+"`.
- [ ] `avg_copies` averages **only over decks playing the card**.
- [ ] Basics excluded from output.
- [ ] `archetype_winrate.win_pct` is null when `match_wins + match_losses = 0`.
- [ ] Both granted to `anon` and `authenticated`.

**Verification:**
- [ ] With one archetype populated + matching decks: `select * from archetype_card_stats('modern', 1, '2026-05-19', '2026-06-03', 'main');` returns rows with sane `inclusion_pct` and `avg_copies`.
- [ ] `archetype_winrate(...)` returns `basis = 'published winners only'`.

**Dependencies:** Tasks 7, 9, 11.

**Files likely touched:** `supabase/migrations/004_rpcs_archetype.sql` (or extend 003).

**Scope:** M.

---

### Checkpoint: Phase 3

- [ ] All four RPCs exist and execute against current data.
- [ ] Classifier runs no-op against empty archetype tables (the actual state until the user supplies archetypes).
- [ ] Human-supplied archetypes + rules can be added without code changes (insert-only path).
- [ ] Human approves before Phase 4.

---

### Phase 4 — Backfill

#### Task 13: MTGO event discovery

**Description:** `lib/mtgo/discover.ts` exposes `findTournamentEvents(format, from, to)` returning the list of tournament event URLs in the window. Strategy depends on Task 1's findings: scrape a Modern decklists index page or hit a known list endpoint. Filter slugs to exclude `-league-` and `-preliminary-` (and 5-0 paths); positive match on `(challenge|qualifier)` in slug. Confirm at parse time via SPEC §3.2 rule.

**Acceptance criteria:**
- [ ] Returns ≥1 URL for `(modern, 2026-05-19, 2026-06-03)`.
- [ ] Filters out leagues, prelims, 5-0 lists at slug level (positive match on `(challenge|qualifier)`, negative on `(league|preliminary)`).
- [ ] Stable ordering: oldest → newest.

**Verification:**
- [ ] Manually cross-check the returned list against the MTGO archive page for May–June 2026.

**Dependencies:** Tasks 1, 5.

**Files likely touched:** `lib/mtgo/discover.ts`.

**Scope:** S.

---

#### Task 14: Backfill orchestrator

**Description:** `scripts/backfill.ts` accepts `--format <f> --from <d> --to <d>` and runs: discover → ingest each (polite delay between) → enrich → classify. Idempotent — re-running mid-failure resumes cleanly.

**Acceptance criteria:**
- [ ] Single command runs the full pipeline.
- [ ] Failure on event N does not corrupt previously-ingested events.
- [ ] Logs progress per event (`✓ ingested`, `✓ enriched`, `✓ classified`).
- [ ] Re-run after a failure picks up where it stopped (idempotent ingest + enrich).

**Verification:**
- [ ] Dry-run with `--from <today>` returns "0 events found" cleanly.
- [ ] Full backfill against the live window runs to completion.

**Dependencies:** Tasks 7, 9, 11, 13.

**Files likely touched:** `scripts/backfill.ts`.

**Scope:** M.

---

#### Task 15: Run the backfill + smoke

**Description:** Execute `npm run backfill -- --format modern --from 2026-05-19 --to 2026-06-03`. Then run hand-checked queries against each RPC.

**Acceptance criteria:**
- [ ] `select count(*) from events where format='modern' and event_date >= '2026-05-19'` ≥ expected count of Modern Challenges in window.
- [ ] `select count(*) from decks` matches sum of `event_size` across ingested events.
- [ ] `select count(*) from deck_cards where scryfall_id is null` is 0 (or a known small edge-case list).
- [ ] `archetype_card_stats`, `archetype_winrate`, `list_decks`, `compare_decks` all execute without errors against the populated DB (archetype-scoped RPCs may return empty until user populates rules — that's expected and acceptable).

**Verification:**
- [ ] Counts above hold.
- [ ] One spot-check: pick a deck in `list_decks` output, cross-reference against the MTGO source page.

**Dependencies:** Task 14.

**Files likely touched:** None (runtime only).

**Scope:** S.

---

### Checkpoint: Complete

- [ ] All acceptance criteria met across all 15 tasks.
- [ ] `SPEC.md` § Acceptance for backfill is satisfied.
- [ ] Ready for the user to populate `archetype` + `archetype_match_rule` and re-run the classifier.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| MTGO page structure differs across events (especially 32 vs 64 vs 96) | High — parser fails mid-backfill | Probe two events in Task 1; parser raises on unknown structure rather than silently skipping; raw cache enables re-parse without re-fetch |
| MTGO rate-limits / IP-throttles the ingester | Med — backfill stalls | Polite delay between requests in `fetch.ts`; disk cache means re-runs don't hit the network |
| Scryfall name mismatch for DFC/split/adventure cards | Med — `scryfall_id` left null on some `deck_cards` | Matcher indexes both `name` and `name_front`; failed matches logged with deck context, not silently dropped |
| Records missing from many Challenge events | Med — `archetype_winrate` denominator small | `n_decks_with_record` added to response so UI can show the basis; `win_pct` null when denominator zero |
| User-supplied archetype rules ambiguous (deck matches multiple archetypes) | Low — classifier picks wrong archetype | Deterministic tiebreaker (alphabetical `archetype.name`) + log ambiguous matches |
| MTGO blocks scraping outright | High — entire build dead | Probe in Task 1 surfaces this immediately, before any further code |

---

## Open Questions

None blocking. SPEC §11 lists items deferred to in-session decisions (DFC edge cases beyond front-face, `p_include_basics` flag, hosted Supabase).

---

## Verification Before Implementation

- [x] Every task has acceptance criteria
- [x] Every task has a verification step
- [x] Task dependencies identified and ordered correctly
- [x] No task touches more than ~5 files (most are 1–3)
- [x] Checkpoints exist between each phase
- [ ] Human has reviewed and approved the plan
