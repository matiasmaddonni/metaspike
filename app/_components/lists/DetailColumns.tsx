"use client";

import { useState } from "react";
import type { DeckPayload } from "@/lib/types/listEvents";
import {
  exportDeckMTGO,
  groupByType,
  isSpice,
  rankTier,
  scopeLabel,
  totalQty,
  ordinal,
} from "@/lib/lists/helpers";
import styles from "../../landing.module.css";
import { Field } from "./Field";

type Props = {
  deck: DeckPayload;
  totalDecksInScope: number;
};

export function DetailColumns({ deck, totalDecksInScope }: Props) {
  const [copied, setCopied] = useState(false);
  const mainGroups = groupByType(deck.main);
  const mainCount = totalQty(deck.main);
  const sideCount = totalQty(deck.side);
  const tier = rankTier(deck.rank);

  async function onExport() {
    try {
      await navigator.clipboard.writeText(exportDeckMTGO(deck));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked — silently ignore
    }
  }

  return (
    <div className={styles.detail}>
      <div className={styles.dhead}>
        <div className={styles.dhl}>
          <div className={`${styles.dhrank} ${styles[tier]}`}>
            {ordinal(deck.rank)}
          </div>
          <div className={styles.dhinfo}>
            <div className={styles.dhplayer}>{deck.player}</div>
            <div className={styles.dhmeta}>
              <span>{deck.event_name}</span>
              <span className={styles.sc}>{scopeLabel(deck.event_scope)}</span>
              <span>{deck.event_date}</span>
              {deck.record && <span>· {deck.record}</span>}
              {deck.entrants != null && <span>· {deck.entrants} entrants</span>}
            </div>
          </div>
        </div>
        <button type="button" className={styles.export} onClick={onExport}>
          <span>⎘</span>
          {copied ? "COPIED" : "EXPORT MTGO"}
        </button>
      </div>

      <div className={styles.cols}>
        <div>
          <div className={styles.zhd}>
            MAINDECK<b>{mainCount}</b>
          </div>
          <div className={styles.grpgrid}>
            {mainGroups.map((g) => (
              <div key={g.type} className={styles.grp}>
                <div className={styles.grphd}>
                  <b>{g.type}</b>
                  <span>{g.count}</span>
                </div>
                {g.cards.map((line) => (
                  <div key={line.card} className={styles.line}>
                    <span className={styles.qty}>{line.qty}</span>
                    <span
                      className={
                        isSpice(line)
                          ? `${styles.cn} ${styles.cnSpice}`
                          : styles.cn
                      }
                    >
                      {isSpice(line) && <span className={styles.spdot} />}
                      {line.card}
                    </span>
                    <Field line={line} totalDecksInScope={totalDecksInScope} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.colsSide}>
          <div className={styles.zhd}>
            SIDEBOARD<b>{sideCount}</b>
          </div>
          <div className={styles.sideList}>
            {deck.side
              .slice()
              .sort((a, b) => a.card.localeCompare(b.card))
              .map((line) => (
                <div
                  key={line.card}
                  className={`${styles.line} ${styles.sideLine}`}
                >
                  <span className={styles.qty}>{line.qty}</span>
                  <span
                    className={
                      isSpice(line)
                        ? `${styles.cn} ${styles.cnSpice}`
                        : styles.cn
                    }
                  >
                    {isSpice(line) && <span className={styles.spdot} />}
                    {line.card}
                  </span>
                  <Field line={line} totalDecksInScope={totalDecksInScope} />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
