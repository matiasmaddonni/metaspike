// metaloan domain types.
//
// Card identity is oracle_id throughout — printing-agnostic, because
// borrowing does not care about set, foil, or language.

export type CrewVisibility = "open" | "query_only";
export type CrewRole = "owner" | "member";
export type AttendanceStatus = "going" | "maybe" | "not_going";

export type LoanState =
  | "requested"
  | "approved"
  | "declined"
  | "handed"
  | "returned"
  | "cancelled";

/** States in which the card is physically out of the lender's box. */
export const OUT_OF_BOX_STATES: readonly LoanState[] = ["approved", "handed"];

export type Crew = {
  id: string;
  name: string;
  invite_code: string;
  visibility: CrewVisibility;
  created_by: string;
  created_at: string;
};

export type CrewMember = {
  crew_id: string;
  user_id: string;
  display_name: string;
  role: CrewRole;
  joined_at: string;
};

export type Holding = {
  user_id: string;
  oracle_id: string;
  qty: number;
  note: string | null;
  updated_at: string;
};

export type LocalEvent = {
  id: number;
  crew_id: string;
  name: string;
  format: "modern" | "standard" | "pioneer";
  event_date: string;
  store: string | null;
  created_by: string;
  created_at: string;
};

export type EventAttendance = {
  local_event_id: number;
  user_id: string;
  status: AttendanceStatus;
  updated_at: string;
};

/**
 * A candidate deck for an event. A user may hold several — the two-deck case,
 * where you bring both and decide in the morning. Locked quantity is the MAX
 * across them, never the SUM: only one gets sleeved.
 *
 * Never visible to the crew. A commitment is a decklist, and the crew contains
 * people you will sit across from.
 */
export type Commitment = {
  id: number;
  local_event_id: number;
  user_id: string;
  label: string;
  created_at: string;
};

export type CommitmentCard = {
  commitment_id: number;
  oracle_id: string;
  qty: number;
};

export type Loan = {
  id: number;
  crew_id: string;
  local_event_id: number | null;
  lender_id: string;
  borrower_id: string;
  state: LoanState;
  note: string | null;
  requested_at: string;
  decided_at: string | null;
  handed_at: string | null;
  returned_at: string | null;
};

export type LoanCard = {
  loan_id: number;
  oracle_id: string;
  qty: number;
};

/** A loan joined with its cards and the counterparty's display name. */
export type LoanWithCards = Loan & {
  counterparty_name: string;
  cards: Array<{ oracle_id: string; name: string; qty: number }>;
};

// ---------------------------------------------------------------------------
// RPC response shapes — must match supabase/migrations/014_loan_rpcs.sql
// ---------------------------------------------------------------------------

/**
 * One row per (crew member, card) where the member owns at least one copy.
 *
 * `owned` / `locked` / `lent_out` are null when the crew runs in `query_only`
 * visibility — enough to ask for the card, not enough to inventory a binder.
 */
export type CrewAvailabilityRow = {
  user_id: string;
  display_name: string;
  oracle_id: string;
  available: number;
  attending: boolean;
  owned: number | null;
  locked: number | null;
  lent_out: number | null;
};

export type CrewAvailabilityResponse = {
  rows: CrewAvailabilityRow[];
  meta: {
    crew_id: string;
    local_event_id: number;
    visibility: CrewVisibility;
  };
};

export type DeckShortfallRow = {
  oracle_id: string;
  name: string;
  image_url: string | null;
  /** Physical copies the list calls for, main + side summed. */
  need: number;
  /** What the caller owns and has not lent out. */
  have: number;
  /** need - have, floored at 0. */
  short: number;
};

export type DeckShortfallResponse = {
  rows: DeckShortfallRow[];
  meta: {
    deck_id: number;
    /** Card names in the list that never resolved to a Scryfall row. */
    unmatched_card_names: string[];
  };
};

// ---------------------------------------------------------------------------
// Solver output — see lib/loan/handoff.ts
// ---------------------------------------------------------------------------

export type HandoffCard = {
  oracle_id: string;
  name: string;
  qty: number;
};

export type HandoffLender = {
  user_id: string;
  display_name: string;
  attending: boolean;
  cards: HandoffCard[];
  /** Total physical cards coming from this person. */
  total_qty: number;
};

export type HandoffPlan = {
  lenders: HandoffLender[];
  /** Cards the plan could not fully cover, with how many are still missing. */
  uncovered: Array<{ oracle_id: string; name: string; still_short: number }>;
  /** People you must physically meet — attendees excluded, they hand over on site. */
  meetings: number;
  /** Every lender in the plan, attendees included. */
  lender_count: number;
  fully_covered: boolean;
};
