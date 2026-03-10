import { db } from "@/lib/db";
import { keywords } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KeywordStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  [KeywordStatus.NEW]: "outline",
  [KeywordStatus.APPROVED]: "default",
  [KeywordStatus.COMPLETED]: "secondary",
  [KeywordStatus.REJECTED]: "destructive",
  [KeywordStatus.FAILED]: "destructive",
};

export default async function KeywordsPage() {
  const allKeywords = await db
    .select()
    .from(keywords)
    .orderBy(desc(keywords.discoveredAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Keywords</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Trend Type</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Discovered</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allKeywords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No keywords yet.
              </TableCell>
            </TableRow>
          ) : (
            allKeywords.map((kw) => (
              <TableRow key={kw.id}>
                <TableCell className="font-medium">{kw.keyword}</TableCell>
                <TableCell>{kw.region}</TableCell>
                <TableCell>{kw.trendType}</TableCell>
                <TableCell>{kw.pinterestTrendScore}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[kw.status] ?? "outline"}>
                    {kw.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(kw.discoveredAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
