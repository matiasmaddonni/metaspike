"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../loan.module.css";
import { createClient } from "@/lib/supabase/browser";

type Mode = "join" | "create";

/**
 * Both paths go through an RPC, never a direct insert.
 *
 * join_crew: the invite code is the credential, and an RLS policy cannot check
 * a secret the caller supplies without also letting them enumerate crews.
 *
 * create_crew: authenticated has no INSERT grant on crew, because a crew and
 * its creator's membership must appear together — a crew without that row is
 * one nobody can read, including the person who made it.
 *
 * Both return null rather than raising when they decline (bad code, or no
 * session), so a null result is the failure branch.
 */
export function JoinForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("join");
  const [code, setCode] = useState("");
  const [crewName, setCrewName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } =
      mode === "join"
        ? await supabase.rpc("join_crew", {
            p_invite_code: code.trim(),
            p_display_name: displayName.trim(),
          })
        : await supabase.rpc("create_crew", {
            p_name: crewName.trim(),
            p_invite_code: code.trim(),
            p_display_name: displayName.trim(),
          });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!data) {
      setError(
        mode === "join"
          ? "No crew has that invite code."
          : "Could not create the crew — that invite code may already be taken.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <div className={styles.row}>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`${styles.btn} ${styles.btnSm} ${mode === "join" ? styles.btnPrimary : ""}`}
        >
          Join with a code
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`${styles.btn} ${styles.btnSm} ${mode === "create" ? styles.btnPrimary : ""}`}
        >
          Create a crew
        </button>
      </div>

      {mode === "create" && (
        <input
          className={styles.textarea}
          style={{ minHeight: 0, height: 38 }}
          placeholder="Crew name"
          required
          value={crewName}
          onChange={(e) => setCrewName(e.target.value)}
        />
      )}

      <input
        className={styles.textarea}
        style={{ minHeight: 0, height: 38 }}
        placeholder={mode === "join" ? "Invite code" : "Invite code to share"}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <input
        className={styles.textarea}
        style={{ minHeight: 0, height: 38 }}
        placeholder="Your name in the crew"
        required
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy}
        className={`${styles.btn} ${styles.btnPrimary} ${styles.selfStart}`}
      >
        {busy
          ? mode === "join"
            ? "Joining…"
            : "Creating…"
          : mode === "join"
            ? "Join"
            : "Create"}
      </button>
      {error && (
        <span
          className={`${styles.badge} ${styles.badgeWarn} ${styles.selfStart}`}
        >
          {error}
        </span>
      )}
    </form>
  );
}
