import Link from "next/link";
import styles from "../loan.module.css";
import { QueryError, Empty } from "../_components/States";
import { createClient } from "@/lib/supabase/server";
import { getMyHoldings, listReferenceDecks } from "@/lib/loan/queries";

export const dynamic = "force-dynamic";

const FORMAT = "modern";
const WINDOW_DAYS = 90;

export default async function CollectionPage() {
  const supabase = await createClient();

  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 86_400_000);
  const dateTo = to.toISOString().slice(0, 10);
  const dateFrom = from.toISOString().slice(0, 10);

  const [holdingsResult, decksResult] = await Promise.all([
    getMyHoldings(supabase),
    listReferenceDecks(supabase, FORMAT, dateFrom, dateTo, 40),
  ]);

  if (holdingsResult.error) {
    return <QueryError what="your cards" error={holdingsResult.error} />;
  }

  const holdings = holdingsResult.data;
  const totalCopies = holdings.reduce((s, h) => s + h.qty, 0);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>My cards</h1>
        <p className={styles.sub}>
          Only what the competitive meta actually plays — not your whole
          collection
        </p>
      </div>

      <div className={styles.stack}>
        <div className={styles.grid3}>
          <div className={styles.panel}>
            <div className={styles.panelBody}>
              <div className={styles.stat}>{holdings.length}</div>
              <div className={styles.statLabel}>distinct cards tracked</div>
            </div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelBody}>
              <div className={styles.stat}>{totalCopies}</div>
              <div className={styles.statLabel}>total copies</div>
            </div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelBody}>
              <div className={styles.stack}>
                <strong className={styles.cardName}>Paste a list</strong>
                <span className={styles.muted}>
                  MTGO, Arena, Moxfield, Archidekt, Goldfish.
                </span>
                <Link
                  href="/loan/collection/paste"
                  className={`${styles.btn} ${styles.btnSm} ${styles.selfStart}`}
                >
                  Paste
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelBody}>
            <p className={styles.note}>
              Cataloguing 3,000 cards is how these tools die. Pick a real
              tournament list below, walk your box, tick what you have —
              anything you do not tick counts as zero and is never asked about
              again.
            </p>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Recent {FORMAT} lists</h2>
            <span className={styles.muted}>
              last {WINDOW_DAYS} days · tournament finishes only
            </span>
          </div>
          {decksResult.error ? (
            <div className={styles.panelBody}>
              <QueryError what="reference decks" error={decksResult.error} />
            </div>
          ) : decksResult.data.length === 0 ? (
            <div className={styles.panelBody}>
              <Empty>
                No decks ingested in this window yet. Run the backfill.
              </Empty>
            </div>
          ) : (
            <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
              {decksResult.data.map((deck) => (
                <li key={deck.deck_id} className={styles.listRow}>
                  <span className={styles.grow}>
                    <Link
                      href={`/loan/collection/deck/${deck.deck_id}`}
                      className={styles.cardName}
                      style={{ textDecoration: "none" }}
                    >
                      {deck.archetype_name ?? deck.player}
                    </Link>
                    <div className={styles.muted}>
                      {deck.player} · {deck.event_name} · {deck.event_date}
                    </div>
                  </span>
                  <span className={styles.badge}>{deck.rank}th</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
