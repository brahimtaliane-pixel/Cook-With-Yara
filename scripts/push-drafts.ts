import "dotenv/config";
import { db } from "@/lib/db";
import { articles, keywords } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ArticleStatus, KeywordStatus } from "@/lib/constants";
import { generateArticleContent } from "@/lib/services/ai-writer";
import { submitImagineJob, checkImagineJob } from "@/lib/services/imagineapi";
import { generatePinImage, generatePinImageSimple } from "@/lib/services/canva";
import { createPin } from "@/lib/services/pinterest";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { put } from "@vercel/blob";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pushArticle(article: {
  id: string;
  slug: string;
  status: string;
  keywordId: string;
  title: string | null;
  midjourneyPrompt: string | null;
  midjourneyTaskId: string | null;
  heroImageUrl: string | null;
  pinImageUrl: string | null;
  pinImageUrl2: string | null;
}) {
  console.log(`\n=== Processing: ${article.slug} (status: ${article.status}) ===`);

  let { status } = article;

  // Stage: draft → content_ready
  if (status === "draft" || status === "content_generating") {
    console.log("  → Generating content via Claude...");
    const [kw] = await db
      .select()
      .from(keywords)
      .where(eq(keywords.id, article.keywordId))
      .limit(1);

    if (!kw) {
      console.error("  ✗ Keyword not found, skipping");
      return;
    }

    const content = await generateArticleContent(kw.keyword);

    const sanitizedPrompt = content.midjourneyPrompt
      .replace(/\bbreast(s)?\b/gi, "fillet$1")
      .replace(/\bthigh(s)?\b/gi, "piece$1")
      .replace(/\bnaked\b/gi, "plain")
      .replace(/\bbare\b/gi, "simple");

    await db
      .update(articles)
      .set({
        title: content.title,
        metaDescription: content.metaDescription,
        contentMdx: content.contentMdx,
        recipeJsonLd: content.recipeJsonLd,
        midjourneyPrompt: sanitizedPrompt,
        status: ArticleStatus.CONTENT_READY,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    await db
      .update(keywords)
      .set({ status: KeywordStatus.COMPLETED, updatedAt: new Date() })
      .where(eq(keywords.id, kw.id));

    article.title = content.title;
    article.midjourneyPrompt = sanitizedPrompt;
    status = ArticleStatus.CONTENT_READY;
    console.log(`  ✓ Content ready: "${content.title}"`);
  }

  // Stage: content_ready → image_ready
  if (status === "content_ready" || status === "image_generating") {
    const prompt = article.midjourneyPrompt;
    if (!prompt) {
      console.error("  ✗ No Midjourney prompt, skipping");
      return;
    }

    let taskId = article.midjourneyTaskId;

    if (status === "content_ready") {
      console.log("  → Submitting Midjourney job...");
      taskId = await submitImagineJob(prompt);

      await db
        .update(articles)
        .set({
          midjourneyTaskId: taskId,
          status: ArticleStatus.IMAGE_GENERATING,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));

      console.log(`  ✓ Submitted: ${taskId}`);
    }

    if (!taskId) {
      console.error("  ✗ No task ID, skipping");
      return;
    }

    // Poll
    console.log("  → Polling for image...");
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const result = await checkImagineJob(taskId);
      process.stdout.write(`    poll ${i + 1}: ${result.status}\r`);

      if (result.status === "completed" && result.result) {
        console.log(`\n  ✓ Image completed`);
        const imageResponse = await fetch(result.result);
        if (!imageResponse.ok) throw new Error(`Download failed: ${imageResponse.status}`);
        const imageBlob = await imageResponse.blob();
        const { url } = await put(`recipes/${article.slug}/hero.jpg`, imageBlob, {
          access: "public",
        });

        await db
          .update(articles)
          .set({
            heroImageUrl: url,
            status: ArticleStatus.IMAGE_READY,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, article.id));

        article.heroImageUrl = url;
        status = ArticleStatus.IMAGE_READY;
        break;
      } else if (result.status === "failed") {
        console.error("\n  ✗ Image generation failed");
        return;
      }
    }

    if (status !== ArticleStatus.IMAGE_READY) {
      console.error("  ✗ Image generation timed out");
      return;
    }
  }

  // Stage: image_ready → pin_ready
  if (status === "image_ready" || status === "pin_generating") {
    console.log("  → Generating pin images...");
    if (!article.heroImageUrl) {
      console.error("  ✗ No hero image URL");
      return;
    }

    await db
      .update(articles)
      .set({ status: ArticleStatus.PIN_GENERATING, updatedAt: new Date() })
      .where(eq(articles.id, article.id));

    const pinParams = {
      title: article.title || "Delicious Recipe",
      heroImageUrl: article.heroImageUrl,
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
        status: ArticleStatus.PIN_READY,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    article.pinImageUrl = blob1.url;
    status = ArticleStatus.PIN_READY;
    console.log("  ✓ Pin images ready");
  }

  // Stage: pin_ready → published
  if (status === "pin_ready" || status === "publishing") {
    console.log("  → Publishing...");

    await db
      .update(articles)
      .set({ status: ArticleStatus.PUBLISHING, updatedAt: new Date() })
      .where(eq(articles.id, article.id));

    const canonicalUrl = getCanonicalUrl(article.slug);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com";

    await fetch(`${siteUrl}/api/revalidate?slug=${article.slug}&secret=${process.env.CRON_SECRET}`);

    let pinterestPinId: string | null = null;
    const boardId = process.env.PINTEREST_BOARD_ID;

    if (boardId) {
      try {
        const pin = await createPin({
          boardId,
          title: article.title || "Delicious Recipe",
          description: "",
          imageUrl: article.pinImageUrl || article.heroImageUrl || "",
          link: canonicalUrl,
        });
        pinterestPinId = pin.id;
        console.log(`  ✓ Pinterest pin: ${pinterestPinId}`);
      } catch (e) {
        console.warn(`  ⚠ Pinterest pin failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    await db
      .update(articles)
      .set({
        pinterestPinId,
        publishedUrl: canonicalUrl,
        publishedAt: new Date(),
        status: ArticleStatus.PUBLISHED,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    console.log(`  ✓ Published: ${canonicalUrl}`);
  }
}

async function main() {
  const rows = await db
    .select()
    .from(articles)
    .where(
      inArray(articles.status, [
        "draft",
        "content_generating",
        "content_ready",
        "image_generating",
        "image_ready",
        "pin_generating",
        "pin_ready",
        "publishing",
      ])
    );

  console.log(`Found ${rows.length} stuck articles to push through pipeline\n`);

  for (const article of rows) {
    try {
      await pushArticle(article);
    } catch (error) {
      console.error(
        `  ✗ Failed: ${error instanceof Error ? error.message : error}`
      );
      // Mark as failed
      await db
        .update(articles)
        .set({
          status: ArticleStatus.FAILED,
          failureReason: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));
    }
  }

  console.log("\nDone!");
  process.exit(0);
}
main();
