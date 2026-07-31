import Link from "next/link";
import styles from "../loan.module.css";

/**
 * Surfaces a Postgres/PostgREST error instead of swallowing it into an empty
 * state. PGRST205/PGRST202 mean the object is not in PostgREST's schema cache
 * — either the migration never applied or the cache is stale — and that is
 * worth saying out loud rather than rendering "no cards yet".
 */
export function QueryError({ what, error }: { what: string; error: string }) {
  const schemaMissing =
    error.includes("PGRST205") ||
    error.includes("PGRST202") ||
    error.includes("schema cache") ||
    error.includes("does not exist");

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Could not load {what}</h2>
        <span className={`${styles.badge} ${styles.badgeWarn}`}>
          {schemaMissing ? "schema not applied" : "query failed"}
        </span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.stack}>
          <pre className={styles.pre}>{error}</pre>
          {schemaMissing && (
            <p className={styles.note}>
              The metaloan tables are not visible over the API. Run{" "}
              <code className="mono">metaloan_apply_v2.sql</code> in the
              Supabase SQL editor — it is idempotent, so it is safe whether or
              not the earlier attempt partially landed, and it ends with a
              PostgREST schema reload.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Authenticated but not in a crew yet — the first-run state. */
export function NoCrew() {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>You are not in a crew yet</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.stack}>
          <p className={styles.muted}>
            metaloan only ever shows cards inside a crew. Join one with an
            invite code, or start your own and share the code.
          </p>
          <Link
            href="/loan/join"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.selfStart}`}
          >
            Join or create a crew
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}
