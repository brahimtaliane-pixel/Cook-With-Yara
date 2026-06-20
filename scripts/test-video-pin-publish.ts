/**
 * End-to-end: publish ONE real video pin to Pinterest from a local reel.
 * Reuses an already-generated MP4 (no Veo charge). Exercises the real
 * pinterest.ts video flow: Blob upload -> register media -> upload -> poll
 * transcode -> create video pin.
 *
 *   npx tsx scripts/test-video-pin-publish.ts --file=salvaged-reel.mp4 [--slug=tzatziki-sauce]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile } from "fs/promises";
import { db } from "../src/lib/db";
import { articles } from "../src/lib/db/schema";
import { ArticleStatus } from "../src/lib/constants";
import { getCanonicalUrl } from "../src/lib/utils/seo";
import { getBoardForArticle } from "../src/lib/services/pinterest-boards";
import {
  registerVideoMedia,
  uploadVideoToMedia,
  getMediaStatus,
  createVideoPin,
} from "../src/lib/services/pinterest";
import { put } from "@vercel/blob";
import { and, desc, eq, isNotNull } from "drizzle-orm";

async function main() {
  const file =
    process.argv.find((a) => a.startsWith("--file="))?.split("=")[1] ??
    "salvaged-reel.mp4";
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

  const [article] = slug
    ? await db.select().from(articles).where(eq(articles.slug, slug)).limit(1)
    : await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, ArticleStatus.PUBLISHED),
            isNotNull(articles.heroImageUrl),
            isNotNull(articles.pinImageUrl),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(1);

  if (!article) throw new Error("No eligible article found");
  if (!article.pinImageUrl) throw new Error("Article has no pin image (cover)");

  console.log("─".repeat(60));
  console.log(`Recipe : ${article.title}`);
  console.log(`Cover  : ${article.pinImageUrl}`);
  console.log(`Reel   : ${file}`);
  console.log("─".repeat(60));

  const buffer = await readFile(file);

  // Mirror the pipeline: stash the reel in Blob first (gives a real videoUrl).
  const blob = await put(`recipes/${article.slug}/reel.mp4`, buffer, {
    access: "public",
    contentType: "video/mp4",
    allowOverwrite: true,
  });
  console.log(`Blob   : ${blob.url}`);

  // 1. register
  console.log("Registering video media…");
  const media = await registerVideoMedia();
  console.log(`  media_id: ${media.media_id}`);

  // 2. upload
  console.log("Uploading MP4 to Pinterest…");
  await uploadVideoToMedia(media.upload_url, media.upload_parameters, buffer);

  // 3. poll transcode
  console.log("Waiting for Pinterest transcode…");
  const deadline = Date.now() + 5 * 60 * 1000;
  let status = media.status;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await getMediaStatus(media.media_id);
    status = s.status;
    console.log(`  …${status}`);
    if (status === "succeeded") break;
    if (status === "failed") throw new Error("Pinterest transcode failed");
  }
  if (status !== "succeeded") throw new Error("Transcode timed out");

  // 4. create the pin
  const recipeJsonLd = article.recipeJsonLd as Record<string, unknown> | null;
  const recipeCategory = (recipeJsonLd?.recipeCategory as string) ?? "";
  const boardId = await getBoardForArticle(article.title, recipeCategory);
  const link = article.publishedUrl || getCanonicalUrl(article.slug);

  console.log(`Creating video pin on board ${boardId}…`);
  const pin = await createVideoPin({
    boardId,
    title: article.title || "Delicious Recipe",
    description: article.metaDescription || "",
    link,
    mediaId: media.media_id,
    coverImageUrl: article.pinImageUrl,
  });

  console.log(`\n✓ Video pin created: ${pin.id}`);
  console.log(`  View: https://www.pinterest.com/pin/${pin.id}/`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Publish failed:", err);
  process.exit(1);
});
