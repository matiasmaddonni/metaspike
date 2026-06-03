import styles from "../landing.module.css";

export function ColumnHeader() {
  return (
    <div className={styles.colhd}>
      <span aria-hidden />
      <span>CARD</span>
      <span>INCLUSION ACROSS LISTS</span>
      <span>AVG</span>
      <span style={{ textAlign: "right" }}>N</span>
    </div>
  );
}
