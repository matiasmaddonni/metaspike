import styles from "../landing.module.css";

const COLOR_HEX: Record<string, string> = {
  W: "#efe7cf",
  U: "#5b87b8",
  B: "#7a7a82",
  R: "#cf5640",
  G: "#4f9a68",
};

export function ColorPips({ colors }: { colors: string[] }) {
  if (!colors || colors.length === 0) {
    return (
      <span className={styles.pips} aria-label="colorless">
        <span className={`${styles.pip} ${styles.pipC}`} />
      </span>
    );
  }
  return (
    <span className={styles.pips} aria-label={`colors ${colors.join("")}`}>
      {colors.map((c) => (
        <span
          key={c}
          className={styles.pip}
          style={{ background: COLOR_HEX[c] ?? "#54585f" }}
        />
      ))}
    </span>
  );
}
