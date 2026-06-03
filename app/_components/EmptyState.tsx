import styles from "../landing.module.css";
import { Logo } from "./Logo";

type Props = {
  format: string;
  error?: string;
};

export function EmptyState({ format, error }: Props) {
  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <Logo size={30} />
      </header>
      <main style={{ padding: "40px 26px", maxWidth: 720 }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            margin: 0,
            color: "var(--ink)",
          }}
        >
          No archetypes seeded for <span style={{ color: "var(--accent)" }}>{format}</span>
        </h1>
        <p
          style={{
            color: "var(--dim)",
            marginTop: 16,
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          Insert rows into <code>public.archetype</code> + <code>public.archetype_match_rule</code>,
          then run <code>npm run classify</code> to populate this view. The classifier reads
          signature rules from <code>archetype_match_rule</code> and writes{" "}
          <code>decks.archetype_id</code> on every matching deck.
        </p>
        {error && (
          <pre
            style={{
              color: "var(--accent)",
              marginTop: 20,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-plex-mono), monospace",
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: 12,
            }}
          >
            {error}
          </pre>
        )}
      </main>
    </div>
  );
}
