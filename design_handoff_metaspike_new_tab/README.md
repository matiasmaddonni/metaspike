# Handoff: metaspike — MTG archetype study tool

## Overview
**metaspike** is a deckbuilding companion for competitive Magic: The Gathering players studying an archetype to pick and tune a tournament deck. It visualizes how top finishers build and sideboard within an archetype across any 1v1 (75-card) format, plus a win-rate signal.

The **centerpiece** is the **Card-spread view**: one row per card in the archetype, showing its **inclusion %** across the filtered decklists and its **average copy count**, with rows auto-grouped into **Core / Flex / Tech** bands. That grouping is the product's reason to exist — it's where deckbuilding decisions live.

This handoff covers the **built, high-fidelity landing view** (`metaspike.html`) plus the full data contract and specs for the remaining views so they can be implemented consistently. It now also covers the **LISTS mode** (built) — an events-grouped, expandable browser for reading individual 75s in finishing order, with off-consensus "spice" flagged.

Target stack (per product brief): **React + Recharts**, dropping onto a **Supabase** backend being built in parallel. The HTML mock is built against mock data that already matches the backend RPC contract (below), so swapping mock → live is a function-body change, not a refactor.

---

## About the design files
The files in this bundle are **design references created in HTML/React-via-Babel** — a working prototype that shows the intended look, layout, and behavior. **They are not production code to copy verbatim.** The task is to **recreate this design in the metaspike codebase** (React + Recharts + Supabase) using its established components, routing, data-fetching, and styling patterns. If no front-end environment exists yet, React + CSS Modules (or your chosen styling solution) + Recharts is the assumed target.

Treat `metaspike.html` as the **single source of truth for visual design**; treat `data/mockData.js` as the **literal shape of the backend contract** you should code against.

## Fidelity
**High-fidelity.** Colors, typography, spacing, grid columns, and row metrics below are final and exact. Recreate pixel-faithfully with the codebase's libraries. The one deliberately-tweakable value is the **accent color** (see Design Tokens → Accent).

---

## The data contract (shared with the Supabase backend)
Implement the UI against these RPC signatures. The mock in `data/mockData.js` returns exactly these shapes.

```
archetype_card_stats(p_format, p_archetype_id, p_date_from, p_date_to, p_zone /* 'main' | 'side' */)
  → rows: {
      card_name, scryfall_id, image_url, mana_value, type_line,
      colors[],            // subset of ['W','U','B','R','G']; [] = colorless/land
      zone,                // 'main' | 'side'
      inclusion_pct,       // 0..1  — fraction of in-scope decks running ≥1 copy
      avg_copies,          // mean copies among decks that run it
      copy_breakdown,      // { "1": n, "2": n, "3": n, "4": n } — deck counts by copy-count
      n_decks              // decks running ≥1 copy (= sum of copy_breakdown)
    }
  + meta: { total_decks }

archetype_winrate(...) → {
    n_decks, n_events, match_wins, match_losses, win_pct,
    basis: 'published winners only'
  }

list_decks(...) → rows: { deck_id, player, event_name, event_date, rank, record, archetype_id }

compare_decks(a, b) → {
    only_in_a: [{ card, qty }],
    only_in_b: [{ card, qty }],
    shared:    [{ card, qty_a, qty_b }]
  }
```

### Individual-lists API (added for the LISTS view)
```
list_events(p_format, p_archetype_id, p_date_from, p_date_to)
  → [ {                         // ordered: event date DESC
      id, name, date,           // event identity
      scope,                    // 'CHALLENGE' | 'SHOWCASE' (per-event; distinct from the
                                //   global Challenges filter scope)
      entrants,                 // field size
      n_decks,                  // # of this archetype's published lists in the event
      top_finish,               // best rank among them, e.g. '1st'
      decks: [ Deck ]           // ordered: rank ASC (finish order)
    } ]

Deck = {
    deck_id, player, rank, rank_label /* '1st'|'2nd'|… */, record /* 'W-L' */,
    event_id, event_name, event_date, event_scope, entrants,
    main:  [ Line ],            // sorted: non-lands first, then by mana_value, then name
    side:  [ Line ],
    main_count, side_count,     // 60 / 15
    groups_main: [ TypeGroup ], // main, partitioned by primary type
    groups_side: [ TypeGroup ],
    spice: [ Line ]             // off-consensus cards, sorted by field_pct ASC
  }

Line = {
    card, qty, zone /* 'main'|'side' */,
    type_line, colors[], mana_value, is_land,
    art_url, card_url,          // Scryfall art_crop / normal
    field_pct,                  // 0..1 — inclusion of THIS card across the whole field
                                //   (same number the aggregate view shows)
    spice                       // bool — true when this maindeck non-land runs in
                                //   < SPICE_THRESHOLD of the field
  }

TypeGroup = { type /* 'Creatures'|'Instants'|'Lands'|… */, cards: [Line], count }

exportDeckMTGO(Deck) → string   // 'Deck\n4 Card…\n\nSideboard\n2 Card…' (MTGO .txt)
```

