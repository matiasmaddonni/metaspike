-- 007_grant_archetype_read.sql
-- Allow anon + authenticated to SELECT from the archetype table.
-- page.tsx reads the archetype list directly (for the dropdown) instead of
-- going through an RPC, so on hosted Supabase (where "Auto-expose new tables"
-- is disabled by default) we need this grant explicitly.
--
-- All other tables stay private; their data is exposed only through the
-- SECURITY DEFINER RPCs (list_decks, compare_decks, archetype_card_stats,
-- archetype_winrate, list_events). The archetype_match_rule table stays
-- private — only the classifier (service_role) reads it.

grant select on public.archetype to anon, authenticated;
