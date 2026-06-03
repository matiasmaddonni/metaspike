# metaspike

Backend + data layer for an MTG deckbuilding companion that analyzes how top finishers build and sideboard within specific archetypes, for any 1v1 (75-card) constructed format.

- **Source of truth:** mtgo.com tournament decklists (Challenges, Showcase Challenges, RC Qualifiers, RC Super Qualifiers — never leagues, prelims, or 5-0 lists).
- **Take-as-published:** ingests exactly the lists MTGO posts per event, no extra rank filtering.
- **Multi-format:** Modern, Standard, Pioneer (Modern first; the rest are config-only).
- **Win rate labeled "among published winners"** — survivorship-biased by definition.

## Stack

- TypeScript + tsx scripts
- Supabase (Postgres + RPCs) — local CLI for dev, hosted deferred
- Scryfall bulk data for card enrichment

## Layout

```
SPEC.md                  Source of truth — schema, RPC contract, data rules, decisions log
PLAN.md                  15-task implementation plan, phased
docs/mtgo-probe.md       MTGO page shape + filter rules
supabase/migrations/     Numbered SQL migrations
scripts/                 tsx entry points (probe, ingest, enrich, classify, backfill)
lib/                     Reusable modules (mtgo/, scryfall/, supabase client)
data/                    Local caches (mtgo + scryfall), gitignored
```

## Dev setup

Requires a container runtime (OrbStack / Docker Desktop / Colima) for local Supabase.

```bash
npm install
npx supabase start         # boots local Postgres + API + Studio
npx supabase db reset      # applies migrations from scratch
npm run typecheck
```

Local URLs after `supabase start`:

| Service | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| DB  | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio | http://127.0.0.1:54323 |

Copy `.env.example` → `.env` and fill in the `SUPABASE_SERVICE_ROLE_KEY` printed by `supabase start`.

## Status

Backend complete through all 4 RPCs in the [SPEC.md](SPEC.md) contract:

- `list_decks`, `compare_decks` (flat default + `p_split_by_zone` variant)
- `archetype_card_stats`, `archetype_winrate`

End-to-end pipeline (fetch → parse → ingest → Scryfall enrich → classify) verified on a single Modern Challenge. Local stack is the only live Supabase instance; hosted project deferred.

Design handoff lives in [`design_handoff_metaspike/`](design_handoff_metaspike/) — HTML mock + mock RPC data + design tokens. UI build is next.

See [PLAN.md](PLAN.md) for the full task list.

## Data rules — non-negotiable

See [SPEC.md §3](SPEC.md). Summary:

- Tournament events only (Challenge / Showcase Challenge / RC Qualifier / RC Super Qualifier). Detection: `type === "TOURNAMENT"` AND `standings[]` non-empty AND description matches `/(challenge|qualifier)/i` AND does NOT match `/preliminary/i`.
- Archetypes are user-supplied and signature-based. The `archetype` + `archetype_match_rule` tables ship empty and are never seeded by code.
- Win rate is published-winners-only. The basis is labeled in the RPC response so the UI can show it.
