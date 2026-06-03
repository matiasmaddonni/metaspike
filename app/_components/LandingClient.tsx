"use client";

import { useMemo, useState } from "react";
import type {
  ArchetypeMeta,
  CardStatsResponse,
  WinrateResponse,
  Zone,
} from "@/lib/types/cardStats";
import { bucketize } from "@/lib/buckets";
import styles from "../landing.module.css";
import { Header } from "./Header";
import { SubHeader } from "./SubHeader";
import { ColumnHeader } from "./ColumnHeader";
import { GroupSection } from "./GroupSection";
import { Logo } from "./Logo";

type Props = {
  archetype: ArchetypeMeta;
  mainStats: CardStatsResponse;
  sideStats: CardStatsResponse;
  winrate: WinrateResponse;
  dateLabel: string;
  formatLabel: string;
};

export function LandingClient({
  archetype,
  mainStats,
  sideStats,
  winrate,
  dateLabel,
  formatLabel,
}: Props) {
  const [zone, setZone] = useState<Zone>("main");

  const active = zone === "main" ? mainStats : sideStats;
  const groups = useMemo(() => bucketize(active.rows), [active.rows]);
  const totalDecks = active.meta.total_decks;
  const scopeLabel = "Modern Challenges";

  return (
    <div className={styles.app}>
      <Header
        zone={zone}
        onZoneChange={setZone}
        formatLabel={formatLabel}
        archetypeLabel={archetype.name}
        dateLabel={dateLabel}
      />
      <SubHeader
        archetype={archetype}
        totalDecks={totalDecks}
        winrate={winrate}
        dateLabel={dateLabel}
        scopeLabel={scopeLabel}
      />
      <ColumnHeader />
      {groups.map((g) => (
        <GroupSection key={g.bucket} group={g} />
      ))}
      <footer className={styles.foot}>
        <Logo size={16} />
        <div className={styles.footnote}>
          Inclusion & copy counts computed across {totalDecks} published Challenge lists.
          Hover AVG for the copy-count split.
        </div>
      </footer>
    </div>
  );
}
