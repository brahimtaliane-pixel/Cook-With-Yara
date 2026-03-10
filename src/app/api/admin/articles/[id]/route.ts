import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [row] = await db
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

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [article] = await db
    .select({ id: articles.id, keywordId: articles.keywordId })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(articles).where(eq(articles.id, id));

  // Reset keyword back to approved so it can be reprocessed
  await db
    .update(keywords)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(keywords.id, article.keywordId));

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowedFields = ["title", "metaDescription"] as const;
  const updates: Record<string, string> = {};

  for (const field of allowedFields) {
    if (field in body && typeof body[field] === "string") {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(articles)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(articles.id, id))
    .returning({ id: articles.id });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
