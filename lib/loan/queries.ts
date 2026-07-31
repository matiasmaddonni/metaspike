// Real data access for metaloan.
//
// Every function returns { data, error } rather than throwing or silently
// returning empty. The distinction matters right now: the 009-015 migrations
// are not visible over the API on hosted, so these tables may genuinely not
// exist yet. A screen that renders "no cards yet" for a missing table would
// hide that; one that renders the Postgres error makes it obvious.
//
// All reads run as the signed-in user, so RLS is what scopes them. There is no
// service_role path in the app — that key only ever lives in the tsx scripts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Crew,
  CrewAvailabilityResponse,
  CrewMember,
  DeckShortfallResponse,
  Holding,
  LoanWithCards,
  LocalEvent,
} from "../types/loan.js";

export type Result<T> = { data: T; error: string | null };

function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

function fail<T>(fallback: T, error: unknown): Result<T> {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return { data: fallback, error: message };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export async function getCurrentUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, email: null };
  return { userId: data.user?.id ?? null, email: data.user?.email ?? null };
}

// ---------------------------------------------------------------------------
// Crew
// ---------------------------------------------------------------------------

/** RLS returns only crews the caller belongs to, so no filter is needed. */
export async function getMyCrew(
  supabase: SupabaseClient,
): Promise<Result<Crew | null>> {
  const { data, error } = await supabase
    .from("crew")
    .select("id, name, invite_code, visibility, created_by, created_at")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) return fail(null, error);
  return ok((data as Crew) ?? null);
}

export async function getCrewMembers(
  supabase: SupabaseClient,
  crewId: string,
): Promise<Result<CrewMember[]>> {
  const { data, error } = await supabase
    .from("crew_member")
    .select("crew_id, user_id, display_name, role, joined_at")
    .eq("crew_id", crewId)
    .order("display_name");

  if (error) return fail([], error);
  return ok((data ?? []) as CrewMember[]);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function getLocalEvents(
  supabase: SupabaseClient,
  crewId: string,
): Promise<Result<LocalEvent[]>> {
  const { data, error } = await supabase
    .from("local_event")
    .select("id, crew_id, name, format, event_date, store, created_by, created_at")
    .eq("crew_id", crewId)
    .order("event_date", { ascending: true });

  if (error) return fail([], error);
  return ok((data ?? []) as LocalEvent[]);
}

export async function getLocalEvent(
  supabase: SupabaseClient,
  id: number,
): Promise<Result<LocalEvent | null>> {
  const { data, error } = await supabase
    .from("local_event")
    .select("id, crew_id, name, format, event_date, store, created_by, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return fail(null, error);
  return ok((data as LocalEvent) ?? null);
}

/** user_id -> going. Only 'going' counts; 'maybe' is not a bag you can rely on. */
export async function getAttendance(
  supabase: SupabaseClient,
  localEventId: number,
): Promise<Result<Record<string, boolean>>> {
  const { data, error } = await supabase
    .from("event_attendance")
    .select("user_id, status")
    .eq("local_event_id", localEventId);

  if (error) return fail({}, error);

  const map: Record<string, boolean> = {};
  for (const row of data ?? []) {
    map[row.user_id as string] = row.status === "going";
  }
  return ok(map);
}

// ---------------------------------------------------------------------------
// Holdings + commitments
// ---------------------------------------------------------------------------

export async function getMyHoldings(
  supabase: SupabaseClient,
): Promise<Result<Holding[]>> {
  const { data, error } = await supabase
    .from("holding")
    .select("user_id, oracle_id, qty, note, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return fail([], error);
  return ok((data ?? []) as Holding[]);
}

export type CommitmentSummary = {
  id: number;
  label: string;
  card_count: number;
  locked_copies: number;
};

/** RLS restricts this to the caller's own commitments — by design. */
export async function getMyCommitments(
  supabase: SupabaseClient,
  localEventId: number,
): Promise<Result<CommitmentSummary[]>> {
  const { data, error } = await supabase
    .from("commitment")
    .select("id, label, commitment_card(qty)")
    .eq("local_event_id", localEventId)
    .order("created_at");

  if (error) return fail([], error);

  const rows = (data ?? []) as Array<{
    id: number;
    label: string;
    commitment_card: Array<{ qty: number }>;
  }>;

  return ok(
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      card_count: r.commitment_card.length,
      locked_copies: r.commitment_card.reduce((s, c) => s + c.qty, 0),
    })),
  );
}

