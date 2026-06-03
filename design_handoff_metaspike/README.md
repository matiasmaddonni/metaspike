# Handoff: metaspike — MTG archetype study tool

## Overview
**metaspike** is a deckbuilding companion for competitive Magic: The Gathering players studying an archetype to pick and tune a tournament deck. It visualizes how top finishers build and sideboard within an archetype across any 1v1 (75-card) format, plus a win-rate signal.

The **centerpiece** is the **Card-spread view**: one row per card in the archetype, showing its **inclusion %** across the filtered decklists and its **average copy count**, with rows auto-grouped into **Core / Flex / Tech** bands. That grouping is the product's reason to exist — it's where deckbuilding decisions live.

This handoff covers the **built, high-fidelity landing view** (`metaspike.html`) plus the full data contract and specs for the remaining views so they can be implemented consistently.

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

**Derived in the client, not the RPC:**
- **Bucketing** (Core/Flex/Tech) is computed from `inclusion_pct` — see "Core/Flex/Tech logic".
- Rows are **sorted by `inclusion_pct` descending** within the full set before bucketing.

---

## Views (priority order)

### 1. Card-spread view — BUILT (this is the landing) ⭐
The home view. One row per card; inclusion % + avg copies; auto-grouped Core/Flex/Tech. Detailed below under "Built view: anatomy".

### 2. Sideboard spread — BUILT (same component, `zone='side'`)
Identical component, fed `archetype_card_stats(..., p_zone='side')`. Toggled by the **MAIN / SIDE** control in the header. No separate screen.

### 3. Win-rate panel — BUILT (compact, in the sub-header)
Per archetype. Big `win_pct` figure + `match_wins–match_losses` record. **Must be labeled "among published winners" and read as survivorship-biased — never as an absolute win rate.** In the mock it's a sub-header block with a caution line. Do not let it visually dominate or imply ground truth.

### 4. 75-vs-75 diff — SPEC ONLY (not yet built)
Pick two lists (from `list_decks`), call `compare_decks(a,b)`, render three columns: **only-in-A**, **shared** (with both quantities + a delta indicator), **only-in-B**. Counts in each column header. A reference implementation of this column layout exists in the earlier exploration file `Deck Lab — Copy-Count Directions` → `v2/tactical2.jsx`/`v2/term2.jsx` compare panels if useful, but build it natively. Entry point: a "Compare" affordance on any deck in a (future) deck list.

### 5. Export-to-MTGO — BUILT (stub)
Button present on the list (`EXPORT MTGO` in sub-header). Mock copies an MTGO-format text block to clipboard via `MTG.exportMTGO(deck)` → lines of `"<qty> <card>"` (split cards joined with `/`). Wire to the real selected list and trigger a `.txt` download in production.

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

## Logo
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
- `filters: { format, archetypeId, dateFrom, dateTo }` → query key for the RPCs.
- Server data: `cardStats`, `winrate`, `decks`, `comparison` — fetch via your data layer (React Query / SWR / Supabase client). Bucketing + sorting derive from `cardStats` in a `useMemo`.
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
- **`metaspike.html`** — the high-fidelity landing view (React via in-browser Babel). Visual source of truth. Search `const CSS = \`` for all styles; component tree is `App → Logo / Header / Sub-header / colhd / GROUPS[] → Row`.
- **`data/mockData.js`** — `window.MTG`: mock implementations of every RPC (`archetype_card_stats`, `archetype_winrate`, `list_decks`, `compare_decks`, `exportMTGO`) returning the exact contract shapes, plus the Modern **Boros Energy** dataset (main + side), two concrete 75s (`DECK_A`/`DECK_B`) for the diff, the Scryfall URL helpers, and `bucketOf`. **Code your data layer to these shapes.**
- **`tweaks-panel.jsx`** — the prototyping Tweaks panel (accent/density/art controls). **Design-time only — do not ship.** Included so the HTML runs standalone.

To run the mock locally: serve the folder over HTTP (e.g. `npx serve`) and open `metaspike.html` — it needs `data/mockData.js` as a sibling and internet access for fonts + Scryfall.

---

## Build-out roadmap (what's mock vs real)
1. **Wire RPCs** — replace `window.MTG.*` with Supabase RPC calls; keep return shapes identical. Bucketing/sorting stay client-side.
2. **Make filters functional** — format / archetype / date drive RPC params; recompute all views on change. Keep Challenges scope as a static label.
3. **Sideboard** — already works via the zone toggle; just point at live data.
4. **75-vs-75 diff** — build view #4 (spec above) + a deck list (from `list_decks`) to pick the two lists.
5. **Export** — real MTGO `.txt` download from the selected list.
6. **Win-rate guardrails** — keep the "among published winners / survivorship-biased" labeling in any surface that shows `win_pct`.
7. **Recharts** — not needed for the current row design (avg-only). If product later wants the copy-count distribution back as a visual (it was explicitly removed in favor of avg + hover tooltip), that's where Recharts would come in — but confirm before re-adding; the current direction is deliberately graph-free.
