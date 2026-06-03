-- 004_design_alignment.sql
-- Align with design handoff:
--   1. archetype.slug for UI routing (e.g. "boros-energy")
--   2. compare_decks gains p_split_by_zone bool default false
--      (default = flat shape matching design mock; true = zone-tagged variant)

alter table public.archetype add column slug text unique;

drop function if exists public.compare_decks(int, int);

create or replace function public.compare_decks(
  p_deck_id_a int,
  p_deck_id_b int,
  p_split_by_zone boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_split_by_zone then
    return (
      with a as (
        select card_name, zone, qty from public.deck_cards where deck_id = p_deck_id_a
      ),
      b as (
        select card_name, zone, qty from public.deck_cards where deck_id = p_deck_id_b
      ),
      only_a as (
        select coalesce(jsonb_agg(
          jsonb_build_object('card', a.card_name, 'qty', a.qty, 'zone', a.zone)
          order by a.zone, a.card_name
        ), '[]'::jsonb) as v
        from a
        where not exists (
          select 1 from b where b.card_name = a.card_name and b.zone = a.zone
        )
      ),
      only_b as (
        select coalesce(jsonb_agg(
          jsonb_build_object('card', b.card_name, 'qty', b.qty, 'zone', b.zone)
          order by b.zone, b.card_name
        ), '[]'::jsonb) as v
        from b
        where not exists (
          select 1 from a where a.card_name = b.card_name and a.zone = b.zone
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
      from only_a, only_b, shared
    );
  else
    return (
      with a as (
        select card_name, sum(qty)::int as qty
        from public.deck_cards
        where deck_id = p_deck_id_a
        group by card_name
      ),
      b as (
        select card_name, sum(qty)::int as qty
        from public.deck_cards
        where deck_id = p_deck_id_b
        group by card_name
      ),
      only_a as (
        select coalesce(jsonb_agg(
          jsonb_build_object('card', a.card_name, 'qty', a.qty)
          order by a.card_name
        ), '[]'::jsonb) as v
        from a
        where not exists (select 1 from b where b.card_name = a.card_name)
      ),
      only_b as (
        select coalesce(jsonb_agg(
          jsonb_build_object('card', b.card_name, 'qty', b.qty)
          order by b.card_name
        ), '[]'::jsonb) as v
        from b
        where not exists (select 1 from a where a.card_name = b.card_name)
      ),
      shared as (
        select coalesce(jsonb_agg(
          jsonb_build_object('card', a.card_name, 'qty_a', a.qty, 'qty_b', b.qty)
          order by a.card_name
        ), '[]'::jsonb) as v
        from a
        join b using (card_name)
      )
      select jsonb_build_object(
        'only_in_a', only_a.v,
        'only_in_b', only_b.v,
        'shared', shared.v
      )
      from only_a, only_b, shared
    );
  end if;
end;
$$;

revoke all on function public.compare_decks(int, int, boolean) from public;
grant execute on function public.compare_decks(int, int, boolean)
  to anon, authenticated;
