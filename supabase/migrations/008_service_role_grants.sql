-- 008_service_role_grants.sql
-- Grant service_role full read/write on the data tables.
-- Supabase normally grants this automatically when "Auto-expose new tables"
-- is on; on this project that toggle is off (defense-in-depth for anon),
-- which also blocks service_role until we grant explicitly.
--
-- service_role is used by tsx scripts (ingest, enrich, classify, backfill,
-- prune) via createAdminClient. It needs full read + write on every table.
-- It does NOT touch the API gateway — calls go via the REST endpoint with
-- the service_role bearer token, which bypasses RLS but still needs grants.

grant select, insert, update, delete on
  public.events,
  public.decks,
  public.deck_cards,
  public.cards,
  public.archetype,
  public.archetype_match_rule
to service_role;

grant usage, select on all sequences in schema public to service_role;
