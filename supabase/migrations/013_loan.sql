-- 013_loan.sql
-- metaloan: a physical handoff of cards from one crew member to another.
--
-- A loan carries N cards, not one. That is not the "lend a whole deck"
-- feature (deliberately out of v1 — WhatsApp handles that fine); it is the
-- handoff itself. If Pedro lends you 2 Ragavan and 1 Urza's Saga, that is one
-- meeting, one approval, one return, not three of each. One-card-per-loan
-- would mean approving twelve separate requests from the same person, and
-- would make the lender-minimising solver pointless.
--
-- No 'lost' state. Unreturned is derived: state in ('approved','handed') and
-- the event was more than 7 days ago. Derived, so it self-clears the moment
-- the card comes back, and there is no punitive flag anyone has to unset.
--
-- local_event_id is nullable — a card can move between crew members outside
-- any event.

create table public.loan (
  id             bigserial primary key,
  crew_id        uuid   not null references public.crew(id) on delete cascade,
  local_event_id bigint references public.local_event(id) on delete set null,
  lender_id      uuid   not null references auth.users(id) on delete cascade,
  borrower_id    uuid   not null references auth.users(id) on delete cascade,
  state          text   not null default 'requested'
                   check (state in (
                     'requested', 'approved', 'declined',
                     'handed', 'returned', 'cancelled'
                   )),
  note           text,
  requested_at   timestamptz not null default now(),
  decided_at     timestamptz,
  handed_at      timestamptz,
  returned_at    timestamptz,
  check (lender_id <> borrower_id)
);

create index loan_lender_state_idx   on public.loan (lender_id, state);
create index loan_borrower_state_idx on public.loan (borrower_id, state);
create index loan_event_idx          on public.loan (local_event_id);

create table public.loan_card (
  loan_id   bigint not null references public.loan(id) on delete cascade,
  oracle_id uuid   not null,
  qty       int    not null check (qty > 0),
  primary key (loan_id, oracle_id)
);

create index loan_card_oracle_idx on public.loan_card (oracle_id);

alter table public.loan      enable row level security;
alter table public.loan_card enable row level security;

create policy loan_select_party on public.loan
  for select to authenticated
  using (lender_id = auth.uid() or borrower_id = auth.uid());

-- Borrower opens the request. Lender never creates a loan against someone.
create policy loan_insert_borrower on public.loan
  for insert to authenticated
  with check (
    borrower_id = auth.uid()
    and public.is_crew_member(crew_id)
    and lender_id <> auth.uid()
  );

-- Either party can move the state; which transitions are legal is enforced in
-- the RPC layer, not here.
create policy loan_update_party on public.loan
  for update to authenticated
  using (lender_id = auth.uid() or borrower_id = auth.uid())
  with check (lender_id = auth.uid() or borrower_id = auth.uid());

create policy loan_card_select_party on public.loan_card
  for select to authenticated
  using (exists (
    select 1 from public.loan l
    where l.id = loan_card.loan_id
      and (l.lender_id = auth.uid() or l.borrower_id = auth.uid())
  ));

create policy loan_card_write_borrower on public.loan_card
  for all to authenticated
  using (exists (
    select 1 from public.loan l
    where l.id = loan_card.loan_id
      and l.borrower_id = auth.uid()
      and l.state = 'requested'
  ))
  with check (exists (
    select 1 from public.loan l
    where l.id = loan_card.loan_id
      and l.borrower_id = auth.uid()
      and l.state = 'requested'
  ));

grant select, insert, update on public.loan      to authenticated;
grant select, insert, update, delete on public.loan_card to authenticated;

grant select, insert, update, delete on
  public.loan,
  public.loan_card
to service_role;
