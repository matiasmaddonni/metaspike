// MTGO display name → Scryfall canonical name aliases.
// Some sets (e.g. the Spider-Man set OM1) print IP-licensed names on the card
// while Scryfall stores the gameplay name as `name` and the licensed string as
// `printed_name`. The `printed_name` field is omitted from the oracle_cards
// bulk file we use, so until we switch to default-cards or query the API live,
// we hardcode known aliases here.
//
// Add entries as enrichment surfaces unmatched MTGO names from these sets.
// To find the canonical name for an unmatched MTGO card:
//   1. Find its digitalobjectcatalogid in any cached event HTML.
//   2. curl https://api.scryfall.com/cards/mtgo/<docid> — read `.name`.
//
// TODO: automate by querying the Scryfall /cards/mtgo endpoint for unmatched
// names during enrichment, then proposing aliases to add here (or persisting
// them in a DB table).

export const MTGO_NAME_ALIASES: Record<string, string> = {
  // --- Spider-Man set (OM1) ---
  "Ademi of the Silkchutes": "Spectacular Spider-Man",
  "Fire-Brained Scheme": "Heroes' Hangout",
  "Kavaero, Mind-Bitten": "Superior Spider-Man",
  "Kraza, the Swarm as One": "Spider-Punk",
  "Makdee and Itla, Skysnarers": "Spider-Woman, Stunning Savior",
};

export function aliasMtgoName(name: string): string {
  return MTGO_NAME_ALIASES[name] ?? name;
}
