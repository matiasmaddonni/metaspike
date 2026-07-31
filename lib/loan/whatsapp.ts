// WhatsApp export.
//
// The asking still happens on WhatsApp and always will. Trying to replace that
// with in-app chat is how these tools die. So the app's job ends at producing
// a message good enough to paste — who, what, how many, for which event.
//
// Per-lender messages matter more than the summary: you DM people one at a
// time, and a message that mentions everyone else's cards is noise to them.

import type { HandoffPlan, HandoffLender } from "../types/loan.js";

export type MessageLang = "en" | "es";

type EventContext = {
  eventName: string;
  eventDate: string;
  deckName?: string;
};

const COPY = {
  en: {
    forEvent: (e: string, d: string) => `${e} — ${d}`,
    playing: (deck: string) => `Playing: ${deck}`,
    askOpen: "Could you lend me:",
    onSite: "(you're going, so on site is fine)",
    bringTo: "Can I pick these up before then?",
    stillMissing: "Still missing, nobody has:",
    nothingNeeded: "Nothing missing — the deck is complete.",
    summaryHead: "Need to borrow:",
  },
  es: {
    forEvent: (e: string, d: string) => `${e} — ${d}`,
    playing: (deck: string) => `Juego: ${deck}`,
    askOpen: "¿Me podés prestar:",
    onSite: "(vas al evento, me las das ahí)",
    bringTo: "¿Las puedo pasar a buscar antes?",
    stillMissing: "Falta todavía, nadie tiene:",
    nothingNeeded: "No falta nada — el mazo está completo.",
    summaryHead: "Necesito pedir prestado:",
  },
} as const;

function cardLines(lender: HandoffLender): string {
  return lender.cards.map((c) => `• ${c.qty}x ${c.name}`).join("\n");
}

/** One message per lender — what you actually paste into a DM. */
export function lenderMessage(
  lender: HandoffLender,
  ctx: EventContext,
  lang: MessageLang = "en",
): string {
  const t = COPY[lang];
  const parts = [t.forEvent(ctx.eventName, ctx.eventDate)];
  if (ctx.deckName) parts.push(t.playing(ctx.deckName));
  parts.push("");
  parts.push(t.askOpen);
  parts.push(cardLines(lender));
  parts.push("");
  parts.push(lender.attending ? t.onSite : t.bringTo);
  return parts.join("\n");
}

/** Group-chat version — the whole plan in one block. */
export function planSummary(
  plan: HandoffPlan,
  ctx: EventContext,
  lang: MessageLang = "en",
): string {
  const t = COPY[lang];

  if (plan.lenders.length === 0 && plan.uncovered.length === 0) {
    return t.nothingNeeded;
  }

  const parts = [t.forEvent(ctx.eventName, ctx.eventDate)];
  if (ctx.deckName) parts.push(t.playing(ctx.deckName));
  parts.push("");
  parts.push(t.summaryHead);

  for (const lender of plan.lenders) {
    parts.push("");
    const marker = lender.attending ? " ✓" : "";
    parts.push(`${lender.display_name}${marker}`);
    parts.push(cardLines(lender));
  }

  if (plan.uncovered.length > 0) {
    parts.push("");
    parts.push(t.stillMissing);
    parts.push(
      plan.uncovered.map((u) => `• ${u.still_short}x ${u.name}`).join("\n"),
    );
  }

  return parts.join("\n");
}

/** wa.me deep link. Text must be encoded; phone is digits only, no +. */
export function whatsappLink(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text);
  return phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
