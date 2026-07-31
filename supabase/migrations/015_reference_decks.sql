-- 015_reference_decks.sql
-- metaloan: browse concrete tournament decks, and read one list in full.
--
-- metaloan does not browse by archetype. Only four Modern archetypes are
-- classified, so list_decks — which excludes decks with a null archetype_id —
-- would hide almost the entire dataset. A concrete finish is also the better
-- unit: "8th, Modern Challenge 64, 2026-07-30" is a 75 someone actually
-- registered and sleeved, which is what you tick your box against.
--
-- SECURITY DEFINER for the same reason as every other read here: decks and
-- events carry no grants to anon or authenticated, and are reachable only
-- through functions. That stays true.

create or replace function public.list_reference_decks(
  p_format text,
  p_date_from date,
  p_date_to date,
  p_limit int default 60
)
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  with scoped as (
    select
      d.id as deck_id,
      d.player,
      d.rank,
      e.event_name,
      e.event_date,
      e.event_tier,
      a.name as archetype_name
    from public.decks d
    join public.events e on e.id = d.event_id
    left join public.archetype a on a.id = d.archetype_id
    where d.format = p_format
      and e.event_date between p_date_from and p_date_to
    order by e.event_date desc, d.rank asc
    limit greatest(p_limit, 1)
  )
  select jsonb_build_object(
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'deck_id', s.deck_id,
          'player', s.player,
          'rank', s.rank,
          'event_name', s.event_name,
          'event_date', s.event_date,
          'event_tier', s.event_tier,
          'archetype_name', s.archetype_name
        )
        order by s.event_date desc, s.rank asc
      ),
      '[]'::jsonb
    )
  )
  from scoped s;
end;

-- One deck's 75, main + side summed per card, for the tick-through screen.
-- Basics excluded: nobody borrows a Mountain, and nobody wants to tick twenty
-- of them. Rows without a resolved scryfall_id are reported separately rather
-- than silently dropped.
create or replace function public.reference_deck_cards(p_deck_id bigint)
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  with resolved as (
    select
      c.oracle_id,
      max(c.name)      as name,
      max(c.image_url) as image_url,
      max(c.type_line) as type_line,
      max(c.mana_value) as mana_value,
      sum(dc.qty)::int as qty
    from public.deck_cards dc
    join public.cards c on c.scryfall_id = dc.scryfall_id
    where dc.deck_id = p_deck_id
      and dc.card_name not in (
        'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'
      )
      and dc.card_name not like 'Snow-Covered %'
    group by c.oracle_id
  ),
  meta_row as (
    select
      d.id, d.player, d.rank,
      e.event_name, e.event_date,
      a.name as archetype_name
    from public.decks d
    join public.events e on e.id = d.event_id
    left join public.archetype a on a.id = d.archetype_id
    where d.id = p_deck_id
  )
  select jsonb_build_object(
    'rows', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'oracle_id', r.oracle_id,
          'name', r.name,
          'image_url', r.image_url,
          'type_line', r.type_line,
          'mana_value', r.mana_value,
          'qty', r.qty
        )
        order by r.name
      ) from resolved r),
      '[]'::jsonb
    ),
    'meta', jsonb_build_object(
      'deck_id', p_deck_id,
      'player', (select player from meta_row),
      'rank', (select rank from meta_row),
      'event_name', (select event_name from meta_row),
      'event_date', (select event_date from meta_row),
      'archetype_name', (select archetype_name from meta_row),
      'unmatched_card_names', coalesce((
        select jsonb_agg(distinct dc.card_name)
        from public.deck_cards dc
        where dc.deck_id = p_deck_id and dc.scryfall_id is null
      ), '[]'::jsonb)
    )
  );
end;

revoke all on function public.list_reference_decks(text, date, date, int) from public;
revoke all on function public.reference_deck_cards(bigint) from public;

grant execute on function public.list_reference_decks(text, date, date, int)
  to anon, authenticated;
grant execute on function public.reference_deck_cards(bigint)
  to anon, authenticated;
