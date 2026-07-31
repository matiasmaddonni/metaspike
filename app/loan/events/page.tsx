import Link from "next/link";
import styles from "../loan.module.css";
import { QueryError, NoCrew, Empty } from "../_components/States";
import { createClient } from "@/lib/supabase/server";
import { getLocalEvents, getMyCrew } from "@/lib/loan/queries";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const crewResult = await getMyCrew(supabase);

  if (crewResult.error) {
    return <QueryError what="your crew" error={crewResult.error} />;
  }
  if (!crewResult.data) return <NoCrew />;

  const eventsResult = await getLocalEvents(supabase, crewResult.data.id);
  if (eventsResult.error) {
    return <QueryError what="events" error={eventsResult.error} />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const events = eventsResult.data;

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Events</h1>
        <p className={styles.sub}>What the crew is preparing for</p>
      </div>

      <div className={styles.stack}>
        <div className={styles.spread}>
          <span className={styles.muted}>
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          <button className={`${styles.btn} ${styles.btnPrimary}`}>
            Add event
          </button>
        </div>

        {events.length === 0 ? (
          <Empty>
            No events yet. Add the RCQ you are preparing for — cards lock
            against it, so the crew can see what is genuinely spare.
          </Empty>
        ) : (
          <div className={styles.panel}>
            <ul className={styles.list}>
              {events.map((event) => {
                const days = Math.round(
                  (new Date(event.event_date).getTime() -
                    new Date(today).getTime()) /
                    86_400_000,
                );
                return (
                  <li key={event.id} className={styles.listRow}>
                    <span className={styles.grow}>
                      <Link
                        href={`/loan/events/${event.id}`}
                        className={styles.cardName}
                        style={{ textDecoration: "none" }}
                      >
                        {event.name}
                      </Link>
                      <div className={styles.muted}>
                        {event.event_date}
                        {event.store ? ` · ${event.store}` : ""} · {event.format}
                      </div>
                    </span>
                    <span className={styles.qty}>
                      {days > 0 ? `${days}d` : days === 0 ? "today" : "past"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className={styles.note}>
          Two events on one weekend is the case to watch. Cards lock per event,
          so a card sleeved on Saturday still reads as free for Sunday until you
          commit that deck too.
        </p>
      </div>
    </>
  );
}
