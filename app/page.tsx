import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Archetype = { id: number; format: string; name: string; slug: string | null };

export default async function Home() {
  const supabase = await createClient();
  const { data: archetypes, error } = await supabase
    .from("archetype")
    .select("id, format, name, slug")
    .order("format")
    .order("name");

  return (
    <main style={{ padding: 40, maxWidth: 1280, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <svg width={30} height={22} viewBox="0 0 30 22" aria-hidden>
          <path
            d="M1 15 H8 L12 15 L15.5 3 L19 13 L21.5 9 H29"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="mono"
          style={{ fontSize: 17, fontWeight: 600, letterSpacing: "0.5px", color: "var(--ink)" }}
        >
          metaspike
        </span>
      </header>

      <section style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>
          Backend ready
        </h1>
        <p style={{ color: "var(--dim)", marginTop: 8, maxWidth: 640, lineHeight: 1.55 }}>
          All four RPCs are live (<code>archetype_card_stats</code>, <code>archetype_winrate</code>,
          <code> list_decks</code>, <code>compare_decks</code>). The landing view ships next — wiring
          this to the Card-spread layout from the design handoff.
        </p>

        <h2
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--dim)",
            marginTop: 32,
            marginBottom: 12,
          }}
        >
          Archetypes seeded
        </h2>

        {error ? (
          <p style={{ color: "var(--accent)" }}>error: {error.message}</p>
        ) : (archetypes ?? []).length === 0 ? (
          <p style={{ color: "var(--dim)" }}>
            None yet. Insert into <code>public.archetype</code> + <code>archetype_match_rule</code>{" "}
            then run <code>npm run classify</code>.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(archetypes as Archetype[]).map((a) => (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--row-divider)",
                }}
              >
                <span className="mono" style={{ color: "var(--dim)", minWidth: 80 }}>
                  {a.format}
                </span>
                <span style={{ color: "var(--ink)" }}>{a.name}</span>
                {a.slug && (
                  <span className="mono" style={{ color: "var(--dim)", marginLeft: "auto" }}>
                    /{a.slug}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
