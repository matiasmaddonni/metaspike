-- 006_list_events.sql
-- list_events: nested events → decks → main/side lines, with each line
-- carrying its field_pct (inclusion across the scope, same as
-- archetype_card_stats.inclusion_pct). Powers the LISTS view.

create or replace function public.list_events(
  p_format text,
  p_archetype_id int,
  p_date_from date,
  p_date_to date
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with scoped_decks as (
    select
      d.id as deck_id,
      d.player,
      d.rank,
      d.score,
      d.event_id,
      e.event_name,
      e.event_date,
      e.event_tier,
      e.event_size
    from public.decks d
    join public.events e on e.id = d.event_id
    where d.format = p_format
      and d.archetype_id = p_archetype_id
      and e.event_date between p_date_from and p_date_to
  ),
  total as (
    select count(*)::numeric as total_decks from scoped_decks
  ),
  field_stats as (
    select
      dc.card_name,
      dc.zone,
      (count(distinct dc.deck_id)::numeric
        / nullif((select total_decks from total), 0))::numeric(10, 4) as field_pct
    from public.deck_cards dc
    join scoped_decks sd on sd.deck_id = dc.deck_id
    group by dc.card_name, dc.zone
  ),
  lines as (
    select
      sd.deck_id,
      sd.player,
      sd.rank,
      sd.score,
      sd.event_id,
      sd.event_name,
      sd.event_date,
      sd.event_tier,
      sd.event_size,
      dc.card_name,
      dc.qty,
      dc.zone,
      c.type_line,
      coalesce(c.colors, array[]::text[]) as colors,
      c.mana_value,
      c.image_url,
      c.scryfall_id,
      coalesce(fs.field_pct, 0) as field_pct,
      coalesce(c.type_line ~* 'land', false) as is_land
    from scoped_decks sd
    join public.deck_cards dc on dc.deck_id = sd.deck_id
    left join public.cards c on c.scryfall_id = dc.scryfall_id
    left join field_stats fs
      on fs.card_name = dc.card_name and fs.zone = dc.zone
  ),
  decks_agg as (
    select
      l.deck_id,
      l.player,
      l.rank,
      l.score,
      l.event_id,
      l.event_name,
      l.event_date,
      l.event_tier,
      l.event_size,
      public._record_for(l.score, l.rank, l.event_name) as record,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'card', l.card_name,
            'qty', l.qty,
            'zone', l.zone,
            'type_line', l.type_line,
            'colors', l.colors,
            'mana_value', l.mana_value,
            'is_land', l.is_land,
            'image_url', l.image_url,
            'scryfall_id', l.scryfall_id,
            'field_pct', l.field_pct
          )
          order by l.card_name
        ) filter (where l.zone = 'main'),
        '[]'::jsonb
      ) as main_lines,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'card', l.card_name,
            'qty', l.qty,
            'zone', l.zone,
            'type_line', l.type_line,
            'colors', l.colors,
            'mana_value', l.mana_value,
            'is_land', l.is_land,
            'image_url', l.image_url,
            'scryfall_id', l.scryfall_id,
            'field_pct', l.field_pct
          )
          order by l.card_name
        ) filter (where l.zone = 'side'),
        '[]'::jsonb
      ) as side_lines
    from lines l
    group by
      l.deck_id, l.player, l.rank, l.score,
      l.event_id, l.event_name, l.event_date, l.event_tier, l.event_size
  ),
  events_agg as (
    select
      da.event_id,
      da.event_name,
      da.event_date,
      da.event_tier,
      da.event_size,
      count(*)::int as n_decks,
      min(da.rank)::int as top_finish,
      jsonb_agg(
        jsonb_build_object(
          'deck_id', da.deck_id,
          'player', da.player,
          'rank', da.rank,
          'record', da.record,
          'event_id', da.event_id,
          'event_name', da.event_name,
          'event_date', da.event_date,
          'event_scope', da.event_tier,
          'entrants', da.event_size,
          'main', da.main_lines,
          'side', da.side_lines
        )
        order by da.rank
      ) as decks
    from decks_agg da
    group by da.event_id, da.event_name, da.event_date, da.event_tier, da.event_size
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ea.event_id,
        'name', ea.event_name,
        'date', ea.event_date,
        'scope', ea.event_tier,
        'entrants', ea.event_size,
        'n_decks', ea.n_decks,
        'top_finish', ea.top_finish,
        'decks', ea.decks
      )
      order by ea.event_date desc, ea.event_id desc
    ),
    '[]'::jsonb
  )
  from events_agg ea;
$$;

revoke all on function public.list_events(text, int, date, date) from public;
grant execute on function public.list_events(text, int, date, date)
  to anon, authenticated;
