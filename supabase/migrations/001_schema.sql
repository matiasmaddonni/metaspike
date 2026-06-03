-- 001_schema.sql
-- Core schema: events, cards, decks, deck_cards.
-- Multi-format by design. archetype + FK from decks live in 002_archetype.sql.

create table public.events (
  id              bigserial primary key,
  mtgo_event_id   text not null unique,
  format          text not null check (format in ('modern', 'standard', 'pioneer')),
  event_name      text not null,
  event_tier      text not null check (event_tier in (
                    'challenge', 'showcase_challenge', 'qualifier', 'super_qualifier'
                  )),
  event_date      date not null,
  event_size      int,
  source_url      text not null,
  raw_cache_path  text,
  ingested_at     timestamptz not null default now()
);

create index events_format_date_idx on public.events (format, event_date desc);

create table public.cards (
  scryfall_id   uuid primary key,
  oracle_id     uuid not null,
  name          text not null,
  name_front    text not null,
  mana_value    int,
  type_line     text,
  colors        text[],
  image_url     text,
  enriched_at   timestamptz not null default now()
);

create index cards_name_front_idx on public.cards (name_front);

create table public.decks (
  id            bigserial primary key,
  event_id      bigint not null references public.events(id) on delete cascade,
  format        text not null check (format in ('modern', 'standard', 'pioneer')),
  player        text not null,
  rank          int not null,
  score         int not null,
  archetype_id  int,
  unique (event_id, player, rank)
);

create index decks_format_archetype_event_idx on public.decks (format, archetype_id, event_id);

create table public.deck_cards (
  deck_id     bigint not null references public.decks(id) on delete cascade,
  card_name   text not null,
  zone        text not null check (zone in ('main', 'side')),
  qty         int not null check (qty > 0),
  scryfall_id uuid references public.cards(scryfall_id),
  primary key (deck_id, card_name, zone)
);

create index deck_cards_card_zone_idx on public.deck_cards (card_name, zone);
