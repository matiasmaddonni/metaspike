"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../loan.module.css";

const LINKS = [
  { href: "/loan", label: "Overview" },
  { href: "/loan/events", label: "Events" },
  { href: "/loan/collection", label: "My cards" },
  { href: "/loan/loans", label: "Loans" },
];

export function Nav({ crewName }: { crewName: string | null }) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/loan" className={styles.brand}>
          meta<em>loan</em>
        </Link>
        <div className={styles.navLinks}>
          {LINKS.map((link) => {
            const active =
              link.href === "/loan"
                ? pathname === "/loan"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <Link href="/loan/join" className={styles.crewChip}>
          {crewName ?? "No crew"}
        </Link>
      </div>
    </nav>
  );
}
