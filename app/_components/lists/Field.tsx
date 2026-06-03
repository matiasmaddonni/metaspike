import type { DeckLine } from "@/lib/types/listEvents";
import { isSpice } from "@/lib/lists/helpers";
import styles from "../../landing.module.css";

type Props = {
  line: DeckLine;
  totalDecksInScope: number;
};

export function Field({ line, totalDecksInScope }: Props) {
  const spice = isSpice(line);
  const fillClass = spice
    ? `${styles.fieldFill} ${styles.fieldFillSpice}`
    : styles.fieldFill;
  const pctClass = spice
    ? `${styles.fieldPct} ${styles.fieldPctSpice}`
    : styles.fieldPct;
  const pct = Math.round(line.field_pct * 100);
  const fillWidth = `${Math.max(0, Math.min(100, line.field_pct * 100))}%`;
  return (
    <div
      className={styles.field}
      title={`${pct}% of ${totalDecksInScope} field lists run this card`}
    >
      <div className={styles.fieldTrack}>
        <span className={fillClass} style={{ width: fillWidth }} />
      </div>
      <span className={pctClass}>{pct}%</span>
    </div>
  );
}
