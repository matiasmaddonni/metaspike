import styles from "../loan.module.css";
import { QueryError, NoCrew, Empty } from "../_components/States";
import { createClient } from "@/lib/supabase/server";
import {
  getCrewMembers,
  getCurrentUser,
  getMyCrew,
  getMyLoans,
} from "@/lib/loan/queries";
import type { LoanState, LoanWithCards } from "@/lib/types/loan";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<LoanState, string> = {
  requested: "waiting for approval",
  approved: "approved, not handed over",
  declined: "declined",
  handed: "handed over",
  returned: "returned",
  cancelled: "cancelled",
};

function LoanRow({ loan, role }: { loan: LoanWithCards; role: "in" | "out" }) {
  return (
    <li className={styles.listRow}>
      <span className={styles.grow}>
        <span className={styles.cardName}>
          {loan.cards.map((c) => `${c.qty}x ${c.name}`).join(", ")}
        </span>
        <div className={styles.muted}>
          {role === "in" ? "from" : "to"} {loan.counterparty_name} ·{" "}
          {STATE_LABEL[loan.state]}
        </div>
      </span>
      {loan.state === "requested" && role === "out" && (
        <button className={`${styles.btn} ${styles.btnSm}`}>Approve</button>
      )}
      {(loan.state === "approved" || loan.state === "handed") && (
        <button className={`${styles.btn} ${styles.btnSm}`}>
          Mark returned
        </button>
      )}
    </li>
  );
}

export default async function LoansPage() {
  const supabase = await createClient();
  const { userId } = await getCurrentUser(supabase);
  const crewResult = await getMyCrew(supabase);

  if (crewResult.error) {
    return <QueryError what="your crew" error={crewResult.error} />;
  }
  if (!crewResult.data || !userId) return <NoCrew />;

  const membersResult = await getCrewMembers(supabase, crewResult.data.id);
  if (membersResult.error) {
    return <QueryError what="crew members" error={membersResult.error} />;
  }

  const memberNames = new Map(
    membersResult.data.map((m) => [m.user_id, m.display_name]),
  );
  const loansResult = await getMyLoans(supabase, memberNames, userId);
  if (loansResult.error) {
    return <QueryError what="loans" error={loansResult.error} />;
  }

  const active = loansResult.data.filter(
    (l) => l.state !== "returned" && l.state !== "declined" && l.state !== "cancelled",
  );
  const borrowing = active.filter((l) => l.borrower_id === userId);
  const lending = active.filter((l) => l.lender_id === userId);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Loans</h1>
        <p className={styles.sub}>What you owe and what you are owed</p>
      </div>

      <div className={styles.grid2}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Coming to you</h2>
            <span className={styles.muted}>{borrowing.length}</span>
          </div>
          {borrowing.length === 0 ? (
            <div className={styles.panelBody}>
              <Empty>Not borrowing anything.</Empty>
            </div>
          ) : (
            <ul className={styles.list}>
              {borrowing.map((loan) => (
                <LoanRow key={loan.id} loan={loan} role="in" />
              ))}
            </ul>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Out of your box</h2>
            <span className={styles.muted}>{lending.length}</span>
          </div>
          {lending.length === 0 ? (
            <div className={styles.panelBody}>
              <Empty>Nothing lent out.</Empty>
            </div>
          ) : (
            <ul className={styles.list}>
              {lending.map((loan) => (
                <LoanRow key={loan.id} loan={loan} role="out" />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <p className={styles.note}>
          A card counts as out of your box the moment a loan is approved, for
          every event, until it comes back. Locking is per event and reflects
          intent; being lent out is physical and global. Two different rules,
          both subtract from what the crew sees as available.
        </p>
      </div>
    </>
  );
}
