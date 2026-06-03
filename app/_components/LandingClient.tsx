"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ArchetypeMeta,
  BucketedRow,
  CardStatsResponse,
  WinrateResponse,
  Zone,
} from "@/lib/types/cardStats";
import type { ListEventsResponse } from "@/lib/types/listEvents";
import { bucketize } from "@/lib/buckets";
import { fullCardUrl } from "@/lib/scryfallImage";
import styles from "../landing.module.css";
import { CardPopover } from "./CardPopover";
import { Header, type ViewMode } from "./Header";
import { SubHeader } from "./SubHeader";
import { ColumnHeader } from "./ColumnHeader";
import { GroupSection } from "./GroupSection";
import { Logo } from "./Logo";
import { ListsView } from "./lists/ListsView";

type HoverState = { row: BucketedRow; x: number; y: number } | null;

type Props = {
  archetype: ArchetypeMeta;
  archetypeOptions: Array<{ slug: string; name: string }>;
  mainStats: CardStatsResponse;
  sideStats: CardStatsResponse;
  winrate: WinrateResponse;
  events: ListEventsResponse;
  dateLabel: string;
  formatLabel: string;
};

export function LandingClient({
  archetype,
  archetypeOptions,
  mainStats,
  sideStats,
  winrate,
  events,
  dateLabel,
  formatLabel,
}: Props) {
  const [mode, setMode] = useState<ViewMode>("aggregate");
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

  const nLists = useMemo(
    () => events.reduce((s, e) => s + e.decks.length, 0),
    [events],
  );

  return (
    <div className={styles.app}>
      <Header
        mode={mode}
        onModeChange={setMode}
        zone={zone}
        onZoneChange={setZone}
        formatLabel={formatLabel}
        archetypeLabel={archetype.name}
        archetypeOptions={archetypeOptions}
        currentArchetypeSlug={archetype.slug}
        dateLabel={dateLabel}
      />
      <SubHeader
        mode={mode}
        archetype={archetype}
        totalDecks={totalDecks}
        winrate={winrate}
        dateLabel={dateLabel}
        scopeLabel={scopeLabel}
        nLists={nLists}
        nEvents={events.length}
      />
      {mode === "aggregate" ? (
        <>
          <ColumnHeader />
          {groups.map((g) => (
            <GroupSection key={g.bucket} group={g} onHoverChange={onHoverChange} />
          ))}
          {hover && (
            <CardPopover
              imageUrl={hoverImage}
              cursorX={hover.x}
              cursorY={hover.y}
            />
          )}
        </>
      ) : (
        <ListsView events={events} archetypeName={archetype.name} />
      )}
      <footer className={styles.foot}>
        <Logo size={16} />
        <div className={styles.footnote}>
          {mode === "aggregate"
            ? `Inclusion & copy counts computed across ${totalDecks} published Challenge lists. Hover AVG for the copy-count split.`
            : `${nLists} lists across ${events.length} events, ordered by event then finish. Hover any row to expand the full 75; pink chips mark off-consensus cards.`}
        </div>
      </footer>
    </div>
  );
}
