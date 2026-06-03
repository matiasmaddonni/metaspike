"use client";

import type { Zone } from "@/lib/types/cardStats";
import styles from "../landing.module.css";
import { Logo } from "./Logo";

type Props = {
  zone: Zone;
  onZoneChange: (z: Zone) => void;
  formatLabel: string;
  archetypeLabel: string;
  dateLabel: string;
};

export function Header({ zone, onZoneChange, formatLabel, archetypeLabel, dateLabel }: Props) {
  return (
    <header className={styles.top}>
      <Logo size={30} />
      <div className={styles.filters}>
        <FilterGroup label="Format" value={formatLabel} />
        <FilterGroup label="Archetype" value={archetypeLabel} />
        <FilterGroup label="Date" value={dateLabel} />
        <FilterGroup label="Scope" fixed value="CHALLENGES" />
      </div>
      <div className={styles.zone} role="group" aria-label="zone toggle">
        <button
          className={zone === "main" ? styles.on : ""}
          onClick={() => onZoneChange("main")}
          type="button"
        >
          MAIN
        </button>
        <button
          className={zone === "side" ? styles.on : ""}
          onClick={() => onZoneChange("side")}
          type="button"
        >
          SIDE
        </button>
      </div>
    </header>
  );
}

function FilterGroup({
  label,
  value,
  fixed,
}: {
  label: string;
  value: string;
  fixed?: boolean;
}) {
  return (
    <div className={`${styles.fg} ${fixed ? styles.fixed : ""}`}>
      <label>{label}</label>
      {fixed ? (
        <span>{value}</span>
      ) : (
        <button type="button" className={styles.sel}>
          {value}
          <i className={styles.selCaret}>▾</i>
        </button>
      )}
    </div>
  );
}
