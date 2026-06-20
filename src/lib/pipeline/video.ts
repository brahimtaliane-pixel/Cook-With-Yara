import { db } from "@/lib/db";
import { articles, pinQueue, keywords } from "@/lib/db/schema";
import type { Article } from "@/lib/db/schema";
import {
  ArticleStatus,
  ConfigKeys,
  MediaType,
  PinType,
  VideoStatus,
  VIDEO_DEFAULTS,
} from "@/lib/constants";
import { getConfigValue, shouldRetry } from "@/lib/pipeline/base";
import { startRecipeVideo, pollRecipeVideo } from "@/lib/services/video-generator";
import { getCanonicalUrl } from "@/lib/utils/seo";
import { extractRecipeMeta } from "@/lib/utils/recipe-meta";
import { generatePinterestCopy } from "@/lib/services/pinterest-copy";
import { getBoardForArticle } from "@/lib/services/pinterest-boards";
import { getNextPostingSlot } from "@/lib/pipeline/schedule";
import { put } from "@vercel/blob";
import { eq, and, sql, gte } from "drizzle-orm";

const RESUME_BATCH = 5;

/**
 * One step of the video-reel pipeline. Runs on its own cron, decoupled from the
 * article state machine:
 *   1. Resume in-flight Veo operations — when done, store the MP4 and enqueue a
 *      video pin.
 *   2. Start new generations on PUBLISHED articles, up to the daily cost cap.
 *
 * Never blocks: each Veo op is a single non-blocking poll, and starting a
 * generation returns immediately with an operation name.
 */
export async function runVideoStep(): Promise<{ processed: number }> {
  const enabled =
    (await getConfigValue(ConfigKeys.VIDEO_ENABLED, "false")) === "true";
  if (!enabled) {
    console.log("[video] Video reels disabled");
    return { processed: 0 };
  }

  let processed = 0;
  processed += await resumeGeneratingVideos();
  processed += await startNewVideos();
  return { processed };
}

// --- Phase 1: poll in-flight Veo operations -------------------------------

async function resumeGeneratingVideos(): Promise<number> {
  const generating = await db
    .select()
    .from(articles)
    .where(eq(articles.videoStatus, VideoStatus.GENERATING))
    .limit(RESUME_BATCH);

  let processed = 0;

  for (const article of generating) {
    if (!article.videoTaskId) {
      // Lost the operation handle — reset so it can be re-picked.
      await db
        .update(articles)
        .set({ videoStatus: VideoStatus.NONE, updatedAt: new Date() })
        .where(eq(articles.id, article.id));
      continue;
    }

    try {
      const result = await pollRecipeVideo(
        article.videoTaskId,
        article.videoKeyIndex ?? 0,
      );

      if (result.status === "processing") continue;

      if (result.status === "failed") {
        await markVideoFailure(article, result.error ?? "Veo generation failed");
        continue;
      }

      // Succeeded — persist the MP4 to Blob.
      const blob = await put(`recipes/${article.slug}/reel.mp4`, result.data!, {
        access: "public",
        contentType: result.mimeType ?? "video/mp4",
        allowOverwrite: true,
      });

      // Atomically flip GENERATING -> READY so a concurrent run can't double-enqueue.
      const [claimed] = await db
        .update(articles)
        .set({
          videoUrl: blob.url,
          videoStatus: VideoStatus.READY,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(articles.id, article.id),
            eq(articles.videoStatus, VideoStatus.GENERATING),
          ),
        )
        .returning();

      if (!claimed) continue; // another run already handled it

      await enqueueVideoPin(claimed, blob.url);
      processed++;
      console.log(`[video] Reel ready + queued for "${article.title}"`);
    } catch (err) {
      console.error(`[video] Poll failed for ${article.slug}:`, err);
    }
  }

  return processed;
}

// --- Phase 2: start new generations up to the daily cap -------------------

