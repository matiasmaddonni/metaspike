import styles from "../loan.module.css";
import { QueryError, Empty } from "../_components/States";
import { JoinForm } from "../_components/JoinForm";
import { createClient } from "@/lib/supabase/server";
import { getCrewMembers, getCurrentUser, getMyCrew } from "@/lib/loan/queries";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const supabase = await createClient();
  const { email } = await getCurrentUser(supabase);
  const crewResult = await getMyCrew(supabase);

  if (crewResult.error) {
    return <QueryError what="your crew" error={crewResult.error} />;
  }

  const crew = crewResult.data;
  const membersResult = crew
    ? await getCrewMembers(supabase, crew.id)
    : { data: [], error: null };

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.h1}>Crew</h1>
        <p className={styles.sub}>
          Cards are only ever visible inside your crew
          {email ? ` · signed in as ${email}` : ""}
        </p>
      </div>

      <div className={styles.grid2}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{crew?.name ?? "No crew yet"}</h2>
            {crew && <span className={styles.badge}>{crew.visibility}</span>}
          </div>
          {!crew ? (
            <div className={styles.panelBody}>
              <Empty>
                Join one with an invite code, or create your own.
              </Empty>
            </div>
          ) : (
            <>
              <ul className={styles.list}>
                {membersResult.data.map((m) => (
                  <li key={m.user_id} className={styles.listRow}>
                    <span className={styles.grow}>
                      <span className={styles.cardName}>{m.display_name}</span>
                    </span>
                    {m.role === "owner" && (
                      <span className={styles.badge}>owner</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className={styles.panelBody}>
                <div className={styles.spread}>
                  <span className={styles.muted}>Invite code</span>
                  <code className="mono">{crew.invite_code}</code>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>
              {crew ? "Join another crew" : "Join a crew"}
            </h2>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.stack}>
              <JoinForm />
              <p className={styles.note}>
                Visibility is a crew setting. <strong>Open</strong> shows
                everyone what everyone owns — right for close friends.{" "}
                <strong>Query-only</strong>{" "}
                answers &ldquo;who has this card&rdquo; without letting anyone
                browse a full collection — right once the crew is the whole
                store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
