import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "./_components/EmptyState";
import { LandingClient } from "./_components/LandingClient";
import type {
  ArchetypeMeta,
  CardStatsResponse,
  WinrateResponse,
} from "@/lib/types/cardStats";
import type { ListEventsResponse } from "@/lib/types/listEvents";

export const dynamic = "force-dynamic";

const DEFAULT_FORMAT = "modern";
const DEFAULT_DATE_FROM = "2026-03-05";
const DEFAULT_DATE_TO = "2026-06-03";

type SearchParams = {
  format?: string;
  archetype?: string;
  from?: string;
  to?: string;
};

function dateLabel(from: string, to: string): string {
  if (from === DEFAULT_DATE_FROM && to === DEFAULT_DATE_TO) {
    return "last 90 days";
  }
  return `${from} → ${to}`;
}

function formatTitle(format: string): string {
  return format.charAt(0).toUpperCase() + format.slice(1);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const format = (params.format ?? DEFAULT_FORMAT).toLowerCase();
  const from = params.from ?? DEFAULT_DATE_FROM;
  const to = params.to ?? DEFAULT_DATE_TO;

  const supabase = await createClient();

  const { data: archetypes, error: archErr } = await supabase
    .from("archetype")
    .select("id, format, name, slug")
    .eq("format", format)
    .order("name");

  if (archErr) {
    return <EmptyState format={format} error={archErr.message} />;
  }
  if (!archetypes || archetypes.length === 0) {
    return <EmptyState format={format} />;
  }

  const requestedSlug = params.archetype;
  const matched = requestedSlug
    ? archetypes.find((a) => a.slug === requestedSlug)
    : undefined;
  const archetype = matched ?? archetypes[0];

  const [mainRes, sideRes, winrateRes, eventsRes] = await Promise.all([
    supabase.rpc("archetype_card_stats", {
      p_format: format,
      p_archetype_id: archetype.id,
      p_date_from: from,
      p_date_to: to,
      p_zone: "main",
    }),
    supabase.rpc("archetype_card_stats", {
      p_format: format,
      p_archetype_id: archetype.id,
      p_date_from: from,
      p_date_to: to,
      p_zone: "side",
    }),
    supabase.rpc("archetype_winrate", {
      p_format: format,
      p_archetype_id: archetype.id,
      p_date_from: from,
      p_date_to: to,
    }),
    supabase.rpc("list_events", {
      p_format: format,
      p_archetype_id: archetype.id,
      p_date_from: from,
      p_date_to: to,
    }),
  ]);

  const firstErr =
    mainRes.error?.message ??
    sideRes.error?.message ??
    winrateRes.error?.message ??
    eventsRes.error?.message;
  if (firstErr) {
    return <EmptyState format={format} error={firstErr} />;
  }

  const archetypeMeta: ArchetypeMeta = {
    name: archetype.name,
    format: archetype.format,
    slug: archetype.slug,
    colors: [],
  };

  const archetypeOptions = archetypes
    .filter((a) => a.slug !== null)
    .map((a) => ({ slug: a.slug as string, name: a.name }));

  return (
    <LandingClient
      archetype={archetypeMeta}
      archetypeOptions={archetypeOptions}
      mainStats={mainRes.data as CardStatsResponse}
      sideStats={sideRes.data as CardStatsResponse}
      winrate={winrateRes.data as WinrateResponse}
      events={(eventsRes.data ?? []) as ListEventsResponse}
      dateLabel={dateLabel(from, to)}
      formatLabel={formatTitle(format)}
    />
  );
}
