import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createPin, getPinterestBoardId } from "@/lib/services/pinterest";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch the article
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (article.pinterestPinId) {
    return NextResponse.json(
      { error: "Pin already posted", pinId: article.pinterestPinId },
      { status: 409 },
    );
  }

  const imageUrl = article.pinImageUrl || article.pinImageUrl2;
  if (!imageUrl) {
    return NextResponse.json(
      { error: "No pin image available" },
      { status: 400 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cookwithlucia.com";
  const link = article.publishedUrl || `${siteUrl}/recipes/${article.slug}`;

  try {
    const boardId = await getPinterestBoardId();

    const pin = await createPin({
      boardId,
      title: article.title || article.slug,
      description: article.metaDescription || "",
      imageUrl,
      link,
    });

    // Update article with pin ID
    await db
      .update(articles)
      .set({ pinterestPinId: pin.id, updatedAt: new Date() })
      .where(eq(articles.id, id));

    return NextResponse.json({ success: true, pinId: pin.id });
  } catch (error) {
    console.error("Failed to post pin:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post pin" },
      { status: 500 },
    );
  }
}
