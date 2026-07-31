import Link from "next/link";
import styles from "./loan.module.css";
import { QueryError, NoCrew, Empty } from "./_components/States";
import { createClient } from "@/lib/supabase/server";
import {
  getCrewMembers,
  getCurrentUser,
  getLocalEvents,
  getMyCrew,
  getMyLoans,
} from "@/lib/loan/queries";
import type { LoanWithCards } from "@/lib/types/loan";

export const dynamic = "force-dynamic";

const OVERDUE_DAYS = 7;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function cardSummary(loan: LoanWithCards): string {
  return loan.cards.map((c) => `${c.qty}x ${c.name}`).join(", ");
}

export default async function LoanOverview() {
  const supabase = await createClient();
  const { userId } = await getCurrentUser(supabase);
  const crewResult = await getMyCrew(supabase);

  if (crewResult.error) {
    return <QueryError what="your crew" error={crewResult.error} />;
  }
  if (!crewResult.data || !userId) {
    return <NoCrew />;
  }
  const crew = crewResult.data;

  const [membersResult, eventsResult] = await Promise.all([
    getCrewMembers(supabase, crew.id),
    getLocalEvents(supabase, crew.id),
  ]);

  if (membersResult.error) {
    return <QueryError what="crew members" error={membersResult.error} />;
  }
  if (eventsResult.error) {
    return <QueryError what="events" error={eventsResult.error} />;
  }

  const memberNames = new Map(
    membersResult.data.map((m) => [m.user_id, m.display_name]),
  );
  const loansResult = await getMyLoans(supabase, memberNames, userId);
  if (loansResult.error) {
    return <QueryError what="loans" error={loansResult.error} />;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const upcoming = eventsResult.data.filter((e) => e.event_date >= today);
  const nextEvent = upcoming[0] ?? null;

  const loans = loansResult.data;
  const incoming = loans.filter(
    (l) => l.lender_id === userId && l.state === "requested",
  );
  const awaiting = loans.filter(
    (l) => l.borrower_id === userId && l.state === "requested",
  );
  const overdue = loans.filter(
    (l) =>
      (l.state === "approved" || l.state === "handed") &&
      l.returned_at === null &&
      daysBetween(new Date(l.handed_at ?? l.requested_at), now) > OVERDUE_DAYS,
  );

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Overview</h1>
        <p className={styles.sub}>
          {membersResult.data.length} in {crew.name}
          {nextEvent
            ? ` · next event in ${daysBetween(now, new Date(nextEvent.event_date))} days`
            : " · no upcoming events"}
        </p>
      </div>

      <div className={styles.stack}>
        {nextEvent ? (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{nextEvent.name}</h2>
              <span className={styles.muted}>
                {nextEvent.event_date}
                {nextEvent.store ? ` · ${nextEvent.store}` : ""}
              </span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.spread}>
                <span className={styles.muted}>
                  Pick a deck and see what the crew can cover.
                </span>
                <Link
                  href={`/loan/events/${nextEvent.id}`}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  Plan the borrows
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>No upcoming events</h2>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.spread}>
                <span className={styles.muted}>
                  Add the RCQ you are preparing for.
                </span>
                <Link
                  href="/loan/events"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  Add event
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className={styles.grid2}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Waiting on you</h2>
              {incoming.length > 0 && (
                <span className={`${styles.badge} ${styles.badgeAccent}`}>
                  {incoming.length}
                </span>
              )}
            </div>
            {incoming.length === 0 ? (
              <div className={styles.panelBody}>
                <Empty>No one is waiting on your approval.</Empty>
              </div>
            ) : (
              <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
                {incoming.map((loan) => (
                  <li key={loan.id} className={styles.listRow}>
                    <span className={styles.grow}>
                      <span className={styles.cardName}>
                        {loan.counterparty_name} wants {cardSummary(loan)}
                      </span>
                    </span>
                    <Link
                      href="/loan/loans"
                      className={`${styles.btn} ${styles.btnSm}`}
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Your requests</h2>
            </div>
            {awaiting.length === 0 ? (
              <div className={styles.panelBody}>
                <Empty>Nothing pending.</Empty>
              </div>
            ) : (
              <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
                {awaiting.map((loan) => (
                  <li key={loan.id} className={styles.listRow}>
                    <span className={styles.grow}>
                      <span className={styles.cardName}>
                        {cardSummary(loan)}
                      </span>
                      <div className={styles.muted}>
                        asked {loan.counterparty_name}
                      </div>
                    </span>
                    <span className={styles.badge}>waiting</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {overdue.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Still out</h2>
              <span className={`${styles.badge} ${styles.badgeWarn}`}>
                {overdue.length} past {OVERDUE_DAYS} days
              </span>
            </div>
            <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
              {overdue.map((loan) => (
                <li key={loan.id} className={styles.listRow}>
                  <span className={styles.grow}>
                    <span className={styles.cardName}>
                      {cardSummary(loan)}
                    </span>
                    <div className={styles.muted}>
                      {loan.lender_id === userId
                        ? `${loan.counterparty_name} has them`
                        : `you have ${loan.counterparty_name}'s`}
                    </div>
                  </span>
                  <Link
                    href="/loan/loans"
                    className={`${styles.btn} ${styles.btnSm}`}
                  >
                    Mark returned
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
