-- 010_holding.sql
-- metaloan: what each user physically owns.
--
-- Keyed by oracle_id, not scryfall_id. Borrowing does not care about set,
-- printing, foil, or language — a Ragavan is a Ragavan. oracle_id is the
-- printing-agnostic identity.
--
-- No FK to public.cards: its PK is scryfall_id and oracle_id is not unique
-- there (one row per printing). The oracle_card view below is the lookup
-- surface; validity of oracle_id is enforced by the RPCs that write holdings,
-- not by a constraint.
--
-- public.cards is granted to authenticated outright. It is Scryfall data —
-- public by definition, nothing gained by hiding it, and granting it lets
-- oracle_card run as security_invoker with no advisor warning.
--
-- Holdings are visible to their owner only. Cross-user reads go exclusively
-- through SECURITY DEFINER RPCs (011+), which is what makes crew.visibility
-- 'query_only' enforceable later without touching this table.

grant select on public.cards to authenticated;

create view public.oracle_card
with (security_invoker = on) as
select distinct on (c.oracle_id)
  c.oracle_id,
  c.name,
  c.name_front,
  c.mana_value,
  c.type_line,
  c.colors,
  c.image_url
from public.cards c
order by c.oracle_id, c.name;

grant select on public.oracle_card to authenticated;

create table public.holding (
  user_id    uuid not null references auth.users(id) on delete cascade,
  oracle_id  uuid not null,
  qty        int  not null check (qty > 0),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (user_id, oracle_id)
);

create index holding_oracle_idx on public.holding (oracle_id);

alter table public.holding enable row level security;

create policy holding_all_own on public.holding
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.holding to authenticated;
grant select, insert, update, delete on public.holding to service_role;
