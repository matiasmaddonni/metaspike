import type { Bucket, BucketedRow, CardStatsRow } from "./types/cardStats.js";

export function bucketOf(pct: number): Bucket {
  if (pct >= 0.85) return "core";
  if (pct >= 0.2) return "flex";
  return "tech";
}

export type BucketGroup = {
  bucket: Bucket;
  rule: string;
  desc: string;
  rows: BucketedRow[];
};

export function bucketize(rows: CardStatsRow[]): BucketGroup[] {
  const sorted = [...rows].sort((a, b) => b.inclusion_pct - a.inclusion_pct);
  const tagged: BucketedRow[] = sorted.map((r) => ({
    ...r,
    bucket: bucketOf(r.inclusion_pct),
  }));
  return [
    {
      bucket: "core",
      rule: "≥ 85%",
      desc: "the non-negotiable shell",
      rows: tagged.filter((r) => r.bucket === "core"),
    },
    {
      bucket: "flex",
      rule: "20–85%",
      desc: "where the deck is decided",
      rows: tagged.filter((r) => r.bucket === "flex"),
    },
    {
      bucket: "tech",
      rule: "< 20%",
      desc: "metagame calls & one-ofs",
      rows: tagged.filter((r) => r.bucket === "tech"),
    },
  ];
}
