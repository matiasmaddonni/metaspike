// Helpers to derive Scryfall CDN URLs at render time.
// We persist `image_url` (normal size) in cards.image_url; thumbnails want
// the smaller `art_crop` version and the hover popover wants `normal`.

type ImageSource = {
  scryfall_id: string | null;
  image_url: string | null;
};

function scryfallUrl(scryfall_id: string, version: "art_crop" | "normal"): string {
  return `https://cards.scryfall.io/${version}/front/${scryfall_id[0]}/${scryfall_id[1]}/${scryfall_id}.jpg`;
}

export function thumbUrl(row: ImageSource): string | null {
  if (row.scryfall_id) return scryfallUrl(row.scryfall_id, "art_crop");
  return row.image_url;
}

export function fullCardUrl(row: ImageSource): string | null {
  if (row.scryfall_id) return scryfallUrl(row.scryfall_id, "normal");
  return row.image_url;
}
