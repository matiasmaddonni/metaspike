-- 011_local_event.sql
-- metaloan: the real-world event being prepped for (an RCQ, a store night).
--
-- Distinct from public.events, which is MTGO tournaments scraped for meta
-- data. Nothing links them. This is the thing you physically drive to.
--
-- attendance is not bookkeeping — it is the strongest input to lender
-- ranking. Someone already going to the event hands the card over on site.
-- That is not a favour, that is a bag. Borrowing from an attendee costs zero
-- extra trips, so the handoff solver weights it above everything else.

create table public.local_event (
  id         bigserial primary key,
  crew_id    uuid not null references public.crew(id) on delete cascade,
  name       text not null,
  format     text not null check (format in ('modern', 'standard', 'pioneer')),
  event_date date not null,
  store      text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index local_event_crew_date_idx
  on public.local_event (crew_id, event_date desc);

create table public.event_attendance (
  local_event_id bigint not null references public.local_event(id) on delete cascade,
  user_id        uuid   not null references auth.users(id) on delete cascade,
  status         text   not null default 'going'
                   check (status in ('going', 'maybe', 'not_going')),
  updated_at     timestamptz not null default now(),
  primary key (local_event_id, user_id)
);

create function public.can_see_local_event(p_local_event_id bigint)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  select exists (
    select 1
    from public.local_event le
    join public.crew_member cm on cm.crew_id = le.crew_id
    where le.id = p_local_event_id
      and cm.user_id = auth.uid()
  );
end;

alter table public.local_event      enable row level security;
alter table public.event_attendance enable row level security;

create policy local_event_select_crew on public.local_event
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy local_event_insert_crew on public.local_event
  for insert to authenticated
  with check (public.is_crew_member(crew_id) and created_by = auth.uid());

create policy local_event_update_creator on public.local_event
  for update to authenticated
  using (created_by = auth.uid() or public.is_crew_owner(crew_id));

-- Attendance is public within the crew — that is the point of it.
create policy event_attendance_select_crew on public.event_attendance
  for select to authenticated
  using (public.can_see_local_event(local_event_id));

create policy event_attendance_write_own on public.event_attendance
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_local_event(local_event_id));

grant select, insert, update         on public.local_event      to authenticated;
grant select, insert, update, delete on public.event_attendance to authenticated;

grant select, insert, update, delete on
  public.local_event,
  public.event_attendance
to service_role;
