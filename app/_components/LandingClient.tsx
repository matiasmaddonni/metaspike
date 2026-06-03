"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ArchetypeMeta,
  BucketedRow,
  CardStatsResponse,
  WinrateResponse,
  Zone,
} from "@/lib/types/cardStats";
import { bucketize } from "@/lib/buckets";
import { fullCardUrl } from "@/lib/scryfallImage";
import styles from "../landing.module.css";
import { CardPopover } from "./CardPopover";
import { Header } from "./Header";
import { SubHeader } from "./SubHeader";
import { ColumnHeader } from "./ColumnHeader";
import { GroupSection } from "./GroupSection";
import { Logo } from "./Logo";

type HoverState = { row: BucketedRow; x: number; y: number } | null;

type Props = {
  archetype: ArchetypeMeta;
  archetypeOptions: Array<{ slug: string; name: string }>;
  mainStats: CardStatsResponse;
  sideStats: CardStatsResponse;
  winrate: WinrateResponse;
  dateLabel: string;
  formatLabel: string;
};

export function LandingClient({
  archetype,
  archetypeOptions,
  mainStats,
  sideStats,
  winrate,
  dateLabel,
  formatLabel,
}: Props) {
  const [zone, setZone] = useState<Zone>("main");
  const [hover, setHover] = useState<HoverState>(null);

  const onHoverChange = useCallback(
    (row: BucketedRow | null, x: number, y: number) => {
      if (row) setHover({ row, x, y });
      else setHover(null);
    },
    [],
  );

  const active = zone === "main" ? mainStats : sideStats;
  const groups = useMemo(() => bucketize(active.rows), [active.rows]);
  const totalDecks = active.meta.total_decks;
  const scopeLabel = "Modern Challenges";
  const hoverImage = hover ? fullCardUrl(hover.row) : null;

  return (
    <div className={styles.app}>
      <Header
        zone={zone}
        onZoneChange={setZone}
        formatLabel={formatLabel}
        archetypeLabel={archetype.name}
        archetypeOptions={archetypeOptions}
        currentArchetypeSlug={archetype.slug}
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
        <GroupSection key={g.bucket} group={g} onHoverChange={onHoverChange} />
      ))}
      {hover && (
        <CardPopover imageUrl={hoverImage} cursorX={hover.x} cursorY={hover.y} />
      )}
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
