import { notFound } from "next/navigation";
import styles from "../../../loan.module.css";
import { TickThrough } from "../../../_components/TickThrough";
import { QueryError } from "../../../_components/States";
import { createClient } from "@/lib/supabase/server";
import { getMyHoldings, getReferenceDeckCards } from "@/lib/loan/queries";

export const dynamic = "force-dynamic";

export default async function TickDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [deckResult, holdingsResult] = await Promise.all([
    getReferenceDeckCards(supabase, id),
    getMyHoldings(supabase),
  ]);

  if (deckResult.error) {
    return <QueryError what="this deck" error={deckResult.error} />;
  }
  if (!deckResult.data || deckResult.data.rows.length === 0) notFound();

  const deck = deckResult.data;
  const owned = new Map(
    (holdingsResult.data ?? []).map((h) => [h.oracle_id, h.qty]),
  );

  const cards = deck.rows.map((card) => ({
    oracle_id: card.oracle_id,
    name: card.name,
    in_list: card.qty,
    already_owned: owned.get(card.oracle_id) ?? 0,
  }));

  const meta = deck.meta;

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>
          {meta.archetype_name ?? meta.player ?? "Deck"}
        </h1>
        <p className={styles.sub}>
          {meta.player} · {meta.rank}th · {meta.event_name} · {meta.event_date}
        </p>
      </div>

      <div className={styles.stack}>
        <div className={styles.panel}>
          <TickThrough cards={cards} />
        </div>

        {meta.unmatched_card_names.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Not resolved to a card</h2>
              <span className={`${styles.badge} ${styles.badgeWarn}`}>
                {meta.unmatched_card_names.length}
              </span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.stack}>
                <pre className={styles.pre}>
                  {meta.unmatched_card_names.join("\n")}
                </pre>
                <p className={styles.note}>
                  These names never matched a Scryfall row during enrichment, so
                  they cannot be tracked. Usually a double-faced card whose
                  front face needs an alias — see lib/scryfall/aliases.ts.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
