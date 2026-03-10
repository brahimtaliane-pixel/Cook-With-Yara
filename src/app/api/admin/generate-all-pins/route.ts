import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq, isNull, isNotNull, and } from "drizzle-orm";
import { generatePinImage, generatePinImageSimple } from "@/lib/services/canva";
import { put } from "@vercel/blob";

export const maxDuration = 300;

export async function POST() {
  // Find all articles with hero images but missing pin images
  const pending = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      heroImageUrl: articles.heroImageUrl,
    })
    .from(articles)
    .where(
      and(
        isNotNull(articles.heroImageUrl),
        isNull(articles.pinImageUrl)
      )
    );

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, message: "All articles already have pin images" });
  }

  const results: { slug: string; success: boolean; error?: string }[] = [];

  for (const article of pending) {
    try {
      const pinParams = {
        title: article.title || "Delicious Recipe",
        heroImageUrl: article.heroImageUrl!,
      };

      const [pngBuffer1, pngBuffer2] = await Promise.all([
        generatePinImage(pinParams),
        generatePinImageSimple(pinParams),
      ]);

      const [blob1, blob2] = await Promise.all([
        put(`recipes/${article.slug}/pin.png`, pngBuffer1, { access: "public" }),
        put(`recipes/${article.slug}/pin2.png`, pngBuffer2, { access: "public" }),
      ]);

      await db
        .update(articles)
        .set({
          pinImageUrl: blob1.url,
          pinImageUrl2: blob2.url,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));

      results.push({ slug: article.slug, success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      results.push({ slug: article.slug, success: false, error: msg });
    }
  }

  return NextResponse.json({
    processed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
