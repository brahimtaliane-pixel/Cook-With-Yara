import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles, pinQueue, keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getBoardForArticle } from "@/lib/services/pinterest-boards";
import { getNextPostingSlot } from "@/lib/pipeline/schedule";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { generatePinterestCopy } from "@/lib/services/pinterest-copy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (!article.pinImageUrl && !article.pinImageUrl2) {
    return NextResponse.json(
      { error: "No pin image available" },
      { status: 400 },
    );
  }

  const link = article.publishedUrl || getCanonicalUrl(article.slug);
  const recipeJsonLd = article.recipeJsonLd as Record<string, unknown> | null;
  const recipeCategory = (recipeJsonLd?.recipeCategory as string) ?? "";
  const topIngredients = Array.isArray(recipeJsonLd?.recipeIngredient)
    ? (recipeJsonLd.recipeIngredient as string[]).slice(0, 6)
    : [];
  const boardId = await getBoardForArticle(article.title || article.slug, recipeCategory);

  // Look up keyword
  let keywordText = "";
  if (article.keywordId) {
    const [kw] = await db
      .select({ keyword: keywords.keyword })
      .from(keywords)
      .where(eq(keywords.id, article.keywordId))
      .limit(1);
    keywordText = kw?.keyword ?? "";
  }

  // Generate Pinterest-optimized copy
  let pinTitle = article.title || article.slug;
  let pinDescription = article.metaDescription || "";
  let altText: string | undefined;

  try {
    const copy = await generatePinterestCopy({
      title: article.title || "",
      metaDescription: article.metaDescription || "",
      keyword: keywordText,
      recipeCategory,
      topIngredients,
    });
    pinTitle = copy.pinterestTitle;
    pinDescription = copy.pinterestDescription;
    altText = copy.altText;
  } catch (err) {
    console.error("[post-pin] Pinterest copy generation failed, using SEO defaults:", err);
  }

  try {
    const slot1 = await getNextPostingSlot();
    let queued = 0;

    if (article.pinImageUrl) {
      await db.insert(pinQueue).values({
        articleId: article.id,
        imageUrl: article.pinImageUrl,
        pinDesign: 1,
        title: pinTitle,
        description: pinDescription,
        link,
        boardId,
        altText,
        pinType: "original",
        scheduledAt: slot1,
      });
      queued++;
    }

    if (article.pinImageUrl2) {
      const slot2 = await getNextPostingSlot({ afterSlot: slot1 });
      await db.insert(pinQueue).values({
        articleId: article.id,
        imageUrl: article.pinImageUrl2,
        pinDesign: 2,
        title: pinTitle,
        description: pinDescription,
        link,
        boardId,
        altText,
        pinType: "original",
        scheduledAt: slot2,
      });
      queued++;
    }

    return NextResponse.json({
      success: true,
      queued,
      scheduledAt: slot1.toISOString(),
    });
  } catch (error) {
    console.error("Failed to queue pin:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue pin" },
      { status: 500 },
    );
  }
}
