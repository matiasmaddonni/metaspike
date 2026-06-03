-- 005_stats_rpcs.sql
-- archetype_card_stats: per-card inclusion + copies + breakdown over filter scope.
-- archetype_winrate:    aggregate W-L derived from score + Swiss-round heuristic.

create or replace function public.archetype_card_stats(
  p_format text,
  p_archetype_id int,
  p_date_from date,
  p_date_to date,
  p_zone text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with scoped_decks as (
    select d.id as deck_id
    from public.decks d
    join public.events e on e.id = d.event_id
    where d.format = p_format
      and d.archetype_id = p_archetype_id
      and e.event_date between p_date_from and p_date_to
  ),
  total as (
    select count(*) as total_decks from scoped_decks
  ),
  card_stats as (
    select
      dc.card_name,
      dc.scryfall_id,
      count(*)::int as n_decks,
      (sum(dc.qty)::numeric / nullif(count(*), 0))::numeric(10, 4) as avg_copies,
      jsonb_build_object(
        '1',  count(*) filter (where dc.qty = 1),
        '2',  count(*) filter (where dc.qty = 2),
        '3',  count(*) filter (where dc.qty = 3),
        '4',  count(*) filter (where dc.qty = 4),
        '5+', count(*) filter (where dc.qty >= 5)
      ) as copy_breakdown
    from public.deck_cards dc
    join scoped_decks sd on sd.deck_id = dc.deck_id
    where dc.zone = p_zone
      and dc.card_name not in (
        'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'
      )
      and dc.card_name not like 'Snow-Covered %'
    group by dc.card_name, dc.scryfall_id
  ),
  enriched as (
    select
      cs.card_name,
      cs.scryfall_id,
      c.image_url,
      c.mana_value,
      c.type_line,
      coalesce(c.colors, array[]::text[]) as colors,
      cs.n_decks,
      cs.avg_copies,
      cs.copy_breakdown,
      (cs.n_decks::numeric / nullif((select total_decks from total), 0))::numeric(10, 4) as inclusion_pct
    from card_stats cs
    left join public.cards c on c.scryfall_id = cs.scryfall_id
  ),
  rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'card_name', e.card_name,
          'scryfall_id', e.scryfall_id,
          'image_url', e.image_url,
          'mana_value', e.mana_value,
          'type_line', e.type_line,
          'colors', e.colors,
          'zone', p_zone,
          'inclusion_pct', e.inclusion_pct,
          'avg_copies', e.avg_copies,
          'copy_breakdown', e.copy_breakdown,
          'n_decks', e.n_decks
        )
        order by e.n_decks desc, e.card_name
      ),
      '[]'::jsonb
    ) as v
    from enriched e
  )
  select jsonb_build_object(
    'rows', rows.v,
    'meta', jsonb_build_object('total_decks', (select total_decks from total))
  )
  from rows;
$$;

create or replace function public.archetype_winrate(
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
  with scoped as (
    select d.score, d.rank, d.event_id, e.event_name
    from public.decks d
    join public.events e on e.id = d.event_id
    where d.format = p_format
      and d.archetype_id = p_archetype_id
      and e.event_date between p_date_from and p_date_to
  ),
  derived as (
    select
      s.score,
      s.rank,
      public._swiss_rounds(s.event_name) as rounds,
      s.score / 3 as wins,
      s.score % 3 as draws,
      public._record_for(s.score, s.rank, s.event_name) as record
    from scoped s
  ),
  agg as (
    select
      (select count(*) from scoped)::int as n_decks,
      (select count(distinct event_id) from scoped)::int as n_events,
      coalesce(sum(d.wins) filter (where d.record is not null), 0)::int as match_wins,
      coalesce(
        sum(d.rounds - d.wins - d.draws) filter (where d.record is not null),
        0
      )::int as match_losses,
      count(*) filter (where d.record is not null)::int as n_decks_with_record
    from derived d
  )
  select jsonb_build_object(
    'n_decks', a.n_decks,
    'n_events', a.n_events,
    'match_wins', a.match_wins,
    'match_losses', a.match_losses,
    'win_pct',
      case
        when (a.match_wins + a.match_losses) > 0
        then (a.match_wins::numeric / (a.match_wins + a.match_losses))::numeric(10, 4)
        else null
      end,
    'n_decks_with_record', a.n_decks_with_record,
    'basis', 'published winners only'
  )
  from agg a;
$$;

revoke all on function public.archetype_card_stats(text, int, date, date, text) from public;
revoke all on function public.archetype_winrate(text, int, date, date) from public;

grant execute on function public.archetype_card_stats(text, int, date, date, text)
  to anon, authenticated;
grant execute on function public.archetype_winrate(text, int, date, date)
  to anon, authenticated;
