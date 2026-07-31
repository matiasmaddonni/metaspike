"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../loan.module.css";
import { createClient } from "@/lib/supabase/browser";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/loan";
  const linkError = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(linkError);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className={styles.panel} style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className={styles.panelHead}>
        <h1 className={styles.panelTitle}>Sign in to metaloan</h1>
      </div>
      <div className={styles.panelBody}>
        {status === "sent" ? (
          <div className={styles.stack}>
            <p className={styles.cardName}>Check your email.</p>
            <p className={styles.muted}>
              A sign-in link is on its way to {email}. It opens this app
              directly — no password.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className={styles.stack}>
            <p className={styles.muted}>
              Your cards are only ever visible inside your crew, so metaloan
              needs to know who you are.
            </p>
            <input
              className={styles.textarea}
              style={{ minHeight: 0, height: 38 }}
              type="email"
              required
              value={email}
              placeholder="you@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.selfStart}`}
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send me a link"}
            </button>
            {message && (
              <span className={`${styles.badge} ${styles.badgeWarn} ${styles.selfStart}`}>
                {message}
              </span>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
