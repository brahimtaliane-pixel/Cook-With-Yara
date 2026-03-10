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
import Link from "next/link";
import Image from "next/image";
import { ArticleRowActions } from "./article-row-actions";
import { StatusFilter } from "./status-filter";

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

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filterStatus } = await searchParams;

  let query = db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      retryCount: articles.retryCount,
      failureReason: articles.failureReason,
      heroImageUrl: articles.heroImageUrl,
      publishedUrl: articles.publishedUrl,
      createdAt: articles.createdAt,
      publishedAt: articles.publishedAt,
      keyword: keywords.keyword,
    })
    .from(articles)
    .leftJoin(keywords, eq(articles.keywordId, keywords.id))
    .orderBy(desc(articles.createdAt))
    .$dynamic();

  if (filterStatus && filterStatus !== "all") {
    query = query.where(eq(articles.status, filterStatus));
  }

  const allArticles = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Articles</h1>
        <StatusFilter currentStatus={filterStatus} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Title</TableHead>
            <TableHead>Keyword</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Retries</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {allArticles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No articles found.
              </TableCell>
            </TableRow>
          ) : (
            allArticles.map((a) => (
              <TableRow key={a.id} className="group">
                <TableCell>
                  {a.heroImageUrl ? (
                    <div className="relative size-10 overflow-hidden rounded-md border">
                      <Image
                        src={a.heroImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div className="size-10 rounded-md border bg-muted" />
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="block hover:underline"
                  >
                    <p className="font-medium">{a.title || a.slug}</p>
                    {a.failureReason && (
                      <p className="mt-1 text-xs text-destructive line-clamp-1">
                        {a.failureReason}
                      </p>
                    )}
                  </Link>
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
                <TableCell>
                  <ArticleRowActions article={a} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
