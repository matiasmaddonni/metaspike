import type { Metadata } from "next";
import { Nav } from "./_components/Nav";
import { createClient } from "@/lib/supabase/server";
import { getMyCrew } from "@/lib/loan/queries";
import styles from "./loan.module.css";

export const metadata: Metadata = {
  title: "metaloan",
  description:
    "Who in your crew can lend you the cards you're missing, for the event you're actually playing",
};

export const dynamic = "force-dynamic";

export default async function LoanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: crew } = await getMyCrew(supabase);

  return (
    <div className={styles.shell}>
      <Nav crewName={crew?.name ?? null} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
