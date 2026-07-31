// Handoff planner — the core of metaloan.
//
// The problem is not "who has this card". It is "how many humans must I meet
// before Saturday". Commander players own one of everything and Modern wants
// four, so a single playset routinely means three lenders. Naively listing
// every holder turns one deck into a dozen WhatsApp threads.
//
// So: minimise the people you have to go and see. Formally a weighted
// multiset cover — multiset because a lender contributes a quantity, not a
// yes/no, and weighted because someone already attending the event costs
// almost nothing. They hand the card over on site. That is not a favour, it
// is a bag.
//
// ATTENDEE_COST is the whole tuning surface. At 0.25, four attendees are
// still cheaper than one person you must make a separate trip for, which
// matches how this actually feels. Raise it toward 1 to treat everyone the
// same; drop it toward 0 to take attendees at any count.
//
// Exhaustive below EXHAUSTIVE_MAX_CANDIDATES because 2^16 subsets over ~20
// cards is about a million operations — nothing, and it gives the true
// optimum rather than greedy's approximation. Above that, greedy plus a
// redundancy prune.

import type {
  CrewAvailabilityRow,
  DeckShortfallRow,
  HandoffCard,
  HandoffLender,
  HandoffPlan,
} from "../types/loan.js";

const ATTENDEE_COST = 0.25;
const NON_ATTENDEE_COST = 1;
const EXHAUSTIVE_MAX_CANDIDATES = 16;

type Candidate = {
  user_id: string;
  display_name: string;
  attending: boolean;
  cost: number;
  /** oracle_id -> available qty from this person */
  supply: Map<string, number>;
};

type Need = {
  oracle_id: string;
  name: string;
  short: number;
};

function buildCandidates(
  needs: Need[],
  availability: CrewAvailabilityRow[],
  excludeUserId?: string,
): Candidate[] {
  const needed = new Set(needs.map((n) => n.oracle_id));
  const byUser = new Map<string, Candidate>();

  for (const row of availability) {
    if (row.available <= 0) continue;
    if (!needed.has(row.oracle_id)) continue;
    if (excludeUserId && row.user_id === excludeUserId) continue;

    let cand = byUser.get(row.user_id);
    if (!cand) {
      cand = {
        user_id: row.user_id,
        display_name: row.display_name,
        attending: row.attending,
        cost: row.attending ? ATTENDEE_COST : NON_ATTENDEE_COST,
        supply: new Map(),
      };
      byUser.set(row.user_id, cand);
    }
    // A member appears once per card; attending is a property of the person.
    cand.attending ||= row.attending;
    cand.cost = cand.attending ? ATTENDEE_COST : NON_ATTENDEE_COST;
    cand.supply.set(
      row.oracle_id,
      (cand.supply.get(row.oracle_id) ?? 0) + row.available,
    );
  }

  return [...byUser.values()].sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
}

/** Cards still missing if this exact set of lenders is used. */
function shortfallAfter(needs: Need[], picked: Candidate[]): number {
  let missing = 0;
  for (const need of needs) {
    let got = 0;
    for (const c of picked) got += c.supply.get(need.oracle_id) ?? 0;
    missing += Math.max(need.short - got, 0);
  }
  return missing;
}

function totalCost(picked: Candidate[]): number {
  return picked.reduce((sum, c) => sum + c.cost, 0);
}

/**
 * Assign concrete quantities once the lender set is fixed.
 *
 * Scarcest cards first, so a lender who is the only source of something is not
 * spent on a card three other people also have. Within a card, attendees
 * first, then whoever is already handing you the most — concentrating a
 * handoff is strictly better than spreading it.
 */
