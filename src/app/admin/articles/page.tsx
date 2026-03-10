import { db } from "@/lib/db";
import { articles, keywords } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArticleStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  [ArticleStatus.DRAFT]: "outline",
  [ArticleStatus.CONTENT_GENERATING]: "secondary",
  [ArticleStatus.CONTENT_READY]: "secondary",
  [ArticleStatus.IMAGE_GENERATING]: "secondary",
  [ArticleStatus.IMAGE_READY]: "secondary",
  [ArticleStatus.PIN_GENERATING]: "secondary",
  [ArticleStatus.PIN_READY]: "secondary",
  [ArticleStatus.PUBLISHING]: "secondary",
  [ArticleStatus.PUBLISHED]: "default",
  [ArticleStatus.FAILED]: "destructive",
};

export default async function ArticlesPage() {
  const allArticles = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      retryCount: articles.retryCount,
      failureReason: articles.failureReason,
      createdAt: articles.createdAt,
      publishedAt: articles.publishedAt,
      keyword: keywords.keyword,
    })
    .from(articles)
    .leftJoin(keywords, eq(articles.keywordId, keywords.id))
    .orderBy(desc(articles.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Articles</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Keyword</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Retries</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allArticles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No articles yet.
              </TableCell>
            </TableRow>
          ) : (
            allArticles.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{a.title || a.slug}</p>
                    {a.failureReason && (
                      <p className="mt-1 text-xs text-destructive">
                        {a.failureReason}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {a.keyword ?? "---"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[a.status] ?? "outline"}>
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell>{a.retryCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
