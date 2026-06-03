"use client";

import { useMemo, useState } from "react";
import type {
  EventPayload,
  ListEventsResponse,
} from "@/lib/types/listEvents";
import { ordinal, scopeLabel } from "@/lib/lists/helpers";
import styles from "../../landing.module.css";
import { ListRow } from "./ListRow";

type Props = {
  events: ListEventsResponse;
  archetypeName: string;
};

export function ListsView({ events, archetypeName }: Props) {
  const totalDecks = useMemo(
    () => events.reduce((s, e) => s + e.decks.length, 0),
    [events],
  );

  const defaultOpen = events[0]?.decks[0]?.deck_id ?? null;
  const [openDeckId, setOpenDeckId] = useState<number | null>(defaultOpen);

  if (events.length === 0) {
    return (
      <div className={styles.empty} style={{ padding: 40 }}>
        — no lists in range —
      </div>
    );
  }

  return (
    <>
      <div className={styles.lcolhd}>
        <span>FINISH</span>
        <span>PLAYER</span>
        <span>RECORD</span>
        <span>SPICE — OFF-CONSENSUS CARDS</span>
        <span aria-hidden />
      </div>
      {events.map((ev) => (
        <EventSection
          key={ev.id}
          event={ev}
          archetypeName={archetypeName}
          openDeckId={openDeckId}
          onToggle={(id) => setOpenDeckId(openDeckId === id ? null : id)}
          totalDecksInScope={totalDecks}
        />
      ))}
    </>
  );
}

function EventSection({
  event,
  archetypeName,
  openDeckId,
  onToggle,
  totalDecksInScope,
}: {
  event: EventPayload;
  archetypeName: string;
  openDeckId: number | null;
  onToggle: (id: number) => void;
  totalDecksInScope: number;
}) {
  return (
    <section>
      <div className={styles.evhd}>
        <div className={styles.evtick} />
        <span className={styles.evname}>{event.name}</span>
        <span className={styles.evtag}>{scopeLabel(event.scope)}</span>
        <span className={styles.evdate}>{event.date}</span>
        {event.entrants != null && (
          <>
            <span className={styles.evdot}>·</span>
            <span className={styles.event}>{event.entrants} entrants</span>
          </>
        )}
        <span className={styles.gcountList}>
          {event.n_decks} {archetypeName} lists · top {ordinal(event.top_finish)}
        </span>
      </div>
      {event.decks.map((deck) => (
        <ListRow
          key={deck.deck_id}
          deck={deck}
          open={openDeckId === deck.deck_id}
          onToggle={() => onToggle(deck.deck_id)}
          totalDecksInScope={totalDecksInScope}
        />
      ))}
    </section>
  );
}