**Client-derived, not RPC:**
- `spice` flag & the `spice[]` list — computed from each line's `field_pct` against `SPICE_THRESHOLD` (maindeck) / `SPICE_THRESHOLD_SIDE` (sideboard). See "Spice logic".
- `groups_main/side`, sorting, and `top_finish` — pure client transforms over the raw 75 + rank.
- In the mock, `list_events()` synthesizes the 75s by merging a shared CORE shell with per-deck FLEX/SIDE packages, and reads every card's `field_pct` from the **aggregate** dataset so spice is grounded in the same numbers the card-spread view shows. **Production:** the backend returns the real per-deck 75s + each card's field inclusion; the client does the grouping/spice/sort.

**Derived in the client, not the RPC:**
- **Bucketing** (Core/Flex/Tech) is computed from `inclusion_pct` — see "Core/Flex/Tech logic".
- Rows are **sorted by `inclusion_pct` descending** within the full set before bucketing.

---

## Views (priority order)

> **Top-level mode toggle (added):** the header now carries an **`AGGREGATE | LISTS`** segmented control (left of the MAIN/SIDE zone toggle). **AGGREGATE** is the card-spread study view (everything below in #1–#3). **LISTS** is the new individual-decklist browser (#6). The MAIN/SIDE zone toggle is **only shown in AGGREGATE** (lists always show the full 75). This is pure client state — no re-fetch needed to switch modes if both datasets are already loaded.

### 1. Card-spread view — BUILT (this is the landing) ⭐
The home view. One row per card; inclusion % + avg copies; auto-grouped Core/Flex/Tech. Detailed below under "Built view: anatomy".

### 2. Sideboard spread — BUILT (same component, `zone='side'`)
Identical component, fed `archetype_card_stats(..., p_zone='side')`. Toggled by the **MAIN / SIDE** control in the header. No separate screen.

### 3. Win-rate panel — BUILT (compact, in the sub-header)
Per archetype. Big `win_pct` figure + `match_wins–match_losses` record. **Must be labeled "among published winners" and read as survivorship-biased — never as an absolute win rate.** In the mock it's a sub-header block with a caution line. Do not let it visually dominate or imply ground truth.

### 4. 75-vs-75 diff — SPEC ONLY (not yet built)
Pick two lists (from `list_decks`), call `compare_decks(a,b)`, render three columns: **only-in-A**, **shared** (with both quantities + a delta indicator), **only-in-B**. Counts in each column header. A reference implementation of this column layout exists in the earlier exploration file `Deck Lab — Copy-Count Directions` → `v2/tactical2.jsx`/`v2/term2.jsx` compare panels if useful, but build it natively. Entry point: a "Compare" affordance on any deck in a (future) deck list.

### 5. Export-to-MTGO — BUILT (stub)
Button present on the list (`EXPORT MTGO` in sub-header). Mock copies an MTGO-format text block to clipboard via `MTG.exportMTGO(deck)` → lines of `"<qty> <card>"` (split cards joined with `/`). Wire to the real selected list and trigger a `.txt` download in production. **Note:** the LISTS view adds a per-list `exportDeckMTGO(Deck)` that includes the `Deck` / `Sideboard` sections — prefer that for individual lists.

### 6. Individual lists (LISTS mode) — BUILT ⭐
The new feature. An **events-grouped, expandable index** of every published 75 for the archetype, so a player can read individual lists in finishing order (a 1st-place list reads differently than a 16th). Full anatomy under "LISTS view: anatomy". Driven by `list_events()`. Each row expands inline to the full 75 in one of **three switchable detail treatments** (Columns / Rows / Spice — a Tweak today, pick one default for prod). "Spice" (off-consensus cards) is flagged throughout.

### Filter bar — drives everything
`format`, `archetype`, `date range` are the live controls. **Event scope is fixed to Challenges — render it as a static, non-interactive label, not a control.** Changing any filter must re-run `archetype_card_stats` + `archetype_winrate` and recompute every view. In the mock these are styled dropdown buttons (visual only); make them functional selects wired to the RPC params in production.

---

## Built view: anatomy (`metaspike.html`)

Top-to-bottom structure of the landing page. All measurements exact.

### A. Header bar (sticky, top:0, z-index 30)
- Height **62px**, padding **0 26px**, `gap: 30px`, `display:flex; align-items:center`.
- Background `linear-gradient(180deg, #15161a, #0d0e11)`, bottom border `1px solid #23252b`.
- **Logo** (left): see "Logo" section.
- **Filters** (`.ms-filters`, `display:flex; gap:8px; align-items:flex-end`): three styled dropdown buttons (FORMAT / ARCHETYPE / DATE) + one fixed SCOPE label.
  - Each group: a mono 8.5px/1.5px-tracked uppercase label (`#868a93`) above the control.
  - Dropdown button `.ms-sel`: bg `#0a0b0e`, border `1px solid #23252b`, radius 5px, padding `7px 11px`, 13px/600 text, a `▾` caret in `#868a93`. Hover border `#3a3e48`.
  - SCOPE: `height 32px`, padding `0 11px`, **dashed** border `1px dashed #34373f`, radius 5px, mono 11px `#868a93`, text `CHALLENGES`. Non-interactive.
- **Zone toggle** (`.ms-zone`, `margin-left:auto`): 2 segmented buttons MAIN / SIDE, border `1px solid #23252b`, radius 6px, overflow hidden. Inactive: bg `#0a0b0e`, mono 11px/1.5px-tracked `#868a93`. Active: bg `var(--accent)`, text `#16120e`, weight 700.

### B. Sub-header (`.ms-sub`)
- Padding **20px 26px**, `display:flex; align-items:center; gap:28px`, bg `#101113`, bottom border `1px solid #23252b`.
- **Archetype title**: `<h1>` 30px/700, letter-spacing −0.5px (e.g. "Boros Energy"). Below it a meta row, 13px `#868a93`, with bolded mono figures (`#cfd2d8`): `64 decks · 8 events · Modern Challenges · last 90 days`. Separators are `·` in `#444`.
- **Win-rate block** (`.ms-wr`, `margin-left:auto`, right-aligned column):
  - Big number `.ms-wrnum`: **IBM Plex Mono 40px/700**, color `var(--accent)`, letter-spacing −1px; the `%` is 18px at 0.6 opacity.
  - Record `.ms-wrcol b`: mono 17px `#e9eaee`, `white-space:nowrap` (e.g. `412–233`), with a 10.5px `match record` caption `#868a93`.
  - Caution line `.ms-wrwarn`: 11px `#868a93`, right-aligned, max-width 340px, with a leading `▲` glyph in `var(--accent)`: *"among published winners — survivorship-biased, not a true win rate"*. **This caveat is required.**
- **Export button** `.ms-export`: bg `#0a0b0e`, border `1px solid #23252b`, radius 6px, padding `11px 15px`, mono 11px/1px-tracked `var(--accent)`, leading `⎘`. Hover: fill `var(--accent)`, text `#16120e`.

### C. Column header (`.ms-colhd`, sticky top:62px, z-index 20)
- CSS Grid. Columns **`40px 1fr 240px 78px 46px`**, `gap:18px`, padding `0 26px`, height **34px**.
- (When card art is OFF, drop the first `40px` column → `1fr 240px 78px 46px`.)
- Labels: mono 9px/1.5px-tracked `#868a93`, bottom border `1px solid #23252b`, bg `#0c0d10`.
- Header cells: `(art spacer) · CARD · INCLUSION ACROSS LISTS · AVG · N`.

### D. Group sections (Core / Flex / Tech)
Each band:
- **Group header** `.ms-ghd` (sticky top:96px, z-index 15): `display:flex; align-items:center; gap:12px`, padding `11px 26px 9px`, bg `#101113`, top+bottom border `1px solid #23252b`.
  - **Tick** `.ms-gtick`: 9×9px, radius 2px. Core = `var(--accent)`; Flex = `#cfd2d8` @ 0.5 opacity; Tech = `#868a93` @ 0.5.
  - **Label** `.ms-glabel`: mono 13px/700, letter-spacing 3px. Core text = `var(--accent)`; Flex = `#cfd2d8`; Tech = `#868a93`.
  - **Rule pill** `.ms-grule`: mono 10px `#868a93`, border `1px solid #23252b`, radius 3px, padding `1px 7px`. Text: `≥ 85%` / `20–85%` / `< 20%`.
  - **Desc**: 12px `#868a93` — `the non-negotiable shell` / `where the deck is decided` / `metagame calls & one-ofs`.
  - **Count** (`margin-left:auto`): mono 10.5px `#868a93`, `N cards`.

- **Card row** `.ms-row`: same grid as column header. Height **50px** (compact 42 / comfy 60), bottom border `1px solid #181a1f`. Hover bg `#141518`.
  - **Thumbnail** `.ms-thumb` (col 1, if art on): 40×38px, radius 4px, border `1px solid #23252b`, `img` `object-fit:cover; object-position:center 18%` (crops to the art, hides name/border of the card art-crop).
  - **Name cell** `.ms-name` (flex column, gap 3px, min-width 0):
    - `.ms-nm`: 14px/600 (comfy 15px), single-line ellipsis (e.g. "Ragavan, Nimble Pilferer").
    - `.ms-meta` row: **color pips** + type line.
      - **Pips** `.ms-pip`: 8×8px circles, `inset 0 0 0 1px rgba(0,0,0,.4)`. Colors: W `#efe7cf`, U `#5b87b8`, B `#7a7a82`, R `#cf5640`, G `#4f9a68`. Colorless/land = single `#54585f` pip. These encode MTG color identity and are the **only** non-monochrome data color besides the accent.
      - Type line `.ms-ty`: 10.5px `#868a93`, ellipsis.
  - **Inclusion cell** `.ms-incl` (col 3): a meter + a percentage.
    - Meter `.ms-meter`: full-width track, height 7px, bg `#1c1e24`, radius 3px; fill width = `inclusion_pct`, bg `var(--accent)`.
    - `.ms-pct`: mono 15px/600, right-aligned, min-width 42px; trailing `%` is 9px `#868a93`.
  - **AVG cell** `.ms-avg` (col 4): mono 15px `#cfd2d8`, baseline-aligned, with a tiny `avg` caption (8.5px `#868a93`). **`cursor:help`** + a native `title` tooltip listing the copy-count split, formatted highest-first: `"Copies run:  60× 4-of · 2× 3-of · 1× 2-of"`. **This is where the 1/2/3/4 distribution lives now — there is intentionally no distribution bar/graph in the row.**
  - **N cell** `.ms-n` (col 5): mono 13px `#868a93`, right-aligned (deck count running the card).

### E. Footer (`.ms-foot`)
Padding `22px 26px 0`, the logo (size 16) + an 11.5px `#868a93` note (max-width 640px): *"Inclusion & copy counts computed across 64 published Challenge lists. Hover a card for full art; hover AVG for the copy-count split."*

### F. Card-art hover popover (`.ms-hover`)
- `position:fixed`, follows cursor (`left = min(cursorX+20, vw-260)`, `top = min(cursorY, vh-360)`), 240px wide, radius 12px, border `1px solid #2a2e38`, shadow `0 18px 50px rgba(0,0,0,.7)`, `pointer-events:none`.
- Shows the **full card** image (`card_url`, Scryfall `normal` version). Row thumbnails use the **art crop** (`art_url`).

---

## LISTS view: anatomy (`lists.jsx`)

Rendered when the header mode toggle is set to **LISTS**. Replaces the column-header + Core/Flex/Tech body (sections C–E above). The header bar (A) and sub-header (B) stay, with two changes in LISTS mode:
- **Sub-header meta line** reads `<N> lists · <M> events · by event, then finish` instead of the deck/event/format line.
- **Sub-header right** replaces the win-rate block + export with a single note (`.ms-listnote`, right-aligned, max-width 420, 12px `#868a93`) led by a glowing accent dot (`.ms-spdot2`, 8px circle, `box-shadow:0 0 9px var(--accent)`): *"pink-flagged cards run in under 35% of the field — the spice that sets a list apart."*

All list-specific CSS lives in the `LIST_CSS` template string at the bottom of `lists.jsx`, prefixed `.msl-`. It inherits the same `--accent`, `--line`, `--ink/ink2/dim`, `--pan/pan2` tokens from `.ms-app`.

### A. Index column header (`.msl-colhd`, sticky top:62px, z-index 20)
CSS Grid, columns **`78px 1fr 80px 320px 44px`**, `gap:18px`, padding `0 26px`, height 34px. Mono 9px/1.5px-tracked `#868a93`, bottom border `1px solid #23252b`, bg `#0c0d10`. Cells: `FINISH · PLAYER · RECORD · SPICE — OFF-CONSENSUS CARDS · (chevron spacer)`.

### B. Event group header (`.msl-evhd`, sticky top:96px, z-index 15)
`display:flex; align-items:center; gap:12px`, padding `12px 26px 10px`, bg `#101113`, top+bottom border `1px solid #23252b`. Mirrors the Core/Flex/Tech group header rhythm. Contents:
- **Tick** `.msl-evtick`: 9×9px, radius 2px, `var(--accent)`.
- **Event name** `.msl-evname`: mono 14px/700, `#e9eaee`.
- **Scope tag** `.msl-evtag`: mono 9.5px/1.5px-tracked `var(--accent)`, `1px solid var(--accent)` border, radius 3px, padding `1px 7px`, opacity .85 (e.g. `CHALLENGE` / `SHOWCASE`).
- **Date** `.msl-evdate`: mono 12.5px `#cfd2d8`. Then a `·` (`#444`) and entrants `.msl-event` (12px `#868a93`).
- **Count** (`margin-left:auto`): mono 10.5px `#868a93` — `<n> Boros Energy lists · top <rank>`.

### C. List row (`.msl-row`) — collapsed
Same grid as the index header. Height **54px**, padding `0 26px`, `cursor:pointer`. Hover bg `#141518`. Wrapped in `.msl-item` (bottom border `1px solid #181a1f`; when `.open`, bg `#101113`). Cells:
- **Finish badge** `.msl-rank`: mono 15px/700, 28px tall, radius 5px, centered. **Tiered by rank** (`rankTier`): `t1` (1st) = filled `var(--accent)` on `#16120e` ink; `t3` (2–3) = accent text + `1px solid var(--accent)`; `t8` (4–8) = `#cfd2d8` text + `1px solid #23252b`; `t16` (9+) = `#868a93` text + `1px solid #1e2026`.
- **Player** `.msl-player` (flex column): name `b` 14.5px/600 `#e9eaee` (ellipsis); sub `.msl-psub` mono 10px `#868a93` — `60 main · 15 side`.
- **Record** `.msl-record`: mono 14px `#cfd2d8` (e.g. `6–1`).
- **Spice column** `.msl-spicecol` (flex, gap 6, wrap): up to **2** `.msl-chip`s (the spiciest cards) + a `+N` overflow chip. Chip: 11px `#cfd2d8`, bg `#16171b`, `1px solid #23252b`, radius 20px, padding `3px 9px`, led by a 6px accent **`.msl-spdot`** (`box-shadow:0 0 8px var(--accent)`); max-width 150px ellipsis. When no spice flagging: `.msl-stock` mono 10.5px `#5a5e67` — `stock` or `<n> off-meta`.
- **Chevron** `.msl-chev`: 12px `#868a93`, `▸` collapsed / `▾` open.

**Default open:** the top-ranked list of the first (most recent) event is expanded on load. Clicking a row toggles its detail (single-open accordion; clicking the open one closes it). Entrance: `.msl-detail` slides in via `@keyframes mslin` (translateY −4px → 0, .16s) — **no opacity fade** (kept capture/print-safe).

### D. Expanded detail — shared header (`.msl-dh`)
`display:flex; align-items:center; gap:18px`, padding `14px 0 16px`, bottom border `1px solid #23252b`. Left (`.msl-dhl`): a larger finish badge `.msl-dhrank` (mono 20px/700, 40px tall, radius 7px, same tier colors) + a column with **player** `.msl-dhplayer` (22px/700) and a meta row `.msl-dhmeta` (12.5px `#868a93`, `·` separators `#444`, each span `white-space:nowrap`): `<event>` + scope tag `.msl-sc` + `<date> · <record> · <entrants> entrants`. Right: **`.msl-export`** (reuses `.ms-export`, `white-space:nowrap`) — copies `exportDeckMTGO(deck)` to clipboard, flips label to `COPIED` for 1.4s.

Zone sub-headers (`.msl-zhd`): mono 10px/2px-tracked `#868a93`, with a count chip `b` (`#cfd2d8`, bg `#16171b`, `1px solid #23252b`, radius 4px) — `MAINDECK 60` / `SIDEBOARD 15`.

**Per-card field indicator `.msl-field`** (used in Columns & Rows): a 46×4px track (`#1c1e24`) with a fill (`#3a3e48`, or `var(--accent)` when `.sp`/spice) + a mono 10.5px `%` (`#868a93`, accent when spice). `title` = `"<n>% of <total> field lists run this card"`.

### E. Detail treatment 1 — **Columns** (`.msl-cols`, default)
Classic type-grouped decklist. Grid `1fr 300px` (maindeck / sideboard, sideboard column has a left border + 30px pad). Maindeck groups flow in a **2-column** `columns:2` masonry (`.msl-grpgrid`). Each `.msl-grp`: header `.msl-grphd` (mono 10px/1.5px accent label + dim count, bottom-bordered) then `.msl-line`s — `qty` (mono `#cfd2d8`) · card name `.msl-cn` (13.5px `#e9eaee`, ellipsis; **accent when spice**, with a small accent dot) · `.msl-field` (right-aligned). Sideboard is a flat `.msl-line` list (dashed dividers). Group order: Creatures, Planeswalkers, Instants, Sorceries, Enchantments, Artifacts, Battles, Other, **Lands last**.

### F. Detail treatment 2 — **Rows** (`.msl-rows`)
Two columns (`1fr 1fr`, maindeck / sideboard). Each `.msl-brow` grid `34px 40px 1fr 150px 54px` (drops the 40px art col when art is off), height 46px: big `qty×` (mono 15px) · **art thumbnail** (reuses `.ms-thumb`, 40×38 art-crop) · name cell (reuses `.ms-name`/`.ms-nm`/`.ms-meta` with color **pips** + type line) · field meter+% (reuses `.ms-meter`/`.ms-pct`, 80px track) · a `SPICE` tag `.msl-btag` (mono 8px accent outline) on spice rows. Spice rows tint `rgba(255,79,139,.05)`.

### G. Detail treatment 3 — **Spice-forward** (`.msl-spv`)
Leads with a callout strip `.msl-spstrip` (accent-tinted gradient bg, `1px solid rgba(255,79,139,.25)`, radius 10): header `.msl-ss-hd` (mono 11px/2px accent, glowing dot) `WHAT MAKES THIS LIST DIFFERENT`, then `.msl-spcard`s (flex, art 52×46 + info: `<qty>×` accent + name, and `only <field_pct>% of the field`, with an `SB` tag for sideboard spice). Empty case: `Stock list — nothing off-consensus.` Below, the full 75 in a de-emphasized compact two-column text list (`.msl-restcols`, `.msl-cgrp`/`.msl-cline`, spice lines in accent).

`DETAIL = { columns, rows, spice }` selects the component from the `detailStyle` tweak. **For production: pick one default** (Columns is the current default and the most analyst-friendly); the other two can ship as a view preference or be dropped.

---

## Spice logic
Pure client derivation from each line's `field_pct` (the card's inclusion across the whole field — identical to the aggregate view's `inclusion_pct`):

```js
const SPICE_THRESHOLD = 0.35;       // maindeck non-land run by < 35% of field = spice
const SPICE_THRESHOLD_SIDE = 0.22;  // sideboard card run by < 22% of field = spice
// per line: spice = zone==='main' && !is_land && field_pct < SPICE_THRESHOLD
// deck.spice[] = [...main, ...side].filter(spice rule).sort(field_pct ASC)
```
Thresholds are intentionally tuned so a typical list flags ~1–6 genuinely off-consensus cards (mainstream flex like a 50%-of-field card is **not** spice). Keep them configurable; the 35% / 22% defaults match the prototype and the sub-header note copy ("under 35%"). If you change the maindeck threshold, update the note copy too.


A wordmark **`metaspike`** (IBM Plex Mono, 17px/600, letter-spacing 0.5px, color `#e9eaee`) preceded by a **mark**: an EKG/line-chart "spike" — a flat baseline that jumps to a sharp peak — drawn as an inline SVG stroke in `var(--accent)`.

```
viewBox="0 0 30 22", stroke=var(--accent), stroke-width 2.2, round caps/joins:
  path d="M1 15 H8 L12 15 L15.5 3 L19 13 L21.5 9 H29"
```

It's a **first proposal** (the spike = a card "spiking" in the metagame). Designer is open to iterating on mark shape/weight and whether the wordmark itself carries color. There is no finalized brand asset yet — implement as SVG so it recolors with the accent.

---

## Core / Flex / Tech logic
Pure client-side derivation from `inclusion_pct`:

```js
function bucketOf(pct) {
  if (pct >= 0.85) return 'core';   // ≥ 85%  — non-negotiable shell
  if (pct >= 0.20) return 'flex';   // 20–85% — contested / deckbuilding decisions
  return 'tech';                    // < 20%  — metagame calls & one-ofs
}
```
Sort all rows by `inclusion_pct` desc, then partition into the three buckets, rendered Core → Flex → Tech. This split is the core value prop; keep the thresholds configurable but default exactly as above. (Brief described Core as "~90%+"; the implemented threshold is 85% to avoid a dead band between 80–90% — confirm with product before changing.)

---

## Interactions & behavior
- **MAIN / SIDE toggle**: swaps `p_zone` and re-renders the whole spread (re-fetch in prod). Pure client state.
- **Filters** (format / archetype / date): in prod, each change re-runs `archetype_card_stats` + `archetype_winrate` with new params and recomputes buckets + win-rate. Event scope is fixed (Challenges) and never a control.
- **Row hover**: row bg lightens to `#141518`; full-card image popover follows the cursor.
- **AVG hover**: native tooltip with the copy-count breakdown (no custom popover needed; `title` attribute is sufficient).
- **Export**: copies MTGO-format decklist to clipboard (prod: also offer `.txt` download).
- **No animations** beyond 0.08–0.12s bg/color transitions on hover. Keep it instant and terminal-like; this is a fast-scan analyst tool, not a marketing page.
- **Loading state** (prod): rows are data-dense; show a skeleton of ~12 rows per bucket (grey meter tracks) while RPC resolves. Card images load async and lazily — never block render on Scryfall.
- **Empty state**: `.ms-empty` — "— none in range —" when a bucket has no cards for the current filters.

---

## State management
Minimal. For the built view:
- `zone: 'main' | 'side'` — toggle state.
- `hover: row | null` + `anchor: {x,y}` — for the card-art popover.
- Tweak state (`accent`, `density`, `showArt`) — design-time only; in prod, `accent`/`density` would be user prefs or fixed, and the Tweaks panel is **not** shipped (it's a prototyping affordance).

For the full app, add:
- `mode: 'aggregate' | 'lists'` — top-level view toggle.
- `filters: { format, archetypeId, dateFrom, dateTo }` → query key for the RPCs.
- Server data: `cardStats`, `winrate`, `events`/`decks`, `comparison` — fetch via your data layer (React Query / SWR / Supabase client). Bucketing + sorting derive from `cardStats` in a `useMemo`; event grouping / spice / 75-sorting derive from `list_events` data in the client.
- LISTS view local state: `openDeckId` (single-open accordion), `detailStyle` (if you keep more than one treatment).
- Diff view: `compareA`, `compareB` deck ids → `compare_decks`.

---

## Design tokens

### Color — surfaces & ink (warm-neutral dark)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0c0d10` | app background, column-header bg |
| panel | `#141518` | row hover |
| panel-2 | `#101113` | sub-header, group-header bg |
| header grad | `#15161a → #0d0e11` | top bar |
| `--line` | `#23252b` | primary borders/dividers |
| row divider | `#181a1f` | between rows |
| meter track | `#1c1e24` | inclusion meter background |
| control bg | `#0a0b0e` | dropdowns, zone/export buttons |
| dashed border | `#34373f` | fixed SCOPE label |
| `--ink` | `#e9eaee` | primary text |
| `--ink2` | `#cfd2d8` | secondary numerics |
| `--dim` | `#868a93` | labels, captions, tertiary |

### Accent (`--accent`) — the single signal color
- **Default: `#ff4f8b` (magenta)** — the chosen direction.
- On-accent ink (text/icons placed on an accent fill): **`#16120e`**.
- Used for: logo mark, win-rate figure, Core tick+label, inclusion meter fill, active zone button, export hover, the caution `▲`.
- Curated alternates offered in the prototype (all avoid MTGO-red / MTGGoldfish blue-green / yellow): ember `#ff6a3d`, violet `#8b7bff`, magenta `#ff4f8b`, teal `#3fb6a8`, bone `#e8e2d4`. Ship as a single brand accent (magenta) unless product wants user theming.

### MTG color-identity pips (data encoding, fixed)
W `#efe7cf` · U `#5b87b8` · B `#7a7a82` · R `#cf5640` · G `#4f9a68` · colorless `#54585f`.

### Typography
- **Body / UI**: `'IBM Plex Sans'` (400/500/600/700).
- **Numerics, labels, code-like accents**: `'IBM Plex Mono'` (400/500/600/700). All stats, %, records, mono labels.
- Scale used: h1 30/700; win-rate 40/700 mono; card name 14–15/600; numerics 13–17 mono; section label 13/700 mono +3px tracking; micro-labels 8.5–10px mono uppercase +1.5px tracking; captions 10.5–12px.

### Spacing & metrics
- Page gutter: **26px** horizontal.
- Header 62px · column header 34px · group header ~38px · row 50px (compact 42 / comfy 60).
- Grid columns: **`40px 1fr 240px 78px 46px`** (art / card / inclusion / avg / n), `gap 18px`; drop col 1 when art is hidden.
- Radii: 3px (pills/meters) · 4px (thumbnail) · 5–6px (controls) · 12px (hover popover).
- Sticky stack z-index: header 30 > column header 20 > group header 15.

---

## Assets — card imagery (Scryfall)
No local assets. Card art loads **live from Scryfall** via the named-image endpoint (no scryfall_id needed for the mock; production should prefer the resolved `image_url`/`scryfall_id` from the RPC):

```
https://api.scryfall.com/cards/named?exact=<FRONT_FACE_NAME>&format=image&version=<art_crop|normal>&face=front
```
- Use **`version=art_crop`** for row thumbnails, **`version=normal`** for the hover popover.
- **`&face=front` is required** so double-faced / modal-DFC cards resolve (e.g. "Witch Enchanter // Witch-Blessed Meadow"). For split/DFC names, query the **front-face name only** (the substring before `" // "`).
- **Production note**: don't hammer Scryfall per-render. Store `scryfall_id` server-side and build canonical `cards.scryfall.io` URLs, or cache/proxy. Respect Scryfall's rate-limit + caching guidance. Lazy-load images; never block the table on them.

---

## Files in this bundle
- **`metaspike.html`** — the high-fidelity app shell (React via in-browser Babel). Visual source of truth. Search `const CSS = \`` for the aggregate styles; component tree is `App → Logo / Header (mode + zone toggles) / Sub-header / { AGGREGATE: colhd + GROUPS[] → Row | LISTS: <ListsView/> }`. The `App` holds `mode` (`'aggregate'|'lists'`), `zone`, hover state, and the Tweaks.
- **`lists.jsx`** — the **LISTS view** (`window.MSLists.ListsView`): events index, expandable `ListRow`, the three detail treatments (`DetailColumns`/`DetailRows`/`DetailSpice`), the per-card `Field` indicator, and per-list `Export`. All `.msl-` CSS is in the `LIST_CSS` string at the bottom. Loaded as `text/babel` **after** `shared.jsx`.
- **`shared.jsx`** — primitives shared by both views (`window.MSShared`): `Logo`, `Pips`, `HoverArt`, `PIP` color map, `fmtPct`. Loaded **before** `lists.jsx` and the main app script.
- **`data/mockData.js`** — `window.MTG`: mock implementations of every RPC returning the exact contract shapes. Aggregate: `archetype_card_stats`, `archetype_winrate`, `bucketOf`, the Modern **Boros Energy** dataset (main + side), `DECK_A`/`DECK_B`, `exportMTGO`, Scryfall helpers. **Lists:** `list_events`, `all_decks`, `exportDeckMTGO`, `cardInfo`, `primaryType`, `ordinal`, `SPICE_THRESHOLD` — synthesized from a CORE shell + FLEX/SIDE packages, with `field_pct` read from the aggregate dataset. **Code your data layer to these shapes.**
- **`tweaks-panel.jsx`** — the prototyping Tweaks panel (accent / decklist-style / flag-spice / density / art). **Design-time only — do not ship.** Included so the HTML runs standalone.

To run the mock locally: serve the folder over HTTP (e.g. `npx serve`) and open `metaspike.html` — it needs `data/mockData.js`, `shared.jsx`, `lists.jsx`, `tweaks-panel.jsx` as siblings and internet access for fonts + Scryfall.

---

## Build-out roadmap (what's mock vs real)
1. **Wire RPCs** — replace `window.MTG.*` with Supabase RPC calls; keep return shapes identical. Bucketing/sorting stay client-side.
2. **Make filters functional** — format / archetype / date drive RPC params; recompute all views on change. Keep Challenges scope as a static label.
3. **Sideboard** — already works via the zone toggle; just point at live data.
4. **LISTS view** — already built (events index + expandable 75s + spice). Production wiring: back `list_events()` with real per-deck 75s + each card's field inclusion; keep grouping/spice/sort client-side. **Decide the default detail treatment** (Columns recommended) and whether to ship the other two as a preference. Pull `event_scope`/`entrants`/`rank`/`record` from results.
5. **75-vs-75 diff** — build view (spec above) + reuse the LISTS index to pick the two lists (a "Compare" affordance on any list row is the natural entry point).
6. **Export** — real MTGO `.txt` download from the selected list.
7. **Win-rate guardrails** — keep the "among published winners / survivorship-biased" labeling in any surface that shows `win_pct`.
8. **Recharts** — not needed for the current row design (avg-only). If product later wants the copy-count distribution back as a visual (it was explicitly removed in favor of avg + hover tooltip), that's where Recharts would come in — but confirm before re-adding; the current direction is deliberately graph-free.
