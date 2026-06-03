"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Zone } from "@/lib/types/cardStats";
import styles from "../landing.module.css";
import { Logo } from "./Logo";

type ArchetypeOption = { slug: string; name: string };

export type ViewMode = "aggregate" | "lists";

type Props = {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  zone: Zone;
  onZoneChange: (z: Zone) => void;
  formatLabel: string;
  archetypeLabel: string;
  archetypeOptions: ArchetypeOption[];
  currentArchetypeSlug: string | null;
  dateLabel: string;
};

export function Header({
  mode,
  onModeChange,
  zone,
  onZoneChange,
  formatLabel,
  archetypeLabel,
  archetypeOptions,
  currentArchetypeSlug,
  dateLabel,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onArchetypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const slug = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("archetype", slug);
    router.push(`/?${params.toString()}`);
  }

  return (
    <header className={styles.top}>
      <Logo size={30} />
      <div className={styles.filters}>
        <FilterGroup label="Format" value={formatLabel} />
        <ArchetypeSelect
          label="Archetype"
          value={archetypeLabel}
          options={archetypeOptions}
          currentSlug={currentArchetypeSlug}
          onChange={onArchetypeChange}
        />
        <FilterGroup label="Date" value={dateLabel} />
        <FilterGroup label="Scope" fixed value="CHALLENGES" />
      </div>
      <div
        style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}
      >
        <div className={styles.modeToggle} role="group" aria-label="view mode">
          <button
            className={mode === "aggregate" ? styles.on : ""}
            onClick={() => onModeChange("aggregate")}
            type="button"
          >
            AGGREGATE
          </button>
          <button
            className={mode === "lists" ? styles.on : ""}
            onClick={() => onModeChange("lists")}
            type="button"
          >
            LISTS
          </button>
        </div>
        {mode === "aggregate" && (
          <div
            className={styles.zone}
            role="group"
            aria-label="zone toggle"
            style={{ marginLeft: 0 }}
          >
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
        )}
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

function ArchetypeSelect({
  label,
  value,
  options,
  currentSlug,
  onChange,
}: {
  label: string;
  value: string;
  options: ArchetypeOption[];
  currentSlug: string | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className={styles.fg}>
      <label>{label}</label>
      <div className={styles.selWrap}>
        <button type="button" className={styles.sel} aria-hidden tabIndex={-1}>
          {value}
          <i className={styles.selCaret}>▾</i>
        </button>
        <select
          className={styles.selNative}
          value={currentSlug ?? ""}
          onChange={onChange}
          aria-label="Archetype"
        >
          {options.map((opt) => (
            <option key={opt.slug} value={opt.slug}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
