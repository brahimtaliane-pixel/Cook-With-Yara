import { db } from "@/lib/db";
import { intelCompetitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { CompetitorAnalytics } from "./competitor-analytics";

export const dynamic = "force-dynamic";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [competitor] = await db
    .select()
    .from(intelCompetitors)
    .where(eq(intelCompetitors.id, id))
    .limit(1);

  if (!competitor) notFound();

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/admin/intel"
            className="transition-colors hover:text-foreground"
          >
            Intel
          </Link>
          <span>/</span>
          <Link
            href="/admin/intel"
            className="transition-colors hover:text-foreground"
          >
            Competitors
          </Link>
          <span>/</span>
          <span className="truncate">@{competitor.username}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                @{competitor.username}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{competitor.displayName}</span>
                <Badge
                  variant={competitor.isActive ? "default" : "outline"}
                >
                  {competitor.isActive ? "Active" : "Paused"}
                </Badge>
                <span>
                  Last fetched:{" "}
                  {competitor.lastFetchedAt
                    ? new Date(competitor.lastFetchedAt).toLocaleDateString()
                    : "Never"}
                </span>
                <span>
                  Added:{" "}
                  {new Date(competitor.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CompetitorAnalytics competitorId={competitor.id} />
    </div>
  );
}
