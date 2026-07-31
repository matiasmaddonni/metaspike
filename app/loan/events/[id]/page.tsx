import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../../loan.module.css";
import { HandoffPlanView } from "../../_components/HandoffPlanView";
import { QueryError, NoCrew, Empty } from "../../_components/States";
import { createClient } from "@/lib/supabase/server";
import { planHandoffs } from "@/lib/loan/handoff";
import {
  getAttendance,
  getCommitmentShortfall,
  getCrewAvailability,
  getCrewMembers,
  getCurrentUser,
  getLocalEvent,
  getMyCommitments,
  getMyCrew,
} from "@/lib/loan/queries";

export const dynamic = "force-dynamic";

export default async function EventDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ commitment?: string }>;
}) {
  const { id } = await params;
  const { commitment: commitmentParam } = await searchParams;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const supabase = await createClient();
  const { userId } = await getCurrentUser(supabase);
  const crewResult = await getMyCrew(supabase);

  if (crewResult.error) {
    return <QueryError what="your crew" error={crewResult.error} />;
  }
  if (!crewResult.data || !userId) return <NoCrew />;
  const crew = crewResult.data;

  const [eventResult, membersResult, attendanceResult, commitmentsResult] =
    await Promise.all([
      getLocalEvent(supabase, eventId),
      getCrewMembers(supabase, crew.id),
      getAttendance(supabase, eventId),
      getMyCommitments(supabase, eventId),
    ]);

  if (eventResult.error) {
    return <QueryError what="this event" error={eventResult.error} />;
  }
  if (!eventResult.data) notFound();
  if (membersResult.error) {
    return <QueryError what="crew members" error={membersResult.error} />;
  }
  if (commitmentsResult.error) {
    return <QueryError what="your decks" error={commitmentsResult.error} />;
  }

  const event = eventResult.data;
  const members = membersResult.data;
  const attendance = attendanceResult.data;
  const commitments = commitmentsResult.data;

  const selected =
    commitments.find((c) => String(c.id) === commitmentParam) ??
    commitments[0] ??
    null;

  // Shortfall → availability → plan. Each step depends on the previous, so
  // these cannot be parallelised.
  const shortfallResult = selected
    ? await getCommitmentShortfall(supabase, selected.id)
    : null;

  if (shortfallResult?.error) {
    return <QueryError what="your missing cards" error={shortfallResult.error} />;
  }

  const shortfall = shortfallResult?.data ?? [];
  const shortCards = shortfall.filter((r) => r.short > 0);

  const availabilityResult = shortCards.length
    ? await getCrewAvailability(
        supabase,
        crew.id,
        eventId,
        shortCards.map((c) => c.oracle_id),
      )
    : null;

  if (availabilityResult?.error) {
    return (
      <QueryError what="crew availability" error={availabilityResult.error} />
    );
  }

  const plan = planHandoffs(shortfall, availabilityResult?.data?.rows ?? [], {
    excludeUserId: userId,
  });

  const going = members.filter((m) => attendance[m.user_id]);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>{event.name}</h1>
        <p className={styles.sub}>
          {event.event_date}
          {event.store ? ` · ${event.store}` : ""} · {event.format}
        </p>
      </div>

      <div className={styles.stack}>
        <div className={styles.grid2}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Who&apos;s going</h2>
              <span className={styles.muted}>
                {going.length} of {members.length}
              </span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.stack}>
                <div className={styles.row} style={{ flexWrap: "wrap" }}>
                  {members.map((m) => (
                    <span
                      key={m.user_id}
                      className={`${styles.badge} ${
                        attendance[m.user_id] ? styles.badgeOk : ""
                      }`}
                    >
                      {m.display_name}
                    </span>
                  ))}
                </div>
                <p className={styles.note}>
                  Attendance is not bookkeeping. Someone already going hands the
                  card over on site, so borrowing from them costs no extra trip
                  — the planner below weights them accordingly.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Your decks for this event</h2>
              <Link
                href="/loan/collection"
                className={`${styles.btn} ${styles.btnSm}`}
              >
                Add deck
              </Link>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.stack}>
                {commitments.length === 0 ? (
                  <Empty>
                    No deck committed yet. Commit one and its cards lock, so the
                    crew sees only what you can genuinely spare.
                  </Empty>
                ) : (
                  commitments.map((c) => (
                    <Link
                      key={c.id}
                      href={`/loan/events/${eventId}?commitment=${c.id}`}
                      className={styles.spread}
                      style={{ textDecoration: "none" }}
                    >
                      <span
                        className={styles.cardName}
                        style={{
                          color:
                            selected?.id === c.id
                              ? "var(--accent)"
                              : "var(--ink)",
                        }}
                      >
                        {c.label}
                      </span>
                      <span className={styles.muted}>
                        {c.locked_copies} cards locked
                      </span>
                    </Link>
                  ))
                )}
                {commitments.length > 1 && (
                  <p className={styles.note}>
                    Two decks committed, one gets sleeved — so a card wanted by
                    both locks once, not twice. Nobody in the crew can see which
                    decks these are, only that a card is spoken for.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  Missing for {selected.label}
                </h2>
                <span className={styles.muted}>
                  {shortCards.length} of {shortfall.length} cards short
                </span>
              </div>
              {shortCards.length === 0 ? (
                <div className={styles.panelBody}>
                  <Empty>
                    Nothing missing — you can build this deck from your own
                    cards.
                  </Empty>
                </div>
              ) : (
                <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
                  {shortCards.map((card) => (
                    <li key={card.oracle_id} className={styles.listRow}>
                      <span className={styles.grow}>
                        <span className={styles.cardName}>{card.name}</span>
                      </span>
                      <span className={styles.muted}>
                        have {card.have} of {card.need}
                      </span>
                      <span className={styles.qty}>
                        <span
                          className={`${styles.badge} ${styles.badgeAccent}`}
                        >
                          {card.short} short
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {shortCards.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>
                    Fewest people who cover it
                  </h2>
                  <span className={styles.muted}>
                    {plan.fully_covered
                      ? "fully covered"
                      : `${plan.uncovered.length} card${plan.uncovered.length === 1 ? "" : "s"} unavailable`}
                  </span>
                </div>
                <div className={styles.panelBody}>
                  <HandoffPlanView
                    plan={plan}
                    eventName={event.name}
                    eventDate={event.event_date}
                    deckName={selected.label}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
