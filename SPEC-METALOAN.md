# metaloan — Spec

Card-lending coordination for a group of friends prepping for an RCQ.

Lives at `/loan` inside the metaspike app: same repo, same Next.js deploy,
same Supabase project. metaspike answers *how do people build this archetype*.
metaloan answers *can I physically assemble it by Saturday*.

Status (2026-07-31): schema **applied and verified on hosted** — 9 tables, 6
functions, 17 policies, anon confirmed blocked. Auth wired. All screens read
real Supabase data. Holdings writes done; the rest of the writes are not.
Not deployed — localhost only.

---

## 1. The problem

You own pieces of several decks, never a whole one. Assembling a legal 75 for
a sanctioned event means asking friends for cards. That coordination currently
happens in a Google Sheet that goes stale, and on WhatsApp where it gets lost.

The sheet fails for one specific reason: **ownership is not availability.**
"Juan has 4 Ragavan" is useless if Juan is sleeving them at the same event. One
physical card, one player, one tournament.

## 2. Firm rules

1. **Availability, not inventory.** The core value is
   `available = owned − locked(event) − lent_out`. A tool that only tracks
   ownership is the spreadsheet with extra steps.
2. **Locked is intent, scoped to one event. Lent-out is physical, global.**
   A card in someone else's bag on Saturday is still there on Sunday, whatever
   event the loan was opened against. Conflating these is the bug that makes a
   lending tracker lie.
3. **Locked is MAX across a user's candidate decks, never SUM.** A user may
   commit two decks to one event and pick on the morning; they sleeve exactly
   one. Two decks each wanting 4 Force of Negation lock 4, not 8. Summing
   phantom-locks cards the owner still has.
4. **Commitments are private to their owner.** A commitment is a decklist, and
   the crew contains people you will play against. Only the aggregate effect
   leaks — "this card is spoken for" — never which deck consumed it.
5. **The card universe is the meta, not your collection.** Only cards appearing
   in tournament decks over a rolling window are trackable. Untracked always
   means zero; a user is never asked about a card they do not own.
6. **Card identity is `oracle_id`.** Printing, set, foil, language, condition
   are all irrelevant to borrowing.
7. **Every metaloan table has RLS, enabled in the migration that creates it.**
   The anon key ships in browser JS. A table without a policy is a leak.
8. **WhatsApp is the transport.** The app produces messages good enough to
   paste. It does not try to replace the group chat.

## 3. Decisions log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-07-31 | Same repo, `/loan` route, migrations continue at 009 | "Same web page, different `/`" — one deploy, one domain, shared `cards` table and design tokens |
| 2026-07-31 | Share metaspike's Supabase project rather than a second one | `holding.oracle_id` resolves against the existing enriched `cards` table; one scraper, one Scryfall matcher |
| 2026-07-31 | Keep the existing 768 decks rather than clearing | Backfill is idempotent on `mtgo_event_id`; May–June data sits *inside* a 90-day window; staleness is a `WHERE`, not a `DELETE`; hosted has no backups |
| 2026-07-31 | Lock per event, not per date | Supports the two-candidate-decks case directly. Known gap: a Sat+Sun weekend needs a same-card-across-nearby-events warning (v1.1) |
| 2026-07-31 | Commitment conflicts alert both parties; never auto-release, never block | Software cannot know which of two people deserves the card. Surface it to two humans and let WhatsApp settle it |
| 2026-07-31 | Loans carry N cards, one lender, one borrower | That is the handoff. One-card-per-loan would mean approving twelve requests from one person and would make the solver pointless. Not a "lend a whole deck" feature — that stays out of v1 |
| 2026-07-31 | Overdue is derived, not a stored state | Self-clears on return; nothing to unset; no punitive flag |
| 2026-07-31 | Crew visibility `open` in v1, `query_only` built but unused | Open matches how a friend group works. Query-only is the scale path once the crew is the whole store. Retrofitting privacy after people enter data is painful |
| 2026-07-31 | No reliability scores in v1 | Public scoring in a six-person friend group gets ugly fast |
| 2026-07-31 | Solver in TypeScript, not SQL | Tiny N; tie-break weights are product knobs that will be tuned often and need to be readable and testable |
| 2026-07-31 | No prices anywhere | Theft magnet, scope creep, and TCGplayer exists |

