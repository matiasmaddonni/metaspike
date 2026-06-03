-- 002_archetype.sql
-- Archetype + match-rule tables. Ship empty. User supplies rows later.
-- Wires the deferred FK from decks.archetype_id to archetype.id.

create table public.archetype (
  id           serial primary key,
  format       text not null check (format in ('modern', 'standard', 'pioneer')),
  name         text not null,
  description  text,
  unique (format, name)
);

create table public.archetype_match_rule (
  id            serial primary key,
  archetype_id  int  not null references public.archetype(id) on delete cascade,
  zone          text not null check (zone in ('main', 'side', 'any')),
  card_name     text not null,
  min_qty       int  not null default 1 check (min_qty > 0),
  group_id      int  not null,
  group_op      text not null default 'all' check (group_op in ('all'))
);

create index archetype_match_rule_archetype_idx
  on public.archetype_match_rule (archetype_id, group_id);

alter table public.decks
  add constraint decks_archetype_id_fkey
  foreign key (archetype_id) references public.archetype(id) on delete set null;
