import { db } from "@/lib/db";
import { articles, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArticleStatus } from "@/lib/constants";
import { RecipeContent } from "@/components/recipe-content";
import { ArticleActions } from "./article-actions";
import { ArticleTabs } from "./article-tabs";

export const dynamic = "force-dynamic";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
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

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [article] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      metaDescription: articles.metaDescription,
      contentMdx: articles.contentMdx,
      recipeJsonLd: articles.recipeJsonLd,
      status: articles.status,
      retryCount: articles.retryCount,
      failureReason: articles.failureReason,
      heroImageUrl: articles.heroImageUrl,
      midjourneyTaskId: articles.midjourneyTaskId,
      midjourneyPrompt: articles.midjourneyPrompt,
      pinImageUrl: articles.pinImageUrl,
      pinImageUrl2: articles.pinImageUrl2,
      pinterestPinId: articles.pinterestPinId,
      publishedUrl: articles.publishedUrl,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      keywordId: articles.keywordId,
      keyword: keywords.keyword,
    })
    .from(articles)
    .leftJoin(keywords, eq(articles.keywordId, keywords.id))
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipe = article.recipeJsonLd as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/admin/articles"
              className="hover:text-foreground transition-colors"
            >
              Articles
            </Link>
            <span>/</span>
            <span className="truncate">{article.slug}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {article.title || article.slug}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={statusVariant[article.status] ?? "outline"}>
              {article.status}
            </Badge>
            {article.keyword && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs">
                {article.keyword}
              </span>
            )}
            <span>
              Created {new Date(article.createdAt).toLocaleDateString()}
            </span>
            {article.publishedAt && (
              <span>
                Published{" "}
                {new Date(article.publishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <ArticleActions article={article} />
      </div>

      {/* Tabs */}
      <ArticleTabs
        article={article}
        recipe={recipe}
        contentMdx={article.contentMdx}
      />
    </div>
  );
}