## 4. Schema

Migrations `009`–`015`. All tables `public`, all with RLS.

| Table | Purpose |
|---|---|
| `crew` | Friend group. `invite_code`, `visibility` (`open` \| `query_only`) |
| `crew_member` | Membership + `display_name` + `role` |
| `holding` | `(user_id, oracle_id, qty)`. Own-rows-only RLS |
| `local_event` | The real RCQ being prepped for. Unrelated to `public.events` (MTGO) |
| `event_attendance` | Who is going. Drives lender ranking |
| `commitment` / `commitment_card` | Candidate decks for an event. Owner-private |
| `loan` / `loan_card` | A physical handoff. States below |

**Loan states:** `requested` → `approved` → `handed` → `returned`, plus
`declined` and `cancelled`. `approved` and `handed` both mean the card is out
of the lender's box.

**Helper functions** (all `SECURITY DEFINER`, to break RLS recursion):
`is_crew_member`, `is_crew_owner`, `can_see_local_event`.

**Write RPCs:** `create_crew` and `join_crew`. `authenticated` has no INSERT
grant on `crew`, so `create_crew` is the only way one can exist — a crew and
its creator's membership must appear together, or the creator ends up with a
crew nobody can read. Both return null rather than raising when they decline.

**No PL/pgSQL, no triggers, no dollar quoting.** Every function is `language
sql` with a `BEGIN ATOMIC` body (Postgres 14+); the two that write use
data-modifying CTEs to stay a single statement.

Principle: one statement, one transaction, nothing hidden behind a trigger, and
bodies parsed at creation time so a broken reference fails the migration rather
than the first call.

Practice: the Supabase SQL editor runs a parameter-substitution pass before
sending, which consumes `$tag$` as a bind placeholder. Bare `$$` gave
"unterminated dollar-quoted string"; named tags gave `42P13: no function body
specified`, the AS clause having been stripped. Wrapping the script in an
explicit `begin;`/`commit;` made this worse — the failure rolled back silently
and the editor reported the last statement's success, so four attempts appeared
to work while persisting nothing. `BEGIN ATOMIC` has no string literal at all.

**View:** `oracle_card` dedupes `public.cards` by `oracle_id` (its PK is
`scryfall_id`, one row per printing). `holding.oracle_id` therefore carries no
FK; validity is the RPCs' job.

## 5. RPC contract

### `crew_availability(p_crew_id uuid, p_local_event_id bigint, p_oracle_ids uuid[])`

Per `(member, card)` where the member owns ≥1 copy:
`{user_id, display_name, oracle_id, available, attending, owned, locked, lent_out}`.

- `locked` = MAX over that member's commitments for the event
- `lent_out` = SUM over loans in `approved`/`handed` with `returned_at IS NULL`, **no event filter**
- `available` = `greatest(owned − locked − lent_out, 0)`
- Under `query_only`, `owned`/`locked`/`lent_out` are null — enough to ask for
  the card, not enough to inventory a binder
- Takes an explicit card list and never enumerates a collection

### `deck_shortfall(p_deck_id bigint)`

What the caller lacks for a metaspike deck.
`{oracle_id, name, image_url, need, have, short}` plus
`meta.unmatched_card_names`.

- `need` sums main + side: the 4-of rule spans the whole 75, so 3 main + 1 side
  is four physical cards
- `have` is net of the caller's own lent-out copies
- Basics excluded
- Does **not** subtract `locked` — the deck being costed is what does the locking

## 6. Handoff solver

`lib/loan/handoff.ts` — `planHandoffs(shortfall, availability, opts)`.

The real bottleneck is not who owns a card, it is **how many people you must
meet before Saturday.** Everyone here plays Commander and owns one of
everything; Modern wants four. A single playset routinely means three lenders.

Weighted multiset cover. Multiset because a lender contributes a quantity;
weighted because an attendee hands the card over on site at almost no cost.

- `ATTENDEE_COST = 0.25`, `NON_ATTENDEE_COST = 1` — the entire tuning surface
- Exhaustive over subsets when candidates ≤ 16 (2^16 is nothing, and gives the
  true optimum); greedy + redundancy prune above that
- Coverage dominates cost: a plan that gets more cards always wins
- Allocation is scarcest-card-first, then attendees, then whoever is already
  handing you the most — concentrating a handoff beats spreading it
