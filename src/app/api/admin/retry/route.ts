import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, keywords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ArticleStatus, KeywordStatus, PIPELINE_DEFAULTS } from "@/lib/constants";

export async function POST(request: Request) {
  const body = (await request.json()) as { type: "article" | "keyword"; id: string };

  if (!body.type || !body.id) {
    return NextResponse.json(
      { error: "type and id are required" },
      { status: 400 }
    );
  }

  if (body.type === "article") {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, body.id))
      .limit(1);

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Only allow retry for failed or stuck states
    const retryableStatuses: string[] = [
      ArticleStatus.FAILED,
      ArticleStatus.CONTENT_GENERATING,
      ArticleStatus.IMAGE_GENERATING,
      ArticleStatus.PIN_GENERATING,
      ArticleStatus.PUBLISHING,
    ];
    if (!retryableStatuses.includes(article.status)) {
      return NextResponse.json(
        { error: "Article is not in a retryable state" },
        { status: 400 }
      );
    }

    await db
      .update(articles)
      .set({
        status: ArticleStatus.DRAFT,
        retryCount: 0,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, body.id));

    return NextResponse.json({ success: true, reset: "draft" });
  }

  if (body.type === "keyword") {
    const [kw] = await db
      .select()
      .from(keywords)
      .where(
        and(
          eq(keywords.id, body.id),
          eq(keywords.status, KeywordStatus.FAILED)
        )
      )
      .limit(1);

    if (!kw) {
      return NextResponse.json(
        { error: "Keyword not found or not in failed state" },
        { status: 404 }
      );
    }

    await db
      .update(keywords)
      .set({
        status: KeywordStatus.NEW,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(keywords.id, body.id));

    return NextResponse.json({ success: true, reset: "new" });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
