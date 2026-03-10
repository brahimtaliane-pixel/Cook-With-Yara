"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArticleStatus } from "@/lib/constants";

const statuses = [
  { label: "All", value: "all" },
  ...Object.values(ArticleStatus).map((s) => ({
    label: s.replace(/_/g, " "),
    value: s,
  })),
];

export function StatusFilter({ currentStatus }: { currentStatus?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={currentStatus || "all"}
      onChange={(e) => {
        const val = e.target.value;
        const url = val === "all" ? pathname : `${pathname}?status=${val}`;
        router.push(url);
      }}
      className="h-8 rounded-md border bg-background px-2 text-sm capitalize"
    >
      {statuses.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
