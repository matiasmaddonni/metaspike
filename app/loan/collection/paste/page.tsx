"use client";

import { useMemo, useState, useTransition } from "react";
import styles from "../../loan.module.css";
import { parseDecklist, totalCopies } from "@/lib/loan/parseDecklist";
import { saveHoldingsByName } from "../../_actions/holdings";

const PLACEHOLDER = `4 Ragavan, Nimble Pilferer
4 Solitude
3 Sacred Foundry (MH3) 220
1 Castle Ardenvale

2 Surgical Extraction
1 Wrath of God`;

export default function PastePage() {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);

  const parsed = useMemo(() => parseDecklist(text), [text]);
  const totals = useMemo(() => totalCopies(parsed), [parsed]);
  const copies = [...totals.values()].reduce((a, b) => a + b, 0);

  function save() {
    setStatus(null);
    setRejected([]);
    const entries = [...totals.entries()].map(([name, qty]) => ({ name, qty }));

    startTransition(async () => {
      const result = await saveHoldingsByName(entries);
      setRejected(result.unmatched);
      setStatus(
        result.ok
          ? `Saved ${result.matched} cards.` +
              (result.unmatched.length > 0
                ? ` ${result.unmatched.length} not recognised.`
                : "")
          : (result.error ?? "Save failed."),
      );
    });
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Paste a list</h1>
        <p className={styles.sub}>
          MTGO, Arena, Moxfield, Archidekt or Goldfish — all handled
        </p>
      </div>

      <div className={styles.grid2}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Your list</h2>
            {text.length > 0 && (
              <button
                className={`${styles.btn} ${styles.btnSm}`}
                onClick={() => setText("")}
              >
                Clear
              </button>
            )}
          </div>
          <div className={styles.panelBody}>
            <textarea
              className={styles.textarea}
              value={text}
              placeholder={PLACEHOLDER}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Parsed</h2>
            <span className={styles.muted}>
              {totals.size} cards · {copies} copies
            </span>
          </div>
          {totals.size === 0 ? (
            <div className={styles.panelBody}>
              <div className={styles.empty}>
                Paste a list and it resolves here.
              </div>
            </div>
          ) : (
            <>
              <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
                {[...totals.entries()]
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([name, qty]) => (
                    <li key={name} className={styles.listRow}>
                      <span className={styles.grow}>
                        <span className={styles.cardName}>{name}</span>
                      </span>
                      <span className={styles.qty}>{qty}</span>
                    </li>
                  ))}
              </ul>
              <div className={styles.panelBody}>
                <div className={styles.stack}>
                  <p className={styles.note}>
                    Main and sideboard are summed. The four-of rule applies
                    across the whole 75, so a card listed 3 main and 1 side is
                    four physical cards — which is what borrowing cares about.
                  </p>
                  {parsed.unparsed.length > 0 && (
                    <div className={styles.stack}>
                      <span className={`${styles.badge} ${styles.badgeWarn}`}>
                        {parsed.unparsed.length}{" "}
                        {parsed.unparsed.length === 1 ? "line" : "lines"} not
                        understood
                      </span>
                      <pre className={styles.pre}>
                        {parsed.unparsed.join("\n")}
                      </pre>
                    </div>
                  )}
                  {rejected.length > 0 && (
                    <div className={styles.stack}>
                      <span
                        className={`${styles.badge} ${styles.badgeWarn} ${styles.selfStart}`}
                      >
                        {rejected.length} not recognised
                      </span>
                      <pre className={styles.pre}>{rejected.join("\n")}</pre>
                    </div>
                  )}
                  {status && <span className={styles.muted}>{status}</span>}
                  <button
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.selfStart}`}
                    onClick={save}
                    disabled={pending}
                  >
                    {pending ? "Saving…" : `Save ${copies} copies to my cards`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
