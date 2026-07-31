"use client";

import { useMemo, useState, useTransition } from "react";
import styles from "../loan.module.css";
import { saveHoldings } from "../_actions/holdings";

export type TickCard = {
  oracle_id: string;
  name: string;
  /** Copies the reference list calls for — the default when you tick it. */
  in_list: number;
  /** Copies already recorded in your holdings, so re-ticking a list is cheap. */
  already_owned?: number;
};

/**
 * Standing at your box, list in hand, ticking what you have.
 *
 * The entry path everything else depends on. Untracked always means zero — a
 * user is never asked to enter a card they do not own, because a form that
 * demands 900 answers gets abandoned at 20.
 */
export function TickThrough({ cards }: { cards: TickCard[] }) {
  const [owned, setOwned] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      cards
        .filter((c) => (c.already_owned ?? 0) > 0)
        .map((c) => [c.oracle_id, c.already_owned as number]),
    ),
  );

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const { ticked, copies } = useMemo(() => {
    const entries = Object.entries(owned).filter(([, qty]) => qty > 0);
    return {
      ticked: entries.length,
      copies: entries.reduce((sum, [, qty]) => sum + qty, 0),
    };
  }, [owned]);

  function save() {
    setStatus(null);
    // Every card in the list is sent, including the unticked ones at qty 0 —
    // that is how unticking a card you previously owned deletes the row.
    const entries = cards.map((card) => ({
      oracle_id: card.oracle_id,
      qty: owned[card.oracle_id] ?? 0,
    }));

    startTransition(async () => {
      const result = await saveHoldings(entries);
      setStatus(
        result.ok
          ? `Saved — ${result.saved} cards, ${copies} copies.`
          : (result.error ?? "Save failed."),
      );
    });
  }

  function toggle(card: TickCard) {
    setOwned((prev) => ({
      ...prev,
      [card.oracle_id]: prev[card.oracle_id] > 0 ? 0 : card.in_list,
    }));
  }

  function step(card: TickCard, delta: number) {
    setOwned((prev) => {
      const next = Math.max(0, (prev[card.oracle_id] ?? 0) + delta);
      return { ...prev, [card.oracle_id]: next };
    });
  }

  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Tick what you own</h2>
        <span className={styles.muted}>
          {ticked} of {cards.length} cards · {copies} copies
        </span>
      </div>

      <ul className={styles.list}>
        {cards.map((card) => {
          const qty = owned[card.oracle_id] ?? 0;
          const on = qty > 0;
          return (
            <li
              key={card.oracle_id}
              className={styles.tickRow}
              onClick={() => toggle(card)}
            >
              <span
                className={`${styles.tickBox} ${on ? styles.tickBoxOn : ""}`}
              >
                {on ? "✓" : ""}
              </span>
              <span className={styles.grow}>
                <span className={styles.cardName}>{card.name}</span>
              </span>
              <span className={styles.muted}>{card.in_list} in list</span>
              {on && (
                <span
                  className={styles.stepper}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className={styles.stepBtn}
                    onClick={() => step(card, -1)}
                    aria-label={`One fewer ${card.name}`}
                  >
                    −
                  </button>
                  <span className={styles.qty} style={{ minWidth: 24 }}>
                    {qty}
                  </span>
                  <button
                    className={styles.stepBtn}
                    onClick={() => step(card, 1)}
                    aria-label={`One more ${card.name}`}
                  >
                    +
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className={styles.panelBody}>
        <div className={styles.spread}>
          <span className={styles.muted}>
            {status ?? "Anything left unticked counts as zero."}
          </span>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={save}
            disabled={pending}
          >
            {pending ? "Saving…" : `Save ${copies} copies`}
          </button>
        </div>
      </div>
    </>
  );
}