function allocate(needs: Need[], picked: Candidate[]): HandoffLender[] {
  const allocatedTo = new Map<string, HandoffCard[]>();
  for (const c of picked) allocatedTo.set(c.user_id, []);

  const scarcityOrder = [...needs].sort((a, b) => {
    const supplyA = picked.reduce(
      (s, c) => s + (c.supply.get(a.oracle_id) ?? 0),
      0,
    );
    const supplyB = picked.reduce(
      (s, c) => s + (c.supply.get(b.oracle_id) ?? 0),
      0,
    );
    if (supplyA !== supplyB) return supplyA - supplyB;
    return a.name.localeCompare(b.name);
  });

  const runningQty = new Map<string, number>();
  for (const c of picked) runningQty.set(c.user_id, 0);

  for (const need of scarcityOrder) {
    let remaining = need.short;
    if (remaining <= 0) continue;

    const contributors = picked
      .filter((c) => (c.supply.get(need.oracle_id) ?? 0) > 0)
      .sort((a, b) => {
        if (a.attending !== b.attending) return a.attending ? -1 : 1;
        const qtyA = runningQty.get(a.user_id) ?? 0;
        const qtyB = runningQty.get(b.user_id) ?? 0;
        if (qtyA !== qtyB) return qtyB - qtyA;
        const supA = a.supply.get(need.oracle_id) ?? 0;
        const supB = b.supply.get(need.oracle_id) ?? 0;
        if (supA !== supB) return supB - supA;
        return a.display_name.localeCompare(b.display_name);
      });

    for (const c of contributors) {
      if (remaining <= 0) break;
      const take = Math.min(c.supply.get(need.oracle_id) ?? 0, remaining);
      if (take <= 0) continue;
      allocatedTo.get(c.user_id)!.push({
        oracle_id: need.oracle_id,
        name: need.name,
        qty: take,
      });
      runningQty.set(c.user_id, (runningQty.get(c.user_id) ?? 0) + take);
      remaining -= take;
    }
  }

  return picked
    .map((c) => {
      const cards = (allocatedTo.get(c.user_id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      return {
        user_id: c.user_id,
        display_name: c.display_name,
        attending: c.attending,
        cards,
        total_qty: cards.reduce((s, card) => s + card.qty, 0),
      };
    })
    // A lender the search selected but allocation never used is dropped.
    .filter((l) => l.cards.length > 0)
    .sort((a, b) => {
      if (a.attending !== b.attending) return a.attending ? -1 : 1;
      if (a.total_qty !== b.total_qty) return b.total_qty - a.total_qty;
      return a.display_name.localeCompare(b.display_name);
    });
}

function exhaustive(needs: Need[], candidates: Candidate[]): Candidate[] {
  const n = candidates.length;
  let best: Candidate[] | null = null;
  let bestMissing = Infinity;
  let bestCost = Infinity;
  let bestCount = Infinity;

  for (let mask = 0; mask < 1 << n; mask++) {
    const picked: Candidate[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picked.push(candidates[i]);

    const missing = shortfallAfter(needs, picked);
    const cost = totalCost(picked);

    // Coverage dominates: a plan that gets you more cards always wins, however
    // many people it costs. Only then minimise cost, then headcount.
    const better =
      missing < bestMissing ||
      (missing === bestMissing &&
        (cost < bestCost ||
          (cost === bestCost && picked.length < bestCount)));

    if (better) {
      best = picked;
      bestMissing = missing;
      bestCost = cost;
      bestCount = picked.length;
    }
  }

  return best ?? [];
}

function greedy(needs: Need[], candidates: Candidate[]): Candidate[] {
  const picked: Candidate[] = [];
  const pool = [...candidates];

  for (;;) {
    const before = shortfallAfter(needs, picked);
    if (before === 0) break;

    let bestIdx = -1;
    let bestRatio = 0;

    for (let i = 0; i < pool.length; i++) {
      const after = shortfallAfter(needs, [...picked, pool[i]]);
      const gain = before - after;
      if (gain <= 0) continue;
      const ratio = gain / pool[i].cost;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    picked.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  // Greedy can pick someone a later choice made redundant. Drop anyone whose
  // removal costs no coverage, most expensive first.
  const ordered = [...picked].sort((a, b) => b.cost - a.cost);
  for (const c of ordered) {
    const without = picked.filter((p) => p.user_id !== c.user_id);
    if (shortfallAfter(needs, without) === shortfallAfter(needs, picked)) {
      picked.length = 0;
      picked.push(...without);
    }
  }

  return picked;
}

export type PlanOptions = {
  /** Usually the current user — you do not borrow from yourself. */
  excludeUserId?: string;
};

/**
 * Given what a deck is missing and what the crew can spare, produce the
 * cheapest set of people to ask.
 *
 * Never fabricates coverage: cards nobody has come back in `uncovered` so the
 * UI can say plainly that the deck is not assemblable.
 */
export function planHandoffs(
  shortfall: DeckShortfallRow[],
  availability: CrewAvailabilityRow[],
  opts: PlanOptions = {},
): HandoffPlan {
  const needs: Need[] = shortfall
    .filter((r) => r.short > 0)
    .map((r) => ({ oracle_id: r.oracle_id, name: r.name, short: r.short }));

  if (needs.length === 0) {
    return {
      lenders: [],
      uncovered: [],
      meetings: 0,
      lender_count: 0,
      fully_covered: true,
    };
  }

  const candidates = buildCandidates(needs, availability, opts.excludeUserId);

  const picked =
    candidates.length <= EXHAUSTIVE_MAX_CANDIDATES
      ? exhaustive(needs, candidates)
      : greedy(needs, candidates);

  const lenders = allocate(needs, picked);

  const uncovered = needs
    .map((need) => {
      const got = lenders.reduce(
        (sum, l) =>
          sum +
          l.cards
            .filter((c) => c.oracle_id === need.oracle_id)
            .reduce((s, c) => s + c.qty, 0),
        0,
      );
      return {
        oracle_id: need.oracle_id,
        name: need.name,
        still_short: Math.max(need.short - got, 0),
      };
    })
    .filter((u) => u.still_short > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    lenders,
    uncovered,
    meetings: lenders.filter((l) => !l.attending).length,
    lender_count: lenders.length,
    fully_covered: uncovered.length === 0,
  };
}
