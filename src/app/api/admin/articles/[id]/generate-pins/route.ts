import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generatePinImage, generatePinImageSimple } from "@/lib/services/canva";
import { put } from "@vercel/blob";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!article.heroImageUrl) {
    return NextResponse.json(
      { error: "No hero image — cannot generate pins" },
      { status: 400 }
    );
  }

  const pinParams = {
    title: article.title || "Delicious Recipe",
    heroImageUrl: article.heroImageUrl,
  };

  // Generate both pin designs in parallel
  const [pngBuffer1, pngBuffer2] = await Promise.all([
    generatePinImage(pinParams),
    generatePinImageSimple(pinParams),
  ]);

  // Upload both to Vercel Blob in parallel
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
    .where(eq(articles.id, id));

  return NextResponse.json({
    success: true,
    pinImageUrl: blob1.url,
    pinImageUrl2: blob2.url,
  });
}
