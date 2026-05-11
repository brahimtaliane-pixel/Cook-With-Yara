import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { intelPins, keywords, articles, pinQueue } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateSlug } from "@/lib/utils/slug";
import { ArticleStatus, KeywordStatus } from "@/lib/constants";
import { generateArticleContent } from "@/lib/services/ai-writer";
import { generateHeroImage } from "@/lib/services/nano-banana";
import { generatePinImage, generatePinImageSimple } from "@/lib/services/canva";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { getBoardForArticle } from "@/lib/services/pinterest-boards";
import { getNextPostingSlot } from "@/lib/pipeline/schedule";
import { put } from "@vercel/blob";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as { pinId: string };

  if (!body.pinId) {
    return NextResponse.json(
      { error: "pinId is required" },
      { status: 400 }
    );
  }

  // 1. Read pin from intelPins
  const [pin] = await db
    .select()
    .from(intelPins)
    .where(eq(intelPins.id, body.pinId))
    .limit(1);

  if (!pin) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  if (pin.sentToPipeline) {
    return NextResponse.json(
      { error: "Pin already sent to pipeline" },
      { status: 409 }
    );
  }

  // 2. Use pin title as keyword
  const keyword = pin.title;
  const slug = generateSlug(keyword);

  const [existingArticle] = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      publishedUrl: articles.publishedUrl,
    })
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (existingArticle) {
    const title = existingArticle.title || slug;
    const url = existingArticle.publishedUrl || `/admin/articles/${existingArticle.id}`;
    return NextResponse.json(
      {
        error: `Already written: "${title}"`,
        existingArticle: {
          id: existingArticle.id,
          title,
          status: existingArticle.status,
          url,
        },
      },
      { status: 409 }
    );
  }

  // Stream progress updates to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        // --- Stage 1: Create keyword + article ---
        sendEvent({ stage: "creating", message: "Creating article..." });

        const [newKeyword] = await db
          .insert(keywords)
          .values({
            keyword,
            status: "approved",
            trendType: "intel",
            pinterestTrendScore: pin.velocity,
          })
          .returning({ id: keywords.id });

        const [newArticle] = await db
          .insert(articles)
          .values({
            keywordId: newKeyword.id,
            slug,
            status: ArticleStatus.CONTENT_GENERATING,
          })
          .returning();

        // Mark pin as sent
        await db
          .update(intelPins)
          .set({
            sentToPipeline: true,
            pipelineKeywordId: newKeyword.id,
            updatedAt: new Date(),
          })
          .where(eq(intelPins.id, body.pinId));

        // --- Stage 2: Generate content via Claude ---
        sendEvent({ stage: "content", message: "Writing article with AI..." });

        const content = await generateArticleContent(keyword);

        await db
          .update(articles)
          .set({
            title: content.title,
            metaDescription: content.metaDescription,
            contentMdx: content.contentMdx,
            recipeJsonLd: content.recipeJsonLd,
            midjourneyPrompt: content.midjourneyPrompt,
            status: ArticleStatus.CONTENT_READY,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, newArticle.id));

        await db
          .update(keywords)
          .set({ status: KeywordStatus.COMPLETED, updatedAt: new Date() })
          .where(eq(keywords.id, newKeyword.id));

        // --- Stage 3: Generate hero image via Nano Banana ---
        sendEvent({ stage: "image", message: "Generating hero image..." });

        await db
          .update(articles)
          .set({
            status: ArticleStatus.IMAGE_GENERATING,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, newArticle.id));

        const image = await generateHeroImage(content.midjourneyPrompt);
        const extension = image.mimeType === "image/jpeg" ? "jpg" : "png";
        const { url: heroImageUrl } = await put(
          `recipes/${slug}/hero.${extension}`,
          image.data,
          { access: "public", contentType: image.mimeType }
        );

        await db
          .update(articles)
          .set({
            heroImageUrl,
            status: ArticleStatus.IMAGE_READY,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, newArticle.id));

        sendEvent({ stage: "image_done", message: "Hero image ready!" });

        // --- Stage 4: Generate pin images ---
        sendEvent({ stage: "pins", message: "Creating pin designs..." });

        await db
          .update(articles)
          .set({ status: ArticleStatus.PIN_GENERATING, updatedAt: new Date() })
          .where(eq(articles.id, newArticle.id));

        const pinParams = {
          title: content.title,
          heroImageUrl,
        };

        const [pngBuffer1, pngBuffer2] = await Promise.all([
          generatePinImage(pinParams),
          generatePinImageSimple(pinParams),
        ]);

        const [blob1, blob2] = await Promise.all([
          put(`recipes/${slug}/pin.png`, pngBuffer1, { access: "public" }),
          put(`recipes/${slug}/pin2.png`, pngBuffer2, { access: "public" }),
        ]);

        await db
          .update(articles)
          .set({
            pinImageUrl: blob1.url,
            pinImageUrl2: blob2.url,
            status: ArticleStatus.PIN_READY,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, newArticle.id));

        // --- Stage 5: Publish ---
        sendEvent({ stage: "publishing", message: "Publishing article..." });

        await db
          .update(articles)
          .set({ status: ArticleStatus.PUBLISHING, updatedAt: new Date() })
          .where(eq(articles.id, newArticle.id));

        const canonicalUrl = getCanonicalUrl(slug);

        // Trigger ISR revalidation
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com";
        await fetch(
          `${siteUrl}/api/revalidate?slug=${slug}&secret=${process.env.CRON_SECRET}`
        );

        // Determine target Pinterest board
        const recipeCategory =
          (content.recipeJsonLd as Record<string, unknown> | null)?.recipeCategory as string | undefined;
        const boardId = await getBoardForArticle(content.title, recipeCategory);

        // Queue both pin designs for scheduled posting at optimal times
        const slot1 = await getNextPostingSlot();
        await db.insert(pinQueue).values({
          articleId: newArticle.id,
          imageUrl: blob1.url,
          pinDesign: 1,
          title: content.title,
          description: content.metaDescription,
          link: canonicalUrl,
          boardId,
          scheduledAt: slot1,
        });
        const slot2 = await getNextPostingSlot({ afterSlot: slot1 });
        await db.insert(pinQueue).values({
          articleId: newArticle.id,
          imageUrl: blob2.url,
          pinDesign: 2,
          title: content.title,
          description: content.metaDescription,
          link: canonicalUrl,
          boardId,
          scheduledAt: slot2,
        });

        await db
          .update(articles)
          .set({
            publishedUrl: canonicalUrl,
            publishedAt: new Date(),
            status: ArticleStatus.PUBLISHED,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, newArticle.id));

        // --- Done ---
        sendEvent({
          stage: "done",
          message: "Published!",
          articleId: newArticle.id,
          slug,
          url: canonicalUrl,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[send-to-pipeline] Pipeline failed:", error);
        sendEvent({ stage: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
