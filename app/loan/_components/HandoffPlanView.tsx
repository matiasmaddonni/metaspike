"use client";

import { useState } from "react";
import styles from "../loan.module.css";
import type { HandoffPlan } from "@/lib/types/loan";
import {
  lenderMessage,
  planSummary,
  whatsappLink,
  type MessageLang,
} from "@/lib/loan/whatsapp";

type Props = {
  plan: HandoffPlan;
  eventName: string;
  eventDate: string;
  deckName: string;
};

export function HandoffPlanView({
  plan,
  eventName,
  eventDate,
  deckName,
}: Props) {
  const [lang, setLang] = useState<MessageLang>("es");
  const [preview, setPreview] = useState<string | null>(null);

  const ctx = { eventName, eventDate, deckName };

  if (plan.lenders.length === 0 && plan.uncovered.length === 0) {
    return (
      <div className={styles.empty}>
        Nothing missing — the deck is complete.
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.note}>
        {plan.lender_count}{" "}
        {plan.lender_count === 1 ? "person covers" : "people cover"} it
        {plan.meetings === 0
          ? " — all of them are going to the event, so every card is handed over on site."
          : `, ${plan.meetings} of whom you have to meet beforehand. The rest are going anyway.`}
      </div>

      {plan.lenders.map((lender) => (
        <div key={lender.user_id} className={styles.lenderCard}>
          <div className={styles.lenderHead}>
            <span className={styles.lenderName}>{lender.display_name}</span>
            {lender.attending ? (
              <span className={`${styles.badge} ${styles.badgeOk}`}>
                at the event
              </span>
            ) : (
              <span className={styles.badge}>needs a meetup</span>
            )}
            <span className={styles.grow} />
            <span className={styles.muted}>{lender.total_qty} cards</span>
            <button
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() => setPreview(lenderMessage(lender, ctx, lang))}
            >
              Message
            </button>
          </div>
          <div className={styles.lenderCards}>
            {lender.cards.map((card) => (
              <div key={card.oracle_id} className={styles.lenderCardLine}>
                <span className="mono">{card.qty}x</span>
                <span>{card.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {plan.uncovered.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Nobody has these</h3>
            <span className={`${styles.badge} ${styles.badgeWarn}`}>
              {plan.uncovered.length}
            </span>
          </div>
          <ul className={`${styles.list} ${styles.panelBodyFlush}`}>
            {plan.uncovered.map((card) => (
              <li key={card.oracle_id} className={styles.listRow}>
                <span className={styles.grow}>
                  <span className={styles.cardName}>{card.name}</span>
                </span>
                <span className={styles.qty}>{card.still_short} short</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.spread}>
        <div className={styles.row}>
          <span className={styles.muted}>Message language</span>
          <button
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={() => setLang(lang === "es" ? "en" : "es")}
          >
            {lang === "es" ? "Español" : "English"}
          </button>
        </div>
        <div className={styles.row}>
          <button
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={() => setPreview(planSummary(plan, ctx, lang))}
          >
            Summary for the group chat
          </button>
          <a
            className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
            href={whatsappLink(planSummary(plan, ctx, lang))}
            target="_blank"
            rel="noreferrer"
          >
            Send to WhatsApp
          </a>
        </div>
      </div>

      {preview && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Message preview</h3>
            <button
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() => navigator.clipboard.writeText(preview)}
            >
              Copy
            </button>
          </div>
          <div className={styles.panelBody}>
            <pre className={styles.pre}>{preview}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
