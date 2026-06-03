"use client";

import type { DeckPayload } from "@/lib/types/listEvents";
import {
  rankTier,
  ordinal,
  spiceCards,
  totalQty,
} from "@/lib/lists/helpers";
import styles from "../../landing.module.css";
import { DetailColumns } from "./DetailColumns";

type Props = {
  deck: DeckPayload;
  open: boolean;
  onToggle: () => void;
  totalDecksInScope: number;
};

export function ListRow({ deck, open, onToggle, totalDecksInScope }: Props) {
  const tier = rankTier(deck.rank);
  const spice = spiceCards(deck);
  const mainCount = totalQty(deck.main);
  const sideCount = totalQty(deck.side);

  return (
    <div className={`${styles.litem} ${open ? styles.open : ""}`}>
      <div
        className={styles.lrow}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={`${styles.rank} ${styles[tier]}`}>
          {ordinal(deck.rank)}
        </div>
        <div className={styles.player}>
          <b>{deck.player}</b>
          <span className={styles.psub}>
            {mainCount} main · {sideCount} side
          </span>
        </div>
        <div className={styles.record}>{deck.record ?? "—"}</div>
        <div className={styles.spicecol}>
          {spice.length === 0 ? (
            <span className={styles.stock}>stock</span>
          ) : (
            <>
              {spice.slice(0, 2).map((s) => (
                <span key={s.card} className={styles.spchip} title={s.card}>
                  <span className={styles.spdot} />
                  {s.card}
                </span>
              ))}
              {spice.length > 2 && (
                <span className={styles.spchipMore}>+{spice.length - 2}</span>
              )}
            </>
          )}
        </div>
        <div className={styles.chev}>{open ? "▾" : "▸"}</div>
      </div>
      {open && (
        <DetailColumns deck={deck} totalDecksInScope={totalDecksInScope} />
      )}
    </div>
  );
}