/**
 * What the caller still needs for one of their own committed decks.
 *
 * Computed in TypeScript rather than via an RPC because every input is already
 * readable by the owner under RLS: commitment_card is theirs, holding is
 * theirs. It also works for a hand-built deck, which a deck_id-based RPC
 * could not express.
 *
 * `have` is net of the caller's own outstanding loans — a card in someone
 * else's bag cannot be sleeved.
 */
export async function getCommitmentShortfall(
  supabase: SupabaseClient,
  commitmentId: number,
): Promise<Result<DeckShortfallResponse["rows"]>> {
  const [wanted, held, lent] = await Promise.all([
    supabase
      .from("commitment_card")
      .select("oracle_id, qty")
      .eq("commitment_id", commitmentId),
    supabase.from("holding").select("oracle_id, qty"),
    supabase
      .from("loan")
      .select("state, returned_at, loan_card(oracle_id, qty)")
      .in("state", ["approved", "handed"])
      .is("returned_at", null),
  ]);

  if (wanted.error) return fail([], wanted.error);
  if (held.error) return fail([], held.error);
  if (lent.error) return fail([], lent.error);

  const owned = new Map<string, number>();
  for (const h of held.data ?? []) {
    owned.set(h.oracle_id as string, h.qty as number);
  }

  const lentOut = new Map<string, number>();
  for (const loan of (lent.data ?? []) as Array<{
    loan_card: Array<{ oracle_id: string; qty: number }>;
  }>) {
    for (const c of loan.loan_card) {
      lentOut.set(c.oracle_id, (lentOut.get(c.oracle_id) ?? 0) + c.qty);
    }
  }

  const names = await resolveCardNames(
    supabase,
    (wanted.data ?? []).map((w) => w.oracle_id as string),
  );

  return ok(
    (wanted.data ?? []).map((w) => {
      const oracleId = w.oracle_id as string;
      const need = w.qty as number;
      const have = Math.max(
        (owned.get(oracleId) ?? 0) - (lentOut.get(oracleId) ?? 0),
        0,
      );
      const card = names.get(oracleId);
      return {
        oracle_id: oracleId,
        name: card?.name ?? oracleId,
        image_url: card?.image_url ?? null,
        need,
        have,
        short: Math.max(need - have, 0),
      };
    }),
  );
}

