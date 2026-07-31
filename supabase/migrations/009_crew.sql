-- 009_crew.sql
-- metaloan: crew (friend group) + membership.
--
-- Security model differs from the metaspike tables. Those hold public
-- tournament data and are guarded by grants alone — anon gets nothing except
-- public.archetype, everything else goes through SECURITY DEFINER RPCs, and
-- no table has RLS. That is fine for read-only public data.
--
-- Every metaloan table holds per-user private data, so grants alone cannot
-- express "this row belongs to that user". RLS is enabled in the same
-- migration that creates the table. A table that ships without a policy is a
-- table that leaked — the anon key is in browser JS, it is not a secret.
--
-- is_crew_member / is_crew_owner are SECURITY DEFINER to break RLS
-- recursion: a policy on crew_member that selects from crew_member would
-- recurse forever. Running as the function owner bypasses RLS on the inner
-- read, which is exactly what we want.
--
-- Function bodies across 009-015 use SQL-standard BEGIN ATOMIC (Postgres 14+)
-- rather than a dollar-quoted string. The Supabase SQL editor runs a
-- parameter-substitution pass before sending, which eats $tag$ as a bind
-- placeholder: bare $$ produced "unterminated dollar-quoted string", and named
-- tags produced "42P13: no function body specified" — the AS clause was gone.
-- BEGIN ATOMIC has no string literal at all, so there is nothing to eat.
--
-- It is also the better form: the body is parsed at creation time and its
-- dependencies are tracked, so a broken reference fails the migration instead
-- of the first call. Every function here is `language sql`, which is what
-- BEGIN ATOMIC requires.

create table public.crew (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  visibility  text not null default 'open'
                check (visibility in ('open', 'query_only')),
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table public.crew_member (
  crew_id      uuid not null references public.crew(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create index crew_member_user_idx on public.crew_member (user_id);

create function public.is_crew_member(p_crew_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  select exists (
    select 1
    from public.crew_member
    where crew_id = p_crew_id
      and user_id = auth.uid()
  );
end;

create function public.is_crew_owner(p_crew_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
begin atomic
  select exists (
    select 1
    from public.crew_member
    where crew_id = p_crew_id
      and user_id = auth.uid()
      and role = 'owner'
  );
end;

-- Creating a crew must also create the creator's membership, or they insert a
-- crew they cannot then read — crew_select_member requires a membership row
-- that does not exist yet.
--
-- One function rather than an INSERT policy plus an AFTER trigger. authenticated
-- gets no INSERT grant on crew at all, so this is the only way a crew can come
-- into existence, which is a stronger guarantee than a trigger that only fires
-- once a separate insert path has already succeeded.
--
-- Data-modifying CTEs keep this to a single statement, so the body needs no
-- PL/pgSQL. Both inserts still commit or roll back together.
create function public.create_crew(
  p_name text,
  p_invite_code text,
  p_display_name text
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
begin atomic
  with new_crew as (
    insert into public.crew (name, invite_code, created_by)
    select p_name, p_invite_code, auth.uid()
    where auth.uid() is not null
    returning id
  ),
  new_member as (
    insert into public.crew_member (crew_id, user_id, display_name, role)
    select nc.id, auth.uid(), p_display_name, 'owner'
    from new_crew nc
    returning crew_id
  )
  select crew_id from new_member;
end;

-- Joining is an RPC, not an INSERT policy: the invite code is the credential,
-- and a policy cannot check a secret the caller supplies without also letting
-- the caller enumerate crews.
--
-- Returns null for a bad code rather than raising. The caller has to handle a
-- null anyway (an unauthenticated call returns null too), so one branch covers
-- both and the body stays a single statement.
create function public.join_crew(p_invite_code text, p_display_name text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
begin atomic
  with target as (
    select id
    from public.crew
    where invite_code = p_invite_code
  ),
  joined as (
    insert into public.crew_member (crew_id, user_id, display_name)
    select t.id, auth.uid(), p_display_name
    from target t
    where auth.uid() is not null
    on conflict (crew_id, user_id)
      do update set display_name = excluded.display_name
    returning crew_id
  )
  select crew_id from joined;
end;

alter table public.crew        enable row level security;
alter table public.crew_member enable row level security;

create policy crew_select_member on public.crew
  for select to authenticated
  using (public.is_crew_member(id));

-- No INSERT policy on crew: create_crew is the only path in, and it is
-- SECURITY DEFINER so it bypasses RLS. Granting INSERT here would let a client
-- create a crew without the matching membership row.

create policy crew_update_owner on public.crew
  for update to authenticated
  using (public.is_crew_owner(id))
  with check (public.is_crew_owner(id));

create policy crew_member_select_same_crew on public.crew_member
  for select to authenticated
  using (public.is_crew_member(crew_id));

-- Leave the crew. No insert policy: join_crew is the only way in.
create policy crew_member_delete_self on public.crew_member
  for delete to authenticated
  using (user_id = auth.uid());

grant select, update on public.crew        to authenticated;
grant select, delete on public.crew_member to authenticated;

revoke all on function public.join_crew(text, text) from public;
revoke all on function public.create_crew(text, text, text) from public;
grant execute on function public.join_crew(text, text) to authenticated;
grant execute on function public.create_crew(text, text, text) to authenticated;

grant select, insert, update, delete on
  public.crew,
  public.crew_member
to service_role;
