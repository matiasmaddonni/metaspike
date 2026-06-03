import type { ArchetypeMeta, WinrateResponse } from "@/lib/types/cardStats";
import styles from "../landing.module.css";

type Props = {
  archetype: ArchetypeMeta;
  totalDecks: number;
  winrate: WinrateResponse;
  dateLabel: string;
  scopeLabel: string;
};

function formatPct(p: number | null): string {
  if (p === null) return "—";
  return (p * 100).toFixed(1);
}

export function SubHeader({ archetype, totalDecks, winrate, dateLabel, scopeLabel }: Props) {
  const pct = formatPct(winrate.win_pct);
  return (
    <section className={styles.sub}>
      <div className={styles.arche}>
        <h1>{archetype.name}</h1>
        <div className={styles.archemeta}>
          <b>{totalDecks}</b>
          <span>decks</span>
          <span className={styles.dot}>·</span>
          <b>{winrate.n_events}</b>
          <span>events</span>
          <span className={styles.dot}>·</span>
          <span>{scopeLabel}</span>
          <span className={styles.dot}>·</span>
          <span>{dateLabel}</span>
        </div>
      </div>
      <div className={styles.wr}>
        <div className={styles.wrcore}>
          <span className={styles.wrnum}>
            {pct}
            <i>%</i>
          </span>
          <div className={styles.wrcol}>
            <b>
              {winrate.match_wins}–{winrate.match_losses}
            </b>
            <span>match record</span>
          </div>
        </div>
        <div className={styles.wrwarn}>
          <i>▲</i>
          among published winners — survivorship-biased, not a true win rate
        </div>
      </div>
      <button type="button" className={styles.export}>
        <span>⎘</span>EXPORT MTGO
      </button>
    </section>
  );
}
