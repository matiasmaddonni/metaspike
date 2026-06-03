-- 003_rpcs.sql
-- Phase 2 RPCs: list_decks + compare_decks.
-- archetype_card_stats + archetype_winrate ship in Phase 3 (migration 004).

create or replace function public._swiss_rounds(p_event_name text)
returns int
language sql
immutable
as $$
  select case
    when p_event_name ~ ' 32$' then 5
    when p_event_name ~ ' 64$' then 6
    when p_event_name ~ ' 96$' then 7
    else null
  end;
$$;

-- Derives "5-2"-style record from score + event_name.
-- Returns null for playoff finishers (rank <= 8): their score conflates Swiss
-- with bracket wins, so a clean W-L can't be reconstructed.
create or replace function public._record_for(
  p_score int,
  p_rank int,
  p_event_name text
)
returns text
language sql
immutable
as $$
  with v as (
    select
      public._swiss_rounds(p_event_name) as rounds,
      p_score / 3 as wins,
      p_score % 3 as draws
  )
  select case
    when p_rank <= 8 then null
    when v.rounds is null then null
    when v.rounds - v.wins - v.draws < 0 then null
    else v.wins::text || '-' || (v.rounds - v.wins - v.draws)::text
         || case when v.draws > 0 then '-' || v.draws::text else '' end
  end
  from v;
$$;

create or replace function public.list_decks(
  p_format text,
  p_archetype_id int,
  p_date_from date,
  p_date_to date
)
returns table (
  deck_id bigint,
  player text,
  event_name text,
  event_date date,
  rank int,
  record text,
  archetype_id int
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    d.id as deck_id,
    d.player,
    e.event_name,
    e.event_date,
    d.rank,
    public._record_for(d.score, d.rank, e.event_name) as record,
    d.archetype_id
  from public.decks d
  join public.events e on e.id = d.event_id
  where d.format = p_format
    and d.archetype_id = p_archetype_id
    and e.event_date between p_date_from and p_date_to
  order by e.event_date desc, d.rank asc;
$$;

create or replace function public.compare_decks(
  p_deck_id_a int,
  p_deck_id_b int
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with a as (
    select card_name, zone, qty
    from public.deck_cards
    where deck_id = p_deck_id_a
  ),
  b as (
    select card_name, zone, qty
    from public.deck_cards
    where deck_id = p_deck_id_b
  ),
  only_a as (
    select coalesce(jsonb_agg(
      jsonb_build_object('card', a.card_name, 'qty', a.qty, 'zone', a.zone)
      order by a.zone, a.card_name
    ), '[]'::jsonb) as v
    from a
    where not exists (
      select 1 from b
      where b.card_name = a.card_name and b.zone = a.zone
    )
  ),
  only_b as (
    select coalesce(jsonb_agg(
      jsonb_build_object('card', b.card_name, 'qty', b.qty, 'zone', b.zone)
      order by b.zone, b.card_name
    ), '[]'::jsonb) as v
    from b
    where not exists (
      select 1 from a
      where a.card_name = b.card_name and a.zone = b.zone
    )
  ),
  shared as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'card', a.card_name,
        'qty_a', a.qty,
        'qty_b', b.qty,
        'zone', a.zone
      )
      order by a.zone, a.card_name
    ), '[]'::jsonb) as v
    from a
    join b on a.card_name = b.card_name and a.zone = b.zone
  )
  select jsonb_build_object(
    'only_in_a', only_a.v,
    'only_in_b', only_b.v,
    'shared', shared.v
  )
  from only_a, only_b, shared;
$$;

revoke all on function public.list_decks(text, int, date, date) from public;
revoke all on function public.compare_decks(int, int) from public;

grant execute on function public.list_decks(text, int, date, date)
  to anon, authenticated;
grant execute on function public.compare_decks(int, int)
  to anon, authenticated;
