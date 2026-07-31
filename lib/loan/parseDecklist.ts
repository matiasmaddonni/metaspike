// Decklist paste parser.
//
// Entering holdings by hand is the adoption risk that kills this kind of tool,
// so every shortcut into the data matters. This handles what people actually
// have on their clipboard: MTGO .txt, Arena export, Moxfield, Archidekt,
// Goldfish. They differ in set codes, "x" suffixes, and how the sideboard is
// marked, and agree on "<qty> <name>".
//
// Names come out exactly as written. Resolving them to oracle_ids is a
// separate concern — it needs the cards table and has to handle DFC front
// faces, which lib/scryfall/match.ts already solves for the ingester.

export type ParsedLine = {
  qty: number;
  name: string;
  /** Set code when the source carried one, else null. Ignored downstream. */
  set: string | null;
};

export type ParsedDecklist = {
  main: ParsedLine[];
  side: ParsedLine[];
  /** Lines that looked like content but did not parse. Surface these. */
  unparsed: string[];
};

const SIDEBOARD_HEADERS = /^(sideboard|side|sb)\b/i;
const MAINDECK_HEADERS = /^(deck|maindeck|main|commander|companion)\b/i;
const COMMENT = /^(\/\/|#)/;

// "4 Ragavan, Nimble Pilferer (MH2) 138" / "4x Ragavan" / "4 Ragavan"
const LINE = /^(\d+)\s*x?\s+(.+?)\s*$/i;
const TRAILING_SET = /\s*\(([A-Za-z0-9]{2,5})\)(?:\s+[\dA-Za-z-]+)?\s*$/;

function parseLine(raw: string): ParsedLine | null {
  const match = raw.match(LINE);
  if (!match) return null;

  const qty = Number.parseInt(match[1], 10);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  let name = match[2].trim();
  let set: string | null = null;

  const setMatch = name.match(TRAILING_SET);
  if (setMatch) {
    set = setMatch[1].toUpperCase();
    name = name.slice(0, setMatch.index).trim();
  }

  // Moxfield/Archidekt category suffixes: "Ragavan [Creatures]"
  name = name.replace(/\s*\[[^\]]*\]\s*$/, "").trim();

  if (name.length === 0) return null;
  return { qty, name, set };
}

export function parseDecklist(input: string): ParsedDecklist {
  const main: ParsedLine[] = [];
  const side: ParsedLine[] = [];
  const unparsed: string[] = [];

  let zone: "main" | "side" = "main";
  let sawBlank = false;
  let explicitSideboard = false;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) {
      sawBlank = true;
      continue;
    }
    if (COMMENT.test(line)) continue;

    if (SIDEBOARD_HEADERS.test(line) && !LINE.test(line)) {
      zone = "side";
      explicitSideboard = true;
      sawBlank = false;
      continue;
    }
    if (MAINDECK_HEADERS.test(line) && !LINE.test(line)) {
      zone = "main";
      sawBlank = false;
      continue;
    }

    const parsed = parseLine(line);
    if (!parsed) {
      unparsed.push(line);
      continue;
    }

    // MTGO .txt has no "Sideboard" header — a blank line separates the zones.
    // Only honour that if no explicit header ever appeared, otherwise a blank
    // line inside a grouped Moxfield export would flip the zone by accident.
    if (sawBlank && !explicitSideboard && zone === "main" && main.length > 0) {
      zone = "side";
    }
    sawBlank = false;

    (zone === "main" ? main : side).push(parsed);
  }

  return { main, side, unparsed };
}

/**
 * Collapse to total physical copies per name, main + side summed.
 *
 * That sum is what borrowing needs: the 4-of rule applies across the whole 75,
 * so a card listed 3 main and 1 side is four physical cards, not two separate
 * requirements.
 */
export function totalCopies(list: ParsedDecklist): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of [...list.main, ...list.side]) {
    totals.set(line.name, (totals.get(line.name) ?? 0) + line.qty);
  }
  return totals;
}
