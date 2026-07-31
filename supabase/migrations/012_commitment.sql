-- 012_commitment.sql
-- metaloan: "these are the cards I plan to sleeve at that event."
--
-- A user may hold several commitments for the same event — the two-deck case,
-- where you bring both and decide on the morning. Hence (local_event_id,
-- user_id, label) rather than one row per user per event.
--
-- Because only one of those decks actually gets played, the locked quantity
-- for a card is the MAX across a user's commitments for that event, never the
-- SUM. Two candidate decks that each want 4 Force of Negation lock 4, not 8.
-- Summing would phantom-lock cards the user still physically has and make
-- them look card-poor to the crew. The MAX lives in the availability RPC
-- (014), not here — this table just records intent.
--
-- SECRECY: commitments are visible to their owner and to nobody else, not
-- even crew owners. A commitment IS your decklist, and the crew contains
-- people you will sit across from at the RCQ. Only the aggregate effect
-- leaks — "this card is unavailable" — never which deck consumed it. Any
-- future RPC over this table must preserve that.

create table public.commitment (
  id             bigserial primary key,
  local_event_id bigint not null references public.local_event(id) on delete cascade,
  user_id        uuid   not null references auth.users(id) on delete cascade,
  label          text   not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (local_event_id, user_id, label)
);

create index commitment_user_event_idx
  on public.commitment (user_id, local_event_id);

create table public.commitment_card (
  commitment_id bigint not null references public.commitment(id) on delete cascade,
  oracle_id     uuid   not null,
  qty           int    not null check (qty > 0),
  primary key (commitment_id, oracle_id)
);

alter table public.commitment      enable row level security;
alter table public.commitment_card enable row level security;

create policy commitment_all_own on public.commitment
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_local_event(local_event_id));

create policy commitment_card_all_own on public.commitment_card
  for all to authenticated
  using (exists (
    select 1 from public.commitment c
    where c.id = commitment_card.commitment_id
      and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.commitment c
    where c.id = commitment_card.commitment_id
      and c.user_id = auth.uid()
  ));

grant select, insert, update, delete on
  public.commitment,
  public.commitment_card
to authenticated;

grant select, insert, update, delete on
  public.commitment,
  public.commitment_card
to service_role;
