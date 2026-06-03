/* ============================================================================
   Deck Lab — mock data layer
   Shapes mirror the shared Supabase RPC contract so swapping to live data
   is a 1:1 replacement. Everything is computed from per-card "rows" plus a
   total_decks count, exactly like archetype_card_stats would return.
   ============================================================================ */
(function () {
  // ---- Scryfall image helpers (live art, no scryfall_id needed) -------------
  const ART = (name, v) =>
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name.split(" // ")[0])}&format=image&version=${v}&face=front`;
  const artCrop = (n) => ART(n, "art_crop");
  const fullCard = (n) => ART(n, "normal");

  // ---- Formats / archetypes / date presets ----------------------------------
  const FORMATS = ["Modern", "Pioneer", "Legacy", "Standard", "Pauper"];

  const ARCHETYPES = {
    Modern: [
      { id: "boros-energy", name: "Boros Energy", colors: ["R", "W"] },
      { id: "izzet-murktide", name: "Izzet Murktide", colors: ["U", "R"] },
      { id: "domain-zoo", name: "Domain Zoo", colors: ["R", "G", "W"] },
      { id: "amulet-titan", name: "Amulet Titan", colors: ["G"] },
      { id: "dimir-control", name: "Dimir Control", colors: ["U", "B"] },
    ],
    Pioneer: [
      { id: "izzet-phoenix", name: "Izzet Phoenix", colors: ["U", "R"] },
      { id: "rakdos-vamp", name: "Rakdos Vampires", colors: ["B", "R"] },
    ],
    Legacy: [{ id: "izzet-delver", name: "Izzet Delver", colors: ["U", "R"] }],
    Standard: [{ id: "golgari-mid", name: "Golgari Midrange", colors: ["B", "G"] }],
    Pauper: [{ id: "mono-r-burn", name: "Mono-Red Burn", colors: ["R"] }],
  };

  const DATE_PRESETS = [
    { id: "30d", label: "Last 30 days", from: "2026-05-04", to: "2026-06-03" },
    { id: "90d", label: "Last 90 days", from: "2026-03-05", to: "2026-06-03" },
    { id: "season", label: "This season", from: "2026-01-01", to: "2026-06-03" },
    { id: "all", label: "All time", from: "2024-01-01", to: "2026-06-03" },
  ];

  // ---- Core archetype dataset: Modern Boros Energy ---------------------------
  // copy_breakdown values are deck-counts running that many copies.
  // n_decks = sum(copy_breakdown); inclusion_pct = n_decks / total_decks.
  const TOTAL = 64;

  const MAIN = [
    ["Ragavan, Nimble Pilferer", 1, "Legendary Creature — Monkey Pirate", ["R"], { 4: 60, 3: 2, 2: 1 }],
    ["Ocelot Pride", 1, "Legendary Creature — Cat", ["W"], { 4: 58, 3: 3 }],
    ["Guide of Souls", 1, "Creature — Angel", ["W"], { 4: 55, 3: 4, 2: 2 }],
    ["Galvanic Discharge", 1, "Instant", ["R"], { 4: 50, 3: 6, 2: 3 }],
    ["Phlage, Titan of Fire's Fury", 5, "Legendary Creature — Elder Giant", ["R", "W"], { 2: 34, 3: 14, 1: 6 }],
    ["Goblin Bombardment", 2, "Enchantment", ["R"], { 2: 30, 3: 18, 1: 9 }],
    ["Amped Raptor", 2, "Creature — Dinosaur", ["R"], { 4: 30, 3: 12, 2: 8 }],
    ["Static Prison", 2, "Enchantment", ["W"], { 2: 24, 1: 14, 3: 8 }],
    ["Emberheart Challenger", 1, "Creature — Goblin Warrior", ["R"], { 4: 18, 3: 8, 2: 6 }],
    ["Ajani, Nacatl Pariah", 2, "Legendary Creature — Cat Warrior", ["W"], { 1: 12, 2: 13, 3: 4 }],
    ["Seasoned Pyromancer", 3, "Creature — Human Shaman", ["R"], { 2: 10, 1: 6, 3: 3 }],
    ["Recruitment Officer", 1, "Creature — Human Soldier", ["W"], { 4: 8, 2: 4, 1: 2 }],
    ["Sunspine Lynx", 4, "Creature — Elemental Cat", ["R"], { 2: 5, 3: 4 }],
    ["Witch Enchanter // Witch-Blessed Meadow", 4, "Creature — Elemental // Land", ["W"], { 1: 6, 2: 4 }],
    ["Blood Moon", 3, "Enchantment", ["R"], { 2: 5, 1: 3 }],
    // mana base
    ["Inspiring Vantage", 0, "Land", [], { 4: 55, 3: 5 }],
    ["Sacred Foundry", 0, "Land — Mountain Plains", [], { 2: 30, 3: 20, 1: 9 }],
    ["Arid Mesa", 0, "Land", [], { 4: 40, 3: 14, 2: 4 }],
    ["Sunbaked Canyon", 0, "Land", [], { 3: 30, 2: 18, 4: 7 }],
    ["Den of the Bugbear", 0, "Land", [], { 2: 30, 3: 15, 1: 6 }],
    ["Plains", 0, "Basic Land — Plains", [], { 2: 24, 1: 20, 3: 18 }],
    ["Mountain", 0, "Basic Land — Mountain", [], { 2: 30, 1: 18, 3: 13 }],
  ];

  const SIDE = [
    ["Wear // Tear", 1, "Instant // Instant", ["R", "W"], { 2: 28, 1: 8, 3: 4 }],
    ["Disruptor Flute", 1, "Artifact", [], { 2: 20, 1: 10, 3: 5 }],
    ["Blood Moon", 3, "Enchantment", ["R"], { 1: 20, 2: 12 }],
    ["Prismatic Ending", 1, "Sorcery", ["W"], { 2: 18, 1: 9, 3: 4 }],
    ["Wrath of the Skies", 4, "Sorcery", ["W"], { 2: 18, 1: 9 }],
    ["Soulless Jailer", 3, "Artifact", [], { 1: 16, 2: 9 }],
    ["Ghost Vacuum", 1, "Artifact", [], { 1: 12, 2: 7 }],
    ["Smash to Smithereens", 2, "Instant", ["R"], { 2: 10, 1: 7 }],
    ["Path to Exile", 1, "Instant", ["W"], { 1: 10, 2: 6 }],
    ["Sunspine Lynx", 4, "Creature — Elemental Cat", ["R"], { 2: 8, 1: 5 }],
    ["Kor Firewalker", 2, "Creature — Kor Soldier", ["W"], { 2: 5, 1: 4 }],
    ["Pyroclasm", 2, "Sorcery", ["R"], { 2: 4, 1: 3 }],
  ];

  function expand(rows, zone) {
    return rows.map(([card_name, mana_value, type_line, colors, copy_breakdown]) => {
      const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, ...copy_breakdown };
      const n_decks = breakdown[1] + breakdown[2] + breakdown[3] + breakdown[4];
      const weighted = 1 * breakdown[1] + 2 * breakdown[2] + 3 * breakdown[3] + 4 * breakdown[4];
      return {
        card_name,
        scryfall_id: card_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        image_url: artCrop(card_name),
        art_url: artCrop(card_name),
        card_url: fullCard(card_name),
        mana_value,
        type_line,
        colors,
        zone,
        is_land: /Land/.test(type_line),
        inclusion_pct: n_decks / TOTAL,
        avg_copies: n_decks ? weighted / n_decks : 0,
        copy_breakdown: breakdown,
        n_decks,
      };
    });
  }

  // Grouping rule — THE deckbuilding split.
  function bucketOf(pct) {
    if (pct >= 0.85) return "core";
    if (pct >= 0.2) return "flex";
    return "tech";
  }

  // Light deterministic jitter so changing filters visibly recomputes.
  function seededScale(seed) {
    let x = Math.sin(seed) * 10000;
    return 0.9 + (x - Math.floor(x)) * 0.2; // 0.9..1.1
  }

  // ---- RPC-shaped API --------------------------------------------------------
  function archetype_card_stats({ p_zone = "main", p_seed = 0 } = {}) {
    const base = p_zone === "side" ? SIDE : MAIN;
    let rows = expand(base, p_zone);
    if (p_seed) {
      rows = rows
        .map((r) => {
          const f = seededScale(p_seed + r.card_name.length);
          const pct = Math.max(0.02, Math.min(0.99, r.inclusion_pct * f));
          return { ...r, inclusion_pct: pct, n_decks: Math.round(pct * TOTAL) };
        });
    }
    rows.sort((a, b) => b.inclusion_pct - a.inclusion_pct);
    rows.forEach((r) => (r.bucket = bucketOf(r.inclusion_pct)));
    return { rows, meta: { total_decks: TOTAL } };
  }

  function archetype_winrate({ p_seed = 0 } = {}) {
    const f = p_seed ? seededScale(p_seed) : 1;
    const wins = Math.round(412 * f);
    const losses = Math.round(233 * (2 - f));
    return {
      n_decks: TOTAL,
      n_events: 8,
      match_wins: wins,
      match_losses: losses,
      win_pct: wins / (wins + losses),
      basis: "published winners only",
    };
  }

  const PLAYERS = [
    "kanister", "Aspiringspike", "MarcoTabladaG", "DyceBancroft", "Nikachu",
    "_INSANE_", "WhiteFaces", "JPA93", "Cftsoc3", "BradB", "Yoman5", "EAUR",
  ];
  const EVENTS = [
    "Modern Challenge 64", "Modern Challenge 32", "Modern Showcase Challenge",
  ];

  function list_decks({ p_seed = 0 } = {}) {
    const rng = (n) => {
      let x = Math.sin((p_seed + n) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return PLAYERS.map((player, i) => {
      const w = 4 + Math.floor(rng(i) * 3); // 4-6 wins
      const l = Math.floor(rng(i + 99) * 3); // 0-2
      const rank = i + 1;
      const d = 2 + Math.floor(rng(i + 7) * 2);
      return {
        deck_id: `dk-${i + 1}`,
        player,
        event_name: EVENTS[i % EVENTS.length],
        event_date: `2026-06-0${d}`,
        rank,
        record: `${w}-${l}`,
        archetype_id: "boros-energy",
      };
    });
  }

  // Two concrete 75s for the diff view.
  const DECK_A = {
    deck_id: "dk-1", player: "kanister", event: "Modern Challenge 64 · 1st",
    cards: {
      "Ragavan, Nimble Pilferer": 4, "Ocelot Pride": 4, "Guide of Souls": 4,
      "Galvanic Discharge": 4, "Goblin Bombardment": 3, "Amped Raptor": 4,
      "Phlage, Titan of Fire's Fury": 2, "Static Prison": 2, "Ajani, Nacatl Pariah": 1,
      "Inspiring Vantage": 4, "Sacred Foundry": 2, "Arid Mesa": 4, "Sunbaked Canyon": 3,
      "Den of the Bugbear": 2, "Plains": 2, "Mountain": 2,
      "Wear // Tear": 2, "Disruptor Flute": 2, "Blood Moon": 2, "Prismatic Ending": 2,
      "Wrath of the Skies": 2, "Soulless Jailer": 1, "Smash to Smithereens": 2, "Path to Exile": 0,
    },
  };
  const DECK_B = {
    deck_id: "dk-2", player: "Aspiringspike", event: "Modern Challenge 32 · 1st",
    cards: {
      "Ragavan, Nimble Pilferer": 4, "Ocelot Pride": 4, "Guide of Souls": 4,
      "Galvanic Discharge": 4, "Goblin Bombardment": 2, "Amped Raptor": 4,
      "Phlage, Titan of Fire's Fury": 3, "Emberheart Challenger": 4, "Static Prison": 1,
      "Inspiring Vantage": 4, "Sacred Foundry": 3, "Arid Mesa": 4, "Sunbaked Canyon": 2,
      "Den of the Bugbear": 2, "Plains": 1, "Mountain": 2,
      "Wear // Tear": 3, "Disruptor Flute": 2, "Blood Moon": 1, "Prismatic Ending": 2,
      "Wrath of the Skies": 1, "Ghost Vacuum": 1, "Sunspine Lynx": 2, "Kor Firewalker": 2,
    },
  };

  function compare_decks(a = DECK_A, b = DECK_B) {
    const names = new Set([...Object.keys(a.cards), ...Object.keys(b.cards)]);
    const only_in_a = [], only_in_b = [], shared = [];
    [...names].forEach((card) => {
      const qa = a.cards[card] || 0;
      const qb = b.cards[card] || 0;
      if (qa && !qb) only_in_a.push({ card, qty: qa });
      else if (qb && !qa) only_in_b.push({ card, qty: qb });
      else if (qa && qb) shared.push({ card, qty_a: qa, qty_b: qb });
    });
    const byCard = (x, y) => x.card.localeCompare(y.card);
    return { only_in_a: only_in_a.sort(byCard), only_in_b: only_in_b.sort(byCard), shared: shared.sort(byCard), a, b };
  }

  // MTGO .txt export string for a list.
  function exportMTGO(deck) {
    const main = [], side = [];
    Object.entries(deck.cards).forEach(([card, qty]) => {
      if (qty > 0) main.push(`${qty} ${card.replace(" // ", "/")}`);
    });
    return main.join("\n");
  }

  /* ==========================================================================
     INDIVIDUAL LISTS  — events + concrete 75s for the per-deck browse view
     Each deck is built by merging the shared CORE shell with one flex package,
     so lists differ realistically and "spice" (off-consensus cards) emerges.
     ========================================================================== */

  // Field-inclusion + metadata lookup, keyed name|zone, computed from aggregate.
  const CARD_DB = (() => {
    const db = {};
    expand(MAIN, "main").forEach((r) => (db[r.card_name + "|main"] = r));
    expand(SIDE, "side").forEach((r) => (db[r.card_name + "|side"] = r));
    return db;
  })();
  // Generic metadata for any card (basics etc) falling back across zones.
  const META = {
    "Plains": { type_line: "Basic Land — Plains", colors: [] },
    "Mountain": { type_line: "Basic Land — Mountain", colors: [] },
  };
  function cardInfo(name, zone) {
    const hit = CARD_DB[name + "|" + zone] || CARD_DB[name + "|main"] || CARD_DB[name + "|side"];
    if (hit) return hit;
    const m = META[name] || { type_line: "Card", colors: [] };
    return {
      card_name: name, type_line: m.type_line, colors: m.colors, mana_value: 0,
      is_land: /Land/.test(m.type_line),
      art_url: artCrop(name), card_url: fullCard(name),
      inclusion_pct: 0.99, avg_copies: 0,
    };
  }

  function mergeCounts(...maps) {
    const o = {};
    maps.forEach((m) => Object.entries(m).forEach(([k, v]) => (o[k] = (o[k] || 0) + v)));
    return o;
  }

  // Shared CORE shell — 48 cards. Flex packages each add exactly 12 → 60 main.
  const CORE_MAIN = {
    "Ragavan, Nimble Pilferer": 4, "Ocelot Pride": 4, "Guide of Souls": 4,
    "Galvanic Discharge": 4, "Amped Raptor": 4, "Goblin Bombardment": 3,
    "Phlage, Titan of Fire's Fury": 2, "Static Prison": 2,
    "Inspiring Vantage": 4, "Arid Mesa": 4, "Sacred Foundry": 2,
    "Sunbaked Canyon": 3, "Den of the Bugbear": 2, "Plains": 3, "Mountain": 3,
  };
  const FLEX = {
    P1: { "Emberheart Challenger": 4, "Ajani, Nacatl Pariah": 2, "Recruitment Officer": 2, "Seasoned Pyromancer": 1, "Plains": 1, "Mountain": 1, "Sacred Foundry": 1 },
    P2: { "Emberheart Challenger": 4, "Ajani, Nacatl Pariah": 3, "Witch Enchanter // Witch-Blessed Meadow": 2, "Sunspine Lynx": 1, "Plains": 1, "Mountain": 1 },
    P3: { "Recruitment Officer": 4, "Emberheart Challenger": 2, "Ajani, Nacatl Pariah": 2, "Blood Moon": 1, "Seasoned Pyromancer": 1, "Plains": 1, "Mountain": 1 },
    P4: { "Emberheart Challenger": 4, "Seasoned Pyromancer": 3, "Ajani, Nacatl Pariah": 1, "Sunspine Lynx": 2, "Den of the Bugbear": 1, "Sacred Foundry": 1 },
    P5: { "Emberheart Challenger": 3, "Ajani, Nacatl Pariah": 2, "Recruitment Officer": 2, "Witch Enchanter // Witch-Blessed Meadow": 2, "Sunspine Lynx": 1, "Plains": 2 },
  };
  const SB = {
    S1: { "Wear // Tear": 2, "Disruptor Flute": 2, "Blood Moon": 2, "Prismatic Ending": 2, "Wrath of the Skies": 2, "Soulless Jailer": 1, "Smash to Smithereens": 2, "Path to Exile": 2 },
    S2: { "Wear // Tear": 3, "Disruptor Flute": 2, "Blood Moon": 1, "Prismatic Ending": 2, "Wrath of the Skies": 1, "Ghost Vacuum": 1, "Sunspine Lynx": 2, "Kor Firewalker": 2, "Pyroclasm": 1 },
    S3: { "Wear // Tear": 2, "Disruptor Flute": 3, "Blood Moon": 2, "Prismatic Ending": 1, "Wrath of the Skies": 2, "Soulless Jailer": 2, "Path to Exile": 1, "Kor Firewalker": 2 },
    S4: { "Wear // Tear": 2, "Blood Moon": 2, "Prismatic Ending": 2, "Wrath of the Skies": 2, "Soulless Jailer": 1, "Ghost Vacuum": 2, "Smash to Smithereens": 2, "Pyroclasm": 2 },
  };

  // Authored finishes across 3 events (date desc; lists in finish order).
  const EVENT_DEFS = [
    { id: "mc64-0531", name: "Modern Challenge 64", date: "2026-05-31", scope: "CHALLENGE", entrants: 64,
      decks: [
        { player: "kanister", rank: 1, record: "6-1", flex: "P1", sb: "S1" },
        { player: "Aspiringspike", rank: 2, record: "6-1", flex: "P3", sb: "S2" },
        { player: "Nikachu", rank: 3, record: "5-2", flex: "P2", sb: "S1" },
        { player: "JPA93", rank: 5, record: "5-2", flex: "P4", sb: "S3" },
        { player: "Yoman5", rank: 9, record: "5-2", flex: "P5", sb: "S4" },
      ] },
    { id: "mc32-0524", name: "Modern Challenge 32", date: "2026-05-24", scope: "CHALLENGE", entrants: 32,
      decks: [
        { player: "MarcoTabladaG", rank: 1, record: "5-0", flex: "P2", sb: "S2" },
        { player: "Cftsoc3", rank: 2, record: "5-1", flex: "P1", sb: "S3" },
        { player: "_INSANE_", rank: 4, record: "4-1", flex: "P3", sb: "S1" },
        { player: "EAUR", rank: 7, record: "4-2", flex: "P4", sb: "S4" },
      ] },
    { id: "msc-0517", name: "Modern Showcase Challenge", date: "2026-05-17", scope: "SHOWCASE", entrants: 96,
      decks: [
        { player: "DyceBancroft", rank: 1, record: "7-1", flex: "P3", sb: "S2" },
        { player: "WhiteFaces", rank: 3, record: "6-2", flex: "P5", sb: "S1" },
        { player: "BradB", rank: 6, record: "6-2", flex: "P1", sb: "S4" },
      ] },
  ];

  const ORD = ["", "1st", "2nd", "3rd"];
  const ordinal = (n) => ORD[n] || n + "th";
  const SPICE_THRESHOLD = 0.35; // maindeck field inclusion below this = spice
  const SPICE_THRESHOLD_SIDE = 0.22;

  // Decorate a raw count map into sorted line objects with field data.
  function decorateZone(map, zone) {
    return Object.entries(map)
      .filter(([, q]) => q > 0)
      .map(([name, qty]) => {
        const info = cardInfo(name, zone);
        const field = info.inclusion_pct;
        return {
          card: name, qty, zone,
          type_line: info.type_line, colors: info.colors, mana_value: info.mana_value,
          is_land: info.is_land, art_url: info.art_url, card_url: info.card_url,
          field_pct: field,
          spice: zone === "main" && !info.is_land && field < SPICE_THRESHOLD,
        };
      })
      .sort((a, b) => {
        // lands last; then by mana value; then name
        if (a.is_land !== b.is_land) return a.is_land ? 1 : -1;
        if (a.mana_value !== b.mana_value) return a.mana_value - b.mana_value;
        return a.card.localeCompare(b.card);
      });
  }

  function primaryType(type_line) {
    const t = type_line.split(" // ")[0];
    if (/Land/.test(t)) return "Lands";
    if (/Planeswalker/.test(t)) return "Planeswalkers";
    if (/Creature/.test(t)) return "Creatures";
    if (/Instant/.test(t)) return "Instants";
    if (/Sorcery/.test(t)) return "Sorceries";
    if (/Enchantment/.test(t)) return "Enchantments";
    if (/Artifact/.test(t)) return "Artifacts";
    if (/Battle/.test(t)) return "Battles";
    return "Other";
  }
  const TYPE_ORDER = ["Creatures", "Planeswalkers", "Instants", "Sorceries", "Enchantments", "Artifacts", "Battles", "Other", "Lands"];

  function groupByType(lines) {
    const by = {};
    lines.forEach((l) => { (by[primaryType(l.type_line)] ||= []).push(l); });
    return TYPE_ORDER.filter((t) => by[t]).map((t) => ({
      type: t,
      cards: by[t],
      count: by[t].reduce((s, l) => s + l.qty, 0),
    }));
  }

  function buildDeck(ev, d, idx) {
    const mainMap = mergeCounts(CORE_MAIN, FLEX[d.flex]);
    const sideMap = SB[d.sb];
    const main = decorateZone(mainMap, "main");
    const side = decorateZone(sideMap, "side");
    const mainCount = main.reduce((s, l) => s + l.qty, 0);
    const sideCount = side.reduce((s, l) => s + l.qty, 0);
    const spiceCards = [...main, ...side]
      .filter((l) => l.zone === "side" ? l.field_pct < SPICE_THRESHOLD_SIDE : l.spice)
      .sort((a, b) => a.field_pct - b.field_pct);
    return {
      deck_id: `${ev.id}-${d.rank}`,
      player: d.player, rank: d.rank, rank_label: ordinal(d.rank), record: d.record,
      event_id: ev.id, event_name: ev.name, event_date: ev.date, event_scope: ev.scope, entrants: ev.entrants,
      main, side, main_count: mainCount, side_count: sideCount,
      groups_main: groupByType(main), groups_side: groupByType(side),
      spice: spiceCards,
    };
  }

  // Events with their decklists, ordered by date desc then finish.
  function list_events() {
    return EVENT_DEFS
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((ev) => {
        const decks = ev.decks
          .slice()
          .sort((a, b) => a.rank - b.rank)
          .map((d, i) => buildDeck(ev, d, i));
        return {
          id: ev.id, name: ev.name, date: ev.date, scope: ev.scope, entrants: ev.entrants,
          n_decks: decks.length,
          top_finish: ordinal(Math.min(...decks.map((d) => d.rank))),
          decks,
        };
      });
  }

  // Flat list of every deck (used for counts / future filtering).
  function all_decks() {
    return list_events().flatMap((e) => e.decks);
  }

  // MTGO export for a single concrete list (Deck / Sideboard sections).
  function exportDeckMTGO(deck) {
    const fmt = (l) => `${l.qty} ${l.card.replace(" // ", "/")}`;
    const out = ["Deck", ...deck.main.map(fmt)];
    if (deck.side.length) out.push("", "Sideboard", ...deck.side.map(fmt));
    return out.join("\n");
  }

  window.MTG = {
    FORMATS, ARCHETYPES, DATE_PRESETS, TOTAL,
    artCrop, fullCard, bucketOf,
    archetype_card_stats, archetype_winrate, list_decks, compare_decks, exportMTGO,
    DECK_A, DECK_B,
    // individual-lists feature
    list_events, all_decks, exportDeckMTGO, cardInfo, primaryType, ordinal,
    SPICE_THRESHOLD,
  };
})();
