-- 014_loan_rpcs.sql
-- metaloan: the two reads the app is built around.
--
-- crew_availability — "who in the crew can actually lend me these cards for
-- that event", the one query that a spreadsheet cannot answer.
--
--   available = owned - locked(event) - lent_out
--
--   locked   is INTENT, scoped to one event, and is the MAX across the user's
--            candidate decks for it — they play exactly one of them.
--   lent_out is PHYSICAL POSSESSION and is global: a card in someone else's
--            bag on Saturday is still in their bag on Sunday, whatever event
--            the loan was opened against.
--
-- Two different rules, both subtract. Conflating them is the bug that makes
-- a lending tracker lie.
--
-- The RPC takes an explicit p_oracle_ids list and never enumerates a
-- collection, so it is safe under both crew visibility modes. Under
-- 'query_only' the owned / locked / lent_out breakdown is withheld and only
-- the availability figure is returned — enough to ask for the card, not
-- enough to inventory someone's binder.
--
-- Commitments are never exposed. The caller learns that a card is spoken for,
-- never which deck spoke for it. See 012.
--
-- The owned / locked / lent_out fields use a FROM-less scalar subquery rather
-- than CASE WHEN: a bare SELECT with a false WHERE yields no rows, so the
-- scalar subquery is NULL, which is the same result. CASE is avoided because
-- its END keyword terminates a BEGIN ATOMIC body early in editors that find
-- block boundaries by counting begin/end.
--
-- The lender-minimising solver is deliberately NOT here. Set cover over a
-- crew of ~20 and a missing list of ~20 is trivially small, and its tie-break
-- weights (attending > same store > already lending you something) are
-- product decisions that will be tuned often. That belongs in TypeScript
-- where it can be read and tested, not in SQL.

create function public.crew_availability(
  p_crew_id uuid,
  p_local_event_id bigint,
  p_oracle_ids uuid[]
)
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  with guard as (
    select public.is_crew_member(p_crew_id) as ok
  ),
  vis as (
    select c.visibility, (c.visibility = 'open') as is_open
    from public.crew c where c.id = p_crew_id
  ),
  members as (
    select cm.user_id, cm.display_name
    from public.crew_member cm
    where cm.crew_id = p_crew_id
      and (select ok from guard)
  ),
  wanted as (
    select unnest(p_oracle_ids) as oracle_id
  ),
  owned as (
    select m.user_id, w.oracle_id, coalesce(h.qty, 0) as qty
    from members m
    cross join wanted w
    left join public.holding h
      on h.user_id = m.user_id and h.oracle_id = w.oracle_id
  ),
  -- MAX, not SUM: a user brings several candidate decks but sleeves one.
  locked as (
    select cm.user_id, cc.oracle_id, max(cc.qty) as qty
    from public.commitment cm
    join public.commitment_card cc on cc.commitment_id = cm.id
    where cm.local_event_id = p_local_event_id
    group by cm.user_id, cc.oracle_id
  ),
  -- Global, not event-scoped: the card is physically elsewhere.
  lent as (
    select l.lender_id as user_id, lc.oracle_id, sum(lc.qty) as qty
    from public.loan l
    join public.loan_card lc on lc.loan_id = l.id
    where l.state in ('approved', 'handed')
      and l.returned_at is null
    group by l.lender_id, lc.oracle_id
  ),
  attending as (
    select ea.user_id
    from public.event_attendance ea
    where ea.local_event_id = p_local_event_id
      and ea.status = 'going'
  ),
  computed as (
    select
      o.user_id,
      m.display_name,
      o.oracle_id,
      o.qty                        as owned,
      coalesce(lk.qty, 0)          as locked,
      coalesce(lt.qty, 0)          as lent_out,
      greatest(
        o.qty - coalesce(lk.qty, 0) - coalesce(lt.qty, 0),
        0
      )                            as available,
      (a.user_id is not null)      as attending
    from owned o
    join members m on m.user_id = o.user_id
    left join locked    lk on lk.user_id = o.user_id and lk.oracle_id = o.oracle_id
    left join lent      lt on lt.user_id = o.user_id and lt.oracle_id = o.oracle_id
    left join attending a  on a.user_id = o.user_id
    where o.qty > 0
  )
  select jsonb_build_object(
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id',     c.user_id,
          'display_name', c.display_name,
          'oracle_id',   c.oracle_id,
          'available',   c.available,
          'attending',   c.attending,
          'owned',    (select c.owned    where (select is_open from vis)),
          'locked',   (select c.locked   where (select is_open from vis)),
          'lent_out', (select c.lent_out where (select is_open from vis))
        )
        order by c.available desc, c.display_name
      ),
      '[]'::jsonb
    ),
    'meta', jsonb_build_object(
      'crew_id', p_crew_id,
      'local_event_id', p_local_event_id,
      'visibility', (select visibility from vis)
    )
  )
  from computed c;
end;

-- deck_shortfall — "what am I missing to build this exact 75?"
--
-- p_deck_id is a metaspike deck: a real list from a real finish, which is how
-- these get browsed in practice. Main + side are SUMMED per card, because the
-- 4-of rule is over the whole 75 and what you need is physical copies.
--
-- Subtracts the caller's own lent-out cards: a Ragavan sitting in someone
-- else's bag cannot be sleeved on Saturday. Does NOT subtract locked — the
-- deck being costed is presumably the thing doing the locking.
--
-- Basics are excluded. Nobody borrows a Mountain.
create function public.deck_shortfall(p_deck_id bigint)
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  with needed as (
    select
      c.oracle_id,
      max(c.name)      as name,
      max(c.image_url) as image_url,
      sum(dc.qty)::int as need
    from public.deck_cards dc
    join public.cards c on c.scryfall_id = dc.scryfall_id
    where dc.deck_id = p_deck_id
      and dc.card_name not in (
        'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'
      )
      and dc.card_name not like 'Snow-Covered %'
    group by c.oracle_id
  ),
  unmatched as (
    select coalesce(jsonb_agg(distinct dc.card_name), '[]'::jsonb) as v
    from public.deck_cards dc
    where dc.deck_id = p_deck_id
      and dc.scryfall_id is null
  ),
  mine as (
    select
      n.oracle_id,
      coalesce(h.qty, 0) as owned,
      coalesce((
        select sum(lc.qty)
        from public.loan l
        join public.loan_card lc on lc.loan_id = l.id
        where l.lender_id = auth.uid()
          and lc.oracle_id = n.oracle_id
          and l.state in ('approved', 'handed')
          and l.returned_at is null
      ), 0) as lent_out
    from needed n
    left join public.holding h
      on h.user_id = auth.uid() and h.oracle_id = n.oracle_id
  )
  select jsonb_build_object(
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'oracle_id', n.oracle_id,
          'name',      n.name,
          'image_url', n.image_url,
          'need',      n.need,
          'have',      greatest(m.owned - m.lent_out, 0),
          'short',     greatest(n.need - greatest(m.owned - m.lent_out, 0), 0)
        )
        order by
          greatest(n.need - greatest(m.owned - m.lent_out, 0), 0) desc,
          n.name
      ),
      '[]'::jsonb
    ),
    'meta', jsonb_build_object(
      'deck_id', p_deck_id,
      'unmatched_card_names', (select v from unmatched)
    )
  )
  from needed n
  join mine m on m.oracle_id = n.oracle_id;
end;

revoke all on function public.crew_availability(uuid, bigint, uuid[]) from public;
revoke all on function public.deck_shortfall(bigint) from public;

grant execute on function public.crew_availability(uuid, bigint, uuid[]) to authenticated;
grant execute on function public.deck_shortfall(bigint) to authenticated;