/** oracle_id -> display info, via the oracle_card view. */
export async function resolveCardNames(
  supabase: SupabaseClient,
  oracleIds: string[],
): Promise<Map<string, { name: string; image_url: string | null }>> {
  const out = new Map<string, { name: string; image_url: string | null }>();
  if (oracleIds.length === 0) return out;

  const { data, error } = await supabase
    .from("oracle_card")
    .select("oracle_id, name, image_url")
    .in("oracle_id", [...new Set(oracleIds)]);

  if (error) return out;
  for (const row of data ?? []) {
    out.set(row.oracle_id as string, {
      name: row.name as string,
      image_url: (row.image_url as string) ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export async function getMyLoans(
  supabase: SupabaseClient,
  memberNames: Map<string, string>,
  currentUserId: string,
): Promise<Result<LoanWithCards[]>> {
  const { data, error } = await supabase
    .from("loan")
    .select(
      `id, crew_id, local_event_id, lender_id, borrower_id, state, note,
       requested_at, decided_at, handed_at, returned_at,
       loan_card(oracle_id, qty)`,
    )
    .order("requested_at", { ascending: false });

  if (error) return fail([], error);

  const rows = (data ?? []) as Array<
    Omit<LoanWithCards, "counterparty_name" | "cards"> & {
      loan_card: Array<{ oracle_id: string; qty: number }>;
    }
  >;

  const names = await resolveCardNames(
    supabase,
    rows.flatMap((r) => r.loan_card.map((c) => c.oracle_id)),
  );

  return ok(
    rows.map((r) => {
      const counterpartyId =
        r.lender_id === currentUserId ? r.borrower_id : r.lender_id;
      return {
        ...r,
        counterparty_name: memberNames.get(counterpartyId) ?? "Unknown",
        cards: r.loan_card.map((c) => ({
          oracle_id: c.oracle_id,
          name: names.get(c.oracle_id)?.name ?? c.oracle_id,
          qty: c.qty,
        })),
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// The two RPCs
// ---------------------------------------------------------------------------

export async function getDeckShortfall(
  supabase: SupabaseClient,
  deckId: number,
): Promise<Result<DeckShortfallResponse | null>> {
  const { data, error } = await supabase.rpc("deck_shortfall", {
    p_deck_id: deckId,
  });

  if (error) return fail(null, error);
  return ok(data as DeckShortfallResponse);
}

export async function getCrewAvailability(
  supabase: SupabaseClient,
  crewId: string,
  localEventId: number,
  oracleIds: string[],
): Promise<Result<CrewAvailabilityResponse | null>> {
  if (oracleIds.length === 0) {
    return ok({
      rows: [],
      meta: { crew_id: crewId, local_event_id: localEventId, visibility: "open" },
    });
  }

  const { data, error } = await supabase.rpc("crew_availability", {
    p_crew_id: crewId,
    p_local_event_id: localEventId,
    p_oracle_ids: oracleIds,
  });

  if (error) return fail(null, error);
  return ok(data as CrewAvailabilityResponse);
}

// ---------------------------------------------------------------------------
// metaspike decks — the reference lists people tick against
// ---------------------------------------------------------------------------

export type ReferenceDeck = {
  deck_id: number;
  player: string;
  rank: number;
  event_name: string;
  event_date: string;
  archetype_name: string | null;
};

export type ReferenceDeckCard = {
  oracle_id: string;
  name: string;
  image_url: string | null;
  type_line: string | null;
  mana_value: number | null;
  /** Main + side summed — the physical copies the list calls for. */
  qty: number;
};

export type ReferenceDeckDetail = {
  rows: ReferenceDeckCard[];
  meta: {
    deck_id: number;
    player: string | null;
    rank: number | null;
    event_name: string | null;
    event_date: string | null;
    archetype_name: string | null;
    unmatched_card_names: string[];
  };
};

/**
 * Recent tournament decks, newest and best-placed first.
 *
 * Goes through the RPC rather than reading decks/events directly: those tables
 * carry no grants to anon or authenticated, so a direct select fails for every
 * role the app ever uses. See 015.
 */
export async function listReferenceDecks(
  supabase: SupabaseClient,
  format: string,
  dateFrom: string,
  dateTo: string,
  limit = 60,
): Promise<Result<ReferenceDeck[]>> {
  const { data, error } = await supabase.rpc("list_reference_decks", {
    p_format: format,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_limit: limit,
  });

  if (error) return fail([], error);
  return ok(((data as { rows: ReferenceDeck[] })?.rows ?? []) as ReferenceDeck[]);
}

/** One deck's 75, deduped to oracle_id with main + side summed. */
export async function getReferenceDeckCards(
  supabase: SupabaseClient,
  deckId: number,
): Promise<Result<ReferenceDeckDetail | null>> {
  const { data, error } = await supabase.rpc("reference_deck_cards", {
    p_deck_id: deckId,
  });

  if (error) return fail(null, error);
  return ok(data as ReferenceDeckDetail);
}
