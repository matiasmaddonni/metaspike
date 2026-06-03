import "dotenv/config";
import { spawn } from "node:child_process";
import { createAdminClient } from "../lib/supabase/admin.js";
import { findTournamentEvents } from "../lib/mtgo/discover.js";

type Args = { format?: string; from?: string; to?: string };

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--format") out.format = argv[i + 1];
    else if (argv[i] === "--from") out.from = argv[i + 1];
    else if (argv[i] === "--to") out.to = argv[i + 1];
  }
  return out;
}

function extractEventId(slug: string): string | null {
  return slug.match(/\d{4}-\d{2}-\d{2}(\d+)$/)?.[1] ?? null;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
    );
    p.on("error", reject);
  });
}

const args = parseArgs(process.argv.slice(2));
if (!args.format || !args.from || !args.to) {
  console.error("usage: tsx scripts/backfill.ts --format <f> --from <YYYY-MM-DD> --to <YYYY-MM-DD>");
  process.exit(1);
}

const supa = createAdminClient();

console.log(`[discover] ${args.format} ${args.from} → ${args.to}`);
const events = await findTournamentEvents(args.format, args.from, args.to);
console.log(`[discover] ${events.length} tournament events found`);

const { data: existingEvents, error: existErr } = await supa
  .from("events")
  .select("mtgo_event_id");
if (existErr) throw new Error(`events select failed: ${existErr.message}`);
const existingIds = new Set(
  (existingEvents ?? []).map((r) => r.mtgo_event_id as string),
);

let ingested = 0;
let skipped = 0;
let failed = 0;
const failures: Array<{ slug: string; reason: string }> = [];

for (const ev of events) {
  const id = extractEventId(ev.slug);
  if (id && existingIds.has(id)) {
    console.log(`[skip] ${ev.slug} (already ingested)`);
    skipped++;
    continue;
  }

  console.log(`[ingest] ${ev.event_date}  ${ev.slug}`);
  try {
    await run("npx", [
      "tsx",
      "scripts/ingest-challenges.ts",
      "--url",
      ev.url,
    ]);
    ingested++;
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`  ✗ ${msg}`);
    failures.push({ slug: ev.slug, reason: msg });
    failed++;
  }
}

console.log(
  `[ingest] done — ingested=${ingested} skipped=${skipped} failed=${failed}`,
);

if (failures.length > 0) {
  console.log("[failures]");
  for (const f of failures) console.log(`  - ${f.slug}: ${f.reason}`);
}

if (ingested > 0) {
  console.log("[enrich] resolving new card names against Scryfall...");
  await run("npx", ["tsx", "scripts/enrich-scryfall.ts"]);
} else {
  console.log("[enrich] no new events ingested — skipping enrichment");
}

console.log("[classify] running classifier against current archetype rules...");
await run("npx", ["tsx", "scripts/classify-archetypes.ts"]);

console.log("[backfill] done");
