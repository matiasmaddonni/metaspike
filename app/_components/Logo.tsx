import styles from "../landing.module.css";

export function Logo({ size = 30 }: { size?: number }) {
  const h = Math.round((size * 22) / 30);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={h} viewBox="0 0 30 22" aria-hidden>
        <path
          d="M1 15 H8 L12 15 L15.5 3 L19 13 L21.5 9 H29"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={styles.mono}
        style={{
          fontWeight: 600,
          letterSpacing: "0.5px",
          fontSize: 17,
          color: "var(--ink)",
        }}
      >
        metaspike
      </span>
    </span>
  );
}