async function startNewVideos(): Promise<number> {
  const maxPerDay = parseInt(
    await getConfigValue(
      ConfigKeys.MAX_VIDEO_GENERATIONS_PER_DAY,
      String(VIDEO_DEFAULTS.MAX_GENERATIONS_PER_DAY),
    ),
    10,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: startedToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(gte(articles.videoStartedAt, todayStart));

  if (startedToday >= maxPerDay) {
    console.log(`[video] Daily generation cap reached (${startedToday}/${maxPerDay})`);
    return 0;
  }

  // Claim one eligible article: published, no reel yet, and a pin image (the
  // required video-pin cover). The reel is text-to-video from the recipe steps,
  // so a hero seed image is not needed. Newest first.
  const [article] = await db
    .update(articles)
    .set({
      videoStatus: VideoStatus.GENERATING,
      videoStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(articles.status, ArticleStatus.PUBLISHED),
        eq(articles.videoStatus, VideoStatus.NONE),
        sql`${articles.pinImageUrl} IS NOT NULL`,
        sql`${articles.id} = (
          SELECT ${articles.id} FROM ${articles}
          WHERE ${articles.status} = ${ArticleStatus.PUBLISHED}
          AND ${articles.videoStatus} = ${VideoStatus.NONE}
          AND ${articles.pinImageUrl} IS NOT NULL
          ORDER BY ${articles.publishedAt} DESC NULLS LAST
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )`,
      ),
    )
    .returning();

  if (!article) return 0;

  try {
    // The provider (and its model) is resolved inside startRecipeVideo from the
    // VIDEO_PROVIDER config.
    const meta = extractRecipeMeta(
      article.recipeJsonLd as Record<string, unknown> | null,
    );
    const { operationName, keyIndex } = await startRecipeVideo({
      title: article.title || "this recipe",
      steps: extractRecipeSteps(article.recipeJsonLd),
      ingredients: meta.topIngredients,
    });

    await db
      .update(articles)
      .set({
        videoTaskId: operationName,
        videoKeyIndex: keyIndex,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));

    console.log(`[video] Started Veo reel for "${article.title}"`);
    return 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // A failed *start* shouldn't burn the daily budget — clear videoStartedAt
    // so the cap reflects only generations actually in flight.
    const newRetry = article.videoRetryCount + 1;
    await db
      .update(articles)
      .set({
        videoStatus: shouldRetry(newRetry)
          ? VideoStatus.NONE
          : VideoStatus.FAILED,
        videoRetryCount: newRetry,
        videoStartedAt: null,
        videoTaskId: null,
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, article.id));
    console.error(`[video] Failed to start reel for ${article.slug}:`, message);
    return 0;
  }
}

// --- Helpers --------------------------------------------------------------

/**
 * Pull ordered step labels from schema.org Recipe JSON-LD. recipeInstructions
 * is an array of HowToStep objects ({ name, text }) or plain strings; prefer the
 * short `name` for a snappy guide montage, falling back to `text`.
 */
function extractRecipeSteps(recipeJsonLd: unknown): string[] {
  const ld = recipeJsonLd as Record<string, unknown> | null | undefined;
  const raw = ld?.recipeInstructions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (typeof s === "string") return s;
      const step = s as Record<string, unknown>;
      return (step.name as string) || (step.text as string) || "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

async function markVideoFailure(article: Article, reason: string): Promise<void> {
  const newRetry = article.videoRetryCount + 1;
  await db
    .update(articles)
    .set({
      // Re-pick (NONE) until retries exhausted, then give up (FAILED).
      videoStatus: shouldRetry(newRetry) ? VideoStatus.NONE : VideoStatus.FAILED,
      videoRetryCount: newRetry,
      videoTaskId: null,
      videoStartedAt: null,
      failureReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, article.id));
  console.warn(`[video] Generation failed for ${article.slug}: ${reason}`);
}

/** Queue a single video pin for the article, reusing the pin image as cover. */
async function enqueueVideoPin(article: Article, videoUrl: string): Promise<void> {
  // Idempotency: never queue more than one video pin per article.
  const existing = await db
    .select({ id: pinQueue.id })
    .from(pinQueue)
    .where(
      and(eq(pinQueue.articleId, article.id), eq(pinQueue.mediaType, MediaType.VIDEO)),
    )
    .limit(1);
  if (existing.length > 0) return;

  if (!article.pinImageUrl) {
    console.warn(`[video] No pin image (cover) for ${article.slug} — skip queue`);
    return;
  }

  const canonicalUrl = article.publishedUrl || getCanonicalUrl(article.slug);
  const recipeJsonLd = article.recipeJsonLd as Record<string, unknown> | null;
  const meta = extractRecipeMeta(recipeJsonLd);

  let keywordText = "";
  if (article.keywordId) {
    const [kw] = await db
      .select({ keyword: keywords.keyword })
      .from(keywords)
      .where(eq(keywords.id, article.keywordId))
      .limit(1);
    keywordText = kw?.keyword ?? "";
  }

  let pinTitle = article.title || "Delicious Recipe";
  let pinDescription = article.metaDescription || "";
  let altText: string | undefined;
  try {
    const copy = await generatePinterestCopy({
      title: article.title || "",
      metaDescription: article.metaDescription || "",
      keyword: keywordText,
      recipeCategory: meta.recipeCategory,
      topIngredients: meta.topIngredients,
    });
    pinTitle = copy.pinterestTitle;
    pinDescription = copy.pinterestDescription;
    altText = copy.altText;
  } catch (err) {
    console.error("[video] Pinterest copy generation failed, using defaults:", err);
  }

  const boardId = await getBoardForArticle(article.title, meta.recipeCategory);
  const slot = await getNextPostingSlot();

  await db.insert(pinQueue).values({
    articleId: article.id,
    mediaType: MediaType.VIDEO,
    videoUrl,
    coverImageUrl: article.pinImageUrl,
    imageUrl: article.pinImageUrl, // imageUrl is NOT NULL; reuse the cover
    pinDesign: 7,
    pinType: PinType.VIDEO,
    title: pinTitle,
    description: pinDescription,
    link: canonicalUrl,
    boardId,
    altText,
    scheduledAt: slot,
  });
}