- Cards nobody has are returned in `uncovered`, never silently dropped

Verified against mock data: 3 lenders, 1 meetup, correctly reports Surgical
Extraction as unobtainable. Invariants checked — never over-allocates a
lender's supply, never over-supplies a need.

## 7. Layout

```
middleware.ts                        session refresh + /loan gate

app/
├── auth/callback/route.ts           magic-link code exchange
└── loan/
    ├── layout.tsx                   nav shell, resolves current crew
    ├── loan.module.css              over metaspike's tokens in globals.css
    ├── login/page.tsx               magic link
    ├── page.tsx                     overview: next event, pending, overdue
    ├── events/page.tsx              event list
    ├── events/[id]/page.tsx         CORE — attendance, commitments, shortfall, plan
    ├── collection/page.tsx          holdings + recent tournament lists
    ├── collection/deck/[deckId]/    tick a real 75 against your box
    ├── collection/paste/page.tsx    decklist paste + live parse
    ├── loans/page.tsx               in / out
    ├── join/page.tsx                crew + invite
    └── _components/                 Nav, HandoffPlanView, TickThrough,
                                     JoinForm, States

lib/loan/
├── handoff.ts                       the solver
├── queries.ts                       all Supabase reads, { data, error }
├── whatsapp.ts                      per-lender + group messages, en/es
└── parseDecklist.ts                 MTGO/Arena/Moxfield/Archidekt/Goldfish

lib/supabase/middleware.ts           session refresh helper
lib/types/loan.ts                    domain + RPC response types
```

## 8. Auth

Supabase magic link. `middleware.ts` matches `/loan/:path*` and `/auth/:path*`
only — metaspike's own routes stay anon-readable and pay no auth round trip.

- `lib/supabase/middleware.ts` refreshes the session on every matched request.
  Server Components cannot write cookies, so without this a lapsed token
  silently degrades the user to anon, which under RLS looks like an empty
  collection rather than an auth error
- Uses `getUser()`, never `getSession()` — the latter trusts the cookie without
  revalidating it
- `/auth/callback` exchanges the one-time code for a session and only follows
  same-origin relative `next` paths; an open redirect there would hand a fresh
  session to an attacker-chosen URL

## 9. Writes

Server Actions under `app/loan/_actions/`, running as the signed-in user so
RLS is what scopes them. There is no service_role path in the app; that key
lives only in the tsx scripts.

`user_id` always comes from the session, never the client, so a caller cannot
write rows on someone else's behalf even if a policy were wrong.

**Done — holdings:**
- `saveHoldings` — tick-through. qty 0 deletes rather than storing a zero;
  untracked and "owns none" are the same state, and zero rows would accumulate
  one per card the user has ever looked at
- `saveHoldingsByName` — paste import. Resolves against both `name` and
  `name_front` so either face of a DFC matches, case-insensitively. Replaces
  quantities rather than adding: a paste states what you own, and adding would
  silently double a collection on a second paste

**Still buttons without handlers:** creating events, attendance, committing
decks, and the loan state machine.

## 10. Not built
- Same-weekend conflict warning (see rule 2 gap)
- Notifications for loan requests
- Bulk CSV import from Moxfield/Deckbox
- Standard and Pioneer universes (schema-ready, config only)

## 11. Open risks

- **Hosted has no backups and no staging.** Free tier. The tick-through data is
  hours of crew effort with no restore point. Paid tier or a `pg_dump` cron
  before inviting anyone
- **Free tier pauses after 7 days idle.** After launch that means the app is
  down on a Saturday morning
- **The Supabase SQL editor silently truncates around 4 KB.** A 4.1 KB file
  reported success while losing its trailing grants; 5.4 KB failed outright
  with "syntax error at end of input". Any future migration pasted there must
  be split under ~3.5 KB, or applied via the CLI / a direct `pg` connection
- **Migration history on hosted is empty.** `db push` would try to re-run
  001–008 against existing tables. Needs `migration repair --status applied
  001 … 008` before the CLI is usable
- **Only 4 archetypes classified**, so archetype browsing is nearly empty.
  Deliberately routed around: metaloan browses *concrete decklists* by
  `deck_id`, which needs no classification and is the better UX anyway
