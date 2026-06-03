import type { BucketGroup } from "@/lib/buckets";
import styles from "../landing.module.css";
import { CardRow } from "./CardRow";

const BUCKET_LABEL: Record<BucketGroup["bucket"], string> = {
  core: "CORE",
  flex: "FLEX",
  tech: "TECH",
};

const BUCKET_CLASS: Record<BucketGroup["bucket"], string> = {
  core: styles.ghdCore,
  flex: styles.ghdFlex,
  tech: styles.ghdTech,
};

export function GroupSection({ group }: { group: BucketGroup }) {
  return (
    <section>
      <div className={`${styles.ghd} ${BUCKET_CLASS[group.bucket]}`}>
        <div className={styles.gtick} />
        <span className={styles.glabel}>{BUCKET_LABEL[group.bucket]}</span>
        <span className={styles.grule}>{group.rule}</span>
        <span className={styles.gdesc}>{group.desc}</span>
        <span className={styles.gcount}>{group.rows.length} cards</span>
      </div>
      {group.rows.length === 0 ? (
        <div className={styles.empty}>— none in range —</div>
      ) : (
        group.rows.map((row) => <CardRow key={`${row.card_name}-${row.zone}`} row={row} />)
      )}
    </section>
  );
}
