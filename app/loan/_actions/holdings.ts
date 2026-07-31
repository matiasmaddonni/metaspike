"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { ok: boolean; saved: number; error?: string };

export type HoldingEntry = {
  oracle_id: string;
  qty: number;
};

/**
 * Write the caller's holdings.
 *
 * Runs as the signed-in user, so `holding_all_own` is what scopes it — there
 * is no service_role path here. user_id is taken from the session rather than
 * the client, so a caller cannot write rows on someone else's behalf even if
 * the policy somehow let them.
 *
 * qty 0 deletes rather than storing a zero. Untracked and "owns none" are the
 * same state, and keeping zero rows would mean every user accumulates a row
 * per card they have ever looked at.
 */
export async function saveHoldings(
  entries: HoldingEntry[],
): Promise<SaveResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: 0, error: "Not signed in." };

  const now = new Date().toISOString();
  const toUpsert = entries
    .filter((e) => e.qty > 0)
    .map((e) => ({
      user_id: user.id,
      oracle_id: e.oracle_id,
      qty: e.qty,
      updated_at: now,
    }));
  const toDelete = entries.filter((e) => e.qty <= 0).map((e) => e.oracle_id);

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("holding")
      .upsert(toUpsert, { onConflict: "user_id,oracle_id" });
    if (error) return { ok: false, saved: 0, error: error.message };
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("holding")
      .delete()
      .eq("user_id", user.id)
      .in("oracle_id", toDelete);
    if (error) return { ok: false, saved: toUpsert.length, error: error.message };
  }

  revalidatePath("/loan", "layout");
  return { ok: true, saved: toUpsert.length };
}

export type PasteResult = SaveResult & {
  matched: number;
  unmatched: string[];
};

/**
 * Resolve pasted card names to oracle_ids, then save.
 *
 * Matches on both `name` and `name_front`: a pasted list may carry the full
 * "A // B" name of a double-faced card or just its front face, and MTGO and
 * Moxfield disagree about which. Names are matched case-insensitively because
 * people paste from anywhere.
 *
 * Existing quantities are replaced, not added to. A paste is a statement of
 * what you own, and adding would make a double-paste silently double your
 * collection.
 */
export async function saveHoldingsByName(
  entries: Array<{ name: string; qty: number }>,
): Promise<PasteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, saved: 0, matched: 0, unmatched: [], error: "Not signed in." };
  }
  if (entries.length === 0) {
    return { ok: true, saved: 0, matched: 0, unmatched: [] };
  }

  const names = [...new Set(entries.map((e) => e.name))];

  const { data, error } = await supabase
    .from("oracle_card")
    .select("oracle_id, name, name_front")
    .or(
      `name.in.(${quoteList(names)}),name_front.in.(${quoteList(names)})`,
    );

  if (error) {
    return { ok: false, saved: 0, matched: 0, unmatched: [], error: error.message };
  }

  const byLowerName = new Map<string, string>();
  for (const row of data ?? []) {
    byLowerName.set(String(row.name).toLowerCase(), row.oracle_id as string);
    byLowerName.set(String(row.name_front).toLowerCase(), row.oracle_id as string);
  }

  const resolved: HoldingEntry[] = [];
  const unmatched: string[] = [];
  for (const entry of entries) {
    const oracleId = byLowerName.get(entry.name.toLowerCase());
    if (!oracleId) {
      unmatched.push(entry.name);
      continue;
    }
    resolved.push({ oracle_id: oracleId, qty: entry.qty });
  }

  const result = await saveHoldings(resolved);
  return { ...result, matched: resolved.length, unmatched };
}

/**
 * PostgREST `in.(…)` takes a bare comma-separated list, so any value
 * containing a comma — "Ragavan, Nimble Pilferer" — must be double-quoted or
 * it reads as two values. Embedded double quotes are escaped.
 */
function quoteList(values: string[]): string {
  return values
    .map((v) => `"${v.replace(/"/g, '\\"')}"`)
    .join(",");
}
