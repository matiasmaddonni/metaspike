import type { BucketedRow, CopyBreakdown } from "@/lib/types/cardStats";
import styles from "../landing.module.css";
import { ColorPips } from "./ColorPip";

function formatCopyBreakdown(b: CopyBreakdown): string {
  const entries: Array<[string, number]> = [
    ["4-of", b["4"]],
    ["3-of", b["3"]],
    ["2-of", b["2"]],
    ["1-of", b["1"]],
    ["5+-of", b["5+"]],
  ];
  const nonZero = entries.filter(([, n]) => n > 0);
  if (nonZero.length === 0) return "—";
  return "Copies run:  " + nonZero.map(([k, n]) => `${n}× ${k}`).join(" · ");
}

export function CardRow({ row }: { row: BucketedRow }) {
  const pct = Math.round(row.inclusion_pct * 1000) / 10;
  const meterWidth = `${Math.max(0, Math.min(100, row.inclusion_pct * 100))}%`;
  return (
    <div className={styles.row}>
      <div className={styles.thumb}>
        {row.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.image_url} alt="" loading="lazy" />
        )}
      </div>
      <div className={styles.name}>
        <div className={styles.nm}>{row.card_name}</div>
        <div className={styles.metaRow}>
          <ColorPips colors={row.colors} />
          <div className={styles.ty}>{row.type_line ?? ""}</div>
        </div>
      </div>
      <div className={styles.incl}>
        <div className={styles.meter}>
          <span style={{ width: meterWidth }} />
        </div>
        <div className={styles.pct}>
          {pct}
          <i>%</i>
        </div>
      </div>
      <div className={styles.avg} title={formatCopyBreakdown(row.copy_breakdown)}>
        {row.avg_copies.toFixed(1)}
        <i>avg</i>
      </div>
      <div className={styles.n}>{row.n_decks}</div>
    </div>
  );
}
